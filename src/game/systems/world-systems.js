'use strict';

function assignMove(c, x, y) {
  if (isBlocked(x, y)) return false;
  c.task = { type: 'move', x, y };
  c.path = findPath(c.x, c.y, x, y);
  c.work = 0;
  c.note = `Indo para ${x},${y}`;
  return true;
}

function notifyWorkComplete(kind, detail = {}, x = null, y = null) {
  window.HavenfallWorkFeedback?.notifyComplete?.(kind, detail, x, y);
}

function feedbackKindForGatherObject(obj, def = null) {
  const gather = def?.gather || objectDefs?.[obj?.type]?.gather || {};
  if (obj?.type === 'tree' || obj?.type === 'logs' || gather.wood) return 'wood';
  return 'gather';
}

function feedbackKindForRecipe(recipe, station = null) {
  if (recipe?.station === 'forge' || station?.type === 'forge') return 'forge';
  if (recipe?.station === 'stove' || recipe?.station === 'smokehouse' || station?.type === 'stove' || station?.type === 'smokehouse') return 'cook';
  if (recipe?.station === 'med_station' || station?.type === 'med_station') return 'heal';
  return 'craft';
}

function assignGather(c, obj) {
  if (!objectDefs[obj.type]?.gather) return;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar em ${objectDefs[obj.type].name}.`); return; }
  c.task = { type: 'gather', objId: obj.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y);
  c.work = 0;
  c.note = `Coletando ${objectDefs[obj.type].name}`;
}

function assignMine(c, x, y, mark = false) {
  if (!c || typeof getRockAt !== 'function') return false;
  const rock = getRockAt(x, y);
  if (!rock?.mineable || !rock.solid) {
    log('Não há rocha mineável nesse tile.');
    return false;
  }
  const adj = nearestFreeAdjacent(x, y, c.x, c.y);
  if (!adj) {
    log(`${c.name} não conseguiu chegar até a rocha.`);
    return false;
  }
  const alreadyAtWorkTile = c.x === adj.x && c.y === adj.y;
  const path = alreadyAtWorkTile ? [] : findPath(c.x, c.y, adj.x, adj.y, rock);
  if (!alreadyAtWorkTile && (!Array.isArray(path) || path.length === 0)) {
    log(`${c.name} não encontrou caminho até a rocha.`);
    return false;
  }
  if (mark && typeof markRockForMining === 'function') markRockForMining(x, y, true);
  c.task = { type: 'mine', mineX: x, mineY: y, x: adj.x, y: adj.y };
  c.path = path;
  c.work = 0;
  c.note = alreadyAtWorkTile
    ? `Minerando ${typeof geologyLabelAt === 'function' ? geologyLabelAt(x, y) : 'rocha'}`
    : `Indo minerar ${typeof geologyLabelAt === 'function' ? geologyLabelAt(x, y) : 'rocha'}`;
  return true;
}

function assignBuild(c, bp) {
  const adj = nearestFreeAdjacent(bp.x, bp.y, c.x, c.y) || { x: bp.x, y: bp.y };
  c.task = { type: 'build', objId: bp.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, bp);
  c.work = 0;
  c.note = `Construindo ${buildDefs[bp.buildType]?.label || 'obra'}`;
}

function assignScare(c, wolf) {
  if (!c || !wolf) return;
  ensureWolfState(wolf);
  ensureEquipment(c);
  const target = { x: Math.round(wolf.x), y: Math.round(wolf.y) };
  const adj = nearestFreeAdjacent(target.x, target.y, c.x, c.y) || target;
  c.task = { type: 'combat', wolfId: wolf.id, x: adj.x, y: adj.y, rounds: 0 };
  c.path = findPath(c.x, c.y, adj.x, adj.y);
  c.work = 0;
  const weapon = itemDefs[c.equipment?.weapon]?.label || itemDefs[c.equipment?.tool]?.label || 'sem arma';
  c.note = `Enfrentando lobo (${weapon})`;
  log(`${c.name} se prepara para enfrentar um lobo ${weapon === 'sem arma' ? 'sem arma — isso é muito arriscado.' : `com ${weapon}.`}`);
}

function assignForge(c, forge) {
  const def = objectDefs[forge.type];
  if (!def?.forge) return;
  const adj = nearestFreeAdjacent(forge.x, forge.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar na ${def.name}.`); return; }
  c.task = { type: 'forge', objId: forge.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, forge);
  c.work = 0;
  c.note = `Indo para ${def.name}`;
}

