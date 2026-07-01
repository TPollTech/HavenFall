'use strict';

let currentZoneTool = null;
let zoneDragActive = false;
let zoneDragStart = null;
let zoneDragEnd = null;

const zoneDefs = Object.freeze({
  storage: {
    label: 'Armazenamento',
    short: 'Estoque',
    hint: 'Madeira solta, recursos e itens úteis.',
    fill: 'rgba(99, 164, 255, .18)',
    stroke: 'rgba(99, 164, 255, .72)'
  },
  dumping: {
    label: 'Descarte / lixo',
    short: 'Descarte',
    hint: 'Área para lixo, carcaças e objetos indesejados.',
    fill: 'rgba(155, 128, 98, .20)',
    stroke: 'rgba(210, 160, 95, .76)'
  },
  home: {
    label: 'Casa / área base',
    short: 'Casa',
    hint: 'Área que representa a casa e o núcleo da colônia.',
    fill: 'rgba(112, 212, 146, .18)',
    stroke: 'rgba(112, 212, 146, .78)'
  },
  safe: {
    label: 'Área segura',
    short: 'Seguro',
    hint: 'Refúgio para colonos feridos, doentes ou em perigo.',
    fill: 'rgba(184, 138, 255, .18)',
    stroke: 'rgba(184, 138, 255, .78)'
  },
  priority: {
    label: 'Área prioritária',
    short: 'Prioridade',
    hint: 'Área de foco para trabalho e movimentação futura.',
    fill: 'rgba(245, 209, 92, .18)',
    stroke: 'rgba(245, 209, 92, .82)'
  }
});

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
    else if (zoneDefForOverlay(zoneType)) zones.grid[key] = zoneType;
    return true;
  },

  setZoneRect(startX, startY, endX, endY, zoneType) {
    const zones = this.ensureState();
    if (!zones) return 0;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    let changed = 0;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const before = this.getZoneAt(x, y);
        if (this.setZone(x, y, zoneType) && this.getZoneAt(x, y) !== before) changed++;
      }
    }
    return changed;
  },

  clearAll() {
    const zones = this.ensureState();
    if (!zones) return;
    zones.grid = {};
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

  count(type = null) {
    return this.entries(type).length;
  },

  counts() {
    const counts = {};
    for (const key of Object.keys(zoneDefs)) counts[key] = 0;
    const zones = this.ensureState();
    if (!zones) return counts;
    for (const type of Object.values(zones.grid)) {
      if (counts[type] !== undefined) counts[type]++;
    }
    return counts;
  },

  findFreeTile(type) {
    const tiles = this.entries(type);
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (getObjectAt(tile.x, tile.y)) continue;
      const reserved = state?.colonists?.some(c => c.task?.zoneType === type && c.task.zoneX === tile.x && c.task.zoneY === tile.y);
      if (!reserved) return { x: tile.x, y: tile.y };
    }
    return null;
  },

  findFreeStorageTile() {
    return this.findFreeTile('storage');
  },

  nearestTile(type, fromX, fromY) {
    const tiles = this.entries(type);
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (isBlocked(tile.x, tile.y)) continue;
      const d = dist(tile.x, tile.y, fromX, fromY);
      if (d < bestDist) {
        bestDist = d;
        best = { x: tile.x, y: tile.y };
      }
    }
    return best;
  }
};

window.zoneSystem = zoneSystem;

function zoneDefForOverlay(type) {
  return window.HavenfallZones?.getZoneDef?.(type) || zoneDefs[type] || null;
}

const unknownZoneDef = Object.freeze({
  label: 'Zona desconhecida',
  short: '?',
  hint: 'Tipo de zona salvo sem definição carregada.',
  fill: 'rgba(148, 163, 184, .16)',
  stroke: 'rgba(148, 163, 184, .72)'
});

function allZoneDefsForUi() {
  return window.HavenfallZones?.getAllZoneDefs?.() || zoneDefs;
}

