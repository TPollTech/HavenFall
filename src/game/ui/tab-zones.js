'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function zoneEntries() {
    return Object.entries(window.HavenfallZones?.getAllZoneDefs?.() || zoneDefs || {});
  }

  function cropOptions(selected) {
    return Object.entries(window.cropDefs || {}).map(([key, def]) => `<option value="${escapeHtml(key)}" ${selected === key ? 'selected' : ''}>${escapeHtml(def.label || key)}</option>`).join('');
  }

  function phaseLabel(phase) {
    const labels = {
      prepare: 'preparar solo',
      readyToSow: 'pronto para semear',
      sown: 'semeado',
      growing: 'crescendo',
      mature: 'maduro',
      harvested: 'colhido',
      needsReplant: 'replantar'
    };
    return labels[phase] || phase || 'vazio';
  }

  function plotRows() {
    const farming = state?.farming;
    const plots = Object.values(farming?.plots || {});
    if (!plots.length) return '<div class="dock-empty">Pinte uma Zona de cultivo para criar o primeiro talhão.</div>';
    return plots.map(plot => {
      const cells = Object.values(farming.cells || {}).filter(cell => cell.plotId === plot.id);
      const sample = cells[0] || null;
      const avgGrowth = cells.length ? Math.round(cells.reduce((sum, cell) => sum + Number(cell.growth || 0), 0) / cells.length) : 0;
      const mature = cells.filter(cell => cell.phase === 'mature').length;
      return `<article class="dock-card farming-plot-card" data-plot-id="${escapeHtml(plot.id)}">
        <strong>${escapeHtml(plot.name || 'Talhão')}</strong>
        <small>${cells.length} célula${cells.length === 1 ? '' : 's'} · ${escapeHtml(plot.status || phaseLabel(sample?.phase))}</small>
        <label class="dock-field"><small>Cultivo</small><select data-plot-crop="${escapeHtml(plot.id)}">${cropOptions(plot.cropId)}</select></label>
        <small>Estágio: ${escapeHtml(phaseLabel(sample?.phase))} · Crescimento médio: ${avgGrowth}% · Pronto: ${mature}</small>
      </article>`;
    }).join('');
  }

  function renderZoneButton(key, def) {
    return `<button class="dock-card zone-card ${currentZoneTool === key ? 'is-active' : ''}" data-zone-tool="${escapeHtml(key)}">
      <strong>${escapeHtml(def.short || def.label)}</strong>
      <small>${escapeHtml(def.hint || '')}</small>
    </button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para marcar zonas.</div>';
    return `<div class="zones-panel">
      <div class="dock-tab-head"><div><h3>Zonas</h3></div></div>
      <div class="dock-card-grid">
        ${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}
        <button class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small></button>
      </div>
      <section class="dock-order-group" style="margin-top:12px;">
        <strong>Talhões</strong>
        <div class="dock-card-grid">${plotRows()}</div>
      </section>
    </div>`;
  }

  function onOpen() {
    document.body.classList.toggle('zone-brush-active', !!currentZoneTool);
  }

  function handleChange(event) {
    const select = event.target.closest?.('[data-plot-crop]');
    if (!select) return;
    event.preventDefault();
    const plotId = select.dataset.plotCrop;
    window.HavenfallFarming?.setPlotCrop?.(plotId, select.value);
    window.HavenfallUI.refreshDockPanel?.('zones');
  }

  document.addEventListener('change', handleChange, true);
  window.HavenfallUI.tabViews.zones = { render, onOpen };
})();
