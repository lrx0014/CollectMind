// Manual "backup to / restore from Google Drive" sync (not automatic
// background sync — real multi-device merge sync is a meaningfully bigger
// feature with its own conflict-resolution engine; this covers "let me save
// a snapshot I can pick up on another browser" instead).
//
// Each backup is its own file (name carries a timestamp for readability, but
// the list is sorted by Drive's own createdTime) — restoring means picking
// which one, and always fully overwrites local data (last-write-wins at the
// granularity of "an entire backup", not per-record). Reuses the existing
// local backup archive format as-is (backup.ts); the only thing that changes
// is where the .zip lives: the user's Drive "appDataFolder", a hidden,
// per-app folder that doesn't show up in their normal Drive UI and that this
// extension can only see its own files in (scope: drive.appdata, the
// narrowest Drive scope that still lets an app manage files it owns).
//
// Embeddings/chunks are deliberately NOT included — they're large, derived,
// and regenerable locally via Settings > "Rebuild index" on each device.

import { createBackupArchive, restoreBackupFromFile, type RestoreSummary } from '../backup.ts';

const BACKUP_FILE_PREFIX = 'collectmind-backup-';
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveAccountInfo {
    email: string;
}

function getIdentity() {
    if (typeof chrome === 'undefined' || !chrome.identity) {
        throw new Error('Google sign-in is only available inside the Chrome extension.');
    }
    return chrome.identity;
}

function getRuntimeErrorMessage(): string | undefined {
    return typeof chrome !== 'undefined' ? chrome.runtime?.lastError?.message : undefined;
}

// chrome.identity.getProfileUserInfo() reads the email of whichever Google
// account is signed into the Chrome profile itself — no OAuth token needed,
// and no "is CollectMind connected" state of its own. We use it purely to
// display *which* account backups will go to/come from once getAuthToken()
// has actually been granted access.
export async function getProfileAccountInfo(): Promise<DriveAccountInfo | null> {
    const identity = getIdentity();
    return new Promise((resolve) => {
        identity.getProfileUserInfo({ accountStatus: 'ANY' }, (info) => {
            const message = getRuntimeErrorMessage();
            if (message || !info?.email) {
                resolve(null);
                return;
            }
            resolve({ email: info.email });
        });
    });
}

async function getAuthToken(interactive: boolean): Promise<string> {
    const identity = getIdentity();
    return new Promise((resolve, reject) => {
        identity.getAuthToken({ interactive }, (result) => {
            const message = getRuntimeErrorMessage();
            if (message) {
                reject(new Error(message));
                return;
            }
            // Chrome's callback shape has changed across versions: older
            // builds pass the token string directly, newer ones pass
            // { token, grantedScopes }. Handle both.
            const token = typeof result === 'string' ? result : (result as { token?: string } | undefined)?.token;
            if (!token) {
                reject(new Error('Google did not return an access token.'));
                return;
            }
            resolve(token);
        });
    });
}

// Checks whether we already hold a granted (cached) token, without ever
// prompting the user — used on Settings open to silently show "already
// connected as ..." instead of making them click Connect every time.
export async function getConnectionStatus(): Promise<DriveAccountInfo | null> {
    try {
        await getAuthToken(false);
    } catch {
        return null;
    }
    return getProfileAccountInfo();
}

export async function connectGoogleAccount(): Promise<DriveAccountInfo> {
    await getAuthToken(true);
    const info = await getProfileAccountInfo();
    if (!info) {
        throw new Error('Connected, but could not read the Google account email (check the identity.email permission).');
    }
    return info;
}

export async function disconnectGoogleAccount(): Promise<void> {
    const identity = getIdentity();
    const token = await getAuthToken(false).catch(() => null);

    await new Promise<void>((resolve) => identity.clearAllCachedAuthTokens(() => resolve()));

    if (token) {
        // Best-effort: also revoke the token with Google so it can't be reused
        // elsewhere. Cache is already cleared either way, so failures here
        // aren't fatal to "disconnect" from the extension's point of view.
        try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' });
        } catch (error) {
            console.warn('[DriveSync] Failed to revoke token with Google.', error);
        }
    }
}

