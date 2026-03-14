# ReJoin Desktop Tool

Десктоп‑приложение для автоматического ре‑джоина Roblox‑аккаунтов.

## Структура проекта

- `ReJoinTool.py` — точка входа консольного режима (MultiRoblox + CLI).
- `config.py` — загрузка/сохранение `rejoin_config.json`, значения по умолчанию.
- `roblox_api.py` — запросы к Roblox, тикеты, presence, запуск клиента.
- `rejoin_worker.py` — воркеры ре‑джоина, запуск потоков.
- `cli.py` — терминальный интерфейс (меню, добавление аккаунтов, настройки).
- `api_server.py` — HTTP API (FastAPI) для UI:
  - `GET/POST/DELETE /accounts`
  - `GET/PUT /settings`
  - `POST /rejoin/start`, `POST /rejoin/stop`, `GET /status`
- `electron-main.cjs` — Electron main‑процесс, который поднимает `api_server.py` и открывает React‑UI.
- `ui/` — React/TypeScript фронтенд (Vite):
  - `src/pages/AccountsPage.tsx` — список аккаунтов;
  - `src/pages/SettingsPage.tsx` — настройки интервала и префикса;
  - `src/pages/StatusPage.tsx` — статус ReJoin и кнопка старт/стоп;
  - `src/api/client.ts` и `src/state/*` — API‑клиент и React‑хуки.

## Запуск backend API

```bash
cd /путь/к/ReJoin
python api_server.py
```

API будет доступно по адресу `http://127.0.0.1:8000`.

## Запуск React UI (dev)

```bash
cd ui
npm install
npm run dev
```

Откройте `http://localhost:5173` в браузере или запустите Electron:

```bash
cd ..
npx electron ./electron-main.cjs
```

## Конфигурация

Файл `rejoin_config.json` (создаётся автоматически при первом запуске):

```jsonc
{
  "CHECK_INTERVAL": 15,
  "CUSTOM_TITLE": "SORA_",
  "THEME": "dark",
  "LANG": "ru",
  "accounts": [],
  "games": {}
}
```

- `CHECK_INTERVAL` — интервал проверки в секундах;
- `CUSTOM_TITLE` — префикс заголовка окна Roblox;
- `THEME`, `LANG` — настройки для UI;
- `accounts` — список аккаунтов с полями, соответствующими модели `Account` в `api_server.py`.

## Пустая страница

Если страница пустая (чёрный экран, нет контента):

1. **Проверьте URL** — UI доступен по `http://localhost:5173`, а не `http://127.0.0.1:8000` (это API).
2. **Запустите Vite** — в папке `ui` выполните `npm run dev`.
3. **Запустите API** — в корне проекта выполните `python api_server.py`.
4. **Откройте консоль** (F12 → Console) — там будут сообщения об ошибках.

Для Electron: сначала `npm run dev` в `ui`, затем `npx electron ./electron-main.cjs`.

## Сборка exe (ReJoinTool SkrilyaHUB)

Сборка одного установщика или портативной версии:

```powershell
# Установить зависимости
pip install -r requirements.txt pyinstaller

# Собрать всё
.\build.ps1
```

Или через CMD (`build.cmd`):

```cmd
pyinstaller api_server.spec --noconfirm
build.cmd
```

Или вручную (CMD):

```cmd
pyinstaller api_server.spec --noconfirm
cd ui
npm install
npm run build
cd ..
npm install
npx electron-builder --win
```

Результат в папке `release/`:

- `ReJoinTool (SkrilyaHUB) Setup 1.0.0.exe` — установщик
- `ReJoinTool (SkrilyaHUB) 1.0.0.exe` — портативная версия (без установки)

Конфигурация сохраняется в `%APPDATA%/ReJoinTool (SkrilyaHUB)/`.

**Если API не запускается (ERR_CONNECTION_REFUSED):**

- Логи: `%APPDATA%\ReJoinTool (SkrilyaHUB)\api_server.log`
- Python 3.14 может быть несовместим с Pydantic — попробуйте Python 3.11 или 3.12 для сборки: `py -3.11 -m PyInstaller api_server.spec --noconfirm`

**Если NSIS падает из‑за иконки:** используется PNG; NSIS требует ICO — иконки установщика временно отключены.

## Тестирование

- Backend:
  - проверить добавление/удаление аккаунтов через `/accounts`;
  - проверить чтение/обновление `/settings`;
  - проверить `POST /rejoin/start` и `POST /rejoin/stop`.
- UI:
  - загрузка аккаунтов и настроек после старта;
  - изменение интервала и префикса в настройках;
  - запуск/остановка ре‑джоина с обновлением статуса.

