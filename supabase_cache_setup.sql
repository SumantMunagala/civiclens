-- ============================================
-- Supabase Cache Table Setup for CivicLens
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This creates the api_cache table for storing cached API responses

-- Create the api_cache table
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on updated_at for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_api_cache_updated_at ON api_cache(updated_at);

-- Create an index on key for faster lookups (though key is already primary key)
-- This is optional but can help with query planning
CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(key);

-- Optional: Add a function to automatically clean up expired cache entries
-- This can be called periodically or via a cron job
CREATE OR REPLACE FUNCTION cleanup_expired_cache(max_age_hours INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_cache
  WHERE updated_at < NOW() - (max_age_hours || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up Row Level Security (RLS) policies
-- Enable RLS on the table
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything (for server-side operations with service role key)
CREATE POLICY "Service role can manage cache"
  ON api_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Allow anon key to read and write cache (for server-side operations with anon key)
-- This allows the anon key to work if service role key is not configured
CREATE POLICY "Anon can manage cache"
  ON api_cache
  FOR ALL
  USING (auth.role() = 'anon');

-- Note: 
-- - If using SUPABASE_SERVICE_ROLE_KEY: Service role policy will be used (recommended)
-- - If using only NEXT_PUBLIC_SUPABASE_ANON_KEY: Anon policy will be used
-- - Service role key bypasses RLS and is recommended for production
