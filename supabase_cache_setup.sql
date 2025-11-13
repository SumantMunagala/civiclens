-- Create the api_cache table for storing cached API responses
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS api_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  cache_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on cache_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);

-- Create an index on fetched_at for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_api_cache_fetched_at ON api_cache(fetched_at);

-- Optional: Add a function to automatically clean up old cache entries (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache
  WHERE fetched_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up a scheduled job to run cleanup (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled:
-- SELECT cron.schedule('cleanup-cache', '0 * * * *', 'SELECT cleanup_old_cache()');

