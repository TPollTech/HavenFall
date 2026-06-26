'use strict';

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
  const parts = ['ILHA','PEDRA','FOGO','VENTO','RUA','BASE','METAL','NOITE','COLONO','MATA'];
  const a = parts[Math.floor(Math.random() * parts.length)];
  const b = Math.floor(1000 + Math.random() * 9000);
  const c = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${a}-${b}-${c}`;
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

function readNewGameConfig() {
  const seed = setupInputValue('worldSeed').trim() || generateRandomSeed();
  return {
    colonyName: setupInputValue('colonyName').trim() || 'First Haven',
    seed,
    difficulty: setupInputValue('difficulty', 'normal'),
    colonistCount: Number(setupInputValue('colonistCount', 3)),
    resourcesPreset: setupInputValue('resourcesPreset', 'standard'),
    eventIntensity: setupInputValue('eventIntensity', 'normal'),
    mapSize: setupInputValue('mapSize', 'standard')
  };
}

function writeNewGameConfig(config = defaultNewGameConfig) {
  if (dom.inputs.colonyName) dom.inputs.colonyName.value = config.colonyName || 'First Haven';
  if (dom.inputs.worldSeed) dom.inputs.worldSeed.value = config.seed || generateRandomSeed();
  if (dom.inputs.difficulty) dom.inputs.difficulty.value = config.difficulty || 'normal';
  if (dom.inputs.colonistCount) dom.inputs.colonistCount.value = String(config.colonistCount || 3);
  if (dom.inputs.resourcesPreset) dom.inputs.resourcesPreset.value = config.resourcesPreset || 'standard';
  if (dom.inputs.eventIntensity) dom.inputs.eventIntensity.value = config.eventIntensity || 'normal';
  if (dom.inputs.mapSize) dom.inputs.mapSize.value = config.mapSize || 'standard';
  updateSetupSummary();
}

function updateSetupSummary() {
  if (!dom.setupSummary) return;
  const cfg = readNewGameConfigSafe();
  dom.setupSummary.innerHTML = `
    <b>Resumo:</b> ${escapeHtml(cfg.colonyName)} · Seed <b>${escapeHtml(cfg.seed || 'será gerada')}</b> · ${labelDifficulty(cfg.difficulty)} · ${cfg.colonistCount} colonos · mapa ${labelMapSize(cfg.mapSize)} · eventos ${labelEventIntensity(cfg.eventIntensity)}.
    <br><span class="muted-inline">A seed agora gera terreno, recursos, metais, ruínas, pontos especiais e spawn de forma determinística.</span>
  `;
}

function readNewGameConfigSafe() {
  try { return readNewGameConfig(); }
  catch (_) { return { ...defaultNewGameConfig, seed: '' }; }
}

function labelDifficulty(v) { return ({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' })[v] || v; }
function labelEventIntensity(v) { return ({ low: 'baixa', normal: 'normal', high: 'alta' })[v] || v; }
function labelMapSize(v) { return ({ small: 'pequeno', standard: 'padrão', large: 'grande', huge: 'enorme', frontier: 'fronteira vasta' })[v] || v; }
