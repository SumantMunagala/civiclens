import { NextResponse } from "next/server";
import { invalidateCache, invalidateAllCache } from "@/lib/supabase/cache";

/**
 * Admin route for cache invalidation
 * Protected by CACHE_ADMIN_SECRET environment variable
 * 
 * Usage:
 *   - Clear specific cache: POST /api/admin/clear-cache?key=crime_data
 *   - Clear all cache: POST /api/admin/clear-cache?all=true
 */
export async function POST(request: Request) {
  try {
    // Verify admin secret
    const adminSecret = process.env.CACHE_ADMIN_SECRET;
    
    if (!adminSecret) {
      console.error("CACHE_ADMIN_SECRET not configured");
      return NextResponse.json(
        { error: "Admin route not configured" },
        { status: 500 }
      );
    }

    // Get secret from request header
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== adminSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      // Clear all cache
      const success = await invalidateAllCache();
      
      if (success) {
        console.log("All cache cleared by admin");
        return NextResponse.json({
          success: true,
          message: "All cache entries cleared",
        });
      } else {
        return NextResponse.json(
          { error: "Failed to clear all cache" },
          { status: 500 }
        );
      }
    } else if (key) {
      // Clear specific cache key
      const success = await invalidateCache(key);
      
      if (success) {
        console.log(`Cache cleared for key: ${key}`);
        return NextResponse.json({
          success: true,
          message: `Cache cleared for key: ${key}`,
        });
      } else {
        return NextResponse.json(
          { error: `Failed to clear cache for key: ${key}` },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing parameter: provide 'key' or 'all=true'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in clear-cache route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking cache status (read-only, no auth required for status)
 */
export async function GET() {
  return NextResponse.json({
    message: "Cache admin endpoint",
    usage: {
      clearSpecific: "POST /api/admin/clear-cache?key=crime_data (requires Bearer token)",
      clearAll: "POST /api/admin/clear-cache?all=true (requires Bearer token)",
    },
  });
}

