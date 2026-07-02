'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 48;

const MAP_SIZES = Object.freeze({
  large: { label: 'grande', cols: 96, rows: 70, resourceMultiplier: 1.35, poiCount: 9, chunkSize: 32, macroBiomeChunks: 2 },
  huge: { label: 'enorme', cols: 132, rows: 96, resourceMultiplier: 1.9, poiCount: 14, chunkSize: 32, macroBiomeChunks: 3 },
  giant: { label: 'gigante', cols: 172, rows: 124, resourceMultiplier: 2.35, poiCount: 20, biomeIntent: 'multi', chunkSize: 32, macroBiomeChunks: 3 },
  infinite_chunks: { label: 'fronteira continental', cols: 220, rows: 156, resourceMultiplier: 1.85, poiCount: 24, chunkMode: true, fixedFrontier: true, biomeIntent: 'multi', chunkSize: 32, macroBiomeChunks: 4 },
  standard: { label: 'padrão', cols: 64, rows: 46, resourceMultiplier: 1.0, poiCount: 5, chunkSize: 32, macroBiomeChunks: 2 }
});

let viewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const camera = { x: 0, y: 0, speed: 720, zoom: 1.12, minZoom: 0.72, maxZoom: 2.6, zoomStep: 0.1 };
const cameraInput = new Set();

function getWorldCols() { return state?.world?.cols || state?.terrain?.[0]?.length || MAP_SIZES.standard.cols; }
function getWorldRows() { return state?.world?.rows || state?.terrain?.length || MAP_SIZES.standard.rows; }
function getTileSize() { return state?.world?.tileSize || TILE; }
function getWorldWidth() { return getWorldCols() * getTileSize(); }
function getWorldHeight() { return getWorldRows() * getTileSize(); }
function getMapSizeDef(size) { return MAP_SIZES[size] || MAP_SIZES.giant || MAP_SIZES.standard; }

const SAVE_KEY = 'havenfall-v1-save';
const SETTINGS_KEY = 'havenfall-v1-settings';
const SCREEN = Object.freeze({
  MAIN_MENU: 'MAIN_MENU',
  MULTIPLAYER: 'MULTIPLAYER',
  NEW_GAME_SETUP: 'NEW_GAME_SETUP',
  PLANET_SCAN: 'PLANET_SCAN',
  COLONIST_SELECT: 'COLONIST_SELECT',
  LOAD_GAME: 'LOAD_GAME',
  SETTINGS: 'SETTINGS',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED'
});

const assetNames = [
  'tile_grass','tile_dirt','tile_sand','tile_stone',
  'tree','tree_oak','tree_birch','tree_pine','tree_palm','tree_willow','tree_eucalyptus',
  'bush','bush_dense','bush_dry','berry','rock','logs',
  'bed_single','table_wood','crate_wood','stool','wall_stone','door_wood','campfire','chest_large',
  'icon_food','icon_wood','icon_stone','icon_metal','icon_warn',
  'weapon_axe','tool_pickaxe','tool_mattock','tool_shovel','tool_hammer','tool_sledgehammer','tool_chisel','tool_sickle','tool_wrench','tool_pliers',
  'weapon_knife','weapon_machete','weapon_sword','weapon_spear','weapon_bow','weapon_arrows','weapon_club','weapon_shield','weapon_torch','toolkit',
  'res_rope','res_nails','res_leather','res_cloth','res_stew','res_raw_meat','res_berries','res_herbs','res_scrap'
];

const images = {};
const dom = {
  screens: {
    main: document.getElementById('mainMenuScreen'),
    multiplayer: document.getElementById('multiplayerScreen'),
    setup: document.getElementById('newGameSetupScreen'),
    scan: document.getElementById('planetScanScreen'),
    colonists: document.getElementById('colonistSelectScreen'),
    load: document.getElementById('loadGameScreen'),
    settings: document.getElementById('settingsScreen'),
    game: document.getElementById('gameScreen')
  },
  buttons: {
    newGame: document.getElementById('newGameBtn'),
    continue: document.getElementById('continueBtn'),
    openMultiplayer: document.getElementById('openMultiplayerBtn'),
    openLoad: document.getElementById('openLoadBtn'),
    openSettings: document.getElementById('openSettingsBtn'),
    exit: document.getElementById('exitBtn'),
    multiplayerBack: document.getElementById('multiplayerBackBtn'),
    multiplayerHostNewGame: document.getElementById('multiplayerHostNewGameBtn'),
    multiplayerHost: document.getElementById('multiplayerHostBtn'),
    multiplayerJoin: document.getElementById('multiplayerJoinBtn'),
    multiplayerStop: document.getElementById('multiplayerStopBtn'),
    setupBack: document.getElementById('setupBackBtn'),
    setupNext: document.getElementById('setupNextBtn'),
    scanBack: document.getElementById('scanBackBtn'),
    scanProceed: document.getElementById('scanProceedBtn'),
    scanRefresh: document.getElementById('scanRefreshBtn'),
    randomSeed: document.getElementById('randomSeedBtn'),
    colonistBack: document.getElementById('colonistBackBtn'),
    rerollAll: document.getElementById('rerollAllBtn'),
    startSelectedGame: document.getElementById('startSelectedGameBtn'),
    loadBack: document.getElementById('loadBackBtn'),
    loadSlot: document.getElementById('loadSlotBtn'),
    deleteSave: document.getElementById('deleteSaveBtn'),
    settingsBack: document.getElementById('settingsBackBtn'),
    cancelBuild: document.getElementById('cancelBuild'),
    pause: document.getElementById('pauseBtn'),
    pauseMenu: document.getElementById('menuPauseBtn'),
    resume: document.getElementById('resumeBtn'),
    pauseSave: document.getElementById('pauseSaveBtn'),
    pauseLoad: document.getElementById('pauseLoadBtn'),
    pauseSettings: document.getElementById('pauseSettingsBtn'),
    pauseMainMenu: document.getElementById('pauseMainMenuBtn'),
    modalStart: document.getElementById('startBtn')
  },
  inputs: {
    colonyName: document.getElementById('colonyNameInput'),
    worldSeed: document.getElementById('worldSeedInput'),
    difficulty: document.getElementById('difficultySelect'),
    colonistCount: document.getElementById('colonist-count') || document.getElementById('colonistCountSelect'),
    resourcesPreset: document.getElementById('resourcesPresetSelect'),
    eventIntensity: document.getElementById('eventIntensitySelect'),
    mapSize: document.getElementById('mapSizeSelect'),
    multiplayerNick: document.getElementById('multiplayerNickInput'),
    multiplayerServer: document.getElementById('multiplayerServerInput'),
    uiScale: document.getElementById('uiScaleSelect'),
    autosave: document.getElementById('autosaveSelect')
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
  resWater: document.getElementById('resWater'),
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
let settings = null;
let activeSession = false;
let activeHudTab = 'build';
let showDebugGrid = false;
let contextMenuState = null;
let selectedWorldObjectId = null;
let selectedCraftStationId = null;
let gatherSelection = null;
let suppressNextClick = false;
let wallIndex = new Map();
let solidWallIndex = new Map();
let doorIndex = new Map();
let wallIndexDirty = true;
let lastWallObjectCount = -1;
let roofSet = new Set();
