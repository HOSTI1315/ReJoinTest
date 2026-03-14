import os

import requests
from colorama import Fore, init

from config import load_config, save_config
from rejoin_worker import start_workers_for_accounts
from roblox_api import (
    convert_share_link_to_legacy,
    get_csrf_token,
    get_universe_id_from_place,
    get_user,
)


def clear_screen() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def show_main_menu() -> None:
    clear_screen()
    print(Fore.GREEN + "==== Меню ====")
    print("1. Запуск Rejoin Tool")
    print("2. Добавить аккаунт")
    print("3. Посмотреть аккаунты")
    print("4. Настройки")
    print("5. Выход")


def start_rejoin_tool_cli(config: dict) -> None:
    clear_screen()
    print(Fore.YELLOW + "Запуск Rejoin Tool...")
    start_workers_for_accounts(config["accounts"], config)
    input("Нажмите Enter для возврата в меню...")


def add_account_page(config: dict) -> None:
    clear_screen()
    print(Fore.YELLOW + "=== Добавить аккаунт ===")
    cookie = input("Введите .ROBLOSECURITY: ").strip()
    place_id = input("Введите placeId: ").strip()
    private = input("(Необязательно) Вставьте ссылку на приват сервер: ").strip()

    session = requests.Session()
    session.cookies[".ROBLOSECURITY"] = cookie
    session.headers.update({"Content-Type": "application/json"})
    session.headers["X-CSRF-TOKEN"] = get_csrf_token(session)
    user = get_user(session)

    try:
        game_info = requests.get(
            f"https://games.roblox.com/v1/games?universeIds={user['id']}"
        )
        data = game_info.json().get("data", [])
        if data:
            config.setdefault("games", {})[place_id] = data[0]["name"]
    except Exception:
        pass

    if not user:
        print("[!] Ошибка получения пользователя")
        input("Нажмите Enter чтобы вернуться...")
        return

    new_acc = {
        "id": user["id"],
        "name": user["name"],
        "displayName": user["displayName"],
        "Cookie": cookie,
        "PlaceId": place_id,
        "UniverseId": get_universe_id_from_place(place_id),
        "PrivatSr": convert_share_link_to_legacy(private, place_id) if private else None,
    }

    config["accounts"].append(new_acc)
    save_config(config)
    print(f"[+] Аккаунт {user['name']} добавлен.")
    input("Нажмите Enter для возврата в меню...")


def show_accounts_page(config: dict) -> None:
    clear_screen()
    print(Fore.CYAN + "==== Аккаунты ====")
    for i, acc in enumerate(config["accounts"], 1):
        name = acc["name"]
        uid = acc["id"]
        place = acc["PlaceId"]
        game_name = config.get("games", {}).get(str(place), "❓ Unknown Game")
        private = acc.get("PrivatSr")
        private_mark = "✅" if private else "❌"

        print(f"{i}. {name}")
        print(f"   ID: {uid}")
        print(f"   PlaceId: {place}")
        print(f"   Name: {game_name}")
        print(f"   P.S: {private_mark}")
        print("--------------------")

    input("Нажмите Enter для возврата в меню...")


def settings_page(config: dict) -> None:
    clear_screen()
    print(Fore.MAGENTA + "==== Настройки ====")
    try:
        interval = int(
            input(f"Интервал проверки (текущий: {config['CHECK_INTERVAL']}): ")
        )
        title = input(
            f"Кастомный префикс (текущий: {config['CUSTOM_TITLE']}): "
        )
        config["CHECK_INTERVAL"] = interval
        config["CUSTOM_TITLE"] = title
        save_config(config)
        print("[✓] Настройки сохранены")
    except Exception:
        print("[!] Ошибка ввода")
    input("Нажмите Enter для возврата в меню...")


def terminal() -> None:
    init(autoreset=True)
    config = load_config()

    while True:
        show_main_menu()
        choice = input("Выбор: ").strip()

        if choice == "1":
            start_rejoin_tool_cli(config)
        elif choice == "2":
            add_account_page(config)
        elif choice == "3":
            show_accounts_page(config)
        elif choice == "4":
            settings_page(config)
        elif choice == "5":
            print("Выход...")
            os._exit(0)
        else:
            input("Неверный выбор. Нажмите Enter, чтобы продолжить...")

