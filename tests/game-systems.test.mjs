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

test('GameSystems runs ticks and hooks in declared order', () => {
  const context = createContext();
  runBrowserScript('src/game/core/game-systems.js', context);

  const calls = [];
  context.GameSystems.registerTick('late', () => calls.push('late'), { order: 20 });
  context.GameSystems.registerTick('early', () => calls.push('early'), { order: 10 });
  context.GameSystems.registerTick('disabled', () => calls.push('disabled'), { enabled: false });

  context.GameSystems.tick(0.16);
  assert.deepEqual(calls, ['early', 'late']);

  assert.equal(context.GameSystems.hasTick('late'), true);
  assert.equal(context.GameSystems.unregisterTick('late'), true);
  assert.equal(context.GameSystems.hasTick('late'), false);
});

test('GameSystems composes task, movement and work-rate extensions', () => {
  const context = createContext();
  runBrowserScript('src/game/core/game-systems.js', context);

  context.GameSystems.registerTaskHandler('build', 'wrong', () => {
    throw new Error('wrong task handler should not run');
  });
  context.GameSystems.registerTaskHandler('mine', 'miss', () => false, { order: 10 });
  context.GameSystems.registerTaskHandler('mine', 'hit', (colonist, task, tick) => {
    colonist.handled = `${task.type}:${tick}`;
    return true;
  }, { order: 20 });

  const colonist = {};
  assert.equal(context.GameSystems.handleTask(colonist, { type: 'mine' }, 7), true);
  assert.equal(colonist.handled, 'mine:7');

  context.GameSystems.registerMovementModifier('mud', (colonist, multiplier) => multiplier * 0.5, { order: 10 });
  context.GameSystems.registerMovementModifier('road', (colonist, multiplier) => multiplier * 1.5, { order: 20 });
  assert.equal(context.GameSystems.movementMultiplier({}), 0.75);

  context.GameSystems.registerWorkRateModifier('injury', rate => rate * 0.5, { order: 10 });
  context.GameSystems.registerWorkRateModifier('tool', rate => rate + 2, { order: 20 });
  assert.equal(context.GameSystems.applyWorkRateModifiers(10, {}, 'build'), 7);
});

test('GameSystems colonist guards can stop base update flow', () => {
  const context = createContext();
  runBrowserScript('src/game/core/game-systems.js', context);

  const calls = [];
  context.GameSystems.registerColonistUpdateGuard('pass', () => {
    calls.push('pass');
    return false;
  }, { order: 10 });
  context.GameSystems.registerColonistUpdateGuard('stop', () => {
    calls.push('stop');
    return true;
  }, { order: 20 });
  context.GameSystems.registerColonistUpdateGuard('after-stop', () => {
    calls.push('after-stop');
    return true;
  }, { order: 30 });

  assert.equal(context.GameSystems.runColonistUpdateGuards({}, 1), true);
  assert.deepEqual(calls, ['pass', 'stop']);
});

test('GameState manages resources, items and object indexes', () => {
  let invalidations = 0;
  const context = createContext({
    state: {
      resources: { wood: 5 },
      items: { rope: 1 },
      objects: []
    },
    wallIndexDirty: false,
    invalidateSpatialGrid: () => {
      invalidations += 1;
    }
  });

  runBrowserScript('src/game/core/game-state.js', context);

  assert.equal(context.GameState.hasResources({ wood: 4 }), true);
  assert.equal(context.GameState.payResources({ wood: 3 }), true);
  assert.equal(context.state.resources.wood, 2);

  context.GameState.addRecipeOutput({
    resources: { wood: 4, stone: 2 },
    items: { rope: 2 }
  });
  assert.deepEqual(context.state.resources, { wood: 6, stone: 2 });
  assert.deepEqual(context.state.items, { rope: 3 });

  const wall = { id: 'wall-1', type: 'wall', x: 1, y: 2 };
  assert.equal(context.GameState.addObject(wall), wall);
  assert.equal(context.GameState.getObjectById('wall-1'), wall);
  assert.equal(invalidations, 1);
  assert.equal(context.wallIndexDirty, true);

  assert.equal(context.GameState.removeObjectById('wall-1'), wall);
  assert.deepEqual(context.state.objects, []);
  assert.equal(invalidations, 2);
});
