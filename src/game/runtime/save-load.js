'use strict';

const SAVE_VERSION = '1.9E-runtime-stable';
const SAVE_UPDATED_AT_KEY = `${SAVE_KEY}:updatedAt`;
const DESKTOP_SAVE_SLOT = 'autosave';
const SAVE_LOCAL_MIRROR_LIMIT_BYTES = 1_500_000;

function desktopApi() {
  return window.HavenfallDesktop?.isElectron ? window.HavenfallDesktop : null;
}

function localGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

function localSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
}

function localRemove(key) {
  try { localStorage.removeItem(key); return true; } catch (_) { return false; }
}

function cloneForSave(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function currentSectorIdForSave(target) {
  return target?.worldMap?.currentSiteId
    || target?.world?.landingSite?.id
    || target?.config?.selectedLandingSiteId
    || target?.config?.landingSiteId
    || target?.config?.planetScan?.selectedLandingSiteId
    || null;
}

function compactStateForSave(target = state) {
  const saveState = cloneForSave(target);

  if (saveState.world && typeof saveState.world === 'object') {
    if (!Array.isArray(saveState.world.terrain) && Array.isArray(saveState.terrain)) {
      saveState.world.terrain = saveState.terrain;
    }
    if (!Array.isArray(saveState.world.objects) && Array.isArray(saveState.objects)) {
      saveState.world.objects = saveState.objects;
    }
  }

  if (Array.isArray(saveState.world?.terrain)) delete saveState.terrain;
  if (Array.isArray(saveState.world?.objects)) delete saveState.objects;

  const currentSectorId = currentSectorIdForSave(saveState);
  if (currentSectorId && saveState.sectors && typeof saveState.sectors === 'object') {
    delete saveState.sectors[currentSectorId];
  }

  return saveState;
}

function serialize() {
  const runtime = desktopApi() ? 'electron' : 'web';
  return JSON.stringify({
    state: compactStateForSave(state),
    selectedColonistId,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    runtime
  });
}

function markLocalSaveUpdated(timestamp = Date.now()) {
  localSet(SAVE_UPDATED_AT_KEY, String(timestamp));
}

function localSaveUpdatedAt() {
  const raw = Number(localGet(SAVE_UPDATED_AT_KEY) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function readDesktopSavePayload() {
  const api = desktopApi();
  if (!api?.readSaveSlot) return null;
  const info = api.getSaveInfo?.(DESKTOP_SAVE_SLOT);
  if (!info?.exists) return null;
  const read = api.readSaveSlot(DESKTOP_SAVE_SLOT);
  if (!read?.ok || !read.text) return null;
  return {
    text: read.text,
    updatedAtMs: Number(read.updatedAtMs || info.updatedAtMs || 0),
    path: read.path,
    bytes: Number(read.bytes || info.bytes || 0)
  };
}

function readLocalSavePayload() {
  const text = localGet(SAVE_KEY);
  if (!text) return null;
  return {
    text,
    updatedAtMs: localSaveUpdatedAt(),
    path: null,
    bytes: text.length
  };
}

function mirrorDesktopSaveToLocal(desktopPayload, options = {}) {
  if (!desktopPayload?.text || !options.cacheLocal) return false;
  if (desktopPayload.text.length > SAVE_LOCAL_MIRROR_LIMIT_BYTES) {
    localRemove(SAVE_KEY);
    markLocalSaveUpdated(desktopPayload.updatedAtMs || Date.now());
    return false;
  }
  localSet(SAVE_KEY, desktopPayload.text);
  markLocalSaveUpdated(desktopPayload.updatedAtMs || Date.now());
  return true;
}

function chooseSavedPayload(options = {}) {
  const local = readLocalSavePayload();
  const desktop = readDesktopSavePayload();

  if (desktop?.text && (!local?.text || desktop.updatedAtMs >= local.updatedAtMs)) {
    mirrorDesktopSaveToLocal(desktop, options);
    return { text: desktop.text, source: 'arquivo desktop', path: desktop.path, bytes: desktop.bytes };
  }

  if (local?.text) return { text: local.text, source: 'navegador', path: null, bytes: local.bytes };
  return null;
}

function hasLocalSave() {
  return !!localGet(SAVE_KEY);
}

function hasDesktopSave() {
  const api = desktopApi();
  if (!api?.getSaveInfo) return false;
  const info = api.getSaveInfo(DESKTOP_SAVE_SLOT);
  return !!info?.exists;
}

function hasAnySave() {
  return hasDesktopSave() || hasLocalSave();
}

function getSaveSummary() {
  const desktop = desktopApi()?.getSaveInfo?.(DESKTOP_SAVE_SLOT) || null;
  const local = readLocalSavePayload();
  return {
    hasAnySave: hasAnySave(),
    desktopExists: !!desktop?.exists,
    desktopBytes: Number(desktop?.bytes || 0),
    desktopUpdatedAt: desktop?.updatedAt || null,
    desktopPath: desktop?.path || null,
    localExists: !!local?.text,
    localBytes: Number(local?.bytes || 0),
    localUpdatedAtMs: Number(local?.updatedAtMs || 0),
    runtime: desktopApi() ? 'electron' : 'web'
  };
}

function writeDesktopSavePayload(payload, manual = false) {
  const api = desktopApi();
  if (!api?.writeSaveSlot) return { ok: false, skipped: true };
  const result = api.writeSaveSlot(DESKTOP_SAVE_SLOT, payload, {
    manual: !!manual,
    saveVersion: SAVE_VERSION,
    colonyName: state?.config?.colonyName || null,
    seed: state?.config?.seed || null,
    day: state?.day || null,
    hour: state?.hour || null,
    runtimeMode: state?.runtimeMode || null
  });
  if (manual && result?.ok && api.backupSaveSlot) api.backupSaveSlot(DESKTOP_SAVE_SLOT, 'manual');
  if (!result?.ok && api.appendLog) api.appendLog('Falha ao salvar jogo no desktop', result);
  return result || { ok: false };
}

function writeSavePayload(payload, manual = false) {
  const api = desktopApi();
  const updatedAt = Date.now();
  if (api) {
    const desktopResult = writeDesktopSavePayload(payload, manual);
    if (desktopResult?.ok) {
      localRemove(SAVE_KEY);
      markLocalSaveUpdated(updatedAt);
      return { ok: true, source: 'arquivo desktop', desktop: desktopResult };
    }
    localSet(SAVE_KEY, payload);
    markLocalSaveUpdated(updatedAt);
    return { ok: true, source: 'navegador fallback', desktop: desktopResult };
  }
  localSet(SAVE_KEY, payload);
  markLocalSaveUpdated(updatedAt);
  return { ok: true, source: 'navegador' };
}

function validateSaveData(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object') errors.push('Payload do save inválido.');
  if (!data?.state || typeof data.state !== 'object') errors.push('Save sem state.');
  if (data?.state) {
    if (!data.state.world) errors.push('Save sem mundo.');
    if (!Array.isArray(data.state.terrain) && !Array.isArray(data.state.world?.terrain)) errors.push('Save sem terrain.');
    if (!Array.isArray(data.state.objects) && !Array.isArray(data.state.world?.objects)) errors.push('Save sem objetos.');
    if (!Array.isArray(data.state.colonists)) warnings.push('Save sem lista válida de colonos.');
  }
  return { ok: errors.length === 0, errors, warnings };
}

function saveGame(manual = false) {
  if (!state || state.isPreview || state.runtimeMode === 'menu-preview') return false;
  if (typeof ensureGeologyState === 'function') ensureGeologyState();
  window.HavenfallGeologyMassSystem?.purgeLooseResourcesOnGeology?.(state.world);
  if (window.HavenfallRuntime?.normalizeState) window.HavenfallRuntime.normalizeState(state);
  const payload = serialize();
  const result = writeSavePayload(payload, manual);
  if (manual) {
    if (result?.source === 'arquivo desktop') log('Jogo salvo no desktop e backup manual criado.');
    else if (result?.source === 'navegador fallback') log('Jogo salvo no navegador. O save em arquivo desktop falhou.');
    else log('Jogo salvo no navegador.');
    refreshMenuSaveInfo?.();
    refreshLoadScreen?.();
  }
  return !!result?.ok;
}

function deleteGameSave() {
  const desktopResult = desktopApi()?.deleteSaveSlot?.(DESKTOP_SAVE_SLOT) || { ok: true, skipped: true };
  localRemove(SAVE_KEY);
  localRemove(SAVE_UPDATED_AT_KEY);
  activeSession = false;
  if (state) {
    state.runtimeMode = 'menu-preview';
    state.isPreview = true;
  }
  refreshMenuSaveInfo?.();
  refreshLoadScreen?.();
  return { ok: desktopResult?.ok !== false, desktop: desktopResult };
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
  const legacyNaturalRoofLayer = Array.isArray(existingWorld.roofLayer) && typeof existingWorld.roofLayer?.[0]?.[0] === 'boolean';
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
    objects: existingWorld.objects || state.objects || [],
    spawn: existingWorld.spawn || state.worldMeta?.spawnPoints?.[0] || { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    spawnPoints: existingWorld.spawnPoints || state.worldMeta?.spawnPoints || [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }],
    pointsOfInterest: existingWorld.pointsOfInterest || [],
    planetScan: existingWorld.planetScan || state.config?.planetScan || null,
    landingSite: existingWorld.landingSite || state.config?.selectedLandingSite || null,
    worldgenSource: existingWorld.worldgenSource || null,
    landingRiskProfile: existingWorld.landingRiskProfile || null,
    landingBiomeIntent: existingWorld.landingBiomeIntent || null,
    landingNarrative: existingWorld.landingNarrative || null,
    weatherPattern: existingWorld.weatherPattern || state.worldMeta?.weatherPattern || [],
    exploration: existingWorld.exploration,
    visibleTiles: existingWorld.visibleTiles || [],
    biomes: existingWorld.biomes || null,
    waterDepth: existingWorld.waterDepth || null,
    livingWorld: existingWorld.livingWorld || null,
    geologyLayer: Array.isArray(existingWorld.geologyLayer) ? existingWorld.geologyLayer : null,
    geologyMassVersion: existingWorld.geologyMassVersion || (Array.isArray(existingWorld.geologyLayer) ? window.HavenfallGeologyMassSystem?.version || 'dense-mountains' : null),
    naturalRoofLayer: existingWorld.naturalRoofLayer || (legacyNaturalRoofLayer ? existingWorld.roofLayer : null),
    roofLayer: legacyNaturalRoofLayer ? null : existingWorld.roofLayer || null,
    builtRoofLayer: existingWorld.builtRoofLayer || null,
    pendingRoofJobs: existingWorld.pendingRoofJobs || [],
    lightMap: existingWorld.lightMap || null,
    geologyVersion: existingWorld.geologyVersion,
    generationVersion: existingWorld.generationVersion || 'migrated'
  };
  state.terrain = state.world.terrain || state.terrain;

  if (!state.world.biomes && window.BiomeEngine?.createBiomeMap) {
    state.world.biomes = window.BiomeEngine.createBiomeMap(cols, rows, state.config.seed, state.config);
  }
  if (typeof ensureGeologyState === 'function') ensureGeologyState(state.world);

  state.worldMeta = state.worldMeta || { seed: state.config.seed, mapSize: state.config.mapSize, difficulty: state.config.difficulty };
  state.objects = ensureLoadedEntityIds((Array.isArray(state.objects) && state.objects.length ? state.objects : state.world.objects) || [], 'obj');
  state.world.objects = state.objects;
  window.HavenfallGeologyMassSystem?.purgeLooseResourcesOnGeology?.(state.world);
  state.objects = state.world.objects;
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
  if (window.HavenfallRuntime?.markGameplayState) window.HavenfallRuntime.markGameplayState(state);
  else {
    state.isPreview = false;
    state.runtimeMode = 'gameplay';
  }
  updateExploration(true);
}

function loadGame() {
  const payload = chooseSavedPayload({ cacheLocal: false });
  if (!payload?.text) {
    if (state) log('Nenhum save encontrado.');
    return false;
  }
  try {
    const data = JSON.parse(payload.text);
    const validation = validateSaveData(data);
    if (!validation.ok) {
      desktopApi()?.appendLog?.('Save recusado pela validação', { errors: validation.errors, source: payload.source, path: payload.path });
      if (state) log(`Save inválido: ${validation.errors.join(' ')}`);
      return false;
    }
    state = data.state || {};
    migrateLoadedState();
    selectedColonistId = data.selectedColonistId || state.colonists?.[0]?.id || 1;
    currentBuild = null;
    if (window.HavenfallRuntime?.bumpPathVersion) window.HavenfallRuntime.bumpPathVersion(state, 'load-game');
    centerCameraOnSelectedColonist();
    log(`Save carregado de ${payload.source}.`);
    updateUI(true);
    return true;
  } catch (err) {
    console.error('[Save Load Error]', err);
    desktopApi()?.appendLog?.('Falha ao carregar save', { error: err.message, source: payload.source, path: payload.path });
    if (state) log('Falha ao carregar o save. Veja o console para detalhes.');
    return false;
  }
}

(function installSaveAwareSessionFlow() {
  if (typeof continueFromMenu === 'function' && !window.HavenfallContext?.saveAwareContinueInstalled) {
    continueFromMenu = function continueFromMenuSaveAware() {
      if (activeSession && state && state.isPreview !== true) {
        setScreen(SCREEN.PLAYING);
        return;
      }
      if (!hasAnySave()) {
        setScreen(SCREEN.LOAD_GAME);
        return;
      }
      loadAndPlay();
    };
    window.HavenfallContext.saveAwareContinueInstalled = true;
  }

  window.HavenfallSaveBackend = Object.freeze({
    slot: DESKTOP_SAVE_SLOT,
    hasLocalSave,
    hasDesktopSave,
    hasAnySave,
    getSaveSummary,
    chooseSavedPayload,
    saveGame,
    loadGame,
    deleteGameSave,
    validateSaveData
  });
})();
