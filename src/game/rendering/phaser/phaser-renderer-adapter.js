'use strict';

(() => {
  const VERSION = 'phaser-terrain-adapter-v1';
  const PHASER_SCRIPT_ID = 'havenfall-phaser-runtime';
  const PHASER_SRC = 'node_modules/phaser/dist/phaser.min.js';
  const TERRAIN_TYPES = Object.freeze(['grass', 'dirt', 'sand', 'stone', 'water']);
  const TERRAIN_COLORS = Object.freeze({
    grass: 0x586d2d,
    dirt: 0x7a5738,
    sand: 0xaa914f,
    stone: 0x626966,
    water: 0x1f6f88
  });

  let game = null;
  let scene = null;
  let worldLayer = null;
  let active = false;
  let booting = false;
  let failed = false;
  let warned = false;
  let pendingState = null;
  let drawBridgeInstalled = false;
  let originalCanvasDraw = null;

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
    console.warn(`[Phaser Renderer] ${message}`, error || '');
  }

  function canvasElement() {
    return document.getElementById('game');
  }

  function viewportElement() {
    return document.querySelector('.gameplay-viewport') || canvasElement()?.parentElement || document.body;
  }

  function ensureLayer() {
    const viewport = viewportElement();
    const canvas = canvasElement();
    let layer = document.getElementById('phaserGameLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'phaserGameLayer';
      layer.setAttribute('aria-hidden', 'true');
      viewport.insertBefore(layer, canvas || viewport.firstChild);
    }
    return layer;
  }

  function readGlobalFunction(name) {
    try {
      if (typeof window[name] === 'function') return window[name];
    } catch (_) {}
    try {
      return Function(`return typeof ${name} !== 'undefined' ? ${name} : null;`)();
    } catch (_) {
      return null;
    }
  }

  function setGlobalValue(name, value) {
    try { window[name] = value; } catch (_) {}
    try { Function('value', `${name} = value;`)(value); } catch (_) {}
  }

  function currentState() {
    return window.Havenfall?.state || pendingState || null;
  }

  function currentCamera() {
    return window.Havenfall?.camera || null;
  }

  function currentViewTransform() {
    return window.Havenfall?.viewTransform || null;
  }

  function tileSize() {
    const value = readGlobalFunction('getTileSize')?.();
    return Number(value || window.Havenfall?.state?.world?.tileSize || 48) || 48;
  }

  function worldCols(state) {
    const value = readGlobalFunction('getWorldCols')?.();
    return Number(value || state?.world?.cols || state?.terrain?.[0]?.length || 1) || 1;
  }

  function worldRows(state) {
    const value = readGlobalFunction('getWorldRows')?.();
    return Number(value || state?.world?.rows || state?.terrain?.length || 1) || 1;
  }

  function canvasSize() {
    const canvas = canvasElement();
    const rect = canvas?.getBoundingClientRect?.();
    return {
      width: Math.max(320, Math.floor(canvas?.width || rect?.width || window.innerWidth || 800)),
      height: Math.max(240, Math.floor(canvas?.height || rect?.height || window.innerHeight || 600))
    };
  }

  function normalizeTerrain(type) {
    const value = String(type || 'grass').toLowerCase();
    return TERRAIN_COLORS[value] ? value : 'grass';
  }

  function textureKey(type) {
    return `hf_tile_${normalizeTerrain(type)}`;
  }

  function sourceImageFor(type) {
    const normalized = normalizeTerrain(type);
    try {
      const imageMap = typeof images !== 'undefined' ? images : null;
      const img = imageMap?.[`tile_${normalized}`] || (normalized === 'water' ? null : imageMap?.tile_grass);
      if (!img || img.dataset?.missingAsset) return null;
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      return width > 1 && height > 1 ? img : null;
    } catch (_) {
      return null;
    }
  }

  function ensureFallbackTexture(targetScene, type) {
    const key = textureKey(type);
    if (targetScene.textures.exists(key)) return key;

    const size = tileSize();
    const graphics = targetScene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(TERRAIN_COLORS[normalizeTerrain(type)] || TERRAIN_COLORS.grass, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.lineStyle(1, 0x000000, 0.12);
    graphics.strokeRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
    return key;
  }

  function ensureTerrainTexture(targetScene, type) {
    const key = textureKey(type);
    if (targetScene.textures.exists(key)) return key;

    const img = sourceImageFor(type);
    if (img) {
      try {
        targetScene.textures.addImage(key, img);
        return key;
      } catch (err) {
        console.warn(`[Phaser Renderer] Falha ao registrar textura ${key}. Usando fallback.`, err);
      }
    }

    return ensureFallbackTexture(targetScene, type);
  }

  function ensureTerrainTextures(targetScene) {
    for (const type of TERRAIN_TYPES) ensureTerrainTexture(targetScene, type);
  }

  function visibleBounds(state) {
    const visibleTileBounds = readGlobalFunction('visibleTileBounds');
    if (visibleTileBounds) return visibleTileBounds(3);

    return {
      startX: 0,
      startY: 0,
      endX: Math.max(0, worldCols(state) - 1),
      endY: Math.max(0, worldRows(state) - 1)
    };
  }

  function createWorldLayer(targetScene) {
    const activeTiles = new Map();
    const pool = [];

    function acquireSprite() {
      const sprite = pool.pop() || targetScene.add.image(0, 0, textureKey('grass'));
      sprite.setOrigin(0, 0);
      sprite.setDepth(0);
      sprite.setVisible(true);
      return sprite;
    }

    function releaseSprite(id, sprite) {
      sprite.setVisible(false);
      sprite.removeData?.('terrainKey');
      activeTiles.delete(id);
      pool.push(sprite);
    }

    function sync(nextState) {
      if (!nextState?.terrain?.length) return;

      const bounds = visibleBounds(nextState);
      const size = tileSize();
      const overdraw = 1.4;
      const displaySize = size + overdraw * 2;
      const seen = new Set();

      for (let y = bounds.startY; y <= bounds.endY; y++) {
        const row = nextState.terrain[y];
        if (!row) continue;

        for (let x = bounds.startX; x <= bounds.endX; x++) {
          const terrainType = row[x] || 'grass';
          const id = `${x}:${y}`;
          seen.add(id);

          const texture = ensureTerrainTexture(targetScene, terrainType);
          let sprite = activeTiles.get(id);
          if (!sprite) {
            sprite = acquireSprite();
            activeTiles.set(id, sprite);
          }

          if (sprite.texture?.key !== texture) sprite.setTexture(texture);
          sprite.setPosition(x * size - overdraw, y * size - overdraw);
          sprite.setDisplaySize(displaySize, displaySize);
          sprite.setVisible(true);
        }
      }

      for (const [id, sprite] of [...activeTiles.entries()]) {
        if (!seen.has(id)) releaseSprite(id, sprite);
      }

      window.HavenfallPhaserStats = {
        version: VERSION,
        activeTiles: activeTiles.size,
        pooledTiles: pool.length,
        bounds: { ...bounds },
        updatedAt: Date.now()
      };
    }

    return Object.freeze({ sync });
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

  function syncCamera() {
    if (!scene) return;

    const viewTransform = currentViewTransform();
    const camera = currentCamera();
    const scale = Number(viewTransform?.scale || camera?.zoom || 1) || 1;
    const size = canvasSize();
    const scrollX = -Number(viewTransform?.offsetX || 0) / scale;
    const scrollY = -Number(viewTransform?.offsetY || 0) / scale;

    const phaserCamera = scene.cameras.main;
    phaserCamera.setViewport(0, 0, size.width, size.height);
    phaserCamera.setZoom(scale);
    phaserCamera.setScroll(scrollX, scrollY);
  }

  function createGame() {
    if (game || active) return;
    if (!window.Phaser) throw new Error('Phaser não está disponível.');

    const layer = ensureLayer();
    const size = canvasSize();
    layer.style.width = `${size.width}px`;
    layer.style.height = `${size.height}px`;

    const sceneConfig = {
      key: 'HavenfallPhaserTerrainScene',
      create() {
        scene = this;
        ensureTerrainTextures(scene);
        worldLayer = createWorldLayer(scene);
        scene.cameras.main.setRoundPixels(false);
        active = true;
        booting = false;
        document.body.classList.add('phaser-visual-active');
        resize();
        if (pendingState) sync(pendingState);
        console.info('[Phaser Renderer] Terreno via Phaser ativo; Canvas preservado como overlay.');
      }
    };

    game = new window.Phaser.Game({
      type: window.Phaser.AUTO,
      parent: layer,
      width: size.width,
      height: size.height,
      backgroundColor: '#070b11',
      transparent: false,
      scene: sceneConfig,
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
        warnOnce('Falha ao iniciar o renderer Phaser. Fallback Canvas mantido.', err);
        stop();
      });
    return false;
  }

  function stop() {
    active = false;
    booting = false;
    scene = null;
    worldLayer = null;
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
    syncCamera();
  }

  function sync(nextState) {
    pendingState = nextState || currentState();
    if (!optIn()) return false;
    if (!active) {
      start();
      return false;
    }
    if (!scene || !worldLayer) return false;

    try {
      resize();
      syncCamera();
      worldLayer.sync(pendingState);
      return true;
    } catch (err) {
      failed = true;
      warnOnce('Erro durante sync do renderer Phaser. Fallback Canvas reativado.', err);
      stop();
      return false;
    }
  }

  function screenToWorld(x, y) {
    const viewTransform = currentViewTransform();
    const scale = Number(viewTransform?.scale || currentCamera()?.zoom || 1) || 1;
    return {
      x: (Number(x) - Number(viewTransform?.offsetX || 0)) / scale,
      y: (Number(y) - Number(viewTransform?.offsetY || 0)) / scale
    };
  }

  function worldToScreen(x, y) {
    const viewTransform = currentViewTransform();
    const scale = Number(viewTransform?.scale || currentCamera()?.zoom || 1) || 1;
    return {
      x: Number(x) * scale + Number(viewTransform?.offsetX || 0),
      y: Number(y) * scale + Number(viewTransform?.offsetY || 0)
    };
  }

  function worldToTile(x, y) {
    const size = tileSize();
    return {
      x: Math.floor(Number(x) / size),
      y: Math.floor(Number(y) / size)
    };
  }

  function drawCanvasOverlay(originalDraw, args) {
    const canvas = canvasElement();
    const context = canvas?.getContext?.('2d');
    const previousDrawTile = readGlobalFunction('drawTile');
    const previousFillRect = context?.fillRect;
    let skippedBaseFill = false;

    if (!canvas || !context || typeof previousFillRect !== 'function' || typeof previousDrawTile !== 'function') {
      return originalDraw.apply(window, args);
    }

    setGlobalValue('drawTile', (x, y, type) => {
      window.GameSystems?.drawTileRenderers?.(x, y, type);
    });

    context.fillRect = function patchedFillRect(x, y, width, height) {
      const isBaseFill = !skippedBaseFill
        && Number(x) === 0
        && Number(y) === 0
        && Math.abs(Number(width) - canvas.width) <= 1
        && Math.abs(Number(height) - canvas.height) <= 1;

      if (isBaseFill) {
        skippedBaseFill = true;
        return undefined;
      }

      return previousFillRect.apply(this, arguments);
    };

    try {
      return originalDraw.apply(window, args);
    } finally {
      context.fillRect = previousFillRect;
      setGlobalValue('drawTile', previousDrawTile);
    }
  }

  function installDrawBridge() {
    if (drawBridgeInstalled) return true;

    const draw = readGlobalFunction('draw');
    if (typeof draw !== 'function') return false;
    if (draw.__havenfallPhaserBridge === true) {
      drawBridgeInstalled = true;
      return true;
    }

    originalCanvasDraw = draw;
    const bridgedDraw = function havenfallPhaserHybridDraw() {
      if (!optIn()) return originalCanvasDraw.apply(window, arguments);

      const synced = sync(currentState());
      if (!synced || !isActive()) return originalCanvasDraw.apply(window, arguments);

      return drawCanvasOverlay(originalCanvasDraw, arguments);
    };

    bridgedDraw.__havenfallPhaserBridge = true;
    bridgedDraw.__originalCanvasDraw = originalCanvasDraw;
    setGlobalValue('draw', bridgedDraw);
    drawBridgeInstalled = true;
    return true;
  }

  function installWhenReady() {
    const startedAt = Date.now();
    const tick = () => {
      if (installDrawBridge()) return;
      if (Date.now() - startedAt > 30000) {
        warnOnce('Não encontrei draw() para instalar o bridge Phaser. Fallback Canvas mantido.');
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  function isActive() {
    return !!active && !!scene && !!game;
  }

  window.HavenfallPhaser = Object.freeze({
    version: VERSION,
    start,
    stop,
    sync,
    resize,
    isActive,
    isOptIn: optIn,
    screenToWorld,
    worldToScreen,
    worldToTile,
    _installDrawBridge: installDrawBridge
  });

  window.addEventListener('resize', () => resize());
  installWhenReady();
})();
