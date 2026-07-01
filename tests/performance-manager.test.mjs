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

test('Performance manager wraps pathfinding with cache and queue metrics', () => {
  const registeredTicks = new Map();
  const context = createContext({
    TILE: 32,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    camera: { x: 0, y: 0 },
    state: {
      pathVersion: 3,
      world: { cols: 64, rows: 64 },
      objects: [],
      mobs: [],
      wolves: [],
      colonists: [],
      visitors: [],
      npcs: []
    },
    navigator: { hardwareConcurrency: 8, deviceMemory: 16 },
    document: {
      createElement() {
        return { getContext() { return null; } };
      }
    },
    performance: { now: () => 100 },
    HavenfallContext: {},
    HavenfallPerf: { lastFrameMs: 16.7, systemsMs: 1, uiMs: 1 },
    HavenfallSettings: {
      metrics: {},
      get(path, fallback) {
        const values = {
          'video.targetFPS': 60,
          'performance.offscreenSimulation': 'reduced',
          'performance.pathfindingQuality': 'balanced',
          'performance.livingWorldUpdateRate': 'medium'
        };
        return path in values ? values[path] : fallback;
      }
    },
    GameSystems: {
      registerTick(id, fn) { registeredTicks.set(id, fn); },
      configureTick() {}
    },
    findPath(startX, startY, endX, endY) {
      return [{ x: startX, y: startY }, { x: endX, y: endY }];
    }
  });

  runBrowserScript('src/game/systems/performance-manager.js', context);

  const firstPath = context.findPath(0, 0, 4, 5);
  const secondPath = context.findPath(0, 0, 4, 5);
  assert.deepEqual(firstPath, secondPath);

  let queuedPath = null;
  context.PathfindingQueue.request({
    key: 'repair:test',
    startX: 1,
    startY: 1,
    endX: 2,
    endY: 3,
    apply(path) {
      queuedPath = path;
    }
  });

  registeredTicks.get('performance.manager')?.(0.16);

  assert.ok(Array.isArray(queuedPath));
  assert.ok(['high', 'ultra'].includes(context.HardwareProfile.tier));
  assert.equal(context.HavenfallPerf.pathfinding.cacheHits >= 1, true);
  assert.equal(context.HavenfallSettings.metrics.pathQueued, 0);
});
