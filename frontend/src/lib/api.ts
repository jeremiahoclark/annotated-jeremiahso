/**
 * Typed same-origin API client for Annotated.
 * Pass token for extension bearer auth.
 */
import type {
  AnnotationDetailResponse,
  CreateAnnotationRequest,
  CreateAnnotationResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  ExtensionTokenResponse,
  FeedResponse,
  HealthResponse,
  Leaderboard,
  LeaderboardWindow,
  Me,
  MediaPrepareRequest,
  MediaPrepareResponse,
  ProfileResponse,
  ReportRequest,
  ReportResponse,
  ScreenshotUploadRequest,
  ScreenshotUploadResponse,
  SortMode,
  VoteResponse,
  AdminReportsResponse,
  ApiError,
} from "./types";

export type FetchOptions = {
  token?: string;
  signal?: AbortSignal;
};

export class ApiClientError extends Error {
  status: number;
  error: string;
  code?: string;

  constructor(status: number, body: ApiError) {
    super(body.error || `HTTP ${status}`);
    this.name = "ApiClientError";
    this.status = status;
    this.error = body.error || `HTTP ${status}`;
    this.code = body.code;
  }
}

function baseUrl(): string {
  // Same-origin: empty string so fetch('/api/...') works on app host
  return "";
}

async function request<T>(
  path: string,
  init: RequestInit & FetchOptions = {}
): Promise<T> {
  const { token, signal, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers,
    signal,
    credentials: "include",
  });

  if (!res.ok) {
    let body: ApiError = { error: res.statusText };
    try {
      body = (await res.json()) as ApiError;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health(opts?: FetchOptions) {
    return request<HealthResponse>("/api/health", opts);
  },

  feed(
    params?: { limit?: number; offset?: number; sort?: SortMode },
    opts?: FetchOptions
  ) {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    if (params?.sort) q.set("sort", params.sort);
    const qs = q.toString();
    return request<FeedResponse>(`/api/feed${qs ? `?${qs}` : ""}`, opts);
  },

  getAnnotation(slug: string, opts?: FetchOptions) {
    return request<AnnotationDetailResponse>(
      `/api/annotations/${encodeURIComponent(slug)}`,
      opts
    );
  },

  createAnnotation(body: CreateAnnotationRequest, opts?: FetchOptions) {
    return request<CreateAnnotationResponse>("/api/annotations", {
      method: "POST",
      body: JSON.stringify(body),
      ...opts,
    });
  },

  getProfile(handle: string, opts?: FetchOptions) {
    return request<ProfileResponse>(
      `/api/users/${encodeURIComponent(handle)}`,
      opts
    );
  },

  getUserAnnotations(
    handle: string,
    params?: { limit?: number; offset?: number },
    opts?: FetchOptions
  ) {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.offset != null) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<FeedResponse>(
      `/api/users/${encodeURIComponent(handle)}/annotations${qs ? `?${qs}` : ""}`,
      opts
    );
  },

  leaderboard(window: LeaderboardWindow = "7d", opts?: FetchOptions) {
    return request<Leaderboard>(
      `/api/leaderboard?window=${encodeURIComponent(window)}`,
      opts
    );
  },

  getComments(annotationId: number | string, opts?: FetchOptions) {
    return request<{ comments: AnnotationDetailResponse["comments"] }>(
      `/api/annotations/${annotationId}/comments`,
      opts
    );
  },

  postComment(
    annotationId: number | string,
    body: CreateCommentRequest,
    opts?: FetchOptions
  ) {
    return request<CreateCommentResponse>(
      `/api/annotations/${annotationId}/comments`,
      { method: "POST", body: JSON.stringify(body), ...opts }
    );
  },

  vote(
    annotationId: number | string,
    value: 1 | -1 | 0,
    opts?: FetchOptions
  ) {
    return request<VoteResponse>(`/api/annotations/${annotationId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
      ...opts,
    });
  },

  report(
    annotationId: number | string,
    body: ReportRequest,
    opts?: FetchOptions
  ) {
    return request<ReportResponse>(
      `/api/annotations/${annotationId}/report`,
      { method: "POST", body: JSON.stringify(body), ...opts }
    );
  },

  me(opts?: FetchOptions) {
    return request<Me>("/api/me", opts);
  },

  extensionToken(opts?: FetchOptions) {
    return request<ExtensionTokenResponse>("/api/auth/extension/token", {
      method: "POST",
      ...opts,
    });
  },

  uploadScreenshot(body: ScreenshotUploadRequest, opts?: FetchOptions) {
    return request<ScreenshotUploadResponse>("/api/screenshots", {
      method: "POST",
      body: JSON.stringify(body),
      ...opts,
    });
  },

  prepareMedia(body: MediaPrepareRequest, opts?: FetchOptions) {
    return request<MediaPrepareResponse>("/api/media/prepare", {
      method: "POST",
      body: JSON.stringify(body),
      ...opts,
    });
  },

  adminReports(params?: { resolved?: "0" | "1" }, opts?: FetchOptions) {
    const q = params?.resolved != null ? `?resolved=${params.resolved}` : "";
    return request<AdminReportsResponse>(`/api/admin/reports${q}`, opts);
  },

  resolveReport(id: number, opts?: FetchOptions) {
    return request<{ ok: boolean; id: number }>(
      `/api/admin/reports/${id}/resolve`,
      { method: "POST", ...opts }
    );
  },

  /** Absolute path for R2 media (served by api worker /media/:key). */
  mediaUrl(key: string): string {
    return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
  },
};

export default api;
