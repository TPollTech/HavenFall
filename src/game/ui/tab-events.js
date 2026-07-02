'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function ensureEventLog() {
    if (!state) return [];
    state.eventLog = state.eventLog || [];
    return state.eventLog;
  }

  function typeClass(type) {
    return ({ attack: 'danger', combat: 'danger', weather: 'warn', warn: 'warn', info: 'info', common: 'common' })[type] || 'common';
  }

  function gameLog(message, type = 'common') {
    if (!state) return;
    const entry = { id: Date.now() + Math.random(), day: state.day || 1, hour: formatHour(state.hour || 6), message: String(message || ''), type };
    ensureEventLog().unshift(entry);
    state.eventLog = state.eventLog.slice(0, 120);
    window.HavenfallUI.refreshDockPanel?.('events');
  }

  function installLogBridge() {
    if (window.HavenfallUI.gameLogBridgeInstalled || typeof log !== 'function') return;
    const nativeLog = log;
    log = function logWithEventFeed(message) {
      nativeLog(message);
      gameLog(message, 'common');
    };
    window.HavenfallUI.gameLogBridgeInstalled = true;
  }

  function socialSnapshot() {
    return window.HavenfallLivingWorld?.debugScheduleSnapshot?.() || null;
  }

  function renderSocialSummary() {
    const social = socialSnapshot();
    if (!social) return '';
    const nextTitle = social.nextVisitorKind === 'merchant' ? 'Mercador' : 'Visitante';
    const nextLine = social.etaHours != null
      ? `${nextTitle} previsto em ${social.etaHours}h (Dia ${social.nextVisitorDay}).`
      : 'Nenhum encontro social agendado.';
    const activeLine = social.visitorCount > 0
      ? `${social.visitorCount} visitante(s) ativo(s) no mapa.`
      : 'Nenhum visitante ativo agora.';
    const encounterLine = social.activeEncounterId
      ? `Dialogo aberto: ${social.activeEncounterType || 'encontro'}.`
      : 'Nenhum dialogo aberto.';
    return `<div class="dock-card-grid" style="margin-bottom:10px;">
      <div class="dock-card"><strong>Agenda social</strong><small>${escapeHtml(nextLine)}</small></div>
      <div class="dock-card"><strong>Presenca no mundo</strong><small>${escapeHtml(activeLine)}</small></div>
      <div class="dock-card"><strong>Estado atual</strong><small>${escapeHtml(encounterLine)}</small></div>
    </div>`;
  }

  function renderEntry(entry, index) {
    return `<div class="event-row ${typeClass(entry.type)} ${index === 0 ? 'is-new' : ''}"><b>Dia ${entry.day} · ${entry.hour}</b><span>${escapeHtml(entry.message)}</span></div>`;
  }

  function render() {
    const entries = ensureEventLog();
    return `<div class="dock-tab-head"><div><h3>Eventos</h3><p>Registro cronológico do que acontece na colônia.</p></div></div>
      ${renderSocialSummary()}
      <div class="event-feed">${entries.length ? entries.map(renderEntry).join('') : '<div class="dock-empty">Nenhum evento registrado ainda.</div>'}</div>`;
  }

  window.gameLog = gameLog;
  installLogBridge();
  window.HavenfallUI.tabViews.events = { render };
})();
