'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  if (window.HavenfallUI.researchOverlayReady) return;
  window.HavenfallUI.researchOverlayReady = true;

  function ensureResearchOverlayElement() {
    let overlay = document.getElementById('research-tree-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = 'research-tree-overlay';
    overlay.className = 'research-tree-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', onResearchOverlayClick);
    return overlay;
  }

  function onResearchOverlayClick(event) {
    if (event.target === event.currentTarget || event.target.closest('[data-close-research-tree]')) closeResearchOverlay();
    const pick = event.target.closest('[data-pick-research]');
    if (pick) chooseResearchNode(pick.dataset.pickResearch);
  }

  function researchKeys() {
    return Array.isArray(researchOrder) && researchOrder.length ? researchOrder : Object.keys(researchDefs || {});
  }

  function isResearchUnlocked(key) {
    return !!state?.research?.unlocked?.[key];
  }

  function researchDescription(key) {
    const map = {
      metalworking: 'Abre produção metálica, ferramentas melhores e novas estruturas.',
      cooking: 'Melhora a comida e estabiliza a rotina de sobrevivência.',
      medicine: 'Libera tratamento, resgate seguro e recuperação dos colonos.'
    };
    return map[key] || 'Tecnologia para expandir a colônia no longo prazo.';
  }

  function nodeHtml(key, index, keys) {
    const def = researchDefs[key];
    if (!def) return '';
    const previous = keys[index - 1];
    const available = !previous || isResearchUnlocked(previous);
    const unlocked = isResearchUnlocked(key);
    const active = state?.research?.current === key;
    const cost = def.cost || 1;
    const progress = active ? Math.min(100, Math.floor(((state.research.progress || 0) / cost) * 100)) : unlocked ? 100 : 0;
    const classes = ['research-node', unlocked ? 'unlocked' : '', active ? 'active' : '', !available ? 'locked' : ''].filter(Boolean).join(' ');
    const unlocks = (def.unlocks || []).map(item => `<span>libera ${escapeHtml(buildDefs?.[item]?.label || item)}</span>`).join('');
    return `<article class="${classes}"><strong>${escapeHtml(def.label)}</strong><p>${escapeHtml(researchDescription(key))}</p><div class="research-progress"><span style="width:${progress}%"></span></div><div class="research-node-badges"><span>custo ${cost}</span>${unlocks}</div>${!unlocked && available ? `<button data-pick-research="${key}">${active ? 'Pesquisando' : 'Definir prioridade'}</button>` : `<small>${unlocked ? 'Concluído' : 'Bloqueado'}</small>`}</article>`;
  }

  function renderResearchOverlay() {
    const overlay = ensureResearchOverlayElement();
    const keys = researchKeys();
    overlay.innerHTML = `<header class="research-tree-header"><div><div class="kicker">Pesquisa</div><h2>Árvore tecnológica</h2><p>Planeje a evolução da colônia por nós conectados. Cada etapa mostra custo, progresso e desbloqueios.</p></div><button data-close-research-tree>Fechar</button></header><div class="research-tree-canvas"><div class="research-lanes">${keys.map((key, index) => `<div class="research-lane">${nodeHtml(key, index, keys)}</div>`).join('')}</div></div>`;
  }

  function openResearchOverlay() {
    if (!state) return;
    if (typeof ensureResearchState === 'function') ensureResearchState();
    renderResearchOverlay();
    const overlay = ensureResearchOverlayElement();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeResearchOverlay() {
    const overlay = document.getElementById('research-tree-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function chooseResearchNode(key) {
    if (!state?.research || !researchDefs?.[key] || isResearchUnlocked(key)) return;
    state.research.current = key;
    state.research.progress = 0;
    if (typeof log === 'function') log(`Pesquisa priorizada: ${researchDefs[key].label}.`);
    if (typeof updateUI === 'function') updateUI(true);
    renderResearchOverlay();
  }

  function bindResearchPill() {
    document.addEventListener('click', event => {
      const tab = event.target?.closest?.('[data-tab="research"]');
      if (!tab) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openResearchOverlay();
    }, true);
  }

  bindResearchPill();
  window.HavenfallUI.openResearchOverlay = openResearchOverlay;
  window.HavenfallUI.closeResearchOverlay = closeResearchOverlay;
})();
