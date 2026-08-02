-- 0001_initial.sql — core Annotated schema (fair-use annotation network)
-- Users bridge table is created in 0002_better_auth.sql.
-- author_user_id / user_id columns reference users(id) logically; FKs added after users exists.

-- Canonical source cache (not a full registry)
CREATE TABLE IF NOT EXISTS canonical_sources (
  key TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  type TEXT,
  domain TEXT,
  title TEXT,
  author TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  annotation_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_canonical_sources_domain ON canonical_sources(domain);

-- Annotations
-- clip_text: ≤100 words enforced at application layer (SQLite has no reliable word-count CHECK).
-- A/V window: ≤90s enforced here when both clip bounds are non-null.
CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  author_user_id INTEGER,
  anonymous INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL,
  canonical_source_key TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('article', 'video', 'audio', 'image')),
  source_title TEXT,
  source_author TEXT,
  domain TEXT,
  clip_text TEXT,
  clip_start_seconds REAL,
  clip_end_seconds REAL,
  transcript_excerpt TEXT,
  media_asset_key TEXT,
  screenshot_key TEXT,
  commentary TEXT NOT NULL,
  parent_id INTEGER REFERENCES annotations(id),
  thread_root_id INTEGER,
  fair_use_basis TEXT DEFAULT 'commentary-criticism',
  up_count INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  CHECK (
    clip_start_seconds IS NULL
    OR clip_end_seconds IS NULL
    OR (
      (clip_end_seconds - clip_start_seconds) > 0
      AND (clip_end_seconds - clip_start_seconds) <= 90
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_annotations_created_at ON annotations(created_at);
CREATE INDEX IF NOT EXISTS idx_annotations_canonical_source_key ON annotations(canonical_source_key);
CREATE INDEX IF NOT EXISTS idx_annotations_author_user_id ON annotations(author_user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_parent_id ON annotations(parent_id);
CREATE INDEX IF NOT EXISTS idx_annotations_thread_root_id ON annotations(thread_root_id);

-- Discussion comments on an annotation
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  user_id INTEGER,
  body TEXT NOT NULL CHECK (length(body) <= 1000),
  parent_id INTEGER REFERENCES comments(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_annotation_id ON comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- Votes (upsert by PK; app recomputes annotation up/down counts)
CREATE TABLE IF NOT EXISTS votes (
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  PRIMARY KEY (annotation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);

-- Copyright / fair-use concern reports
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  reporter_user_id INTEGER,
  reason TEXT NOT NULL CHECK (reason IN ('copyright_concern', 'other')),
  body TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_annotation_id ON reports(annotation_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved ON reports(resolved);
