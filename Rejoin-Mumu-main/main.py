import os
import json
import subprocess
import threading
import time

CONFIG_FILE = 'config.json'
PORT_MAP_FILE = 'port_map.json'

# глобальные переменные используются потоками для получения состояния портов
RUN_FLAG = True
PORT_MAP = {}


def load_json(path, default=None):
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default if default is not None else {}


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def ensure_config():
    config = load_json(CONFIG_FILE)
    if 'mumu_path' not in config:
        path = input('Введите путь до MuMu (например E:\\MuMuPlayerGlobal-12.0): ').strip()
        config['mumu_path'] = path
        save_json(CONFIG_FILE, config)
    if 'start_cmd' not in config:
        cmd = input('Команда запуска эмулятора (используйте {name}): ').strip()
        config['start_cmd'] = cmd
        save_json(CONFIG_FILE, config)
    return config


def scan_emulators(mumu_path):
    vms = os.path.join(mumu_path, 'vms')
    emulators = []
    if not os.path.isdir(vms):
        return emulators
    for folder in os.listdir(vms):
        cfg = os.path.join(vms, folder, 'configs', 'vm_config.json')
        extra = os.path.join(vms, folder, 'configs', 'extra_config.json')
        if not os.path.exists(cfg):
            continue
        try:
            with open(cfg, 'r', encoding='utf-8') as f:
                data = json.load(f)
            port = data['vm']['nat']['port_forward']['adb']['host_port']
        except Exception:
            continue
        name = folder
        if os.path.exists(extra):
            try:
                with open(extra, 'r', encoding='utf-8') as f:
                    name = json.load(f).get('playerName', folder)
            except Exception:
                pass
        emulators.append((name, port))
    return emulators


def normalize_port_map(port_map):
    for p, v in list(port_map.items()):
        if isinstance(v, str):
            port_map[p] = {'place_id': v, 'enabled': True}
    return port_map


def update_port_map(emulators, port_map):
    changed = False
    for name, port in emulators:
        key = str(port)
        if key not in port_map:
            place_id = input(f'Введите PlaceID для порта {port} ({name}): ').strip()
            port_map[key] = {'place_id': place_id, 'enabled': True}
            changed = True
    if changed:
        save_json(PORT_MAP_FILE, port_map)
    return port_map


def rebuild_port_map(emulators):
    new_map = {}
    for name, port in emulators:
        place_id = input(f'Введите новый PlaceID для порта {port} ({name}): ').strip()
        new_map[str(port)] = {'place_id': place_id, 'enabled': True}
    save_json(PORT_MAP_FILE, new_map)
    return new_map


def display_table(emulators, port_map):
    w1, w2, w3, w4 = 14, 12, 14, 8
    header = (
        '┌' + '┬'.join('─'*w for w in (w1, w2, w3, w4)) + '┐\n'
        '│{: ^14}│{: ^12}│{: ^14}│{: ^8}│\n'.format('Эмулятор', 'ADB Порт', 'PlaceID', 'Active') +
        '├' + '┼'.join('─'*w for w in (w1, w2, w3, w4)) + '┤'
    )
    lines = [header]
    for name, port in emulators:
        entry = port_map.get(str(port), {})
        if isinstance(entry, str):
            pid = entry
            enabled = True
        else:
            pid = entry.get('place_id', '')
            enabled = entry.get('enabled', True)
        line = '│{:<14}│{:<12}│{:<14}│{:<8}│'.format(name, port, pid, 'Y' if enabled else 'N')
        lines.append(line)
    footer = '└' + '┴'.join('─'*w for w in (w1, w2, w3, w4)) + '┘'
    lines.append(footer)
    print('\n'.join(lines))


def adb_path(mumu_path):
    return os.path.join(mumu_path, 'shell', 'adb.exe')


def connect(adb, port):
    res = subprocess.run([adb, 'connect', f'127.0.0.1:{port}'], capture_output=True, text=True)
    return 'connected' in res.stdout.lower()


def is_emulator_running(adb, port):
    res = subprocess.run([adb, '-s', f'127.0.0.1:{port}', 'get-state'], capture_output=True, text=True)
    return 'device' in res.stdout.lower()


