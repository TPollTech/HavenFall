'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const TILE = 48;

const MAP_SIZES = Object.freeze({
  small: { label: 'pequeno', cols: 42, rows: 30, resourceMultiplier: 0.75, poiCount: 3 },
  standard: { label: 'padrão', cols: 64, rows: 46, resourceMultiplier: 1.0, poiCount: 5 },
  large: { label: 'grande', cols: 88, rows: 64, resourceMultiplier: 1.35, poiCount: 8 },
  huge: { label: 'enorme', cols: 118, rows: 84, resourceMultiplier: 1.85, poiCount: 12 },
  frontier: { label: 'fronteira vasta', cols: 150, rows: 104, resourceMultiplier: 2.4, poiCount: 18 }
});

let viewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const camera = {
  x: 0,
  y: 0,
  speed: 720,
  zoom: 1.12,
  minZoom: 0.72,
  maxZoom: 2.6,
  zoomStep: 0.1
};
const cameraInput = new Set();

function getWorldCols() { return state?.world?.cols || state?.terrain?.[0]?.length || MAP_SIZES.standard.cols; }
function getWorldRows() { return state?.world?.rows || state?.terrain?.length || MAP_SIZES.standard.rows; }
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
  'weapon_axe','tool_pickaxe','tool_mattock','tool_shovel','tool_hammer','tool_sledgehammer','tool_chisel','tool_sickle','tool_wrench','tool_pliers',
  'weapon_knife','weapon_machete','weapon_sword','weapon_spear','weapon_bow','weapon_arrows','weapon_club','weapon_shield','weapon_torch','toolkit',
  'res_rope','res_nails','res_leather','res_cloth','res_stew','res_raw_meat','res_berries','res_herbs','res_scrap',

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
  bench: { name: 'bancada', img: 'crafting_bench', blocks: true, craft: 1 },
  door: { name: 'porta', img: 'door_wood', blocks: false, door: true, roofBoundary: true }
};

const buildDefs = {
  bed: { label: 'Cama', type: 'bed', cost: { wood: 12 }, work: 5 },
  campfire: { label: 'Fogueira', type: 'campfire', cost: { wood: 6, stone: 2 }, work: 4 },
  crate: { label: 'Depósito', type: 'crate', cost: { wood: 10 }, work: 4 },
  wall: { label: 'Parede', type: 'wall', cost: { wood: 4 }, work: 3 },
  door: { label: 'Porta', type: 'door', cost: { wood: 6 }, work: 4 },
  crop: { label: 'Plantação', type: 'crop', cost: { food: 2 }, work: 3 },
  bench: { label: 'Bancada', type: 'bench', cost: { wood: 18, stone: 8 }, work: 7 },
  research_desk: { label: 'Mesa de Pesquisa', type: 'research_desk', cost: { wood: 20, stone: 6 }, work: 7 },
  forge: { label: 'Forja', type: 'forge', cost: { wood: 14, stone: 12 }, work: 8, requires: 'metalworking' },
  stove: { label: 'Fogão', type: 'stove', cost: { wood: 12, stone: 10, metal: 2 }, work: 7, requires: 'cooking' },
  med_station: { label: 'Estação Médica', type: 'med_station', cost: { wood: 10, stone: 4, metal: 4 }, work: 8, requires: 'medicine' }
};


const itemDefs = {
  rope: { label: 'Corda', icon: 'res_rope', kind: 'material', note: 'Material encontrado ou saqueado.' },
  nails: { label: 'Pregos', icon: 'res_nails', kind: 'material', note: 'Material para crafting avançado.' },
  cloth: { label: 'Tecido', icon: 'res_cloth', kind: 'material', note: 'Material para itens médicos.' },
  leather: { label: 'Couro', icon: 'res_leather', kind: 'material', note: 'Material resistente.' },
  stoneAxe: { label: 'Machado de pedra', icon: 'weapon_axe', slot: 'tool', kind: 'tool', gatherBonus: { wood: 0.35 }, combat: 1.5, note: 'Corta madeira melhor e ajuda em defesa.' },
  pickaxe: { label: 'Picareta', icon: 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.35, metal: 0.35 }, combat: 1.2, note: 'Minera pedra e metal mais rápido.' },
  hammer: { label: 'Martelo', icon: 'tool_hammer', slot: 'tool', kind: 'tool', buildBonus: 0.28, combat: 1.1, note: 'Acelera construção.' },
  toolkit: { label: 'Kit de ferramentas', icon: 'toolkit', slot: 'tool', kind: 'tool', buildBonus: 0.45, craftBonus: 0.25, combat: 1.0, note: 'Ferramenta avançada para construir e fabricar.' },
  knife: { label: 'Faca simples', icon: 'weapon_knife', slot: 'weapon', kind: 'weapon', combat: 2.1, note: 'Defesa básica, melhor que lutar desarmado.' },
  spear: { label: 'Lança improvisada', icon: 'weapon_spear', slot: 'weapon', kind: 'weapon', combat: 3.0, range: 1, note: 'Boa contra animais.' },
  bow: { label: 'Arco simples', icon: 'weapon_bow', slot: 'weapon', kind: 'weapon', combat: 2.7, needsAmmo: 'arrows', note: 'Permite atacar com distância se houver flechas.' },
  club: { label: 'Porrete', icon: 'weapon_club', slot: 'weapon', kind: 'weapon', combat: 1.8, note: 'Arma simples e pesada.' },
  shield: { label: 'Escudo improvisado', icon: 'weapon_shield', slot: 'offhand', kind: 'shield', defense: 0.35, note: 'Reduz risco em combate.' },
  torch: { label: 'Tocha', icon: 'weapon_torch', slot: 'offhand', kind: 'utility', defense: 0.18, scare: 0.35, note: 'Ajuda a afastar animais e ilumina à noite.' },
  arrows: { label: 'Flechas', icon: 'weapon_arrows', kind: 'ammo', note: 'Munição para arco.' },
  bandage: { label: 'Curativo', icon: 'res_cloth', kind: 'medical', note: 'Pode ser usado em futuras ações médicas.' },
  simpleMeal: { label: 'Refeição cozida', icon: 'res_stew', kind: 'food', note: 'Comida preparada no fogão.' }
};

