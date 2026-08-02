import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * MV3 service worker: single IIFE file at dist/background.js.
 * All imports bundled; no ES module imports at runtime.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@annotated/types": path.resolve(root, "../frontend/src/lib/types.ts"),
    },
  },
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    lib: {
      entry: path.resolve(root, "src/background.ts"),
      name: "AnnotatedBackground",
      formats: ["iife"],
      fileName: () => "background.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
  },
  define: {
    // Avoid process.env surprises in SW
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
