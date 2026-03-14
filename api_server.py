import logging
import multiprocessing
import sys
from threading import Event, Thread
from typing import Any, Dict, List, Optional

import requests
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import load_config, save_config
from scripts_sync import (
    delete_script as scripts_delete,
    get_script_by_id,
    list_workspace_from_ours,
    merge_scripts,
    save_script as scripts_save,
)
from account_status import get_status as account_status_get
from rejoin_worker import start_workers_for_accounts
from roblox_api import (
    convert_share_link_to_legacy,
    get_account_process_map,
    get_csrf_token,
    get_presence,
    get_universe_id_from_place,
    get_user,
    is_cookie_valid,
    is_injector_running,
    kill_all_roblox,
)

log = logging.getLogger("api_server")


# ── Pydantic models ────────────────────────────────────────────────

class Account(BaseModel):
    id: int
    name: str
    displayName: str
    Cookie: str
    PlaceId: str
    UniverseId: Optional[int] = None
    PrivatSr: Optional[str] = None
    enabled: Optional[bool] = True
    dead: Optional[bool] = False


class ToggleAccountRequest(BaseModel):
    enabled: bool


class AddAccountRequest(BaseModel):
    cookie: str
    placeId: str
    vipLink: Optional[str] = None


class UpdateAccountRequest(BaseModel):
    cookie: Optional[str] = None
    placeId: str
    vipLink: Optional[str] = None


class Settings(BaseModel):
    CHECK_INTERVAL: int
    CUSTOM_TITLE: str
    THEME: str
    LANG: str
    TRACK_INJECTOR: bool = False
    INJECTOR_PATH: str = ""
    REJOIN_DELAY: int = 3
    SYNC_VOLT: bool = True
    SYNC_SELIWARE: bool = True
    SYNC_POTASSIUM: bool = True
    SYNC_WAVE: bool = True
    STREAMER_MODE: bool = False


class Status(BaseModel):
    running: bool


class SaveScriptRequest(BaseModel):
    name: str
    content: str


# ── App setup ──────────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

workers_running = False
stop_event = Event()


# ── Helpers ────────────────────────────────────────────────────────

def _make_roblox_session(cookie: str) -> requests.Session:
    session = requests.Session()
    session.cookies[".ROBLOSECURITY"] = cookie
    session.headers["Content-Type"] = "application/json"
    return session


