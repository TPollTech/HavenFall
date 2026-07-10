'use strict';

(() => {
  if (window.HavenfallContext?.advancedZonesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.advancedZonesInstalled = true;

  const advancedZoneDefs = Object.freeze({
    growing: {
      label: 'Zona de cultivo',
      short: 'Cultivo',
      hint: 'Cria talhões agrícolas por área pintada.',
      fill: 'rgba(74,222,128,.16)',
      stroke: 'rgba(74,222,128,.82)'
    },
    allowed: {
      label: 'Área permitida',
      short: 'Permitida',
      hint: 'Limita movimentação automática dos colonos.',
      fill: 'rgba(56,189,248,.12)',
      stroke: 'rgba(56,189,248,.72)'
    }
  });

  const baseZoneDefs = typeof zoneDefs !== 'undefined' ? zoneDefs : {};
  const allZoneDefs = () => ({ ...baseZoneDefs, ...advancedZoneDefs });

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function tileDistance(ax, ay, bx, by) {
    if (typeof dist === 'function') return dist(ax, ay, bx, by);
    return Math.hypot(numberOr(ax) - numberOr(bx), numberOr(ay) - numberOr(by));
  }

  function clampAmount(value) {
    return Math.max(1, Math.round(numberOr(value, 1)));
  }

  function cargoForObject(payload) {
    if (!payload) return null;
    if (payload.resource || payload.item) {
      return {
        resource: payload.resource || null,
        item: payload.item || payload.itemKey || null,
        amount: clampAmount(payload.amount || 1),
        label: payload.label || payload.resource || payload.item || payload.itemKey || 'carga'
      };
    }
    if (payload.type === 'logs') {
      return { resource: 'wood', amount: clampAmount(payload.amount || 5), label: 'madeira' };
    }
    if (payload.itemKey) {
      const defs = typeof itemDefs === 'object' ? itemDefs : {};
      const resourceKey = defs?.[payload.itemKey]?.resourceKey || null;
      return {
        resource: resourceKey,
        item: resourceKey ? null : payload.itemKey,
        amount: clampAmount(payload.amount || 1),
        label: defs?.[payload.itemKey]?.label || payload.itemKey
      };
    }
    if (payload.type === 'stockpile') {
      if (payload.resource) return { resource: payload.resource, amount: clampAmount(payload.amount || 1), label: payload.label || payload.resource };
      if (payload.itemKey) return { item: payload.itemKey, amount: clampAmount(payload.amount || 1), label: payload.label || payload.itemKey };
    }
    return null;
  }

  function ensureStorageContents(obj) {
    if (!obj) return null;
    obj.storageContents = obj.storageContents || {};
    obj.storageContents.resources = obj.storageContents.resources || {};
    obj.storageContents.items = obj.storageContents.items || {};
    return obj.storageContents;
  }

  function storageCapacityFor(obj) {
    const defs = typeof objectDefs === 'object' ? objectDefs : {};
    const def = defs?.[obj?.type] || {};
    return Math.max(0, Math.round(numberOr(obj?.storageCapacity, numberOr(def.storageCapacity, 0))));
  }

  function storageUsedFor(obj) {
    const contents = ensureStorageContents(obj);
    if (!contents) return 0;
    const totalResources = Object.values(contents.resources || {}).reduce((sum, value) => sum + Math.max(0, numberOr(value)), 0);
    const totalItems = Object.values(contents.items || {}).reduce((sum, value) => sum + Math.max(0, numberOr(value)), 0);
    return totalResources + totalItems;
  }

  function storageFreeFor(obj) {
    return Math.max(0, storageCapacityFor(obj) - storageUsedFor(obj));
  }

  function isStorageObject(obj) {
    if (!obj) return false;
    const defs = typeof objectDefs === 'object' ? objectDefs : {};
    const def = defs?.[obj.type] || {};
    return !!(def.storage || storageCapacityFor(obj) > 0);
  }

  function stackAcceptsCargo(obj, cargo) {
    if (!obj || obj.type !== 'stockpile' || !cargo) return false;
    if (cargo.resource) return obj.resource === cargo.resource && !obj.itemKey;
    if (cargo.item) return obj.itemKey === cargo.item;
    return false;
  }

  function storageAcceptsObject(obj, payload = null) {
    const cargo = cargoForObject(payload) || payload;
    if (!obj || !cargo || obj.type === 'stockpile' || !isStorageObject(obj)) return false;
    return storageFreeFor(obj) >= clampAmount(cargo.amount || 1);
  }

  function storageObjectsForCargo(cargo, fromX = 0, fromY = 0) {
    return (state?.objects || [])
      .filter(obj => zoneSystem.getZoneAt(obj.x, obj.y) === 'storage' && storageAcceptsObject(obj, cargo))
      .sort((a, b) => tileDistance(fromX, fromY, a.x, a.y) - tileDistance(fromX, fromY, b.x, b.y));
  }

  function floorStorageDestinationForCargo(cargo, fromX = 0, fromY = 0) {
    const options = zoneSystem.entries('storage')
      .map(tile => {
        const occupant = typeof getObjectAt === 'function' ? getObjectAt(tile.x, tile.y) : null;
        if (!occupant) return { x: tile.x, y: tile.y, type: 'storage', stackId: null, reusable: false };
        if (stackAcceptsCargo(occupant, cargo)) return { x: tile.x, y: tile.y, type: 'storage', stackId: occupant.id, reusable: true };
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.reusable !== b.reusable) return a.reusable ? -1 : 1;
        return tileDistance(fromX, fromY, a.x, a.y) - tileDistance(fromX, fromY, b.x, b.y);
      });
    return options[0] || null;
  }

  function addCargoToColony(cargo) {
    if (!cargo) return false;
    if (cargo.resource && typeof addResources === 'function') addResources({ [cargo.resource]: clampAmount(cargo.amount) });
    if (cargo.item && typeof addItems === 'function') addItems({ [cargo.item]: clampAmount(cargo.amount) });
    return true;
  }

  function ensureFloorStack(tile, cargo) {
    if (!tile || !cargo) return null;
    const existing = (state?.objects || []).find(obj =>
      obj.x === tile.x
      && obj.y === tile.y
      && obj.type === 'stockpile'
      && stackAcceptsCargo(obj, cargo));
    if (existing) {
      existing.amount = clampAmount(numberOr(existing.amount, 0) + clampAmount(cargo.amount));
      return existing;
    }
    const stack = {
      id: typeof uid === 'function' ? uid('stockpile') : `stockpile_${Date.now()}`,
      type: 'stockpile',
      x: tile.x,
      y: tile.y,
      amount: clampAmount(cargo.amount),
      stored: true,
      resource: cargo.resource || null,
      itemKey: cargo.item || null,
      label: cargo.label || cargo.resource || cargo.item || 'estoque'
    };
    state.objects = Array.isArray(state?.objects) ? state.objects : [];
    state.objects.push(stack);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return stack;
  }

  function fallbackStorageTile(task, cargo) {
    if (task?.zoneType === 'storage' && zoneSystem.getZoneAt(task.storageX, task.storageY) === 'storage') {
      const occupant = typeof getObjectAt === 'function' ? getObjectAt(task.storageX, task.storageY) : null;
      if (!occupant || stackAcceptsCargo(occupant, cargo)) {
        return { x: task.storageX, y: task.storageY, type: 'storage', stackId: task.zoneStackId || occupant?.id || null };
      }
    }
    return floorStorageDestinationForCargo(cargo, task?.storageX ?? 0, task?.storageY ?? 0);
  }

  window.HavenfallZones = window.HavenfallZones || {};
  window.HavenfallZones.getZoneDef = type => allZoneDefs()[type] || null;
  window.HavenfallZones.getAllZoneDefs = allZoneDefs;

  const nativeEnsureState = zoneSystem.ensureState.bind(zoneSystem);
  zoneSystem.ensureState = function ensureAdvancedZoneState() {
    const zones = nativeEnsureState();
    if (!zones) return null;
    zones.grid = zones.grid || {};
    return zones;
  };

  zoneSystem.setZone = function setAdvancedZone(x, y, zoneType) {
    const zones = this.ensureState();
    if (!zones) return false;
    if (typeof isInside === 'function' && !isInside(x, y)) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) return false;
    const key = this.key(x, y);
    if (!zoneType || zoneType === 'none') delete zones.grid[key];
    else if (allZoneDefs()[zoneType]) zones.grid[key] = zoneType;
    else return false;
    return true;
  };

  zoneSystem.counts = function advancedZoneCounts() {
    const counts = Object.fromEntries(Object.keys(allZoneDefs()).map(key => [key, 0]));
    const zones = this.ensureState();
    if (!zones) return counts;
    for (const type of Object.values(zones.grid)) counts[type] = (counts[type] || 0) + 1;
    return counts;
  };

  zoneSystem.findFreeTile = function findFreeAdvancedZoneTile(type, predicate = null) {
    for (const tile of this.entries(type)) {
      if (getObjectAt(tile.x, tile.y)) continue;
      if (typeof isBlocked === 'function' && isBlocked(tile.x, tile.y)) continue;
      if (predicate && !predicate(tile)) continue;
      const reserved = state?.colonists?.some(c => c.task?.zoneType === type && c.task.zoneX === tile.x && c.task.zoneY === tile.y);
      if (!reserved) return { x: tile.x, y: tile.y };
    }
    return null;
  };

  zoneSystem.findFreeDumpingTile = function findFreeDumpingTile() {
    return this.findFreeTile('dumping');
  };

  zoneSystem.findFreeGrowingTile = function findFreeGrowingTile() {
    return this.findFreeTile('growing');
  };

  zoneSystem.findFreeStorageTileFor = function findFreeStorageTileFor(payload, fromX = payload?.x ?? 0, fromY = payload?.y ?? 0) {
    const cargo = cargoForObject(payload);
    if (!cargo) return null;
    return floorStorageDestinationForCargo(cargo, fromX, fromY);
  };

  zoneSystem.findFreeStorageDestinationFor = function findFreeStorageDestinationFor(payload, fromX = payload?.x ?? 0, fromY = payload?.y ?? 0) {
    const cargo = cargoForObject(payload);
    if (!cargo) return null;
    const storageObject = storageObjectsForCargo(cargo, fromX, fromY)[0];
    if (storageObject) return { x: storageObject.x, y: storageObject.y, type: 'storage_object', objectId: storageObject.id };
    return floorStorageDestinationForCargo(cargo, fromX, fromY);
  };

  zoneSystem.hasStorageDestination = function hasStorageDestination(payload, fromX = payload?.x ?? 0, fromY = payload?.y ?? 0) {
    return !!this.findFreeStorageDestinationFor(payload, fromX, fromY);
  };

  zoneSystem.hasAllowedArea = function hasAllowedArea() {
    return this.count('allowed') > 0;
  };

  zoneSystem.isTileAllowed = function isTileAllowed(x, y) {
    if (!this.hasAllowedArea()) return true;
    const type = this.getZoneAt(x, y);
    return type === 'allowed' || type === 'home' || type === 'safe';
  };

  const nativeAssignMove = typeof assignMove === 'function' ? assignMove : null;
  if (nativeAssignMove) {
    assignMove = function assignMoveWithAllowedArea(c, x, y) {
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(x, y)) {
        if (typeof log === 'function') log(`${c?.name || 'Colono'} não pode sair da área permitida.`);
        return false;
      }
      return nativeAssignMove(c, x, y);
    };
  }

  const nativeUpdateZoneBehaviors = updateZoneBehaviors;
  updateZoneBehaviors = function advancedZoneBehaviorsWithoutCropObjects() {
    nativeUpdateZoneBehaviors?.();
    if (!state || appScreen !== SCREEN.PLAYING) return;
    for (const c of state.colonists || []) {
      if (c.task || c.energy < 18 || c.health < 20) continue;
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(c.x, c.y)) {
        if (assignMoveToZone(c, 'allowed', 'Retornando para área permitida')) continue;
      }
      if (window.HavenfallFarming?.assignFarmingTask?.(c)) continue;
    }
  };

  function destinationForCargo(cargo, fromX = 0, fromY = 0) {
    return zoneSystem.findFreeStorageDestinationFor(cargo, fromX, fromY);
  }

  function depositCargoForTask(task, payload) {
    const cargo = cargoForObject(payload);
    if (!task || !cargo) return { ok: false, reason: 'invalid-cargo' };

    if (task.zoneType === 'storage_object') {
      const storageObject = (state?.objects || []).find(obj => String(obj.id) === String(task.zoneObjectId))
        || (typeof getObjectAt === 'function' ? getObjectAt(task.storageX, task.storageY) : null);
      if (storageAcceptsObject(storageObject, cargo)) {
        const contents = ensureStorageContents(storageObject);
        if (cargo.resource) contents.resources[cargo.resource] = numberOr(contents.resources[cargo.resource]) + clampAmount(cargo.amount);
        if (cargo.item) contents.items[cargo.item] = numberOr(contents.items[cargo.item]) + clampAmount(cargo.amount);
        addCargoToColony(cargo);
        return { ok: true, type: 'storage_object', objectId: storageObject.id };
      }
    }

    const floorTile = fallbackStorageTile(task, cargo);
    if (!floorTile) return { ok: false, reason: 'no-storage-tile' };
    const stack = ensureFloorStack(floorTile, cargo);
    addCargoToColony(cargo);
    return { ok: true, type: 'storage', x: floorTile.x, y: floorTile.y, stackId: stack?.id || floorTile.stackId || null, fallback: true };
  }

  window.zoneSystem = zoneSystem;
  window.storageAcceptsObject = storageAcceptsObject;
  window.HavenfallStorage = Object.freeze({
    storageAcceptsObject,
    destinationForCargo,
    depositCargoForTask
  });
})();