def start_emulator(cmd_template, name):
    cmd = cmd_template.format(name=name)
    subprocess.Popen(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start_app(adb, port, place_id, cmd_template, name):
    if not is_emulator_running(adb, port):
        start_emulator(cmd_template, name)
        time.sleep(10)
    connect(adb, port)
    subprocess.run([
        adb, '-s', f'127.0.0.1:{port}', 'shell', 'am', 'start',
        '-a', 'android.intent.action.VIEW',
        '-d', f'roblox://placeId={place_id}'
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def stop_app(adb, port):
    subprocess.run([adb, '-s', f'127.0.0.1:{port}', 'shell', 'am', 'force-stop', 'com.roblox.client'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def get_ps_line(adb, port):
    res = subprocess.run([adb, '-s', f'127.0.0.1:{port}', 'shell', 'ps'], capture_output=True, text=True)
    if res.returncode != 0:
        return None
    for line in res.stdout.splitlines():
        if 'com.roblox.client' in line:
            return line
    return ''


def monitor_emulator(name, adb, port, place_id, interval, start_cmd):
    last_state = None
    while RUN_FLAG:
        if not PORT_MAP.get(str(port), {}).get('enabled', True):
            time.sleep(1)
            continue
        line = get_ps_line(adb, port)
        if line is None:
            start_app(adb, port, place_id, start_cmd, name)
            last_state = None
        elif not line:
            start_app(adb, port, place_id, start_cmd, name)
            last_state = None
        else:
            if last_state == line:
                stop_app(adb, port)
                start_app(adb, port, place_id, start_cmd, name)
                last_state = None
            else:
                last_state = line
        time.sleep(interval)


def simple_monitor(name, adb, port, place_id, start_cmd):
    while RUN_FLAG:
        if not PORT_MAP.get(str(port), {}).get('enabled', True):
            time.sleep(1)
            continue
        line = get_ps_line(adb, port)
        if line is None or not line:
            start_app(adb, port, place_id, start_cmd, name)
        time.sleep(10)


def start(emulators, port_map, mumu_path, start_cmd):
    global RUN_FLAG, PORT_MAP
    PORT_MAP = port_map
    RUN_FLAG = True
    adb = adb_path(mumu_path)
    use_detect = input('Enable DetectFreeze? Y/N >> ').strip().lower()
    interval = 60
    if use_detect == 'y':
        try:
            interval = int(input('DetectFreeze interval (seconds) >> '))
        except ValueError:
            interval = 60
    threads = []
    for name, port in emulators:
        entry = port_map.get(str(port))
        if not entry or not entry.get('enabled', True):
            continue
        place_id = entry['place_id'] if isinstance(entry, dict) else entry
        if use_detect == 'y':
            t = threading.Thread(target=monitor_emulator, args=(name, adb, port, place_id, interval, start_cmd))
        else:
            t = threading.Thread(target=simple_monitor, args=(name, adb, port, place_id, start_cmd))
        t.daemon = True
        threads.append(t)
        t.start()

    while True:
        cmd = input('Toggle PORT or Q to stop >> ').strip().lower()
        if cmd == 'q':
            RUN_FLAG = False
            break
        if cmd in port_map:
            port_map[cmd]['enabled'] = not port_map[cmd].get('enabled', True)
            save_json(PORT_MAP_FILE, port_map)
            display_table(emulators, port_map)
        else:
            print('Unknown port')

    for t in threads:
        t.join()


def main():
    config = ensure_config()
    mumu = config['mumu_path']
    start_cmd = config.get('start_cmd', '')
    port_map = normalize_port_map(load_json(PORT_MAP_FILE))
    emulators = scan_emulators(mumu)
    port_map = update_port_map(emulators, port_map)
    while True:
        display_table(emulators, port_map)
        cmd = input('S - start, R - rebuild port map, Q - quit >> ').strip().lower()
        if cmd == 's':
            start(emulators, port_map, mumu, start_cmd)
        elif cmd == 'r':
            port_map = rebuild_port_map(emulators)
        elif cmd == 'q':
            break
        else:
            print('Unknown command')


if __name__ == '__main__':
    main()
