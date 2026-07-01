'use strict';

function installHaulingDefinitions() {
  if (window.HavenfallContext?.haulingAdvDefsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  itemDefs.handcart = {
    label: 'Carrinho de mão',
    icon: 'toolkit',
    slot: 'offhand',
    kind: 'utility',
    haulCapacity: 20,
    defense: 0.05,
    note: 'Aumenta muito a capacidade de transporte.'
  };

  recipeDefs.handcart = {
    label: 'Carrinho de mão',
    station: 'bench',
    cost: { wood: 10, metal: 2 },
    itemCost: { nails: 2 },
    duration: 9,
    output: { items: { handcart: 1 } },
    unlock: 'heavy_hauling',
    desc: 'Permite carregar grandes quantidades por viagem.'
  };

  window.HavenfallContext.haulingAdvDefsInstalled = true;
}

function getColonistMaxCapacity(c) {
  if (!c) return 2;
  ensureEquipment(c);
  if (isResearched('heavy_hauling')) {
    if (c.equipment?.offhand === 'handcart') return 20;
    return 10;
  }
  return 2;
}

function getColonistCurrentLoadCount(c) {
  if (!c?.carrying) return 0;
  return Math.max(0, Number(c.carrying.amount || 0));
}

function getColonistFreeCapacity(c) {
  return Math.max(0, getColonistMaxCapacity(c) - getColonistCurrentLoadCount(c));
}

function getHaulAmountForColonist(c, resource = 'wood') {
  const max = getColonistMaxCapacity(c);
  if (resource === 'wood') return max;
  return Math.max(1, Math.floor(max / 2));
}

function getHaulingPriority(c) {
  if (typeof getColonistTaskPriority === 'function') return getColonistTaskPriority(c, 'handle');
  return 2;
}

function canColonistAutoHandle(c) {
  return getHaulingPriority(c) > 0;
}

function haulingDestinationFor(obj, c, destination = null) {
  if (destination) return { ...destination, type: destination.type || 'storage' };
  if (typeof zoneSystem === 'undefined') return null;
  if (typeof zoneSystem.findFreeStorageDestinationFor === 'function') {
    return zoneSystem.findFreeStorageDestinationFor(obj, c?.x ?? obj?.x ?? 0, c?.y ?? obj?.y ?? 0);
  }
  const tile = zoneSystem.findFreeStorageTileFor?.(obj) || zoneSystem.findFreeStorageTile?.();
  return tile ? { ...tile, type: tile.type || 'storage' } : null;
}

function haulingCargoForObject(obj, c) {
  if (!obj) return null;
  if (obj.stored || obj.type === 'stockpile') return null;
  if (obj.type === 'rubble') return { kind: 'debris', label: 'entulho', amount: 1, removeObject: true };
  if (obj.type === 'logs') {
    const available = Math.max(1, Number(obj.amount || 5));
    const amount = Math.min(getHaulAmountForColonist(c, 'wood'), available);
    return { resource: 'wood', amount, label: 'madeira', remaining: available - amount };
  }
  if (obj.itemKey) {
    const label = typeof itemDefs !== 'undefined' ? itemDefs?.[obj.itemKey]?.label || obj.itemKey : obj.itemKey;
    const resourceKey = itemDefs?.[obj.itemKey]?.resourceKey || null;
    if (resourceKey) return { resource: resourceKey, amount: Math.max(1, Number(obj.amount || 1)), label, removeObject: true };
    return { item: obj.itemKey, amount: Math.max(1, Number(obj.amount || 1)), label, removeObject: true };
  }
  return null;
}

function haulAmount(cargo) {
  return Math.max(1, Number(cargo?.amount || 1));
}

function isAtTile(c, x, y) {
  return c && Math.round(c.x) === Math.round(x) && Math.round(c.y) === Math.round(y);
}

function tileDistance(ax, ay, bx, by) {
  if (typeof dist === 'function') return dist(ax, ay, bx, by);
  return Math.hypot((Number(ax) || 0) - (Number(bx) || 0), (Number(ay) || 0) - (Number(by) || 0));
}

function routeBetween(fromX, fromY, toX, toY, target = null) {
  if (fromX === toX && fromY === toY) return [];
  const path = typeof findPath === 'function' ? findPath(fromX, fromY, toX, toY, target) : [];
  return Array.isArray(path) ? path : [];
}

function canRouteBetween(fromX, fromY, toX, toY, target = null) {
  return (fromX === toX && fromY === toY) || routeBetween(fromX, fromY, toX, toY, target).length > 0;
}

function tileOccupiedByOtherColonist(x, y, fromX, fromY) {
  return !!(state?.colonists || []).some(c => {
    const cx = Math.round(Number(c.x) || 0);
    const cy = Math.round(Number(c.y) || 0);
    if (cx !== x || cy !== y) return false;
    return cx !== Math.round(Number(fromX) || 0) || cy !== Math.round(Number(fromY) || 0);
  });
}

function canStandOnHaulTile(x, y, fromX, fromY) {
  const tx = Math.round(Number(x) || 0);
  const ty = Math.round(Number(y) || 0);
  if (typeof isInside === 'function' && !isInside(tx, ty)) return false;
  if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tx, ty)) return false;
  if (typeof isBlocked === 'function' && isBlocked(tx, ty)) return false;
  if (tileOccupiedByOtherColonist(tx, ty, fromX, fromY)) return false;
  return true;
}

