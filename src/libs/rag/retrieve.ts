// Turns "topic chat" / "page chat" questions into a budgeted set of reference
// sources, replacing the old approach of stuffing every page's full summary
// (or the whole current page) into the prompt on every turn. This is the
// piece that makes chatting over a topic with many saved pages actually work
// instead of blowing past the model's context window.

import db, { type SavedPage } from '../db.ts';
import { chunkText, estimateTokens } from './chunker.ts';
import { getEmbeddingProvider } from './embeddings.ts';
import { dot, searchChunks } from './vector-store.ts';

export interface RagSource {
    // Stable 1-based label shown to the model ("Source N") and reused verbatim
    // to build the citation list shown under the chat bubble.
    index: number;
    pageId: number | null;
    title: string;
    url: string;
    text: string;
    score: number;
}

export interface RagContext {
    sources: RagSource[];
    referenceBlock: string;
}

const DEFAULT_TOP_K = 10;
// Used when a live session's contextWindow/contextUsage aren't available to
// size the budget dynamically (see App.tsx's handleSendMessage).
export const DEFAULT_TOKEN_BUDGET = 1200;

function formatSources(sources: RagSource[]): string {
    if (sources.length === 0) return 'No documents available.';
    return sources
        .map(s => `Source ${s.index}: ${s.title}\nURL: ${s.url}\nContent:\n${s.text}`)
        .join('\n\n');
}

function toSources(entries: { pageId: number | null; title: string; url: string; text: string; score: number }[]): RagContext {
    const sources = entries.map((entry, i) => ({ ...entry, index: i + 1 }));
    return { sources, referenceBlock: formatSources(sources) };
}

// Greedily keeps the highest-scored items until the token budget runs out,
// instead of stuffing everything and hoping the model call doesn't throw a
// QuotaExceededError. Always keeps at least one item so a single very long
// top match still gets a chance (the Summarizer-style chunking upstream keeps
// individual chunks small anyway).
function budgetItems<T>(items: T[], tokenBudget: number, getTokens: (item: T) => number): T[] {
    const kept: T[] = [];
    let used = 0;
    for (const item of items) {
        const tokens = getTokens(item);
        if (kept.length > 0 && used + tokens > tokenBudget) break;
        kept.push(item);
        used += tokens;
    }
    return kept;
}

async function retrieveTopicChunks(topicId: number, query: string, topK: number, tokenBudget: number): Promise<RagContext> {
    const provider = getEmbeddingProvider();
    const [queryEmbedding] = await provider.embed([query], 'query');

    const retrieved = await searchChunks(queryEmbedding, { topicId, topK });
    const kept = budgetItems(retrieved, tokenBudget, c => c.token_estimate);
    if (kept.length === 0) {
        return { sources: [], referenceBlock: 'No documents available.' };
    }

    const pageIds = [...new Set(kept.map(c => c.page_id))];
    const pages = await Promise.all(pageIds.map(id => db.saved_pages.get(id)));
    const pageById = new Map(pages.filter((p): p is SavedPage => !!p).map(p => [p.id, p]));

    return toSources(kept.map(chunk => {
        const page = pageById.get(chunk.page_id);
        return {
            pageId: chunk.page_id,
            title: page?.title?.trim() || 'Untitled page',
            url: page?.url ?? '',
            text: chunk.text,
            score: chunk.score,
        };
    }));
}

// Safety net for topics whose pages haven't been chunked/embedded yet (index
// still catching up in the background, or data saved before this feature
// existed). Falls back to the pre-RAG behavior of using page summaries
// directly so chat doesn't go blind just because indexing hasn't finished.
// Still budgeted — a topic with many unindexed pages could otherwise blow
// straight past the model's context window the same way the old
// stuff-everything-in approach did.
async function buildSummaryFallback(topicId: number, tokenBudget: number): Promise<RagContext> {
    const pages = await db.getSavedPagesByTopicId(topicId);
    if (pages.length === 0) {
        return { sources: [], referenceBlock: 'No documents available.' };
    }
    const entries = pages.map(page => ({
        pageId: page.id,
        title: page.title?.trim() || 'Untitled page',
        url: page.url,
        text: page.summary?.trim() || 'Summary is not available yet.',
        score: 0,
    }));
    return toSources(budgetItems(entries, tokenBudget, e => estimateTokens(e.text)));
}

