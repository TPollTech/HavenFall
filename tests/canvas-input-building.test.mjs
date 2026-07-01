import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('Context menu target lookup ignores missing getWolfAt helper safely', () => {
  const context = createContext({
    canvas: createCanvasStub(),
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    TILE: 32,
    state: {
      world: {
        cols: 64,
        rows: 64,
        pointsOfInterest: []
      },
      colonists: [],
      terrain: Array.from({ length: 64 }, () => Array(64).fill('grass'))
    },
    viewTransform: { offsetX: 0, offsetY: 0, scale: 1 },
    buildDefs: {},
    objectDefs: {},
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
      return x >= 0 && y >= 0 && x < 64 && y < 64;
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
    }
  });

  runBrowserScript('src/game/input/canvas-input-building.js', context);

  assert.doesNotThrow(() => context.getContextTarget({ x: 12, y: 18 }));
  const target = JSON.parse(JSON.stringify(context.getContextTarget({ x: 12, y: 18 })));
  assert.deepEqual(target, {
    kind: 'tile',
    tile: { x: 12, y: 18 },
    label: 'Terreno'
  });
});
