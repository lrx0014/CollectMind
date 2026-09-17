// Brute-force cosine similarity search over the `chunks` table. At personal
// bookmark-collection scale (hundreds to low thousands of chunks) a full scan
// comfortably finishes in well under the time a single Prompt API round-trip
// takes, so there's no need for an ANN index (HNSW/etc.) yet. If chunk counts
// grow into the tens of thousands, revisit with a WASM ANN library — the
// searchChunks() signature below is the seam to swap the implementation behind.

import db, { type PageChunk } from '../db.ts';

export interface RetrievedChunk extends PageChunk {
    score: number;
}

export interface SearchOptions {
    topK?: number;
    topicId?: number;
    pageId?: number;
    minScore?: number;
}

// Embeddings from the provider are L2-normalized, so the dot product already
// equals cosine similarity — no need to divide by magnitudes here. Exported so
// ad-hoc (unsaved-page) retrieval in rag/retrieve.ts can score chunks the same
// way without persisting them to the `chunks` table.
export function dot(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}

export async function searchChunks(queryEmbedding: Float32Array, opts: SearchOptions = {}): Promise<RetrievedChunk[]> {
    const topK = opts.topK ?? 8;

    let candidates: PageChunk[];
    if (opts.pageId != null) {
        candidates = await db.getChunksByPage(opts.pageId);
    } else if (opts.topicId != null) {
        candidates = await db.getChunksByTopic(opts.topicId);
    } else {
        candidates = await db.getAllChunks();
    }

    const scored = candidates
        .map(chunk => ({ ...chunk, score: dot(queryEmbedding, chunk.embedding) }))
        .filter(chunk => opts.minScore == null || chunk.score >= opts.minScore);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}
