'use strict';

function installOnlineManualHostPatch() {
  if (window.__havenfallManualHostPatchInstalled) return;
  window.__havenfallManualHostPatchInstalled = true;

  let allowHostUntil = 0;
  let pendingHost = false;

  function allowManualHost() {
    allowHostUntil = Date.now() + 6000;
    pendingHost = true;
  }

  function isAllowedManualHost() {
    return Date.now() < allowHostUntil;
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#onlineHostCleanBtn, #hostCurrentWorldBtn')) allowManualHost();
  }, true);

  const originalHostOnline = window.havenfallHostOnline;
  if (typeof originalHostOnline === 'function') {
    window.havenfallHostOnline = function manualOnlyHostOnline() {
      if (!isAllowedManualHost()) {
        const pill = document.getElementById('multiplayerPill');
        if (pill) pill.textContent = 'Offline local';
        return false;
      }
      pendingHost = false;
      return originalHostOnline.apply(this, arguments);
    };
  }

  const originalSetScreen = setScreen;
  setScreen = function manualHostSetScreen(screen) {
    originalSetScreen(screen);
    if (screen === SCREEN.PLAYING && pendingHost && isAllowedManualHost()) {
      pendingHost = false;
      setTimeout(() => window.havenfallHostOnline?.(), 40);
    }
  };
}

if (typeof window !== 'undefined' && typeof setScreen === 'function') {
  installOnlineManualHostPatch();
}
