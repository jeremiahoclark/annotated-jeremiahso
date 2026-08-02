/**
 * Extension-local types. API shapes imported type-only from frontend contracts.
 */
import type {
  CreateAnnotationRequest,
  CreateAnnotationResponse,
  Me,
  ScreenshotUploadResponse,
  SourceType,
} from "@annotated/types";

export type {
  CreateAnnotationRequest,
  CreateAnnotationResponse,
  Me,
  ScreenshotUploadResponse,
  SourceType,
  ErrorCode,
  ApiError,
  HealthResponse,
} from "@annotated/types";

export type OgMeta = {
  title?: string | null;
  description?: string | null;
  site_name?: string | null;
  author?: string | null;
};

export type ExtractedMedia = {
  found: boolean;
  error?: string;
  currentSrc?: string | null;
  duration?: number | null;
  currentTime?: number;
  isYouTubePage?: boolean;
  videoId?: string | null;
  pageUrl?: string;
  title?: string;
  og?: OgMeta;
  posterUrl?: string | null;
};

export type ScreenshotInfo = {
  upload_id?: string;
  dataUrl?: string;
};

export type ClipDraftKind = "av" | "text" | "page" | "image";

export type ClipDraft = {
  kind: ClipDraftKind;
  pageUrl: string;
  title: string;
  og?: OgMeta;
  /** A/V */
  currentSrc?: string | null;
  duration?: number | null;
  currentTime?: number;
  isYouTubePage?: boolean;
  videoId?: string | null;
  posterUrl?: string | null;
  /** Text */
  text?: string;
  /** Image context menu */
  imageUrl?: string;
  screenshot?: ScreenshotInfo;
  createdAt: number;
};

export type StoredAuth = {
  token: string;
  user: {
    handle: string;
    display_name: string | null;
    id?: number;
    avatar_url?: string | null;
  };
};

export type RuntimeMessage =
  | { type: "clip-draft-ready" }
  | { type: "open-compose" }
  | { type: "ping" };

export type { Me as ApiMe };
