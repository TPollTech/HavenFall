'use strict';

(() => {
  BiomeRegistry.register({
    id: 'desert',
    label: 'Deserto seco',
    tileFloor: 'sand',
    terrainWeights: { sand: 0.76, dirt: 0.18, stone: 0.06 },
    trees: ['palm_tree'],
    forageables: ['dry_twigs'],
    objects: {
      treeDensity: 0.18,
      berryDensity: 0.05,
      rockDensity: 1.05,
      oreDensity: 0.9,
      herbDensity: 0.12
    },
    spawnRules: {
      rabbit: { allowed: true, weight: 0.22 },
      spider: { allowed: true, weight: 0.9, nightBonus: 0.75 },
      wolf: { allowed: true, weight: 0.18, nightBonus: 0.25 },
      blood_wolf: { allowed: false, weight: 0 }
    },
    climate: { temperature: 'hot', moisture: 'low' },
    color: 'rgba(196, 147, 62, .18)'
  });
})();
