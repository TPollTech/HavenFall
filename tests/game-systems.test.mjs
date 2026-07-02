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

function createFakeModalDocument() {
  const elements = {};
  const makeNode = () => ({
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    hidden: false,
    setAttribute() {},
    addEventListener() {}
  });
  const fakeModal = {
    id: 'eventModal',
    isConnected: true,
    hidden: true,
    dataset: {},
    style: {},
    classList: {
      values: new Set(),
      add(...names) { names.forEach(name => this.values.add(name)); },
      remove(...names) { names.forEach(name => this.values.delete(name)); },
      contains(name) { return this.values.has(name); }
    },
    setAttribute() {},
    addEventListener() {},
    querySelector(selector) {
      if (!this.nodes) {
        this.nodes = {
          '[data-encounter-kicker]': makeNode(),
          '[data-encounter-title]': makeNode(),
          '[data-encounter-body]': makeNode(),
          '[data-encounter-actions]': makeNode()
        };
      }
      return this.nodes[selector] || null;
    }
  };
  elements.eventModal = fakeModal;
  return {
    activeElement: null,
    getElementById(id) { return elements[id] || null; },
    addEventListener() {},
    createElement(tag) {
      return {
        tagName: String(tag || '').toUpperCase(),
        id: '',
        style: {},
        dataset: {},
        className: '',
        hidden: false,
        innerHTML: '',
        textContent: '',
        setAttribute() {},
        appendChild() {},
        querySelector: () => null,
        addEventListener() {},
        classList: { add() {}, remove() {}, contains() { return false; } }
      };
    },
    head: {
      appendChild(node) {
        if (node?.id) elements[node.id] = node;
      }
    },
    body: {
      appendChild(node) {
        if (node?.id) elements[node.id] = node;
      }
    }
  };
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

test('GameSystems can reconfigure registered tick intervals', () => {
  const context = createContext();
  runBrowserScript('src/game/core/game-systems.js', context);

  let calls = 0;
  context.GameSystems.registerTick('paced', () => { calls++; }, { order: 10, intervalMs: 1000 });
  context.performance = { now: () => 0 };
  context.GameSystems.tick(0.16);
  assert.equal(calls, 1);

  context.GameSystems.configureTick('paced', { intervalMs: 0 });
  context.performance = { now: () => 10 };
  context.GameSystems.tick(0.16);
  assert.equal(calls, 2);

  context.GameSystems.configureTick('paced', { enabled: false });
  context.performance = { now: () => 20 };
  context.GameSystems.tick(0.16);
  assert.equal(calls, 2);
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

test('Schedule manager sends exhausted leisure colonists to sleep', () => {
  const context = createContext({
    state: { hour: 12, objects: [{ id: 'fire-1', type: 'campfire', x: 4, y: 4 }], colonists: [] },
    HavenfallContext: {},
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by),
    nearestFreeAdjacent: (x, y) => ({ x: x - 1, y }),
    findPath: () => [],
    startSleep: c => {
      c.task = { type: 'sleep', x: c.x, y: c.y };
      c.path = [];
      c.work = 0;
      c.note = 'Dormindo';
      return true;
    }
  });
  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/schedule-manager.js', context);
  context.updateScheduleManagerTick();

  const leisureSchedule = Array(24).fill(context.ScheduleManager.SCHEDULE.LEISURE);
  const tired = { id: 1, x: 0, y: 0, energy: 0, mood: 0, hunger: 80, health: 100, task: { type: 'leisure' }, path: [], schedule: leisureSchedule };
  context.GameSystems.runBeforeColonistUpdate(tired, 1);
  assert.equal(tired.task.type, 'sleep');

  const sleepSchedule = Array(24).fill(context.ScheduleManager.SCHEDULE.SLEEP);
  const trapped = { id: 2, x: 0, y: 0, energy: 80, mood: 80, hunger: 80, health: 100, task: { type: 'leisure' }, path: [], schedule: sleepSchedule };
  context.GameSystems.runBeforeColonistUpdate(trapped, 1);
  assert.equal(trapped.task.type, 'sleep');

  const restedEnough = { id: 3, x: 0, y: 0, energy: 40, mood: 0, hunger: 80, health: 100, task: { type: 'leisure' }, path: [], schedule: leisureSchedule };
  context.GameSystems.handleTask(restedEnough, restedEnough.task, 10);
  assert.ok(restedEnough.energy > 40);
  assert.ok(restedEnough.mood > 0);
});

test('Simulation balance keeps colonists asleep while mood is critically low', () => {
  const context = createContext({
    state: { isPreview: false, runtimeMode: 'playing', speed: 1, objects: [], colonists: [] },
    HavenfallContext: {},
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    document: {
      addEventListener() {},
      querySelectorAll() { return []; }
    },
    setTimeout(fn) { fn(); },
    findPath: () => [],
    nearestFreeAdjacent: (x, y) => ({ x, y })
  });
  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/simulation-balance-system.js', context);

  const exhausted = { id: 1, x: 0, y: 0, energy: 89, mood: 0, task: { type: 'sleep', x: 0, y: 0, groundRest: true }, path: [], work: 0 };
  assert.equal(context.GameSystems.handleTask(exhausted, exhausted.task, 1), true);
  assert.equal(exhausted.task.type, 'sleep');
  assert.ok(exhausted.energy > 89);
  assert.ok(exhausted.mood > 0);

  exhausted.energy = 98;
  exhausted.mood = 2;
  assert.equal(context.GameSystems.handleTask(exhausted, exhausted.task, 1), true);
  assert.equal(exhausted.task, null);
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

test('Gather priority only auto-assigns marked resources', () => {
  const resource = { id: 'tree-1', type: 'tree', x: 3, y: 2 };
  const context = createContext({
    state: {
      objects: [resource],
      taskPriorities: {
        1: { gather: 2, build: 0, research: 0, handle: 0 }
      }
    },
    objectDefs: {
      tree: { name: 'arvore', gather: { wood: 8 }, work: 3 }
    },
    isTileDiscovered: () => true,
    dist: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by),
    nearestFreeAdjacent: (x, y) => ({ x: x - 1, y }),
    findPath: (fromX, fromY, toX, toY) => [{ x: toX, y: toY }],
    log: () => {},
    nearestMarkedMine: () => null
  });
  runBrowserScript('src/game/systems/world-systems.js', context);

  const colonist = { id: 1, name: 'Ana', x: 0, y: 0 };
  assert.equal(context.canDoPriorityTask(colonist, 'gather'), false);
  assert.equal(context.assignPriorityTask(colonist, 'gather'), false);
  assert.equal(colonist.task, undefined);

  resource.markedForGather = true;
  assert.equal(context.canDoPriorityTask(colonist, 'gather'), true);
  assert.equal(context.assignPriorityTask(colonist, 'gather'), true);
  assert.equal(colonist.task.type, 'gather');
  assert.equal(colonist.task.objId, 'tree-1');
  assert.equal(colonist.task.x, 2);
  assert.equal(colonist.task.y, 2);
});

test('Handle priority can haul loose items to a built storage depot', () => {
  const looseLogs = { id: 'logs-1', type: 'logs', x: 4, y: 4, amount: 5 };
  const depot = { id: 'crate-1', type: 'crate', x: 7, y: 4 };
  const context = createContext({
    state: {
      objects: [looseLogs, depot],
      taskPriorities: {
        1: { gather: 0, build: 0, research: 0, handle: 3 }
      }
    },
    zoneSystem: {
      hasStorageDestination: obj => obj?.type === 'logs',
      findFreeStorageDestinationFor: obj => obj?.type === 'logs' ? { x: depot.x, y: depot.y, type: 'storage_object', objectId: depot.id } : null,
      findFreeStorageTile: () => null,
      count: () => 0
    },
    findLooseHaulTarget: () => looseLogs,
    assignHaulTask: (colonist, obj, destination) => {
      colonist.task = { type: 'haul', objId: obj.id, zoneType: destination.type, zoneObjectId: destination.objectId };
      return true;
    },
    ensureResearchState: () => {},
    nearestMarkedMine: () => null,
    nearestFreeAdjacent: (x, y) => ({ x: x - 1, y }),
    findPath: () => [],
    dist: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by)
  });
  runBrowserScript('src/game/systems/world-systems.js', context);

  const colonist = { id: 1, name: 'Lia', x: 1, y: 1 };
  assert.equal(context.canDoPriorityTask(colonist, 'handle'), true);
  assert.equal(context.assignPriorityTask(colonist, 'handle'), true);
  assert.equal(colonist.task.zoneType, 'storage_object');
  assert.equal(colonist.task.zoneObjectId, 'crate-1');
});

test('Storage zone falls back to floor stack when crate is full', () => {
  const grid = {};
  const zoneKey = (x, y) => String((x << 16) | y);
  grid[zoneKey(7, 4)] = 'storage';
  grid[zoneKey(8, 4)] = 'storage';
  const crate = {
    id: 'crate-1',
    type: 'crate',
    x: 7,
    y: 4,
    storageContents: { resources: { wood: 80 }, items: {} }
  };
  const looseLogs = { id: 'logs-1', type: 'logs', x: 4, y: 4, amount: 5 };
  const context = createContext({
    state: {
      zones: { grid },
      objects: [crate, looseLogs],
      colonists: [],
      resources: { wood: 0 },
      items: {}
    },
    zoneDefs: { storage: { label: 'Armazenamento' }, home: {}, safe: {}, dumping: {}, priority: {} },
    zoneSystem: {
      ensureState() { return context.state.zones; },
      key: zoneKey,
      decode(key) { const raw = Number(key); return { x: raw >> 16, y: raw & 0xFFFF }; },
      entries(type = null) {
        return Object.entries(context.state.zones.grid)
          .map(([key, zoneType]) => ({ ...this.decode(key), type: zoneType }))
          .filter(tile => !type || tile.type === type);
      },
      count(type = null) { return this.entries(type).length; },
      getZoneAt(x, y) { return context.state.zones.grid[this.key(x, y)] || null; },
      findFreeTile(type, predicate = null) {
        return this.entries(type).find(tile => !context.getObjectAt(tile.x, tile.y) && (!predicate || predicate(tile))) || null;
      }
    },
    objectDefs: {
      crate: { storage: 1, storageCapacity: 80 },
      logs: { gather: { wood: 5 } },
      stockpile: { stored: true }
    },
    itemDefs: {},
    GameSystems: { registerTaskHandler: () => {}, registerDrawOverlay: () => {} },
    HavenfallContext: {},
    isInside: () => true,
    isTileDiscovered: () => true,
    isBlocked: () => false,
    getObjectAt: (x, y) => context.state.objects.find(obj => obj.x === x && obj.y === y) || null,
    dist: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by),
    uid: prefix => `${prefix}-1`,
    addResources: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.resources[key] = (context.state.resources[key] || 0) + value;
    },
    addItems: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.items[key] = (context.state.items[key] || 0) + value;
    },
    invalidateSpatialGrid: () => {},
    escapeHtml: value => String(value ?? ''),
    zoneToolButtonsHtml: () => '',
    zoneLabel: value => value,
    zoneToolLabel: () => '',
    updateZonePanel: () => {},
    updateZonesModal: () => {},
    ensureZonesModalElement: () => ({ dataset: {}, addEventListener: () => {} }),
    ensureZonesModalStyles: () => {},
    assignMove: () => false,
    findLooseHaulTarget: () => null,
    assignHaulTask: () => false,
    processHaulTask: () => false,
    updateZoneBehaviors: () => {},
    drawZonesOverlay: () => {}
  });
  runBrowserScript('src/game/systems/advanced-zones.js', context);

  const destination = context.zoneSystem.findFreeStorageDestinationFor(looseLogs, looseLogs.x, looseLogs.y);
  assert.equal(destination.type, 'storage');
  assert.equal(destination.x, 8);
  assert.equal(destination.y, 4);

  const stored = context.HavenfallStorage.depositCargoForTask({
    zoneType: 'storage_object',
    zoneObjectId: crate.id,
    storageX: crate.x,
    storageY: crate.y
  }, { resource: 'wood', amount: 5, label: 'madeira' });
  assert.equal(stored.ok, true);
  assert.equal(crate.storageContents.resources.wood, 80);
  const stack = context.state.objects.find(obj => obj.type === 'stockpile');
  assert.equal(stack.amount, 5);
  assert.equal(stack.x, 8);
  assert.equal(stack.y, 4);
  assert.equal(context.state.resources.wood, 5);
  assert.equal(context.storageAcceptsObject(stack), false);
});

