import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for server-side operations
 * Uses service role key if available (bypasses RLS), otherwise falls back to anon key
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable. Please check your .env.local file.'
    )
  }

  // Prefer service role key for server-side operations (bypasses RLS)
  const apiKey = serviceRoleKey || anonKey

  if (!apiKey) {
    throw new Error(
      'Missing Supabase API key. Please set either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    )
  }

  return createSupabaseClient(supabaseUrl, apiKey)
}

