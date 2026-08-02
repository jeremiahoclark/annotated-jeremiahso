import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, "../../migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        singleWorker: true,
        isolatedStorage: true,
        miniflare: {
          compatibilityDate: "2026-03-24",
          compatibilityFlags: ["nodejs_compat"],
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_SECRET: "test-auth-secret",
            ENVIRONMENT: "test",
            ADMIN_EMAILS: "",
          },
          d1Databases: { DB: "test-db" },
          kvNamespaces: ["RATE_LIMIT", "CACHE"],
          r2Buckets: ["MEDIA"],
        },
      }),
    ],
    test: {
      include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
      setupFiles: ["./tests/apply-migrations.ts"],
    },
  };
});

