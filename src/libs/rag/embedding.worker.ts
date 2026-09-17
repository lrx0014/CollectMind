// Runs inside a dedicated Worker spawned from the offscreen document. Keeps the
// (relatively heavy) WASM/ONNX embedding inference off the offscreen document's
// main thread. Model weights are fetched from the Hugging Face CDN on first use
// and cached by Transformers.js's own Cache Storage layer, same pattern as the
// official "Transformers.js in a Chrome Extension" guide.

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Never look for models bundled with the extension; always fetch (and let the
// browser cache) from the remote hub. Model weights are data, not executable
// code, so this is fine under MV3's remote-code policy.
env.allowLocalModels = false;

// ONNX Runtime Web normally locates its own .wasm/.mjs helper files relative
// to its own module URL — which, once bundled by Vite, no longer matches
// where those files actually live, so it falls back to wrapping its backend
// factory in a Blob and doing `import(blob:...)`. MV3's extension CSP
// (script-src 'self') blocks that blob: import outright, which surfaces as
// "no available backend found" / "Failed to fetch dynamically imported
// module: blob:...".
//
// Pointing wasmPaths at these two files explicitly makes it fetch/import them
// normally instead. Referencing them via `new URL(..., import.meta.url)`
// (rather than a separate copy under public/) lets Vite's own asset pipeline
// bundle them — and because onnxruntime-web's shipped bundle *also* contains
// a `new URL("ort-wasm-simd-threaded.asyncify.wasm", ...)` reference to this
// exact file (a dead fallback for the same blob-import path above, unreached
// once wasmPaths is set, but still visible to Vite's static analysis), Vite
// dedupes both references to the identical file content into a single output
// asset instead of shipping it twice. Verify after any onnxruntime-web
// version bump: `du -sh dist/assets/*.wasm` should show one ~26MB file, not
// two — see keys/README.md-style note, or just check dist/ after building.
if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = {
        wasm: new URL('../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href,
        mjs: new URL('../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
    };
    // Also sidesteps a *second*, unconditional blob-wrapped worker ONNX
    // Runtime spawns for its thread pool when numThreads !== 1; we're already
    // off the main thread inside this dedicated worker, so we don't need
    // ORT's own threading on top of it.
    env.backends.onnx.wasm.numThreads = 1;
}

// Multilingual so English- and Chinese-language bookmarks embed into a shared
// space with comparable quality (all-MiniLM-L6-v2 style English-only models
// perform poorly on CJK text).
export const EMBEDDING_MODEL_ID = 'Xenova/multilingual-e5-small';
export const EMBEDDING_DIM = 384;

type EmbedRequest = {
    id: number;
    type: 'embed';
    payload: { texts: string[]; kind: 'query' | 'passage' };
};

type WarmupRequest = {
    id: number;
    type: 'warmup';
};

type WorkerRequest = EmbedRequest | WarmupRequest;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!extractorPromise) {
        extractorPromise = pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
            progress_callback: (progress: unknown) => {
                (self as unknown as Worker).postMessage({ type: 'progress', payload: progress });
            },
        }).catch((error: unknown) => {
            extractorPromise = null;
            throw error;
        });
    }
    return extractorPromise;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'warmup') {
        try {
            await getExtractor();
            self.postMessage({ id: message.id, type: 'result', payload: null });
        } catch (error) {
            self.postMessage({ id: message.id, type: 'error', payload: describeError(error) });
        }
        return;
    }

    if (message.type === 'embed') {
        try {
            const extractor = await getExtractor();
            // e5 models expect a "query: "/"passage: " instruction prefix for
            // asymmetric retrieval (queries and documents are embedded slightly
            // differently for better ranking quality).
            const prefixed = message.payload.texts.map(text =>
                message.payload.kind === 'query' ? `query: ${text}` : `passage: ${text}`
            );
            const output = await extractor(prefixed, { pooling: 'mean', normalize: true });
            const vectors = output.tolist() as number[][];
            self.postMessage({ id: message.id, type: 'result', payload: vectors });
        } catch (error) {
            self.postMessage({ id: message.id, type: 'error', payload: describeError(error) });
        }
    }
};

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
