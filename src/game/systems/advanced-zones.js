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
  const STORAGE_OBJECT_UNIT_CAPACITY = 80;
  const FLOOR_STACK_CAPACITY = 75;

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

  function storageObjects() {
    if (!state?.objects) return [];
    const hasStorageZones = zoneSystem.count('storage') > 0;
    return state.objects.filter(obj => {
      if (!obj || obj.type === 'blueprint' || obj.deconstruct) return false;
      if (!objectDefs?.[obj.type]?.storage) return false;
      if (!isTileDiscovered(obj.x, obj.y)) return false;
      if (hasStorageZones && zoneSystem.getZoneAt(obj.x, obj.y) !== 'storage') return false;
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(obj.x, obj.y)) return false;
      return true;
    });
  }

  function storageObjectReservationCount(obj) {
    if (!obj?.id || !state?.colonists) return 0;
    return state.colonists.filter(c => c.task?.type === 'haul' && c.task.zoneType === 'storage_object' && c.task.zoneObjectId === obj.id).length;
  }

  function cargoCategory(cargo) {
    if (!cargo) return null;
    if (cargo.kind === 'debris') return 'debris';
    if (cargo.resource) return cargo.resource;
    if (cargo.item) return 'item';
    return null;
  }

  function storageAcceptsCargo(cargo) {
    const zones = zoneSystem.ensureState();
    const category = cargoCategory(cargo);
    if (!category || category === 'debris') return false;
    const filters = zones?.storageFilters || {};
    if (category === 'item') return filters.items !== false;
    return filters[category] !== false;
  }

  function cargoStorageKey(cargo) {
    if (cargo?.resource) return `resource:${cargo.resource}`;
    if (cargo?.item) return `item:${cargo.item}`;
    return null;
  }

  function cargoAmount(cargo) {
    return Math.max(1, Number(cargo?.amount || 1));
  }

  function ensureStorageContents(obj) {
    obj.storageContents = obj.storageContents || { resources: {}, items: {} };
    obj.storageContents.resources = obj.storageContents.resources || {};
    obj.storageContents.items = obj.storageContents.items || {};
    return obj.storageContents;
  }

  function storedAmountInContents(contents = {}) {
    const resources = Object.values(contents.resources || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
    const items = Object.values(contents.items || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
    return resources + items;
  }

  function storageObjectCapacity(obj) {
    const def = objectDefs?.[obj?.type] || {};
    return Math.max(1, Number(obj?.storageCapacity || def.storageCapacity || Number(def.storage || 1) * STORAGE_OBJECT_UNIT_CAPACITY || STORAGE_OBJECT_UNIT_CAPACITY));
  }

  function storageObjectUsed(obj) {
    return storedAmountInContents(ensureStorageContents(obj));
  }

  function storageObjectReservedAmount(obj) {
    if (!obj?.id || !state?.colonists) return 0;
    return state.colonists.reduce((sum, c) => {
      const task = c.task;
      if (task?.type !== 'haul' || task.zoneType !== 'storage_object' || task.zoneObjectId !== obj.id) return sum;
      return sum + Math.max(1, Number(task.haulAmount || c.carrying?.amount || 1));
    }, 0);
  }

  function storageObjectFreeCapacity(obj) {
    return Math.max(0, storageObjectCapacity(obj) - storageObjectUsed(obj) - storageObjectReservedAmount(obj));
  }

  function findFreeStorageObjectFor(obj, fromX = obj?.x || 0, fromY = obj?.y || 0) {
    if (!obj || !storageAcceptsObject(obj)) return null;
    return storageObjects()
      .filter(storage => storageObjectFreeCapacity(storage) > 0)
      .sort((a, b) => dist(fromX, fromY, a.x, a.y) - dist(fromX, fromY, b.x, b.y))[0] || null;
  }

  zoneSystem.findFreeStorageObjectFor = function findFreeStorageObjectForZone(obj, fromX = obj?.x || 0, fromY = obj?.y || 0) {
    const storage = findFreeStorageObjectFor(obj, fromX, fromY);
    return storage ? { x: storage.x, y: storage.y, type: 'storage_object', objectId: storage.id } : null;
  };

  zoneSystem.findFreeStorageDestinationFor = function findFreeStorageDestinationFor(obj, fromX = obj?.x || 0, fromY = obj?.y || 0) {
    if (!obj || !storageAcceptsObject(obj)) return null;
    const cargo = cargoForObject(obj);
    return destinationForCargo(cargo, fromX, fromY);
  };

  zoneSystem.storageObjectCount = function storageObjectCount() {
    return storageObjects().length;
  };

  zoneSystem.hasStorageDestination = function hasStorageDestination(obj = null) {
    if (obj) return !!this.findFreeStorageDestinationFor(obj, obj.x, obj.y);
    return this.count('storage') > 0 || this.storageObjectCount() > 0;
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
    if (obj.stored || obj.type === 'stockpile') return null;
    if (obj.type === 'rubble') return 'debris';
    if (obj.type === 'logs') return 'wood';
    if (obj.type === 'berry' || obj.type === 'crop') return 'food';
    if (obj.type === 'rock') return 'stone';
    if (obj.type === 'ore') return 'metal';
    if (obj.itemKey) return 'item';
    return null;
  }

  function storageAcceptsObject(obj) {
    if (obj?.stored || obj?.type === 'stockpile') return false;
    const zones = zoneSystem.ensureState();
    const category = resourceCategoryForObject(obj);
    if (!category || category === 'debris') return false;
    const filters = zones?.storageFilters || {};
    if (category === 'item') return filters.items !== false;
    return filters[category] !== false;
  }

  function cargoForObject(obj) {
    if (!obj) return null;
    if (obj.stored || obj.type === 'stockpile') return null;
    if (obj.type === 'rubble') return { kind: 'debris', label: 'entulho', amount: 1 };
    if (obj.type === 'logs') return { resource: 'wood', amount: Number(obj.amount || 5), label: 'toras' };
    if (obj.itemKey) {
      const resourceKey = itemDefs?.[obj.itemKey]?.resourceKey || null;
      const label = itemDefs?.[obj.itemKey]?.label || obj.itemKey;
      if (resourceKey) return { resource: resourceKey, amount: Number(obj.amount || 1), label };
      return { item: obj.itemKey, amount: Number(obj.amount || 1), label };
    }
    return null;
  }

  function stackMatchesCargo(stack, cargo) {
    if (!stack?.stored || stack.type !== 'stockpile' || !cargo) return false;
    if (stack.storageKey && stack.storageKey !== cargoStorageKey(cargo)) return false;
    if (cargo.resource) return stack.storageKind === 'resource' && stack.resource === cargo.resource;
    if (cargo.item) return stack.storageKind === 'item' && stack.itemKey === cargo.item;
    return false;
  }

  function stackFreeCapacity(stack) {
    return Math.max(0, Number(stack.storageCapacity || FLOOR_STACK_CAPACITY) - Math.max(0, Number(stack.amount || 0)));
  }

  function findExistingStorageStackForCargo(cargo, fromX = 0, fromY = 0) {
    if (!storageAcceptsCargo(cargo) || !zoneSystem.count('storage')) return null;
    return (state?.objects || [])
      .filter(obj => stackMatchesCargo(obj, cargo) && zoneSystem.getZoneAt(obj.x, obj.y) === 'storage' && stackFreeCapacity(obj) > 0)
      .sort((a, b) => dist(fromX, fromY, a.x, a.y) - dist(fromX, fromY, b.x, b.y))[0] || null;
  }

  function findFreeStorageTileForCargo(cargo, fromX = 0, fromY = 0) {
    if (!storageAcceptsCargo(cargo)) return null;
    return zoneSystem.entries('storage')
      .filter(tile => !getObjectAt(tile.x, tile.y) && !isBlocked(tile.x, tile.y))
      .sort((a, b) => dist(fromX, fromY, a.x, a.y) - dist(fromX, fromY, b.x, b.y))[0] || null;
  }

  function destinationForCargo(cargo, fromX = 0, fromY = 0) {
    if (!storageAcceptsCargo(cargo)) return null;
    const sourceLike = cargo.resource === 'wood'
      ? { type: 'logs', amount: cargo.amount }
      : cargo.item
        ? { type: 'loot', itemKey: cargo.item, amount: cargo.amount }
        : null;
    const storageObject = sourceLike ? zoneSystem.findFreeStorageObjectFor(sourceLike, fromX, fromY) : null;
    if (storageObject) return storageObject;
    const stack = findExistingStorageStackForCargo(cargo, fromX, fromY);
    if (stack) return { x: stack.x, y: stack.y, type: 'storage_stack', stackId: stack.id };
    const tile = findFreeStorageTileForCargo(cargo, fromX, fromY);
    return tile ? { ...tile, type: 'storage' } : null;
  }

  zoneSystem.findFreeStorageStackForCargo = function findFreeStorageStackForCargo(cargo, fromX = 0, fromY = 0) {
    const stack = findExistingStorageStackForCargo(cargo, fromX, fromY);
    return stack ? { x: stack.x, y: stack.y, type: 'storage_stack', stackId: stack.id } : null;
  };

  zoneSystem.findFreeStorageDestinationForCargo = function findFreeStorageDestinationForCargo(cargo, fromX = 0, fromY = 0) {
    return destinationForCargo(cargo, fromX, fromY);
  };

  function addCargoToGlobalStock(cargo, amount = cargoAmount(cargo)) {
    if (cargo?.resource && amount > 0) addResources({ [cargo.resource]: amount });
    if (cargo?.item && amount > 0 && typeof addItems === 'function') addItems({ [cargo.item]: amount });
  }

  function depositIntoStorageObject(objectId, cargo, amount = cargoAmount(cargo)) {
    const storage = (state?.objects || []).find(obj => obj.id === objectId);
    if (!storage || !objectDefs?.[storage.type]?.storage || !storageAcceptsCargo(cargo)) return { ok: false, amount: 0 };
    const free = Math.max(0, storageObjectCapacity(storage) - storageObjectUsed(storage));
    const stored = Math.min(amount, free);
    if (stored <= 0) return { ok: false, amount: 0, full: true };
    const contents = ensureStorageContents(storage);
    if (cargo.resource) contents.resources[cargo.resource] = (contents.resources[cargo.resource] || 0) + stored;
    if (cargo.item) contents.items[cargo.item] = (contents.items[cargo.item] || 0) + stored;
    storage.lastStoredAt = Date.now();
    addCargoToGlobalStock(cargo, stored);
    return { ok: true, amount: stored, target: storage };
  }

  function createStockpileAt(x, y, cargo) {
    const stack = {
      id: typeof uid === 'function' ? uid('stock') : `stock_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: 'stockpile',
      x,
      y,
      stored: true,
      storageKind: cargo.resource ? 'resource' : 'item',
      storageKey: cargoStorageKey(cargo),
      resource: cargo.resource || null,
      itemKey: cargo.item || null,
      label: cargo.label || cargo.resource || cargo.item || 'item',
      amount: 0,
      storageCapacity: FLOOR_STACK_CAPACITY
    };
    state.objects.push(stack);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return stack;
  }

  function depositIntoFloorStack(destination, cargo, amount = cargoAmount(cargo)) {
    if (!storageAcceptsCargo(cargo) || !destination) return { ok: false, amount: 0 };
    let stack = destination.stackId ? state.objects.find(obj => obj.id === destination.stackId) : null;
    if (!stack && destination.x !== undefined && destination.y !== undefined) {
      const existing = getObjectAt(destination.x, destination.y);
      if (stackMatchesCargo(existing, cargo)) stack = existing;
    }
    if (!stack && destination.x !== undefined && destination.y !== undefined && !getObjectAt(destination.x, destination.y)) {
      stack = createStockpileAt(destination.x, destination.y, cargo);
    }
    if (!stack || !stackMatchesCargo(stack, cargo)) return { ok: false, amount: 0 };
    const stored = Math.min(amount, stackFreeCapacity(stack));
    if (stored <= 0) return { ok: false, amount: 0, full: true };
    stack.amount = Math.max(0, Number(stack.amount || 0)) + stored;
    stack.label = cargo.label || stack.label;
    stack.lastStoredAt = Date.now();
    addCargoToGlobalStock(cargo, stored);
    return { ok: true, amount: stored, target: stack };
  }

  function depositCargoForTask(task, cargo) {
    if (!task || !cargo || cargo.kind === 'debris') return { ok: false, amount: 0 };
    let remaining = cargoAmount(cargo);
    let stored = 0;
    if (task.zoneType === 'storage_object' && task.zoneObjectId) {
      const result = depositIntoStorageObject(task.zoneObjectId, cargo, remaining);
      stored += result.amount || 0;
      remaining -= result.amount || 0;
    }
    if (remaining > 0) {
      const preferred = task.zoneType === 'storage' || task.zoneType === 'storage_stack'
        ? { x: task.storageX, y: task.storageY, type: task.zoneType, stackId: task.zoneStackId || null }
        : destinationForCargo(cargo, task.storageX, task.storageY);
      const result = depositIntoFloorStack(preferred, cargo, remaining);
      stored += result.amount || 0;
      remaining -= result.amount || 0;
    }
    return { ok: stored > 0 && remaining <= 0, amount: stored, remaining };
  }

  function destinationForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'rubble') {
      const tile = zoneSystem.findFreeDumpingTile();
      return tile ? { ...tile, type: 'dumping' } : null;
    }
    if (storageAcceptsObject(obj)) {
      const cargo = cargoForObject(obj);
      return destinationForCargo(cargo, obj.x, obj.y);
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
    c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: destination.x, storageY: destination.y, zoneType: destination.type, zoneX: destination.x, zoneY: destination.y, zoneObjectId: destination.objectId || null };
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
      c.note = task.zoneType === 'dumping' ? 'Levando entulho ao descarte' : task.zoneType === 'storage_object' ? 'Levando item ao depósito' : 'Levando item ao estoque';
      return true;
    }
    if (task.phase === 'dropoff') {
      const cargo = c.carrying;
      if (task.zoneType === 'dumping' || cargo?.kind === 'debris') {
        log(`${c.name} descartou ${cargo?.label || 'entulho'} na zona de descarte.`);
      } else {
        if (cargo?.resource && cargo.amount) addResources({ [cargo.resource]: cargo.amount });
        if (cargo?.item && cargo.amount && typeof addItems === 'function') addItems({ [cargo.item]: cargo.amount });
        const targetLabel = task.zoneType === 'storage_object' ? 'o depósito' : 'a zona de armazenamento';
        log(`${c.name} levou ${cargo?.amount || 0} ${cargo?.label || 'item'} para ${targetLabel}.`);
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
  window.HavenfallStorage = {
    cargoForObject,
    cargoAmount,
    cargoStorageKey,
    destinationForCargo,
    destinationForObject,
    depositCargoForTask,
    depositIntoStorageObject,
    depositIntoFloorStack,
    storageObjectCapacity,
    storageObjectUsed,
    storageObjectFreeCapacity,
    stackFreeCapacity,
    floorStackCapacity: FLOOR_STACK_CAPACITY
  };
  window.GameSystems?.registerTaskHandler('plantZone', 'zones.growing', handlePlantZoneTask, { order: 26 });
})();
