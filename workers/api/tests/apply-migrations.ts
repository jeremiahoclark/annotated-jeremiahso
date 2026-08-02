/// <reference types="@cloudflare/vitest-pool-workers" />
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  const migrations = env.TEST_MIGRATIONS;
  if (!migrations) {
    throw new Error("TEST_MIGRATIONS binding missing — check vitest.config.mts");
  }
  await applyD1Migrations(env.DB, migrations);
});
