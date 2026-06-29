'use strict';

(() => {
  window.HavenfallUI = window.HavenfallUI || {};
  window.HavenfallUI.tabViews = window.HavenfallUI.tabViews || {};

  let brush = null;
  let suppressClickUntil = 0;

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
    return `<td><button type="button" class="schedule-cell ${cls(value)} ${hour === ScheduleManager.normalizeHour(state?.hour || 0) ? 'is-now' : ''}" title="${escapeHtml(c.name)} · ${String(hour).padStart(2, '0')}:00 · ${escapeHtml(label(value))}" data-schedule-colonist="${c.id}" data-schedule-hour="${hour}" aria-label="${escapeHtml(c.name)} ${String(hour).padStart(2, '0')}:00 ${escapeHtml(label(value))}">${value}</button></td>`;
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
      <div class="schedule-legend"><span class="sleep">Dormir</span><span class="work">Trabalhar</span><span class="leisure">Lazer</span><em>Arraste para pintar várias horas · Hora atual: ${formatHour(state.hour || 0)}</em></div>
      <div class="schedule-table-wrap"><table class="schedule-table"><thead><tr><th>Colono</th>${renderHourHeader()}</tr></thead><tbody>${state.colonists.map(renderRow).join('')}</tbody></table></div>
    </div>`;
  }

  function cellFromEvent(event) {
    const btn = event.target?.closest?.('[data-schedule-colonist][data-schedule-hour]');
    if (!btn || !btn.closest('#anchored-ui-panel')) return null;
    return btn;
  }

  function colonistForCell(btn) {
    const id = String(btn.dataset.scheduleColonist);
    return state?.colonists?.find(col => String(col.id) === id) || null;
  }

  function updateCellVisual(btn, value) {
    const hour = Number(btn.dataset.scheduleHour);
    const c = colonistForCell(btn);
    btn.className = `schedule-cell ${cls(value)} ${hour === ScheduleManager.normalizeHour(state?.hour || 0) ? 'is-now' : ''}`;
    btn.textContent = String(value);
    if (c) {
      btn.title = `${c.name} · ${String(hour).padStart(2, '0')}:00 · ${label(value)}`;
      btn.setAttribute('aria-label', `${c.name} ${String(hour).padStart(2, '0')}:00 ${label(value)}`);
    }
  }

  function applyCell(btn, value) {
    const c = colonistForCell(btn);
    if (!c) return false;
    const hour = Number(btn.dataset.scheduleHour);
    ScheduleManager.setScheduleState(c, hour, value);
    updateCellVisual(btn, value);
    return true;
  }

  function cellKey(btn) {
    return `${btn.dataset.scheduleColonist}:${btn.dataset.scheduleHour}`;
  }

  function handlePointerDown(event) {
    const btn = cellFromEvent(event);
    if (!btn || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const c = colonistForCell(btn);
    if (!c) return;
    const hour = Number(btn.dataset.scheduleHour);
    const value = ScheduleManager.cycleScheduleState(c, hour);
    updateCellVisual(btn, value);
    brush = { value, last: cellKey(btn), changed: 1 };
    suppressClickUntil = performance.now() + 450;
  }

  function handlePointerMove(event) {
    if (!brush) return;
    const btn = cellFromEvent(event);
    if (!btn) return;
    const key = cellKey(btn);
    if (key === brush.last) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (applyCell(btn, brush.value)) {
      brush.last = key;
      brush.changed++;
    }
  }

  function finishBrush() {
    if (!brush) return;
    const changed = brush.changed;
    const value = brush.value;
    brush = null;
    suppressClickUntil = performance.now() + 250;
    if (changed > 1 && typeof gameLog === 'function') gameLog(`Rotina: ${changed} horário${changed > 1 ? 's' : ''} definido${changed > 1 ? 's' : ''} como ${label(value)}.`, 'info');
    updateUI?.(true);
    window.HavenfallUI.refreshDockPanel?.('schedule');
  }

  function handleScheduleClick(event) {
    const btn = cellFromEvent(event);
    if (!btn) return;
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
  }

  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('pointerup', finishBrush, true);
  document.addEventListener('pointercancel', finishBrush, true);
  document.addEventListener('click', handleScheduleClick, true);
  window.addEventListener('blur', finishBrush);

  window.HavenfallUI.tabViews.schedule = { render, onOpen: () => ScheduleManager.ensureAllSchedules() };
})();