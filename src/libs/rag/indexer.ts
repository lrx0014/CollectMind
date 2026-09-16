// Turns a saved page's extracted text into searchable chunks: split -> embed ->
// store in the `chunks` table. Idempotent via a cheap content hash, so
// re-indexing an unchanged page is a no-op.

import db from '../db.ts';
import { chunkText } from './chunker.ts';
import { getEmbeddingProvider } from './embeddings.ts';

// Not cryptographic — just cheap change detection so we can skip re-embedding
// a page whose extracted text hasn't changed since the last index run.
function hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return `${text.length}:${hash}`;
}

export interface IndexPageResult {
    pageId: number;
    chunkCount: number;
    skipped: boolean;
}

export async function indexSavedPage(args: {
    pageId: number;
    topicId: number;
    text: string;
    force?: boolean;
}): Promise<IndexPageResult> {
    const { pageId, topicId, force } = args;
    const cleaned = (args.text || '').replace(/[ \t]+/g, ' ').trim();
    const contentHash = hashText(cleaned);

    if (!force) {
        const existing = await db.saved_pages.get(pageId);
        if (existing && existing.content_hash === contentHash && existing.indexed_at > 0) {
            return { pageId, chunkCount: 0, skipped: true };
        }
    }

    await db.deleteChunksByPage(pageId);

    if (!cleaned) {
        await db.markPageIndexed(pageId, contentHash);
        return { pageId, chunkCount: 0, skipped: false };
    }

    const pieces = chunkText(cleaned);
    if (pieces.length === 0) {
        await db.markPageIndexed(pageId, contentHash);
        return { pageId, chunkCount: 0, skipped: false };
    }

    const provider = getEmbeddingProvider();
    const vectors = await provider.embed(pieces.map(p => p.text), 'passage');

    const now = Date.now();
    await db.addChunks(pieces.map((piece, i) => ({
        page_id: pageId,
        topic_id: topicId,
        chunk_index: piece.index,
        text: piece.text,
        embedding: vectors[i],
        embedding_model: provider.id,
        token_estimate: piece.tokenEstimate,
        created_at: now,
    })));

    await db.markPageIndexed(pageId, contentHash);
    await db.markTopicSummaryStale(topicId);

    return { pageId, chunkCount: pieces.length, skipped: false };
}

// Re-embeds every saved page (e.g. after switching embedding models, or as a
// manual "rebuild search index" action in Settings).
export async function reindexAllPages(onProgress?: (done: number, total: number) => void): Promise<void> {
    const pages = await db.getAllSavedPages();
    let done = 0;
    for (const page of pages) {
        const fresh = await db.saved_pages.get(page.id);
        // We only have the last-extracted text if it was cached; when it wasn't,
        // fall back to the summary so the page stays searchable rather than
        // silently dropping out of the index. Full re-extraction requires a live
        // tab and is out of scope for a background reindex pass.
        const text = fresh?.summary ?? page.summary ?? '';
        await indexSavedPage({ pageId: page.id, topicId: page.topic_id, text, force: true });
        done += 1;
        onProgress?.(done, pages.length);
    }
}
