'use strict';

function startNewGame(config, selectedColonists) {
  state = createInitialState(config, selectedColonists);
  ensureResearchState();
  selectedColonistId = state.colonists[0]?.id || 1;
  currentBuild = null;
  updateExploration(true);
  centerCameraOnSelectedColonist();
  state.paused = false;
  started = true;
  activeSession = true;
  log(`Nova partida iniciada: ${config.colonyName}. Seed: ${config.seed}. Mundo: ${getWorldCols()}x${getWorldRows()}.`);
  setScreen(SCREEN.PLAYING);
  updateUI(true);
}

function continueFromMenu() {
  if (activeSession && state) {
    setScreen(SCREEN.PLAYING);
    return;
  }
  if (!localStorage.getItem(SAVE_KEY)) {
    setScreen(SCREEN.LOAD_GAME);
    return;
  }
  loadAndPlay();
}

function loadAndPlay() {
  const ok = loadGame();
  if (ok) { activeSession = true; setScreen(SCREEN.PLAYING); }
}

function loadImages() {
  const spriteLoads = assetNames.map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = reject;
    img.src = typeof spriteSrc === 'function' ? spriteSrc(name) : `assets/ui/${name}.png`;
  }));

  const animationLoads = Object.entries(window.HavenfallAssets?.animations || {}).map(([key, animation]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[`vfx:${key}`] = img; resolve(); };
    img.onerror = reject;
    img.src = animation.path;
  }));

  return Promise.all([...spriteLoads, ...animationLoads]);
}

function generateWorldFromSeed(config) {
  config = { ...defaultNewGameConfig, ...config };
  const size = getMapSizeDef(config.mapSize);
  const cols = size.cols;
  const rows = size.rows;
  const rand = seededRandom(`${config.seed}|${config.mapSize}|${config.difficulty}|world-v18`);
  const terrain = createTerrainMap(cols, rows, config, rand);
  const spawn = chooseSpawnPoint(terrain, cols, rows, config, rand);
  carveSpawnClearing(terrain, spawn.x, spawn.y, cols, rows);

  const objects = [];
  const add = (type, x, y, extra = {}) => {
    if (!isWorldCoordInside(x, y, cols, rows)) return null;
    if (objects.some(o => o.x === x && o.y === y)) return null;
    const obj = { id: worldUid(type, objects.length, config.seed), type, x, y, ...extra };
    objects.push(obj);
    return obj;
  };

  generateResourceFields({ terrain, objects, cols, rows, spawn, config, rand, add });
  const pointsOfInterest = generatePointsOfInterest({ terrain, objects, cols, rows, spawn, config, rand, add });
  placeStartingCamp({ objects, spawn, add });

  const exploration = makeExplorationMatrix(cols, rows);
  const spawnPoints = makeSpawnPoints(spawn, cols, rows);

  const world = {
    seed: config.seed,
    mapSize: config.mapSize,
    difficulty: config.difficulty,
    chunkMode: !!size.chunkMode,
    biomeIntent: size.biomeIntent || 'classic',
    cols,
    rows,
    tileSize: TILE,
    width: cols * TILE,
    height: rows * TILE,
    terrain,
    objects,
    exploration,
    visibleTiles: [],
    spawn,
    spawnPoints,
    pointsOfInterest,
    weatherPattern: generateWeatherPattern(config, rand),
    generationVersion: '1.8.2'
  };

  return window.BiomeEngine?.applyToWorld ? window.BiomeEngine.applyToWorld(world, config) : world;
}

function difficultyResourceFactor(difficulty) {
  if (difficulty === 'easy') return 1.12;
  if (difficulty === 'hard') return 0.88;
  if (difficulty === 'hardcore') return 0.72;
  return 1;
}

function difficultyRockBonus(difficulty) {
  if (difficulty === 'hard') return 0.05;
  if (difficulty === 'hardcore') return 0.085;
  return 0;
}

function eventIntensityValue(intensity) {
  return ({ low: 3, normal: 5, high: 8 })[intensity] || 5;
}

