import React from "react";
import { api } from "../api/client";

const POLL_INTERVAL_MS = 8000;

export function useProcessPids(): Record<string, number | null> {
  const [pids, setPids] = React.useState<Record<string, number | null>>({});

  React.useEffect(() => {
    let cancelled = false;

    const poll = () => {
      api
        .getAccountProcesses()
        .then((data) => {
          if (!cancelled) setPids(data);
        })
        .catch(() => {
          if (!cancelled) setPids({});
        });
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return pids;
}
