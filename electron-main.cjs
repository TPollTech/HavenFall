'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'HavenFall Desktop';
const isDevToolsRequested = process.argv.includes('--devtools') || process.env.HAVENFALL_DEVTOOLS === '1';
const rootDir = __dirname;
const indexPath = path.join(rootDir, 'index.html');
const windowIconPath = path.join(rootDir, 'logo.png');

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

function desktopConfigPath() {
  return path.join(userDataPath(), 'desktop-config.json');
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

function readDesktopConfig() {
  const config = readJsonSafe(desktopConfigPath(), {});
  return config && typeof config === 'object' ? config : {};
}

function writeDesktopConfig(next = {}) {
  const current = readDesktopConfig();
  const value = {
    ...current,
    ...next,
    updatedAt: new Date().toISOString()
  };
  if (!value.createdAt) value.createdAt = current.createdAt || value.updatedAt;
  writeJsonAtomic(desktopConfigPath(), value);
  return value;
}

function normalizeSaveRoot(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return path.resolve(raw);
}

function desktopPaths() {
  const base = userDataPath();
  const config = readDesktopConfig();
  const configuredSaveRoot = normalizeSaveRoot(config.saveRoot);
  const defaultSaves = ensureDir(path.join(base, 'saves'));
  const saves = ensureDir(configuredSaveRoot || defaultSaves);
  return {
    userData: base,
    saves,
    backups: ensureDir(path.join(saves, 'backups')),
    logs: ensureDir(path.join(base, 'logs')),
    config: desktopConfigPath(),
    windowState: path.join(base, 'window-state.json'),
    defaultSaves,
    customSaves: !!configuredSaveRoot
  };
}

function saveFilesIn(dir) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => path.join(dir, file));
  } catch (_) {
    return [];
  }
}

function copySaveFiles(oldDir, newDir) {
  const from = path.resolve(String(oldDir || ''));
  const to = path.resolve(String(newDir || ''));
  if (!from || !to || from === to || !fs.existsSync(from)) return { copied: 0, skipped: 0 };
  ensureDir(to);
  let copied = 0;
  let skipped = 0;
  for (const file of saveFilesIn(from)) {
    const dest = path.join(to, path.basename(file));
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    fs.copyFileSync(file, dest);
    copied++;
  }
  return { copied, skipped };
}

function appendDesktopLog(...parts) {
  try {
    const paths = desktopPaths();
    const line = `[${new Date().toISOString()}] ${parts.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join(' ')}\n`;
    fs.appendFileSync(path.join(paths.logs, 'desktop.log'), line, 'utf8');
  } catch (_) {}
}

function selectSaveRoot(win, options = {}) {
  return dialog.showOpenDialog(win || BrowserWindow.getFocusedWindow(), {
    title: 'Escolher pasta dos saves do HavenFall',
    buttonLabel: 'Usar esta pasta',
    properties: ['openDirectory', 'createDirectory']
  }).then(result => {
    if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true, paths: desktopPaths() };
    const before = desktopPaths();
    const nextRoot = ensureDir(result.filePaths[0]);
    const copy = options.migrate === false ? { copied: 0, skipped: 0 } : copySaveFiles(before.saves, nextRoot);
    const config = writeDesktopConfig({ saveRoot: nextRoot });
    const paths = desktopPaths();
    appendDesktopLog('save-root changed', { from: before.saves, to: paths.saves, ...copy });
    return { ok: true, canceled: false, config, paths, migration: copy };
  });
}

function resetSaveRoot(options = {}) {
  const before = desktopPaths();
  const defaultRoot = before.defaultSaves;
  const copy = options.migrate === false ? { copied: 0, skipped: 0 } : copySaveFiles(before.saves, defaultRoot);
  const current = readDesktopConfig();
  delete current.saveRoot;
  writeDesktopConfig(current);
  const paths = desktopPaths();
  appendDesktopLog('save-root reset', { from: before.saves, to: paths.saves, ...copy });
  return { ok: true, config: readDesktopConfig(), paths, migration: copy };
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
        { label: 'Escolher pasta de saves...', click: () => selectSaveRoot(win, { migrate: true }).then(() => win.webContents.send('havenfall:desktop-paths-changed', desktopPaths())) },
        { label: 'Restaurar pasta padrão de saves', click: () => { resetSaveRoot({ migrate: true }); win.webContents.send('havenfall:desktop-paths-changed', desktopPaths()); } },
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
    icon: fs.existsSync(windowIconPath) ? windowIconPath : undefined,
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

ipcMain.on('havenfall:desktop-paths', event => {
  event.returnValue = desktopPaths();
});

ipcMain.handle('havenfall:get-desktop-config', async () => ({
  ok: true,
  config: readDesktopConfig(),
  paths: desktopPaths()
}));

ipcMain.handle('havenfall:choose-save-root', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return selectSaveRoot(win, options);
});

ipcMain.handle('havenfall:reset-save-root', async (_event, options = {}) => resetSaveRoot(options));

ipcMain.handle('havenfall:open-path', async (_event, target) => {
  const paths = desktopPaths();
  const selected = target === 'logs' ? paths.logs : target === 'backups' ? paths.backups : target === 'userData' ? paths.userData : paths.saves;
  const result = await shell.openPath(selected);
  return { ok: !result, error: result || null, path: selected };
});

ipcMain.handle('havenfall:quit', () => {
  app.quit();
  return { ok: true };
});

app.whenReady().then(() => {
  appendDesktopLog('boot', { version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, paths: desktopPaths() });
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