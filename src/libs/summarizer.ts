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

const cache = new Map<string, any>();
const def = { type: "tldr" as SummaryType, format: "plain-text" as SummaryFormat, length: "short" as SummaryLength, maxChars: 40_000 };
const MAX_REDUCE_DEPTH = 4;
const FIXED_CHUNK_SIZE = 8_000;

function key(t: SummaryType, f: SummaryFormat, l: SummaryLength, s?: string) {
    return `${t}|${f}|${l}|${s ?? ""}`;
}

async function getSummarizer(opts: SummarizeOptions) {
    if (typeof Summarizer === "undefined") throw new Error("Summarizer API unsupported.");
    const k = key(opts.type ?? def.type, opts.format ?? def.format, opts.length ?? def.length, opts.sharedContext);
    if (cache.has(k)) return cache.get(k);

    const s = await Summarizer.create({
        type: opts.type ?? def.type,
        format: opts.format ?? def.format,
        length: opts.length ?? def.length,
        sharedContext: opts.sharedContext,
        monitor(m) {
            m.addEventListener("downloadprogress", (e: any) => opts.onDownloadProgress?.(e?.loaded ?? 0));
        },
    });
    cache.set(k, s);
    return s;
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
    depth: number
): Promise<string> {
    if (summaries.length === 1) {
        return summaries[0];
    }

    if (depth >= MAX_REDUCE_DEPTH) {
        return summaries.join("\n\n");
    }

    const chunkSize = Math.min(opts.maxChars ?? def.maxChars, FIXED_CHUNK_SIZE);
    const aggregateText = summaries
        .map((summary, index) => `Summary ${index + 1}: ${summary}`)
        .join("\n\n");

    if (aggregateText.length <= chunkSize) {
        return summarizeInternal(summarizer, aggregateText, opts);
    }

    const nextChunks = chunkText(aggregateText, chunkSize);
    if (nextChunks.length > 1) {
        console.log(`[Summarizer] Reduce depth ${depth + 1} will process ${nextChunks.length} chunks.`);
    }
    const nextRound: string[] = [];
    for (let i = 0; i < nextChunks.length; i++) {
        const chunk = nextChunks[i];
        console.log(`[Summarizer] Reducing chunk ${i + 1}/${nextChunks.length} at depth ${depth + 1} (${chunk.length} chars).`);
        const result = await summarizeInternal(summarizer, chunk, opts);
        nextRound.push(result || chunk);
    }

    return reduceSummaries(summarizer, nextRound, opts, depth + 1);
}

export async function summarize(opts: SummarizeOptions): Promise<string> {
    console.log(`Summarizer ${await Summarizer.availability()}`);
    const cleaned = normalizeText(opts.text);
    if (!cleaned) return "";

    const chunkSize = Math.min(opts.maxChars ?? def.maxChars, FIXED_CHUNK_SIZE);
    const chunks = chunkText(cleaned, chunkSize);
    if (chunks.length > 1) {
        console.log(`[Summarizer] Input requires ${chunks.length} chunks (chunk size ${chunkSize}).`);
    }
    const summarizer = await getSummarizer(opts);

    if (chunks.length === 1) {
        return summarizeInternal(summarizer, chunks[0], opts);
    }

    const partialSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[Summarizer] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars).`);
        try {
            const summary = await summarizeInternal(summarizer, chunk, opts);
            partialSummaries.push(summary || chunk);
        } catch (error) {
            console.warn('Summarizer chunk failed, falling back to raw chunk', error);
            partialSummaries.push(chunk);
        }
    }

    return reduceSummaries(summarizer, partialSummaries, opts, 0);
}
