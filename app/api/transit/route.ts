import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Using NextBus API for San Francisco Muni
    // This returns vehicle locations for SF Muni
    const res = await fetch(
      "https://retro.umoiq.com/service/publicJSONFeed?command=vehicleLocations&a=sf-muni&t=0",
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error(`Transit API error: ${res.statusText}`);
      // Return empty array instead of error to prevent app crash
      return NextResponse.json([]);
    }

    const data = await res.json();

    // NextBus API structure: { vehicle: [...] }
    const vehicles = Array.isArray(data.vehicle) ? data.vehicle : data?.vehicle || [];

    const formatted = vehicles
      .filter((item: any) => item?.lat && item?.lon)
      .map((item: any) => ({
        id: item.id || item.vehicleId || Math.random().toString(),
        route: item.routeTag || item.route || "Unknown",
        direction: item.dirTag || item.direction || null,
        heading: item.heading || null,
        speed: item.speedKmHr || null,
        timestamp: new Date().toISOString(), // NextBus doesn't provide timestamp
        latitude: parseFloat(item.lat) || 0,
        longitude: parseFloat(item.lon) || 0,
      }))
      .filter((item: any) => item.latitude !== 0 && item.longitude !== 0 && 
                             item.latitude >= 37.7 && item.latitude <= 37.8 && // San Francisco bounds
                             item.longitude >= -122.6 && item.longitude <= -122.3);

    console.log(`Transit API: Found ${formatted.length} vehicles`);
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching transit data:", error);
    // Return empty array instead of error to prevent app crash
    return NextResponse.json([]);
  }
}
