'use strict';

const GAME_HOUR_SECONDS_1X = 40;
const TIME_SPEED = 1 / GAME_HOUR_SECONDS_1X;
const AUTOSAVE_INTERVAL_SECONDS = 90;
const UI_REFRESH_INTERVAL_SECONDS = 0.35;
const TARGET_RENDER_INTERVAL_MS = 1000 / 45;
const PAUSED_RENDER_INTERVAL_MS = 1000 / 15;
const loopErrorState = new Set();
let doorAutoClosePulse = 0;
let lastRenderAt = 0;

window.regrowthQueue = [];

window.HavenfallPerf = window.HavenfallPerf || {
  frame: 0,
  updateMs: 0,
  systemsMs: 0,
  drawMs: 0,
  uiMs: 0,
  lastFrameMs: 0,
  rendered: false,
  skippedRender: false
};

function newGame() {
  writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
  newGameConfig = readNewGameConfig();
  generateColonistCandidates(newGameConfig);
  setScreen(SCREEN.COLONIST_SELECT);
}

function showModal(title, text, button) {
  if (!dom.modal) return;
  dom.modal.querySelector('h1').textContent = title;
  dom.modal.querySelector('p').innerHTML = text;
  dom.modal.querySelector('button').textContent = button;
  dom.modal.classList.add('show');
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function markPerf(label, startedAt) {
  const elapsed = Math.round(((performance.now ? performance.now() : Date.now()) - startedAt) * 10) / 10;
  window.HavenfallPerf[label] = elapsed;
  return elapsed;
}

function safeSystemTick(label, fn) {
  if (typeof fn !== 'function') return;
  try {
    fn();
  } catch (err) {
    if (!loopErrorState.has(label)) {
      loopErrorState.add(label);
      console.error(`[GameLoop:${label}]`, err);
      if (typeof log === 'function') log(`Sistema ${label} falhou e foi isolado para manter o jogo rodando.`);
    }
  }
}

function doorOpenState() { return window.DoorState?.OPEN || 'open'; }
function doorClosedState() { return window.DoorState?.CLOSED || 'closed'; }
function doorClock() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
function isRealGameplay() { return !!state && state.isPreview !== true && state.runtimeMode !== 'menu-preview'; }

function isOpenedDoorObject(obj) {
  return obj?.type === 'door' && (obj.state || doorClosedState()) === doorOpenState();
}

function normalizeDoorObject(obj) {
  if (obj?.type !== 'door') return;
  obj.state = obj.state || doorClosedState();
  obj.doorState = obj.state;
  obj.texture_id = obj.state === doorOpenState() ? 'door_wood_open' : 'door_wood_closed';
  obj.lastDoorSeenAt = Number(obj.lastDoorSeenAt || doorClock());
}

function doorTileOccupied(obj) {
  const actors = [ ...(state?.colonists || []), ...(state?.visitors || []), ...(state?.mobs || []) ];
  return actors.some(actor => Math.round(actor.x) === obj.x && Math.round(actor.y) === obj.y);
}

function colonistNearDoor(obj) {
  return (state?.colonists || []).some(c => !c.isUnconscious && Math.hypot(Math.round(c.x) - obj.x, Math.round(c.y) - obj.y) <= 1.35);
}

function closeDoorObject(obj, reason = 'auto') {
  if (!isOpenedDoorObject(obj)) return false;
  if (doorTileOccupied(obj)) {
    obj.closeRequested = true;
    return false;
  }
  obj.state = doorClosedState();
  obj.doorState = doorClosedState();
  obj.texture_id = 'door_wood_closed';
  obj.lastClosedAt = doorClock();
  obj.lastDoorReason = reason;
  obj.lastOpenedBy = null;
  obj.closeRequested = false;
  if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  window.HavenfallRuntime?.bumpPathVersion?.(state, 'door-close');
  return true;
}

function updateDoorAutoClose(dt) {
  if (!isRealGameplay() || appScreen !== SCREEN.PLAYING) return;
  doorAutoClosePulse += dt * Number(state.speed || 1);
  if (doorAutoClosePulse < 0.18) return;
  doorAutoClosePulse = 0;
  const now = doorClock();
  for (const obj of state.objects || []) {
    if (obj?.type !== 'door') continue;
    normalizeDoorObject(obj);
    if (!isOpenedDoorObject(obj)) continue;
    const openedAt = Number(obj.lastOpenedAt || obj.lastDoorSeenAt || now);
    const elapsed = (now - openedAt) / 1000;
    if (obj.closeRequested || (!colonistNearDoor(obj) && elapsed >= 1.15) || elapsed >= 3.6) closeDoorObject(obj, 'auto');
  }
}

function processRegrowth() {
  if (!state?.objects || !window.regrowthQueue?.length) return;
  const now = (Number(state.day || 0) * 24) + Number(state.hour || 0);
  const remaining = [];
  for (const entry of window.regrowthQueue) {
    if (now < entry.readyAt) { remaining.push(entry); continue; }
    const spots = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = Math.round(entry.x) + dx;
        const ny = Math.round(entry.y) + dy;
        if (state.terrain?.[ny]?.[nx] && !getObjectAt(nx, ny) && !isBlocked(nx, ny)) spots.push({ x: nx, y: ny });
      }
    }
    spots.sort(() => Math.random() - 0.5);
    if (spots.length) {
      const spot = spots[0];
      state.objects.push({ id: uid('obj'), type: entry.type, x: spot.x, y: spot.y });
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    }
  }
  window.regrowthQueue = remaining;
}