function nearestFreeAdjacent(targetX, targetY, fromX = targetX, fromY = targetY) {
  const tx = Math.round(Number(targetX) || 0);
  const ty = Math.round(Number(targetY) || 0);
  const fx = Math.round(Number(fromX) || 0);
  const fy = Math.round(Number(fromY) || 0);
  const candidates = [
    { x: tx, y: ty - 1 },
    { x: tx + 1, y: ty },
    { x: tx, y: ty + 1 },
    { x: tx - 1, y: ty },
    { x: tx + 1, y: ty - 1 },
    { x: tx + 1, y: ty + 1 },
    { x: tx - 1, y: ty + 1 },
    { x: tx - 1, y: ty - 1 }
  ].filter(tile => canStandOnHaulTile(tile.x, tile.y, fx, fy));

  if (!candidates.length) return null;
  const reachable = candidates
    .map(tile => ({ ...tile, path: routeBetween(fx, fy, tile.x, tile.y) }))
    .filter(tile => (tile.x === fx && tile.y === fy) || tile.path.length > 0)
    .sort((a, b) => {
      const pathA = a.x === fx && a.y === fy ? 0 : a.path.length || 9999;
      const pathB = b.x === fx && b.y === fy ? 0 : b.path.length || 9999;
      return pathA - pathB || tileDistance(fx, fy, a.x, a.y) - tileDistance(fx, fy, b.x, b.y);
    });

  const selected = reachable[0] || candidates.sort((a, b) => tileDistance(fx, fy, a.x, a.y) - tileDistance(fx, fy, b.x, b.y))[0];
  return selected ? { x: selected.x, y: selected.y } : null;
}

function dropoffTileForDestination(destination, c) {
  if (!destination) return null;
  if (destination.type === 'storage_object') return nearestFreeAdjacent(destination.x, destination.y, c.x, c.y);
  if (typeof isBlocked === 'function' && isBlocked(destination.x, destination.y)) return nearestFreeAdjacent(destination.x, destination.y, c.x, c.y);
  return { x: destination.x, y: destination.y };
}

function equipAvailableHandcart(c) {
  if (!c || !canColonistAutoHandle(c) || !isResearched('heavy_hauling')) return false;
  if ((state.items?.handcart || 0) <= 0) return false;
  return equipItem(c, 'handcart');
}

function reservationOwnerAliveForHaul(obj) {
  return !!(obj?.reservedBy && state?.colonists?.some(colonist => colonist.id === obj.reservedBy && colonist.task?.objId === obj.id));
}

