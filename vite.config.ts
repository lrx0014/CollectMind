import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {viteStaticCopy} from "vite-plugin-static-copy";
import {crx} from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";
import pkg from "./package.json";

// YYYYMMDDHHmm in local time, e.g. "202609170134" — compact, sorts
// chronologically, and reads as an actual date/time at a glance.
function buildTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// https://vite.dev/config/
export default defineConfig({
  // manifest.json's own "version" field must stay strict dot-separated
  // integers (Chrome rejects anything else), so the human-readable
  // "2.0.0 (build.<timestamp>)" string lives only in the UI/backup metadata,
  // stamped fresh on every build — see App.tsx's use of __APP_VERSION__ /
  // __BUILD_TIMESTAMP__ and src/vite-env.d.ts for their type declarations.
  define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp()),
  },
  plugins: [
      react(),
      crx({ manifest }),
      viteStaticCopy({
          targets: [
              {
                  src: 'src/styles',
                  dest: ''
              },
              {
                  // ONNX Runtime Web needs real, fetchable copies of its wasm
                  // binary + .mjs glue file to avoid its blob:-URL dynamic
                  // import fallback, which MV3's CSP blocks (see
                  // src/libs/rag/embedding.worker.ts). Copied straight from
                  // node_modules at build time instead of committing a ~26MB
                  // binary to the repo; stays in sync with whatever version of
                  // onnxruntime-web is actually installed. If @huggingface/
                  // transformers ever switches to a different wasm variant
                  // (currently ort-wasm-simd-threaded.asyncify), update both
                  // this glob and wasmPaths together.
                  src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.*',
                  dest: 'onnx-wasm'
              }
          ]
      })
  ],
    build: {
        rollupOptions: {
            input: {
                app: 'index.html',
                offscreen: 'offscreen.html',
            },
        },
    },
    worker: {
        // Vite's default worker output format is 'iife', which can't natively
        // support dynamic import() — Vite polyfills it with a blob: URL shim
        // instead. onnxruntime-web (used by the embedding worker) relies on
        // dynamic import() internally, and that blob: shim is script content,
        // which MV3's extension-page CSP (script-src 'self') refuses to run.
        // Building the worker as a real ES module lets those imports resolve
        // to normal chrome-extension:// chunk URLs instead.
        format: 'es',
    },
})