function fallbackZoneDef(type) {
  return zoneDefForOverlay(type) || unknownZoneDef;
}

function zoneToolExists(tool) {
  return tool === 'none' || !!zoneDefForOverlay(tool) || !!allZoneDefsForUi()[tool];
}

function zoneLabel(type) {
  return zoneDefForOverlay(type)?.label || type || 'Sem zona';
}

function zoneToolLabel() {
  if (!currentZoneTool) return 'nenhuma ferramenta ativa';
  if (currentZoneTool === 'none') return 'apagando zonas';
  return `marcando ${zoneDefForOverlay(currentZoneTool)?.label?.toLowerCase() || currentZoneTool}`;
}

function clearZoneTool(reason = '') {
  if (!currentZoneTool && !zoneDragActive) return;
  currentZoneTool = null;
  clearZoneSelection();
  document.body.classList.remove('zone-brush-active');
  updateZonePanel();
  updateZonesModal();
  if (reason && typeof log === 'function') log(`Ferramenta de zona desativada${reason ? `: ${reason}` : ''}.`);
}

function installZonePanel() {
  const panel = document.querySelector('[data-panel="zones"]');
  if (!panel || panel.dataset.zonePanelReady === '1') return;
  panel.dataset.zonePanelReady = '1';
  panel.innerHTML = `
    <div class="panel-title-row">
      <div>
        <h2>Zonas</h2>
        <p class="panel-hint">Atalho rápido. O controle completo abre em modal para não entupir o rodapé.</p>
      </div>
      <button data-open-zones-modal>Gerenciar zonas</button>
    </div>
    <div class="zone-tool-row" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      ${zoneToolButtonsHtml()}
      <button data-zone-tool="none" class="secondary">Apagar</button>
      <button data-clear-zone-tool class="secondary">Desativar ferramenta</button>
    </div>
    <div id="zoneInfo" class="subtle-box">Nenhuma zona marcada ainda.</div>
  `;
}

function zoneToolButtonsHtml() {
  return Object.entries(allZoneDefsForUi()).map(([key, def]) => `<button data-zone-tool="${key}">${def.short}</button>`).join('');
}

function zoneCountCardsHtml() {
  const counts = zoneSystem.counts();
  return Object.entries(allZoneDefsForUi()).map(([key, def]) => `
    <div class="colonist-stat-card">
      <b>${def.label}</b>
      <span>${counts[key] || 0} tile${counts[key] === 1 ? '' : 's'}</span>
      <small style="display:block;margin-top:4px;color:#b8b0a0;">${def.hint}</small>
    </div>
  `).join('');
}

