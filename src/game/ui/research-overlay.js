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
    overlay.className = 'research-tree-overlay compact-research-tree';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', onResearchOverlayClick);
    overlay.addEventListener('mouseover', onResearchNodeHover);
    overlay.addEventListener('focusin', onResearchNodeHover);
    ensureResearchOverlayStyles();
    return overlay;
  }

  function ensureResearchOverlayStyles() {
    if (document.getElementById('research-tree-compact-style')) return;
    const style = document.createElement('style');
    style.id = 'research-tree-compact-style';
    style.textContent = `
      .research-tree-overlay.compact-research-tree {
        position: fixed;
        inset: 0;
        z-index: 8200;
        display: none;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 16px;
        padding: 26px;
        color: #e5edf8;
        background:
          radial-gradient(circle at 12% 8%, rgba(96, 165, 250, .12), transparent 28%),
          radial-gradient(circle at 85% 12%, rgba(227, 169, 63, .10), transparent 34%),
          rgba(2, 6, 23, .96);
        backdrop-filter: blur(8px);
      }
      .research-tree-overlay.compact-research-tree.show { display: grid; }
      .research-tree-header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: start;
        border: 1px solid rgba(148, 163, 184, .16);
        border-radius: 18px;
        background: rgba(15, 23, 42, .74);
        padding: 16px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      .research-tree-header h2 { margin: 0; font-size: 26px; }
      .research-tree-header p { margin: 6px 0 0; color: rgba(203, 213, 225, .74); max-width: 760px; }
      .research-tree-header button,
      .research-node-pick {
        border: 1px solid rgba(227, 169, 63, .42);
        border-radius: 12px;
        background: rgba(227, 169, 63, .10);
        color: #f8d78a;
        padding: 9px 12px;
        font-weight: 900;
        cursor: pointer;
      }
      .research-tree-canvas {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
        gap: 14px;
        overflow: hidden;
      }
      .research-icon-grid {
        min-height: 0;
        overflow: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        align-content: start;
        gap: 12px;
        padding: 4px;
      }
      .research-icon-node {
        min-width: 0;
        min-height: 92px;
        border: 1px solid rgba(148, 163, 184, .14);
        border-radius: 16px;
        background:
          linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .92));
        color: #e5edf8;
        padding: 9px;
        display: grid;
        place-items: center;
        gap: 6px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        text-align: center;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      .research-icon-node::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: .28;
        background-image:
          linear-gradient(rgba(148, 163, 184, .10) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, .08) 1px, transparent 1px);
        background-size: 18px 18px;
        pointer-events: none;
      }
      .research-icon-node:hover,
      .research-icon-node:focus {
        outline: none;
        transform: translateY(-2px);
        border-color: rgba(96, 165, 250, .45);
        box-shadow: 0 10px 28px rgba(0,0,0,.30), 0 0 0 1px rgba(96, 165, 250, .16);
      }
      .research-icon-node.active { border-color: rgba(227, 169, 63, .64); box-shadow: 0 0 24px rgba(227, 169, 63, .16); }
      .research-icon-node.unlocked { border-color: rgba(94, 234, 212, .36); }
      .research-icon-node.locked { opacity: .48; filter: grayscale(.55); }
      .research-node-icon {
        width: 38px;
        height: 38px;
        border-radius: 13px;
        display: grid;
        place-items: center;
        background: rgba(96, 165, 250, .11);
        border: 1px solid rgba(96, 165, 250, .20);
        font-size: 18px;
        z-index: 1;
      }
      .research-icon-node.unlocked .research-node-icon { background: rgba(20, 184, 166, .14); border-color: rgba(94, 234, 212, .30); }
      .research-icon-node.active .research-node-icon { background: rgba(227, 169, 63, .16); border-color: rgba(227, 169, 63, .42); }
      .research-node-label {
        z-index: 1;
        max-width: 100%;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.12;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .research-node-progress {
        z-index: 1;
        width: 100%;
        height: 5px;
        border-radius: 999px;
        background: rgba(15, 23, 42, .92);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.05);
      }
      .research-node-progress span {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #38bdf8, #f8d78a);
      }
      .research-detail-panel {
        min-height: 0;
        border: 1px solid rgba(148, 163, 184, .16);
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(15, 23, 42, .90), rgba(2, 6, 23, .94));
        padding: 16px;
        overflow: auto;
        display: grid;
        align-content: start;
        gap: 12px;
      }
      .research-detail-panel .kicker { color: #f8d78a; letter-spacing: .18em; }
      .research-detail-panel h3 { margin: 0; font-size: 22px; }
      .research-detail-panel p { margin: 0; color: rgba(203, 213, 225, .78); line-height: 1.45; }
      .research-detail-badges { display: flex; flex-wrap: wrap; gap: 7px; }
      .research-detail-badges span {
        border-radius: 999px;
        padding: 6px 8px;
        background: rgba(96, 165, 250, .10);
        border: 1px solid rgba(96, 165, 250, .20);
        color: #dbeafe;
        font-size: 11px;
        font-weight: 800;
      }
      .research-detail-panel .research-node-pick { justify-self: start; }
      .research-tooltip {
        position: fixed;
        z-index: 8300;
        pointer-events: none;
        max-width: 280px;
        border: 1px solid rgba(96, 165, 250, .34);
        background: rgba(2, 6, 23, .94);
        color: #e5edf8;
        border-radius: 12px;
        padding: 10px;
        box-shadow: 0 18px 40px rgba(0,0,0,.42);
        display: none;
      }
      .research-tooltip.show { display: block; }
      .research-tooltip b { display: block; margin-bottom: 4px; color: #f8d78a; }
      .research-tooltip small { display: block; color: rgba(203, 213, 225, .76); line-height: 1.35; }
      @media (max-width: 920px) {
        .research-tree-canvas { grid-template-columns: 1fr; overflow: auto; }
        .research-detail-panel { min-height: 220px; }
      }
    `;
    document.head.appendChild(style);
  }

  function onResearchOverlayClick(event) {
    if (event.target === event.currentTarget || event.target.closest('[data-close-research-tree]')) closeResearchOverlay();
    const node = event.target.closest('[data-research-preview]');
    if (node) renderResearchDetail(node.dataset.researchPreview);
    const pick = event.target.closest('[data-pick-research]');
    if (pick) chooseResearchNode(pick.dataset.pickResearch);
  }

  function onResearchNodeHover(event) {
    const node = event.target.closest?.('[data-research-preview]');
    if (!node) return hideResearchTooltip();
    showResearchTooltip(node, event);
  }

  function researchKeys() { return Array.isArray(researchOrder) && researchOrder.length ? researchOrder : Object.keys(researchDefs || {}); }
  function isResearchUnlocked(key) { return !!state?.research?.unlocked?.[key]; }

  function researchDescription(key) {
    const map = {
      metalworking: 'Abre produção metálica, ferramentas melhores e novas estruturas.',
      cooking: 'Melhora a comida e estabiliza a rotina de sobrevivência.',
      medicine: 'Libera tratamento, resgate seguro e recuperação dos colonos.'
    };
    return map[key] || 'Tecnologia para expandir a colônia no longo prazo.';
  }

  function researchIcon(key) {
    const icons = { metalworking: '⚙', cooking: '♨', medicine: '✚', heavy_hauling: '▣', agriculture: '✤', tailoring: '◈' };
    return icons[key] || '◆';
  }

  function researchState(key, index, keys) {
    const previous = keys[index - 1];
    const available = !previous || isResearchUnlocked(previous);
    const unlocked = isResearchUnlocked(key);
    const active = state?.research?.current === key;
    return { previous, available, unlocked, active };
  }

  function researchProgress(key) {
    const def = researchDefs[key];
    const cost = def?.cost || 1;
    if (isResearchUnlocked(key)) return 100;
    if (state?.research?.current !== key) return 0;
    return Math.min(100, Math.floor(((state.research.progress || 0) / cost) * 100));
  }

  function nodeHtml(key, index, keys) {
    const def = researchDefs[key];
    if (!def) return '';
    const status = researchState(key, index, keys);
    const progress = researchProgress(key);
    const classes = ['research-icon-node', status.unlocked ? 'unlocked' : '', status.active ? 'active' : '', !status.available ? 'locked' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${classes}" data-research-preview="${key}" title="${escapeHtml(def.label)}">
      <span class="research-node-icon">${escapeHtml(researchIcon(key))}</span>
      <span class="research-node-label">${escapeHtml(def.label)}</span>
      <span class="research-node-progress"><span style="width:${progress}%"></span></span>
    </button>`;
  }

  function researchDetailHtml(key) {
    const keys = researchKeys();
    const index = Math.max(0, keys.indexOf(key));
    const def = researchDefs[keys[index]];
    const actualKey = keys[index];
    if (!def) return '<p class="empty">Selecione uma pesquisa.</p>';
    const status = researchState(actualKey, index, keys);
    const cost = def.cost || 1;
    const progress = researchProgress(actualKey);
    const unlocks = (def.unlocks || []).map(item => `<span>libera ${escapeHtml(buildDefs?.[item]?.label || item)}</span>`).join('');
    const stateLabel = status.unlocked ? 'Concluída' : status.active ? 'Em andamento' : status.available ? 'Disponível' : 'Bloqueada';
    return `<div class="kicker">Pesquisa selecionada</div>
      <h3>${escapeHtml(def.label)}</h3>
      <p>${escapeHtml(researchDescription(actualKey))}</p>
      <div class="research-detail-badges"><span>${stateLabel}</span><span>custo ${cost}</span><span>progresso ${progress}%</span>${unlocks}</div>
      ${!status.unlocked && status.available ? `<button class="research-node-pick" data-pick-research="${actualKey}">${status.active ? 'Pesquisando' : 'Definir prioridade'}</button>` : `<p class="empty">${status.unlocked ? 'Pesquisa já concluída.' : 'Conclua a pesquisa anterior para liberar este nó.'}</p>`}`;
  }

  function renderResearchDetail(key) {
    const panel = document.getElementById('research-detail-panel');
    if (!panel) return;
    panel.innerHTML = researchDetailHtml(key);
  }

  function renderResearchOverlay() {
    const overlay = ensureResearchOverlayElement();
    const keys = researchKeys();
    const selected = state?.research?.current || keys.find(k => !isResearchUnlocked(k)) || keys[0];
    overlay.innerHTML = `<header class="research-tree-header"><div><div class="kicker">Pesquisa</div><h2>Árvore tecnológica</h2><p>Ícones compactos para acompanhar progressão sem rolagem gigante. Passe o mouse para prévia e clique para ver detalhes.</p></div><button data-close-research-tree>Fechar</button></header><div class="research-tree-canvas"><div class="research-icon-grid">${keys.map((key, index) => nodeHtml(key, index, keys)).join('')}</div><aside id="research-detail-panel" class="research-detail-panel">${researchDetailHtml(selected)}</aside></div><div id="research-tooltip" class="research-tooltip" aria-hidden="true"></div>`;
  }

  function showResearchTooltip(node, event) {
    const key = node.dataset.researchPreview;
    const def = researchDefs[key];
    const tip = document.getElementById('research-tooltip');
    if (!tip || !def) return;
    tip.innerHTML = `<b>${escapeHtml(def.label)}</b><small>${escapeHtml(researchDescription(key))}</small>`;
    const rect = node.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - 300, rect.left + rect.width + 10)}px`;
    tip.style.top = `${Math.max(12, rect.top)}px`;
    tip.classList.add('show');
    tip.setAttribute('aria-hidden', 'false');
  }

  function hideResearchTooltip() {
    const tip = document.getElementById('research-tooltip');
    if (!tip) return;
    tip.classList.remove('show');
    tip.setAttribute('aria-hidden', 'true');
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
    hideResearchTooltip();
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