test('Hauling task cannot pick up loose item remotely when path is missing', () => {
  const looseLogs = { id: 'logs-1', type: 'logs', x: 4, y: 4, amount: 5, reservedBy: 1 };
  const context = createContext({
    state: {
      objects: [looseLogs],
      items: {},
      resources: {},
      taskPriorities: {}
    },
    itemDefs: {},
    recipeDefs: {},
    HavenfallContext: {},
    assignHaulTask: () => false,
    processHaulTask: () => false,
    canAutoHandleZoneTask: () => true,
    nearestFreeAdjacent: (x, y) => ({ x: x - 1, y }),
    findPath: () => [],
    isResearched: () => false,
    equipItem: () => false,
    addResources: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.resources[key] = (context.state.resources[key] || 0) + value;
    },
    addItems: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.items[key] = (context.state.items[key] || 0) + value;
    },
    invalidateSpatialGrid: () => {},
    log: () => {}
  });
  runBrowserScript('src/game/systems/hauling-adv.js', context);

  const colonist = {
    id: 1,
    name: 'Lia',
    x: 0,
    y: 0,
    task: { type: 'haul', phase: 'pickup', objId: looseLogs.id, x: 3, y: 4 },
    path: []
  };
  assert.equal(context.processHaulTask(colonist), true);
  assert.equal(colonist.carrying, undefined);
  assert.equal(colonist.task, null);
  assert.equal(context.state.objects.includes(looseLogs), true);
  assert.equal(looseLogs.reservedBy, null);
});

