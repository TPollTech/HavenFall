'use strict';

(() => {
  if (window.HavenfallContext?.performanceSettingsNavigationInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceSettingsNavigationInstalled = true;

  function refreshSettingsScreenIfVisible() {
    const screen = document.getElementById('settingsScreen');
    if (!screen || !screen.classList.contains('active')) return;
    window.HavenfallUI?.renderPerformanceSettingsScreen?.();
  }

  document.addEventListener('click', event => {
    const back = event.target?.closest?.('#settingsScreen #settingsBackBtn');
    if (!back) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof goBackFromSettings === 'function') goBackFromSettings();
    else if (typeof setScreen === 'function') setScreen(SCREEN.MAIN_MENU);
  }, true);

  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.refreshSettingsScreenIfVisible = refreshSettingsScreenIfVisible;
})();