function updateWorld(dt) {
  if (!isRealGameplay() || appScreen !== SCREEN.PLAYING) return;
  const speed = Number(state.speed || 1);
  const tick = dt * speed;
  const previousHour = Math.floor(state.hour || 0);

  state.hour += tick * TIME_SPEED;
  if (state.hour >= 24) {
    state.day += Math.floor(state.hour / 24);
    state.hour %= 24;
    state.eventDoneToday = false;
    log(`A colônia chegou ao Dia ${state.day}.`);
  }

  const currentHour = Math.floor(state.hour || 0);
  if (currentHour !== previousHour && typeof window.HavenfallUI?.refreshDockPanel === 'function') {
    window.HavenfallUI.refreshDockPanel('schedule');
    window.HavenfallUI.refreshDockPanel('tasks');
    window.HavenfallUI.refreshDockPanel('events');
  }

  if (!state.eventDoneToday && state.hour > 7.5) {
    state.eventDoneToday = true;
    randomEvent();
  }

  const intensityChance = ({ low: 0.0008, normal: 0.0018, high: 0.0035 })[state.config?.eventIntensity || 'normal'] || 0.0018;
  if (Math.random() < intensityChance * tick) randomEvent();

  if (state.weatherTime > 0) {
    state.weatherTime -= tick;
    if (state.weatherTime <= 0) {
      state.weather = 'limpo';
      log('O tempo abriu.');
    }
  }

  updateDoorAutoClose(dt);

  for (const c of state.colonists || []) {
    try {
      if (c.isDead) continue;
      updateColonist(c, dt);
    } catch (err) {
      console.error('[Colonist Update Error]', { colonist: c, task: c?.task, error: err });
      window.HavenfallRuntime?.cancelColonistTask?.(c, 'Tarefa cancelada por erro de IA');
      if (!window.HavenfallRuntime?.cancelColonistTask) {
        c.task = null;
        c.path = [];
        c.work = 0;
        c.note = 'Tarefa cancelada por erro de IA';
      }
    }
  }
  removeDeadColonists();
  processRegrowth();
  checkGoals();
}

function removeDeadColonists() {
  if (!state?.colonists) return;
  const deadTimeout = 12;
  const currentTime = (Number(state.day || 0) * 24) + Number(state.hour || 0);
  const alive = [];
  for (const c of state.colonists) {
    if (c.isDead && c.deathTime != null) {
      const hoursSinceDeath = currentTime - c.deathTime;
      if (hoursSinceDeath >= deadTimeout) {
        if (typeof log === 'function') log(`${c.name} foi enterrado após ${Math.round(hoursSinceDeath)}h (causa: ${c.deathCause || 'desconhecida'}).`);
        continue;
      }
    }
    alive.push(c);
  }
  state.colonists = alive;
}

function randomEvent() {
  if (!isRealGameplay()) return;
  const options = ['rain', 'supplies', 'wolf', 'berries', 'ore'];
  const event = options[Math.floor(Math.random() * options.length)];

  if (event === 'rain') {
    state.weather = 'chuva';
    state.weatherTime = 45;
    log('Chuva fina: umidade dos talhões mudou.');
    return;
  }

  if (event === 'supplies') {
    const wood = 4 + Math.floor(Math.random() * 7);
    const food = 2 + Math.floor(Math.random() * 5);
    const medicine = Math.random() < 0.35 ? 1 : 0;
    addResources({ wood, food, medicine });
    log(`Caixas antigas encontradas: +${wood} madeira, +${food} comida${medicine ? ' e +1 remédio' : ''}.`);
    return;
  }

  if (event === 'wolf') {
    if (typeof spawnMob === 'function') spawnMob('wolf');
    else if (typeof spawnWolf === 'function') spawnWolf();
    log('Uma ameaça apareceu perto da colônia. Organize a defesa.');
    return;
  }

  if (event === 'berries') {
    for (let i = 0; i < 2; i++) {
      const tile = freeRandomTile();
      if (tile) state.objects.push({ id: uid('obj'), type: 'berry', x: tile.x, y: tile.y });
    }
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    window.HavenfallRuntime?.bumpPathVersion?.(state, 'event-berries');
    log('Frutas silvestres brotaram perto da base.');
    return;
  }

  if (event === 'ore') {
    const tile = freeRandomStoneTile() || freeRandomTile();
    if (tile) {
      state.objects.push({ id: uid('obj'), type: 'ore', x: tile.x, y: tile.y });
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      window.HavenfallRuntime?.bumpPathVersion?.(state, 'event-ore');
      log('Um veio de metal foi encontrado em uma área rochosa.');
    }
  }
}