function assignResearch(c, desk) {
  ensureResearchState();
  const key = state.research.current;
  if (!key) { log('Todas as pesquisas da V1.6 já foram concluídas.'); return; }
  const adj = nearestFreeAdjacent(desk.x, desk.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar na mesa de pesquisa.`); return; }
  c.task = { type: 'research', objId: desk.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, desk);
  c.work = 0;
  c.note = `Indo pesquisar ${researchDefs[key].label}`;
}

function assignCook(c, stove) {
  const adj = nearestFreeAdjacent(stove.x, stove.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar no fogão.`); return; }
  c.task = { type: 'cook', objId: stove.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, stove);
  c.work = 0;
  c.note = 'Indo preparar refeição';
}

function assignHeal(c, station) {
  const adj = nearestFreeAdjacent(station.x, station.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar na estação médica.`); return; }
  c.task = { type: 'heal', objId: station.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, station);
  c.work = 0;
  c.note = 'Indo receber tratamento';
}

function assignCraft(c, recipeKey, stationOverride = null) {
  const recipe = recipeDefs[recipeKey];
  if (!recipe) return;
  if (!recipeUnlocked(recipeKey)) {
    log(`Receita bloqueada: pesquise ${researchDefs[recipe.unlock]?.label || recipe.unlock}.`);
    return;
  }
  if (!hasRecipeCost(recipe)) {
    log(`Faltam recursos para fabricar ${recipe.label}. Precisa de ${itemCostText(recipe.cost, recipe.itemCost)}.`);
    return;
  }
  const station = stationOverride || getStationObject(recipe.station, c);
  if (!station) {
    log(`Construa ${stationLabels[recipe.station] || recipe.station} antes de fabricar ${recipe.label}.`);
    return;
  }
  const adj = nearestFreeAdjacent(station.x, station.y, c.x, c.y);
  if (!adj) {
    log(`${c.name} não conseguiu chegar em ${stationLabels[recipe.station] || 'estação'}.`);
    return;
  }
  c.task = { type: 'craft', recipeKey, objId: station.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, station);
  c.work = 0;
  c.note = `Indo fabricar ${recipe.label}`;
}

function openCraftingForStation(obj) {
  if (!obj) return;
  selectedCraftStationId = obj.id;
  setHudTab('crafting');
  updateCraftingUI();
  updateUI(true);
}

function assignInspect(c, obj) {
  if (!obj) return;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar em ${objectDefs[obj.type]?.name || 'objeto'}.`); return; }
  c.task = { type: 'inspect', objId: obj.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
  c.work = 0;
  c.note = `Indo investigar ${objectDefs[obj.type]?.name || 'objeto'}`;
}

function assignLoot(c, obj) {
  if (!obj) return;
  const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y);
  if (!adj) { log(`${c.name} não conseguiu chegar em ${objectDefs[obj.type]?.name || 'objeto'}.`); return; }
  c.task = { type: 'loot', objId: obj.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y, obj);
  c.work = 0;
  c.note = `Indo vasculhar ${objectDefs[obj.type]?.name || 'objeto'}`;
}

function assignPoiInspect(c, poi) {
  if (!poi) return;
  const adj = nearestFreeAdjacent(poi.x, poi.y, c.x, c.y) || { x: poi.x, y: poi.y };
  c.task = { type: 'inspectPoi', poiId: poi.id, x: adj.x, y: adj.y };
  c.path = findPath(c.x, c.y, adj.x, adj.y);
  c.work = 0;
  c.note = `Indo investigar ${poi.name}`;
}

function isGatherableReady(obj) {
  const def = objectDefs[obj.type];
  if (!def?.gather) return false;
  if (obj.type === 'crop' && (obj.growth || 0) < 100) return false;
  return true;
}

