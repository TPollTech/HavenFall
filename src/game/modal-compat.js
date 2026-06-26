'use strict';

function repairModalDomReferences() {
  if (typeof dom === 'undefined') return;
  dom.modal = dom.modal || document.getElementById('eventModal');
  dom.buttons = dom.buttons || {};
  dom.buttons.modalStart = dom.buttons.modalStart || document.getElementById('modalStartBtn');
}

function applyPremiumHeaderPolish() {
  const bar = document.getElementById('top-resource-bar');
  if (!bar) return;
  bar.innerHTML = [
    '<div class="res-item">🥩 Comida: <span id="txt-food">0</span></div>',
    '<div class="res-item">🪵 Madeira: <span id="txt-wood">0</span></div>',
    '<div class="res-item">🪨 Pedra: <span id="txt-stone">0</span></div>',
    '<div class="res-item">🪙 Metal: <span id="txt-metal">0</span></div>',
    '<div class="res-item">💊 Remédios: <span id="txt-meds">0</span></div>'
  ].join('');

  if (!document.getElementById('premium-header-polish-style')) {
    const style = document.createElement('style');
    style.id = 'premium-header-polish-style';
    style.textContent = '#top-resource-bar{height:45px!important;background:linear-gradient(to bottom,rgba(10,15,30,.95) 60%,rgba(10,15,30,.8) 80%,rgba(0,0,0,0))!important;justify-content:center!important;gap:30px!important;color:#f1f5f9!important;font-size:13px!important;font-weight:600!important;letter-spacing:.5px!important;border-bottom:1px solid rgba(59,130,246,.2)!important;box-shadow:0 4px 20px rgba(0,0,0,.4)!important}.res-item{background:rgba(255,255,255,.03)!important;padding:4px 12px!important;border-radius:6px!important;border:1px solid rgba(255,255,255,.05)!important;display:flex!important;align-items:center!important;gap:6px!important;box-shadow:inset 0 1px 3px rgba(0,0,0,.2)!important}.res-item:hover{background:rgba(59,130,246,.1)!important;border-color:rgba(59,130,246,.3)!important}.res-item span{color:#3b82f6!important;font-weight:700!important}.game-popup-modal{width:550px!important;max-height:80vh!important;background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.98))!important;border:2px solid #3b82f6!important;box-shadow:0 0 20px rgba(59,130,246,.2),inset 0 0 15px rgba(255,255,255,.02)!important}.game-popup-modal.is-active{display:flex!important;flex-direction:column!important}.modal-header h3{color:#3b82f6!important}.modal-tabs{display:flex;gap:8px;margin-bottom:15px}.tab-btn{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);color:#94a3b8;padding:6px 14px;border-radius:6px;cursor:pointer}.tab-btn.is-active,.tab-btn:hover{background:#3b82f6;color:#fff}.modal-grid-content{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.build-card{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:12px;text-align:left;cursor:pointer;color:#f8fafc}.build-card:hover{border-color:#60a5fa;background:rgba(59,130,246,.05)}.build-card-title{font-weight:700;margin-bottom:4px}.build-card-desc{font-size:11px;color:#94a3b8}';
    document.head.appendChild(style);
  }
}

function applySimpleBuildCards() {
  const modal = document.getElementById('modal-build');
  const body = modal?.querySelector('.modal-body');
  if (!modal || !body || !window.buildDefs) return;
  const groups = { structures: ['wall', 'door', 'crop'], furniture: ['bed', 'campfire', 'crate', 'bench', 'research_desk'], support: ['torch'] };
  const labels = { structures: 'Estruturas', furniture: 'Mobília', support: 'Suporte' };
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Arquitetura e Planejamento';
  body.innerHTML = '<div class="modal-tabs"></div><div id="simpleBuildGrid" class="modal-grid-content"></div>';
  const tabs = body.querySelector('.modal-tabs');
  Object.entries(labels).forEach(([key, label], index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab-btn ${index === 0 ? 'is-active' : ''}`;
    btn.textContent = label;
    btn.dataset.group = key;
    tabs.appendChild(btn);
  });
  function render(group = 'structures') {
    const grid = document.getElementById('simpleBuildGrid');
    grid.innerHTML = '';
    (groups[group] || groups.structures).forEach(key => {
      const def = buildDefs[key];
      if (!def) return;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'build-card';
      card.dataset.buildKey = key;
      card.innerHTML = `<div class="build-card-title">${def.label || key}</div><div class="build-card-desc">Construção tática para sobrevivência da colônia.</div>`;
      grid.appendChild(card);
    });
    body.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.group === group));
  }
  render('structures');
  body.addEventListener('click', event => {
    const tab = event.target.closest('[data-group]');
    if (tab) { event.preventDefault(); render(tab.dataset.group); return; }
    const card = event.target.closest('[data-build-key]');
    if (!card) return;
    event.preventDefault();
    currentBuild = card.dataset.buildKey;
    if (typeof log === 'function') log(`Construção selecionada: ${buildDefs[currentBuild]?.label || currentBuild}. Clique no mapa para posicionar.`);
    if (window.uiManager?.closeCurrentModal) window.uiManager.closeCurrentModal();
    if (typeof updateUI === 'function') updateUI(true);
  }, { once: false });
}

repairModalDomReferences();
applyPremiumHeaderPolish();
applySimpleBuildCards();
