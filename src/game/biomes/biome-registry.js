'use strict';

(() => {
  const definitions = {};

  function normalizeMobRule(rule) {
    if (rule === false || rule == null) return { allowed: false, weight: 0 };
    if (rule === true) return { allowed: true, weight: 1 };
    return {
      allowed: rule.allowed !== false,
      weight: Number(rule.weight ?? 1),
      nightBonus: Number(rule.nightBonus ?? 0),
      minHour: rule.minHour,
      maxHour: rule.maxHour,
      difficultyBonus: rule.difficultyBonus || {},
      eventIntensityBonus: rule.eventIntensityBonus || {}
    };
  }

  function registerBiome(definition) {
    if (!definition?.id) return null;
    const normalized = {
      id: definition.id,
      label: definition.label || definition.id,
      tileFloor: definition.tileFloor || 'grass',
      terrainWeights: definition.terrainWeights || {},
      trees: Array.isArray(definition.trees) ? definition.trees : ['tree'],
      forageables: Array.isArray(definition.forageables) ? definition.forageables : [],
      objects: definition.objects || {},
      spawnRules: definition.spawnRules || {},
      climate: definition.climate || {},
      color: definition.color || 'rgba(255,255,255,.04)'
    };
    definitions[normalized.id] = Object.freeze(normalized);
    return definitions[normalized.id];
  }

  function getBiome(id) {
    return definitions[id] || definitions.forest || Object.values(definitions)[0] || null;
  }

  function allBiomes() {
    return Object.freeze({ ...definitions });
  }

  function spawnRuleFor(mobType, biomeId) {
    const biome = getBiome(biomeId);
    if (!biome) return { allowed: true, weight: 1 };
    return normalizeMobRule(biome.spawnRules?.[mobType]);
  }

  function canSpawnMobInBiome(mobType, biomeId, context = {}) {
    const rule = spawnRuleFor(mobType, biomeId);
    if (!rule.allowed || rule.weight <= 0) return false;
    const hour = Number(context.hour ?? state?.hour ?? 12);
    if (rule.minHour != null && hour < rule.minHour) return false;
    if (rule.maxHour != null && hour > rule.maxHour) return false;
    return true;
  }

  function spawnWeightFor(mobType, biomeId, context = {}) {
    if (!canSpawnMobInBiome(mobType, biomeId, context)) return 0;
    const rule = spawnRuleFor(mobType, biomeId);
    const hour = Number(context.hour ?? state?.hour ?? 12);
    const isNight = hour < 6 || hour > 20;
    const difficulty = context.difficulty || state?.config?.difficulty || 'normal';
    const intensity = context.eventIntensity || state?.config?.eventIntensity || 'normal';
    let weight = Number(rule.weight || 0);
    if (isNight) weight += Number(rule.nightBonus || 0);
    weight += Number(rule.difficultyBonus?.[difficulty] || 0);
    weight += Number(rule.eventIntensityBonus?.[intensity] || 0);
    return Math.max(0, weight);
  }

  window.BiomeRegistry = {
    register: registerBiome,
    get: getBiome,
    all: allBiomes,
    canSpawnMobInBiome,
    spawnWeightFor,
    spawnRuleFor
  };
})();
