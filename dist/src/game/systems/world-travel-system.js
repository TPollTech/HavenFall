'use strict';

(() => {
  if (window.HavenfallContext?.worldTravelSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldTravelSystemInstalled = true;

  const TRAVEL_MODES = Object.freeze({
    fast: { label: 'Rápida', time: 0.75, risk: 1.26, food: 0.82, fatigue: 1.38, capacity: 1 },
    balanced: { label: 'Equilibrada', time: 1, risk: 1, food: 1, fatigue: 1, capacity: 1 },
    safe: { label: 'Segura', time: 1.28, risk: 0.72, food: 1.22, fatigue: 0.78, capacity: 1 },
    loaded: { label: 'Carregada', time: 1.55, risk: 1.18, food: 1.45, fatigue: 1.25, capacity: 1.7 }
  });

  const WORLD_MAP_VERSION = 'world-map-globe-v2';
  const WORLD_SITE_TARGETS = Object.freeze({ large: 16, huge: 20, giant: 26, infinite_chunks: 34 });
  const DISCOVERY_TEMPLATES = Object.freeze([
    {
      type: 'mine',
      archetype: 'rocky_valley',
      label: 'Mina',
      names: ['Mina Antiga', 'Veio de Ferro', 'Pedreira Profunda', 'Corte Mineral'],
      subtitle: 'Sinal mineral forte - bom para pedra e metal',
      primary: 'rock',
      secondary: ['geology', 'mine'],
      resources: { wood: 22, food: 24, stone: 88, metal: 82, medicine: 18, water: 20 },
      risks: { fauna: 20, weather: 36, disease: 16, raids: 28, terrain: 66 },
      buildSpace: 38,
      fertility: 18,
      modifiers: { treeMultiplier: 0.50, rockMultiplier: 1.70, oreMultiplier: 1.95, berryMultiplier: 0.48, riverChance: 0.08, mountainChance: 0.70, ruinChance: 0.10, spawnClearingRadius: 5, initialThreatMultiplier: 1.00, poiMultiplier: 1.12 },
      signatures: ['falha_geologica', 'eco_metalico']
    },
    {
      type: 'dungeon',
      archetype: 'ancient_ruins',
      label: 'Dungeon',
      names: ['Complexo Soterrado', 'Cripta Industrial', 'Galeria Lacrada', 'Tunel Antigo'],
      subtitle: 'Estrutura enterrada - loot alto e ameacas provaveis',
      primary: 'rock',
      secondary: ['ruins', 'dungeon'],
      resources: { wood: 28, food: 24, stone: 62, metal: 78, medicine: 30, water: 24 },
      risks: { fauna: 34, weather: 36, disease: 30, raids: 72, terrain: 64 },
      buildSpace: 34,
      fertility: 20,
      modifiers: { treeMultiplier: 0.66, rockMultiplier: 1.22, oreMultiplier: 1.38, berryMultiplier: 0.55, riverChance: 0.10, mountainChance: 0.36, ruinChance: 0.76, spawnClearingRadius: 4, initialThreatMultiplier: 1.48, poiMultiplier: 1.80 },
      signatures: ['ruina_detectada', 'eco_metalico']
    },
    {
      type: 'outpost',
      archetype: 'ancient_ruins',
      label: 'Construcao',
      names: ['Posto Quebrado', 'Torre de Radio', 'Estacao de Bombeamento', 'Armazem Remoto'],
      subtitle: 'Construcao abandonada - sucata e abrigo possiveis',
      primary: 'rock',
      secondary: ['ruins', 'scrap'],
      resources: { wood: 42, food: 36, stone: 54, metal: 64, medicine: 38, water: 30 },
      risks: { fauna: 26, weather: 34, disease: 22, raids: 48, terrain: 42 },
      buildSpace: 58,
      fertility: 34,
      modifiers: { treeMultiplier: 0.88, rockMultiplier: 1.10, oreMultiplier: 1.20, berryMultiplier: 0.75, riverChance: 0.13, mountainChance: 0.25, ruinChance: 0.62, spawnClearingRadius: 7, initialThreatMultiplier: 1.12, poiMultiplier: 1.55 },
      signatures: ['ruina_detectada', 'eco_metalico']
    },
    {
      type: 'grove',
      archetype: 'dense_forest',
      label: 'Bosque',
      names: ['Bosque de Caca', 'Mata de Ervas', 'Vale de Frutas', 'Copa Fechada'],
      subtitle: 'Biossinal denso - comida, madeira e remedios',
      primary: 'forest',
      secondary: ['fauna', 'fertile'],
      resources: { wood: 90, food: 78, stone: 26, metal: 16, medicine: 72, water: 46 },
      risks: { fauna: 58, weather: 34, disease: 26, raids: 18, terrain: 42 },
      buildSpace: 38,
      fertility: 86,
      modifiers: { treeMultiplier: 1.68, rockMultiplier: 0.68, oreMultiplier: 0.62, berryMultiplier: 1.60, riverChance: 0.24, mountainChance: 0.08, ruinChance: 0.08, spawnClearingRadius: 6, initialThreatMultiplier: 1.18, poiMultiplier: 0.95 },
      signatures: ['atividade_biologica', 'zona_fertil']
    },
    {
      type: 'water',
      archetype: 'riverbank',
      label: 'Agua',
      names: ['Delta Raso', 'Lagoa Turva', 'Fonte Mineral', 'Curva do Rio'],
      subtitle: 'Agua detectada - fertilidade alta e risco de umidade',
      primary: 'water',
      secondary: ['riverbank', 'fertile'],
      resources: { wood: 58, food: 72, stone: 34, metal: 20, medicine: 48, water: 92 },
      risks: { fauna: 38, weather: 54, disease: 52, raids: 16, terrain: 44 },
      buildSpace: 44,
      fertility: 90,
      modifiers: { treeMultiplier: 1.20, rockMultiplier: 0.72, oreMultiplier: 0.70, berryMultiplier: 1.40, riverChance: 0.92, mountainChance: 0.07, ruinChance: 0.08, spawnClearingRadius: 7, initialThreatMultiplier: 0.94, poiMultiplier: 1.00 },
      signatures: ['bacia_hidrica', 'zona_fertil']
    },
    {
      type: 'danger',
      archetype: 'extreme',
      label: 'Anomalia',
      names: ['Fenda Vermelha', 'Marco Hostil', 'Planicie Queimada', 'Zona de Ruido'],
      subtitle: 'Assinatura instavel - risco alto e recompensa rara',
      primary: 'desert',
      secondary: ['rock', 'anomaly'],
      resources: { wood: 22, food: 24, stone: 76, metal: 88, medicine: 24, water: 16 },
      risks: { fauna: 62, weather: 80, disease: 44, raids: 76, terrain: 78 },
      buildSpace: 30,
      fertility: 16,
      modifiers: { treeMultiplier: 0.52, rockMultiplier: 1.48, oreMultiplier: 1.95, berryMultiplier: 0.52, riverChance: 0.06, mountainChance: 0.48, ruinChance: 0.50, spawnClearingRadius: 4, initialThreatMultiplier: 1.72, poiMultiplier: 1.50 },
      signatures: ['instabilidade_climatica', 'ruina_detectada', 'falha_geologica']
    }
  ]);

  function clone(value) {
    try { return structuredClone(value); }
    catch (_) { return JSON.parse(JSON.stringify(value)); }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function isGameplayReady() {
    return !!state && state.isPreview !== true && state.runtimeMode !== 'menu-preview' && Array.isArray(state.colonists) && !!state.world;
  }

  function hash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    for (const ch of String(text || 'travel')) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function riskAverage(site) {
    const r = site?.risks || {};
    const values = ['fauna', 'weather', 'disease', 'raids', 'terrain'].map(key => Number(r[key] || 0));
    return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
  }

  function riskLabel(score) {
    const value = Number(score) || 0;
    if (value <= 20) return 'Muito baixo';
    if (value <= 40) return 'Baixo';
    if (value <= 60) return 'Moderado';
    if (value <= 80) return 'Alto';
    return 'Extremo';
  }

  function seededUnit(seed, salt) {
    return (hash(`${seed}|${salt}`) % 10000) / 10000;
  }

  function varySeeded(value, seed, salt, amount = 10) {
    return clamp(Math.round(Number(value || 0) + (seededUnit(seed, salt) - 0.5) * amount * 2), 0, 100);
  }

  function averageValues(obj, keys) {
    const values = keys.map(key => Number(obj?.[key] || 0));
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }

  function discoveryDifficulty(resources, risks, buildSpace, fertility) {
    const resourceScore = averageValues(resources, ['wood', 'food', 'stone', 'metal', 'medicine', 'water']);
    const riskScore = averageValues(risks, ['fauna', 'weather', 'disease', 'raids', 'terrain']);
    const score = clamp(Math.round(resourceScore * 0.36 + (100 - riskScore) * 0.34 + Number(buildSpace || 0) * 0.16 + Number(fertility || 0) * 0.14 - riskScore * 0.26), 0, 100);
    if (score <= 25 || riskScore >= 72) return { tier: 'extreme', label: 'Extremo', score };
    if (score <= 45) return { tier: 'hard', label: 'Dificil', score };
    if (score <= 65) return { tier: 'moderate', label: 'Moderado', score };
    if (score <= 80) return { tier: 'safe', label: 'Seguro', score };
    return { tier: 'favorable', label: 'Muito favoravel', score };
  }

  function discoveryPoint(seed, index, existing, minDistance = 0.075) {
    for (let attempt = 0; attempt < 180; attempt++) {
      const angle = seededUnit(seed, `point-a-${index}-${attempt}`) * Math.PI * 2;
      const radius = Math.sqrt(seededUnit(seed, `point-r-${index}-${attempt}`)) * 0.47;
      const x = clamp(0.5 + Math.cos(angle) * radius, 0.045, 0.955);
      const y = clamp(0.5 + Math.sin(angle) * radius * 0.92, 0.045, 0.955);
      if (existing.every(site => Math.hypot(Number(site.globe?.x ?? 0.5) - x, Number(site.globe?.y ?? 0.5) - y) >= minDistance)) {
        return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
      }
    }
    const angle = seededUnit(seed, `point-fallback-a-${index}`) * Math.PI * 2;
    const radius = 0.18 + seededUnit(seed, `point-fallback-r-${index}`) * 0.30;
    return {
      x: Math.round(clamp(0.5 + Math.cos(angle) * radius, 0.05, 0.95) * 1000) / 1000,
      y: Math.round(clamp(0.5 + Math.sin(angle) * radius * 0.9, 0.05, 0.95) * 1000) / 1000
    };
  }

  function makeDiscoverySignatures(template, seed, index, risks) {
    const signatureInfo = {
      falha_geologica: { name: 'Falha geologica', kind: 'geology', biome: 'rock', positive: 'Mais pedra e minerio', negative: 'Terreno irregular' },
      eco_metalico: { name: 'Eco metalico', kind: 'metal', biome: 'rock', positive: 'Metal e sucata proximos', negative: 'Sinal pode atrair risco' },
      ruina_detectada: { name: 'Ruina detectada', kind: 'ruin', biome: 'rock', positive: 'Loot e estruturas antigas', negative: 'Ameacas possiveis' },
      atividade_biologica: { name: 'Atividade biologica', kind: 'fauna', biome: 'forest', positive: 'Mais caca e frutas', negative: 'Fauna mais ativa' },
      zona_fertil: { name: 'Zona fertil', kind: 'fertile', biome: 'forest', positive: 'Solo bom para plantio', negative: 'Vegetacao densa' },
      bacia_hidrica: { name: 'Bacia hidrica', kind: 'water', biome: 'water', positive: 'Agua e fertilidade', negative: 'Risco de doenca' },
      instabilidade_climatica: { name: 'Instabilidade climatica', kind: 'weather', biome: 'desert', positive: 'Recursos raros expostos', negative: 'Clima agressivo' }
    };
    const risk = averageValues(risks, ['fauna', 'weather', 'disease', 'raids', 'terrain']);
    return (template.signatures || []).slice(0, 3).map((key, i) => {
      const info = signatureInfo[key] || signatureInfo.eco_metalico;
      return {
        id: `world_sig_${index}_${i}_${hash(`${seed}|sig|${key}`).toString(36).slice(0, 3)}`,
        key,
        kind: info.kind,
        name: `${info.name} ${String(i + 1).padStart(2, '0')}`,
        biome: info.biome,
        risk: risk > 68 ? 'elevado' : risk > 42 ? 'moderado' : 'baixo',
        positive: info.positive,
        negative: info.negative
      };
    });
  }

  function makeDiscoverySite(config, index, existing) {
    const baseSeed = `${config?.seed || 'havenfall'}|world-discovery|${index}`;
    const template = DISCOVERY_TEMPLATES[hash(`${baseSeed}|template`) % DISCOVERY_TEMPLATES.length];
    const point = discoveryPoint(baseSeed, index, existing, existing.length > 24 ? 0.052 : 0.07);
    const resources = {};
    const risks = {};
    for (const key of ['wood', 'food', 'stone', 'metal', 'medicine', 'water']) resources[key] = varySeeded(template.resources[key], baseSeed, `res-${key}`, 9);
    for (const key of ['fauna', 'weather', 'disease', 'raids', 'terrain']) risks[key] = varySeeded(template.risks[key], baseSeed, `risk-${key}`, 8);
    const buildSpace = varySeeded(template.buildSpace, baseSeed, 'build-space', 9);
    const fertility = varySeeded(template.fertility, baseSeed, 'fertility', 9);
    const difficulty = discoveryDifficulty(resources, risks, buildSpace, fertility);
    const name = template.names[hash(`${baseSeed}|name`) % template.names.length];
    const id = `world_${template.type}_${String(index + 1).padStart(2, '0')}_${hash(`${baseSeed}|id`).toString(36).slice(0, 5)}`;
    return {
      id,
      name,
      archetype: template.archetype,
      discoveryType: template.type,
      discoveryLabel: template.label,
      globe: {
        x: point.x,
        y: point.y,
        hemisphere: `${point.y < 0.5 ? 'north' : 'south'}${point.x < 0.5 ? 'west' : 'east'}`,
        visible: true
      },
      labels: {
        title: name,
        subtitle: template.subtitle,
        biomeLabel: template.label,
        siteTypeLabel: template.label
      },
      difficulty,
      biomes: {
        primary: template.primary,
        secondary: template.secondary,
        mix: {
          forest: clamp(Math.round(resources.wood * 0.5), 0, 100),
          meadow: clamp(Math.round((resources.food + resources.medicine) * 0.22), 0, 100),
          rock: clamp(Math.round((resources.stone + resources.metal) * 0.35), 0, 100),
          water: clamp(Math.round(resources.water * 0.48), 0, 100),
          ruins: clamp(Math.round(risks.raids * 0.22), 0, 100),
          desert: template.primary === 'desert' ? 48 : clamp(Math.round(risks.weather * 0.14), 0, 32),
          snow: template.primary === 'snow' ? 42 : 0
        }
      },
      resources,
      risks,
      buildSpace,
      fertility,
      positives: [
        resources.metal > 68 ? 'Potencial alto de metal.' : null,
        resources.food > 68 ? 'Comida promissora.' : null,
        resources.water > 68 ? 'Agua abundante.' : null,
        template.type === 'outpost' ? 'Estruturas reaproveitaveis.' : null,
        template.type === 'dungeon' ? 'Loot raro possivel.' : null
      ].filter(Boolean).slice(0, 4),
      negatives: [
        risks.raids > 60 ? 'Ameacas inteligentes provaveis.' : null,
        risks.terrain > 62 ? 'Terreno dificil.' : null,
        risks.weather > 62 ? 'Clima instavel.' : null,
        risks.disease > 48 ? 'Risco sanitario.' : null
      ].filter(Boolean).slice(0, 4),
      signatures: makeDiscoverySignatures(template, baseSeed, index, risks),
      worldgenModifiers: { ...template.modifiers },
      preview: {
        seed: `${baseSeed}|preview`,
        thumbnail: null,
        terrainSample: []
      },
      travel: { discovered: true }
    };
  }

  function expandedSiteTarget(config, baseCount) {
    const size = config?.mapSize || 'giant';
    const baseTarget = WORLD_SITE_TARGETS[size] || 20;
    const priorityBonus = config?.landingPriority === 'exploration' ? 4 : 0;
    return Math.max(baseCount, baseTarget + priorityBonus);
  }

  function expandWorldSites(config, sites) {
    const output = sites.map(site => ({
      discoveryType: site.discoveryType || 'landing',
      discoveryLabel: site.discoveryLabel || site.labels?.siteTypeLabel || 'Pouso',
      ...site
    }));
    const target = expandedSiteTarget(config, output.length);
    for (let i = output.length; i < target; i++) output.push(makeDiscoverySite(config, i, output));
    return output;
  }

  function distanceBetweenSites(a, b) {
    if (!a || !b) return 1;
    const ax = Number(a.globe?.x ?? 0.5);
    const ay = Number(a.globe?.y ?? 0.5);
    const bx = Number(b.globe?.x ?? 0.5);
    const by = Number(b.globe?.y ?? 0.5);
    return Math.max(0.35, Math.hypot(ax - bx, ay - by) * 7.5 + 0.4);
  }

  function sitePrimaryBiome(site) {
    return site?.biomes?.primary || site?.archetype || 'forest';
  }

  function terrainMultiplier(site) {
    const biome = sitePrimaryBiome(site);
    let value = 1;
    if (biome === 'forest') value += 0.14;
    if (biome === 'desert') value += 0.18;
    if (biome === 'rock') value += 0.26;
    if (biome === 'water') value += 0.20;
    if (biome === 'snow') value += 0.32;
    if (site?.archetype === 'safe') value -= 0.16;
    if (site?.archetype === 'extreme') value += 0.34;
    return clamp(value, 0.72, 1.9);
  }

  function compactLandingSite(site) {
    if (!site) return null;
    return {
      id: site.id,
      name: site.name,
      archetype: site.archetype,
      discoveryType: site.discoveryType || 'landing',
      discoveryLabel: site.discoveryLabel || site.labels?.siteTypeLabel || null,
      globe: clone(site.globe || {}),
      labels: clone(site.labels || {}),
      difficulty: clone(site.difficulty || {}),
      biomes: clone(site.biomes || {}),
      resources: clone(site.resources || {}),
      risks: clone(site.risks || {}),
      positives: clone(site.positives || []),
      negatives: clone(site.negatives || []),
      signatures: clone(site.signatures || []),
      preview: clone(site.preview || {}),
      worldgenModifiers: clone(site.worldgenModifiers || {})
    };
  }

  function currentSiteId() {
    return state?.worldMap?.currentSiteId
      || state?.world?.landingSite?.id
      || state?.config?.selectedLandingSiteId
      || state?.config?.landingSiteId
      || state?.config?.planetScan?.selectedLandingSiteId
      || state?.config?.planetScan?.landingSites?.[0]?.id
      || 'landing_initial';
  }

  function normalizeLandingSites(config = state?.config || {}) {
    const profile = typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(config).planetScan : config?.planetScan;
    const sites = Array.isArray(profile?.landingSites) ? clone(profile.landingSites) : [];
    const selectedId = config?.selectedLandingSiteId || profile?.selectedLandingSiteId || sites[0]?.id || 'landing_initial';
    if (!sites.length) {
      sites.push({
        id: selectedId,
        name: config?.selectedLandingSite?.name || state?.world?.landingSite?.name || 'Setor Inicial',
        archetype: 'safe',
        globe: { x: 0.5, y: 0.5, visible: true },
        labels: { biomeLabel: 'Setor conhecido', subtitle: 'Local inicial' },
        difficulty: { tier: 'safe', label: 'Seguro', score: 70 },
        biomes: { primary: 'forest', secondary: [], mix: {} },
        resources: { wood: 55, food: 55, stone: 45, metal: 25, medicine: 35, water: 35 },
        risks: { fauna: 20, weather: 20, disease: 15, raids: 10, terrain: 18 },
        positives: ['Local inicial conhecido.'],
        negatives: ['Poucos dados orbitais disponíveis.'],
        preview: { terrainSample: [] }
      });
    }
    return { profile, sites: expandWorldSites(config, sites), selectedId };
  }

  function statusForSite(site, currentId, visitedSites = {}) {
    if (!site) return 'unknown';
    if (site.id === currentId) return 'current';
    if (visitedSites[site.id]?.visited || site.worldState?.visited || site.travel?.visited) return 'visited';
    if (site.travel?.locked || site.worldState?.locked) return 'locked';
    if (site.travel?.discovered === false) return 'unknown';
    if (riskAverage(site) >= 72 || site.difficulty?.tier === 'extreme') return 'danger';
    if ((site.signatures || []).some(sig => sig.kind === 'ruin' || sig.key === 'ruina_detectada')) return 'quest';
    return 'known';
  }

  function sectorStore() {
    state.sectors = state.sectors && typeof state.sectors === 'object' ? state.sectors : {};
    return state.sectors;
  }

  function attachSectorStore(worldMap, sectors) {
    Object.defineProperty(worldMap, 'sectors', {
      value: sectors,
      enumerable: false,
      configurable: true,
      writable: true
    });
    return worldMap;
  }

  function enrichLandingSite(site, worldMap, currentSite = null) {
    const current = currentSite || site;
    const distance = distanceBetweenSites(current, site);
    const baseRisk = riskAverage(site);
    const riskScore = clamp(Math.round(baseRisk + distance * 4 + (terrainMultiplier(site) - 1) * 28), 0, 100);
    const travelHours = Math.max(6, Math.round(distance * 13 * terrainMultiplier(site)));
    const minFood = Math.max(4, Math.ceil(travelHours / 12) * Math.max(1, state?.colonists?.length || 1));
    const recommendedFood = Math.ceil(minFood * 1.55);
    const sectors = sectorStore();
    const visited = !!worldMap?.visitedSites?.[site.id]?.visited || !!site.worldState?.visited;
    const currentFlag = site.id === worldMap?.currentSiteId;
    const status = statusForSite(site, worldMap?.currentSiteId, worldMap?.visitedSites || {});
    return {
      ...site,
      state: status,
      travel: {
        discovered: site.travel?.discovered !== false,
        visited,
        current: currentFlag,
        locked: !!site.travel?.locked,
        distanceFromCurrent: Math.round(distance * 10) / 10,
        travelHours,
        riskScore,
        minFood,
        recommendedFood,
        recommendedMedicine: Math.max(1, Math.ceil(riskScore / 34)),
        requiredTech: site.travel?.requiredTech || null
      },
      worldState: {
        generated: !!sectors[site.id] || !!site.worldState?.generated,
        hasBase: !!worldMap?.visitedSites?.[site.id]?.hasBase || !!site.worldState?.hasBase,
        hasOutpost: !!worldMap?.visitedSites?.[site.id]?.hasOutpost || !!site.worldState?.hasOutpost,
        lastVisitedDay: worldMap?.visitedSites?.[site.id]?.lastVisitedDay ?? site.worldState?.lastVisitedDay ?? null,
        exploredPercent: worldMap?.visitedSites?.[site.id]?.exploredPercent ?? site.worldState?.exploredPercent ?? 0,
        dangerLevel: riskScore,
        knownResources: { ...(site.resources || {}) }
      }
    };
  }

  function buildRoutes(worldMap) {
    const sites = worldMap?.landingSites || [];
    if (sites.length < 2) return [];
    const routes = new Map();
    const seed = `${worldMap.planetSeed || 'havenfall'}|routes|${WORLD_MAP_VERSION}`;

    function routeKey(a, b) {
      return [a.id, b.id].sort().join('->');
    }

    function addRoute(a, b, roadType = 'trail') {
      if (!a || !b || a.id === b.id) return;
      const key = routeKey(a, b);
      if (routes.has(key)) return;
      const distance = distanceBetweenSites(a, b);
      const risk = Math.round((riskAverage(a) + riskAverage(b)) / 2);
      routes.set(key, {
        from: a.id,
        to: b.id,
        distance: Math.round(distance * 10) / 10,
        risk,
        known: !['unknown', 'locked'].includes(a.state) && !['unknown', 'locked'].includes(b.state),
        roadType: distance > 3.1 ? 'long' : roadType
      });
    }

    const ordered = [...sites].sort((a, b) => (a.globe?.x || 0) - (b.globe?.x || 0) || (a.globe?.y || 0) - (b.globe?.y || 0));
    for (let i = 1; i < ordered.length; i++) {
      const site = ordered[i];
      const nearestPrevious = ordered.slice(0, i).sort((a, b) => distanceBetweenSites(site, a) - distanceBetweenSites(site, b))[0];
      addRoute(site, nearestPrevious, 'road');
    }

    for (const site of sites) {
      const neighbors = sites
        .filter(other => other.id !== site.id)
        .sort((a, b) => distanceBetweenSites(site, a) - distanceBetweenSites(site, b));
      const linkCount = site.id === worldMap.currentSiteId ? 4 : 2;
      for (const neighbor of neighbors.slice(0, linkCount)) addRoute(site, neighbor, neighbor.state === 'danger' ? 'hazard' : 'trail');
    }

    const extras = Math.ceil(sites.length * 0.42);
    for (let i = 0; i < extras; i++) {
      const a = sites[hash(`${seed}|extra-a|${i}`) % sites.length];
      const b = sites[hash(`${seed}|extra-b|${i}`) % sites.length];
      if (!a || !b || a.id === b.id) continue;
      const distance = distanceBetweenSites(a, b);
      const roll = seededUnit(seed, `extra-roll-${i}`);
      if (distance <= 3.6 || roll > 0.58) addRoute(a, b, roll > 0.72 ? 'road' : 'trail');
    }

    return [...routes.values()].sort((a, b) => a.distance - b.distance || a.from.localeCompare(b.from));
  }

  function ensureWorldMap(options = {}) {
    if (!isGameplayReady()) return null;
    const previous = state.worldMap || {};
    const cacheKey = [
      WORLD_MAP_VERSION,
      state.config?.seed,
      state.config?.selectedLandingSiteId,
      previous.currentSiteId,
      Object.keys(state.sectors || {}).length,
      Object.keys(previous.visitedSites || {}).length,
      state.day || 1
    ].join('|');
    if (!options.refresh && previous._cacheKey === cacheKey && Array.isArray(previous.landingSites)) {
      attachSectorStore(previous, sectorStore());
      return previous;
    }

    const normalized = normalizeLandingSites(state.config || {});
    const currentId = previous.currentSiteId || normalized.selectedId;
    const visitedSites = { ...(previous.visitedSites || {}) };
    visitedSites[currentId] = {
      ...(visitedSites[currentId] || {}),
      visited: true,
      current: true,
      lastVisitedDay: state.day || 1,
      hasBase: true
    };

    const sectors = sectorStore();
    let worldMap = {
      planetSeed: previous.planetSeed || state.config?.seed || normalized.profile?.seed || 'havenfall',
      currentSiteId: currentId,
      selectedWorldMapSiteId: previous.selectedWorldMapSiteId || currentId,
      landingSites: [],
      routes: [],
      visitedSites,
      knownSites: previous.knownSites || {},
      travelLog: Array.isArray(previous.travelLog) ? previous.travelLog.slice(0, 30) : [],
      lastMapTab: previous.lastMapTab || 'local',
      globalExplorationPercent: previous.globalExplorationPercent || 0
    };
    attachSectorStore(worldMap, sectors);

    const currentRaw = normalized.sites.find(site => site.id === currentId) || normalized.sites[0];
    worldMap.landingSites = normalized.sites.map(site => enrichLandingSite(site, worldMap, currentRaw));
    worldMap.routes = buildRoutes(worldMap);
    worldMap.globalExplorationPercent = Math.round((Object.values(worldMap.visitedSites).filter(v => v?.visited).length / Math.max(1, worldMap.landingSites.length)) * 100);
    Object.defineProperty(worldMap, '_cacheKey', { value: cacheKey, enumerable: false, configurable: true, writable: true });

    state.worldMap = worldMap;
    state.activeTravel = state.activeTravel || null;
    state.ui = state.ui || {};
    state.ui.map = state.ui.map || {
      open: false,
      tab: worldMap.lastMapTab || 'local',
      selectedLocalTile: null,
      selectedWorldSiteId: worldMap.selectedWorldMapSiteId,
      filters: { resources: true, colonists: true, threats: true, poi: true, zones: true, buildings: true }
    };
    return state.worldMap;
  }

  function snapshotCurrentSector() {
    if (!isGameplayReady()) return null;
    const worldMap = ensureWorldMap();
    const siteId = worldMap?.currentSiteId || currentSiteId();
    if (!siteId) return null;
    const objects = clone(state.objects || state.world?.objects || []);
    const world = clone(state.world || {});
    world.objects = objects;
    return {
      id: siteId,
      siteId,
      generated: true,
      world,
      terrain: clone(state.terrain || state.world?.terrain),
      objects,
      mobs: clone(state.mobs || []),
      wolves: clone(state.wolves || []),
      visitors: clone(state.visitors || []),
      pointsOfInterest: clone(state.world?.pointsOfInterest || []),
      exploration: clone(state.world?.exploration || []),
      spawn: clone(state.world?.spawn || { x: 0, y: 0 }),
      savedAtDay: state.day || 1,
      savedAtHour: state.hour || 0
    };
  }

  function saveCurrentSector() {
    if (!isGameplayReady()) return null;
    const worldMap = ensureWorldMap();
    const siteId = worldMap?.currentSiteId;
    if (!siteId) return null;
    const sector = snapshotCurrentSector();
    if (!sector) return null;
    const sectors = sectorStore();
    sectors[siteId] = sector;
    attachSectorStore(worldMap, sectors);
    worldMap.visitedSites[siteId] = {
      ...(worldMap.visitedSites[siteId] || {}),
      visited: true,
      generated: true,
      current: true,
      lastVisitedDay: state.day || 1,
      exploredPercent: explorationPercent(),
      hasBase: true
    };
    return sector;
  }

  function explorationPercent(sector = null) {
    const exploration = sector?.exploration || state?.world?.exploration || [];
    let known = 0, total = 0;
    for (const row of exploration) for (const cell of row || []) { total++; if (cell) known++; }
    return total ? Math.round((known / total) * 100) : 0;
  }

  function siteById(siteId) {
    const worldMap = ensureWorldMap();
    return worldMap?.landingSites?.find(site => site.id === siteId) || null;
  }

  function currentSite() {
    return siteById(currentSiteId());
  }

  function calculateTravelPlan(toSiteId, options = {}) {
    const worldMap = ensureWorldMap();
    const fromSite = currentSite();
    const toSite = siteById(toSiteId);
    const modeKey = options.mode || 'balanced';
    const mode = TRAVEL_MODES[modeKey] || TRAVEL_MODES.balanced;
    if (!worldMap || !fromSite || !toSite) return null;
    const distance = distanceBetweenSites(fromSite, toSite);
    const terrain = terrainMultiplier(toSite);
    const colonistCount = Math.max(1, Number(options.colonistCount || state?.colonists?.filter(c => !c.isUnconscious)?.length || state?.colonists?.length || 1));
    const baseRisk = riskAverage(toSite);
    const travelHours = Math.max(4, Math.round(distance * 13 * terrain * mode.time));
    const foodCost = Math.max(1, Math.ceil(colonistCount * Math.ceil(travelHours / 12) * mode.food));
    const riskScore = clamp(Math.round((baseRisk + distance * 5 + (terrain - 1) * 30) * mode.risk), 0, 100);
    const eventChance = clamp(Math.round(8 + riskScore * 0.42 + travelHours * 0.14 - (modeKey === 'safe' ? 12 : 0)), 4, 88);
    return {
      fromSiteId: fromSite.id,
      toSiteId: toSite.id,
      toSiteName: toSite.name,
      colonistIds: (state?.colonists || []).map(c => c.id),
      supplies: {
        food: foodCost,
        medicine: Math.max(1, Math.ceil(riskScore / 35)),
        wood: modeKey === 'loaded' ? 12 : modeKey === 'safe' ? 8 : 4
      },
      mode: modeKey,
      modeLabel: mode.label,
      distance: Math.round(distance * 10) / 10,
      estimatedHours: travelHours,
      riskScore,
      riskLabel: riskLabel(riskScore),
      eventChance,
      foodCost,
      medicineRecommended: Math.max(1, Math.ceil(riskScore / 35)),
      status: 'ready'
    };
  }

  function canTravel(plan) {
    const worldMap = ensureWorldMap();
    const toSite = siteById(plan?.toSiteId);
    const awakeColonists = (state?.colonists || []).filter(c => !c.isUnconscious && Number(c.health ?? 100) > 5);
    const reasons = [];
    const warnings = [];
    if (!plan || !toSite) reasons.push('Nenhum destino selecionado.');
    if (plan?.toSiteId === worldMap?.currentSiteId) reasons.push('Este já é o setor atual.');
    if (toSite?.travel?.locked || toSite?.state === 'locked') reasons.push(`Destino bloqueado${toSite.travel?.requiredTech ? `: requer ${toSite.travel.requiredTech}` : ''}.`);
    if ((state?.resources?.food || 0) < (plan?.foodCost || 0)) reasons.push(`Comida insuficiente: precisa de ${plan?.foodCost || 0}.`);
    if (!awakeColonists.length) reasons.push('Nenhum colono está apto para viajar.');
    if ((state?.resources?.medicine || 0) < (plan?.medicineRecommended || 0)) warnings.push('Remédios abaixo do recomendado.');
    if (plan?.riskScore >= 70) warnings.push('Risco alto de evento negativo.');
    if ((state?.colonists || []).some(c => Number(c.energy ?? 100) < 30)) warnings.push('Há colonos com energia baixa.');
    return { ok: reasons.length === 0, reasons, warnings };
  }

  function advanceTime(hours) {
    state.hour = Number(state.hour || 0) + Number(hours || 0);
    while (state.hour >= 24) {
      state.hour -= 24;
      state.day = Number(state.day || 1) + 1;
      state.eventDoneToday = false;
    }
  }

  function applyTravelConsequences(plan, event = null) {
    const fatigue = TRAVEL_MODES[plan.mode]?.fatigue || 1;
    const foodShortage = (state.resources.food || 0) < 0;
    for (const c of state.colonists || []) {
      c.energy = clamp((c.energy ?? 80) - plan.estimatedHours * 0.22 * fatigue, 0, 100);
      c.hunger = clamp((c.hunger ?? 80) - (foodShortage ? 18 : 5 + plan.estimatedHours * 0.04), 0, 100);
      c.mood = clamp((c.mood ?? 65) - (plan.riskScore >= 70 ? 6 : 2) - (event?.bad ? 5 : 0), 0, 100);
      if (event?.injury && Math.random() < 0.45) c.health = clamp((c.health ?? 100) - event.injury, 1, 100);
      window.HavenfallRuntime?.cancelColonistTask?.(c, `Viajou para ${plan.toSiteName}`);
      if (!window.HavenfallRuntime?.cancelColonistTask) {
        c.task = null;
        c.path = [];
        c.work = 0;
        c.sleeping = false;
        c.note = `Viajou para ${plan.toSiteName}`;
      }
    }
  }

  function travelEvent(plan, site) {
    const roll = hash(`${state.config?.seed}|${state.day}|${state.hour}|${plan.toSiteId}|${plan.mode}`) % 100;
    if (roll > plan.eventChance) return null;
    const risk = plan.riskScore;
    if (risk >= 70) return { title: 'Rota perigosa', text: 'A expedição atravessou uma área hostil e perdeu parte do ritmo.', bad: true, injury: 6, delay: Math.ceil(plan.estimatedHours * 0.12) };
    if (site?.archetype === 'ancient_ruins' || site?.state === 'quest') return { title: 'Sinal antigo', text: 'O grupo encontrou marcas de uma rota abandonada e trouxe sucata útil.', gain: { metal: 2 }, delay: 2 };
    if (sitePrimaryBiome(site) === 'water') return { title: 'Chuva intensa', text: 'A rota ficou alagada e atrasou a chegada.', bad: false, delay: 4 };
    if (sitePrimaryBiome(site) === 'forest') return { title: 'Rastros de caça', text: 'Os colonos encontraram rastros recentes e evitaram uma área de risco.', bad: false, mood: 1 };
    return { title: 'Achado de rota', text: 'A expedição encontrou restos úteis pelo caminho.', gain: { wood: 4 }, delay: 1 };
  }

  function generateSectorForLandingSite(site) {
    const sectorConfig = typeof selectLandingSiteInConfig === 'function'
      ? selectLandingSiteInConfig({ ...(state.config || {}) }, site.id)
      : { ...(state.config || {}), selectedLandingSiteId: site.id, selectedLandingSite: site, landingSiteId: site.id };
    const compact = compactLandingSite(site);
    sectorConfig.selectedLandingSiteId = site.id;
    sectorConfig.landingSiteId = site.id;
    sectorConfig.selectedLandingSite = compact;
    sectorConfig.planetScan = sectorConfig.planetScan || {};
    sectorConfig.planetScan.selectedLandingSiteId = site.id;
    sectorConfig.planetScan.selectedLandingSite = compact;
    sectorConfig.planetScan.landingSites = Array.isArray(sectorConfig.planetScan.landingSites) ? sectorConfig.planetScan.landingSites : [];
    if (!sectorConfig.planetScan.landingSites.some(entry => entry.id === site.id)) sectorConfig.planetScan.landingSites.push(compact);
    const world = generateWorldFromSeed(sectorConfig);
    const mobs = typeof generateInitialMobs === 'function' ? generateInitialMobs(world, sectorConfig, state.colonists || []) : [];
    return {
      id: site.id,
      siteId: site.id,
      generated: true,
      world,
      terrain: world.terrain,
      objects: world.objects,
      mobs,
      wolves: [],
      visitors: [],
      pointsOfInterest: world.pointsOfInterest || [],
      exploration: world.exploration || [],
      spawn: world.spawn,
      savedAtDay: state.day || 1,
      savedAtHour: state.hour || 0
    };
  }

  function placeColonistsAtSpawn(sector) {
    const spawn = sector?.world?.spawn || sector?.spawn || { x: 5, y: 5 };
    const tileSize = typeof TILE !== 'undefined' ? TILE : 32;
    const offsets = [[0,2],[1,2],[-1,2],[2,1],[-2,1],[0,3],[1,3],[-1,3]];
    (state.colonists || []).forEach((c, index) => {
      const off = offsets[index % offsets.length];
      c.x = spawn.x + off[0];
      c.y = spawn.y + off[1];
      c.px = c.x * tileSize + tileSize / 2;
      c.py = c.y * tileSize + tileSize / 2;
      window.HavenfallRuntime?.cancelColonistTask?.(c, 'Chegou ao setor');
      if (!window.HavenfallRuntime?.cancelColonistTask) {
        c.path = [];
        c.task = null;
        c.work = 0;
        c.sleeping = false;
      }
    });
    selectedColonistId = state.colonists?.[0]?.id || selectedColonistId;
  }

  function syncConfigToSite(site) {
    if (!site) return;
    const selected = compactLandingSite(site);
    state.config = state.config || {};
    state.config.selectedLandingSiteId = site.id;
    state.config.landingSiteId = site.id;
    state.config.selectedLandingSite = selected;
    if (state.config.planetScan) {
      state.config.planetScan.selectedLandingSiteId = site.id;
      state.config.planetScan.selectedLandingSite = selected;
      state.config.planetScan.landingSites = Array.isArray(state.config.planetScan.landingSites) ? state.config.planetScan.landingSites : [];
      if (!state.config.planetScan.landingSites.some(entry => entry.id === site.id)) state.config.planetScan.landingSites.push(selected);
    }
    if (state.world) {
      state.world.landingSite = selected;
      state.world.planetScan = state.config.planetScan || state.world.planetScan || null;
    }
  }

  function loadSector(siteId, options = {}) {
    const worldMap = ensureWorldMap();
    const site = siteById(siteId);
    if (!worldMap || !site) return false;
    if (!options.skipSaveCurrent) saveCurrentSector();
    const sectors = sectorStore();
    let sector = sectors[siteId];
    if (!sector) {
      sector = generateSectorForLandingSite(site);
      sectors[siteId] = sector;
    }

    state.world = sector.world;
    state.terrain = sector.terrain || sector.world?.terrain;
    state.objects = sector.objects || sector.world?.objects || [];
    state.world.objects = state.objects;
    state.mobs = sector.mobs || [];
    state.wolves = sector.wolves || [];
    state.visitors = sector.visitors || [];
    state.world.pointsOfInterest = sector.pointsOfInterest || state.world.pointsOfInterest || [];
    state.world.exploration = sector.exploration || state.world.exploration;
    syncConfigToSite(site);
    state.worldMap.currentSiteId = siteId;
    state.worldMap.selectedWorldMapSiteId = siteId;

    for (const id of Object.keys(state.worldMap.visitedSites || {})) state.worldMap.visitedSites[id].current = false;
    state.worldMap.visitedSites[siteId] = {
      ...(state.worldMap.visitedSites[siteId] || {}),
      visited: true,
      generated: true,
      current: true,
      lastVisitedDay: state.day || 1,
      exploredPercent: explorationPercent(sector),
      hasBase: true
    };

    placeColonistsAtSpawn(sector);
    window.HavenfallRuntime?.normalizeState?.(state);
    window.HavenfallRuntime?.bumpPathVersion?.(state, 'load-sector');
    if (typeof ensureExplorationState === 'function') ensureExplorationState();
    if (typeof updateExploration === 'function') updateExploration(true);
    if (typeof ensureGeologyState === 'function') ensureGeologyState(state.world);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof wallIndexDirty !== 'undefined') wallIndexDirty = true;
    if (typeof centerCameraOnSelectedColonist === 'function') centerCameraOnSelectedColonist();
    ensureWorldMap({ refresh: true });
    return true;
  }

  function startTravel(toSiteId, options = {}) {
    const worldMap = ensureWorldMap();
    const plan = calculateTravelPlan(toSiteId, options);
    const validation = canTravel(plan);
    const site = siteById(toSiteId);
    if (!validation.ok) {
      if (typeof log === 'function') log(`Viagem cancelada: ${validation.reasons.join(' ')}`);
      return { ok: false, plan, ...validation };
    }

    state.activeTravel = { ...plan, startedDay: state.day, startedHour: state.hour, status: 'traveling' };
    saveCurrentSector();
    if (plan.foodCost > 0) {
      const spent = typeof consumeCost === 'function'
        ? consumeCost({ food: plan.foodCost }, { reason: 'travel-supplies', targetId: toSiteId })
        : window.GameState?.consumeResources?.({ food: plan.foodCost }, { reason: 'travel-supplies', targetId: toSiteId });
      if (!spent) {
        state.activeTravel = null;
        if (typeof log === 'function') log('Viagem cancelada: suprimentos insuficientes para a expedição.');
        return { ok: false, plan, reasons: ['Suprimentos insuficientes.'] };
      }
    }
    const event = travelEvent(plan, site);
    if (event?.gain) addResources(event.gain, { reason: 'travel-event-gain', targetId: toSiteId });
    const totalHours = plan.estimatedHours + Number(event?.delay || 0);
    advanceTime(totalHours);
    applyTravelConsequences(plan, event);

    const loaded = loadSector(toSiteId, { skipSaveCurrent: true });
    state.activeTravel = null;
    const entry = {
      day: state.day,
      hour: Math.round(state.hour * 10) / 10,
      fromSiteId: plan.fromSiteId,
      toSiteId: plan.toSiteId,
      toSiteName: plan.toSiteName,
      hours: totalHours,
      mode: plan.mode,
      riskScore: plan.riskScore,
      event: event ? event.title : null
    };
    state.worldMap.travelLog.unshift(entry);
    state.worldMap.travelLog = state.worldMap.travelLog.slice(0, 30);
    if (typeof log === 'function') {
      log(`A colônia viajou para ${plan.toSiteName}. Tempo: ${totalHours}h. Risco: ${plan.riskLabel}.`);
      if (event) log(`${event.title}: ${event.text}`);
    }
    if (typeof updateUI === 'function') updateUI(true);
    return { ok: loaded, plan, event, warnings: validation.warnings };
  }

  function establishOutpost(siteId = currentSiteId()) {
    const worldMap = ensureWorldMap();
    if (!worldMap) return false;
    const cost = { wood: 20, food: 10, stone: 5 };
    const res = state.resources || {};
    const ok = Object.entries(cost).every(([key, value]) => (res[key] || 0) >= value);
    if (!ok) {
      if (typeof log === 'function') log('Posto avançado requer 20 madeira, 10 comida e 5 pedra.');
      return false;
    }
    for (const [key, value] of Object.entries(cost)) res[key] -= value;
    worldMap.visitedSites[siteId] = { ...(worldMap.visitedSites[siteId] || {}), hasOutpost: true, visited: true };
    ensureWorldMap({ refresh: true });
    if (typeof log === 'function') log('Posto avançado estabelecido neste setor. Rotas futuras ficam mais seguras.');
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function initializeCurrentSector() {
    if (!isGameplayReady()) return null;
    const worldMap = ensureWorldMap({ refresh: true });
    if (!worldMap) return null;
    if (!sectorStore()[worldMap.currentSiteId]) saveCurrentSector();
    return worldMap;
  }

  function installStatePatch() {
    if (typeof startNewGame === 'function' && !window.HavenfallContext.worldTravelStartNewGamePatched) {
      const nativeStartNewGame = startNewGame;
      startNewGame = function startNewGameWithWorldTravel(config, selectedColonists) {
        const result = nativeStartNewGame(config, selectedColonists);
        if (window.HavenfallRuntime?.markGameplayState) window.HavenfallRuntime.markGameplayState(state);
        initializeCurrentSector();
        return result;
      };
      window.HavenfallContext.worldTravelStartNewGamePatched = true;
    }

    if (typeof loadGame === 'function' && !window.HavenfallContext.worldTravelLoadGamePatched) {
      const nativeLoadGame = loadGame;
      loadGame = function loadGameWithWorldMap() {
        const ok = nativeLoadGame();
        if (ok) initializeCurrentSector();
        return ok;
      };
      window.HavenfallContext.worldTravelLoadGamePatched = true;
    }
  }

  installStatePatch();

  window.HavenfallWorldTravel = Object.freeze({
    modes: TRAVEL_MODES,
    ensureWorldMap,
    initializeCurrentSector,
    snapshotCurrentSector,
    saveCurrentSector,
    loadSector,
    generateSectorForLandingSite,
    calculateTravelPlan,
    canTravel,
    startTravel,
    establishOutpost,
    siteById,
    currentSite,
    riskLabel,
    explorationPercent
  });
})();
