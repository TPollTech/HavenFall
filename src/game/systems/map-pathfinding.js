'use strict';

let spatialObjectGrid = new Map();
let spatialObjectsRef = null;
let spatialObjectsLength = -1;

function tileKey(x, y) {
  return (x << 16) | y;
}

function ensureSpatialGrid() {
  const objects = state?.objects || [];
  if (objects === spatialObjectsRef && objects.length === spatialObjectsLength) return;

  spatialObjectGrid.clear();
  spatialObjectsRef = objects;
  spatialObjectsLength = objects.length;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj) continue;
    spatialObjectGrid.set(tileKey(obj.x, obj.y), obj);
  }
}

function invalidateSpatialGrid() {
  spatialObjectsRef = null;
  spatialObjectsLength = -1;
}

function log(message) {
  const hour = formatHour(state.hour);
  state.log.unshift(`[Dia ${state.day} ${hour}] ${message}`);
  state.log = state.log.slice(0, 60);
}

function formatHour(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hasCost(cost) {
  if (window.GameState) return window.GameState.hasResources(cost);
  return Object.entries(cost || {}).every(([k, v]) => (state.resources[k] || 0) >= v);
}

function payCost(cost, options = {}) {
  if (window.GameState) return window.GameState.payResources(cost, options);
  if (!hasCost(cost) && options.requireEnough !== false) return false;
  for (const [k, v] of Object.entries(cost || {})) state.resources[k] = Math.max(0, (state.resources[k] || 0) - v);
  return true;
}

function consumeCost(cost, options = {}) {
  if (window.GameState?.consumeResources) return window.GameState.consumeResources(cost, options);
  return payCost(cost, options);
}

function reserveCost(cost, options = {}) {
  if (window.GameState?.reserveResources) return window.GameState.reserveResources(cost, options);
  return payCost(cost, options);
}

function refundCost(cost, options = {}) {
  if (window.GameState?.refundResources) return window.GameState.refundResources(cost, options);
  return addResources(cost, options);
}

function addResources(gain, options = {}) {
  if (window.GameState) return window.GameState.addResources(gain, options);
  for (const [k, v] of Object.entries(gain || {})) state.resources[k] = (state.resources[k] || 0) + v;
  return true;
}

function addItems(gain = {}, options = {}) {
  if (window.GameState) return window.GameState.addItems(gain, options);
  state.items = state.items || {};
  for (const [k, v] of Object.entries(gain || {})) state.items[k] = (state.items[k] || 0) + v;
  return true;
}

function hasItems(cost = {}) {
  if (window.GameState) return window.GameState.hasItems(cost);
  state.items = state.items || {};
  return Object.entries(cost || {}).every(([k, v]) => (state.items[k] || 0) >= v);
}

function payItems(cost = {}, options = {}) {
  if (window.GameState) return window.GameState.payItems(cost, options);
  if (!hasItems(cost) && options.requireEnough !== false) return false;
  state.items = state.items || {};
  for (const [k, v] of Object.entries(cost || {})) state.items[k] = Math.max(0, (state.items[k] || 0) - v);
  return true;
}

function reserveItems(cost = {}, options = {}) {
  if (window.GameState?.reserveItems) return window.GameState.reserveItems(cost, options);
  return payItems(cost, options);
}

function refundItems(cost = {}, options = {}) {
  if (window.GameState?.refundItems) return window.GameState.refundItems(cost, options);
  return addItems(cost, options);
}

function hasRecipeCost(recipe) {
  return hasCost(recipe.cost || {}) && hasItems(recipe.itemCost || {});
}

function payRecipeCost(recipe, options = {}) {
  const paidResources = payCost(recipe.cost || {}, { ...options, reason: options.reason || 'recipe' });
  const paidItems = payItems(recipe.itemCost || {}, { ...options, reason: options.reason || 'recipe' });
  return paidResources && paidItems;
}

function addRecipeOutput(output = {}, options = {}) {
  if (window.GameState) {
    window.GameState.addRecipeOutput(output, options);
    return true;
  }
  if (output.resources) addResources(output.resources, options);
  if (output.items) addItems(output.items, options);
  return true;
}

function itemLabel(key) {
  return itemDefs[key]?.label || key;
}

function resourceLabel(key) {
  return ({
    food: 'comida',
    wood: 'madeira',
    stone: 'pedra',
    metal: 'metal',
    water: 'água',
    medicine: 'remédio'
  })[key] || key;
}

function itemCount(key) {
  return state?.items?.[key] || 0;
}

function recipeUnlocked(key) {
  const recipe = recipeDefs[key];
  if (!recipe) return false;
  return !recipe.unlock || !!state.research?.unlocked?.[recipe.unlock];
}

function getStationObject(station, nearColonist = null) {
  ensureSpatialGrid();
  const objects = spatialObjectsRef || [];
  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj?.type !== station) continue;
    if (!nearColonist) return obj;
    const d = dist(nearColonist.x, nearColonist.y, obj.x, obj.y);
    if (d < bestDist) {
      bestDist = d;
      best = obj;
    }
  }

  return best;
}

