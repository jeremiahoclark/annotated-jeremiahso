/**
 * Server-side fair-use + input validation.
 * All violations return 422 { error, code } via ValidationError.
 */

import type { ReportReason, SourceType } from "./db";

export type ValidationCode =
  | "CLIP_TOO_LONG"
  | "CLIP_WINDOW_INVALID"
  | "COMMENTARY_REQUIRED"
  | "SOURCE_URL_INVALID"
  | "SOURCE_TYPE_INVALID"
  | "COMMENT_INVALID"
  | "REPORT_INVALID"
  | "VOTE_INVALID"
  | "PARENT_NOT_FOUND"
  | "BODY_INVALID";

export class ValidationError extends Error {
  readonly code: ValidationCode;
  readonly status = 422;

  constructor(code: ValidationCode, message: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }

  toJSON() {
    return { error: this.message, code: this.code };
  }
}

const SOURCE_TYPES: SourceType[] = ["article", "video", "audio", "image"];
const REPORT_REASONS: ReportReason[] = ["copyright_concern", "other"];

/** Whitespace-separated token count (empty → 0). */
export function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/**
 * Text clips: max 100 words.
 * Boundary: 100 OK, 101 → CLIP_TOO_LONG.
 */
export function validateClipText(clipText: string | null | undefined): void {
  if (clipText == null || clipText === "") return;
  if (wordCount(clipText) > 100) {
    throw new ValidationError(
      "CLIP_TOO_LONG",
      "Text clips are limited to 100 words"
    );
  }
}

/**
 * A/V window: clip_end - clip_start must be in (0, 90].
 * Required for video/audio source_type.
 * Boundary: 90 OK, 90.1 → CLIP_WINDOW_INVALID; <=0 invalid.
 */
export function validateClipWindow(
  sourceType: SourceType,
  start: number | null | undefined,
  end: number | null | undefined
): void {
  const needsWindow = sourceType === "video" || sourceType === "audio";

  if (start == null && end == null) {
    if (needsWindow) {
      throw new ValidationError(
        "CLIP_WINDOW_INVALID",
        "clip_start_seconds and clip_end_seconds are required for video/audio"
      );
    }
    return;
  }

  if (
    start == null ||
    end == null ||
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < 0
  ) {
    throw new ValidationError(
      "CLIP_WINDOW_INVALID",
      "clip_start_seconds and clip_end_seconds must be non-negative numbers"
    );
  }

  const duration = end - start;
  if (duration <= 0 || duration > 90) {
    throw new ValidationError(
      "CLIP_WINDOW_INVALID",
      "Clip window must be greater than 0 and at most 90 seconds"
    );
  }
}

/**
 * Commentary required: min 10 non-whitespace characters (top-level annotations).
 * For replies (parent_id set), still require the same min per product rule.
 */
export function validateCommentary(commentary: unknown): string {
  if (typeof commentary !== "string") {
    throw new ValidationError(
      "COMMENTARY_REQUIRED",
      "Commentary is required (min 10 non-whitespace characters)"
    );
  }
  const nonWs = commentary.replace(/\s/g, "");
  if (nonWs.length < 10) {
    throw new ValidationError(
      "COMMENTARY_REQUIRED",
      "Commentary is required (min 10 non-whitespace characters)"
    );
  }
  return commentary.trim();
}

export function validateSourceUrl(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) {
    throw new ValidationError("SOURCE_URL_INVALID", "source_url is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ValidationError(
      "SOURCE_URL_INVALID",
      "source_url must be an absolute http(s) URL"
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(
      "SOURCE_URL_INVALID",
      "source_url must be http or https"
    );
  }
  return url.trim();
}

export function validateSourceType(type: unknown): SourceType {
  if (typeof type !== "string" || !SOURCE_TYPES.includes(type as SourceType)) {
    throw new ValidationError(
      "SOURCE_TYPE_INVALID",
      `source_type must be one of: ${SOURCE_TYPES.join(", ")}`
    );
  }
  return type as SourceType;
}

/** Comment body 1..1000 chars (after trim). */
export function validateCommentBody(body: unknown): string {
  if (typeof body !== "string") {
    throw new ValidationError("COMMENT_INVALID", "Comment body is required");
  }
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) {
    throw new ValidationError(
      "COMMENT_INVALID",
      "Comment body must be 1–1000 characters"
    );
  }
  return trimmed;
}

export function validateReportReason(reason: unknown): ReportReason {
  if (
    typeof reason !== "string" ||
    !REPORT_REASONS.includes(reason as ReportReason)
  ) {
    throw new ValidationError(
      "REPORT_INVALID",
      "reason must be copyright_concern or other"
    );
  }
  return reason as ReportReason;
}

export function validateVoteValue(value: unknown): 1 | -1 | 0 {
  if (value === 1 || value === -1 || value === 0) return value;
  if (value === "1") return 1;
  if (value === "-1") return -1;
  if (value === "0") return 0;
  throw new ValidationError("VOTE_INVALID", "value must be 1, -1, or 0");
}

export interface CreateAnnotationInput {
  source_url: string;
  source_type: SourceType;
  source_title?: string | null;
  source_author?: string | null;
  clip_text?: string | null;
  clip_start_seconds?: number | null;
  clip_end_seconds?: number | null;
  transcript_excerpt?: string | null;
  commentary: string;
  anonymous?: boolean | number;
  parent_id?: number | null;
  screenshot_upload_id?: string | null;
}

export function validateCreateAnnotation(body: unknown): CreateAnnotationInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("BODY_INVALID", "JSON body required");
  }
  const b = body as Record<string, unknown>;
  const source_url = validateSourceUrl(b.source_url);
  const source_type = validateSourceType(b.source_type);
  const commentary = validateCommentary(b.commentary);
  validateClipText(
    typeof b.clip_text === "string" ? b.clip_text : null
  );
  validateClipWindow(
    source_type,
    typeof b.clip_start_seconds === "number" ? b.clip_start_seconds : null,
    typeof b.clip_end_seconds === "number" ? b.clip_end_seconds : null
  );

  return {
    source_url,
    source_type,
    source_title:
      typeof b.source_title === "string" ? b.source_title : null,
    source_author:
      typeof b.source_author === "string" ? b.source_author : null,
    clip_text: typeof b.clip_text === "string" ? b.clip_text : null,
    clip_start_seconds:
      typeof b.clip_start_seconds === "number" ? b.clip_start_seconds : null,
    clip_end_seconds:
      typeof b.clip_end_seconds === "number" ? b.clip_end_seconds : null,
    transcript_excerpt:
      typeof b.transcript_excerpt === "string" ? b.transcript_excerpt : null,
    commentary,
    anonymous: b.anonymous === true || b.anonymous === 1,
    parent_id:
      typeof b.parent_id === "number" && Number.isFinite(b.parent_id)
        ? b.parent_id
        : null,
    screenshot_upload_id:
      typeof b.screenshot_upload_id === "string"
        ? b.screenshot_upload_id
        : null,
  };
}