def _verify_cookie_and_build_account(
    cookie: str, place_id: str, private_url: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    session = _make_roblox_session(cookie)
    csrf = get_csrf_token(session)
    if not csrf:
        return None
    session.headers["X-CSRF-TOKEN"] = csrf
    user = get_user(session)
    if not user:
        return None
    universe_id = get_universe_id_from_place(place_id)
    privat_sr = (
        convert_share_link_to_legacy(private_url, place_id) if private_url else None
    )
    return {
        "id": user["id"],
        "name": user["name"],
        "displayName": user["displayName"],
        "Cookie": cookie,
        "PlaceId": place_id,
        "UniverseId": universe_id,
        "PrivatSr": privat_sr,
        "enabled": True,
    }


def _fetch_game_name(universe_id: int) -> Optional[str]:
    try:
        r = requests.get(
            f"https://games.roblox.com/v1/games?universeIds={universe_id}"
        )
        data = r.json().get("data", [])
        if data:
            return data[0].get("name", "Unknown")
    except Exception:
        pass
    return None


def _save_game_name(cfg: Dict, place_id: str, universe_id: Optional[int]) -> None:
    if not universe_id:
        return
    name = _fetch_game_name(universe_id)
    if name:
        cfg.setdefault("games", {})[place_id] = name


def _find_account_index(accounts: List[Dict], account_id: int) -> Optional[int]:
    return next(
        (i for i, a in enumerate(accounts) if int(a.get("id")) == account_id), None
    )


# ── Account endpoints ─────────────────────────────────────────────

@app.get("/accounts", response_model=List[Account])
def get_accounts() -> List[Dict[str, Any]]:
    return load_config().get("accounts", [])


@app.post("/accounts", response_model=Account)
def add_account(req: AddAccountRequest) -> Dict[str, Any]:
    acc = _verify_cookie_and_build_account(req.cookie, req.placeId, req.vipLink)
    if not acc:
        raise HTTPException(400, "Неверный cookie или ошибка проверки (Roblox API)")
    cfg = load_config()
    _save_game_name(cfg, req.placeId, acc.get("UniverseId"))
    cfg.setdefault("accounts", []).append(acc)
    save_config(cfg)
    return acc


@app.put("/accounts/{account_id}", response_model=Account)
def update_account(account_id: int, req: UpdateAccountRequest) -> Dict[str, Any]:
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    idx = _find_account_index(accounts, account_id)
    if idx is None:
        raise HTTPException(404, "Account not found")
    old = accounts[idx]

    if req.cookie:
        acc = _verify_cookie_and_build_account(req.cookie, req.placeId, req.vipLink)
        if not acc:
            raise HTTPException(400, "Неверный cookie или ошибка проверки (Roblox API)")
        acc["id"] = int(account_id)
    else:
        acc = dict(old)
        acc["PlaceId"] = req.placeId
        acc["UniverseId"] = get_universe_id_from_place(req.placeId)
        acc["PrivatSr"] = (
            convert_share_link_to_legacy(req.vipLink, req.placeId)
            if req.vipLink
            else None
        )

    _save_game_name(cfg, req.placeId, acc.get("UniverseId"))
    accounts[idx] = acc
    save_config(cfg)
    return acc


@app.patch("/accounts/{account_id}/enabled", response_model=Account)
def toggle_account(account_id: int, req: ToggleAccountRequest) -> Dict[str, Any]:
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    idx = _find_account_index(accounts, account_id)
    if idx is None:
        raise HTTPException(404, "Account not found")
    accounts[idx]["enabled"] = req.enabled
    save_config(cfg)
    return accounts[idx]


@app.delete("/accounts/{account_id}")
def delete_account(account_id: int) -> Dict[str, str]:
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    new_accounts = [a for a in accounts if int(a.get("id")) != account_id]
    if len(new_accounts) == len(accounts):
        raise HTTPException(404, "Account not found")
    cfg["accounts"] = new_accounts
    save_config(cfg)
    return {"detail": "Account deleted"}


# ── Settings endpoints ─────────────────────────────────────────────

SETTINGS_KEYS = [
    "CHECK_INTERVAL", "CUSTOM_TITLE", "THEME", "LANG",
    "TRACK_INJECTOR", "INJECTOR_PATH", "REJOIN_DELAY",
    "SYNC_VOLT", "SYNC_SELIWARE", "SYNC_POTASSIUM", "SYNC_WAVE",
    "STREAMER_MODE",
]


@app.get("/settings", response_model=Settings)
def get_settings() -> Dict[str, Any]:
    cfg = load_config()
    defaults = Settings(
        CHECK_INTERVAL=15, CUSTOM_TITLE="SORA_", THEME="dark", LANG="ru"
    )
    result = defaults.model_dump()
    for key in SETTINGS_KEYS:
        if key in cfg:
            result[key] = cfg[key]
    return result


@app.put("/settings", response_model=Settings)
def update_settings(settings: Settings) -> Dict[str, Any]:
    cfg = load_config()
    data = settings.model_dump()
    for key in SETTINGS_KEYS:
        cfg[key] = data[key]
    save_config(cfg)
    return data


# ── Rejoin worker endpoints ───────────────────────────────────────

def _worker_thread(cfg: Dict[str, Any]) -> None:
    global workers_running
    workers_running = True
    accounts = [a for a in cfg.get("accounts", []) if a.get("enabled", True)]
    start_workers_for_accounts(accounts, cfg)
    stop_event.wait()
    workers_running = False


@app.post("/rejoin/start", response_model=Status)
def start_rejoin() -> Dict[str, Any]:
    global workers_running, stop_event
    if workers_running:
        return {"running": True}
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    valid_accounts: List[Dict[str, Any]] = []
    changed = False

    for acc in accounts:
        if not acc.get("enabled", True):
            continue
        ok = is_cookie_valid(acc.get("Cookie", ""))
        if ok:
            if acc.get("dead"):
                acc["dead"] = False
                changed = True
            valid_accounts.append(acc)
        else:
            if not acc.get("dead", False):
                acc["dead"] = True
                changed = True

    if changed:
        cfg["accounts"] = accounts
        save_config(cfg)

    if not valid_accounts:
        return {"running": False}

    cfg_for_workers = dict(cfg)
    cfg_for_workers["accounts"] = valid_accounts
    stop_event.clear()
    Thread(target=_worker_thread, args=(cfg_for_workers,), daemon=True).start()
    return {"running": True}


@app.post("/rejoin/stop", response_model=Status)
def stop_rejoin() -> Dict[str, Any]:
    global workers_running, stop_event
    if not workers_running:
        return {"running": False}
    stop_event.set()
    return {"running": False}


@app.get("/status", response_model=Status)
def status() -> Dict[str, Any]:
    return {"running": workers_running}


# ── Process & status endpoints ─────────────────────────────────────

@app.get("/accounts/processes")
def get_account_processes() -> Dict[str, Any]:
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    custom_title = cfg.get("CUSTOM_TITLE", "SORA_")
    mapping = get_account_process_map(accounts, custom_title)
    return {str(k): v["pid"] for k, v in mapping.items()}


@app.get("/accounts/status")
def get_account_status() -> Dict[str, Any]:
    cfg = load_config()
    accounts = cfg.get("accounts", [])
    custom_title = cfg.get("CUSTOM_TITLE", "SORA_")
    proc_map = get_account_process_map(accounts, custom_title)
    result: Dict[str, Any] = {}

    for acc in accounts:
        aid = acc["id"]
        proc = proc_map.get(aid) or {}
        pid = proc.get("pid")
        process_name = proc.get("processName")

        in_game = False
        try:
            session = _make_roblox_session(acc.get("Cookie", ""))
            csrf = get_csrf_token(session)
            if csrf:
                session.headers["X-CSRF-TOKEN"] = csrf
                pres = get_presence(session, aid)
                if pres and pres.get("userPresenceType") == 2:
                    place_ok = (
                        str(pres.get("placeId")) == str(acc.get("PlaceId"))
                        or str(pres.get("universeId"))
                        == str(acc.get("UniverseId", ""))
                    )
                    in_game = bool(place_ok)
        except Exception:
            pass

        st = account_status_get(aid, in_game)
        result[str(aid)] = {
            "status": st,
            "pid": pid,
            "processName": process_name,
        }

    return result


@app.get("/injector/status")
def injector_status() -> Dict[str, Any]:
    cfg = load_config()
    if not cfg.get("TRACK_INJECTOR", False):
        return {"tracking": False}
    path = cfg.get("INJECTOR_PATH", "").strip()
    if not path:
        return {"tracking": True, "running": False, "pid": None}
    pid = is_injector_running(path)
    return {"tracking": True, "running": pid is not None, "pid": pid}


@app.post("/roblox/kill-all")
def kill_all_roblox_endpoint() -> Dict[str, Any]:
    killed = kill_all_roblox()
    return {"killed": killed}


# ── Script endpoints ───────────────────────────────────────────────

@app.get("/scripts/autoexec")
def get_scripts_autoexec() -> List[Dict[str, Any]]:
    return merge_scripts("autoexec", load_config())


@app.get("/scripts/workspace")
def get_scripts_workspace() -> List[Dict[str, Any]]:
    return list_workspace_from_ours()


@app.get("/scripts/{script_type}/{script_id}")
def get_script(script_type: str, script_id: str) -> Dict[str, Any]:
    if script_type not in ("autoexec", "workspace"):
        raise HTTPException(400, "Invalid script type")
    s = get_script_by_id(script_type, script_id)
    if not s:
        raise HTTPException(404, "Script not found")
    return s


@app.post("/scripts/autoexec")
def save_script_autoexec(req: SaveScriptRequest) -> Dict[str, Any]:
    return scripts_save("autoexec", req.name, req.content, load_config())


@app.post("/scripts/workspace")
def save_script_workspace(req: SaveScriptRequest) -> Dict[str, Any]:
    return scripts_save("workspace", req.name, req.content, load_config())


@app.post("/scripts/{script_type}/sync")
def sync_scripts(script_type: str) -> List[Dict[str, Any]]:
    if script_type not in ("autoexec", "workspace"):
        raise HTTPException(400, "Invalid script type")
    return merge_scripts(script_type, load_config())


@app.delete("/scripts/{script_type}/{script_id}")
def delete_script_endpoint(script_type: str, script_id: str) -> Dict[str, str]:
    if script_type not in ("autoexec", "workspace"):
        raise HTTPException(400, "Invalid script type")
    if scripts_delete(script_type, script_id):
        return {"detail": "Deleted"}
    raise HTTPException(404, "Script not found")


# ── Entry point ────────────────────────────────────────────────────

if __name__ == "__main__":
    multiprocessing.freeze_support()

    import os as _os
    _config_dir = _os.environ.get("REJOIN_CONFIG_DIR", ".")
    _log_file = _os.path.join(_config_dir, "api_server_python.log")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(_log_file, encoding="utf-8"),
        ],
    )

    log.info("api_server starting, config_dir=%s, frozen=%s", _config_dir, getattr(sys, "frozen", False))

    try:
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except Exception:
        log.exception("Fatal error in api_server")
