-- Run in Supabase SQL Editor
-- W5: Session Replay snapshots

CREATE TABLE IF NOT EXISTS codecast_snapshots (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES codecast_sessions(id) ON DELETE CASCADE,
  code        TEXT NOT NULL DEFAULT '',
  language    TEXT NOT NULL DEFAULT 'typescript',
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast time-ordered replay fetch
CREATE INDEX IF NOT EXISTS idx_snapshots_session_time
  ON codecast_snapshots(session_id, captured_at ASC);
