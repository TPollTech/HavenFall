'use strict';

(() => {
  window.DoorState = Object.freeze({ CLOSED: 'closed', OPEN: 'open' });
  window.WallConfig = Object.freeze({
    wood: { key: 'wood', label: 'Madeira', hp: 100, texture_id: 'wall_wood', cost: { wood: 4 }, work: 3 },
    stone: { key: 'stone', label: 'Pedra', hp: 260, texture_id: 'wall_stone', cost: { stone: 6 }, work: 4 },
    metal: { key: 'metal', label: 'Metal', hp: 520, texture_id: 'wall_metal', cost: { stone: 2, metal: 6 }, work: 5 }
  });

  window.tileToWorld = function tileToWorld(x, y, anchor = 'center') {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const left = Math.round(Number(x) || 0) * tileSize;
    const top = Math.round(Number(y) || 0) * tileSize;
    if (anchor === 'top-left') return { x: left, y: top };
    if (anchor === 'bottom-center') return { x: left + tileSize / 2, y: top + tileSize };
    return { x: left + tileSize / 2, y: top + tileSize / 2 };
  };

  window.worldToTile = function worldToTile(worldX, worldY) {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    return { x: Math.floor((Number(worldX) || 0) / tileSize), y: Math.floor((Number(worldY) || 0) / tileSize) };
  };
})();
