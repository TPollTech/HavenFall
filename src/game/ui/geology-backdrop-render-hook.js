'use strict';

(() => {
  if (window.HavenfallContext?.geologyBackdropTileHooked) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.geologyBackdropTileHooked = true;

  if (typeof drawTile !== 'function') return;
  const nativeDrawTile = drawTile;

  function rockColor(rock) {
    const defs = window.GeologySystem?.ROCK_DEFS || {};
    return (defs[rock?.type] || defs.granite)?.color || '#4b5563';
  }

  function drawRockBackdropAt(x, y) {
    if (appScreen !== SCREEN.PLAYING || !state?.world) return;
    const rock = typeof getRockAt === 'function' ? getRockAt(x, y) : null;
    if (!rock?.solid) return;
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = rockColor(rock);
    ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(x * TILE + 2, y * TILE + TILE * 0.55, TILE - 4, TILE * 0.38);
    ctx.restore();
  }

  drawTile = function drawTileWithMountainBackdrop(x, y, type) {
    nativeDrawTile(x, y, type);
    drawRockBackdropAt(x, y);
  };
})();