function nearestGatherable(c, markedOnly = false) {
  const list = state.objects
    .filter(o => isGatherableReady(o) && isTileDiscovered(o.x, o.y) && (!markedOnly || o.markedForGather))
    .sort((a, b) => {
      const marked = Number(!!b.markedForGather) - Number(!!a.markedForGather);
      if (marked) return marked;
      return dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y);
    });
  return list[0];
}

function markGatherObjectsInRect(a, b) {
  if (!state) return 0;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  let count = 0;
  for (const obj of state.objects) {
    if (obj.x < minX || obj.x > maxX || obj.y < minY || obj.y > maxY) continue;
    if (!isTileDiscovered(obj.x, obj.y) || !isGatherableReady(obj)) continue;
    obj.markedForGather = true;
    count++;
  }
  if (count) {
    log(`${count} recurso${count > 1 ? 's' : ''} marcado${count > 1 ? 's' : ''} para coleta.`);
    assignMarkedGatherTasks();
  }
  return count;
}

function toggleGatherMark(obj) {
  if (!obj || !isGatherableReady(obj)) return;
  obj.markedForGather = !obj.markedForGather;
  log(`${objectDefs[obj.type]?.name || 'Recurso'} ${obj.markedForGather ? 'marcado para coleta' : 'desmarcado'}.`);
  if (obj.markedForGather) assignMarkedGatherTasks();
}

function taskPriorityValue(c, key) {
  if (!c || !state?.taskPriorities) return 2;
  const row = state.taskPriorities[c.id] || state.taskPriorities[String(c.id)];
  if (!row || row[key] === undefined) return 2;
  return Math.max(0, Math.min(4, Number(row[key]) || 0));
}

function taskPriorityOrder(c) {
  return [
    ['gather', taskPriorityValue(c, 'gather')],
    ['build', taskPriorityValue(c, 'build')],
    ['research', taskPriorityValue(c, 'research')],
    ['handle', taskPriorityValue(c, 'handle')]
  ].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
}

function storageDestinationForPriority(obj, c = null) {
  if (typeof zoneSystem === 'undefined' || !obj) return null;
  if (typeof zoneSystem.findFreeStorageDestinationFor === 'function') {
    return zoneSystem.findFreeStorageDestinationFor(obj, c?.x ?? obj.x, c?.y ?? obj.y);
  }
  const tile = zoneSystem.findFreeStorageTileFor?.(obj) || zoneSystem.findFreeStorageTile?.();
  return tile ? { ...tile, type: tile.type || 'storage' } : null;
}

function canDoPriorityTask(c, key) {
  if (taskPriorityValue(c, key) <= 0) return false;
  if (key === 'gather') {
    const mine = typeof nearestMarkedMine === 'function' ? nearestMarkedMine(c) : null;
    return !!(mine || nearestGatherable(c, true));
  }
  if (key === 'build') return !!nearestBlueprint(c);
  if (key === 'research') {
    ensureResearchState();
    return !!state.research?.current && !!state.objects.find(o => o.type === 'research_desk');
  }
  if (key === 'handle') {
    if (typeof findLooseHaulTarget !== 'function' || typeof assignHaulTask !== 'function') return false;
    const target = findLooseHaulTarget(c);
    if (!target) return false;
    if (typeof zoneSystem !== 'undefined' && typeof zoneSystem.hasStorageDestination === 'function') return zoneSystem.hasStorageDestination(target);
    return !!storageDestinationForPriority(target, c);
  }
  return false;
}

function assignPriorityTask(c, key) {
  if (key === 'gather') {
    const mine = typeof nearestMarkedMine === 'function' ? nearestMarkedMine(c) : null;
    if (mine && assignMine(c, mine.x, mine.y)) return true;
    const resource = nearestGatherable(c, true);
    if (resource) { assignGather(c, resource); return true; }
  }

  if (key === 'build') {
    const bp = nearestBlueprint(c);
    if (bp) { assignBuild(c, bp); return true; }
  }

  if (key === 'research') {
    ensureResearchState();
    const desk = state.objects.find(o => o.type === 'research_desk');
    if (desk && state.research?.current) { assignResearch(c, desk); return true; }
  }

  if (key === 'handle') {
    if (typeof zoneSystem !== 'undefined' && typeof findLooseHaulTarget === 'function' && typeof assignHaulTask === 'function') {
      const target = findLooseHaulTarget(c);
      const destination = storageDestinationForPriority(target, c);
      if (target && destination && assignHaulTask(c, target, destination)) return true;
    }
  }

  return false;
}

