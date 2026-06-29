'use strict';

function serialize() {
  return JSON.stringify({ state, selectedColonistId, version: '1.9D'  });
}

function saveGame(manual = false) {
  if (!state) return false;
  if (typeof ensureGeologyState === 'function') ensureGeologyState();
  localStorage.setItem(SAVE_KEY, serialize());
  if (manual) log('Jogo salvo no navegador.');
  refreshMenuSaveInfo();
  refreshLoadScreen();
  return true;
}

function fallbackLoreForPoi(type = 'ruin', index = 0, seed = 'save') {
  const labels = {
    ruin: 'Registros antigos mencionam um abrigo improvisado e sinais de abandono apressado.',
    cache: 'O baú contém marcas de uma rota de sobreviventes que passou por aqui antes da colônia.',
    supply_crate: 'A caixa parece ter sido deixada por uma expedição perdida durante a queda da região.'
  };
  const suffix = typeof hashSeed === 'function' ? hashSeed(`${seed}|${type}|${index}`).toString(36).slice(0, 4).toUpperCase() : String(index + 1);
  return `${labels[type] || labels.ruin} Código de campo: ${suffix}.`;
}

function ensureLoadedEntityIds(list, prefix) {
  if (!Array.isArray(list)) return [];
  for (let i = 0; i < list.length; i++) {
    const entity = list[i];
    if (!entity || typeof entity !== 'object') continue;
    if (typeof ensureEntityId === 'function') ensureEntityId(entity, prefix);
    else {
      entity.id = entity.id || `${prefix}_${i}_${Date.now()}`;
      entity.uid = entity.uid || entity.id;
    }
  }
  return list;
}

function migrateLoadedState() {
  state.resources = state.resources || {};
  state.resources.food = state.resources.food || 0;
  state.resources.wood = state.resources.wood || 0;
  state.resources.stone = state.resources.stone || 0;
  state.resources.metal = state.resources.metal || 0;
  state.resources.medicine = state.resources.medicine || 0;
  state.items = state.items || {};
  for (const key of ['rope','nails','cloth','leather','arrows']) state.items[key] = state.items[key] || 0;
  state.config = { ...defaultNewGameConfig, colonyName: 'Colônia antiga', seed: 'save-antigo', ...(state.config || {}) };

  const existingWorld = state.world || {};
  const cols = existingWorld.cols || state.terrain?.[0]?.length || MAP_SIZES.standard.cols;
  const rows = existingWorld.rows || state.terrain?.length || MAP_SIZES.standard.rows;
  state.world = {
    seed: state.config.seed,
    mapSize: state.config.mapSize,
    difficulty: state.config.difficulty,
    chunkMode: !!existingWorld.chunkMode,
    biomeIntent: existingWorld.biomeIntent || getMapSizeDef(state.config.mapSize)?.biomeIntent || 'classic',
    cols,
    rows,
    tileSize: TILE,
    width: cols * TILE,
    height: rows * TILE,
    terrain: existingWorld.terrain || state.terrain,
    spawn: existingWorld.spawn || state.worldMeta?.spawnPoints?.[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    spawnPoints: existingWorld.spawnPoints || state.worldMeta?.spawnPoints || [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }],
    pointsOfInterest: existingWorld.pointsOfInterest || [],
    weatherPattern: existingWorld.weatherPattern || state.worldMeta?.weatherPattern || [],
    exploration: existingWorld.exploration,
    visibleTiles: existingWorld.visibleTiles || [],
    biomes: existingWorld.biomes || null,
    waterDepth: existingWorld.waterDepth || null,
    livingWorld: existingWorld.livingWorld || null,
    geologyLayer: existingWorld.geologyLayer || null,
    roofLayer: existingWorld.roofLayer || null,
    geologyVersion: existingWorld.geologyVersion,
    generationVersion: existingWorld.generationVersion || 'migrated'
  };
  state.terrain = state.world.terrain || state.terrain;

  if (!state.world.biomes && window.BiomeEngine?.createBiomeMap) {
    state.world.biomes = window.BiomeEngine.createBiomeMap(cols, rows, state.config.seed, state.config);
  }
  if (typeof ensureGeologyState === 'function') ensureGeologyState(state.world);

  state.worldMeta = state.worldMeta || { seed: state.config.seed, mapSize: state.config.mapSize, difficulty: state.config.difficulty };
  state.objects = ensureLoadedEntityIds(state.objects || [], 'obj');
  state.colonists = ensureLoadedEntityIds(state.colonists || [], 'colonist');
  state.mobs = ensureLoadedEntityIds(state.mobs || [], 'mob');
  state.wolves = ensureLoadedEntityIds(state.wolves || [], 'wolf');
  state.visitors = ensureLoadedEntityIds(state.visitors || [], 'visitor');

  if (typeof window.HavenfallLivingWorld?.ensureWorldWater === 'function') window.HavenfallLivingWorld.ensureWorldWater(state.world, state.config);
  state.world.livingWorld = state.world.livingWorld || {};
  state.world.livingWorld.waypoints = Array.isArray(state.world.livingWorld.waypoints) ? state.world.livingWorld.waypoints : [];

  ensureExplorationState();
  ensureResearchState();

  for (const obj of state.objects || []) {
    if (['ruin','cache','supply_crate'].includes(obj.type)) {
      obj.interactable = true;
      if (obj.inspected === undefined) obj.inspected = false;
      if (obj.looted === undefined) obj.looted = false;
      if (obj.unknown === undefined) obj.unknown = !obj.inspected;
    }
  }

  for (let i = 0; i < (state.world.pointsOfInterest || []).length; i++) {
    const poi = state.world.pointsOfInterest[i];
    if (!poi || typeof poi !== 'object') continue;
    if (poi.inspected === undefined) poi.inspected = false;
    if (poi.looted === undefined) poi.looted = false;
    if (!poi.id && typeof uid === 'function') poi.id = uid('poi');
    if (!poi.lore) {
      poi.lore = typeof loreForPoi === 'function'
        ? loreForPoi(poi.type || 'ruin', i, state.config.seed)
        : fallbackLoreForPoi(poi.type || 'ruin', i, state.config.seed);
    }
  }

  for (const c of state.colonists || []) { ensureColonistMeta(c); ensureEquipment(c); }
  updateExploration(true);
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    if (state) log('Nenhum save encontrado.');
    return false;
  }
  try {
    const data = JSON.parse(raw);
    state = data.state || {};
    migrateLoadedState();
    selectedColonistId = data.selectedColonistId || state.colonists?.[0]?.id || 1;
    currentBuild = null;
    centerCameraOnSelectedColonist();
    log('Save carregado.');
    updateUI(true);
    return true;
  } catch (err) {
    console.error('[Save Load Error]', err);
    if (state) log('Falha ao carregar o save. Veja o console para detalhes.');
    return false;
  }
}
