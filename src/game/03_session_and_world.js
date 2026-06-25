'use strict';

function refreshMenuSaveInfo() {
  if (!dom.menuSaveInfo) return;
  const continueBtn = document.getElementById('continueBtn');

  if (activeSession && state) {
    if (continueBtn) {
      continueBtn.textContent = 'Continuar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.innerHTML = `Partida em andamento · <b>${escapeHtml(state.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${state.day || 1}`;
    return;
  }

  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (continueBtn) {
      continueBtn.textContent = 'Carregar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.textContent = 'Nenhum save local encontrado.';
    return;
  }

  try {
    const data = JSON.parse(raw);
    const s = data.state;
    if (continueBtn) {
      continueBtn.textContent = 'Continuar';
      continueBtn.disabled = false;
    }
    dom.menuSaveInfo.innerHTML = `Save local · <b>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${s.day || 1} · Seed ${escapeHtml(s.config?.seed || 'antiga')}`;
  } catch (_) {
    if (continueBtn) {
      continueBtn.textContent = 'Carregar';
      continueBtn.disabled = true;
    }
    dom.menuSaveInfo.textContent = 'Save local encontrado, mas parece corrompido.';
  }
}

function refreshLoadScreen() {
  if (!dom.loadSlot) return;
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    dom.loadSlot.innerHTML = 'Nenhum save local encontrado.';
    const loadBtn = document.getElementById('loadSlotBtn');
    if (loadBtn) loadBtn.disabled = true;
    return;
  }
  try {
    const data = JSON.parse(raw);
    const s = data.state;
    const cols = s.world?.cols || s.terrain?.[0]?.length || COLS;
    const rows = s.world?.rows || s.terrain?.length || ROWS;
    dom.loadSlot.innerHTML = `<strong>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</strong><br>Dia ${s.day || 1}, ${formatHour(s.hour || 6)} · Seed ${escapeHtml(s.config?.seed || 'save antigo')} · ${cols}x${rows} · ${s.colonists?.length || 0} colonos`;
    const loadBtn = document.getElementById('loadSlotBtn');
    if (loadBtn) loadBtn.disabled = false;
  } catch (_) {
    dom.loadSlot.innerHTML = 'Save local encontrado, mas não foi possível ler o resumo.';
  }
}

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
  return Promise.all(assetNames.map(name => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = reject;
    img.src = `assets/sprites/${name}.png`;
  })));
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

  return {
    seed: config.seed,
    mapSize: config.mapSize,
    difficulty: config.difficulty,
    cols,
    rows,
    tileSize: TILE,
    width: cols * TILE,
    height: rows * TILE,
    terrain,
    objects,
    exploration,
    spawn,
    spawnPoints,
    pointsOfInterest,
    weatherPattern: generateWeatherPattern(config, rand),
    generationVersion: '1.8.0'
  };
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

  const hardRockBonus = config.difficulty === 'hard' ? 0.05 : 0;
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
  const difficultyFactor = config.difficulty === 'easy' ? 1.12 : config.difficulty === 'hard' ? 0.88 : 1;
  const multiplier = size.resourceMultiplier * difficultyFactor;
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
    for (let tries = 0; tries < 50; tries++) {
      const angle = rand() * Math.PI * 2;
      const r = minR + rand() * (maxR - minR);
      const x = Math.round(spawn.x + Math.cos(angle) * r);
      const y = Math.round(spawn.y + Math.sin(angle) * r);
      if (!terrain[y]?.[x]) continue;
      if (type === 'rock' && terrain[y][x] === 'sand') continue;
      if (type !== 'rock' && terrain[y][x] === 'stone') continue;
      if (add(type, x, y)) break;
    }
  }
}

function generatePointsOfInterest(ctx) {
  const { terrain, objects, cols, rows, spawn, config, rand, add } = ctx;
  const size = getMapSizeDef(config.mapSize);
  const names = ['Old Depot', 'Broken Camp', 'Stone Ring', 'Abandoned Cache', 'Rusted Outpost', 'Silent Ruin', 'Ashen Shelter', 'Forgotten Relay'];
  const types = ['ruin', 'cache', 'ore_field', 'wild_grove'];
  const pois = [];
  for (let i = 0; i < size.poiCount; i++) {
    const type = types[Math.floor(rand() * types.length)];
    const tile = farFreeTile(terrain, objects, cols, rows, spawn, rand, 12 + i * 2);
    if (!tile) continue;
    const poi = {
      id: worldUid('poi', i, config.seed),
      type,
      name: names[i % names.length],
      x: tile.x,
      y: tile.y,
      discovered: false,
      inspected: false,
      looted: false,
      lore: loreForPoi(type, i, config.seed)
    };
    pois.push(poi);
    decoratePoi(type, tile.x, tile.y, add, terrain, cols, rows, rand, poi);
  }
  return pois;
}

