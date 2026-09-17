import JSZip from 'jszip';
import db, { type ChatMessageRecord, type SavedPage, type Topic } from './db.ts';

const BACKUP_FORMAT_VERSION = 1;
const BACKUP_FOLDER = 'collectmind';
const MANIFEST_FILENAME = `${BACKUP_FOLDER}/manifest.json`;
const TOPICS_FILENAME = `${BACKUP_FOLDER}/topics.json`;
const SAVED_PAGES_FILENAME = `${BACKUP_FOLDER}/saved_pages.json`;
const CHAT_MESSAGES_FILENAME = `${BACKUP_FOLDER}/chat_messages.json`;

export const BACKUP_FILE_EXTENSION = '.collectmind.backup.zip';

export interface BackupManifest {
    formatVersion: number;
    createdAt: string;
    schemaVersion: number;
    appVersion?: string;
    tables: Record<string, { rows: number }>;
}

export interface BackupArchive {
    blob: Blob;
    filename: string;
    manifest: BackupManifest;
}

type TopicRecord = Omit<Topic, 'id'> & { id?: number };
type SavedPageRecord = Omit<SavedPage, 'id'> & { id?: number };
type ChatMessageRecordOptionalId = Omit<ChatMessageRecord, 'id'> & { id?: number };

function toValidTimestamp(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Date.now();
}

function normalizeTopic(raw: any): TopicRecord {
    const idValue = Number(raw?.id);
    const normalized: TopicRecord = {
        id: Number.isFinite(idValue) && idValue > 0 ? idValue : undefined,
        name: String(raw?.name ?? ''),
        color_tag: String(raw?.color_tag ?? ''),
        color_tag_rgb: String(raw?.color_tag_rgb ?? ''),
        summary: String(raw?.summary ?? ''),
        create_time: toValidTimestamp(raw?.create_time),
        update_time: toValidTimestamp(raw?.update_time),
        is_deleted: raw?.is_deleted === 1 ? 1 : 0,
        summary_stale: raw?.summary_stale === 1 ? 1 : 0,
    };

    return normalized;
}

function normalizeSavedPage(raw: any): SavedPageRecord {
    const idValue = Number(raw?.id);
    const normalized: SavedPageRecord = {
        id: Number.isFinite(idValue) && idValue > 0 ? idValue : undefined,
        topic_id: Number(raw?.topic_id) || 0,
        url: String(raw?.url ?? ''),
        title: String(raw?.title ?? ''),
        icon: typeof raw?.icon === 'string' ? raw.icon : '',
        summary: typeof raw?.summary === 'string' ? raw.summary : '',
        create_time: toValidTimestamp(raw?.create_time),
        update_time: toValidTimestamp(raw?.update_time),
        is_deleted: raw?.is_deleted === 1 ? 1 : 0,
        // The search index isn't part of the backup archive (it's large,
        // regenerable, binary data), so restored pages always come back
        // unindexed; Settings > "Rebuild index" repopulates it afterwards.
        content_hash: '',
        indexed_at: 0,
    };

    return normalized;
}

function normalizeChatMessage(raw: any): ChatMessageRecordOptionalId {
    const idValue = Number(raw?.id);
    const sender = raw?.sender === 'ai' ? 'ai' : 'user';
    const normalized: ChatMessageRecordOptionalId = {
        id: Number.isFinite(idValue) && idValue > 0 ? idValue : undefined,
        topic_id: Number(raw?.topic_id) || 0,
        sender,
        text: typeof raw?.text === 'string' ? raw.text : '',
        created_at: toValidTimestamp(raw?.created_at),
    };

    return normalized;
}

function forExport<T extends { id?: number }>(record: T): T & { id: number } {
    return {
        ...record,
        id: record.id ?? 0,
    };
}

async function readArrayFromZip(zip: JSZip, ...filenames: string[]): Promise<any[]> {
    for (const name of filenames) {
        const file = zip.file(name);
        if (!file) {
            continue;
        }

        try {
            const text = await file.async('string');
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn(`[Backup] Failed to parse ${name}`, error);
            return [];
        }
    }

    return [];
}

