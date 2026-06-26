'use strict';

function installMultiplayerHostPublishFixPatch() {
  if (window.__havenfallHostPublishFixInstalled) return;
  window.__havenfallHostPublishFixInstalled = true;

  let lastForcedPublish = 0;
  let forcing = false;
  let allowHostUntil = 0;
  let pendingHost = false;

  function allowManualHost() {
    allowHostUntil = Date.now() + 7000;
    pendingHost = true;
  }

  function allowSetupHost() {
    allowHostUntil = Date.now() + 7000;
    pendingHost = false;
    window.havenfallAllowHostFromSetup = true;
  }

  function isManualHostAllowed() {
    return Date.now() < allowHostUntil || window.havenfallAllowHostFromSetup === true;
  }

  function isHostMode() {
    return !(sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join');
  }

  function hasRealWorld() {
    return !!state && !!activeSession && state.config?.seed && state.config.seed !== 'preview-menu';
  }

  async function forcePublish(reason = 'manual') {
    if (forcing || !isHostMode() || !hasRealWorld()) return false;
    if (Date.now() - lastForcedPublish < 250) return false;
    forcing = true;
    lastForcedPublish = Date.now();
    try {
      const res = await fetch('/api/multiplayer/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: state, reason })
      });
      if (res.ok) {
        const data = await res.json();
        const pill = document.getElementById('multiplayerPill');
        if (pill) pill.textContent = `Host online · rev ${data.revision || 0}`;
        return true;
      }
    } catch (_) {
      // servidor antigo/offline
    } finally {
      forcing = false;
    }
    return false;
  }

  function publishSoon(reason) {
    setTimeout(() => forcePublish(reason), 40);
    setTimeout(() => forcePublish(reason), 350);
    setTimeout(() => forcePublish(reason), 950);
  }

  document.addEventListener('click', event => {
    if (event.target?.closest?.('#onlineHostCleanBtn, #hostCurrentWorldBtn')) allowManualHost();
  }, true);

  const previousHostOnline = window.havenfallHostOnline;
  window.havenfallHostOnline = function fixedHavenfallHostOnline() {
    if (!isManualHostAllowed()) {
      const pill = document.getElementById('multiplayerPill');
      if (pill) pill.textContent = 'Offline local';
      return false;
    }
    pendingHost = false;
    sessionStorage.setItem('havenfall-online-mode', 'host');
    window.havenfallOnlineMode = 'host';
    window.havenfallOnlineSessionActive = true;
    const result = previousHostOnline?.apply(this, arguments);
    window.havenfallAllowHostFromSetup = false;
    publishSoon('host-online');
    return result;
  };

  const previousSetScreen = setScreen;
  setScreen = function hostPublishAwareSetScreen(screen) {
    previousSetScreen(screen);
    if (screen === SCREEN.PLAYING && pendingHost && isManualHostAllowed()) {
      pendingHost = false;
      setTimeout(() => window.havenfallHostOnline?.(), 40);
    }
    if (screen === SCREEN.PLAYING && isHostMode() && isManualHostAllowed()) publishSoon('entered-playing');
  };

  window.havenfallForcePublishWorld = forcePublish;
  window.havenfallAllowManualHostStart = allowSetupHost;
}

if (typeof window !== 'undefined' && typeof setScreen === 'function') {
  installMultiplayerHostPublishFixPatch();
}
