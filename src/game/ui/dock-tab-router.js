'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const TAB_LABELS = { crafting: 'Crafting', zones: 'Zonas', colonists: 'Colonos', tasks: 'Tarefas', orders: 'Ordens', schedule: 'Rotina', events: 'Eventos' };
  let activeDockTab = null;

  function addStyle() {
    if (document.getElementById('dock-tab-router-style')) return;
    const style = document.createElement('style');
    style.id = 'dock-tab-router-style';
    style.textContent = [
      '.dock-tab-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.dock-tab-head h3{margin:0;color:#fff3df}.dock-tab-head p{margin:3px 0 0;color:#b8b0a0;font-size:12px}',
      '.dock-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.dock-chip,.dock-tab-head button,.dock-card button,.dock-table button{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#f4efe4;border-radius:12px;padding:8px 11px;cursor:pointer}.dock-chip:hover,.dock-tab-head button:hover,.dock-card button:hover,.dock-table button:hover{border-color:rgba(227,169,63,.55);background:rgba(227,169,63,.12)}.dock-chip:active,.dock-tab-head button:active,.dock-card button:active,.dock-table button:active{transform:translateY(1px)}.dock-chip.is-active{background:rgba(59,130,246,.22);border-color:rgba(96,165,250,.8)}.dock-chip small{opacity:.7;margin-left:4px}',
      '.dock-empty{display:grid;gap:4px;padding:14px;border:1px dashed rgba(255,255,255,.14);border-radius:14px;color:#b8b0a0;background:rgba(255,255,255,.035)}.dock-empty b{color:#fff3df}',
      '.dock-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px}.dock-card{display:grid;gap:5px;align-content:start;text-align:left;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);border-radius:14px;padding:11px;color:#f4efe4}.dock-card:hover{border-color:rgba(227,169,63,.45);background:rgba(227,169,63,.08)}.dock-card:active{transform:translateY(1px)}.dock-card.is-disabled,.dock-card:disabled{opacity:.45;filter:grayscale(.4);cursor:not-allowed}.dock-card strong{color:#fff3df}.dock-card small,.dock-card em{color:#b8b0a0;font-size:11px}.dock-badge{justify-self:start;border:1px solid rgba(227,169,63,.24);border-radius:999px;padding:3px 7px;color:#ffe2a3;font-size:11px}.zone-card.is-active{outline:2px solid rgba(245,209,92,.75)}',
      '.dock-progress{height:7px;border-radius:999px;background:rgba(0,0,0,.35);overflow:hidden}.dock-progress i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#f7b84a)}',
      '.dock-table-wrap{overflow:auto;max-height:260px;border-radius:14px;border:1px solid rgba(255,255,255,.08)}.dock-table{width:100%;border-collapse:collapse;font-size:12px}.dock-table th,.dock-table td{padding:9px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left}.dock-table th{position:sticky;top:0;background:rgba(12,16,24,.98);color:#ffe2a3}.dock-table small{display:block;color:#b8b0a0}.dock-table tr.is-selected{background:rgba(59,130,246,.12)}',
      '.mini-bar{display:grid;grid-template-columns:42px 1fr 34px;gap:6px;align-items:center;margin:2px 0}.mini-bar i{height:6px;background:rgba(0,0,0,.38);border-radius:999px;overflow:hidden}.mini-bar em{display:block;height:100%;background:#3b82f6}.mini-bar small{font-size:10px}',
      '.priority-dots{display:flex;gap:3px}.priority-dots button{width:26px;height:26px;padding:0;border-radius:8px}.priority-dots button.is-active{background:rgba(247,184,74,.24);border-color:rgba(247,184,74,.8)}',
      '#anchored-ui-panel[data-active-dock-tab="tasks"]{max-height:min(34vh,300px);padding:10px;bottom:84px}#anchored-ui-panel[data-active-dock-tab="tasks"] .anchored-ui-header{padding-bottom:6px;margin-bottom:0}#anchored-ui-panel[data-active-dock-tab="tasks"] .anchored-ui-body{overflow:hidden!important;padding-right:0}#anchored-ui-panel[data-active-dock-tab="tasks"] .dock-table-wrap{overflow:hidden!important;max-height:none!important;border-radius:12px}.task-priority-panel{display:grid;gap:6px;min-height:0;overflow:hidden}.task-legend{display:flex;gap:10px;justify-content:flex-end;color:#b8b0a0;font-size:10px;margin-top:-2px}.task-compact-table{table-layout:fixed;font-size:10.5px;line-height:1.05}.task-compact-table th,.task-compact-table td{padding:4px 6px!important}.task-compact-table th:first-child{width:22%}.task-compact-table th:not(:first-child){width:19.5%;text-align:center}.task-priority-cell{text-align:center!important}.task-colonist{min-width:0}.task-colonist-line{display:flex;align-items:center;gap:6px;min-width:0}.task-colonist-line b{font-size:11px;color:#fff3df;white-space:nowrap}.task-colonist-line span{font-size:9px;color:#b8b0a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.task-status-bar{display:block;height:4px;margin-top:3px;border-radius:999px;background:rgba(0,0,0,.42);overflow:hidden}.task-status-bar i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#f7b84a)}.priority-dots.compact{display:flex;justify-content:center;gap:2px}.priority-dots.compact button{width:20px;height:20px;border-radius:7px;font-size:10px;font-weight:900;padding:0;background:rgba(255,255,255,.055);border-color:rgba(255,255,255,.14);color:#d7dce8}.priority-dots.compact button:hover{border-color:rgba(247,184,74,.6);background:rgba(247,184,74,.12)}.priority-dots.compact button.is-active{background:linear-gradient(180deg,#ffc95d,#9b650f);border-color:#ffe2a3;color:#111827;box-shadow:0 0 0 1px rgba(255,226,163,.35),0 0 14px rgba(247,184,74,.65);transform:translateY(-1px)}',
      '#anchored-ui-panel[data-active-dock-tab="orders"]{max-height:min(38vh,330px);width:min(980px,calc(100vw - 28px))}.orders-panel{display:grid;gap:9px}.order-status-card{min-height:86px}.order-help{font-size:12px}',
      '#anchored-ui-panel[data-active-dock-tab="schedule"]{max-height:min(46vh,390px);width:min(1280px,calc(100vw - 28px))}#anchored-ui-panel[data-active-dock-tab="schedule"] .anchored-ui-body{overflow:hidden!important}.schedule-panel{display:grid;gap:8px;min-height:0;overflow:hidden}.schedule-legend{display:flex;gap:8px;align-items:center;justify-content:flex-end;font-size:11px;color:#b8b0a0}.schedule-legend span{border-radius:999px;padding:4px 8px;font-weight:900}.schedule-legend .sleep{background:rgba(96,165,250,.20);color:#cfe4ff}.schedule-legend .work{background:rgba(247,184,74,.22);color:#ffe4a9}.schedule-legend .leisure{background:rgba(97,211,126,.20);color:#d7ffdd}.schedule-legend em{font-style:normal;margin-left:auto;color:#ffe2a3}.schedule-table-wrap{overflow:auto;max-height:290px;border:1px solid rgba(255,255,255,.08);border-radius:14px}.schedule-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}.schedule-table th,.schedule-table td{padding:3px;border-bottom:1px solid rgba(255,255,255,.055);text-align:center}.schedule-table th:first-child,.schedule-name{width:96px;text-align:left!important;position:sticky;left:0;background:rgba(12,16,24,.96);z-index:2}.schedule-hour.is-now{color:#fff;background:rgba(227,169,63,.22)}.schedule-name b{display:block;font-size:11px;color:#fff3df}.schedule-name small{color:#b8b0a0}.schedule-cell{width:100%;min-width:24px;height:24px;padding:0;border-radius:7px;font-size:0;color:transparent;border:1px solid rgba(255,255,255,.08)}.schedule-cell.sleep{background:rgba(96,165,250,.42);border-color:rgba(96,165,250,.55)}.schedule-cell.work{background:rgba(247,184,74,.46);border-color:rgba(247,184,74,.62)}.schedule-cell.leisure{background:rgba(97,211,126,.42);border-color:rgba(97,211,126,.58)}.schedule-cell.is-now{box-shadow:0 0 0 2px rgba(255,255,255,.38),0 0 12px rgba(255,255,255,.18)}.schedule-cell:active{transform:scale(.94)}',
      '.event-feed{display:grid;gap:7px;max-height:270px;overflow-y:auto;padding-right:4px}.event-row{display:grid;gap:2px;padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);animation:eventFade .18s ease}.event-row b{font-size:11px;color:#b8b0a0}.event-row.danger{border-color:rgba(239,68,68,.34);color:#ffd2d2}.event-row.warn{border-color:rgba(247,184,74,.38);color:#ffe5ad}.event-row.info{border-color:rgba(96,165,250,.34)}@keyframes eventFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
      'body.zone-brush-active canvas,body.order-mine-active canvas{cursor:crosshair!important}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureDockButton(key, label, beforeKey = 'events') {
    const dock = document.getElementById('bottom-navigation-dock');
    if (!dock || dock.querySelector(`[data-ui-panel="${key}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.uiPanel = key;
    button.textContent = label;
    const beforeButton = beforeKey ? dock.querySelector(`[data-ui-panel="${beforeKey}"]`) : null;
    dock.insertBefore(button, beforeButton || dock.querySelector('[data-speed]') || null);
  }

  function ensureDynamicDockButtons() {
    ensureDockButton('orders', 'Ordens', 'zones');
    ensureDockButton('schedule', 'Rotina', 'events');
  }

  function panelParts() {
    return {
      panel: document.getElementById('anchored-ui-panel'),
      title: document.getElementById('anchoredPanelTitle'),
      body: document.getElementById('anchoredPanelBody')
    };
  }

  function setDockButton(key) {
    document.querySelectorAll('#bottom-navigation-dock [data-ui-panel]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.uiPanel === key);
    });
  }

  function recordDockPanelOpen(key, meta = null) {
    window.HavenfallDebugRuntime?.recordPanelOpen?.({
      key,
      title: TAB_LABELS[key] || key,
      origin: meta?.origin || 'dock-api',
      source: meta?.source || null
    });
  }

  function renderDockPanel(key, meta = null) {
    const view = window.HavenfallUI.tabViews[key];
    if (!view) return false;
    if (typeof view.onOpen === 'function') view.onOpen();
    const { panel, title, body } = panelParts();
    if (!panel || !title || !body) return false;
    const previousKey = activeDockTab;
    window.uiManager?.forceCloseAll?.({ except: 'panel' });
    activeDockTab = key;
    title.textContent = TAB_LABELS[key] || key;
    panel.dataset.activeDockTab = key;
    body.dataset.activeDockTab = key;
    body.innerHTML = view.render ? view.render() : '<div class="dock-empty">Aba sem renderizador.</div>';
    panel.hidden = false;
    panel.classList.add('is-active');
    panel.setAttribute('aria-hidden', 'false');
    setDockButton(key);
    if (meta || previousKey !== key) recordDockPanelOpen(key, meta);
    return true;
  }

  function refreshDockPanel(key = activeDockTab) {
    if (!key || key !== activeDockTab) return;
    renderDockPanel(key);
  }

  function clearDockPanelState() {
    const { panel, body } = panelParts();
    if (panel) delete panel.dataset.activeDockTab;
    if (body) delete body.dataset.activeDockTab;
    activeDockTab = null;
    setDockButton(null);
  }

  function closeDockPanel() {
    const { panel } = panelParts();
    if (panel) {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }
    clearDockPanelState();
  }

  function handleDockClick(event) {
    const button = event.target.closest?.('#bottom-navigation-dock [data-ui-panel]');
    if (!button) return;
    const key = button.dataset.uiPanel;
    if (!window.HavenfallUI.tabViews[key]) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const panel = document.getElementById('anchored-ui-panel');
    if (activeDockTab === key && panel?.classList.contains('is-active')) {
      closeDockPanel();
      return;
    }
    renderDockPanel(key, { origin: 'bottom-navigation-dock', source: 'dock-tab-router.handleDockClick' });
  }

  addStyle();
  ensureDynamicDockButtons();
  document.addEventListener('click', handleDockClick, true);
  window.HavenfallUI.renderDockPanel = renderDockPanel;
  window.HavenfallUI.refreshDockPanel = refreshDockPanel;
  window.HavenfallUI.closeDockPanel = closeDockPanel;
})();
