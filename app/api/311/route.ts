import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/supabase/cache";

// TypeScript interface for 311 service request data
interface ServiceRequest {
  id: string;
  category: string;
  description: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string | null;
  status: string | null;
  neighborhood: string | null;
  agency: string | null;
}

// Cache configuration
const CACHE_KEY = "311_data";
const CACHE_MAX_AGE_MINUTES = 15; // Cache for 15 minutes (311 data changes less frequently)

export async function GET() {
  try {
    // Check cache first
    const cachedData = await getCached(CACHE_KEY, CACHE_MAX_AGE_MINUTES);
    
    if (cachedData) {
      console.log("Returning cached 311 data");
      return NextResponse.json(cachedData);
    }

    // Cache miss or expired - fetch from external API
    console.log("Fetching fresh 311 data from API");
    const res = await fetch(
      "https://data.sfgov.org/resource/vw6y-z8j6.json?$limit=200",
      {
        cache: "no-store",
        headers: {
          "User-Agent": "CivicLens/1.0",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`311 API error: ${res.status} ${res.statusText}`);
    }

    const rawData = await res.json();

    // Validate response is an array
    if (!Array.isArray(rawData)) {
      throw new Error("Invalid API response: expected array");
    }

    // Normalize and validate data
    const formatted: ServiceRequest[] = rawData
      .filter((item: any) => {
        // Filter out items without valid coordinates
        const lat = item?.lat || item?.latitude;
        const lng = item?.long || item?.longitude;
        return lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
      })
      .map((item: any) => ({
        id: item.service_request_id || `311-${Math.random().toString(36).substr(2, 9)}`,
        category: item.request_type || item.service_name || "Unknown",
        description: item.service_details || item.description || null,
        timestamp: item.requested_datetime || item.opened || new Date().toISOString(),
        latitude: parseFloat(item.lat || item.latitude),
        longitude: parseFloat(item.long || item.longitude),
        address: item.address || item.incident_address || null,
        status: item.status || item.status_notes || null,
        neighborhood: item.neighborhood || item.supervisor_district || null,
        agency: item.agency_responsible || null,
      }))
      .filter((item: ServiceRequest) => {
        // Additional validation: ensure coordinates are valid and not zero
        return (
          item.latitude !== 0 &&
          item.longitude !== 0 &&
          item.latitude >= -90 &&
          item.latitude <= 90 &&
          item.longitude >= -180 &&
          item.longitude <= 180
        );
      });

    // Validate we have data
    if (formatted.length === 0) {
      console.warn("No valid 311 data found in API response");
      // Return empty array instead of error to prevent app crash
      return NextResponse.json([]);
    }

    // Store in cache (fire and forget - don't block response)
    setCache(CACHE_KEY, formatted).catch((error) => {
      console.error("Failed to cache 311 data:", error);
      // Don't throw - caching failure shouldn't break the API
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching 311 data:", error);
    
    // Try to return stale cache if available (even if expired)
    try {
      const staleCache = await getCached(CACHE_KEY, 999999); // Get any cache regardless of age
      if (staleCache) {
        console.log("Returning stale cache due to API error");
        return NextResponse.json(staleCache);
      }
    } catch (cacheError) {
      console.error("Failed to retrieve stale cache:", cacheError);
    }

    return NextResponse.json(
      { error: "Failed to fetch 311 data" },
      { status: 500 }
    );
  }
}
