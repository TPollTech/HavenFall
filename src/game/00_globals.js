'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 48;

// Fallbacks legados. A partir da V1.8 o tamanho real do mundo vem de state.world.
const COLS = 22;
const ROWS = 14;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

const MAP_SIZES = Object.freeze({
  small: { label: 'pequeno', cols: 42, rows: 30, resourceMultiplier: 0.75, poiCount: 3 },
  standard: { label: 'padrão', cols: 64, rows: 46, resourceMultiplier: 1.0, poiCount: 5 },
  large: { label: 'grande', cols: 88, rows: 64, resourceMultiplier: 1.35, poiCount: 8 },
  huge: { label: 'enorme', cols: 118, rows: 84, resourceMultiplier: 1.85, poiCount: 12 },
  frontier: { label: 'fronteira vasta', cols: 150, rows: 104, resourceMultiplier: 2.4, poiCount: 18 }
});

let viewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const camera = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  speed: 720,
  zoom: 1.12,
  minZoom: 0.72,
  maxZoom: 2.6,
  zoomStep: 0.1
};
const cameraInput = new Set();

function getWorldCols() { return state?.world?.cols || state?.terrain?.[0]?.length || COLS; }
function getWorldRows() { return state?.world?.rows || state?.terrain?.length || ROWS; }
function getTileSize() { return state?.world?.tileSize || TILE; }
function getWorldWidth() { return getWorldCols() * getTileSize(); }
function getWorldHeight() { return getWorldRows() * getTileSize(); }
function getMapSizeDef(size) { return MAP_SIZES[size] || MAP_SIZES.standard; }

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
  ruin: { name: 'ruína antiga', img: 'wall_stone', blocks: true, interactable: true, unknown: true, work: 3.8 },
  cache: { name: 'baú abandonado', img: 'chest_large', blocks: true, interactable: true, unknown: true, work: 2.6 },
  supply_crate: { name: 'caixa de suprimentos', img: 'crate_wood', blocks: true, interactable: true, unknown: true, work: 2.2 },
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
let settings = null;
let activeSession = false;
let activeHudTab = 'build';
let showDebugGrid = false;
let contextMenuState = null;
let selectedWorldObjectId = null;

const defaultNewGameConfig = {
  colonyName: 'First Haven',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'standard'
};
