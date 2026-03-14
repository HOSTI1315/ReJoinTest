const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;

let mainWindow;
let apiProcess;
let apiErrorShown = false;
const openFds = [];

function logToFile(filename, message) {
  try {
    const userDataPath = app.getPath("userData");
    fs.mkdirSync(userDataPath, { recursive: true });
    const logPath = path.join(userDataPath, filename);
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // ignore
  }
}

function waitForApiReady(timeoutMs, intervalMs) {
  const start = Date.now();

  function pingOnce() {
    return new Promise((resolve) => {
      const req = http.get("http://127.0.0.1:8000/status", (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        res.resume();
        resolve(ok);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("API server did not become ready in time"));
      }
      if (await pingOnce()) return resolve();
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, "assets", "icon.png");
  const opts = {
    width: 1200,
    height: 800,
    title: "ReJoinTool (SkrilyaHUB)",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  };
  if (fs.existsSync(iconPath)) opts.icon = iconPath;

  mainWindow = new BrowserWindow(opts);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow.isVisible()) mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    logToFile("ui-errors.log", `did-fail-load: ${code} ${desc} ${url}`);
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const htmlPath = path.join(__dirname, "ui", "dist", "index.html");
    if (!fs.existsSync(htmlPath)) {
      logToFile("ui-errors.log", `UI not found: ${htmlPath}`);
    }
    mainWindow.loadFile(htmlPath);
  }

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3000);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showServerError(title, message) {
  if (apiErrorShown || isDev) return;
  apiErrorShown = true;
  dialog
    .showMessageBox({
      type: "error",
      title,
      message,
      buttons: ["ОК", "Открыть страницу загрузки VC++"],
      defaultId: 0,
      cancelId: 0,
    })
    .then((result) => {
      if (result.response === 1) {
        shell.openExternal(
          "https://learn.microsoft.com/ru-ru/cpp/windows/latest-supported-vc-redist"
        );
      }
    });
}

function killStaleApiServers() {
  try {
    execSync('taskkill /F /IM api_server.exe /T 2>nul', { windowsHide: true });
  } catch {
    // no process found — that's fine
  }
}

function startApiServer() {
  const userDataPath = app.getPath("userData");
  fs.mkdirSync(userDataPath, { recursive: true });

  if (isDev) {
    const scriptPath = path.join(__dirname, "api_server.py");
    apiProcess = spawn("python", [scriptPath], {
      cwd: __dirname,
      stdio: "inherit",
      env: { ...process.env },
    });
    return;
  }

  killStaleApiServers();

  const exeDir = path.join(process.resourcesPath, "api_server");
  let serverStartedAt = Date.now();
  const exePath = path.join(exeDir, "api_server.exe");
  const mainLogPath = path.join(userDataPath, "api_server.log");

  const log = (msg) => {
    try {
      fs.appendFileSync(
        mainLogPath,
        `[${new Date().toISOString()}] ${msg}\n`
      );
    } catch {
      // ignore
    }
  };

  if (!fs.existsSync(exePath)) {
    log(`ERROR: api_server.exe not found at: ${exePath}`);
    log(`resourcesPath: ${process.resourcesPath}`);
    showServerError(
      "Ошибка запуска сервера",
      "Не удалось найти файл api_server.exe внутри приложения.\n\nПопробуйте переустановить приложение."
    );
    return;
  }

  log(`Starting: ${exePath}`);
  log(`cwd: ${userDataPath}`);

  const stdoutPath = path.join(userDataPath, "api_server_stdout.log");
  const stderrPath = path.join(userDataPath, "api_server_stderr.log");

  const stdoutFd = fs.openSync(stdoutPath, "a");
  const stderrFd = fs.openSync(stderrPath, "a");
  openFds.push(stdoutFd, stderrFd);

  fs.writeSync(stderrFd, `\n--- ${new Date().toISOString()} ---\n`);
  fs.writeSync(stdoutFd, `\n--- ${new Date().toISOString()} ---\n`);

  apiProcess = spawn(exePath, [], {
    cwd: userDataPath,
    env: { ...process.env, REJOIN_CONFIG_DIR: userDataPath },
    stdio: ["ignore", stdoutFd, stderrFd],
    detached: false,
    windowsHide: true,
  });

  apiProcess.on("error", (err) => {
    log(`ERROR: Failed to start: ${err.message}`);
    showServerError(
      "Не удалось запустить сервер",
      "Не удалось запустить встроенный сервер api_server.exe.\n\nЧасто это связано с отсутствующими системными библиотеками (Microsoft Visual C++ Redistributable x64)."
    );
  });

  apiProcess.on("exit", (code, signal) => {
    log(`api_server exited: code=${code} signal=${signal}`);
    if (code !== 0 && code !== null) {
      const uptime = Date.now() - serverStartedAt;
      log(`Uptime before crash: ${uptime}ms`);
      if (uptime < 5000) {
        log("Crashed quickly — likely port conflict, will not show error (waitForApiReady will handle)");
      } else {
        log("Check api_server_stderr.log for details");
        showServerError(
          "Сервер завершился с ошибкой",
          "Встроенный сервер api_server.exe завершился с ошибкой.\n\nПроверьте файл api_server_stderr.log в папке данных приложения."
        );
      }
    }
  });
}

function closeOpenFds() {
  for (const fd of openFds) {
    try {
      fs.closeSync(fd);
    } catch {
      // ignore
    }
  }
  openFds.length = 0;
}

app.whenReady().then(async () => {
  startApiServer();

  const maxWaitMs = isDev ? 5000 : 20000;
  try {
    await waitForApiReady(maxWaitMs, 500);
    logToFile("api_server.log", "API server is ready");
  } catch (err) {
    logToFile("api_server.log", `API did not become ready: ${err.message}`);
    if (!isDev && !apiErrorShown) {
      apiErrorShown = true;
      dialog.showMessageBox({
        type: "warning",
        title: "Сервер не запустился вовремя",
        message:
          "Не удалось дождаться запуска встроенного сервера.\n\nИнтерфейс будет открыт, но некоторые функции могут быть недоступны.",
      });
    }
  }

  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (apiProcess) {
    apiProcess.kill();
  }
  closeOpenFds();
});
