"""Shared account status for UI (in_game, restarting). Updated by rejoin worker."""
import time
from threading import Lock
from typing import Dict

_restart_until: Dict[int, float] = {}
_lock = Lock()

RESTART_DURATION_SEC = 15


def set_restarting(account_id: int) -> None:
    with _lock:
        _restart_until[account_id] = time.time() + RESTART_DURATION_SEC


def get_status(account_id: int, in_game: bool) -> str:
    """Returns 'in_game' | 'not_in_game' | 'restarting'."""
    with _lock:
        until = _restart_until.get(account_id, 0)
        if until > time.time():
            return "restarting"
    return "in_game" if in_game else "not_in_game"
