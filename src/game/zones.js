'use strict';

let currentZoneTool = null;
let zoneDragActive = false;

const zoneSystem = {
  ensureState() {
    if (!state) return null;
    state.zones = state.zones || { grid: {} };
    state.zones.grid = state.zones.grid || {};
    return state.zones;
  },

  key(x, y) {
    return String((x << 16) | y);
  },

  decode(key) {
    const raw = Number(key);
    return { x: raw >> 16, y: raw & 0xFFFF };
  },

  setZone(x, y, zoneType) {
    const zones = this.ensureState();
    if (!zones || !isInside(x, y) || !isTileDiscovered(x, y)) return false;
    const key = this.key(x, y);
    if (!zoneType || zoneType === 'none') delete zones.grid[key];
    else zones.grid[key] = zoneType;
    return true;
  },

  getZoneAt(x, y) {
    const zones = this.ensureState();
    if (!zones) return null;
    return zones.grid[this.key(x, y)] || null;
  },

  entries(type = null) {
    const zones = this.ensureState();
    if (!zones) return [];
    const out = [];
    for (const [key, zoneType] of Object.entries(zones.grid)) {
      if (type && zoneType !== type) continue;
      const pos = this.decode(key);
      out.push({ ...pos, type: zoneType });
    }
    return out;
  },

  findFreeStorageTile() {
    const tiles = this.entries('storage');
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (getObjectAt(tile.x, tile.y)) continue;
      const reserved = state?.colonists?.some(c => c.task?.type === 'haul' && c.task.storageX === tile.x && c.task.storageY === tile.y);
      if (!reserved) return { x: tile.x, y: tile.y };
    }
    return null;
  },

  count(type = null) {
    return this.entries(type).length;
  }
};

window.zoneSystem = zoneSystem;

function installZonePanel() {
  const panel = document.querySelector('[data-panel="zones"]');
  if (!panel || panel.dataset.zonePanelReady === '1') return;
  panel.dataset.zonePanelReady = '1';
  panel.innerHTML = `
    <div class="panel-title-row">
      <div>
        <h2>Zonas</h2>
        <p class="panel-hint">Marque áreas de armazenamento. Colonos ociosos levam toras soltas para essas zonas.</p>
      </div>
    </div>
    <div class="zone-tool-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <button data-zone-tool="storage">Zona de armazenamento</button>
      <button data-zone-tool="none" class="secondary">Apagar zona</button>
    </div>
    <div id="zoneInfo" class="subtle-box">Nenhuma zona marcada ainda.</div>
  `;
}

function updateZonePanel() {
  const info = document.getElementById('zoneInfo');
  if (!info || !state) return;
  const storageCount = zoneSystem.count('storage');
  const toolLabel = currentZoneTool === 'storage' ? 'marcando armazenamento' : currentZoneTool === 'none' ? 'apagando zonas' : 'nenhuma ferramenta ativa';
  info.innerHTML = `<b>Armazenamento:</b> ${storageCount} tile${storageCount === 1 ? '' : 's'} · <b>Ferramenta:</b> ${toolLabel}`;
  document.querySelectorAll('[data-zone-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.zoneTool === currentZoneTool));
}

function setZoneTool(tool) {
  currentZoneTool = currentZoneTool === tool ? null : tool;
  currentBuild = null;
  updateZonePanel();
  if (typeof updateUI === 'function') updateUI(true);
}

function zoneTileFromEvent(event) {
  if (typeof tileFromEvent !== 'function') return null;
  const tile = tileFromEvent(event);
  if (!tile || !isInside(tile.x, tile.y)) return null;
  return tile;
}

function paintZoneFromEvent(event) {
  if (!currentZoneTool || appScreen !== SCREEN.PLAYING || !state) return false;
  const tile = zoneTileFromEvent(event);
  if (!tile) return false;
  const changed = zoneSystem.setZone(tile.x, tile.y, currentZoneTool);
  if (changed) updateZonePanel();
  return changed;
}

function stopCanvasEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function installZoneInput() {
  if (!canvas || canvas.dataset.zoneInputReady === '1') return;
  canvas.dataset.zoneInputReady = '1';

  canvas.addEventListener('mousedown', event => {
    if (event.button !== 0 || !currentZoneTool) return;
    if (paintZoneFromEvent(event)) {
      zoneDragActive = true;
      stopCanvasEvent(event);
    }
  }, true);

  canvas.addEventListener('mousemove', event => {
    if (!zoneDragActive || !currentZoneTool) return;
    if (paintZoneFromEvent(event)) stopCanvasEvent(event);
  }, true);

  canvas.addEventListener('mouseup', event => {
    if (!zoneDragActive) return;
    zoneDragActive = false;
    stopCanvasEvent(event);
    if (typeof updateUI === 'function') updateUI(true);
  }, true);

  canvas.addEventListener('click', event => {
    if (!currentZoneTool) return;
    stopCanvasEvent(event);
  }, true);

  canvas.addEventListener('mouseleave', () => { zoneDragActive = false; }, true);
}

function installZoneButtons() {
  if (document.body.dataset.zoneButtonsReady === '1') return;
  document.body.dataset.zoneButtonsReady = '1';
  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-zone-tool]');
    if (!btn) return;
    setZoneTool(btn.dataset.zoneTool);
  });
}