async function driveFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, {
        ...init,
        headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Google Drive request failed (${res.status}). ${body.slice(0, 200)}`);
    }
    return res;
}

// Builds a `multipart/related` body (Drive's upload format for setting both
// file metadata and content in one request) as a Blob, so we're not pulling
// in a form-data polyfill for something this small.
function buildMultipartBody(metadata: object, content: Blob, boundary: string): Blob {
    const CRLF = '\r\n';
    const head =
        `--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}` +
        `${JSON.stringify(metadata)}${CRLF}--${boundary}${CRLF}Content-Type: application/zip${CRLF}${CRLF}`;
    const tail = `${CRLF}--${boundary}--`;
    return new Blob([head, content, tail]);
}

// Human-readable + sortable-by-eye, e.g. "collectmind-backup-20260917-134502-a1b2.zip".
// The trailing random suffix just avoids same-second name collisions; actual
// list ordering always comes from Drive's own createdTime, not the name.
function buildBackupFileName(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${BACKUP_FILE_PREFIX}${stamp}-${suffix}.zip`;
}

export interface DriveBackupEntry {
    id: string;
    name: string;
    createdTime: string;
    size?: number;
}

export async function listDriveBackups(): Promise<DriveBackupEntry[]> {
    const token = await getAuthToken(true);
    const params = new URLSearchParams({
        spaces: 'appDataFolder',
        q: `name contains '${BACKUP_FILE_PREFIX}' and trashed = false`,
        fields: 'files(id, name, createdTime, size)',
        orderBy: 'createdTime desc',
        pageSize: '100',
    });
    const res = await driveFetch(`${DRIVE_FILES_API}?${params.toString()}`, token);
    const data = await res.json() as { files?: { id: string; name: string; createdTime: string; size?: string }[] };
    return (data.files ?? []).map(f => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
        size: f.size ? Number(f.size) : undefined,
    }));
}

export interface DriveBackupResult {
    entry: DriveBackupEntry;
    rows: { topics: number; saved_pages: number; chat_messages: number };
}

// Always creates a new file — backups are a list you pick from, not a single
// slot that gets clobbered on every save.
export async function backupToDrive(appVersion?: string): Promise<DriveBackupResult> {
    const token = await getAuthToken(true);
    const archive = await createBackupArchive(appVersion);
    const name = buildBackupFileName();

    const boundary = `collectmind-${Date.now()}`;
    const body = buildMultipartBody({ name, parents: ['appDataFolder'] }, archive.blob, boundary);
    const response = await driveFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,createdTime,size`, token, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
    });

    const data = await response.json() as { id: string; name: string; createdTime: string; size?: string };
    return {
        entry: { id: data.id, name: data.name, createdTime: data.createdTime, size: data.size ? Number(data.size) : undefined },
        rows: {
            topics: archive.manifest.tables.topics?.rows ?? 0,
            saved_pages: archive.manifest.tables.saved_pages?.rows ?? 0,
            chat_messages: archive.manifest.tables.chat_messages?.rows ?? 0,
        },
    };
}

export interface DriveRestoreResult {
    restored: RestoreSummary['restored'];
}

// Caller is responsible for confirming with the user first — this
// unconditionally wipes and replaces all local topics/pages/chat history,
// same as restoreBackupFromFile() does for local-file restores.
export async function restoreFromDriveBackup(fileId: string): Promise<DriveRestoreResult> {
    const token = await getAuthToken(true);
    const contentRes = await driveFetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, token);
    const blob = await contentRes.blob();
    const summary = await restoreBackupFromFile(blob);
    return { restored: summary.restored };
}

export async function deleteDriveBackup(fileId: string): Promise<void> {
    const token = await getAuthToken(true);
    await driveFetch(`${DRIVE_FILES_API}/${fileId}`, token, { method: 'DELETE' });
}
