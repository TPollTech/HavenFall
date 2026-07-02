'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  let activeHortaId = null;

  function zoneEntries() {
    const defs = { ...(typeof zoneDefs !== 'undefined' ? zoneDefs : {}), ...(window.HavenfallZones?.getAllZoneDefs?.() || {}) };
    if (!defs.growing && (window.cropDefs || window.HavenfallFarming)) {
      defs.growing = { label: 'Zona de cultivo', short: 'Cultivo', hint: 'Pinte a área da horta.' };
    }
    if (defs.growing) defs.growing = { ...defs.growing, short: defs.growing.short || 'Cultivo', hint: 'Pinte a área da horta.' };
    return Object.entries(defs);
  }

  function cropOptions(selected) {
    return Object.entries(window.cropDefs || {}).map(([key, def]) => `<option value="${escapeHtml(key)}" ${selected === key ? 'selected' : ''}>${escapeHtml(def.label || key)}</option>`).join('');
  }

  function phaseLabel(phase) {
    return ({ prepare: 'solo sendo preparado', readyToSow: 'pronta para semear', sown: 'semeada', growing: 'crescendo', mature: 'pronta para colher', harvested: 'colhida', needsReplant: 'precisa replantar' })[phase] || phase || 'sem preparo';
  }

  function rainLabel(value) {
    return ({ benefits: 'gosta de chuva moderada', neutral: 'chuva neutra', overwater_risk: 'cuidado com excesso de água', rot_risk: 'pode apodrecer com muita chuva' })[value] || value || 'neutra';
  }

  function farmingState() { return state?.farming || null; }
  function hortaCells(id) { return Object.values(farmingState()?.cells || {}).filter(cell => cell.plotId === id); }
  function hortaName(plot) { return String(plot?.name || '').replace(/talh[aã]o/ig, 'Horta') || 'Horta'; }
  function avg(cells, prop) { return cells.length ? Math.round(cells.reduce((sum, cell) => sum + Number(cell[prop] || 0), 0) / cells.length) : 0; }

  function hortaInfo(plotId) {
    const plot = farmingState()?.plots?.[plotId];
    if (!plot) return null;
    const cells = hortaCells(plot.id);
    const crop = window.cropDefs?.[plot.cropId] || null;
    return { plot, cells, crop, mature: cells.filter(cell => cell.phase === 'mature').length, growth: avg(cells, 'growth'), water: avg(cells, 'water'), health: avg(cells, 'health') };
  }

  function ensureHortaModal() {
    let modal = document.getElementById('horta-config-modal');
    if (modal) return modal;
    const style = document.createElement('style');
    style.id = 'horta-config-modal-style';
    style.textContent = `
      #horta-config-modal{position:fixed;inset:0;z-index:1700;display:none;place-items:center;background:rgba(0,0,0,.38);backdrop-filter:blur(2px)}
      #horta-config-modal.show{display:grid}
      #horta-config-modal .horta-card{width:min(520px,calc(100vw - 28px));border:1px solid rgba(244,214,148,.28);border-radius:18px;background:linear-gradient(180deg,rgba(18,22,27,.98),rgba(10,13,17,.96));box-shadow:0 24px 80px rgba(0,0,0,.55);color:#f4efe4;padding:16px;display:grid;gap:12px}
      #horta-config-modal header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px}
      #horta-config-modal h3{margin:0;color:#fff3df}#horta-config-modal small{color:#b8b0a0}
      #horta-config-modal button,#horta-config-modal select{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#f4efe4;border-radius:12px;padding:9px 11px}
      #horta-config-modal select{width:100%}.horta-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.horta-stat{border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:10px;background:rgba(255,255,255,.045)}.horta-stat b{display:block;color:#fff3df;font-size:18px}.horta-status-row{display:grid;gap:5px}.horta-meter{height:7px;border-radius:999px;overflow:hidden;background:rgba(0,0,0,.35)}.horta-meter i{display:block;height:100%;background:linear-gradient(90deg,#84cc16,#facc15)}
    `;
    document.head.appendChild(style);
    modal = document.createElement('div');
    modal.id = 'horta-config-modal';
    modal.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-close-horta-modal]')) closeHortaModal();
    });
    modal.addEventListener('change', event => {
      const select = event.target.closest('[data-horta-crop]');
      if (!select || !activeHortaId) return;
      window.HavenfallFarming?.setPlotCrop?.(activeHortaId, select.value);
      renderHortaModal(activeHortaId);
      if (typeof updateUI === 'function') updateUI(true);
    });
    return modal;
  }

  function renderHortaModal(plotId) {
    const modal = ensureHortaModal();
    const info = hortaInfo(plotId);
    if (!info) return closeHortaModal();
    const { plot, cells, crop, mature, growth, water, health } = info;
    const sample = cells[0] || null;
    modal.innerHTML = `<article class="horta-card">
      <header><div><h3>${escapeHtml(hortaName(plot))}</h3><small>${cells.length} célula${cells.length === 1 ? '' : 's'} · ${escapeHtml(plot.status || phaseLabel(sample?.phase))}</small></div><button type="button" data-close-horta-modal>Fechar</button></header>
      <label><small>Cultivo plantado</small><select data-horta-crop>${cropOptions(plot.cropId)}</select></label>
      <div class="horta-stat-grid">
        <div class="horta-stat"><b>${growth}%</b><small>crescimento</small></div>
        <div class="horta-stat"><b>${water}%</b><small>umidade</small></div>
        <div class="horta-stat"><b>${health}%</b><small>saúde</small></div>
        <div class="horta-stat"><b>${mature}</b><small>prontas</small></div>
      </div>
      <div class="horta-status-row"><small>Progresso da horta</small><span class="horta-meter"><i style="width:${Math.max(0, Math.min(100, growth))}%"></i></span></div>
      ${crop ? `<small>${escapeHtml(crop.label)}: cresce em ${escapeHtml(String(crop.growHours))}h, estraga em ${escapeHtml(String(crop.perishHours))}h, ${crop.needsCooling ? 'precisa de frio depois da colheita' : 'não exige frio imediato'}.</small><small>Uso ideal: ${escapeHtml(crop.bestUse || 'consumo básico')} · Chuva: ${escapeHtml(rainLabel(crop.rainResponse))}.</small>` : '<small>Escolha um cultivo para esta horta.</small>'}
    </article>`;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function openHortaModal(plotId) { activeHortaId = plotId; renderHortaModal(plotId); }
  function closeHortaModal() { const modal = document.getElementById('horta-config-modal'); if (modal) { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); } }

  function renderZoneButton(key, def) {
    return `<button type="button" class="dock-card zone-card ${currentZoneTool === key ? 'is-active' : ''}" data-zone-tool="${escapeHtml(key)}"><strong>${escapeHtml(def.short || def.label)}</strong><small>${escapeHtml(def.hint || '')}</small></button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para marcar zonas.</div>';
    return `<div class="zones-panel" data-zones-panel><div class="dock-tab-head"><div><h3>Zonas</h3></div></div><div class="dock-card-grid">${zoneEntries().map(([key, def]) => renderZoneButton(key, def)).join('')}<button type="button" class="dock-card zone-card ${currentZoneTool === 'none' ? 'is-active' : ''}" data-zone-tool="none"><strong>Apagar</strong><small>Remove zonas pintadas.</small></button></div></div>`;
  }

  function onOpen() { document.body.classList.toggle('zone-brush-active', !!currentZoneTool); }
  function stopEvent(event) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); }
  function activateZoneTool(tool) { return window.HavenfallZoneInput?.setTool?.(tool) || (typeof setZoneTool === 'function' && (setZoneTool(tool), true)); }

  function handleZoneToolClick(event) {
    const button = event.target.closest?.('#anchored-ui-panel[data-active-dock-tab="zones"] [data-zone-tool]');
    if (!button) return;
    stopEvent(event);
    closeHortaModal();
    activateZoneTool(button.dataset.zoneTool);
  }

  function tileFromCanvasClick(event) { return typeof canvas !== 'undefined' && event.target === canvas && typeof tileFromEvent === 'function' ? tileFromEvent(event) : null; }
  function handleMapHortaClick(event) {
    if (currentZoneTool || !state || appScreen !== SCREEN.PLAYING) return;
    const tile = tileFromCanvasClick(event);
    if (!tile) return;
    const info = window.HavenfallFarming?.inspectPlotAt?.(tile.x, tile.y);
    if (!info?.plot) return;
    openHortaModal(info.plot.id);
    stopEvent(event);
  }

  function cellVisible(cell) {
    if (typeof isInside === 'function' && !isInside(cell.x, cell.y)) return false;
    const exploration = state?.world?.exploration;
    if (!Array.isArray(exploration) || !exploration.length) return true;
    return typeof isTileDiscovered !== 'function' || isTileDiscovered(cell.x, cell.y);
  }

  function drawCropMark(cell, crop) {
    const x = cell.x * TILE, y = cell.y * TILE, cx = x + TILE / 2, cy = y + TILE / 2;
    const growth = Math.max(0, Math.min(100, Number(cell.growth || 0)));
    const stage = cell.phase === 'mature' ? 3 : cell.phase === 'growing' ? (growth > 66 ? 2 : 1) : cell.phase === 'sown' ? 1 : 0;
    ctx.save();
    ctx.fillStyle = cell.phase === 'mature' ? 'rgba(250,204,21,.22)' : cell.phase === 'growing' || cell.phase === 'sown' ? 'rgba(34,197,94,.18)' : 'rgba(139,92,45,.22)';
    ctx.strokeStyle = cell.phase === 'mature' ? 'rgba(250,204,21,.95)' : 'rgba(74,222,128,.78)';
    ctx.lineWidth = cell.phase === 'mature' ? 3 : 2;
    ctx.setLineDash(cell.phase === 'prepare' || cell.phase === 'readyToSow' ? [6, 4] : []);
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(88,52,28,.75)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 10, y + 15 + i * 9); ctx.lineTo(x + TILE - 10, y + 11 + i * 9); ctx.stroke(); }
    if (stage > 0) {
      ctx.fillStyle = crop?.id === 'strawberry' ? '#ef4444' : crop?.id === 'corn' ? '#facc15' : crop?.id === 'carrot' ? '#fb923c' : '#86efac';
      for (let i = 0; i < stage + 1; i++) {
        ctx.beginPath();
        ctx.arc(cx - 10 + i * 8, cy + 5 - stage * 3, 3.5 + stage, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 8, y + TILE - 10, TILE - 16, 5);
    ctx.fillStyle = cell.phase === 'mature' ? '#facc15' : '#84cc16'; ctx.fillRect(x + 8, y + TILE - 10, (TILE - 16) * (cell.phase === 'mature' ? 1 : growth / 100), 5);
    if (viewTransform.scale >= 0.7) {
      ctx.font = '800 9px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f8fafc';
      ctx.fillText(cell.phase === 'mature' ? 'colher' : cell.phase === 'prepare' ? 'solo' : cell.phase === 'readyToSow' ? 'semear' : crop?.label || 'cultivo', cx, y + 14);
    }
    ctx.restore();
  }

  function drawHortasOverlay() {
    if (!state?.farming?.cells) return;
    const cells = Object.values(state.farming.cells).filter(cellVisible);
    if (!cells.length) return;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (const cell of cells) {
      const plot = state.farming.plots?.[cell.plotId];
      drawCropMark(cell, window.cropDefs?.[plot?.cropId]);
    }
    ctx.restore();
  }

  if (!window.HavenfallContext?.hortaOverlayHooked) {
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.hortaOverlayHooked = true;
    window.GameSystems?.registerDrawOverlay('hortas', drawHortasOverlay, { order: 22 });
  }

  document.addEventListener('pointerdown', handleZoneToolClick, true);
  document.addEventListener('click', handleZoneToolClick, true);
  document.addEventListener('click', handleMapHortaClick, true);
  window.HavenfallUI.tabViews.zones = { render, onOpen };
})();
