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

function updateHaulingAdvTick() {
  installHaulingDefinitions();
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
