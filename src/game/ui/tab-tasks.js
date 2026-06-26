'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  const TASKS = [
    ['gather', 'Coletar'],
    ['build', 'Construir'],
    ['research', 'Pesquisar'],
    ['handle', 'Manusear']
  ];

  function ensureTaskPriorities() {
    if (!state) return null;
    state.taskPriorities = state.taskPriorities || {};
    for (const c of state.colonists || []) {
      state.taskPriorities[c.id] = state.taskPriorities[c.id] || { gather: 2, build: 2, research: 2, handle: 2 };
      for (const [key] of TASKS) if (state.taskPriorities[c.id][key] === undefined) state.taskPriorities[c.id][key] = 2;
    }
    return state.taskPriorities;
  }

  function priorityFor(c, key) {
    return ensureTaskPriorities()?.[c.id]?.[key] ?? 2;
  }

  function renderCell(c, key) {
    const value = priorityFor(c, key);
    return `<td><div class="priority-dots" data-priority-colonist="${c.id}" data-priority-task="${key}">${[0,1,2,3,4].map(n => `<button class="${Number(value) === n ? 'is-active' : ''}" data-priority-value="${n}">${n}</button>`).join('')}</div></td>`;
  }

  function renderRow(c) {
    return `<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.note || 'Ocioso')}</small></td>${TASKS.map(([key]) => renderCell(c, key)).join('')}</tr>`;
  }

  function render() {
    if (!state?.colonists?.length) return '<div class="dock-empty">Nenhum colono para priorizar.</div>';
    ensureTaskPriorities();
    return `<div class="dock-tab-head"><div><h3>Tarefas</h3><p>Matriz de prioridades 0-4. Zero desativa a tarefa para aquele colono.</p></div></div>
      <div class="dock-table-wrap"><table class="dock-table task-table"><thead><tr><th>Colono</th>${TASKS.map(([, label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${state.colonists.map(renderRow).join('')}</tbody></table></div>`;
  }

  function getColonistTaskPriority(c, taskKey) {
    if (!c) return 0;
    return ensureTaskPriorities()?.[c.id]?.[taskKey] ?? 2;
  }

  function installAutoTaskPriorityHook() {
    if (window.HavenfallUI.taskPriorityHooked || typeof assignAutoTask !== 'function') return;
    const nativeAssignAutoTask = assignAutoTask;
    assignAutoTask = function assignAutoTaskByMatrix(c) {
      const matrix = ensureTaskPriorities()?.[c.id];
      if (matrix) {
        const ranked = TASKS.map(([key]) => [key, matrix[key] ?? 0]).sort((a, b) => b[1] - a[1]);
        const top = ranked.find(([, value]) => value > 0);
        if (top) {
          if (top[0] === 'gather') c.priority = 'gather';
          if (top[0] === 'build') c.priority = 'build';
          if (top[0] === 'research' && state?.objects?.some(o => o.type === 'research_desk')) {
            const desk = state.objects.find(o => o.type === 'research_desk');
            if (desk && typeof assignResearch === 'function') { assignResearch(c, desk); return true; }
          }
        }
      }
      return nativeAssignAutoTask(c);
    };
    window.HavenfallUI.taskPriorityHooked = true;
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest?.('[data-priority-value]');
    if (!btn) return;
    const box = btn.closest('[data-priority-colonist][data-priority-task]');
    if (!box || !state) return;
    const id = Number(box.dataset.priorityColonist);
    const task = box.dataset.priorityTask;
    ensureTaskPriorities();
    state.taskPriorities[id][task] = Number(btn.dataset.priorityValue);
    gameLog?.(`Prioridade atualizada: ${task} = ${state.taskPriorities[id][task]}.`, 'info');
    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('tasks');
  });

  installAutoTaskPriorityHook();
  window.getColonistTaskPriority = getColonistTaskPriority;
  window.HavenfallUI.tabViews.tasks = { render, onOpen: ensureTaskPriorities };
})();