export async function createBackupArchive(appVersion?: string): Promise<BackupArchive> {
    const [rawTopics, rawSavedPages, rawChatMessages] = await Promise.all([
        db.topics.toArray(),
        db.saved_pages.toArray(),
        db.chat_messages.toArray(),
    ]);

    const normalizedTopics = rawTopics
        .map(normalizeTopic)
        .filter(topic => topic.is_deleted !== 1);
    const normalizedSavedPages = rawSavedPages
        .map(normalizeSavedPage)
        .filter(page => page.is_deleted !== 1);

    const topics = normalizedTopics.map(record => forExport(record));
    const savedPages = normalizedSavedPages.map(record => forExport(record));
    const chatMessages = rawChatMessages.map(record => forExport(normalizeChatMessage(record)));

    const manifest: BackupManifest = {
        formatVersion: BACKUP_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        schemaVersion: db.verno,
        appVersion,
        tables: {
            topics: { rows: topics.length },
            saved_pages: { rows: savedPages.length },
            chat_messages: { rows: chatMessages.length },
        },
    };

    const zip = new JSZip();
    zip.file(MANIFEST_FILENAME, JSON.stringify(manifest, null, 2));
    zip.file(TOPICS_FILENAME, JSON.stringify(topics, null, 2));
    zip.file(SAVED_PAGES_FILENAME, JSON.stringify(savedPages, null, 2));
    zip.file(CHAT_MESSAGES_FILENAME, JSON.stringify(chatMessages, null, 2));

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
    });

    const filename = `collectmind-backup-${Date.now()}${BACKUP_FILE_EXTENSION}`;

    return { blob, filename, manifest };
}

export function downloadBackupArchive(archive: BackupArchive): void {
    const url = URL.createObjectURL(archive.blob);

    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = archive.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } finally {
        URL.revokeObjectURL(url);
    }
}

export interface RestoreSummary {
    manifest: BackupManifest;
    restored: {
        topics: number;
        saved_pages: number;
        chat_messages: number;
    };
}

export async function restoreBackupFromFile(file: File | Blob): Promise<RestoreSummary> {
    const zip = await JSZip.loadAsync(file);

    const manifestFile = zip.file(MANIFEST_FILENAME) ?? zip.file('manifest.json');
    if (!manifestFile) {
        throw new Error('Invalid backup: missing manifest.');
    }
    const parsedManifest = JSON.parse(await manifestFile.async('string')) as Partial<BackupManifest>;
    const formatVersion = Number((parsedManifest as { formatVersion?: number }).formatVersion ?? 1);

    if (formatVersion > BACKUP_FORMAT_VERSION) {
        throw new Error(`Unsupported backup format version: ${formatVersion}`);
    }

    const manifest: BackupManifest = {
        formatVersion,
        createdAt: typeof parsedManifest.createdAt === 'string' ? parsedManifest.createdAt : new Date().toISOString(),
        schemaVersion: Number((parsedManifest as { schemaVersion?: number }).schemaVersion ?? 0),
        appVersion: parsedManifest.appVersion,
        tables: parsedManifest.tables ?? {},
    };

    const [topicsRaw, savedPagesRaw, chatMessagesRaw] = await Promise.all([
        readArrayFromZip(zip, TOPICS_FILENAME, 'topics.json'),
        readArrayFromZip(zip, SAVED_PAGES_FILENAME, 'saved_pages.json'),
        readArrayFromZip(zip, CHAT_MESSAGES_FILENAME, 'chat_messages.json'),
    ]);

    const topics = Array.isArray(topicsRaw) ? topicsRaw.map(normalizeTopic) : [];
    const savedPages = Array.isArray(savedPagesRaw) ? savedPagesRaw.map(normalizeSavedPage) : [];
    const chatMessages = Array.isArray(chatMessagesRaw) ? chatMessagesRaw.map(normalizeChatMessage) : [];

    await db.transaction('rw', db.topics, db.saved_pages, db.chat_messages, db.chunks, async () => {
        await Promise.all([
            db.topics.clear(),
            db.saved_pages.clear(),
            db.chat_messages.clear(),
            // Restored pages are marked unindexed above; drop any old chunks so
            // they don't dangle against page ids that may now mean something
            // else (or point at pages restored with indexed_at reset to 0).
            db.chunks.clear(),
        ]);

        if (topics.length > 0) {
            await db.topics.bulkPut(topics);
        }
        if (savedPages.length > 0) {
            await db.saved_pages.bulkPut(savedPages);
        }
        if (chatMessages.length > 0) {
            await db.chat_messages.bulkPut(chatMessages);
        }
    });

    const restoredCounts = {
        topics: topics.filter(topic => topic.is_deleted !== 1).length,
        saved_pages: savedPages.filter(page => page.is_deleted !== 1).length,
        chat_messages: chatMessages.length,
    };

    manifest.tables = {
        ...manifest.tables,
        topics: { rows: restoredCounts.topics },
        saved_pages: { rows: restoredCounts.saved_pages },
        chat_messages: { rows: restoredCounts.chat_messages },
    };

    return {
        manifest,
        restored: restoredCounts,
    };
}