function generateWeatherPattern(config, rand) {
  const intensity = eventIntensityValue(config?.eventIntensity || 'normal');
  const difficultyBonus = config?.difficulty === 'hardcore' ? 0.06 : config?.difficulty === 'hard' ? 0.035 : 0;
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const seasonalWave = Math.sin((day / 30) * Math.PI * 2) * 0.035;
    const rainChance = Math.max(0.04, Math.min(0.62, 0.12 + rand() * 0.18 + intensity * 0.01 + seasonalWave + difficultyBonus));
    const stormChance = Math.max(0.01, Math.min(0.26, 0.025 + intensity * 0.008 + difficultyBonus * 0.55 + rand() * 0.035));
    return {
      day,
      rainChance: Math.round(rainChance * 100) / 100,
      stormChance: Math.round(stormChance * 100) / 100
    };
  });
}

function createTerrainMap(cols, rows, config, rand) {
  const terrain = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'grass'));
  const regionCount = Math.max(8, Math.floor((cols * rows) / 620));
  const regions = [];
  const types = ['forest', 'rocky', 'dry', 'meadow', 'rough', 'fertile'];
  for (let i = 0; i < regionCount; i++) {
    regions.push({
      x: 4 + Math.floor(rand() * (cols - 8)),
      y: 4 + Math.floor(rand() * (rows - 8)),
      radius: 7 + Math.floor(rand() * Math.max(7, Math.min(cols, rows) / 6)),
      type: types[Math.floor(rand() * types.length)],
      strength: 0.7 + rand() * 0.55
    });
  }

  const hardRockBonus = difficultyRockBonus(config.difficulty);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const edge = Math.min(x, y, cols - 1 - x, rows - 1 - y);
      const noise = worldNoise(config.seed, x, y, 'terrain');
      const rough = worldNoise(config.seed, x, y, 'rough');
      let type = 'grass';

      if (edge <= 1) type = 'sand';
      else if (edge <= 3 && noise < 0.45) type = 'sand';

      let best = null;
      let bestScore = -Infinity;
      for (const r of regions) {
        const d = Math.hypot(x - r.x, y - r.y);
        const score = (1 - d / r.radius) * r.strength;
        if (score > bestScore) { bestScore = score; best = r; }
      }

      if (best && bestScore > 0.08) {
        if (best.type === 'rocky') type = noise > 0.34 ? 'stone' : 'dirt';
        if (best.type === 'dry') type = noise > 0.35 ? 'sand' : 'dirt';
        if (best.type === 'rough') type = rough > 0.5 ? 'stone' : 'dirt';
        if (best.type === 'fertile') type = noise > 0.16 ? 'grass' : 'dirt';
        if (best.type === 'meadow') type = noise > 0.12 ? 'grass' : 'dirt';
        if (best.type === 'forest') type = noise > 0.10 ? 'grass' : 'dirt';
      }

      if (noise + hardRockBonus > 0.91 && edge > 4) type = 'stone';
      if (rough < 0.055 && edge > 4) type = 'dirt';
      terrain[y][x] = type;
    }
  }
  return terrain;
}

function chooseSpawnPoint(terrain, cols, rows, config, rand) {
  const centerX = Math.floor(cols * (0.42 + (rand() - 0.5) * 0.18));
  const centerY = Math.floor(rows * (0.48 + (rand() - 0.5) * 0.18));
  let best = { x: centerX, y: centerY, score: -Infinity };
  const scan = Math.floor(Math.min(cols, rows) * 0.22);
  for (let y = Math.max(4, centerY - scan); y < Math.min(rows - 4, centerY + scan); y++) {
    for (let x = Math.max(4, centerX - scan); x < Math.min(cols - 4, centerX + scan); x++) {
      let score = 0;
      const t = terrain[y][x];
      if (t === 'grass') score += 10;
      if (t === 'dirt') score += 6;
      if (t === 'sand') score -= 7;
      if (t === 'stone') score -= 14;
      score -= Math.hypot(x - centerX, y - centerY) * 0.22;
      score += worldNoise(config.seed, x, y, 'spawn') * 4;
      if (score > best.score) best = { x, y, score };
    }
  }
  return { x: best.x, y: best.y };
}

