import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import { requireAuth, isErrorResponse } from "../middleware";
import { checkRateLimit, rateLimitedJson } from "../rate-limit";
import { randomBase32 } from "../db";

const MAX_BYTES = 2_000_000;
const ALLOWED = new Set(["image/png", "image/jpeg"]);

export const screenshotRoutes = new Hono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

function decodeBase64(data: string): Uint8Array {
  // strip data URL prefix if present
  const comma = data.indexOf(",");
  const b64 = data.startsWith("data:") && comma >= 0 ? data.slice(comma + 1) : data;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

screenshotRoutes.post("/screenshots", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  const rl = await checkRateLimit(c.env, user.id, "screenshots");
  if (!rl.ok) return c.json(rateLimitedJson(), 429);

  let body: { data_base64?: string; content_type?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON", code: "BODY_INVALID" }, 422);
  }

  const contentType = (body.content_type || "").toLowerCase();
  if (!ALLOWED.has(contentType)) {
    return c.json(
      {
        error: "content_type must be image/png or image/jpeg",
        code: "BODY_INVALID",
      },
      422
    );
  }

  if (!body.data_base64 || typeof body.data_base64 !== "string") {
    return c.json(
      { error: "data_base64 required", code: "BODY_INVALID" },
      422
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(body.data_base64);
  } catch {
    return c.json({ error: "Invalid base64", code: "BODY_INVALID" }, 422);
  }

  if (bytes.byteLength > MAX_BYTES) {
    return c.json(
      { error: "Screenshot exceeds 2MB limit", code: "PAYLOAD_TOO_LARGE" },
      413
    );
  }

  const ext = contentType === "image/png" ? "png" : "jpg";
  const yyyy = new Date().getUTCFullYear();
  const rand = randomBase32(16);
  const r2Key = `shots/${yyyy}/${rand}.${ext}`;
  const uploadId = randomBase32(16);

  await c.env.MEDIA.put(r2Key, bytes, {
    httpMetadata: { contentType },
  });

  await c.env.DB.prepare(
    `INSERT INTO screenshot_uploads (id, r2_key, user_id, used)
     VALUES (?, ?, ?, 0)`
  )
    .bind(uploadId, r2Key, user.id)
    .run();

  return c.json({ upload_id: uploadId }, 201);
});
