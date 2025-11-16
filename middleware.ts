import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Skip middleware for static assets and Next.js internals
  const pathname = request.nextUrl.pathname
  
  // Early return for static files and API routes that don't need auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/crime') ||
    pathname.startsWith('/api/311') ||
    pathname.startsWith('/api/fire') ||
    pathname.startsWith('/api/search') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/i)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Only check auth for routes that need it
  // Suppress console logs in production
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect authenticated users away from login/signup pages
  if (
    user &&
    (pathname.startsWith('/login') || pathname.startsWith('/signup'))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match only routes that need authentication checks:
     * - Login/signup pages (for redirect logic)
     * - API routes (for auth validation)
     * - Main app routes
     * Exclude static files, images, and Next.js internals
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}

