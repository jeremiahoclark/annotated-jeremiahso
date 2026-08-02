/**
 * Thin extension API client. Same endpoint shapes as frontend/src/lib/api.ts,
 * but absolute APP_ORIGIN base + Bearer auth (no cookie credentials by default).
 */
import { APP_ORIGIN } from "../config";
import type {
  CreateAnnotationRequest,
  CreateAnnotationResponse,
  HealthResponse,
  Me,
  ScreenshotUploadResponse,
} from "./types";

export class ApiClientError extends Error {
  status: number;
  error: string;
  code?: string;

  constructor(status: number, body: { error?: string; code?: string }) {
    super(body.error || `HTTP ${status}`);
    this.name = "ApiClientError";
    this.status = status;
    this.error = body.error || `HTTP ${status}`;
    this.code = body.code;
  }
}

export type FetchOpts = {
  token?: string | null;
  signal?: AbortSignal;
};

async function request<T>(
  path: string,
  init: RequestInit & FetchOpts = {}
): Promise<T> {
  const { token, signal, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${APP_ORIGIN}${path}`, {
    ...rest,
    headers,
    signal,
  });

  if (!res.ok) {
    let body: { error?: string; code?: string } = { error: res.statusText };
    try {
      body = (await res.json()) as { error?: string; code?: string };
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function health(opts?: FetchOpts): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", opts);
}

/** Online gate with AbortController timeout (default 4s). */
export async function healthOk(timeoutMs = 4000): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await health({ signal: ac.signal });
    return !!res?.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function me(token: string, opts?: FetchOpts): Promise<Me> {
  return request<Me>("/api/me", { ...opts, token });
}

export async function createAnnotation(
  body: CreateAnnotationRequest,
  token: string,
  opts?: FetchOpts
): Promise<CreateAnnotationResponse> {
  return request<CreateAnnotationResponse>("/api/annotations", {
    method: "POST",
    body: JSON.stringify(body),
    token,
    ...opts,
  });
}

export async function uploadScreenshot(
  data_base64: string,
  content_type: "image/png" | "image/jpeg",
  token: string,
  opts?: FetchOpts
): Promise<ScreenshotUploadResponse> {
  return request<ScreenshotUploadResponse>("/api/screenshots", {
    method: "POST",
    body: JSON.stringify({ data_base64, content_type }),
    token,
    ...opts,
  });
}

/** Magic-link email sign-in (Better Auth). */
export async function requestMagicLink(
  email: string,
  callbackURL?: string
): Promise<{ ok?: boolean; status?: boolean; dev_link?: string }> {
  return request("/api/auth/sign-in/magic-link", {
    method: "POST",
    body: JSON.stringify({
      email,
      callbackURL: callbackURL || `${APP_ORIGIN}/auth/extension/complete`,
    }),
  });
}
