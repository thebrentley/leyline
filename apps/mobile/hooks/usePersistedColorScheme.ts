import { useEffect } from "react";
import { colorScheme, useColorScheme } from "nativewind";
import { secureStorage } from "~/lib/storage";

const THEME_KEY = "theme_preference";

/**
 * Custom hook that wraps NativeWind's useColorScheme with persistent storage
 * Saves theme preference to storage and loads it on app start
 */
export function usePersistedColorScheme() {
  const { colorScheme: currentScheme } = useColorScheme();

  // Load saved theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await secureStorage.getItem(THEME_KEY);
        if (savedTheme === "dark" || savedTheme === "light") {
          colorScheme.set(savedTheme);
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      }
    };

    loadTheme();
  }, []);

  const toggleColorScheme = async () => {
    const isDark = currentScheme === "dark";
    const newScheme = isDark ? "light" : "dark";

    // Update NativeWind's in-memory state
    colorScheme.set(newScheme);

    // Persist to storage
    try {
      await secureStorage.setItem(THEME_KEY, newScheme);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  return {
    colorScheme: currentScheme,
    isDark: currentScheme === "dark",
    toggleColorScheme,
  };
}
