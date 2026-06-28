'use strict';

(() => {
  if (window.HavenfallContext?.fogOfWarRenderHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.fogOfWarRenderHookInstalled = true;

  drawFogOfWar = function drawStrictFogOfWar(bounds = visibleTileBounds(1)) {
    if (!state?.world?.exploration) return;
    ctx.save();
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        const v = state.world.exploration[y]?.[x] || 0;
        if (v === 2) continue;
        ctx.fillStyle = v === 1 ? 'rgba(4, 8, 13, .58)' : 'rgba(0, 0, 0, 1)';
        ctx.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
      }
    }
    ctx.restore();
  };

  if (typeof draw !== 'function') return;
  const nativeDraw = draw;

  draw = function drawWithFinalFogMask() {
    nativeDraw();
    if (!state || appScreen !== SCREEN.PLAYING || !state.world?.exploration) return;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    drawFogOfWar(visibleTileBounds(2));
    ctx.restore();
  };
})();
