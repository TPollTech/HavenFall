'use strict';

(() => {
  if (window.HavenfallContext?.inspectionInputHookInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.inspectionInputHookInstalled = true;

  const ANIMAL_VISUAL_PROFILES = Object.freeze({
    rabbit: { rx: 24, ry: 24, oy: 14 },
    squirrel: { rx: 23, ry: 24, oy: 16 },
    turtle: { rx: 24, ry: 22, oy: 16 },
    chicken: { rx: 23, ry: 24, oy: 16 },
    duck: { rx: 23, ry: 24, oy: 16 },
    turkey: { rx: 25, ry: 25, oy: 16 },
    deer: { rx: 36, ry: 31, oy: 12 },
    goat: { rx: 34, ry: 30, oy: 13 },
    sheep: { rx: 34, ry: 30, oy: 13 },
    pig: { rx: 34, ry: 30, oy: 13 },
    cow: { rx: 42, ry: 34, oy: 13 }
  });

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  function shouldLetNativeCanvasClick(event) {
    if (event.button !== 0 || appScreen !== SCREEN.PLAYING || !state) return true;
    if (currentBuild) return true;
    if (suppressNextClick) return true;
    if (gatherSelection?.active) return true;
    if (event.shiftKey) return true;
    if (typeof isOrderToolActive === 'function' && isOrderToolActive('mine')) return true;
    return false;
  }

  function canvasWorldPoint(event) {
    if (!canvas || !viewTransform || !canvas.width || !canvas.height) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (event.clientX - rect.left) * (canvas.width / rect.width);
    const py = (event.clientY - rect.top) * (canvas.height / rect.height);
    const scale = Math.max(0.01, Number(viewTransform.scale) || 1);
    return {
      wx: (px - viewTransform.offsetX) / scale,
      wy: (py - viewTransform.offsetY) / scale
    };
  }

  function isHostileMob(mob) {
    if (!mob) return false;
    if (mob.hostile === true) return true;
    if (typeof isHostileMobType === 'function') return isHostileMobType(mob.type);
    return ['wolf', 'blood_wolf', 'spider', 'raider', 'hostile'].includes(mob.type);
  }

  function animalVisualProfile(mob) {
    return ANIMAL_VISUAL_PROFILES[mob?.type] || { rx: 28, ry: 28, oy: 14 };
  }

  function animalHitScore(mob, point, tile) {
    if (!mob || isHostileMob(mob)) return Infinity;
    const tx = Math.round(Number(mob.x));
    const ty = Math.round(Number(mob.y));
    if (typeof isTileVisible === 'function' && !isTileVisible(tx, ty)) return Infinity;

    const profile = animalVisualProfile(mob);
    const cx = Number(mob.px ?? (tx * TILE + TILE / 2));
    const cy = Number(mob.py ?? (ty * TILE + TILE / 2)) + profile.oy;
    const dx = Math.abs(point.wx - cx);
    const dy = Math.abs(point.wy - cy);
    const ellipse = (dx / Math.max(1, profile.rx)) ** 2 + (dy / Math.max(1, profile.ry)) ** 2;
    if (ellipse <= 1.35) return ellipse;

    const sameTile = tile && Math.abs(tile.x - tx) <= 0 && Math.abs(tile.y - ty) <= 0;
    const nearTile = tile && Math.abs(tile.x - tx) <= 1 && Math.abs(tile.y - ty) <= 1;
    if (sameTile) return 1.45 + Math.hypot(dx, dy) / 120;
    if (nearTile && Math.hypot(dx, dy) <= Math.max(profile.rx, profile.ry) + 18) return 1.8 + Math.hypot(dx, dy) / 140;
    return Infinity;
  }

  function findAnimalAtClick(event, tile) {
    if (!state?.mobs?.length || !window.InspectionPanel?.selectTarget) return null;
    const point = canvasWorldPoint(event);
    if (!point) return null;
    let best = null;
    let bestScore = Infinity;
    for (const mob of state.mobs) {
      const score = animalHitScore(mob, point, tile);
      if (score < bestScore) {
        best = mob;
        bestScore = score;
      }
    }
    return Number.isFinite(bestScore) ? best : null;
  }

  function inspectCanvasClickCapture(event) {
    if (shouldLetNativeCanvasClick(event)) return;
    if (!window.InspectionPanel?.inspectCanvasEvent) return;
    const tile = typeof tileFromEvent === 'function' ? tileFromEvent(event) : null;
    if (!tile || (typeof isInside === 'function' && !isInside(tile.x, tile.y))) return;

    const animal = findAnimalAtClick(event, tile);
    if (animal) {
      window.InspectionPanel.selectTarget({ kind: 'animal', id: animal.id, x: animal.x, y: animal.y });
      hideContextMenu?.();
      event.preventDefault();
      event.stopImmediatePropagation();
      updateUI?.(true);
      return;
    }

    if (!window.InspectionPanel.inspectCanvasEvent(event, { tile })) return;
    hideContextMenu?.();
    event.preventDefault();
    event.stopImmediatePropagation();
    updateUI?.(true);
  }

  function blockLegacyDoubleClick(event) {
    if (appScreen !== SCREEN.PLAYING || !state || currentBuild) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function openInspectionFromHudClick(event) {
    const select = event.target?.closest?.('[data-select-colonist]');
    if (!select || !state || !window.InspectionPanel?.selectById) return;
    const id = Number(select.dataset.selectColonist);
    if (!Number.isFinite(id)) return;
    setTimeout(() => {
      selectedColonistId = id;
      window.InspectionPanel.selectById('colonist', id);
      updateUI?.(true);
    }, 0);
  }

  function closeInspectionOnEsc(event) {
    if (isTypingTarget() || event.key !== 'Escape') return;
    if (currentBuild || appScreen !== SCREEN.PLAYING || !window.InspectionPanel?.isOpen?.()) return;
    window.InspectionPanel.clear();
    event.preventDefault();
    event.stopImmediatePropagation();
    updateUI?.(true);
  }

  canvas?.addEventListener?.('click', inspectCanvasClickCapture, true);
  canvas?.addEventListener?.('dblclick', blockLegacyDoubleClick, true);
  document.addEventListener('click', openInspectionFromHudClick, true);
  window.addEventListener('keydown', closeInspectionOnEsc, true);
})();