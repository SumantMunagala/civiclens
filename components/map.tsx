"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import SearchBar from "./SearchBar";
import SettingsModal from "./SettingsModal";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserSettings } from "@/lib/types/settings";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const TIME_OPTIONS = [
  { label: "Past Week", value: 7 * 24 }, // 7 days in hours
  { label: "Past 30 Days", value: 30 * 24 }, // 30 days in hours
  { label: "Past 6 Months", value: 180 * 24 }, // 180 days in hours
  { label: "Past Year", value: 365 * 24 }, // 365 days in hours
  { label: "All Time", value: 999999 },
];

export default function Map() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Crime, 311, and Fire are mutually exclusive (radio button behavior)
  const [activeDataType, setActiveDataType] = useState<"crime" | "311" | "fire" | null>("crime");
  const [timeFilter, setTimeFilter] = useState(999999); // Default to "All time"
  
  // Stats counts for each data type
  const [crimeCount, setCrimeCount] = useState(0);
  const [calls311Count, setCalls311Count] = useState(0);
  const [fireCount, setFireCount] = useState(0);
  
  // Sidebar state
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [incidentType, setIncidentType] = useState<"crime" | "311" | "fire" | null>(null);
  
  // Dark mode state
  const [isDark, setIsDark] = useState(false);
  
  // User and settings state
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [savedSettings, setSavedSettings] = useState<UserSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Logout handler
  const handleLogout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Logout button clicked");
    
    try {
      const supabase = createClient();
      console.log("Supabase client created");
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
      } else {
        console.log("Sign out successful");
      }
      
      // Clear any local state
      setSavedSettings(null);
      
      // Small delay to ensure signOut completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force a hard redirect to ensure session is cleared
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
      // Force redirect even on error
      window.location.href = "/login";
    }
  };
  
  // Search location handler
  const handleSearchLocation = (lng: number, lat: number, placeName: string) => {
    if (!map.current) return;
    
    map.current.flyTo({
      center: [lng, lat],
      zoom: 14,
      speed: 1.2,
      curve: 1.42,
      easing: (t: number) => t * (2 - t), // ease-out
    });

    // Optional: Add a temporary marker at the searched location
    const isDarkMode = document.documentElement.classList.contains("dark");
    const searchMarker = new mapboxgl.Marker({
      color: "#3b82f6",
      scale: 1.2,
    })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25, closeOnClick: false })
          .setHTML(`
            <div class="p-3 ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} rounded-lg">
              <h3 class="font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} text-sm">${placeName}</h3>
            </div>
          `)
      )
      .addTo(map.current);

    // Remove the search marker after 5 seconds
    setTimeout(() => {
      searchMarker.remove();
    }, 5000);
  };
  
  // Derived states for easier use
  const showCrime = activeDataType === "crime";
  const show311 = activeDataType === "311";
  const showFire = activeDataType === "fire";

  const markers = useRef<mapboxgl.Marker[]>([]);
  const incidentDataRef = useRef<Record<string, any>>({}); // Store full incident data by marker ID

  // Detect dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      const isCurrentlyDark = document.documentElement.classList.contains("dark");
      setIsDark(isCurrentlyDark);
    };

    // Initial check
    checkDarkMode();

    // Watch for DOM changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also listen for theme change events
    const handleThemeChange = () => {
      checkDarkMode();
    };
    window.addEventListener("themechange", handleThemeChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("themechange", handleThemeChange);
    };
  }, []);

  // Load user settings on mount
  useEffect(() => {
    if (userLoading || !user) {
      setSettingsLoaded(false);
      return;
    }

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const settings = await res.json();
          setSavedSettings(settings);
          
          // Apply settings
          if (settings.preferred_datasets) {
            // Set initial active data type based on preferences
            if (settings.preferred_datasets.crime) {
              setActiveDataType("crime");
            } else if (settings.preferred_datasets.service) {
              setActiveDataType("311");
            } else if (settings.preferred_datasets.fire) {
              setActiveDataType("fire");
            }
          }
          
          if (settings.preferred_time_window) {
            setTimeFilter(settings.preferred_time_window);
          }
          
          if (settings.map_style === "dark" && !document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
          } else if (settings.map_style === "light" && document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
            setIsDark(false);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setSettingsLoaded(true);
      }
    }

    loadSettings();
  }, [user, userLoading]);

  useEffect(() => {
    if (map.current) return;

    const initialStyle = document.documentElement.classList.contains("dark")
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: initialStyle,
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    map.current.on("load", () => {
      console.log("Map loaded, loading markers...");
      loadMarkers();
    });
  }, []);

  // Update map style when dark mode changes
  useEffect(() => {
    if (!map.current) return;

    const newStyle = isDark
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11";

    map.current.setStyle(newStyle);
    map.current.once("style.load", () => {
      // Reload markers after style change
      loadMarkers();
    });
  }, [isDark]);

  useEffect(() => {
    if (!map.current) return;
    // Wait a bit to ensure map is fully loaded
    const timer = setTimeout(() => {
      if (map.current && map.current.isStyleLoaded()) {
        console.log("Filters changed, reloading markers...");
        loadMarkers();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeDataType, timeFilter]);

  // Fetch and calculate counts for all data types
  useEffect(() => {
    async function fetchCounts() {
      const now = Date.now();
      const cutoff = timeFilter === 999999 ? 0 : now - timeFilter * 3600 * 1000;

      // Fetch crime count
      try {
        const crimeRes = await fetch("/api/crime");
        if (crimeRes.ok) {
          const crimeData = await crimeRes.json();
          if (!crimeData.error) {
            const count = crimeData.filter((i: any) => {
              if (!i.longitude || !i.latitude) return false;
              const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
              return timeFilter === 999999 || (time && time >= cutoff);
            }).length;
            setCrimeCount(count);
          }
        }
      } catch (error) {
        console.error("Error fetching crime count:", error);
      }

      // Fetch 311 count
      try {
        const calls311Res = await fetch("/api/311");
        if (calls311Res.ok) {
          const calls311Data = await calls311Res.json();
          if (!calls311Data.error) {
            const count = calls311Data.filter((i: any) => {
              if (!i.longitude || !i.latitude) return false;
              const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
              return timeFilter === 999999 || (time && time >= cutoff);
            }).length;
            setCalls311Count(count);
          }
        }
      } catch (error) {
        console.error("Error fetching 311 count:", error);
      }

      // Fetch fire count
      try {
        const fireRes = await fetch("/api/fire");
        if (fireRes.ok) {
          const fireData = await fireRes.json();
          if (!fireData.error) {
            const count = fireData.filter((i: any) => {
              if (!i.longitude || !i.latitude) return false;
              const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
              return timeFilter === 999999 || (time && time >= cutoff);
            }).length;
            setFireCount(count);
          }
        }
      } catch (error) {
        console.error("Error fetching fire count:", error);
      }
    }

    fetchCounts();
  }, [timeFilter]);

  // Load markers
  async function loadMarkers() {
    if (!map.current) return;

    // Remove existing markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    incidentDataRef.current = {};

    const now = Date.now();
    const cutoff = timeFilter === 999999 ? 0 : now - timeFilter * 3600 * 1000;

    function addMarker(
      lng: number, 
      lat: number, 
      color: string, 
      popupHtml: string, 
      incidentData: any,
      type: "crime" | "311" | "fire"
    ) {
      // Validate coordinates
      if (!lng || !lat || isNaN(lng) || isNaN(lat) || lng === 0 || lat === 0) {
        return;
      }

      const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      // Store incident data with marker
      const markerId = `${type}-${incidentData.id || Math.random()}`;
      incidentDataRef.current[markerId] = { ...incidentData, type };

      // Add click handler to open sidebar
      marker.getElement().addEventListener('click', () => {
        setSelectedIncident(incidentData);
        setIncidentType(type);
        // Zoom to marker location
        if (map.current) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: Math.max(map.current.getZoom(), 15),
            duration: 1000
          });
        }
      });

      markers.current.push(marker);
    }

    try {
      // Crime
      if (showCrime) {
        try {
          const res = await fetch("/api/crime");
          if (!res.ok) {
            console.error("Crime API error:", res.statusText);
            return;
          }
          const data = await res.json();
          
          if (data.error) {
            console.error("Crime API returned error:", data.error);
            return;
          }

          let crimeCount = 0;
          data.forEach((i: any) => {
            if (!i.longitude || !i.latitude) return;
            
            const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
            if (timeFilter === 999999 || (time && time >= cutoff)) {
              const isDarkMode = document.documentElement.classList.contains("dark");
              addMarker(
                i.longitude,
                i.latitude,
                "red",
                `
                <div class="p-3 min-w-[200px] ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} rounded-lg">
                  <h3 class="font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-1">Crime Incident</h3>
                  <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}"><strong>Type:</strong> ${i.category || "Unknown"}</p>
                  <p class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
                </div>`,
                i,
                "crime"
              );
              crimeCount++;
            }
          });
          console.log(`Added ${crimeCount} crime markers`);
        } catch (error) {
          console.error("Error loading crime data:", error);
        }
      }

      // 311 / Fire / Public Safety
      if (show311) {
        try {
          const res = await fetch("/api/311");
          if (!res.ok) {
            console.error("311 API error:", res.statusText);
            return;
          }
          const data = await res.json();
          
          if (data.error) {
            console.error("311 API returned error:", data.error);
            return;
          }

          let callsCount = 0;
          data.forEach((i: any) => {
            if (!i.longitude || !i.latitude) return;
            
            const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
            if (timeFilter === 999999 || (time && time >= cutoff)) {
              const isDarkMode = document.documentElement.classList.contains("dark");
              addMarker(
                i.longitude,
                i.latitude,
                "blue",
                `
                <div class="p-3 min-w-[200px] ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} rounded-lg">
                  <h3 class="font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-1">311 / Public Safety</h3>
                  <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}"><strong>Incident:</strong> ${i.category || "Unknown"}</p>
                  <p class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
                </div>`,
                i,
                "311"
              );
              callsCount++;
            }
          });
          console.log(`Added ${callsCount} 311 markers`);
        } catch (error) {
          console.error("Error loading 311 data:", error);
        }
      }

      // Fire / Emergency
      if (showFire) {
        try {
          const res = await fetch("/api/fire");
          if (!res.ok) {
            console.error("Fire API error:", res.statusText);
            return;
          }
          const data = await res.json();
          
          if (data.error) {
            console.error("Fire API returned error:", data.error);
            return;
          }

          let fireCount = 0;
          data.forEach((i: any) => {
            if (!i.longitude || !i.latitude) return;
            
            const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
            if (timeFilter === 999999 || (time && time >= cutoff)) {
              const isDarkMode = document.documentElement.classList.contains("dark");
              addMarker(
                i.longitude,
                i.latitude,
                "#f97316", // orange-500
                `
                <div class="p-3 min-w-[200px] ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'} rounded-lg">
                  <h3 class="font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-1">Fire / Emergency</h3>
                  <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}"><strong>Situation:</strong> ${i.category || i.primarySituation || "Unknown"}</p>
                  ${i.address ? `<p class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1">${i.address}</p>` : ''}
                  <p class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
                </div>`,
                i,
                "fire"
              );
              fireCount++;
            }
          });
          console.log(`Added ${fireCount} fire markers`);
        } catch (error) {
          console.error("Error loading fire data:", error);
        }
      }
    } catch (error) {
      console.error("Error in loadMarkers:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6 lg:p-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 lg:p-8 transition-colors duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                CivicLens Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm lg:text-base transition-colors duration-200">
                Real-time public safety & city activity monitoring
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* User Actions */}
              {user ? (
                <>
                  <button
                    onClick={() => setSettingsModalOpen(true)}
                    className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
                    aria-label="User Settings"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleLogout}
                    type="button"
                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 text-sm font-medium cursor-pointer z-10 relative"
                    aria-label="Logout"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <a
                  href="/login"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 text-sm font-semibold shadow-lg shadow-blue-500/30"
                >
                  Sign In
                </a>
              )}
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Live indicator */}
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800 w-fit transition-colors duration-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700 dark:text-green-400 transition-colors duration-200">Live Data</span>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 lg:p-8 transition-colors duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            
            {/* Data Type Filters */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 transition-colors duration-200">
                Data Layers
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveDataType("crime")}
                  className={`
                    group relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${activeDataType === "crime"
                      ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30 scale-105"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeDataType === "crime" ? 'bg-white' : 'bg-red-500'}`}></span>
                    Crime
                  </span>
                </button>

                <button
                  onClick={() => setActiveDataType("311")}
                  className={`
                    group relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${activeDataType === "311"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeDataType === "311" ? 'bg-white' : 'bg-blue-500'}`}></span>
                    311 / Public Safety
                  </span>
                </button>

                <button
                  onClick={() => setActiveDataType("fire")}
                  className={`
                    group relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${activeDataType === "fire"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30 scale-105"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeDataType === "fire" ? 'bg-white' : 'bg-orange-500'}`}></span>
                    Fire / Emergency
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 transition-colors duration-200">Crime Reports</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">{crimeCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">
                  {TIME_OPTIONS.find(o => o.value === timeFilter)?.label || "All Time"}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg transition-colors duration-200">
                <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 transition-colors duration-200">311 Calls</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">{calls311Count.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">
                  {TIME_OPTIONS.find(o => o.value === timeFilter)?.label || "All Time"}
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors duration-200">
                <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 transition-colors duration-200">Fire / Emergency</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">{fireCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">
                  {TIME_OPTIONS.find(o => o.value === timeFilter)?.label || "All Time"}
                </p>
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg transition-colors duration-200">
                <svg className="w-6 h-6 text-orange-500 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Filter Buttons */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 lg:p-8 transition-colors duration-200">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 transition-colors duration-200">
            Time Range
          </h2>
          <div className="flex flex-wrap gap-3">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeFilter(option.value)}
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                  ${timeFilter === option.value
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Container with Sidebar */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 dark:border-gray-700/50 transition-colors duration-200">
          <div
            ref={mapContainer}
            className={`w-full h-[600px] lg:h-[700px] transition-all duration-300 ${
              selectedIncident ? "lg:mr-[400px]" : ""
            }`}
          />
          
          {/* Map overlay gradient for depth */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/5 to-transparent"></div>

          {/* Floating Search Bar Overlay */}
          <div className="absolute top-4 left-4 right-4 lg:left-6 lg:right-auto lg:w-96 z-10">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-1">
              <SearchBar onLocationSelect={handleSearchLocation} />
            </div>
          </div>

          {/* Backdrop overlay for mobile */}
          {selectedIncident && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => {
                setSelectedIncident(null);
                setIncidentType(null);
              }}
            />
          )}

          {/* Sidebar */}
          <div
            className={`
              fixed lg:absolute top-0 right-0 h-full lg:h-auto lg:max-h-[700px]
              w-full lg:w-[400px] 
              bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg
              shadow-2xl border-l border-gray-200 dark:border-gray-700
              transform transition-all duration-300 ease-in-out z-50
              overflow-y-auto
              ${selectedIncident ? "translate-x-0" : "translate-x-full lg:translate-x-full"}
            `}
          >
            {selectedIncident && (
              <div className="p-6">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-200">
                    {incidentType === "crime" && "Crime Incident"}
                    {incidentType === "311" && "311 Service Request"}
                    {incidentType === "fire" && "Fire / Emergency Incident"}
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedIncident(null);
                      setIncidentType(null);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Crime Incident Details */}
                {incidentType === "crime" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-100 dark:border-red-800/50 transition-colors duration-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase transition-colors duration-200">Crime Report</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 transition-colors duration-200">
                        {selectedIncident.category || "Unknown Category"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Incident ID</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">{selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Date & Time</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">
                          {selectedIncident.timestamp 
                            ? new Date(selectedIncident.timestamp).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "N/A"}
                        </p>
                        {selectedIncident.dayOfWeek && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">{selectedIncident.dayOfWeek}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Category</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.category || "Unknown"}</p>
                      </div>

                      {selectedIncident.description && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Description</label>
                          <p className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">{selectedIncident.description}</p>
                        </div>
                      )}

                      {selectedIncident.address && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Address</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.address}</p>
                        </div>
                      )}

                      {selectedIncident.policeDistrict && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Police District</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.policeDistrict}</p>
                        </div>
                      )}

                      {selectedIncident.resolution && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Resolution</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.resolution}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Coordinates</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">
                          {selectedIncident.latitude?.toFixed(6)}, {selectedIncident.longitude?.toFixed(6)}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (map.current && selectedIncident.latitude && selectedIncident.longitude) {
                            map.current.flyTo({
                              center: [selectedIncident.longitude, selectedIncident.latitude],
                              zoom: 16,
                              duration: 1000
                            });
                          }
                        }}
                        className="w-full mt-4 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Zoom to Location
                      </button>
                    </div>
                  </div>
                )}

                {/* 311 Service Request Details */}
                {incidentType === "311" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-100 dark:border-blue-800/50 transition-colors duration-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase transition-colors duration-200">311 Service Request</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 transition-colors duration-200">
                        {selectedIncident.category || "Unknown Request"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Request ID</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">{selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Request Type</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.category || "Unknown"}</p>
                      </div>

                      {selectedIncident.description && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Description</label>
                          <p className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">{selectedIncident.description}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Requested Date & Time</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">
                          {selectedIncident.timestamp 
                            ? new Date(selectedIncident.timestamp).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "N/A"}
                        </p>
                      </div>

                      {selectedIncident.address && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Address</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.address}</p>
                        </div>
                      )}

                      {selectedIncident.neighborhood && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Neighborhood</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.neighborhood}</p>
                        </div>
                      )}

                      {selectedIncident.status && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Status</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.status}</p>
                        </div>
                      )}

                      {selectedIncident.agency && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Agency</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.agency}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Coordinates</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">
                          {selectedIncident.latitude?.toFixed(6)}, {selectedIncident.longitude?.toFixed(6)}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (map.current && selectedIncident.latitude && selectedIncident.longitude) {
                            map.current.flyTo({
                              center: [selectedIncident.longitude, selectedIncident.latitude],
                              zoom: 16,
                              duration: 1000
                            });
                          }
                        }}
                        className="w-full mt-4 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Zoom to Location
                      </button>
                    </div>
                  </div>
                )}

                {/* Fire / Emergency Incident Details */}
                {incidentType === "fire" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-xl border border-orange-100 dark:border-orange-800/50 transition-colors duration-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-orange-700 dark:text-orange-400 uppercase transition-colors duration-200">Fire / Emergency</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 transition-colors duration-200">
                        {selectedIncident.category || selectedIncident.primarySituation || "Emergency Response"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Incident Number</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">{selectedIncident.incidentNumber || selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Date & Time</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">
                          {selectedIncident.alarmTime 
                            ? new Date(selectedIncident.alarmTime).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : selectedIncident.timestamp 
                            ? new Date(selectedIncident.timestamp).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : "N/A"}
                        </p>
                        {selectedIncident.arrivalTime && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">
                            Arrived: {new Date(selectedIncident.arrivalTime).toLocaleString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Primary Situation</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.category || selectedIncident.primarySituation || "Unknown"}</p>
                      </div>

                      {selectedIncident.description && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Description</label>
                          <p className="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-200">{selectedIncident.description}</p>
                        </div>
                      )}

                      {selectedIncident.address && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Address</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.address}</p>
                        </div>
                      )}

                      {selectedIncident.neighborhood && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Neighborhood</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.neighborhood}</p>
                        </div>
                      )}

                      {selectedIncident.battalion && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Battalion</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.battalion}</p>
                        </div>
                      )}

                      {selectedIncident.stationArea && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Station Area</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">{selectedIncident.stationArea}</p>
                        </div>
                      )}

                      {selectedIncident.closeTime && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Close Time</label>
                          <p className="text-sm text-gray-900 dark:text-gray-100 transition-colors duration-200">
                            {new Date(selectedIncident.closeTime).toLocaleString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">Coordinates</label>
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-mono transition-colors duration-200">
                          {selectedIncident.latitude?.toFixed(6)}, {selectedIncident.longitude?.toFixed(6)}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (map.current && selectedIncident.latitude && selectedIncident.longitude) {
                            map.current.flyTo({
                              center: [selectedIncident.longitude, selectedIncident.latitude],
                              zoom: 16,
                              duration: 1000
                            });
                          }
                        }}
                        className="w-full mt-4 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Zoom to Location
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 p-6 transition-colors duration-200">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 transition-colors duration-200">
            Map Legend
          </h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors duration-200">Crime Incidents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors duration-200">311 Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors duration-200">Fire / Emergency</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSave={async (settings: UserSettings) => {
          const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
          });
          if (!res.ok) {
            throw new Error("Failed to save settings");
          }
          const updatedSettings = await res.json();
          setSavedSettings(updatedSettings);
          
          // Apply map style immediately
          if (settings.map_style === "dark" && !document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
          } else if (settings.map_style === "light" && document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
            setIsDark(false);
          }
        }}
        initialSettings={savedSettings}
      />
    </div>
  );
}