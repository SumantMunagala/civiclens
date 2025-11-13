import { NextResponse } from "next/server";
import { getCached, setCache } from "@/lib/supabase/cache";

// TypeScript interface for fire/emergency incident data
interface FireIncident {
  id: string;
  category: string;
  description: string | null;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string | null;
  neighborhood: string | null;
  incidentNumber: string | null;
  primarySituation: string | null;
  alarmTime: string | null;
  arrivalTime: string | null;
  closeTime: string | null;
  battalion: string | null;
  stationArea: string | null;
}

// Cache configuration
const CACHE_KEY = "fire_data";
const CACHE_MAX_AGE_MINUTES = 12; // Cache for 12 minutes (fire data changes moderately)

export async function GET() {
  try {
    // Check cache first
    const cachedData = await getCached(CACHE_KEY, CACHE_MAX_AGE_MINUTES);
    
    if (cachedData) {
      console.log("Returning cached fire data");
      return NextResponse.json(cachedData);
    }

    // Cache miss or expired - fetch from external API
    console.log("Fetching fresh fire data from API");
    const res = await fetch(
      "https://data.sfgov.org/resource/wr8u-xric.json?$limit=200",
      {
        cache: "no-store",
        headers: {
          "User-Agent": "CivicLens/1.0",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Fire API error: ${res.status} ${res.statusText}`);
    }

    const rawData = await res.json();

    // Validate response is an array
    if (!Array.isArray(rawData)) {
      throw new Error("Invalid API response: expected array");
    }

    // Normalize and validate data
    const fire: FireIncident[] = rawData
      .filter((item: any) => {
        // Extract coordinates from point object or direct lat/lng fields
        const point = item?.point;
        let lat: number | null = null;
        let lng: number | null = null;

        if (point && point.coordinates) {
          // GeoJSON format: [lng, lat]
          [lng, lat] = point.coordinates;
        } else if (item?.latitude && item?.longitude) {
          lat = parseFloat(item.latitude);
          lng = parseFloat(item.longitude);
        } else if (item?.lat && item?.lon) {
          lat = parseFloat(item.lat);
          lng = parseFloat(item.lon);
        }

        // Filter out items without valid coordinates
        return (
          lat &&
          lng &&
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      })
      .map((item: any) => {
        // Extract coordinates
        const point = item?.point;
        let lat = 0;
        let lng = 0;

        if (point && point.coordinates) {
          [lng, lat] = point.coordinates;
        } else if (item?.latitude && item?.longitude) {
          lat = parseFloat(item.latitude);
          lng = parseFloat(item.longitude);
        } else if (item?.lat && item?.lon) {
          lat = parseFloat(item.lat);
          lng = parseFloat(item.lon);
        }

        return {
          id: item.incident_number || `fire-${Math.random().toString(36).substr(2, 9)}`,
          category: item.primary_situation || "Emergency Response",
          description: item.primary_situation || item.incident_type || null,
          timestamp: item.alarm_dttm || item.arrival_dttm || item.close_dttm || new Date().toISOString(),
          latitude: lat,
          longitude: lng,
          address: item.address || item.location || null,
          neighborhood: item.neighborhood_district || item.neighborhood || null,
          incidentNumber: item.incident_number || null,
          primarySituation: item.primary_situation || null,
          alarmTime: item.alarm_dttm || null,
          arrivalTime: item.arrival_dttm || null,
          closeTime: item.close_dttm || null,
          battalion: item.battalion || null,
          stationArea: item.station_area || item.station || null,
        };
      })
      .filter((item: FireIncident) => {
        // Additional validation: ensure coordinates are within reasonable bounds
        return (
          item.latitude >= -90 &&
          item.latitude <= 90 &&
          item.longitude >= -180 &&
          item.longitude <= 180 &&
          item.latitude !== 0 &&
          item.longitude !== 0
        );
      });

    // Validate we have data
    if (fire.length === 0) {
      console.warn("No valid fire data found in API response");
      // Return empty array instead of error to prevent app crash
      return NextResponse.json([]);
    }

    // Store in cache (fire and forget - don't block response)
    setCache(CACHE_KEY, fire).catch((error) => {
      console.error("Failed to cache fire data:", error);
      // Don't throw - caching failure shouldn't break the API
    });

    return NextResponse.json(fire);
  } catch (error) {
    console.error("Error fetching fire data:", error);
    
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
      { error: "Failed to fetch fire data" },
      { status: 500 }
    );
  }
}

