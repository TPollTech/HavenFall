'use strict';

var defaultNewGameConfig = Object.freeze({
  colonyName: 'Primeiro Refúgio',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'large',
  sectorProfile: 'balanced',
  landingPriority: 'safe',
  planetScan: null,
  selectedLandingSiteId: null,
  selectedLandingSite: null,
  landingSiteId: null
});
const MAX_STARTING_COLONISTS = 8;
const SETUP_PREVIEW_COLORS = Object.freeze({
  grass: '#688744',
  dirt: '#785438',
  sand: '#b99558',
  stone: '#6f7c7d',
  water: '#2c708b',
  forest: '#35592d',
  snow: '#cdd9e4',
  ruin: '#8b6650',
  spawn: '#f7bc54'
});
const SETUP_PREVIEW_LABELS = Object.freeze({
  grass: 'campo vivo',
  dirt: 'solo seco',
  sand: 'faixa de areia',
  stone: 'placa mineral',
  water: 'agua detectada',
  forest: 'massa florestal',
  snow: 'gelo superficial',
  ruin: 'eco estrutural',
  spawn: 'zona de insercao'
});
const SETUP_BIOME_LABELS = Object.freeze({
  forest: 'Floresta temperada',
  meadow: 'Planicie estavel',
  rock: 'Cinturao mineral',
  water: 'Bacia hidrica',
  desert: 'Faixa desertica',
  snow: 'Planalto gelido'
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

function labelMapSize(value) {
  return ({
    large: 'Grande',
    huge: 'Enorme',
    giant: 'Gigante',
    infinite_chunks: 'Fronteira Continental'
  })[value] || value || 'Mapa';
}

function descriptionMapSize(value) {
  return ({
    large: 'Recomendado: rápido e estável.',
    huge: 'Exploração maior, ainda com geração rápida.',
    giant: 'Mapa grande com múltiplos biomas.',
    infinite_chunks: 'Mapa fixo continental, experimental. Usa seed livre, mas ainda não é expansão infinita real.'
  })[value] || 'Mapa procedural gerado por seed.';
}

function refreshMapSizeOptionLabels() {
  const select = dom.inputs?.mapSize;
  if (!select) return;

  const labels = {
    large: 'Grande · recomendado',
    huge: 'Enorme · exploração maior',
    giant: 'Gigante · múltiplos biomas',
    infinite_chunks: 'Fronteira Continental · mapa fixo experimental'
  };

  for (const option of Array.from(select.options || [])) {
    if (labels[option.value]) option.textContent = labels[option.value];
  }
}

function labelEventIntensity(value) {
  return ({
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta'
  })[value] || value || 'Normal';
}

function labelResourcesPreset(value) {
  return ({
    scarce: 'Escassos',
    standard: 'Padrão',
    rich: 'Abundantes'
  })[value] || value || 'Padrão';
}

function setupPreviewColor(type) {
  return SETUP_PREVIEW_COLORS[type] || '#455569';
}

function setupPreviewLabel(type) {
  return SETUP_PREVIEW_LABELS[type] || String(type || 'setor');
}

function normalizePreviewSample(sample) {
  if (!Array.isArray(sample) || !sample.length) return [];
  const rows = sample
    .filter(row => Array.isArray(row) && row.length)
    .map(row => row.map(cell => ({ type: String(cell?.type || 'grass') })));
  return rows.length ? rows : [];
}

function buildSyntheticSetupPreview(cfg, width = 24, height = 14) {
  const rand = seededRandom(`${cfg.seed}|setup-preview|${cfg.mapSize}|${cfg.difficulty}|${cfg.resourcesPreset}|${cfg.eventIntensity}`);
  const harsh = Math.max(0, Math.min(1, (({
    easy: 0.20,
    normal: 0.38,
    hard: 0.60,
    hardcore: 0.82
  })[cfg.difficulty] ?? 0.38) + (({ low: -0.06, normal: 0, high: 0.09 })[cfg.eventIntensity] || 0)));
  const fertile = Math.max(0, Math.min(1, ({
    scarce: 0.18,
    standard: 0.36,
    rich: 0.56
  })[cfg.resourcesPreset] ?? 0.36));
  const frontier = Math.max(0, Math.min(1, ({
    large: 0.18,
    huge: 0.30,
    giant: 0.44,
    infinite_chunks: 0.62
  })[cfg.mapSize] ?? 0.30));
  const desertish = harsh > 0.64 && fertile < 0.34 && rand() > 0.40;
  const snowy = !desertish && (cfg.mapSize === 'giant' || cfg.mapSize === 'infinite_chunks') && harsh > 0.58 && rand() > 0.58;
  const ruinChance = Math.max(0, harsh - 0.42) * 0.14;
  const riverLine = height * (0.56 + (rand() - 0.5) * 0.20);
  const sample = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const dx = (x - width / 2) / width;
      const dy = (y - height / 2) / height;
      const dist = Math.hypot(dx, dy);
      const noise = rand();
      const ridge = rand();
      const riverOffset = Math.sin((x / width) * Math.PI * (1.4 + frontier)) * (0.7 + frontier * 1.1);
      let type = desertish ? 'sand' : snowy ? 'snow' : (fertile > 0.40 ? 'grass' : 'dirt');

      if (dist < 0.09) type = 'spawn';
      else if (fertile > 0.24 && Math.abs(y - riverLine - riverOffset) < 0.80 + fertile * 1.1 && noise > 0.34) type = 'water';
      else if (ridge > 0.90 - frontier * 0.17 + harsh * 0.05) type = 'stone';
      else if (!desertish && !snowy && noise < fertile * 0.56) type = ridge < 0.30 ? 'forest' : 'grass';
      else if (desertish && noise < 0.16 + harsh * 0.08) type = 'stone';
      else if (!desertish && noise > 0.81) type = 'dirt';
      else if (desertish && noise > 0.72) type = 'sand';

      if (type !== 'spawn' && type !== 'water' && noise > 0.965 - ruinChance) type = 'ruin';
      if (cfg.mapSize === 'infinite_chunks' && x > width * 0.64 && ridge > 0.76) type = 'stone';
      if (cfg.resourcesPreset === 'rich' && type === 'dirt' && noise < 0.22) type = 'grass';
      row.push({ type });
    }
    sample.push(row);
  }
  return sample;
}

