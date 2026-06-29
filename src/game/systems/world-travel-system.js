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
    return { profile, sites, selectedId };
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
    const current = worldMap.landingSites.find(site => site.id === worldMap.currentSiteId) || worldMap.landingSites[0];
    return worldMap.landingSites
      .filter(site => site.id !== current?.id)
      .map(site => ({
        from: current?.id,
        to: site.id,
        distance: Math.round(distanceBetweenSites(current, site) * 10) / 10,
        risk: riskAverage(site),
        known: site.state !== 'unknown' && site.state !== 'locked'
      }));
  }

  function ensureWorldMap(options = {}) {
    if (!isGameplayReady()) return null;
    const previous = state.worldMap || {};
    const cacheKey = [
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
    state.resources.food = (state.resources.food || 0) - plan.foodCost;
    const event = travelEvent(plan, site);
    if (event?.gain) for (const [key, value] of Object.entries(event.gain)) state.resources[key] = (state.resources[key] || 0) + value;
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