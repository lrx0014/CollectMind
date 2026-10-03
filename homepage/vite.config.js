import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), "index.html"),
        privacy: resolve(process.cwd(), "privacy.html"),
      },
    },
  },
});
