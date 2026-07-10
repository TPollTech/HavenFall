'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteScanPolishInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteScanPolishInstalled = true;

  window.HavenfallLandingSiteScanPolish = Object.freeze({
    version: 'stage-driven'
  });
})();
