'use strict';

(() => {
  if (window.HavenfallContext?.runtimeSaveUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.runtimeSaveUiInstalled = true;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function summary() {
    return typeof getSaveSummary === 'function'
      ? getSaveSummary()
      : { hasAnySave: !!localStorage.getItem(SAVE_KEY), runtime: 'web' };
  }

  function readSummaryPayload() {
    const payload = typeof chooseSavedPayload === 'function' ? chooseSavedPayload() : null;
    if (!payload?.text) return null;
    try {
      const data = JSON.parse(payload.text);
      return { data, payload };
    } catch (_) {
      return { data: null, payload };
    }
  }

  refreshMenuSaveInfo = function refreshMenuSaveInfoSaveAware() {
    if (!dom.menuSaveInfo) return;
    const continueBtn = dom.buttons?.continue;
    if (activeSession && state && state.isPreview !== true) {
      if (continueBtn) { continueBtn.textContent = 'Continuar'; continueBtn.disabled = false; }
      dom.menuSaveInfo.innerHTML = `<b>${esc(state.config?.colonyName || 'Colônia sem nome')}</b>`;
      return;
    }

    const info = summary();
    if (!info.hasAnySave) {
      if (continueBtn) { continueBtn.textContent = 'Carregar'; continueBtn.disabled = false; }
      dom.menuSaveInfo.textContent = info.runtime === 'electron' ? 'Nenhum save encontrado na pasta atual.' : 'Nenhum save local encontrado.';
      return;
    }

    const loaded = readSummaryPayload();
    if (!loaded?.data?.state) {
      if (continueBtn) { continueBtn.textContent = 'Carregar'; continueBtn.disabled = true; }
      dom.menuSaveInfo.textContent = 'Save encontrado, mas parece corrompido.';
      return;
    }

    const s = loaded.data.state;
    if (continueBtn) { continueBtn.textContent = 'Continuar'; continueBtn.disabled = false; }
    const source = loaded.payload.source === 'arquivo desktop' ? 'arquivo desktop' : 'navegador';
    dom.menuSaveInfo.innerHTML = `<b>${esc(s.config?.colonyName || 'Colônia sem nome')}</b><br><span>Dia ${s.day || 1} · ${source}</span>`;
  };

  refreshLoadScreen = function refreshLoadScreenSaveAware() {
    if (!dom.loadSlot) return;
    const loadBtn = dom.buttons?.loadSlot;
    const info = summary();
    if (!info.hasAnySave) {
      dom.loadSlot.innerHTML = info.runtime === 'electron' ? 'Nenhum save encontrado na pasta atual.' : 'Nenhum save local encontrado.';
      if (loadBtn) loadBtn.disabled = true;
      return;
    }

    const loaded = readSummaryPayload();
    if (!loaded?.data?.state) {
      dom.loadSlot.innerHTML = 'Save encontrado, mas não foi possível ler o resumo.';
      if (loadBtn) loadBtn.disabled = true;
      return;
    }

    const s = loaded.data.state;
    const cols = s.world?.cols || s.terrain?.[0]?.length || MAP_SIZES.standard.cols;
    const rows = s.world?.rows || s.terrain?.length || MAP_SIZES.standard.rows;
    const source = loaded.payload.source === 'arquivo desktop' ? 'arquivo desktop' : 'navegador';
    dom.loadSlot.innerHTML = `<strong>${esc(s.config?.colonyName || 'Colônia sem nome')}</strong><br>Dia ${s.day || 1}, ${typeof formatHour === 'function' ? formatHour(s.hour || 6) : Math.round(s.hour || 6)} · Seed ${esc(s.config?.seed || 'save antigo')} · ${cols}x${rows} · ${s.colonists?.length || 0} colonos<br><span>Origem: ${source}</span>`;
    if (loadBtn) loadBtn.disabled = false;
  };
})();