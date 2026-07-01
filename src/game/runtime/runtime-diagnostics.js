'use strict';

(() => {
  if (window.HavenfallContext?.runtimeDiagnosticsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeDiagnosticsInstalled = true;

  const runtimeErrors = window.HavenfallRuntimeErrors = window.HavenfallRuntimeErrors || [];
  const MAX_ERRORS = 80;

  function pushError(kind, payload) {
    const entry = {
      kind,
      message: payload?.message || String(payload?.reason || payload || 'erro desconhecido'),
      stack: payload?.stack || payload?.error?.stack || null,
      at: new Date().toISOString(),
      screen: typeof appScreen !== 'undefined' ? appScreen : null,
      runtimeMode: state?.runtimeMode || null
    };
    runtimeErrors.unshift(entry);
    runtimeErrors.length = Math.min(runtimeErrors.length, MAX_ERRORS);
    window.HavenfallDesktop?.appendLog?.(`runtime ${kind}`, entry);
    return entry;
  }

  if (!window.HavenfallContext.runtimeErrorHandlersInstalled) {
    window.addEventListener('error', event => pushError('error', event.error || { message: event.message }));
    window.addEventListener('unhandledrejection', event => pushError('unhandledrejection', event.reason || { message: 'Promise rejeitada' }));
    window.HavenfallContext.runtimeErrorHandlersInstalled = true;
  }

  function saveInfo() {
    try {
      if (typeof getSaveSummary === 'function') return getSaveSummary();
      const desktop = window.HavenfallDesktop?.getSaveInfo?.('autosave') || null;
      const local = localStorage.getItem(SAVE_KEY);
      return {
        desktopExists: !!desktop?.exists,
        desktopBytes: desktop?.bytes || 0,
        localExists: !!local,
        localBytes: local ? new Blob([local]).size : 0
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  function collect() {
    const world = state?.world || {};
    const save = saveInfo();
    const canvasEl = typeof canvas !== 'undefined' ? canvas : null;
    return {
      version: window.Havenfall?.version || 'unknown',
      screen: typeof appScreen !== 'undefined' ? appScreen : null,
      activeSession: typeof activeSession !== 'undefined' ? !!activeSession : null,
      started: typeof started !== 'undefined' ? !!started : null,
      hasState: !!state,
      runtimeMode: state?.runtimeMode || null,
      isPreview: !!state?.isPreview,
      day: state?.day || null,
      hour: state ? Math.round(Number(state.hour || 0) * 10) / 10 : null,
      mapSize: state?.config?.mapSize || world.mapSize || null,
      worldCols: typeof getWorldCols === 'function' ? getWorldCols() : world.cols || null,
      worldRows: typeof getWorldRows === 'function' ? getWorldRows() : world.rows || null,
      objects: state?.objects?.length || 0,
      colonists: state?.colonists?.length || 0,
      mobs: state?.mobs?.length || 0,
      wolves: state?.wolves?.length || 0,
      currentSiteId: state?.worldMap?.currentSiteId || state?.world?.landingSite?.id || null,
      sectorsCount: Object.keys(state?.sectors || state?.worldMap?.sectors || {}).length,
      pathVersion: state?.pathVersion || 0,
      performance: {
        hardware: window.HardwareProfile || null,
        frame: { ...(window.HavenfallSettings?.metrics || {}) },
        simulation: window.HavenfallPerf?.simulation || null,
        pathfinding: window.HavenfallPerf?.pathfinding || null
      },
      save,
      canvas: canvasEl ? { width: canvasEl.width, height: canvasEl.height } : null,
      errors: runtimeErrors.slice(0, 10)
    };
  }

  function validateState(target = state) {
    const errors = [];
    const warnings = [];
    if (!target) errors.push('state inexistente');
    if (target) {
      if (!target.world) errors.push('state.world inexistente');
      if (!Array.isArray(target.terrain)) errors.push('state.terrain não é matriz');
      if (!Array.isArray(target.objects)) errors.push('state.objects não é lista');
      if (!Array.isArray(target.colonists)) warnings.push('state.colonists não é lista');
      if (target.world?.objects && target.objects && target.world.objects !== target.objects) errors.push('state.world.objects diverge de state.objects');
      if (target.world?.terrain && target.terrain && target.world.terrain !== target.terrain) errors.push('state.world.terrain diverge de state.terrain');
      if (target.runtimeMode === 'gameplay' && target.isPreview) errors.push('runtimeMode gameplay com isPreview=true');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function validateWorld(world = state?.world) {
    const errors = [];
    const warnings = [];
    if (!world) errors.push('world inexistente');
    if (world) {
      if (!world.cols || !world.rows) errors.push('dimensões do mundo ausentes');
      if (!Array.isArray(world.terrain)) errors.push('world.terrain ausente');
      if (!Array.isArray(world.objects)) errors.push('world.objects ausente');
      if (!world.spawn) errors.push('spawn ausente');
      if (world.spawn && (world.spawn.x < 0 || world.spawn.y < 0 || world.spawn.x >= world.cols || world.spawn.y >= world.rows)) errors.push('spawn fora do mapa');
      if (world.terrain?.length && world.terrain.length !== world.rows) warnings.push('linhas do terrain não batem com rows');
      if (world.terrain?.[0]?.length && world.terrain[0].length !== world.cols) warnings.push('colunas do terrain não batem com cols');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function validateTravel() {
    const errors = [];
    const warnings = [];
    if (!state?.worldMap) warnings.push('worldMap ainda não inicializado');
    if (state?.worldMap) {
      const current = state.worldMap.currentSiteId;
      if (!current) errors.push('worldMap.currentSiteId ausente');
      if (current && !state.worldMap.landingSites?.some(site => site.id === current)) errors.push('currentSiteId não existe em landingSites');
      if (state.world?.landingSite?.id && current && state.world.landingSite.id !== current) warnings.push('landingSite do mundo difere do currentSiteId');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function print() {
    const summary = collect();
    console.group('[HavenFall Diagnostics]');
    console.table(summary);
    console.log('state', validateState());
    console.log('world', validateWorld());
    console.log('travel', validateTravel());
    console.groupEnd();
    return summary;
  }

  window.HavenfallDiagnostics = Object.freeze({
    collect,
    print,
    validateState,
    validateWorld,
    validateTravel,
    errors: runtimeErrors
  });
})();
