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
  context.addEventListener = context.addEventListener || (() => {});
  return context;
}

function grid(rows, cols, value = 'grass') {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function createMinimalNode() {
  return {
    id: '',
    hidden: false,
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    classList: {
      values: new Set(),
      add(...names) { names.forEach(name => this.values.add(name)); },
      remove(...names) { names.forEach(name => this.values.delete(name)); },
      contains(name) { return this.values.has(name); }
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    insertBefore(node) {
      this.children.push(node);
      return node;
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function createMinimalDocument() {
  const elements = {};
  const head = createMinimalNode();
  const body = createMinimalNode();
  const register = node => {
    if (node?.id) elements[node.id] = node;
    return node;
  };
  head.appendChild = node => register(node);
  body.appendChild = node => register(node);
  body.insertBefore = node => register(node);
  return {
    head,
    body,
    activeElement: null,
    createElement() {
      const node = createMinimalNode();
      return node;
    },
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function createLocalStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}

test('Runtime debug snapshot collects provider data and panel history', () => {
  const terrain = grid(8, 8, 'grass');
  const context = createContext({
    console,
    document: createMinimalDocument(),
    localStorage: createLocalStorage(),
    canvas: { width: 800, height: 600 },
    state: {
      day: 3,
      hour: 9.5,
      runtimeMode: 'gameplay',
      terrain,
      objects: [],
      colonists: [],
      mobs: [],
      wolves: [],
      world: { cols: 8, rows: 8, terrain, objects: [], spawn: { x: 2, y: 2 } }
    },
    appScreen: 'playing',
    mouseTile: { x: 2, y: 3 },
    addEventListener() {}
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/runtime/runtime-diagnostics.js', context);

  context.HavenfallDebugRuntime.registerProvider('test.provider', () => ({
    sections: [{ title: 'Provider', lines: ['linha de teste'] }],
    world: [{ kind: 'tile', x: 2, y: 3, color: '#ffffff' }]
  }), { flags: ['floorAdjacency'] });

  context.HavenfallDebugRuntime.setFlag('floorAdjacency', true);
  context.HavenfallDebugRuntime.recordPanelOpen({ key: 'tasks', origin: 'unit-test' });

  const snapshot = context.HavenfallDebugRuntime.snapshot({ startX: 0, startY: 0, endX: 7, endY: 7 });

  assert.equal(snapshot.world.length, 1);
  assert.equal(snapshot.panel.last.key, 'tasks');
  assert.equal(snapshot.panel.last.origin, 'unit-test');
  assert.ok(snapshot.sections.some(section => section.title === 'Runtime'));
  assert.ok(snapshot.sections.some(section => section.title === 'Paineis'));
  assert.ok(snapshot.sections.some(section => section.title === 'Provider'));
});

test('Floor debug provider exposes adjacency mask and orientation for focused tile', () => {
  const terrain = grid(5, 5, 'grass');
  const context = createContext({
    console,
    document: createMinimalDocument(),
    localStorage: createLocalStorage(),
    TILE: 48,
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    ctx: {},
    state: {
      terrain,
      objects: [],
      colonists: [],
      mobs: [],
      wolves: [],
      world: { cols: 5, rows: 5, terrain, objects: [], spawn: { x: 2, y: 2 } }
    },
    buildDefs: {},
    objectDefs: {},
    mouseTile: { x: 1, y: 1 },
    invalidateSpatialGrid() {}
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/runtime/runtime-diagnostics.js', context);
  runBrowserScript('src/game/systems/floor-system.js', context);

  context.setFloorAt(1, 1, 'wood_floor');
  context.setFloorAt(1, 0, 'wood_floor');
  context.setFloorAt(2, 1, 'wood_floor');
  context.HavenfallDebugRuntime.setFlag('floorAdjacency', true);

  const snapshot = context.HavenfallDebugRuntime.snapshot({ startX: 0, startY: 0, endX: 4, endY: 4 });
  const section = snapshot.sections.find(entry => entry.title === 'Piso em foco');

  assert.ok(section);
  assert.ok(section.lines.includes('orientacao horizontal'));
  assert.ok(section.lines.includes('adjacencia NE--'));
  assert.ok(snapshot.world.some(entry => entry.kind === 'tile' && entry.x === 1 && entry.y === 1));
});

test('Simple object asset debug provider reports resolved asset for focused object', () => {
  const context = createContext({
    console,
    document: createMinimalDocument(),
    localStorage: createLocalStorage(),
    TILE: 48,
    ctx: {},
    buildDefs: {},
    objectDefs: { bed: { img: 'bed_asset' } },
    images: {
      bed_asset: { naturalWidth: 64, naturalHeight: 64, src: 'assets/bed_asset.png' }
    },
    state: {
      objects: [{ id: 'bed-1', type: 'bed', x: 3, y: 4 }],
      colonists: [],
      mobs: [],
      wolves: [],
      world: { cols: 8, rows: 8, objects: [] }
    },
    mouseTile: { x: 3, y: 4 }
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/runtime/runtime-diagnostics.js', context);
  runBrowserScript('src/game/rendering/simple-object-renderer.js', context);

  context.HavenfallDebugRuntime.setFlag('objectAssets', true);
  const snapshot = context.HavenfallDebugRuntime.snapshot({ startX: 0, startY: 0, endX: 7, endY: 7 });
  const section = snapshot.sections.find(entry => entry.title === 'Asset em foco');

  assert.ok(section);
  assert.ok(section.lines.includes('asset bed_asset'));
  assert.ok(section.lines.includes('status asset pronto'));
});

test('Mob hitbox debug provider exposes the focused creature body box', () => {
  const context = createContext({
    console,
    document: createMinimalDocument(),
    localStorage: createLocalStorage(),
    TILE: 48,
    state: {
      mobs: [{ id: 'rabbit-1', type: 'rabbit', x: 2, y: 2, px: 120, py: 120 }],
      wolves: [],
      colonists: []
    },
    HavenfallContext: {},
    uid: () => 'mob-1',
    mouseTile: { x: 2, y: 2 }
  });

  runBrowserScript('src/game/core/game-systems.js', context);
  runBrowserScript('src/game/runtime/runtime-diagnostics.js', context);
  runBrowserScript('src/game/mobs/mobs.js', context);

  context.HavenfallDebugRuntime.setFlag('animalHitboxes', true);
  const snapshot = context.HavenfallDebugRuntime.snapshot({ startX: 0, startY: 0, endX: 6, endY: 6 });
  const section = snapshot.sections.find(entry => entry.title === 'Hitbox animal');
  const hitbox = snapshot.world.find(entry => entry.kind === 'rect');

  assert.ok(section);
  assert.ok(section.lines[0].includes('Coelho'));
  assert.equal(hitbox.width, 30);
  assert.equal(hitbox.height, 32);
});