const recipeDefs = {
  stoneAxe: { label: 'Machado de pedra', station: 'bench', cost: { wood: 3, stone: 2 }, duration: 5, output: { items: { stoneAxe: 1 } }, unlock: null, desc: 'Ferramenta inicial para madeira e defesa.' },
  pickaxe: { label: 'Picareta', station: 'bench', cost: { wood: 3, stone: 4 }, duration: 6, output: { items: { pickaxe: 1 } }, unlock: null, desc: 'Aumenta coleta de pedra e metal.' },
  hammer: { label: 'Martelo', station: 'bench', cost: { wood: 2, stone: 3 }, duration: 5, output: { items: { hammer: 1 } }, unlock: null, desc: 'Acelera construção.' },
  club: { label: 'Porrete', station: 'bench', cost: { wood: 4 }, duration: 4, output: { items: { club: 1 } }, unlock: null, desc: 'Defesa básica barata.' },
  spear: { label: 'Lança improvisada', station: 'bench', cost: { wood: 4, stone: 2 }, duration: 6, output: { items: { spear: 1 } }, unlock: null, desc: 'Boa contra lobos.' },
  bow: { label: 'Arco simples', station: 'bench', cost: { wood: 5 }, itemCost: { rope: 1 }, duration: 7, output: { items: { bow: 1 } }, unlock: null, desc: 'Arma de distância; usa flechas.' },
  arrows: { label: 'Flechas x6', station: 'bench', cost: { wood: 2, stone: 1 }, duration: 4, output: { items: { arrows: 6 } }, unlock: null, desc: 'Munição para arco.' },
  torch: { label: 'Tocha', station: 'bench', cost: { wood: 2 }, duration: 3, output: { items: { torch: 1 } }, unlock: null, desc: 'Ajuda contra animais à noite.' },
  knife: { label: 'Faca simples', station: 'forge', cost: { metal: 3, wood: 1 }, duration: 7, output: { items: { knife: 1 } }, unlock: 'metalworking', desc: 'Arma curta de metal.' },
  toolkit: { label: 'Kit de ferramentas', station: 'forge', cost: { metal: 5, wood: 2 }, itemCost: { nails: 2 }, duration: 9, output: { items: { toolkit: 1 } }, unlock: 'metalworking', desc: 'Ferramenta avançada.' },
  shield: { label: 'Escudo improvisado', station: 'forge', cost: { wood: 4, metal: 2 }, duration: 8, output: { items: { shield: 1 } }, unlock: 'metalworking', desc: 'Reduz risco em combate.' },
  simpleMeal: { label: 'Refeição cozida x3', station: 'stove', cost: { food: 2, wood: 1 }, duration: 4, output: { resources: { food: 4 }, items: { simpleMeal: 1 } }, unlock: 'cooking', desc: 'Cozinha comida e melhora o estoque.' },
  bandage: { label: 'Curativo x2', station: 'med_station', cost: { medicine: 1 }, itemCost: { cloth: 1 }, duration: 5, output: { items: { bandage: 2 } }, unlock: 'medicine', desc: 'Item médico básico.' }
};

const stationLabels = {
  bench: 'Bancada',
  forge: 'Forja',
  stove: 'Fogão',
  med_station: 'Estação Médica',
  research_desk: 'Mesa de Pesquisa'
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
let selectedCraftStationId = null;
let gatherSelection = null;
let suppressNextClick = false;
let wallIndex = new Map();
let solidWallIndex = new Map();
let doorIndex = new Map();
let wallIndexDirty = true;
let lastWallObjectCount = -1;
let roofSet = new Set();
let roofArrayRef = null;
let roofTick = 0;
let lastSpriteCleanupAt = 0;
const transparentSpriteUrl = new Map();

const defaultNewGameConfig = {
  colonyName: 'First Haven',
  seed: '',
  difficulty: 'normal',
  colonistCount: 3,
  resourcesPreset: 'standard',
  eventIntensity: 'normal',
  mapSize: 'standard'
};
