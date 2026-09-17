// Main-thread-facing embedding provider. Delegates actual inference to
// embedding.worker.ts over a small request/response protocol, so the WASM/ONNX
// model runs off whatever thread calls embed() (the offscreen document, in
// practice). Deliberately kept behind an interface: if Chrome ever ships a
// native embedding API, a new provider can be swapped in without touching the
// RAG/indexing code that consumes it.

export interface EmbeddingProvider {
    readonly id: string;
    readonly dim: number;
    embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
    warmup(onProgress?: (info: unknown) => void): Promise<void>;
    dispose(): void;
}

type PendingEntry = {
    resolve: (value: number[][]) => void;
    reject: (error: Error) => void;
};

class TransformersJsProvider implements EmbeddingProvider {
    readonly id: string;
    readonly dim: number;

    private worker: Worker | null = null;
    private nextRequestId = 1;
    private pending = new Map<number, PendingEntry>();
    private onProgress: ((info: unknown) => void) | undefined;

    constructor(id: string, dim: number) {
        this.id = id;
        this.dim = dim;
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;

        const worker = new Worker(new URL('./embedding.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent) => {
            const message = event.data as { id?: number; type: string; payload: unknown };
            if (message.type === 'progress') {
                this.onProgress?.(message.payload);
                return;
            }
            if (typeof message.id !== 'number') return;
            const entry = this.pending.get(message.id);
            if (!entry) return;
            this.pending.delete(message.id);

            if (message.type === 'error') {
                entry.reject(new Error(String(message.payload)));
            } else {
                entry.resolve(message.payload as number[][]);
            }
        };
        worker.onerror = (event: ErrorEvent) => {
            const error = new Error(event.message || 'Embedding worker crashed.');
            for (const [, entry] of this.pending) {
                entry.reject(error);
            }
            this.pending.clear();
        };

        this.worker = worker;
        return worker;
    }

    private request(message: { type: 'embed'; payload: { texts: string[]; kind: 'query' | 'passage' } } | { type: 'warmup' }): Promise<number[][]> {
        const worker = this.ensureWorker();
        const id = this.nextRequestId++;
        return new Promise<number[][]>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            worker.postMessage({ id, ...message });
        });
    }

    async embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]> {
        if (texts.length === 0) return [];
        const vectors = await this.request({ type: 'embed', payload: { texts, kind } });
        return vectors.map(v => new Float32Array(v));
    }

    async warmup(onProgress?: (info: unknown) => void): Promise<void> {
        this.onProgress = onProgress;
        await this.request({ type: 'warmup' });
    }

    dispose(): void {
        this.worker?.terminate();
        this.worker = null;
        for (const [, entry] of this.pending) {
            entry.reject(new Error('Embedding provider disposed.'));
        }
        this.pending.clear();
    }
}

let sharedProvider: TransformersJsProvider | null = null;

// Kept in sync with embedding.worker.ts's EMBEDDING_MODEL_ID/EMBEDDING_DIM.
// Duplicated (rather than imported) so this module never has to pull the
// worker's transformers.js import graph into the caller's bundle.
export const DEFAULT_EMBEDDING_MODEL_ID = 'Xenova/multilingual-e5-small';
export const DEFAULT_EMBEDDING_DIM = 384;

export function getEmbeddingProvider(): EmbeddingProvider {
    if (!sharedProvider) {
        sharedProvider = new TransformersJsProvider(DEFAULT_EMBEDDING_MODEL_ID, DEFAULT_EMBEDDING_DIM);
    }
    return sharedProvider;
}

export function disposeEmbeddingProvider(): void {
    sharedProvider?.dispose();
    sharedProvider = null;
}
