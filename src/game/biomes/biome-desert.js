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
      deer: { allowed: true, weight: 0.08 },
      goat: { allowed: true, weight: 0.34 },
      sheep: { allowed: true, weight: 0.10 },
      pig: { allowed: false, weight: 0 },
      cow: { allowed: false, weight: 0 },
      chicken: { allowed: true, weight: 0.18 },
      duck: { allowed: false, weight: 0 },
      turkey: { allowed: true, weight: 0.10 },
      squirrel: { allowed: true, weight: 0.12 },
      turtle: { allowed: true, weight: 0.20 },
      spider: { allowed: true, weight: 0.9, nightBonus: 0.75 },
      wolf: { allowed: true, weight: 0.18, nightBonus: 0.25 },
      blood_wolf: { allowed: false, weight: 0 }
    },
    climate: { temperature: 'hot', moisture: 'low' },
    color: 'rgba(196, 147, 62, .18)'
  });
})();
