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

function setScreen(screen) {
  previousScreen = appScreen;
  appScreen = screen;
  Object.values(dom.screens).forEach(el => el && el.classList.remove('active'));
  if (screen === SCREEN.MAIN_MENU) dom.screens.main.classList.add('active');
  if (screen === SCREEN.NEW_GAME_SETUP) dom.screens.setup.classList.add('active');
  if (screen === SCREEN.COLONIST_SELECT) dom.screens.colonists.classList.add('active');
  if (screen === SCREEN.LOAD_GAME) dom.screens.load.classList.add('active');
  if (screen === SCREEN.SETTINGS) dom.screens.settings.classList.add('active');
  if (screen === SCREEN.PLAYING || screen === SCREEN.PAUSED) dom.screens.game.classList.add('active');
  dom.pauseOverlay.classList.toggle('show', screen === SCREEN.PAUSED);
  if (state) state.paused = screen !== SCREEN.PLAYING;
  started = screen === SCREEN.PLAYING;
  refreshMenuSaveInfo();
  refreshLoadScreen();
  updateSetupSummary();
  if (state) updateUI(true);
}

function goBackFromSettings() {
  setScreen(previousScreen === SCREEN.PAUSED || previousScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.MAIN_MENU);
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

function readNewGameConfig() {
  const seedInput = document.getElementById('worldSeedInput');
  if (!seedInput.value.trim()) seedInput.value = generateRandomSeed();
  return {
    colonyName: document.getElementById('colonyNameInput').value.trim() || 'First Haven',
    seed: seedInput.value.trim(),
    difficulty: document.getElementById('difficultySelect').value,
    colonistCount: Number(document.getElementById('colonistCountSelect').value),
    resourcesPreset: document.getElementById('resourcesPresetSelect').value,
    eventIntensity: document.getElementById('eventIntensitySelect').value,
    mapSize: document.getElementById('mapSizeSelect').value
  };
}

function writeNewGameConfig(config = defaultNewGameConfig) {
  document.getElementById('colonyNameInput').value = config.colonyName || 'First Haven';
  document.getElementById('worldSeedInput').value = config.seed || generateRandomSeed();
  document.getElementById('difficultySelect').value = config.difficulty || 'normal';
  document.getElementById('colonistCountSelect').value = String(config.colonistCount || 3);
  document.getElementById('resourcesPresetSelect').value = config.resourcesPreset || 'standard';
  document.getElementById('eventIntensitySelect').value = config.eventIntensity || 'normal';
  document.getElementById('mapSizeSelect').value = config.mapSize || 'standard';
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