function assignMarkedGatherTasks() {
  const idle = state.colonists.filter(c => !c.task && c.energy > 14 && c.health > 15 && taskPriorityValue(c, 'gather') > 0);
  for (const c of idle) {
    const mine = typeof nearestMarkedMine === 'function' ? nearestMarkedMine(c) : null;
    if (mine && assignMine(c, mine.x, mine.y)) continue;
    const target = nearestGatherable(c, true);
    if (!target) break;
    assignGather(c, target);
  }
}

function nearestThreat(c) {
  return state.wolves
    .filter(w => isTileDiscovered(Math.round(w.x), Math.round(w.y)) || dist(c.x, c.y, Math.round(w.x), Math.round(w.y)) < 14)
    .sort((a, b) => dist(c.x, c.y, Math.round(a.x), Math.round(a.y)) - dist(c.x, c.y, Math.round(b.x), Math.round(b.y)))[0];
}

function assignAutoTask(c) {
  ensureColonistMeta(c);

  if (window.GameSystems?.assignAutoTask(c)) return true;

  if (c.priority === 'defense') {
    const threat = nearestThreat(c);
    if (threat) { assignScare(c, threat); return true; }
    c.note = 'Vigiando a área';
    return false;
  }

  const ordered = taskPriorityOrder(c);
  for (const [key] of ordered) {
    if (canDoPriorityTask(c, key) && assignPriorityTask(c, key)) return true;
  }

  c.note = ordered.length ? 'Aguardando tarefa prioritária' : 'Tarefas automáticas desativadas';
  return false;
}

function nearestBlueprint(c) {
  return state.objects
    .filter(o => o.type === 'blueprint')
    .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
}

function nearestBed(c) {
  return state.objects
    .filter(o => o.type === 'bed' && (!o.occupiedBy || String(o.occupiedBy) === String(c?.id || '')) && (!o.reservedBy || String(o.reservedBy) === String(c?.id || '')))
    .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
}

function updateColonist(c, dt) {
  if (window.GameSystems?.runColonistUpdateGuards(c, dt)) return;
  window.GameSystems?.runBeforeColonistUpdate(c, dt);

  const tick = dt * state.speed;
  c.anim += tick;
  c.hunger = clamp(c.hunger - tick * 0.18, 0, 100);
  c.energy = clamp(c.energy - tick * 0.12, 0, 100);
  c.mood = clamp(c.mood - tick * (c.hunger < 25 || c.energy < 20 ? 0.18 : 0.035), 0, 100);

  if (c.hunger < 18) c.health = clamp(c.health - tick * 0.08, 1, 100);
  if (c.health < 30) c.mood = clamp(c.mood - tick * 0.12, 0, 100);

  if (c.hunger < 32 && state.resources.food > 0 && c.task?.type !== 'sleep') {
    const spent = typeof consumeCost === 'function'
      ? consumeCost({ food: 1 }, { reason: 'colonist-eat', actorId: c.id })
      : window.GameState?.consumeResources?.({ food: 1 }, { reason: 'colonist-eat', actorId: c.id });
    if (spent) {
      c.hunger = clamp(c.hunger + 42, 0, 100);
      c.mood = clamp(c.mood + 4, 0, 100);
      log(`${c.name} comeu uma refeição rápida.`);
    }
  }

  if (c.task?.type === 'leisure' && c.energy < 18) {
    c.task = null;
    c.path = [];
    c.work = 0;
    startSleep(c);
  }

  if (!c.task) {
    if (c.energy < 18) {
      startSleep(c);
    } else {
      const assigned = assignAutoTask(c);
      if (!assigned && c.priority !== 'defense') c.note = c.note || 'Aguardando tarefa prioritária';
    }
  }

  if (c.task) {
    if (c.path && c.path.length) moveAlongPath(c, tick);
    else handleTaskAtTarget(c, tick);
  }

  c.x = Math.round((c.px - TILE / 2) / TILE);
  c.y = Math.round((c.py - TILE / 2) / TILE);
  window.GameSystems?.runAfterColonistUpdate(c, dt);
}

