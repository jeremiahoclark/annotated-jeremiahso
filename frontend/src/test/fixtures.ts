import type {
  AnnotationDetail,
  AnnotationDetailResponse,
  FeedItem,
  Me,
} from "@/lib/types";

export const mockMe: Me = {
  id: 1,
  handle: "jay",
  display_name: "Jay",
  avatar_url: null,
  created_at: "2025-01-01T00:00:00.000Z",
};

export const mockFeedItem: FeedItem = {
  id: 42,
  slug: "demo-clip-ab12",
  anonymous: false,
  source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  canonical_source_key: "youtube:dQw4w9WgXcQ",
  source_type: "video",
  source_title: "Interesting podcast take",
  source_author: "Host",
  domain: "youtube.com",
  clip_text: null,
  clip_start_seconds: 47,
  clip_end_seconds: 137,
  transcript_excerpt: "Sample transcript window text.",
  screenshot_key: null,
  commentary:
    "This moment reframes the entire debate about fair use and commentary.",
  parent_id: null,
  thread_root_id: 42,
  up_count: 12,
  down_count: 1,
  comment_count: 3,
  created_at: "2026-03-01T12:00:00.000Z",
  author: {
    handle: "alice",
    display_name: "Alice",
    avatar_url: null,
  },
};

export const mockFeedItem2: FeedItem = {
  ...mockFeedItem,
  id: 43,
  slug: "second-clip-cd34",
  source_title: "Another take",
  commentary: "Second card for list rendering.",
  clip_start_seconds: 10,
  clip_end_seconds: 40,
};

export const mockAnnotationDetail: AnnotationDetail = {
  ...mockFeedItem,
  media_asset_key: null,
  fair_use_basis: "commentary-criticism",
  updated_at: null,
  youtube_video_id: "dQw4w9WgXcQ",
  parent: null,
  children: [],
};

export const mockAnnotationResponse: AnnotationDetailResponse = {
  annotation: mockAnnotationDetail,
  comments: [],
  user_vote: null,
  og: { title: "Interesting podcast take", author: "Host" },
};
