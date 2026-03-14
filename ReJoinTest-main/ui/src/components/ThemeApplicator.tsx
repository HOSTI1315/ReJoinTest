import React from "react";
import { useSettingsContext } from "../context/SettingsContext";

/**
 * Applies theme from settings to document.
 * Syncs with external system (DOM) — correct use of useEffect per react-useeffect.
 */
export function ThemeApplicator() {
  const { settings } = useSettingsContext();

  React.useEffect(() => {
    const theme = settings?.THEME ?? "dark";
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        theme === "light" ? "#f4f4f5" : "#0c0c0f"
      );
    }
  }, [settings?.THEME]);

  return null;
}
