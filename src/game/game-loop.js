'use strict';

const GAME_HOUR_SECONDS_1X = 40;
const TIME_SPEED = 1 / GAME_HOUR_SECONDS_1X;
const loopErrorState = new Set();

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

function updateWorld(dt) {
  if (!state || appScreen !== SCREEN.PLAYING) return;
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

  for (const obj of state.objects || []) {
    if (obj.type === 'crop') {
      const rainBonus = state.weather === 'chuva' ? 2.1 : 1;
      obj.growth = clamp((obj.growth || 0) + tick * 0.85 * rainBonus, 0, 100);
    }
  }

  for (const c of state.colonists || []) {
    try {
      updateColonist(c, dt);
    } catch (err) {
      console.error('[Colonist Update Error]', { colonist: c, task: c?.task, error: err });
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Tarefa cancelada por erro de IA';
    }
  }
  checkGoals();
}

function randomEvent() {
  if (!state) return;
  const options = ['rain', 'supplies', 'wolf', 'berries', 'ore'];
  const event = options[Math.floor(Math.random() * options.length)];

  if (event === 'rain') {
    state.weather = 'chuva';
    state.weatherTime = 45;
    log('Chuva fina: plantações crescem mais rápido hoje.');
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
    log('Frutas silvestres brotaram perto da base.');
    return;
  }

  if (event === 'ore') {
    const tile = freeRandomStoneTile() || freeRandomTile();
    if (tile) {
      state.objects.push({ id: uid('obj'), type: 'ore', x: tile.x, y: tile.y });
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      log('Um veio de metal foi encontrado em uma área rochosa.');
    }
  }
}

function freeRandomTile() {
  if (!state) return null;
  for (let i = 0; i < 140; i++) {
    const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
    const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
    if (!getObjectAt(x, y) && !isBlocked(x, y) && isTileDiscovered(x, y)) return { x, y };
  }
  return null;
}

function freeRandomStoneTile() {
  if (!state) return null;
  for (let i = 0; i < 160; i++) {
    const x = 2 + Math.floor(Math.random() * Math.max(1, getWorldCols() - 4));
    const y = 2 + Math.floor(Math.random() * Math.max(1, getWorldRows() - 4));
    if (state.terrain?.[y]?.[x] === 'stone' && !getObjectAt(x, y)) return { x, y };
  }
  return null;
}

function checkGoals() {
  if (!state) return;
  if (typeof ensureResearchState === 'function') ensureResearchState();
  const beds = state.objects.filter(o => o.type === 'bed').length;
  const campfire = state.objects.some(o => o.type === 'campfire');
  const researchDesk = state.objects.some(o => o.type === 'research_desk');
  const allTechs = researchOrder.every(key => !!state.research?.unlocked?.[key]);
  setGoal('beds', beds >= 2);
  setGoal('campfire', campfire);
  setGoal('researchDesk', researchDesk);
  setGoal('techs', allTechs);
  setGoal('food', state.resources.food >= 20);
  setGoal('days', state.day >= 4);
  if (!state.won && beds >= 2 && campfire && researchDesk && allTechs && state.resources.food >= 20 && state.day >= 4) {
    state.won = true;
    setScreen(SCREEN.PAUSED);
    showModal('Base estabilizada!', 'Tu venceu a versão atual: a colônia tem cama, fogo, comida, mesa de pesquisa e tecnologias avançadas desbloqueadas. Dá para continuar jogando.', 'Continuar jogando');
    log('Objetivos principais concluídos.');
  }
}

function setGoal(key, done) {
  const el = dom.goalList?.querySelector(`[data-goal="${key}"]`);
  if (el) el.classList.toggle('done', !!done);
}

function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (window.GameSystems) GameSystems.tick(dt, safeSystemTick);
  else safeSystemTick('world', () => updateWorld(dt));
  safeSystemTick('camera', () => updateCamera(dt));
  safeSystemTick('draw', () => {
    if (state && (appScreen === SCREEN.PLAYING || appScreen === SCREEN.PAUSED)) {
      draw();
    }
  });
  uiTimer += dt;
  autosaveTimer += dt;
  if (state && uiTimer > 0.25) { uiTimer = 0; safeSystemTick('ui', () => updateUI()); }
  if (state && settings.autosave !== 'off' && appScreen === SCREEN.PLAYING && autosaveTimer > 15) { autosaveTimer = 0; safeSystemTick('save', () => saveGame(false)); }
  requestAnimationFrame(gameLoop);
}

window.GameSystems?.registerTick('world', updateWorld, { order: 30 });
window.TIME_SPEED = TIME_SPEED;
window.GAME_HOUR_SECONDS_1X = GAME_HOUR_SECONDS_1X;
