"use client";

import { useEffect, useState } from "react";
import type { UserSettings } from "@/lib/types/settings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: UserSettings) => Promise<void>;
  initialSettings: UserSettings | null;
}

const TIME_OPTIONS = [
  { label: "Past Week", value: 7 * 24 },
  { label: "Past 30 Days", value: 30 * 24 },
  { label: "Past 6 Months", value: 180 * 24 },
  { label: "Past Year", value: 365 * 24 },
  { label: "All Time", value: 999999 },
];

export default function SettingsModal({ isOpen, onClose, onSave, initialSettings }: SettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>({
    preferred_datasets: {
      crime: true,
      service: true,
      fire: true,
    },
    preferred_time_window: 999999,
    map_style: "light",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave(settings);
      onClose();
    } catch (err) {
      setError("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 lg:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Preferred Datasets */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Data Layers
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preferred_datasets.crime}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferred_datasets: {
                        ...settings.preferred_datasets,
                        crime: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-red-500 rounded focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Crime Reports</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preferred_datasets.service}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferred_datasets: {
                        ...settings.preferred_datasets,
                        service: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">311 / Public Safety</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preferred_datasets.fire}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferred_datasets: {
                        ...settings.preferred_datasets,
                        fire: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-orange-500 rounded focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fire / Emergency</span>
              </label>
            </div>
          </div>

          {/* Time Window */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Default Time Range
            </h3>
            <div className="flex flex-wrap gap-3">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setSettings({
                      ...settings,
                      preferred_time_window: option.value,
                    })
                  }
                  className={`
                    px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                    ${settings.preferred_time_window === option.value
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105"}
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Map Style */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Map Theme
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    map_style: "light",
                  })
                }
                className={`
                  flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${settings.map_style === "light"
                    ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg shadow-gray-500/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}
                `}
              >
                Light
              </button>
              <button
                onClick={() =>
                  setSettings({
                    ...settings,
                    map_style: "dark",
                  })
                }
                className={`
                  flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                  ${settings.map_style === "dark"
                    ? "bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-lg shadow-gray-700/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}
                `}
              >
                Dark
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

