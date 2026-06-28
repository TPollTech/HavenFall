'use strict';

(() => {
  window.Havenfall = window.Havenfall || {};

  Object.assign(window.Havenfall, {
    version: '1.9-refactor',
    systems: window.GameSystems,
    stateApi: window.GameState,
    defs: {
      research: researchDefs,
      researchOrder,
      priorities: priorityDefs,
      priorityOrder,
      objects: objectDefs,
      builds: buildDefs,
      items: itemDefs,
      recipes: recipeDefs,
      stations: stationLabels
    }
  });

  Object.defineProperties(window.Havenfall, {
    state: { configurable: true, enumerable: true, get: () => state },
    screen: { configurable: true, enumerable: true, get: () => appScreen }
  });
})();