test('Crafting dock keeps string workstation ids selectable', () => {
  let clickHandler = null;
  const bench = { id: 'obj_bench_1', type: 'bench', x: 5, y: 6 };
  const context = createContext({
    state: { objects: [bench], colonists: [{ id: 1, name: 'Lia' }] },
    selectedCraftStationId: null,
    recipeDefs: {
      hammer: { label: 'Martelo', station: 'bench', cost: { wood: 2 }, output: { items: { hammer: 1 } }, desc: 'Acelera construção.' }
    },
    stationLabels: { bench: 'Bancada' },
    objectDefs: { bench: { name: 'bancada' } },
    researchDefs: {},
    document: {
      addEventListener: (name, handler) => {
        if (name === 'click') clickHandler = handler;
      }
    },
    selectedColonist: () => ({ id: 1, name: 'Lia' }),
    recipeUnlocked: () => true,
    hasRecipeCost: () => true,
    itemCostText: () => '2 madeira',
    outputText: () => '+1 Martelo',
    escapeHtml: value => String(value ?? ''),
    assignCraft: (colonist, recipeKey, station) => {
      context.assigned = { colonist, recipeKey, station };
    },
    updateUI: () => {}
  });
  runBrowserScript('src/game/ui/tab-crafting.js', context);

  const html = context.HavenfallUI.tabViews.crafting.render();
  assert.equal(context.selectedCraftStationId, 'obj_bench_1');
  assert.match(html, /data-craft-recipe="hammer"/);

  clickHandler({
    target: {
      closest: selector => selector === '[data-craft-station-id]' ? { dataset: { craftStationId: 'obj_bench_1' } } : null
    }
  });
  assert.equal(context.selectedCraftStationId, 'obj_bench_1');
});

