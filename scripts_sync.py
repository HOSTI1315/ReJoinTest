"""
Content-based script sync for AutoExec and Workspace tabs.
Syncs with Volt, Potassium, Seliware, Wave folders.
Creates backups on first sync.
"""
import hashlib
import json
import logging
import os
import shutil
from datetime import datetime
from typing import Dict, List, Optional

from config import (
    AUTOEXEC_DIR,
    BACKUPS_DIR,
    CONFIG_DIR,
    WORKSPACE_DIR,
    load_config,
)

log = logging.getLogger(__name__)

SCRIPT_SYNC_STATE_FILE = os.path.join(CONFIG_DIR, "scripts_sync_state.json")

LOCALAPPDATA = os.environ.get("LOCALAPPDATA", os.path.expandvars("%LOCALAPPDATA%"))

AUTOEXEC_SOURCES = [
    ("volt", os.path.join(LOCALAPPDATA, "Volt", "autoexec")),
    ("potassium", os.path.join(LOCALAPPDATA, "Potassium", "autoexec")),
    ("seliware", os.path.join(LOCALAPPDATA, "seliware-autoexec")),
    ("wave", os.path.join(LOCALAPPDATA, "Wave", "AutoExecute")),
]

WORKSPACE_SOURCES = [
    ("volt", os.path.join(LOCALAPPDATA, "Volt", "workspace")),
    ("potassium", os.path.join(LOCALAPPDATA, "Potassium", "workspace")),
    ("seliware", os.path.join(LOCALAPPDATA, "seliware-workspace")),
    ("wave", os.path.join(LOCALAPPDATA, "Wave", "Workspace")),
]

_SYNC_KEY_MAP = {
    "volt": "SYNC_VOLT",
    "potassium": "SYNC_POTASSIUM",
    "seliware": "SYNC_SELIWARE",
    "wave": "SYNC_WAVE",
}


def _is_source_enabled(name: str, config: dict) -> bool:
    key = _SYNC_KEY_MAP.get(name)
    return config.get(key, True) if key else True


def _load_sync_state() -> dict:
    if os.path.exists(SCRIPT_SYNC_STATE_FILE):
        try:
            with open(SCRIPT_SYNC_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"backup_autoexec": None, "backup_workspace": None}


