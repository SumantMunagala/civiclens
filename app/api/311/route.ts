import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "https://data.sfgov.org/resource/vw6y-z8j6.json?$limit=200",
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      throw new Error(`311 API error: ${res.statusText}`);
    }

    const data = await res.json();

    const formatted = data
      .filter((item: any) => (item?.lat || item?.latitude) && (item?.long || item?.longitude))
      .map((item: any) => ({
        id: item.service_request_id || Math.random().toString(),
        category: item.request_type || item.service_name || "Unknown",
        description: item.service_details || item.description || null,
        timestamp: item.requested_datetime || item.opened || new Date().toISOString(),
        latitude: parseFloat(item.lat || item.latitude) || 0,
        longitude: parseFloat(item.long || item.longitude) || 0,
        address: item.address || item.incident_address || null,
        status: item.status || item.status_notes || null,
        neighborhood: item.neighborhood || item.supervisor_district || null,
        agency: item.agency_responsible || null,
      }))
      .filter((item: any) => item.latitude !== 0 && item.longitude !== 0);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching 311 data:", error);
    return NextResponse.json(
      { error: "Failed to fetch 311 data" },
      { status: 500 }
    );
  }
}
