import React from "react";
import { api, type Settings } from "../api/client";

interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  save: (next: Settings) => Promise<void>;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api
      .getSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Ошибка загрузки настроек");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = React.useCallback(async (next: Settings) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.updateSettings(next);
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения настроек");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value: SettingsContextValue = React.useMemo(
    () => ({ settings, loading, error, save }),
    [settings, loading, error, save]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsProvider");
  return ctx;
}
