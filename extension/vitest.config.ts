import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "@annotated/types": path.resolve(root, "../frontend/src/lib/types.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.mjs", "tests/**/*.test.ts"],
  },
});
