import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://data.sfgov.org/resource/wg3w-h783.json?$limit=100",
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`Crime API error: ${res.statusText}`);
    }

    const data = await res.json();

    // normalize data - include all available fields for sidebar
    const crime = data
      .filter((item: any) => item?.latitude && item?.longitude)
      .map((item: any) => ({
        id: item.incident_id || Math.random().toString(),
        category: item.incident_category || "Unknown",
        description: item.incident_description || item.incident_subcategory || null,
        timestamp: item.incident_datetime || new Date().toISOString(),
        latitude: parseFloat(item.latitude) || 0,
        longitude: parseFloat(item.longitude) || 0,
        address: item.incident_address || item.address || null,
        policeDistrict: item.police_district || item.district || null,
        resolution: item.resolution || null,
        dayOfWeek: item.day_of_week || null,
      }));

    return NextResponse.json(crime);
  } catch (error) {
    console.error("Error fetching crime data:", error);
    return NextResponse.json(
      { error: "Failed to fetch crime data" },
      { status: 500 }
    );
  }
}
