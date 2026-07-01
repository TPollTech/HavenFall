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
  function hashText(text) {
    let h = 2166136261;
    for (const ch of String(text || 'havenfall')) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seeded(seed, salt) { return (hashText(`${seed}|${salt}`) % 10000) / 10000; }
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
      .world-map-overlay{position:fixed;inset:0;z-index:9996;display:none;place-items:center;background:rgba(2,6,23,.72);backdrop-filter:blur(10px)}.world-map-overlay.open{display:grid}.world-map-shell{width:min(1280px,calc(100vw - 28px));height:min(820px,calc(100vh - 28px));display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(125,211,252,.22);border-radius:22px;background:linear-gradient(180deg,rgba(15,23,42,.97),rgba(2,6,23,.96));box-shadow:0 30px 90px rgba(0,0,0,.55);overflow:hidden;color:#e5eefc}.world-map-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid rgba(125,211,252,.14)}.world-map-title h2{margin:0;font-size:22px;color:#fff}.world-map-title small{color:rgba(203,213,225,.76)}.world-map-tabs{display:flex;gap:8px}.world-map-tabs button,.world-map-foot button,.map-mode-btn,.travel-prep-actions button{border:1px solid rgba(125,211,252,.18);background:rgba(15,23,42,.76);color:#dbeafe;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}.world-map-tabs button.active,.map-mode-btn.active{border-color:rgba(250,204,21,.55);background:rgba(120,53,15,.28);color:#fef3c7}.world-map-close{border:0;background:rgba(239,68,68,.14);color:#fecaca;border-radius:12px;padding:9px 12px;cursor:pointer}.world-map-body{display:grid;grid-template-columns:minmax(420px,1fr) 360px;gap:14px;min-height:0;padding:14px}.map-viewport{position:relative;min-height:0;border:1px solid rgba(148,163,184,.14);border-radius:18px;background:radial-gradient(circle at 50% 40%,rgba(56,189,248,.11),transparent 36%),rgba(2,6,23,.50);overflow:hidden}.map-viewport.world-globe-mode{background:radial-gradient(circle at 50% 45%,rgba(59,130,246,.16),transparent 42%),linear-gradient(180deg,rgba(2,6,23,.95),rgba(7,10,24,.98))}.map-viewport canvas{display:block;width:100%;height:100%;min-height:480px}.map-panel{border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(15,23,42,.70);padding:14px;overflow:auto}.map-panel h3{margin:0 0 8px;color:#67e8f9;font-size:12px;letter-spacing:.14em;text-transform:uppercase}.map-panel h2{margin:0;color:#fff}.map-panel p,.map-panel small{color:rgba(203,213,225,.78);line-height:1.45}.map-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.map-stat{border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:9px;background:rgba(2,6,23,.38)}.map-stat small{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.09em}.map-stat b{display:block;color:#f8fafc;font-size:16px}.map-list{display:grid;gap:7px;margin-top:10px}.map-list button{display:grid;grid-template-columns:1fr auto;gap:8px;text-align:left;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.36);border-radius:12px;padding:9px;color:#e5eefc;cursor:pointer}.map-list button.active{border-color:rgba(250,204,21,.45);background:rgba(120,53,15,.20)}.map-chip-row{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.map-chip{border:1px solid rgba(125,211,252,.16);border-radius:999px;background:rgba(15,23,42,.62);padding:5px 8px;font-size:11px;color:rgba(226,232,240,.84)}.map-bars{display:grid;gap:7px}.map-bar{display:grid;grid-template-columns:84px 1fr 32px;gap:8px;align-items:center;font-size:11px}.map-bar i{display:block;height:8px;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#22c55e);width:var(--v)}.map-bar.danger i{background:linear-gradient(90deg,#facc15,#ef4444)}.map-bar span{height:8px;border-radius:999px;background:rgba(51,65,85,.9);overflow:hidden}.map-actions{display:grid;gap:8px;margin-top:12px}.map-actions button.primary,.travel-prep-actions button.primary{border-color:rgba(34,197,94,.38);background:rgba(22,101,52,.25);color:#bbf7d0}.map-actions button.danger{border-color:rgba(239,68,68,.36);background:rgba(127,29,29,.25);color:#fecaca}.map-warning{border:1px solid rgba(251,146,60,.28);background:rgba(124,45,18,.18);color:#fed7aa;border-radius:12px;padding:8px;margin:8px 0;font-size:12px}.map-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid rgba(125,211,252,.14)}.map-legend{display:flex;gap:10px;flex-wrap:wrap;color:rgba(203,213,225,.78);font-size:11px}.map-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;background:var(--c)}.map-mode-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:8px 0}.local-info{position:absolute;left:14px;top:14px;right:14px;display:flex;gap:8px;flex-wrap:wrap;pointer-events:none}.local-info span{border:1px solid rgba(125,211,252,.16);background:rgba(2,6,23,.62);border-radius:999px;padding:5px 8px;color:rgba(226,232,240,.84);font-size:11px}.travel-prep-backdrop{position:absolute;inset:0;z-index:2;display:none;place-items:center;background:rgba(2,6,23,.58);padding:18px}.travel-prep-backdrop.open{display:grid}.travel-prep-modal{width:min(680px,calc(100vw - 44px));max-height:min(760px,calc(100vh - 44px));display:grid;grid-template-rows:auto 1fr auto;border:1px solid rgba(125,211,252,.24);border-radius:18px;background:rgba(15,23,42,.98);box-shadow:0 24px 70px rgba(0,0,0,.52);overflow:hidden}.travel-prep-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid rgba(125,211,252,.14)}.travel-prep-head h2{margin:0;color:#fff;font-size:20px}.travel-prep-head small{color:rgba(203,213,225,.74)}.travel-prep-close{border:0;background:rgba(239,68,68,.14);color:#fecaca;border-radius:12px;padding:8px 10px;cursor:pointer}.travel-prep-body{overflow:auto;padding:14px}.travel-prep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.travel-prep-list{display:grid;gap:6px;margin-top:8px}.travel-prep-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:9px;background:rgba(2,6,23,.34)}.travel-prep-row b{color:#fff}.travel-prep-row span{color:rgba(203,213,225,.78)}.travel-prep-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 14px;border-top:1px solid rgba(125,211,252,.14)}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:940px){.world-map-shell{display:block;overflow:auto}.world-map-body{grid-template-columns:1fr;grid-auto-rows:auto;min-height:auto}.map-viewport,.map-viewport.world-globe-mode{min-height:360px}.map-viewport canvas{height:360px;min-height:360px}.map-panel{max-height:none}.world-map-head{align-items:flex-start;flex-direction:column}.world-map-tabs{width:100%}.travel-prep-grid{grid-template-columns:1fr}}
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
    viewport.classList.remove('world-globe-mode');
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
    if (filters.resources !== false) drawObjects(c, scale, ox, oy, new Set(['tree','bush','berry','rock','ore','logs','cactus','oak_tree','birch_tree','pine_tree','palm_tree','willow_tree']), '#fde68a');
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
    viewport.classList.add('world-globe-mode');
    if (subtitle) subtitle.textContent = `Planeta ${wm?.planetSeed || state.config?.seed} · ${Object.keys(wm?.visitedSites || {}).length}/${wm?.landingSites?.length || 0} setores visitados · ${(wm?.routes || []).length} rotas`;
    viewport.innerHTML = '<canvas id="worldMapCanvas"></canvas>';
    panel.innerHTML = worldPanelHtml(wm, selected);
    legend.innerHTML = `<span><i style="--c:${SITE.current}"></i>Atual</span><span><i style="--c:${SITE.known}"></i>Conhecido</span><span><i style="--c:${SITE.visited}"></i>Visitado</span><span><i style="--c:#94a3b8"></i>Rota</span><span><i style="--c:#f59e0b"></i>Mina/Ruina</span>`;
    drawWorldMap(wm, selected);
    const canvas = document.getElementById('worldMapCanvas');
    canvas.onclick = clickWorldMap;
  }

  function siteType(site) {
    return site?.discoveryType || site?.labels?.siteTypeLabel || site?.archetype || 'landing';
  }

  function siteTypeLabel(site) {
    const type = siteType(site);
    return ({
      landing: 'Pouso',
      mine: 'Mina',
      dungeon: 'Dungeon',
      outpost: 'Construção',
      grove: 'Bosque',
      water: 'Água',
      danger: 'Anomalia',
      ancient_ruins: 'Ruína',
      rocky_valley: 'Mineral',
      dense_forest: 'Bosque',
      riverbank: 'Água',
      safe: 'Seguro',
      extreme: 'Anomalia'
    })[type] || site?.discoveryLabel || site?.labels?.siteTypeLabel || 'Setor';
  }

  function siteGlyph(site) {
    const type = siteType(site);
    return ({ mine: 'M', dungeon: 'D', outpost: 'O', grove: 'B', water: 'A', danger: '!', ancient_ruins: 'R', rocky_valley: 'M', riverbank: 'A', extreme: '!' })[type] || '';
  }

  function siteTypeColor(site) {
    const type = siteType(site);
    return ({ mine: '#f59e0b', dungeon: '#c084fc', outpost: '#eab308', grove: '#22c55e', water: '#38bdf8', danger: '#ef4444', ancient_ruins: '#c084fc', rocky_valley: '#f59e0b', riverbank: '#38bdf8', extreme: '#ef4444' })[type] || (SITE[site?.state] || SITE.known);
  }

  function worldPanelHtml(wm, site) {
    if (!site) return '<h3>Mapa Mundo</h3><p>Nenhum local detectado.</p>';
    const plan = travel()?.calculateTravelPlan?.(site.id, { mode: selectedMode });
    const validation = travel()?.canTravel?.(plan) || { ok:false, reasons:['Plano indisponível.'], warnings:[] };
    const resources = site.resources || {};
    const risks = site.risks || {};
    const current = site.id === wm.currentSiteId;
    const routes = (wm.routes || []).filter(route => route.from === site.id || route.to === site.id);
    const signatures = (site.signatures || []).slice(0, 4);
    const signatureChips = signatures.map(sig => `<span class="map-chip">${esc(sig.name || sig.kind || sig.key)}</span>`).join('');
    return `<h3>Destino selecionado</h3><h2>${esc(site.name)}</h2><p>${esc(site.labels?.subtitle || site.labels?.biomeLabel || 'Setor detectado por varredura orbital.')}</p><div class="map-chip-row"><span class="map-chip">${esc(siteTypeLabel(site))}</span><span class="map-chip">${esc(site.state || 'known')}</span><span class="map-chip">${esc(site.difficulty?.label || 'Moderado')}</span><span class="map-chip">${routes.length} rotas</span></div>${signatureChips ? `<h3 style="margin-top:12px">Assinaturas</h3><div class="map-chip-row">${signatureChips}</div>` : ''}<div class="map-stat-grid"><div class="map-stat"><small>Distância</small><b>${plan?.distance ?? 0}</b></div><div class="map-stat"><small>Tempo</small><b>${plan?.estimatedHours ?? 0}h</b></div><div class="map-stat"><small>Risco</small><b>${esc(plan?.riskLabel || 'N/A')}</b></div><div class="map-stat"><small>Comida</small><b>${plan?.foodCost ?? 0}</b></div></div><h3>Recursos esperados</h3><div class="map-bars">${resourceBars(resources,false)}</div><h3 style="margin-top:12px">Riscos</h3><div class="map-bars">${resourceBars(risks,true)}</div><h3 style="margin-top:12px">Modo da viagem</h3><div class="map-mode-row">${travelModeButtons()}</div>${validation.reasons?.length ? `<div class="map-warning">${validation.reasons.map(esc).join('<br>')}</div>` : ''}${validation.warnings?.length ? `<div class="map-warning">${validation.warnings.map(esc).join('<br>')}</div>` : ''}<div class="map-actions"><button class="primary" data-prepare-travel="${esc(site.id)}" ${current || !validation.ok ? 'disabled' : ''}>Preparar expedição</button><button data-establish-outpost="${esc(wm.currentSiteId)}">Estabelecer posto neste setor</button></div><h3 style="margin-top:14px">Locais detectados</h3><div class="map-list">${wm.landingSites.map(s=>`<button data-world-site="${esc(s.id)}" class="${s.id===site.id?'active':''}"><span>${esc(s.name)}<small>${esc(siteTypeLabel(s))}</small></span><b>${esc(s.state||'known')}</b></button>`).join('')}</div>`;
  }

  function travelModeButtons() {
    return Object.entries(travel()?.modes || {}).map(([key,mode]) => `<button class="map-mode-btn ${selectedMode===key?'active':''}" data-travel-mode="${key}">${esc(mode.label)}</button>`).join('');
  }

  function resourceBars(src, danger) {
    const entries = danger ? [['Fauna','fauna'],['Clima','weather'],['Doença','disease'],['Ameaças','raids'],['Terreno','terrain']] : [['Madeira','wood'],['Comida','food'],['Pedra','stone'],['Metal','metal'],['Remédio','medicine'],['Água','water']];
    return entries.map(([label,key]) => `<div class="map-bar ${danger?'danger':''}"><b>${esc(label)}</b><span><i style="--v:${clamp(src[key]||0,0,100)}%"></i></span><em>${clamp(src[key]||0,0,100)}</em></div>`).join('');
  }

  function drawSpace(c, canvas, seed) {
    const bg = c.createRadialGradient(canvas.width * 0.5, canvas.height * 0.5, 20, canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.72);
    bg.addColorStop(0, '#0d1b32');
    bg.addColorStop(0.48, '#050a18');
    bg.addColorStop(1, '#020617');
    c.fillStyle = bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 120; i++) {
      const x = seeded(seed, `star-x-${i}`) * canvas.width;
      const y = seeded(seed, `star-y-${i}`) * canvas.height;
      const a = 0.18 + seeded(seed, `star-a-${i}`) * 0.55;
      const r = 0.55 + seeded(seed, `star-r-${i}`) * 1.25;
      c.fillStyle = `rgba(226,232,240,${a.toFixed(3)})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawPlanetBase(c, cx, cy, radius) {
    const planet = c.createRadialGradient(cx - radius * 0.30, cy - radius * 0.36, radius * 0.08, cx, cy, radius);
    planet.addColorStop(0, '#4cc9f0');
    planet.addColorStop(0.36, '#186b8f');
    planet.addColorStop(0.72, '#0f3b63');
    planet.addColorStop(1, '#07162b');
    c.fillStyle = planet;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();
  }

  function drawContinents(c, cx, cy, radius, seed, sites = []) {
    for (let i = 0; i < 9; i++) {
      const angle = seeded(seed, `land-a-${i}`) * Math.PI * 2;
      const distFromCenter = radius * (0.12 + seeded(seed, `land-d-${i}`) * 0.54);
      const bx = cx + Math.cos(angle) * distFromCenter;
      const by = cy + Math.sin(angle) * distFromCenter * 0.78;
      const base = radius * (0.12 + seeded(seed, `land-r-${i}`) * 0.14);
      const hue = seeded(seed, `land-h-${i}`);
      c.fillStyle = hue > 0.72 ? 'rgba(154,130,73,.78)' : hue > 0.42 ? 'rgba(57,119,76,.82)' : 'rgba(78,137,63,.80)';
      c.beginPath();
      for (let p = 0; p < 18; p++) {
        const t = (p / 18) * Math.PI * 2;
        const wobble = 0.70 + seeded(seed, `land-${i}-${p}`) * 0.55;
        const rx = base * wobble * (1.25 + seeded(seed, `land-wide-${i}`) * 0.55);
        const ry = base * wobble * (0.72 + seeded(seed, `land-tall-${i}`) * 0.44);
        const x = bx + Math.cos(t) * rx;
        const y = by + Math.sin(t) * ry;
        if (p === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
    }

    drawSiteLandAnchors(c, radius, seed, sites);

    c.fillStyle = 'rgba(211,230,169,.10)';
    for (let i = 0; i < 34; i++) {
      const x = cx + (seeded(seed, `speck-x-${i}`) - 0.5) * radius * 1.55;
      const y = cy + (seeded(seed, `speck-y-${i}`) - 0.5) * radius * 1.35;
      if (Math.hypot(x - cx, y - cy) > radius * 0.92) continue;
      c.beginPath();
      c.arc(x, y, radius * (0.006 + seeded(seed, `speck-r-${i}`) * 0.010), 0, Math.PI * 2);
      c.fill();
    }
  }

  function siteLandPalette(site) {
    const type = siteType(site);
    if (type === 'mine' || type === 'rocky_valley') return { shore: 'rgba(194,158,91,.54)', body: 'rgba(123,116,83,.82)', detail: 'rgba(203,190,137,.22)' };
    if (type === 'dungeon' || type === 'outpost' || type === 'ancient_ruins') return { shore: 'rgba(186,148,88,.54)', body: 'rgba(107,122,76,.82)', detail: 'rgba(205,180,116,.20)' };
    if (type === 'water' || type === 'riverbank') return { shore: 'rgba(203,177,103,.55)', body: 'rgba(74,139,83,.82)', detail: 'rgba(56,189,248,.28)' };
    if (type === 'danger' || type === 'extreme') return { shore: 'rgba(207,137,78,.55)', body: 'rgba(132,103,66,.84)', detail: 'rgba(239,68,68,.20)' };
    if (type === 'grove' || type === 'dense_forest') return { shore: 'rgba(177,165,86,.52)', body: 'rgba(66,142,74,.86)', detail: 'rgba(139,195,93,.24)' };
    return { shore: 'rgba(194,165,91,.50)', body: 'rgba(78,137,63,.84)', detail: 'rgba(211,230,169,.18)' };
  }

  function drawOrganicPatch(c, x, y, rx, ry, seed, salt, fillStyle, points = 16) {
    c.fillStyle = fillStyle;
    c.beginPath();
    for (let i = 0; i < points; i++) {
      const t = (i / points) * Math.PI * 2;
      const wobble = 0.74 + seeded(seed, `${salt}-w-${i}`) * 0.48;
      const px = x + Math.cos(t) * rx * wobble;
      const py = y + Math.sin(t) * ry * wobble;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  function drawSiteLandAnchors(c, radius, seed, sites) {
    sites.forEach((site, index) => {
      const p = sitePoint(site);
      const type = siteType(site);
      const palette = siteLandPalette(site);
      const base = radius * (type === 'water' ? 0.090 : type === 'danger' ? 0.078 : 0.074);
      const rx = base * (1.10 + seeded(seed, `site-land-rx-${site.id}`) * 0.55);
      const ry = base * (0.82 + seeded(seed, `site-land-ry-${site.id}`) * 0.42);
      const angle = seeded(seed, `site-land-angle-${site.id}`) * Math.PI * 2;

      c.save();
      c.translate(p.x, p.y);
      c.rotate(angle);
      drawOrganicPatch(c, 0, 0, rx * 1.70, ry * 1.62, seed, `shore-${site.id}`, palette.shore, 18);
      drawOrganicPatch(c, 0, 0, rx, ry, seed, `land-${site.id}`, palette.body, 18);
      if (type === 'water' || type === 'riverbank') {
        drawOrganicPatch(c, rx * 0.18, -ry * 0.08, rx * 0.35, ry * 0.22, seed, `lagoon-${site.id}`, 'rgba(56,189,248,.34)', 12);
      } else if (type === 'mine' || type === 'dungeon' || type === 'outpost') {
        drawOrganicPatch(c, -rx * 0.10, ry * 0.04, rx * 0.38, ry * 0.26, seed, `rock-detail-${site.id}`, palette.detail, 12);
      } else {
        drawOrganicPatch(c, rx * 0.12, ry * 0.02, rx * 0.36, ry * 0.24, seed, `green-detail-${site.id}`, palette.detail, 12);
      }
      c.restore();

      if (index % 3 === 0) {
        c.fillStyle = 'rgba(80, 150, 84, .20)';
        c.beginPath();
        c.arc(p.x + rx * 0.45, p.y + ry * 0.35, Math.max(2, radius * 0.010), 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  function drawGlobeGrid(c, cx, cy, radius) {
    c.strokeStyle = 'rgba(191,219,254,.16)';
    c.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const y = cy + i * radius * 0.22;
      const w = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / radius, 2))) * radius;
      c.beginPath();
      c.ellipse(cx, y, w, radius * 0.06, 0, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.ellipse(cx + i * radius * 0.12, cy, radius * (0.36 - Math.abs(i) * 0.035), radius * 0.96, 0, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.beginPath();
      c.ellipse(cx - i * radius * 0.12, cy, radius * (0.36 - Math.abs(i) * 0.035), radius * 0.96, 0, Math.PI / 2, Math.PI * 1.5);
      c.stroke();
    }
  }

  function drawRoute(c, a, b, route, selected) {
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const midx = (a.x + b.x) / 2;
    const midy = (a.y + b.y) / 2;
    const bend = (seeded(lastWorldScale.seed, `route-${route.from}-${route.to}`) - 0.5) * Math.min(72, len * 0.32);
    const ctrlX = midx - (dy / len) * bend + (midx - lastWorldScale.cx) * 0.12;
    const ctrlY = midy + (dx / len) * bend + (midy - lastWorldScale.cy) * 0.12;
    const active = selected && (route.from === selected.id || route.to === selected.id);
    c.save();
    c.strokeStyle = active ? 'rgba(250,204,21,.88)' : route.roadType === 'road' ? 'rgba(226,183,92,.55)' : route.roadType === 'hazard' ? 'rgba(248,113,113,.42)' : 'rgba(148,163,184,.34)';
    c.lineWidth = active ? 3 : route.roadType === 'road' ? 1.8 : 1.25;
    if (!route.known || route.roadType === 'long') c.setLineDash([7, 6]);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);
    c.stroke();
    c.restore();
  }

  function drawWorldSite(c, wm, site, selected) {
    const p = sitePoint(site);
    const isSel = site.id === selected?.id;
    const isCur = site.id === wm.currentSiteId;
    const stateColor = SITE[site.state] || SITE.known;
    const typeColor = siteTypeColor(site);
    const r = isCur ? 12 : isSel ? 11 : 7.5;
    const glow = isSel || isCur ? 0.32 : 0.10;
    c.fillStyle = `rgba(250,204,21,${glow})`;
    c.beginPath();
    c.arc(p.x, p.y, r + 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = typeColor;
    c.strokeStyle = isSel ? '#fff7ed' : stateColor;
    c.lineWidth = isSel ? 3 : 2;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const glyph = siteGlyph(site);
    if (glyph) {
      c.fillStyle = '#0f172a';
      c.font = '900 10px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(glyph, p.x, p.y + 0.5);
    }
    if (site.state === 'quest') {
      c.fillStyle = '#fff';
      c.font = '900 11px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('*', p.x, p.y - 1);
    }
    c.textBaseline = 'alphabetic';
    c.fillStyle = isSel || isCur ? '#fff7ed' : 'rgba(226,232,240,.78)';
    c.font = isSel || isCur ? '800 12px system-ui' : '700 9px system-ui';
    c.textAlign = 'center';
    const label = isSel || isCur || wm.landingSites.length <= 18 ? site.name : siteTypeLabel(site);
    c.fillText(label, p.x, p.y + r + 15);
  }

  function drawPlanetRim(c, cx, cy, radius) {
    const shade = c.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, radius * 0.18, cx, cy, radius);
    shade.addColorStop(0, 'rgba(255,255,255,0)');
    shade.addColorStop(0.62, 'rgba(2,6,23,0)');
    shade.addColorStop(1, 'rgba(2,6,23,.64)');
    c.fillStyle = shade;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(191,219,254,.38)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(125,211,252,.12)';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    c.stroke();
  }

  function drawWorldMap(wm, selected) {
    const canvas = document.getElementById('worldMapCanvas');
    if (!canvas || !wm) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(500, Math.floor(rect.width));
    canvas.height = Math.max(420, Math.floor(rect.height));
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width * 0.50;
    const cy = canvas.height * 0.50;
    const radius = Math.max(150, Math.min(canvas.width * 0.42, canvas.height * 0.44));
    lastWorldScale = { cx, cy, radius, sites: new Map(), seed: wm.planetSeed || state?.config?.seed || 'havenfall' };

    drawSpace(c, canvas, lastWorldScale.seed);
    drawPlanetBase(c, cx, cy, radius);

    c.save();
    c.beginPath();
    c.arc(cx, cy, radius, 0, Math.PI * 2);
    c.clip();
    drawContinents(c, cx, cy, radius, lastWorldScale.seed, wm.landingSites || []);
    drawGlobeGrid(c, cx, cy, radius);

    for (const route of wm.routes || []) {
      const from = wm.landingSites.find(site => site.id === route.from);
      const to = wm.landingSites.find(site => site.id === route.to);
      if (!from || !to) continue;
      drawRoute(c, sitePoint(from), sitePoint(to), route, selected);
    }

    for (const site of wm.landingSites || []) drawWorldSite(c, wm, site, selected);
    c.restore();

    drawPlanetRim(c, cx, cy, radius);
  }

  function sitePoint(site) {
    if (!lastWorldScale) return { x: 0, y: 0, z: 0 };
    if (lastWorldScale.sites?.has(site.id)) return lastWorldScale.sites.get(site.id);
    const nx = (clamp(site.globe?.x ?? .5, .04, .96) - 0.5) * 2;
    const ny = (clamp(site.globe?.y ?? .5, .04, .96) - 0.5) * 2;
    let px = nx * 0.84;
    let py = ny * 0.74;
    const d = Math.hypot(px, py);
    if (d > 0.94) { px *= 0.94 / d; py *= 0.94 / d; }
    const z = Math.sqrt(Math.max(0, 1 - px * px - py * py));
    const point = {
      x: lastWorldScale.cx + px * lastWorldScale.radius,
      y: lastWorldScale.cy + py * lastWorldScale.radius,
      z
    };
    lastWorldScale.sites?.set(site.id, point);
    return point;
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
