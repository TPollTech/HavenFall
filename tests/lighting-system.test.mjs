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

function createLightingContext({ exploration, explorationDisabled = false }) {
  let fillCount = 0;
  const context = createContext({
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    HavenfallContext: {},
    state: {
      hour: 6 + 50 / 60,
      weather: 'limpo',
      world: {
        rows: 3,
        cols: 3,
        objects: [],
        exploration,
        explorationDisabled,
        lightLayer: grid(3, 3, 1),
        builtRoofLayer: grid(3, 3, false),
        naturalRoofLayer: grid(3, 3, false)
      }
    },
    ctx: {
      save() {},
      restore() {},
      fillRect() { fillCount += 1; },
      set fillStyle(value) { this._fillStyle = value; },
      get fillStyle() { return this._fillStyle; }
    },
    getWorldCols: () => 3,
    getWorldRows: () => 3
  });

  context.fillCount = () => fillCount;
  return context;
}

test('Lighting overlay treats disabled exploration as already visible', () => {
  const context = createLightingContext({ exploration: [], explorationDisabled: true });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  assert.equal(context.LightingSystem.hasUsableExplorationMask(context.state.world), false);

  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });

  assert.equal(context.fillCount(), 0);
});

test('Lighting overlay keeps heavy fog when a valid exploration mask hides tiles', () => {
  const context = createLightingContext({ exploration: grid(3, 3, 0) });
  runBrowserScript('src/game/systems/lighting-system.js', context);

  assert.equal(context.LightingSystem.hasUsableExplorationMask(context.state.world), true);

  context.LightingSystem.drawLightingOverlay({ startX: 0, startY: 0, endX: 2, endY: 2 });

  assert.equal(context.fillCount(), 9);
});
