import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/supabase/cache";

// TypeScript interface for crime incident data
interface CrimeIncident {
  id: string;
  category: string;
  description: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string | null;
  policeDistrict: string | null;
  resolution: string | null;
  dayOfWeek: string | null;
}

// Cache configuration
const CACHE_KEY = "crime_data";
const CACHE_MAX_AGE_MINUTES = 10; // Cache for 10 minutes

export async function GET() {
  try {
    // Check cache first
    const cachedData = await getCached(CACHE_KEY, CACHE_MAX_AGE_MINUTES);
    
    if (cachedData) {
      console.log("Returning cached crime data");
      return NextResponse.json(cachedData);
    }

    // Cache miss or expired - fetch from external API
    console.log("Fetching fresh crime data from API");
    const res = await fetch(
      "https://data.sfgov.org/resource/wg3w-h783.json?$limit=100",
      {
        cache: "no-store",
        headers: {
          "User-Agent": "CivicLens/1.0",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Crime API error: ${res.status} ${res.statusText}`);
    }

    const rawData = await res.json();

    // Validate response is an array
    if (!Array.isArray(rawData)) {
      throw new Error("Invalid API response: expected array");
    }

    // Normalize and validate data
    const crime: CrimeIncident[] = rawData
      .filter((item: any) => {
        // Filter out items without valid coordinates
        const lat = item?.latitude;
        const lng = item?.longitude;
        return lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
      })
      .map((item: any) => ({
        id: item.incident_id || `crime-${Math.random().toString(36).substr(2, 9)}`,
        category: item.incident_category || "Unknown",
        description: item.incident_description || item.incident_subcategory || null,
        timestamp: item.incident_datetime || new Date().toISOString(),
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        address: item.incident_address || item.address || null,
        policeDistrict: item.police_district || item.district || null,
        resolution: item.resolution || null,
        dayOfWeek: item.day_of_week || null,
      }))
      .filter((item: CrimeIncident) => {
        // Additional validation: ensure coordinates are within reasonable bounds
        return (
          item.latitude >= -90 &&
          item.latitude <= 90 &&
          item.longitude >= -180 &&
          item.longitude <= 180
        );
      });

    // Validate we have data
    if (crime.length === 0) {
      console.warn("No valid crime data found in API response");
      // Return empty array instead of error to prevent app crash
      return NextResponse.json([]);
    }

    // Store in cache (fire and forget - don't block response)
    setCache(CACHE_KEY, crime).catch((error) => {
      console.error("Failed to cache crime data:", error);
      // Don't throw - caching failure shouldn't break the API
    });

    return NextResponse.json(crime);
  } catch (error) {
    console.error("Error fetching crime data:", error);
    
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
      { error: "Failed to fetch crime data" },
      { status: 500 }
    );
  }
}
