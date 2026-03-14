import json
import os
import sys

def _get_base_dir() -> str:
    """Resolve base directory: REJOIN_CONFIG_DIR env > cwd."""
    env = os.environ.get("REJOIN_CONFIG_DIR")
    if env:
        return env
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return "."

CONFIG_DIR = _get_base_dir()
CONFIG_FILE = os.path.join(CONFIG_DIR, "rejoin_config.json")
AUTOEXEC_DIR = os.path.join(CONFIG_DIR, "autoexec")
WORKSPACE_DIR = os.path.join(CONFIG_DIR, "workspace")
BACKUPS_DIR = os.path.join(CONFIG_DIR, "backups")

DEFAULT_CONFIG = {
    "CHECK_INTERVAL": 15,
    "CUSTOM_TITLE": "SORA_",
    "THEME": "dark",
    "LANG": "ru",
    "TRACK_INJECTOR": False,
    "INJECTOR_PATH": "",
    "REJOIN_DELAY": 3,
    "SYNC_VOLT": True,
    "SYNC_SELIWARE": True,
    "SYNC_POTASSIUM": True,
    "SYNC_WAVE": True,
    "STREAMER_MODE": False,
    "accounts": [],
    "games": {},
}


def load_config() -> dict:
    config = DEFAULT_CONFIG.copy()
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                file_cfg = json.load(f)
            if isinstance(file_cfg, dict):
                config.update(file_cfg)
        except (json.JSONDecodeError, OSError):
            pass
    return config


def save_config(cfg: dict) -> None:
    os.makedirs(os.path.dirname(CONFIG_FILE) or ".", exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
