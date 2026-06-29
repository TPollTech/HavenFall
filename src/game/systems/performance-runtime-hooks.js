'use strict';

(() => {
  if (window.HavenfallContext?.performanceRuntimeHooksInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceRuntimeHooksInstalled = true;

  let timer = 0;
  const hostileTypes = new Set(['wolf', 'spider', 'blood_wolf']);

  function animalCap() {
    const value = window.HavenfallSettings?.get?.('performance.maxAnimals', 'medium') || 'medium';
    return ({ low: 14, medium: 28, high: 48, unlimited: Infinity })[value] ?? 28;
  }

  function distanceFromFocus(mob) {
    const focusX = camera?.x || selectedColonist?.()?.px || 0;
    const focusY = camera?.y || selectedColonist?.()?.py || 0;
    const px = Number(mob.px || mob.x * TILE || 0);
    const py = Number(mob.py || mob.y * TILE || 0);
    return Math.hypot(px - focusX, py - focusY);
  }

  function enforceAnimalCap() {
    if (!state?.mobs?.length) return;
    const cap = animalCap();
    if (!Number.isFinite(cap)) return;
    const passive = state.mobs.filter(mob => !hostileTypes.has(mob.type));
    if (passive.length <= cap) return;

    const keep = new Set(
      passive
        .sort((a, b) => distanceFromFocus(a) - distanceFromFocus(b))
        .slice(0, cap)
        .map(mob => mob.id)
    );

    state.mobs = state.mobs.filter(mob => hostileTypes.has(mob.type) || keep.has(mob.id));
  }

  function applyRuntimePerformance(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    timer += dt;
    if (timer < 1) return;
    timer = 0;
    enforceAnimalCap();
  }

  window.GameSystems?.registerTick?.('performance.runtime', applyRuntimePerformance, { order: 4 });
})();