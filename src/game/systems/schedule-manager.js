'use strict';

(() => {
  const SCHEDULE = Object.freeze({ SLEEP: 0, WORK: 1, LEISURE: 2 });
  const SCHEDULE_LABELS = Object.freeze({ 0: 'Dormir', 1: 'Trabalhar', 2: 'Lazer' });
  const SCHEDULE_CLASS = Object.freeze({ 0: 'sleep', 1: 'work', 2: 'leisure' });
  const LEISURE_MIN_ENERGY = 24;
  const LEISURE_WAKE_MOOD = 18;
  const DEFAULT_SCHEDULE = Object.freeze([
    0,0,0,0,0,0,
    1,1,1,1,1,1,
    2,
    1,1,1,1,1,1,1,
    2,2,
    0,0
  ]);

  function normalizeHour(hour = state?.hour || 0) {
    return ((Math.floor(Number(hour) || 0) % 24) + 24) % 24;
  }

  function makeDefaultSchedule() {
    return Array.from(DEFAULT_SCHEDULE);
  }

  function ensureColonistSchedule(c) {
    if (!c) return null;
    if (!Array.isArray(c.schedule) || c.schedule.length !== 24) c.schedule = makeDefaultSchedule();
    c.schedule = c.schedule.map(v => [0,1,2].includes(Number(v)) ? Number(v) : 1);
    return c.schedule;
  }

  function ensureAllSchedules() {
    if (!state?.colonists) return;
    state.scheduleVersion = state.scheduleVersion || 1;
    for (const c of state.colonists) ensureColonistSchedule(c);
  }

  function getScheduleState(c, hour = state?.hour || 0) {
    const schedule = ensureColonistSchedule(c);
    if (!schedule) return SCHEDULE.WORK;
    return schedule[normalizeHour(hour)] ?? SCHEDULE.WORK;
  }

  function setScheduleState(c, hour, value) {
    const schedule = ensureColonistSchedule(c);
    if (!schedule) return;
    schedule[normalizeHour(hour)] = [0,1,2].includes(Number(value)) ? Number(value) : SCHEDULE.WORK;
  }

  function cycleScheduleState(c, hour) {
    const current = getScheduleState(c, hour);
    const next = current === SCHEDULE.SLEEP ? SCHEDULE.WORK : current === SCHEDULE.WORK ? SCHEDULE.LEISURE : SCHEDULE.SLEEP;
    setScheduleState(c, hour, next);
    return next;
  }

  function isInterruptibleForSchedule(c) {
    const type = c?.task?.type;
    if (!type) return true;
    return ['move','gather','mine','build','buildRoof','research','craft','haul','inspect','loot','inspectPoi','forge','cook','leisure'].includes(type);
  }

  function hasExplicitWorkPending() {
    return !!window.HavenfallWorkCoordinator?.workExists?.();
  }

  function canDeferLeisureForWork(c) {
    return Number(c?.energy ?? 100) > 28
      && Number(c?.mood ?? 100) > 16
      && Number(c?.hunger ?? 100) > 24
      && Number(c?.health ?? 100) > 20
      && hasExplicitWorkPending();
  }

  function isWorkTask(c) {
    const type = c?.task?.type;
    return ['gather','mine','build','buildRoof','haul','deconstruct','research','craft','forge','cook','inspect','loot','inspectPoi'].includes(type);
  }

  function nearestLeisureObject(c) {
    if (!state?.objects?.length) return null;
    return state.objects
      .filter(o => o.type === 'campfire')
      .sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0] || null;
  }

  function assignLeisure(c) {
    if (Number(c?.energy ?? 100) < LEISURE_MIN_ENERGY) {
      c.task = null;
      c.path = [];
      c.work = 0;
      if (typeof startSleep === 'function') startSleep(c);
      else c.note = 'Exausto: precisa dormir';
      return true;
    }
    const target = nearestLeisureObject(c);
    if (!target) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Procurando diversão';
      c.mood = clamp((c.mood || 0) + 0.01, 0, 100);
      return true;
    }
    const adj = nearestFreeAdjacent(target.x, target.y, c.x, c.y) || { x: target.x, y: target.y };
    c.task = { type: 'leisure', x: adj.x, y: adj.y, objId: target.id };
    c.path = findPath(c.x, c.y, adj.x, adj.y, target);
    c.work = 0;
    c.note = 'Indo relaxar na fogueira';
    return true;
  }

  function handleLeisureAtTarget(c, task, tick) {
    tick = Number(tick) || 0;
    if (Number(c?.energy ?? 100) < LEISURE_MIN_ENERGY) {
      c.task = null;
      c.path = [];
      c.work = 0;
      if (typeof startSleep === 'function') startSleep(c);
      else c.note = 'Exausto: precisa dormir';
      return true;
    }
    c.mood = clamp((c.mood || 0) + tick * 0.72, 0, 100);
    c.energy = clamp((c.energy || 0) + tick * 0.24, 0, 100);
    c.note = 'Relaxando';
    return true;
  }

  function applyScheduleBeforeColonistUpdate(c) {
    if (!state || !c || c.isUnconscious) return false;
    const mode = getScheduleState(c, state.hour);
    c.scheduleMode = mode;

    if (Number(c.energy ?? 100) < LEISURE_MIN_ENERGY && c.task?.type === 'leisure') {
      c.task = null;
      c.path = [];
      c.work = 0;
      if (typeof startSleep === 'function') startSleep(c);
      else c.note = 'Exausto: precisa dormir';
      return true;
    }

    if (mode === SCHEDULE.SLEEP) {
      if (c.task?.type !== 'sleep' && isInterruptibleForSchedule(c)) {
        c.task = null;
        c.path = [];
        c.work = 0;
        if (typeof startSleep === 'function') startSleep(c);
        else c.note = 'Horário de dormir';
        return true;
      }
      return false;
    }

    if (mode === SCHEDULE.LEISURE) {
      if (Number(c.energy ?? 100) < LEISURE_MIN_ENERGY) {
        if (c.task?.type !== 'sleep' && isInterruptibleForSchedule(c)) {
          c.task = null;
          c.path = [];
          c.work = 0;
          if (typeof startSleep === 'function') startSleep(c);
          else c.note = 'Exausto: precisa dormir';
          return true;
        }
        return false;
      }
      if (c.task?.type === 'sleep' && (c.energy < 35 || c.mood < LEISURE_WAKE_MOOD)) return false;
      if (isWorkTask(c) && canDeferLeisureForWork(c)) return false;
      if (!c.task && canDeferLeisureForWork(c)) return false;
      if (c.task?.type !== 'leisure' && isInterruptibleForSchedule(c)) {
        assignLeisure(c);
        return true;
      }
      return false;
    }

    if (mode === SCHEDULE.WORK && c.task?.type === 'sleep' && c.energy > 45) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Voltando ao trabalho';
      return true;
    }

    return false;
  }

  function installScheduleHooks() {
    if (window.HavenfallContext?.scheduleHooksInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};
    window.GameSystems?.registerBeforeColonistUpdate('schedule.mode', c => {
      ensureColonistSchedule(c);
      applyScheduleBeforeColonistUpdate(c);
    }, { order: 10 });
    window.GameSystems?.registerTaskHandler('leisure', 'schedule.leisure', handleLeisureAtTarget, { order: 10 });

    window.HavenfallContext.scheduleHooksInstalled = true;
  }

  function updateScheduleManagerTick() {
    installScheduleHooks();
    ensureAllSchedules();
  }

  window.ScheduleManager = {
    SCHEDULE,
    SCHEDULE_LABELS,
    SCHEDULE_CLASS,
    makeDefaultSchedule,
    ensureColonistSchedule,
    ensureAllSchedules,
    getScheduleState,
    setScheduleState,
    cycleScheduleState,
    normalizeHour,
    assignLeisure
  };

  window.updateScheduleManagerTick = updateScheduleManagerTick;
  installScheduleHooks();
  window.GameSystems?.registerTick('schedule', updateScheduleManagerTick, { order: 20 });
})();
