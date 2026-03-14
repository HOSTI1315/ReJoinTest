import logging
import os
import re
import subprocess
import time
import urllib.parse
from typing import Dict, List, Optional

import psutil
import requests

log = logging.getLogger(__name__)

PROCESS_NAME = "RobloxPlayerBeta"


def get_csrf_token(session: requests.Session) -> Optional[str]:
    response = session.post("https://auth.roblox.com/v2/logout")
    return response.headers.get("x-csrf-token")


def get_user(session: requests.Session) -> Optional[dict]:
    response = session.get("https://users.roblox.com/v1/users/authenticated")
    return response.json() if response.ok else None


def is_cookie_valid(cookie: str) -> bool:
    if not cookie:
        return False
    session = requests.Session()
    session.cookies[".ROBLOSECURITY"] = cookie
    session.headers["Content-Type"] = "application/json"
    csrf = get_csrf_token(session)
    if not csrf:
        return False
    session.headers["X-CSRF-TOKEN"] = csrf
    return bool(get_user(session))


def get_ticket(session: requests.Session) -> Optional[str]:
    response = session.post(
        "https://auth.roblox.com/v1/authentication-ticket/",
        headers={"Referer": "https://www.roblox.com/games/1/Any"},
        json={},
    )
    if response.status_code == 200:
        return response.headers.get("rbx-authentication-ticket")
    log.warning("Ticket request failed: %s %s", response.status_code, response.text)
    return None


def get_presence(session: requests.Session, uid: int) -> Optional[dict]:
    response = session.post(
        "https://presence.roblox.com/v1/presence/users", json={"userIds": [uid]}
    )
    return response.json()["userPresences"][0] if response.ok else None


def get_universe_id_from_place(place_id: str) -> Optional[int]:
    try:
        response = requests.get(
            f"https://apis.roblox.com/universes/v1/places/{place_id}/universe"
        )
        if response.ok:
            return response.json()["universeId"]
    except Exception:
        pass
    return None


def extract_link_code(url: str) -> Optional[str]:
    match = re.search(r"(?:code|privateServerLinkCode)=([a-zA-Z0-9]+)", url)
    return match.group(1) if match else None


def convert_share_link_to_legacy(url: str, place_id: str) -> Optional[str]:
    code = extract_link_code(url)
    if code:
        return f"https://www.roblox.com/games/{place_id}/Game?privateServerLinkCode={code}"
    return None


def launch_roblox(
    ticket: str,
    place_id: str,
    username: str,
    custom_title: str,
    private_url: Optional[str] = None,
) -> None:
    timestamp = int(time.time() * 1000)
    launcher_url = (
        "https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame"
        f"&browserTrackerId=1337&placeId={place_id}&isPlayTogetherGame=false"
    )

    if private_url:
        code = extract_link_code(private_url)
        if code:
            launcher_url += f"&linkCode={urllib.parse.quote(code)}"
        else:
            log.warning("Invalid private server link: %s", private_url)
            return

    encoded_launcher = urllib.parse.quote(launcher_url, safe="")
    uri = (
        f"roblox-player:1+launchmode:play+gameinfo:{ticket}"
        f"+launchtime:{timestamp}"
        f"+placelauncherurl:{encoded_launcher}"
        f"+browsertrackerid:1337+robloxLocale:ru_ru+gameLocale:ru_ru"
    )

    title = f"{custom_title}{username}"
    log.info("Launching Roblox: %s", title)
    subprocess.Popen(f'start "{title}" "{uri}"', shell=True)


def kill_roblox_by_pid(pid: int) -> bool:
    try:
        proc = psutil.Process(pid)
        if PROCESS_NAME in (proc.name() or ""):
            proc.kill()
            log.info("Killed Roblox PID %d", pid)
            return True
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    return False


def kill_window_by_title(title: str, place_id: Optional[str] = None) -> None:
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            if PROCESS_NAME not in (proc.info.get("name") or ""):
                continue
            cmdline = proc.info.get("cmdline") or []
            cl = " ".join(cmdline).lower()
            matched = title.lower() in cl
            if not matched and place_id:
                matched = place_id in " ".join(cmdline)
            if matched:
                proc.kill()
                log.info("Killed Roblox: %s (PID %d)", title, proc.info["pid"])
        except (psutil.NoSuchProcess, psutil.AccessDenied, TypeError, AttributeError):
            continue


def get_roblox_processes() -> List[Dict]:
    result = []
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            if PROCESS_NAME not in (proc.info.get("name") or ""):
                continue
            cmdline = proc.info.get("cmdline") or []
            result.append({
                "pid": proc.info["pid"],
                "cmdline": " ".join(cmdline) if cmdline else "",
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return result


def get_account_process_map(
    accounts: List[Dict], custom_title: str
) -> Dict[int, Dict]:
    procs = get_roblox_processes()
    mapping: Dict[int, Dict] = {
        a["id"]: {"pid": None, "processName": None} for a in accounts
    }
    used_pids: set = set()

    for acc in accounts:
        title = f"{custom_title}{acc['name']}".lower()
        place_id = str(acc.get("PlaceId", ""))
        for p in procs:
            if p["pid"] in used_pids:
                continue
            cl = p["cmdline"].lower()
            if title in cl or (place_id and place_id in p["cmdline"]):
                mapping[acc["id"]] = {"pid": p["pid"], "processName": PROCESS_NAME}
                used_pids.add(p["pid"])
                break

    return mapping


def _normalize_path(p: str) -> str:
    return os.path.normcase(os.path.abspath(p.strip()))


def is_injector_running(path: str) -> Optional[int]:
    if not path or not path.strip():
        return None
    target = _normalize_path(path)
    for proc in psutil.process_iter(["pid", "exe"]):
        try:
            exe = proc.info.get("exe")
            if exe and _normalize_path(exe) == target:
                return proc.info["pid"]
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None


def kill_all_roblox() -> int:
    killed = 0
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            if PROCESS_NAME in (proc.info.get("name") or ""):
                proc.kill()
                killed += 1
                log.info("Killed Roblox PID %d", proc.info["pid"])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return killed
