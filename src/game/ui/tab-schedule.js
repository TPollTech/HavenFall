'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  function label(value) {
    return ScheduleManager?.SCHEDULE_LABELS?.[value] || 'Trabalhar';
  }

  function cls(value) {
    return ScheduleManager?.SCHEDULE_CLASS?.[value] || 'work';
  }

  function renderHourHeader() {
    return Array.from({ length: 24 }, (_, h) => `<th class="schedule-hour ${h === ScheduleManager.normalizeHour(state?.hour || 0) ? 'is-now' : ''}">${String(h).padStart(2, '0')}</th>`).join('');
  }

  function renderCell(c, hour) {
    const value = ScheduleManager.getScheduleState(c, hour);
    return `<td><button type="button" class="schedule-cell ${cls(value)} ${hour === ScheduleManager.normalizeHour(state?.hour || 0) ? 'is-now' : ''}" title="${escapeHtml(c.name)} · ${String(hour).padStart(2, '0')}:00 · ${escapeHtml(label(value))}" data-schedule-colonist="${c.id}" data-schedule-hour="${hour}">${value}</button></td>`;
  }

  function renderRow(c) {
    ScheduleManager.ensureColonistSchedule(c);
    const mode = ScheduleManager.getScheduleState(c, state?.hour || 0);
    return `<tr><td class="schedule-name"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(label(mode))}</small></td>${Array.from({ length: 24 }, (_, h) => renderCell(c, h)).join('')}</tr>`;
  }

  function render() {
    if (!state?.colonists?.length) return '<div class="dock-empty">Nenhum colono para configurar rotina.</div>';
    ScheduleManager.ensureAllSchedules();
    return `<div class="schedule-panel">
      <div class="schedule-legend"><span class="sleep">Dormir</span><span class="work">Trabalhar</span><span class="leisure">Lazer</span><em>Hora atual: ${formatHour(state.hour || 0)}</em></div>
      <div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Colono</th>${renderHourHeader()}</tr></thead><tbody>${state.colonists.map(renderRow).join('')}</tbody></table></div>
    </div>`;
  }

  function handleScheduleClick(event) {
    const btn = event.target.closest?.('[data-schedule-colonist][data-schedule-hour]');
    if (!btn || !btn.closest('#anchored-ui-panel')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const c = state?.colonists?.find(col => col.id === Number(btn.dataset.scheduleColonist));
    if (!c) return;
    const hour = Number(btn.dataset.scheduleHour);
    const value = ScheduleManager.cycleScheduleState(c, hour);
    if (typeof gameLog === 'function') gameLog(`Rotina: ${c.name} às ${String(hour).padStart(2, '0')}:00 = ${label(value)}.`, 'info');
    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('schedule');
  }

  document.addEventListener('click', handleScheduleClick, true);

  window.HavenfallUI.tabViews.schedule = { render, onOpen: () => ScheduleManager.ensureAllSchedules() };
})();
