'use strict';

(() => {
  const BLOOD_WOLF_TYPE = 'blood_wolf';
  const BLOOD_WOLF_CAP = 2;
  const BLOOD_WOLF_BASE_CHANCE = 0.006;

  function installBloodWolfConfig() {
    if (!window.mobSpawnConfig) return;
    window.mobSpawnConfig[BLOOD_WOLF_TYPE] = {
      maxCount: BLOOD_WOLF_CAP,
      spawnChance: 0,
      hostile: true,
      biomeLocked: true
    };
  }

  function countBloodWolves() {
    return (state?.wolves || []).filter(w => w.type === BLOOD_WOLF_TYPE).length;
  }

  function bloodWolfSpawnMultiplier() {
    const hour = Number(state?.hour || 12);
    const night = hour < 6 || hour > 20;
    const difficulty = state?.config?.difficulty || 'normal';
    const intensity = state?.config?.eventIntensity || 'normal';
    let mult = night ? 1.75 : 0.45;
    if (difficulty === 'hard') mult += 0.35;
    if (difficulty === 'hardcore') mult += 0.75;
    if (intensity === 'high') mult += 0.35;
    if (intensity === 'low') mult -= 0.25;
    return Math.max(0, mult);
  }

  function canSpawnBloodWolf() {
    if (!state || appScreen !== SCREEN.PLAYING) return false;
    if (!Array.isArray(state.wolves)) state.wolves = [];
    if (countBloodWolves() >= BLOOD_WOLF_CAP) return false;
    if (typeof countHostileMobs === 'function' && countHostileMobs() >= MOB_HOSTILE_DENSITY_CAP) return false;
    if (typeof allMobileEntities === 'function' && allMobileEntities().length >= MOB_GLOBAL_DENSITY_CAP) return false;
    return true;
  }

  function randomBloodWolfTile() {
    for (let i = 0; i < 180; i++) {
      const tile = typeof randomSafeEdgeTile === 'function' ? randomSafeEdgeTile(BLOOD_WOLF_TYPE) : null;
      if (!tile) continue;
      if (typeof isValidMobSpawnTile === 'function' && !isValidMobSpawnTile(BLOOD_WOLF_TYPE, tile)) continue;
      if (window.BiomeEngine && !window.BiomeEngine.canSpawnMobAt(BLOOD_WOLF_TYPE, tile.x, tile.y, state?.config || {})) continue;
      return tile;
    }
    return null;
  }

  function spawnBloodWolf(tile = null) {
    installBloodWolfConfig();
    if (!canSpawnBloodWolf()) return null;
    const t = tile || randomBloodWolfTile();
    if (!t) return null;
    const wolf = {
      id: uid(),
      type: BLOOD_WOLF_TYPE,
      x: t.x,
      y: t.y,
      px: t.x * TILE + TILE / 2,
      py: t.y * TILE + TILE / 2,
      anim: 0,
      dir: 'left',
      hp: 135,
      morale: 125,
      aggression: 1.45 + Math.random() * 0.35,
      state: 'hunting',
      attackAnimTimer: 0,
      hitAnimTimer: 0,
      biomeId: window.BiomeEngine?.getBiomeIdAt?.(t.x, t.y) || 'forest'
    };
    state.wolves.push(wolf);
    if (typeof gameLog === 'function') gameLog('Um Lobo de Sangue ronda a borda da colônia.', 'danger');
    else if (typeof log === 'function') log('Um Lobo de Sangue ronda a borda da colônia.');
    return wolf;
  }

  function maybeSpawnBloodWolf(dt) {
    if (!canSpawnBloodWolf()) return;
    const chance = BLOOD_WOLF_BASE_CHANCE * bloodWolfSpawnMultiplier() * Number(dt || 0) * Number(state?.speed || 1);
    if (Math.random() < chance) spawnBloodWolf();
  }

  function installBloodWolfTick() {
    if (window.HavenfallContext?.bloodWolfTickInstalled || typeof updateMobsTick !== 'function') return;
    const nativeUpdateMobsTick = updateMobsTick;
    updateMobsTick = function updateMobsTickWithBloodWolf(dt) {
      nativeUpdateMobsTick(dt);
      maybeSpawnBloodWolf(dt);
    };
    window.HavenfallContext.bloodWolfTickInstalled = true;
  }

  function installBloodWolfRenderer() {
    if (window.HavenfallContext?.bloodWolfRendererInstalled || typeof drawWolf !== 'function') return;
    const nativeDrawWolf = drawWolf;
    drawWolf = function drawWolfWithBloodWolf(wolf) {
      nativeDrawWolf(wolf);
      if (wolf?.type !== BLOOD_WOLF_TYPE) return;
      ctx.save();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(wolf.px, wolf.py + 16, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    };
    window.HavenfallContext.bloodWolfRendererInstalled = true;
  }

  window.spawnBloodWolf = spawnBloodWolf;
  window.countBloodWolves = countBloodWolves;

  window.HavenfallContext = window.HavenfallContext || {};
  installBloodWolfConfig();
  installBloodWolfTick();
  installBloodWolfRenderer();
})();
