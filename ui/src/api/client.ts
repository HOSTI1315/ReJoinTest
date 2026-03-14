export interface AddAccountRequest {
  cookie: string;
  placeId: string;
  vipLink?: string;
}

export interface UpdateAccountRequest {
  cookie?: string;
  placeId: string;
  vipLink?: string;
}

export interface Account {
  id: number;
  name: string;
  displayName: string;
  Cookie: string;
  PlaceId: string;
  UniverseId?: number | null;
  PrivatSr?: string | null;
  enabled?: boolean;
  dead?: boolean;
}

export interface Settings {
  CHECK_INTERVAL: number;
  CUSTOM_TITLE: string;
  THEME: string;
  LANG: string;
  TRACK_INJECTOR?: boolean;
  INJECTOR_PATH?: string;
  REJOIN_DELAY?: number;
  SYNC_VOLT?: boolean;
  SYNC_SELIWARE?: boolean;
  SYNC_POTASSIUM?: boolean;
  SYNC_WAVE?: boolean;
  STREAMER_MODE?: boolean;
}

export type ScriptType = "autoexec" | "workspace";

export interface Script {
  id: string;
  name: string;
  content: string;
  path?: string;
  mtime?: number;
}

export interface SaveScriptPayload {
  name: string;
  content: string;
}

export interface InjectorStatus {
  tracking: boolean;
  running?: boolean;
  pid?: number | null;
}

export interface Status {
  running: boolean;
}

const API_BASE = "http://127.0.0.1:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export const api = {
  getAccounts(): Promise<Account[]> {
    return request<Account[]>("/accounts");
  },
  addAccount(data: AddAccountRequest): Promise<Account> {
    return request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  updateAccount(
    accountId: number,
    data: UpdateAccountRequest
  ): Promise<Account> {
    return request<Account>(`/accounts/${accountId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },
  toggleAccount(
    accountId: number,
    enabled: boolean
  ): Promise<Account> {
    return request<Account>(`/accounts/${accountId}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled })
    });
  },
  deleteAccount(accountId: number): Promise<{ detail: string }> {
    return request<{ detail: string }>(`/accounts/${accountId}`, {
      method: "DELETE"
    });
  },
  getSettings(): Promise<Settings> {
    return request<Settings>("/settings");
  },
  updateSettings(data: Settings): Promise<Settings> {
    return request<Settings>("/settings", {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },
  getStatus(): Promise<Status> {
    return request<Status>("/status");
  },
  startRejoin(): Promise<Status> {
    return request<Status>("/rejoin/start", { method: "POST" });
  },
  stopRejoin(): Promise<Status> {
    return request<Status>("/rejoin/stop", { method: "POST" });
  },
  getAccountProcesses(): Promise<Record<string, number | null>> {
    return request<Record<string, number | null>>("/accounts/processes");
  },
  getAccountStatus(): Promise<
    Record<string, { status: "in_game" | "not_in_game" | "restarting"; pid: number | null; processName: string | null }>
  > {
    return request("/accounts/status");
  },
  killAllRoblox(): Promise<{ killed: number }> {
    return request<{ killed: number }>("/roblox/kill-all", { method: "POST" });
  },
  getInjectorStatus(): Promise<InjectorStatus> {
    return request<InjectorStatus>("/injector/status");
  },
  getScripts(type: ScriptType): Promise<Script[]> {
    return request<Script[]>(`/scripts/${type}`);
  },
  getScript(type: ScriptType, id: string): Promise<Script> {
    return request<Script>(`/scripts/${type}/${id}`);
  },
  saveScript(
    type: ScriptType,
    payload: SaveScriptPayload
  ): Promise<Script> {
    return request<Script>(`/scripts/${type}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  syncScripts(type: ScriptType): Promise<Script[]> {
    return request<Script[]>(`/scripts/${type}/sync`, { method: "POST" });
  },
  deleteScript(type: ScriptType, id: string): Promise<{ detail: string }> {
    return request<{ detail: string }>(`/scripts/${type}/${id}`, {
      method: "DELETE"
    });
  }
};