function drawZonesOverlay() {
  if (!state || !zoneSystem.count()) return;
  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);
  for (const tile of zoneSystem.entries()) {
    if (!isTileDiscovered(tile.x, tile.y)) continue;
    ctx.fillStyle = tile.type === 'storage' ? 'rgba(99, 164, 255, .18)' : 'rgba(255,255,255,.10)';
    ctx.strokeStyle = tile.type === 'storage' ? 'rgba(99, 164, 255, .72)' : 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
    ctx.strokeRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);
  }
  ctx.restore();
}

function installZoneRendererHook() {
  if (window.HavenfallContext?.zoneRendererHooked || typeof draw !== 'function') return;
  window.HavenfallContext = window.HavenfallContext || {};
  const nativeDraw = draw;
  draw = function drawWithZones() {
    nativeDraw();
    drawZonesOverlay();
  };
  window.HavenfallContext.zoneRendererHooked = true;
}

function findLooseHaulTarget() {
  if (!state?.objects) return null;
  let best = null;
  for (let i = 0; i < state.objects.length; i++) {
    const obj = state.objects[i];
    if (obj.type !== 'logs' || obj.reservedBy) continue;
    if (!isTileDiscovered(obj.x, obj.y)) continue;
    best = obj;
    break;
  }
  return best;
}

function assignHaulTask(c, obj, storageTile) {
  if (!c || !obj || !storageTile) return false;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
  obj.reservedBy = c.id;
  c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: storageTile.x, storageY: storageTile.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
  c.work = 0;
  c.note = 'Indo buscar toras soltas';
  return true;
}

function processHaulTask(c) {
  if (!c?.task || c.task.type !== 'haul') return false;
  if (c.path?.length) return true;

  const task = c.task;
  if (task.phase === 'pickup') {
    const obj = state.objects.find(o => o.id === task.objId);
    if (!obj) { c.task = null; c.note = 'Ocioso'; return true; }
    c.carrying = { resource: 'wood', amount: 5, label: 'toras' };
    state.objects = state.objects.filter(o => o.id !== obj.id);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    task.phase = 'dropoff';
    task.x = task.storageX;
    task.y = task.storageY;
    c.path = findPath(c.x, c.y, task.storageX, task.storageY);
    c.note = 'Levando toras ao armazenamento';
    return true;
  }

  if (task.phase === 'dropoff') {
    const cargo = c.carrying;
    if (cargo?.resource && cargo.amount) addResources({ [cargo.resource]: cargo.amount });
    log(`${c.name} levou ${cargo?.amount || 0} madeira para a zona de armazenamento.`);
    c.carrying = null;
    c.task = null;
    c.work = 0;
    c.note = 'Ocioso';
    return true;
  }

  return false;
}

function updateZonesTick() {
  installZonePanel();
  updateZonePanel();
  if (!state || appScreen !== SCREEN.PLAYING) return;

  for (const c of state.colonists || []) {
    if (processHaulTask(c)) continue;
  }

  if (!zoneSystem.count('storage')) return;
  for (const c of state.colonists || []) {
    if (c.task || c.energy < 18 || c.health < 20) continue;
    const target = findLooseHaulTarget();
    if (!target) return;
    const storageTile = zoneSystem.findFreeStorageTile();
    if (!storageTile) return;
    assignHaulTask(c, target, storageTile);
  }
}

installZonePanel();
installZoneButtons();
installZoneInput();
installZoneRendererHook();
