type SummaryType = "tldr" | "key-points" | "teaser" | "headline";
type SummaryFormat = "plain-text" | "markdown";
type SummaryLength = "short" | "medium" | "long";

declare const Summarizer: {
    availability(): Promise<string>;
    create(opts?: {
        type?: SummaryType;
        format?: SummaryFormat;
        length?: SummaryLength;
        sharedContext?: string;
        monitor?: (m: EventTarget) => void;
    }): Promise<{ summarize(text: string, opts?: { context?: string }): Promise<string> }>;
};

export interface SummarizeOptions {
    text: string;
    type?: SummaryType;
    format?: SummaryFormat;
    length?: SummaryLength;
    context?: string;
    sharedContext?: string;
    onDownloadProgress?: (ratio: number) => void;
    maxChars?: number;
}

export type SummarizerAvailabilityStatus =
    | "available"
    | "downloadable"
    | "unavailable"
    | "unsupported"
    | "error"
    | "unknown"
    | string;

export async function getSummarizerAvailability(): Promise<SummarizerAvailabilityStatus> {
    if (typeof Summarizer === "undefined") {
        return "unsupported";
    }

    return readSummarizerAvailability();
}

async function readSummarizerAvailability(): Promise<SummarizerAvailabilityStatus> {
    try {
        const status = await Summarizer.availability();
        return typeof status === "string" && status.trim() ? status : "unknown";
    } catch (error) {
        console.warn("[Summarizer] Failed to read availability.", error);
        return "error";
    }
}

function assertUserActivation(): void {
    try {
        if (typeof navigator === "undefined") return;
        const activation = (navigator as any).userActivation;
        if (activation && activation.isActive === false) {
            throw new Error("Summarizer model creation requires a recent user gesture.");
        }
    } catch (_err) {
        // Ignore environments without navigator/userActivation support.
    }
}
export async function ensureSummarizerReady(opts?: {
    type?: SummaryType;
    format?: SummaryFormat;
    length?: SummaryLength;
    sharedContext?: string;
    onDownloadProgress?: (ratio: number) => void;
    forceWarmup?: boolean;
}) {
    const summarizer = await getSummarizer({
        text: "",
        type: opts?.type,
        format: opts?.format,
        length: opts?.length,
        sharedContext: opts?.sharedContext,
        onDownloadProgress: opts?.onDownloadProgress,
    });

    if (!opts?.forceWarmup) {
        return summarizer;
    }

    try {
        await summarizer.summarize("Warm up the on-device summarizer model.");
    } catch (error) {
        console.warn("[Summarizer] Warmup summarize call failed.", error);
        throw error;
    }

    return summarizer;
}

type SummarizerInstance = Awaited<ReturnType<typeof Summarizer.create>>;

const cache = new Map<string, Promise<SummarizerInstance>>();
const def = { type: "key-points" as SummaryType, format: "plain-text" as SummaryFormat, length: "long" as SummaryLength };
const MAX_REDUCE_DEPTH = 4;
const DEFAULT_CHUNK_SIZE = 8_000;

function key(t: SummaryType, f: SummaryFormat, l: SummaryLength, s?: string) {
    return `${t}|${f}|${l}|${s ?? ""}`;
}

async function createSummarizer(opts: SummarizeOptions): Promise<SummarizerInstance> {
    if (typeof Summarizer === "undefined") {
        throw new Error("Summarizer API unsupported.");
    }

    const availability = await readSummarizerAvailability();
    console.log("[Summarizer] Availability:", availability);
    if (availability === "unavailable") {
        throw new Error("Summarizer API is unavailable on this device.");
    }
    if (availability !== "available" && availability !== "downloadable") {
        throw new Error(`Summarizer API not ready (status: ${availability}).`);
    }

    assertUserActivation();

    return Summarizer.create({
        type: opts.type ?? def.type,
        format: opts.format ?? def.format,
        length: opts.length ?? def.length,
        sharedContext: opts.sharedContext,
        monitor(m) {
            m.addEventListener("downloadprogress", (e: any) => {
                const loaded = Number(e?.loaded);
                if (!Number.isFinite(loaded)) {
                    console.log("[Summarizer] downloadprogress event", e);
                    return;
                }

                let ratio = loaded;
                if (ratio > 1) {
                    ratio = ratio <= 100 ? ratio / 100 : 1;
                }
                ratio = Math.max(0, Math.min(1, ratio));

                console.log(`Downloaded ${loaded * 100}%`);
                opts.onDownloadProgress?.(ratio);
            });
        },
    });
}

