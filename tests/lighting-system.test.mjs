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
  const context = createContext({
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    HavenfallContext: {},
    performance: { now: () => now },
    OffscreenCanvas: class OffscreenCanvas {
      constructor(w, h) { this.width = w; this.height = h; this._data = new Uint8ClampedArray(w * h * 4); }
      getContext() {
        return {
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (imgData) => { this._data = imgData.data; }.bind(this)
        };
      }
    },
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
    ctx: {
      globalCompositeOperation: 'source-over',
      save() {},
      restore() {},
      beginPath() {},
      ellipse() {},
      fillRect(x, y, width, height) { draws.push({ kind: 'rect', style: this._fillStyle, x, y, width, height }); },
      fill() { draws.push({ kind: 'shape', style: this._fillStyle }); },
      createLinearGradient(x0, y0, x1, y1) {
        const stops = [];
        return {
          addColorStop(offset, color) { stops.push({ offset, color }); },
          _stops: stops,
          _x0: x0, _y0: y0, _x1: x1, _y1: y1,
          toString() { return `gradient(${stops.map(s => s.color).join('|')})`; }
        };
      },
      set fillStyle(value) { this._fillStyle = value; },
      get fillStyle() { return this._fillStyle; }
    },
    getWorldCols: () => 3,
    getWorldRows: () => 3
  });

  context.draws = () => draws;
  context.advanceMs = ms => { now += ms; };
  return context;
}

function darkOverlayDraws(context) {
  return context.draws().filter(draw => {
    const s = draw.style;
    if (typeof s === 'string') return s.startsWith('rgba(1, 5, 14,');
    if (s && typeof s === 'object' && Array.isArray(s._stops)) {
      return s._stops.some(stop => typeof stop.color === 'string' && stop.color.startsWith('rgba(1,5,14'));
    }
    return false;
  });
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

  assert.ok(darkOverlayDraws(context).length >= 9);
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
