'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};
  if (window.HavenfallContext.startingLoadoutSystemInstalled) return;
  window.HavenfallContext.startingLoadoutSystemInstalled = true;

  const STARTING_LOADOUT = Object.freeze({
    COLONISTS_ONLY: 'colonists_only'
  });

  function shouldSkipStartingCamp(config = null) {
    const value = config?.startingLoadout || window.HavenfallStartingLoadout?.mode || STARTING_LOADOUT.COLONISTS_ONLY;
    return value === STARTING_LOADOUT.COLONISTS_ONLY;
  }

  function applyStartingLoadoutPolicy() {
    const original = typeof placeStartingCamp === 'function' ? placeStartingCamp : null;
    window.HavenfallStartingLoadout = Object.freeze({
      mode: STARTING_LOADOUT.COLONISTS_ONLY,
      version: 'starting-loadout-colonists-only-v1',
      originalPlaceStartingCamp: original
    });

    if (original) {
      placeStartingCamp = function placeStartingCampColonistsOnly(ctx = {}) {
        if (shouldSkipStartingCamp(ctx.config)) return [];
        return original(ctx);
      };
      window.placeStartingCamp = placeStartingCamp;
    }
  }

  applyStartingLoadoutPolicy();
})();
