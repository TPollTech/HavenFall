'use strict';

(() => {
  if (window.HavenfallContext?.landingSiteScanUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.landingSiteScanUiInstalled = true;

  window.HavenfallLandingSiteScanUI = Object.freeze({
    version: 'stage-driven'
  });
})();
