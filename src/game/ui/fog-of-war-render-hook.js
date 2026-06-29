'use strict';

(() => {
  if (window.HavenfallContext?.visibilityOverlayDisabled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.visibilityOverlayDisabled = true;

  drawFogOfWar = function drawVisibilityOverlayDisabled() {
    return;
  };
})();