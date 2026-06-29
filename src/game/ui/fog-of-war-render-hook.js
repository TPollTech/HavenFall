'use strict';

(() => {
  if (window.HavenfallContext?.fogOfWarRenderHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.fogOfWarRenderHookInstalled = true;

  drawFogOfWar = function drawSoftFogOfWar(bounds = visibleTileBounds(1)) {
    if (!state?.world?.exploration) return;
    ctx.save();
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        const v = state.world.exploration[y]?.[x] || 0;
        if (v === 2) continue;
        ctx.fillStyle = v === 1 ? 'rgba(4, 8, 13, .46)' : 'rgba(2, 5, 10, .78)';
        ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
        if (v === 0 && ((x * 17 + y * 31) % 9 === 0)) {
          ctx.fillStyle = 'rgba(180, 210, 220, .035)';
          ctx.fillRect(x * TILE + 8, y * TILE + 8, TILE - 16, TILE - 16);
        }
      }
    }
    ctx.restore();
  };

})();