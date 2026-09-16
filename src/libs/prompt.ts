import type {SummarizerAvailabilityStatus} from "./summarizer.ts";

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatSessionMessage {
    role: ChatRole;
    content: string;
}

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

async function createSession(opts?: {
    initialPrompts?: ChatSessionMessage[];
    onDownloadProgress?: (ratio: number) => void;
}): Promise<any> {
    const LM = getLM();

    assertUserActivation();

    const availability = await readAvailability(LM);
    console.log("[Prompt] LanguageModel availability:", availability);
    if (availability === "unavailable") {
        throw new Error("Prompt API is unavailable on this device.");
    }

    return LM.create({
        initialPrompts: opts?.initialPrompts,
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

// --- Session pool ---------------------------------------------------------
// Each conversational context (a topic's "chat about this topic" thread, a
// topic's "chat about the current page" thread, etc.) gets its own isolated
// LanguageModel session, keyed by caller-supplied string. This replaces a
// previous single global-singleton session that every topic/page chat shared
// forever: that let unrelated conversations bleed into each other's context
// and made long-lived usage progressively more likely to hit the model's
// context window limit. Sessions here are cheap to create (the on-device
// model itself is already downloaded and shared by Chrome; creating a session
// just opens a new conversation against it), so one per context is fine.

const sessions = new Map<string, Promise<any>>();

export async function getChatSession(key: string, opts?: {
    systemPrompt?: string;
    onDownloadProgress?: (ratio: number) => void;
}): Promise<any> {
    const cached = sessions.get(key);
    if (cached) return cached;

    const initialPrompts: ChatSessionMessage[] | undefined = opts?.systemPrompt
        ? [{ role: "system", content: opts.systemPrompt }]
        : undefined;

    const creation = createSession({ initialPrompts, onDownloadProgress: opts?.onDownloadProgress }).catch((error) => {
        sessions.delete(key);
        throw error;
    });

    sessions.set(key, creation);
    return creation;
}

export async function destroyChatSession(key: string): Promise<void> {
    const existing = sessions.get(key);
    sessions.delete(key);
    if (!existing) return;
    try {
        const session = await existing;
        session?.destroy?.();
    } catch {
        // Session never finished creating; nothing to destroy.
    }
}

export async function destroyAllChatSessions(): Promise<void> {
    const keys = [...sessions.keys()];
    await Promise.all(keys.map((key) => destroyChatSession(key)));
}

// session.contextUsage/contextWindow track how much of the model's context
// budget the conversation has used so far. Use this to proactively trim RAG
// context instead of waiting for a QuotaExceededError.
export function getSessionUsage(session: any): { used: number; total: number } | null {
    const used = session?.contextUsage;
    const total = session?.contextWindow;
    if (typeof used === "number" && typeof total === "number" && total > 0) {
        return { used, total };
    }
    return null;
}

export interface PromptOptions {
    systemPrompt?: string;
    responseConstraint?: object;
}

export async function promptInSession(key: string, text: string, opts?: PromptOptions): Promise<string> {
    const session = await getChatSession(key, { systemPrompt: opts?.systemPrompt });
    const out: string = await session.prompt(
        String(text ?? ""),
        opts?.responseConstraint ? { responseConstraint: opts.responseConstraint } : undefined
    );
    return String(out ?? "");
}

// Chrome's current documented behavior is that each streamed chunk is an
// incremental delta meant to be appended (per developer.chrome.com/docs/ai/
// render-llm-responses), but this API has changed shape before (older builds
// emitted the full accumulated response per chunk). Rather than trust one
// behavior blindly, detect which mode is actually happening from the first
// two chunks and normalize to always yield deltas, so callers can just `+=`.
export async function* normalizeDeltaStream(stream: AsyncIterable<string>): AsyncIterable<string> {
    let accumulated = "";
    let mode: "unknown" | "delta" | "cumulative" = "unknown";

    for await (const chunk of stream) {
        if (mode === "unknown") {
            if (accumulated === "") {
                accumulated = chunk;
                if (chunk) yield chunk;
                continue;
            }
            mode = chunk.startsWith(accumulated) ? "cumulative" : "delta";
        }

        if (mode === "cumulative") {
            const delta = chunk.slice(accumulated.length);
            accumulated = chunk;
            if (delta) yield delta;
        } else {
            accumulated += chunk;
            if (chunk) yield chunk;
        }
    }
}

async function* rawSessionStream(session: any, text: string): AsyncIterable<string> {
    const rs: ReadableStream<string> = await session.promptStreaming(String(text ?? ""));
    const reader = rs.getReader();
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

export async function promptStreamInSession(key: string, text: string, opts?: PromptOptions): Promise<AsyncIterable<string>> {
    const session = await getChatSession(key, { systemPrompt: opts?.systemPrompt });
    return normalizeDeltaStream(rawSessionStream(session, text));
}

// --- Backward-compatible single-shot helpers ------------------------------
// For one-off, non-conversational calls that don't need a dedicated session
// (e.g. Settings' "warm up the model" check).
const DEFAULT_KEY = "__default__";

export async function prompt(text: string): Promise<string> {
    return promptInSession(DEFAULT_KEY, text);
}

export async function promptStream(text: string): Promise<AsyncIterable<string>> {
    return promptStreamInSession(DEFAULT_KEY, text);
}

export async function destroyPromptSession(): Promise<void> {
    return destroyChatSession(DEFAULT_KEY);
}

export async function ensurePromptReady(opts?: { onDownloadProgress?: (ratio: number) => void; forceWarmup?: boolean }) {
    const session = await getChatSession(DEFAULT_KEY, { onDownloadProgress: opts?.onDownloadProgress });

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
