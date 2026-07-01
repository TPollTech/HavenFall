'use strict';

window.defenseSystem = window.defenseSystem || {};

const DEFENSE_COMBAT_WORK = 1.35;
const DEFENSE_REPATH_DISTANCE = 1.25;

function installDefenseDefinitions() {
  if (window.defenseSystem.defsInstalled) return;

  objectDefs.spike_trap = {
    name: 'armadilha de espinhos',
    img: 'weapon_spear',
    blocks: false,
    trap: true,
    work: 2.5
  };

  buildDefs.spike_trap = {
    label: 'Armadilha de espinhos',
    type: 'spike_trap',
    cost: { wood: 6, stone: 2 },
    work: 3.5,
    requires: 'basic_defense'
  };

  window.defenseSystem.defsInstalled = true;
}

function installDefenseBuildButton() {
  const grid = document.querySelector('.build-grid');
  if (!grid || grid.querySelector('[data-build="spike_trap"]')) return;
  const btn = document.createElement('button');
  btn.dataset.build = 'spike_trap';
  btn.innerHTML = 'Armadilha<br><small>pesquisar defesa</small>';
  grid.appendChild(btn);
}

function triggerSpikeTrap(enemy, trap) {
  if (!enemy || !trap || trap.isBroken) return false;
  const damage = 45;
  enemy.hp = clamp((enemy.hp ?? enemy.health ?? 100) - damage, 0, 100);
  enemy.health = enemy.hp;
  enemy.morale = clamp((enemy.morale ?? 100) - 28, 0, 100);
  trap.uses = (trap.uses || 0) + 1;
  trap.triggerCooldown = 1.4;
  log(`Uma armadilha de espinhos feriu um lobo. Dano: ${damage}.`);

  if (trap.uses >= 3) {
    trap.isBroken = true;
    trap.broken = true;
    log('Uma armadilha de espinhos colapsou e precisa ser reconstruída.');
  }

  return true;
}

function checkTrapTrigger(enemy) {
  if (!isResearched('basic_defense')) return false;
  const ex = Math.round(enemy.x);
  const ey = Math.round(enemy.y);
  const obj = getObjectAt(ex, ey);
  if (!obj || obj.type !== 'spike_trap' || obj.isBroken || obj.triggerCooldown > 0) return false;
  return triggerSpikeTrap(enemy, obj);
}

function updateTrapCooldowns(tick) {
  for (const obj of state?.objects || []) {
    if (obj.type === 'spike_trap' && obj.triggerCooldown > 0) obj.triggerCooldown = Math.max(0, obj.triggerCooldown - tick);
  }
}

function resetColonistTask(c, note = 'Ocioso') {
  if (!c) return;
  c.task = null;
  c.path = [];
  c.work = 0;
  c.note = note;
}

function normalizeThreat(threat) {
  if (!threat) return null;
  threat.type = threat.type || 'wolf';
  threat.hp = threat.hp ?? threat.health ?? 100;
  threat.maxHp = threat.maxHp || Math.max(100, threat.hp || 100);
  threat.morale = threat.morale ?? 100;
  threat.px = threat.px ?? threat.x * TILE + TILE / 2;
  threat.py = threat.py ?? threat.y * TILE + TILE / 2;
  threat.attackAnimTimer = threat.attackAnimTimer || 0;
  threat.hitAnimTimer = threat.hitAnimTimer || 0;
  return threat;
}

function combatTargetId(task) {
  return task?.wolfId || task?.mobId || task?.targetId || null;
}

function findCombatTarget(task) {
  const id = combatTargetId(task);
  if (!id) return null;
  const byId = item => String(item?.id) === String(id);
  const wolf = (state?.wolves || []).find(byId);
  if (wolf) return { entity: normalizeThreat(wolf), collection: 'wolves' };
  const mob = (state?.mobs || []).find(byId);
  if (mob) return { entity: normalizeThreat(mob), collection: 'mobs' };
  return null;
}

function threatLabel(threat) {
  if (typeof mobName === 'function') return mobName(threat?.type || 'wolf').toLowerCase();
  if (threat?.type === 'spider') return 'aranha';
  if (threat?.type === 'blood_wolf') return 'lobo de sangue';
  return 'lobo';
}

function combatWeapon(c) {
  if (typeof ensureEquipment === 'function') ensureEquipment(c);
  return itemDefs?.[c?.equipment?.weapon] || itemDefs?.[c?.equipment?.tool] || null;
}

function colonistCombatDamage(c, mode = 'combat') {
  const weapon = combatWeapon(c);
  const weaponPower = Number(weapon?.combat || weapon?.damage || 1);
  const roleBonus = c?.priority === 'defense' ? 1.16 : 1;
  const base = mode === 'scare' ? 4.5 : 9.5;
  return base * weaponPower * roleBonus;
}

function colonistMoralePressure(c, mode = 'combat') {
  const weapon = combatWeapon(c);
  const weaponPower = Number(weapon?.combat || weapon?.damage || 1);
  return (mode === 'scare' ? 24 : 12) * Math.max(0.85, weaponPower);
}

function threatCounterDamage(threat) {
  const base = threat?.type === 'spider' ? 2.4 : threat?.type === 'blood_wolf' ? 5.5 : 3.6;
  return base * Number(threat?.aggression || 1);
}

function applyCombatImpact(attacker, target, amount = 10) {
  if (typeof applyAttackImpact === 'function') {
    applyAttackImpact(attacker, target, amount);
    return;
  }
  if (attacker) attacker.attackAnimTimer = 0.18;
  if (target) target.hitAnimTimer = 0.18;
}

