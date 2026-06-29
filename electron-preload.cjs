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

const basePath = userDataPath();
const paths = Object.freeze({
  userData: basePath,
  saves: ensureDir(path.join(basePath, 'saves')),
  backups: ensureDir(path.join(basePath, 'backups')),
  logs: ensureDir(path.join(basePath, 'logs'))
});

function savePath(slot = 'autosave') {
  return path.join(paths.saves, `${cleanSlot(slot)}.json`);
}

function metaPath(slot = 'autosave') {
  return path.join(paths.saves, `${cleanSlot(slot)}.meta.json`);
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
    return { ok: true, slot: clean, path: file, updatedAt };
  } catch (error) {
    appendLog('writeSaveSlot failed', { slot, error: error.message });
    return { ok: false, error: error.message };
  }
}

function readSaveSlot(slot = 'autosave') {
  try {
    const clean = cleanSlot(slot);
    const file = savePath(clean);
    if (!fs.existsSync(file)) return { ok: false, exists: false, slot: clean, path: file };
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
      bytes: stat.size
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
    if (!fs.existsSync(file)) return { ok: true, exists: false, slot: clean, path: file };
    const stat = fs.statSync(file);
    const meta = readJsonSafe(metaPath(clean), {});
    return {
      ok: true,
      exists: true,
      slot: clean,
      path: file,
      updatedAt: meta.updatedAt || stat.mtime.toISOString(),
      updatedAtMs: Number(meta.updatedAtMs || stat.mtimeMs || 0),
      bytes: stat.size
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
    const file = path.join(paths.backups, `${clean}-${String(label).replace(/[^a-zA-Z0-9_-]/g, '')}-${stamp}.json`);
    atomicWrite(file, current.text);
    return { ok: true, path: file };
  } catch (error) {
    appendLog('backupSaveSlot failed', { slot, error: error.message });
    return { ok: false, error: error.message };
  }
}

function listSaves() {
  try {
    const files = fs.readdirSync(paths.saves).filter(file => file.endsWith('.json') && !file.endsWith('.meta.json'));
    return {
      ok: true,
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
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(paths.logs, `diagnostics-${stamp}.json`);
    writeJson(file, {
      createdAt: new Date().toISOString(),
      platform: process.platform,
      versions: process.versions,
      payload
    });
    return { ok: true, path: file };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

contextBridge.exposeInMainWorld('HavenfallDesktop', Object.freeze({
  isElectron: true,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }),
  paths,
  getSaveInfo,
  readSaveSlot,
  writeSaveSlot,
  backupSaveSlot,
  listSaves,
  appendLog,
  exportDiagnostics,
  openFolder(target = 'saves') { return ipcRenderer.invoke('havenfall:open-path', target); },
  quit() { return ipcRenderer.invoke('havenfall:quit'); }
}));