function setupPreviewSample(cfg) {
  const landingSample = normalizePreviewSample(cfg?.selectedLandingSite?.preview?.terrainSample);
  return landingSample.length ? landingSample : buildSyntheticSetupPreview(cfg);
}

function summarizePreviewSample(sample) {
  const counts = {};
  let total = 0;
  for (const row of sample || []) {
    for (const cell of row || []) {
      const type = String(cell?.type || 'grass');
      counts[type] = Number(counts[type] || 0) + 1;
      total++;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { counts, total, entries };
}

function inferSetupPreviewBiome(sample) {
  const counts = summarizePreviewSample(sample).counts;
  if ((counts.sand || 0) >= Math.max(counts.grass || 0, counts.forest || 0, counts.snow || 0) && (counts.sand || 0) > 10) return 'desert';
  if ((counts.snow || 0) > Math.max(counts.grass || 0, counts.forest || 0, counts.sand || 0)) return 'snow';
  if ((counts.water || 0) > 28) return 'water';
  if ((counts.stone || 0) > 34) return 'rock';
  if ((counts.forest || 0) > (counts.grass || 0)) return 'forest';
  return 'meadow';
}

function setupBiomeLabel(landing, sample) {
  if (landing?.labels?.biomeLabel) return String(landing.labels.biomeLabel);
  const primary = String(landing?.biomes?.primary || inferSetupPreviewBiome(sample));
  return SETUP_BIOME_LABELS[primary] || primary;
}

function renderSetupSectorVisual(cfg, risk, sample = setupPreviewSample(cfg), biomeLabel = setupBiomeLabel(cfg?.selectedLandingSite, sample)) {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('setupSectorVisual') || document.querySelector('#newGameSetupScreen .setup-sector-visual');
  if (!host) return;
  const landing = cfg.selectedLandingSite;
  const chips = [
    { text: landing ? 'setor validado' : 'scan pendente', state: landing ? 'is-locked' : 'is-pending' },
    { text: labelMapSize(cfg.mapSize) },
    { text: labelResourcesPreset(cfg.resourcesPreset) },
    { text: labelEventIntensity(cfg.eventIntensity) },
    { text: landing ? `${Number(landing.difficulty?.score || 0)}/100 score` : `risco ${risk.label.toLowerCase()}` }
  ];
  const lead = landing
    ? escapeHtml(landing.labels?.subtitle || 'Pouso travado. Este setor ja define spawn, terreno, riscos e recursos do mapa final.')
    : escapeHtml('Nenhum pouso foi travado ainda. Abra a analise de setor para escolher o ponto de descida da colonia.');
  const stages = [
    { label: 'Agora', title: 'Identidade e expedicao', state: 'current' },
    { label: 'Etapa 02', title: 'Analise de setor', state: landing ? 'ready' : 'pending' },
    { label: 'Etapa 03', title: 'Selecao de colonos', state: landing ? 'pending' : 'locked' }
  ];

  host.innerHTML = `
    <div class="setup-visual-head">
      <div class="setup-visual-copy">
        <span class="setup-visual-kicker">Fluxo da missao</span>
        <b>${escapeHtml(landing?.name || 'Passos da expedicao')}</b>
        <small>${lead}</small>
      </div>
      <div class="setup-visual-status ${landing ? 'is-locked' : 'is-pending'}">${landing ? 'SETOR TRAVADO' : 'SCAN PENDENTE'}</div>
    </div>
    <div class="setup-stage-list">
      ${stages.map(stage => `<span class="setup-stage-card ${stage.state}"><small>${escapeHtml(stage.label)}</small><b>${escapeHtml(stage.title)}</b></span>`).join('')}
    </div>
    <div class="setup-visual-chip-row">${chips.map(chip => `<span class="setup-visual-chip ${chip.state || ''}">${escapeHtml(chip.text)}</span>`).join('')}</div>`;
}

function readNewGameConfig() {
  refreshMapSizeOptionLabels();
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
  refreshMapSizeOptionLabels();
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
  refreshMapSizeOptionLabels();
  if (!dom.setupSummary) return;
  if (dom?.buttons?.setupNext) dom.buttons.setupNext.textContent = 'Abrir Analise de Setor';
  const nextStep = typeof document === 'undefined' ? null : document.querySelector('#newGameSetupScreen .setup-next-step b');
  if (nextStep) nextStep.textContent = 'Analise orbital do pouso';
  const cfg = readNewGameConfigSafe();
  const risk = setupRiskLabel(cfg);
  const landing = cfg.selectedLandingSite;
  const previewSample = setupPreviewSample(cfg);
  const biomeLabel = setupBiomeLabel(landing, previewSample);
  const landingName = landing ? (landing.name || landing.id) : 'Escolher na analise';
  const scanScore = landing ? `${Number(landing.difficulty?.score || 0)}/100` : 'Pendente';
  const summaryLead = landing
    ? `Pouso confirmado em ${landingName}. O mundo vai herdar os modificadores, riscos e recursos desse setor.`
    : 'Ajuste os parametros da expedicao e abra a analise de setor para escolher onde a colonia vai descer.';
  const landingLine = landing
    ? `
      <span><small>Pouso</small><b>${escapeHtml(landingName)}</b></span>
      <span><small>Score orbital</small><b>${scanScore}</b></span>`
    : `
      <span><small>Analise</small><b>Aguardando escolha do pouso</b></span>
      <span><small>Status</small><b>Sem setor travado</b></span>`;
  renderSetupSectorVisual(cfg, risk, previewSample, biomeLabel);
  dom.setupSummary.innerHTML = `
    <div class="setup-summary-title">
      <span>Dossie da missao</span>
      <b>${escapeHtml(cfg.colonyName)}</b>
    </div>
    <div class="setup-summary-grid">
      <span><small>Seed</small><b>${escapeHtml(cfg.seed)}</b></span>
      <span><small>Risco</small><b>${escapeHtml(risk.label)}</b></span>
      <span><small>Equipe</small><b>${cfg.colonistCount} colono${cfg.colonistCount === 1 ? '' : 's'}</b></span>
      <span><small>Mapa</small><b>${escapeHtml(labelMapSize(cfg.mapSize))}</b></span>
      <span><small>Tipo</small><b>${escapeHtml(descriptionMapSize(cfg.mapSize))}</b></span>
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
  return { value, label: 'Baixo', className: 'safe', note: 'Condições favoráveis para estabelecer o primeiro abrigo.' };
}

function readNewGameConfigSafe() {
  try { return readNewGameConfig(); }
  catch (_) { return normalizeNewGameConfig(newGameConfig || defaultNewGameConfig); }
}

function updateSetupInputsFromScan(config) {
  const cfg = normalizeNewGameConfig(config);
  writeNewGameConfig(cfg);
  return cfg;
}
