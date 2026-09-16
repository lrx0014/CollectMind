// Shared text splitter used both for RAG (embedding) chunks and for feeding the
// Summarizer API in map-reduce mode. Splits on paragraph/sentence boundaries
// instead of hard character cuts, so chunks don't sever mid-sentence, and adds
// a small overlap between consecutive chunks so retrieval doesn't lose context
// that straddles a boundary.

export interface TextChunk {
    index: number;
    text: string;
    tokenEstimate: number;
}

export interface ChunkOptions {
    maxTokens?: number;
    overlapRatio?: number;
}

const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_OVERLAP_RATIO = 0.12;

// CJK characters are ~1 token each under most tokenizers; Latin text is closer
// to ~4 characters per token. This is a heuristic for budgeting, not exact.
const CJK_RANGE = /[㐀-鿿豈-﫿぀-ヿ가-힯]/g;

export function estimateTokens(text: string): number {
    if (!text) return 0;
    const cjkCount = (text.match(CJK_RANGE) ?? []).length;
    const otherCount = text.length - cjkCount;
    return Math.max(1, Math.ceil(cjkCount + otherCount / 4));
}

function splitParagraphs(text: string): string[] {
    return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

// Splits on sentence-ending punctuation for both CJK (。！？) and Latin (.!?)
// text, keeping the delimiter attached to its sentence.
function splitSentences(text: string): string[] {
    const matches = text.match(/[^。!?!?.]+[。!?!?.]*/g);
    if (!matches) return [text];
    return matches.map(s => s.trim()).filter(Boolean);
}

export function chunkText(rawText: string, opts?: ChunkOptions): TextChunk[] {
    const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const overlapRatio = opts?.overlapRatio ?? DEFAULT_OVERLAP_RATIO;
    const text = (rawText || '').replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const units: string[] = [];
    for (const paragraph of splitParagraphs(text)) {
        if (estimateTokens(paragraph) <= maxTokens) {
            units.push(paragraph);
        } else {
            units.push(...splitSentences(paragraph));
        }
    }
    if (units.length === 0) {
        units.push(text);
    }

    const chunks: string[] = [];
    let current: string[] = [];
    let currentTokens = 0;

    const flush = () => {
        if (current.length === 0) return;
        chunks.push(current.join(' ').trim());
    };

    const takeOverlapTail = (pieces: string[]): { tail: string[]; tailTokens: number } => {
        const overlapTokens = Math.floor(maxTokens * overlapRatio);
        const tail: string[] = [];
        let tailTokens = 0;
        for (let i = pieces.length - 1; i >= 0 && tailTokens < overlapTokens; i--) {
            tail.unshift(pieces[i]);
            tailTokens += estimateTokens(pieces[i]);
        }
        return { tail, tailTokens };
    };

    for (const unit of units) {
        const unitTokens = estimateTokens(unit);

        // A single unit bigger than the whole budget (e.g. one huge line with no
        // punctuation): flush what we have, then hard-split just this unit.
        if (unitTokens > maxTokens) {
            flush();
            current = [];
            currentTokens = 0;

            const charsPerToken = unit.length / unitTokens;
            const hardLimit = Math.max(1, Math.floor(maxTokens * charsPerToken));
            for (let i = 0; i < unit.length; i += hardLimit) {
                chunks.push(unit.slice(i, i + hardLimit).trim());
            }
            continue;
        }

        if (current.length > 0 && currentTokens + unitTokens > maxTokens) {
            flush();
            const { tail, tailTokens } = takeOverlapTail(current);
            current = tail;
            currentTokens = tailTokens;
        }

        current.push(unit);
        currentTokens += unitTokens;
    }
    flush();

    return chunks
        .filter(Boolean)
        .map((text, index) => ({ index, text, tokenEstimate: estimateTokens(text) }));
}
