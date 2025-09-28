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

export async function summarize(opts: SummarizeOptions): Promise<string> {
    console.log(`Summarizer ${await Summarizer.availability()}`);
    const max = opts.maxChars ?? def.maxChars;
    const text = (opts.text || "").replace(/\s+/g, " ").trim().slice(0, max);
    if (!text) return "";
    const s = await getSummarizer(opts);
    const out = await s.summarize(text, opts.context ? { context: opts.context } : undefined);
    return (out ?? "").toString().trim();
}
