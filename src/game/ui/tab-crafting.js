'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function stations() {
    if (!state?.objects) return [];
    const recipeStations = new Set(Object.values(recipeDefs || {}).map(r => r.station).filter(Boolean));
    return state.objects.filter(o => recipeStations.has(o.type));
  }

  function stationName(type) {
    return stationLabels?.[type] || objectDefs?.[type]?.name || type;
  }

  function selectedStation() {
    return state?.objects?.find(o => o.id === selectedCraftStationId) || null;
  }

  function recipeProgress(key) {
    const worker = state?.colonists?.find(c => c.task?.type === 'craft' && c.task.recipeKey === key);
    if (!worker) return { pct: 0, text: '' };
    const recipe = recipeDefs[key];
    const pct = Math.max(0, Math.min(100, Math.floor(((worker.work || 0) / Math.max(1, recipe?.duration || 1)) * 100)));
    return { pct, text: `${worker.name} · ${pct}%` };
  }

  function renderStations(list, selected) {
    if (!list.length) return '<div class="dock-empty"><b>Nenhum posto de trabalho construído.</b><span>Construa uma Bancada, Forja, Fogão ou Estação Médica para liberar receitas.</span></div>';
    return `<div class="dock-chip-row">${list.map(o => `<button class="dock-chip ${selected?.id === o.id ? 'is-active' : ''}" data-craft-station-id="${o.id}">${stationName(o.type)} <small>${o.x},${o.y}</small></button>`).join('')}</div>`;
  }

  function renderRecipe(key, recipe, station) {
    const unlocked = typeof recipeUnlocked === 'function' ? recipeUnlocked(key) : true;
    const affordable = typeof hasRecipeCost === 'function' ? hasRecipeCost(recipe) : true;
    const disabled = !station || !unlocked || !affordable || !selectedColonist?.();
    const progress = recipeProgress(key);
    const reason = !station ? 'Selecione uma estação' : !unlocked ? `Pesquise ${researchDefs?.[recipe.unlock]?.label || recipe.unlock}` : !affordable ? `Faltam: ${itemCostText(recipe.cost, recipe.itemCost)}` : recipe.desc;
    return `<button class="dock-card recipe-card ${disabled ? 'is-disabled' : ''}" data-craft-recipe="${key}" ${disabled ? 'disabled' : ''}>
      <strong>${escapeHtml(recipe.label)}</strong>
      <small>${escapeHtml(itemCostText(recipe.cost, recipe.itemCost))}</small>
      <small>Resultado: ${escapeHtml(outputText(recipe.output))}</small>
      <em>${escapeHtml(reason || '')}</em>
      <span class="dock-progress"><i style="width:${progress.pct}%"></i></span>
      ${progress.text ? `<small>${escapeHtml(progress.text)}</small>` : ''}
    </button>`;
  }

  function render() {
    if (!state) return '<div class="dock-empty">Inicie uma partida para fabricar.</div>';
    const list = stations();
    const selected = selectedStation();
    const station = selected || null;
    const recipes = station ? Object.entries(recipeDefs || {}).filter(([, r]) => r.station === station.type) : [];
    return `<div class="dock-tab-head"><div><h3>Crafting</h3><p>Receitas filtradas por estação de trabalho selecionada.</p></div></div>
      ${renderStations(list, selected)}
      ${!station ? '<div class="dock-empty"><b>Nenhum posto de trabalho selecionado.</b><span>Escolha uma estação acima ou clique com botão direito numa estação no mapa.</span></div>' : ''}
      ${station ? `<div class="dock-section-title">${stationName(station.type)} · ${station.x},${station.y}</div>` : ''}
      <div class="dock-card-grid">${recipes.length ? recipes.map(([key, recipe]) => renderRecipe(key, recipe, station)).join('') : station ? '<div class="dock-empty">Nenhuma receita disponível nesta estação.</div>' : ''}</div>`;
  }

  function handleClick(event) {
    const station = event.target.closest?.('[data-craft-station-id]');
    if (station) {
      selectedCraftStationId = Number(station.dataset.craftStationId);
      window.HavenfallUI.refreshDockPanel?.('crafting');
      return;
    }
    const recipe = event.target.closest?.('[data-craft-recipe]');
    if (!recipe || recipe.disabled || !state) return;
    const c = selectedColonist?.();
    const stationObj = selectedStation();
    if (!c) { gameLog?.('Selecione um colono para fabricar.', 'warn'); return; }
    assignCraft(c, recipe.dataset.craftRecipe, stationObj);
    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('crafting');
  }

  document.addEventListener('click', handleClick);
  window.HavenfallUI.tabViews.crafting = { render };
})();