function freeRandomTile() {
  if (!isRealGameplay()) return null;
  for (let i = 0; i < 140; i++) {
    const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
    const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
    if (!getObjectAt(x, y) && !isBlocked(x, y) && isTileDiscovered(x, y)) return { x, y };
  }
  return null;
}

function freeRandomStoneTile() {
  if (!isRealGameplay()) return null;
  for (let i = 0; i < 160; i++) {
    const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
    const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
    if (state.terrain?.[y]?.[x] === 'stone' && !getObjectAt(x, y)) return { x, y };
  }
  return null;
}

function livingWorldState() {
  return state?.livingWorld || state?.world?.livingWorld || null;
}

function socialObjectiveState() {
  const living = livingWorldState();
  const nextKind = living?.nextVisitorKind || null;
  const now = (Number(state?.day || 1) * 24) + Number(state?.hour || 0);
  const nextAt = Number(living?.nextVisitorAt);
  const eta = Number.isFinite(nextAt) ? Math.max(0, Math.round((nextAt - now) * 10) / 10) : null;
  const firstContactDone = !!(living?.visitorSeen || living?.merchantSeen || Number(living?.socialEventCount || 0) > 0 || (state?.visitors?.length || 0) > 0);
  const merchantSeen = !!living?.merchantSeen || (state?.visitors || []).some(visitor => visitor?.kind === 'merchant');
  return { firstContactDone, merchantSeen, nextKind, eta };
}

function buildObjectiveSnapshot() {
  const beds = (state?.objects || []).filter(o => o.type === 'bed').length;
  const campfire = (state?.objects || []).some(o => o.type === 'campfire');
  const researchDesk = (state?.objects || []).some(o => o.type === 'research_desk');
  const food = Number(state?.resources?.food || 0);
  const medicine = Number(state?.resources?.medicine || 0);
  const social = socialObjectiveState();

  const entries = [
    { key: 'beds', label: 'Construir 2 camas', done: beds >= 2, progress: `${Math.min(beds, 2)}/2`, detail: beds >= 2 ? 'Leitos suficientes para a primeira noite.' : `Faltam ${Math.max(0, 2 - beds)} cama(s).` },
    { key: 'campfire', label: 'Construir 1 fogueira', done: campfire, progress: campfire ? 'ok' : '0/1', detail: campfire ? 'Calor e luz basicos garantidos.' : 'Sem fogo, a base continua sem ponto central.' },
    { key: 'researchDesk', label: 'Construir 1 mesa de pesquisa', done: researchDesk, progress: researchDesk ? 'ok' : '0/1', detail: researchDesk ? 'A colonia ja pode destravar tecnologia.' : 'Monte uma mesa para sair do improviso.' },
    { key: 'food', label: 'Estocar 20 comidas', done: food >= 20, progress: `${Math.min(food, 20)}/20`, detail: food >= 20 ? 'Reserva inicial de comida fechada.' : 'A reserva ainda esta curta para varios colonos.' },
    { key: 'medicine', label: 'Garantir 1 remedio', done: medicine >= 1, progress: `${Math.min(medicine, 1)}/1`, detail: medicine >= 1 ? 'Ja existe ao menos um recurso medico de emergencia.' : 'Explore ruinas ou negocie para conseguir remedio.' },
    {
      key: 'firstContact',
      label: 'Receber o primeiro visitante',
      done: social.firstContactDone,
      progress: social.firstContactDone ? 'ok' : 'pendente',
      detail: social.firstContactDone
        ? (social.merchantSeen ? 'A colonia ja fez contato com gente de fora, inclusive mercador.' : 'A colonia ja teve o primeiro contato social.')
        : (social.eta != null ? `${social.nextKind === 'merchant' ? 'Mercador' : 'Visitante'} previsto em ${social.eta}h.` : 'Sem encontro social agendado ainda.')
    }
  ];

  return {
    entries,
    pending: entries.filter(entry => !entry.done),
    primary: entries.find(entry => !entry.done) || null,
    social
  };
}