async function getSummarizer(opts: SummarizeOptions) {
    if (typeof Summarizer === "undefined") throw new Error("Summarizer API unsupported.");
    const k = key(opts.type ?? def.type, opts.format ?? def.format, opts.length ?? def.length, opts.sharedContext);
    const cached = cache.get(k);
    if (cached) return cached;

    const creation = createSummarizer(opts).catch((error) => {
        cache.delete(k);
        throw error;
    });

    const availability = await Summarizer.availability();
    console.log("[Summarizer] Availability:", availability);

    cache.set(k, creation);
    return creation;
}

function normalizeText(text: string) {
    return (text || "").replace(/\s+/g, " ").trim();
}

function chunkText(text: string, chunkSize: number): string[] {
    if (text.length <= chunkSize) return [text];

    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

type QuotaError = {
    name?: string;
    requested?: number;
    quota?: number;
};

function isQuotaExceededError(error: unknown): error is QuotaError {
    return !!error && typeof error === "object" && (error as QuotaError).name === "QuotaExceededError";
}

function clampChunkSize(size: number, opts: SummarizeOptions, upperBound?: number): number {
    const hardCap = opts.maxChars ?? Number.POSITIVE_INFINITY;
    let next = Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_CHUNK_SIZE;
    if (Number.isFinite(hardCap)) {
        next = Math.min(next, Math.floor(hardCap));
    }
    if (typeof upperBound === "number" && upperBound > 0) {
        next = Math.min(next, Math.floor(upperBound));
    }
    return Math.max(1, next);
}

function resolveChunkSizeFromError(error: QuotaError | null, textLength: number, opts: SummarizeOptions, current?: number): number {
    const upperBound = textLength > 1 ? textLength - 1 : undefined;
    const fallback = clampChunkSize(DEFAULT_CHUNK_SIZE, opts, upperBound);

    if (!error || typeof error.quota !== "number" || error.quota <= 0) {
        return fallback;
    }

    const quota = Math.floor(error.quota);
    const safeQuota = quota > 0 ? Math.floor(quota * 0.9) : 0;

    let candidate = safeQuota > 0 ? safeQuota : quota;

    if (typeof error.requested === "number" && error.requested > 0) {
        const ratio = error.quota / error.requested;
        const ratioCandidate = Math.floor(textLength * ratio * 0.9);
        if (ratioCandidate > 0) {
            candidate = candidate > 0 ? Math.min(candidate, ratioCandidate) : ratioCandidate;
        }
    }

    if (!Number.isFinite(candidate) || candidate <= 0) {
        candidate = fallback;
    }

    let chunkSize = clampChunkSize(candidate, opts, upperBound);

    if (typeof current === "number" && current > 1 && chunkSize >= current) {
        chunkSize = clampChunkSize(current - 1, opts, upperBound);
    }

    if (chunkSize >= textLength && textLength > 1) {
        chunkSize = clampChunkSize(textLength - 1, opts, upperBound);
    }

    return Math.max(1, chunkSize);
}

async function summarizeInternal(
    summarizer: Awaited<ReturnType<typeof getSummarizer>>,
    text: string,
    opts: SummarizeOptions
): Promise<string> {
    const out = await summarizer.summarize(text, opts.context ? { context: opts.context } : undefined);
    return (out ?? "").toString().trim();
}

async function reduceSummaries(
    summarizer: Awaited<ReturnType<typeof getSummarizer>>,
    summaries: string[],
    opts: SummarizeOptions,
    chunkSize: number,
    depth: number
): Promise<string> {
    if (summaries.length === 1) {
        return summaries[0];
    }

    if (depth >= MAX_REDUCE_DEPTH) {
        return summaries.join("\n\n");
    }

    const aggregateText = summaries
        .map((summary, index) => `Summary ${index + 1}: ${summary}`)
        .join("\n\n");

    if (aggregateText.length <= chunkSize) {
        try {
            return summarizeInternal(summarizer, aggregateText, opts);
        } catch (err) {
            if (isQuotaExceededError(err)) {
                const nextSize = resolveChunkSizeFromError(err, aggregateText.length, opts, chunkSize);
                if (nextSize < aggregateText.length) {
                    console.warn(
                        `[Summarizer] Aggregated summaries exceeded quota; retrying reduce step with chunk size ${nextSize}.`
                    );
                    return summarizeWithChunking(summarizer, aggregateText, opts, nextSize);
                }
            }

            console.warn("[Summarizer] Aggregated summaries failed, returning fallback text.", err);
            return aggregateText;
        }
    }

    const nextChunks = chunkText(aggregateText, chunkSize);
    if (nextChunks.length > 1) {
        console.log(`[Summarizer] Reduce depth ${depth + 1} will process ${nextChunks.length} chunks.`);
    }
    const nextRound: string[] = [];
    for (let i = 0; i < nextChunks.length; i++) {
        const chunk = nextChunks[i];
        console.log(`[Summarizer] Reducing chunk ${i + 1}/${nextChunks.length} at depth ${depth + 1} (${chunk.length} chars).`);
        try {
            const result = await summarizeInternal(summarizer, chunk, opts);
            nextRound.push(result || chunk);
        } catch (err) {
            if (isQuotaExceededError(err)) {
                const nextSize = resolveChunkSizeFromError(err, chunk.length, opts, chunkSize);
                if (nextSize < chunk.length) {
                    console.warn(
                        `[Summarizer] Reduce chunk ${i + 1}/${nextChunks.length} exceeded quota; retrying with chunk size ${nextSize}.`
                    );
                    const retried = await summarizeWithChunking(summarizer, chunk, opts, nextSize);
                    nextRound.push(retried);
                    continue;
                }
            }
            console.warn("[Summarizer] Reduce chunk failed, falling back to raw chunk", err);
            nextRound.push(chunk);
        }
    }

    return reduceSummaries(summarizer, nextRound, opts, chunkSize, depth + 1);
}

async function summarizeWithChunking(
    summarizer: Awaited<ReturnType<typeof getSummarizer>>,
    text: string,
    opts: SummarizeOptions,
    chunkSize: number
): Promise<string> {
    const size = clampChunkSize(chunkSize, opts, text.length > 1 ? text.length - 1 : undefined);
    const chunks = chunkText(text, size);
    if (chunks.length > 1) {
        console.log(`[Summarizer] Input requires ${chunks.length} chunks (chunk size ${size}).`);
    }

    if (chunks.length === 1) {
        try {
            return summarizeInternal(summarizer, chunks[0], opts);
        } catch (err) {
            if (isQuotaExceededError(err)) {
                const nextSize = resolveChunkSizeFromError(err, chunks[0].length, opts, size);
                if (nextSize < chunks[0].length) {
                    console.warn(`[Summarizer] Single chunk exceeded quota; retrying with chunk size ${nextSize}.`);
                    return summarizeWithChunking(summarizer, chunks[0], opts, nextSize);
                }
            }
            throw err;
        }
    }

    const partialSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[Summarizer] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars).`);
        try {
            const summary = await summarizeInternal(summarizer, chunk, opts);
            partialSummaries.push(summary || chunk);
        } catch (err) {
            if (isQuotaExceededError(err)) {
                const nextSize = resolveChunkSizeFromError(err, chunk.length, opts, size);
                if (nextSize < chunk.length) {
                    console.warn(
                        `[Summarizer] Chunk ${i + 1}/${chunks.length} exceeded quota; retrying with chunk size ${nextSize}.`
                    );
                    const retried = await summarizeWithChunking(summarizer, chunk, opts, nextSize);
                    partialSummaries.push(retried);
                    continue;
                }
            }
            console.warn('Summarizer chunk failed, falling back to raw chunk', err);
            partialSummaries.push(chunk);
        }
    }

    return reduceSummaries(summarizer, partialSummaries, opts, size, 0);
}

export async function summarize(opts: SummarizeOptions): Promise<string> {
    if (typeof Summarizer !== "undefined") {
        console.log("[Summarizer] Availability check during summarize:", await readSummarizerAvailability());
    }
    const cleaned = normalizeText(opts.text);
    if (!cleaned) return "";
    const summarizer = await getSummarizer(opts);

    const maxChars = typeof opts.maxChars === "number" && opts.maxChars > 0 ? Math.floor(opts.maxChars) : null;
    if (maxChars && cleaned.length > maxChars) {
        console.warn(`[Summarizer] Input exceeds configured maxChars (${maxChars}); chunking upfront.`);
        return summarizeWithChunking(summarizer, cleaned, opts, maxChars);
    }

    try {
        return await summarizeInternal(summarizer, cleaned, opts);
    } catch (err) {
        if (isQuotaExceededError(err)) {
            const chunkSize = resolveChunkSizeFromError(err, cleaned.length, opts);
            console.warn(
                `[Summarizer] Input exceeded quota (requested ${err.requested ?? "?"}, quota ${err.quota ?? "?"}). ` +
                    `Retrying with chunk size ${chunkSize}.`
            );
            return summarizeWithChunking(summarizer, cleaned, opts, chunkSize);
        }

        throw err;
    }
}
