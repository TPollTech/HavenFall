'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  if (window.HavenfallUI.researchOverlayReady) return;
  window.HavenfallUI.researchOverlayReady = true;

  const L = { w: 220, h: 88, x: 86, y: 26, p: 36 };

  function ensureResearchOverlayElement() {
    let overlay = document.getElementById('research-tree-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = 'research-tree-overlay';
    overlay.className = 'research-tree-overlay node-research-tree';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', onResearchOverlayClick);
    overlay.addEventListener('mouseover', onResearchNodeHover);
    overlay.addEventListener('focusin', onResearchNodeHover);
    ensureResearchOverlayStyles();
    return overlay;
  }

  function ensureResearchOverlayStyles() {
    if (document.getElementById('research-tree-node-style')) return;
    const style = document.createElement('style');
    style.id = 'research-tree-node-style';
    style.textContent = `
      .research-tree-overlay.node-research-tree{position:fixed;inset:0;z-index:8200;display:none;grid-template-rows:auto minmax(0,1fr);gap:14px;padding:24px;color:#e5edf8;background:radial-gradient(circle at 12% 8%,rgba(96,165,250,.13),transparent 28%),radial-gradient(circle at 84% 10%,rgba(227,169,63,.12),transparent 34%),rgba(2,6,23,.97);backdrop-filter:blur(8px)}
      .research-tree-overlay.node-research-tree.show{display:grid}
      .research-tree-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border:1px solid rgba(148,163,184,.18);border-radius:20px;background:linear-gradient(135deg,rgba(15,23,42,.88),rgba(2,6,23,.78));padding:16px 18px;box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05)}
      .research-tree-header h2{margin:0;font-size:28px;line-height:1.08}.research-tree-header p{margin:7px 0 0;color:rgba(203,213,225,.78);max-width:850px}.research-tree-header button,.research-node-pick{border:1px solid rgba(227,169,63,.42);border-radius:12px;background:rgba(227,169,63,.1);color:#f8d78a;padding:9px 12px;font-weight:900;cursor:pointer}.research-tree-header button:hover,.research-node-pick:hover{background:rgba(227,169,63,.18)}
      .research-tree-summary{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.research-tree-summary span{border:1px solid rgba(148,163,184,.18);border-radius:999px;padding:5px 8px;background:rgba(15,23,42,.68);color:rgba(226,232,240,.84);font-size:11px;font-weight:800}
      .research-tree-canvas{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,390px);gap:14px;overflow:hidden}.research-tree-map-shell{position:relative;min-height:0;overflow:auto;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:linear-gradient(rgba(148,163,184,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.045) 1px,transparent 1px),rgba(2,6,23,.64);background-size:28px 28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.research-tree-map{position:relative;min-width:100%;min-height:100%}.research-tree-lines{position:absolute;inset:0;z-index:1;pointer-events:none}.research-tree-line{fill:none;stroke-width:4;stroke-linecap:round;opacity:.86}.research-tree-line.locked{stroke:rgba(71,85,105,.48)}.research-tree-line.available{stroke:rgba(250,204,21,.74)}.research-tree-line.current{stroke:rgba(56,189,248,.94);stroke-dasharray:8 9}.research-tree-line.completed{stroke:rgba(34,197,94,.95)}
      .research-tree-node{position:absolute;z-index:2;display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;align-items:center;text-align:left;min-height:88px;padding:11px;border:1px solid rgba(148,163,184,.22);border-radius:17px;background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.92));color:#e5edf8;cursor:pointer;overflow:hidden;box-shadow:0 14px 32px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.05);transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease,opacity .15s ease,filter .15s ease}.research-tree-node:before{content:'';position:absolute;inset:0;opacity:.34;background:radial-gradient(circle at 10% 0%,var(--node-glow,rgba(96,165,250,.18)),transparent 46%),linear-gradient(135deg,rgba(255,255,255,.04),transparent 50%);pointer-events:none}.research-tree-node:hover,.research-tree-node:focus{outline:none;transform:translateY(-3px);border-color:rgba(226,232,240,.48);box-shadow:0 20px 42px rgba(0,0,0,.42),0 0 0 1px rgba(96,165,250,.16)}.research-tree-node.locked{opacity:.5;filter:grayscale(.65)}.research-tree-node.available{border-color:rgba(250,204,21,.62);--node-glow:rgba(250,204,21,.24)}.research-tree-node.current{border-color:rgba(56,189,248,.86);--node-glow:rgba(56,189,248,.28)}.research-tree-node.completed{border-color:rgba(34,197,94,.86);--node-glow:rgba(34,197,94,.28);background:linear-gradient(135deg,rgba(22,101,52,.34),rgba(15,23,42,.94))}
      .research-node-icon{position:relative;z-index:1;width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.22);font-size:19px}.research-node-body{position:relative;z-index:1;min-width:0;display:grid;gap:4px}.research-node-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:950;color:#f8fafc}.research-node-meta{display:flex;flex-wrap:wrap;gap:5px}.research-node-meta span,.research-detail-badges span,.research-requirements span,.research-unlocks span{border-radius:999px;padding:4px 7px;background:rgba(96,165,250,.10);border:1px solid rgba(96,165,250,.20);color:#dbeafe;font-size:11px;font-weight:850}.research-node-progress{width:100%;height:5px;border-radius:999px;background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.06);overflow:hidden}.research-node-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#f8d78a)}
      .research-detail-panel{min-height:0;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.95));padding:16px;overflow:auto;display:grid;align-content:start;gap:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}.research-detail-panel .kicker{color:#f8d78a;letter-spacing:.18em}.research-detail-panel h3{margin:0;font-size:24px;line-height:1.08}.research-detail-panel p{margin:0;color:rgba(203,213,225,.82);line-height:1.45}.research-detail-badges,.research-requirements,.research-unlocks{display:flex;flex-wrap:wrap;gap:7px}.research-requirements span.done{background:rgba(34,197,94,.11);border-color:rgba(34,197,94,.26);color:#bbf7d0}.research-requirements span.missing{background:rgba(248,113,113,.10);border-color:rgba(248,113,113,.24);color:#fecaca}.research-detail-section-title{margin:4px 0 -4px;color:rgba(248,215,138,.92);font-size:11px;font-weight:950;letter-spacing:.11em;text-transform:uppercase}.research-empty-note{color:rgba(203,213,225,.72);font-size:12px;line-height:1.45}.research-node-pick{justify-self:start}
      @media(max-width:980px){.research-tree-overlay.node-research-tree{padding:14px}.research-tree-header{flex-direction:column}.research-tree-canvas{grid-template-columns:1fr;overflow:auto}.research-tree-map-shell{min-height:420px}.research-detail-panel{min-height:240px}}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function onResearchOverlayClick(event) {
    if (event.target === event.currentTarget || event.target.closest('[data-close-research-tree]')) { closeResearchOverlay(); return; }
    const node = event.target.closest('[data-research-preview]');
    if (node) renderResearchDetail(node.dataset.researchPreview);
    const pick = event.target.closest('[data-pick-research]');
    if (pick) chooseResearchNode(pick.dataset.pickResearch);
  }

  function onResearchNodeHover(event) {
    const node = event.target.closest?.('[data-research-preview]');
    if (node) renderResearchDetail(node.dataset.researchPreview);
  }

  function researchKeys() { return Array.isArray(researchOrder) && researchOrder.length ? researchOrder : Object.keys(researchDefs || {}); }
  function isResearchUnlocked(key) { return !!state?.research?.unlocked?.[key]; }
  function requirementKeys(key) {
    const def = researchDefs?.[key];
    const reqs = def?.prerequisites || def?.requires || [];
    return Array.isArray(reqs) ? reqs : [reqs];
  }
  function canResearchNow(key) { return requirementKeys(key).every(req => isResearchUnlocked(req)); }
  function researchStatus(key) {
    if (isResearchUnlocked(key)) return 'completed';
    if (state?.research?.current === key) return 'current';
    return canResearchNow(key) ? 'available' : 'locked';
  }
  function researchStatusLabel(status) { return ({ completed: 'Concluída', current: 'Em andamento', available: 'Disponível', locked: 'Bloqueada' })[status] || 'Indefinida'; }
  function categoryInfo(def) { return researchCategories?.[def?.category] || { label: 'Pesquisa', icon: '◆' }; }
  function researchProgress(key) {
    const def = researchDefs?.[key];
    const cost = Math.max(1, Number(def?.cost || 1));
    if (isResearchUnlocked(key)) return 100;
    if (state?.research?.current !== key) return 0;
    return Math.min(100, Math.floor(((state.research.progress || 0) / cost) * 100));
  }
  function nodePos(key, index = 0) {
    const def = researchDefs?.[key] || {};
    const pos = Array.isArray(def.pos) ? def.pos : [Number(def.tier || 0), index];
    return { x: L.p + pos[0] * (L.w + L.x), y: L.p + pos[1] * (L.h + L.y), width: L.w, height: L.h };
  }
  function treeSize(keys) {
    let width = 0, height = 0;
    keys.forEach((key, index) => { const p = nodePos(key, index); width = Math.max(width, p.x + p.width + L.p); height = Math.max(height, p.y + p.height + L.p); });
    return { width, height };
  }
  function connections(keys) {
    return keys.flatMap(key => requirementKeys(key).map(req => ({ from: req, to: key })));
  }
  function lineStatus(conn) {
    const fromDone = isResearchUnlocked(conn.from);
    const to = researchStatus(conn.to);
    if (fromDone && to === 'completed') return 'completed';
    if (fromDone && to === 'current') return 'current';
    if (fromDone && to === 'available') return 'available';
    return 'locked';
  }
  function lineHtml(conn, keys) {
    const fromIndex = keys.indexOf(conn.from), toIndex = keys.indexOf(conn.to);
    if (fromIndex < 0 || toIndex < 0) return '';
    const a = nodePos(conn.from, fromIndex), b = nodePos(conn.to, toIndex);
    const x1 = a.x + a.width, y1 = a.y + a.height / 2, x2 = b.x, y2 = b.y + b.height / 2, mx = x1 + (x2 - x1) * .5;
    return `<path class="research-tree-line ${lineStatus(conn)}" d="M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" />`;
  }
  function unlockLabel(key) { return buildDefs?.[key]?.label || itemDefs?.[key]?.label || zoneDefs?.[key]?.label || key; }
  function nodeHtml(key, index) {
    const def = researchDefs?.[key];
    if (!def) return '';
    const status = researchStatus(key), p = nodePos(key, index), progress = researchProgress(key), cat = categoryInfo(def);
    return `<button type="button" class="research-tree-node ${status}" data-research-preview="${escapeHtml(key)}" style="left:${p.x}px;top:${p.y}px;width:${p.width}px;min-height:${p.height}px;" aria-label="${escapeHtml(def.label)}"><span class="research-node-icon">${escapeHtml(cat.icon)}</span><span class="research-node-body"><span class="research-node-label">${escapeHtml(def.label)}</span><span class="research-node-meta"><span>${escapeHtml(cat.label)}</span><span>T${escapeHtml(def.tier ?? 0)}</span><span>${escapeHtml(def.cost || 1)} pts</span></span><span class="research-node-progress"><span style="width:${progress}%"></span></span></span></button>`;
  }
  function requirementsHtml(key) {
    const reqs = requirementKeys(key);
    if (!reqs.length) return '<span class="done">Nenhum pré-requisito</span>';
    return reqs.map(req => `<span class="${isResearchUnlocked(req) ? 'done' : 'missing'}">${isResearchUnlocked(req) ? 'OK' : 'Falta'}: ${escapeHtml(researchDefs?.[req]?.label || req)}</span>`).join('');
  }
  function unlocksHtml(def) {
    const unlocks = Array.isArray(def?.unlocks) ? def.unlocks : [];
    return unlocks.length ? unlocks.map(item => `<span>${escapeHtml(unlockLabel(item))}</span>`).join('') : '<span>Sem desbloqueio direto</span>';
  }
  function researchDetailHtml(key) {
    const keys = researchKeys();
    const actualKey = researchDefs?.[key] ? key : keys[0];
    const def = researchDefs?.[actualKey];
    if (!def) return '<p class="research-empty-note">Selecione uma pesquisa.</p>';
    const status = researchStatus(actualKey), cat = categoryInfo(def), progress = researchProgress(actualKey), selectable = !isResearchUnlocked(actualKey) && canResearchNow(actualKey), current = state?.research?.current === actualKey;
    return `<div class="kicker">${escapeHtml(cat.label)}</div><h3>${escapeHtml(def.label)}</h3><p>${escapeHtml(def.description || 'Tecnologia para expandir a colônia.')}</p><div class="research-detail-badges"><span>${escapeHtml(researchStatusLabel(status))}</span><span>Tier ${escapeHtml(def.tier ?? 0)}</span><span>Custo ${escapeHtml(def.cost || 1)}</span><span>Progresso ${progress}%</span></div><div class="research-detail-section-title">Pré-requisitos</div><div class="research-requirements">${requirementsHtml(actualKey)}</div><div class="research-detail-section-title">Desbloqueia</div><div class="research-unlocks">${unlocksHtml(def)}</div>${selectable ? `<button class="research-node-pick" data-pick-research="${escapeHtml(actualKey)}">${current ? 'Pesquisa ativa' : 'Definir como pesquisa atual'}</button>` : `<p class="research-empty-note">${isResearchUnlocked(actualKey) ? 'Pesquisa já concluída.' : 'Conclua os pré-requisitos para liberar este node.'}</p>`}`;
  }
  function renderResearchDetail(key) { const panel = document.getElementById('research-detail-panel'); if (panel) panel.innerHTML = researchDetailHtml(key); }
  function progressSummary(keys) {
    const completed = keys.filter(key => isResearchUnlocked(key)).length;
    const available = keys.filter(key => !isResearchUnlocked(key) && canResearchNow(key)).length;
    const current = state?.research?.current ? researchDefs?.[state.research.current]?.label : 'nenhuma';
    return `<div class="research-tree-summary"><span>${completed}/${keys.length} concluídas</span><span>${available} disponíveis</span><span>Atual: ${escapeHtml(current || 'nenhuma')}</span></div>`;
  }
  function renderResearchOverlay() {
    const overlay = ensureResearchOverlayElement();
    const keys = researchKeys();
    const selected = state?.research?.current || keys.find(k => !isResearchUnlocked(k) && canResearchNow(k)) || keys[0];
    const size = treeSize(keys), links = connections(keys);
    overlay.innerHTML = `<header class="research-tree-header"><div><div class="kicker">Pesquisa</div><h2>Árvore tecnológica da colônia</h2><p>Escolha um caminho de evolução. Cada node possui pré-requisitos reais, custo próprio, desbloqueios e conexões visuais entre ramos.</p>${progressSummary(keys)}</div><button type="button" data-close-research-tree>Fechar</button></header><div class="research-tree-canvas"><div class="research-tree-map-shell"><div class="research-tree-map" style="width:${size.width}px;height:${size.height}px;"><svg class="research-tree-lines" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" aria-hidden="true">${links.map(conn => lineHtml(conn, keys)).join('')}</svg>${keys.map((key, index) => nodeHtml(key, index)).join('')}</div></div><aside id="research-detail-panel" class="research-detail-panel">${researchDetailHtml(selected)}</aside></div>`;
  }
  function openResearchOverlay() { if (!state) return; if (typeof ensureResearchState === 'function') ensureResearchState(); renderResearchOverlay(); const overlay = ensureResearchOverlayElement(); overlay.classList.add('show'); overlay.setAttribute('aria-hidden', 'false'); }
  function closeResearchOverlay() { const overlay = document.getElementById('research-tree-overlay'); if (!overlay) return; overlay.classList.remove('show'); overlay.setAttribute('aria-hidden', 'true'); }
  function chooseResearchNode(key) {
    if (!state?.research || !researchDefs?.[key] || isResearchUnlocked(key)) return;
    if (!canResearchNow(key)) { if (typeof log === 'function') log(`Pesquisa bloqueada: conclua os pré-requisitos de ${researchDefs[key].label}.`); renderResearchDetail(key); return; }
    if (state.research.current === key) { if (typeof log === 'function') log(`${researchDefs[key].label} já é a pesquisa ativa.`); return; }
    state.research.current = key; state.research.progress = 0;
    if (typeof log === 'function') log(`Pesquisa priorizada: ${researchDefs[key].label}.`);
    if (typeof updateUI === 'function') updateUI(true);
    renderResearchOverlay();
  }
  function bindResearchPill() {
    document.addEventListener('click', event => {
      const tab = event.target?.closest?.('[data-tab="research"]');
      if (!tab) return;
      event.preventDefault(); event.stopImmediatePropagation(); openResearchOverlay();
    }, true);
  }

  bindResearchPill();
  window.HavenfallUI.openResearchOverlay = openResearchOverlay;
  window.HavenfallUI.closeResearchOverlay = closeResearchOverlay;
})();
