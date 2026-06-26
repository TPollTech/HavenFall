'use strict';

function ensureColonistModalStyles() {
  if (document.getElementById('colonist-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'colonist-modal-styles';
  style.textContent = `
    .game-modal-backdrop{position:fixed;inset:0;z-index:8500;display:none;align-items:center;justify-content:center;background:rgba(2,4,8,.58);backdrop-filter:blur(4px);padding:18px;}
    .game-modal-backdrop.show{display:flex;}
    .colonist-modal-card{width:min(720px,96vw);max-height:86vh;overflow:auto;background:#111722;border:1px solid rgba(227,169,63,.35);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.48);color:#f4efe4;padding:18px;}
    .colonist-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.10);padding-bottom:12px;margin-bottom:14px;}
    .colonist-modal-header h3{margin:0;font-size:22px;}
    .colonist-modal-close{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#f4efe4;border-radius:10px;padding:8px 10px;cursor:pointer;}
    .colonist-modal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0;}
    .colonist-stat-card{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;}
    .colonist-stat-card b{display:block;margin-bottom:4px;color:#f8d78a;}
    .status-badges{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px;}
    .status-badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);font-size:12px;font-weight:800;text-transform:uppercase;}
    .status-badge.good{background:rgba(120,190,120,.12);border-color:rgba(120,190,120,.35);}
    .status-badge.warn{background:rgba(230,170,70,.12);border-color:rgba(230,170,70,.35);}
    .status-badge.bad{background:rgba(230,100,90,.12);border-color:rgba(230,100,90,.35);}
    .inventory-list{display:grid;gap:8px;margin-top:8px;}
    .inventory-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px;}
    .inventory-row button{white-space:nowrap;}
  `;
  document.head.appendChild(style);
}

function ensureColonistModalElement() {
  ensureColonistModalStyles();
  let modal = document.getElementById('colonist-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'colonist-modal';
  modal.className = 'game-modal-backdrop';
  modal.setAttribute('aria-hidden', 'true');
  document.body.appendChild(modal);
  modal.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target === modal || event.target.closest('[data-close-colonist-modal]')) closeColonistModal();
    const equip = event.target.closest('[data-equip-modal-item]');
    if (equip) {
      const c = selectedColonist();
      if (c && typeof equipItem === 'function') equipItem(c, equip.dataset.equipModalItem);
      openColonistDetailsModal(c?.id);
    }
    const use = event.target.closest('[data-use-modal-item]');
    if (use) useItemFromInventory(Number(use.dataset.colonistId), use.dataset.useModalItem);
  });
  return modal;
}

function statusClass(status) {
  if (status === 'saudável') return 'good';
  if (status === 'molhado') return 'warn';
  return 'bad';
}

function colonistStatusBadges(c) {
  const statuses = Array.isArray(c.statuses) && c.statuses.length ? c.statuses : ['saudável'];
  return `<div class="status-badges">${statuses.map(s => `<span class="status-badge ${statusClass(s)}">${escapeHtml(s)}</span>`).join('')}</div>`;
}

function equipmentModalRows(c) {
  ensureEquipment(c);
  const eq = c.equipment;
  return ['tool','weapon','offhand'].map(slot => {
    const key = eq[slot];
    const item = key ? itemDefs[key] : null;
    return `<div class="inventory-row"><span><b>${escapeHtml(slotLabel(slot))}</b><br>${escapeHtml(item?.label || 'vazio')}</span>${key ? `<button data-unequip-slot="${slot}" data-close-colonist-modal>Guardar</button>` : ''}</div>`;
  }).join('');
}

function colonyInventoryRows(c) {
  const entries = Object.entries(state.items || {}).filter(([, qty]) => qty > 0);
  if (!entries.length && !c.carrying) return '<p class="empty">Nenhum item no estoque.</p>';

  const rows = entries.map(([key, qty]) => {
    const item = itemDefs[key] || { label: key };
    const canEquip = !!item.slot;
    return `<div class="inventory-row"><span>${escapeHtml(item.label)} <b>x${qty}</b></span>${canEquip ? `<button data-equip-modal-item="${key}">Equipar</button>` : ''}</div>`;
  });

  if (c.carrying) rows.unshift(`<div class="inventory-row"><span>Carregando: ${escapeHtml(c.carrying.label || c.carrying.resource)} <b>x${c.carrying.amount || 1}</b></span></div>`);
  return rows.join('');
}

