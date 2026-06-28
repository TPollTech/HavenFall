'use strict';

(() => {
  BiomeRegistry.register({
    id: 'forest',
    label: 'Floresta temperada',
    tileFloor: 'grass',
    terrainWeights: { grass: 0.72, dirt: 0.20, stone: 0.08 },
    trees: ['oak_tree', 'birch_tree', 'pine_tree'],
    forageables: ['berry', 'herbs', 'mushrooms'],
    objects: {
      treeDensity: 1.25,
      berryDensity: 1.15,
      rockDensity: 0.75,
      oreDensity: 0.65,
      herbDensity: 1.05
    },
    spawnRules: {
      rabbit: { allowed: true, weight: 1.25 },
      deer: { allowed: true, weight: 0.95 },
      goat: { allowed: true, weight: 0.45 },
      sheep: { allowed: true, weight: 0.38 },
      pig: { allowed: true, weight: 0.42 },
      cow: { allowed: true, weight: 0.18 },
      chicken: { allowed: true, weight: 0.58 },
      duck: { allowed: true, weight: 0.36 },
      turkey: { allowed: true, weight: 0.30 },
      squirrel: { allowed: true, weight: 1.1 },
      turtle: { allowed: true, weight: 0.24 },
      spider: { allowed: true, weight: 0.45, nightBonus: 0.5 },
      wolf: { allowed: true, weight: 0.85, nightBonus: 0.45 },
      blood_wolf: { allowed: true, weight: 0.55, nightBonus: 0.85, difficultyBonus: { hard: 0.25, hardcore: 0.55 }, eventIntensityBonus: { high: 0.35 } }
    },
    climate: { temperature: 'mild', moisture: 'high' },
    color: 'rgba(38, 96, 48, .18)'
  });
})();
