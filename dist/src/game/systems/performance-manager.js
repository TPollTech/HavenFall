'use strict';

(() => {
  if (window.HavenfallContext?.performanceManagerInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.performanceManagerInstalled = true;

  const PRESSURE_LABELS = Object.freeze(['relaxed', 'balanced', 'stressed', 'critical']);
  const pendingPathRequests = [];
  const pendingPathByKey = new Map();
  const pathCache = new Map();
  const pathLifetime = {
    calls: 0,
    cacheHits: 0,
    totalMs: 0,
    maxMs: 0,
    queued: 0,
    processed: 0
  };
  const frameProfiler = {
    colonistsActive: 0,
    colonistsDeferred: 0,
    colonistsTotal: 0,
    pathCalls: 0,
    pathCacheHits: 0,
    pathMs: 0,
    worldGenerationMs: 0,
    initialStateMs: 0,
    lastBudgetAppliedAt: 0
  };
  const simulationBudget = {
    pressure: 1,
    label: PRESSURE_LABELS[1],
    current: {
      colonistNearInterval: 0.08,
      colonistFarInterval: 0.18,
      pathBudgetMs: 3,
      pathJobsPerTick: 2,
      lightingIntervalMs: 420,
      livingWorldIntervalMs: 720,
      regionIntervalMs: 900
    }
  };

  let pathRequestSeq = 0;
  let nativeFindPath = null;
  let nativeGenerateWorldFromSeed = null;
  let nativeCreateInitialState = null;
  let nativeUpdateColonist = null;
  let heavyFrames = 0;
  let stableFrames = 0;

  function perfNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function clampNumber(value, min, max, fallback = min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  }

  function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function qualitySetting(path, fallback) {
    return window.HavenfallSettings?.get?.(path, fallback) ?? fallback;
  }

  function targetFrameMs() {
    const fps = qualitySetting('video.targetFPS', 60);
    if (fps === 'unlimited') return 16.7;
    return 1000 / clampNumber(fps, 20, 144, 60);
  }

  function mapArea() {
    return Math.max(1, Number(state?.world?.cols || 0) * Number(state?.world?.rows || 0));
  }

  function worldScaleBias() {
    const area = mapArea();
    if (area >= 20000) return 1.35;
    if (area >= 12000) return 1.18;
    if (area >= 7000) return 1.08;
    return 1;
  }

  function hashTextLocal(text) {
    const value = String(text || '');
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function jitterFromId(value) {
    return (hashTextLocal(value) % 1000) / 1000;
  }

  function focusWorldPoint() {
    const selected = typeof selectedColonist === 'function' ? selectedColonist() : null;
    return {
      x: Number(camera?.x || selected?.px || 0),
      y: Number(camera?.y || selected?.py || 0)
    };
  }

  function entityPx(actor) {
    return Number.isFinite(Number(actor?.px)) ? Number(actor.px) : Number(actor?.x || 0) * TILE + TILE / 2;
  }

  function entityPy(actor) {
    return Number.isFinite(Number(actor?.py)) ? Number(actor.py) : Number(actor?.y || 0) * TILE + TILE / 2;
  }

  function distanceFromFocusTiles(actor) {
    const focus = focusWorldPoint();
    return Math.hypot(entityPx(actor) - focus.x, entityPy(actor) - focus.y) / Math.max(1, TILE || 1);
  }

  function isActorVisible(actor) {
    if (typeof isWorldPointInView === 'function') return !!isWorldPointInView(entityPx(actor), entityPy(actor), TILE * 5);
    return true;
  }

  function detectGpuInfo() {
    try {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
      const canvasRef = document.createElement('canvas');
      const gl = canvasRef.getContext?.('webgl') || canvasRef.getContext?.('experimental-webgl');
      if (!gl) return null;
      const debugInfo = gl.getExtension?.('WEBGL_debug_renderer_info');
      if (debugInfo) return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || null;
      return gl.getParameter?.(gl.RENDERER) || null;
    } catch (_) {
      return null;
    }
  }

  function detectHardwareProfile() {
    const threads = Math.max(1, Number(globalThis.navigator?.hardwareConcurrency || 4));
    const memoryGb = Math.max(0, Number(globalThis.navigator?.deviceMemory || 0));
    const gpu = detectGpuInfo();
    let score = threads * 1.2 + memoryGb * 2;

    if (/RTX 40|RX 7|Apple M3|Apple M4/i.test(gpu || '')) score += 6;
    else if (/RTX|RX|ARC|Apple M1|Apple M2/i.test(gpu || '')) score += 4;
    else if (/Iris|Vega|UHD|Radeon/i.test(gpu || '')) score += 2;

    const tier = score >= 22 ? 'ultra' : score >= 16 ? 'high' : score >= 10 ? 'medium' : 'low';
    return Object.freeze({
      threads,
      memoryGb: memoryGb || null,
      gpu: gpu || null,
      score: round1(score),
      tier,
      recommendedPreset: tier
    });
  }

  const hardwareProfile = detectHardwareProfile();

  function budgetBase() {
    const offscreen = qualitySetting('performance.offscreenSimulation', 'reduced');
    const pathfinding = qualitySetting('performance.pathfindingQuality', 'balanced');
    const livingWorldRate = qualitySetting('performance.livingWorldUpdateRate', 'medium');
    const worldBias = worldScaleBias();
    const hardwareBias = hardwareProfile.tier === 'low'
      ? 1.18
      : hardwareProfile.tier === 'ultra'
        ? 0.82
        : hardwareProfile.tier === 'high'
          ? 0.9
          : 1;

    const nearCadence = ({ minimal: 0.14, reduced: 0.09, complete: 0.04 })[offscreen] ?? 0.09;
    const farCadence = ({ minimal: 0.48, reduced: 0.26, complete: 0.12 })[offscreen] ?? 0.26;
    const pathBudgetMs = ({ eco: 1.8, balanced: 3.4, high: 5.6 })[pathfinding] ?? 3.4;
    const pathJobsPerTick = ({ eco: 1, balanced: 2, high: 4 })[pathfinding] ?? 2;
    const livingWorldIntervalMs = ({ low: 1250, medium: 720, high: 420 })[livingWorldRate] ?? 720;
    const lightingIntervalMs = ({ low: 650, medium: 420, high: 260 })[livingWorldRate] ?? 420;

    return {
      colonistNearInterval: round1(nearCadence * worldBias * hardwareBias),
      colonistFarInterval: round1(farCadence * worldBias * hardwareBias),
      pathBudgetMs: round1(pathBudgetMs / Math.max(0.82, hardwareBias)),
      pathJobsPerTick: Math.max(1, Math.round(pathJobsPerTick / Math.max(0.85, hardwareBias))),
      lightingIntervalMs: Math.round(lightingIntervalMs * worldBias * hardwareBias),
      livingWorldIntervalMs: Math.round(livingWorldIntervalMs * worldBias * hardwareBias),
      regionIntervalMs: Math.round(900 * worldBias * hardwareBias)
    };
  }

  function applyPressureToBudget(base) {
    const pressure = simulationBudget.pressure;
    const pressureMultiplier = pressure === 3 ? 1.55 : pressure === 2 ? 1.25 : pressure === 0 ? 0.9 : 1;
    const pathBudgetMultiplier = pressure === 3 ? 0.55 : pressure === 2 ? 0.78 : pressure === 0 ? 1.1 : 1;
    return {
      colonistNearInterval: round1(base.colonistNearInterval * pressureMultiplier),
      colonistFarInterval: round1(base.colonistFarInterval * pressureMultiplier),
      pathBudgetMs: round1(base.pathBudgetMs * pathBudgetMultiplier),
      pathJobsPerTick: Math.max(1, Math.round(base.pathJobsPerTick * pathBudgetMultiplier)),
      lightingIntervalMs: Math.round(base.lightingIntervalMs * pressureMultiplier),
      livingWorldIntervalMs: Math.round(base.livingWorldIntervalMs * pressureMultiplier),
      regionIntervalMs: Math.round(base.regionIntervalMs * pressureMultiplier)
    };
  }

  function updatePressure() {
    const frameMs = Number(window.HavenfallPerf?.lastFrameMs || window.HavenfallSettings?.metrics?.frameMs || 0);
    const budgetMs = targetFrameMs();
    if (frameMs > budgetMs * 1.18) {
      heavyFrames++;
      stableFrames = Math.max(0, stableFrames - 1);
    } else if (frameMs && frameMs < budgetMs * 0.9) {
      stableFrames++;
      heavyFrames = Math.max(0, heavyFrames - 1);
    } else {
      heavyFrames = Math.max(0, heavyFrames - 1);
      stableFrames = Math.max(0, stableFrames - 1);
    }

    if (heavyFrames >= 8) {
      simulationBudget.pressure = Math.min(3, simulationBudget.pressure + 1);
      heavyFrames = 0;
      stableFrames = 0;
    } else if (stableFrames >= 24) {
      simulationBudget.pressure = Math.max(0, simulationBudget.pressure - 1);
      heavyFrames = 0;
      stableFrames = 0;
    }

    simulationBudget.label = PRESSURE_LABELS[simulationBudget.pressure] || PRESSURE_LABELS[1];
    simulationBudget.current = applyPressureToBudget(budgetBase());
  }

  function visibleChunkCount() {
    if (typeof visibleTileBounds !== 'function') return 0;
    const bounds = visibleTileBounds(window.HavenfallSettings?.renderPadding?.() ?? 2);
    const chunkSize = 16;
    const startCx = Math.floor(bounds.startX / chunkSize);
    const endCx = Math.floor(bounds.endX / chunkSize);
    const startCy = Math.floor(bounds.startY / chunkSize);
    const endCy = Math.floor(bounds.endY / chunkSize);
    return Math.max(0, endCx - startCx + 1) * Math.max(0, endCy - startCy + 1);
  }

  function pathCacheLimit() {
    const quality = qualitySetting('performance.pathfindingQuality', 'balanced');
    if (quality === 'eco') return 160;
    if (quality === 'high') return 640;
    return 320;
  }

  function clonePath(path) {
    return Array.isArray(path) ? path.map(step => ({ x: step.x, y: step.y })) : [];
  }

  function trimPathCache() {
    const limit = pathCacheLimit();
    while (pathCache.size > limit) {
      const firstKey = pathCache.keys().next().value;
      if (firstKey === undefined) break;
      pathCache.delete(firstKey);
    }
  }

  function pathCacheKey(startX, startY, endX, endY, target = null) {
    return [
      Number(state?.pathVersion || 0),
      qualitySetting('performance.pathfindingQuality', 'balanced'),
      Math.round(Number(startX) || 0),
      Math.round(Number(startY) || 0),
      Math.round(Number(endX) || 0),
      Math.round(Number(endY) || 0),
      target?.id || target?.type || ''
    ].join('|');
  }

  function computePath(startX, startY, endX, endY, target = null) {
    if (typeof nativeFindPath !== 'function') return [];
    const startedAt = perfNow();
    const result = nativeFindPath(startX, startY, endX, endY, target) || [];
    const elapsed = perfNow() - startedAt;
    frameProfiler.pathCalls++;
    frameProfiler.pathMs += elapsed;
    pathLifetime.calls++;
    pathLifetime.totalMs += elapsed;
    pathLifetime.maxMs = Math.max(pathLifetime.maxMs, elapsed);
    return Array.isArray(result) ? result : [];
  }

  function managedFindPath(startX, startY, endX, endY, target = null) {
    const key = pathCacheKey(startX, startY, endX, endY, target);
    const cached = pathCache.get(key);
    if (cached) {
      pathCache.delete(key);
      pathCache.set(key, cached);
      frameProfiler.pathCacheHits++;
      pathLifetime.cacheHits++;
      return clonePath(cached.path);
    }
    const path = computePath(startX, startY, endX, endY, target);
    pathCache.set(key, { path: clonePath(path), createdAt: perfNow() });
    trimPathCache();
    return clonePath(path);
  }

  function requestPath(options = {}) {
    const request = {
      id: `path_${++pathRequestSeq}`,
      ownerId: options.ownerId || null,
      key: options.key || pathCacheKey(options.startX, options.startY, options.endX, options.endY, options.target || null),
      startX: options.startX,
      startY: options.startY,
      endX: options.endX,
      endY: options.endY,
      target: options.target || null,
      apply: typeof options.apply === 'function' ? options.apply : null
    };

    if (pendingPathByKey.has(request.key)) return pendingPathByKey.get(request.key).id;
    pendingPathByKey.set(request.key, request);
    pendingPathRequests.push(request);
    pathLifetime.queued = pendingPathRequests.length;
    return request.id;
  }

  function cancelQueuedPathsFor(ownerId) {
    if (!ownerId) return 0;
    let removed = 0;
    for (let index = pendingPathRequests.length - 1; index >= 0; index--) {
      if (pendingPathRequests[index]?.ownerId !== ownerId) continue;
      pendingPathByKey.delete(pendingPathRequests[index].key);
      pendingPathRequests.splice(index, 1);
      removed++;
    }
    pathLifetime.queued = pendingPathRequests.length;
    return removed;
  }

  function processPathQueue() {
    const budget = simulationBudget.current;
    const startedAt = perfNow();
    let processed = 0;
    while (pendingPathRequests.length > 0 && processed < budget.pathJobsPerTick && (perfNow() - startedAt) <= budget.pathBudgetMs) {
      const request = pendingPathRequests.shift();
      if (!request) break;
      pendingPathByKey.delete(request.key);
      const path = managedFindPath(request.startX, request.startY, request.endX, request.endY, request.target);
      processed++;
      pathLifetime.processed++;
      if (request.apply) {
        try {
          request.apply(path, request);
        } catch (error) {
          console.warn('[PerformanceManager] Path callback falhou.', error);
        }
      }
    }
    pathLifetime.queued = pendingPathRequests.length;
  }

  function patchPathfinding() {
    if (nativeFindPath || typeof findPath !== 'function') return false;
    nativeFindPath = findPath;
    findPath = managedFindPath;
    window.findPathAsync = requestPath;
    return true;
  }

  function patchWorldGeneration() {
    if (!nativeGenerateWorldFromSeed && typeof generateWorldFromSeed === 'function') {
      nativeGenerateWorldFromSeed = generateWorldFromSeed;
      generateWorldFromSeed = function generateWorldFromSeedWithMetrics(config) {
        const startedAt = perfNow();
        const world = nativeGenerateWorldFromSeed(config);
        const elapsed = perfNow() - startedAt;
        frameProfiler.worldGenerationMs = round1(elapsed);
        if (world) {
          world.performance = {
            ...(world.performance || {}),
            worldGenerationMs: frameProfiler.worldGenerationMs,
            hardwareTier: hardwareProfile.tier
          };
        }
        return world;
      };
    }

    if (!nativeCreateInitialState && typeof createInitialState === 'function') {
      nativeCreateInitialState = createInitialState;
      createInitialState = function createInitialStateWithMetrics(config, selectedColonists) {
        const startedAt = perfNow();
        const result = nativeCreateInitialState(config, selectedColonists);
        frameProfiler.initialStateMs = round1(perfNow() - startedAt);
        return result;
      };
    }

    return !!nativeGenerateWorldFromSeed || !!nativeCreateInitialState;
  }

  function managedUpdateColonist(colonist, dt) {
    if (!colonist || typeof nativeUpdateColonist !== 'function') return;
    if (!state || state.isPreview || appScreen !== SCREEN.PLAYING) {
      nativeUpdateColonist(colonist, dt);
      return;
    }

    frameProfiler.colonistsTotal++;
    const urgent = colonist === (typeof selectedColonist === 'function' ? selectedColonist() : null)
      || colonist.task?.type === 'combat'
      || colonist.task?.type === 'scare'
      || colonist.task?.type === 'sleep';
    const visible = isActorVisible(colonist);
    if (urgent || visible) {
      frameProfiler.colonistsActive++;
      nativeUpdateColonist(colonist, dt);
      return;
    }

    const cadence = distanceFromFocusTiles(colonist) > 42
      ? simulationBudget.current.colonistFarInterval
      : simulationBudget.current.colonistNearInterval;
    const now = perfNow();
    colonist.__hfPerfPendingDt = Math.min(0.5, Number(colonist.__hfPerfPendingDt || 0) + Math.max(0, Number(dt) || 0));
    if (now < Number(colonist.__hfPerfNextAt || 0)) {
      frameProfiler.colonistsDeferred++;
      return;
    }

    colonist.__hfPerfNextAt = now + cadence * 1000 * (0.85 + jitterFromId(colonist.id) * 0.3);
    const stepDt = Math.max(Number(dt) || 0, Number(colonist.__hfPerfPendingDt || 0));
    colonist.__hfPerfPendingDt = 0;
    frameProfiler.colonistsActive++;
    nativeUpdateColonist(colonist, Math.min(0.5, stepDt));
  }

  function patchColonistUpdate() {
    if (nativeUpdateColonist || typeof updateColonist !== 'function' || !window.HavenfallColonistAutonomy) return false;
    nativeUpdateColonist = updateColonist;
    updateColonist = managedUpdateColonist;
    return true;
  }

  function configureSystemIntervals() {
    if (!window.GameSystems?.configureTick) return;
    window.GameSystems.configureTick('lighting.ensure-layer', { intervalMs: simulationBudget.current.lightingIntervalMs });
    window.GameSystems.configureTick('living-world.ecology', { intervalMs: simulationBudget.current.livingWorldIntervalMs });
    window.GameSystems.configureTick('world-region-system.active-regions', { intervalMs: simulationBudget.current.regionIntervalMs });
  }

  function publishMetrics() {
    const metrics = window.HavenfallSettings?.metrics || null;
    const lightingStats = window.LightingSystem?.stats?.() || {};
    const totalNpcs = (state?.colonists?.length || 0) + (state?.visitors?.length || 0) + (state?.npcs?.length || 0);

    if (metrics) {
      metrics.systemsMs = round1(window.HavenfallPerf?.systemsMs || metrics.systemsMs || 0);
      metrics.uiMs = round1(window.HavenfallPerf?.uiMs || metrics.uiMs || 0);
      metrics.pathMs = round1(frameProfiler.pathMs);
      metrics.pathCalls = frameProfiler.pathCalls;
      metrics.pathCacheHits = frameProfiler.pathCacheHits;
      metrics.pathQueued = pendingPathRequests.length;
      metrics.colonistsActive = frameProfiler.colonistsActive;
      metrics.colonistsDeferred = frameProfiler.colonistsDeferred;
      metrics.colonistsTotal = frameProfiler.colonistsTotal;
      metrics.npcsActive = totalNpcs;
      metrics.activeChunks = visibleChunkCount();
      metrics.worldGenMs = frameProfiler.worldGenerationMs;
      metrics.initialStateMs = frameProfiler.initialStateMs;
      metrics.hardwareProfile = hardwareProfile.tier;
      metrics.hardwareThreads = hardwareProfile.threads;
      metrics.simulationProfile = simulationBudget.label;
      metrics.lightMs = round1(lightingStats.lastMs || 0);
      metrics.lightSources = Number(lightingStats.sources || 0);
      metrics.lightTiles = Number(lightingStats.tiles || 0);
    }

    window.HavenfallPerf = window.HavenfallPerf || {};
    window.HavenfallPerf.hardware = hardwareProfile;
    window.HavenfallPerf.pathfinding = {
      calls: pathLifetime.calls,
      cacheHits: pathLifetime.cacheHits,
      totalMs: round1(pathLifetime.totalMs),
      maxMs: round1(pathLifetime.maxMs),
      queued: pendingPathRequests.length,
      processed: pathLifetime.processed,
      frameCalls: frameProfiler.pathCalls,
      frameMs: round1(frameProfiler.pathMs)
    };
    window.HavenfallPerf.simulation = {
      ...simulationBudget.current,
      pressure: simulationBudget.label,
      colonistsActive: frameProfiler.colonistsActive,
      colonistsDeferred: frameProfiler.colonistsDeferred,
      colonistsTotal: frameProfiler.colonistsTotal
    };

    frameProfiler.colonistsActive = 0;
    frameProfiler.colonistsDeferred = 0;
    frameProfiler.colonistsTotal = 0;
    frameProfiler.pathCalls = 0;
    frameProfiler.pathCacheHits = 0;
    frameProfiler.pathMs = 0;
  }

  function snapshot() {
    return {
      hardware: hardwareProfile,
      simulation: { pressure: simulationBudget.label, ...simulationBudget.current },
      pathfinding: { ...window.HavenfallPerf?.pathfinding },
      metrics: { ...(window.HavenfallSettings?.metrics || {}) }
    };
  }

  function installDeferredPatches() {
    patchPathfinding();
    patchWorldGeneration();
    patchColonistUpdate();
    configureSystemIntervals();
  }

  function tick() {
    installDeferredPatches();
    updatePressure();
    processPathQueue();
    configureSystemIntervals();
    publishMetrics();
    frameProfiler.lastBudgetAppliedAt = perfNow();
  }

  const pathfindingQueueApi = Object.freeze({
    request: requestPath,
    cancelOwner: cancelQueuedPathsFor,
    clearCache() { pathCache.clear(); },
    stats() {
      return {
        queued: pendingPathRequests.length,
        processed: pathLifetime.processed,
        cacheEntries: pathCache.size,
        cacheHits: pathLifetime.cacheHits,
        calls: pathLifetime.calls
      };
    }
  });

  window.HardwareProfile = hardwareProfile;
  window.FrameProfiler = Object.freeze({
    stats: () => ({
      worldGenerationMs: frameProfiler.worldGenerationMs,
      initialStateMs: frameProfiler.initialStateMs,
      lastFrameMs: round1(window.HavenfallPerf?.lastFrameMs || 0),
      updateMs: round1(window.HavenfallPerf?.updateMs || 0),
      systemsMs: round1(window.HavenfallPerf?.systemsMs || 0),
      drawMs: round1(window.HavenfallPerf?.drawMs || 0),
      uiMs: round1(window.HavenfallPerf?.uiMs || 0)
    })
  });
  window.SimulationBudget = Object.freeze({
    current: () => ({ pressure: simulationBudget.label, ...simulationBudget.current })
  });
  window.PathfindingQueue = pathfindingQueueApi;
  window.PerformanceManager = Object.freeze({
    hardware: hardwareProfile,
    snapshot,
    installDeferredPatches,
    configureSystemIntervals,
    queue: pathfindingQueueApi
  });
  window.HavenfallPerformanceManager = window.PerformanceManager;

  installDeferredPatches();
  console.info('[Performance Manager] Diagnostico dinamico carregado.', {
    hardware: hardwareProfile.tier,
    recommendedPreset: hardwareProfile.recommendedPreset
  });
  window.GameSystems?.registerTick?.('performance.manager', tick, { order: 3, critical: false });
})();
