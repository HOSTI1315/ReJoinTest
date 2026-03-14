import win32api
import win32event
import winerror

from cli import terminal


def enable_multi_roblox() -> bool:
    try:
        win32event.CreateMutex(None, True, "ROBLOX_singletonMutex")
        if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
            print(
                "Roblox уже запущен. Закрой все клиенты перед активацией MultiRoblox."
            )
            return False
        print("MultiRoblox активирован.")
        return True
    except Exception as exc:
        print(f"Не удалось активировать MultiRoblox: {exc}")
        return False


if __name__ == "__main__":
    enable_multi_roblox()
    terminal()