function carveSpawnClearing(terrain, sx, sy, cols, rows) {
  for (let y = sy - 5; y <= sy + 5; y++) {
    for (let x = sx - 6; x <= sx + 6; x++) {
      if (!isWorldCoordInside(x, y, cols, rows)) continue;
      const d = Math.hypot(x - sx, y - sy);
      if (d <= 5.5) terrain[y][x] = d > 4.4 ? 'dirt' : 'grass';
    }
  }
}

function generateResourceFields(ctx) {
  const { terrain, cols, rows, spawn, config, rand, add } = ctx;
  const size = getMapSizeDef(config.mapSize);
  const area = cols * rows;
  const multiplier = size.resourceMultiplier * difficultyResourceFactor(config.difficulty);
  const counts = {
    tree: Math.floor(area * 0.030 * multiplier),
    bush: Math.floor(area * 0.012 * multiplier),
    berry: Math.floor(area * 0.010 * multiplier),
    rock: Math.floor(area * 0.016 * multiplier),
    ore: Math.floor(area * 0.0065 * multiplier),
    logs: Math.floor(area * 0.0035 * multiplier)
  };

  placeAroundSpawn(add, terrain, spawn, 'tree', 6, 8, 11, rand);
  placeAroundSpawn(add, terrain, spawn, 'berry', 3, 5, 8, rand);
  placeAroundSpawn(add, terrain, spawn, 'rock', 3, 7, 12, rand);

  for (const [type, amount] of Object.entries(counts)) {
    for (let i = 0; i < amount; i++) {
      const tile = weightedResourceTile(type, terrain, cols, rows, spawn, rand, config.seed);
      if (!tile) continue;
      add(type, tile.x, tile.y);
    }
  }
}

function weightedResourceTile(type, terrain, cols, rows, spawn, rand, seed) {
  const minDist = type === 'ore' ? 13 : type === 'rock' ? 7 : 5;
  for (let i = 0; i < 160; i++) {
    const x = 2 + Math.floor(rand() * (cols - 4));
    const y = 2 + Math.floor(rand() * (rows - 4));
    const t = terrain[y][x];
    const d = Math.hypot(x - spawn.x, y - spawn.y);
    if (d < minDist) continue;
    if (type === 'tree' && !['grass', 'dirt'].includes(t)) continue;
    if (type === 'bush' && !['grass', 'dirt'].includes(t)) continue;
    if (type === 'berry' && t !== 'grass') continue;
    if (type === 'rock' && !['stone', 'dirt', 'grass'].includes(t)) continue;
    if (type === 'ore' && t !== 'stone' && worldNoise(seed, x, y, 'ore') < 0.72) continue;
    if (type === 'logs' && !['grass', 'dirt'].includes(t)) continue;
    return { x, y };
  }
  return null;
}

function placeAroundSpawn(add, terrain, spawn, type, amount, minR, maxR, rand) {
  for (let i = 0; i < amount; i++) {
    const angle = rand() * Math.PI * 2;
    const r = minR + rand() * (maxR - minR);
    const x = Math.round(spawn.x + Math.cos(angle) * r);
    const y = Math.round(spawn.y + Math.sin(angle) * r);
    if (!terrain[y]?.[x]) continue;
    add(type, x, y);
  }
}

function generatePointsOfInterest(ctx) {
  const { terrain, objects, cols, rows, spawn, config, rand, add } = ctx;
  const size = getMapSizeDef(config.mapSize);
  const points = [];
  const names = ['Oficina afundada', 'Antiga torre de rádio', 'Mercado abandonado', 'Clínica rural', 'Depósito militar', 'Casa soterrada', 'Estação meteorológica'];
  const types = ['ruin', 'cache', 'supply_crate'];
  for (let i = 0; i < size.poiCount; i++) {
    const p = farRandomTile(terrain, objects, cols, rows, spawn, rand);
    if (!p) continue;
    const type = types[Math.floor(rand() * types.length)];
    const obj = add(type, p.x, p.y, { poiId: `poi_${i}` });
    if (!obj) continue;
    points.push({
      id: `poi_${i}`,
      name: `${names[i % names.length]} ${i + 1}`,
      type,
      x: p.x,
      y: p.y,
      discovered: false,
      inspected: false
    });
  }
  return points;
}

