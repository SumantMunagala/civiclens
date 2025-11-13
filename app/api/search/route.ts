import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      console.error("Mapbox access token not configured");
      return NextResponse.json(
        { error: "Search service not configured" },
        { status: 500 }
      );
    }

    // Focus search on San Francisco area for better results
    const proximity = "-122.4194,37.7749"; // San Francisco center
    const bbox = "-122.6,37.7,-122.3,37.8"; // San Francisco bounding box

    const url = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/" + encodeURIComponent(query) + ".json");
    url.searchParams.set("access_token", mapboxToken);
    url.searchParams.set("proximity", proximity);
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("limit", "8");
    url.searchParams.set("types", "address,poi,neighborhood,locality,place");
    url.searchParams.set("country", "us");

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mapbox API error:", response.status, errorText);
      return NextResponse.json(
        { error: "Search service unavailable" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform Mapbox response to our format
    const features = (data.features || []).map((feature: any, index: number) => ({
      id: feature.id || `search-result-${index}`,
      place_name: feature.place_name || "",
      center: feature.center || [0, 0],
      text: feature.text || "",
      context: feature.context || [],
    }));

    return NextResponse.json({
      features,
      query: data.query || [],
    });
  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

