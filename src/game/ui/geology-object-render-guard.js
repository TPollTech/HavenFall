'use strict';

(() => {
  if (window.HavenfallContext?.geologyObjectRenderGuardInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.geologyObjectRenderGuardInstalled = true;

  const LOOSE_RESOURCE_TYPES = new Set(['tree', 'bush', 'berry', 'sapling', 'invasive_weed', 'logs', 'rock', 'ore']);
  const TALL_RESOURCE_TYPES = new Set(['tree', 'bush', 'berry', 'sapling', 'invasive_weed', 'logs']);

  function solidRockAt(x, y) {
    return !!(typeof getRockAt === 'function' && getRockAt(x, y)?.solid);
  }

  function solidNear(x, y, radius = 1) {
    for (let yy = y - radius; yy <= y + radius; yy++) {
      for (let xx = x - radius; xx <= x + radius; xx++) {
        if (solidRockAt(xx, yy)) return true;
      }
    }
    return false;
  }

  function objectInvalidatedByMountain(obj) {
    if (!obj || !LOOSE_RESOURCE_TYPES.has(obj.type)) return false;
    const x = Math.round(obj.x);
    const y = Math.round(obj.y);
    if (solidRockAt(x, y)) return true;
    if (typeof hasNaturalRoofAt === 'function' && hasNaturalRoofAt(x, y)) return true;
    if (TALL_RESOURCE_TYPES.has(obj.type) && (solidNear(x, y, 1) || solidNear(x, y - 1, 1))) return true;
    return false;
  }

  if (typeof drawObject === 'function') {
    const nativeDrawObject = drawObject;
    drawObject = function drawObjectWithGeologyGuard(obj) {
      if (objectInvalidatedByMountain(obj)) return;
      return nativeDrawObject(obj);
    };
  }

  window.HavenfallGeologyObjectRenderGuard = { objectInvalidatedByMountain };
})();