def _save_sync_state(state: dict) -> None:
    with open(SCRIPT_SYNC_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get_sources(script_type: str) -> List[tuple]:
    return AUTOEXEC_SOURCES if script_type == "autoexec" else WORKSPACE_SOURCES


def _our_dir(script_type: str) -> str:
    return AUTOEXEC_DIR if script_type == "autoexec" else WORKSPACE_DIR


def _enabled_sources(script_type: str, config: dict) -> List[tuple]:
    return [
        (name, path)
        for name, path in _get_sources(script_type)
        if _is_source_enabled(name, config)
    ]


def get_script_folders(
    script_type: str, config: Optional[dict] = None
) -> List[str]:
    if config is None:
        config = load_config()
    our = _our_dir(script_type)
    os.makedirs(our, exist_ok=True)
    folders = [our]
    for name, path in _enabled_sources(script_type, config):
        if script_type == "autoexec" and not os.path.isdir(path):
            continue
        folders.append(path)
    return folders


def _ensure_folders() -> None:
    os.makedirs(AUTOEXEC_DIR, exist_ok=True)
    os.makedirs(WORKSPACE_DIR, exist_ok=True)


def _copy_tree_resilient(src_root: str, dst_root: str) -> None:
    for dirpath, _dirnames, filenames in os.walk(src_root):
        rel = os.path.relpath(dirpath, src_root)
        dst_dir = os.path.join(dst_root, rel)
        if rel != ".":
            os.makedirs(dst_dir, exist_ok=True)
        for f in filenames:
            try:
                shutil.copy2(os.path.join(dirpath, f), os.path.join(dst_dir, f))
            except (OSError, IOError):
                pass


def _create_backups(script_type: str, config: dict) -> None:
    state = _load_sync_state()
    key = f"backup_{script_type}"
    if state.get(key):
        return

    sources = _enabled_sources(script_type, config)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    backup_root = os.path.join(BACKUPS_DIR, timestamp)
    os.makedirs(backup_root, exist_ok=True)
    created = False

    for name, path in sources:
        if not os.path.isdir(path):
            continue
        dest = os.path.join(backup_root, f"{name}_{script_type}")
        os.makedirs(dest, exist_ok=True)
        _copy_tree_resilient(path, dest)
        created = True

    if created:
        state[key] = timestamp
        _save_sync_state(state)


def scan_folder(
    path: str, ext_filter: Optional[str] = None, recursive: bool = False
) -> Dict[str, dict]:
    result = {}
    if not os.path.isdir(path):
        return result
    try:
        entries = (
            (
                (os.path.join(dp, fn), os.path.relpath(os.path.join(dp, fn), path), fn)
                for dp, _, fns in os.walk(path)
                for fn in fns
            )
            if recursive
            else (
                (os.path.join(path, n), n, n)
                for n in os.listdir(path)
                if os.path.isfile(os.path.join(path, n))
            )
        )
        for full_path, key_path, name in entries:
            if ext_filter and not name.lower().endswith(ext_filter.lower()):
                continue
            try:
                with open(full_path, "rb") as f:
                    data = f.read()
            except (IOError, OSError):
                continue
            try:
                content = data.decode("utf-8")
            except UnicodeDecodeError:
                content = ""
            mtime = os.path.getmtime(full_path)
            entry = {
                "path": full_path,
                "name": name,
                "content": content,
                "mtime": mtime,
                "data": data,
            }
            if recursive:
                entry["rel_path"] = key_path
                result[key_path] = entry
            else:
                result[content_hash(data)] = entry
    except (IOError, OSError):
        pass
    return result


def _push_workspace_to_folders(
    files_by_rel: Dict[str, dict], folders: List[str], config: dict
) -> None:
    for folder in folders:
        os.makedirs(folder, exist_ok=True)
        for rel_path, info in files_by_rel.items():
            dst = os.path.join(folder, rel_path)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            try:
                data = info.get("data") or info["content"].encode("utf-8")
                with open(dst, "wb") as f:
                    f.write(data)
            except (OSError, IOError):
                pass


def list_workspace_from_ours() -> List[dict]:
    _ensure_folders()
    scanned = scan_folder(WORKSPACE_DIR, ext_filter=None, recursive=True)
    return [
        {
            "id": content_hash(v.get("data") or v["content"].encode("utf-8")),
            "name": v["rel_path"],
            "rel_path": v["rel_path"],
            "content": v["content"],
            "path": v["path"],
        }
        for v in scanned.values()
    ]


def _merge_workspace(folders: List[str], ext_filter: Optional[str], config: dict) -> List[dict]:
    our_dir = WORKSPACE_DIR
    files_by_rel: Dict[str, dict] = {}

    for folder in folders:
        scanned = scan_folder(folder, ext_filter, recursive=True)
        for rel_path, info in scanned.items():
            if rel_path not in files_by_rel:
                files_by_rel[rel_path] = dict(info)
                files_by_rel[rel_path]["rel_path"] = rel_path
            else:
                existing = files_by_rel[rel_path]
                dir_existing = os.path.normpath(os.path.dirname(existing["path"]))
                dir_new = os.path.normpath(os.path.dirname(info["path"]))
                our_dir_n = os.path.normpath(our_dir)
                if dir_new == our_dir_n:
                    files_by_rel[rel_path] = dict(info)
                    files_by_rel[rel_path]["rel_path"] = rel_path
                elif (
                    dir_existing != our_dir_n
                    and info.get("mtime", 0) > existing.get("mtime", 0)
                ):
                    files_by_rel[rel_path] = dict(info)
                    files_by_rel[rel_path]["rel_path"] = rel_path

    _push_workspace_to_folders(files_by_rel, folders, config)
    return [
        {
            "id": content_hash(v.get("data") or v["content"].encode("utf-8")),
            "name": v["name"],
            "rel_path": v["rel_path"],
            "content": v["content"],
            "path": os.path.join(our_dir, v["rel_path"]),
        }
        for v in files_by_rel.values()
    ]


def _merge_autoexec(folders: List[str], ext_filter: Optional[str]) -> List[dict]:
    merged: Dict[str, dict] = {}

    for folder in folders:
        scanned = scan_folder(folder, ext_filter, recursive=False)
        for h, info in scanned.items():
            if h not in merged:
                merged[h] = {
                    "id": h,
                    "name": os.path.splitext(info["name"])[0],
                    "content": info["content"],
                    "path": info["path"],
                    "mtime": info["mtime"],
                }
            else:
                our_path = os.path.dirname(merged[h]["path"])
                if our_path in (AUTOEXEC_DIR, WORKSPACE_DIR):
                    pass
                elif os.path.dirname(info["path"]) in (AUTOEXEC_DIR, WORKSPACE_DIR):
                    merged[h].update(
                        path=info["path"],
                        name=os.path.splitext(info["name"])[0],
                        content=info["content"],
                        mtime=info["mtime"],
                    )

    return list(merged.values())


def merge_scripts(script_type: str, config: Optional[dict] = None) -> List[dict]:
    _ensure_folders()
    if config is None:
        config = load_config()
    _create_backups(script_type, config)
    folders = get_script_folders(script_type, config)
    ext_filter = ".lua" if script_type == "autoexec" else None

    if script_type == "workspace":
        return _merge_workspace(folders, ext_filter, config)
    return _merge_autoexec(folders, ext_filter)


def save_script(
    script_type: str, name: str, content: str, config: Optional[dict] = None
) -> dict:
    _ensure_folders()
    if config is None:
        config = load_config()

    if script_type == "autoexec":
        if not name.lower().endswith(".lua"):
            name = f"{name}.lua"
        target_dir = AUTOEXEC_DIR
    else:
        if "." not in name:
            name = f"{name}.lua"
        target_dir = WORKSPACE_DIR

    full_path = os.path.join(target_dir, name)
    data = content.encode("utf-8")
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)

    h = content_hash(data)
    if script_type == "workspace":
        folders = get_script_folders(script_type, config)
        _push_workspace_to_folders(
            {name: {"content": content, "data": data}}, folders, config
        )
    return {"id": h, "name": name, "content": content, "path": full_path}


def get_script_by_id(script_type: str, script_id: str) -> Optional[dict]:
    if script_type == "workspace":
        items = list_workspace_from_ours()
    else:
        items = merge_scripts(script_type, load_config())
    for s in items:
        if s["id"] == script_id:
            return s
    return None


def delete_script(script_type: str, script_id: str) -> bool:
    s = get_script_by_id(script_type, script_id)
    if not s:
        return False
    our_dir = _our_dir(script_type)
    if not s["path"].startswith(our_dir):
        return False
    if os.path.isfile(s["path"]):
        os.remove(s["path"])
        return True
    return False
