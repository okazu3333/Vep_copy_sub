-- Proto検証用の簡易スキーマ（Vercel Postgres / Supabase で実行）
-- psql -d $DATABASE_URL -f scripts/sql/proto_vercel_schema.sql

CREATE TABLE IF NOT EXISTS proto_raw_events (
  id TEXT PRIMARY KEY,
  label TEXT,
  notes TEXT,
  event JSONB NOT NULL,
  expected_segment TEXT,
  expected_rule TEXT,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proto_runtime_alerts (
  id TEXT PRIMARY KEY,
  source_event_id TEXT,
  segment TEXT,
  rule TEXT,
  severity TEXT,
  urgency_score INTEGER,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proto_alert_threads (
  thread_id TEXT PRIMARY KEY,
  customer TEXT,
  latest_segment TEXT,
  last_alert_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proto_runtime_alerts_event_idx ON proto_runtime_alerts (source_event_id);
CREATE INDEX IF NOT EXISTS proto_runtime_alerts_segment_idx ON proto_runtime_alerts (segment);
CREATE INDEX IF NOT EXISTS proto_raw_events_occurred_idx ON proto_raw_events (occurred_at DESC);
