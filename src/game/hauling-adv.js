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

function equipAvailableHandcart(c) {
  if (!c || !isResearched('heavy_hauling')) return false;
  if ((state.items?.handcart || 0) <= 0) return false;
  return equipItem(c, 'handcart');
}

function installHaulingZonePatch() {
  if (window.HavenfallContext?.haulingZonePatchInstalled || typeof assignHaulTask !== 'function' || typeof processHaulTask !== 'function') return;

  assignHaulTask = function assignHaulTaskWithCapacity(c, obj, storageTile) {
    if (!c || !obj || !storageTile) return false;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y) || { x: obj.x, y: obj.y };
    obj.reservedBy = c.id;
    c.task = { type: 'haul', phase: 'pickup', objId: obj.id, x: adj.x, y: adj.y, storageX: storageTile.x, storageY: storageTile.y, zoneType: 'storage', zoneX: storageTile.x, zoneY: storageTile.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
    c.work = 0;
    c.note = `Indo buscar toras soltas · carga ${getColonistCurrentLoadCount(c)}/${getColonistMaxCapacity(c)}`;
    return true;
  };

  processHaulTask = function processHaulTaskWithCapacity(c) {
    if (!c?.task || c.task.type !== 'haul') return false;
    if (c.path?.length) return true;

    const task = c.task;
    if (task.phase === 'pickup') {
      const obj = state.objects.find(o => o.id === task.objId);
      if (!obj) { c.task = null; c.note = 'Ocioso'; return true; }
      const amount = getHaulAmountForColonist(c, 'wood');
      c.carrying = { resource: 'wood', amount, label: 'toras' };
      state.objects = state.objects.filter(o => o.id !== obj.id);
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      task.phase = 'dropoff';
      task.x = task.storageX;
      task.y = task.storageY;
      c.path = findPath(c.x, c.y, task.storageX, task.storageY);
      c.note = `Levando toras ao armazenamento · ${amount}/${getColonistMaxCapacity(c)}`;
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
  };

  window.HavenfallContext.haulingZonePatchInstalled = true;
}

function updateHaulingAdvTick() {
  installHaulingDefinitions();
  installHaulingZonePatch();
  if (!state || appScreen !== SCREEN.PLAYING || !isResearched('heavy_hauling')) return;

  for (const c of state.colonists || []) {
    ensureEquipment(c);
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

installHaulingDefinitions();
installHaulingZonePatch();
