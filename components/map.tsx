"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

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

  // Crime and 311 are mutually exclusive (radio button behavior)
  const [activeDataType, setActiveDataType] = useState<"crime" | "311" | null>("crime");
  const [showTransit, setShowTransit] = useState(true);
  const [timeFilter, setTimeFilter] = useState(999999); // Default to "All time"
  
  // Stats counts for each data type
  const [crimeCount, setCrimeCount] = useState(0);
  const [calls311Count, setCalls311Count] = useState(0);
  const [transitCount, setTransitCount] = useState(0);
  
  // Sidebar state
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [incidentType, setIncidentType] = useState<"crime" | "311" | "transit" | null>(null);
  
  // Derived states for easier use
  const showCrime = activeDataType === "crime";
  const show311 = activeDataType === "311";

  const markers = useRef<mapboxgl.Marker[]>([]);
  const incidentDataRef = useRef<Record<string, any>>({}); // Store full incident data by marker ID

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-122.4194, 37.7749],
      zoom: 12,
    });

    map.current.on("load", () => {
      console.log("Map loaded, loading markers...");
      loadMarkers();
    });
  }, []);

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
  }, [activeDataType, showTransit, timeFilter]);

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

      // Fetch transit count
      try {
        const transitRes = await fetch("/api/transit");
        if (transitRes.ok) {
          const transitData = await transitRes.json();
          if (!transitData.error) {
            const count = transitData.filter((i: any) => {
              if (!i.longitude || !i.latitude) return false;
              const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
              return timeFilter === 999999 || (time && time >= cutoff);
            }).length;
            setTransitCount(count);
          }
        }
      } catch (error) {
        console.error("Error fetching transit count:", error);
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
      type: "crime" | "311" | "transit"
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
              addMarker(
                i.longitude,
                i.latitude,
                "red",
                `
                <div class="p-3 min-w-[200px]">
                  <h3 class="font-bold text-gray-900 mb-1">Crime Incident</h3>
                  <p class="text-sm text-gray-700"><strong>Type:</strong> ${i.category || "Unknown"}</p>
                  <p class="text-xs text-gray-600 mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
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
              addMarker(
                i.longitude,
                i.latitude,
                "blue",
                `
                <div class="p-3 min-w-[200px]">
                  <h3 class="font-bold text-gray-900 mb-1">311 / Public Safety</h3>
                  <p class="text-sm text-gray-700"><strong>Incident:</strong> ${i.category || "Unknown"}</p>
                  <p class="text-xs text-gray-600 mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
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

      // Transit
      if (showTransit) {
        try {
          const res = await fetch("/api/transit");
          if (!res.ok) {
            console.error("Transit API error:", res.statusText);
            return;
          }
          const data = await res.json();
          
          if (data.error) {
            console.error("Transit API returned error:", data.error);
            return;
          }

          let transitCount = 0;
          data.forEach((i: any) => {
            if (!i.longitude || !i.latitude) return;
            
            const time = i.timestamp ? new Date(i.timestamp).getTime() : null;
            if (timeFilter === 999999 || (time && time >= cutoff)) {
              addMarker(
                i.longitude,
                i.latitude,
                "green",
                `
                <div class="p-3 min-w-[200px]">
                  <h3 class="font-bold text-gray-900 mb-1">Transit Vehicle</h3>
                  <p class="text-sm text-gray-700"><strong>Route:</strong> ${i.route || "Unknown"}</p>
                  <p class="text-xs text-gray-600 mt-1">${i.timestamp ? new Date(i.timestamp).toLocaleString() : "N/A"}</p>
                </div>`,
                i,
                "transit"
              );
              transitCount++;
            }
          });
          console.log(`Added ${transitCount} transit markers`);
        } catch (error) {
          console.error("Error loading transit data:", error);
        }
      }
    } catch (error) {
      console.error("Error in loadMarkers:", error);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                CivicLens Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-sm lg:text-base">
                Real-time public safety & city activity monitoring
              </p>
            </div>
            
            {/* Live indicator */}
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-200 w-fit">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">Live Data</span>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            
            {/* Data Type Filters */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Data Layers
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveDataType("crime")}
                  className={`
                    group relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${activeDataType === "crime"
                      ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30 scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"}
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
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${activeDataType === "311" ? 'bg-white' : 'bg-blue-500'}`}></span>
                    311 / Public Safety
                  </span>
                </button>

                <button
                  onClick={() => setShowTransit(!showTransit)}
                  className={`
                    group relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${showTransit
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30 scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"}
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${showTransit ? 'bg-white' : 'bg-green-500'}`}></span>
                    Transit
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Crime Reports</p>
                <p className="text-3xl font-bold text-gray-900">{crimeCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {TIME_OPTIONS.find(o => o.value === timeFilter)?.label || "All Time"}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">311 Calls</p>
                <p className="text-3xl font-bold text-gray-900">{calls311Count.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {TIME_OPTIONS.find(o => o.value === timeFilter)?.label || "All Time"}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Transit Vehicles</p>
                <p className="text-3xl font-bold text-gray-900">{transitCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Real-time</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Filter Buttons */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 lg:p-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
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
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105"}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Map Container with Sidebar */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50">
          <div
            ref={mapContainer}
            className={`w-full h-[600px] lg:h-[700px] transition-all duration-300 ${
              selectedIncident ? "lg:mr-[400px]" : ""
            }`}
          />
          
          {/* Map overlay gradient for depth */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/5 to-transparent"></div>

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
              bg-white/95 backdrop-blur-lg
              shadow-2xl border-l border-gray-200
              transform transition-transform duration-300 ease-in-out z-50
              overflow-y-auto
              ${selectedIncident ? "translate-x-0" : "translate-x-full lg:translate-x-full"}
            `}
          >
            {selectedIncident && (
              <div className="p-6">
                {/* Sidebar Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {incidentType === "crime" && "Crime Incident"}
                    {incidentType === "311" && "311 Service Request"}
                    {incidentType === "transit" && "Transit Vehicle"}
                  </h2>
                  <button
                    onClick={() => {
                      setSelectedIncident(null);
                      setIncidentType(null);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Crime Incident Details */}
                {incidentType === "crime" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-red-700 uppercase">Crime Report</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {selectedIncident.category || "Unknown Category"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Incident ID</label>
                        <p className="text-sm text-gray-900 font-mono">{selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</label>
                        <p className="text-sm text-gray-900">
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
                          <p className="text-xs text-gray-500 mt-1">{selectedIncident.dayOfWeek}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</label>
                        <p className="text-sm text-gray-900">{selectedIncident.category || "Unknown"}</p>
                      </div>

                      {selectedIncident.description && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                          <p className="text-sm text-gray-700">{selectedIncident.description}</p>
                        </div>
                      )}

                      {selectedIncident.address && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
                          <p className="text-sm text-gray-900">{selectedIncident.address}</p>
                        </div>
                      )}

                      {selectedIncident.policeDistrict && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Police District</label>
                          <p className="text-sm text-gray-900">{selectedIncident.policeDistrict}</p>
                        </div>
                      )}

                      {selectedIncident.resolution && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolution</label>
                          <p className="text-sm text-gray-900">{selectedIncident.resolution}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordinates</label>
                        <p className="text-sm text-gray-900 font-mono">
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
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-semibold text-blue-700 uppercase">311 Service Request</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {selectedIncident.category || "Unknown Request"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Request ID</label>
                        <p className="text-sm text-gray-900 font-mono">{selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Type</label>
                        <p className="text-sm text-gray-900">{selectedIncident.category || "Unknown"}</p>
                      </div>

                      {selectedIncident.description && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                          <p className="text-sm text-gray-700">{selectedIncident.description}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested Date & Time</label>
                        <p className="text-sm text-gray-900">
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
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</label>
                          <p className="text-sm text-gray-900">{selectedIncident.address}</p>
                        </div>
                      )}

                      {selectedIncident.neighborhood && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Neighborhood</label>
                          <p className="text-sm text-gray-900">{selectedIncident.neighborhood}</p>
                        </div>
                      )}

                      {selectedIncident.status && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                          <p className="text-sm text-gray-900">{selectedIncident.status}</p>
                        </div>
                      )}

                      {selectedIncident.agency && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agency</label>
                          <p className="text-sm text-gray-900">{selectedIncident.agency}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordinates</label>
                        <p className="text-sm text-gray-900 font-mono">
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

                {/* Transit Vehicle Details */}
                {incidentType === "transit" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-green-700 uppercase">Live Transit</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        Route {selectedIncident.route || "Unknown"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vehicle ID</label>
                        <p className="text-sm text-gray-900 font-mono">{selectedIncident.id || "N/A"}</p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Route</label>
                        <p className="text-2xl font-bold text-gray-900">{selectedIncident.route || "Unknown"}</p>
                      </div>

                      {selectedIncident.direction && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direction</label>
                          <p className="text-sm text-gray-900">{selectedIncident.direction}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Updated</label>
                        <p className="text-sm text-gray-900">
                          {selectedIncident.timestamp 
                            ? new Date(selectedIncident.timestamp).toLocaleString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : "N/A"}
                        </p>
                      </div>

                      {selectedIncident.heading !== null && selectedIncident.heading !== undefined && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Heading</label>
                          <p className="text-sm text-gray-900">{selectedIncident.heading}°</p>
                        </div>
                      )}

                      {selectedIncident.speed !== null && selectedIncident.speed !== undefined && (
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Speed</label>
                          <p className="text-sm text-gray-900">{selectedIncident.speed} km/h</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Location</label>
                        <p className="text-sm text-gray-900 font-mono">
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
                        className="w-full mt-4 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Track Vehicle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Map Legend
          </h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 font-medium">Crime Incidents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 font-medium">311 Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded-full shadow-md"></div>
              <span className="text-sm text-gray-700 font-medium">Transit Vehicles</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}