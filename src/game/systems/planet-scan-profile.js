'use strict';

(() => {
  const BIOME_KEYS = ['forest', 'desert', 'snow', 'rock', 'water'];

  function stableHash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    const str = String(text || 'scan');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randFor(config, salt = 'profile') {
    const seed = `${config?.seed || 'scan'}|${config?.difficulty || 'normal'}|${config?.mapSize || 'giant'}|${config?.eventIntensity || 'normal'}|${salt}`;
    return typeof seededRandom === 'function' ? seededRandom(seed) : (() => (stableHash(seed + Math.random()) % 100000) / 100000);
  }

  function normalizeStats(stats) {
    const total = Math.max(1, Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0));
    const normalized = {};
    let used = 0;
    BIOME_KEYS.forEach((key, index) => {
      if (index === BIOME_KEYS.length - 1) {
        normalized[key] = Math.max(0, 100 - used);
      } else {
        normalized[key] = Math.max(0, Math.round((Number(stats[key] || 0) / total) * 100));
        used += normalized[key];
      }
    });
    return normalized;
  }

  function buildBiomeStats(config, rand) {
    const map = config?.mapSize || 'giant';
    const difficulty = config?.difficulty || 'normal';
    const events = config?.eventIntensity || 'normal';
    const stats = {
      forest: 38 + rand() * 22,
      desert: 12 + rand() * 18,
      snow: 10 + rand() * 18,
      rock: 18 + rand() * 24,
      water: 4 + rand() * 12
    };

    if (map === 'large') { stats.forest += 7; stats.water -= 2; }
    if (map === 'huge') { stats.rock += 4; stats.desert += 2; }
    if (map === 'giant') { stats.snow += 5; stats.rock += 6; stats.desert += 4; }
    if (map === 'infinite_chunks') { stats.snow += 8; stats.rock += 9; stats.desert += 7; stats.forest -= 4; }

    if (difficulty === 'hard') { stats.rock += 5; stats.desert += 3; }
    if (difficulty === 'hardcore') { stats.rock += 8; stats.desert += 6; stats.snow += 5; stats.forest -= 6; }
    if (events === 'high') { stats.desert += 4; stats.snow += 3; stats.water += 2; }
    if (events === 'low') { stats.forest += 5; stats.rock -= 2; }

    const profile = config?.sectorProfile || 'balanced';
    if (profile === 'forest') { stats.forest += 22; stats.water += 4; stats.desert -= 8; stats.rock -= 4; }
    if (profile === 'water') { stats.water += 18; stats.forest += 7; stats.desert -= 6; stats.snow -= 3; }
    if (profile === 'rock') { stats.rock += 22; stats.desert += 5; stats.forest -= 9; stats.water -= 3; }
    if (profile === 'harsh') { stats.desert += 13; stats.snow += 11; stats.rock += 9; stats.forest -= 15; stats.water -= 4; }

    return normalizeStats(stats);
  }

  function strongest(stats) {
    return Object.entries(stats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'forest';
  }

  function buildMetrics(config, stats, rand) {
    const difficultyBonus = ({ easy: -8, normal: 0, hard: 12, hardcore: 22 })[config?.difficulty || 'normal'] || 0;
    const eventBonus = ({ low: -10, normal: 0, high: 16 })[config?.eventIntensity || 'normal'] || 0;
    const geology = Math.max(4, Math.min(98, Math.round(24 + stats.rock * 0.78 + stats.desert * 0.22 + rand() * 12)));
    const biology = Math.max(4, Math.min(98, Math.round(18 + stats.forest * 0.82 + stats.water * 0.30 - stats.desert * 0.18 + rand() * 10)));
    const climate = Math.max(4, Math.min(98, Math.round(18 + stats.snow * 0.58 + stats.desert * 0.45 + eventBonus + rand() * 12)));
    const noise = Math.max(4, Math.min(98, Math.round(22 + difficultyBonus + eventBonus * 0.6 + rand() * 22)));
    const priority = config?.landingPriority || 'safe';
    const priorityLanding = ({ safe: 10, resources: -2, exploration: -5, challenge: -14 })[priority] || 0;
    const landing = Math.max(4, Math.min(98, Math.round(88 + priorityLanding - climate * 0.25 - noise * 0.18 - Math.max(0, difficultyBonus) * 0.25)));
    return { geology, biology, climate, noise, landing };
  }

  function buildSignatureSummary(config, dominantBiome, metrics, rand) {
    const base = ({ low: 2, normal: 3, high: 4 })[config?.eventIntensity || 'normal'] || 3;
    const bonus = ({ easy: -1, normal: 0, hard: 1, hardcore: 2 })[config?.difficulty || 'normal'] || 0;
    const count = Math.max(1, base + bonus);
    const riskLevel = metrics.noise > 72 || metrics.climate > 76 ? 'elevado' : metrics.noise > 46 ? 'moderado' : 'baixo';
    const typesByBiome = {
      forest: ['organic', 'fauna', 'ruin'],
      desert: ['heat', 'ruin', 'dust'],
      snow: ['cold', 'geology', 'ruin'],
      rock: ['metal', 'collapse', 'geology'],
      water: ['water', 'humidity', 'ruin']
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `sig_${i}`,
      kind: (typesByBiome[dominantBiome] || typesByBiome.forest)[Math.floor(rand() * 3)],
      risk: i === 0 ? riskLevel : (rand() > 0.72 ? 'elevado' : rand() > 0.38 ? 'moderado' : 'baixo')
    }));
  }

  function buildPlanetScanWorldgenProfile(config = {}) {
    config = typeof normalizeNewGameConfig === 'function' ? normalizeNewGameConfig(config) : { ...config };
    const rand = randFor(config, 'worldgen-profile-v1');
    const stats = buildBiomeStats(config, rand);
    const dominantBiome = strongest(stats);
    const metrics = buildMetrics(config, stats, rand);
    const sectorId = `HV-${String(stableHash(`${config.seed || 'scan'}|sector`)).slice(0, 5).toUpperCase()}`;
    const signatures = buildSignatureSummary(config, dominantBiome, metrics, rand);

    return {
      version: 'planet-scan-profile-v1',
      seed: config.seed || '',
      sectorProfile: config.sectorProfile || 'balanced',
      landingPriority: config.landingPriority || 'safe',
      sectorId,
      dominantBiome,
      biomeStats: stats,
      metrics,
      signatures,
      modifiers: {
        forestBias: Math.round((stats.forest - 35) / 10) / 10,
        desertBias: Math.round((stats.desert - 18) / 10) / 10,
        snowBias: Math.round((stats.snow - 16) / 10) / 10,
        rockBias: Math.round((stats.rock - 24) / 10) / 10,
        waterBias: Math.round((stats.water - 8) / 10) / 10,
        weatherRisk: Math.round((metrics.climate + metrics.noise) / 2),
        landingIntegrity: metrics.landing
      }
    };
  }

  function attachPlanetScanToConfig(config = {}) {
    const profile = buildPlanetScanWorldgenProfile(config);
    return { ...config, planetScan: profile };
  }

  function ensurePlanetScanOnConfig(config = {}) {
    const normalized = typeof normalizeNewGameConfig === 'function' ? normalizeNewGameConfig(config) : { ...config };
    const current = normalized.planetScan;
    if (current?.version === 'planet-scan-profile-v1'
      && (!current.seed || current.seed === normalized.seed)
      && (current.sectorProfile || 'balanced') === (normalized.sectorProfile || 'balanced')
      && (current.landingPriority || 'safe') === (normalized.landingPriority || 'safe')) {
      return { ...normalized, planetScan: current };
    }
    return attachPlanetScanToConfig(normalized);
  }

  window.buildPlanetScanWorldgenProfile = buildPlanetScanWorldgenProfile;
  window.attachPlanetScanToConfig = attachPlanetScanToConfig;
  window.ensurePlanetScanOnConfig = ensurePlanetScanOnConfig;
})();