function equipItem(c, itemKey) {
  const def = itemDefs[itemKey];
  if (!c || !def?.slot) return false;
  if (itemCount(itemKey) <= 0) {
    log(`Não há ${def.label} disponível no estoque.`);
    return false;
  }
  const equipment = ensureEquipment(c);
  const previous = equipment[def.slot];
  if (previous) addItems({ [previous]: 1 }, { reason: 'unequip-swap', actorId: c.id });
  payItems({ [itemKey]: 1 }, { reason: 'equip', actorId: c.id });
  equipment[def.slot] = itemKey;
  log(`${c.name} equipou ${def.label}.`);
  updateUI(true);
  return true;
}

function unequipSlot(c, slot) {
  const equipment = ensureEquipment(c);
  const previous = equipment[slot];
  if (!previous) return false;
  addItems({ [previous]: 1 }, { reason: 'unequip', actorId: c.id });
  equipment[slot] = null;
  log(`${c.name} guardou ${itemLabel(previous)} no estoque.`);
  updateUI(true);
  return true;
}

function autoEquipCraftedItem(c, output = {}) {
  if (!c || !output.items) return;
  ensureEquipment(c);
  const preference = ['weapon', 'tool', 'offhand'];
  for (const slot of preference) {
    const candidate = Object.keys(output.items).find(k => itemDefs[k]?.slot === slot && !c.equipment[slot] && itemCount(k) > 0);
    if (candidate) equipItem(c, candidate);
  }
}

function equipmentCombatPower(c) {
  const eq = ensureEquipment(c);
  const weapon = itemDefs[eq.weapon];
  const tool = itemDefs[eq.tool];
  const offhand = itemDefs[eq.offhand];
  let power = 0.45;
  if (weapon?.combat) power += weapon.combat;
  else if (tool?.combat) power += tool.combat * 0.55;
  if (offhand?.scare) power += offhand.scare;
  if (c.skills?.defesa) power += c.skills.defesa * 0.08;
  if (c.role === 'Faz-tudo' || c.role === 'Generalista') power += 0.25;
  return power;
}

function equipmentDefense(c) {
  const eq = ensureEquipment(c);
  const offhand = itemDefs[eq.offhand];
  const tool = itemDefs[eq.tool];
  let defense = 0;
  if (offhand?.defense) defense += offhand.defense;
  if (tool?.defense) defense += tool.defense;
  if (c.skills?.defesa) defense += c.skills.defesa * 0.015;
  return clamp(defense, 0, 0.75);
}

function itemCostText(cost = {}, itemCost = {}) {
  const parts = [
    ...Object.entries(cost || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${resourceLabel(k)}`),
    ...Object.entries(itemCost || {}).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${itemLabel(k)}`)
  ];
  return parts.join(' + ') || 'sem custo';
}