function farRandomTile(terrain, objects, cols, rows, spawn, rand) {
  for (let i = 0; i < 320; i++) {
    const x = 3 + Math.floor(rand() * (cols - 6));
    const y = 3 + Math.floor(rand() * (rows - 6));
    if (Math.hypot(x - spawn.x, y - spawn.y) < Math.min(cols, rows) * 0.18) continue;
    if (terrain[y]?.[x] === 'stone') continue;
    if (objects.some(o => o.x === x && o.y === y)) continue;
    return { x, y };
  }
  return null;
}

function placeStartingCamp({ objects, spawn, add }) {
  add('campfire', spawn.x, spawn.y);
  add('crate', spawn.x + 2, spawn.y);
  add('logs', spawn.x - 2, spawn.y + 1);
}

function makeSpawnPoints(spawn, cols, rows) {
  return [
    { x: Math.max(2, spawn.x - 8), y: Math.max(2, spawn.y - 5), kind: 'northwest' },
    { x: Math.min(cols - 3, spawn.x + 8), y: Math.max(2, spawn.y - 5), kind: 'northeast' },
    { x: Math.max(2, spawn.x - 8), y: Math.min(rows - 3, spawn.y + 5), kind: 'southwest' },
    { x: Math.min(cols - 3, spawn.x + 8), y: Math.min(rows - 3, spawn.y + 5), kind: 'southeast' }
  ];
}

function worldUid(type, index, seed) {
  return `${type}_${index}_${hashSeed(`${seed}|${type}|${index}`).toString(36)}`;
}

function worldNoise(seed, x, y, salt) {
  const h = hashSeed(`${seed}|${salt}|${x}|${y}`);
  return h / 4294967295;
}

function isWorldCoordInside(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function createInitialState(config = defaultNewGameConfig, selectedColonists = null) {
  config = { ...defaultNewGameConfig, ...config };
  if (!config.seed) config.seed = generateRandomSeed();
  const world = generateWorldFromSeed(config);
  const spawn = world.spawn;
  const candidates = selectedColonists?.length ? selectedColonists : Array.from({ length: Number(config.colonistCount || 3) }, (_, i) => createColonistCandidate(i, config));
  const colonists = candidates.map((candidate, i) => candidateToColonist(candidate, i + 1, spawn.x + i, spawn.y + 2 + (i % 2)));
  const resources = startingResources(config.resourcesPreset, config.difficulty);
  return {
    config,
    world,
    terrain: world.terrain,
    objects: world.objects,
    colonists,
    wolves: [],
    resources,
    items: startingItems(config.resourcesPreset),
    day: 1,
    hour: 6,
    speed: 1,
    weather: 'limpo',
    weatherTime: 0,
    eventDoneToday: false,
    paused: true,
    log: [],
    won: false,
    research: { unlocked: {}, completed: [], current: null, progress: 0 }
  };
}

function startingResources(preset, difficulty = 'normal') {
  const table = {
    scarce: { food: 95, wood: 95, stone: 40, metal: 0, medicine: 6 },
    standard: { food: 170, wood: 300, stone: 20, metal: 0, medicine: 19 },
    rich: { food: 240, wood: 420, stone: 90, metal: 8, medicine: 28 }
  };
  const base = { ...(table[preset] || table.standard) };
  if (difficulty === 'hard') {
    base.food = Math.floor(base.food * 0.82);
    base.medicine = Math.floor(base.medicine * 0.75);
  }
  if (difficulty === 'hardcore') {
    base.food = Math.floor(base.food * 0.62);
    base.wood = Math.floor(base.wood * 0.78);
    base.stone = Math.floor(base.stone * 0.75);
    base.medicine = Math.floor(base.medicine * 0.48);
  }
  return base;
}

function startingItems(preset) {
  if (preset === 'rich') return { rope: 4, nails: 6, cloth: 4, leather: 3, stoneAxe: 1, pickaxe: 1 };
  if (preset === 'scarce') return { rope: 1, nails: 1 };
  return { rope: 2, nails: 2, cloth: 1 };
}