// Same safety net as buildSummaryFallback, but across every topic — used by
// getLibraryRagContext when the chunks table is empty. Without this, asking
// the Library chat anything before the background indexer has produced a
// single chunk yet (e.g. right after upgrading, before "Rebuild index" has
// been run, or just because embedding was broken until moments ago) makes it
// look like the feature has no access to the collection at all, when the
// page summaries are sitting right there.
async function buildLibrarySummaryFallback(tokenBudget: number): Promise<RagContext> {
    const pages = await db.getAllSavedPages();
    if (pages.length === 0) {
        return { sources: [], referenceBlock: 'No documents available.' };
    }

    const topicIds = [...new Set(pages.map(p => p.topic_id))];
    const topics = await Promise.all(topicIds.map(id => db.topics.get(id)));
    const topicNameById = new Map(topics.filter((t): t is NonNullable<typeof t> => !!t).map(t => [t.id, t.name]));

    const entries = pages.map(page => {
        const topicName = topicNameById.get(page.topic_id);
        const title = page.title?.trim() || 'Untitled page';
        return {
            pageId: page.id,
            title: topicName ? `${title} (${topicName})` : title,
            url: page.url,
            text: page.summary?.trim() || 'Summary is not available yet.',
            score: 0,
        };
    });
    return toSources(budgetItems(entries, tokenBudget, e => estimateTokens(e.text)));
}

// Cross-topic retrieval for the "Library" chat surface: "did any of my
// bookmarks talk about X", without the user having to remember which topic
// they filed it under. Sources are labeled with their topic so the model (and
// the citation chips) can show where each snippet came from.
export async function getLibraryRagContext(query: string, opts?: {
    topK?: number;
    tokenBudget?: number;
}): Promise<RagContext> {
    const topK = opts?.topK ?? DEFAULT_TOP_K;
    const tokenBudget = opts?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

    const totalChunks = await db.chunks.count();
    if (totalChunks === 0) {
        return buildLibrarySummaryFallback(tokenBudget);
    }

    const provider = getEmbeddingProvider();
    const [queryEmbedding] = await provider.embed([query], 'query');

    const retrieved = await searchChunks(queryEmbedding, { topK });
    const kept = budgetItems(retrieved, tokenBudget, c => c.token_estimate);
    if (kept.length === 0) {
        return { sources: [], referenceBlock: 'No documents available.' };
    }

    const pageIds = [...new Set(kept.map(c => c.page_id))];
    const topicIds = [...new Set(kept.map(c => c.topic_id))];
    const [pages, topics] = await Promise.all([
        Promise.all(pageIds.map(id => db.saved_pages.get(id))),
        Promise.all(topicIds.map(id => db.topics.get(id))),
    ]);
    const pageById = new Map(pages.filter((p): p is SavedPage => !!p).map(p => [p.id, p]));
    const topicNameById = new Map(topics.filter((t): t is NonNullable<typeof t> => !!t).map(t => [t.id, t.name]));

    const sources = kept.map((chunk, i) => {
        const page = pageById.get(chunk.page_id);
        const topicName = topicNameById.get(chunk.topic_id);
        const title = page?.title?.trim() || 'Untitled page';
        return {
            index: i + 1,
            pageId: chunk.page_id,
            title: topicName ? `${title} (${topicName})` : title,
            url: page?.url ?? '',
            text: chunk.text,
            score: chunk.score,
        };
    });

    return { sources, referenceBlock: formatSources(sources) };
}

export async function getTopicRagContext(topicId: number, query: string, opts?: {
    topK?: number;
    tokenBudget?: number;
}): Promise<RagContext> {
    const topK = opts?.topK ?? DEFAULT_TOP_K;
    const tokenBudget = opts?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

    const chunkCount = await db.chunks.where('topic_id').equals(topicId).count();
    if (chunkCount === 0) {
        return buildSummaryFallback(topicId, tokenBudget);
    }
    return retrieveTopicChunks(topicId, query, topK, tokenBudget);
}

// Chats about "the currently open page" almost never have that page saved (and
// therefore indexed) yet, so we chunk+embed it in memory for this one turn
// instead of persisting it. Short pages skip retrieval entirely — no point
// round-tripping through the embedding model when the whole thing fits.
export async function getAdHocPageRagContext(args: {
    text: string;
    query: string;
    title: string;
    url: string;
    topK?: number;
    tokenBudget?: number;
}): Promise<RagContext> {
    const tokenBudget = args.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
    const cleaned = (args.text || '').trim();
    if (!cleaned) {
        return { sources: [], referenceBlock: 'No content available.' };
    }

    if (estimateTokens(cleaned) <= tokenBudget) {
        return toSources([{ pageId: null, title: args.title, url: args.url, text: cleaned, score: 1 }]);
    }

    const pieces = chunkText(cleaned);
    const provider = getEmbeddingProvider();
    const [passageVectors, queryVectors] = await Promise.all([
        provider.embed(pieces.map(p => p.text), 'passage'),
        provider.embed([args.query], 'query'),
    ]);
    const queryVector = queryVectors[0];

    const scored = pieces
        .map((piece, i) => ({ ...piece, score: dot(queryVector, passageVectors[i]) }))
        .sort((a, b) => b.score - a.score);

    const kept = budgetItems(scored, tokenBudget, p => p.tokenEstimate);
    return toSources(kept.map(piece => ({
        pageId: null,
        title: args.title,
        url: args.url,
        text: piece.text,
        score: piece.score,
    })));
}
