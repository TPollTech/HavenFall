'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteWorldgenPolishInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteWorldgenPolishInstalled = true;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function hash(text) {
    if (typeof hashSeed === 'function') return hashSeed(String(text));
    let h = 2166136261;
    const str = String(text || 'landing');
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function noise(seed, x, y, salt = 'n') {
    return (hash(`${seed}|${salt}|${x}|${y}`) % 10000) / 10000;
  }

  function key(x, y) {
    return `${x},${y}`;
  }

  function inside(world, x, y, margin = 1) {
    return !!world && x >= margin && y >= margin && x < world.cols - margin && y < world.rows - margin;
  }

  function activeSite(config, world) {
    const profile = config?.planetScan || world?.planetScan;
    return config?.selectedLandingSite
      || profile?.selectedLandingSite
      || world?.landingSite
      || profile?.landingSites?.find(site => site.id === (config?.selectedLandingSiteId || config?.landingSiteId || profile?.selectedLandingSiteId))
      || null;
  }

  function occupied(world) {
    return new Set((world?.objects || []).map(obj => key(obj.x, obj.y)));
  }

  function addObject(world, type, x, y, extra = {}, occ = occupied(world)) {
    if (!inside(world, x, y, 1)) return null;
    const k = key(x, y);
    if (occ.has(k)) return null;
    const obj = {
      id: `${type}_${hash(`${world.seed}|polish|${type}|${x}|${y}|${world.objects?.length || 0}`).toString(36)}`,
      type,
      x,
      y,
      ...extra
    };
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    world.objects.push(obj);
    occ.add(k);
    return obj;
  }

  function terrain(world, x, y) {
    return world?.terrain?.[y]?.[x] || 'grass';
  }

  function setTerrain(world, x, y, type) {
    if (inside(world, x, y, 1) && world.terrain?.[y]) world.terrain[y][x] = type;
  }

  function distanceToSpawn(world, x, y) {
    return Math.hypot(x - world.spawn.x, y - world.spawn.y);
  }

  function buildLandingSeed(world, site) {
    return site?.previewSeed || site?.preview?.seed || `${world.seed}|${site?.id || 'landing'}|world-polish`;
  }

  function applyRiver(world, site, seed, effects) {
    const water = Number(site?.resources?.water || 0);
    const chance = Number(site?.worldgenModifiers?.riverChance || 0);
    if (water < 62 && chance < 0.46) return;

    const vertical = noise(seed, 1, 1, 'river-axis') > 0.55;
    const anchor = vertical ? world.spawn.x + Math.round((noise(seed, 2, 1, 'river-offset') - 0.5) * 22) : world.spawn.y + Math.round((noise(seed, 1, 2, 'river-offset') - 0.5) * 18);
    const width = clamp(Math.round(2 + water / 28), 2, 5);
    const length = vertical ? world.rows : world.cols;

    for (let i = 2; i < length - 2; i++) {
      const wave = Math.round(Math.sin(i * 0.11 + noise(seed, i, 0, 'river-wave') * 4) * 3);
      for (let w = -width; w <= width; w++) {
        const x = vertical ? anchor + wave + w : i;
        const y = vertical ? i : anchor + wave + w;
        if (!inside(world, x, y, 2)) continue;
        if (distanceToSpawn(world, x, y) < 7) continue;
        const edge = Math.abs(w);
        if (edge <= Math.max(1, Math.floor(width * 0.55))) setTerrain(world, x, y, 'water');
        else if (terrain(world, x, y) !== 'stone') setTerrain(world, x, y, 'dirt');
      }
    }

    effects.push('Rio/área úmida próxima conforme leitura hídrica do pouso.');
  }

  function applyDefensiveRidge(world, site, seed, effects) {
    const rock = Number(site?.resources?.stone || 0);
    const mountain = Number(site?.worldgenModifiers?.mountainChance || 0);
    if (rock < 62 && mountain < 0.42) return;

    const start = noise(seed, 5, 5, 'ridge-start') * Math.PI * 2;
    const arc = Math.PI * (0.72 + noise(seed, 6, 5, 'ridge-arc') * 0.42);
    const radius = 15 + Math.round(noise(seed, 7, 5, 'ridge-radius') * 14);
    const thickness = rock > 80 ? 4 : 3;

    for (let step = 0; step < 110; step++) {
      const angle = start + (step / 109) * arc;
      const cx = Math.round(world.spawn.x + Math.cos(angle) * radius);
      const cy = Math.round(world.spawn.y + Math.sin(angle) * radius * 0.72);
      for (let y = cy - thickness; y <= cy + thickness; y++) {
        for (let x = cx - thickness; x <= cx + thickness; x++) {
          if (!inside(world, x, y, 2)) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d > thickness + noise(seed, x, y, 'ridge-shape')) continue;
          if (distanceToSpawn(world, x, y) < 8) continue;
          setTerrain(world, x, y, 'stone');
        }
      }
    }

    effects.push('Crista rochosa defensiva criada perto do setor inicial.');
  }

  function applyBiomePatch(world, site, seed, effects) {
    const primary = site?.biomes?.primary || 'forest';
    const radius = 20 + Math.round((Number(site?.buildSpace || 50) / 100) * 14);
    const clear = Number(site?.worldgenModifiers?.spawnClearingRadius || 6);

    for (let y = world.spawn.y - radius; y <= world.spawn.y + radius; y++) {
      for (let x = world.spawn.x - radius; x <= world.spawn.x + radius; x++) {
        if (!inside(world, x, y, 2)) continue;
        const d = distanceToSpawn(world, x, y);
        if (d < clear) continue;
        const n = noise(seed, x, y, 'biome-patch');
        if (primary === 'desert' && n < 0.42) setTerrain(world, x, y, 'sand');
        else if (primary === 'snow' && n < 0.28 && terrain(world, x, y) !== 'water') setTerrain(world, x, y, 'dirt');
        else if (primary === 'rock' && n > 0.72) setTerrain(world, x, y, 'stone');
        else if (primary === 'water' && n < 0.20 && d > clear + 3) setTerrain(world, x, y, 'dirt');
        else if (primary === 'forest' && ['sand', 'stone'].includes(terrain(world, x, y)) && n > 0.62) setTerrain(world, x, y, 'grass');
      }
    }

    effects.push(`Microbioma inicial reforçado: ${primary}.`);
  }

  function placeForestRing(world, site, seed, effects) {
    const treeFactor = Number(site?.worldgenModifiers?.treeMultiplier || 1);
    const wood = Number(site?.resources?.wood || 0);
    if (treeFactor < 1.10 && wood < 62) return;

    const occ = occupied(world);
    const amount = Math.min(95, Math.round((wood - 45) * 1.15 + treeFactor * 24));
    for (let i = 0; i < amount; i++) {
      const angle = noise(seed, i, 1, 'tree-angle') * Math.PI * 2;
      const radius = 9 + noise(seed, i, 2, 'tree-radius') * 28;
      const x = Math.round(world.spawn.x + Math.cos(angle) * radius);
      const y = Math.round(world.spawn.y + Math.sin(angle) * radius);
      if (!inside(world, x, y, 2)) continue;
      if (!['grass', 'dirt'].includes(terrain(world, x, y))) continue;
      if (distanceToSpawn(world, x, y) < 7) continue;
      const type = noise(seed, i, 3, 'tree-kind') > 0.82 ? 'bush' : 'tree';
      addObject(world, type, x, y, { landingSiteId: site.id }, occ);
    }

    effects.push('Anel de vegetação inicial criado conforme riqueza de madeira.');
  }

  function placeRockAndOrePocket(world, site, seed, effects) {
    const ore = Number(site?.worldgenModifiers?.oreMultiplier || 1);
    const metal = Number(site?.resources?.metal || 0);
    const stone = Number(site?.resources?.stone || 0);
    if (ore < 1.08 && metal < 52 && stone < 68) return;

    const occ = occupied(world);
    const amount = Math.min(54, Math.round((metal + stone) / 4.5));
    for (let i = 0; i < amount; i++) {
      const angle = noise(seed, i, 11, 'ore-angle') * Math.PI * 2;
      const radius = 14 + noise(seed, i, 12, 'ore-radius') * 34;
      const x = Math.round(world.spawn.x + Math.cos(angle) * radius);
      const y = Math.round(world.spawn.y + Math.sin(angle) * radius);
      if (!inside(world, x, y, 2)) continue;
      if (distanceToSpawn(world, x, y) < 10) continue;
      if (terrain(world, x, y) !== 'stone' && noise(seed, x, y, 'ore-place') < 0.38) setTerrain(world, x, y, 'stone');
      const type = noise(seed, i, 13, 'ore-kind') < clamp(metal / 130, 0.18, 0.72) ? 'ore' : 'rock';
      addObject(world, type, x, y, { landingSiteId: site.id }, occ);
    }

    effects.push('Bolsões de pedra/minério posicionados conforme leitura geológica.');
  }

  function placeFoodAndHerbs(world, site, seed, effects) {
    const food = Number(site?.resources?.food || 0);
    const medicine = Number(site?.resources?.medicine || 0);
    if (food < 55 && medicine < 48) return;

    const occ = occupied(world);
    const amount = Math.min(46, Math.round(food / 5 + medicine / 7));
    for (let i = 0; i < amount; i++) {
      const angle = noise(seed, i, 21, 'food-angle') * Math.PI * 2;
      const radius = 8 + noise(seed, i, 22, 'food-radius') * 22;
      const x = Math.round(world.spawn.x + Math.cos(angle) * radius);
      const y = Math.round(world.spawn.y + Math.sin(angle) * radius);
      if (!inside(world, x, y, 2)) continue;
      if (terrain(world, x, y) !== 'grass') continue;
      const type = noise(seed, i, 23, 'food-kind') < clamp(medicine / 140, 0.14, 0.52) ? 'bush' : 'berry';
      addObject(world, type, x, y, { landingSiteId: site.id }, occ);
    }

    effects.push('Comida e ervas próximas calibradas pelo score biológico.');
  }

  function placeRuinCluster(world, site, seed, effects) {
    const ruinChance = Number(site?.worldgenModifiers?.ruinChance || 0);
    const raids = Number(site?.risks?.raids || 0);
    if (ruinChance < 0.22 && raids < 48) return;

    const occ = occupied(world);
    const angle = noise(seed, 31, 1, 'ruin-angle') * Math.PI * 2;
    const radius = 22 + noise(seed, 31, 2, 'ruin-radius') * 30;
    const cx = Math.round(world.spawn.x + Math.cos(angle) * radius);
    const cy = Math.round(world.spawn.y + Math.sin(angle) * radius);
    if (!inside(world, cx, cy, 5)) return;

    const clusterId = `landing_ruin_cluster_${hash(`${seed}|ruin-cluster`).toString(36)}`;
    const layout = [
      [0, 0, 'ruin'], [1, 0, 'cache'], [-1, 0, 'ruin'], [0, 1, 'supply_crate'],
      [2, 1, 'rock'], [-2, -1, 'rock'], [1, -2, 'logs'], [-1, 2, 'crate']
    ];
    for (const [dx, dy, type] of layout) {
      const x = cx + dx;
      const y = cy + dy;
      if (!inside(world, x, y, 2)) continue;
      if (terrain(world, x, y) === 'water') setTerrain(world, x, y, 'dirt');
      addObject(world, type, x, y, { landingSiteId: site.id, poiId: clusterId }, occ);
    }

    world.pointsOfInterest = Array.isArray(world.pointsOfInterest) ? world.pointsOfInterest : [];
    world.pointsOfInterest.push({
      id: clusterId,
      name: `${site.name} - estrutura detectada`,
      type: 'ruin',
      x: cx,
      y: cy,
      landingSiteId: site.id,
      discovered: false,
      inspected: false,
      orbitalNote: 'Ruína gerada pelo ponto de pouso selecionado.'
    });

    effects.push('Ruína/loot orbital adicionada como ponto de interesse real.');
  }

  function placeStarterHints(world, site, seed, effects) {
    const occ = occupied(world);
    const siteScore = Number(site?.difficulty?.score || 50);
    const crateChance = siteScore < 40 ? 0.30 : siteScore > 72 ? 0.08 : 0.16;
    if (noise(seed, 44, 1, 'starter-hint') > crateChance) return;
    const x = world.spawn.x + (noise(seed, 44, 2, 'starter-x') > 0.5 ? 4 : -4);
    const y = world.spawn.y + (noise(seed, 44, 3, 'starter-y') > 0.5 ? 3 : -3);
    addObject(world, 'supply_crate', x, y, { landingSiteId: site.id, starterHint: true }, occ);
    effects.push('Pequeno cache inicial colocado para comunicar a escolha do pouso.');
  }

  function refreshExplorationIfNeeded(world) {
    if (typeof makeExplorationMatrix !== 'function') return;
    if (!Array.isArray(world.exploration) || world.exploration.length !== world.rows || world.exploration[0]?.length !== world.cols) {
      world.exploration = makeExplorationMatrix(world.cols, world.rows);
    }
  }

  function rebuildSpawnPoints(world) {
    if (typeof makeSpawnPoints === 'function') {
      world.spawnPoints = makeSpawnPoints(world.spawn, world.cols, world.rows);
    } else {
      world.spawnPoints = [
        { x: Math.max(2, world.spawn.x - 8), y: Math.max(2, world.spawn.y - 5), kind: 'northwest' },
        { x: Math.min(world.cols - 3, world.spawn.x + 8), y: Math.max(2, world.spawn.y - 5), kind: 'northeast' },
        { x: Math.max(2, world.spawn.x - 8), y: Math.min(world.rows - 3, world.spawn.y + 5), kind: 'southwest' },
        { x: Math.min(world.cols - 3, world.spawn.x + 8), y: Math.min(world.rows - 3, world.spawn.y + 5), kind: 'southeast' }
      ];
    }
  }

  function applyPolish(world, config, site) {
    if (!world || !site || world.worldgenSource?.polishVersion === 'landing-site-polish-v2') return world;
    world.objects = Array.isArray(world.objects) ? world.objects : [];
    const seed = buildLandingSeed(world, site);
    const effects = [];

    applyBiomePatch(world, site, seed, effects);
    applyRiver(world, site, seed, effects);
    applyDefensiveRidge(world, site, seed, effects);
    placeForestRing(world, site, seed, effects);
    placeRockAndOrePocket(world, site, seed, effects);
    placeFoodAndHerbs(world, site, seed, effects);
    placeRuinCluster(world, site, seed, effects);
    placeStarterHints(world, site, seed, effects);

    refreshExplorationIfNeeded(world);
    rebuildSpawnPoints(world);

    world.landingSite = { ...(world.landingSite || site), appliedEffects: effects };
    world.landingBiomeIntent = {
      primary: site.biomes?.primary || 'forest',
      secondary: site.biomes?.secondary || [],
      mix: site.biomes?.mix || {}
    };
    world.landingNarrative = {
      title: site.name,
      verdict: site.difficulty?.label || 'Moderado',
      positives: site.positives || [],
      negatives: site.negatives || [],
      effects
    };
    world.worldgenSource = {
      ...(world.worldgenSource || {}),
      polishVersion: 'landing-site-polish-v2',
      polishedAt: 'world-generation',
      selectedLandingSiteId: site.id,
      archetype: site.archetype,
      riskAverage: Math.round(Object.values(site.risks || {}).reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, Object.keys(site.risks || {}).length)),
      resourceAverage: Math.round(Object.values(site.resources || {}).reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, Object.keys(site.resources || {}).length))
    };
    world.generationVersion = `${world.generationVersion || 'world'}+landing-polish`;
    return world;
  }

  function applyToWorld(world, config = {}) {
    const site = activeSite(config, world);
    return site ? applyPolish(world, config, site) : world;
  }

  function applyInitialMobs(mobs, world, config = {}, colonists = []) {
    mobs = mobs || [];
    const site = activeSite(config, world);
    if (!site || mobs._landingPolished) return mobs;

    const faunaRisk = Number(site.risks?.fauna || 0);
    const threatMultiplier = Number(site.worldgenModifiers?.initialThreatMultiplier || 1);
    const safeRadius = threatMultiplier < 0.85 ? 24 : 16;
    const passiveBonus = faunaRisk > 55 ? 3 : faunaRisk > 36 ? 2 : 0;
    const seed = buildLandingSeed(world, site);

    for (let i = 0; i < passiveBonus && mobs.length < 38; i++) {
      const type = ['rabbit', 'deer', 'goat', 'chicken'][hash(`${seed}|passive|${i}`) % 4];
      const tile = findFaunaTile(world, seed, type, i, safeRadius);
      if (!tile) continue;
      const stats = window.mobStatModifiers?.[type] || { hp: 40 };
      mobs.push({
        id: `landing_mob_${type}_${i}_${hash(`${seed}|${type}|${tile.x}|${tile.y}`).toString(36)}`,
        type,
        x: tile.x,
        y: tile.y,
        px: tile.x * TILE + TILE / 2,
        py: tile.y * TILE + TILE / 2,
        dir: noise(seed, tile.x, tile.y, 'dir') > 0.5 ? 'right' : 'left',
        anim: 0,
        attackAnimTimer: 0,
        hitAnimTimer: 0,
        hp: stats.hp,
        maxHp: stats.hp,
        state: 'wander',
        target: null,
        landingSiteId: site.id
      });
    }

    mobs._landingPolished = true;
    return mobs;
  }

  function installGenerateWorldPatch() {
    window.HavenfallContext.landingSiteWorldgenPolishPatched = true;
  }

  function installInitialMobsPatch() {
    window.HavenfallContext.landingSiteMobsPolishPatched = true;
  }

  function findFaunaTile(world, seed, type, offset, minDist) {
    for (let i = 0; i < 220; i++) {
      const x = 2 + Math.floor(noise(seed, i + offset * 11, 1, 'fauna-x') * Math.max(1, world.cols - 4));
      const y = 2 + Math.floor(noise(seed, i + offset * 11, 2, 'fauna-y') * Math.max(1, world.rows - 4));
      if (!inside(world, x, y, 2)) continue;
      if (Math.hypot(x - world.spawn.x, y - world.spawn.y) < minDist) continue;
      const t = terrain(world, x, y);
      if (!['grass', 'dirt', 'sand'].includes(t)) continue;
      if ((world.objects || []).some(obj => obj.x === x && obj.y === y)) continue;
      return { x, y };
    }
    return null;
  }

  installGenerateWorldPatch();
  installInitialMobsPatch();

  window.HavenfallLandingSiteWorldgenPolish = Object.freeze({
    version: 'landing-site-polish-v2',
    applyPolish,
    applyToWorld,
    applyInitialMobs
  });
})();
