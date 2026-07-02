'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const TASKS = [
    ['gather', 'Coletar'],
    ['build', 'Construir'],
    ['farming', 'Agricultura'],
    ['crafting', 'Artesanato'],
    ['research', 'Pesquisar'],
    ['hauling', 'Transporte']
  ];

  const TASK_LABELS = Object.fromEntries(TASKS);

  function ensureTaskPriorities() {
    if (!state) return null;
    state.taskPriorities = state.taskPriorities || {};
    for (const c of state.colonists || []) {
      state.taskPriorities[c.id] = state.taskPriorities[c.id] || { gather: 2, build: 2, farming: 2, crafting: 2, research: 2, hauling: 2 };
      if (state.taskPriorities[c.id].handle !== undefined && state.taskPriorities[c.id].hauling === undefined) {
        state.taskPriorities[c.id].hauling = state.taskPriorities[c.id].handle;
      }
      for (const [key] of TASKS) if (state.taskPriorities[c.id][key] === undefined) state.taskPriorities[c.id][key] = 2;
    }
    return state.taskPriorities;
  }

  function priorityFor(c, key) {
    return ensureTaskPriorities()?.[c.id]?.[key] ?? 2;
  }

  function statusText(c) {
    if (c.isUnconscious) return 'Inconsciente';
    if (c.task?.type === 'sleep') return 'Dormindo';
    if (c.task?.type === 'gather') return 'Coletando';
    if (c.task?.type === 'build') return 'Construindo';
    if (c.task?.type === 'craft') return 'Fabricando';
    if (c.task?.type === 'research') return 'Pesquisando';
    if (c.task?.type === 'haul') return 'Transportando';
    if (c.task) return 'Trabalhando';
    return 'Ocioso';
  }

  function statusPercent(c) {
    const notePct = String(c.note || '').match(/(\d{1,3})%/);
    if (notePct) return Math.max(0, Math.min(100, Number(notePct[1])));
    if (c.task?.type === 'haul' && c.task.phase === 'dropoff') return 65;
    if (c.task?.type === 'haul') return 35;
    if (c.task) return 25;
    return 0;
  }

  function renderColonistCell(c) {
    const pct = statusPercent(c);
    const note = c.note || statusText(c);
    return `<td class="task-colonist" title="${escapeHtml(note)}">
      <div class="task-colonist-line"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(statusText(c))}</span></div>
      <span class="task-status-bar"><i style="width:${pct}%"></i></span>
    </td>`;
  }

  function renderCell(c, key) {
    const value = Number(priorityFor(c, key));
    return `<td class="task-priority-cell" aria-label="${escapeHtml(TASK_LABELS[key])}"><div class="priority-dots compact" data-priority-colonist="${c.id}" data-priority-task="${key}">${[0,1,2,3,4].map(n => `<button type="button" title="${escapeHtml(TASK_LABELS[key])}: prioridade ${n}" class="${value === n ? 'is-active' : ''}" data-priority-value="${n}">${n}</button>`).join('')}</div></td>`;
  }

  function renderRow(c) {
    return `<tr>${renderColonistCell(c)}${TASKS.map(([key]) => renderCell(c, key)).join('')}</tr>`;
  }

  function objectiveSnapshot() {
    return window.HavenfallObjectives?.getSnapshot?.() || window.HavenfallObjectives?.evaluate?.() || null;
  }

  function socialSnapshot() {
    return window.HavenfallLivingWorld?.debugScheduleSnapshot?.() || null;
  }

  function renderObjectiveCards() {
    const snapshot = objectiveSnapshot();
    const social = socialSnapshot();
    if (!snapshot?.entries?.length) return '';

    const primary = snapshot.primary;
    const primaryText = primary
      ? `${primary.label}. ${primary.detail}`
      : 'Os objetivos iniciais estao fechados. Agora a colonia precisa expandir, negociar e explorar.';

    const socialLine = social?.visitorCount
      ? `${social.visitorCount} visitante(s) ativo(s) no mapa.`
      : (social?.etaHours != null
        ? `${social.nextVisitorKind === 'merchant' ? 'Mercador' : 'Visitante'} previsto em ${social.etaHours}h.`
        : 'Nenhum encontro social agendado no momento.');

    return `<div class="dock-card-grid" style="margin-bottom:10px;">
      <div class="dock-card">
        <span class="dock-badge">Agora</span>
        <strong>${escapeHtml(primary?.label || 'Base estabilizada')}</strong>
        <small>${escapeHtml(primaryText)}</small>
      </div>
      <div class="dock-card">
        <span class="dock-badge">Mundo vivo</span>
        <strong>${escapeHtml(social?.nextVisitorKind === 'merchant' ? 'Mercador na rota' : 'Ciclo social')}</strong>
        <small>${escapeHtml(socialLine)}</small>
      </div>
    </div>
    <div class="dock-card-grid" style="margin-bottom:10px;">${snapshot.entries.map(entry => `
      <div class="dock-card">
        <strong>${escapeHtml(entry.label)}</strong>
        <small>${escapeHtml(entry.detail)}</small>
        <span class="dock-badge">${escapeHtml(entry.progress || (entry.done ? 'ok' : 'pendente'))}</span>
      </div>
    `).join('')}</div>`;
  }

  function render() {
    if (!state?.colonists?.length) return '<div class="dock-empty">Nenhum colono para priorizar.</div>';
    ensureTaskPriorities();
    return `${renderObjectiveCards()}<div class="task-priority-panel">
      <div class="task-legend"><span>0 desativa</span><span>4 máxima</span><span>Status no hover</span></div>
      <div class="dock-table-wrap task-table-wrap"><table class="dock-table task-table task-compact-table"><thead><tr><th>Colono</th>${TASKS.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${state.colonists.map(renderRow).join('')}</tbody></table></div>
    </div>`;
  }

  function getColonistTaskPriority(c, taskKey) {
    if (!c) return 0;
    return ensureTaskPriorities()?.[c.id]?.[taskKey] ?? 2;
  }

  function onPriorityClick(event) {
    const btn = event.target.closest?.('[data-priority-value]');
    if (!btn || !btn.closest('#anchored-ui-panel')) return;
    const box = btn.closest('[data-priority-colonist][data-priority-task]');
    if (!box || !state) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const id = Number(box.dataset.priorityColonist);
    const task = box.dataset.priorityTask;
    const value = Number(btn.dataset.priorityValue);
    ensureTaskPriorities();
    state.taskPriorities[id][task] = value;

    const colonist = state.colonists?.find(c => c.id === id);
    if (colonist && !colonist.task) colonist.note = `Prioridade ${TASK_LABELS[task] || task}: ${value}`;
    if (typeof gameLog === 'function') gameLog(`Prioridade: ${colonist?.name || 'colono'} · ${TASK_LABELS[task] || task} = ${value}.`, 'info');

    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('tasks');
  }

  document.addEventListener('click', onPriorityClick, true);

  window.getColonistTaskPriority = getColonistTaskPriority;
  window.HavenfallUI.ensureTaskPriorities = ensureTaskPriorities;
  window.HavenfallUI.tabViews.tasks = { render, onOpen: ensureTaskPriorities };
})();
