import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {viteStaticCopy} from "vite-plugin-static-copy";
import {crx} from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
      react(),
      crx({ manifest }),
      viteStaticCopy({
          targets: [
              {
                  src: 'src/styles',
                  dest: ''
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
})
