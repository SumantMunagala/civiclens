# Authentication & User Settings Setup for CivicLens

This guide will walk you through setting up user authentication and user-specific settings for your CivicLens application.

## Step 1: Enable Email/Password Authentication in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Providers**
3. Enable **Email** provider
4. Configure email settings (SMTP) if you want custom email templates
5. **Important**: For development, you may want to disable email confirmation:
   - Go to **Authentication** > **Settings**
   - Under **Email Auth**, toggle off **"Enable email confirmations"**
   - This allows users to sign in immediately after signup (useful for development)
   - **Note**: For production, keep email confirmation enabled for security
6. Save changes

## Step 2: Create Database Tables

Run the SQL script in your Supabase SQL Editor:

1. Go to **SQL Editor** in your Supabase Dashboard
2. Click **New query**
3. Copy and paste the entire content from `supabase_auth_setup.sql`
4. Click **Run**

This will create:
- `user_profiles` table for user profile information
- `user_settings` table for user preferences
- Row Level Security (RLS) policies
- Triggers to automatically create profiles and settings on signup

## Step 3: Environment Variables

Ensure your `.env.local` file includes:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service role key for admin operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Step 4: Install Dependencies

The required package `@supabase/ssr` should already be installed. If not:

```bash
npm install @supabase/ssr
```

## Step 5: Test Authentication

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click **Sign In** in the header
4. Create a new account on the signup page
5. After signing up, you should be redirected to the dashboard
6. Click the settings icon (⚙️) in the header to access user settings

## Features Implemented

### Authentication
- ✅ Email/password sign up (`/signup`)
- ✅ Email/password login (`/login`)
- ✅ Logout button in dashboard header
- ✅ Protected routes via middleware
- ✅ Automatic redirect for authenticated users

### User Settings
- ✅ Save preferred data layers (Crime, 311, Fire)
- ✅ Save default time window filter
- ✅ Save map theme preference (light/dark)
- ✅ Settings automatically load on login
- ✅ Settings modal with Tailwind UI styling

### Database Schema

**user_profiles**
- `id` (UUID, references auth.users)
- `created_at` (timestamp)
- `display_name` (text)
- `avatar_url` (text)

**user_settings**
- `user_id` (UUID, references auth.users)
- `preferred_datasets` (JSONB) - `{ crime: boolean, service: boolean, fire: boolean }`
- `preferred_time_window` (integer) - hours
- `map_style` (text) - "light" or "dark"
- `home_location` (JSONB) - `{ lat: number, lng: number, zoom: number }`
- `updated_at` (timestamp)

### API Routes

- `GET /api/settings` - Fetch user's saved settings
- `POST /api/settings` - Save/update user settings

Both routes require authentication and enforce Row Level Security.

## Security Features

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ Server-side session validation
- ✅ Secure cookie handling via `@supabase/ssr`
- ✅ No auth tokens exposed to client

## Usage

### For Users

1. **Sign Up**: Create an account at `/signup`
2. **Sign In**: Log in at `/login`
3. **Settings**: Click the settings icon (⚙️) in the header to customize preferences
4. **Logout**: Click "Logout" button in the header

### For Developers

**Check authentication state:**
```typescript
import { useUser } from "@/lib/hooks/useUser";

function MyComponent() {
  const { user, loading } = useUser();
  // user is null if not authenticated
}
```

**Load user settings:**
```typescript
const res = await fetch("/api/settings");
const settings = await res.json();
```

**Save user settings:**
```typescript
const res = await fetch("/api/settings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    preferred_datasets: { crime: true, service: true, fire: false },
    preferred_time_window: 168, // 7 days
    map_style: "dark",
  }),
});
```

## Troubleshooting

**Issue**: "Unauthorized" errors when accessing `/api/settings`
- **Solution**: Ensure you're logged in and the session cookie is being sent

**Issue**: Settings not loading on login
- **Solution**: Check browser console for errors, verify RLS policies are enabled

**Issue**: Can't sign up
- **Solution**: Verify email provider is enabled in Supabase Dashboard > Authentication > Providers

**Issue**: Middleware warnings
- **Solution**: The warning about "middleware" being deprecated is informational. The code still works correctly.

## Next Steps

- Add email verification
- Add password reset functionality
- Add social auth providers (Google, GitHub, etc.)
- Add user profile editing
- Add saved locations/bookmarks