test('Living world registers water infrastructure and bridges unblock water', () => {
  const context = createContext({
    console,
    performance: { now: () => 0 },
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    buildDefs: {},
    objectDefs: {},
    state: {
      day: 1,
      hour: 8,
      speed: 1,
      weather: 'limpo',
      terrain: [
        ['grass', 'grass', 'grass', 'grass'],
        ['grass', 'water', 'water', 'grass'],
        ['grass', 'grass', 'grass', 'grass']
      ],
      objects: [],
      mobs: [],
      wolves: [],
      colonists: [],
      resources: {},
      world: { seed: 'test', waterTiles: [{ x: 1, y: 1 }], livingWorld: null, spawn: { x: 0, y: 0 } }
    },
    document: {
      activeElement: null,
      addEventListener: () => {},
      createElement: () => ({
        style: {},
        dataset: {},
        className: '',
        setAttribute: () => {},
        appendChild: () => {},
        querySelector: () => null,
        addEventListener: () => {}
      }),
      head: { appendChild: () => {} },
      body: { appendChild: () => {} }
    },
    getWorldCols: () => 4,
    getWorldRows: () => 3,
    getObjectAt: (x, y) => context.state.objects.find(o => o.x === x && o.y === y) || null,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  });
  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/living-world.js', context);

  assert.equal(context.buildDefs.bridge.placeOnWater, true);
  assert.equal(context.buildDefs.water_collector.needsAdjacentWater, true);
  assert.equal(context.GameSystems.pathBlocked(1, 1), true);

  context.state.objects.push({ id: 'bridge-1', type: 'bridge', x: 1, y: 1 });
  assert.equal(context.GameSystems.pathBlocked(1, 1), false);

  context.HavenfallLivingWorld.createWaypoint(3, 2, 'exploration', 'Ruina distante');
  context.HavenfallLivingWorld.createWaypoint(1, 0, 'water', 'Agua ao norte');
  const queue = context.HavenfallLivingWorld.generateExplorationQueue();
  assert.equal(queue.length, 2);
  assert.equal(context.state.livingWorld.explorationQueue.length, 2);
});

test('Living world can pause for encounters and recruit a visitor into the colony', () => {
  const math = Object.create(Math);
  math.random = () => 0;
  const document = createFakeModalDocument();
  const context = createContext({
    console,
    Math: math,
    performance: { now: () => 0 },
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    defaultNewGameConfig: { seed: 'TEST', eventIntensity: 'high' },
    buildDefs: {},
    objectDefs: {},
    itemDefs: {},
    state: {
      day: 1,
      hour: 9,
      speed: 2,
      weather: 'limpo',
      terrain: Array.from({ length: 12 }, () => Array(12).fill('grass')),
      objects: [],
      mobs: [],
      wolves: [],
      colonists: [{ id: 1, name: 'Lia', x: 6, y: 6 }],
      visitors: [],
      resources: { food: 40, medicine: 3, wood: 0, stone: 0, metal: 0, water: 0 },
      items: {},
      taskPriorities: {},
      config: { seed: 'TEST', eventIntensity: 'high', difficulty: 'normal' },
      world: { seed: 'TEST', cols: 12, rows: 12, terrain: Array.from({ length: 12 }, () => Array(12).fill('grass')), waterTiles: [], livingWorld: null, spawn: { x: 6, y: 6 } }
    },
    document,
    uid: prefix => `${prefix}-1`,
    getWorldCols: () => 12,
    getWorldRows: () => 12,
    getObjectAt: () => null,
    isBlocked: () => false,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    addResources: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.resources[key] = (context.state.resources[key] || 0) + value;
    },
    payResources: cost => {
      for (const [key, value] of Object.entries(cost)) context.state.resources[key] = Math.max(0, (context.state.resources[key] || 0) - value);
      return true;
    },
    addItems: gain => {
      for (const [key, value] of Object.entries(gain)) context.state.items[key] = (context.state.items[key] || 0) + value;
    },
    payItems: cost => {
      for (const [key, value] of Object.entries(cost)) context.state.items[key] = Math.max(0, (context.state.items[key] || 0) - value);
      return true;
    },
    createColonistCandidate: () => ({
      name: 'Ari',
      sprite: 'colonist',
      role: 'Generalista',
      age: 24,
      skills: { coleta: 4, construcao: 4, defesa: 3, pesquisa: 2, medicina: 1 },
      needs: { hunger: 74, energy: 68, mood: 62, health: 90 },
      workPreferenceId: 'gather',
      physicalTraitIds: [],
      positiveTraitIds: [],
      negativeTraitIds: []
    }),
    candidateToColonist: (candidate, id, x, y) => ({ id, name: candidate.name, x, y, mood: 70, energy: 72, health: 90, priority: 'gather' }),
    invalidateSpatialGrid() {},
    updateUI() {}
  });
  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/living-world.js', context);

  assert.equal(context.HavenfallLivingWorld.openBriefing(), true);
  assert.equal(context.state.speed, 0);
  assert.equal(context.state.livingWorld.activeEncounter.key, 'intro');

  assert.equal(context.HavenfallLivingWorld.resolveEncounter('intro_close'), true);
  assert.equal(context.state.speed, 2);
  assert.equal(context.state.livingWorld.activeEncounter, null);

  const visitor = context.HavenfallLivingWorld.spawnVisitor('visitor', 0);
  assert.ok(visitor);
  assert.ok(['lost_traveler', 'injured_refugee', 'wandering_scout'].includes(visitor.story.key));
  assert.equal(context.HavenfallLivingWorld.triggerEncounter(visitor.id), true);
  assert.equal(context.state.speed, 0);
  assert.equal(context.state.livingWorld.activeEncounter.key, 'visitor');

  assert.equal(context.HavenfallLivingWorld.resolveEncounter('visitor_invite'), true);
  assert.equal(context.state.colonists.length, 2);
  assert.equal(context.state.visitors.length, 0);
  assert.equal(context.state.speed, 2);
});

