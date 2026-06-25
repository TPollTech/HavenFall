'use strict';

function installQolPatch() {
  const defaults = {
    uiScale: 'normal',
    autosave: 'on',
    showGrid: false,
    cameraSpeed: 720,
    defaultZoom: 1.12
  };

  settings = { ...defaults, ...(settings || {}) };

  function applyRuntimeSettings() {
    document.body.dataset.uiScale = settings.uiScale || 'normal';
    showDebugGrid = !!settings.showGrid;
    camera.speed = Number(settings.cameraSpeed || 720);
  }

  const originalSaveSettings = saveSettings;
  saveSettings = function patchedSaveSettings() {
    originalSaveSettings();
    applyRuntimeSettings();
  };

  function injectQolStyles() {
    if (document.getElementById('qolPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'qolPatchStyles';
    style.textContent = `
      body[data-ui-scale="compact"] { --top-h: 56px; --bottom-h: 164px; }
      body[data-ui-scale="large"] { --top-h: 76px; --bottom-h: 226px; }
      .settings-actions { margin-top: 14px; flex-wrap: wrap; }
      .controls-cheatsheet { font-size: 13px; line-height: 1.55; }
      button:focus-visible, input:focus-visible, select:focus-visible {
        outline: 2px solid rgba(121, 199, 232, .88);
        outline-offset: 2px;
      }
      body.hud-hidden .topbar,
      body.hud-hidden .bottom-command-panel {
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity .12s ease, transform .12s ease;
      }
      body.hud-hidden::after {
        content: "HUD oculto · pressione H para mostrar";
        position: fixed;
        right: 16px;
        bottom: 14px;
        z-index: 20;
        color: rgba(244,239,228,.76);
        background: rgba(8, 11, 16, .58);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 12px;
        backdrop-filter: blur(10px);
      }
    `;
    document.head.appendChild(style);
  }

  function toggleFullscreenMode() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      root.requestFullscreen?.().catch?.(() => log?.('Não foi possível entrar em fullscreen.'));
    } else {
      document.exitFullscreen?.();
    }
  }

  function setHudHidden(hidden, shouldLog = true) {
    document.body.classList.toggle('hud-hidden', !!hidden);
    if (shouldLog && state) log(hidden ? 'HUD oculto. Pressione H para mostrar novamente.' : 'HUD visível.');
  }

  function injectSettingsControls() {
    const grid = document.querySelector('#settingsScreen .form-grid');
    if (!grid || document.getElementById('showGridSelect')) return;

    grid.insertAdjacentHTML('beforeend', `
      <label>Grade de debug
        <select id="showGridSelect">
          <option value="off">Desligada</option>
          <option value="on">Ligada</option>
        </select>
      </label>
      <label>Velocidade da câmera
        <select id="cameraSpeedSelect">
          <option value="560">Lenta</option>
          <option value="720">Normal</option>
          <option value="920">Rápida</option>
          <option value="1180">Muito rápida</option>
        </select>
      </label>
      <label>Zoom padrão
        <select id="defaultZoomSelect">
          <option value="0.85">Afastado</option>
          <option value="1.12">Normal</option>
          <option value="1.35">Aproximado</option>
          <option value="1.65">Bem próximo</option>
        </select>
      </label>
      <label>Modo tela cheia
        <button id="fullscreenToggleBtn" type="button" class="secondary">Alternar fullscreen</button>
      </label>
    `);

    const card = document.querySelector('#settingsScreen .menu-card');
    card?.insertAdjacentHTML('beforeend', `
      <div class="menu-actions row settings-actions">
        <button id="centerCameraBtn" type="button" class="secondary">Centralizar câmera no colono</button>
        <button id="resetViewBtn" type="button" class="secondary">Resetar zoom/câmera</button>
      </div>
      <div class="subtle-box controls-cheatsheet">
        <b>Atalhos:</b> WASD/setas movem a câmera · Shift acelera · Scroll/+/- ajusta zoom · 0 reseta zoom · C centraliza no colono · G liga/desliga grade · H oculta HUD · F alterna fullscreen · ESC pausa.
      </div>
    `);
  }

  function syncSettingsControls() {
    const gridSelect = document.getElementById('showGridSelect');
    const speedSelect = document.getElementById('cameraSpeedSelect');
    const zoomSelect = document.getElementById('defaultZoomSelect');
    if (gridSelect) gridSelect.value = settings.showGrid ? 'on' : 'off';
    if (speedSelect) speedSelect.value = String(settings.cameraSpeed || 720);
    if (zoomSelect) zoomSelect.value = String(settings.defaultZoom || 1.12);
  }

  function attachQolControlEvents() {
    document.getElementById('showGridSelect')?.addEventListener('change', e => {
      settings.showGrid = e.target.value === 'on';
      saveSettings();
      log(settings.showGrid ? 'Grade de debug ligada pelas configurações.' : 'Grade de debug desligada pelas configurações.');
      updateUI(true);
    });

    document.getElementById('cameraSpeedSelect')?.addEventListener('change', e => {
      settings.cameraSpeed = Number(e.target.value || 720);
      saveSettings();
      log(`Velocidade da câmera ajustada para ${settings.cameraSpeed}.`);
    });

    document.getElementById('defaultZoomSelect')?.addEventListener('change', e => {
      settings.defaultZoom = Number(e.target.value || 1.12);
      saveSettings();
      setCameraZoom(settings.defaultZoom);
      log('Zoom padrão atualizado.');
    });

    document.getElementById('fullscreenToggleBtn')?.addEventListener('click', toggleFullscreenMode);
    document.getElementById('centerCameraBtn')?.addEventListener('click', () => {
      centerCameraOnSelectedColonist();
      setScreen(SCREEN.PLAYING);
    });
    document.getElementById('resetViewBtn')?.addEventListener('click', () => {
      setCameraZoom(Number(settings.defaultZoom || 1.12));
      centerCameraOnSelectedColonist();
      setScreen(SCREEN.PLAYING);
    });
  }

  function attachQolShortcuts() {
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreenMode();
        return;
      }
      if (!state || appScreen !== SCREEN.PLAYING) return;
      if (e.code === 'KeyC') {
        e.preventDefault();
        centerCameraOnSelectedColonist();
        return;
      }
      if (e.code === 'KeyH') {
        e.preventDefault();
        setHudHidden(!document.body.classList.contains('hud-hidden'));
        return;
      }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        setCameraZoom(Number(settings.defaultZoom || 1.12));
        centerCameraOnSelectedColonist();
      }
    });
  }

  const originalSetupEventListeners = setupEventListeners;
  setupEventListeners = function patchedSetupEventListeners() {
    injectSettingsControls();
    syncSettingsControls();
    originalSetupEventListeners();
    attachQolControlEvents();
    attachQolShortcuts();
  };

  const originalSetScreen = setScreen;
  setScreen = function patchedSetScreen(screen) {
    originalSetScreen(screen);
    if (screen === SCREEN.SETTINGS) syncSettingsControls();
  };

  injectQolStyles();
  applyRuntimeSettings();
}
