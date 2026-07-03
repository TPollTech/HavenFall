import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function runBrowserScript(path, context) {
  const code = readFileSync(path, 'utf8');
  vm.runInContext(code, context, { filename: path });
}

function createContext(extra = {}) {
  const context = vm.createContext({ console, ...extra });
  context.window = context;
  return context;
}

async function drainTimers(timers) {
  for (let round = 0; round < 8; round++) {
    let ran = false;
    for (let i = 0; i < timers.length; i++) {
      const fn = timers[i];
      if (!fn) continue;
      timers[i] = null;
      fn();
      ran = true;
    }
    await Promise.resolve();
    if (!ran && !timers.some(Boolean)) return;
  }
}

function createCanvasStub() {
  return {
    width: 1280,
    height: 720,
    addEventListener() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1280, height: 720 };
    }
  };
}

function createDrawSpy() {
  const counts = { fillRect: 0, stroke: 0, fill: 0 };
  return {
    counts,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    ellipse() {},
    fillRect() { counts.fillRect++; },
    fill() { counts.fill++; },
    stroke() { counts.stroke++; },
    save() {},
    restore() {}
  };
}

test('Primary click and context menu expose vein mining actions', () => {
  const calls = [];
  const context = createContext({
    canvas: createCanvasStub(),
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    TILE: 48,
    state: {
      world: { cols: 32, rows: 32, pointsOfInterest: [] },
      colonists: [],
      terrain: Array.from({ length: 32 }, () => Array(32).fill('grass'))
    },
    selectedWorldObjectId: null,
    viewTransform: { offsetX: 0, offsetY: 0, scale: 1 },
    buildDefs: {},
    objectDefs: {
      ironVein: { name: 'veio de ferro', img: 'mining_vein_iron' }
    },
    stationLabels: {},
    itemDefs: {},
    document: {
      getElementById() { return null; },
      createElement() {
        return {
          id: '',
          className: '',
          style: {},
          dataset: {},
          innerHTML: '',
          setAttribute() {},
          appendChild() {},
          addEventListener() {},
          classList: { add() {}, remove() {} },
          getBoundingClientRect() { return { width: 240, height: 120 }; }
        };
      },
      body: { appendChild() {} }
    },
    isInside(x, y) {
      return x >= 0 && y >= 0 && x < 32 && y < 32;
    },
    isTileVisible() {
      return true;
    },
    isTileDiscovered() {
      return true;
    },
    getObjectAt() {
      return null;
    },
    getRockAt() {
      return null;
    },
    assignVeinMine(colonist, obj) {
      calls.push({ colonist, obj });
      return true;
    },
    purityText() {
      return 'Normal';
    },
    log() {}
  });

  runBrowserScript('src/game/input/canvas-input-building.js', context);

  const colonist = { id: 7, name: 'Eva' };
  const vein = { id: 'vein-1', type: 'ironVein', x: 10, y: 12, vein: true };

  context.routePrimaryObjectAction(colonist, vein);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].obj, vein);

  const actions = context.makeContextActions(colonist, { kind: 'object', obj: vein, label: 'veio de ferro' }, { x: 10, y: 12 });
  const labels = actions.map(action => action.label);
  assert.ok(labels.includes('Minerar veio'));
});

