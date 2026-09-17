// Single place that answers "can we do X right now?" for every AI capability
// the app depends on. Settings UI and app logic (e.g. "should we offer RAG
// chat, or fall back to a plain prompt?") both read from here instead of each
// re-implementing their own availability probing.

import { getSummarizerAvailability, type SummarizerAvailabilityStatus } from './summarizer.ts';
import { getPromptAvailability } from './prompt.ts';

export type AvailabilityStatus = SummarizerAvailabilityStatus;

export type EmbeddingAvailabilityStatus = 'available' | 'unsupported' | 'error' | 'unknown';

export interface AiCapabilities {
    summarizer: AvailabilityStatus;
    prompt: AvailabilityStatus;
    // Whether the embedding worker (Transformers.js) can run at all in this
    // browser. It doesn't report "downloaded" vs "not downloaded" the way the
    // Summarizer/Prompt APIs do — the model streams in lazily on first use and
    // is cached by the browser, so there's no separate pre-flight signal.
    embeddings: EmbeddingAvailabilityStatus;
}

export function isUsable(status: AvailabilityStatus): boolean {
    return status === 'available' || status === 'downloadable';
}

function detectEmbeddingSupport(): EmbeddingAvailabilityStatus {
    try {
        if (typeof Worker === 'undefined') return 'unsupported';
        if (typeof WebAssembly === 'undefined') return 'unsupported';
        return 'available';
    } catch (error) {
        console.warn('[Capabilities] Failed to probe embedding support.', error);
        return 'error';
    }
}

let cached: Promise<AiCapabilities> | null = null;

export async function getAiCapabilities(opts?: { forceRefresh?: boolean }): Promise<AiCapabilities> {
    if (opts?.forceRefresh) {
        cached = null;
    }
    if (cached) return cached;

    cached = (async () => {
        const [summarizer, prompt] = await Promise.all([
            getSummarizerAvailability(),
            getPromptAvailability(),
        ]);
        return {
            summarizer,
            prompt,
            embeddings: detectEmbeddingSupport(),
        };
    })();

    return cached;
}

// Whether we can run retrieval-augmented chat/summarization at all: needs the
// Prompt API to answer questions and a working embedding pipeline to retrieve
// relevant chunks. The Summarizer API is used opportunistically but isn't a
// hard requirement for RAG itself.
export async function canUseRag(): Promise<boolean> {
    const caps = await getAiCapabilities();
    return isUsable(caps.prompt) && caps.embeddings === 'available';
}