function updateZonePanel() {
  const info = document.getElementById('zoneInfo');
  if (!info || !state) return;
  const counts = zoneSystem.counts();
  info.innerHTML = `
    <b>Ferramenta:</b> ${zoneToolLabel()}<br>
    Estoque: ${counts.storage || 0} · Descarte: ${counts.dumping || 0} · Casa: ${counts.home || 0} · Seguro: ${counts.safe || 0} · Prioridade: ${counts.priority || 0}
  `;
  document.querySelectorAll('[data-zone-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.zoneTool === currentZoneTool));
}

function setZoneTool(tool) {
  if (!zoneToolExists(tool)) return;
  currentZoneTool = tool;
  currentBuild = null;
  clearZoneSelection();
  document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
  updateZonePanel();
  updateZonesModal();
  if (typeof updateUI === 'function') updateUI(true);
}

function ensureZonesModalStyles() {
  if (document.getElementById('zones-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'zones-modal-styles';
  style.textContent = `
    #zones-modal{background:rgba(2,4,8,.34);backdrop-filter:blur(2px);}
    #zones-modal .colonist-modal-card{pointer-events:auto;}
    .zones-modal-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;}
    .zones-modal-actions button.active,.zone-tool-row button.active{outline:2px solid #f5d15c;background:rgba(245,209,92,.16);}
    .zones-help-list{margin:10px 0 0;padding-left:18px;color:#b8b0a0;}
  `;
  document.head.appendChild(style);
}

function ensureZonesModalElement() {
  ensureZonesModalStyles();
  let modal = document.getElementById('zones-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'zones-modal';
  modal.className = 'game-modal-backdrop';
  modal.setAttribute('aria-hidden', 'true');
  document.body.appendChild(modal);
  modal.addEventListener('click', event => {
    if (event.target.closest('[data-close-zones-modal]')) closeZonesModal();
    const btn = event.target.closest('[data-zone-tool]');
    if (btn) {
      setZoneTool(btn.dataset.zoneTool);
      closeZonesModal({ preserveTool: true });
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const clear = event.target.closest('[data-clear-zone-tool]');
    if (clear) clearZoneTool('manual');
    const wipe = event.target.closest('[data-clear-all-zones]');
    if (wipe && confirm('Apagar todas as zonas marcadas?')) {
      zoneSystem.clearAll();
      updateZonePanel();
      updateZonesModal();
      if (typeof updateUI === 'function') updateUI(true);
    }
  });
  return modal;
}

function openZonesModal() {
  const modal = ensureZonesModalElement();
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  updateZonesModal();
  if (typeof updateUI === 'function') updateUI(true);
}

function closeZonesModal(options = {}) {
  const modal = document.getElementById('zones-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  if (!options.preserveTool) clearZoneTool();
  if (typeof updateUI === 'function') updateUI(true);
}

function updateZonesModal() {
  const modal = document.getElementById('zones-modal');
  if (!modal || !modal.classList.contains('show')) return;
  modal.innerHTML = `
    <article class="colonist-modal-card">
      <header class="colonist-modal-header">
        <div>
          <div class="kicker">Gerenciamento</div>
          <h3>Zonas da colônia</h3>
          <p class="empty">Escolha uma ferramenta e clique/arraste no mapa para marcar uma área inteira. Solte para confirmar.</p>
        </div>
        <button class="colonist-modal-close" data-close-zones-modal>Fechar</button>
      </header>
      <section class="colonist-modal-grid">${zoneCountCardsHtml()}</section>
      <div class="zones-modal-actions">
        ${zoneToolButtonsHtml()}
        <button data-zone-tool="none" class="secondary">Apagar zona</button>
        <button data-clear-zone-tool class="secondary">Desativar ferramenta</button>
        <button data-clear-all-zones class="danger">Apagar todas</button>
      </div>
      <div class="subtle-box"><b>Ferramenta ativa:</b> ${zoneToolLabel()}</div>
      <ul class="zones-help-list">
        <li><b>Como usar:</b> clique e arraste no mapa; soltar o mouse aplica a zona na área selecionada.</li>
        <li><b>Armazenamento:</b> recebe toras soltas automaticamente.</li>
        <li><b>Descarte:</b> reservada para lixo, carcaças e itens indesejados nas próximas simulações.</li>
        <li><b>Casa:</b> define o núcleo da base.</li>
        <li><b>Área segura:</b> colonos feridos/doentes podem buscar abrigo nela.</li>
        <li><b>Prioritária:</b> gancho para foco de trabalho e defesa.</li>
      </ul>
    </article>
  `;
  document.querySelectorAll('[data-zone-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.zoneTool === currentZoneTool));
}

function zoneTileFromEvent(event) {
  if (typeof tileFromEvent !== 'function') return null;
  const tile = tileFromEvent(event);
  if (!tile || !isInside(tile.x, tile.y)) return null;
  return tile;
}

function clearZoneSelection() {
  zoneDragActive = false;
  zoneDragStart = null;
  zoneDragEnd = null;
}

function updateZoneDragFromEvent(event) {
  const tile = zoneTileFromEvent(event);
  if (!tile) return false;
  zoneDragEnd = { x: tile.x, y: tile.y };
  if (typeof updateUI === 'function') updateUI(true);
  return true;
}

function beginZoneSelectionFromEvent(event) {
  if (!currentZoneTool || appScreen !== SCREEN.PLAYING || !state) return false;
  const tile = zoneTileFromEvent(event);
  if (!tile) return false;
  zoneDragActive = true;
  zoneDragStart = { x: tile.x, y: tile.y };
  zoneDragEnd = { x: tile.x, y: tile.y };
  if (typeof updateUI === 'function') updateUI(true);
  return true;
}

function zoneSelectionBounds() {
  if (!zoneDragStart || !zoneDragEnd) return null;
  return {
    minX: Math.min(zoneDragStart.x, zoneDragEnd.x),
    maxX: Math.max(zoneDragStart.x, zoneDragEnd.x),
    minY: Math.min(zoneDragStart.y, zoneDragEnd.y),
    maxY: Math.max(zoneDragStart.y, zoneDragEnd.y)
  };
}

function finishZoneSelectionFromEvent(event = null) {
  if (!zoneDragActive || !currentZoneTool) return false;
  const tool = currentZoneTool;
  if (event) updateZoneDragFromEvent(event);
  const bounds = zoneSelectionBounds();
  clearZoneSelection();
  if (!bounds) {
    currentZoneTool = null;
    document.body.classList.remove('zone-brush-active');
    updateZonePanel();
    updateZonesModal();
    if (typeof updateUI === 'function') updateUI(true);
    return false;
  }
  const changed = zoneSystem.setZoneRect(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY, tool);
  currentZoneTool = null;
  document.body.classList.remove('zone-brush-active');
  updateZonePanel();
  updateZonesModal();
  if (typeof updateUI === 'function') updateUI(true);
  return changed > 0;
}

function zonesModalOpen() {
  return document.getElementById('zones-modal')?.classList.contains('show') === true;
}

function shouldShowZonesOverlay() {
  return zoneDragActive || zonesModalOpen();
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
    if (beginZoneSelectionFromEvent(event)) {
      stopCanvasEvent(event);
    }
  }, true);

  canvas.addEventListener('mousemove', event => {
    if (!zoneDragActive || !currentZoneTool) return;
    if (updateZoneDragFromEvent(event)) stopCanvasEvent(event);
  }, true);

  canvas.addEventListener('mouseup', event => {
    if (!zoneDragActive) return;
    finishZoneSelectionFromEvent(event);
    stopCanvasEvent(event);
  }, true);

  window.addEventListener('mouseup', event => {
    if (!zoneDragActive) return;
    finishZoneSelectionFromEvent(event);
    stopCanvasEvent(event);
  }, true);

  canvas.addEventListener('click', event => {
    if (!currentZoneTool) return;
    stopCanvasEvent(event);
  }, true);
}

function installZoneButtons() {
  if (document.body.dataset.zoneButtonsReady === '1') return;
  document.body.dataset.zoneButtonsReady = '1';
  document.addEventListener('click', event => {
    const open = event.target.closest?.('[data-open-zones-modal]');
    if (open) {
      openZonesModal();
      return;
    }
    const clear = event.target.closest?.('[data-clear-zone-tool]');
    if (clear) {
      clearZoneTool('manual');
      return;
    }
    const btn = event.target.closest?.('[data-zone-tool]');
    if (!btn) return;
    setZoneTool(btn.dataset.zoneTool);
    if (btn.closest?.('#zones-modal')) closeZonesModal({ preserveTool: true });
  });
}

function drawZoneSelectionPreview() {
  const bounds = zoneSelectionBounds();
  if (!bounds || !currentZoneTool) return;
  const def = currentZoneTool === 'none'
    ? { fill: 'rgba(248, 113, 113, .14)', stroke: 'rgba(248, 113, 113, .86)' }
    : fallbackZoneDef(currentZoneTool);
  const x = bounds.minX * TILE;
  const y = bounds.minY * TILE;
  const w = (bounds.maxX - bounds.minX + 1) * TILE;
  const h = (bounds.maxY - bounds.minY + 1) * TILE;
  ctx.save();
  ctx.fillStyle = def.fill;
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.restore();
}

function drawZonesOverlay() {
  if (!state) return;
  const showExistingZones = shouldShowZonesOverlay() && zoneSystem.count() > 0;
  const showPreview = zoneDragActive && zoneDragStart && zoneDragEnd;
  if (!showExistingZones && !showPreview) return;
  ctx.save();
  ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
  ctx.scale(viewTransform.scale, viewTransform.scale);
  if (showExistingZones) {
    for (const tile of zoneSystem.entries()) {
      if (!isTileDiscovered(tile.x, tile.y)) continue;
      const def = fallbackZoneDef(tile.type);
      ctx.fillStyle = def.fill;
      ctx.strokeStyle = def.stroke;
      ctx.lineWidth = tile.type === 'allowed' ? 1 : 2;
      ctx.setLineDash(tile.type === 'home' ? [] : [5, 5]);
      ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
      ctx.strokeRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);
      if (tile.type === 'growing' && viewTransform.scale >= 0.55) {
        ctx.fillStyle = 'rgba(187,247,208,.78)';
        ctx.font = '900 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🌱', tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2 + 4);
      }
    }
  }
  if (showPreview) drawZoneSelectionPreview();
  ctx.restore();
}

function installZoneRendererHook() {
  if (window.HavenfallContext?.zoneRendererHooked) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.GameSystems?.registerDrawOverlay('zones', drawZonesOverlay, { order: 20 });
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

function handlePriorityValue(c) {
  if (typeof getColonistTaskPriority === 'function') return getColonistTaskPriority(c, 'handle');
  return 2;
}

function canAutoHandleZoneTask(c) {
  return handlePriorityValue(c) > 0;
}

function assignHaulTask(c, obj, storageTile) {
  if (!c || !obj || !storageTile || !canAutoHandleZoneTask(c)) return false;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
  obj.reservedBy = c.id;
  c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: storageTile.x, storageY: storageTile.y, zoneType: 'storage', zoneX: storageTile.x, zoneY: storageTile.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
  c.work = 0;
  c.note = 'Indo buscar toras soltas';
  return true;
}

function assignMoveToZone(c, type, note) {
  if (!c || c.task) return false;
  const tile = zoneSystem.nearestTile(type, c.x, c.y);
  if (!tile) return false;
  c.task = { type: 'move', x: tile.x, y: tile.y, zoneType: type, zoneX: tile.x, zoneY: tile.y };
  c.path = findPath(c.x, c.y, tile.x, tile.y);
  c.note = note || `Indo para ${zoneLabel(type)}`;
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

function updateZoneBehaviors() {
  if (!state || appScreen !== SCREEN.PLAYING) return;

  for (const c of state.colonists || []) {
    if (processHaulTask(c)) continue;
  }

  for (const c of state.colonists || []) {
    if (c.task || c.energy < 18 || c.health < 20) continue;

    if ((c.health < 38 || c.statuses?.includes('gripe') || c.statuses?.includes('hipotermia')) && assignMoveToZone(c, 'safe', 'Buscando área segura')) continue;

    const target = canAutoHandleZoneTask(c) && zoneSystem.count('storage') ? findLooseHaulTarget() : null;
    if (target) {
      const storageTile = zoneSystem.findFreeStorageTile();
      if (storageTile && assignHaulTask(c, target, storageTile)) continue;
    }

    if (c.mood < 22 && assignMoveToZone(c, 'home', 'Voltando para casa')) continue;
  }
}

function updateZonesTick() {
  installZonePanel();
  updateZonePanel();
  updateZonesModal();
  updateZoneBehaviors();
}

installZonePanel();
installZoneButtons();
installZoneInput();
installZoneRendererHook();
ensureZonesModalElement();
window.GameSystems?.registerTick('zones', updateZonesTick, { order: 90 });