test('Asset load guard keeps mining sprites and ore icons in the runtime load list', async () => {
  const timers = [];
  class FakeImage {
    constructor() {
      this.dataset = {};
      this.width = 96;
      this.height = 96;
      this.naturalWidth = 96;
      this.naturalHeight = 96;
      this.onload = null;
      this.onerror = null;
    }

    set src(value) {
      this._src = value;
      if (typeof this.onload === 'function') this.onload();
    }

    get src() {
      return this._src;
    }
  }

  const context = createContext({
    HavenfallContext: {},
    loadImages() {},
    assetNames: ['tile_grass'],
    images: {},
    objectDefs: {
      ironVein: { img: 'mining_vein_iron' },
      furnace: { img: 'mining_station_simple_furnace' }
    },
    itemDefs: {
      rawIron: { icon: 'mining_ore_iron_raw' },
      ironIngot: { icon: 'mining_ingot_iron' }
    },
    HavenfallAssets: {
      assets: {
        mining_vein_iron: { path: 'assets/ui/mining_automation/deposits/mining_vein_iron.svg' },
        mining_station_simple_furnace: { path: 'assets/ui/mining_automation/workstations/mining_station_simple_furnace.svg' },
        mining_ore_iron_raw: { path: 'assets/ui/mining_automation/resources/ores/mining_ore_iron_raw.svg' },
        mining_ingot_iron: { path: 'assets/ui/mining_automation/metals/mining_ingot_iron.svg' }
      },
      animations: {}
    },
    spriteSrc(name) {
      return context.HavenfallAssets.assets[name]?.path || `assets/ui/${name}.png`;
    },
    isProceduralRuntimeAsset() {
      return false;
    },
    Image: FakeImage,
    setTimeout(fn) {
      timers.push(fn);
      return timers.length - 1;
    },
    clearTimeout(id) {
      timers[id] = null;
    }
  });

  runBrowserScript('src/game/systems/asset-load-guard-system.js', context);

  await context.HavenfallAssetLoadGuard.guardedLoadImages();
  await drainTimers(timers);

  assert.ok(context.images.tile_grass, 'expected terrain tile to remain loaded');
  assert.ok(context.images.mining_vein_iron, 'expected mining vein asset to load');
  assert.ok(context.images.mining_station_simple_furnace, 'expected mining workstation asset to load');
  assert.ok(context.images.mining_ore_iron_raw, 'expected mining ore icon to load');
  assert.ok(context.images.mining_ingot_iron, 'expected mining ingot icon to load');
});

test('World generator spawns persistent mining veins on fresh maps', () => {
  let randomTick = 0;
  const context = createContext({
    console,
    TILE: 48,
    getMapSizeDef() {
      return { cols: 40, rows: 40, resourceMultiplier: 1 };
    },
    hashSeed(text) {
      return String(text).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) >>> 0;
    }
  });

  runBrowserScript('src/game/systems/world-generator.js', context);

  const terrain = Array.from({ length: 40 }, () => Array(40).fill('stone'));
  const objects = [];
  const occupiedTiles = new Set();
  const rand = () => ((randomTick++ * 17) % 97) / 97;
  const add = (type, x, y, extra = {}) => {
    const obj = { id: `${type}-${x}-${y}`, type, x, y, ...extra };
    objects.push(obj);
    occupiedTiles.add(`${x},${y}`);
    return obj;
  };

  context.generateOreVeins({
    terrain,
    objects,
    occupiedTiles,
    cols: 40,
    rows: 40,
    spawn: { x: 20, y: 20 },
    config: { mapSize: 'standard', difficulty: 'normal', seed: 'VEIN-TEST' },
    rand,
    add
  });

  const veins = objects.filter(obj => obj.vein);
  assert.ok(veins.length > 0, 'expected at least one mining vein');
  assert.ok(veins.some(obj => obj.type === 'ironVein'));
  assert.ok(veins.some(obj => obj.type === 'coalVein'));
});

test('Simple object renderer has a fallback for mining veins and tin manifest points to dedicated art', () => {
  const ctx = createDrawSpy();
  const registrations = [];
  const context = createContext({
    TILE: 48,
    ctx,
    buildDefs: {},
    objectDefs: {
      ironVein: { img: 'mining_vein_iron' }
    },
    images: {},
    state: { objects: [] },
    HavenfallContext: {},
    GameSystems: {
      registerObjectRenderer(id, fn) {
        registrations.push({ id, fn });
      }
    },
    HavenfallDebugRuntime: {
      registerProvider() {}
    }
  });

  runBrowserScript('src/game/rendering/simple-object-renderer.js', context);

  const drawn = context.HavenfallSimpleObjectRenderer.drawObject({ id: 'vein-x', type: 'ironVein', x: 2, y: 3, vein: true });
  assert.equal(drawn, true);
  assert.ok(registrations.length > 0);
  assert.ok(ctx.counts.fillRect > 0 || ctx.counts.fill > 0 || ctx.counts.stroke > 0);

  const manifest = readFileSync('assets/manifest.js', 'utf8');
  assert.match(manifest, /"mining_vein_tin":\s*\{\s*"path":\s*"assets\/ui\/mining_automation\/deposits\/mining_vein_tin\.svg"/);
  assert.equal(existsSync('assets/ui/mining_automation/deposits/mining_vein_tin.svg'), true);
});