function startSleep(c) {
  const bed = nearestBed(c);
  if (bed) {
    const adj = nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) || { x: bed.x, y: bed.y };
    c.task = { type: 'sleep', x: adj.x, y: adj.y, bedId: bed.id, bedX: bed.x, bedY: bed.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, bed);
    c.note = 'Indo dormir';
  } else {
    c.task = { type: 'sleep', x: c.x, y: c.y };
    c.path = [];
    c.note = 'Descansando no chão';
  }
}

function randomWander(c) {
  const tries = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
  for (const [dx, dy] of tries) {
    const nx = c.x + dx, ny = c.y + dy;
    if (!isBlocked(nx, ny)) {
      assignMove(c, nx, ny);
      c.note = 'Caminhando';
      break;
    }
  }
}

function moveAlongPath(c, tick) {
  const next = c.path[0];
  const tx = next.x * TILE + TILE / 2;
  const ty = next.y * TILE + TILE / 2;
  const dx = tx - c.px;
  const dy = ty - c.py;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 62 * (c.energy < 20 ? 0.65 : 1) * (c.mood < 20 ? 0.75 : 1);
  const movementMultiplier = window.GameSystems?.movementMultiplier(c) ?? 1;
  const step = speed * movementMultiplier * tick;

  if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
  else if (Math.abs(dy) > 1) c.dir = dy > 0 ? 'down' : 'up';

  if (len <= step) {
    c.px = tx; c.py = ty; c.path.shift();
  } else {
    c.px += dx / len * step;
    c.py += dy / len * step;
  }
}

