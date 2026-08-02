/**
 * API contract types for Annotated (backend workers/api).
 * Keep in sync with docs/CONTRACTS.md.
 */

export type SourceType = "article" | "video" | "audio" | "image";
export type ReportReason = "copyright_concern" | "other";
export type SortMode = "hot" | "new";
export type LeaderboardWindow = "7d" | "30d" | "all";

export type ErrorCode =
  | "CLIP_TOO_LONG"
  | "CLIP_WINDOW_INVALID"
  | "COMMENTARY_REQUIRED"
  | "SOURCE_URL_INVALID"
  | "SOURCE_TYPE_INVALID"
  | "COMMENT_INVALID"
  | "REPORT_INVALID"
  | "VOTE_INVALID"
  | "PARENT_NOT_FOUND"
  | "BODY_INVALID"
  | "PAYLOAD_TOO_LARGE"
  | "rate_limited"
  | "not_found"
  | "internal_error";

export interface ApiError {
  error: string;
  code?: ErrorCode | string;
  status?: number;
}

export interface AuthorPublic {
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
}

export interface FeedItem {
  id: number;
  slug: string;
  anonymous: boolean;
  source_url: string;
  canonical_source_key: string;
  source_type: SourceType | string;
  source_title: string | null;
  source_author: string | null;
  domain: string | null;
  clip_text: string | null;
  clip_start_seconds: number | null;
  clip_end_seconds: number | null;
  transcript_excerpt: string | null;
  screenshot_key: string | null;
  commentary: string;
  parent_id: number | null;
  thread_root_id: number | null;
  up_count: number;
  down_count: number;
  comment_count: number;
  created_at: string;
  author: AuthorPublic;
}

export interface FeedResponse {
  items: FeedItem[];
  limit: number;
  offset: number;
  sort?: SortMode;
}

export interface CommentNode {
  id: number;
  annotation_id: number;
  body: string;
  parent_id: number | null;
  created_at: string;
  deleted_at: string | null;
  author: AuthorPublic;
  children: CommentNode[];
}

export interface AnnotationDetail {
  id: number;
  slug: string;
  anonymous: boolean;
  source_url: string;
  canonical_source_key: string;
  source_type: SourceType | string;
  source_title: string | null;
  source_author: string | null;
  domain: string | null;
  clip_text: string | null;
  clip_start_seconds: number | null;
  clip_end_seconds: number | null;
  transcript_excerpt: string | null;
  screenshot_key: string | null;
  media_asset_key: string | null;
  commentary: string;
  parent_id: number | null;
  thread_root_id: number | null;
  fair_use_basis: string | null;
  up_count: number;
  down_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
  youtube_video_id: string | null;
  author: AuthorPublic;
  parent: { slug: string; title_snippet: string } | null;
  children: FeedItem[];
}

export interface AnnotationDetailResponse {
  annotation: AnnotationDetail;
  comments: CommentNode[];
  user_vote: 1 | -1 | 0 | null;
  og: { title: string; author: string };
}

export interface CreateAnnotationRequest {
  source_url: string;
  source_type: SourceType;
  source_title?: string | null;
  source_author?: string | null;
  clip_text?: string | null;
  clip_start_seconds?: number | null;
  clip_end_seconds?: number | null;
  transcript_excerpt?: string | null;
  commentary: string;
  anonymous?: boolean;
  parent_id?: number | null;
  screenshot_upload_id?: string | null;
}

export interface CreateAnnotationResponse {
  slug: string;
  url: string;
}

export interface Profile {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  annotation_count: number;
}

export interface ProfileResponse {
  profile: Profile;
}

export interface Leaderboard {
  window: LeaderboardWindow | string;
  most_annotated: Array<{
    canonical_source_key: string;
    domain: string | null;
    title: string | null;
    count: number;
  }>;
  top_annotators: Array<{
    handle: string;
    display_name: string | null;
    annotations: number;
    net_votes: number;
  }>;
}

export interface Me {
  id: number;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface VoteResponse {
  up_count: number;
  down_count: number;
  user_vote: 1 | -1 | 0;
}

export interface CreateCommentRequest {
  body: string;
  parent_id?: number | null;
}

export interface CreateCommentResponse {
  id: number;
  annotation_id: number;
  body: string;
  parent_id: number | null;
  created_at: string;
}

export interface ReportRequest {
  reason: ReportReason;
  body?: string | null;
}

export interface ReportResponse {
  id: number;
  ok: boolean;
}

export interface ScreenshotUploadRequest {
  data_base64: string;
  content_type: "image/png" | "image/jpeg";
}

export interface ScreenshotUploadResponse {
  upload_id: string;
}

export interface MediaPrepareRequest {
  url: string;
}

export interface MediaPrepareResponse {
  ok: boolean;
  type: "video" | "audio" | "article" | "image" | "unknown";
  domain: string | null;
  canonical_key: string | null;
  youtube_video_id?: string;
  captions_available?: boolean;
  reason?: string;
}

export interface ExtensionTokenResponse {
  token: string;
  user: { handle: string; display_name: string | null };
}

export interface HealthResponse {
  ok: boolean;
}

export interface AdminReportsResponse {
  reports: Array<{
    id: number;
    annotation_id: number;
    reporter_user_id: number | null;
    reason: ReportReason;
    body: string | null;
    resolved: number;
    created_at: string;
    annotation_slug: string;
  }>;
}
