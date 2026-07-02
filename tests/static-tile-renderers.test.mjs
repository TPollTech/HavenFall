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

function createRenderCtxSpy() {
  const counts = {
    save: 0,
    restore: 0,
    beginPath: 0,
    closePath: 0,
    moveTo: 0,
    lineTo: 0,
    fill: 0,
    stroke: 0,
    fillRect: 0,
    rect: 0,
    clip: 0,
    gradient: 0
  };

  return {
    counts,
    lineWidth: 1,
    globalAlpha: 1,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    save() { counts.save++; },
    restore() { counts.restore++; },
    beginPath() { counts.beginPath++; },
    closePath() { counts.closePath++; },
    moveTo() { counts.moveTo++; },
    lineTo() { counts.lineTo++; },
    fill() { counts.fill++; },
    stroke() { counts.stroke++; },
    fillRect() { counts.fillRect++; },
    rect() { counts.rect++; },
    clip() { counts.clip++; },
    createLinearGradient() {
      counts.gradient++;
      return { addColorStop() {} };
    },
    createRadialGradient() {
      counts.gradient++;
      return { addColorStop() {} };
    }
  };
}

function createTerrain(rows, cols, value = 'grass') {
  return Array.from({ length: rows }, () => Array(cols).fill(value));
}

test('Floor and mountain static tile renderers honor targetCtx instead of global ctx', () => {
  const targetCtx = createRenderCtxSpy();
  const screenCtx = createRenderCtxSpy();
  const terrain = createTerrain(8, 8);
  const context = createContext({
    performance: { now: () => 0 },
    TILE: 32,
    ctx: screenCtx,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    buildDefs: {},
    objectDefs: {},
    state: {
      terrain,
      objects: [],
      world: {
        rows: 8,
        cols: 8,
        terrain,
        objects: []
      }
    },
    HavenfallContext: { gameBooted: true },
    invalidateSpatialGrid() {},
    isInside(x, y) {
      return x >= 0 && y >= 0 && x < 8 && y < 8;
    },
    isTileDiscovered() {
      return true;
    },
    getObjectAt() {
      return null;
    },
    getRockAt(x, y) {
      return x === 2 && y === 3 ? { solid: true, type: 'granite' } : null;
    },
    isMountainBlocked(x, y) {
      return x === 2 && y === 3;
    }
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/floor-system.js', context);
  runBrowserScript('src/game/systems/render-collision-system.js', context);

  assert.equal(context.FloorSystem.setFloorAt(1, 1, 'wood_floor'), true);
  context.GameSystems.drawTileRenderers(1, 1, 'grass', {
    pass: 'static',
    targetCtx,
    quality: { renderDistance: 'normal' }
  });
  assert.equal(context.FloorSystem.patternDirectionForFloor('wood_floor', 99, 77), 'horizontal');
  assert.ok(targetCtx.counts.fillRect > 0, 'expected floor renderer to draw into targetCtx');
  assert.equal(screenCtx.counts.fillRect, 0, 'expected floor renderer to avoid drawing into global ctx');

  const screenFillRectAfterFloor = screenCtx.counts.fillRect;
  const targetFillAfterFloor = targetCtx.counts.fill + targetCtx.counts.stroke + targetCtx.counts.fillRect;
  context.GameSystems.drawTileRenderers(2, 3, 'grass', {
    pass: 'static',
    targetCtx,
    quality: { renderDistance: 'normal' }
  });

  assert.ok(
    targetCtx.counts.fill + targetCtx.counts.stroke + targetCtx.counts.fillRect > targetFillAfterFloor,
    'expected mountain renderer to draw into targetCtx'
  );
  assert.equal(
    screenCtx.counts.fillRect,
    screenFillRectAfterFloor,
    'expected mountain renderer to avoid drawing into global ctx'
  );
});
