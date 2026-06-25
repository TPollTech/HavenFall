(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const TILE = 48;
  const COLS = 22;
  const ROWS = 14;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  let viewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  const SAVE_KEY = 'havenfall-v1-save';
  const SETTINGS_KEY = 'havenfall-v1-settings';
  const SCREEN = Object.freeze({
    MAIN_MENU: 'MAIN_MENU',
    NEW_GAME_SETUP: 'NEW_GAME_SETUP',
    COLONIST_SELECT: 'COLONIST_SELECT',
    LOAD_GAME: 'LOAD_GAME',
    SETTINGS: 'SETTINGS',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED'
  });

  const assetNames = [
    'tile_grass','tile_dirt','tile_sand','tile_stone',
    'tree','bush','rock','logs','berry','crop_patch',
    'bed_single','table_wood','crate_wood','stool','wall_stone','door_wood','campfire','chest_large',
    'crafting_bench','research_desk','stove','med_station',
    'wolf_0','wolf_1','wolf_2','wolf_3','wolf_4',
    'icon_food','icon_wood','icon_stone','icon_metal','icon_warn',
    'colonistA_down_0','colonistA_down_1','colonistA_down_2','colonistA_down_3',
    'colonistA_up_0','colonistA_up_1','colonistA_up_2','colonistA_up_3',
    'colonistA_left_0','colonistA_left_1','colonistA_left_2','colonistA_left_3',
    'colonistA_right_0','colonistA_right_1','colonistA_right_2','colonistA_right_3',
    'colonistB_down_0','colonistB_down_1','colonistB_down_2','colonistB_down_3',
    'colonistB_up_0','colonistB_up_1','colonistB_up_2','colonistB_up_3',
    'colonistB_right_0','colonistB_right_1','colonistB_right_2','colonistB_right_3',
    'colonistC_down_0','colonistC_down_1','colonistC_down_2','colonistC_down_3',
    'colonistC_up_0','colonistC_up_1','colonistC_up_2','colonistC_up_3',
    'colonistC_right_0','colonistC_right_1','colonistC_right_2','colonistC_right_3'
  ];

  const images = {};
  const dom = {
    screens: {
      main: document.getElementById('mainMenuScreen'),
      setup: document.getElementById('newGameSetupScreen'),
      colonists: document.getElementById('colonistSelectScreen'),
      load: document.getElementById('loadGameScreen'),
      settings: document.getElementById('settingsScreen'),
      game: document.getElementById('gameScreen')
    },
    pauseOverlay: document.getElementById('pauseOverlay'),
    dayLabel: document.getElementById('dayLabel'),
    timeLabel: document.getElementById('timeLabel'),
    weatherLabel: document.getElementById('weatherLabel'),
    speedLabel: document.getElementById('speedLabel'),
    colonyTitle: document.getElementById('colonyTitle'),
    gameConfigLabel: document.getElementById('gameConfigLabel'),
    menuSaveInfo: document.getElementById('menuSaveInfo'),
    resFood: document.getElementById('resFood'),
    resWood: document.getElementById('resWood'),
    resStone: document.getElementById('resStone'),
    resMetal: document.getElementById('resMetal'),
    resMedicine: document.getElementById('resMedicine'),
    selectedInfo: document.getElementById('selectedInfo'),
    selectedObjectInfo: document.getElementById('selectedObjectInfo'),
    colonistList: document.getElementById('colonistList'),
    buildStatus: document.getElementById('buildStatus'),
    log: document.getElementById('log'),
    modal: document.getElementById('modal'),
    goalList: document.getElementById('goalList'),
    setupSummary: document.getElementById('setupSummary'),
    colonistCards: document.getElementById('colonistCards'),
    loadSlot: document.getElementById('loadSlot')
  };

  const researchDefs = {
    metalworking: { label: 'Metalurgia básica', unlocks: ['forge'], cost: 24 },
    cooking: { label: 'Cozinha de sobrevivência', unlocks: ['stove'], cost: 20 },
    medicine: { label: 'Primeiros socorros', unlocks: ['med_station'], cost: 22 }
  };

  const researchOrder = ['metalworking', 'cooking', 'medicine'];

  const priorityDefs = {
    build: { label: 'Construção', note: 'Procura blueprints automaticamente.' },
    gather: { label: 'Coleta', note: 'Procura recursos coletáveis automaticamente.' },
    defense: { label: 'Defesa', note: 'Fica de guarda e corre para espantar ameaças.' }
  };

  const priorityOrder = ['build', 'gather', 'defense'];

  const objectDefs = {
    tree: { name: 'árvore', img: 'tree', blocks: true, gather: { wood: 8 }, work: 3.2, respawn: false },
    bush: { name: 'arbusto', img: 'bush', blocks: true, gather: { wood: 2 }, work: 1.5 },
    berry: { name: 'frutas silvestres', img: 'berry', blocks: false, gather: { food: 7 }, work: 2.0 },
    rock: { name: 'rocha', img: 'rock', blocks: true, gather: { stone: 7 }, work: 3.4 },
    ore: { name: 'veio de metal', img: 'icon_metal', blocks: true, gather: { stone: 2, metal: 4 }, work: 4.0 },
    logs: { name: 'toras', img: 'logs', blocks: false, gather: { wood: 5 }, work: 1.4 },
    crop: { name: 'plantação', img: 'crop_patch', blocks: false, gather: { food: 10 }, work: 2.4 },
    bed: { name: 'cama', img: 'bed_single', blocks: true, comfort: 1.25 },
    campfire: { name: 'fogueira', img: 'campfire', blocks: true, warmth: 1 },
    forge: { name: 'forja de metal', img: 'stove', blocks: true, forge: { input: { stone: 3 }, output: { metal: 1 } }, work: 4.5 },
    stove: { name: 'fogão', img: 'stove', blocks: true, cook: { input: { food: 2, wood: 1 }, output: { food: 4 } }, work: 3.8 },
    med_station: { name: 'estação médica', img: 'med_station', blocks: true, heal: { input: { medicine: 1 }, amount: 28 }, work: 4.2 },
    research_desk: { name: 'mesa de pesquisa', img: 'research_desk', blocks: true, research: 1, work: 5.0 },
    crate: { name: 'depósito', img: 'crate_wood', blocks: true, storage: 1 },
    wall: { name: 'parede', img: 'wall_stone', blocks: true },
    bench: { name: 'bancada', img: 'crafting_bench', blocks: true, craft: 1 }
  };

  const buildDefs = {
    bed: { label: 'Cama', type: 'bed', cost: { wood: 12 }, work: 5 },
    campfire: { label: 'Fogueira', type: 'campfire', cost: { wood: 6, stone: 2 }, work: 4 },
    crate: { label: 'Depósito', type: 'crate', cost: { wood: 10 }, work: 4 },
    wall: { label: 'Parede', type: 'wall', cost: { wood: 4 }, work: 3 },
    crop: { label: 'Plantação', type: 'crop', cost: { food: 2 }, work: 3 },
    bench: { label: 'Bancada', type: 'bench', cost: { wood: 18, stone: 8 }, work: 7 },
    research_desk: { label: 'Mesa de Pesquisa', type: 'research_desk', cost: { wood: 20, stone: 6 }, work: 7 },
    forge: { label: 'Forja', type: 'forge', cost: { wood: 14, stone: 12 }, work: 8, requires: 'metalworking' },
    stove: { label: 'Fogão', type: 'stove', cost: { wood: 12, stone: 10, metal: 2 }, work: 7, requires: 'cooking' },
    med_station: { label: 'Estação Médica', type: 'med_station', cost: { wood: 10, stone: 4, metal: 4 }, work: 8, requires: 'medicine' }
  };

  const names = ['Lia', 'Téo', 'Nico'];

  let state;
  let appScreen = SCREEN.MAIN_MENU;
  let previousScreen = SCREEN.MAIN_MENU;
  let selectedColonistId = 1;
  let currentBuild = null;
  let lastTime = performance.now();
  let uiTimer = 0;
  let autosaveTimer = 0;
  let started = false;
  let newGameConfig = null;
  let colonistCandidates = [];
  let settings = loadSettings();
  let activeSession = false;
  let activeHudTab = 'build';

  const defaultNewGameConfig = {
    colonyName: 'First Haven',
    seed: '',
    difficulty: 'normal',
    colonistCount: 3,
    resourcesPreset: 'standard',
    eventIntensity: 'normal',
    mapSize: 'standard'
  };


  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { uiScale: 'normal', autosave: 'on' };
    } catch (_) {
      return { uiScale: 'normal', autosave: 'on' };
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
      <br><span class="muted-inline">A função <code>generateWorldFromSeed(config)</code> já recebe seed, tamanho e dificuldade. Nesta etapa ela mantém o mapa base com variação determinística inicial.</span>
    `;
  }

  function readNewGameConfigSafe() {
    try { return readNewGameConfig(); }
    catch (_) { return { ...defaultNewGameConfig, seed: '' }; }
  }

  function labelDifficulty(v) { return ({ easy: 'Fácil', normal: 'Normal', hard: 'Difícil' })[v] || v; }
  function labelEventIntensity(v) { return ({ low: 'baixa', normal: 'normal', high: 'alta' })[v] || v; }
  function labelMapSize(v) { return ({ small: 'pequeno', standard: 'padrão', large: 'grande' })[v] || v; }

  function initialResourcesForConfig(config) {
    const table = {
      scarce: { food: 10, wood: 12, stone: 4, metal: 0, medicine: 0 },
      standard: { food: 14, wood: 18, stone: 6, metal: 0, medicine: 1 },
      rich: { food: 24, wood: 30, stone: 12, metal: 2, medicine: 2 }
    };
    const res = { ...(table[config.resourcesPreset] || table.standard) };
    if (config.difficulty === 'easy') { res.food += 6; res.wood += 8; res.medicine += 1; }
    if (config.difficulty === 'hard') { res.food = Math.max(4, res.food - 5); res.wood = Math.max(5, res.wood - 7); res.stone = Math.max(2, res.stone - 3); }
    return res;
  }

  function createColonistCandidate(index, config, forceSeed = null) {
    const rand = seededRandom(forceSeed || `${config.seed}-colonist-${index}-${Date.now()}-${Math.random()}`);
    const firstNames = ['Lia','Téo','Nico','Bia','Gael','Mira','Davi','Luma','Caio','Iris','Noa','Eva','Ravi','Mila','Otto','Nina'];
    const roles = ['Coletora', 'Construtor', 'Faz-tudo'];
    const sprites = ['colonistA', 'colonistB', 'colonistC'];
    const physical = ['resistente', 'baixo', 'alto', 'ágil', 'visão boa', 'mãos firmes', 'cansa rápido', 'passo leve'];
    const psycheGood = ['calmo', 'curioso', 'otimista', 'focado', 'corajoso', 'organizado', 'paciente'];
    const psycheBad = ['teimoso', 'medroso', 'impaciente', 'desastrado', 'noturno', 'pessimista', 'distraído'];
    const workPrefs = ['Construção', 'Coleta', 'Defesa', 'Pesquisa', 'Culinária', 'Medicina'];
    const skills = {
      coleta: 1 + Math.floor(rand() * 5),
      construcao: 1 + Math.floor(rand() * 5),
      defesa: 1 + Math.floor(rand() * 5),
      pesquisa: 1 + Math.floor(rand() * 5),
      medicina: 1 + Math.floor(rand() * 5)
    };
    const role = roles[Math.floor(rand() * roles.length)];
    return {
      setupId: uid(),
      locked: false,
      name: firstNames[Math.floor(rand() * firstNames.length)],
      age: 18 + Math.floor(rand() * 38),
      sprite: sprites[index % sprites.length],
      role,
      physicalTraits: pickMany(physical, 2, rand),
      positiveTraits: pickMany(psycheGood, 2, rand),
      negativeTraits: pickMany(psycheBad, 1, rand),
      skills,
      workPreference: workPrefs[Math.floor(rand() * workPrefs.length)],
      needs: {
        hunger: 72 + Math.floor(rand() * 22),
        energy: 72 + Math.floor(rand() * 22),
        mood: 68 + Math.floor(rand() * 26),
        health: 88 + Math.floor(rand() * 13)
      }
    };
  }

  function pickMany(list, amount, rand) {
    const copy = list.slice();
    const out = [];
    while (out.length < amount && copy.length) {
      out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    }
    return out;
  }

  function generateColonistCandidates(config) {
    colonistCandidates = Array.from({ length: config.colonistCount }, (_, i) => createColonistCandidate(i, config, `${config.seed}-candidate-${i}`));
    renderColonistSelection();
  }

  function rerollColonist(index) {
    if (colonistCandidates[index]?.locked) return;
    colonistCandidates[index] = createColonistCandidate(index, newGameConfig, `${newGameConfig.seed}-reroll-${index}-${Date.now()}-${Math.random()}`);
    renderColonistSelection();
  }

  function renderColonistSelection() {
    if (!dom.colonistCards) return;
    dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => `
      <article class="colonist-card ${c.locked ? 'locked' : ''}">
        <div class="colonist-head">
          <div class="colonist-preview"><img src="assets/sprites/${c.sprite}_down_0.png" alt=""></div>
          <div>
            <h2>${escapeHtml(c.name)}, ${c.age}</h2>
            <div class="empty">${escapeHtml(c.role)} · Prefere ${escapeHtml(c.workPreference)}</div>
          </div>
        </div>
        <div class="tags">
          ${c.physicalTraits.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          ${c.positiveTraits.map(t => `<span class="tag good">+ ${escapeHtml(t)}</span>`).join('')}
          ${c.negativeTraits.map(t => `<span class="tag bad">- ${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="empty">Habilidades: coleta ${c.skills.coleta}, construção ${c.skills.construcao}, defesa ${c.skills.defesa}, pesquisa ${c.skills.pesquisa}, medicina ${c.skills.medicina}</div>
        <div class="empty">Necessidades: comida ${c.needs.hunger}%, energia ${c.needs.energy}%, humor ${c.needs.mood}%, saúde ${c.needs.health}%</div>
        <div class="card-actions">
          <button data-reroll-colonist="${i}" ${c.locked ? 'disabled' : ''}>Rerolar</button>
          <button data-lock-colonist="${i}" class="${c.locked ? 'active' : 'secondary'}">${c.locked ? 'Travado' : 'Travar'}</button>
        </div>
      </article>
    `).join('');
  }

  function candidateToColonist(candidate, id, x, y) {
    const c = makeColonist(id, candidate.name, candidate.sprite, x, y, candidate.role);
    c.age = candidate.age;
    c.appearance = candidate.sprite;
    c.physicalTraits = candidate.physicalTraits;
    c.positiveTraits = candidate.positiveTraits;
    c.negativeTraits = candidate.negativeTraits;
    c.skills = candidate.skills;
    c.workPreference = candidate.workPreference;
    c.hunger = candidate.needs.hunger;
    c.energy = candidate.needs.energy;
    c.mood = candidate.needs.mood;
    c.health = candidate.needs.health;
    c.priority = priorityFromWorkPreference(candidate.workPreference, candidate.role);
    return c;
  }

  function priorityFromWorkPreference(pref, role) {
    if (pref === 'Construção') return 'build';
    if (pref === 'Coleta') return 'gather';
    if (pref === 'Defesa') return 'defense';
    return defaultPriorityForRole(role);
  }

  function refreshMenuSaveInfo() {
    if (!dom.menuSaveInfo) return;
    const continueBtn = document.getElementById('continueBtn');
    if (activeSession && state) {
      dom.menuSaveInfo.innerHTML = `Partida em andamento: <b>${escapeHtml(state.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${state.day || 1} · Seed ${escapeHtml(state.config?.seed || 'sem seed')}`;
      if (continueBtn) continueBtn.disabled = false;
      return;
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      dom.menuSaveInfo.textContent = 'Nenhum save encontrado. Comece por Novo Jogo.';
      if (continueBtn) continueBtn.disabled = true;
      return;
    }
    try {
      const data = JSON.parse(raw);
      const s = data.state;
      dom.menuSaveInfo.innerHTML = `Save encontrado: <b>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</b> · Dia ${s.day || 1} · Seed ${escapeHtml(s.config?.seed || 'antiga')}`;
      if (continueBtn) continueBtn.disabled = false;
    } catch (_) {
      dom.menuSaveInfo.textContent = 'Save encontrado, mas pode estar corrompido.';
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
      dom.loadSlot.innerHTML = `<strong>${escapeHtml(s.config?.colonyName || 'Colônia sem nome')}</strong><br>Dia ${s.day || 1}, ${formatHour(s.hour || 6)} · Seed ${escapeHtml(s.config?.seed || 'save antigo')} · ${s.colonists?.length || 0} colonos`;
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
    state.paused = false;
    started = true;
    activeSession = true;
    log(`Nova partida iniciada: ${config.colonyName}. Seed: ${config.seed}.`);
    setScreen(SCREEN.PLAYING);
    updateUI(true);
  }

  function continueFromMenu() {
    if (activeSession && state) setScreen(SCREEN.PLAYING);
    else loadAndPlay();
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
    const rand = seededRandom(`${config.seed}-${config.mapSize}-${config.difficulty}`);
    const terrain = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) {
        let t = 'grass';
        if (x < 2 || y < 1 || x > COLS - 3 || y > ROWS - 2) t = 'sand';
        if ((x > 8 && x < 14 && y > 4 && y < 8) || (x === 15 && y > 8)) t = 'dirt';
        if ((x > 16 && y < 4) || (x === 4 && y === 9)) t = 'stone';
        if (config.mapSize === 'large' && rand() < 0.035 && x > 2 && y > 2 && x < COLS - 3 && y < ROWS - 3) t = rand() > 0.5 ? 'dirt' : 'stone';
        if (config.mapSize === 'small' && rand() < 0.02 && x > 2 && y > 2 && x < COLS - 3 && y < ROWS - 3) t = 'sand';
        row.push(t);
      }
      terrain.push(row);
    }

    const objects = [];
    const add = (type, x, y, extra = {}) => objects.push({ id: uid(), type, x, y, ...extra });
    const baseObjects = [
      ['tree',4,2],['tree',6,3],['tree',3,10],['tree',18,3],['tree',19,9],
      ['bush',5,10],['bush',2,7],['berry',8,10],['berry',17,10],
      ['rock',16,2],['rock',18,2],['rock',16,5],['rock',19,5],
      ['ore',17,2],['ore',20,5],
      ['logs',10,8],['berry',11,5]
    ];
    baseObjects.forEach(([t,x,y]) => add(t,x,y));

    const extraBySize = { small: 2, standard: 4, large: 7 }[config.mapSize] || 4;
    for (let i = 0; i < extraBySize; i++) {
      const tile = randomFreeTileForWorld(terrain, objects, rand);
      if (!tile) continue;
      const roll = rand();
      const type = roll < 0.25 ? 'tree' : roll < 0.48 ? 'rock' : roll < 0.62 ? 'ore' : roll < 0.82 ? 'berry' : 'bush';
      add(type, tile.x, tile.y);
    }

    add('crate', 10, 6);
    add('campfire', 12, 6);

    return {
      seed: config.seed,
      mapSize: config.mapSize,
      difficulty: config.difficulty,
      terrain,
      objects,
      spawnPoints: [{ x: 7, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 8 }, { x: 8, y: 8 }, { x: 9, y: 7 }],
      weatherPattern: []
    };
  }

  function randomFreeTileForWorld(terrain, objects, rand) {
    for (let i = 0; i < 80; i++) {
      const x = 2 + Math.floor(rand() * (COLS - 4));
      const y = 2 + Math.floor(rand() * (ROWS - 4));
      if (terrain[y][x] === 'sand') continue;
      if (objects.some(o => o.x === x && o.y === y)) continue;
      return { x, y };
    }
    return null;
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
      const spawn = world.spawnPoints[i] || { x: 7 + i, y: 7 };
      return candidateToColonist(candidate, i + 1, spawn.x, spawn.y);
    });

    return {
      config,
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

  function uid() {
    return Math.floor(Math.random() * 1e9).toString(36) + Date.now().toString(36).slice(-4);
  }

  function makeResearchState() {
    return {
      unlocked: {},
      current: researchOrder[0],
      progress: 0,
      completed: []
    };
  }

  function ensureResearchState() {
    if (!state.research) state.research = makeResearchState();
    state.research.unlocked = state.research.unlocked || {};
    state.research.completed = state.research.completed || [];
    if (!state.research.current || state.research.unlocked[state.research.current]) state.research.current = nextResearchKey();
    state.research.progress = state.research.progress || 0;
  }

  function nextResearchKey() {
    return researchOrder.find(key => !state.research?.unlocked?.[key]) || null;
  }

  function isBuildUnlocked(buildKey) {
    const def = buildDefs[buildKey];
    return !def?.requires || !!state.research?.unlocked?.[def.requires];
  }

  function unlockResearch(key) {
    const def = researchDefs[key];
    if (!def) return;
    state.research.unlocked[key] = true;
    if (!state.research.completed.includes(key)) state.research.completed.push(key);
    state.research.progress = 0;
    state.research.current = nextResearchKey();
    const unlockedNames = def.unlocks.map(k => buildDefs[k]?.label || k).join(', ');
    log(`Pesquisa concluída: ${def.label}. Desbloqueado: ${unlockedNames}.`);
  }

  function defaultPriorityForRole(role) {
    if (role === 'Coletora') return 'gather';
    if (role === 'Construtor') return 'build';
    return 'defense';
  }

  function roleBonusText(c) {
    if (c.role === 'Coletora') return '+25% em coleta';
    if (c.role === 'Construtor') return '+25% em construção';
    if (c.role === 'Faz-tudo') return '+10% em tarefas gerais';
    return 'sem bônus';
  }

  function workRate(c, kind) {
    let rate = 1;
    if (c.role === 'Coletora' && kind === 'gather') rate += 0.25;
    if (c.role === 'Construtor' && kind === 'build') rate += 0.25;
    if (c.role === 'Faz-tudo' && ['gather','build','research','forge','cook','heal','defense'].includes(kind)) rate += 0.10;
    if (c.priority === 'build' && kind === 'build') rate += 0.10;
    if (c.priority === 'gather' && kind === 'gather') rate += 0.10;
    if (c.priority === 'defense' && kind === 'defense') rate += 0.10;
    return rate;
  }

  function ensureColonistMeta(c) {
    if (!priorityDefs[c.priority]) c.priority = defaultPriorityForRole(c.role);
    c.path = c.path || [];
    c.px = c.px ?? c.x * TILE + TILE / 2;
    c.py = c.py ?? c.y * TILE + TILE / 2;
    c.note = c.note || 'Ocioso';
    c.work = c.work || 0;
  }

  function makeColonist(id, name, sprite, x, y, role) {
    return {
      id, name, role, sprite,
      x, y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2,
      dir: 'down', frame: 0, anim: 0,
      hunger: 78 + Math.random() * 10,
      energy: 82 + Math.random() * 8,
      mood: 76 + Math.random() * 12,
      health: 100,
      priority: defaultPriorityForRole(role),
      task: null,
      path: [],
      work: 0,
      note: 'Ocioso'
    };
  }

  function log(message) {
    const hour = formatHour(state.hour);
    state.log.unshift(`[Dia ${state.day} ${hour}] ${message}`);
    state.log = state.log.slice(0, 60);
  }

  function formatHour(hour) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour - Math.floor(hour)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function hasCost(cost) {
    return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
  }

  function payCost(cost) {
    for (const [k, v] of Object.entries(cost)) state.resources[k] -= v;
  }

  function addResources(gain) {
    for (const [k, v] of Object.entries(gain)) state.resources[k] = (state.resources[k] || 0) + v;
  }

  function getObjectAt(x, y) {
    return state.objects.find(o => o.x === x && o.y === y);
  }

  function getWolfAt(x, y) {
    return state.wolves.find(w => Math.round(w.x) === x && Math.round(w.y) === y);
  }

  function isInside(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function isBlocked(x, y, target = null) {
    if (!isInside(x, y)) return true;
    if (target && target.x === x && target.y === y) return false;
    const obj = getObjectAt(x, y);
    if (obj && obj.type !== 'blueprint' && objectDefs[obj.type]?.blocks) return true;
    if (state.colonists.some(c => Math.round(c.x) === x && Math.round(c.y) === y && Math.abs(c.px - (x * TILE + TILE / 2)) < 5 && Math.abs(c.py - (y * TILE + TILE / 2)) < 5)) return false;
    return false;
  }

  function findPath(startX, startY, endX, endY, target = null) {
    startX = Math.round(startX); startY = Math.round(startY);
    endX = Math.round(endX); endY = Math.round(endY);
    if (!isInside(endX, endY)) return [];
    const key = (x, y) => `${x},${y}`;
    const queue = [[startX, startY]];
    const came = new Map([[key(startX, startY), null]]);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === endX && y === endY) break;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        const k = key(nx, ny);
        if (!came.has(k) && !isBlocked(nx, ny, target)) {
          came.set(k, [x, y]);
          queue.push([nx, ny]);
        }
      }
    }

    const endKey = key(endX, endY);
    if (!came.has(endKey)) return [];
    const path = [];
    let cur = [endX, endY];
    while (cur) {
      path.push({ x: cur[0], y: cur[1] });
      cur = came.get(key(cur[0], cur[1]));
    }
    path.reverse();
    path.shift();
    return path;
  }

  function nearestFreeAdjacent(x, y, fromX, fromY) {
    const candidates = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
      .filter(([cx, cy]) => !isBlocked(cx, cy))
      .sort((a, b) => dist(a[0], a[1], fromX, fromY) - dist(b[0], b[1], fromX, fromY));
    return candidates[0] ? { x: candidates[0][0], y: candidates[0][1] } : null;
  }

  function dist(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function selectedColonist() {
    return state.colonists.find(c => c.id === selectedColonistId) || state.colonists[0];
  }

  function assignMove(c, x, y) {
    if (isBlocked(x, y)) return false;
    c.task = { type: 'move', x, y };
    c.path = findPath(c.x, c.y, x, y);
    c.work = 0;
    c.note = `Indo para ${x},${y}`;
    return true;
  }

  function assignGather(c, obj) {
    if (!objectDefs[obj.type]?.gather) return;
    const adj = nearestFreeAdjacent(obj.x, obj.y, c.x, c.y);
    if (!adj) { log(`${c.name} não conseguiu chegar em ${objectDefs[obj.type].name}.`); return; }
    c.task = { type: 'gather', objId: obj.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y);
    c.work = 0;
    c.note = `Coletando ${objectDefs[obj.type].name}`;
  }

  function assignBuild(c, bp) {
    const adj = nearestFreeAdjacent(bp.x, bp.y, c.x, c.y) || { x: bp.x, y: bp.y };
    c.task = { type: 'build', objId: bp.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, bp);
    c.work = 0;
    c.note = `Construindo ${buildDefs[bp.buildType]?.label || 'obra'}`;
  }

  function assignScare(c, wolf) {
    const target = { x: Math.round(wolf.x), y: Math.round(wolf.y) };
    const adj = nearestFreeAdjacent(target.x, target.y, c.x, c.y) || target;
    c.task = { type: 'scare', wolfId: wolf.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y);
    c.work = 0;
    c.note = 'Espantando animal';
  }

  function assignForge(c, forge) {
    const def = objectDefs[forge.type];
    if (!def?.forge) return;
    const adj = nearestFreeAdjacent(forge.x, forge.y, c.x, c.y);
    if (!adj) { log(`${c.name} não conseguiu chegar na ${def.name}.`); return; }
    c.task = { type: 'forge', objId: forge.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, forge);
    c.work = 0;
    c.note = `Indo para ${def.name}`;
  }

  function assignResearch(c, desk) {
    ensureResearchState();
    const key = state.research.current;
    if (!key) { log('Todas as pesquisas da V1.6 já foram concluídas.'); return; }
    const adj = nearestFreeAdjacent(desk.x, desk.y, c.x, c.y);
    if (!adj) { log(`${c.name} não conseguiu chegar na mesa de pesquisa.`); return; }
    c.task = { type: 'research', objId: desk.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, desk);
    c.work = 0;
    c.note = `Indo pesquisar ${researchDefs[key].label}`;
  }

  function assignCook(c, stove) {
    const adj = nearestFreeAdjacent(stove.x, stove.y, c.x, c.y);
    if (!adj) { log(`${c.name} não conseguiu chegar no fogão.`); return; }
    c.task = { type: 'cook', objId: stove.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, stove);
    c.work = 0;
    c.note = 'Indo preparar refeição';
  }

  function assignHeal(c, station) {
    const adj = nearestFreeAdjacent(station.x, station.y, c.x, c.y);
    if (!adj) { log(`${c.name} não conseguiu chegar na estação médica.`); return; }
    c.task = { type: 'heal', objId: station.id, x: adj.x, y: adj.y };
    c.path = findPath(c.x, c.y, adj.x, adj.y, station);
    c.work = 0;
    c.note = 'Indo receber tratamento';
  }

  function isGatherableReady(obj) {
    const def = objectDefs[obj.type];
    if (!def?.gather) return false;
    if (obj.type === 'crop' && (obj.growth || 0) < 100) return false;
    return true;
  }

  function nearestGatherable(c) {
    return state.objects
      .filter(isGatherableReady)
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
  }

  function nearestThreat(c) {
    return state.wolves
      .slice()
      .sort((a, b) => dist(c.x, c.y, Math.round(a.x), Math.round(a.y)) - dist(c.x, c.y, Math.round(b.x), Math.round(b.y)))[0];
  }

  function assignAutoTask(c) {
    ensureColonistMeta(c);
    if (c.priority === 'defense') {
      const threat = nearestThreat(c);
      if (threat) { assignScare(c, threat); return true; }
      c.note = 'Vigiando a área';
      return false;
    }

    if (c.priority === 'gather') {
      const resource = nearestGatherable(c);
      if (resource) { assignGather(c, resource); return true; }
      c.note = 'Aguardando recurso para coletar';
      return false;
    }

    if (c.priority === 'build') {
      const bp = nearestBlueprint(c);
      if (bp) { assignBuild(c, bp); return true; }
      c.note = 'Aguardando obra';
      return false;
    }

    return false;
  }

  function nearestBlueprint(c) {
    return state.objects
      .filter(o => o.type === 'blueprint')
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
  }

  function nearestBed(c) {
    return state.objects
      .filter(o => o.type === 'bed')
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
  }

  function updateColonist(c, dt) {
    const tick = dt * state.speed;
    c.anim += tick;
    c.hunger = clamp(c.hunger - tick * 0.18, 0, 100);
    c.energy = clamp(c.energy - tick * 0.12, 0, 100);
    c.mood = clamp(c.mood - tick * (c.hunger < 25 || c.energy < 20 ? 0.18 : 0.035), 0, 100);

    if (c.hunger < 18) c.health = clamp(c.health - tick * 0.08, 1, 100);
    if (c.health < 30) c.mood = clamp(c.mood - tick * 0.12, 0, 100);

    if (c.hunger < 32 && state.resources.food > 0 && c.task?.type !== 'sleep') {
      state.resources.food -= 1;
      c.hunger = clamp(c.hunger + 42, 0, 100);
      c.mood = clamp(c.mood + 4, 0, 100);
      log(`${c.name} comeu uma refeição rápida.`);
    }

    if (!c.task) {
      if (c.energy < 18) {
        startSleep(c);
      } else {
        const assigned = assignAutoTask(c);
        if (!assigned && c.priority !== 'defense' && Math.random() < 0.002 * state.speed) randomWander(c);
      }
    }

    if (c.task) {
      if (c.path && c.path.length) moveAlongPath(c, tick);
      else handleTaskAtTarget(c, tick);
    }

    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
  }

  function startSleep(c) {
    const bed = nearestBed(c);
    if (bed) {
      const adj = nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) || { x: bed.x, y: bed.y };
      c.task = { type: 'sleep', x: adj.x, y: adj.y, bedId: bed.id };
      c.path = findPath(c.x, c.y, adj.x, adj.y, bed);
      c.note = 'Indo dormir';
    } else {
      c.task = { type: 'sleep', x: c.x, y: c.y };
      c.path = [];
      c.note = 'Descansando no chão';
    }
  }

  function randomWander(c) {
    const tries = [[1,0],[-1,0],[0,1],[0,-1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of tries) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!isBlocked(nx, ny)) {
        assignMove(c, nx, ny);
        c.note = 'Caminhando';
        break;
      }
    }
  }

  function moveAlongPath(c, tick) {
    const next = c.path[0];
    const tx = next.x * TILE + TILE / 2;
    const ty = next.y * TILE + TILE / 2;
    const dx = tx - c.px;
    const dy = ty - c.py;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 62 * (c.energy < 20 ? 0.65 : 1) * (c.mood < 20 ? 0.75 : 1);
    const step = speed * tick;

    if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) > 1) c.dir = dy > 0 ? 'down' : 'up';

    if (len <= step) {
      c.px = tx; c.py = ty; c.path.shift();
    } else {
      c.px += dx / len * step;
      c.py += dy / len * step;
    }
  }

  function handleTaskAtTarget(c, tick) {
    const task = c.task;
    if (task.type === 'move') {
      c.task = null; c.note = 'Ocioso'; return;
    }

    if (task.type === 'sleep') {
      const hasBed = task.bedId && state.objects.some(o => o.id === task.bedId);
      c.energy = clamp(c.energy + tick * (hasBed ? 2.4 : 1.25), 0, 100);
      c.mood = clamp(c.mood + tick * (hasBed ? 0.35 : 0.08), 0, 100);
      c.note = hasBed ? 'Dormindo na cama' : 'Descansando no chão';
      if (c.energy > 88) { c.task = null; c.note = 'Descansado'; }
      return;
    }

    if (task.type === 'gather') {
      const obj = state.objects.find(o => o.id === task.objId);
      if (!obj) { c.task = null; c.note = 'Ocioso'; return; }
      const def = objectDefs[obj.type];
      c.work += tick * workRate(c, 'gather');
      c.note = `Coletando ${def.name} ${Math.floor((c.work / def.work) * 100)}%`;
      if (c.work >= def.work) {
        addResources(def.gather);
        state.objects = state.objects.filter(o => o.id !== obj.id);
        if (obj.type === 'tree') state.objects.push({ id: uid(), type: 'logs', x: obj.x, y: obj.y });
        if (obj.type === 'crop') state.objects.push({ id: uid(), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
        log(`${c.name} coletou ${def.name}.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
      return;
    }

    if (task.type === 'forge') {
      const forge = state.objects.find(o => o.id === task.objId && o.type === 'forge');
      if (!forge) { c.task = null; c.note = 'Ocioso'; return; }
      const def = objectDefs.forge;
      const input = def.forge.input;
      const output = def.forge.output;
      if (!hasCost(input)) {
        log(`Falta pedra para usar a forja. Precisa de ${input.stone} pedras.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
        return;
      }
      c.work += tick * workRate(c, 'forge');
      c.note = `Forjando metal ${Math.floor((c.work / def.work) * 100)}%`;
      if (c.work >= def.work) {
        payCost(input);
        addResources(output);
        log(`${c.name} transformou ${input.stone} pedras em ${output.metal} metal.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
      return;
    }

    if (task.type === 'research') {
      ensureResearchState();
      const desk = state.objects.find(o => o.id === task.objId && o.type === 'research_desk');
      if (!desk) { c.task = null; c.note = 'Ocioso'; return; }
      const key = state.research.current;
      if (!key) { c.task = null; c.note = 'Todas as pesquisas concluídas'; return; }
      const def = researchDefs[key];
      const weatherPenalty = state.weather === 'chuva' ? 0.9 : 1;
      const gain = tick * 4.5 * weatherPenalty * workRate(c, 'research');
      state.research.progress = clamp((state.research.progress || 0) + gain, 0, def.cost);
      c.note = `Pesquisando ${def.label} ${Math.floor((state.research.progress / def.cost) * 100)}%`;
      if (state.research.progress >= def.cost) {
        unlockResearch(key);
        c.mood = clamp(c.mood + 5, 0, 100);
        c.task = null; c.note = 'Pesquisa concluída'; c.work = 0;
      }
      return;
    }

    if (task.type === 'cook') {
      const stove = state.objects.find(o => o.id === task.objId && o.type === 'stove');
      if (!stove) { c.task = null; c.note = 'Ocioso'; return; }
      const def = objectDefs.stove;
      if (!hasCost(def.cook.input)) {
        log('Falta comida crua ou madeira para preparar refeições no fogão.');
        c.task = null; c.note = 'Ocioso'; c.work = 0;
        return;
      }
      c.work += tick * workRate(c, 'cook');
      c.note = `Preparando refeição ${Math.floor((c.work / def.work) * 100)}%`;
      if (c.work >= def.work) {
        payCost(def.cook.input);
        addResources(def.cook.output);
        c.mood = clamp(c.mood + 4, 0, 100);
        log(`${c.name} preparou refeições no fogão.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
      return;
    }

    if (task.type === 'heal') {
      const station = state.objects.find(o => o.id === task.objId && o.type === 'med_station');
      if (!station) { c.task = null; c.note = 'Ocioso'; return; }
      const def = objectDefs.med_station;
      if (!hasCost(def.heal.input)) {
        log('Falta remédio para usar a estação médica.');
        c.task = null; c.note = 'Ocioso'; c.work = 0;
        return;
      }
      c.work += tick * workRate(c, 'heal');
      c.note = `Tratamento médico ${Math.floor((c.work / def.work) * 100)}%`;
      if (c.work >= def.work) {
        payCost(def.heal.input);
        c.health = clamp(c.health + def.heal.amount, 0, 100);
        c.mood = clamp(c.mood + 3, 0, 100);
        log(`${c.name} recebeu tratamento médico.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
      return;
    }

    if (task.type === 'build') {
      const bp = state.objects.find(o => o.id === task.objId && o.type === 'blueprint');
      if (!bp) { c.task = null; c.note = 'Ocioso'; return; }
      bp.progress = (bp.progress || 0) + tick * workRate(c, 'build');
      const def = buildDefs[bp.buildType];
      c.note = `Construindo ${def.label} ${Math.floor((bp.progress / def.work) * 100)}%`;
      if (bp.progress >= def.work) {
        bp.type = def.type;
        bp.growth = bp.type === 'crop' ? 0 : undefined;
        delete bp.buildType;
        delete bp.progress;
        log(`${c.name} terminou: ${def.label}.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
      return;
    }

    if (task.type === 'scare') {
      const wolf = state.wolves.find(w => w.id === task.wolfId);
      if (!wolf) { c.task = null; c.note = 'Ocioso'; return; }
      c.work += tick * workRate(c, 'defense');
      c.note = `Espantando animal ${Math.floor((c.work / 3) * 100)}%`;
      if (c.work >= 3) {
        state.wolves = state.wolves.filter(w => w.id !== wolf.id);
        c.mood = clamp(c.mood + 8, 0, 100);
        log(`${c.name} espantou um lobo da área.`);
        c.task = null; c.note = 'Ocioso'; c.work = 0;
      }
    }
  }

  function updateWolves(dt) {
    for (const w of state.wolves) {
      const tick = dt * state.speed;
      const nearest = state.colonists
        .slice()
        .sort((a, b) => Math.hypot(a.px - w.px, a.py - w.py) - Math.hypot(b.px - w.px, b.py - w.py))[0];
      if (!nearest) continue;
      const close = Math.hypot(nearest.px - w.px, nearest.py - w.py);
      w.anim += tick;
      if (close < TILE * 4) {
        const dx = nearest.px - w.px;
        const dy = nearest.py - w.py;
        const len = Math.hypot(dx, dy) || 1;
        w.px += dx / len * 35 * tick;
        w.py += dy / len * 35 * tick;
        w.dir = dx > 0 ? 'right' : 'left';
        if (close < 32) {
          nearest.health = clamp(nearest.health - tick * 3.2, 1, 100);
          nearest.mood = clamp(nearest.mood - tick * 1.1, 0, 100);
          nearest.note = 'Em perigo';
        }
      } else if (Math.random() < 0.01 * state.speed) {
        w.target = randomEdgeTile(false);
      }
      if (w.target) {
        const tx = w.target.x * TILE + TILE / 2;
        const ty = w.target.y * TILE + TILE / 2;
        const dx = tx - w.px;
        const dy = ty - w.py;
        const len = Math.hypot(dx, dy) || 1;
        if (len < 4) w.target = null;
        else { w.px += dx / len * 24 * tick; w.py += dy / len * 24 * tick; }
      }
      w.x = Math.round((w.px - TILE / 2) / TILE);
      w.y = Math.round((w.py - TILE / 2) / TILE);
    }
  }

  function randomEdgeTile(forWolf = true) {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: 1, y: 1 + Math.floor(Math.random() * (ROWS - 2)) };
    if (side === 1) return { x: COLS - 2, y: 1 + Math.floor(Math.random() * (ROWS - 2)) };
    if (side === 2) return { x: 1 + Math.floor(Math.random() * (COLS - 2)), y: 1 };
    return { x: 1 + Math.floor(Math.random() * (COLS - 2)), y: ROWS - 2 };
  }

  function updateWorld(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    const tick = dt * state.speed;
    state.hour += tick * 0.085;
    if (state.hour >= 24) {
      state.day += 1;
      state.hour -= 24;
      state.eventDoneToday = false;
      log(`A colônia chegou ao Dia ${state.day}.`);
    }

    if (!state.eventDoneToday && state.hour > 7.5) {
      state.eventDoneToday = true;
      randomEvent();
    }

    const intensityChance = ({ low: 0.0008, normal: 0.0018, high: 0.0035 })[state.config?.eventIntensity || 'normal'] || 0.0018;
    if (Math.random() < intensityChance * state.speed) randomEvent();

    if (state.weatherTime > 0) {
      state.weatherTime -= tick;
      if (state.weatherTime <= 0) {
        state.weather = 'limpo';
        log('O tempo abriu.');
      }
    }

    for (const obj of state.objects) {
      if (obj.type === 'crop') {
        const rainBonus = state.weather === 'chuva' ? 2.1 : 1;
        obj.growth = clamp((obj.growth || 0) + tick * 0.85 * rainBonus, 0, 100);
      }
    }

    for (const c of state.colonists) updateColonist(c, dt);
    updateWolves(dt);
    checkGoals();
  }

  function randomEvent() {
    const options = ['rain', 'supplies', 'wolf', 'berries', 'ore'];
    const event = options[Math.floor(Math.random() * options.length)];
    if (event === 'rain') {
      state.weather = 'chuva';
      state.weatherTime = 45;
      log('Chuva fina: plantações crescem mais rápido hoje.');
    } else if (event === 'supplies') {
      const wood = 4 + Math.floor(Math.random() * 7);
      const food = 2 + Math.floor(Math.random() * 5);
      const medicine = Math.random() < 0.35 ? 1 : 0;
      addResources({ wood, food, medicine });
      log(`Caixas antigas encontradas: +${wood} madeira, +${food} comida${medicine ? ' e +1 remédio' : ''}.`);
    } else if (event === 'wolf') {
      spawnWolf();
      log('Um lobo apareceu perto da colônia. Selecione um colono e clique nele para espantar.');
    } else if (event === 'berries') {
      for (let i = 0; i < 2; i++) {
        const tile = freeRandomTile();
        if (tile) state.objects.push({ id: uid(), type: 'berry', x: tile.x, y: tile.y });
      }
      log('Frutas silvestres brotaram perto da base.');
    } else if (event === 'ore') {
      const tile = freeRandomStoneTile() || freeRandomTile();
      if (tile) {
        state.objects.push({ id: uid(), type: 'ore', x: tile.x, y: tile.y });
        log('Um veio de metal foi encontrado em uma área rochosa.');
      }
    }
  }

  function spawnWolf() {
    const t = randomEdgeTile();
    state.wolves.push({ id: uid(), x: t.x, y: t.y, px: t.x * TILE + TILE / 2, py: t.y * TILE + TILE / 2, anim: 0, dir: 'left' });
  }

  function freeRandomTile() {
    for (let i = 0; i < 100; i++) {
      const x = 2 + Math.floor(Math.random() * (COLS - 4));
      const y = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (!getObjectAt(x, y) && !isBlocked(x, y)) return { x, y };
    }
    return null;
  }

  function freeRandomStoneTile() {
    for (let i = 0; i < 120; i++) {
      const x = 2 + Math.floor(Math.random() * (COLS - 4));
      const y = 2 + Math.floor(Math.random() * (ROWS - 4));
      if (state.terrain[y][x] === 'stone' && !getObjectAt(x, y)) return { x, y };
    }
    return null;
  }

  function checkGoals() {
    ensureResearchState();
    const beds = state.objects.filter(o => o.type === 'bed').length;
    const campfire = state.objects.some(o => o.type === 'campfire');
    const researchDesk = state.objects.some(o => o.type === 'research_desk');
    const allTechs = researchOrder.every(key => !!state.research.unlocked[key]);
    setGoal('beds', beds >= 2);
    setGoal('campfire', campfire);
    setGoal('researchDesk', researchDesk);
    setGoal('techs', allTechs);
    setGoal('food', state.resources.food >= 20);
    setGoal('days', state.day >= 4);
    if (!state.won && beds >= 2 && campfire && researchDesk && allTechs && state.resources.food >= 20 && state.day >= 4) {
      state.won = true;
      setScreen(SCREEN.PAUSED);
      showModal('Base estabilizada!', 'Tu venceu a V1.6: a colônia tem cama, fogo, comida, mesa de pesquisa e tecnologias avançadas desbloqueadas. Dá pra continuar jogando, mas esse é o final do protótipo.', 'Continuar jogando');
      log('Objetivos da V1.6 concluídos.');
    }
  }

  function setGoal(key, done) {
    const el = dom.goalList?.querySelector(`[data-goal="${key}"]`);
    if (el) el.classList.toggle('done', done);
  }

  function resizeGameCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || window.innerWidth));
    const height = Math.max(240, Math.floor(rect.height || window.innerHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const scale = Math.max(width / WORLD_W, height / WORLD_H);
    viewTransform = {
      scale,
      offsetX: (width - WORLD_W * scale) / 2,
      offsetY: (height - WORLD_H * scale) / 2
    };
  }

  function draw() {
    resizeGameCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#070b11';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) drawTile(x, y, state.terrain[y][x]);
    }

    drawGrid();

    const renderList = [];
    for (const obj of state.objects) renderList.push({ kind: 'obj', y: obj.y, data: obj });
    for (const wolf of state.wolves) renderList.push({ kind: 'wolf', y: (wolf.py / TILE), data: wolf });
    for (const c of state.colonists) renderList.push({ kind: 'colonist', y: (c.py / TILE), data: c });
    renderList.sort((a, b) => a.y - b.y);

    for (const item of renderList) {
      if (item.kind === 'obj') drawObject(item.data);
      if (item.kind === 'wolf') drawWolf(item.data);
      if (item.kind === 'colonist') drawColonist(item.data);
    }

    drawNightOverlay();
    drawRain();
    drawBuildPreview();
    ctx.restore();
  }

  function drawTile(x, y, type) {
    const img = images[`tile_${type}`] || images.tile_grass;
    ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE);
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * TILE, 0); ctx.lineTo(x * TILE, ROWS * TILE); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * TILE); ctx.lineTo(COLS * TILE, y * TILE); ctx.stroke();
    }
    ctx.restore();
  }

  function drawObject(obj) {
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2;
    if (obj.type === 'blueprint') {
      const type = buildDefs[obj.buildType].type;
      const img = images[objectDefs[type].img];
      ctx.save();
      ctx.globalAlpha = 0.42;
      drawAsset(img, cx, cy + 22, objectScale(type), 0.5, 1);
      ctx.restore();
      drawProgress(cx, obj.y * TILE + 8, (obj.progress || 0) / buildDefs[obj.buildType].work, '#9bd36a');
      return;
    }

    const def = objectDefs[obj.type];
    if (!def) return;
    drawAsset(images[def.img], cx, cy + 22, objectScale(obj.type), 0.5, 1);
    if (obj.type === 'crop') {
      drawProgress(cx, obj.y * TILE + 7, (obj.growth || 0) / 100, '#80c96c');
    }
  }

  function objectScale(type) {
    return ({
      tree: 0.54, bush: 0.42, rock: 0.38, ore: 0.34, logs: 0.35, berry: 0.42, crop: 0.22,
      bed: 0.28, campfire: 0.30, forge: 0.22, stove: 0.24, med_station: 0.24, research_desk: 0.22, crate: 0.34, wall: 0.29, bench: 0.20,
      stool: 0.45
    })[type] || 0.35;
  }

  function drawAsset(img, x, y, scale = 1, ax = 0.5, ay = 0.5, flip = false) {
    if (!img) return;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.save();
    if (flip) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w * ax, -h * ay, w, h);
    } else {
      ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
    }
    ctx.restore();
  }

  function drawColonist(c) {
    const selected = c.id === selectedColonistId;
    if (selected) {
      ctx.save();
      ctx.fillStyle = 'rgba(155, 211, 106, .28)';
      ctx.strokeStyle = '#9bd36a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(c.px, c.py + 19, 18, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    const moving = c.path && c.path.length;
    const frame = moving ? Math.floor(c.anim * 8) % 4 : 0;
    let dir = c.dir;
    let flip = false;
    if ((c.sprite === 'colonistB' || c.sprite === 'colonistC') && dir === 'left') { dir = 'right'; flip = true; }
    const img = images[`${c.sprite}_${dir}_${frame}`] || images[`${c.sprite}_down_0`];
    drawAsset(img, c.px, c.py + 24, 0.48, 0.5, 1, flip);

    drawTinyBars(c);
    drawName(c.name, c.px, c.py - 38);
  }

  function drawTinyBars(c) {
    const x = c.px - 18;
    const y = c.py - 31;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x, y, 36, 4);
    ctx.fillStyle = c.health < 35 ? '#e67866' : '#9bd36a';
    ctx.fillRect(x, y, 36 * (c.health / 100), 4);
  }

  function drawName(name, x, y) {
    ctx.save();
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    const w = ctx.measureText(name).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundRect(x - w / 2, y - 13, w, 18, 8, true, false);
    ctx.fillStyle = '#f2fff0';
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  function drawWolf(w) {
    ctx.save();
    ctx.fillStyle = 'rgba(230, 120, 102, .22)';
    ctx.strokeStyle = '#e67866';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w.px, w.py + 16, 25, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    const frame = Math.floor(w.anim * 6) % 5;
    drawAsset(images[`wolf_${frame}`], w.px, w.py + 20, 0.36, 0.5, 1, w.dir === 'left');
  }

  function drawProgress(cx, y, value, color) {
    value = clamp(value, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(cx - 18, y, 36, 5);
    ctx.fillStyle = color;
    ctx.fillRect(cx - 18, y, 36 * value, 5);
    ctx.restore();
  }

  function drawNightOverlay() {
    const hour = state.hour;
    let alpha = 0;
    if (hour < 5) alpha = 0.45;
    else if (hour < 7) alpha = (7 - hour) * 0.18;
    else if (hour > 20) alpha = Math.min(0.45, (hour - 20) * 0.13);
    if (alpha > 0) {
      ctx.fillStyle = `rgba(7, 17, 31, ${alpha})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  function drawRain() {
    if (state.weather !== 'chuva') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(170, 210, 255, .45)';
    ctx.lineWidth = 1;
    const offset = (performance.now() / 14) % 18;
    for (let x = -20; x < WORLD_W + 30; x += 38) {
      for (let y = -20; y < WORLD_H + 30; y += 62) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + offset);
        ctx.lineTo(x + offset - 10, y + offset + 18);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBuildPreview() {
    if (!currentBuild || !mouseTile) return;
    const def = buildDefs[currentBuild];
    const type = def.type;
    const can = canPlace(type, mouseTile.x, mouseTile.y) && hasCost(def.cost);
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = can ? 'rgba(155, 211, 106, .22)' : 'rgba(230, 120, 102, .28)';
    ctx.fillRect(mouseTile.x * TILE, mouseTile.y * TILE, TILE, TILE);
    const img = images[objectDefs[type].img];
    drawAsset(img, mouseTile.x * TILE + TILE / 2, mouseTile.y * TILE + TILE, objectScale(type), 0.5, 1);
    ctx.restore();
  }

  let mouseTile = null;
  canvas.addEventListener('mousemove', e => {
    const pos = tileFromEvent(e);
    mouseTile = pos;
  });
  canvas.addEventListener('mouseleave', () => { mouseTile = null; });

  canvas.addEventListener('click', e => {
    if (appScreen !== SCREEN.PLAYING || !state) return;
    const tile = tileFromEvent(e);
    if (!tile || !isInside(tile.x, tile.y)) return;

    const clickedColonist = state.colonists.find(c => Math.abs(c.px - (tile.x * TILE + TILE / 2)) < 24 && Math.abs(c.py - (tile.y * TILE + TILE / 2)) < 34);
    if (clickedColonist) {
      selectedColonistId = clickedColonist.id;
      updateUI(true);
      return;
    }

    if (currentBuild) {
      placeBlueprint(currentBuild, tile.x, tile.y);
      return;
    }

    const c = selectedColonist();
    const wolf = getWolfAt(tile.x, tile.y);
    if (wolf) { assignScare(c, wolf); return; }

    const obj = getObjectAt(tile.x, tile.y);
    if (obj) {
      if (obj.type === 'blueprint') assignBuild(c, obj);
      else if (obj.type === 'forge') assignForge(c, obj);
      else if (obj.type === 'research_desk') assignResearch(c, obj);
      else if (obj.type === 'stove') assignCook(c, obj);
      else if (obj.type === 'med_station') assignHeal(c, obj);
      else if (obj.type === 'crop' && (obj.growth || 0) < 100) log('Essa plantação ainda está crescendo.');
      else if (objectDefs[obj.type]?.gather) assignGather(c, obj);
      else log(`${objectDefs[obj.type]?.name || 'Objeto'} já está construído.`);
      return;
    }

    assignMove(c, tile.x, tile.y);
  });

  function tileFromEvent(e) {
    resizeGameCanvas();
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const worldX = (px - viewTransform.offsetX) / viewTransform.scale;
    const worldY = (py - viewTransform.offsetY) / viewTransform.scale;
    const x = Math.floor(worldX / TILE);
    const y = Math.floor(worldY / TILE);
    return { x, y };
  }

  function canPlace(type, x, y) {
    if (!isInside(x, y) || x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) return false;
    if (getObjectAt(x, y)) return false;
    if (state.colonists.some(c => Math.round(c.x) === x && Math.round(c.y) === y)) return false;
    return state.terrain[y][x] !== 'stone' || type === 'wall';
  }

  function placeBlueprint(buildKey, x, y) {
    const def = buildDefs[buildKey];
    if (!def) return;
    if (!isBuildUnlocked(buildKey)) { log(`Precisa pesquisar ${researchDefs[def.requires]?.label || 'tecnologia'} antes de construir ${def.label}.`); return; }
    if (!canPlace(def.type, x, y)) { log('Não dá para construir nesse lugar.'); return; }
    if (!hasCost(def.cost)) { log('Recursos insuficientes para essa construção.'); return; }
    payCost(def.cost);
    state.objects.push({ id: uid(), type: 'blueprint', buildType: buildKey, x, y, progress: 0 });
    log(`Planta de ${def.label} posicionada.`);
    const c = selectedColonist();
    const bp = getObjectAt(x, y);
    if (c && bp) assignBuild(c, bp);
  }

  function setHudTab(tab) {
    activeHudTab = tab || 'build';
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeHudTab);
    });
    document.querySelectorAll('[data-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.panel === activeHudTab);
    });
  }

  function selectedSummary(c) {
    if (!c) return '<span class="empty">Nenhum colono selecionado.</span>';
    ensureColonistMeta(c);
    const carrying = c.carrying ? escapeHtml(c.carrying.type || c.carrying.name || 'item') : 'nada';
    return `
      <div><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.role)}${c.age ? ` · ${c.age} anos` : ''}</span></div>
      <div class="empty"><b>Estado:</b> ${escapeHtml(c.state || 'idle')} · <b>Tarefa:</b> ${escapeHtml(c.note || 'Ocioso')}</div>
      <div class="empty"><b>Posição:</b> ${Math.round(c.x)}, ${Math.round(c.y)} · <b>Carregando:</b> ${carrying}</div>
      <div class="empty"><b>Prioridade:</b> ${escapeHtml((priorityDefs[c.priority] || priorityDefs[defaultPriorityForRole(c.role)]).label)}</div>
    `;
  }

  function updateUI(force = false) {
    if (!state) return;
    uiTimer += force ? 1 : 0;
    dom.dayLabel.textContent = `Dia ${state.day}`;
    dom.timeLabel.textContent = formatHour(state.hour);
    dom.weatherLabel.textContent = state.weather === 'chuva' ? 'Chuva' : 'Tempo limpo';
    if (dom.speedLabel) dom.speedLabel.textContent = state.paused || appScreen === SCREEN.PAUSED ? 'Pausado' : `${state.speed}x`;
    if (dom.colonyTitle) dom.colonyTitle.textContent = state.config?.colonyName || 'First Haven';
    if (dom.gameConfigLabel) dom.gameConfigLabel.textContent = `Dif.: ${labelDifficulty(state.config?.difficulty || 'normal')} · Mapa: ${labelMapSize(state.config?.mapSize || 'standard')} · Eventos: ${labelEventIntensity(state.config?.eventIntensity || 'normal')} · Seed ${state.config?.seed || 'antiga'}`;
    dom.resFood.textContent = Math.floor(state.resources.food || 0);
    dom.resWood.textContent = Math.floor(state.resources.wood || 0);
    dom.resStone.textContent = Math.floor(state.resources.stone || 0);
    dom.resMetal.textContent = Math.floor(state.resources.metal || 0);
    if (dom.resMedicine) dom.resMedicine.textContent = Math.floor(state.resources.medicine || 0);
    ensureResearchState();
    updateResearchUI();
    updateColonistPanel();

    const c = selectedColonist();
    if (c) {
      ensureColonistMeta(c);
      const priority = priorityDefs[c.priority] || priorityDefs[defaultPriorityForRole(c.role)];
      const traits = [
        ...(c.physicalTraits || []),
        ...(c.positiveTraits || []).map(t => `+ ${t}`),
        ...(c.negativeTraits || []).map(t => `- ${t}`)
      ];
      const skills = c.skills ? `Coleta ${c.skills.coleta}, Construção ${c.skills.construcao}, Defesa ${c.skills.defesa}, Pesquisa ${c.skills.pesquisa}, Medicina ${c.skills.medicina}` : 'habilidades antigas não definidas';
      dom.selectedInfo.innerHTML = `
        <div><b>${escapeHtml(c.name)}</b> <span class="muted">${escapeHtml(c.role)}${c.age ? ` · ${c.age} anos` : ''}</span></div>
        <div class="empty"><b>Bônus:</b> ${roleBonusText(c)}</div>
        <div class="empty"><b>Preferência:</b> ${escapeHtml(c.workPreference || priority.label)}</div>
        <div class="empty"><b>Habilidades:</b> ${escapeHtml(skills)}</div>
        ${traits.length ? `<div class="tags">${traits.map(t => `<span class="tag ${t.startsWith('-') ? 'bad' : t.startsWith('+') ? 'good' : ''}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${statLine('Comida', c.hunger)}
        ${statLine('Sono', c.energy)}
        ${statLine('Humor', c.mood)}
        ${statLine('Saúde', c.health)}
        <div class="priority-box">
          <div><b>Prioridade automática:</b> ${priority.label}</div>
          <div class="priority-buttons">
            ${priorityOrder.map(key => `<button class="mini ${c.priority === key ? 'active' : ''}" data-priority="${key}">${priorityDefs[key].label}</button>`).join('')}
          </div>
          <div class="empty">${priority.note}</div>
        </div>
        <div class="empty"><b>Tarefa:</b> ${escapeHtml(c.note || 'Ocioso')}</div>
      `;
      if (dom.selectedObjectInfo) dom.selectedObjectInfo.innerHTML = selectedSummary(c);
    } else if (dom.selectedObjectInfo) {
      dom.selectedObjectInfo.innerHTML = '<span class="empty">Nenhum colono selecionado.</span>';
    }
    dom.log.innerHTML = state.log.map(line => `<p>${escapeHtml(line)}</p>`).join('');
    dom.buildStatus.textContent = currentBuild ? `Construindo: ${buildDefs[currentBuild].label}. Clique no chão do mapa.` : 'Nenhuma construção selecionada.';
    document.querySelectorAll('[data-build]').forEach(btn => {
      const key = btn.dataset.build;
      const unlocked = isBuildUnlocked(key);
      btn.classList.toggle('active', key === currentBuild);
      btn.classList.toggle('locked', !unlocked);
      btn.disabled = !unlocked;
      if (!unlocked) {
        const req = buildDefs[key].requires;
        btn.title = `Bloqueado: pesquise ${researchDefs[req]?.label || req}.`;
      } else {
        btn.title = '';
      }
    });
  }

  function updateColonistPanel() {
    if (!dom.colonistList || !state?.colonists) return;
    dom.colonistList.innerHTML = state.colonists.map(c => `
      <div class="colonist-row ${c.id === selectedColonistId ? 'active' : ''}" data-select-colonist="${c.id}">
        <img src="assets/sprites/${c.sprite}_down_0.png" alt="">
        <div><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.note || 'Ocioso')}</small></div>
        <span>${Math.floor(c.mood || 0)}%</span>
      </div>
    `).join('');
  }

  function updateResearchUI() {
    const el = document.getElementById('researchInfo');
    if (!el) return;
    const key = state.research.current;
    const unlockedLabels = state.research.completed.map(k => researchDefs[k]?.label).filter(Boolean);
    if (!key) {
      el.innerHTML = `<b>Todas as pesquisas concluídas.</b><br><span class="muted-inline">Liberado: ${unlockedLabels.join(', ') || 'nenhuma'}</span>`;
      return;
    }
    const def = researchDefs[key];
    const pct = Math.floor(((state.research.progress || 0) / def.cost) * 100);
    const unlocks = def.unlocks.map(k => buildDefs[k]?.label || k).join(', ');
    el.innerHTML = `
      <div><b>Pesquisa atual:</b> ${def.label}</div>
      <div class="statline compact">
        <label><span>Progresso</span><span>${pct}%</span></label>
        <div class="bar"><span style="width:${clamp(pct,0,100)}%"></span></div>
      </div>
      <div class="empty">Desbloqueia: ${unlocks}</div>
      <div class="empty">Construa uma Mesa de Pesquisa e clique nela com um colono selecionado.</div>
      <div class="empty"><b>Liberadas:</b> ${unlockedLabels.join(', ') || 'nenhuma ainda'}</div>
    `;
  }

  function statLine(label, value) {
    const cls = value < 25 ? 'danger' : value < 45 ? 'warn' : '';
    return `
      <div class="statline">
        <label><span>${label}</span><span>${Math.floor(value)}%</span></label>
        <div class="bar ${cls}"><span style="width:${clamp(value,0,100)}%"></span></div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>'"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[s]));
  }

  function serialize() {
    return JSON.stringify({ state, selectedColonistId, version: '1.4.0' });
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
    state.config = { ...defaultNewGameConfig, colonyName: 'Colônia antiga', seed: 'save-antigo', ...(state.config || {}) };
    state.worldMeta = state.worldMeta || { seed: state.config.seed, mapSize: state.config.mapSize, difficulty: state.config.difficulty };
    ensureResearchState();
    for (const c of state.colonists || []) ensureColonistMeta(c);
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
      log('Save carregado.');
      updateUI(true);
      return true;
    } catch (err) {
      console.error(err);
      if (state) log('Falha ao carregar o save.');
      return false;
    }
  }

  function newGame() {
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    newGameConfig = readNewGameConfig();
    generateColonistCandidates(newGameConfig);
    setScreen(SCREEN.COLONIST_SELECT);
  }

  function showModal(title, text, button) {
    dom.modal.querySelector('h1').textContent = title;
    dom.modal.querySelector('p').innerHTML = text;
    dom.modal.querySelector('button').textContent = button;
    dom.modal.classList.add('show');
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function gameLoop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    updateWorld(dt);
    if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) draw();
    uiTimer += dt;
    autosaveTimer += dt;
    if (state && uiTimer > 0.25) { uiTimer = 0; updateUI(); }
    if (state && settings.autosave !== 'off' && appScreen === SCREEN.PLAYING && autosaveTimer > 15) { autosaveTimer = 0; saveGame(false); }
    requestAnimationFrame(gameLoop);
  }

  function setupEventListeners() {
    document.getElementById('continueBtn').addEventListener('click', continueFromMenu);
    document.getElementById('newGameBtn').addEventListener('click', () => {
      writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
      setScreen(SCREEN.NEW_GAME_SETUP);
    });
    document.getElementById('openLoadBtn').addEventListener('click', () => setScreen(SCREEN.LOAD_GAME));
    document.getElementById('openSettingsBtn').addEventListener('click', () => setScreen(SCREEN.SETTINGS));
    document.getElementById('exitBtn').addEventListener('click', () => refreshMenuSaveInfo());
    document.getElementById('setupBackBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
    document.getElementById('setupNextBtn').addEventListener('click', () => {
      newGameConfig = readNewGameConfig();
      generateColonistCandidates(newGameConfig);
      setScreen(SCREEN.COLONIST_SELECT);
    });
    document.getElementById('randomSeedBtn').addEventListener('click', () => {
      document.getElementById('worldSeedInput').value = generateRandomSeed();
      updateSetupSummary();
    });
    ['colonyNameInput','worldSeedInput','difficultySelect','colonistCountSelect','resourcesPresetSelect','eventIntensitySelect','mapSizeSelect'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateSetupSummary);
      document.getElementById(id).addEventListener('change', updateSetupSummary);
    });
    document.getElementById('colonistBackBtn').addEventListener('click', () => setScreen(SCREEN.NEW_GAME_SETUP));
    document.getElementById('rerollAllBtn').addEventListener('click', () => {
      colonistCandidates = colonistCandidates.map((c, i) => c.locked ? c : createColonistCandidate(i, newGameConfig, `${newGameConfig.seed}-reroll-all-${Date.now()}-${i}-${Math.random()}`));
      renderColonistSelection();
    });
    document.getElementById('startSelectedGameBtn').addEventListener('click', () => {
      if (!newGameConfig) newGameConfig = readNewGameConfig();
      startNewGame(newGameConfig, colonistCandidates);
    });
    document.getElementById('loadBackBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
    document.getElementById('loadSlotBtn').addEventListener('click', loadAndPlay);
    document.getElementById('deleteSaveBtn').addEventListener('click', () => {
      if (confirm('Apagar o save local?')) {
        localStorage.removeItem(SAVE_KEY);
        activeSession = false;
        refreshMenuSaveInfo();
        refreshLoadScreen();
      }
    });
    document.getElementById('settingsBackBtn').addEventListener('click', goBackFromSettings);
    document.getElementById('uiScaleSelect').value = settings.uiScale || 'normal';
    document.getElementById('autosaveSelect').value = settings.autosave || 'on';
    document.getElementById('uiScaleSelect').addEventListener('change', e => { settings.uiScale = e.target.value; saveSettings(); });
    document.getElementById('autosaveSelect').addEventListener('change', e => { settings.autosave = e.target.value; saveSettings(); });

    document.addEventListener('click', e => {
      const reroll = e.target.closest('[data-reroll-colonist]');
      if (reroll) { rerollColonist(Number(reroll.dataset.rerollColonist)); return; }
      const lock = e.target.closest('[data-lock-colonist]');
      if (lock) {
        const idx = Number(lock.dataset.lockColonist);
        if (colonistCandidates[idx]) colonistCandidates[idx].locked = !colonistCandidates[idx].locked;
        renderColonistSelection();
        return;
      }
      const select = e.target.closest('[data-select-colonist]');
      if (select && state) {
        selectedColonistId = Number(select.dataset.selectColonist);
        updateUI(true);
        return;
      }
      const btn = e.target.closest('[data-priority]');
      if (btn && state) {
        const c = selectedColonist();
        if (!c) return;
        const key = btn.dataset.priority;
        if (!priorityDefs[key]) return;
        c.priority = key;
        c.note = c.task ? c.note : `Prioridade: ${priorityDefs[key].label}`;
        log(`${c.name} agora prioriza ${priorityDefs[key].label.toLowerCase()}.`);
        updateUI(true);
      }
    });

    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => setHudTab(btn.dataset.tab));
    });
    setHudTab(activeHudTab);

    document.querySelectorAll('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state) return;
        if (!isBuildUnlocked(btn.dataset.build)) {
          const req = buildDefs[btn.dataset.build]?.requires;
          log(`Bloqueado: pesquise ${researchDefs[req]?.label || 'tecnologia'} primeiro.`);
          updateUI(true);
          return;
        }
        currentBuild = btn.dataset.build;
        setHudTab('build');
        updateUI(true);
      });
    });
    document.querySelectorAll('[data-speed]').forEach(btn => btn.addEventListener('click', () => {
      if (!state) return;
      state.speed = Number(btn.dataset.speed);
      setScreen(SCREEN.PLAYING);
    }));
    document.getElementById('cancelBuild').addEventListener('click', () => { currentBuild = null; updateUI(true); });
    document.getElementById('pauseBtn').addEventListener('click', () => setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING));
    document.getElementById('menuPauseBtn').addEventListener('click', () => setScreen(SCREEN.PAUSED));
    document.getElementById('resumeBtn').addEventListener('click', () => setScreen(SCREEN.PLAYING));
    document.getElementById('pauseSaveBtn').addEventListener('click', () => { saveGame(true); updateUI(true); });
    document.getElementById('pauseLoadBtn').addEventListener('click', loadAndPlay);
    document.getElementById('pauseSettingsBtn').addEventListener('click', () => setScreen(SCREEN.SETTINGS));
    document.getElementById('pauseMainMenuBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
    document.getElementById('startBtn').addEventListener('click', () => { dom.modal.classList.remove('show'); setScreen(SCREEN.PLAYING); });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) {
        e.preventDefault();
        setScreen(appScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.PLAYING);
      }
      if (e.key === 'Escape') {
        if (appScreen === SCREEN.PLAYING) setScreen(SCREEN.PAUSED);
        else if (appScreen === SCREEN.PAUSED) setScreen(SCREEN.PLAYING);
        else if (appScreen !== SCREEN.MAIN_MENU) setScreen(SCREEN.MAIN_MENU);
        currentBuild = null;
      }
      if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED) && ['1','2','3'].includes(e.key)) { state.speed = Number(e.key); setScreen(SCREEN.PLAYING); }
    });
  }

  loadImages().then(() => {
    setupEventListeners();
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    state = createInitialState({ ...defaultNewGameConfig, colonyName: 'First Haven', seed: 'preview-menu' });
    activeSession = false;
    ensureResearchState();
    refreshMenuSaveInfo();
    refreshLoadScreen();
    updateUI(true);
    setScreen(SCREEN.MAIN_MENU);
    resizeGameCanvas();
    window.addEventListener('resize', resizeGameCanvas);
    requestAnimationFrame(gameLoop);
  }).catch(err => {
    console.error(err);
    alert('Falha ao carregar assets do jogo. Veja o console.');
  });
})();
