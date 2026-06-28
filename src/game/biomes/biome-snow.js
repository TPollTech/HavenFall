'use strict';

(() => {
  BiomeRegistry.register({
    id: 'snow',
    label: 'Neve profunda',
    tileFloor: 'stone',
    terrainWeights: { stone: 0.44, dirt: 0.30, grass: 0.26 },
    trees: ['pine_tree'],
    forageables: ['dry_twigs', 'herbs'],
    objects: {
      treeDensity: 0.62,
      berryDensity: 0.16,
      rockDensity: 1.28,
      oreDensity: 1.05,
      herbDensity: 0.22
    },
    spawnRules: {
      rabbit: { allowed: true, weight: 0.38 },
      deer: { allowed: true, weight: 0.58 },
      goat: { allowed: true, weight: 0.18 },
      sheep: { allowed: true, weight: 0.24 },
      pig: { allowed: false, weight: 0 },
      cow: { allowed: false, weight: 0 },
      chicken: { allowed: true, weight: 0.08 },
      duck: { allowed: true, weight: 0.10 },
      turkey: { allowed: true, weight: 0.16 },
      squirrel: { allowed: true, weight: 0.32 },
      turtle: { allowed: false, weight: 0 },
      spider: { allowed: false, weight: 0 },
      wolf: { allowed: true, weight: 1.05, nightBonus: 0.35 },
      blood_wolf: { allowed: true, weight: 0.72, nightBonus: 0.95, difficultyBonus: { hard: 0.32, hardcore: 0.72 }, eventIntensityBonus: { high: 0.45 } }
    },
    climate: { temperature: 'cold', moisture: 'medium' },
    color: 'rgba(174, 205, 226, .16)'
  });
})();
