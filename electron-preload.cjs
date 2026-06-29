'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanSlot(slot) {
  return String(slot || 'autosave').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'autosave';
}

function userDataPath() {
  return ipcRenderer.sendSync('havenfall:user-data-path');
}

function getDesktopPaths() {
  const paths = ipcRenderer.sendSync('havenfall:desktop-paths');
  ensureDir(paths.saves);
  ensureDir(paths.backups);
  ensureDir(paths.logs);
  return paths;
}

function savePath(slot = 'autosave') {
  return path.join(getDesktopPaths().saves, `${cleanSlot(slot)}.json`);
}

function metaPath(slot = 'autosave') {
  return path.join(getDesktopPaths().saves, `${cleanSlot(slot)}.meta.json`);
}

function atomicWrite(file, content) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function readJsonSafe(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  atomicWrite(file, JSON.stringify(data, null, 2));
}

function appendLog(message, details = null) {
  try {
    const paths = getDesktopPaths();
    const line = `[${new Date().toISOString()}] ${message}${details ? ` ${JSON.stringify(details)}` : ''}\n`;
    fs.appendFileSync(path.join(paths.logs, 'renderer.log'), line, 'utf8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function writeSaveSlot(slot, text, metadata = {}) {
  try {
    const clean = cleanSlot(slot);
    const file = savePath(clean);
    const updatedAt = new Date().toISOString();
    atomicWrite(file, String(text || ''));
    writeJson(metaPath(clean), {
      slot: clean,
      updatedAt,
      updatedAtMs: Date.now(),
      bytes: Buffer.byteLength(String(text || ''), 'utf8'),
      ...metadata
    });
    return { ok: true, slot: clean, path: file, updatedAt, paths: getDesktopPaths() };
  } catch (error) {
    appendLog('writeSaveSlot failed', { slot, error: error.message });
    return { ok: false, error: error.message };
  }
}

function readSaveSlot(slot = 'autosave') {
  try {
    const clean = cleanSlot(slot);
    const file = savePath(clean);
    if (!fs.existsSync(file)) return { ok: false, exists: false, slot: clean, path: file, paths: getDesktopPaths() };
    const text = fs.readFileSync(file, 'utf8');
    const stat = fs.statSync(file);
    const meta = readJsonSafe(metaPath(clean), {});
    return {
      ok: true,
      exists: true,
      slot: clean,
      path: file,
      text,
      updatedAt: meta.updatedAt || stat.mtime.toISOString(),
      updatedAtMs: Number(meta.updatedAtMs || stat.mtimeMs || 0),
      bytes: stat.size,
      paths: getDesktopPaths()
    };
  } catch (error) {
    appendLog('readSaveSlot failed', { slot, error: error.message });
    return { ok: false, exists: false, error: error.message };
  }
}

function getSaveInfo(slot = 'autosave') {
  try {
    const clean = cleanSlot(slot);
    const file = savePath(clean);
    if (!fs.existsSync(file)) return { ok: true, exists: false, slot: clean, path: file, paths: getDesktopPaths() };
    const stat = fs.statSync(file);
    const meta = readJsonSafe(metaPath(clean), {});
    return {
      ok: true,
      exists: true,
      slot: clean,
      path: file,
      updatedAt: meta.updatedAt || stat.mtime.toISOString(),
      updatedAtMs: Number(meta.updatedAtMs || stat.mtimeMs || 0),
      bytes: stat.size,
      paths: getDesktopPaths()
    };
  } catch (error) {
    return { ok: false, exists: false, error: error.message };
  }
}

function backupSaveSlot(slot = 'autosave', label = 'manual') {
  try {
    const current = readSaveSlot(slot);
    if (!current.ok || !current.exists) return { ok: false, error: 'save inexistente' };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const clean = cleanSlot(slot);
    const file = path.join(getDesktopPaths().backups, `${clean}-${String(label).replace(/[^a-zA-Z0-9_-]/g, '')}-${stamp}.json`);
    atomicWrite(file, current.text);
    return { ok: true, path: file };
  } catch (error) {
    appendLog('backupSaveSlot failed', { slot, error: error.message });
    return { ok: false, error: error.message };
  }
}

function deleteSaveSlot(slot = 'autosave') {
  try {
    const clean = cleanSlot(slot);
    const files = [savePath(clean), metaPath(clean)];
    let deleted = 0;
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        deleted++;
      }
    }
    appendLog('deleteSaveSlot', { slot: clean, deleted });
    return { ok: true, slot: clean, deleted, paths: getDesktopPaths() };
  } catch (error) {
    appendLog('deleteSaveSlot failed', { slot, error: error.message });
    return { ok: false, error: error.message };
  }
}

function listSaves() {
  try {
    const paths = getDesktopPaths();
    const files = fs.readdirSync(paths.saves).filter(file => file.endsWith('.json') && !file.endsWith('.meta.json'));
    return {
      ok: true,
      paths,
      saves: files.map(file => {
        const full = path.join(paths.saves, file);
        const stat = fs.statSync(full);
        const slot = file.replace(/\.json$/i, '');
        const meta = readJsonSafe(metaPath(slot), {});
        return {
          slot,
          path: full,
          bytes: stat.size,
          updatedAt: meta.updatedAt || stat.mtime.toISOString(),
          updatedAtMs: Number(meta.updatedAtMs || stat.mtimeMs || 0)
        };
      }).sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    };
  } catch (error) {
    return { ok: false, saves: [], error: error.message };
  }
}

function exportDiagnostics(payload = {}) {
  try {
    const paths = getDesktopPaths();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(paths.logs, `diagnostics-${stamp}.json`);
    writeJson(file, {
      createdAt: new Date().toISOString(),
      platform: process.platform,
      versions: process.versions,
      paths,
      payload
    });
    return { ok: true, path: file };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const desktopApi = {
  isElectron: true,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }),
  paths: getDesktopPaths(),
  userDataPath,
  getDesktopPaths,
  getDesktopConfig() { return ipcRenderer.invoke('havenfall:get-desktop-config'); },
  chooseSaveFolder(options = { migrate: true }) { return ipcRenderer.invoke('havenfall:choose-save-root', options); },
  resetSaveFolder(options = { migrate: true }) { return ipcRenderer.invoke('havenfall:reset-save-root', options); },
  onDesktopPathsChanged(callback) {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, paths) => callback(paths);
    ipcRenderer.on('havenfall:desktop-paths-changed', listener);
    return () => ipcRenderer.removeListener('havenfall:desktop-paths-changed', listener);
  },
  getSaveInfo,
  readSaveSlot,
  writeSaveSlot,
  backupSaveSlot,
  deleteSaveSlot,
  listSaves,
  appendLog,
  exportDiagnostics,
  openFolder(target = 'saves') { return ipcRenderer.invoke('havenfall:open-path', target); },
  quit() { return ipcRenderer.invoke('havenfall:quit'); }
};

contextBridge.exposeInMainWorld('HavenfallDesktop', Object.freeze(desktopApi));