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

function createCtxStub() {
  return {
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    arc() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    translate() {},
    rotate() {},
    scale() {},
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    setLineDash() {},
    lineWidth: 1,
    lineCap: 'round',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1
  };
}

function createAnimalRendererContext(extra = {}) {
  const context = createContext({
    ctx: createCtxStub(),
    drawProgress() {},
    ...extra
  });
  runBrowserScript('src/game/rendering/pawns/pawn-core.js', context);
  runBrowserScript('src/game/rendering/pawns/pawn-style.js', context);
  runBrowserScript('src/game/rendering/pawns/animal-renderer.js', context);
  return context;
}

function makeMob(type) {
  return {
    id: `mob_${type}_test`,
    type,
    px: 100,
    py: 100,
    dir: 'left',
    hp: 10,
    maxHp: 10
  };
}

test('Animal renderer draws each passive fauna species without errors', () => {
  const context = createAnimalRendererContext();
  const passiveTypes = [
    'rabbit',
    'deer',
    'goat',
    'sheep',
    'pig',
    'cow',
    'chicken',
    'duck',
    'turkey',
    'squirrel',
    'turtle'
  ];

  for (const type of passiveTypes) {
    assert.equal(
      context.HavenfallAnimalRenderer.drawMob(makeMob(type)),
      true,
      `expected renderer to support ${type}`
    );
  }
});

test('Animal renderer covers every passive mob type from spawn config', () => {
  const context = createAnimalRendererContext({
    GameSystems: {
      registerMovementModifier() {},
      registerTaskHandler() {},
      registerAutoTaskProvider() {},
      registerColonistUpdateGuard() {},
      registerAfterColonistUpdate() {},
      registerDrawOverlay() {},
      registerTick() {}
    },
    HavenfallContext: {},
    SCREEN: { PLAYING: 'playing' },
    appScreen: 'playing',
    state: {
      mobs: [],
      wolves: [],
      colonists: []
    }
  });

  runBrowserScript('src/game/mobs/mobs.js', context);

  const passiveTypes = Object.entries(context.mobSpawnConfig)
    .filter(([, cfg]) => cfg?.hostile === false)
    .map(([type]) => type);

  assert.ok(passiveTypes.length > 0, 'expected passive types to be present in mobSpawnConfig');

  for (const type of passiveTypes) {
    assert.equal(
      context.HavenfallAnimalRenderer.drawMob(makeMob(type)),
      true,
      `expected renderer coverage for passive type ${type}`
    );
  }
});
