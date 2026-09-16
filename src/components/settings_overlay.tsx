import React, {useEffect, useMemo, useRef, useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import {ensureSummarizerReady, getSummarizerAvailability, type SummarizerAvailabilityStatus} from "../libs/summarizer.ts";
import {ensurePromptReady, getPromptAvailability} from "../libs/prompt.ts";
import {createBackupArchive, downloadBackupArchive, restoreBackupFromFile} from "../libs/backup.ts";
import {getAiCapabilities, type EmbeddingAvailabilityStatus} from "../libs/capabilities.ts";
import {reindexAllPages} from "../libs/rag/indexer.ts";
import db from "../libs/db.ts";
import "../styles/settings_overlay.css";

interface SettingsOverlayProps {
    open: boolean;
    onClose: () => void;
    appName: string;
    version: string;
}

type StatusBadge = {
    label: string;
    tone: "success" | "warning" | "danger" | "neutral" | "pending";
};

function toPercent(ratio: number | null): number | null {
    if (ratio == null || !Number.isFinite(ratio)) {
        return null;
    }
    return Math.floor(Math.max(0, Math.min(100, ratio * 100)));
}

const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ open, onClose, appName, version }) => {
    const [summarizerAvailability, setSummarizerAvailability] = useState<SummarizerAvailabilityStatus | null>(null);
    const [isSummarizerChecking, setIsSummarizerChecking] = useState(false);
    const [isSummarizerDownloading, setIsSummarizerDownloading] = useState(false);
    const [summarizerDownloadProgress, setSummarizerDownloadProgress] = useState<number | null>(null);
    const [summarizerStatusError, setSummarizerStatusError] = useState<string | null>(null);

    const [promptAvailability, setPromptAvailability] = useState<SummarizerAvailabilityStatus | null>(null);
    const [isPromptChecking, setIsPromptChecking] = useState(false);
    const [isPromptDownloading, setIsPromptDownloading] = useState(false);
    const [promptDownloadProgress, setPromptDownloadProgress] = useState<number | null>(null);
    const [promptStatusError, setPromptStatusError] = useState<string | null>(null);

    const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
    const [embeddingAvailability, setEmbeddingAvailability] = useState<EmbeddingAvailabilityStatus | null>(null);
    const [isReindexing, setIsReindexing] = useState(false);
    const [reindexProgress, setReindexProgress] = useState<{ done: number; total: number } | null>(null);
    const [reindexError, setReindexError] = useState<string | null>(null);
    const [reindexInfoMessage, setReindexInfoMessage] = useState<string | null>(null);
    const chunkCount = useLiveQuery(() => db.chunks.count(), [], undefined);

    const [isBackupExporting, setIsBackupExporting] = useState(false);
    const [backupExportError, setBackupExportError] = useState<string | null>(null);
    const [isBackupRestoring, setIsBackupRestoring] = useState(false);
    const [backupRestoreError, setBackupRestoreError] = useState<string | null>(null);
    const [backupInfoMessage, setBackupInfoMessage] = useState<string | null>(null);
    const backupFileInputRef = useRef<HTMLInputElement | null>(null);

    const normalizedSummarizerAvailability = useMemo(
        () => (summarizerAvailability ?? "unknown").toString().toLowerCase(),
        [summarizerAvailability]
    );

    const normalizedPromptAvailability = useMemo(
        () => (promptAvailability ?? "unknown").toString().toLowerCase(),
        [promptAvailability]
    );

    const summarizerStatusBadge: StatusBadge = useMemo(() => {
        if (isSummarizerChecking) {
            return { label: "Checking…", tone: "neutral" };
        }
        if (isSummarizerDownloading) {
            const percent = toPercent(summarizerDownloadProgress);
            return { label: percent == null ? "Preparing…" : `${percent}%`, tone: "pending" };
        }

        switch (normalizedSummarizerAvailability) {
        case "available":
            return { label: "Ready", tone: "success" };
        case "downloadable":
            return { label: "Downloadable", tone: "warning" };
        case "unavailable":
            return { label: "Unavailable", tone: "danger" };
        case "unsupported":
            return { label: "Unsupported", tone: "neutral" };
        case "error":
            return { label: "Error", tone: "danger" };
        default:
            return { label: summarizerAvailability ?? "Unknown", tone: "neutral" };
        }
    }, [isSummarizerChecking, isSummarizerDownloading, normalizedSummarizerAvailability, summarizerAvailability, summarizerDownloadProgress]);

    const promptStatusBadge: StatusBadge = useMemo(() => {
        if (isPromptChecking) {
            return { label: "Checking…", tone: "neutral" };
        }
        if (isPromptDownloading) {
            const percent = toPercent(promptDownloadProgress);
            return { label: percent == null ? "Preparing…" : `${percent}%`, tone: "pending" };
        }

        switch (normalizedPromptAvailability) {
        case "available":
            return { label: "Ready", tone: "success" };
        case "downloadable":
            return { label: "Downloadable", tone: "warning" };
        case "unavailable":
            return { label: "Unavailable", tone: "danger" };
        case "unsupported":
            return { label: "Unsupported", tone: "neutral" };
        case "error":
            return { label: "Error", tone: "danger" };
        default:
            return { label: promptAvailability ?? "Unknown", tone: "neutral" };
        }
    }, [isPromptChecking, isPromptDownloading, normalizedPromptAvailability, promptAvailability, promptDownloadProgress]);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;

        const fetchSummarizerAvailability = async () => {
            setIsSummarizerChecking(true);
            setSummarizerStatusError(null);
            try {
                const status = await getSummarizerAvailability();
                if (!cancelled) {
                    setSummarizerAvailability(status);
                }
            } catch (error) {
                console.warn("[Settings] Failed to fetch summarizer availability.", error);
                if (!cancelled) {
                    setSummarizerAvailability("error");
                    setSummarizerStatusError(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (!cancelled) {
                    setIsSummarizerChecking(false);
                }
            }
        };

        const fetchPromptAvailability = async () => {
            setIsPromptChecking(true);
            setPromptStatusError(null);
            try {
                const status = await getPromptAvailability();
                if (!cancelled) {
                    setPromptAvailability(status);
                }
            } catch (error) {
                console.warn("[Settings] Failed to fetch prompt availability.", error);
                if (!cancelled) {
                    setPromptAvailability("error");
                    setPromptStatusError(error instanceof Error ? error.message : String(error));
                }
            } finally {
                if (!cancelled) {
                    setIsPromptChecking(false);
                }
            }
        };

        const fetchEmbeddingAvailability = async () => {
            try {
                const caps = await getAiCapabilities();
                if (!cancelled) {
                    setEmbeddingAvailability(caps.embeddings);
                }
            } catch (error) {
                console.warn("[Settings] Failed to fetch embedding capability.", error);
                if (!cancelled) {
                    setEmbeddingAvailability("error");
                }
            }
        };

        const fetchStorageEstimate = async () => {
            try {
                if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
                const { usage, quota } = await navigator.storage.estimate();
                if (!cancelled) {
                    setStorageEstimate({ usage: usage ?? 0, quota: quota ?? 0 });
                }
            } catch (error) {
                console.warn("[Settings] Failed to read storage estimate.", error);
            }
        };

        fetchSummarizerAvailability();
        fetchPromptAvailability();
        fetchEmbeddingAvailability();
        fetchStorageEstimate();

        return () => {
            cancelled = true;
        };
    }, [open]);

    function formatBytes(bytes: number): string {
        if (bytes <= 0) return "0 MB";
        const mb = bytes / (1024 * 1024);
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        return `${(mb / 1024).toFixed(2)} GB`;
    }

    const embeddingStatusBadge: StatusBadge = useMemo(() => {
        switch (embeddingAvailability) {
        case "available":
            return { label: "Ready", tone: "success" };
        case "unsupported":
            return { label: "Unsupported", tone: "neutral" };
        case "error":
            return { label: "Error", tone: "danger" };
        default:
            return { label: "Checking…", tone: "neutral" };
        }
    }, [embeddingAvailability]);

    const handleRebuildIndex = async () => {
        if (isReindexing) return;

        setIsReindexing(true);
        setReindexError(null);
        setReindexInfoMessage(null);
        setReindexProgress({ done: 0, total: 0 });

        try {
            await reindexAllPages((done, total) => setReindexProgress({ done, total }));
            setReindexInfoMessage("Search index rebuilt.");
        } catch (error) {
            console.error("[Settings] Rebuild index failed.", error);
            setReindexError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsReindexing(false);
        }
    };

    const handleSummarizerDownload = async () => {
        if (isSummarizerDownloading || isSummarizerChecking) {
            return;
        }

        setIsSummarizerDownloading(true);
        setSummarizerStatusError(null);
        setSummarizerDownloadProgress(0);

        try {
            await ensureSummarizerReady({
                onDownloadProgress(ratio) {
                    const value = Number(ratio);
                    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
                    setSummarizerDownloadProgress(clamped);
                },
            });
            setSummarizerDownloadProgress(1);
        } catch (error) {
            console.warn("[Settings] Manual summarizer download failed.", error);
            const message = error instanceof Error ? error.message : String(error);
            setSummarizerStatusError(message || "Failed to download model.");
            if (/unsupported/i.test(message)) {
                setSummarizerAvailability("unsupported");
            } else {
                setSummarizerAvailability("error");
            }
            setIsSummarizerDownloading(false);
            return;
        }

        setIsSummarizerDownloading(false);

        try {
            const status = await getSummarizerAvailability();
            setSummarizerAvailability(status);
        } catch (error) {
            console.warn("[Settings] Failed to refresh summarizer availability after download.", error);
            setSummarizerAvailability("error");
            setSummarizerStatusError(error instanceof Error ? error.message : String(error));
        }
    };

    const handlePromptDownload = async () => {
        console.log("[Settings] Prompt download requested.");
        if (isPromptDownloading || isPromptChecking) {
            console.log("[Settings] Prompt download already in progress.");
            return;
        }

        setIsPromptDownloading(true);
        setPromptStatusError(null);
        setPromptDownloadProgress(0);

        try {
            await ensurePromptReady({
                onDownloadProgress(ratio) {
                    const value = Number(ratio);
                    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
                    setPromptDownloadProgress(clamped);
                },
            });
            setPromptDownloadProgress(1);
        } catch (error) {
            console.warn("[Settings] Manual prompt download failed.", error);
            const message = error instanceof Error ? error.message : String(error);
            setPromptStatusError(message || "Failed to download model.");
            if (/unsupported/i.test(message)) {
                setPromptAvailability("unsupported");
            } else {
                setPromptAvailability("error");
            }
            setIsPromptDownloading(false);
            return;
        }

        setIsPromptDownloading(false);

        try {
            const status = await getPromptAvailability();
            setPromptAvailability(status);
        } catch (error) {
            console.warn("[Settings] Failed to refresh prompt availability after download.", error);
            setPromptAvailability("error");
            setPromptStatusError(error instanceof Error ? error.message : String(error));
        }
    };

    const handleBackupExport = async () => {
        if (isBackupExporting) {
            return;
        }

        setIsBackupExporting(true);
        setBackupExportError(null);
        setBackupRestoreError(null);
        setBackupInfoMessage(null);

        try {
            const archive = await createBackupArchive(version);
            downloadBackupArchive(archive);
            setBackupInfoMessage(
                `Backup created ${new Date(archive.manifest.createdAt).toLocaleString()} with ${archive.manifest.tables.topics.rows} active topics.`
            );
        } catch (error) {
            console.error("[Settings] Backup export failed.", error);
            setBackupExportError(error instanceof Error ? error.message : String(error));
            setBackupInfoMessage(null);
        } finally {
            setIsBackupExporting(false);
        }
    };

    const handleBackupRestoreRequest = () => {
        backupFileInputRef.current?.click();
    };

    const handleBackupFileChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        const confirmed = window.confirm(
            "Restoring a backup will delete all current topics, saved pages, and chat history, then replace them with the backup contents.\n\nThis action cannot be undone. Do you want to continue?"
        );

        if (!confirmed) {
            setBackupInfoMessage("Restore cancelled.");
            setBackupRestoreError(null);
            return;
        }

        setIsBackupRestoring(true);
        setBackupRestoreError(null);
        setBackupInfoMessage(null);

        try {
            const summary = await restoreBackupFromFile(file);
            const { topics, saved_pages, chat_messages } = summary.restored;
            setBackupInfoMessage(
                `Restore complete: ${topics} topics, ${saved_pages} saved pages, ${chat_messages} chat messages.`
            );
        } catch (error) {
            console.error("[Settings] Backup restore failed.", error);
            setBackupRestoreError(error instanceof Error ? error.message : String(error));
            setBackupInfoMessage(null);
        } finally {
            setIsBackupRestoring(false);
        }
    };

    // "unavailable" comes straight from Chrome's own Summarizer/LanguageModel
    // .availability() call — it means this specific device doesn't meet
    // Chrome's on-device model requirements (>=22GB free disk, a GPU with
    // >4GB VRAM or 16GB+ RAM/4+ CPU cores) or the model component hasn't
    // synced yet, not that the extension is broken. Point people at Chrome's
    // own diagnostics page instead of leaving them with just an error string.
    const openOnDeviceInternals = () => {
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
            chrome.tabs.create({ url: "chrome://on-device-internals" }).catch((error) => console.error(error));
        } else {
            window.open("chrome://on-device-internals", "_blank");
        }
    };

    const unavailabilityHint = (
        <div className="setting-hint-block">
            <p className="setting-hint">
                This is reported by Chrome itself, not by CollectMind. Common causes: less than 22GB free disk space,
                a GPU with 4GB or less VRAM combined with under 16GB RAM/4 CPU cores, or the on-device model component
                hasn&apos;t finished syncing yet. Check <code>chrome://components</code> for &quot;Optimization Guide On
                Device Model&quot; and force an update there, or open the diagnostics page below for details.
            </p>
            <button type="button" className="setting-action setting-action--ghost" onClick={openOnDeviceInternals}>
                Open chrome://on-device-internals
            </button>
        </div>
    );

    const showSummarizerDownloadButton = useMemo(() => {
        if (isSummarizerChecking || isSummarizerDownloading) return false;
        if (normalizedSummarizerAvailability === "unsupported") return false;
        if (normalizedSummarizerAvailability === "available") return false;
        return true;
    }, [isSummarizerChecking, isSummarizerDownloading, normalizedSummarizerAvailability]);

    const showPromptDownloadButton = useMemo(() => {
        if (isPromptChecking || isPromptDownloading) return false;
        if (normalizedPromptAvailability === "unsupported") return false;
        if (normalizedPromptAvailability === "available") return false;
        return true;
    }, [isPromptChecking, isPromptDownloading, normalizedPromptAvailability]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    const summarizerProgressPercent = toPercent(summarizerDownloadProgress) ?? 0;
    const promptProgressPercent = toPercent(promptDownloadProgress) ?? 0;

    return (
        <div className="settings-overlay" role="dialog" aria-modal="true">
            <div className="settings-backdrop" onClick={onClose} />
            <div className="settings-content">
                <button className="settings-close" onClick={onClose} aria-label="Close settings">&times;</button>
                <img
                    className="settings-logo"
                    src="/images/icon_origin.png"
                    alt={`${appName} logo`}
                    width={96}
                    height={96}
                />
                <h1 className="settings-title">{appName}</h1>
                <p className="settings-version">Version {version}</p>
                <div className="settings-divider" aria-hidden="true" />
                <div className="settings-panel">
                    <div className="settings-panel-header">
                        <h2 className="settings-panel-title">Settings</h2>
                        <p className="settings-panel-subtitle">Manage on-device capabilities.</p>
                    </div>

                    <div className="setting-card">
                        <div className="setting-card-header">
                            <span className="setting-card-label">Summarizer status</span>
                            <span className={`setting-status setting-status--${summarizerStatusBadge.tone}`}>
                                {summarizerStatusBadge.label}
                            </span>
                        </div>
                        <p className="setting-card-description">
                            Check the Chrome summarizer model availability on this device.
                        </p>

                        {isSummarizerDownloading && (
                            <div className="setting-progress" aria-live="polite">
                                <div className="setting-progress-track">
                                    <div
                                        className="setting-progress-bar"
                                        style={{ width: `${summarizerProgressPercent}%` }}
                                    />
                                </div>
                                <span className="setting-progress-value">
                                    {summarizerDownloadProgress == null ? "Starting…" : `${summarizerProgressPercent}%`}
                                </span>
                            </div>
                        )}

                        {summarizerStatusError && (
                            <p className="setting-error" role="alert">{summarizerStatusError}</p>
                        )}

                        {normalizedSummarizerAvailability === "unavailable" && unavailabilityHint}

                        {showSummarizerDownloadButton && (
                            <button
                                type="button"
                                className="setting-action"
                                onClick={handleSummarizerDownload}
                                disabled={isSummarizerDownloading || isSummarizerChecking}
                            >
                                Download
                            </button>
                        )}
                    </div>

                    <div className="setting-card">
                        <div className="setting-card-header">
                            <span className="setting-card-label">Prompt status</span>
                            <span className={`setting-status setting-status--${promptStatusBadge.tone}`}>
                                {promptStatusBadge.label}
                            </span>
                        </div>
                        <p className="setting-card-description">
                            Monitor the Chrome prompt model used for chat responses.
                        </p>

                        {isPromptDownloading && (
                            <div className="setting-progress" aria-live="polite">
                                <div className="setting-progress-track">
                                    <div
                                        className="setting-progress-bar"
                                        style={{ width: `${promptProgressPercent}%` }}
                                    />
                                </div>
                                <span className="setting-progress-value">
                                    {promptDownloadProgress == null ? "Starting…" : `${promptProgressPercent}%`}
                                </span>
                            </div>
                        )}

                        {promptStatusError && (
                            <p className="setting-error" role="alert">{promptStatusError}</p>
                        )}

                        {normalizedPromptAvailability === "unavailable" && unavailabilityHint}

                        {showPromptDownloadButton && (
                            <button
                                type="button"
                                className="setting-action"
                                onClick={handlePromptDownload}
                                disabled={isPromptDownloading || isPromptChecking}
                            >
                                Download
                            </button>
                        )}
                    </div>

                    <div className="setting-card">
                        <div className="setting-card-header">
                            <span className="setting-card-label">Search index</span>
                            <span className={`setting-status setting-status--${embeddingStatusBadge.tone}`}>
                                {embeddingStatusBadge.label}
                            </span>
                        </div>
                        <p className="setting-card-description">
                            On-device embeddings used to find relevant saved pages when you chat, instead of stuffing every page into the prompt. {chunkCount ?? 0} chunk{chunkCount === 1 ? "" : "s"} indexed.
                            {storageEstimate && storageEstimate.quota > 0 && (
                                <> Using {formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)} available storage.</>
                            )}
                        </p>

                        {isReindexing && reindexProgress && (
                            <div className="setting-progress" aria-live="polite">
                                <div className="setting-progress-track">
                                    <div
                                        className="setting-progress-bar"
                                        style={{
                                            width: reindexProgress.total > 0
                                                ? `${Math.floor((reindexProgress.done / reindexProgress.total) * 100)}%`
                                                : "0%",
                                        }}
                                    />
                                </div>
                                <span className="setting-progress-value">
                                    {reindexProgress.total > 0
                                        ? `${reindexProgress.done}/${reindexProgress.total}`
                                        : "Starting…"}
                                </span>
                            </div>
                        )}

                        {reindexError && (
                            <p className="setting-error" role="alert">{reindexError}</p>
                        )}

                        {reindexInfoMessage && !reindexError && (
                            <p className="setting-success" role="status">{reindexInfoMessage}</p>
                        )}

                        <button
                            type="button"
                            className="setting-action"
                            onClick={handleRebuildIndex}
                            disabled={isReindexing || embeddingAvailability !== "available"}
                        >
                            {isReindexing ? "Rebuilding…" : "Rebuild index"}
                        </button>
                    </div>

                    <div className="setting-card">
                        <div className="setting-card-header">
                            <div className="setting-card-copy">
                                <span className="setting-card-label">Backup &amp; Restore</span>
                                <span className="setting-card-description">
                                    Export your saved content for safekeeping or restore it from a backup file.
                                </span>
                            </div>
                        </div>

                        <div className="setting-actions">
                            <button
                                type="button"
                                className="setting-action"
                                onClick={handleBackupExport}
                                disabled={isBackupExporting || isBackupRestoring}
                            >
                                {isBackupExporting ? "Preparing…" : "Export backup"}
                            </button>
                            <button
                                type="button"
                                className="setting-action setting-action--ghost"
                                onClick={handleBackupRestoreRequest}
                                disabled={isBackupRestoring || isBackupExporting}
                            >
                                {isBackupRestoring ? "Restoring…" : "Restore from file"}
                            </button>
                            <input
                                ref={backupFileInputRef}
                                type="file"
                                accept=".collectmind.backup.zip,application/zip,.zip"
                                style={{ display: "none" }}
                                onChange={handleBackupFileChange}
                            />
                        </div>

                        <p className="setting-hint">
                            Restoring replaces your current data with the backup you choose.
                        </p>

                        {backupExportError && (
                            <p className="setting-error" role="alert">{backupExportError}</p>
                        )}

                        {backupRestoreError && (
                            <p className="setting-error" role="alert">{backupRestoreError}</p>
                        )}

                        {backupInfoMessage && !backupRestoreError && (
                            <p className="setting-success" role="status">{backupInfoMessage}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsOverlay;