function survivalStatsHtml(c) {
  const load = typeof getColonistCurrentLoadCount === 'function' ? getColonistCurrentLoadCount(c) : (c.carrying?.amount || 0);
  const max = typeof getColonistMaxCapacity === 'function' ? getColonistMaxCapacity(c) : 2;
  const roomTemp = Number(c.roomTemperature ?? (typeof roomTemperatureAt === 'function' ? roomTemperatureAt(Math.round(c.x), Math.round(c.y)) : 18));
  const external = Number(state.environment?.externalTemperature ?? roomTemp);
  const immunityVisible = typeof isResearched === 'function' && isResearched('medicine');
  const immunity = Math.floor(c.immunity ?? 35);
  return `
    <section class="colonist-modal-grid">
      <div class="colonist-stat-card"><b>Temperatura do ambiente</b>${roomTemp.toFixed(1)}°C<br><small>Externo: ${external.toFixed(1)}°C</small></div>
      <div class="colonist-stat-card"><b>Carga</b>${load} / ${max}<br><small>${c.equipment?.offhand === 'handcart' ? 'Carrinho equipado' : 'Sem carrinho'}</small></div>
      <div class="colonist-stat-card"><b>Automação</b>${typeof isResearched === 'function' && isResearched('heavy_hauling') ? 'Carga pesada ativa' : 'Carga básica'}</div>
      ${immunityVisible ? `<div class="colonist-stat-card"><b>Imunidade</b>${immunity}%<br><small>Medicina pesquisada</small></div>` : ''}
    </section>
  `;
}

function openColonistDetailsModal(colonistId) {
  if (!state) return;
  const c = state.colonists.find(col => col.id === colonistId) || selectedColonist();
  if (!c) return;
  if (typeof ensureColonistEnvironment === 'function') ensureColonistEnvironment(c);
  ensureColonistMeta(c);
  ensureEquipment(c);

  const modal = ensureColonistModalElement();
  modal.innerHTML = `
    <article class="colonist-modal-card">
      <header class="colonist-modal-header">
        <div><div class="kicker">Detalhes do colono</div><h3>${escapeHtml(c.name)} <span class="muted">${escapeHtml(c.role)}</span></h3><p class="empty">${escapeHtml(c.note || 'Ocioso')}</p></div>
        <button class="colonist-modal-close" data-close-colonist-modal>Fechar</button>
      </header>
      ${colonistStatusBadges(c)}
      <h4>Status de sobrevivência</h4>
      <section class="colonist-modal-grid">
        <div class="colonist-stat-card"><b>Saúde</b>${Math.floor(c.health || 0)}%</div>
        <div class="colonist-stat-card"><b>Fome</b>${Math.floor(c.hunger || 0)}%</div>
        <div class="colonist-stat-card"><b>Energia</b>${Math.floor(c.energy || 0)}%</div>
        <div class="colonist-stat-card"><b>Humor</b>${Math.floor(c.mood || 0)}%</div>
        <div class="colonist-stat-card"><b>Umidade</b>${Math.floor(c.wetness || 0)}%</div>
        <div class="colonist-stat-card"><b>Temperatura corporal</b>${Number(c.bodyTemperature || 37).toFixed(1)}°C</div>
      </section>
      <h4>Carga, clima e automação</h4>${survivalStatsHtml(c)}
      <h4>Equipamento pessoal</h4><div class="inventory-list">${equipmentModalRows(c)}</div>
      <h4>Estoque utilizável</h4><div class="inventory-list">${colonyInventoryRows(c)}</div>
    </article>`;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function closeColonistModal() {
  const modal = document.getElementById('colonist-modal');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function useItemFromInventory(colonistId, itemKey) {
  const c = state?.colonists?.find(col => col.id === colonistId);
  if (!c || !itemKey) return;
  if (itemKey === 'torch' && itemCount('torch') > 0) {
    equipItem(c, 'torch');
    log(`${c.name} pegou uma tocha para iluminação e defesa.`);
  }
  if (itemKey === 'handcart' && typeof equipAvailableHandcart === 'function') equipAvailableHandcart(c);
  openColonistDetailsModal(c.id);
}

function installColonistModalCanvasClick() {
  if (!canvas || canvas.dataset.colonistModalReady === '1') return;
  canvas.dataset.colonistModalReady = '1';
  canvas.addEventListener('click', event => {
    if (appScreen !== SCREEN.PLAYING || !state || currentBuild || currentZoneTool) return;
    if (typeof tileFromEvent !== 'function') return;
    const tile = tileFromEvent(event);
    if (!tile) return;
    const clicked = state.colonists.find(c => Math.abs(c.px - (tile.x * TILE + TILE / 2)) < 24 && Math.abs(c.py - (tile.y * TILE + TILE / 2)) < 34);
    if (clicked) openColonistDetailsModal(clicked.id);
  });
}

installColonistModalCanvasClick();
ensureColonistModalElement();
