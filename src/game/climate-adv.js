'use strict';

function ensureEnvironmentState() {
  if (!state) return null;
  state.environment = state.environment || {};
  state.environment.externalTemperature = state.environment.externalTemperature ?? 18;
  state.environment.roomTemperature = state.environment.roomTemperature || {};
  return state.environment;
}

function calculateExternalTemperature() {
  const hour = state?.hour || 12;
  const night = hour < 6 || hour > 20;
  const rainPenalty = state.weather === 'chuva' ? 4 : 0;
  const nightPenalty = night ? 6 : 0;
  return clamp(22 - rainPenalty - nightPenalty, 6, 28);
}

function tileHasThermalRoof(x, y) {
  if (typeof hasNaturalRoofAt === 'function' && hasNaturalRoofAt(x, y)) return true;
  if (typeof hasRoofAt === 'function') return !!hasRoofAt(x, y);
  return false;
}

function insulationFactorAt(x, y) {
  const naturalRoof = tileHasThermalRoof(x, y);
  if (naturalRoof) return isResearched('thermal_comfort') ? 0.92 : 0.68;
  if (!isResearched('thermal_comfort')) return 0.3;
  return 0.45;
}

function roomTemperatureAt(x, y) {
  const env = ensureEnvironmentState();
  if (!env) return 18;
  const external = env.externalTemperature;
  const heat = typeof torchHeatAt === 'function' ? torchHeatAt(x, y) : 0;
  const factor = insulationFactorAt(x, y);
  return clamp(external + heat * 5 * (1 + factor), 6, 28);
}

function updateRoomTemperatureMap() {
  const env = ensureEnvironmentState();
  if (!env) return;
  env.externalTemperature = calculateExternalTemperature();
  env.roomTemperature = env.roomTemperature || {};

  for (const c of state.colonists || []) {
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    env.roomTemperature[String((x << 16) | y)] = roomTemperatureAt(x, y);
  }
}

function installClimatePatches() {
  if (window.HavenfallContext?.climateAdvPatchesInstalled || typeof updateColonistEnvironment !== 'function') return;
  window.HavenfallContext = window.HavenfallContext || {};
  const nativeUpdateColonistEnvironment = updateColonistEnvironment;

  updateColonistEnvironment = function updateColonistEnvironmentWithRooms(c, tick) {
    nativeUpdateColonistEnvironment(c, tick);
    const env = ensureEnvironmentState();
    if (!env || !c) return;
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const roomTemp = roomTemperatureAt(x, y);
    c.roomTemperature = roomTemp;
    c.immunity = clamp(c.immunity ?? 35, 0, 100);

    if (c.statuses?.includes('gripe')) {
      const comfort = roomTemp >= 18 && roomTemp <= 25 ? 0.035 : 0.012;
      const medical = isResearched('medicine') ? 0.028 : 0;
      c.immunity = clamp(c.immunity + tick * (comfort + medical), 0, 100);
      if (c.immunity >= 100) {
        if (typeof removeColonistStatus === 'function') removeColonistStatus(c, 'gripe');
        c.immunity = 45;
        log(`${c.name} desenvolveu imunidade e se recuperou da gripe.`);
      }
    } else {
      c.immunity = clamp((c.immunity || 35) + tick * 0.004, 0, 100);
    }
  };

  window.HavenfallContext.climateAdvPatchesInstalled = true;
}

function updateClimateAdvancedTick() {
  if (!state || appScreen !== SCREEN.PLAYING) return;
  if (typeof ensureGeologyState === 'function') ensureGeologyState();
  ensureEnvironmentState();
  updateRoomTemperatureMap();
  installClimatePatches();
}

window.updateRoomTemperature = function updateRoomTemperature(room) {
  if (!room) return;
  const objects = Array.isArray(room.objects) ? room.objects : [];
  const heatSources = objects.filter(o => o.type === 'torch' || o.type === 'campfire').length;
  const external = ensureEnvironmentState()?.externalTemperature || 18;
  const insulation = isResearched('thermal_comfort') ? 0.8 : 0.3;
  room.temperature = clamp(external + heatSources * 5 * (1 + insulation), 6, 28);
};

window.roomTemperatureAt = roomTemperatureAt;
window.ensureEnvironmentState = ensureEnvironmentState;
window.tileHasThermalRoof = tileHasThermalRoof;
