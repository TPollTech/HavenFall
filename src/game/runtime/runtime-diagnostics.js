'use strict';

(() => {
  if (window.HavenfallContext?.runtimeDiagnosticsInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeDiagnosticsInstalled = true;

  const runtimeErrors = window.HavenfallRuntimeErrors = window.HavenfallRuntimeErrors || [];
  const MAX_ERRORS = 80;
  const DEBUG_STORAGE_KEY = 'havenfall-runtime-debug-v1';
  const DEBUG_VERSION = 'runtime-debug-v1';
  const DEFAULT_FLAGS = Object.freeze({
    floorAdjacency: false,
    socialEvents: false,
    objectAssets: false,
    animalHitboxes: false,
    panelOrigins: true
  });
  const FLAG_META = Object.freeze({
    floorAdjacency: Object.freeze({ label: 'Pisos', short: 'floors', note: 'Mascara de adjacencia e orientacao do piso em foco.' }),
    socialEvents: Object.freeze({ label: 'Eventos', short: 'events', note: 'Agenda social, visitantes e encontros ativos.' }),
    objectAssets: Object.freeze({ label: 'Assets', short: 'assets', note: 'Asset realmente carregado para o objeto em foco.' }),
    animalHitboxes: Object.freeze({ label: 'Hitboxes', short: 'hitboxes', note: 'Area clicavel e caixa do corpo dos animais.' }),
    panelOrigins: Object.freeze({ label: 'Paineis', short: 'panels', note: 'Origem e historico de abertura dos paineis.', panelOnly: true })
  });

  const debugProviders = new Map();
  const debugState = {
    panelOpen: false,
    flags: { ...DEFAULT_FLAGS, ...readStoredFlags() },
    lastPanelOpen: null,
    panelHistory: []
  };

  let debugPanel = null;
  let debugSummary = null;
  let debugSections = null;
  let lastPanelRefreshAt = 0;

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

  function safeStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function readStoredFlags() {
    try {
      const raw = safeStorage()?.getItem(DEBUG_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.flags !== 'object') return null;
      const next = {};
      for (const key of Object.keys(DEFAULT_FLAGS)) next[key] = !!parsed.flags[key];
      return next;
    } catch (_) {
      return null;
    }
  }

  function persistDebugFlags() {
    try {
      safeStorage()?.setItem(DEBUG_STORAGE_KEY, JSON.stringify({ version: DEBUG_VERSION, flags: debugState.flags }));
    } catch (_) {}
  }

  function hasDom() {
    return typeof document !== 'undefined' && !!document.body && !!document.head;
  }

  function h(value) {
    const text = String(value ?? '');
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function tileSize() {
    const sized = typeof getTileSize === 'function' ? Number(getTileSize()) : Number(typeof TILE !== 'undefined' ? TILE : 48);
    return Number.isFinite(sized) && sized > 0 ? sized : 48;
  }

  function tileBoundsNow() {
    if (typeof visibleTileBounds === 'function') return visibleTileBounds(1);
    const cols = typeof getWorldCols === 'function' ? getWorldCols() : Number(state?.world?.cols || state?.terrain?.[0]?.length || 0);
    const rows = typeof getWorldRows === 'function' ? getWorldRows() : Number(state?.world?.rows || state?.terrain?.length || 0);
    if (!cols || !rows) return null;
    return { startX: 0, startY: 0, endX: cols - 1, endY: rows - 1 };
  }

  function boundsContain(bounds, x, y) {
    if (!bounds) return true;
    return x >= bounds.startX && x <= bounds.endX && y >= bounds.startY && y <= bounds.endY;
  }

  function focusTile(bounds = null) {
    const tile = typeof mouseTile !== 'undefined' && mouseTile
      ? { x: Math.round(Number(mouseTile.x) || 0), y: Math.round(Number(mouseTile.y) || 0) }
      : null;
    if (tile && (!bounds || boundsContain(bounds, tile.x, tile.y))) return tile;
    if (!bounds) return null;
    return {
      x: Math.round((Number(bounds.startX || 0) + Number(bounds.endX || 0)) / 2),
      y: Math.round((Number(bounds.startY || 0) + Number(bounds.endY || 0)) / 2)
    };
  }

  function focusWorldPoint(bounds = null) {
    const focus = focusTile(bounds);
    if (!focus) return null;
    const size = tileSize();
    return {
      x: focus.x * size + size / 2,
      y: focus.y * size + size / 2,
      tile: focus
    };
  }

  function activeDebugFlags() {
    return Object.keys(debugState.flags).filter(flag => !!debugState.flags[flag]);
  }

  function worldDebugFlags() {
    return activeDebugFlags().filter(flag => !FLAG_META[flag]?.panelOnly);
  }

  function isFlagEnabled(flag) {
    return !!debugState.flags[String(flag || '')];
  }

  function setFlag(flag, enabled) {
    const key = String(flag || '');
    if (!(key in DEFAULT_FLAGS)) return false;
    const next = !!enabled;
    if (debugState.flags[key] === next) return false;
    debugState.flags[key] = next;
    persistDebugFlags();
    refreshDebugPanel(true);
    return true;
  }

  function toggleFlag(flag) {
    return setFlag(flag, !isFlagEnabled(flag));
  }

  function registerDebugProvider(id, provider, options = {}) {
    if (!id || typeof provider !== 'function') return false;
    debugProviders.set(String(id), {
      provider,
      order: Number(options.order ?? 100),
      flags: Array.isArray(options.flags) ? options.flags.map(flag => String(flag)) : [],
      world: options.world !== false,
      panel: options.panel !== false
    });
    refreshDebugPanel(true);
    return true;
  }

  function orderedDebugProviders() {
    return [...debugProviders.entries()].sort((a, b) => a[1].order - b[1].order || String(a[0]).localeCompare(String(b[0])));
  }

  function providerFlagsActive(entry) {
    const flags = Array.isArray(entry?.flags) ? entry.flags : [];
    if (!flags.length) return false;
    return flags.some(flag => isFlagEnabled(flag));
  }

  function currentPanelState() {
    const panel = hasDom() ? document.getElementById('anchored-ui-panel') : null;
    const title = hasDom() ? document.getElementById('anchoredPanelTitle') : null;
    const activeDockTab = panel?.dataset?.activeDockTab || null;
    const visible = !!panel?.classList?.contains?.('is-active');
    return {
      visible,
      activeDockTab,
      title: title?.textContent || null,
      last: debugState.lastPanelOpen ? { ...debugState.lastPanelOpen } : null,
      history: debugState.panelHistory.slice(0, 8).map(entry => ({ ...entry }))
    };
  }

  function buildRuntimeSection(bounds) {
    const focus = focusTile(bounds);
    const active = activeDebugFlags().map(flag => FLAG_META[flag]?.short || flag).join(', ') || 'nenhuma';
    const world = state?.world || {};
    return {
      title: 'Runtime',
      accent: '#56d7d0',
      lines: [
        `screen ${typeof appScreen !== 'undefined' ? appScreen : 'n/a'} | modo ${state?.runtimeMode || 'n/a'}`,
        `dia ${Number(state?.day || 0)} | hora ${round1(state?.hour || 0)} | mapa ${Number(world.cols || 0)}x${Number(world.rows || 0)}`,
        `flags ${active}`,
        `foco ${focus ? `${focus.x},${focus.y}` : 'sem tile em foco'}`
      ]
    };
  }

  function buildPanelSection() {
    const panel = currentPanelState();
    const lines = [];
    if (panel.visible) {
      lines.push(`aberto agora ${panel.activeDockTab || panel.title || 'painel sem chave'}`);
    } else {
      lines.push('nenhum painel ancorado aberto');
    }
    if (panel.last) {
      lines.push(`ultimo ${panel.last.key || 'desconhecido'} via ${panel.last.origin || 'api'} @ D${panel.last.day || 0} ${round1(panel.last.hour || 0)}h`);
    }
    for (const entry of panel.history.slice(0, 4)) {
      lines.push(`hist ${entry.key || 'desconhecido'} <- ${entry.origin || 'api'}`);
    }
    return { title: 'Paineis', accent: '#f59e0b', lines };
  }

  function normalizeSection(section, id) {
    if (!section) return null;
    return {
      id: section.id || id,
      title: section.title || id,
      accent: section.accent || '#d6a24a',
      lines: Array.isArray(section.lines) ? section.lines.map(line => String(line)) : []
    };
  }

  function collectDebugSnapshot(bounds = null, options = {}) {
    const includeWorld = options.includeWorld !== false;
    const includeSections = options.includeSections !== false;
    const focus = focusTile(bounds);
    const focusPoint = focusWorldPoint(bounds);
    const snapshot = {
      version: DEBUG_VERSION,
      panelOpen: !!debugState.panelOpen,
      flags: { ...debugState.flags },
      activeFlags: activeDebugFlags(),
      world: [],
      sections: [],
      panel: currentPanelState(),
      focusTile: focus,
      focusWorldPoint: focusPoint
    };

    if (includeSections) snapshot.sections.push(buildRuntimeSection(bounds));
    if (includeSections && isFlagEnabled('panelOrigins')) snapshot.sections.push(buildPanelSection());

    for (const [id, entry] of orderedDebugProviders()) {
      const wantsWorld = includeWorld && entry.world && providerFlagsActive(entry) && entry.flags.some(flag => !FLAG_META[flag]?.panelOnly);
      const wantsSections = includeSections && entry.panel && (debugState.panelOpen || providerFlagsActive(entry));
      if (!wantsWorld && !wantsSections) continue;

      try {
        const result = entry.provider({
          bounds,
          flags: { ...debugState.flags },
          activeFlags: snapshot.activeFlags.slice(),
          focusTile: focus,
          focusWorldPoint: focusPoint,
          panel: snapshot.panel,
          mode: wantsWorld && wantsSections ? 'all' : wantsWorld ? 'world' : 'panel'
        });
        if (!result || typeof result !== 'object') continue;
        if (wantsWorld && Array.isArray(result.world)) {
          for (const worldEntry of result.world) {
            if (!worldEntry || typeof worldEntry !== 'object') continue;
            snapshot.world.push({ providerId: id, ...worldEntry });
          }
        }
        if (wantsSections) {
          const sections = Array.isArray(result.sections)
            ? result.sections
            : result.section
              ? [result.section]
              : [];
          for (const section of sections) {
            const normalized = normalizeSection(section, id);
            if (normalized && normalized.lines.length) snapshot.sections.push(normalized);
          }
        }
      } catch (error) {
        pushError('debug-provider', { message: `${id}: ${error?.message || error}`, error });
      }
    }

    return snapshot;
  }

  function worldLabel(text, x, y, color = '#fff4df', bg = 'rgba(4, 8, 14, .86)', align = 'center') {
    if (!ctx || !text) return;
    ctx.save();
    ctx.font = '900 11px system-ui';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const width = Math.ceil(ctx.measureText(text).width) + 10;
    const height = 18;
    const left = align === 'left' ? x - 4 : align === 'right' ? x - width + 4 : x - width / 2;
    ctx.fillStyle = bg;
    ctx.fillRect(left, y - height / 2, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 0.5, y - height / 2 + 0.5, width - 1, height - 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  function drawWorldEntry(entry) {
    if (!ctx || !entry) return;
    const size = tileSize();
    const color = entry.color || '#56d7d0';
    const fill = entry.fill || null;

    if (entry.kind === 'tile') {
      const px = Number(entry.x || 0) * size;
      const py = Number(entry.y || 0) * size;
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Number(entry.lineWidth || 2);
      ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      ctx.restore();
      if (entry.label) worldLabel(String(entry.label), px + size / 2, py + 9, color, entry.bg);
      return;
    }

    if (entry.kind === 'rect') {
      const px = Number(entry.x || 0);
      const py = Number(entry.y || 0);
      const width = Number(entry.width || 0);
      const height = Number(entry.height || 0);
      ctx.save();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(px, py, width, height);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Number(entry.lineWidth || 2);
      ctx.strokeRect(px + 0.5, py + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
      ctx.restore();
      if (entry.label) worldLabel(String(entry.label), px + width / 2, py - 8, color, entry.bg);
      return;
    }

    if (entry.kind === 'point') {
      const px = Number(entry.x || 0);
      const py = Number(entry.y || 0);
      const radius = Math.max(3, Number(entry.radius || 6));
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = Number(entry.lineWidth || 2);
      ctx.stroke();
      ctx.restore();
      if (entry.label) worldLabel(String(entry.label), px, py - radius - 10, color, entry.bg);
      return;
    }

    if (entry.kind === 'label') {
      worldLabel(String(entry.text || entry.label || ''), Number(entry.x || 0), Number(entry.y || 0), color, entry.bg, entry.align || 'center');
    }
  }

  function drawDebugWorld(bounds = null) {
    if (!worldDebugFlags().length) return;
    const snapshot = collectDebugSnapshot(bounds, { includeSections: false });
    for (const entry of snapshot.world) drawWorldEntry(entry);
  }

  function ensurePanelStyle() {
    if (!hasDom() || document.getElementById('havenfall-debug-panel-style')) return;
    const style = document.createElement('style');
    style.id = 'havenfall-debug-panel-style';
    style.textContent = `
      #havenfall-debug-panel{position:fixed;top:14px;right:14px;z-index:10020;width:min(420px,calc(100vw - 28px));max-height:min(calc(100vh - 28px),760px);display:none;grid-template-rows:auto auto auto 1fr;border:1px solid rgba(86,215,208,.34);background:linear-gradient(180deg,rgba(6,10,16,.96),rgba(4,7,12,.94));box-shadow:0 24px 70px rgba(0,0,0,.56);backdrop-filter:blur(12px);color:#eef4fb;border-radius:16px;overflow:hidden}
      #havenfall-debug-panel.is-open{display:grid}
      #havenfall-debug-panel .hf-debug-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}
      #havenfall-debug-panel .hf-debug-head b{display:block;color:#56d7d0;letter-spacing:.18em;font-size:11px;text-transform:uppercase}
      #havenfall-debug-panel .hf-debug-head span{display:block;margin-top:3px;color:#fff4df;font-size:20px;font-weight:950}
      #havenfall-debug-panel .hf-debug-head button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff4df;border-radius:10px;padding:8px 11px;cursor:pointer}
      #havenfall-debug-panel .hf-debug-summary{padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.06);color:#aebbd0;font-size:12px;line-height:1.45}
      #havenfall-debug-panel .hf-debug-flags{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
      #havenfall-debug-panel .hf-debug-flag{display:grid;gap:5px;padding:10px 11px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.04)}
      #havenfall-debug-panel .hf-debug-flag-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #havenfall-debug-panel .hf-debug-flag b{font-size:13px;color:#fff4df}
      #havenfall-debug-panel .hf-debug-flag small{color:#8fa2bc;font-size:11px;line-height:1.35}
      #havenfall-debug-panel .hf-debug-flag input{width:18px;height:18px;accent-color:#56d7d0}
      #havenfall-debug-panel .hf-debug-sections{display:grid;gap:8px;overflow:auto;padding:12px 16px 16px}
      #havenfall-debug-panel .hf-debug-section{display:grid;gap:6px;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-left:4px solid var(--accent,#d6a24a);border-radius:12px;background:rgba(255,255,255,.035)}
      #havenfall-debug-panel .hf-debug-section h3{margin:0;color:#fff4df;font-size:13px}
      #havenfall-debug-panel .hf-debug-section p{margin:0;color:#d7e0eb;font-size:12px;line-height:1.4}
      @media(max-width:700px){#havenfall-debug-panel{left:14px;right:14px;width:auto}#havenfall-debug-panel .hf-debug-flags{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function flagControlsHtml() {
    return Object.entries(FLAG_META).map(([key, meta]) => `
      <label class="hf-debug-flag">
        <div class="hf-debug-flag-head">
          <b>${h(meta.label)}</b>
          <input type="checkbox" data-debug-flag="${h(key)}" ${isFlagEnabled(key) ? 'checked' : ''}>
        </div>
        <small>${h(meta.note)}</small>
      </label>
    `).join('');
  }

  function ensureDebugPanel() {
    if (!hasDom()) return null;
    ensurePanelStyle();
    if (debugPanel) return debugPanel;

    debugPanel = document.createElement('section');
    debugPanel.id = 'havenfall-debug-panel';
    debugPanel.innerHTML = `
      <header class="hf-debug-head">
        <div><b>Runtime Debug</b><span>Inspecao ao vivo</span></div>
        <button type="button" data-debug-close>Fechar</button>
      </header>
      <div class="hf-debug-summary"></div>
      <div class="hf-debug-flags">${flagControlsHtml()}</div>
      <div class="hf-debug-sections"></div>
    `;
    debugSummary = debugPanel.querySelector('.hf-debug-summary');
    debugSections = debugPanel.querySelector('.hf-debug-sections');
    debugPanel.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('[data-debug-close]')) {
        event.preventDefault();
        closeDebugPanel();
      }
    });
    debugPanel.addEventListener('change', event => {
      const input = event.target.closest?.('[data-debug-flag]');
      if (!input) return;
      setFlag(input.dataset.debugFlag, !!input.checked);
      refreshDebugPanel(true);
    });
    ['pointerdown', 'mousedown', 'contextmenu', 'wheel'].forEach(type => {
      debugPanel.addEventListener(type, event => event.stopPropagation(), { passive: type === 'wheel' ? false : true });
    });
    document.body.appendChild(debugPanel);
    return debugPanel;
  }

  function sectionsHtml(sections) {
    return sections.map(section => `
      <section class="hf-debug-section" style="--accent:${h(section.accent || '#d6a24a')}">
        <h3>${h(section.title || 'Secao')}</h3>
        ${(section.lines || []).map(line => `<p>${h(line)}</p>`).join('')}
      </section>
    `).join('');
  }

  function refreshDebugPanel(force = false, bounds = null) {
    if (!debugState.panelOpen || !hasDom()) return;
    const now = Date.now();
    if (!force && now - lastPanelRefreshAt < 140) return;
    lastPanelRefreshAt = now;
    const panel = ensureDebugPanel();
    if (!panel || !debugSummary || !debugSections) return;
    const snapshot = collectDebugSnapshot(bounds || tileBoundsNow(), { includeWorld: true, includeSections: true });
    panel.classList.add('is-open');
    panel.querySelector('.hf-debug-flags').innerHTML = flagControlsHtml();
    debugSummary.textContent = `F8 abre/fecha. Overlays ativas: ${snapshot.activeFlags.map(flag => FLAG_META[flag]?.label || flag).join(', ') || 'nenhuma'}.`;
    debugSections.innerHTML = sectionsHtml(snapshot.sections);
  }

  function openDebugPanel() {
    debugState.panelOpen = true;
    ensureDebugPanel()?.classList.add('is-open');
    refreshDebugPanel(true);
  }

  function closeDebugPanel() {
    debugState.panelOpen = false;
    debugPanel?.classList.remove('is-open');
  }

  function toggleDebugPanel(force = null) {
    const next = force === null ? !debugState.panelOpen : !!force;
    if (next) openDebugPanel();
    else closeDebugPanel();
    return next;
  }

  function drawDebugScreenOverlay() {
    if (debugState.panelOpen) refreshDebugPanel(false);
    const flags = worldDebugFlags();
    if (!ctx || (!debugState.panelOpen && !flags.length)) return;
    const text = debugState.panelOpen
      ? `F8 runtime debug | ${flags.length ? flags.map(flag => FLAG_META[flag]?.short || flag).join(' | ') : 'sem world overlays'}`
      : `runtime debug | ${flags.map(flag => FLAG_META[flag]?.short || flag).join(' | ')}`;
    ctx.save();
    ctx.font = '900 12px system-ui';
    const width = Math.ceil(ctx.measureText(text).width) + 16;
    ctx.fillStyle = 'rgba(4, 8, 14, .74)';
    ctx.fillRect(12, 12, width, 24);
    ctx.strokeStyle = '#56d7d0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12.5, 12.5, width - 1, 23);
    ctx.fillStyle = '#e9f7ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 20, 24);
    ctx.restore();
  }

  function recordPanelOpen(payload = {}) {
    const entry = {
      key: payload.key || null,
      title: payload.title || payload.key || null,
      origin: payload.origin || 'api',
      source: payload.source || null,
      day: Number(state?.day || 0),
      hour: round1(state?.hour || 0),
      at: new Date().toISOString()
    };
    debugState.lastPanelOpen = entry;
    debugState.panelHistory.unshift(entry);
    debugState.panelHistory.length = Math.min(debugState.panelHistory.length, 12);
    refreshDebugPanel(true);
    return entry;
  }

  function saveInfo() {
    try {
      if (typeof getSaveSummary === 'function') return getSaveSummary();
      const desktop = window.HavenfallDesktop?.getSaveInfo?.('autosave') || null;
      const local = safeStorage()?.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'havenfall-save');
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
      hour: state ? round1(state.hour || 0) : null,
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
      debug: {
        version: DEBUG_VERSION,
        panelOpen: !!debugState.panelOpen,
        flags: { ...debugState.flags },
        lastPanelOpen: debugState.lastPanelOpen ? { ...debugState.lastPanelOpen } : null
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
      if (!Array.isArray(target.terrain)) errors.push('state.terrain nao e matriz');
      if (!Array.isArray(target.objects)) errors.push('state.objects nao e lista');
      if (!Array.isArray(target.colonists)) warnings.push('state.colonists nao e lista');
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
      if (!world.cols || !world.rows) errors.push('dimensoes do mundo ausentes');
      if (!Array.isArray(world.terrain)) errors.push('world.terrain ausente');
      if (!Array.isArray(world.objects)) errors.push('world.objects ausente');
      if (!world.spawn) errors.push('spawn ausente');
      if (world.spawn && (world.spawn.x < 0 || world.spawn.y < 0 || world.spawn.x >= world.cols || world.spawn.y >= world.rows)) errors.push('spawn fora do mapa');
      if (world.terrain?.length && world.terrain.length !== world.rows) warnings.push('linhas do terrain nao batem com rows');
      if (world.terrain?.[0]?.length && world.terrain[0].length !== world.cols) warnings.push('colunas do terrain nao batem com cols');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function validateTravel() {
    const errors = [];
    const warnings = [];
    if (!state?.worldMap) warnings.push('worldMap ainda nao inicializado');
    if (state?.worldMap) {
      const current = state.worldMap.currentSiteId;
      if (!current) errors.push('worldMap.currentSiteId ausente');
      if (current && !state.worldMap.landingSites?.some(site => site.id === current)) errors.push('currentSiteId nao existe em landingSites');
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

  function handleDebugHotkeys(event) {
    const target = event.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    if (typing) return;
    if (event.code === 'F8') {
      event.preventDefault();
      toggleDebugPanel();
    }
  }

  if (!window.HavenfallContext.runtimeDebugHotkeysInstalled && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', handleDebugHotkeys, true);
    window.HavenfallContext.runtimeDebugHotkeysInstalled = true;
  }

  window.GameSystems?.registerWorldOverlay?.('runtime.debug.world', drawDebugWorld, { order: 96, critical: false });
  window.GameSystems?.registerDrawOverlay?.('runtime.debug.screen', drawDebugScreenOverlay, { order: 1000, critical: false });

  window.HavenfallDebugRuntime = Object.freeze({
    version: DEBUG_VERSION,
    flags: () => ({ ...debugState.flags }),
    activeFlags: () => activeDebugFlags().slice(),
    isFlagEnabled,
    setFlag,
    toggleFlag,
    registerProvider: registerDebugProvider,
    snapshot: (bounds = null) => collectDebugSnapshot(bounds || tileBoundsNow(), { includeWorld: true, includeSections: true }),
    collectSnapshot: (bounds = null, options = {}) => collectDebugSnapshot(bounds || tileBoundsNow(), options),
    focusTile,
    focusWorldPoint,
    openPanel: () => openDebugPanel(),
    closePanel: () => closeDebugPanel(),
    togglePanel: force => toggleDebugPanel(force ?? null),
    isPanelOpen: () => !!debugState.panelOpen,
    refreshPanel: (force = false) => refreshDebugPanel(force),
    recordPanelOpen,
    currentPanelState
  });

  window.HavenfallDiagnostics = Object.freeze({
    collect,
    print,
    validateState,
    validateWorld,
    validateTravel,
    errors: runtimeErrors
  });
})();
