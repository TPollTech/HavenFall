'use strict';

(() => {
  if (window.HavenfallContext?.performanceSettingsBackfixInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceSettingsBackfixInstalled = true;

  document.addEventListener('click', event => {
    const back = event.target?.closest?.('#settingsScreen #settingsBackBtn');
    if (!back) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof goBackFromSettings === 'function') goBackFromSettings();
    else if (typeof setScreen === 'function') setScreen(SCREEN.MAIN_MENU);
  }, true);
})();