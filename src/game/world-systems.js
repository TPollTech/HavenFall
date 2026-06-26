'use strict';

function assignMove(c, x, y) {
  if (isBlocked(x, y)) return false;
  c.task = { type: 'move', x, y };
  c.path = findPath(c.x, c.y, x, y);
  c.work = 0;
  c.note = `Indo para ${x},${y}`;
  return true;
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

function assignMarkedGatherTasks() {
  const idle = state.colonists.filter(c => !c.task && c.energy > 14 && c.health > 15);
  for (const c of idle) {
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
  if (c.priority === 'defense') {
    const threat = nearestThreat(c);
    if (threat) { assignScare(c, threat); return true; }
    c.note = 'Vigiando a área';
    return false;
  }

  if (c.priority === 'gather') {
    const resource = nearestGatherable(c, true) || nearestGatherable(c);
    if (resource) { assignGather(c, resource); return true; }
    c.note = 'Aguardando recurso para coletar';
    return false;
  }

  if (c.priority === 'build') {
    const bp = nearestBlueprint(c);
    if (bp) { assignBuild(c, bp); return true; }
    c.note = 'Aguardando obra';
    return false;
  }

  return false;
}

function nearestBlueprint(c) {
  return state.objects
    .filter(o => o.type === 'blueprint')
    .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
}

function nearestBed(c) {
  return state.objects
    .filter(o => o.type === 'bed')
    .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
}

function updateColonist(c, dt) {
  const tick = dt * state.speed;
  c.anim += tick;
  c.hunger = clamp(c.hunger - tick * 0.18, 0, 100);
  c.energy = clamp(c.energy - tick * 0.12, 0, 100);
  c.mood = clamp(c.mood - tick * (c.hunger < 25 || c.energy < 20 ? 0.18 : 0.035), 0, 100);

  if (c.hunger < 18) c.health = clamp(c.health - tick * 0.08, 1, 100);
  if (c.health < 30) c.mood = clamp(c.mood - tick * 0.12, 0, 100);

  if (c.hunger < 32 && state.resources.food > 0 && c.task?.type !== 'sleep') {
    state.resources.food -= 1;
    c.hunger = clamp(c.hunger + 42, 0, 100);
    c.mood = clamp(c.mood + 4, 0, 100);
    log(`${c.name} comeu uma refeição rápida.`);
  }

  if (!c.task) {
    if (c.energy < 18) {
      startSleep(c);
    } else {
      const assigned = assignAutoTask(c);
      if (!assigned && c.priority !== 'defense' && Math.random() < 0.002 * state.speed) randomWander(c);
    }
  }

  if (c.task) {
    if (c.path && c.path.length) moveAlongPath(c, tick);
    else handleTaskAtTarget(c, tick);
  }

  c.x = Math.round((c.px - TILE / 2) / TILE);
  c.y = Math.round((c.py - TILE / 2) / TILE);
}

function startSleep(c) {
  const bed = nearestBed(c);
  if (bed) {
    const adj = nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) || { x: bed.x, y: bed.y };
    c.task = { type: 'sleep', x: adj.x, y: adj.y, bedId: bed.id };
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
  const step = speed * tick;

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
  if (task.type === 'move') {
    c.task = null; c.note = 'Ocioso'; return;
  }

  if (task.type === 'sleep') {
    const hasBed = task.bedId && state.objects.some(o => o.id === task.bedId);
    c.energy = clamp(c.energy + tick * (hasBed ? 2.4 : 1.25), 0, 100);
    c.mood = clamp(c.mood + tick * (hasBed ? 0.35 : 0.08), 0, 100);
    c.note = hasBed ? 'Dormindo na cama' : 'Descansando no chão';
    if (c.energy > 88) { c.task = null; c.note = 'Descansado'; }
    return;
  }

  if (task.type === 'inspect' || task.type === 'loot' || task.type === 'inspectPoi') {
    handleInteractionTask(c, task, tick);
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
      state.objects = state.objects.filter(o => o.id !== obj.id);
      if (obj.type === 'tree') state.objects.push({ id: uid(), type: 'logs', x: obj.x, y: obj.y });
      if (obj.type === 'crop') state.objects.push({ id: uid(), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
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
      payRecipeCost(recipe);
      addRecipeOutput(recipe.output);
      autoEquipCraftedItem(c, recipe.output);
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
      payCost(input);
      addResources(output);
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
      payCost(def.cook.input);
      addResources(def.cook.output);
      c.mood = clamp(c.mood + 4, 0, 100);
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
      payCost(def.heal.input);
      c.health = clamp(c.health + def.heal.amount, 0, 100);
      c.mood = clamp(c.mood + 3, 0, 100);
      log(`${c.name} recebeu tratamento médico.`);
      c.task = null; c.note = 'Ocioso'; c.work = 0;
    }
    return;
  }

  if (task.type === 'build') {
    const bp = state.objects.find(o => o.id === task.objId && o.type === 'blueprint');
    if (!bp) { c.task = null; c.note = 'Ocioso'; return; }
    bp.progress = (bp.progress || 0) + tick * workRate(c, 'build');
    const def = buildDefs[bp.buildType];
    c.note = `Construindo ${def.label} ${Math.floor((bp.progress / def.work) * 100)}%`;
    if (bp.progress >= def.work) {
      bp.type = def.type;
      bp.growth = bp.type === 'crop' ? 0 : undefined;
      delete bp.buildType;
      delete bp.progress;
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
  wolf.hp = wolf.hp ?? 100;
  wolf.morale = wolf.morale ?? 100;
  wolf.aggression = wolf.aggression ?? 1;
  wolf.state = wolf.state || 'hunting';
}

function handleCombatTask(c, task, tick) {
  const wolf = state.wolves.find(w => w.id === task.wolfId);
  if (!wolf) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }
  ensureWolfState(wolf);
  ensureEquipment(c);
  const power = equipmentCombatPower(c);
  const defense = equipmentDefense(c);
  const roundTime = power < 1.2 ? 4.2 : 3.0;
  c.work += tick * workRate(c, 'defense');
  c.note = `Confronto com lobo ${Math.floor((c.work / roundTime) * 100)}%`;

  if (c.work < roundTime) return;

  c.work = 0;
  task.rounds = (task.rounds || 0) + 1;

  const weaponKey = c.equipment?.weapon;
  const toolKey = c.equipment?.tool;
  const offhandKey = c.equipment?.offhand;
  const bowWithoutArrows = weaponKey === 'bow' && itemCount('arrows') <= 0;
  const weaponName = bowWithoutArrows ? null : (itemDefs[weaponKey]?.label || itemDefs[toolKey]?.label || null);
  const hasRealWeapon = !!weaponKey && !bowWithoutArrows;
  if (bowWithoutArrows && task.rounds === 0) log(`${c.name} está com arco, mas não tem flechas. O confronto fica muito mais perigoso.`);
  if (weaponKey === 'bow' && !bowWithoutArrows) state.items.arrows = Math.max(0, (state.items.arrows || 0) - 1);
  const hasTorch = offhandKey === 'torch';
  const hasShield = offhandKey === 'shield';
  const alliesNearby = state.colonists.filter(other => other.id !== c.id && dist(other.x, other.y, c.x, c.y) <= 3).length;
  const groupBonus = alliesNearby * 0.35;
  const chanceRoll = Math.random();
  const attackPower = power + groupBonus + (hasTorch ? 0.35 : 0);
  const damageToWolf = hasRealWeapon ? 18 + attackPower * 8 : 4 + attackPower * 3;
  const danger = clamp((wolf.aggression || 1) * (hasRealWeapon ? 0.42 : 0.92) - defense - groupBonus * 0.12 - (hasTorch ? 0.18 : 0), 0.08, 0.95);
  const injury = Math.max(0, Math.round((hasRealWeapon ? 5 : 14) + danger * 14 - (hasShield ? 6 : 0)));

  if (!hasRealWeapon && chanceRoll < 0.55) {
    c.health = clamp(c.health - injury, 1, 100);
    c.mood = clamp(c.mood - 8, 0, 100);
    wolf.morale = clamp(wolf.morale - 8 - (hasTorch ? 12 : 0), 0, 100);
    log(`${c.name} tentou segurar o lobo sem arma. O animal pressionou o ataque, e ${c.name} recuou machucado.`);
  } else {
    wolf.hp = clamp(wolf.hp - damageToWolf, 0, 100);
    wolf.morale = clamp(wolf.morale - (hasTorch ? 28 : 12) - groupBonus * 8, 0, 100);
    if (chanceRoll < danger) {
      c.health = clamp(c.health - Math.max(2, Math.floor(injury * 0.55)), 1, 100);
      log(`${c.name} acertou o lobo com ${weaponName || 'as próprias mãos'}, mas o animal conseguiu contra-atacar.`);
    } else {
      log(`${c.name} manteve distância e acertou o lobo com ${weaponName || 'um golpe improvisado'}.`);
    }
  }

  if (c.health <= 12) {
    c.task = null;
    c.note = 'Ferido e recuando';
    c.mood = clamp(c.mood - 12, 0, 100);
    log(`${c.name} ficou em condição ruim e abandonou o confronto. É melhor buscar tratamento.`);
    return;
  }

  if (wolf.hp <= 0) {
    state.wolves = state.wolves.filter(w => w.id !== wolf.id);
    c.mood = clamp(c.mood + 7, 0, 100);
    c.note = 'Ameaça neutralizada';
    c.task = null;
    log(`${c.name} neutralizou o lobo depois de um confronto difícil.`);
    return;
  }

  if (wolf.morale <= 15 || (hasTorch && chanceRoll < 0.42) || (!hasRealWeapon && task.rounds >= 2 && chanceRoll < 0.28)) {
    state.wolves = state.wolves.filter(w => w.id !== wolf.id);
    c.mood = clamp(c.mood + 4, 0, 100);
    c.note = 'Lobo afastado';
    c.task = null;
    log(`O lobo hesitou e fugiu da área. ${c.name} sobreviveu ao confronto.`);
    return;
  }

  if (!hasRealWeapon && task.rounds >= 3) {
    c.task = null;
    c.note = 'Recuou do combate';
    c.mood = clamp(c.mood - 6, 0, 100);
    log(`${c.name} percebeu que lutar desarmado era arriscado demais e recuou.`);
    return;
  }
}

function handleInteractionTask(c, task, tick) {
  if (task.type === 'inspectPoi') {
    const poi = state.world?.pointsOfInterest?.find(p => p.id === task.poiId);
    if (!poi) { c.task = null; c.note = 'Ocioso'; return; }
    c.work += tick * workRate(c, 'research');
    c.note = `Investigando ${poi.name} ${Math.floor((c.work / 2.6) * 100)}%`;
    if (c.work >= 2.6) {
      poi.inspected = true;
      poi.discovered = true;
      log(`${c.name} investigou ${poi.name}: ${poi.lore || 'há sinais de uma história esquecida neste lugar.'}`);
      c.mood = clamp(c.mood + 3, 0, 100);
      c.task = null; c.note = 'Investigação concluída'; c.work = 0;
    }
    return;
  }

  const obj = state.objects.find(o => o.id === task.objId);
  if (!obj) { c.task = null; c.note = 'Ocioso'; return; }
  const def = objectDefs[obj.type] || { name: 'objeto', work: 2.5 };
  const workNeeded = def.work || 2.5;
  c.work += tick * workRate(c, task.type === 'inspect' ? 'research' : 'gather');
  c.note = `${task.type === 'inspect' ? 'Investigando' : 'Vasculhando'} ${def.name} ${Math.floor((c.work / workNeeded) * 100)}%`;
  if (c.work < workNeeded) return;

  if (task.type === 'inspect') finishInspect(c, obj);
  else finishLoot(c, obj);
  c.task = null;
  c.work = 0;
}

function finishInspect(c, obj) {
  obj.inspected = true;
  obj.unknown = false;
  const poi = obj.poiId ? state.world?.pointsOfInterest?.find(p => p.id === obj.poiId) : null;
  if (poi) poi.inspected = true;
  const lore = obj.lore || poi?.lore || loreForObject(obj);
  log(`${c.name} investigou ${objectDefs[obj.type]?.name || 'objeto'}: ${lore}`);
  c.note = 'Investigação concluída';
  c.mood = clamp(c.mood + 2, 0, 100);
}

function finishLoot(c, obj) {
  if (obj.looted) {
    log(`${objectDefs[obj.type]?.name || 'Objeto'} já foi vasculhado.`);
    c.note = 'Nada encontrado';
    return;
  }
  obj.looted = true;
  obj.unknown = false;
  const poi = obj.poiId ? state.world?.pointsOfInterest?.find(p => p.id === obj.poiId) : null;
  if (poi) poi.looted = true;
  const loot = obj.loot || rollLootForObject(obj);
  addResources(loot.resources || loot);
  addItems(loot.items || {});
  const resourceLoot = loot.resources || loot;
  const itemLoot = loot.items || {};
  const lootText = [
    ...Object.entries(resourceLoot).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${resourceLabel(k)}`),
    ...Object.entries(itemLoot).filter(([,v]) => v > 0).map(([k,v]) => `+${v} ${itemLabel(k)}`)
  ].join(', ') || 'nada útil';
  log(`${c.name} vasculhou ${objectDefs[obj.type]?.name || 'objeto'} e encontrou ${lootText}.`);
  c.note = 'Loot coletado';
  c.mood = clamp(c.mood + 3, 0, 100);
}

function rollLootForObject(obj) {
  const rand = seededRandom(`${state.config?.seed || 'save'}|loot|${obj.id}|${obj.type}`);
  const resources = { food: 0, wood: 0, stone: 0, metal: 0, medicine: 0 };
  const items = {};
  const maybeItem = (key, chance, min = 1, max = 1) => {
    if (rand() < chance) items[key] = (items[key] || 0) + min + Math.floor(rand() * (max - min + 1));
  };
  if (obj.type === 'cache' || obj.type === 'supply_crate') {
    resources.food = Math.floor(rand() * 6) + 2;
    resources.wood = Math.floor(rand() * 5) + 1;
    resources.metal = rand() < 0.62 ? Math.floor(rand() * 4) + 1 : 0;
    resources.medicine = rand() < 0.28 ? 1 : 0;
    maybeItem('rope', 0.35);
    maybeItem('nails', 0.55, 1, 3);
    maybeItem('cloth', 0.32);
    maybeItem('arrows', 0.22, 2, 6);
  } else if (obj.type === 'ruin') {
    resources.stone = Math.floor(rand() * 5) + 2;
    resources.metal = Math.floor(rand() * 5) + 1;
    resources.medicine = rand() < 0.18 ? 1 : 0;
    maybeItem('nails', 0.48, 1, 4);
    maybeItem('leather', 0.22);
    maybeItem('knife', 0.08);
  } else if (obj.type === 'crate') {
    resources.wood = Math.floor(rand() * 4) + 2;
    resources.food = rand() < 0.4 ? Math.floor(rand() * 3) + 1 : 0;
    maybeItem('rope', 0.18);
  }
  return { resources, items };
}

function loreForObject(obj) {
  if (obj.type === 'ruin') return 'pedras quebradas, cinzas antigas e marcas de ferramentas revelam que este lugar já foi usado como abrigo.';
  if (obj.type === 'cache' || obj.type === 'supply_crate') return 'a tampa está gasta, mas ainda há sinais de que alguém tentou proteger estes suprimentos.';
  if (obj.type === 'crate') return 'a madeira está úmida e antiga, mas o conteúdo ainda pode ser útil.';
  return 'não parece comum. Talvez exista algo útil ou alguma pista neste local.';
}

function resourceLabel(key) {
  return ({ food: 'comida', wood: 'madeira', stone: 'pedra', metal: 'metal', medicine: 'remédio' })[key] || key;
}

function updateWolves(dt) {
  for (const w of state.wolves) {
    ensureWolfState(w);
    const tick = dt * state.speed;
    const nearest = state.colonists
      .slice()
      .sort((a, b) => Math.hypot(a.px - w.px, a.py - w.py) - Math.hypot(b.px - w.px, b.py - w.py))[0];
    if (!nearest) continue;
    const close = Math.hypot(nearest.px - w.px, nearest.py - w.py);
    w.anim += tick;
    if (close < TILE * 4) {
      const dx = nearest.px - w.px;
      const dy = nearest.py - w.py;
      const len = Math.hypot(dx, dy) || 1;
      w.px += dx / len * 35 * tick;
      w.py += dy / len * 35 * tick;
      w.dir = dx > 0 ? 'right' : 'left';
      if (close < 32) {
        const activelyFighting = nearest.task?.type === 'combat' && nearest.task?.wolfId === w.id;
        const armor = equipmentDefense(nearest);
        const pressure = activelyFighting ? 1.4 : 3.2;
        nearest.health = clamp(nearest.health - tick * pressure * (1 - armor), 1, 100);
        nearest.mood = clamp(nearest.mood - tick * (activelyFighting ? 0.55 : 1.1), 0, 100);
        nearest.note = activelyFighting ? nearest.note : 'Em perigo';
      }
    } else if (Math.random() < 0.01 * state.speed) {
      w.target = randomEdgeTile(false);
    }
    if (w.target) {
      const tx = w.target.x * TILE + TILE / 2;
      const ty = w.target.y * TILE + TILE / 2;
      const dx = tx - w.px;
      const dy = ty - w.py;
      const len = Math.hypot(dx, dy) || 1;
      if (len < 4) w.target = null;
      else { w.px += dx / len * 24 * tick; w.py += dy / len * 24 * tick; }
    }
    w.x = Math.round((w.px - TILE / 2) / TILE);
    w.y = Math.round((w.py - TILE / 2) / TILE);
  }
}

function randomEdgeTile(forWolf = true) {
  const side = Math.floor(Math.random() * 4);
  const cols = getWorldCols();
  const rows = getWorldRows();
  if (side === 0) return { x: 1, y: 1 + Math.floor(Math.random() * (rows - 2)) };
  if (side === 1) return { x: cols - 2, y: 1 + Math.floor(Math.random() * (rows - 2)) };
  if (side === 2) return { x: 1 + Math.floor(Math.random() * (cols - 2)), y: 1 };
  return { x: 1 + Math.floor(Math.random() * (cols - 2)), y: rows - 2 };
}

function updateWorld(dt) {
  if (!state || appScreen !== SCREEN.PLAYING) return;
  const tick = dt * state.speed;
  state.hour += tick * 0.085;
  if (state.hour >= 24) {
    state.day += 1;
    state.hour -= 24;
    state.eventDoneToday = false;
    log(`A colônia chegou ao Dia ${state.day}.`);
  }

  if (!state.eventDoneToday && state.hour > 7.5) {
    state.eventDoneToday = true;
    randomEvent();
  }

  const intensityChance = ({ low: 0.0008, normal: 0.0018, high: 0.0035 })[state.config?.eventIntensity || 'normal'] || 0.0018;
  if (Math.random() < intensityChance * state.speed) randomEvent();

  if (state.weatherTime > 0) {
    state.weatherTime -= tick;
    if (state.weatherTime <= 0) {
      state.weather = 'limpo';
      log('O tempo abriu.');
    }
  }

  for (const obj of state.objects) {
    if (obj.type === 'crop') {
      const rainBonus = state.weather === 'chuva' ? 2.1 : 1;
      obj.growth = clamp((obj.growth || 0) + tick * 0.85 * rainBonus, 0, 100);
    }
  }

  for (const c of state.colonists) updateColonist(c, dt);
  updateWolves(dt);
  updateExploration();
  checkGoals();
}

function randomEvent() {
  const options = ['rain', 'supplies', 'wolf', 'berries', 'ore'];
  const event = options[Math.floor(Math.random() * options.length)];
  if (event === 'rain') {
    state.weather = 'chuva';
    state.weatherTime = 45;
    log('Chuva fina: plantações crescem mais rápido hoje.');
  } else if (event === 'supplies') {
    const wood = 4 + Math.floor(Math.random() * 7);
    const food = 2 + Math.floor(Math.random() * 5);
    const medicine = Math.random() < 0.35 ? 1 : 0;
    addResources({ wood, food, medicine });
    log(`Caixas antigas encontradas: +${wood} madeira, +${food} comida${medicine ? ' e +1 remédio' : ''}.`);
  } else if (event === 'wolf') {
    spawnWolf();
    log('Um lobo apareceu perto da colônia. Selecione um colono e clique nele para espantar.');
  } else if (event === 'berries') {
    for (let i = 0; i < 2; i++) {
      const tile = freeRandomTile();
      if (tile) state.objects.push({ id: uid(), type: 'berry', x: tile.x, y: tile.y });
    }
    log('Frutas silvestres brotaram perto da base.');
  } else if (event === 'ore') {
    const tile = freeRandomStoneTile() || freeRandomTile();
    if (tile) {
      state.objects.push({ id: uid(), type: 'ore', x: tile.x, y: tile.y });
      log('Um veio de metal foi encontrado em uma área rochosa.');
    }
  }
}

function spawnWolf() {
  const t = randomThreatTile() || randomEdgeTile();
  state.wolves.push({ id: uid(), x: t.x, y: t.y, px: t.x * TILE + TILE / 2, py: t.y * TILE + TILE / 2, anim: 0, dir: 'left', hp: 100, morale: 100, aggression: 1 + Math.random() * 0.35, state: 'hunting' });
}

function randomThreatTile() {
  const base = state.colonists[Math.floor(Math.random() * state.colonists.length)] || selectedColonist();
  if (!base) return null;
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.floor(Math.random() * 12);
    const x = Math.round(base.x + Math.cos(angle) * radius);
    const y = Math.round(base.y + Math.sin(angle) * radius);
    if (isInside(x, y) && !isBlocked(x, y)) return { x, y };
  }
  return null;
}

function freeRandomTile() {
  const cols = getWorldCols();
  const rows = getWorldRows();
  for (let i = 0; i < 160; i++) {
    const x = 2 + Math.floor(Math.random() * (cols - 4));
    const y = 2 + Math.floor(Math.random() * (rows - 4));
    if (!getObjectAt(x, y) && !isBlocked(x, y)) return { x, y };
  }
  return null;
}

function freeRandomStoneTile() {
  const cols = getWorldCols();
  const rows = getWorldRows();
  for (let i = 0; i < 200; i++) {
    const x = 2 + Math.floor(Math.random() * (cols - 4));
    const y = 2 + Math.floor(Math.random() * (rows - 4));
    if (state.terrain[y]?.[x] === 'stone' && !getObjectAt(x, y)) return { x, y };
  }
  return null;
}

function checkGoals() {
  ensureResearchState();
  const beds = state.objects.filter(o => o.type === 'bed').length;
  const campfire = state.objects.some(o => o.type === 'campfire');
  const researchDesk = state.objects.some(o => o.type === 'research_desk');
  const allTechs = researchOrder.every(key => !!state.research.unlocked[key]);
  setGoal('beds', beds >= 2);
  setGoal('campfire', campfire);
  setGoal('researchDesk', researchDesk);
  setGoal('techs', allTechs);
  setGoal('food', state.resources.food >= 20);
  setGoal('days', state.day >= 4);
  if (!state.won && beds >= 2 && campfire && researchDesk && allTechs && state.resources.food >= 20 && state.day >= 4) {
    state.won = true;
    setScreen(SCREEN.PAUSED);
    showModal('Base estabilizada!', 'Tu venceu a V1.8: a colônia tem cama, fogo, comida, mesa de pesquisa e tecnologias avançadas desbloqueadas. Dá pra continuar jogando, mas esse é o final do protótipo.', 'Continuar jogando');
    log('Objetivos da V1.8 concluídos.');
  }
}

function setGoal(key, done) {
  const el = dom.goalList?.querySelector(`[data-goal="${key}"]`);
  if (el) el.classList.toggle('done', done);
}
