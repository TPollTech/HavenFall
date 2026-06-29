'use strict';

(() => {
  if (window.HavenfallContext?.performanceRenderHooksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceRenderHooksInstalled = true;

  const nativeResizeGameCanvas = typeof resizeGameCanvas === 'function' ? resizeGameCanvas : null;
  const nativeVisibleTileBounds = typeof visibleTileBounds === 'function' ? visibleTileBounds : null;
  const nativeDraw = typeof draw === 'function' ? draw : null;
  const nativeDrawColonist = typeof drawColonist === 'function' ? drawColonist : null;
  const nativeDrawWolf = typeof drawWolf === 'function' ? drawWolf : null;

  function quality() {
    return window.HavenfallSettings?.quality?.() || {};
  }

  function canvasResolution(cssWidth, cssHeight) {
    if (window.HavenfallSettings?.resolutionSize) return window.HavenfallSettings.resolutionSize(cssWidth, cssHeight);
    return { width: cssWidth, height: cssHeight, scale: 1 };
  }

  if (nativeResizeGameCanvas) {
    resizeGameCanvas = function resizeGameCanvasWithRenderScale(force = false) {
      if (typeof measureRendererLayout !== 'function') return nativeResizeGameCanvas(force);
      measureRendererLayout(force);

      const cssWidth = rendererLayoutCache?.canvasCssWidth || Math.max(320, Math.floor(window.innerWidth));
      const cssHeight = rendererLayoutCache?.canvasCssHeight || Math.max(240, Math.floor(window.innerHeight));
      const internal = canvasResolution(cssWidth, cssHeight);
      const width = Math.max(320, Math.floor(internal.width));
      const height = Math.max(240, Math.floor(internal.height));
      const renderScale = Math.max(0.45, Number(internal.scale || 1));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        measureRendererLayout(true);
      }

      ctx.imageSmoothingEnabled = renderScale >= 0.75;
      viewTransform.scale = camera.zoom * renderScale;
      clampCamera();
      const safe = cameraSafeViewport();
      viewTransform.offsetX = width / 2 - camera.x * viewTransform.scale;
      viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
    };
  }

  if (nativeVisibleTileBounds) {
    visibleTileBounds = function visibleTileBoundsWithPerformancePadding(padding = 2) {
      const tuned = window.HavenfallSettings?.renderPadding?.();
      const finalPadding = Number.isFinite(tuned) && padding <= 2 ? tuned : padding;
      return nativeVisibleTileBounds(finalPadding);
    };
  }

  if (nativeDrawColonist) {
    drawColonist = function drawColonistWithShadowQuality(c) {
      const shadows = quality().shadows || 'simple';
      if (shadows !== 'off') {
        ctx.save();
        ctx.fillStyle = shadows === 'high' ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.18)';
        ctx.beginPath();
        ctx.ellipse(c.px, c.py + 24, shadows === 'high' ? 18 : 14, shadows === 'high' ? 7 : 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      nativeDrawColonist(c);
    };
  }

  if (nativeDrawWolf) {
    drawWolf = function drawWolfWithShadowQuality(w) {
      const shadows = quality().shadows || 'simple';
      if (shadows !== 'off') {
        ctx.save();
        ctx.fillStyle = shadows === 'high' ? 'rgba(0,0,0,.30)' : 'rgba(0,0,0,.18)';
        ctx.beginPath();
        ctx.ellipse(w.px, w.py + 23, shadows === 'high' ? 24 : 18, shadows === 'high' ? 8 : 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      nativeDrawWolf(w);
    };
  }

  if (nativeDraw) {
    draw = function drawWithPerformanceStats() {
      nativeDraw();
      if (!window.HavenfallSettings?.recordRenderStats) return;
      const bounds = typeof visibleTileBounds === 'function' ? visibleTileBounds(0) : null;
      const tilesDrawn = bounds ? Math.max(0, bounds.endX - bounds.startX + 1) * Math.max(0, bounds.endY - bounds.startY + 1) : 0;
      const visibleObjects = (state?.objects || []).reduce((count, obj) => {
        const cx = obj.x * TILE + TILE / 2;
        const cy = obj.y * TILE + TILE / 2;
        return count + (typeof isWorldPointInView === 'function' && isWorldPointInView(cx, cy) ? 1 : 0);
      }, 0);
      const visibleColonists = (state?.colonists || []).filter(c => typeof isWorldPointInView === 'function' && isWorldPointInView(c.px, c.py)).length;
      const visibleMobs = [...(state?.mobs || []), ...(state?.wolves || [])].filter(m => typeof isWorldPointInView === 'function' && isWorldPointInView(m.px || m.x * TILE, m.py || m.y * TILE)).length;
      window.HavenfallSettings.recordRenderStats({ tilesDrawn, entitiesDrawn: visibleObjects + visibleColonists + visibleMobs });
    };
  }

  drawRain = function drawRainWithParticleQuality() {
    if (!state || state.weather !== 'chuva') return;
    const particles = quality().particles || 'medium';
    if (particles === 'off') return;
    const spacingX = particles === 'low' ? 70 : particles === 'high' ? 28 : 42;
    const spacingY = particles === 'low' ? 96 : particles === 'high' ? 44 : 68;
    const alpha = particles === 'low' ? 0.28 : particles === 'high' ? 0.52 : 0.42;
    ctx.save();
    ctx.strokeStyle = `rgba(170, 210, 255, ${alpha})`;
    ctx.lineWidth = particles === 'high' ? 1.2 : 1;
    const b = visibleWorldBounds(TILE * 2);
    const offset = (performance.now() / (particles === 'low' ? 24 : 14)) % 18;
    for (let x = b.left - 20; x < b.right + 30; x += spacingX) {
      for (let y = b.top - 20; y < b.bottom + 30; y += spacingY) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + offset);
        ctx.lineTo(x + offset - 10, y + offset + 18);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  drawFogOfWar = function drawFogOfWarDisabledByPerformanceHooks() {
    return;
  };

  drawNightOverlay = function drawNightOverlayDisabledByPerformanceHooks() {
    return;
  };

  function drawLowQualityWater(x, y, type) {
    if (type !== 'water') return;
    if ((quality().water || 'medium') !== 'low') return;
    const t = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const px = x * t, py = y * t;
    ctx.save();
    ctx.fillStyle = 'rgba(28, 112, 168, .76)';
    ctx.fillRect(px, py, t, t);
    ctx.strokeStyle = 'rgba(3, 7, 18, .28)';
    ctx.strokeRect(px + 0.5, py + 0.5, t - 1, t - 1);
    ctx.restore();
  }

  function applyRendererQualityToggles() {
    const water = quality().water || 'medium';
    window.GameSystems?.setTileRendererEnabled?.('living-world.water', water !== 'low');
  }

  window.GameSystems?.registerTileRenderer?.('performance.low-water', drawLowQualityWater, { order: 6 });
  window.GameSystems?.registerTick?.('performance.render-quality', applyRendererQualityToggles, { order: 2 });
})();