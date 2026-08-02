/// <reference types="@cloudflare/vitest-pool-workers" />
import { describe, it, expect, beforeEach } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker from "../src/index";
import {
  resetDb,
  seedUser,
  seedAnnotation,
  seedSession,
  authUserIdForAppUser,
} from "./setup";

async function fetchWorker(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const request = new Request(`http://localhost${path}`, init);
  const ctx = createExecutionContext();
  const res = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("API integration", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /api/health", async () => {
    const res = await fetchWorker("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("feed hot vs new ordering", async () => {
    const u = await seedUser({ handle: "alice" });
    // Old but high engagement
    await seedAnnotation({
      authorId: u,
      slug: "hot-old",
      upCount: 50,
      commentCount: 20,
      createdAt: "2020-01-01T00:00:00",
      commentary: "Old viral commentary that still ranks hot maybe.",
    });
    // Fresh with no engagement
    await seedAnnotation({
      authorId: u,
      slug: "fresh-new",
      upCount: 0,
      createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      commentary: "Brand new clip with solid commentary text.",
    });

    const hotRes = await fetchWorker("/api/feed?sort=hot&limit=10");
    expect(hotRes.status).toBe(200);
    const hot = (await hotRes.json()) as { items: { slug: string }[] };
    expect(hot.items.length).toBe(2);

    const newRes = await fetchWorker("/api/feed?sort=new&limit=10");
    const neu = (await newRes.json()) as { items: { slug: string }[] };
    expect(neu.items[0]?.slug).toBe("fresh-new");
  });

  it("votes upsert recount", async () => {
    const u = await seedUser({ handle: "voter" });
    const authId = await authUserIdForAppUser(u);
    const token = await seedSession(authId);
    const ann = await seedAnnotation({ authorId: u, slug: "vote-me" });

    const up = await fetchWorker(`/api/annotations/${ann.id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 1 }),
    });
    expect(up.status).toBe(200);
    const upBody = (await up.json()) as {
      up_count: number;
      down_count: number;
      user_vote: number;
    };
    expect(upBody.up_count).toBe(1);
    expect(upBody.user_vote).toBe(1);

    const flip = await fetchWorker(`/api/annotations/${ann.id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: -1 }),
    });
    const flipBody = (await flip.json()) as {
      up_count: number;
      down_count: number;
    };
    expect(flipBody.up_count).toBe(0);
    expect(flipBody.down_count).toBe(1);

    const clear = await fetchWorker(`/api/annotations/${ann.id}/vote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: 0 }),
    });
    const clearBody = (await clear.json()) as {
      up_count: number;
      down_count: number;
      user_vote: number;
    };
    expect(clearBody.up_count).toBe(0);
    expect(clearBody.down_count).toBe(0);
    expect(clearBody.user_vote).toBe(0);
  });

  it("threading root propagation", async () => {
    const u = await seedUser({ handle: "threader" });
    const authId = await authUserIdForAppUser(u);
    const token = await seedSession(authId);
    const root = await seedAnnotation({ authorId: u, slug: "root-ann" });

    const res = await fetchWorker("/api/annotations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: "https://example.com/article",
        source_type: "article",
        commentary: "Child reply with enough commentary here.",
        parent_id: root.id,
        clip_text: "quoted text",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { slug: string };
    const child = await env.DB.prepare(
      "SELECT parent_id, thread_root_id FROM annotations WHERE slug = ?"
    )
      .bind(body.slug)
      .first<{ parent_id: number; thread_root_id: number }>();
    expect(child?.parent_id).toBe(root.id);
    expect(child?.thread_root_id).toBe(root.id);
  });

  it("reports unauthed", async () => {
    const u = await seedUser({ handle: "rep" });
    const ann = await seedAnnotation({ authorId: u, slug: "report-me" });
    const res = await fetchWorker(`/api/annotations/${ann.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "copyright_concern", body: "stolen?" }),
    });
    expect(res.status).toBe(201);
    const row = await env.DB.prepare(
      "SELECT reporter_user_id, reason FROM reports WHERE annotation_id = ?"
    )
      .bind(ann.id)
      .first<{ reporter_user_id: number | null; reason: string }>();
    expect(row?.reporter_user_id).toBeNull();
    expect(row?.reason).toBe("copyright_concern");
  });

  it("screenshots 413 over 2MB", async () => {
    const u = await seedUser({ handle: "shot" });
    const authId = await authUserIdForAppUser(u);
    const token = await seedSession(authId);

    // ~2.1MB of zeros as base64 is larger than 2_000_000 decoded
    const big = new Uint8Array(2_100_000);
    // btoa on large arrays — build in chunks for Workers
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < big.length; i += chunk) {
      binary += String.fromCharCode(...big.subarray(i, i + chunk));
    }
    const data_base64 = btoa(binary);

    const res = await fetchWorker("/api/screenshots", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data_base64,
        content_type: "image/png",
      }),
    });
    expect(res.status).toBe(413);
  });

  it("GET /media 404 when missing", async () => {
    const res = await fetchWorker("/media/shots/2099/nope.png");
    expect(res.status).toBe(404);
  });

  it("GET /api/me 401 unauthed", async () => {
    const res = await fetchWorker("/api/me");
    expect(res.status).toBe(401);
  });

  it("annotation detail 404", async () => {
    const res = await fetchWorker("/api/annotations/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("create annotation validation CLIP_TOO_LONG", async () => {
    const u = await seedUser({ handle: "val" });
    const authId = await authUserIdForAppUser(u);
    const token = await seedSession(authId);
    const text = Array.from({ length: 101 }, (_, i) => `w${i}`).join(" ");
    const res = await fetchWorker("/api/annotations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: "https://example.com/x",
        source_type: "article",
        commentary: "Enough commentary for this test case here.",
        clip_text: text,
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CLIP_TOO_LONG");
  });

  it("media prepare returns structured response", async () => {
    const u = await seedUser({ handle: "prep" });
    const authId = await authUserIdForAppUser(u);
    const token = await seedSession(authId);
    const res = await fetchWorker("/api/media/prepare", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/story?utm_source=x" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      type: string;
      canonical_key: string;
    };
    expect(body.ok).toBe(true);
    expect(body.type).toBe("article");
    expect(body.canonical_key).toBe("example.com/story");
  });
});