test('World systems do not grant craft output when payment fails at completion', () => {
  const logs = [];
  let outputCalls = 0;
  let uiRefreshes = 0;
  const context = createContext({
    state: {
      objects: [{ id: 'bench-1', type: 'bench', x: 2, y: 2 }],
      resources: {},
      items: {}
    },
    recipeDefs: {
      hammer: {
        label: 'Martelo',
        duration: 1,
        output: { items: { hammer: 1 } }
      }
    },
    objectDefs: { bench: { name: 'bancada' } },
    GameSystems: { handleTask: () => false },
    hasRecipeCost: () => true,
    payRecipeCost: () => false,
    addRecipeOutput: () => { outputCalls += 1; },
    autoEquipCraftedItem: () => { throw new Error('crafted item should not be equipped when payment fails'); },
    notifyWorkComplete: () => { throw new Error('work completion should not fire when payment fails'); },
    feedbackKindForRecipe: () => 'craft',
    outputText: () => '+1 Martelo',
    workRate: () => 1,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    updateCraftingUI: () => { uiRefreshes += 1; },
    log: message => logs.push(message)
  });

  runBrowserScript('src/game/systems/world-systems.js', context);

  const colonist = {
    id: 1,
    name: 'Lia',
    mood: 50,
    task: { type: 'craft', recipeKey: 'hammer', objId: 'bench-1' },
    work: 0
  };

  context.handleTaskAtTarget(colonist, 1);

  assert.equal(outputCalls, 0);
  assert.equal(uiRefreshes, 1);
  assert.equal(colonist.task, null);
  assert.equal(colonist.note, 'Sem recursos');
  assert.match(logs.at(-1), /Faltaram recursos/);
});

test('Colonist autonomy snaps sleepers onto bed tiles and releases the bed on wake', () => {
  const context = createContext({
    console,
    state: {
      day: 1,
      hour: 12,
      speed: 1,
      weather: 'limpo',
      objects: [{ id: 'bed-1', type: 'bed', x: 4, y: 4 }],
      colonists: []
    },
    HavenfallContext: {},
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    TILE: 48,
    clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    dist: (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by),
    nearestFreeAdjacent: (x, y) => ({ x: x - 1, y }),
    findPath: () => [],
    assignAutoTask: () => false,
    updateColonist: () => {},
    startSleep: () => false,
    moveAlongPath: () => {},
    handleTaskAtTarget: () => false,
    log: () => {},
    document: {
      addEventListener() {},
      querySelectorAll() { return []; }
    },
    setTimeout(fn) { fn(); },
    ScheduleManager: {
      SCHEDULE: { SLEEP: 0, WORK: 1, LEISURE: 2 },
      getScheduleState: () => 1,
      ensureColonistSchedule: () => Array(24).fill(1),
      normalizeHour: hour => ((Math.floor(hour) % 24) + 24) % 24
    }
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/colonist-vitals-system.js', context);
  runBrowserScript('src/game/systems/colonist-autonomy-system.js', context);

  const colonist = {
    id: 1,
    name: 'Lia',
    x: 3,
    y: 4,
    px: 3 * 48 + 24,
    py: 4 * 48 + 24,
    energy: 10,
    mood: 60,
    hunger: 80,
    health: 100,
    skills: {},
    path: [],
    work: 0
  };
  context.state.colonists.push(colonist);

  assert.equal(context.HavenfallColonistAutonomy.startSleep(colonist, 'test'), true);
  assert.equal(context.state.objects[0].reservedBy, 1);

  context.updateColonist(colonist, 1);

  assert.equal(colonist.x, 4);
  assert.equal(colonist.y, 4);
  assert.equal(context.state.objects[0].occupiedBy, 1);
  assert.equal(colonist.note, 'Dormindo na cama');

  colonist.energy = 97;
  colonist.mood = 60;
  context.updateColonist(colonist, 1);

  assert.equal(colonist.task, null);
  assert.equal(context.state.objects[0].reservedBy, null);
  assert.equal(context.state.objects[0].occupiedBy, null);
});

test('Mob world hit query follows the drawn animal body', () => {
  const noop = () => {};
  const context = createContext({
    console,
    state: {
      mobs: [{ id: 'rabbit-1', type: 'rabbit', x: 2, y: 2, px: 120, py: 120 }],
      wolves: [],
      colonists: []
    },
    HavenfallContext: {},
    TILE: 48,
    uid: () => 'mob-1',
    GameSystems: {
      registerMovementModifier: noop,
      registerTaskHandler: noop,
      registerAutoTaskProvider: noop,
      registerColonistUpdateGuard: noop,
      registerAfterColonistUpdate: noop,
      registerDrawOverlay: noop,
      registerTick: noop
    }
  });

  runBrowserScript('src/game/mobs/mobs.js', context);

  assert.equal(context.getMobAtWorld(120, 140)?.id, 'rabbit-1');
  assert.equal(context.getMobAtWorld(120, 94), null);
});

test('New game config clamps setup values and keeps planet scan stable', () => {
  const context = createContext({
    dom: { inputs: {} },
    localStorage: {
      getItem: () => null,
      setItem: () => {}
    },
    SETTINGS_KEY: 'test-settings'
  });
  runBrowserScript('src/game/core/game-setup.js', context);
  runBrowserScript('src/game/systems/planet-scan-profile.js', context);

  const config = context.ensurePlanetScanOnConfig({
    colonyName: '  Vale   Novo  ',
    seed: 'hvf teste 01',
    colonistCount: 50,
    difficulty: 'hard',
    mapSize: 'giant',
    eventIntensity: 'high',
    resourcesPreset: 'rich',
    sectorProfile: 'water',
    landingPriority: 'resources'
  });
  const same = context.ensurePlanetScanOnConfig(config);
  const changed = context.ensurePlanetScanOnConfig({ ...config, sectorProfile: 'rock' });

  assert.equal(config.colonyName, 'Vale Novo');
  assert.equal(config.seed, 'HVF-TESTE-01');
  assert.equal(config.colonistCount, 8);
  assert.equal(config.sectorProfile, 'water');
  assert.equal(config.landingPriority, 'resources');
  assert.equal(config.planetScan.seed, config.seed);
  assert.equal(config.planetScan.sectorProfile, 'water');
  assert.equal(config.planetScan.landingPriority, 'resources');
  assert.equal(same.planetScan.sectorId, config.planetScan.sectorId);
  assert.equal(changed.planetScan.sectorProfile, 'rock');
});

test('World generator preserves validator failures in world metadata', () => {
  const context = createContext({
    console,
    TILE: 48,
    defaultNewGameConfig: { seed: 'TEST', mapSize: 'large', difficulty: 'normal' },
    getMapSizeDef: () => ({ cols: 8, rows: 8, resourceMultiplier: 1 }),
    hashSeed: text => String(text).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) >>> 0,
    seededRandom: () => () => 0.5,
    createTerrainMap: (cols, rows) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'grass')),
    chooseSpawnPoint: () => ({ x: 4, y: 4 }),
    carveSpawnClearing: () => {},
    generateResourceFields: () => {},
    generatePointsOfInterest: () => [],
    placeStartingCamp: () => {},
    makeExplorationMatrix: (cols, rows) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)),
    makeSpawnPoints: spawn => [spawn],
    generateWeatherPattern: () => [],
    HavenfallEcosystemRules: {},
    HavenfallWorldValidator: {
      validateWorld(world) {
        world.validationVersion = 'validator-test';
        world.validationReport = { version: 'validator-test', fixCount: 1, errorCount: 1, fixes: ['fix'], errors: ['erro real'] };
        return {
          world,
          valid: false,
          playable: false,
          fixCount: 1,
          errorCount: 1,
          fixes: ['fix'],
          errors: ['erro real']
        };
      }
    }
  });
  context.window = context;
  runBrowserScript('src/game/systems/world-generator.js', context);

  const world = context.generateWorldFromSeed({ seed: 'TEST', mapSize: 'large', difficulty: 'normal' });

  assert.equal(world.validated, false);
  assert.equal(world.validationVersion, 'validator-test');
  assert.equal(world.validationReport.valid, false);
  assert.equal(world.validationReport.playable, false);
  assert.equal(world.validationReport.errorCount, 1);
  assert.deepEqual(world.validationReport.errors, ['erro real']);
});

