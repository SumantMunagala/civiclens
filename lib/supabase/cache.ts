import { createServiceRoleClient } from "./server";

/**
 * Cache entry interface matching the Supabase table structure
 */
interface CacheEntry {
  key: string;
  data: any;
  updated_at: string;
}

/**
 * Retrieves cached data from Supabase if it exists and is not expired
 * 
 * @param key - Unique cache key identifier
 * @param maxMinutes - Maximum age of cache in minutes before it's considered expired
 * @returns Cached data if found and fresh, null otherwise
 */
export async function getCached(
  key: string,
  maxMinutes: number
): Promise<any | null> {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("api_cache")
      .select("data, updated_at")
      .eq("key", key)
      .single();

    if (error || !data) {
      // Cache miss or error - return null
      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" which is expected, log other errors
        console.error(`Cache read error for key "${key}":`, error.message);
      }
      return null;
    }

    // Check if cache is expired
    const updatedAt = new Date(data.updated_at);
    const ageMinutes = (Date.now() - updatedAt.getTime()) / (1000 * 60);

    if (ageMinutes >= maxMinutes) {
      // Cache expired
      return null;
    }

    // Return cached data
    return data.data;
  } catch (error) {
    console.error(`Error retrieving cache for key "${key}":`, error);
    return null;
  }
}

/**
 * Stores data in Supabase cache with upsert logic to prevent duplicates
 * 
 * @param key - Unique cache key identifier
 * @param data - Data to cache (will be serialized as JSONB)
 * @returns true if successful, false otherwise
 */
export async function setCache(
  key: string,
  data: any
): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();

    // Upsert: update if exists, insert if not
    const { error } = await supabase
      .from("api_cache")
      .upsert(
        {
          key,
          data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "key",
        }
      );

    if (error) {
      console.error(`Cache write error for key "${key}":`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error setting cache for key "${key}":`, error);
    return false;
  }
}

/**
 * Invalidates a specific cache entry by deleting it
 * 
 * @param key - Cache key to invalidate
 * @returns true if successful, false otherwise
 */
export async function invalidateCache(key: string): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("api_cache")
      .delete()
      .eq("key", key);

    if (error) {
      console.error(`Cache invalidation error for key "${key}":`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error invalidating cache for key "${key}":`, error);
    return false;
  }
}

/**
 * Invalidates all cache entries (use with caution)
 * 
 * @returns true if successful, false otherwise
 */
export async function invalidateAllCache(): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from("api_cache")
      .delete()
      .neq("key", ""); // Delete all entries

    if (error) {
      console.error("Cache invalidation error (all):", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error invalidating all cache:", error);
    return false;
  }
}
