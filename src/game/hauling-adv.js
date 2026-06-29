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

function equipAvailableHandcart(c) {
  if (!c || !canColonistAutoHandle(c) || !isResearched('heavy_hauling')) return false;
  if ((state.items?.handcart || 0) <= 0) return false;
  return equipItem(c, 'handcart');
}

function installHaulingZonePatch() {
  if (window.HavenfallContext?.haulingZonePatchInstalled || typeof assignHaulTask !== 'function' || typeof processHaulTask !== 'function') return;

  assignHaulTask = function assignHaulTaskWithCapacity(c, obj, storageTile = null) {
    if (!c || !obj || !canColonistAutoHandle(c)) return false;
    const destination = haulingDestinationFor(obj, c, storageTile);
    if (!destination) return false;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
    obj.reservedBy = c.id;
    c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: destination.x, storageY: destination.y, zoneType: destination.type, zoneX: destination.x, zoneY: destination.y, zoneObjectId: destination.objectId || null };
    c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
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
      task.x = task.storageX;
      task.y = task.storageY;
      c.path = findPath(c.x, c.y, task.storageX, task.storageY);
      const targetLabel = task.zoneType === 'storage_object' ? 'depósito' : task.zoneType === 'dumping' ? 'descarte' : 'armazenamento';
      c.note = `Levando ${cargo.label} ao ${targetLabel} - ${cargo.amount}/${getColonistMaxCapacity(c)}`;
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
