'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const uiState = window.HavenfallCraftingUiState = window.HavenfallCraftingUiState || { recipeKey: null, search: '' };
  const resourceLabels = { wood: 'Madeira', stone: 'Pedra', food: 'Comida', metal: 'Metal', medicine: 'Remédio' };

  function h(value) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(String(value ?? ''))
      : String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function stations() {
    if (!state?.objects) return [];
    const recipeStations = new Set(Object.values(recipeDefs || {}).map(r => r.station).filter(Boolean));
    return state.objects.filter(o => recipeStations.has(o.type));
  }

  function stationName(type) {
    return stationLabels?.[type] || objectDefs?.[type]?.name || type;
  }

  function selectedStation(list = stations()) {
    const selected = list.find(o => String(o.id) === String(selectedCraftStationId));
    if (selected) return selected;
    if (list.length === 1) {
      selectedCraftStationId = list[0].id;
      return list[0];
    }
    return null;
  }

  function idleColonists(exclude = new Set()) {
    return (state?.colonists || []).filter(c => !exclude.has(c.id) && !c.task && !c.isUnconscious && c.health > 15 && c.energy > 12);
  }

  function selectedWorker(station = null, exclude = new Set()) {
    const selected = typeof selectedColonist === 'function' ? selectedColonist() : null;
    if (selected && !exclude.has(selected.id) && !selected.task && !selected.isUnconscious && selected.health > 15 && selected.energy > 12) return selected;
    const workers = idleColonists(exclude);
    if (!workers.length) return null;
    if (!station) return workers[0];
    return workers.sort((a, b) => Math.abs(a.x - station.x) + Math.abs(a.y - station.y) - (Math.abs(b.x - station.x) + Math.abs(b.y - station.y)))[0];
  }

  function recipeListForStation(station) {
    if (!station) return [];
    const query = String(uiState.search || '').trim().toLowerCase();
    return Object.entries(recipeDefs || {})
      .filter(([, recipe]) => recipe.station === station.type)
      .filter(([, recipe]) => !query || `${recipe.label} ${recipe.desc || ''} ${itemCostText(recipe.cost, recipe.itemCost)} ${outputText(recipe.output)}`.toLowerCase().includes(query))
      .sort(([aKey, a], [bKey, b]) => {
        const aUnlocked = typeof recipeUnlocked === 'function' ? recipeUnlocked(aKey) : true;
        const bUnlocked = typeof recipeUnlocked === 'function' ? recipeUnlocked(bKey) : true;
        const aAffordable = typeof hasRecipeCost === 'function' ? hasRecipeCost(a) : true;
        const bAffordable = typeof hasRecipeCost === 'function' ? hasRecipeCost(b) : true;
        return Number(bUnlocked) - Number(aUnlocked) || Number(bAffordable) - Number(aAffordable) || String(a.label).localeCompare(String(b.label));
      });
  }

  function ensureSelectedRecipe(recipes) {
    if (recipes.some(([key]) => key === uiState.recipeKey)) return uiState.recipeKey;
    const firstAvailable = recipes.find(([key, recipe]) => (typeof recipeUnlocked !== 'function' || recipeUnlocked(key)) && (typeof hasRecipeCost !== 'function' || hasRecipeCost(recipe)));
    uiState.recipeKey = firstAvailable?.[0] || recipes[0]?.[0] || null;
    return uiState.recipeKey;
  }

  function recipeStatus(key, recipe, station, worker) {
    if (!station) return { ok: false, label: 'Sem estação', detail: 'Selecione uma estação de trabalho.' };
    if (!worker) return { ok: false, label: 'Sem colono livre', detail: 'Todos estão ocupados, cansados ou incapazes de fabricar agora.' };
    if (typeof recipeUnlocked === 'function' && !recipeUnlocked(key)) return { ok: false, label: 'Bloqueada', detail: `Pesquise ${researchDefs?.[recipe.unlock]?.label || recipe.unlock}.` };
    if (typeof hasRecipeCost === 'function' && !hasRecipeCost(recipe)) return { ok: false, label: 'Faltam recursos', detail: `Precisa de ${itemCostText(recipe.cost, recipe.itemCost)}.` };
    return { ok: true, label: 'Disponível', detail: recipe.desc || 'Receita pronta para fabricação.' };
  }

  function recipeProgress(key) {
    const workers = (state?.colonists || []).filter(c => c.task?.type === 'craft' && c.task.recipeKey === key);
    if (!workers.length) return { pct: 0, text: '' };
    const recipe = recipeDefs[key];
    const worker = workers[0];
    const pct = Math.max(0, Math.min(100, Math.floor(((worker.work || 0) / Math.max(1, recipe?.duration || 1)) * 100)));
    return { pct, text: `${worker.name} · ${pct}%`, count: workers.length };
  }

  function resourcesSummary() {
    const resources = state?.resources || {};
    const items = state?.items || {};
    const base = Object.keys(resourceLabels).map(key => `<span><b>${h(resourceLabels[key])}</b>${h(resources[key] ?? 0)}</span>`).join('');
    const itemCount = Object.values(items).reduce((sum, value) => sum + Number(value || 0), 0);
    return `<div class="craft-resource-strip">${base}<span><b>Itens</b>${itemCount}</span></div>`;
  }

  function stationStatus(station) {
    if (!station) return 'Escolha uma estação para ver receitas.';
    const active = (state?.colonists || []).filter(c => c.task?.type === 'craft' && String(c.task.objId) === String(station.id));
    if (!active.length) return 'Livre para produção.';
    return `${active.length} trabalho${active.length > 1 ? 's' : ''} em andamento.`;
  }

  function renderStations(list, selected) {
    if (!list.length) return `<div class="craft-empty-panel"><b>Nenhuma estação construída</b><span>Construa uma Bancada, Forja, Fogão ou Estação Médica para liberar receitas.</span></div>`;
    return `<div class="craft-station-list">${list.map(o => {
      const active = selected?.id === o.id;
      const count = Object.values(recipeDefs || {}).filter(recipe => recipe.station === o.type).length;
      return `<button type="button" class="craft-station ${active ? 'is-active' : ''}" data-craft-station-id="${h(o.id)}"><span><b>${h(stationName(o.type))}</b><small>${count} receita${count !== 1 ? 's' : ''}</small></span><em>${h(o.x)},${h(o.y)}</em></button>`;
    }).join('')}</div>`;
  }

  function renderRecipeRow(key, recipe, station, worker) {
    const status = recipeStatus(key, recipe, station, worker);
    const progress = recipeProgress(key);
    const active = uiState.recipeKey === key;
    return `<button type="button" class="craft-recipe-row ${active ? 'is-selected' : ''} ${status.ok ? '' : 'is-locked'}" data-craft-select-recipe="${h(key)}"><span class="craft-recipe-main"><b>${h(recipe.label)}</b><small>${h(outputText(recipe.output))}</small></span><span class="craft-recipe-meta"><em>${h(status.label)}</em><small>${h(recipe.duration || 1)}s</small></span>${progress.pct ? `<i class="craft-mini-progress"><b style="width:${progress.pct}%"></b></i>` : ''}</button>`;
  }

  function renderRecipeList(recipes, station, worker) {
    if (!station) return `<div class="craft-empty-panel"><b>Selecione uma estação</b><span>As receitas aparecem aqui depois que você escolhe onde fabricar.</span></div>`;
    if (!recipes.length) return `<div class="craft-empty-panel"><b>Nenhuma receita encontrada</b><span>Limpe a busca ou use outra estação.</span></div>`;
    return `<div class="craft-recipe-list">${recipes.map(([key, recipe]) => renderRecipeRow(key, recipe, station, worker)).join('')}</div>`;
  }

  function renderRequirements(recipe) {
    const resourceRows = Object.entries(recipe?.cost || {}).map(([key, amount]) => {
      const have = Number(state?.resources?.[key] || 0);
      return `<span class="${have >= amount ? 'ok' : 'bad'}"><b>${h(resourceLabels[key] || key)}</b>${have}/${amount}</span>`;
    }).join('');
    const itemRows = Object.entries(recipe?.itemCost || {}).map(([key, amount]) => {
      const have = Number(state?.items?.[key] || 0);
      return `<span class="${have >= amount ? 'ok' : 'bad'}"><b>${h(itemDefs?.[key]?.label || key)}</b>${have}/${amount}</span>`;
    }).join('');
    return resourceRows || itemRows ? `<div class="craft-requirements">${resourceRows}${itemRows}</div>` : '<div class="craft-requirements"><span class="ok"><b>Custo</b>Grátis</span></div>';
  }

  function renderDetails(key, recipe, station, worker) {
    if (!key || !recipe) return `<div class="craft-detail-card is-empty"><b>Nenhuma receita selecionada</b><span>Escolha uma receita para ver custo, resultado e produção.</span></div>`;
    const status = recipeStatus(key, recipe, station, worker);
    const progress = recipeProgress(key);
    return `<div class="craft-detail-card"><div class="craft-detail-head"><span><small>Receita selecionada</small><b>${h(recipe.label)}</b></span><em class="${status.ok ? 'ok' : 'bad'}">${h(status.label)}</em></div><p>${h(status.detail)}</p><div class="craft-detail-grid"><span><b>Resultado</b>${h(outputText(recipe.output))}</span><span><b>Tempo</b>${h(recipe.duration || 1)}s</span><span><b>Trabalhador</b>${h(worker?.name || 'Nenhum')}</span><span><b>Estação</b>${h(station ? `${stationName(station.type)} ${station.x},${station.y}` : 'Nenhuma')}</span></div><h4>Materiais</h4>${renderRequirements(recipe)}${progress.text ? `<div class="craft-progress-block"><span>${h(progress.text)}${progress.count > 1 ? ` +${progress.count - 1}` : ''}</span><i><b style="width:${progress.pct}%"></b></i></div>` : ''}<div class="craft-actions"><button type="button" data-craft-start="1" ${status.ok ? '' : 'disabled'}>Fabricar 1</button><button type="button" data-craft-start="3" ${status.ok ? '' : 'disabled'}>Fabricar 3</button><button type="button" data-craft-start="5" ${status.ok ? '' : 'disabled'}>Fabricar 5</button></div></div>`;
  }

  function renderQueue() {
    const queue = (state?.colonists || []).filter(c => c.task?.type === 'craft');
    if (!queue.length) return `<div class="craft-queue"><h4>Fila</h4><span class="craft-muted">Nenhuma fabricação em andamento.</span></div>`;
    return `<div class="craft-queue"><h4>Fila</h4>${queue.map(c => {
      const recipe = recipeDefs?.[c.task.recipeKey];
      const pct = Math.max(0, Math.min(100, Math.floor(((c.work || 0) / Math.max(1, recipe?.duration || 1)) * 100)));
      return `<div class="craft-queue-row"><span><b>${h(recipe?.label || c.task.recipeKey)}</b><small>${h(c.name)}</small></span><em>${pct}%</em></div>`;
    }).join('')}</div>`;
  }

  function render() {
    ensureStyle();
    if (!state) return '<div class="dock-empty">Inicie uma partida para fabricar.</div>';
    const list = stations();
    const selected = selectedStation(list);
    const worker = selectedWorker(selected);
    const recipes = recipeListForStation(selected);
    const selectedKey = ensureSelectedRecipe(recipes);
    const selectedRecipe = selectedKey ? recipeDefs[selectedKey] : null;
    return `<div class="craft-panel"><header class="craft-header"><div><small>PRODUÇÃO</small><h3>Crafting</h3><p>Escolha uma estação, selecione a receita e envie um colono livre para fabricar.</p></div><div class="craft-header-status"><span>${h(selected ? stationName(selected.type) : 'Sem estação')}</span><b>${h(stationStatus(selected))}</b></div></header>${resourcesSummary()}<div class="craft-layout"><aside class="craft-column craft-stations"><div class="craft-column-title"><b>Estações</b><small>${list.length}</small></div>${renderStations(list, selected)}</aside><section class="craft-column craft-recipes"><div class="craft-column-title"><b>Receitas</b><input type="search" placeholder="Buscar..." value="${h(uiState.search)}" data-craft-search></div>${renderRecipeList(recipes, selected, worker)}</section><aside class="craft-column craft-details">${renderDetails(selectedKey, selectedRecipe, selected, worker)}${renderQueue()}</aside></div></div>`;
  }

  function assignMany(qty) {
    const stationObj = selectedStation();
    const key = uiState.recipeKey;
    const recipe = key ? recipeDefs?.[key] : null;
    if (!stationObj || !key || !recipe) return;
    let started = 0;
    const used = new Set();
    for (let i = 0; i < qty; i++) {
      if (typeof hasRecipeCost === 'function' && !hasRecipeCost(recipe)) break;
      const worker = selectedWorker(stationObj, used);
      if (!worker) break;
      assignCraft(worker, key, stationObj);
      if (worker.task?.type === 'craft') {
        used.add(worker.id);
        started++;
      }
    }
    if (!started && typeof log === 'function') log('Não foi possível iniciar fabricação agora. Verifique trabalhador livre, estação e recursos.');
    if (started && typeof log === 'function') log(`${started} fabricação${started > 1 ? 'ões' : ''} iniciada${started > 1 ? 's' : ''}.`);
    if (typeof updateUI === 'function') updateUI(true);
    window.HavenfallUI.refreshDockPanel?.('crafting');
  }

  function handleClick(event) {
    const station = event.target.closest?.('[data-craft-station-id]');
    if (station) {
      event.preventDefault?.();
      event.stopPropagation?.();
      selectedCraftStationId = station.dataset.craftStationId;
      uiState.recipeKey = null;
      window.HavenfallUI.refreshDockPanel?.('crafting');
      return;
    }
    const row = event.target.closest?.('[data-craft-select-recipe]');
    if (row) {
      event.preventDefault?.();
      event.stopPropagation?.();
      uiState.recipeKey = row.dataset.craftSelectRecipe;
      window.HavenfallUI.refreshDockPanel?.('crafting');
      return;
    }
    const start = event.target.closest?.('[data-craft-start]');
    if (start) {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (start.disabled) return;
      assignMany(Math.max(1, Number(start.dataset.craftStart || 1)));
    }
  }

  function handleInput(event) {
    const input = event.target.closest?.('[data-craft-search]');
    if (!input) return;
    uiState.search = input.value || '';
    uiState.recipeKey = null;
    window.HavenfallUI.refreshDockPanel?.('crafting');
  }

  function ensureStyle() {
    let style = document.getElementById('crafting-panel-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'crafting-panel-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      .craft-panel{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;min-height:0;color:#e5edf8}.craft-header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:12px 14px;border:1px solid rgba(148,163,184,.18);border-radius:14px;background:linear-gradient(135deg,rgba(15,23,42,.92),rgba(2,6,23,.72))}.craft-header small{color:#d6a24a;font:900 10px system-ui;letter-spacing:.16em}.craft-header h3{margin:0;color:#fff4d9;font:950 22px/1.05 system-ui;text-transform:uppercase;letter-spacing:.06em}.craft-header p{margin:2px 0 0;color:#94a3b8;font-size:12px}.craft-header-status{min-width:190px;text-align:right}.craft-header-status span{display:block;color:#f8d78a;font-weight:950}.craft-header-status b{display:block;color:#93a4b8;font-size:11px;font-weight:700}.craft-resource-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.craft-resource-strip span{padding:8px 10px;border:1px solid rgba(148,163,184,.14);border-radius:10px;background:rgba(15,23,42,.66);font-weight:950;text-align:center}.craft-resource-strip b{display:block;color:#8ea2b7;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.craft-layout{display:grid;grid-template-columns:minmax(170px,.75fr) minmax(260px,1.15fr) minmax(280px,1fr);gap:10px;min-height:0}.craft-column{min-height:0;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(6,10,18,.72);overflow:hidden}.craft-column-title{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.72)}.craft-column-title b{color:#fff4d9;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.craft-column-title small{color:#7dd3fc}.craft-column-title input{width:150px;max-width:55%;border:1px solid rgba(148,163,184,.22);border-radius:999px;background:#050914;color:#e5edf8;padding:7px 10px;outline:none}.craft-station-list,.craft-recipe-list{display:grid;gap:7px;padding:10px;overflow:auto;max-height:420px}.craft-station,.craft-recipe-row{border:1px solid rgba(148,163,184,.14);border-radius:12px;background:linear-gradient(180deg,rgba(30,41,59,.55),rgba(15,23,42,.58));color:#dbe7f5;text-align:left;cursor:pointer}.craft-station{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px}.craft-station b,.craft-recipe-row b{display:block;color:#f8fafc}.craft-station small,.craft-recipe-row small{display:block;color:#8fa1b5;font-size:11px}.craft-station em{color:#7dd3fc;font-style:normal;font-size:11px}.craft-station.is-active,.craft-recipe-row.is-selected{border-color:#f8d78a;background:linear-gradient(90deg,rgba(214,162,74,.25),rgba(30,41,59,.72));box-shadow:inset 0 0 0 1px rgba(248,215,138,.12)}.craft-recipe-row{position:relative;display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 10px 12px}.craft-recipe-row.is-locked{opacity:.66}.craft-recipe-meta{text-align:right}.craft-recipe-meta em{display:block;font-style:normal;color:#f8d78a;font-size:11px;font-weight:900}.craft-mini-progress{position:absolute;left:10px;right:10px;bottom:5px;height:3px;background:rgba(15,23,42,.95);border-radius:999px;overflow:hidden}.craft-mini-progress b{display:block;height:100%;background:#7dd3fc}.craft-details{display:grid;grid-template-rows:auto minmax(90px,auto);gap:10px;padding:10px;background:rgba(2,6,23,.58)}.craft-detail-card{border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(15,23,42,.62);padding:12px}.craft-detail-card.is-empty,.craft-empty-panel{display:grid;place-content:center;gap:4px;min-height:150px;padding:18px;text-align:center;color:#94a3b8}.craft-empty-panel b,.craft-detail-card.is-empty b{color:#fff4d9}.craft-detail-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.craft-detail-head small{display:block;color:#8ea2b7;text-transform:uppercase;font-size:10px}.craft-detail-head b{display:block;color:#fff4d9;font-size:18px}.craft-detail-head em{font-style:normal;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:950}.craft-detail-head em.ok{background:rgba(34,197,94,.12);color:#86efac}.craft-detail-head em.bad{background:rgba(248,113,113,.12);color:#fecaca}.craft-detail-card p{margin:8px 0;color:#aab8c8;font-size:12px;line-height:1.35}.craft-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.craft-detail-grid span,.craft-requirements span{padding:8px;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(2,6,23,.35);font-size:12px}.craft-detail-grid b,.craft-requirements b{display:block;color:#8ea2b7;font-size:10px;text-transform:uppercase}.craft-detail-card h4,.craft-queue h4{margin:12px 0 7px;color:#fff4d9;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.craft-requirements{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.craft-requirements .ok{color:#d1fae5}.craft-requirements .bad{color:#fecaca;border-color:rgba(248,113,113,.28)}.craft-progress-block{margin-top:10px}.craft-progress-block span{display:block;color:#a9bdd2;font-size:11px;margin-bottom:4px}.craft-progress-block i{display:block;height:7px;border-radius:999px;background:#020617;overflow:hidden}.craft-progress-block b{display:block;height:100%;background:#7dd3fc}.craft-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}.craft-actions button{border:1px solid rgba(248,215,138,.34);border-radius:10px;background:linear-gradient(180deg,#2d3442,#121826);color:#fff4d9;padding:9px;font-weight:950;cursor:pointer}.craft-actions button:disabled{opacity:.38;cursor:not-allowed}.craft-queue{border:1px solid rgba(148,163,184,.13);border-radius:14px;background:rgba(15,23,42,.48);padding:10px}.craft-queue-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(148,163,184,.10)}.craft-queue-row:first-of-type{border-top:0}.craft-queue-row b{color:#eaf2ff}.craft-queue-row small,.craft-muted{display:block;color:#8ea2b7;font-size:11px}.craft-queue-row em{font-style:normal;color:#7dd3fc;font-weight:950}@media(max-width:960px){.craft-layout{grid-template-columns:1fr}.craft-resource-strip{grid-template-columns:repeat(3,1fr)}.craft-station-list,.craft-recipe-list{max-height:220px}.craft-header{align-items:flex-start}.craft-header-status{text-align:left;min-width:0}}`;
  }

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  window.HavenfallUI.tabViews.crafting = { render };
})();