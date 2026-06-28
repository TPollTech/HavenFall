'use strict';

var defaultNewGameConfig = Object.freeze({
  colonyName: 'First Haven',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'giant'
});

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
  return Math.max(1, Math.min(50, Math.floor(Number(value) || 3)));
}

function readNewGameConfig() {
  const seed = setupInputValue('worldSeed').trim() || generateRandomSeed();
  return {
    colonyName: setupInputValue('colonyName').trim() || 'First Haven',
    seed,
    difficulty: setupInputValue('difficulty', 'normal'),
    colonistCount: clampColonistCount(setupInputValue('colonistCount', 3)),
    resourcesPreset: setupInputValue('resourcesPreset', 'standard'),
    eventIntensity: setupInputValue('eventIntensity', 'normal'),
    mapSize: setupInputValue('mapSize', 'giant')
  };
}

function writeNewGameConfig(config = defaultNewGameConfig) {
  if (dom.inputs.colonyName) dom.inputs.colonyName.value = config.colonyName || 'First Haven';
  if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = config.seed || generateRandomSeed();
  if (dom.inputs.difficulty) dom.inputs.difficulty.value = config.difficulty || 'normal';
  if (dom.inputs.colonistCount) dom.inputs.colonistCount.value = String(clampColonistCount(config.colonistCount || 3));
  if (dom.inputs.resourcesPreset) dom.inputs.resourcesPreset.value = config.resourcesPreset || 'standard';
  if (dom.inputs.eventIntensity) dom.inputs.eventIntensity.value = config.eventIntensity || 'normal';
  if (dom.inputs.mapSize) dom.inputs.mapSize.value = config.mapSize || 'giant';
  updateSetupSummary();
}

function updateSetupSummary() {
  if (!dom.setupSummary) return;
  dom.setupSummary.remove();
  dom.setupSummary = null;
}

function readNewGameConfigSafe() {
  try { return readNewGameConfig(); }
  catch (_) { return { ...defaultNewGameConfig, seed: '' }; }
}

function labelDifficulty(v) {
  return ({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil', hardcore: 'Hardcore' })[v] || v;
}
function labelEventIntensity(v) { return ({ low: 'baixa', normal: 'normal', high: 'alta' })[v] || v; }
function labelMapSize(v) {
  return ({
    large: 'grande',
    huge: 'enorme',
    giant: 'gigante',
    infinite_chunks: 'infinito por chunks'
  })[v] || v;
}
