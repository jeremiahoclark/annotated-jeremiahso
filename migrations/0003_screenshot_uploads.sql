-- 0003_screenshot_uploads.sql — pending screenshot uploads before annotation create
-- Client uploads screenshot → upload_id; annotation create references it and marks used=1.

CREATE TABLE IF NOT EXISTS screenshot_uploads (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_screenshot_uploads_user_id ON screenshot_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_uploads_used ON screenshot_uploads(used);
