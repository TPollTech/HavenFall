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
  runBrowserScript('src/game/world-systems.js', context);

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
  runBrowserScript('src/game/world-systems.js', context);

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
    GameSystems: { registerTaskHandler: () => {} },
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
  runBrowserScript('src/game/hauling-adv.js', context);

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
  runBrowserScript('src/game/asset-audit.js', context);

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
