'use strict';

(() => {
  if (window.HavenfallContext?.worldMapUiInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldMapUiInstalled = true;

  const TERRAIN = { grass:'#2f8f58', dirt:'#7c5635', stone:'#8a94a3', sand:'#c8933f', water:'#0e7490' };
  const SITE = { current:'#facc15', visited:'#22c55e', known:'#38bdf8', danger:'#ef4444', quest:'#c084fc', unknown:'#94a3b8', locked:'#475569' };
  let selectedMode = 'balanced';
  let pendingTravelSiteId = null;
  let lastLocalScale = null;
  let lastWorldScale = null;

  function esc(v) { return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, Number(v) || 0)); }
  function travel() { return window.HavenfallWorldTravel; }
  function worldMap() { return travel()?.ensureWorldMap?.() || state?.worldMap || null; }
  function currentTab() { return state?.ui?.map?.tab || state?.worldMap?.lastMapTab || 'local'; }
  function setTab(tab) { state.ui = state.ui || {}; state.ui.map = state.ui.map || {}; state.ui.map.tab = tab; if (state.worldMap) state.worldMap.lastMapTab = tab; render(); }
  function selectedSiteId() { return state?.ui?.map?.selectedWorldSiteId || state?.worldMap?.selectedWorldMapSiteId || state?.worldMap?.currentSiteId; }
  function setSelectedSite(id) { state.ui.map.selectedWorldSiteId = id; if (state.worldMap) state.worldMap.selectedWorldMapSiteId = id; render(); }

  function injectStyle() {
    if (document.getElementById('world-map-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'world-map-ui-style';
    style.textContent = `
      .world-map-overlay{position:fixed;inset:0;z-index:9996;display:none;place-items:center;background:rgba(2,6,23,.72);backdrop-filter:blur(10px)}.world-map-overlay.open{display:grid}.world-map-shell{width:min(1280px,calc(100vw - 28px));height:min(820px,calc(100vh - 28px));display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(125,211,252,.22);border-radius:22px;background:linear-gradient(180deg,rgba(15,23,42,.97),rgba(2,6,23,.96));box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;color:#e5eefc}.world-map-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid rgba(125,211,252,.14)}.world-map-title h2{margin:0;font-size:22px;color:#fff}.world-map-title small{color:rgba(203,213,225,.76)}.world-map-tabs{display:flex;gap:8px}.world-map-tabs button,.world-map-foot button,.map-mode-btn,.travel-prep-actions button{border:1px solid rgba(125,211,252,.18);background:rgba(15,23,42,.76);color:#dbeafe;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}.world-map-tabs button.active,.map-mode-btn.active{border-color:rgba(250,204,21,.55);background:rgba(120,53,15,.28);color:#fef3c7}.world-map-close{border:0;background:rgba(239,68,68,.14);color:#fecaca;border-radius:12px;padding:9px 12px;cursor:pointer}.world-map-body{display:grid;grid-template-columns:minmax(420px,1fr) 360px;gap:14px;min-height:0;padding:14px}.map-viewport{position:relative;min-height:0;border:1px solid rgba(148,163,184,.14);border-radius:18px;background:radial-gradient(circle at 50% 40%,rgba(56,189,248,.11),transparent 36%),rgba(2,6,23,.50);overflow:hidden}.map-viewport canvas{display:block;width:100%;height:100%;min-height:480px}.map-panel{border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(15,23,42,.70);padding:14px;overflow:auto}.map-panel h3{margin:0 0 8px;color:#67e8f9;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.map-panel h2{margin:0;color:#fff}.map-panel p,.map-panel small{color:rgba(203,213,225,.78);line-height:1.45}.map-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.map-stat{border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:9px;background:rgba(2,6,23,.38)}.map-stat small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em}.map-stat b{display:block;color:#f8fafc;font-size:16px}.map-list{display:grid;gap:7px;margin-top:10px}.map-list button{display:grid;grid-template-columns:1fr auto;gap:8px;text-align:left;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.36);border-radius:12px;padding:9px;color:#e5eefc;cursor:pointer}.map-list button.active{border-color:rgba(250,204,21,.45);background:rgba(120,53,15,.20)}.map-chip-row{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.map-chip{border:1px solid rgba(125,211,252,.16);border-radius:999px;background:rgba(15,23,42,.62);padding:5px 8px;font-size:11px;color:rgba(226,232,240,.84)}.map-bars{display:grid;gap:7px}.map-bar{display:grid;grid-template-columns:84px 1fr 32px;gap:8px;align-items:center;font-size:11px}.map-bar i{display:block;height:8px;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#22c55e);width:var(--v)}.map-bar.danger i{background:linear-gradient(90deg,#facc15,#ef4444)}.map-bar span{height:8px;border-radius:999px;background:rgba(51,65,85,.9);overflow:hidden}.map-actions{display:grid;gap:8px;margin-top:12px}.map-actions button.primary,.travel-prep-actions button.primary{border-color:rgba(34,197,94,.38);background:rgba(22,101,52,.25);color:#bbf7d0}.map-actions button.danger{border-color:rgba(239,68,68,.36);background:rgba(127,29,29,.25);color:#fecaca}.map-warning{border:1px solid rgba(251,146,60,.28);background:rgba(124,45,18,.18);color:#fed7aa;border-radius:12px;padding:8px;margin:8px 0;font-size:12px}.map-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(125,211,252,.14)}.map-legend{display:flex;gap:10px;flex-wrap:wrap;color:rgba(203,213,225,.78);font-size:11px}.map-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;background:var(--c)}.map-mode-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:8px 0}.local-info{position:absolute;left:14px;top:14px;right:14px;display:flex;gap:8px;flex-wrap:wrap;pointer-events:none}.local-info span{border:1px solid rgba(125,211,252,.16);background:rgba(2,6,23,.62);border-radius:999px;padding:5px 8px;color:rgba(226,232,240,.84);font-size:11px}.travel-prep-backdrop{position:absolute;inset:0;z-index:2;display:none;place-items:center;background:rgba(2,6,23,.58);padding:18px}.travel-prep-backdrop.open{display:grid}.travel-prep-modal{width:min(680px,calc(100vw - 44px));max-height:min(760px,calc(100vh - 44px));display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(125,211,252,.24);border-radius:18px;background:rgba(15,23,42,.98);box-shadow:0 24px 70px rgba(0,0,0,.52);overflow:hidden}.travel-prep-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid rgba(125,211,252,.14)}.travel-prep-head h2{margin:0;color:#fff;font-size:20px}.travel-prep-head small{color:rgba(203,213,225,.74)}.travel-prep-close{border:0;background:rgba(239,68,68,.14);color:#fecaca;border-radius:12px;padding:8px 10px;cursor:pointer}.travel-prep-body{overflow:auto;padding:14px}.travel-prep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.travel-prep-list{display:grid;gap:6px;margin-top:8px}.travel-prep-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:9px;background:rgba(2,6,23,.34)}.travel-prep-row b{color:#fff}.travel-prep-row span{color:rgba(203,213,225,.78)}.travel-prep-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 14px;border-top:1px solid rgba(125,211,252,.14)}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:940px){.world-map-body{grid-template-columns:1fr}.map-viewport canvas{min-height:360px}.world-map-shell{overflow:auto}.map-panel{max-height:none}.world-map-head{align-items:flex-start;flex-direction:column}.world-map-tabs{width:100%}.travel-prep-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    injectStyle();
    let overlay = document.getElementById('worldMapOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'worldMapOverlay';
    overlay.className = 'world-map-overlay';
    overlay.innerHTML = `
      <div class="world-map-shell" role="dialog" aria-modal="true">
        <header class="world-map-head">
          <div class="world-map-title"><h2>Mapa</h2><small id="worldMapSubtitle">Mapa local e rotas globais</small></div>
          <div class="world-map-tabs"><button data-map-tab="local">1 · Mapa Local</button><button data-map-tab="world">2 · Mapa Mundo</button></div>
          <button class="world-map-close" data-map-close>Fechar</button>
        </header>
        <main class="world-map-body"><section class="map-viewport" id="worldMapViewport"></section><aside class="map-panel" id="worldMapPanel"></aside></main>
        <footer class="map-foot"><div class="map-legend" id="worldMapLegend"></div><div><button data-map-center>Centralizar Base</button> <button data-map-close>Fechar</button></div></footer>
      </div>
      <div id="travelPrepBackdrop" class="travel-prep-backdrop" aria-hidden="true"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', handleClick);
    overlay.addEventListener('change', handleChange);
    return overlay;
  }

  function open(tab = null) {
    if (!state || appScreen !== SCREEN.PLAYING && appScreen !== SCREEN.PAUSED) return;
    const wm = worldMap();
    state.ui = state.ui || {}; state.ui.map = state.ui.map || {};
    state.ui.map.open = true;
    if (tab) state.ui.map.tab = tab;
    else state.ui.map.tab = state.ui.map.tab || wm?.lastMapTab || 'local';
    ensureOverlay().classList.add('open');
    render();
  }

  function close() {
    if (state?.ui?.map) state.ui.map.open = false;
    closeTravelPrep();
    document.getElementById('worldMapOverlay')?.classList.remove('open');
  }

  function toggle(tab = null) {
    const overlay = ensureOverlay();
    if (overlay.classList.contains('open')) close();
    else open(tab);
  }

  function render() {
    const overlay = ensureOverlay();
    if (!overlay.classList.contains('open')) return;
    const tab = currentTab();
    overlay.querySelectorAll('[data-map-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.mapTab === tab));
    if (tab === 'world') renderWorld(); else renderLocal();
  }

  function handleClick(event) {
    if (event.target?.id === 'travelPrepBackdrop') { closeTravelPrep(); return; }
    if (event.target.closest?.('[data-travel-prep-close]')) { closeTravelPrep(); return; }
    const startPrep = event.target.closest?.('[data-travel-prep-start]');
    if (startPrep) { startPreparedTravel(startPrep.dataset.travelPrepStart); return; }
    const tab = event.target.closest?.('[data-map-tab]');
    if (tab) { setTab(tab.dataset.mapTab); return; }
    if (event.target.closest?.('[data-map-close]')) { close(); return; }
    if (event.target.closest?.('[data-map-center]')) { centerCameraOnSelectedColonist?.(); close(); return; }
    const siteBtn = event.target.closest?.('[data-world-site]');
    if (siteBtn) { setSelectedSite(siteBtn.dataset.worldSite); return; }
    const compare = event.target.closest?.('[data-travel-mode]');
    if (compare) {
      selectedMode = compare.dataset.travelMode;
      if (pendingTravelSiteId) renderTravelPrep(pendingTravelSiteId);
      else render();
      return;
    }
    const prepare = event.target.closest?.('[data-prepare-travel]');
    if (prepare) { openTravelPrep(prepare.dataset.prepareTravel); return; }
    const outpost = event.target.closest?.('[data-establish-outpost]');
    if (outpost) { travel()?.establishOutpost?.(outpost.dataset.establishOutpost); render(); return; }
  }

  function handleChange(event) {
    const filter = event.target.closest?.('[data-map-filter]');
    if (!filter) return;
    state.ui.map.filters = state.ui.map.filters || {};
    state.ui.map.filters[filter.dataset.mapFilter] = !!filter.checked;
    renderLocal();
  }

  function renderLocal() {
    const viewport = document.getElementById('worldMapViewport');
    const panel = document.getElementById('worldMapPanel');
    const subtitle = document.getElementById('worldMapSubtitle');
    const legend = document.getElementById('worldMapLegend');
    const site = travel()?.currentSite?.();
    if (subtitle) subtitle.textContent = `Setor atual: ${site?.name || state?.world?.landingSite?.name || 'Setor atual'} · Dia ${state.day}`;
    viewport.innerHTML = '<canvas id="localMapCanvas"></canvas><div class="local-info" id="localMapInfo"></div>';
    panel.innerHTML = localPanelHtml(site);
    legend.innerHTML = `<span><i style="--c:#3b82f6"></i>Colonista</span><span><i style="--c:#ef4444"></i>Ameaça</span><span><i style="--c:#c084fc"></i>POI</span><span><i style="--c:#020617"></i>Não explorado</span>`;
    drawLocalMap();
    const canvas = document.getElementById('localMapCanvas');
    canvas.onclick = clickLocalMap;
  }

  function localPanelHtml(site) {
    const filters = state.ui?.map?.filters || { resources:true, colonists:true, threats:true, poi:true, zones:true, buildings:true };
    const explored = travel()?.explorationPercent?.() || 0;
    const poiCount = state.world?.pointsOfInterest?.length || 0;
    return `<h3>Mapa Local</h3><h2>${esc(site?.name || state.world?.landingSite?.name || 'Setor Atual')}</h2><p>${esc(state.world?.landingNarrative?.title || site?.labels?.subtitle || 'Área atual da colônia.')}</p><div class="map-stat-grid"><div class="map-stat"><small>Bioma</small><b>${esc(site?.labels?.biomeLabel || site?.biomes?.primary || 'local')}</b></div><div class="map-stat"><small>Explorado</small><b>${explored}%</b></div><div class="map-stat"><small>Tamanho</small><b>${getWorldCols()}x${getWorldRows()}</b></div><div class="map-stat"><small>POIs</small><b>${poiCount}</b></div></div><h3>Filtros</h3><div class="map-list">${['colonists','resources','buildings','threats','poi','zones'].map(key => `<label class="map-chip"><input type="checkbox" data-map-filter="${key}" ${filters[key]!==false?'checked':''}> ${labelFilter(key)}</label>`).join('')}</div><h3 style="margin-top:14px">Interação</h3><p>Clique no minimapa para centralizar a câmera naquele tile. Use <b>2</b> para Mapa Mundo.</p>`;
  }

  function labelFilter(key) { return ({ colonists:'Colonos', resources:'Recursos', buildings:'Construções', threats:'Ameaças', poi:'POIs', zones:'Zonas' })[key] || key; }

  function drawLocalMap() {
    const canvas = document.getElementById('localMapCanvas');
    if (!canvas || !state?.terrain) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(420, Math.floor(rect.width));
    canvas.height = Math.max(420, Math.floor(rect.height));
    const c = canvas.getContext('2d');
    const cols = getWorldCols(), rows = getWorldRows();
    const scale = Math.min(canvas.width / cols, canvas.height / rows);
    const ox = Math.floor((canvas.width - cols * scale) / 2);
    const oy = Math.floor((canvas.height - rows * scale) / 2);
    lastLocalScale = { scale, ox, oy, cols, rows };
    c.fillStyle = '#020617'; c.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const discovered = !!state.world?.exploration?.[y]?.[x];
      c.fillStyle = discovered ? (TERRAIN[state.terrain[y]?.[x]] || '#2f8f58') : '#030712';
      c.fillRect(ox + x * scale, oy + y * scale, Math.ceil(scale), Math.ceil(scale));
      if (discovered && state.world?.exploration?.[y]?.[x] === 1) { c.fillStyle = 'rgba(2,6,23,.38)'; c.fillRect(ox + x * scale, oy + y * scale, Math.ceil(scale), Math.ceil(scale)); }
    }
    const filters = state.ui?.map?.filters || {};
    if (filters.resources !== false) drawObjects(c, scale, ox, oy, new Set(['tree','bush','berry','rock','ore','logs']), '#fde68a');
    if (filters.buildings !== false) drawObjects(c, scale, ox, oy, new Set(['campfire','crate','bed','wall','door','table','stove','forge','research_desk','crafting_bench']), '#f8fafc');
    if (filters.poi !== false) drawObjects(c, scale, ox, oy, new Set(['ruin','cache','supply_crate']), '#c084fc', 2.4);
    if (filters.threats !== false) for (const m of [...(state.mobs||[]), ...(state.wolves||[])]) dot(c, m.x, m.y, scale, ox, oy, '#ef4444', 2.7);
    if (filters.colonists !== false) for (const col of state.colonists || []) dot(c, col.x, col.y, scale, ox, oy, '#60a5fa', 3.1);
    const spawn = state.world?.spawn; if (spawn) dot(c, spawn.x, spawn.y, scale, ox, oy, '#facc15', 4.2);
    c.strokeStyle = 'rgba(125,211,252,.28)'; c.lineWidth = 1; c.strokeRect(ox, oy, cols * scale, rows * scale);
    const info = document.getElementById('localMapInfo');
    if (info) info.innerHTML = `<span>Base: ${Math.round(spawn?.x || 0)},${Math.round(spawn?.y || 0)}</span><span>Colonos: ${(state.colonists||[]).length}</span><span>Explorado: ${travel()?.explorationPercent?.() || 0}%</span>`;
  }

  function drawObjects(c, scale, ox, oy, types, color, size = 2) {
    for (const obj of state.objects || []) if (types.has(obj.type)) dot(c, obj.x, obj.y, scale, ox, oy, color, size);
  }

  function dot(c, x, y, scale, ox, oy, color, size = 2) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(ox + (Number(x) + .5) * scale, oy + (Number(y) + .5) * scale, Math.max(size, scale * .55), 0, Math.PI * 2);
    c.fill();
  }

  function clickLocalMap(event) {
    if (!lastLocalScale) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - lastLocalScale.ox) / lastLocalScale.scale);
    const y = Math.floor((event.clientY - rect.top - lastLocalScale.oy) / lastLocalScale.scale);
    if (x < 0 || y < 0 || x >= lastLocalScale.cols || y >= lastLocalScale.rows) return;
    state.ui.map.selectedLocalTile = { x, y, terrain: state.terrain?.[y]?.[x], discovered: !!state.world?.exploration?.[y]?.[x] };
    camera.x = x * TILE + TILE / 2;
    camera.y = y * TILE + TILE / 2;
    if (typeof clampCamera === 'function') clampCamera();
    if (typeof log === 'function') log(`Mapa local: câmera centralizada em ${x}, ${y}.`);
    close();
  }

  function renderWorld() {
    const wm = worldMap();
    const viewport = document.getElementById('worldMapViewport');
    const panel = document.getElementById('worldMapPanel');
    const subtitle = document.getElementById('worldMapSubtitle');
    const legend = document.getElementById('worldMapLegend');
    const selected = travel()?.siteById?.(selectedSiteId()) || wm?.landingSites?.[0];
    if (subtitle) subtitle.textContent = `Planeta ${wm?.planetSeed || state.config?.seed} · ${Object.keys(wm?.visitedSites || {}).length}/${wm?.landingSites?.length || 0} setores visitados`;
    viewport.innerHTML = '<canvas id="worldMapCanvas"></canvas>';
    panel.innerHTML = worldPanelHtml(wm, selected);
    legend.innerHTML = `<span><i style="--c:${SITE.current}"></i>Atual</span><span><i style="--c:${SITE.known}"></i>Conhecido</span><span><i style="--c:${SITE.visited}"></i>Visitado</span><span><i style="--c:${SITE.danger}"></i>Perigoso</span><span><i style="--c:${SITE.quest}"></i>Evento</span>`;
    drawWorldMap(wm, selected);
    const canvas = document.getElementById('worldMapCanvas');
    canvas.onclick = clickWorldMap;
  }

  function worldPanelHtml(wm, site) {
    if (!site) return '<h3>Mapa Mundo</h3><p>Nenhum local detectado.</p>';
    const plan = travel()?.calculateTravelPlan?.(site.id, { mode: selectedMode });
    const validation = travel()?.canTravel?.(plan) || { ok:false, reasons:['Plano indisponível.'], warnings:[] };
    const resources = site.resources || {};
    const risks = site.risks || {};
    const current = site.id === wm.currentSiteId;
    return `<h3>Destino selecionado</h3><h2>${esc(site.name)}</h2><p>${esc(site.labels?.subtitle || site.labels?.biomeLabel || 'Setor detectado por varredura orbital.')}</p><div class="map-chip-row"><span class="map-chip">${esc(site.state || 'known')}</span><span class="map-chip">${esc(site.difficulty?.label || 'Moderado')}</span><span class="map-chip">${esc(site.biomes?.primary || site.archetype || 'setor')}</span></div><div class="map-stat-grid"><div class="map-stat"><small>Distância</small><b>${plan?.distance ?? 0}</b></div><div class="map-stat"><small>Tempo</small><b>${plan?.estimatedHours ?? 0}h</b></div><div class="map-stat"><small>Risco</small><b>${esc(plan?.riskLabel || 'N/A')}</b></div><div class="map-stat"><small>Comida</small><b>${plan?.foodCost ?? 0}</b></div></div><h3>Recursos esperados</h3><div class="map-bars">${resourceBars(resources,false)}</div><h3 style="margin-top:12px">Riscos</h3><div class="map-bars">${resourceBars(risks,true)}</div><h3 style="margin-top:12px">Modo da viagem</h3><div class="map-mode-row">${travelModeButtons()}</div>${validation.reasons?.length ? `<div class="map-warning">${validation.reasons.map(esc).join('<br>')}</div>` : ''}${validation.warnings?.length ? `<div class="map-warning">${validation.warnings.map(esc).join('<br>')}</div>` : ''}<div class="map-actions"><button class="primary" data-prepare-travel="${esc(site.id)}" ${current || !validation.ok ? 'disabled' : ''}>Preparar expedição</button><button data-establish-outpost="${esc(wm.currentSiteId)}">Estabelecer posto neste setor</button></div><h3 style="margin-top:14px">Locais detectados</h3><div class="map-list">${wm.landingSites.map(s=>`<button data-world-site="${esc(s.id)}" class="${s.id===site.id?'active':''}"><span>${esc(s.name)}</span><b>${esc(s.state||'known')}</b></button>`).join('')}</div>`;
  }

  function travelModeButtons() {
    return Object.entries(travel()?.modes || {}).map(([key,mode]) => `<button class="map-mode-btn ${selectedMode===key?'active':''}" data-travel-mode="${key}">${esc(mode.label)}</button>`).join('');
  }

  function resourceBars(src, danger) {
    const entries = danger ? [['Fauna','fauna'],['Clima','weather'],['Doença','disease'],['Ameaças','raids'],['Terreno','terrain']] : [['Madeira','wood'],['Comida','food'],['Pedra','stone'],['Metal','metal'],['Remédio','medicine'],['Água','water']];
    return entries.map(([label,key]) => `<div class="map-bar ${danger?'danger':''}"><b>${esc(label)}</b><span><i style="--v:${clamp(src[key]||0,0,100)}%"></i></span><em>${clamp(src[key]||0,0,100)}</em></div>`).join('');
  }

  function drawWorldMap(wm, selected) {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas || !wm) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(500, Math.floor(rect.width));
    canvas.height = Math.max(420, Math.floor(rect.height));
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    const pad = 54;
    lastWorldScale = { pad, w: canvas.width - pad * 2, h: canvas.height - pad * 2 };
    c.fillStyle = '#020617'; c.fillRect(0,0,canvas.width,canvas.height);
    const bg = c.createRadialGradient(canvas.width*.5, canvas.height*.48, 20, canvas.width*.5, canvas.height*.5, Math.max(canvas.width,canvas.height)*.62);
    bg.addColorStop(0,'rgba(56,189,248,.18)'); bg.addColorStop(.5,'rgba(15,23,42,.58)'); bg.addColorStop(1,'rgba(2,6,23,.98)'); c.fillStyle=bg; c.fillRect(0,0,canvas.width,canvas.height);
    c.strokeStyle = 'rgba(125,211,252,.12)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const y = pad + (lastWorldScale.h/6)*i; c.beginPath(); c.moveTo(pad,y); c.lineTo(canvas.width-pad,y); c.stroke(); }
    for (let i = 0; i < 7; i++) { const x = pad + (lastWorldScale.w/6)*i; c.beginPath(); c.moveTo(x,pad); c.lineTo(x,canvas.height-pad); c.stroke(); }
    const current = wm.landingSites.find(s => s.id === wm.currentSiteId);
    if (current) for (const route of wm.routes || []) { const to = wm.landingSites.find(s => s.id === route.to); if (!to) continue; const a = sitePoint(current), b = sitePoint(to); c.strokeStyle = route.known ? 'rgba(125,211,252,.24)' : 'rgba(148,163,184,.12)'; c.lineWidth = to.id === selected?.id ? 3 : 1; c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); }
    for (const site of wm.landingSites || []) {
      const p = sitePoint(site); const isSel = site.id === selected?.id; const isCur = site.id === wm.currentSiteId; const col = SITE[site.state] || SITE.known;
      c.fillStyle = col; c.strokeStyle = isSel ? '#fef3c7' : 'rgba(255,255,255,.75)'; c.lineWidth = isSel ? 3 : 1;
      c.beginPath(); c.arc(p.x, p.y, isCur ? 12 : isSel ? 11 : 8, 0, Math.PI*2); c.fill(); c.stroke();
      if (site.state === 'quest') { c.fillStyle = '#fff'; c.font = '900 13px system-ui'; c.textAlign='center'; c.fillText('✦', p.x, p.y + 4); }
      if (site.state === 'locked') { c.fillStyle = '#fff'; c.font = '900 11px system-ui'; c.textAlign='center'; c.fillText('×', p.x, p.y + 4); }
      c.fillStyle = isSel || isCur ? '#fff7ed' : 'rgba(226,232,240,.76)'; c.font = isSel || isCur ? '800 12px system-ui' : '700 10px system-ui'; c.textAlign = 'center'; c.fillText(site.name, p.x, p.y + 24);
    }
  }

  function sitePoint(site) {
    const x = lastWorldScale.pad + clamp(site.globe?.x ?? .5, .04, .96) * lastWorldScale.w;
    const y = lastWorldScale.pad + clamp(site.globe?.y ?? .5, .04, .96) * lastWorldScale.h;
    return { x, y };
  }

  function clickWorldMap(event) {
    const wm = worldMap(); if (!wm || !lastWorldScale) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left, my = event.clientY - rect.top;
    let best = null, bestD = Infinity;
    for (const site of wm.landingSites || []) { const p = sitePoint(site); const d = Math.hypot(mx - p.x, my - p.y); if (d < bestD) { bestD = d; best = site; } }
    if (best && bestD < 34) setSelectedSite(best.id);
  }

  function openTravelPrep(siteId) {
    pendingTravelSiteId = siteId;
    renderTravelPrep(siteId);
  }

  function closeTravelPrep() {
    pendingTravelSiteId = null;
    const modal = document.getElementById('travelPrepBackdrop');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = '';
    }
  }

  function renderTravelPrep(siteId) {
    const backdrop = document.getElementById('travelPrepBackdrop');
    if (!backdrop) return;
    const plan = travel()?.calculateTravelPlan?.(siteId, { mode: selectedMode });
    const validation = travel()?.canTravel?.(plan) || { ok:false, reasons:['Plano indisponível.'], warnings:[] };
    const colonists = (state?.colonists || []).filter(c => plan?.colonistIds?.includes(c.id) || !plan?.colonistIds);
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    backdrop.innerHTML = `<section class="travel-prep-modal" role="dialog" aria-modal="true">
      <header class="travel-prep-head"><div><h2>${esc(plan?.toSiteName || 'Expedição')}</h2><small>${esc(plan?.fromSiteId || 'origem')} -> ${esc(plan?.toSiteId || 'destino')}</small></div><button class="travel-prep-close" data-travel-prep-close>Fechar</button></header>
      <div class="travel-prep-body">
        <div class="travel-prep-grid">
          <div class="map-stat"><small>Tempo</small><b>${plan?.estimatedHours ?? 0}h</b></div>
          <div class="map-stat"><small>Risco</small><b>${esc(plan?.riskLabel || 'N/A')}</b></div>
          <div class="map-stat"><small>Comida</small><b>${plan?.foodCost ?? 0}</b></div>
          <div class="map-stat"><small>Evento</small><b>${plan?.eventChance ?? 0}%</b></div>
        </div>
        <h3 style="margin-top:14px">Modo da viagem</h3><div class="map-mode-row">${travelModeButtons()}</div>
        <h3 style="margin-top:14px">Grupo</h3><div class="travel-prep-list">${colonists.map(c => `<div class="travel-prep-row"><b>${esc(c.name)}</b><span>${Math.round(c.health ?? 100)}% vida · ${Math.round(c.energy ?? 100)}% energia</span></div>`).join('') || '<div class="travel-prep-row"><b>Nenhum colono apto</b><span>-</span></div>'}</div>
        <h3 style="margin-top:14px">Suprimentos</h3><div class="travel-prep-list"><div class="travel-prep-row"><b>Comida</b><span>${plan?.foodCost ?? 0} / ${state?.resources?.food ?? 0}</span></div><div class="travel-prep-row"><b>Remédios</b><span>${plan?.medicineRecommended ?? 0} / ${state?.resources?.medicine ?? 0}</span></div><div class="travel-prep-row"><b>Madeira</b><span>${plan?.supplies?.wood ?? 0} recomendado</span></div></div>
        ${validation.reasons?.length ? `<div class="map-warning">${validation.reasons.map(esc).join('<br>')}</div>` : ''}
        ${validation.warnings?.length ? `<div class="map-warning">${validation.warnings.map(esc).join('<br>')}</div>` : ''}
      </div>
      <footer class="travel-prep-actions"><button data-travel-prep-close>Cancelar</button><button class="primary" data-travel-prep-start="${esc(siteId)}" ${!validation.ok ? 'disabled' : ''}>Iniciar viagem</button></footer>
    </section>`;
  }

  function startPreparedTravel(siteId) {
    const result = travel()?.startTravel?.(siteId, { mode: selectedMode });
    if (!result?.ok) {
      renderTravelPrep(siteId);
      if (typeof log === 'function') log(`Viagem não iniciada: ${(result?.reasons || ['erro desconhecido']).join(' ')}`);
      return;
    }
    closeTravelPrep();
    close();
  }

  function confirmTravel(siteId) {
    openTravelPrep(siteId);
  }

  function handleKeyDown(event) {
    const target = event.target;
    const typing = target && ['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target?.isContentEditable;
    if (typing) return;
    const overlay = ensureOverlay();
    if (event.code === 'KeyM' && state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) { event.preventDefault(); toggle(); return; }
    if (!overlay.classList.contains('open')) return;
    if (event.key === '1') { event.preventDefault(); setTab('local'); return; }
    if (event.key === '2') { event.preventDefault(); setTab('world'); return; }
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Enter' && currentTab() === 'world') { event.preventDefault(); const id = selectedSiteId(); if (id && id !== state.worldMap?.currentSiteId) confirmTravel(id); }
  }

  document.addEventListener('keydown', handleKeyDown, true);
  window.HavenfallWorldMapUI = Object.freeze({ open, close, toggle, render });
})();
