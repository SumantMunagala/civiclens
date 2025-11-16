export interface UserSettings {
  preferred_datasets: {
    crime: boolean;
    service: boolean;
    fire: boolean;
  };
  preferred_time_window: number;
  map_style: "light" | "dark";
  home_location?: {
    lat: number;
    lng: number;
    zoom: number;
  };
}

export interface UserProfile {
  id: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

