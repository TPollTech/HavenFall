'use strict';

(() => {
  if (window.HavenfallContext?.performanceSettingsBackfixInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceSettingsBackfixInstalled = true;

  if (typeof loadSettings === 'function' && !window.HavenfallContext.performanceSettingsLoadPatched) {
    const nativeLoadSettings = loadSettings;
    loadSettings = function loadSettingsAndRefreshPerformanceUi() {
      const loaded = nativeLoadSettings();
      setTimeout(() => window.HavenfallUI?.renderPerformanceSettingsScreen?.(), 0);
      return loaded;
    };
    window.loadSettings = loadSettings;
    window.HavenfallContext.performanceSettingsLoadPatched = true;
  }

  document.addEventListener('click', event => {
    const back = event.target?.closest?.('#settingsScreen #settingsBackBtn');
    if (!back) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof goBackFromSettings === 'function') goBackFromSettings();
    else if (typeof setScreen === 'function') setScreen(SCREEN.MAIN_MENU);
  }, true);
})();