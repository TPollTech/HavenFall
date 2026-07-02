import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function runBrowserScript(path, context) {
  const code = readFileSync(path, 'utf8');
  vm.runInContext(code, context, { filename: path });
}

function createContext(extra = {}) {
  const context = vm.createContext({ ...extra });
  context.window = context;
  return context;
}

function grid(rows, cols, value) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function createLightingContext({ exploration, explorationDisabled = false, hour = 6 + 50 / 60, objects = [] } = {}) {
  let now = 1;
  const draws = [];
  const drawImages = [];
  const mockCtx = {
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: false,
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    fillRect(x, y, width, height) { draws.push({ kind: 'rect', style: this._fillStyle, x, y, width, height }); },
    fill() { draws.push({ kind: 'shape', style: this._fillStyle }); },
    drawImage(_img, x, y, w, h) { drawImages.push({ x, y, w, h }); },
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; }
  };
  const FakeOffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      const self = this;
      return {
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData(imgData) { self._pixels = imgData.data; }
      };
    }
  };
  const context = createContext({
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    HavenfallContext: {},
    performance: { now: () => now },
    OffscreenCanvas: FakeOffscreenCanvas,
    state: {
      hour,
      weather: 'limpo',
      colonists: [],
      world: {
        rows: 3,
        cols: 3,
        objects,
        exploration,
        explorationDisabled,
        lightLayer: grid(3, 3, 1),
        builtRoofLayer: grid(3, 3, false),
        naturalRoofLayer: grid(3, 3, false)
      }
    },
    objectDefs: {
      tree: { blocks: true },
      torch: { fuelMax: 100, light: { radius: 4, power: 0.7 } }
    },
    ctx: mockCtx,
    getWorldCols: () => 3,
    getWorldRows: () => 3
  });

  context.draws = () => draws;
  context.drawImages = () => drawImages;
  context.advanceMs = ms => { now += ms; };
  return context;
}

function darkOverlayDraws(context) {
  return context.drawImages().filter(d => d.w > 0 && d.h > 0);
}

function shadowDraws(context) {
  return context.draws().filter(draw => String(draw.style).startsWith('rgba(0, 0, 0,'));
}

test('Lighting overlay treats disabled exploration as already visible', () => {
  const context = createLightingContext({ exploration: [], explorationDisabled: true, hour: 12 });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  assert.equal(context.LightingSystem.hasUsableExplorationMask(context.state.world), false);

  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });

  assert.equal(darkOverlayDraws(context).length, 0);
});

test('Lighting overlay keeps heavy fog when a valid exploration mask hides tiles', () => {
  const context = createLightingContext({ exploration: grid(3, 3, 0) });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  assert.equal(context.LightingSystem.hasUsableExplorationMask(context.state.world), true);

  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });

  assert.equal(darkOverlayDraws(context).length, 1);
});

test('Lighting system eases global daylight instead of snapping or updating by map chunks', () => {
  const context = createLightingContext({ exploration: grid(3, 3, 2), hour: 12 });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  const noon = context.LightingSystem.updateVisualSunState(context.state.world, true);
  assert.ok(noon.light > 0.95);

  context.state.hour = 23;
  context.advanceMs(100);
  const fading = context.LightingSystem.updateVisualSunState(context.state.world);
  const nightTarget = context.LightingSystem.sunStateAtHour(23).light;

  assert.ok(fading.light < noon.light);
  assert.ok(fading.light > nightTarget);

  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });
  const darkTiles = darkOverlayDraws(context);
  assert.ok(darkTiles.length > 0);
});

test('Directional sun casts object shadows during daylight', () => {
  const context = createLightingContext({ exploration: grid(3, 3, 2), hour: 7, objects: [{ id: 'tree-1', type: 'tree', x: 1, y: 1 }] });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  context.LightingSystem.updateVisualSunState(context.state.world, true);
  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });

  assert.ok(shadowDraws(context).length >= 1);
});
