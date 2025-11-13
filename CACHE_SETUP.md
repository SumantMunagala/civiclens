# Supabase Caching Setup Guide

This guide explains how to set up and use the Supabase-based caching layer for CivicLens API routes.

## Prerequisites

- Supabase project created at [supabase.com](https://supabase.com)
- Next.js project with Supabase client configured

## Step 1: Create the Cache Table in Supabase

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase_cache_setup.sql`
4. Click **Run** to execute the SQL

This will create:
- `api_cache` table with columns: `key`, `data`, `updated_at`
- Indexes for performance
- Optional cleanup function
- Row Level Security (RLS) policies

## Step 2: Configure Environment Variables

### Local Development (.env.local)

Add these variables to your `.env.local` file:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (Recommended for production)
# This bypasses RLS and is more secure for server-side operations
# Find it in: Supabase Dashboard > Settings > API > service_role key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Admin secret for cache invalidation
CACHE_ADMIN_SECRET=your-secure-random-string-here
```

**Note**: The service role key is recommended for production as it bypasses Row Level Security (RLS) and is more secure for server-side operations. If not provided, the system will fall back to the anon key.

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add the following variables:

   - **NEXT_PUBLIC_SUPABASE_URL**
     - Value: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
     - Environment: Production, Preview, Development

   - **NEXT_PUBLIC_SUPABASE_ANON_KEY**
     - Value: Your Supabase anon/public key
     - Environment: Production, Preview, Development

   - **SUPABASE_SERVICE_ROLE_KEY** (Recommended)
     - Value: Your Supabase service role key (found in Dashboard > Settings > API)
     - Environment: Production, Preview, Development
     - **Important**: This is a secret key - never expose it to the client!

   - **CACHE_ADMIN_SECRET** (Optional)
     - Value: A secure random string (e.g., generate with `openssl rand -hex 32`)
     - Environment: Production, Preview, Development
     - **Important**: Keep this secret! Never commit it to git.

4. Click **Save** for each variable
5. Redeploy your application for changes to take effect

## Step 3: Verify Setup

After deployment, test the caching:

1. Make a request to `/api/crime` - should fetch from API
2. Make another request immediately - should return cached data
3. Wait 10 minutes and request again - should fetch fresh data

## Cache Configuration

Each API route has its own cache duration:

- **Crime Data** (`/api/crime`): 10 minutes
- **311 Data** (`/api/311`): 15 minutes
- **Fire / Emergency Data** (`/api/fire`): 12 minutes

These durations are configured in each route file and can be adjusted based on your needs.

## Cache Invalidation

### Clear Specific Cache

```bash
curl -X POST "https://your-domain.com/api/admin/clear-cache?key=crime_data" \
  -H "Authorization: Bearer YOUR_CACHE_ADMIN_SECRET"
```

### Clear All Cache

```bash
curl -X POST "https://your-domain.com/api/admin/clear-cache?all=true" \
  -H "Authorization: Bearer YOUR_CACHE_ADMIN_SECRET"
```

### Using the Admin Route

The admin route is protected by the `CACHE_ADMIN_SECRET` environment variable. Always use HTTPS in production and keep the secret secure.

## How It Works

1. **First Request**: API route checks Supabase cache → Cache miss → Fetches from external API → Stores in cache → Returns data
2. **Subsequent Requests**: API route checks Supabase cache → Cache hit → Returns cached data immediately
3. **After Expiration**: API route checks Supabase cache → Cache expired → Fetches fresh data → Updates cache → Returns data

## Benefits

- ✅ **Reduced API Rate Limits**: Fewer calls to external APIs
- ✅ **Faster Response Times**: Cached responses are instant
- ✅ **Better Reliability**: Stale cache returned if API fails
- ✅ **Survives Deployments**: Cache persists across Vercel deployments
- ✅ **Handles Cold Starts**: Cached data available immediately

## Troubleshooting

### Cache Not Working

1. Verify Supabase environment variables are set correctly
2. Check that the `api_cache` table exists in Supabase
3. Check browser console and server logs for errors
4. Verify RLS policies allow your service role to read/write

### Cache Always Expired

- Check that `updated_at` column is being set correctly
- Verify timezone settings in Supabase

### Permission Errors

- Ensure RLS policies are configured correctly
- If using anon key, you may need to adjust RLS policies
- Consider using service role key for server-side operations

## Maintenance

### Cleanup Old Cache Entries

You can manually run the cleanup function in Supabase SQL Editor:

```sql
SELECT cleanup_expired_cache(24); -- Remove entries older than 24 hours
```

Or set up a cron job (requires pg_cron extension):

```sql
SELECT cron.schedule('cleanup-cache', '0 * * * *', 'SELECT cleanup_expired_cache(24)');
```

