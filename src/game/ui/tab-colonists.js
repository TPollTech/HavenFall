'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function statusText(c) {
    if (c.isUnconscious) return 'Inconsciente';
    if (c.task?.type === 'sleep') return 'Dormindo';
    if (c.task?.type === 'craft') return 'Fabricando';
    if (c.task?.type === 'build') return 'Construindo';
    if (c.task?.type === 'gather') return 'Coletando';
    if (c.task?.type === 'research') return 'Pesquisando';
    if (c.task?.type === 'haul') return 'Carregando';
    if (c.task) return 'Trabalhando';
    return 'Ocioso';
  }

  function bar(label, value) {
    const pct = Math.max(0, Math.min(100, Math.floor(value || 0)));
    return `<span class="mini-bar"><b>${label}</b><i><em style="width:${pct}%"></em></i><small>${pct}%</small></span>`;
  }

  function renderRow(c) {
    return `<tr class="${c.id === selectedColonistId ? 'is-selected' : ''}">
      <td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.role || '')}</small></td>
      <td>${escapeHtml(statusText(c))}</td>
      <td>${bar('Fome', c.hunger)}${bar('Saúde', c.health)}</td>
      <td><button data-focus-colonist="${c.id}">Focar</button></td>
    </tr>`;
  }

  function render() {
    const colonists = state?.colonists || [];
    if (!colonists.length) return '<div class="dock-empty">Nenhum colono disponível.</div>';
    return `<div class="dock-tab-head"><div><h3>Colonos</h3><p>Visão de gestão, status e foco rápido de câmera.</p></div></div>
      <div class="dock-table-wrap"><table class="dock-table"><thead><tr><th>Nome</th><th>Status</th><th>Fome/Saúde</th><th>Ação</th></tr></thead><tbody>${colonists.map(renderRow).join('')}</tbody></table></div>`;
  }

  function focusColonist(id) {
    const c = state?.colonists?.find(col => col.id === id);
    if (!c) return;
    selectedColonistId = c.id;
    camera.x = c.px || c.x * TILE + TILE / 2;
    camera.y = c.py || c.y * TILE + TILE / 2;
    if (typeof clampCamera === 'function') clampCamera();
    gameLog?.(`Câmera focada em ${c.name}.`, 'info');
    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('colonists');
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-focus-colonist]');
    if (!btn) return;
    focusColonist(Number(btn.dataset.focusColonist));
  });

  window.HavenfallUI.tabViews.colonists = { render };
})();
