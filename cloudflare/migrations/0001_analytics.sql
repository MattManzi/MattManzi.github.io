CREATE TABLE IF NOT EXISTS analytics_counts (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  device TEXT NOT NULL,
  browser TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, country, device, browser, source, metric)
);
CREATE INDEX IF NOT EXISTS analytics_counts_day ON analytics_counts(day);
CREATE TABLE IF NOT EXISTS analytics_dedup (
  event_id TEXT PRIMARY KEY,
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_dedup_created ON analytics_dedup(created_at);
CREATE TABLE IF NOT EXISTS analytics_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_rate_expiry ON analytics_rate_limits(expires_at);
