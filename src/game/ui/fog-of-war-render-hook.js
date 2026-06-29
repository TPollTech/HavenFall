'use strict';

(() => {
  if (window.HavenfallContext?.fogOfWarRenderHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.fogOfWarRenderHookInstalled = true;

  drawFogOfWar = function drawReadableFogOfWar(bounds = visibleTileBounds(1)) {
    if (!state?.world?.exploration) return;
    ctx.save();
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        const v = state.world.exploration[y]?.[x] || 0;
        if (v === 2) continue;
        const unseen = v === 0;
        ctx.fillStyle = unseen ? 'rgba(3, 7, 18, .86)' : 'rgba(4, 8, 13, .48)';
        ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
        if (unseen && ((x + y) % 2 === 0)) {
          ctx.fillStyle = 'rgba(148, 163, 184, .035)';
          ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
        }
      }
    }
    ctx.restore();
  };

})();