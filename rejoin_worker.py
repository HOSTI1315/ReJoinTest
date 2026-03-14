import logging
import time
from threading import Thread
from typing import Dict, List

import psutil

from account_status import set_restarting
from config import load_config
from roblox_api import (
    get_account_process_map,
    get_csrf_token,
    get_presence,
    get_ticket,
    kill_roblox_by_pid,
    kill_window_by_title,
    launch_roblox,
)

log = logging.getLogger(__name__)


def _is_in_target_game(presence: dict, account: Dict) -> bool:
    if not presence or presence.get("userPresenceType") != 2:
        return False
    return (
        str(presence.get("placeId")) == str(account["PlaceId"])
        or str(presence.get("universeId")) == str(account.get("UniverseId"))
    )


def worker(account: Dict, config: Dict) -> None:
    import requests

    name = account["name"]
    session = requests.Session()
    session.cookies[".ROBLOSECURITY"] = account["Cookie"]
    session.headers["Content-Type"] = "application/json"

    csrf = get_csrf_token(session)
    if not csrf:
        log.error("Failed to get CSRF for %s", name)
        return
    session.headers["X-CSRF-TOKEN"] = csrf

    def _do_restart(kill_first: bool) -> None:
        set_restarting(account["id"])
        if kill_first:
            proc_map = get_account_process_map(
                config.get("accounts", []), config.get("CUSTOM_TITLE", "SORA_")
            )
            pid = (proc_map.get(account["id"]) or {}).get("pid")
            killed = pid is not None and kill_roblox_by_pid(pid)
            if not killed:
                title = f"{config['CUSTOM_TITLE']}{name}"
                place_id = str(account.get("PlaceId", ""))
                kill_window_by_title(title, place_id=place_id or None)
            delay = config.get("REJOIN_DELAY", 3)
            if delay > 0:
                time.sleep(delay)

        ticket = get_ticket(session)
        if ticket:
            launch_roblox(
                ticket,
                account["PlaceId"],
                name,
                config["CUSTOM_TITLE"],
                account.get("PrivatSr"),
            )
        else:
            log.warning("%s: ticket unavailable, will retry later", name)

    while True:
        try:
            pres = get_presence(session, account["id"])
            proc_map = get_account_process_map(
                config.get("accounts", []), config.get("CUSTOM_TITLE", "SORA_")
            )
            pid = (proc_map.get(account["id"]) or {}).get("pid")
            in_game = _is_in_target_game(pres, account)
            process_alive = pid is not None and psutil.pid_exists(pid)

            if in_game and process_alive:
                log.debug("%s: in target game", name)
            elif in_game and not process_alive:
                log.info("%s: Roblox crashed, restarting", name)
                _do_restart(kill_first=False)
            else:
                log.info("%s: not in game / wrong game, killing and restarting", name)
                _do_restart(kill_first=True)
        except Exception as e:
            log.error("%s: worker error: %s", name, e)

        time.sleep(config["CHECK_INTERVAL"])


def start_workers_for_accounts(accounts: List[Dict], config: Dict) -> None:
    for acc in accounts:
        Thread(target=worker, args=(acc, config), daemon=True).start()
