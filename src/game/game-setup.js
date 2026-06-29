'use strict';

var defaultNewGameConfig = Object.freeze({
  colonyName: 'Primeiro Refúgio',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'giant',
  sectorProfile: 'balanced',
  landingPriority: 'safe',
  planetScan: null,
  selectedLandingSiteId: null,
  selectedLandingSite: null,
  landingSiteId: null
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

function sanitizeLandingSite(site) {
  if (!site || typeof site !== 'object') return null;
  return {
    id: String(site.id || ''),
    name: String(site.name || site.labels?.title || 'Local de pouso'),
    archetype: String(site.archetype || 'safe'),
    labels: { ...(site.labels || {}) },
    difficulty: { ...(site.difficulty || {}) },
    biomes: {
      primary: site.biomes?.primary || 'forest',
      secondary: Array.isArray(site.biomes?.secondary) ? [...site.biomes.secondary] : [],
      mix: { ...(site.biomes?.mix || {}) }
    },
    resources: { ...(site.resources || {}) },
    risks: { ...(site.risks || {}) },
    positives: Array.isArray(site.positives) ? [...site.positives] : [],
    negatives: Array.isArray(site.negatives) ? [...site.negatives] : [],
    signatures: Array.isArray(site.signatures) ? [...site.signatures] : [],
    worldgenModifiers: { ...(site.worldgenModifiers || {}) },
    preview: {
      seed: site.preview?.seed || '',
      terrainSample: site.preview?.terrainSample || []
    }
  };
}

function normalizeNewGameConfig(config = {}) {
  const seed = normalizeSeedValue(config.seed) || generateRandomSeed();
  const selectedLandingSite = sanitizeLandingSite(config.selectedLandingSite || config.planetScan?.selectedLandingSite);
  const selectedLandingSiteId = String(config.selectedLandingSiteId || config.landingSiteId || selectedLandingSite?.id || config.planetScan?.selectedLandingSiteId || '') || null;
  return {
    ...defaultNewGameConfig,
    ...config,
    colonyName: normalizeColonyName(config.colonyName),
    seed,
    difficulty: ['easy', 'normal', 'hard', 'hardcore'].includes(config.difficulty) ? config.difficulty : defaultNewGameConfig.difficulty,
    colonistCount: clampColonistCount(config.colonistCount),
    resourcesPreset: ['scarce', 'standard', 'rich'].includes(config.resourcesPreset) ? config.resourcesPreset : defaultNewGameConfig.resourcesPreset,
    eventIntensity: ['low', 'normal', 'high'].includes(config.eventIntensity) ? config.eventIntensity : defaultNewGameConfig.eventIntensity,
    mapSize: ['large', 'huge', 'giant', 'infinite_chunks'].includes(config.mapSize) ? config.mapSize : defaultNewGameConfig.mapSize,
    sectorProfile: ['balanced', 'forest', 'water', 'rock', 'harsh', 'safe', 'dense_forest', 'rocky_valley', 'riverbank', 'dry_desert', 'frozen_mountain', 'ancient_ruins', 'extreme'].includes(config.sectorProfile) ? config.sectorProfile : defaultNewGameConfig.sectorProfile,
    landingPriority: ['safe', 'resources', 'exploration', 'challenge'].includes(config.landingPriority) ? config.landingPriority : defaultNewGameConfig.landingPriority,
    planetScan: config.planetScan || null,
    selectedLandingSiteId,
    selectedLandingSite,
    landingSiteId: selectedLandingSiteId
  };
}

function readNewGameConfig() {
  const previous = (typeof newGameConfig !== 'undefined' && newGameConfig) ? newGameConfig : {};
  const raw = normalizeNewGameConfig({
    ...previous,
    colonyName: setupInputValue('colonyName').trim() || defaultNewGameConfig.colonyName,
    seed: setupInputValue('worldSeed').trim(),
    difficulty: setupInputValue('difficulty', 'normal'),
    colonistCount: clampColonistCount(setupInputValue('colonistCount', 3)),
    resourcesPreset: setupInputValue('resourcesPreset', 'standard'),
    eventIntensity: setupInputValue('eventIntensity', 'normal'),
    mapSize: setupInputValue('mapSize', 'giant')
  });

  const changedScanInputs = previous.seed && (
    previous.seed !== raw.seed
    || previous.mapSize !== raw.mapSize
    || previous.difficulty !== raw.difficulty
    || previous.eventIntensity !== raw.eventIntensity
    || previous.resourcesPreset !== raw.resourcesPreset
  );

  if (changedScanInputs) {
    raw.planetScan = null;
    raw.selectedLandingSiteId = null;
    raw.selectedLandingSite = null;
    raw.landingSiteId = null;
    raw.sectorProfile = defaultNewGameConfig.sectorProfile;
  }

  return raw;
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
  const risk = setupRiskLabel(cfg);
  const landing = cfg.selectedLandingSite;
  const landingLine = landing ? `
      <span><small>Pouso</small><b>${escapeHtml(landing.name || landing.id)}</b></span>
      <span><small>Score orbital</small><b>${Number(landing.difficulty?.score || 0)}/100</b></span>` : '';
  dom.setupSummary.innerHTML = `
    <div class="setup-summary-title">
      <span>Briefing</span>
      <b>${escapeHtml(cfg.colonyName)}</b>
    </div>
    <div class="setup-summary-grid">
      <span><small>Seed</small><b>${escapeHtml(cfg.seed)}</b></span>
      <span><small>Risco</small><b>${escapeHtml(risk.label)}</b></span>
      <span><small>Equipe</small><b>${cfg.colonistCount} colono${cfg.colonistCount === 1 ? '' : 's'}</b></span>
      <span><small>Mapa</small><b>${escapeHtml(labelMapSize(cfg.mapSize))}</b></span>
      <span><small>Eventos</small><b>${escapeHtml(labelEventIntensity(cfg.eventIntensity))}</b></span>
      <span><small>Suprimentos</small><b>${escapeHtml(labelResourcesPreset(cfg.resourcesPreset))}</b></span>
      ${landingLine}
    </div>
    <div class="setup-risk-meter ${risk.className}">
      <i style="width:${risk.value}%"></i>
      <em>${escapeHtml(risk.note)}</em>
    </div>`;
}

function setupRiskLabel(cfg) {
  let score = 34;
  if (cfg.difficulty === 'easy') score -= 12;
  if (cfg.difficulty === 'hard') score += 18;
  if (cfg.difficulty === 'hardcore') score += 34;
  if (cfg.eventIntensity === 'low') score -= 8;
  if (cfg.eventIntensity === 'high') score += 16;
  if (cfg.resourcesPreset === 'scarce') score += 14;
  if (cfg.resourcesPreset === 'rich') score -= 10;
  if (cfg.mapSize === 'infinite_chunks') score += 8;

  const landing = cfg.selectedLandingSite;
  if (landing?.difficulty?.tier === 'extreme') score += 22;
  else if (landing?.difficulty?.tier === 'hard') score += 12;
  else if (landing?.difficulty?.tier === 'safe' || landing?.difficulty?.tier === 'favorable') score -= 8;

  const value = Math.max(8, Math.min(100, score));
  if (value >= 72) return { value, label: 'Alto', className: 'danger', note: 'Setor exigente: eventos e logística podem pressionar cedo.' };
  if (value >= 48) return { value, label: 'Moderado', className: 'warn', note: 'Expedição equilibrada, com margem para adaptação.' };
  return { value, label: 'Controlado', className: 'ok', note: 'Condições favoráveis para estabelecer a base inicial.' };
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