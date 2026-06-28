'use strict';

window.HavenfallContext = window.HavenfallContext || {};

function installEnvironmentDefinitions() {
  if (window.HavenfallContext.environmentDefsInstalled) return;

  objectDefs.torch = {
    name: 'tocha fixa',
    img: 'weapon_torch',
    blocks: false,
    warmth: 3,
    fuelMax: 48,
    fuelUse: 1,
    roofBoundary: false
  };

  buildDefs.torch = {
    label: 'Tocha fixa',
    type: 'torch',
    cost: { wood: 3 },
    work: 2.4,
    requires: 'lighting'
  };

  window.HavenfallContext.environmentDefsInstalled = true;
}

function installTorchBuildButton() {
  const grid = document.querySelector('.build-grid');
  if (!grid || grid.querySelector('[data-build="torch"]')) return;
  const btn = document.createElement('button');
  btn.dataset.build = 'torch';
  btn.innerHTML = 'Tocha fixa<br><small>pesquisar iluminação</small>';
  grid.appendChild(btn);
}

function ensureColonistEnvironment(c) {
  c.wetness = clamp(c.wetness ?? 0, 0, 100);
  c.bodyTemperature = clamp(c.bodyTemperature ?? 37, 30, 41);
  c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
}

function addColonistStatus(c, status) {
  ensureColonistEnvironment(c);
  if (c.statuses.includes(status)) return false;
  c.statuses.push(status);
  return true;
}

function removeColonistStatus(c, status) {
  if (!Array.isArray(c.statuses)) return false;
  const before = c.statuses.length;
  c.statuses = c.statuses.filter(s => s !== status);
  return c.statuses.length !== before;
}

function hasRoofAt(x, y) {
  if (!state || !isInside(x, y)) return false;
  if (roofSet?.has?.(tileKey(x, y))) return true;

  const obj = getObjectAt(x, y);
  if (obj?.hasRoof) return true;

  let boundaries = 0;
  const checks = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2]
  ];

  for (let i = 0; i < checks.length; i++) {
    const nx = x + checks[i][0];
    const ny = y + checks[i][1];
    const near = getObjectAt(nx, ny);
    if (near?.type === 'wall' || near?.type === 'door') boundaries++;
  }

  return boundaries >= 3;
}

function torchHeatAt(x, y) {
  if (!state?.objects) return 0;
  let heat = 0;
  for (let i = 0; i < state.objects.length; i++) {
    const obj = state.objects[i];
    if (obj.type !== 'torch' && obj.type !== 'campfire') continue;
    if (obj.type === 'torch' && (obj.fuel ?? objectDefs.torch.fuelMax) <= 0) continue;
    const radius = obj.type === 'campfire' ? 3 : 4;
    const d = Math.abs(obj.x - x) + Math.abs(obj.y - y);
    if (d <= radius) heat += (radius - d + 1) / radius;
  }
  return heat;
}

function updateTorchFuel(tick) {
  if (!state?.objects) return;
  for (let i = 0; i < state.objects.length; i++) {
    const obj = state.objects[i];
    if (obj.type !== 'torch') continue;
    obj.fuel = obj.fuel ?? objectDefs.torch.fuelMax;
    if (obj.fuel <= 0) {
      obj.lit = false;
      continue;
    }
    obj.lit = true;
    obj.fuel = Math.max(0, obj.fuel - tick * 0.018);
    if (obj.fuel <= 0) log('Uma tocha apagou por falta de combustível.');
  }
}

function maybeRefuelTorches() {
  if (!state?.objects || state.resources.wood <= 0) return;
  const needy = state.objects.find(o => o.type === 'torch' && (o.fuel ?? objectDefs.torch.fuelMax) < 8);
  if (!needy) return;
  state.resources.wood -= 1;
  needy.fuel = Math.min(objectDefs.torch.fuelMax, (needy.fuel || 0) + 18);
  needy.lit = true;
  log(`Uma tocha foi reabastecida com 1 madeira do estoque.`);
}

