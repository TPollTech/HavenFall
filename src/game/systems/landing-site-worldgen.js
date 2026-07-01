'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteWorldgenInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteWorldgenInstalled = true;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }
  function hash(text) { return typeof hashSeed === 'function' ? hashSeed(String(text)) : String(text).split('').reduce((a,c)=>Math.imul(a^c.charCodeAt(0),16777619),2166136261)>>>0; }
  function noise(seed, x, y, salt='n') { return (hash(`${seed}|${salt}|${x}|${y}`) % 10000) / 10000; }
  function coordKey(x,y) { return `${x},${y}`; }

  function ensureConfig(config) {
    return typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(config || {}) : (config || {});
  }

  function selectedSite(config) {
    const profile = config?.planetScan;
    return config?.selectedLandingSite
      || profile?.selectedLandingSite
      || profile?.landingSites?.find(site => site.id === (config?.selectedLandingSiteId || config?.landingSiteId || profile?.selectedLandingSiteId))
      || profile?.landingSites?.[0]
      || null;
  }

  function compactSite(site) {
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
      previewSeed: site.preview?.seed || null
    };
  }

  function bestSpawnNear(world, site, seed) {
    const cols = world.cols, rows = world.rows;
    const gx = clamp(Math.round((site.globe?.x ?? 0.5) * (cols - 1)), 4, cols - 5);
    const gy = clamp(Math.round((site.globe?.y ?? 0.5) * (rows - 1)), 4, rows - 5);
    const radius = Math.max(12, Math.floor(Math.min(cols, rows) * 0.18));
    let best = { x: gx, y: gy, score: -Infinity };
    const occupied = occupiedSet(world);
    for (let y = Math.max(4, gy - radius); y <= Math.min(rows - 5, gy + radius); y++) {
      for (let x = Math.max(4, gx - radius); x <= Math.min(cols - 5, gx + radius); x++) {
        const tile = world.terrain?.[y]?.[x] || 'grass';
        if (tile === 'water' || tile === 'stone') continue;
        let blocked = false;
        for (let yy = y - 1; yy <= y + 1 && !blocked; yy++) {
          for (let xx = x - 1; xx <= x + 1; xx++) {
            if (occupied.has(coordKey(xx, yy))) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) continue;
        let score = 32 - Math.hypot(x - gx, y - gy) * 0.42 + noise(seed, x, y, 'landing-spawn') * 8;
        if (tile === 'grass') score += 12;
        if (tile === 'dirt') score += 6;
        if (tile === 'sand') score -= site.biomes?.primary === 'desert' ? 0 : 8;
        if (site.resources?.water > 65 && nearbyTerrain(world, x, y, 'water', 10) > 0) score += 5;
        if (site.buildSpace > 65) score += openSpaceScore(world, x, y);
        if (score > best.score) best = { x, y, score };
      }
    }
    return { x: best.x, y: best.y };
  }

  function nearbyTerrain(world, x, y, type, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) {
      if (world.terrain?.[yy]?.[xx] === type) count++;
    }
    return count;
  }

  function openSpaceScore(world, x, y) {
    let score = 0;
    for (let yy = y - 4; yy <= y + 4; yy++) for (let xx = x - 4; xx <= x + 4; xx++) {
      const tile = world.terrain?.[yy]?.[xx];
      if (tile === 'grass' || tile === 'dirt' || tile === 'sand') score += 0.08;
      if (tile === 'stone' || tile === 'water') score -= 0.12;
    }
    return score;
  }

  function removeOldCamp(world, oldSpawn) {
    if (!oldSpawn || !Array.isArray(world.objects)) return;
    const campTypes = new Set(['campfire', 'crate', 'logs']);
    world.objects = world.objects.filter(obj => !(campTypes.has(obj.type) && Math.hypot(obj.x - oldSpawn.x, obj.y - oldSpawn.y) <= 4));
  }

  function occupiedSet(world) {
    return new Set((world.objects || []).map(o => coordKey(o.x, o.y)));
  }

  function addObject(world, type, x, y, extra = {}, occupied = occupiedSet(world)) {
    if (x < 1 || y < 1 || x >= world.cols - 1 || y >= world.rows - 1) return null;
    if (occupied.has(coordKey(x,y))) return null;
    const obj = { id: `${type}_${hash(`${world.seed}|${type}|${x}|${y}|landing`).toString(36)}`, type, x, y, ...extra };
    world.objects.push(obj);
    occupied.add(coordKey(x,y));
    return obj;
  }

  function carveClearing(world, spawn, site) {
    const radius = clamp(site.worldgenModifiers?.spawnClearingRadius || 6, 4, 10);
    for (let y = spawn.y - radius - 1; y <= spawn.y + radius + 1; y++) for (let x = spawn.x - radius - 1; x <= spawn.x + radius + 1; x++) {
      if (x < 1 || y < 1 || x >= world.cols - 1 || y >= world.rows - 1) continue;
      const d = Math.hypot(x - spawn.x, y - spawn.y);
      if (d > radius + 0.5) continue;
      if (site.biomes?.primary === 'desert') world.terrain[y][x] = d < radius - 1 ? 'sand' : 'dirt';
      else if (site.biomes?.primary === 'rock') world.terrain[y][x] = d < radius - 2 ? 'dirt' : world.terrain[y][x];
      else world.terrain[y][x] = d < radius - 1 ? 'grass' : 'dirt';
    }
  }

  function placeCamp(world, spawn) {
    const occ = occupiedSet(world);
    addObject(world, 'campfire', spawn.x, spawn.y, {}, occ);
    addObject(world, 'crate', spawn.x + 2, spawn.y, {}, occ);
    addObject(world, 'logs', spawn.x - 2, spawn.y + 1, {}, occ);
  }

  function applyTerrainBias(world, site, seed) {
    const mods = site.worldgenModifiers || {};
    const primary = site.biomes?.primary || 'forest';
    const rockChance = clamp((mods.mountainChance || 0) * 0.09 + ((site.resources?.stone || 0) - 45) / 900, 0, 0.16);
    const waterChance = clamp((mods.riverChance || 0) * 0.08 + ((site.resources?.water || 0) - 45) / 1100, 0, 0.14);
    const forestChance = clamp(((mods.treeMultiplier || 1) - 1) * 0.10 + ((site.resources?.wood || 0) - 48) / 900, -0.06, 0.16);
    for (let y = 2; y < world.rows - 2; y++) for (let x = 2; x < world.cols - 2; x++) {
      const n = noise(seed, x, y, 'landing-terrain');
      const t = world.terrain[y][x];
      if (primary === 'desert' && t !== 'stone' && n < 0.10) world.terrain[y][x] = 'sand';
      else if (primary === 'snow' && t === 'grass' && n < 0.08) world.terrain[y][x] = 'dirt';
      else if (rockChance > 0 && n > 1 - rockChance && t !== 'water') world.terrain[y][x] = 'stone';
      else if (waterChance > 0 && n < waterChance * 0.25 && t !== 'stone') world.terrain[y][x] = 'water';
      else if (forestChance > 0 && ['dirt','sand'].includes(t) && n > 0.52 && n < 0.52 + forestChance) world.terrain[y][x] = 'grass';
    }
  }

  function randomTile(world, site, seed, kind, tries = 260, occ = occupiedSet(world)) {
    for (let i = 0; i < tries; i++) {
      const x = 2 + Math.floor(noise(seed, i, kind.length, `${kind}-x`) * Math.max(1, world.cols - 4));
      const y = 2 + Math.floor(noise(seed, i, kind.length, `${kind}-y`) * Math.max(1, world.rows - 4));
      const t = world.terrain?.[y]?.[x];
      if (occ.has(coordKey(x,y))) continue;
      if (Math.hypot(x - world.spawn.x, y - world.spawn.y) < 5) continue;
      if (kind === 'tree' && !['grass','dirt'].includes(t)) continue;
      if (kind === 'berry' && t !== 'grass') continue;
      if (kind === 'rock' && !['stone','dirt','grass'].includes(t)) continue;
      if (kind === 'ore' && t !== 'stone') continue;
      if (kind === 'ruin' && t === 'water') continue;
      return { x, y };
    }
    return null;
  }

  function applyResourceBias(world, site, seed) {
    if (!Array.isArray(world.objects)) world.objects = [];
    const area = world.cols * world.rows;
    const mods = site.worldgenModifiers || {};
    const occ = occupiedSet(world);
    const extras = {
      tree: Math.max(0, Math.floor(area * 0.006 * Math.max(0, (mods.treeMultiplier || 1) - 0.85))),
      berry: Math.max(0, Math.floor(area * 0.0028 * Math.max(0, (mods.berryMultiplier || 1) - 0.75))),
      rock: Math.max(0, Math.floor(area * 0.0038 * Math.max(0, (mods.rockMultiplier || 1) - 0.85))),
      ore: Math.max(0, Math.floor(area * 0.0018 * Math.max(0, (mods.oreMultiplier || 1) - 0.80))),
      ruin: Math.max(0, Math.floor((mods.ruinChance || 0) * 7))
    };
    for (const [type, amount] of Object.entries(extras)) {
      const objectType = type === 'ruin' ? 'ruin' : type;
      for (let i = 0; i < amount; i++) {
        const tile = randomTile(world, site, seed, type, 180, occ);
        if (!tile) continue;
        addObject(world, objectType, tile.x, tile.y, type === 'ruin' ? { landingSiteId: site.id, poiId: `landing_ruin_${i}` } : {}, occ);
      }
    }
  }

  function applyPoiBias(world, site, seed) {
    const multiplier = site.worldgenModifiers?.poiMultiplier || 1;
    const bonus = Math.max(0, Math.floor((multiplier - 1) * 5));
    if (!bonus) return;
    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];
    const occ = occupiedSet(world);
    for (let i = 0; i < bonus; i++) {
      const tile = randomTile(world, site, seed, 'ruin', 220, occ);
      if (!tile) continue;
      const id = `landing_poi_${i}`;
      addObject(world, 'cache', tile.x, tile.y, { poiId: id, landingSiteId: site.id }, occ);
      world.pointsOfInterest.push({ id, name: `${site.name} - eco orbital ${i + 1}`, type: 'cache', x: tile.x, y: tile.y, landingSiteId: site.id, discovered: false, inspected: false });
    }
  }

  function applyWeatherBias(world, site) {
    const risk = clamp(site.risks?.weather || 35, 0, 100) / 100;
    const water = clamp(site.resources?.water || 30, 0, 100) / 100;
    for (const day of world.weatherPattern || []) {
      day.rainChance = Math.round(clamp(day.rainChance + (water - 0.45) * 0.08 + (risk - 0.5) * 0.04, 0.02, 0.72) * 100) / 100;
      day.stormChance = Math.round(clamp(day.stormChance + (risk - 0.45) * 0.09, 0.01, 0.34) * 100) / 100;
    }
  }

  function applyLandingSite(world, config, site) {
    if (!world || !site) return world;
    const seed = site.preview?.seed || `${config.seed}|${site.id}|landing-worldgen`;
    const oldSpawn = world.spawn ? { ...world.spawn } : null;
    applyTerrainBias(world, site, seed);
    const spawn = bestSpawnNear(world, site, seed);
    removeOldCamp(world, oldSpawn);
    world.spawn = spawn;
    carveClearing(world, spawn, site);
    placeCamp(world, spawn);
    applyResourceBias(world, site, seed);
    applyPoiBias(world, site, seed);
    applyWeatherBias(world, site);
    world.landingSite = compactSite(site);
    world.worldgenSource = {
      version: 'landing-sites-v1',
      seed: config.seed,
      landingSeed: seed,
      selectedLandingSiteId: site.id,
      archetype: site.archetype,
      appliedModifiers: { ...(site.worldgenModifiers || {}) }
    };
    world.landingRiskProfile = { ...(site.risks || {}) };
    world.generationVersion = '1.9.0-landing-sites';
    if (world.planetScan) {
      world.planetScan.selectedLandingSiteId = site.id;
      world.planetScan.selectedLandingSite = compactSite(site);
    }
    return world;
  }

  function installWorldgenPatch() {
    window.HavenfallContext.landingSiteWorldgenPatched = true;
  }

  function installStartPatch() {
    window.HavenfallContext.landingSiteStartPatched = true;
  }

  installWorldgenPatch();
  installStartPatch();

  window.HavenfallLandingSiteWorldgen = Object.freeze({
    ensureConfig,
    selectedSite,
    applyLandingSite
  });
})();
