'use strict';

(() => {
  if (window.HavenfallContext?.advancedZonesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.advancedZonesInstalled = true;

  const advancedZoneDefs = Object.freeze({
    growing: {
      label: 'Zona de cultivo',
      short: 'Cultivo',
      hint: 'Área onde colonos plantam a cultura escolhida.',
      fill: 'rgba(74, 222, 128, .16)',
      stroke: 'rgba(74, 222, 128, .82)'
    },
    allowed: {
      label: 'Área permitida',
      short: 'Permitida',
      hint: 'Quando existe, colonos tentam permanecer dentro dela.',
      fill: 'rgba(56, 189, 248, .12)',
      stroke: 'rgba(56, 189, 248, .72)'
    }
  });

  const storageFilterDefs = Object.freeze({
    wood: { label: 'Madeira', accepts: ['wood'] },
    stone: { label: 'Pedra', accepts: ['stone'] },
    metal: { label: 'Metal', accepts: ['metal'] },
    food: { label: 'Comida', accepts: ['food'] },
    medicine: { label: 'Remédio', accepts: ['medicine'] },
    items: { label: 'Itens', accepts: ['item'] }
  });

  const cropDefs = Object.freeze({
    food: { label: 'Comida básica', buildType: 'crop', seedCost: { food: 1 }, note: 'Produz alimento genérico.' },
    berries: { label: 'Bagas', buildType: 'crop', seedCost: { food: 1 }, note: 'Variante visual/narrativa de alimento.' }
  });

  const baseZoneDefs = typeof zoneDefs !== 'undefined' ? zoneDefs : {};
  const allZoneDefs = () => ({ ...baseZoneDefs, ...advancedZoneDefs });

  const nativeEnsureState = zoneSystem.ensureState.bind(zoneSystem);
  zoneSystem.ensureState = function ensureAdvancedZoneState() {
    const zones = nativeEnsureState();
    if (!zones) return null;
    zones.grid = zones.grid || {};
    zones.storageFilters = zones.storageFilters || { wood: true, stone: true, metal: true, food: true, medicine: true, items: true };
    zones.growing = zones.growing || { cropType: 'food' };
    return zones;
  };

  zoneSystem.setZone = function setAdvancedZone(x, y, zoneType) {
    const zones = this.ensureState();
    if (!zones || !isInside(x, y) || !isTileDiscovered(x, y)) return false;
    const key = this.key(x, y);
    if (!zoneType || zoneType === 'none') delete zones.grid[key];
    else if (allZoneDefs()[zoneType]) zones.grid[key] = zoneType;
    else return false;
    return true;
  };

  zoneSystem.counts = function advancedZoneCounts() {
    const counts = {};
    for (const key of Object.keys(allZoneDefs())) counts[key] = 0;
    const zones = this.ensureState();
    if (!zones) return counts;
    for (const type of Object.values(zones.grid)) counts[type] = (counts[type] || 0) + 1;
    return counts;
  };

  zoneSystem.findFreeTile = function findFreeAdvancedZoneTile(type, predicate = null) {
    const tiles = this.entries(type);
    for (const tile of tiles) {
      if (getObjectAt(tile.x, tile.y)) continue;
      if (predicate && !predicate(tile)) continue;
      const reserved = state?.colonists?.some(c => c.task?.zoneType === type && c.task.zoneX === tile.x && c.task.zoneY === tile.y);
      if (!reserved) return { x: tile.x, y: tile.y };
    }
    return null;
  };

  zoneSystem.hasAllowedArea = function hasAllowedArea() {
    return this.count('allowed') > 0;
  };

  zoneSystem.isTileAllowed = function isTileAllowed(x, y) {
    if (!this.hasAllowedArea()) return true;
    const type = this.getZoneAt(x, y);
    return type === 'allowed' || type === 'home' || type === 'safe';
  };

  zoneSystem.findFreeStorageTileFor = function findFreeStorageTileFor(obj) {
    return this.findFreeTile('storage', () => storageAcceptsObject(obj));
  };

  zoneSystem.findFreeDumpingTile = function findFreeDumpingTile() {
    return this.findFreeTile('dumping');
  };

  zoneSystem.findFreeGrowingTile = function findFreeGrowingTile() {
    return this.findFreeTile('growing', tile => !isBlocked(tile.x, tile.y));
  };

  function zoneDefFor(type) {
    return allZoneDefs()[type] || baseZoneDefs.storage;
  }

  function resourceCategoryForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'rubble') return 'debris';
    if (obj.type === 'logs') return 'wood';
    if (obj.type === 'berry' || obj.type === 'crop') return 'food';
    if (obj.type === 'rock') return 'stone';
    if (obj.type === 'ore') return 'metal';
    if (obj.itemKey) return 'item';
    return null;
  }

  function storageAcceptsObject(obj) {
    const zones = zoneSystem.ensureState();
    const category = resourceCategoryForObject(obj);
    if (!category || category === 'debris') return false;
    const filters = zones?.storageFilters || {};
    if (category === 'item') return filters.items !== false;
    return filters[category] !== false;
  }

  function cargoForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'rubble') return { kind: 'debris', label: 'entulho', amount: 1 };
    if (obj.type === 'logs') return { resource: 'wood', amount: Number(obj.amount || 5), label: 'toras' };
    if (obj.itemKey) return { item: obj.itemKey, amount: Number(obj.amount || 1), label: itemDefs?.[obj.itemKey]?.label || obj.itemKey };
    return null;
  }

  function destinationForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'rubble') {
      const tile = zoneSystem.findFreeDumpingTile();
      return tile ? { ...tile, type: 'dumping' } : null;
    }
    if (storageAcceptsObject(obj)) {
      const tile = zoneSystem.findFreeStorageTileFor(obj);
      return tile ? { ...tile, type: 'storage' } : null;
    }
    return null;
  }

  function setStorageFilter(key, enabled) {
    const zones = zoneSystem.ensureState();
    if (!zones || !storageFilterDefs[key]) return;
    zones.storageFilters[key] = !!enabled;
    updateZonePanel?.();
    updateZonesModal?.();
    if (typeof updateUI === 'function') updateUI(true);
  }

  function setGrowingCrop(cropType) {
    const zones = zoneSystem.ensureState();
    if (!zones || !cropDefs[cropType]) return;
    zones.growing.cropType = cropType;
    updateZonePanel?.();
    updateZonesModal?.();
    if (typeof updateUI === 'function') updateUI(true);
  }

  zoneToolButtonsHtml = function advancedZoneToolButtonsHtml() {
    return Object.entries(allZoneDefs()).map(([key, def]) => `<button data-zone-tool="${key}">${def.short}</button>`).join('');
  };

  zoneLabel = function advancedZoneLabel(type) {
    return allZoneDefs()[type]?.label || type || 'Sem zona';
  };

  updateZonePanel = function advancedUpdateZonePanel() {
    const info = document.getElementById('zoneInfo');
    if (!info || !state) return;
    const counts = zoneSystem.counts();
    const zones = zoneSystem.ensureState();
    const crop = cropDefs[zones?.growing?.cropType || 'food']?.label || 'Comida básica';
    info.innerHTML = `
      <b>Ferramenta:</b> ${zoneToolLabel()}<br>
      Estoque: ${counts.storage || 0} · Descarte: ${counts.dumping || 0} · Cultivo: ${counts.growing || 0} · Permitida: ${counts.allowed || 0} · Casa: ${counts.home || 0}<br>
      <small>Filtros do estoque: ${storageFilterSummary()} · Cultura: ${escapeHtml(crop)}</small>
    `;
    document.querySelectorAll('[data-zone-tool]').forEach(btn => btn.classList.toggle('active', btn.dataset.zoneTool === currentZoneTool));
  };

  zoneCountCardsHtml = function advancedZoneCountCardsHtml() {
    const counts = zoneSystem.counts();
    return Object.entries(allZoneDefs()).map(([key, def]) => `
      <div class="colonist-stat-card">
        <b>${def.label}</b>
        <span>${counts[key] || 0} tile${counts[key] === 1 ? '' : 's'}</span>
        <small style="display:block;margin-top:4px;color:#b8b0a0;">${def.hint}</small>
      </div>
    `).join('');
  };

  const nativeEnsureZonesModalElement = ensureZonesModalElement;
  ensureZonesModalElement = function advancedEnsureZonesModalElement() {
    const modal = nativeEnsureZonesModalElement();
    if (modal.dataset.advancedZoneControlsReady === '1') return modal;
    modal.dataset.advancedZoneControlsReady = '1';
    modal.addEventListener('change', event => {
      const filter = event.target.closest?.('[data-storage-filter]');
      if (filter) {
        setStorageFilter(filter.dataset.storageFilter, filter.checked);
        return;
      }
      const crop = event.target.closest?.('[data-growing-crop]');
      if (crop) setGrowingCrop(crop.value);
    });
    return modal;
  };

  updateZonesModal = function advancedUpdateZonesModal() {
    const modal = document.getElementById('zones-modal');
    if (!modal || !modal.classList.contains('show')) return;
    modal.innerHTML = `
      <article class="colonist-modal-card">
        <header class="colonist-modal-header">
          <div>
            <div class="kicker">Gerenciamento</div>
            <h3>Zonas da colônia</h3>
            <p class="empty">Pinte áreas funcionais. Estoque e descarte já alimentam a logística automática.</p>
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
        ${zoneAdvancedControlsHtml()}
        <ul class="zones-help-list">
          <li><b>Estoque:</b> recebe toras e itens soltos respeitando filtros.</li>
          <li><b>Descarte:</b> recebe entulho gerado por desconstrução.</li>
          <li><b>Cultivo:</b> colonos com Manusear ativo plantam a cultura selecionada.</li>
          <li><b>Área permitida:</b> se existir, movimentos e tarefas automáticas tentam ficar dentro dela.</li>
          <li><b>Casa:</b> vira ponto de retorno em mau tempo, cansaço e baixa moral.</li>
        </ul>
      </article>
    `;
    document.querySelectorAll('[data-zone-tool]').forEach(btn => btn.classList.toggle('active', btn.datasetZoneTool === currentZoneTool || btn.dataset.zoneTool === currentZoneTool));
  };

  function storageFilterSummary() {
    const zones = zoneSystem.ensureState();
    const filters = zones?.storageFilters || {};
    return Object.entries(storageFilterDefs).filter(([key]) => filters[key] !== false).map(([, def]) => def.label).join(', ') || 'nenhum';
  }

  function zoneAdvancedControlsHtml() {
    const zones = zoneSystem.ensureState();
    const filters = zones?.storageFilters || {};
    const crop = zones?.growing?.cropType || 'food';
    return `<div class="zones-advanced-controls">
      <div class="subtle-box">
        <b>Filtros da Stockpile</b>
        <div class="zone-filter-grid">
          ${Object.entries(storageFilterDefs).map(([key, def]) => `<label><input type="checkbox" data-storage-filter="${key}" ${filters[key] !== false ? 'checked' : ''}> ${def.label}</label>`).join('')}
        </div>
      </div>
      <div class="subtle-box">
        <b>Cultura da Growing Zone</b>
        <select data-growing-crop>
          ${Object.entries(cropDefs).map(([key, def]) => `<option value="${key}" ${crop === key ? 'selected' : ''}>${def.label}</option>`).join('')}
        </select>
        <small style="display:block;margin-top:6px;color:#b8b0a0;">${escapeHtml(cropDefs[crop]?.note || '')}</small>
      </div>
    </div>`;
  }

  const nativeEnsureZonesModalStyles = ensureZonesModalStyles;
  ensureZonesModalStyles = function advancedEnsureZonesModalStyles() {
    nativeEnsureZonesModalStyles();
    if (document.getElementById('advanced-zones-style')) return;
    const style = document.createElement('style');
    style.id = 'advanced-zones-style';
    style.textContent = `
      .zones-advanced-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0;}
      .zone-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-top:8px;}
      .zone-filter-grid label{font-size:12px;color:#ddd6c5;}
      [data-growing-crop]{width:100%;margin-top:8px;background:#111827;color:#f4efe4;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;}
    `;
    document.head.appendChild(style);
  };

  const nativeAssignMove = typeof assignMove === 'function' ? assignMove : null;
  if (nativeAssignMove) {
    assignMove = function assignMoveWithAllowedArea(c, x, y) {
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(x, y)) {
        log(`${c?.name || 'Colono'} não pode sair da área permitida.`);
        return false;
      }
      return nativeAssignMove(c, x, y);
    };
  }

  findLooseHaulTarget = function advancedFindLooseHaulTarget() {
    if (!state?.objects) return null;
    for (const obj of state.objects) {
      if (obj.reservedBy) continue;
      if (!isTileDiscovered(obj.x, obj.y)) continue;
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(obj.x, obj.y)) continue;
      const destination = destinationForObject(obj);
      if (!destination) continue;
      return obj;
    }
    return null;
  };

  assignHaulTask = function advancedAssignHaulTask(c, obj, storageTile = null) {
    if (!c || !obj || !canAutoHandleZoneTask(c)) return false;
    const destination = storageTile ? { ...storageTile, type: storageTile.type || 'storage' } : destinationForObject(obj);
    if (!destination) return false;
    if (zoneSystem.hasAllowedArea?.() && (!zoneSystem.isTileAllowed?.(obj.x, obj.y) || !zoneSystem.isTileAllowed?.(destination.x, destination.y))) return false;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
    obj.reservedBy = c.id;
    c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: destination.x, storageY: destination.y, zoneType: destination.type, zoneX: destination.x, zoneY: destination.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
    c.work = 0;
    c.note = destination.type === 'dumping' ? 'Indo recolher entulho' : 'Indo buscar item solto';
    return true;
  };

  processHaulTask = function advancedProcessHaulTask(c) {
    if (!c?.task || c.task.type !== 'haul') return false;
    if (c.path?.length) return true;
    const task = c.task;
    if (task.phase === 'pickup') {
      const obj = state.objects.find(o => o.id === task.objId);
      if (!obj) { c.task = null; c.note = 'Ocioso'; return true; }
      c.carrying = cargoForObject(obj);
      state.objects = state.objects.filter(o => o.id !== obj.id);
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      task.phase = 'dropoff';
      task.x = task.storageX;
      task.y = task.storageY;
      c.path = findPath(c.x, c.y, task.storageX, task.storageY);
      c.note = task.zoneType === 'dumping' ? 'Levando entulho ao descarte' : 'Levando item ao estoque';
      return true;
    }
    if (task.phase === 'dropoff') {
      const cargo = c.carrying;
      if (task.zoneType === 'dumping' || cargo?.kind === 'debris') {
        log(`${c.name} descartou ${cargo?.label || 'entulho'} na zona de descarte.`);
      } else {
        if (cargo?.resource && cargo.amount) addResources({ [cargo.resource]: cargo.amount });
        if (cargo?.item && cargo.amount && typeof addItems === 'function') addItems({ [cargo.item]: cargo.amount });
        log(`${c.name} levou ${cargo?.amount || 0} ${cargo?.label || 'item'} para a zona de armazenamento.`);
      }
      c.carrying = null;
      c.task = null;
      c.work = 0;
      c.note = 'Ocioso';
      return true;
    }
    return false;
  };

  function canPlantInTile(tile) {
    if (!tile || isBlocked(tile.x, tile.y) || getObjectAt(tile.x, tile.y)) return false;
    const terrain = state?.terrain?.[tile.y]?.[tile.x];
    return terrain === 'dirt' || terrain === 'grass' || terrain === 'sand';
  }

  function nearestGrowingTile(c) {
    const tiles = zoneSystem.entries('growing').filter(canPlantInTile);
    return tiles.sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || null;
  }

  function assignPlantZone(c, tile) {
    if (!c || !tile || !canAutoHandleZoneTask(c)) return false;
    const cropKey = zoneSystem.ensureState()?.growing?.cropType || 'food';
    const crop = cropDefs[cropKey] || cropDefs.food;
    if (crop.seedCost && !hasCost(crop.seedCost)) return false;
    if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(tile.x, tile.y)) return false;
    c.task = { type: 'plantZone', x: tile.x, y: tile.y, zoneType: 'growing', zoneX: tile.x, zoneY: tile.y, cropType: cropKey };
    c.path = findPath(c.x, c.y, tile.x, tile.y);
    c.work = 0;
    c.note = `Plantando ${crop.label}`;
    return true;
  }

  function handlePlantZoneTask(c, task, tick) {
    if (task?.type !== 'plantZone') return false;
    const tile = { x: task.x, y: task.y };
    if (!canPlantInTile(tile)) { c.task = null; c.note = 'Ocioso'; c.work = 0; return true; }
    const crop = cropDefs[task.cropType] || cropDefs.food;
    if (crop.seedCost && !hasCost(crop.seedCost)) { c.task = null; c.note = 'Sem sementes/comida para plantar'; c.work = 0; return true; }
    c.work += tick * (typeof workRate === 'function' ? workRate(c, 'handle') : 1);
    c.note = `Plantando ${crop.label} ${Math.floor((c.work / 2.4) * 100)}%`;
    if (c.work < 2.4) return true;
    if (crop.seedCost) payCost(crop.seedCost);
    state.objects.push({ id: uid('obj'), type: 'crop', x: tile.x, y: tile.y, growth: 0, cropType: task.cropType });
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    log(`${c.name} plantou ${crop.label}.`);
    c.task = null;
    c.note = 'Ocioso';
    c.work = 0;
    return true;
  }

  const nativeUpdateZoneBehaviors = updateZoneBehaviors;
  updateZoneBehaviors = function advancedUpdateZoneBehaviors() {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    for (const c of state.colonists || []) {
      if (processHaulTask(c)) continue;
    }
    for (const c of state.colonists || []) {
      if (c.task || c.energy < 18 || c.health < 20) continue;
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(c.x, c.y)) {
        if (assignMoveToZone(c, 'allowed', 'Retornando para área permitida')) continue;
      }
      if ((state.weather === 'chuva' || c.energy < 26 || c.mood < 24) && zoneSystem.count('home') && assignMoveToZone(c, 'home', 'Voltando para a área da colônia')) continue;
      if ((c.health < 38 || c.statuses?.includes('gripe') || c.statuses?.includes('hipotermia')) && assignMoveToZone(c, 'safe', 'Buscando área segura')) continue;
      const target = canAutoHandleZoneTask(c) ? findLooseHaulTarget() : null;
      if (target && assignHaulTask(c, target)) continue;
      const growTile = nearestGrowingTile(c);
      if (growTile && assignPlantZone(c, growTile)) continue;
      if (c.mood < 22 && assignMoveToZone(c, 'home', 'Voltando para casa')) continue;
    }
  };

  const nativeDrawZonesOverlay = drawZonesOverlay;
  drawZonesOverlay = function advancedDrawZonesOverlay() {
    if (!state || !zoneSystem.count()) return;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (const tile of zoneSystem.entries()) {
      if (!isTileDiscovered(tile.x, tile.y)) continue;
      const def = zoneDefFor(tile.type);
      ctx.fillStyle = def.fill;
      ctx.strokeStyle = def.stroke;
      ctx.lineWidth = tile.type === 'allowed' ? 1 : 2;
      ctx.setLineDash(tile.type === 'home' ? [] : [5, 5]);
      ctx.fillRect(tile.x * TILE, tile.y * TILE, TILE, TILE);
      ctx.strokeRect(tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE - 4);
      if (tile.type === 'growing') {
        ctx.fillStyle = 'rgba(187,247,208,.78)';
        ctx.font = '900 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🌱', tile.x * TILE + TILE / 2, tile.y * TILE + TILE / 2 + 4);
      }
    }
    ctx.restore();
  };

  window.zoneSystem = zoneSystem;
  window.storageFilterDefs = storageFilterDefs;
  window.cropDefs = cropDefs;
  window.storageAcceptsObject = storageAcceptsObject;
  window.GameSystems?.registerTaskHandler('plantZone', 'zones.growing', handlePlantZoneTask, { order: 26 });
})();
