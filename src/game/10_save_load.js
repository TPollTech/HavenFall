'use strict';

function serialize() {
  return JSON.stringify({ state, selectedColonistId, version: '1.9C'  });
}

function saveGame(manual = false) {
  if (!state) return false;
  localStorage.setItem(SAVE_KEY, serialize());
  if (manual) log('Jogo salvo no navegador.');
  refreshMenuSaveInfo();
  refreshLoadScreen();
  return true;
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

  const cols = state.world?.cols || state.terrain?.[0]?.length || MAP_SIZES.standard.cols;
  const rows = state.world?.rows || state.terrain?.length || MAP_SIZES.standard.rows;
  state.world = {
    seed: state.config.seed,
    mapSize: state.config.mapSize,
    difficulty: state.config.difficulty,
    cols,
    rows,
    tileSize: TILE,
    width: cols * TILE,
    height: rows * TILE,
    spawn: state.world?.spawn || state.worldMeta?.spawnPoints?.[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    spawnPoints: state.world?.spawnPoints || state.worldMeta?.spawnPoints || [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }],
    pointsOfInterest: state.world?.pointsOfInterest || [],
    weatherPattern: state.world?.weatherPattern || state.worldMeta?.weatherPattern || [],
    exploration: state.world?.exploration,
    visibleTiles: state.world?.visibleTiles || [],
    generationVersion: state.world?.generationVersion || 'migrated'
  };
  state.worldMeta = state.worldMeta || { seed: state.config.seed, mapSize: state.config.mapSize, difficulty: state.config.difficulty };
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
  for (const poi of state.world.pointsOfInterest || []) {
    if (poi.inspected === undefined) poi.inspected = false;
    if (poi.looted === undefined) poi.looted = false;
    if (!poi.lore) poi.lore = loreForPoi(poi.type || 'ruin', 0, state.config.seed);
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
    state = data.state;
    migrateLoadedState();
    selectedColonistId = data.selectedColonistId || state.colonists?.[0]?.id || 1;
    currentBuild = null;
    centerCameraOnSelectedColonist();
    log('Save carregado.');
    updateUI(true);
    return true;
  } catch (err) {
    console.error(err);
    if (state) log('Falha ao carregar o save.');
    return false;
  }
}
