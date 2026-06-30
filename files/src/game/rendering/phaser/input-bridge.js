'use strict';

(() => {
  function currentScale() {
    const vt = typeof viewTransform !== 'undefined' ? viewTransform : window.Havenfall?.viewTransform;
    return Number(vt?.scale || camera?.zoom || 1) || 1;
  }

  function currentOffset() {
    const vt = typeof viewTransform !== 'undefined' ? viewTransform : window.Havenfall?.viewTransform;
    return { x: Number(vt?.offsetX || 0), y: Number(vt?.offsetY || 0) };
  }

  function tileSize() {
    if (typeof getTileSize === 'function') return getTileSize();
    return typeof TILE !== 'undefined' ? TILE : 48;
  }

  function screenToWorld(x, y) {
    const scale = currentScale();
    const offset = currentOffset();
    return {
      x: (Number(x) - offset.x) / scale,
      y: (Number(y) - offset.y) / scale
    };
  }

  function worldToScreen(x, y) {
    const scale = currentScale();
    const offset = currentOffset();
    return {
      x: Number(x) * scale + offset.x,
      y: Number(y) * scale + offset.y
    };
  }

  function worldToTile(x, y) {
    const size = tileSize();
    return {
      x: Math.floor(Number(x) / size),
      y: Math.floor(Number(y) / size)
    };
  }

  function screenToTile(x, y) {
    const world = screenToWorld(x, y);
    return worldToTile(world.x, world.y);
  }

  window.HavenfallPhaserInputBridge = Object.freeze({
    version: 'phaser-input-bridge-v1',
    screenToWorld,
    worldToScreen,
    worldToTile,
    screenToTile
  });
})();
