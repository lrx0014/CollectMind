import type {SummarizerAvailabilityStatus} from "./summarizer.ts";

let _sessionPromise: Promise<any> | null = null;

function getLM(): any {
    const LM = (globalThis as any).LanguageModel || (window as any).LanguageModel;
    if (!LM) throw new Error("LanguageModel API not available.");
    return LM;
}

export async function getPromptAvailability(): Promise<SummarizerAvailabilityStatus> {
    let LM: any;
    try {
        LM = getLM();
    } catch (error) {
        console.warn("[Prompt] LanguageModel API not available.", error);
        return "unsupported";
    }

    try {
        const availability = await LM.availability?.();
        return typeof availability === "string" && availability.trim() ? availability : "unknown";
    } catch (error) {
        console.warn("[Prompt] Failed to read availability.", error);
        return "error";
    }
}

async function ensureSession(opts?: { onDownloadProgress?: (ratio: number) => void }): Promise<any> {
    if (_sessionPromise) return _sessionPromise;

    const LM = getLM();
    const availability = await LM.availability?.();

    console.log("[Prompt] LanguageModel availability:", availability);

    if (availability === "unavailable") {
        throw new Error("Prompt API is unavailable on this device.");
    }

    _sessionPromise = LM.create({
        monitor(m: EventTarget) {
            m.addEventListener("downloadprogress", (e: any) => {
                const value = Number(e?.loaded ?? 0);
                const ratio = Number.isFinite(value) ? value : 0;
                console.log(`[Prompt] model download: ${ratio * 100}%`);
                opts?.onDownloadProgress?.(ratio);
            });
        },
    });

    return _sessionPromise;
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
