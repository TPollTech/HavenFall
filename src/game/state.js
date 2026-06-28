'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 48;

const MAP_SIZES = Object.freeze({
  large: { label: 'grande', cols: 96, rows: 70, resourceMultiplier: 1.35, poiCount: 9 },
  huge: { label: 'enorme', cols: 132, rows: 96, resourceMultiplier: 1.9, poiCount: 14 },
  giant: { label: 'gigante', cols: 172, rows: 124, resourceMultiplier: 2.55, poiCount: 22, biomeIntent: 'multi' },
  infinite_chunks: { label: 'infinito por chunks', cols: 220, rows: 156, resourceMultiplier: 3.1, poiCount: 30, chunkMode: true, biomeIntent: 'multi' },
  standard: { label: 'padrÃ£o', cols: 64, rows: 46, resourceMultiplier: 1.0, poiCount: 5 }
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
  NEW_GAME_SETUP: 'NEW_GAME_SETUP',
  PLANET_SCAN: 'PLANET_SCAN',
  COLONIST_SELECT: 'COLONIST_SELECT',
  LOAD_GAME: 'LOAD_GAME',
  SETTINGS: 'SETTINGS',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED'
});

const assetNames = [
  'tile_grass','tile_dirt','tile_sand','tile_stone','tree','bush','rock','logs','berry','crop_patch',
  'bed_single','table_wood','crate_wood','stool','wall_stone','door_wood','campfire','chest_large',
  'crafting_bench','research_desk','stove','med_station','wolf_0','wolf_1','wolf_2','wolf_3','wolf_4',
  'icon_food','icon_wood','icon_stone','icon_metal','icon_warn',
  'weapon_axe','tool_pickaxe','tool_mattock','tool_shovel','tool_hammer','tool_sledgehammer','tool_chisel','tool_sickle','tool_wrench','tool_pliers',
  'weapon_knife','weapon_machete','weapon_sword','weapon_spear','weapon_bow','weapon_arrows','weapon_club','weapon_shield','weapon_torch','toolkit',
  'res_rope','res_nails','res_leather','res_cloth','res_stew','res_raw_meat','res_berries','res_herbs','res_scrap',
  'colonistA_down_0','colonistA_down_1','colonistA_down_2','colonistA_down_3','colonistA_up_0','colonistA_up_1','colonistA_up_2','colonistA_up_3','colonistA_left_0','colonistA_left_1','colonistA_left_2','colonistA_left_3','colonistA_right_0','colonistA_right_1','colonistA_right_2','colonistA_right_3',
  'colonistB_down_0','colonistB_down_1','colonistB_down_2','colonistB_down_3','colonistB_up_0','colonistB_up_1','colonistB_up_2','colonistB_up_3','colonistB_right_0','colonistB_right_1','colonistB_right_2','colonistB_right_3',
  'colonistC_down_0','colonistC_down_1','colonistC_down_2','colonistC_down_3','colonistC_up_0','colonistC_up_1','colonistC_up_2','colonistC_up_3','colonistC_right_0','colonistC_right_1','colonistC_right_2','colonistC_right_3'
];

const images = {};
const dom = {
  screens: {
    main: document.getElementById('mainMenuScreen'),
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
    openLoad: document.getElementById('openLoadBtn'),
    openSettings: document.getElementById('openSettingsBtn'),
    exit: document.getElementById('exitBtn'),
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