test('Dense geology purge removes loose resources from mountain tiles before gameplay', () => {
  let invalidations = 0;
  const context = createContext({
    state: { world: null, objects: [] },
    GameSystems: { registerTick() {} },
    worldNoise: () => 0.5,
    invalidateSpatialGrid: () => { invalidations += 1; }
  });
  runBrowserScript('src/game/systems/geology-mass-system.js', context);

  const solid = { solid: true, mineable: true };
  const world = {
    cols: 8,
    rows: 8,
    terrain: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 'grass')),
    geologyLayer: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null)),
    naturalRoofLayer: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => false)),
    objects: [
      { id: 'tree-on-rock', type: 'tree', x: 2, y: 2 },
      { id: 'variant-near-rock', type: 'oak_tree', x: 3, y: 2 },
      { id: 'logs-under-roof', type: 'logs', x: 5, y: 5 },
      { id: 'supply-crate-on-rock', type: 'supply_crate', x: 1, y: 1 },
      { id: 'cache-under-roof', type: 'cache', x: 4, y: 4 },
      { id: 'rubble-on-rock', type: 'rubble', x: 1, y: 2 },
      { id: 'safe-berry', type: 'berry', x: 6, y: 6 }
    ]
  };
  world.geologyLayer[1][1] = solid;
  world.geologyLayer[2][1] = solid;
  world.geologyLayer[2][2] = solid;
  world.geologyLayer[2][4] = solid;
  world.naturalRoofLayer[4][4] = true;
  world.naturalRoofLayer[5][5] = true;

  const removed = context.HavenfallGeologyMassSystem.purgeLooseResourcesOnGeology(world);

  assert.equal(removed, 6);
  assert.deepEqual(world.objects.map(obj => obj.id), ['safe-berry']);
  assert.equal(invalidations, 1);
});

test('Forge uses its own workstation sprite instead of fire or stove fallback', () => {
  const context = createContext({
    assetNames: ['campfire', 'stove', 'icon_warn'],
    HavenfallAssets: {
      assets: {
        edificios_forge: { path: 'assets/ui/edificios_forge.png' }
      }
    },
    window: null,
    URLSearchParams: class {
      has() { return false; }
    },
    location: { search: '' },
    console
  });
  context.window = context;
  runBrowserScript('src/game/data/objects.js', context);
  runBrowserScript('src/game/assets/asset-audit.js', context);

  const forgeImg = vm.runInContext('baseObjectDefs.forge.img', context);
  const campfireImg = vm.runInContext('baseObjectDefs.campfire.img', context);
  const stoveImg = vm.runInContext('baseObjectDefs.stove.img', context);
  assert.equal(forgeImg, 'edificios_forge');
  assert.notEqual(forgeImg, campfireImg);
  assert.notEqual(forgeImg, stoveImg);
  assert.equal(context.assetAudit.workstation('forge'), 'edificios_forge');
});