let lastObjectiveSignature = '';

function ensureLegacyGoalList(snapshot = null) {
  const list = dom.goalList;
  if (!list?.querySelectorAll) return;
  const source = snapshot?.entries || buildObjectiveSnapshot().entries;
  const items = [...list.querySelectorAll('li')];
  source.forEach((entry, index) => {
    const item = items[index];
    if (!item) return;
    item.dataset.goal = entry.key;
    item.textContent = entry.label;
  });
}

function checkGoals() {
  if (!isRealGameplay()) return;
  if (typeof ensureResearchState === 'function') ensureResearchState();
  const snapshot = buildObjectiveSnapshot();
  ensureLegacyGoalList(snapshot);
  state.objectives = snapshot;
  window.HavenfallObjectives = {
    evaluate: buildObjectiveSnapshot,
    getSnapshot: () => state?.objectives || buildObjectiveSnapshot()
  };

  for (const entry of snapshot.entries) setGoal(entry.key, entry.done);

  const signature = snapshot.entries.map(entry => `${entry.key}:${entry.done ? 1 : 0}:${entry.progress}`).join('|');
  if (signature !== lastObjectiveSignature) {
    lastObjectiveSignature = signature;
    window.HavenfallUI?.refreshDockPanel?.('tasks');
  }
}

function setGoal(key, done) {
  const el = dom.goalList?.querySelector?.(`[data-goal="${key}"]`);
  if (el) el.classList.toggle('done', !!done);
}

function runLoopStep(label, fn) {
  try {
    return typeof fn === 'function' ? fn() : undefined;
  } catch (err) {
    if (!loopErrorState.has(label)) {
      loopErrorState.add(label);
      console.error(`[GameLoop:${label}]`, err);
      if (typeof log === 'function') log(`Sistema ${label} falhou e foi isolado para manter o jogo rodando.`);
    }
    return undefined;
  }
}

function shouldRefreshUi() {
  return isRealGameplay() && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED || appScreen === SCREEN.LOAD_GAME);
}

function shouldAutosave() {
  return isRealGameplay() && settings?.autosave !== 'off' && appScreen === SCREEN.PLAYING && autosaveTimer > AUTOSAVE_INTERVAL_SECONDS;
}

function shouldRenderFrame(now) {
  if (!isRealGameplay() || !(appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) return false;
  const interval = appScreen === SCREEN.PAUSED ? PAUSED_RENDER_INTERVAL_MS : TARGET_RENDER_INTERVAL_MS;
  return now - lastRenderAt >= interval;
}

function gameLoop(now = performance.now()) {
  const frameStart = performance.now ? performance.now() : Date.now();
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000 || 0));
  lastTime = now;
  window.HavenfallPerf.rendered = false;
  window.HavenfallPerf.skippedRender = false;

  let stepStart = performance.now ? performance.now() : Date.now();
  runLoopStep('world', () => updateWorld(dt));
  markPerf('updateMs', stepStart);

  stepStart = performance.now ? performance.now() : Date.now();
  if (isRealGameplay() && window.GameSystems?.tick) {
    window.GameSystems.tick(dt, (label, fn) => safeSystemTick(label, fn));
  }
  markPerf('systemsMs', stepStart);

  runLoopStep('camera', () => updateCamera(dt));

  if (shouldRenderFrame(now)) {
    stepStart = performance.now ? performance.now() : Date.now();
    lastRenderAt = now;
    runLoopStep('draw', draw);
    window.HavenfallPerf.rendered = true;
    markPerf('drawMs', stepStart);
  } else {
    window.HavenfallPerf.skippedRender = isRealGameplay();
    window.HavenfallPerf.drawMs = 0;
  }

  uiTimer += dt;
  autosaveTimer += dt;
  if (state && uiTimer > UI_REFRESH_INTERVAL_SECONDS) {
    uiTimer = 0;
    if (shouldRefreshUi()) {
      stepStart = performance.now ? performance.now() : Date.now();
      runLoopStep('ui', () => updateUI());
      markPerf('uiMs', stepStart);
    }
  }
  if (state && shouldAutosave()) {
    autosaveTimer = 0;
    runLoopStep('autosave', () => saveGame(false));
  }

  window.HavenfallPerf.frame++;
  window.HavenfallPerf.lastFrameMs = Math.round(((performance.now ? performance.now() : Date.now()) - frameStart) * 10) / 10;
  requestAnimationFrame(gameLoop);
}

window.gameLoop = gameLoop;
