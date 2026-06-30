'use strict';

(() => {
  if (window.HavenfallContext?.simulationBalanceInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.simulationBalanceInstalled = true;

  const SPEEDS = Object.freeze([1, 2, 3]);
  const CRITICAL_ENERGY = 8;
  const LOW_ENERGY = 18;
  const REST_DONE_WITH_BED = 88;
  const REST_DONE_WITH_CAMPFIRE = 82;
  const REST_DONE_ON_GROUND = 76;
  const RESEARCH_POINTS_PER_SECOND = 0.28;

  function clampLocal(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalizeGameSpeed(value) {
    const speed = Math.floor(Number(value) || 1);
    return SPEEDS.includes(speed) ? speed : 1;
  }

  function applySpeedToState() {
    if (!state || state.isPreview) return 1;
    const normalized = normalizeGameSpeed(state.speed);
    if (Number(state.speed) !== normalized) state.speed = normalized;
    return normalized;
  }

  function isPlayingSimulation() {
    return !!state && !state.isPreview && state.runtimeMode !== 'menu-preview' && appScreen === SCREEN.PLAYING;
  }

  function patchGameSystemsTick() {
    if (!window.GameSystems?.tick || window.GameSystems.tick.__havenfallSpeedPatched) return;
    const originalTick = window.GameSystems.tick.bind(window.GameSystems);
    function speedAwareTick(dt, safeTick = null) {
      if (!isPlayingSimulation()) return undefined;
      const speed = applySpeedToState();
      return originalTick(Math.max(0, Number(dt) || 0) * speed, safeTick);
    }
    speedAwareTick.__havenfallSpeedPatched = true;
    window.GameSystems.tick = speedAwareTick;
  }

  function patchSpeedInputs() {
    const normalizeSoon = () => setTimeout(() => {
      applySpeedToState();
      document.querySelectorAll('[data-speed]').forEach(btn => {
        btn.classList.toggle('active', !!state && Number(btn.dataset.speed) === Number(state.speed || 1) && appScreen === SCREEN.PLAYING);
      });
    }, 0);

    document.addEventListener('click', event => {
      if (event.target?.closest?.('[data-speed]')) normalizeSoon();
    });

    document.addEventListener('keydown', event => {
      if (!['1', '2', '3'].includes(event.key)) return;
      if (!state || !(appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) return;
      normalizeSoon();
    });
  }

  function sameTile(c, x, y) {
    return Math.round(c?.x || 0) === Math.round(Number(x) || 0) && Math.round(c?.y || 0) === Math.round(Number(y) || 0);
  }

  function reachablePath(c, x, y, target = null) {
    if (sameTile(c, x, y)) return [];
    if (typeof findPath !== 'function') return null;
    const path = findPath(c.x, c.y, x, y, target);
    return Array.isArray(path) ? path : null;
  }

  function sleepSpotNear(c, obj) {
    if (!obj) return null;
    const adj = typeof nearestFreeAdjacent === 'function'
      ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y)
      : { x: obj.x, y: obj.y };
    if (!adj) return null;
    const path = reachablePath(c, adj.x, adj.y, obj);
    if (!path) return null;
    return { x: adj.x, y: adj.y, path, obj };
  }

  function nearestReachableRestObject(c, type) {
    const objects = (state?.objects || [])
      .filter(obj => obj?.type === type)
      .sort((a, b) => Math.hypot(c.x - a.x, c.y - a.y) - Math.hypot(c.x - b.x, c.y - b.y));

    for (const obj of objects) {
      const spot = sleepSpotNear(c, obj);
      if (spot) return spot;
    }
    return null;
  }

  function assignSleepTask(c, task, path, note) {
    c.task = task;
    c.path = Array.isArray(path) ? path : [];
    c.work = 0;
    c.note = note;
    return true;
  }

  function improvedStartSleep(c) {
    if (!state || !c) return false;

    const bed = nearestReachableRestObject(c, 'bed');
    if (bed) {
      return assignSleepTask(c, { type: 'sleep', x: bed.x, y: bed.y, bedId: bed.obj.id }, bed.path, sameTile(c, bed.x, bed.y) ? 'Dormindo na cama' : 'Indo dormir');
    }

    const campfire = nearestReachableRestObject(c, 'campfire');
    if (campfire) {
      return assignSleepTask(c, { type: 'sleep', x: campfire.x, y: campfire.y, campfireId: campfire.obj.id }, campfire.path, sameTile(c, campfire.x, campfire.y) ? 'Descansando perto da fogueira' : 'Indo descansar perto da fogueira');
    }

    return assignSleepTask(c, { type: 'sleep', x: Math.round(c.x), y: Math.round(c.y), groundRest: true }, [], 'Descansando no chão');
  }

  function patchStartSleep() {
    if (typeof window.startSleep !== 'function' || window.startSleep.__havenfallRestPatched) return;
    improvedStartSleep.__havenfallRestPatched = true;
    window.startSleep = improvedStartSleep;
  }

  function cancelForRest(c, note = 'Exausto: descansando') {
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = note;
    improvedStartSleep(c);
  }

  function exhaustionGuard(c) {
    if (!state || state.isPreview || !c) return;
    const energy = Number(c.energy ?? 100);
    const taskType = c.task?.type;
    if (energy <= CRITICAL_ENERGY && taskType && !['sleep', 'combat', 'scare'].includes(taskType)) {
      cancelForRest(c);
      return;
    }
    if (energy < LOW_ENERGY && !taskType) improvedStartSleep(c);
  }

  function handleSleepTask(c, task, tick) {
    if (!task || task.type !== 'sleep') return false;

    if (!sameTile(c, task.x, task.y)) {
      const target = task.bedId
        ? (state.objects || []).find(obj => obj.id === task.bedId)
        : task.campfireId
          ? (state.objects || []).find(obj => obj.id === task.campfireId)
          : null;
      const path = reachablePath(c, task.x, task.y, target);
      if (path && path.length) {
        c.path = path;
        c.note = target?.type === 'bed' ? 'Indo dormir' : target?.type === 'campfire' ? 'Indo descansar perto da fogueira' : 'Indo descansar';
        return true;
      }
      task.x = Math.round(c.x);
      task.y = Math.round(c.y);
      task.groundRest = true;
      delete task.bedId;
      delete task.campfireId;
    }

    const hasBed = !!task.bedId && (state.objects || []).some(obj => obj.id === task.bedId && obj.type === 'bed');
    const hasCampfire = !!task.campfireId && (state.objects || []).some(obj => obj.id === task.campfireId && obj.type === 'campfire');
    const rate = hasBed ? 2.35 : hasCampfire ? 1.75 : 1.18;
    const moodRate = hasBed ? 0.32 : hasCampfire ? 0.18 : 0.06;
    const doneAt = hasBed ? REST_DONE_WITH_BED : hasCampfire ? REST_DONE_WITH_CAMPFIRE : REST_DONE_ON_GROUND;

    c.energy = clampLocal((c.energy || 0) + Math.max(0, Number(tick) || 0) * rate, 0, 100);
    c.mood = clampLocal((c.mood || 0) + Math.max(0, Number(tick) || 0) * moodRate, 0, 100);
    c.note = hasBed ? 'Dormindo na cama' : hasCampfire ? 'Descansando perto da fogueira' : 'Descansando no chão';

    if (c.energy >= doneAt) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Descansado';
    }
    return true;
  }

  function skillValue(c, keys) {
    for (const key of keys) {
      const value = c?.skills?.[key] ?? c?.[key];
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return 0;
  }

  function researchRate(c) {
    const research = skillValue(c, ['pesquisa', 'research', 'conhecimento', 'knowledge']);
    const reading = skillValue(c, ['leitura', 'reading']);
    const skillBonus = Math.min(0.34, research * 0.028);
    const readingBonus = Math.min(0.16, reading * 0.020);
    const tiredPenalty = Number(c.energy || 0) < 25 ? 0.55 : 1;
    const moodPenalty = Number(c.mood || 0) < 25 ? 0.78 : 1;
    const focus = tiredPenalty * moodPenalty;
    const base = RESEARCH_POINTS_PER_SECOND * (1 + skillBonus + readingBonus) * focus;
    return Math.max(0.08, base);
  }

  function handleResearchTask(c, task, tick) {
    if (!task || task.type !== 'research') return false;
    if (typeof ensureResearchState === 'function') ensureResearchState();

    const desk = (state.objects || []).find(obj => obj.id === task.objId && obj.type === 'research_desk');
    if (!desk) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Mesa de pesquisa indisponível';
      return true;
    }

    const key = state.research?.current;
    if (!key) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Todas as pesquisas concluídas';
      return true;
    }

    const def = researchDefs?.[key];
    if (!def) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Pesquisa inválida';
      return true;
    }

    const weatherPenalty = state.weather === 'chuva' ? 0.9 : 1;
    const workMultiplier = typeof workRate === 'function' ? workRate(c, 'research') : 1;
    const gain = Math.max(0, Number(tick) || 0) * researchRate(c) * weatherPenalty * Math.max(0.4, workMultiplier);

    state.research.progress = clampLocal((state.research.progress || 0) + gain, 0, def.cost);
    const pct = Math.floor((state.research.progress / Math.max(1, def.cost)) * 100);
    const skill = skillValue(c, ['pesquisa', 'research', 'conhecimento', 'knowledge']);
    c.note = `Pesquisando ${def.label} ${pct}% · conhecimento ${Math.round(skill)}`;

    if (state.research.progress >= def.cost) {
      if (typeof unlockResearch === 'function') unlockResearch(key);
      else {
        state.research.unlocked[key] = true;
        state.research.completed = state.research.completed || [];
        if (!state.research.completed.includes(key)) state.research.completed.push(key);
        state.research.progress = 0;
      }
      if (typeof notifyWorkComplete === 'function') notifyWorkComplete('research', { researchKey: key }, desk.x, desk.y);
      c.mood = clampLocal((c.mood || 0) + 4, 0, 100);
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Pesquisa concluída';
    }

    return true;
  }

  function installSystems() {
    patchGameSystemsTick();
    patchStartSleep();
    patchSpeedInputs();

    window.HavenfallSimulation = Object.freeze({
      normalizeGameSpeed,
      applySpeedToState,
      researchRate
    });

    window.GameSystems?.registerBeforeColonistUpdate?.('simulation-balance-exhaustion', exhaustionGuard, { order: 2 });
    window.GameSystems?.registerTaskHandler?.('sleep', 'simulation-balance-rest', handleSleepTask, { order: 2 });
    window.GameSystems?.registerTaskHandler?.('research', 'simulation-balance-research', handleResearchTask, { order: 2 });
  }

  installSystems();
})();
