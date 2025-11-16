import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/types/settings";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (settingsError) {
      // If settings don't exist, create default settings
      if (settingsError.code === "PGRST116") {
        const defaultSettings: UserSettings = {
          preferred_datasets: {
            crime: true,
            service: true,
            fire: true,
          },
          preferred_time_window: 999999,
          map_style: "light",
        };

        const { data: newSettings, error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            ...defaultSettings,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating default settings:", insertError);
          return NextResponse.json(
            { error: "Failed to create settings" },
            { status: 500 }
          );
        }

        return NextResponse.json(newSettings);
      }

      console.error("Error fetching settings:", settingsError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Unexpected error in GET /api/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Validate structure
    const settings: UserSettings = {
      preferred_datasets: {
        crime: typeof body.preferred_datasets?.crime === "boolean" ? body.preferred_datasets.crime : true,
        service: typeof body.preferred_datasets?.service === "boolean" ? body.preferred_datasets.service : true,
        fire: typeof body.preferred_datasets?.fire === "boolean" ? body.preferred_datasets.fire : true,
      },
      preferred_time_window: typeof body.preferred_time_window === "number" ? body.preferred_time_window : 999999,
      map_style: body.map_style === "dark" || body.map_style === "light" ? body.map_style : "light",
      home_location: body.home_location && 
        typeof body.home_location.lat === "number" &&
        typeof body.home_location.lng === "number" &&
        typeof body.home_location.zoom === "number"
        ? body.home_location
        : undefined,
    };

    // Upsert settings
    const { data: updatedSettings, error: updateError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          preferred_datasets: settings.preferred_datasets,
          preferred_time_window: settings.preferred_time_window,
          map_style: settings.map_style,
          home_location: settings.home_location,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (updateError) {
      console.error("Error updating settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("Unexpected error in POST /api/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

