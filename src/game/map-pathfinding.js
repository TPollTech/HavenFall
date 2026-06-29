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
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

function payCost(cost) {
  if (window.GameState) {
    window.GameState.payResources(cost);
    return;
  }
  for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
}

function addResources(gain) {
  if (window.GameState) {
    window.GameState.addResources(gain);
    return;
  }
  for (const [k, v] of Object.entries(gain)) state.resources[k] = (state.resources[k] || 0) + v;
}

function addItems(gain = {}) {
  if (window.GameState) {
    window.GameState.addItems(gain);
    return;
  }
  state.items = state.items || {};
  for (const [k, v] of Object.entries(gain)) state.items[k] = (state.items[k] || 0) + v;
}

function hasItems(cost = {}) {
  if (window.GameState) return window.GameState.hasItems(cost);
  state.items = state.items || {};
  return Object.entries(cost || {}).every(([k, v]) => (state.items[k] || 0) >= v);
}

function payItems(cost = {}) {
  if (window.GameState) {
    window.GameState.payItems(cost);
    return;
  }
  state.items = state.items || {};
  for (const [k, v] of Object.entries(cost || {})) state.items[k] = Math.max(0, (state.items[k] || 0) - v);
}

function hasRecipeCost(recipe) {
  return hasCost(recipe.cost || {}) && hasItems(recipe.itemCost || {});
}

function payRecipeCost(recipe) {
  payCost(recipe.cost || {});
  payItems(recipe.itemCost || {});
}

function addRecipeOutput(output = {}) {
  if (window.GameState) {
    window.GameState.addRecipeOutput(output);
    return;
  }
  if (output.resources) addResources(output.resources);
  if (output.items) addItems(output.items);
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
  if (previous) state.items[previous] = (state.items[previous] || 0) + 1;
  state.items[itemKey] = Math.max(0, (state.items[itemKey] || 0) - 1);
  equipment[def.slot] = itemKey;
  log(`${c.name} equipou ${def.label}.`);
  updateUI(true);
  return true;
}

function unequipSlot(c, slot) {
  const equipment = ensureEquipment(c);
  const previous = equipment[slot];
  if (!previous) return false;
  state.items[previous] = (state.items[previous] || 0) + 1;
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

function outputText(output = {}) {
  const parts = [
    ...Object.entries(output.resources || {}).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${resourceLabel(k)}`),
    ...Object.entries(output.items || {}).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${itemLabel(k)}`)
  ];
  return parts.join(', ') || 'nada';
}

function getObjectAt(x, y) {
  ensureSpatialGrid();
  return spatialObjectGrid.get(tileKey(x, y)) || null;
}

function getWolfAt(x, y) {
  const wolves = state?.wolves || [];
  for (let i = 0; i < wolves.length; i++) {
    const wolf = wolves[i];
    if (Math.round(wolf.x) === x && Math.round(wolf.y) === y) return wolf;
  }
  return null;
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < getWorldCols() && y < getWorldRows();
}

function isBlocked(x, y, target = null) {
  if (!isInside(x, y)) return true;
  if (target && target.x === x && target.y === y) return false;

  const registeredBlock = window.GameSystems?.pathBlocked?.(x, y, target);
  if (registeredBlock !== null && registeredBlock !== undefined) return registeredBlock;

  if (typeof isMountainBlocked === 'function' && isMountainBlocked(x, y)) return true;

  const obj = getObjectAt(x, y);
  if (obj && obj.type !== 'blueprint' && objectDefs[obj.type]?.blocks) return true;

  const colonists = state?.colonists || [];
  for (let i = 0; i < colonists.length; i++) {
    const c = colonists[i];
    if (Math.round(c.x) === x && Math.round(c.y) === y && Math.abs(c.px - (x * TILE + TILE / 2)) < 5 && Math.abs(c.py - (y * TILE + TILE / 2)) < 5) return false;
  }

  return false;
}

function findPath(startX, startY, endX, endY, target = null) {
  startX = Math.round(startX);
  startY = Math.round(startY);
  endX = Math.round(endX);
  endY = Math.round(endY);

  if (!isInside(endX, endY)) return [];
  if (startX === endX && startY === endY) return [];

  const queue = [{ x: startX, y: startY }];
  let head = 0;
  const came = new Map();
  const startKey = tileKey(startX, startY);
  const endKey = tileKey(endX, endY);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const maxIterations = Math.min(getWorldCols() * getWorldRows(), 4000);
  let found = false;
  let iterations = 0;

  came.set(startKey, -1);

  while (head < queue.length && iterations++ < maxIterations) {
    const curr = queue[head++];
    const currKey = tileKey(curr.x, curr.y);
    if (currKey === endKey) {
      found = true;
      break;
    }

    for (let i = 0; i < dirs.length; i++) {
      const nx = curr.x + dirs[i][0];
      const ny = curr.y + dirs[i][1];
      const nKey = tileKey(nx, ny);
      const diagonal = dirs[i][0] !== 0 && dirs[i][1] !== 0;
      if (diagonal && (isBlocked(curr.x + dirs[i][0], curr.y, target) || isBlocked(curr.x, curr.y + dirs[i][1], target))) continue;
      if (!came.has(nKey) && !isBlocked(nx, ny, target)) {
        came.set(nKey, currKey);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  if (!found || !came.has(endKey)) return [];

  const path = [];
  let currentKey = endKey;
  while (currentKey !== startKey && currentKey !== -1) {
    path.push({ x: currentKey >> 16, y: currentKey & 0xFFFF });
    currentKey = came.get(currentKey);
  }

  path.reverse();
  return path;
}

function nearestFreeAdjacent(x, y, fromX, fromY) {
  const candidates = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const cx = candidates[i][0];
    const cy = candidates[i][1];
    if (isBlocked(cx, cy)) continue;
    const d = dist(cx, cy, fromX, fromY);
    if (d < bestDist) {
      bestDist = d;
      best = { x: cx, y: cy };
    }
  }

  return best;
}

function dist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function selectedColonist() {
  return state.colonists.find(c => c.id === selectedColonistId) || state.colonists[0];
}
