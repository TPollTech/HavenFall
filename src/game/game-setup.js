'use strict';

var defaultNewGameConfig = Object.freeze({
  colonyName: 'Primeiro Refúgio',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'giant'
});
const MAX_STARTING_COLONISTS = 8;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { uiScale: 'normal', autosave: 'on', showGrid: false, ...(raw ? JSON.parse(raw) : {}) };
  } catch (_) {
    return { uiScale: 'normal', autosave: 'on', showGrid: false };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function generateRandomSeed() {
  const prefixes = ['HVF', 'ASH', 'FALL', 'VALE', 'RUIN', 'HAVEN'];
  const codenames = ['OMEGA', 'EMBER', 'BOREAL', 'ONYX', 'ECHO', 'NOVA', 'VANTA', 'ORION', 'WRAITH', 'CIPHER'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(10 + Math.random() * 90);
  const letter = Math.random().toString(36).slice(2, 3).toUpperCase();
  const suffix = codenames[Math.floor(Math.random() * codenames.length)];
  const checksum = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${number}${letter}-${suffix}-${checksum}`;
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let t = hashSeed(String(seed || 'default-seed')) || 1;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function setupInputValue(key, fallback = '') {
  const el = dom.inputs?.[key];
  return el ? el.value : fallback;
}

function clampColonistCount(value) {
  return Math.max(1, Math.min(MAX_STARTING_COLONISTS, Math.floor(Number(value) || 3)));
}

function normalizeSeedValue(value) {
  return String(value || '').trim().replace(/\s+/g, '-').toUpperCase();
}

function normalizeColonyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32) || defaultNewGameConfig.colonyName;
}

function normalizeNewGameConfig(config = {}) {
  const seed = normalizeSeedValue(config.seed) || generateRandomSeed();
  return {
    ...defaultNewGameConfig,
    ...config,
    colonyName: normalizeColonyName(config.colonyName),
    seed,
    difficulty: ['easy', 'normal', 'hard', 'hardcore'].includes(config.difficulty) ? config.difficulty : defaultNewGameConfig.difficulty,
    colonistCount: clampColonistCount(config.colonistCount),
    resourcesPreset: ['scarce', 'standard', 'rich'].includes(config.resourcesPreset) ? config.resourcesPreset : defaultNewGameConfig.resourcesPreset,
    eventIntensity: ['low', 'normal', 'high'].includes(config.eventIntensity) ? config.eventIntensity : defaultNewGameConfig.eventIntensity,
    mapSize: ['large', 'huge', 'giant', 'infinite_chunks'].includes(config.mapSize) ? config.mapSize : defaultNewGameConfig.mapSize
  };
}

function readNewGameConfig() {
  return normalizeNewGameConfig({
    colonyName: setupInputValue('colonyName').trim() || defaultNewGameConfig.colonyName,
    seed: setupInputValue('worldSeed').trim(),
    difficulty: setupInputValue('difficulty', 'normal'),
    colonistCount: clampColonistCount(setupInputValue('colonistCount', 3)),
    resourcesPreset: setupInputValue('resourcesPreset', 'standard'),
    eventIntensity: setupInputValue('eventIntensity', 'normal'),
    mapSize: setupInputValue('mapSize', 'giant')
  });
}

function writeNewGameConfig(config = defaultNewGameConfig) {
  const normalized = normalizeNewGameConfig(config);
  if (dom.inputs.colonyName) dom.inputs.colonyName.value = normalized.colonyName;
  if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = normalized.seed;
  if (dom.inputs.difficulty) dom.inputs.difficulty.value = normalized.difficulty;
  if (dom.inputs.colonistCount) dom.inputs.colonistCount.value = String(normalized.colonistCount);
  if (dom.inputs.resourcesPreset) dom.inputs.resourcesPreset.value = normalized.resourcesPreset;
  if (dom.inputs.eventIntensity) dom.inputs.eventIntensity.value = normalized.eventIntensity;
  if (dom.inputs.mapSize) dom.inputs.mapSize.value = normalized.mapSize;
  updateSetupSummary();
  return normalized;
}

function updateSetupSummary() {
  if (!dom.setupSummary) return;
  const cfg = readNewGameConfigSafe();
  dom.setupSummary.innerHTML = `<b>Resumo da expedição:</b> ${escapeHtml(cfg.colonyName)} · Seed <b>${escapeHtml(cfg.seed)}</b> · ${labelDifficulty(cfg.difficulty)} · ${cfg.colonistCount} colono${cfg.colonistCount === 1 ? '' : 's'} · mapa ${labelMapSize(cfg.mapSize)} · eventos ${labelEventIntensity(cfg.eventIntensity)} · recursos ${labelResourcesPreset(cfg.resourcesPreset)}.`;
}

function readNewGameConfigSafe() {
  try { return readNewGameConfig(); }
  catch (_) { return normalizeNewGameConfig(defaultNewGameConfig); }
}

function labelDifficulty(v) {
  return ({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil', hardcore: 'Hardcore' })[v] || v;
}
function labelEventIntensity(v) { return ({ low: 'baixa', normal: 'normal', high: 'alta' })[v] || v; }
function labelResourcesPreset(v) { return ({ scarce: 'escassos', standard: 'padrão', rich: 'abundantes' })[v] || v; }
function labelMapSize(v) {
  return ({
    large: 'grande',
    huge: 'enorme',
    giant: 'gigante',
    infinite_chunks: 'infinito por chunks'
  })[v] || v;
}