test('Bench sprite scale fits adjacent one-tile placement', () => {
  const context = createContext({
    TILE: 48,
    performance: { now: () => 0 }
  });
  runBrowserScript('src/game/rendering/renderer.js', context);

  const scale = vm.runInContext("objectScale('bench', { width: 310, height: 224, naturalWidth: 310, naturalHeight: 224 })", context);
  const renderedWidth = 310 * scale;
  assert.ok(renderedWidth <= 48 * 0.9);
});

test('GameSystems composes render and collision extension points', () => {
  const context = createContext();
  runBrowserScript('src/game/core/game-systems.js', context);

  const calls = [];
  context.GameSystems.registerTileRenderer('late', (x, y, type) => calls.push(`late:${type}:${x},${y}`), { order: 20 });
  context.GameSystems.registerTileRenderer('early', (x, y, type) => calls.push(`early:${type}:${x},${y}`), { order: 10 });
  context.GameSystems.drawTileRenderers(2, 3, 'grass');
  assert.deepEqual(calls, ['early:grass:2,3', 'late:grass:2,3']);

  const passes = [];
  context.GameSystems.registerTileRenderer('static-floor', (x, y, type) => passes.push(`static:${type}:${x},${y}`), { order: 5, renderPass: 'static' });
  context.GameSystems.registerTileRenderer('dynamic-water', (x, y, type) => passes.push(`dynamic:${type}:${x},${y}`), { order: 6, renderPass: 'dynamic' });
  context.GameSystems.drawTileRenderers(4, 5, 'water', { pass: 'static' });
  context.GameSystems.drawTileRenderers(4, 5, 'water', { pass: 'dynamic' });
  assert.deepEqual(passes, ['static:water:4,5', 'dynamic:water:4,5']);

  context.GameSystems.registerObjectRenderer('miss', () => false, { order: 10 });
  context.GameSystems.registerObjectRenderer('hit', obj => {
    obj.rendered = true;
    return true;
  }, { order: 20 });
  const obj = {};
  assert.equal(context.GameSystems.drawObject(obj), true);
  assert.equal(obj.rendered, true);

  context.GameSystems.registerCollisionProvider('walkable', () => 0, { order: 10 });
  assert.equal(context.GameSystems.collisionAt(1, 1), 0);
  assert.equal(context.GameSystems.pathBlocked(1, 1), false);

  context.GameSystems.registerCollisionProvider('wall', () => 5, { order: 1 });
  assert.equal(context.GameSystems.collisionAt(1, 1), 5);
  assert.equal(context.GameSystems.pathBlocked(1, 1), true);
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
  assert.equal(context.state.resources.wood, 6);
  assert.equal(context.state.resources.stone, 2);
  assert.equal(context.state.items.rope, 3);

  const wall = { id: 'wall-1', type: 'wall', x: 1, y: 2 };
  assert.equal(context.GameState.addObject(wall), wall);
  assert.equal(context.GameState.getObjectById('wall-1'), wall);
  assert.equal(invalidations, 1);
  assert.equal(context.wallIndexDirty, true);

  assert.equal(context.GameState.removeObjectById('wall-1'), wall);
  assert.deepEqual(context.state.objects, []);
  assert.equal(invalidations, 2);
});

test('Lighting system respects built roofs and active workstation sources', () => {
  const grid = (rows, cols, value) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
  const context = createContext({
    console,
    performance: { now: () => 0 },
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    HavenfallContext: {},
    state: {
      hour: 23,
      weather: 'limpo',
      colonists: [{ id: 1, task: { type: 'forge', objId: 'forge-1' } }],
      world: {
        rows: 8,
        cols: 8,
        terrain: grid(8, 8, 'grass'),
        objects: [{ id: 'forge-1', type: 'forge', x: 4, y: 4 }],
        exploration: grid(8, 8, 1),
        builtRoofLayer: grid(8, 8, false),
        naturalRoofLayer: grid(8, 8, false)
      }
    },
    ctx: {
      save() {},
      restore() {},
      fillRect() {},
      set fillStyle(value) { this._fillStyle = value; },
      get fillStyle() { return this._fillStyle; }
    },
    getWorldCols: () => 8,
    getWorldRows: () => 8,
    visibleTileBounds: () => ({ startX: 0, startY: 0, endX: 7, endY: 7 })
  });
  context.state.world.builtRoofLayer[4][4] = true;

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/data/objects.js', context);
  vm.runInContext('this.objectDefs = { ...baseObjectDefs };', context);
  runBrowserScript('src/game/systems/lighting-system.js', context);

  assert.equal(context.LightingSystem.hasRoofAt(4, 4, context.state.world), true);
  assert.equal(context.LightingSystem.collectLightSources(context.state.world).sources.length, 1);

  context.LightingSystem.recomputeLighting(null, context.state.world, 'active-source');
  const activeLight = context.LightingSystem.getLightAt(4, 4, context.state.world);
  assert.ok(activeLight > 0.5);

  context.state.colonists = [];
  context.LightingSystem.invalidate('workstation-idle', context.state.world);
  assert.equal(context.LightingSystem.collectLightSources(context.state.world).sources.length, 0);
  context.LightingSystem.recomputeLighting(null, context.state.world, 'idle-source');
  const idleLight = context.LightingSystem.getLightAt(4, 4, context.state.world);
  assert.ok(idleLight < activeLight);
});

