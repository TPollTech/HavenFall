'use strict';

(() => {
  const STORAGE_KEY = typeof SETTINGS_KEY !== 'undefined' ? SETTINGS_KEY : 'havenfall-v1-settings';

  const defaultSettings = Object.freeze({
    uiScale: 'normal',
    autosave: 'on',
    showGrid: false,
    video: {
      displayMode: 'windowed',
      resolution: 'auto',
      renderScale: 1,
      targetFPS: 60,
      vsync: 'auto'
    },
    graphics: {
      preset: 'medium',
      shadows: 'simple',
      particles: 'medium',
      waterQuality: 'medium',
      fogQuality: 'medium',
      uiAnimations: 'on'
    },
    performance: {
      renderDistance: 'medium',
      livingWorldUpdateRate: 'medium',
      maxAnimals: 'medium',
      offscreenSimulation: 'reduced',
      pathfindingQuality: 'balanced',
      batterySaver: false
    },
    interface: {
      fpsOverlay: 'off',
      density: 'normal',
      fontSize: 'normal'
    },
    controls: {
      controlMode: 'auto',
      interact: 'KeyE',
      map: 'KeyM'
    },
    audio: {
      enabled: 'on',
      masterVolume: 0.8,
      sfxVolume: 0.85,
      ambientVolume: 0.55,
      uiVolume: 0.7,
      rain: 'normal'
    }
  });

  const presets = Object.freeze({
    potato: {
      label: 'Muito baixo',
      video: { renderScale: 0.5, targetFPS: 30, vsync: 'off' },
      graphics: { preset: 'potato', shadows: 'off', particles: 'off', waterQuality: 'low', fogQuality: 'low', uiAnimations: 'off' },
      performance: { renderDistance: 'short', livingWorldUpdateRate: 'low', maxAnimals: 'low', offscreenSimulation: 'minimal', pathfindingQuality: 'eco', batterySaver: true }
    },
    low: {
      label: 'Baixo',
      video: { renderScale: 0.67, targetFPS: 45, vsync: 'auto' },
      graphics: { preset: 'low', shadows: 'off', particles: 'low', waterQuality: 'low', fogQuality: 'low', uiAnimations: 'reduced' },
      performance: { renderDistance: 'short', livingWorldUpdateRate: 'low', maxAnimals: 'medium', offscreenSimulation: 'minimal', pathfindingQuality: 'eco', batterySaver: false }
    },
    medium: {
      label: 'Médio',
      video: { renderScale: 0.85, targetFPS: 60, vsync: 'auto' },
      graphics: { preset: 'medium', shadows: 'simple', particles: 'medium', waterQuality: 'medium', fogQuality: 'medium', uiAnimations: 'on' },
      performance: { renderDistance: 'medium', livingWorldUpdateRate: 'medium', maxAnimals: 'medium', offscreenSimulation: 'reduced', pathfindingQuality: 'balanced', batterySaver: false }
    },
    high: {
      label: 'Alto',
      video: { renderScale: 1, targetFPS: 60, vsync: 'on' },
      graphics: { preset: 'high', shadows: 'high', particles: 'high', waterQuality: 'high', fogQuality: 'high', uiAnimations: 'on' },
      performance: { renderDistance: 'long', livingWorldUpdateRate: 'high', maxAnimals: 'high', offscreenSimulation: 'complete', pathfindingQuality: 'high', batterySaver: false }
    },
    ultra: {
      label: 'Ultra',
      video: { renderScale: 1.25, targetFPS: 120, vsync: 'on' },
      graphics: { preset: 'ultra', shadows: 'high', particles: 'high', waterQuality: 'high', fogQuality: 'high', uiAnimations: 'on' },
      performance: { renderDistance: 'very_long', livingWorldUpdateRate: 'high', maxAnimals: 'unlimited', offscreenSimulation: 'complete', pathfindingQuality: 'high', batterySaver: false }
    }
  });

  const metrics = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    systemsMs: 0,
    renderMs: 0,
    uiMs: 0,
    tilesDrawn: 0,
    chunksDrawn: 0,
    entitiesDrawn: 0,
    objects: 0,
    mobs: 0,
    pathMs: 0,
    pathCalls: 0,
    pathCacheHits: 0,
    pathQueued: 0,
    colonistsActive: 0,
    colonistsDeferred: 0,
    colonistsTotal: 0,
    npcsActive: 0,
    activeChunks: 0,
    worldGenMs: 0,
    initialStateMs: 0,
    hardwareProfile: 'medium',
    hardwareThreads: 0,
    simulationProfile: 'balanced',
    lightMs: 0,
    lightSources: 0,
    lightTiles: 0,
    lastMetricAt: performance.now(),
    frameCount: 0,
    lastAllowedFrameAt: 0
  };

  let currentSettings = null;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function mergeSettings(base, incoming) {
    const out = deepClone(base);
    for (const [key, value] of Object.entries(incoming || {})) {
      if (isPlainObject(value) && isPlainObject(out[key])) out[key] = mergeSettings(out[key], value);
      else out[key] = value;
    }
    return out;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function allowed(value, list, fallback) {
    return list.includes(value) ? value : fallback;
  }

  function normalizeSettings(input = {}) {
    const merged = mergeSettings(defaultSettings, input);
    if (!isPlainObject(merged.audio)) {
      merged.audio = { ...defaultSettings.audio, enabled: merged.audio === 'off' ? 'off' : 'on' };
    }
    merged.uiScale = allowed(merged.uiScale, ['compact', 'normal', 'large'], 'normal');
    merged.autosave = allowed(merged.autosave, ['on', 'off'], 'on');
    merged.showGrid = !!merged.showGrid;

    merged.video.displayMode = allowed(merged.video.displayMode, ['windowed', 'fullscreen', 'borderless', 'maximized'], 'windowed');
    merged.video.resolution = allowed(merged.video.resolution, ['auto', '1280x720', '1600x900', '1920x1080', '2560x1440', '3840x2160'], 'auto');
    merged.video.renderScale = clampNumber(merged.video.renderScale, 0.45, 1.5, 1);
    merged.video.targetFPS = merged.video.targetFPS === 'unlimited' ? 'unlimited' : clampNumber(merged.video.targetFPS, 20, 144, 60);
    merged.video.vsync = allowed(merged.video.vsync, ['auto', 'on', 'off'], 'auto');

    merged.graphics.preset = allowed(merged.graphics.preset, ['custom', 'potato', 'low', 'medium', 'high', 'ultra'], 'medium');
    merged.graphics.shadows = allowed(merged.graphics.shadows, ['off', 'simple', 'high'], 'simple');
    merged.graphics.particles = allowed(merged.graphics.particles, ['off', 'low', 'medium', 'high'], 'medium');
    merged.graphics.waterQuality = allowed(merged.graphics.waterQuality, ['low', 'medium', 'high'], 'medium');
    merged.graphics.fogQuality = allowed(merged.graphics.fogQuality, ['low', 'medium', 'high'], 'medium');
    merged.graphics.uiAnimations = allowed(merged.graphics.uiAnimations, ['off', 'reduced', 'on'], 'on');

    merged.performance.renderDistance = allowed(merged.performance.renderDistance, ['short', 'medium', 'long', 'very_long'], 'medium');
    merged.performance.livingWorldUpdateRate = allowed(merged.performance.livingWorldUpdateRate, ['low', 'medium', 'high'], 'medium');
    merged.performance.maxAnimals = allowed(merged.performance.maxAnimals, ['low', 'medium', 'high', 'unlimited'], 'medium');
    merged.performance.offscreenSimulation = allowed(merged.performance.offscreenSimulation, ['minimal', 'reduced', 'complete'], 'reduced');
    merged.performance.pathfindingQuality = allowed(merged.performance.pathfindingQuality, ['eco', 'balanced', 'high'], 'balanced');
    merged.performance.batterySaver = !!merged.performance.batterySaver;

    merged.interface.fpsOverlay = allowed(merged.interface.fpsOverlay, ['off', 'fps', 'full'], 'off');
    merged.interface.density = allowed(merged.interface.density, ['compact', 'normal', 'comfortable'], 'normal');
    merged.interface.fontSize = allowed(merged.interface.fontSize, ['small', 'normal', 'large', 'huge'], 'normal');
    merged.audio.enabled = allowed(merged.audio.enabled, ['on', 'off'], 'on');
    merged.audio.masterVolume = clampNumber(merged.audio.masterVolume, 0, 1, defaultSettings.audio.masterVolume);
    merged.audio.sfxVolume = clampNumber(merged.audio.sfxVolume, 0, 1, defaultSettings.audio.sfxVolume);
    merged.audio.ambientVolume = clampNumber(merged.audio.ambientVolume, 0, 1, defaultSettings.audio.ambientVolume);
    merged.audio.uiVolume = clampNumber(merged.audio.uiVolume, 0, 1, defaultSettings.audio.uiVolume);
    merged.audio.rain = allowed(merged.audio.rain, ['normal', 'reduced', 'off'], 'normal');
    return merged;
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      currentSettings = normalizeSettings(raw ? JSON.parse(raw) : {});
    } catch (_) {
      currentSettings = normalizeSettings({});
    }
    applySettings(currentSettings, { skipDisplayMode: true });
    return currentSettings;
  }

  function saveSettings() {
    currentSettings = normalizeSettings(typeof settings === 'object' && settings ? settings : currentSettings || {});
    if (typeof settings === 'object' && settings) Object.assign(settings, currentSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    applySettings(currentSettings);
    return currentSettings;
  }

  function getSettings() {
    if (!currentSettings) currentSettings = normalizeSettings(typeof settings === 'object' && settings ? settings : {});
    return currentSettings;
  }

  function getPath(path, fallback = null) {
    const parts = String(path || '').split('.').filter(Boolean);
    let cursor = getSettings();
    for (const part of parts) {
      if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return fallback;
      cursor = cursor[part];
    }
    return cursor;
  }

  function setPath(path, value, options = {}) {
    const parts = String(path || '').split('.').filter(Boolean);
    if (!parts.length) return getSettings();
    const next = deepClone(getSettings());
    let cursor = next;
    while (parts.length > 1) {
      const part = parts.shift();
      cursor[part] = isPlainObject(cursor[part]) ? cursor[part] : {};
      cursor = cursor[part];
    }
    cursor[parts[0]] = value;
    currentSettings = normalizeSettings(next);
    if (typeof settings === 'object' && settings) Object.assign(settings, currentSettings);
    if (options.save !== false) saveSettings();
    else applySettings(currentSettings);
    return currentSettings;
  }

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return getSettings();
    currentSettings = normalizeSettings(mergeSettings(getSettings(), preset));
    if (typeof settings === 'object' && settings) Object.assign(settings, currentSettings);
    saveSettings();
    return currentSettings;
  }

  function renderScale() {
    return clampNumber(getPath('video.renderScale', 1), 0.45, 1.5, 1);
  }

  function resolutionSize(cssWidth, cssHeight) {
    const resolution = getPath('video.resolution', 'auto');
    const scale = renderScale();
    if (resolution === 'auto') return { width: Math.max(320, Math.floor(cssWidth * scale)), height: Math.max(240, Math.floor(cssHeight * scale)), scale };
    const [w, h] = resolution.split('x').map(Number);
    return { width: Math.max(320, Math.floor((w || cssWidth) * scale)), height: Math.max(240, Math.floor((h || cssHeight) * scale)), scale };
  }

  function renderPadding() {
    return ({ short: 0, medium: 2, long: 4, very_long: 7 })[getPath('performance.renderDistance', 'medium')] ?? 2;
  }

  function targetFrameInterval() {
    const fps = getPath('video.targetFPS', 60);
    if (fps === 'unlimited') return 0;
    return 1000 / clampNumber(fps, 20, 144, 60);
  }

  function shouldSkipFrame(now) {
    const interval = targetFrameInterval();
    if (interval <= 0) return false;
    if (!metrics.lastAllowedFrameAt) { metrics.lastAllowedFrameAt = now; return false; }
    if (now - metrics.lastAllowedFrameAt + 0.5 < interval) return true;
    metrics.lastAllowedFrameAt = now;
    return false;
  }

  function recordFrame(data = {}) {
    const now = performance.now();
    metrics.frameCount++;
    metrics.frameMs = Number(data.frameMs || metrics.frameMs || 0);
    metrics.updateMs = Number(data.updateMs || metrics.updateMs || 0);
    metrics.systemsMs = Number(data.systemsMs || window.HavenfallPerf?.systemsMs || metrics.systemsMs || 0);
    metrics.renderMs = Number(data.renderMs || metrics.renderMs || 0);
    metrics.uiMs = Number(data.uiMs || window.HavenfallPerf?.uiMs || metrics.uiMs || 0);
    metrics.objects = state?.objects?.length || 0;
    metrics.mobs = (state?.mobs?.length || 0) + (state?.wolves?.length || 0);
    if (now - metrics.lastMetricAt >= 500) {
      metrics.fps = Math.round((metrics.frameCount * 1000) / Math.max(1, now - metrics.lastMetricAt));
      metrics.frameCount = 0;
      metrics.lastMetricAt = now;
    }
  }

  function recordRenderStats(stats = {}) {
    metrics.tilesDrawn = Number(stats.tilesDrawn || 0);
    metrics.chunksDrawn = Number(stats.chunksDrawn || 0);
    metrics.entitiesDrawn = Number(stats.entitiesDrawn || 0);
  }

  async function applyDisplayMode(mode = getPath('video.displayMode', 'windowed')) {
    const desktop = window.HavenfallDesktop || window.electronAPI || null;
    if (desktop?.setDisplayMode) {
      try { await desktop.setDisplayMode(mode); return true; } catch (_) {}
    }
    try {
      if (mode === 'fullscreen' || mode === 'borderless') {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      document.body.classList.toggle('display-borderless-fallback', mode === 'borderless');
      return true;
    } catch (_) {
      return false;
    }
  }

  function applySettings(next = getSettings(), options = {}) {
    currentSettings = normalizeSettings(next);
    document.documentElement.style.setProperty('--hf-ui-scale', currentSettings.uiScale === 'compact' ? '0.92' : currentSettings.uiScale === 'large' ? '1.12' : '1');
    document.documentElement.dataset.uiDensity = currentSettings.interface.density;
    document.documentElement.dataset.uiAnimations = currentSettings.graphics.uiAnimations;
    document.documentElement.dataset.fontSize = currentSettings.interface.fontSize;
    document.body.classList.toggle('hf-no-ui-animations', currentSettings.graphics.uiAnimations === 'off');
    document.body.classList.toggle('hf-reduced-ui-animations', currentSettings.graphics.uiAnimations === 'reduced');
    if (!options.skipDisplayMode) applyDisplayMode(currentSettings.video.displayMode);
    window.HavenfallAudio?.applySettings?.(currentSettings.audio);
    if (typeof resizeGameCanvas === 'function') resizeGameCanvas(true);
    return currentSettings;
  }

  function drawPerformanceOverlay() {
    const mode = getPath('interface.fpsOverlay', 'off');
    if (mode === 'off' || !ctx) return;
    const lines = mode === 'fps'
      ? [`FPS ${metrics.fps || 0}`, `${Math.round(metrics.frameMs || 0)} ms`]
      : [
        `FPS ${metrics.fps || 0} · ${Math.round(metrics.frameMs || 0)} ms`,
        `Update ${Math.round(metrics.updateMs || 0)} · Systems ${Math.round(metrics.systemsMs || 0)} · Render ${Math.round(metrics.renderMs || 0)} ms`,
        `Path ${metrics.pathCalls || 0}x/${Math.round(metrics.pathMs || 0)} ms · Fila ${metrics.pathQueued || 0} · Cache ${metrics.pathCacheHits || 0}`,
        `Chunks ${metrics.chunksDrawn || 0} · Tiles ${metrics.tilesDrawn || 0} · Entidades ${metrics.entitiesDrawn || 0}`,
        `Colonos ${metrics.colonistsActive || 0}/${metrics.colonistsTotal || 0} · Adiados ${metrics.colonistsDeferred || 0} · NPCs ${metrics.npcsActive || 0}`,
        `Objetos ${metrics.objects || 0} · Mobs ${metrics.mobs || 0} · Luz ${Math.round(metrics.lightMs || 0)} ms/${metrics.lightSources || 0}`,
        `Mundo ${Math.round(metrics.worldGenMs || 0)} ms · HW ${metrics.hardwareProfile || 'auto'} ${metrics.hardwareThreads || 0}t · Sim ${metrics.simulationProfile || 'balanced'}`
      ];
    ctx.save();
    ctx.font = '900 12px system-ui';
    const w = Math.max(...lines.map(line => ctx.measureText(line).width)) + 20;
    const h = lines.length * 17 + 14;
    ctx.fillStyle = 'rgba(2,6,23,.82)';
    ctx.fillRect(12, 12, w, h);
    ctx.strokeStyle = 'rgba(148,163,184,.32)';
    ctx.strokeRect(12.5, 12.5, w, h);
    ctx.fillStyle = '#dbeafe';
    lines.forEach((line, index) => ctx.fillText(line, 22, 33 + index * 17));
    ctx.restore();
  }

  function quality() {
    const s = getSettings();
    return {
      shadows: s.graphics.shadows,
      particles: s.graphics.particles,
      fog: s.graphics.fogQuality,
      water: s.graphics.waterQuality,
      renderDistance: s.performance.renderDistance,
      livingWorldUpdateRate: s.performance.livingWorldUpdateRate,
      maxAnimals: s.performance.maxAnimals,
      offscreenSimulation: s.performance.offscreenSimulation,
      pathfindingQuality: s.performance.pathfindingQuality
    };
  }

  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;
  window.HavenfallSettings = {
    defaults: defaultSettings,
    presets,
    load: loadSettings,
    save: saveSettings,
    getSettings,
    get: getPath,
    set: setPath,
    applyPreset,
    apply: applySettings,
    applyDisplayMode,
    renderScale,
    resolutionSize,
    renderPadding,
    shouldSkipFrame,
    recordFrame,
    recordRenderStats,
    drawPerformanceOverlay,
    metrics,
    quality
  };

  window.GameSystems?.registerDrawOverlay?.('performance.overlay', drawPerformanceOverlay, { order: 999 });
})();
