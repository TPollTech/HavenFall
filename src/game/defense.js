'use strict';

window.defenseSystem = window.defenseSystem || {};

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
window.defenseSystem.update = updateDefenseTick;

installDefenseDefinitions();
installDefenseBuildButton();
