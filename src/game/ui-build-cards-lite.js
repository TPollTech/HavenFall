'use strict';

(() => {
  function css() {
    if (document.getElementById('ui-build-cards-lite-style')) return;
    const style = document.createElement('style');
    style.id = 'ui-build-cards-lite-style';
    style.textContent = `.game-popup-modal{width:550px!important;max-height:80vh!important;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.98))!important;border:2px solid #3b82f6!important;box-shadow:0 0 20px rgba(59,130,246,.2),inset 0 0 15px rgba(255,255,255,.02)!important}.game-popup-modal.is-active{display:flex!important;flex-direction:column}.modal-tabs{display:flex;gap:8px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:12px;margin-bottom:15px}.tab-btn{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);color:#94a3b8;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer}.tab-btn.is-active,.tab-btn:hover{background:#3b82f6;color:#fff;border-color:#60a5fa}.modal-grid-content{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;overflow-y:auto;padding-right:4px;max-height:50vh}.build-card{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer;text-align:left;min-height:124px}.build-card:hover{border-color:#60a5fa;background:rgba(59,130,246,.05);transform:translateY(-1px)}.build-card.locked{opacity:.55}.build-card-title{font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:4px}.build-card-desc{font-size:11px;color:#94a3b8;line-height:1.4;margin-bottom:10px}.build-card-costs{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.05);padding-top:8px}.cost-badge{font-size:10px;background:rgba(15,23,42,.6);padding:2px 6px;border-radius:4px;color:#cbd5e1}.cost-badge.insufficient{color:#f87171;background:rgba(248,113,113,.05)}@media(max-width:720px){.modal-grid-content{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  const groups = {
    structures: ['wall', 'door', 'crop', 'bridge'],
    furniture: ['bed', 'campfire', 'crate', 'bench', 'research_desk', 'stove', 'forge', 'med_station', 'sewing_table', 'smokehouse'],
    support: ['torch', 'fish_trap', 'water_collector', 'irrigation_channel']
  };
  const groupNames = { structures: 'Estruturas', furniture: 'Mobília', support: 'Suporte' };
  const costNames = { wood: 'Madeira', stone: 'Pedra', food: 'Comida', metal: 'Metal', medicine: 'Remédio', leather: 'Couro', cloth: 'Tecido', nails: 'Pregos' };

  function miss(key, qty, item) {
    const source = item ? state?.items : state?.resources;
    return (source?.[key] || 0) < qty;
  }

  function costs(def) {
    const list = [];
    Object.entries(def.cost || {}).forEach(([key, qty]) => list.push(`<span class="cost-badge ${miss(key, qty) ? 'insufficient' : ''}">${costNames[key] || key} x${qty}</span>`));
    Object.entries(def.itemCost || {}).forEach(([key, qty]) => list.push(`<span class="cost-badge ${miss(key, qty, true) ? 'insufficient' : ''}">${costNames[key] || key} x${qty}</span>`));
    return list.join('') || '<span class="cost-badge">Sem custo</span>';
  }

  function locked(key) {
    return typeof isBuildUnlocked === 'function' && !isBuildUnlocked(key);
  }

  function card(key) {
    const def = buildDefs?.[key];
    if (!def) return '';
    const isLocked = locked(key);
    const text = isLocked && def.requires ? `Requer ${researchDefs?.[def.requires]?.label || def.requires}` : 'Construção tática para sobrevivência da colônia.';
    return `<button type="button" class="build-card ${isLocked ? 'locked' : ''}" data-build-card="${key}"><div><div class="build-card-title">${def.label || key}</div><div class="build-card-desc">${text}</div></div><div class="build-card-costs">${costs(def)}</div></button>`;
  }

  function render(group = 'structures') {
    const grid = document.getElementById('premiumBuildGrid');
    if (!grid) return;
    grid.innerHTML = (groups[group] || groups.structures).map(card).join('');
    document.querySelectorAll('#modal-build .tab-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.group === group));
  }

  function setup() {
    const modal = document.getElementById('modal-build');
    const body = modal?.querySelector('.modal-body');
    if (!body) return;
    const title = modal.querySelector('.modal-header h3');
    if (title) title.textContent = 'Arquitetura e Planejamento';
    body.innerHTML = `<div class="modal-tabs">${Object.entries(groupNames).map(([key, label], i) => `<button type="button" class="tab-btn ${i === 0 ? 'is-active' : ''}" data-group="${key}">${label}</button>`).join('')}</div><div id="premiumBuildGrid" class="modal-grid-content"></div>`;
    render('structures');
  }

  function select(key) {
    const def = buildDefs?.[key];
    if (!def) return;
    if (locked(key)) { if (typeof log === 'function') log(`Precisa pesquisar ${researchDefs?.[def.requires]?.label || 'tecnologia'} antes de construir ${def.label}.`); return; }
    if (typeof cancelZoneToolForAction === 'function') cancelZoneToolForAction('construção selecionada');
    else if (typeof clearZoneTool === 'function') clearZoneTool();
    currentBuild = key;
    if (typeof log === 'function') log(`Construção selecionada: ${def.label}. Clique no mapa para posicionar.`);
    if (window.uiManager?.closeCurrentModal) window.uiManager.closeCurrentModal();
    if (typeof updateUI === 'function') updateUI(true);
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('#modal-build [data-group]');
    if (tab) { event.preventDefault(); event.stopPropagation(); render(tab.dataset.group); return; }
    const item = event.target.closest?.('#modal-build [data-build-card]');
    if (item) { event.preventDefault(); event.stopPropagation(); select(item.dataset.buildCard); }
  }, true);

  css();
  setup();
  window.renderPremiumBuildCards = setup;
})();
