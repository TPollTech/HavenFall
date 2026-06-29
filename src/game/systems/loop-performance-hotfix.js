'use strict';

(() => {
  if (window.HavenfallContext?.loopPerformanceHotfixInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.loopPerformanceHotfixInstalled = true;

  function installUpdateWorldFastPath() {
    if (typeof updateWorld !== 'function' || window.HavenfallContext.updateWorldFastPathInstalled) return;
    window.HavenfallContext.updateWorldFastPathInstalled = true;

    let cropPulse = 0;
    let goalsPulse = 0;

    updateWorld = function updateWorldFastPath(dt) {
      if (!state || appScreen !== SCREEN.PLAYING) return;
      const speed = Number(state.speed || 1);
      const tick = dt * speed;
      const previousHour = Math.floor(state.hour || 0);

      state.hour += tick * TIME_SPEED;
      if (state.hour >= 24) {
        state.day += Math.floor(state.hour / 24);
        state.hour %= 24;
        state.eventDoneToday = false;
        log(`A colônia chegou ao Dia ${state.day}.`);
      }

      const currentHour = Math.floor(state.hour || 0);
      if (currentHour !== previousHour && typeof window.HavenfallUI?.refreshDockPanel === 'function') {
        window.HavenfallUI.refreshDockPanel('schedule');
      }

      if (!state.eventDoneToday && state.hour > 7.5) {
        state.eventDoneToday = true;
        randomEvent();
      }

      const intensityChance = ({ low: 0.0008, normal: 0.0018, high: 0.0035 })[state.config?.eventIntensity || 'normal'] || 0.0018;
      if (Math.random() < intensityChance * tick) randomEvent();

      if (state.weatherTime > 0) {
        state.weatherTime -= tick;
        if (state.weatherTime <= 0) {
          state.weather = 'limpo';
          log('O tempo abriu.');
        }
      }

      cropPulse += tick;
      if (cropPulse >= 0.25) {
        const cropTick = cropPulse;
        cropPulse = 0;
        const objects = state.objects || [];
        const rainBonus = state.weather === 'chuva' ? 2.1 : 1;
        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i];
          if (obj.type === 'crop') obj.growth = clamp((obj.growth || 0) + cropTick * 0.85 * rainBonus, 0, 100);
        }
      }

      updateDoorAutoClose(dt);

      const colonists = state.colonists || [];
      for (let i = 0; i < colonists.length; i++) {
        const c = colonists[i];
        try {
          updateColonist(c, dt);
        } catch (err) {
          console.error('[Colonist Update Error]', { colonist: c, task: c?.task, error: err });
          c.task = null;
          c.path = [];
          c.work = 0;
          c.note = 'Tarefa cancelada por erro de IA';
        }
      }

      goalsPulse += dt;
      if (goalsPulse >= 0.5) {
        goalsPulse = 0;
        checkGoals();
      }
    };
  }

  function installDrawFastPath() {
    if (typeof draw !== 'function' || window.HavenfallContext.drawFastPathInstalled) return;
    window.HavenfallContext.drawFastPathInstalled = true;

    function visibleWorldRectFromTransform(padding = TILE * 3) {
      const scale = viewTransform.scale || 1;
      const safe = cameraSafeViewport();
      return {
        left: Math.max(0, (-viewTransform.offsetX / scale) - padding),
        top: Math.max(0, (-viewTransform.offsetY / scale) - padding),
        right: Math.min(getWorldWidth(), ((safe.width - viewTransform.offsetX) / scale) + padding),
        bottom: Math.min(getWorldHeight(), ((safe.height - viewTransform.offsetY) / scale) + padding)
      };
    }

    function pointInRect(px, py, rect) {
      return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
    }

    draw = function drawFastPath() {
      resizeGameCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#070b11';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
      ctx.scale(viewTransform.scale, viewTransform.scale);

      const bounds = visibleTileBounds(2);
      for (let y = bounds.startY; y <= bounds.endY; y++) {
        const row = state.terrain[y];
        if (!row) continue;
        for (let x = bounds.startX; x <= bounds.endX; x++) drawTile(x, y, row[x] || 'grass');
      }

      if (showDebugGrid || settings?.showGrid) drawGrid(bounds);

      const renderList = rendererScratch.renderList;
      renderList.length = 0;
      const rect = visibleWorldRectFromTransform(TILE * 4);
      const objectMinX = Math.floor(rect.left / TILE) - 3;
      const objectMaxX = Math.ceil(rect.right / TILE) + 3;
      const objectMinY = Math.floor(rect.top / TILE) - 4;
      const objectMaxY = Math.ceil(rect.bottom / TILE) + 3;

      const objects = state.objects || [];
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (obj.x < objectMinX || obj.x > objectMaxX || obj.y < objectMinY || obj.y > objectMaxY) continue;
        if (!isTileDiscovered(obj.x, obj.y)) continue;
        renderList.push({ kind: 'obj', y: obj.y, data: obj });
      }

      const wolves = state.wolves || [];
      for (let i = 0; i < wolves.length; i++) {
        const wolf = wolves[i];
        if (pointInRect(wolf.px, wolf.py, rect)) renderList.push({ kind: 'wolf', y: wolf.py / TILE, data: wolf });
      }

      const colonists = state.colonists || [];
      for (let i = 0; i < colonists.length; i++) {
        const c = colonists[i];
        if (pointInRect(c.px, c.py, rect)) renderList.push({ kind: 'colonist', y: c.py / TILE, data: c });
      }

      if (renderList.length > 1) renderList.sort((a, b) => a.y - b.y);

      for (let i = 0; i < renderList.length; i++) {
        const item = renderList[i];
        if (item.kind === 'obj') drawObject(item.data);
        else if (item.kind === 'wolf') drawWolf(item.data);
        else if (item.kind === 'colonist') drawColonist(item.data);
      }

      drawPoiMarkers();
      drawBuildPreview();
      drawGatherSelection();
      window.GameSystems?.drawWorldOverlays(bounds);
      drawFogOfWar(bounds);
      drawRain();
      ctx.restore();
      window.GameSystems?.drawRegisteredOverlays();

      if (window.HavenfallSettings?.recordRenderStats) {
        const tilesDrawn = Math.max(0, bounds.endX - bounds.startX + 1) * Math.max(0, bounds.endY - bounds.startY + 1);
        window.HavenfallSettings.recordRenderStats({ tilesDrawn, entitiesDrawn: renderList.length });
      }
    };
  }

  installUpdateWorldFastPath();
  installDrawFastPath();
  console.info('[Performance] Loop principal otimizado.');
})();