function decoratePoi(type, x, y, add, terrain, cols, rows, rand, poi = null) {
  if (type === 'ruin') {
    add('ruin', x, y, { poiId: poi?.id, inspected: false, looted: false, lore: poi?.lore });
    [[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2],[-2,1],[1,-2]].forEach(([dx, dy], i) => {
      const px = x + dx, py = y + dy;
      if (!isWorldCoordInside(px, py, cols, rows)) return;
      if (i % 3 === 0) add('wall', px, py);
      else if (rand() < 0.48) add('rock', px, py);
    });
    add('supply_crate', x + 1, y + 1, { poiId: poi?.id, inspected: false, looted: false });
  }
  if (type === 'cache') {
    add('cache', x, y, { poiId: poi?.id, inspected: false, looted: false, lore: poi?.lore });
    add('logs', x + 1, y);
    if (rand() < 0.55) add('campfire', x, y + 1);
  }
  if (type === 'ore_field') {
    add('supply_crate', x, y, { poiId: poi?.id, inspected: false, looted: false, lore: poi?.lore });
    for (let i = 0; i < 8; i++) {
      const px = x + Math.floor(rand() * 7) - 3;
      const py = y + Math.floor(rand() * 7) - 3;
      if (isWorldCoordInside(px, py, cols, rows)) { terrain[py][px] = 'stone'; add(rand() < 0.62 ? 'ore' : 'rock', px, py); }
    }
  }
  if (type === 'wild_grove') {
    add('cache', x, y, { poiId: poi?.id, inspected: false, looted: false, lore: poi?.lore });
    for (let i = 0; i < 10; i++) {
      const px = x + Math.floor(rand() * 9) - 4;
      const py = y + Math.floor(rand() * 9) - 4;
      if (!isWorldCoordInside(px, py, cols, rows)) continue;
      terrain[py][px] = 'grass';
      add(rand() < 0.58 ? 'tree' : 'berry', px, py);
    }
  }
}


function loreForPoi(type, index, seed) {
  const lore = {
    ruin: [
      'As marcas nas pedras indicam que alguém tentou fortificar este lugar às pressas.',
      'Há símbolos gastos nas paredes. Parece que a ruína serviu como abrigo durante uma longa estação fria.',
      'Entre os destroços, há sinais de uma antiga oficina improvisada.'
    ],
    cache: [
      'A caixa foi escondida debaixo de galhos secos. Quem deixou isso aqui provavelmente esperava voltar.',
      'O baú tem marcas de transporte. Pode ter vindo de uma caravana perdida.',
      'O local parece ter sido abandonado sem tempo de recolher suprimentos.'
    ],
    ore_field: [
      'O chão brilha com pequenos veios metálicos. Esta área pode sustentar uma produção inicial de ferramentas.',
      'Pedras rachadas revelam minério escuro logo abaixo da superfície.',
      'Há restos de extração antiga. Alguém já tentou minerar esta região.'
    ],
    wild_grove: [
      'O bosque cresceu em volta de objetos antigos. Parece seguro, mas estranhamente silencioso.',
      'A vegetação é densa e fértil. Há sinais de acampamento sob as raízes.',
      'Frutos selvagens cobrem o lugar. No centro, uma caixa esquecida ainda resiste ao tempo.'
    ]
  };
  const pool = lore[type] || lore.ruin;
  return pool[hashSeed(`${seed}|poi-lore|${type}|${index}`) % pool.length];
}

function farFreeTile(terrain, objects, cols, rows, spawn, rand, minDist = 14) {
  for (let i = 0; i < 240; i++) {
    const x = 3 + Math.floor(rand() * (cols - 6));
    const y = 3 + Math.floor(rand() * (rows - 6));
    if (Math.hypot(x - spawn.x, y - spawn.y) < minDist) continue;
    if (terrain[y][x] === 'sand') continue;
    if (objects.some(o => o.x === x && o.y === y)) continue;
    return { x, y };
  }
  return null;
}

function placeStartingCamp({ add, spawn }) {
  add('crate', spawn.x + 2, spawn.y);
  add('campfire', spawn.x + 3, spawn.y + 1);
}

function makeSpawnPoints(spawn, cols, rows) {
  const candidates = [
    { x: spawn.x, y: spawn.y },
    { x: spawn.x + 1, y: spawn.y },
    { x: spawn.x, y: spawn.y + 1 },
    { x: spawn.x - 1, y: spawn.y },
    { x: spawn.x, y: spawn.y - 1 },
    { x: spawn.x + 1, y: spawn.y + 1 }
  ];
  return candidates.filter(p => isWorldCoordInside(p.x, p.y, cols, rows));
}

