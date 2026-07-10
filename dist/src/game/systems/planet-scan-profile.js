'use strict';

(() => {
  const BIOME_KEYS = ['forest', 'desert', 'snow', 'rock', 'water'];

  const BIOME_LABELS = Object.freeze({
    forest: 'Floresta temperada',
    desert: 'Deserto seco',
    snow: 'Região fria',
    rock: 'Vale rochoso',
    water: 'Bacia hídrica'
  });

  const ARCHETYPES = Object.freeze({
    safe: {
      label: 'Clareira Segura',
      subtitle: 'Pouso seguro · recursos equilibrados',
      primary: 'forest',
      secondary: ['meadow'],
      baseResources: { wood: 66, food: 62, stone: 42, metal: 24, medicine: 44, water: 36 },
      baseRisks: { fauna: 18, weather: 20, disease: 14, raids: 12, terrain: 14 },
      buildSpace: 82,
      fertility: 68,
      modifiers: { treeMultiplier: 1.02, rockMultiplier: 0.92, oreMultiplier: 0.78, berryMultiplier: 1.10, riverChance: 0.16, mountainChance: 0.10, ruinChance: 0.05, spawnClearingRadius: 8, initialThreatMultiplier: 0.70, poiMultiplier: 0.85 },
      signatures: ['vale_protegido']
    },
    dense_forest: {
      label: 'Mata Fechada',
      subtitle: 'Madeira abundante · fauna ativa',
      primary: 'forest',
      secondary: ['meadow', 'fauna'],
      baseResources: { wood: 88, food: 70, stone: 28, metal: 18, medicine: 58, water: 38 },
      baseRisks: { fauna: 58, weather: 34, disease: 22, raids: 16, terrain: 38 },
      buildSpace: 42,
      fertility: 78,
      modifiers: { treeMultiplier: 1.55, rockMultiplier: 0.72, oreMultiplier: 0.70, berryMultiplier: 1.42, riverChance: 0.24, mountainChance: 0.10, ruinChance: 0.09, spawnClearingRadius: 6, initialThreatMultiplier: 1.18, poiMultiplier: 0.95 },
      signatures: ['atividade_biologica', 'zona_fertil']
    },
    rocky_valley: {
      label: 'Vale de Basalto',
      subtitle: 'Pedra e metal · defesa natural',
      primary: 'rock',
      secondary: ['geology', 'mineral'],
      baseResources: { wood: 28, food: 28, stone: 86, metal: 74, medicine: 20, water: 20 },
      baseRisks: { fauna: 22, weather: 32, disease: 12, raids: 22, terrain: 62 },
      buildSpace: 48,
      fertility: 26,
      modifiers: { treeMultiplier: 0.62, rockMultiplier: 1.62, oreMultiplier: 1.75, berryMultiplier: 0.62, riverChance: 0.09, mountainChance: 0.55, ruinChance: 0.12, spawnClearingRadius: 6, initialThreatMultiplier: 0.95, poiMultiplier: 1.08 },
      signatures: ['falha_geologica', 'eco_metalico']
    },
    riverbank: {
      label: 'Margem Alagada',
      subtitle: 'Água e fertilidade · umidade alta',
      primary: 'water',
      secondary: ['forest', 'riverbank'],
      baseResources: { wood: 64, food: 76, stone: 30, metal: 18, medicine: 52, water: 90 },
      baseRisks: { fauna: 36, weather: 54, disease: 48, raids: 14, terrain: 40 },
      buildSpace: 46,
      fertility: 88,
      modifiers: { treeMultiplier: 1.18, rockMultiplier: 0.74, oreMultiplier: 0.70, berryMultiplier: 1.36, riverChance: 0.86, mountainChance: 0.08, ruinChance: 0.10, spawnClearingRadius: 7, initialThreatMultiplier: 0.92, poiMultiplier: 1.00 },
      signatures: ['bacia_hidrica', 'zona_fertil']
    },
    dry_desert: {
      label: 'Planície Seca',
      subtitle: 'Campo aberto · escassez severa',
      primary: 'desert',
      secondary: ['dust', 'open'],
      baseResources: { wood: 18, food: 22, stone: 58, metal: 36, medicine: 18, water: 12 },
      baseRisks: { fauna: 16, weather: 68, disease: 18, raids: 28, terrain: 36 },
      buildSpace: 78,
      fertility: 16,
      modifiers: { treeMultiplier: 0.38, rockMultiplier: 1.10, oreMultiplier: 1.05, berryMultiplier: 0.32, riverChance: 0.03, mountainChance: 0.18, ruinChance: 0.16, spawnClearingRadius: 8, initialThreatMultiplier: 0.86, poiMultiplier: 1.02 },
      signatures: ['instabilidade_climatica']
    },
    frozen_mountain: {
      label: 'Cordilheira Fria',
      subtitle: 'Sobrevivência climática · minério bom',
      primary: 'snow',
      secondary: ['rock', 'cold'],
      baseResources: { wood: 24, food: 18, stone: 76, metal: 68, medicine: 16, water: 34 },
      baseRisks: { fauna: 12, weather: 82, disease: 12, raids: 20, terrain: 70 },
      buildSpace: 36,
      fertility: 12,
      modifiers: { treeMultiplier: 0.48, rockMultiplier: 1.34, oreMultiplier: 1.48, berryMultiplier: 0.38, riverChance: 0.10, mountainChance: 0.66, ruinChance: 0.13, spawnClearingRadius: 5, initialThreatMultiplier: 0.72, poiMultiplier: 1.10 },
      signatures: ['instabilidade_climatica', 'falha_geologica']
    },
    ancient_ruins: {
      label: 'Posto Abandonado',
      subtitle: 'Loot e sucata · risco narrativo',
      primary: 'rock',
      secondary: ['ruins', 'scrap'],
      baseResources: { wood: 38, food: 34, stone: 56, metal: 70, medicine: 32, water: 26 },
      baseRisks: { fauna: 28, weather: 36, disease: 24, raids: 58, terrain: 52 },
      buildSpace: 54,
      fertility: 34,
      modifiers: { treeMultiplier: 0.82, rockMultiplier: 1.12, oreMultiplier: 1.22, berryMultiplier: 0.72, riverChance: 0.12, mountainChance: 0.28, ruinChance: 0.54, spawnClearingRadius: 6, initialThreatMultiplier: 1.25, poiMultiplier: 1.55 },
      signatures: ['ruina_detectada', 'eco_metalico']
    },
    extreme: {
      label: 'Zona Instável',
      subtitle: 'Risco extremo · recompensas raras',
      primary: 'desert',
      secondary: ['rock', 'ruins'],
      baseResources: { wood: 24, food: 24, stone: 72, metal: 84, medicine: 24, water: 16 },
      baseRisks: { fauna: 62, weather: 78, disease: 42, raids: 72, terrain: 74 },
      buildSpace: 32,
      fertility: 18,
      modifiers: { treeMultiplier: 0.55, rockMultiplier: 1.42, oreMultiplier: 1.88, berryMultiplier: 0.55, riverChance: 0.08, mountainChance: 0.45, ruinChance: 0.45, spawnClearingRadius: 4, initialThreatMultiplier: 1.65, poiMultiplier: 1.45 },
      signatures: ['instabilidade_climatica', 'ruina_detectada', 'falha_geologica']
    }
  });

  const ARCHETYPE_ORDER = ['safe', 'dense_forest', 'rocky_valley', 'riverbank', 'dry_desert', 'frozen_mountain', 'ancient_ruins', 'extreme'];

  const SIGNATURE_DETAILS = Object.freeze({
    falha_geologica: { name: 'Falha geológica', kind: 'geology', biome: 'rock', positive: 'Mais pedra e minério', negative: 'Terreno mais irregular' },
    atividade_biologica: { name: 'Atividade biológica', kind: 'fauna', biome: 'forest', positive: 'Mais caça, frutas e ervas', negative: 'Fauna mais ativa' },
    bacia_hidrica: { name: 'Bacia hídrica', kind: 'water', biome: 'water', positive: 'Água e fertilidade próximas', negative: 'Risco de umidade e doença' },
    ruina_detectada: { name: 'Ruína detectada', kind: 'ruin', biome: 'rock', positive: 'Loot e estruturas aproveitáveis', negative: 'Possível ameaça próxima' },
    eco_metalico: { name: 'Eco metálico', kind: 'metal', biome: 'rock', positive: 'Sucata e minério próximos', negative: 'Sinal pode atrair risco' },
    instabilidade_climatica: { name: 'Instabilidade climática', kind: 'weather', biome: 'desert', positive: 'Recursos raros expostos', negative: 'Clima mais agressivo' },
    zona_fertil: { name: 'Zona fértil', kind: 'fertile', biome: 'forest', positive: 'Plantio favorecido', negative: 'Vegetação exige limpeza' },
    vale_protegido: { name: 'Vale protegido', kind: 'safe', biome: 'forest', positive: 'Pouso mais seguro', negative: 'Poucas recompensas especiais' }
  });

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, Number(v) || 0));
  }

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
    const geology = clamp(Math.round(24 + stats.rock * 0.78 + stats.desert * 0.22 + rand() * 12), 4, 98);
    const biology = clamp(Math.round(18 + stats.forest * 0.82 + stats.water * 0.30 - stats.desert * 0.18 + rand() * 10), 4, 98);
    const climate = clamp(Math.round(18 + stats.snow * 0.58 + stats.desert * 0.45 + eventBonus + rand() * 12), 4, 98);
    const noise = clamp(Math.round(22 + difficultyBonus + eventBonus * 0.6 + rand() * 22), 4, 98);
    const priority = config?.landingPriority || 'safe';
    const priorityLanding = ({ safe: 10, resources: -2, exploration: -5, challenge: -14 })[priority] || 0;
    const landing = clamp(Math.round(88 + priorityLanding - climate * 0.25 - noise * 0.18 - Math.max(0, difficultyBonus) * 0.25), 4, 98);
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

  function landingCountForMap(mapSize) {
    return ({ large: 5, huge: 7, giant: 9, infinite_chunks: 12 })[mapSize] || 7;
  }

  function pickArchetypeSequence(config, count, stats) {
    const preferred = [];
    const priority = config?.landingPriority || 'safe';
    const dominant = strongest(stats);

    if (priority === 'safe') preferred.push('safe');
    if (priority === 'resources') preferred.push('rocky_valley', 'ancient_ruins');
    if (priority === 'exploration') preferred.push('ancient_ruins', 'riverbank');
    if (priority === 'challenge') preferred.push('extreme', 'dry_desert', 'frozen_mountain');

    if (dominant === 'forest') preferred.push('dense_forest', 'safe');
    if (dominant === 'water') preferred.push('riverbank', 'dense_forest');
    if (dominant === 'rock') preferred.push('rocky_valley', 'ancient_ruins');
    if (dominant === 'desert') preferred.push('dry_desert', 'extreme');
    if (dominant === 'snow') preferred.push('frozen_mountain', 'rocky_valley');

    const seq = [...new Set([...preferred, ...ARCHETYPE_ORDER])];
    const result = [];
    for (let i = 0; i < count; i++) result.push(seq[i % seq.length]);
    return result;
  }

  function landingPoint(rand, existing, minDistance = 0.10) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const angle = rand() * Math.PI * 2;
      const radius = Math.sqrt(rand()) * 0.43;
      const x = 0.5 + Math.cos(angle) * radius;
      const y = 0.5 + Math.sin(angle) * radius;
      const ok = existing.every(p => Math.hypot(p.globe.x - x, p.globe.y - y) >= minDistance);
      if (ok) return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    }
    const angle = rand() * Math.PI * 2;
    const radius = 0.18 + rand() * 0.25;
    return { x: Math.round((0.5 + Math.cos(angle) * radius) * 1000) / 1000, y: Math.round((0.5 + Math.sin(angle) * radius) * 1000) / 1000 };
  }

  function vary(value, rand, amount = 10) {
    return clamp(Math.round(value + (rand() - 0.5) * amount * 2), 0, 100);
  }

  function resourceAverage(resources) {
    return (resources.wood + resources.food + resources.stone + resources.metal + resources.medicine + resources.water) / 6;
  }

  function riskAverage(risks) {
    return (risks.fauna + risks.weather + risks.disease + risks.raids + risks.terrain) / 5;
  }

  function scoreLandingSite(resources, risks, buildSpace, fertility) {
    const resourcesScore = resourceAverage(resources);
    const safety = 100 - riskAverage(risks);
    const score = resourcesScore * 0.35 + safety * 0.30 + buildSpace * 0.20 + fertility * 0.15 - riskAverage(risks) * 0.30;
    return clamp(Math.round(score), 0, 100);
  }

  function difficultyFromScore(score, risks) {
    if (score <= 25 || riskAverage(risks) >= 72) return { tier: 'extreme', label: 'Extremo' };
    if (score <= 45) return { tier: 'hard', label: 'Difícil' };
    if (score <= 65) return { tier: 'moderate', label: 'Moderado' };
    if (score <= 80) return { tier: 'safe', label: 'Seguro' };
    return { tier: 'favorable', label: 'Muito favorável' };
  }

  function derivePositives(site) {
    const r = site.resources;
    const risks = site.risks;
    const positives = [];
    if (r.wood > 75) positives.push('Muita madeira próxima');
    if (r.food > 65) positives.push('Boa disponibilidade de comida');
    if (r.stone > 70) positives.push('Rochas abundantes para construção');
    if (r.metal > 60) positives.push('Sinais fortes de minério');
    if (r.medicine > 55) positives.push('Ervas medicinais promissoras');
    if (r.water > 65) positives.push('Água próxima e solo úmido');
    if (risks.weather < 25) positives.push('Clima estável');
    if (site.buildSpace > 70) positives.push('Boa área plana para construção');
    if (site.fertility > 70) positives.push('Solo fértil para plantio');
    if (!positives.length) positives.push('Condições equilibradas para adaptação');
    return positives.slice(0, 5);
  }

  function deriveNegatives(site) {
    const r = site.resources;
    const risks = site.risks;
    const negatives = [];
    if (r.wood < 30) negatives.push('Madeira escassa');
    if (r.food < 30) negatives.push('Comida inicial limitada');
    if (r.stone < 25) negatives.push('Pouca pedra próxima');
    if (risks.weather > 65) negatives.push('Clima instável');
    if (risks.fauna > 60) negatives.push('Fauna agressiva próxima');
    if (risks.disease > 55) negatives.push('Risco de doença e umidade');
    if (risks.raids > 55) negatives.push('Sinais de ameaça inteligente');
    if (risks.terrain > 65) negatives.push('Terreno irregular');
    if (!negatives.length) negatives.push('Poucas recompensas especiais no início');
    return negatives.slice(0, 5);
  }

  function buildSiteSignatures(archetype, resources, risks, index) {
    const keys = [...(archetype.signatures || [])];
    if (resources.metal > 64 && !keys.includes('eco_metalico')) keys.push('eco_metalico');
    if (resources.water > 62 && !keys.includes('bacia_hidrica')) keys.push('bacia_hidrica');
    if (resources.food > 66 && !keys.includes('atividade_biologica')) keys.push('atividade_biologica');
    if (risks.weather > 65 && !keys.includes('instabilidade_climatica')) keys.push('instabilidade_climatica');
    if (risks.raids > 52 && !keys.includes('ruina_detectada')) keys.push('ruina_detectada');
    return keys.slice(0, 3).map((key, i) => {
      const sig = SIGNATURE_DETAILS[key] || SIGNATURE_DETAILS.vale_protegido;
      const risk = risks.weather > 70 || risks.raids > 60 || risks.terrain > 70 ? 'elevado' : risks.fauna > 42 ? 'moderado' : 'baixo';
      return {
        id: `landing_sig_${index}_${i}`,
        key,
        kind: sig.kind,
        name: `${sig.name} ${String(i + 1).padStart(2, '0')}`,
        biome: sig.biome,
        risk,
        positive: sig.positive,
        negative: sig.negative
      };
    });
  }

  function generateLandingPreview(site, width = 24, height = 14) {
    const seed = site.preview?.seed || `${site.id}|preview`;
    const sample = [];
    const waterBias = site.resources.water / 100;
    const rockBias = site.resources.stone / 100;
    const forestBias = site.resources.wood / 100;
    const ruinBias = site.worldgenModifiers.ruinChance || 0;
    const desertish = site.biomes.primary === 'desert';
    const snowy = site.biomes.primary === 'snow';

    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const cx = width / 2;
        const cy = height / 2;
        const d = Math.hypot((x - cx) / width, (y - cy) / height);
        const n = (stableHash(`${seed}|${x}|${y}|n`) % 10000) / 10000;
        const ridge = (stableHash(`${seed}|${x}|${y}|r`) % 10000) / 10000;
        let type = desertish ? 'sand' : snowy ? 'snow' : 'grass';
        if (d < 0.10) type = 'spawn';
        else if (waterBias > 0.55 && Math.abs(y - height * (0.55 + (stableHash(seed) % 9) / 100)) < 1.2 + waterBias * 1.6) type = 'water';
        else if (ridge < rockBias * 0.34) type = 'stone';
        else if (n < forestBias * 0.30 && !desertish && !snowy) type = 'forest';
        else if (n > 0.88 && ruinBias > 0.18) type = 'ruin';
        else if (n > 0.72 && !snowy && !desertish) type = 'dirt';
        row.push({ type, elevation: ridge, moisture: waterBias, resourceHint: type === 'ruin' ? 'poi' : null });
      }
      sample.push(row);
    }
    return sample;
  }

  function mapBiomeMix(primary, resources, risks) {
    const mix = { forest: 0, meadow: 0, rock: 0, water: 0, ruins: 0, desert: 0, snow: 0 };
    mix.forest = clamp(Math.round(resources.wood * 0.55), 0, 100);
    mix.meadow = clamp(Math.round((resources.food + resources.medicine) * 0.22), 0, 100);
    mix.rock = clamp(Math.round((resources.stone + resources.metal) * 0.32), 0, 100);
    mix.water = clamp(Math.round(resources.water * 0.48), 0, 100);
    mix.ruins = clamp(Math.round(risks.raids * 0.18), 0, 100);
    mix.desert = primary === 'desert' ? 45 : clamp(Math.round(risks.weather * 0.18), 0, 30);
    mix.snow = primary === 'snow' ? 42 : 0;
    return mix;
  }

  function generateLandingSites(config, profile, count = landingCountForMap(config?.mapSize)) {
    const rand = randFor(config, 'landing-sites-v1');
    const stats = profile?.biomeStats || buildBiomeStats(config, rand);
    const sequence = pickArchetypeSequence(config, count, stats);
    const points = [];
    const namesByArchetype = {
      safe: ['Clareira Segura', 'Vale Verdejante', 'Campo Sereno'],
      dense_forest: ['Mata Fechada', 'Bosque Vivo', 'Selva Temperada'],
      rocky_valley: ['Vale de Basalto', 'Garganta Mineral', 'Pedreira Natural'],
      riverbank: ['Margem Alagada', 'Bacia Verde', 'Curva do Rio'],
      dry_desert: ['Planície Seca', 'Areial Aberto', 'Mesa Dourada'],
      frozen_mountain: ['Cordilheira Fria', 'Crista Boreal', 'Vale Gelado'],
      ancient_ruins: ['Posto Abandonado', 'Ruína Submersa', 'Eco de Concreto'],
      extreme: ['Zona Instável', 'Fenda Vermelha', 'Marco Hostil']
    };

    for (let i = 0; i < count; i++) {
      const archetypeKey = sequence[i];
      const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.safe;
      const globePoint = landingPoint(rand, points, count > 9 ? 0.075 : 0.10);
      const resourceNoise = rand();
      const riskNoise = rand();
      const resources = Object.fromEntries(Object.entries(archetype.baseResources).map(([key, value]) => [key, vary(value + (stats[archetype.primary] || 0) * 0.10, rand, 9 + resourceNoise * 4)]));
      const risks = Object.fromEntries(Object.entries(archetype.baseRisks).map(([key, value]) => [key, vary(value + ((config?.difficulty === 'hardcore') ? 9 : config?.difficulty === 'hard' ? 5 : 0) + ((config?.eventIntensity === 'high') ? 5 : 0), rand, 8 + riskNoise * 3)]));
      const buildSpace = vary(archetype.buildSpace, rand, 10);
      const fertility = vary(archetype.fertility, rand, 10);
      const score = scoreLandingSite(resources, risks, buildSpace, fertility);
      const difficulty = difficultyFromScore(score, risks);
      const names = namesByArchetype[archetypeKey] || [archetype.label];
      const title = names[i % names.length];
      const landingSeed = `${config?.seed || 'scan'}|landing|${i}|${archetypeKey}|${Math.round(globePoint.x * 1000)}-${Math.round(globePoint.y * 1000)}`;
      const id = `landing_${String(i + 1).padStart(2, '0')}_${stableHash(landingSeed).toString(36).slice(0, 4)}`;
      const site = {
        id,
        name: title,
        archetype: archetypeKey,
        globe: {
          x: globePoint.x,
          y: globePoint.y,
          hemisphere: `${globePoint.y < 0.5 ? 'north' : 'south'}${globePoint.x < 0.5 ? 'west' : 'east'}`,
          visible: true
        },
        labels: {
          title,
          subtitle: archetype.subtitle,
          biomeLabel: BIOME_LABELS[archetype.primary] || archetype.primary
        },
        difficulty: { ...difficulty, score, label: difficulty.label },
        biomes: {
          primary: archetype.primary,
          secondary: archetype.secondary,
          mix: mapBiomeMix(archetype.primary, resources, risks)
        },
        resources,
        risks,
        buildSpace,
        fertility,
        positives: [],
        negatives: [],
        signatures: [],
        worldgenModifiers: { ...archetype.modifiers },
        preview: {
          seed: landingSeed,
          thumbnail: null,
          terrainSample: []
        }
      };

      site.positives = derivePositives(site);
      site.negatives = deriveNegatives(site);
      site.signatures = buildSiteSignatures(archetype, resources, risks, i);
      site.preview.terrainSample = generateLandingPreview(site);
      points.push(site);
    }

    return points;
  }

  function selectedLandingSiteFromProfile(profile, siteId = null, fallbackFirst = true) {
    if (!profile?.landingSites?.length) return null;
    const id = siteId || profile.selectedLandingSiteId;
    if (id) {
      const selected = profile.landingSites.find(site => site.id === id);
      if (selected) return selected;
    }
    return fallbackFirst ? profile.landingSites[0] : null;
  }

  function requestedLandingSiteId(config = {}, profile = null) {
    return config.selectedLandingSiteId
      || config.selectedLandingSite?.id
      || config.landingSiteId
      || profile?.selectedLandingSiteId
      || null;
  }

  function compactLandingSite(site) {
    if (!site) return null;
    return {
      id: site.id,
      name: site.name,
      archetype: site.archetype,
      labels: { ...(site.labels || {}) },
      difficulty: { ...(site.difficulty || {}) },
      biomes: {
        primary: site.biomes?.primary,
        secondary: [...(site.biomes?.secondary || [])],
        mix: { ...(site.biomes?.mix || {}) }
      },
      resources: { ...(site.resources || {}) },
      risks: { ...(site.risks || {}) },
      positives: [...(site.positives || [])],
      negatives: [...(site.negatives || [])],
      signatures: [...(site.signatures || [])],
      worldgenModifiers: { ...(site.worldgenModifiers || {}) },
      preview: {
        seed: site.preview?.seed,
        terrainSample: site.preview?.terrainSample || []
      }
    };
  }

  function buildPlanetScanWorldgenProfile(config = {}) {
    config = typeof normalizeNewGameConfig === 'function' ? normalizeNewGameConfig(config) : { ...config };
    const rand = randFor(config, 'worldgen-profile-v1');
    const stats = buildBiomeStats(config, rand);
    const dominantBiome = strongest(stats);
    const metrics = buildMetrics(config, stats, rand);
    const sectorId = `HV-${String(stableHash(`${config.seed || 'scan'}|sector`)).slice(0, 5).toUpperCase()}`;
    const signatures = buildSignatureSummary(config, dominantBiome, metrics, rand);
    const profile = {
      version: 'planet-scan-profile-v1',
      seed: config.seed || '',
      sectorProfile: config.sectorProfile || 'balanced',
      landingPriority: config.landingPriority || 'safe',
      sectorId,
      dominantBiome,
      biomeStats: stats,
      metrics,
      signatures,
      landingSites: [],
      selectedLandingSiteId: null,
      selectedLandingSite: null,
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
    profile.landingSites = generateLandingSites(config, profile);
    const selectedId = requestedLandingSiteId(config, profile);
    const selected = selectedId ? selectedLandingSiteFromProfile(profile, selectedId, false) : null;
    profile.selectedLandingSiteId = selected?.id || null;
    profile.selectedLandingSite = compactLandingSite(selected);
    return profile;
  }

  function attachPlanetScanToConfig(config = {}) {
    const profile = buildPlanetScanWorldgenProfile(config);
    const selectedId = requestedLandingSiteId(config, profile);
    const selected = selectedId ? selectedLandingSiteFromProfile(profile, selectedId, false) : null;
    profile.selectedLandingSiteId = selected?.id || null;
    profile.selectedLandingSite = compactLandingSite(selected);
    return {
      ...config,
      planetScan: profile,
      selectedLandingSiteId: profile.selectedLandingSiteId,
      selectedLandingSite: profile.selectedLandingSite,
      landingSiteId: profile.selectedLandingSiteId,
      sectorProfile: config.sectorProfile || 'balanced'
    };
  }

  function scanMatchesConfig(current, normalized) {
    return current?.version === 'planet-scan-profile-v1'
      && (!current.seed || current.seed === normalized.seed)
      && (current.sectorProfile || 'balanced') === (normalized.sectorProfile || 'balanced')
      && (current.landingPriority || 'safe') === (normalized.landingPriority || 'safe')
      && Array.isArray(current.landingSites)
      && current.landingSites.length > 0;
  }

  function ensurePlanetScanOnConfig(config = {}) {
    const normalized = typeof normalizeNewGameConfig === 'function' ? normalizeNewGameConfig(config) : { ...config };
    let profile = normalized.planetScan;
    if (!scanMatchesConfig(profile, normalized)) {
      profile = buildPlanetScanWorldgenProfile(normalized);
    }
    const selectedId = requestedLandingSiteId(normalized, profile);
    const selected = selectedId ? selectedLandingSiteFromProfile(profile, selectedId, false) : null;
    profile = {
      ...profile,
      selectedLandingSiteId: selected?.id || null,
      selectedLandingSite: compactLandingSite(selected)
    };
    return {
      ...normalized,
      planetScan: profile,
      selectedLandingSiteId: profile.selectedLandingSiteId,
      selectedLandingSite: profile.selectedLandingSite,
      landingSiteId: profile.selectedLandingSiteId,
      sectorProfile: normalized.sectorProfile || 'balanced'
    };
  }

  function selectLandingSiteInConfig(config = {}, siteId) {
    const ensured = ensurePlanetScanOnConfig(config);
    const selected = selectedLandingSiteFromProfile(ensured.planetScan, siteId, false);
    if (!selected) return ensured;
    const profile = {
      ...ensured.planetScan,
      selectedLandingSiteId: selected.id,
      selectedLandingSite: compactLandingSite(selected)
    };
    return {
      ...ensured,
      planetScan: profile,
      selectedLandingSiteId: selected.id,
      selectedLandingSite: profile.selectedLandingSite,
      landingSiteId: selected.id,
      sectorProfile: ensured.sectorProfile || 'balanced'
    };
  }

  function clearLandingSiteSelectionInConfig(config = {}) {
    const ensured = ensurePlanetScanOnConfig(config);
    const profile = {
      ...ensured.planetScan,
      selectedLandingSiteId: null,
      selectedLandingSite: null
    };
    return {
      ...ensured,
      planetScan: profile,
      selectedLandingSiteId: null,
      selectedLandingSite: null,
      landingSiteId: null,
      sectorProfile: ensured.sectorProfile || 'balanced'
    };
  }

  window.buildPlanetScanWorldgenProfile = buildPlanetScanWorldgenProfile;
  window.attachPlanetScanToConfig = attachPlanetScanToConfig;
  window.ensurePlanetScanOnConfig = ensurePlanetScanOnConfig;
  window.selectLandingSiteInConfig = selectLandingSiteInConfig;
  window.clearLandingSiteSelectionInConfig = clearLandingSiteSelectionInConfig;
  window.generateLandingSites = generateLandingSites;
  window.generateLandingPreview = generateLandingPreview;
})();
