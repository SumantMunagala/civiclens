-- ============================================
-- Fix RLS Policies for api_cache Table
-- ============================================
-- Run this SQL in your Supabase SQL Editor to fix the cache write errors
-- This allows server-side operations to write to the cache table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage cache" ON api_cache;
DROP POLICY IF EXISTS "Anon can manage cache" ON api_cache;

-- Option 1: Disable RLS for api_cache (Recommended for server-side cache)
-- This is safe because the cache is only accessed from server-side API routes
-- and the service role key should be used for these operations
ALTER TABLE api_cache DISABLE ROW LEVEL SECURITY;

-- Option 2: If you prefer to keep RLS enabled, use this permissive policy instead:
-- CREATE POLICY "Allow all cache operations"
--   ON api_cache
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- Note: 
-- - With RLS disabled, the service role key (SUPABASE_SERVICE_ROLE_KEY) will work
-- - The anon key will also work, but service role is recommended for server-side operations
-- - This is safe because api_cache is only accessed from server-side API routes, not client-side