function generateWeatherPattern(config, rand) {
  const intensity = ({ low: 3, normal: 5, high: 8 })[config.eventIntensity] || 5;
  return Array.from({ length: 20 }, (_, i) => ({ day: i + 1, rainChance: Math.round((0.12 + rand() * 0.18 + intensity * 0.01) * 100) / 100 }));
}

function createInitialState(config = defaultNewGameConfig, selectedColonists = null) {
  config = { ...defaultNewGameConfig, ...config };
  if (!config.seed) config.seed = generateRandomSeed();
  const world = generateWorldFromSeed(config);
  const candidates = selectedColonists && selectedColonists.length ? selectedColonists : [
    createColonistCandidate(0, config, `${config.seed}-fallback-0`),
    createColonistCandidate(1, config, `${config.seed}-fallback-1`),
    createColonistCandidate(2, config, `${config.seed}-fallback-2`)
  ];
  const colonists = candidates.slice(0, config.colonistCount).map((candidate, i) => {
    const spawn = world.spawnPoints[i] || world.spawn;
    return candidateToColonist(candidate, i + 1, spawn.x, spawn.y);
  });

  return {
    config,
    world: {
      seed: world.seed,
      mapSize: world.mapSize,
      difficulty: world.difficulty,
      cols: world.cols,
      rows: world.rows,
      tileSize: world.tileSize,
      width: world.width,
      height: world.height,
      spawn: world.spawn,
      spawnPoints: world.spawnPoints,
      pointsOfInterest: world.pointsOfInterest,
      weatherPattern: world.weatherPattern,
      exploration: world.exploration,
      generationVersion: world.generationVersion
    },
    worldMeta: { seed: world.seed, mapSize: world.mapSize, difficulty: world.difficulty, spawnPoints: world.spawnPoints, weatherPattern: world.weatherPattern },
    terrain: world.terrain,
    objects: world.objects,
    colonists,
    wolves: [],
    resources: initialResourcesForConfig(config),
    research: makeResearchState(),
    day: 1,
    hour: 6,
    speed: 1,
    paused: false,
    weather: 'limpo',
    weatherTime: 0,
    eventDoneToday: false,
    log: [],
    won: false
  };
}

function makeExplorationMatrix(cols, rows) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function ensureExplorationState() {
  if (!state) return;
  state.world = state.world || {};
  state.world.cols = state.world.cols || state.terrain?.[0]?.length || COLS;
  state.world.rows = state.world.rows || state.terrain?.length || ROWS;
  state.world.tileSize = state.world.tileSize || TILE;
  state.world.width = state.world.cols * state.world.tileSize;
  state.world.height = state.world.rows * state.world.tileSize;
  if (!Array.isArray(state.world.exploration) || state.world.exploration.length !== state.world.rows || state.world.exploration[0]?.length !== state.world.cols) {
    state.world.exploration = makeExplorationMatrix(state.world.cols, state.world.rows);
  }
}

function updateExploration(force = false) {
  if (!state?.colonists) return;
  ensureExplorationState();
  const rows = getWorldRows();
  const cols = getWorldCols();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (state.world.exploration[y][x] === 2) state.world.exploration[y][x] = 1;
    }
  }
  const baseRadius = force ? 10 : 8;
  for (const c of state.colonists) revealAround(c.x, c.y, baseRadius);
  updatePoiDiscovery();
}

function revealAround(cx, cy, radius = 8) {
  ensureExplorationState();
  const rows = getWorldRows();
  const cols = getWorldCols();
  const r2 = radius * radius;
  for (let y = Math.max(0, cy - radius); y <= Math.min(rows - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(cols - 1, cx + radius); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) state.world.exploration[y][x] = 2;
    }
  }
}

function isTileDiscovered(x, y) {
  return !!state?.world?.exploration?.[y]?.[x];
}

function isTileVisible(x, y) {
  return state?.world?.exploration?.[y]?.[x] === 2;
}

function updatePoiDiscovery() {
  if (!state?.world?.pointsOfInterest) return;
  for (const poi of state.world.pointsOfInterest) {
    if (!poi.discovered && isTileDiscovered(poi.x, poi.y)) {
      poi.discovered = true;
      log(`Ponto descoberto: ${poi.name}.`);
    }
  }
}

function isWorldCoordInside(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function worldNoise(seed, x, y, salt = 'n') {
  let h = hashSeed(`${seed}:${salt}:${x}:${y}`) || 1;
  h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
  return ((h >>> 0) / 4294967295);
}

function worldUid(prefix, index, seed) {
  return `${prefix}_${index}_${hashSeed(`${seed}-${prefix}-${index}`).toString(36)}`;
}

function uid() {
  return Math.floor(Math.random() * 1e9).toString(36) + Date.now().toString(36).slice(-4);
}