function installHaulingZonePatch() {
  if (window.HavenfallContext?.haulingZonePatchInstalled || typeof assignHaulTask !== 'function' || typeof processHaulTask !== 'function') return;

  assignHaulTask = function assignHaulTaskWithCapacity(c, obj, storageTile = null) {
    if (!c || !obj || !canColonistAutoHandle(c)) return false;
    if (reservationOwnerAliveForHaul(obj) && obj.reservedBy !== c.id) return false;
    const plannedCargo = haulingCargoForObject(obj, c);
    if (!plannedCargo) return false;
    const destination = haulingDestinationFor(obj, c, storageTile)
      || window.HavenfallStorage?.destinationForCargo?.(plannedCargo, c.x, c.y);
    if (!destination) return false;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
    const pickupPath = routeBetween(c.x, c.y, adj.x, adj.y, obj);
    if (!isAtTile(c, adj.x, adj.y) && !pickupPath.length) return false;
    const dropoff = dropoffTileForDestination(destination, c);
    if (!dropoff) return false;
    if (!canRouteBetween(adj.x, adj.y, dropoff.x, dropoff.y)) return false;
    obj.reservedBy = c.id;
    c.task = {
      type: 'haul',
      phase: 'pickup',
      objId: obj.id,
      x: adj.x,
      y: adj.y,
      storageX: destination.x,
      storageY: destination.y,
      dropoffX: dropoff.x,
      dropoffY: dropoff.y,
      zoneType: destination.type,
      zoneX: destination.x,
      zoneY: destination.y,
      zoneObjectId: destination.objectId || null,
      zoneStackId: destination.stackId || null,
      haulAmount: haulAmount(plannedCargo)
    };
    c.path = pickupPath;
    c.work = 0;
    c.note = `Indo buscar item solto - carga ${getColonistCurrentLoadCount(c)}/${getColonistMaxCapacity(c)}`;
    return true;
  };

  processHaulTask = function processHaulTaskWithCapacity(c) {
    if (!c?.task || c.task.type !== 'haul') return false;
    if (c.path?.length) return true;

    const task = c.task;
    if (task.phase === 'pickup') {
      const obj = state.objects.find(o => o.id === task.objId);
      if (!obj) { c.task = null; c.note = 'Ocioso'; return true; }
      if (!isAtTile(c, task.x, task.y)) {
        const path = routeBetween(c.x, c.y, task.x, task.y, obj);
        if (path.length) {
          c.path = path;
          c.note = 'Indo buscar item solto';
        } else {
          obj.reservedBy = null;
          c.task = null;
          c.note = 'Sem caminho para buscar item';
        }
        return true;
      }
      const cargo = haulingCargoForObject(obj, c);
      if (!cargo) { obj.reservedBy = null; c.task = null; c.note = 'Ocioso'; return true; }
      c.carrying = cargo;
      if (cargo.remaining > 0) {
        obj.amount = cargo.remaining;
        obj.reservedBy = null;
      } else {
        state.objects = state.objects.filter(o => o.id !== obj.id);
        if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      }
      task.phase = 'dropoff';
      task.x = task.dropoffX ?? task.storageX;
      task.y = task.dropoffY ?? task.storageY;
      c.path = routeBetween(c.x, c.y, task.x, task.y);
      const targetLabel = task.zoneType === 'storage_object' ? 'depósito' : task.zoneType === 'dumping' ? 'descarte' : 'armazenamento';
      c.note = `Levando ${cargo.label} ao ${targetLabel} - ${cargo.amount}/${getColonistMaxCapacity(c)}`;
      return true;
    }

    if (task.phase === 'dropoff') {
      const cargo = c.carrying;
      if (!isAtTile(c, task.x, task.y)) {
        const path = routeBetween(c.x, c.y, task.x, task.y);
        if (path.length) {
          c.path = path;
          c.note = `Levando ${cargo?.label || 'item'} ao armazenamento`;
        } else {
          c.task = null;
          c.note = 'Sem caminho para entregar item';
        }
        return true;
      }
      if (task.zoneType === 'dumping' || cargo?.kind === 'debris') {
        log(`${c.name} descartou ${cargo?.label || 'entulho'} na zona de descarte.`);
      } else {
        const stored = window.HavenfallStorage?.depositCargoForTask?.(task, cargo);
        if (!stored?.ok) {
          if (cargo?.resource && cargo.amount) addResources({ [cargo.resource]: cargo.amount });
          if (cargo?.item && cargo.amount && typeof addItems === 'function') addItems({ [cargo.item]: cargo.amount });
        }
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

  window.HavenfallContext.haulingZonePatchInstalled = true;
}

function updateHaulingAdvTick() {
  installHaulingDefinitions();
  installHaulingZonePatch();
  if (!state || appScreen !== SCREEN.PLAYING || !isResearched('heavy_hauling')) return;

  for (const c of state.colonists || []) {
    ensureEquipment(c);
    if (!canColonistAutoHandle(c)) continue;
    if (!c.equipment.offhand && (state.items?.handcart || 0) > 0 && !c.task) {
      equipAvailableHandcart(c);
    }
  }
}

window.nearestFreeAdjacent = window.nearestFreeAdjacent || nearestFreeAdjacent;
window.getColonistMaxCapacity = getColonistMaxCapacity;
window.getColonoMaxCapacity = getColonistMaxCapacity;
window.getColonistCurrentLoadCount = getColonistCurrentLoadCount;
window.getColonoCurrentLoadCount = getColonistCurrentLoadCount;
window.getColonistFreeCapacity = getColonistFreeCapacity;
window.getHaulAmountForColonist = getHaulAmountForColonist;
window.equipAvailableHandcart = equipAvailableHandcart;
window.canColonistAutoHandle = canColonistAutoHandle;

installHaulingDefinitions();
installHaulingZonePatch();
window.GameSystems?.registerTick('hauling', updateHaulingAdvTick, { order: 60 });