function handleTaskAtTarget(c, tick) {
  const task = c.task;
  if (window.GameSystems?.handleTask(c, task, tick)) return;

  if (task.type === 'move') {
    c.task = null; c.note = 'Ocioso'; return;
  }

  if (task.type === 'sleep') {
    const bed = task.bedId ? state.objects.find(o => o.id === task.bedId && o.type === 'bed') : null;
    const hasBed = !!bed;
    if (bed) {
      c.px = (Number(task.bedX ?? bed.x) * TILE) + TILE / 2;
      c.py = (Number(task.bedY ?? bed.y) * TILE) + TILE / 2;
      c.x = Number(task.bedX ?? bed.x);
      c.y = Number(task.bedY ?? bed.y);
    }
    c.energy = clamp(c.energy + tick * (hasBed ? 2.4 : 1.25), 0, 100);
    c.mood = clamp(c.mood + tick * (hasBed ? 0.55 : 0.24), 0, 100);
    c.note = hasBed ? 'Dormindo na cama' : 'Descansando no chão';
    if (c.energy > 88 && (c.mood >= 14 || c.energy >= 98)) { c.task = null; c.note = 'Descansado'; }
    return;
  }

  if (task.type === 'inspect' || task.type === 'loot' || task.type === 'inspectPoi') {
    window.handleInteractionTask?.(c, task, tick);
    return;
  }

  if (task.type === 'mine') {
    const rock = typeof getRockAt === 'function' ? getRockAt(task.mineX, task.mineY) : null;
    if (!rock?.solid) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }
    const label = typeof geologyLabelAt === 'function' ? geologyLabelAt(task.mineX, task.mineY) : 'rocha';
    c.work += tick * workRate(c, 'gather');
    c.note = `Minerando ${label}`;
    const rockBeforeHit = { type: rock.type, resource: rock.resource, maxHp: rock.maxHp };
    const result = typeof mineRockAt === 'function' ? mineRockAt(task.mineX, task.mineY, tick * 12 * workRate(c, 'gather')) : null;
    if (result?.removed) {
      const gainText = Object.entries(result.gain || {}).map(([k, v]) => `+${v} ${resourceLabel(k)}`).join(', ');
      notifyWorkComplete(rockBeforeHit.resource === 'metal' ? 'ore' : 'mine', { ...rockBeforeHit, gain: result.gain }, task.mineX, task.mineY);
      log(`${c.name} minerou ${label}. ${gainText || 'Rocha removida'}.`);
      c.task = null;
      c.note = 'Ocioso';
      c.work = 0;
    }
    return;
  }

  if (task.type === 'gather') {
    const obj = state.objects.find(o => o.id === task.objId);
    if (!obj) { c.task = null; c.note = 'Ocioso'; return; }
    const def = objectDefs[obj.type];
    c.work += tick * workRate(c, 'gather', obj);
    c.note = `Coletando ${def.name} ${Math.floor((c.work / def.work) * 100)}%`;
    if (c.work >= def.work) {
      addResources(def.gather);
      notifyWorkComplete(feedbackKindForGatherObject(obj, def), { objectType: obj.type, gain: def.gather }, obj.x, obj.y);
      state.objects = state.objects.filter(o => o.id !== obj.id);
      if (obj.type === 'tree') state.objects.push({ id: uid('obj'), type: 'logs', x: obj.x, y: obj.y });
      if (obj.type === 'crop') state.objects.push({ id: uid('obj'), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
      log(`${c.name} coletou ${def.name}.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'craft') {
    const recipe = recipeDefs[task.recipeKey];
    const station = state.objects.find(o => o.id === task.objId);
    if (!recipe || !station) { c.task = null; c.note = 'Ocioso'; return; }
    if (!hasRecipeCost(recipe)) {
      log(`Faltam recursos para fabricar ${recipe.label}.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return;
    }
    c.work += tick * workRate(c, 'craft');
    c.note = `Fabricando ${recipe.label} ${Math.floor((c.work / recipe.duration) * 100)}%`;
    if (c.work >= recipe.duration) {
      if (!payRecipeCost(recipe)) {
        log(`Faltaram recursos para concluir ${recipe.label}.`);
        c.task = null; c.note = 'Sem recursos'; c.work = 0;
        updateCraftingUI();
        return;
      }
      addRecipeOutput(recipe.output);
      autoEquipCraftedItem(c, recipe.output);
      notifyWorkComplete(feedbackKindForRecipe(recipe, station), { recipeKey: task.recipeKey, output: recipe.output, station: station.type }, station.x, station.y);
      log(`${c.name} fabricou ${recipe.label}. Resultado: ${outputText(recipe.output)}.`);
      c.mood = clamp(c.mood + 2, 0, 100);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      updateCraftingUI();
    }
    return;
  }

  if (task.type === 'forge') {
    const forge = state.objects.find(o => o.id === task.objId && o.type === 'forge');
    if (!forge) { c.task = null; c.note = 'Ocioso'; return; }
    const def = objectDefs.forge;
    const input = def.forge.input;
    const output = def.forge.output;
    if (!hasCost(input)) {
      log(`Falta pedra para usar a forja. Precisa de ${input.stone} pedras.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return;
    }
    c.work += tick * workRate(c, 'forge');
    c.note = `Forjando metal ${Math.floor((c.work / def.work) * 100)}%`;
    if (c.work >= def.work) {
      if (!payCost(input)) {
        log('Faltaram recursos para concluir a forja.');
        c.task = null; c.note = 'Sem recursos'; c.work = 0;
        return;
      }
      addResources(output);
      notifyWorkComplete('forge', { objectType: forge.type, input, output }, forge.x, forge.y);
      log(`${c.name} transformou ${input.stone} pedras em ${output.metal} metal.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'research') {
    ensureResearchState();
    const desk = state.objects.find(o => o.id === task.objId && o.type === 'research_desk');
    if (!desk) { c.task = null; c.note = 'Ocioso'; return; }
    const key = state.research.current;
    if (!key) { c.task = null; c.note = 'Todas as pesquisas concluídas'; return; }
    const def = researchDefs[key];
    const weatherPenalty = state.weather === 'chuva' ? 0.9 : 1;
    const gain = tick * 4.5 * weatherPenalty * workRate(c, 'research');
    state.research.progress = clamp((state.research.progress || 0) + gain, 0, def.cost);
    c.note = `Pesquisando ${def.label} ${Math.floor((state.research.progress / def.cost) * 100)}%`;
    if (state.research.progress >= def.cost) {
      unlockResearch(key);
      notifyWorkComplete('research', { researchKey: key }, desk.x, desk.y);
      c.mood = clamp(c.mood + 5, 0, 100);
      c.task = null; c.note = 'Pesquisa concluída'; c.work = 0;
    }
    return;
  }

  if (task.type === 'cook') {
    const stove = state.objects.find(o => o.id === task.objId && o.type === 'stove');
    if (!stove) { c.task = null; c.note = 'Ocioso'; return; }
    const def = objectDefs.stove;
    if (!hasCost(def.cook.input)) {
      log('Falta comida crua ou madeira para preparar refeições no fogão.');
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return;
    }
    c.work += tick * workRate(c, 'cook');
    c.note = `Preparando refeição ${Math.floor((c.work / def.work) * 100)}%`;
    if (c.work >= def.work) {
      if (!payCost(def.cook.input)) {
        log('Faltaram recursos para concluir o preparo da refeicao.');
        c.task = null; c.note = 'Sem recursos'; c.work = 0;
        return;
      }
      addResources(def.cook.output);
      c.mood = clamp(c.mood + 4, 0, 100);
      notifyWorkComplete('cook', { objectType: stove.type, input: def.cook.input, output: def.cook.output }, stove.x, stove.y);
      log(`${c.name} preparou refeições no fogão.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'heal') {
    const station = state.objects.find(o => o.id === task.objId && o.type === 'med_station');
    if (!station) { c.task = null; c.note = 'Ocioso'; return; }
    const def = objectDefs.med_station;
    if (!hasCost(def.heal.input)) {
      log('Falta remédio para usar a estação médica.');
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return;
    }
    c.work += tick * workRate(c, 'heal');
    c.note = `Tratamento médico ${Math.floor((c.work / def.work) * 100)}%`;
    if (c.work >= def.work) {
      if (!payCost(def.heal.input)) {
        log('Faltaram recursos para concluir o tratamento.');
        c.task = null; c.note = 'Sem recursos'; c.work = 0;
        return;
      }
      c.health = clamp(c.health + def.heal.amount, 0, 100);
      c.mood = clamp(c.mood + 3, 0, 100);
      notifyWorkComplete('heal', { objectType: station.type, input: def.heal.input, amount: def.heal.amount }, station.x, station.y);
      log(`${c.name} recebeu tratamento médico.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'build') {
    const bp = state.objects.find(o => o.id === task.objId && o.type === 'blueprint');
    if (!bp) { c.task = null; c.note = 'Ocioso'; return; }
    bp.progress = (bp.progress || 0) + tick * workRate(c, 'build');
    const buildType = bp.buildType;
    const def = buildDefs[buildType];
    c.note = `Construindo ${def.label} ${Math.floor((bp.progress / def.work) * 100)}%`;
    if (bp.progress >= def.work) {
      const x = bp.x;
      const y = bp.y;
      bp.type = def.type;
      bp.growth = bp.type === 'crop' ? 0 : undefined;
      delete bp.buildType;
      delete bp.progress;
      notifyWorkComplete('build', { buildType, objectType: def.type }, x, y);
      log(`${c.name} terminou: ${def.label}.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'scare' || task.type === 'combat') {
    handleCombatTask(c, task, tick);
    return;
  }
}



function ensureWolfState(wolf) {
  if (!wolf) return;
  wolf.id ??= uid('wolf');
  wolf.uid ??= wolf.id;
  wolf.hp = wolf.hp === undefined ? 100 : wolf.hp;
  wolf.morale = wolf.morale === undefined ? 65 : wolf.morale;
  wolf.attackCooldown = wolf.attackCooldown || 0;
  wolf.attackAnimTimer = wolf.attackAnimTimer || 0;
}
