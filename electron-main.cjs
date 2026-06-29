'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'HavenFall Desktop';
const isDevToolsRequested = process.argv.includes('--devtools') || process.env.HAVENFALL_DEVTOOLS === '1';
const rootDir = __dirname;
const indexPath = path.join(rootDir, 'index.html');

app.setName(APP_NAME);
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function userDataPath() {
  return ensureDir(app.getPath('userData'));
}

function desktopPaths() {
  const base = userDataPath();
  return {
    userData: base,
    saves: ensureDir(path.join(base, 'saves')),
    backups: ensureDir(path.join(base, 'backups')),
    logs: ensureDir(path.join(base, 'logs')),
    config: path.join(base, 'desktop-config.json'),
    windowState: path.join(base, 'window-state.json')
  };
}

function readJsonSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function appendDesktopLog(...parts) {
  try {
    const paths = desktopPaths();
    const line = `[${new Date().toISOString()}] ${parts.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join(' ')}\n`;
    fs.appendFileSync(path.join(paths.logs, 'desktop.log'), line, 'utf8');
  } catch (_) {}
}

function loadWindowState() {
  const saved = readJsonSafe(desktopPaths().windowState, {});
  return {
    width: Math.max(1100, Number(saved.width) || 1440),
    height: Math.max(720, Number(saved.height) || 900),
    x: Number.isFinite(saved.x) ? saved.x : undefined,
    y: Number.isFinite(saved.y) ? saved.y : undefined,
    maximized: !!saved.maximized,
    fullscreen: !!saved.fullscreen
  };
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  writeJsonAtomic(desktopPaths().windowState, {
    ...bounds,
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen(),
    savedAt: new Date().toISOString()
  });
}

function createAppMenu(win) {
  const template = [
    {
      label: 'Jogo',
      submenu: [
        { label: 'Recarregar', accelerator: 'Ctrl+R', click: () => win.reload() },
        { label: 'Tela cheia', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) },
        { type: 'separator' },
        { label: 'Abrir pasta de saves', click: () => shell.openPath(desktopPaths().saves) },
        { label: 'Abrir pasta de logs', click: () => shell.openPath(desktopPaths().logs) },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: 'Debug',
      submenu: [
        { label: 'DevTools', accelerator: 'F12', click: () => win.webContents.toggleDevTools() },
        { label: 'Recarregar ignorando cache', accelerator: 'Ctrl+Shift+R', click: () => win.webContents.reloadIgnoringCache() }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1100,
    minHeight: 720,
    title: APP_NAME,
    backgroundColor: '#080b10',
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(rootDir, 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  createAppMenu(win);

  win.once('ready-to-show', () => {
    if (state.maximized) win.maximize();
    if (state.fullscreen) win.setFullScreen(true);
    win.show();
    if (isDevToolsRequested) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.on('close', () => saveWindowState(win));
  win.on('closed', () => appendDesktopLog('window closed'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current && !url.startsWith('file://')) event.preventDefault();
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    appendDesktopLog('render-process-gone', details);
    dialog.showErrorBox(APP_NAME, `O processo do jogo caiu: ${details.reason || 'erro desconhecido'}. Veja a pasta de logs.`);
  });

  win.loadFile(indexPath).catch(error => {
    appendDesktopLog('loadFile failed', error.message);
    dialog.showErrorBox(APP_NAME, `Falha ao abrir index.html: ${error.message}`);
  });

  return win;
}

ipcMain.on('havenfall:user-data-path', event => {
  event.returnValue = userDataPath();
});

ipcMain.handle('havenfall:open-path', async (_event, target) => {
  const paths = desktopPaths();
  const selected = target === 'logs' ? paths.logs : target === 'backups' ? paths.backups : paths.saves;
  const result = await shell.openPath(selected);
  return { ok: !result, error: result || null, path: selected };
});

ipcMain.handle('havenfall:quit', () => {
  app.quit();
  return { ok: true };
});

app.whenReady().then(() => {
  appendDesktopLog('boot', { version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome });
  const win = createWindow();
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', error => {
  appendDesktopLog('uncaughtException', error.stack || error.message || error);
});

process.on('unhandledRejection', reason => {
  appendDesktopLog('unhandledRejection', reason?.stack || reason?.message || reason);
});
