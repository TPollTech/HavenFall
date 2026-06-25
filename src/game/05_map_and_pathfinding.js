'use strict';

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
  return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
}

function payCost(cost) {
  for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
}

function addResources(gain) {
  for (const [k, v] of Object.entries(gain)) state.resources[k] = (state.resources[k] || 0) + v;
}


function addItems(gain = {}) {
  state.items = state.items || {};
  for (const [k, v] of Object.entries(gain)) state.items[k] = (state.items[k] || 0) + v;
}

function hasItems(cost = {}) {
  state.items = state.items || {};
  return Object.entries(cost || {}).every(([k, v]) => (state.items[k] || 0) >= v);
}

function payItems(cost = {}) {
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
  if (output.resources) addResources(output.resources);
  if (output.items) addItems(output.items);
}

function itemLabel(key) {
  return itemDefs[key]?.label || key;
}

function itemCount(key) {
  return state?.items?.[key] || 0;
}

function recipeUnlocked(key) {
  const recipe = recipeDefs[key];
  if (!recipe) return false;
  return !recipe.unlock || !!state.research?.unlocked?.[recipe.unlock];
}

function recipeStationBuilt(station) {
  if (!station) return true;
  return state.objects.some(o => o.type === station);
}

function getStationObject(station, nearColonist = null) {
  const list = state.objects.filter(o => o.type === station);
  if (!list.length) return null;
  if (!nearColonist) return list[0];
  return list.sort((a, b) => dist(nearColonist.x, nearColonist.y, a.x, a.y) - dist(nearColonist.x, nearColonist.y, b.x, b.y))[0];
}

function ensureEquipment(c) {
  c.equipment = c.equipment || { tool: null, weapon: null, offhand: null };
  if (!('tool' in c.equipment)) c.equipment.tool = null;
  if (!('weapon' in c.equipment)) c.equipment.weapon = null;
  if (!('offhand' in c.equipment)) c.equipment.offhand = null;
  return c.equipment;
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
  let power = 0.45; // desarmado é propositalmente fraco
  if (weapon?.combat) power += weapon.combat;
  else if (tool?.combat) power += tool.combat * 0.55;
  if (offhand?.scare) power += offhand.scare;
  if (c.skills?.defesa) power += c.skills.defesa * 0.08;
  if (c.role === 'Faz-tudo') power += 0.25;
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
  return state.objects.find(o => o.x === x && o.y === y);
}

function getWolfAt(x, y) {
  return state.wolves.find(w => Math.round(w.x) === x && Math.round(w.y) === y);
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < getWorldCols() && y < getWorldRows();
}

function isBlocked(x, y, target = null) {
  if (!isInside(x, y)) return true;
  if (target && target.x === x && target.y === y) return false;
  const obj = getObjectAt(x, y);
  if (obj && obj.type !== 'blueprint' && objectDefs[obj.type]?.blocks) return true;
  if (state.colonists.some(c => Math.round(c.x) === x && Math.round(c.y) === y && Math.abs(c.px - (x * TILE + TILE / 2)) < 5 && Math.abs(c.py - (y * TILE + TILE / 2)) < 5)) return false;
  return false;
}

function findPath(startX, startY, endX, endY, target = null) {
  startX = Math.round(startX); startY = Math.round(startY);
  endX = Math.round(endX); endY = Math.round(endY);
  if (!isInside(endX, endY)) return [];
  const key = (x, y) => `${x},${y}`;
  const queue = [[startX, startY]];
  const came = new Map([[key(startX, startY), null]]);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === endX && y === endY) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      const k = key(nx, ny);
      if (!came.has(k) && !isBlocked(nx, ny, target)) {
        came.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
  }

  const endKey = key(endX, endY);
  if (!came.has(endKey)) return [];
  const path = [];
  let cur = [endX, endY];
  while (cur) {
    path.push({ x: cur[0], y: cur[1] });
    cur = came.get(key(cur[0], cur[1]));
  }
  path.reverse();
  path.shift();
  return path;
}

function nearestFreeAdjacent(x, y, fromX, fromY) {
  const candidates = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([cx, cy]) => !isBlocked(cx, cy))
    .sort((a, b) => dist(a[0], a[1], fromX, fromY) - dist(b[0], b[1], fromX, fromY));
  return candidates[0] ? { x: candidates[0][0], y: candidates[0][1] } : null;
}

function dist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function selectedColonist() {
  return state.colonists.find(c => c.id === selectedColonistId) || state.colonists[0];
}