test('World region system only snapshots active regions when region mode is enabled', () => {
  const grid = (rows, cols, value) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
  const context = createContext({
    console,
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    HavenfallContext: {},
    camera: { x: 128 * 48, y: 128 * 48 },
    getMapSizeDef: mapSize => mapSize === 'infinite_chunks'
      ? { chunkMode: true, chunkSize: 32 }
      : { chunkMode: false, chunkSize: 32 }
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/systems/world-region-system.js', context);

  const largeWorld = {
    mapSize: 'large',
    cols: 256,
    rows: 256,
    terrain: grid(256, 256, 'grass'),
    objects: []
  };
  assert.equal(context.WorldRegionSystem.updateActiveRegions(largeWorld).length, 0);
  assert.equal(Object.keys(largeWorld.regions || {}).length, 0);

  const frontierWorld = {
    mapSize: 'infinite_chunks',
    regionMode: true,
    cols: 256,
    rows: 256,
    terrain: grid(256, 256, 'grass'),
    biomes: grid(256, 256, 'forest'),
    exploration: grid(256, 256, 0),
    objects: [{ id: 'ore-1', type: 'ore', x: 126, y: 126 }],
    lightLayer: grid(256, 256, 1)
  };
  const snapshots = context.WorldRegionSystem.snapshotActiveRegions(frontierWorld);
  assert.equal(frontierWorld.activeRegions.length, 9);
  assert.equal(snapshots.length, 9);
  assert.equal(Object.keys(frontierWorld.regions).length, 9);
  assert.ok(Object.keys(frontierWorld.regions).length < 16);
});

test('compactStateForSave strips transient lighting and region caches', () => {
  const context = createContext({
    SAVE_KEY: 'hf-save',
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  });
  runBrowserScript('src/game/runtime/save-load.js', context);

  const compact = context.compactStateForSave({
    world: {
      terrain: [['grass']],
      objects: [{ id: 'obj-1', type: 'campfire', x: 0, y: 0 }],
      regionMode: true,
      regionSize: 64,
      regionSaveVersion: 'region-save-v2',
      lightLayer: [[0.4]],
      lightState: { lastRecomputeAt: 10 },
      lightDirty: true,
      lightVersion: 3,
      lightInvalidationReason: 'debug',
      regions: { '0,0': { objects: [] } },
      activeRegions: ['0,0'],
      activeRegion: { x: 0, y: 0 },
      regionIndexing: false,
      regionSnapshotAt: 20
    }
  });

  assert.equal(compact.world.regionMode, true);
  assert.equal(compact.world.regionSize, 64);
  assert.equal(compact.world.regionSaveVersion, 'region-save-v2');
  assert.equal('lightLayer' in compact.world, false);
  assert.equal('lightState' in compact.world, false);
  assert.equal('regions' in compact.world, false);
  assert.equal('activeRegions' in compact.world, false);
});

test('Biome rebalance gives desert tiles real sand and cactus signatures', () => {
  const hashSeed = value => {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const worldNoise = (seed, x, y, salt) => (hashSeed(`${seed}|${salt}|${x}|${y}`) % 100000) / 100000;
  const context = createContext({
    console,
    hashSeed,
    worldNoise,
    assetAudit: { vegetation: () => null },
    objectDefs: {},
    HavenfallContext: {},
    worldUid: (type, index) => `${type}_${index}`,
    state: { config: { seed: 'TEST' } },
    getMapSizeDef: () => ({ chunkSize: 32, macroBiomeChunks: 2 })
  });
  runBrowserScript('src/game/data/ecosystem-rules.js', context);
  runBrowserScript('src/game/biomes/biome-registry.js', context);
  runBrowserScript('src/game/biomes/biome-forest.js', context);
  runBrowserScript('src/game/biomes/biome-desert.js', context);
  runBrowserScript('src/game/biomes/biome-snow.js', context);
  runBrowserScript('src/game/biomes/biome-engine.js', context);

  const cols = 40;
  const rows = 20;
  const terrain = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 'grass'));
  const biomes = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => x >= 20 ? 'desert' : 'forest'));
  const world = {
    seed: 'TEST',
    cols,
    rows,
    terrain,
    biomes,
    objects: [
      { id: 'tree-1', type: 'tree', x: 24, y: 8 },
      { id: 'berry-1', type: 'berry', x: 28, y: 10 },
      { id: 'bush-1', type: 'bush', x: 31, y: 11 }
    ],
    spawn: { x: 4, y: 4 },
    generationVersion: 'test'
  };

  context.BiomeEngine.installBiomeObjectDefs();
  context.BiomeEngine.rebalanceWorld(world, { seed: 'TEST' });

  const desertSandTiles = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 20; x < cols; x++) {
      if (world.terrain[y][x] === 'sand') desertSandTiles.push(`${x},${y}`);
    }
  }
  const cacti = world.objects.filter(obj => obj.type === 'cactus');

  assert.ok(desertSandTiles.length > 40);
  assert.ok(cacti.length >= 3);
  assert.ok(cacti.every(obj => world.biomes[obj.y][obj.x] === 'desert'));
  assert.ok(cacti.every(obj => ['sand', 'dirt'].includes(world.terrain[obj.y][obj.x])));
  assert.ok(world.objects.some(obj => obj.type === 'palm_tree' && world.biomes[obj.y][obj.x] === 'desert'));
});

