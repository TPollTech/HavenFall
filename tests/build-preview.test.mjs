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
    fillText() {},
    lineWidth: 1,
    lineCap: 'round',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    globalAlpha: 1
  };
}

test('Floor build preview renders procedurally without sprite dependencies', () => {
  const floorBuilds = {
    floor_dirt: 'packed_dirt',
    floor_wood: 'wood_floor',
    floor_stone: 'stone_floor'
  };

  for (const [buildKey, floorType] of Object.entries(floorBuilds)) {
    const floorCalls = [];
    const context = createContext({
      ctx: createCtxStub(),
      TILE: 32,
      currentBuild: buildKey,
      currentBuildRotation: 0,
      mouseTile: { x: 7, y: 9 },
      buildDefs: {
        [buildKey]: {
          type: 'floor',
          floorType,
          cost: {},
          itemCost: null
        }
      },
      objectDefs: {
        wall: { img: 'wall_wood' },
        door: { img: 'door_wood' }
      },
      images: {},
      hasCost() { return true; },
      hasItems() { return true; },
      canPlaceBuild(key, x, y) {
        assert.equal(key, buildKey);
        assert.equal(x, 7);
        assert.equal(y, 9);
        return true;
      },
      canPlace() {
        throw new Error('generic canPlace fallback should not be used for floors when canPlaceBuild exists');
      },
      drawAsset() {
        throw new Error('drawAsset should not be used for floor previews');
      },
      objectScale() {
        throw new Error('objectScale should not be used for floor previews');
      },
      HavenfallWorkstationRenderer: {
        drawObject() {
          throw new Error('workstation renderer should not be used for floor previews');
        }
      },
      FloorSystem: {
        drawFloorTile(targetCtx, x, y, type) {
          floorCalls.push({ targetCtx, x, y, type });
          return true;
        }
      }
    });

    runBrowserScript('src/game/rendering/renderer.js', context);

    assert.doesNotThrow(() => context.drawBuildPreview(), `expected safe preview for ${buildKey}`);
    assert.deepEqual(
      floorCalls.map(({ x, y, type }) => ({ x, y, type })),
      [{ x: 7, y: 9, type: floorType }],
      `expected procedural floor preview for ${buildKey}`
    );
  }
});
