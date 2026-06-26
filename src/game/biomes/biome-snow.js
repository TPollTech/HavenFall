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
      spider: { allowed: false, weight: 0 },
      wolf: { allowed: true, weight: 1.05, nightBonus: 0.35 },
      blood_wolf: { allowed: true, weight: 0.72, nightBonus: 0.95, difficultyBonus: { hard: 0.32, hardcore: 0.72 }, eventIntensityBonus: { high: 0.45 } }
    },
    climate: { temperature: 'cold', moisture: 'medium' },
    color: 'rgba(174, 205, 226, .16)'
  });
})();
