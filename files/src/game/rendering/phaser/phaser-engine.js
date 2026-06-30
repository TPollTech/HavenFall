'use strict';

(() => {
  const ENGINE_VERSION = 'phaser-visual-layer-v1';
  const PHASER_SCRIPT_ID = 'havenfall-phaser-runtime';
  const PHASER_SRC = 'node_modules/phaser/dist/phaser.min.js';
  let game = null;
  let scene = null;
  let active = false;
  let booting = false;
  let failed = false;
  let warned = false;
  let pendingState = null;

  function optIn() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('phaser') === '1') return true;
      if (params.get('renderer') === 'phaser') return true;
      if (window.HAVENFALL_USE_PHASER_RENDERER === true) return true;
      if (window.localStorage?.getItem?.('havenfall:phaser') === '1') return true;
    } catch (_) {}
    return false;
  }

  function warnOnce(message, error = null) {
    if (warned) return;
    warned = true;
    console.warn(`[Phaser V1] ${message}`, error || '');
  }

  function viewportElement() {
    return document.querySelector('.gameplay-viewport') || canvas?.parentElement || document.body;
  }

  function ensureLayer() {
    const viewport = viewportElement();
    let layer = document.getElementById('phaserGameLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'phaserGameLayer';
      layer.setAttribute('aria-hidden', 'true');
      viewport.insertBefore(layer, canvas || viewport.firstChild);
    }
    return layer;
  }

  function loadPhaserLibrary() {
    if (window.Phaser) return Promise.resolve(window.Phaser);
    const existing = document.getElementById(PHASER_SCRIPT_ID);
    if (existing?.dataset.loaded === 'true') return Promise.resolve(window.Phaser);

    return new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      script.id = PHASER_SCRIPT_ID;
      script.src = PHASER_SRC;
      script.onload = () => {
        script.dataset.loaded = 'true';
        window.Phaser ? resolve(window.Phaser) : reject(new Error('Phaser carregou, mas window.Phaser ficou ausente.'));
      };
      script.onerror = () => reject(new Error(`Falha ao carregar ${PHASER_SRC}. Rode npm install antes de testar ?phaser=1.`));
      if (!existing) document.body.appendChild(script);
    });
  }

  function canvasSize() {
    const rect = canvas?.getBoundingClientRect?.();
    return {
      width: Math.max(320, Math.floor(canvas?.width || rect?.width || window.innerWidth || 800)),
      height: Math.max(240, Math.floor(canvas?.height || rect?.height || window.innerHeight || 600))
    };
  }

  function createGame() {
    if (game || active) return;
    if (!window.Phaser || !window.HavenfallPhaserScene) throw new Error('Phaser ou HavenfallPhaserScene não estão disponíveis.');

    const layer = ensureLayer();
    const size = canvasSize();
    layer.style.width = `${size.width}px`;
    layer.style.height = `${size.height}px`;

    game = new window.Phaser.Game({
      type: window.Phaser.AUTO,
      parent: layer,
      width: size.width,
      height: size.height,
      backgroundColor: '#070b11',
      transparent: false,
      scene: [window.HavenfallPhaserScene],
      physics: { default: false },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false,
        powerPreference: 'high-performance'
      },
      scale: {
        mode: window.Phaser.Scale.NONE,
        autoCenter: window.Phaser.Scale.NO_CENTER
      }
    });
  }

  function start() {
    if (active) return true;
    if (failed || booting || !optIn()) return false;

    booting = true;
    loadPhaserLibrary()
      .then(() => createGame())
      .catch(err => {
        failed = true;
        booting = false;
        active = false;
        warnOnce('Falha ao iniciar renderer Phaser. Fallback Canvas mantido.', err);
        stop();
      });
    return false;
  }

  function stop() {
    active = false;
    booting = false;
    scene = null;
    document.body.classList.remove('phaser-visual-active');
    const layer = document.getElementById('phaserGameLayer');
    if (game) {
      try { game.destroy(true); } catch (err) { warnOnce('Falha ao destruir instância Phaser.', err); }
    }
    game = null;
    if (layer) layer.innerHTML = '';
  }

  function resize() {
    const layer = document.getElementById('phaserGameLayer');
    if (!layer || !game) return;
    const size = canvasSize();
    layer.style.width = `${size.width}px`;
    layer.style.height = `${size.height}px`;
    game.scale?.resize?.(size.width, size.height);
    game.renderer?.resize?.(size.width, size.height);
    scene?.syncCamera?.();
  }

  function sync(nextState) {
    pendingState = nextState || state;
    if (!active) {
      start();
      return false;
    }
    if (!scene) return false;

    try {
      resize();
      scene.syncState(pendingState);
      return true;
    } catch (err) {
      failed = true;
      warnOnce('Erro durante sync do renderer Phaser. Fallback Canvas reativado.', err);
      stop();
      return false;
    }
  }

  function isActive() {
    return !!active && !!scene && !!game;
  }

  function registerScene(nextScene) {
    scene = nextScene;
    active = true;
    booting = false;
    document.body.classList.add('phaser-visual-active');
    resize();
    if (pendingState) scene.syncState(pendingState);
    console.info(`[Phaser V1] Renderer visual ativo: terreno via Phaser, Canvas em overlay.`);
  }

  function playSound() { return false; }
  function playAnimation() { return false; }

  window.HavenfallPhaser = Object.freeze({
    version: ENGINE_VERSION,
    start,
    stop,
    sync,
    resize,
    isActive,
    isOptIn: optIn,
    screenToWorld: (...args) => window.HavenfallPhaserInputBridge?.screenToWorld?.(...args),
    worldToTile: (...args) => window.HavenfallPhaserInputBridge?.worldToTile?.(...args),
    worldToScreen: (...args) => window.HavenfallPhaserInputBridge?.worldToScreen?.(...args),
    playSound,
    playAnimation,
    _registerScene: registerScene
  });
})();
