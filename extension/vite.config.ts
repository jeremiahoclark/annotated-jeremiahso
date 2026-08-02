import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Side panel React app only.
 * Background SW is built via vite.background.config.ts (IIFE, no code-split).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@annotated/types": path.resolve(root, "../frontend/src/lib/types.ts"),
    },
  },
  root: path.resolve(root, "src/sidepanel"),
  base: "./",
  build: {
    outDir: path.resolve(root, "dist/sidepanel"),
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    rollupOptions: {
      input: path.resolve(root, "src/sidepanel/index.html"),
    },
  },
});
