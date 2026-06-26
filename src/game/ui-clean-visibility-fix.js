'use strict';

(() => {
  function isGameplayScreen() {
    return typeof SCREEN !== 'undefined' && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED);
  }

  function applyCleanUiVisibility() {
    const visible = isGameplayScreen();
    const top = document.getElementById('top-resource-bar');
    const dock = document.getElementById('bottom-navigation-dock');
    const backdrop = document.getElementById('ui-modal-backdrop');

    if (top) top.style.display = visible ? 'flex' : 'none';
    if (dock) dock.style.display = visible ? 'flex' : 'none';
    if (!visible) {
      if (backdrop) backdrop.classList.remove('is-active');
      document.querySelectorAll('.game-popup-modal.is-active').forEach(modal => {
        modal.classList.remove('is-active');
        modal.setAttribute('aria-hidden', 'true');
      });
      document.querySelectorAll('#bottom-navigation-dock .is-active').forEach(btn => btn.classList.remove('is-active'));
    }
  }

  if (typeof setScreen === 'function' && !window.HavenfallContext?.cleanUiVisibilityScreenPatched) {
    const originalSetScreen = setScreen;
    setScreen = screen => {
      originalSetScreen(screen);
      applyCleanUiVisibility();
    };
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.cleanUiVisibilityScreenPatched = true;
  }

  if (typeof updateUI === 'function' && !window.HavenfallContext?.cleanUiVisibilityUpdatePatched) {
    const originalUpdateUI = updateUI;
    updateUI = force => {
      originalUpdateUI(force);
      applyCleanUiVisibility();
    };
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.cleanUiVisibilityUpdatePatched = true;
  }

  window.applyCleanUiVisibility = applyCleanUiVisibility;
  applyCleanUiVisibility();
})();
