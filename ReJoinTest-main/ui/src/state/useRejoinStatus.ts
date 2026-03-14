import React from "react";
import { api } from "../api/client";

interface UseRejoinStatusState {
  running: boolean;
  loading: boolean;
  error: string | null;
  toggle: () => void;
}

export function useRejoinStatus(): UseRejoinStatusState {
  const [running, setRunning] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .getStatus()
      .then((data) => {
        setRunning(data.running);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Ошибка получения статуса");
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const toggle = () => {
    setLoading(true);
    const action = running ? api.stopRejoin() : api.startRejoin();
    action
      .then((data) => {
        setRunning(data.running);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Ошибка управления ReJoin");
      })
      .finally(() => setLoading(false));
  };

  return { running, loading, error, toggle };
}