function removeCombatTarget(targetInfo, hunter = null, reason = 'neutralized') {
  const target = targetInfo?.entity;
  if (!target || !state) return false;

  if (targetInfo.collection === 'mobs') {
    const index = (state.mobs || []).findIndex(mob => mob.id === target.id);
    if (index >= 0) {
      if (reason === 'defeated' && typeof finishMobDeath === 'function') finishMobDeath(target, index, hunter);
      else state.mobs.splice(index, 1);
      return true;
    }
  }

  const wolfIndex = (state.wolves || []).findIndex(wolf => wolf.id === target.id);
  if (wolfIndex >= 0) {
    const drops = typeof mobDrop === 'function' && reason === 'defeated' ? mobDrop({ ...target, type: target.type || 'wolf' }, hunter) : null;
    if (drops?.items && typeof addItems === 'function') addItems(drops.items);
    if (drops?.resources && typeof addResources === 'function') addResources(drops.resources);
    state.wolves.splice(wolfIndex, 1);
    return true;
  }

  return false;
}

function ensureCombatRoute(c, task, threat) {
  if (!c || !task || !threat) return false;
  if (dist(c.x, c.y, threat.x, threat.y) <= DEFENSE_REPATH_DISTANCE) return true;
  const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(threat.x, threat.y, c.x, c.y) : null;
  if (!adj) {
    resetColonistTask(c, `Sem rota até ${threatLabel(threat)}`);
    return false;
  }
  task.x = adj.x;
  task.y = adj.y;
  c.path = typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, threat) : [];
  if (!Array.isArray(c.path) || !c.path.length) {
    resetColonistTask(c, `Sem rota até ${threatLabel(threat)}`);
    return false;
  }
  c.note = `Indo enfrentar ${threatLabel(threat)}`;
  return false;
}

function handleCombatTask(c, task, tick) {
  if (!c || !task || !['combat', 'scare'].includes(task.type)) return false;
  const targetInfo = findCombatTarget(task);
  if (!targetInfo?.entity) {
    resetColonistTask(c, 'Ameaça não existe mais');
    return true;
  }

  const threat = targetInfo.entity;
  const mode = task.type === 'scare' ? 'scare' : 'combat';
  if (!ensureCombatRoute(c, task, threat)) return true;

  const needed = Math.max(0.55, DEFENSE_COMBAT_WORK / Math.max(0.55, typeof workRate === 'function' ? workRate(c, 'defense', threat) : 1));
  c.work = Number(c.work || 0) + Math.max(0, tick);
  c.note = `${mode === 'scare' ? 'Afugentando' : 'Enfrentando'} ${threatLabel(threat)} ${Math.floor((c.work / needed) * 100)}%`;
  if (c.work < needed) return true;

  c.work = 0;
  threat.hp = clamp(Number(threat.hp ?? 100) - colonistCombatDamage(c, mode), 0, Math.max(100, Number(threat.maxHp || 100)));
  threat.health = threat.hp;
  threat.morale = clamp(Number(threat.morale ?? 100) - colonistMoralePressure(c, mode), 0, 100);
  applyCombatImpact(c, threat, mode === 'scare' ? 7 : 11);
  if (typeof emitBloodParticles === 'function' && mode === 'combat') emitBloodParticles(threat.px, threat.py, 4);

  if (threat.hp <= 0) {
    removeCombatTarget(targetInfo, c, 'defeated');
    resetColonistTask(c, 'Ameaça neutralizada');
    log(`${c.name} neutralizou ${threatLabel(threat)}.`);
    return true;
  }

  if (threat.morale <= 0) {
    removeCombatTarget(targetInfo, c, 'fled');
    resetColonistTask(c, 'Ameaça afugentada');
    log(`${c.name} afugentou ${threatLabel(threat)}.`);
    return true;
  }

  if (mode === 'combat') {
    const previousHealth = Number(c.health ?? 100);
    c.health = clamp(previousHealth - threatCounterDamage(threat), 1, 100);
    if (c.health < previousHealth) {
      c.hitAnimTimer = 0.18;
      if (typeof emitBloodParticles === 'function') emitBloodParticles(c.px, c.py, 2);
      if (c.health <= 1 && typeof makeColonistUnconscious === 'function') makeColonistUnconscious(c, 'Ferimento grave');
    }
  }

  return true;
}

function updateDefenseTick(dt) {
  installDefenseDefinitions();
  installDefenseBuildButton();
  if (!state || appScreen !== SCREEN.PLAYING) return;
  const tick = dt * state.speed;
  updateTrapCooldowns(tick);

  for (const wolf of state.wolves || []) {
    ensureWolfState?.(wolf);
    checkTrapTrigger(wolf);
  }

  const before = state.wolves.length;
  state.wolves = state.wolves.filter(w => (w.hp ?? 100) > 0 && (w.morale ?? 100) > 0);
  if (before !== state.wolves.length) log('Uma ameaça foi neutralizada por defesa passiva.');
}

window.defenseSystem.checkTrapTrigger = checkTrapTrigger;
window.defenseSystem.triggerSpikeTrap = triggerSpikeTrap;
window.defenseSystem.handleCombatTask = handleCombatTask;
window.defenseSystem.update = updateDefenseTick;
window.handleCombatTask = handleCombatTask;

installDefenseDefinitions();
installDefenseBuildButton();
window.GameSystems?.registerTaskHandler?.('combat', 'defense.combat', handleCombatTask, { order: 12 });
window.GameSystems?.registerTaskHandler?.('scare', 'defense.scare', handleCombatTask, { order: 12 });
window.GameSystems?.registerTick('defense', updateDefenseTick, { order: 50 });
