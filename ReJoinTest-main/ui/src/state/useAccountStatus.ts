import React from "react";
import { api } from "../api/client";

export type AccountStatus = "in_game" | "not_in_game" | "restarting";

export interface AccountStatusInfo {
  status: AccountStatus;
  pid: number | null;
  processName: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useAccountStatus(): Record<string, AccountStatusInfo> {
  const [data, setData] = React.useState<Record<string, AccountStatusInfo>>({});

  React.useEffect(() => {
    let cancelled = false;

    const poll = () => {
      api
        .getAccountStatus()
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch(() => {
          if (!cancelled) setData({});
        });
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return data;
}