function statusWorkMultiplier(c) {
  ensureColonistEnvironment(c);
  let mult = 1;
  if (c.statuses.includes('gripe')) mult *= 0.5;
  if (c.statuses.includes('hipotermia')) mult *= 0.42;
  if (c.wetness > 80) mult *= 0.85;
  return mult;
}

function statusMoveMultiplier(c) {
  ensureColonistEnvironment(c);
  let mult = 1;
  if (c.statuses.includes('gripe')) mult *= 0.7;
  if (c.statuses.includes('hipotermia')) mult *= 0.62;
  return mult;
}

function installEnvironmentPatches() {
  if (window.HavenfallContext.environmentPatchesInstalled) return;
  window.GameSystems?.registerWorkRateModifier('environment.status', (rate, c) => rate * statusWorkMultiplier(c), { order: 10 });
  window.GameSystems?.registerMovementModifier('environment.status', (c, multiplier) => multiplier * statusMoveMultiplier(c), { order: 10 });

  window.HavenfallContext.environmentPatchesInstalled = true;
}

function updateColonistEnvironment(c, tick) {
  ensureColonistEnvironment(c);
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const roofed = hasRoofAt(x, y);
  const heat = torchHeatAt(x, y);
  const raining = state.weather === 'chuva';

  if (raining && !roofed) {
    c.wetness = clamp(c.wetness + tick * 0.75, 0, 100);
    c.bodyTemperature = clamp(c.bodyTemperature - tick * 0.018, 30, 41);
  } else {
    c.wetness = clamp(c.wetness - tick * (heat > 0 ? 2.2 : 0.85), 0, 100);
  }

  if (heat > 0) c.bodyTemperature = clamp(c.bodyTemperature + tick * 0.04 * heat, 30, 37.4);
  else if (!raining) c.bodyTemperature = clamp(c.bodyTemperature + tick * 0.006, 30, 37);

  if (c.wetness > 80) {
    if (addColonistStatus(c, 'molhado')) log(`${c.name} está encharcado e desconfortável.`);
    c.mood = clamp(c.mood - tick * 0.035, 0, 100);
  } else if (c.wetness < 35) {
    removeColonistStatus(c, 'molhado');
  }

  if (c.wetness > 85 && c.bodyTemperature < 36.2 && Math.random() < 0.0009 * state.speed) {
    if (addColonistStatus(c, 'gripe')) log(`${c.name} ficou gripado depois de trabalhar molhado no frio.`);
  }

  if (c.bodyTemperature < 34.5) {
    if (addColonistStatus(c, 'hipotermia')) log(`${c.name} precisa se aquecer perto de uma tocha ou fogueira.`);
  } else if (c.bodyTemperature > 36.1 && heat > 0) {
    if (removeColonistStatus(c, 'hipotermia')) log(`${c.name} recuperou a temperatura perto do fogo.`);
  }

  if (c.statuses.includes('gripe')) {
    c.energy = clamp(c.energy - tick * 0.018, 0, 100);
    if (c.wetness < 20 && c.energy > 65 && Math.random() < 0.0007 * state.speed) {
      if (removeColonistStatus(c, 'gripe')) log(`${c.name} se recuperou da gripe.`);
    }
  }
}

function updateEnvironmentTick(dt) {
  installEnvironmentDefinitions();
  installTorchBuildButton();
  installEnvironmentPatches();
  if (!state || appScreen !== SCREEN.PLAYING) return;

  const tick = dt * state.speed;
  updateTorchFuel(tick);
  if (Math.random() < 0.002 * state.speed) maybeRefuelTorches();

  for (let i = 0; i < state.colonists.length; i++) {
    updateColonistEnvironment(state.colonists[i], tick);
  }
}

installEnvironmentDefinitions();
installTorchBuildButton();
window.GameSystems?.registerTick('environment', updateEnvironmentTick, { order: 40 });
