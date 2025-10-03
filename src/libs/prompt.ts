import type {SummarizerAvailabilityStatus} from "./summarizer.ts";

let _sessionPromise: Promise<any> | null = null;

function getLM(): any {
    const LM = (globalThis as any).LanguageModel || (window as any).LanguageModel;
    if (!LM) throw new Error("LanguageModel API not available.");
    return LM;
}

async function readAvailability(LM: any): Promise<SummarizerAvailabilityStatus> {
    try {
        const availability = await LM.availability?.();
        return typeof availability === "string" && availability.trim() ? availability : "unknown";
    } catch (error) {
        console.warn("[Prompt] Failed to read availability.", error);
        return "error";
    }
}

function extractProgressRatio(event: any): number | null {
    const candidates = [
        event?.loaded,
        event?.progress,
        event?.detail?.loaded,
        event?.detail?.progress,
        event?.target?.loaded,
        event?.target?.progress,
        event?.currentTarget?.loaded,
        event?.currentTarget?.progress,
    ];

    const raw = candidates.find((value) => typeof value === "number" && Number.isFinite(value));
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return null;
    }

    const totalCandidates = [
        event?.total,
        event?.detail?.total,
        event?.target?.total,
        event?.currentTarget?.total,
    ];

    const total = totalCandidates.find((value) => typeof value === "number" && Number.isFinite(value) && value > 0);

    let ratio = raw;
    if (typeof total === "number" && total > 0 && raw > 1) {
        ratio = raw / total;
    } else if (raw > 1) {
        ratio = raw <= 100 ? raw / 100 : 1;
    }

    return Math.max(0, Math.min(1, ratio));
}

function assertUserActivation(): void {
    try {
        if (typeof navigator === "undefined") return;
        const activation = (navigator as any).userActivation;
        if (activation && activation.isActive === false) {
            throw new Error("Prompt model creation requires a recent user gesture.");
        }
    } catch (_err) {
        // Ignore environments without navigator/userActivation support.
    }
}

export async function getPromptAvailability(): Promise<SummarizerAvailabilityStatus> {
    let LM: any;
    try {
        LM = getLM();
    } catch (error) {
        console.warn("[Prompt] LanguageModel API not available.", error);
        return "unsupported";
    }

    return readAvailability(LM);
}

async function createSession(opts?: { onDownloadProgress?: (ratio: number) => void }): Promise<any> {
    const LM = getLM();

    assertUserActivation();

    const availability = await readAvailability(LM);
    console.log("[Prompt] LanguageModel availability:", availability);
    if (availability === "unavailable") {
        throw new Error("Prompt API is unavailable on this device.");
    }

    return LM.create({
        monitor(m: EventTarget) {
            m.addEventListener("downloadprogress", (e: any) => {
                const ratio = extractProgressRatio(e);
                if (ratio != null) {
                    console.log(`Downloaded ${Math.round(ratio * 100)}%`);
                    opts?.onDownloadProgress?.(ratio);
                } else {
                    console.log("[Prompt] downloadprogress event", e);
                }
            });
        },
    });
}

async function ensureSession(opts?: { onDownloadProgress?: (ratio: number) => void }): Promise<any> {
    if (_sessionPromise) return _sessionPromise;

    _sessionPromise = createSession(opts);

    try {
        return await _sessionPromise;
    } catch (error) {
        _sessionPromise = null;
        throw error;
    }
}

export async function prompt(text: string): Promise<string> {
    const session = await ensureSession();
    const out: string = await session.prompt(String(text ?? ""));
    return String(out ?? "");
}

export async function promptStream(text: string): Promise<AsyncIterable<string>> {
    const session = await ensureSession();
    const rs: ReadableStream<string> = await session.promptStreaming(String(text ?? ""));

    const reader = rs.getReader();
    async function* iterator() {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                yield String(value ?? "");
            }
        } finally {
            try { reader.releaseLock(); } catch { /* empty */ }
        }
    }
    return iterator();
}

/** 可选：销毁已创建的会话 */
export async function destroyPromptSession() {
    try { (await _sessionPromise)?.destroy?.(); } catch { /* empty */ }
    _sessionPromise = null;
}

export async function ensurePromptReady(opts?: { onDownloadProgress?: (ratio: number) => void; forceWarmup?: boolean }) {
    const session = await ensureSession(opts);

    const availability = await getPromptAvailability();
    if (availability === "available" && !opts?.forceWarmup) {
        return session;
    }

    try {
        await session.prompt("Warm up the on-device prompt model.");
    } catch (error) {
        console.warn("[Prompt] Warmup prompt call failed.", error);
        throw error;
    }

    return session;
}
