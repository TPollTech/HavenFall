'use strict';

function installCombatDeathFixPatch() {
  function isColonistAlive(c) {
    return !!c && !c.dead && (c.health ?? 100) > 0;
  }

  function livingColonists() {
    return (state?.colonists || []).filter(isColonistAlive);
  }

  function ensureGameOverStyles() {
    if (document.getElementById('gameOverPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'gameOverPatchStyles';
    style.textContent = `
      .game-over-overlay {
        position: fixed;
        inset: 0;
        z-index: 220;
        display: none;
        place-items: center;
        padding: 20px;
        background: radial-gradient(circle at center, rgba(67, 25, 28, .72), rgba(2, 4, 8, .92));
        backdrop-filter: blur(4px);
      }
      .game-over-overlay.show { display: grid; }
      .game-over-card {
        width: min(620px, 94vw);
        border-radius: 24px;
        border: 1px solid rgba(255,255,255,.14);
        background: linear-gradient(145deg, rgba(16,18,27,.98), rgba(38,28,31,.98));
        box-shadow: 0 26px 90px rgba(0,0,0,.55);
        padding: 24px;
        text-align: center;
      }
      .game-over-card .kicker {
        color: #f0b46d;
        letter-spacing: .18em;
        text-transform: uppercase;
        font-weight: 900;
        font-size: 12px;
      }
      .game-over-card h1 {
        margin: 8px 0 10px;
        font-size: clamp(32px, 6vw, 58px);
      }
      .game-over-card p {
        color: rgba(232,241,255,.75);
        line-height: 1.55;
      }
      .game-over-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin: 18px 0;
      }
      .game-over-stats div {
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.045);
        padding: 10px;
      }
      .game-over-stats b { display:block; font-size: 20px; }
      .game-over-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureGameOverOverlay() {
    ensureGameOverStyles();
    let overlay = document.getElementById('gameOverOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'gameOverOverlay';
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
      <div class="game-over-card">
        <div class="kicker">Colônia perdida</div>
        <h1>Fim de jogo</h1>
        <p>Todos os colonos morreram. A simulação foi pausada e este mundo não possui mais sobreviventes ativos.</p>
        <div class="game-over-stats">
          <div><b id="gameOverDay">-</b><span>Dia</span></div>
          <div><b id="gameOverSeed">-</b><span>Seed</span></div>
          <div><b id="gameOverWorld">-</b><span>Mundo</span></div>
        </div>
        <div class="game-over-actions">
          <button id="gameOverNewGameBtn">Nova colônia</button>
          <button id="gameOverMenuBtn" class="secondary">Menu principal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#gameOverNewGameBtn')?.addEventListener('click', () => {
      overlay.classList.remove('show');
      activeSession = false;
      state = createInitialState({ ...defaultNewGameConfig, colonyName: 'First Haven', seed: generateRandomSeed() });
      writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
      setScreen(SCREEN.NEW_GAME_SETUP);
      updateUI(true);
    });

    overlay.querySelector('#gameOverMenuBtn')?.addEventListener('click', () => {
      overlay.classList.remove('show');
      setScreen(SCREEN.MAIN_MENU);
    });

    return overlay;
  }

  function showGameOverOverlay() {
    const overlay = ensureGameOverOverlay();
    const day = document.getElementById('gameOverDay');
    const seed = document.getElementById('gameOverSeed');
    const world = document.getElementById('gameOverWorld');
    if (day) day.textContent = String(state?.day || 1);
    if (seed) seed.textContent = String(state?.config?.seed || '-').slice(0, 12);
    if (world) world.textContent = String(state?.config?.colonyName || 'Colônia');
    overlay.classList.add('show');
  }

  function checkColonyGameOver() {
    if (!state || !activeSession) return false;
    if (!state.colonists || state.colonists.length === 0) return false;
    if (state.gameOver) return true;
    if (livingColonists().length > 0) return false;

    state.gameOver = true;
    state.paused = true;
    state.speed = 0;
    currentBuild = null;
    selectedCraftStationId = null;
    if (typeof hideContextMenu === 'function') hideContextMenu();
    log('Fim de jogo: todos os colonos morreram.');
    showGameOverOverlay();
    updateUI(true);
    return true;
  }

  function markColonistDead(c, reason = 'não resistiu aos ferimentos') {
    if (!c || c.dead) return;
    c.health = 0;
    c.dead = true;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = 'Morto';
    c.mood = 0;
    log(`${c.name} ${reason}.`);

    if (selectedColonistId === c.id) {
      const next = state.colonists.find(isColonistAlive);
      selectedColonistId = next?.id || c.id;
    }

    checkColonyGameOver();
  }

  window.havenfallCheckGameOver = checkColonyGameOver;

  const previousUpdateColonist = updateColonist;
  updateColonist = function deathAwareUpdateColonist(c, dt) {
    if (!c) return;
    if (state?.gameOver) return;
    if (c.dead || c.health <= 0) {
      markColonistDead(c);
      return;
    }
    previousUpdateColonist(c, dt);
    if (c.health <= 0) markColonistDead(c);
  };

  updateWolves = function deathAwareUpdateWolves(dt) {
    if (state?.gameOver) return;
    for (const w of state.wolves) {
      ensureWolfState(w);
      const tick = dt * state.speed;
      const nearest = state.colonists
        .filter(isColonistAlive)
        .slice()
        .sort((a, b) => Math.hypot(a.px - w.px, a.py - w.py) - Math.hypot(b.px - w.px, b.py - w.py))[0];
      if (!nearest) continue;

      const close = Math.hypot(nearest.px - w.px, nearest.py - w.py);
      w.anim += tick;

      if (close < TILE * 4) {
        const dx = nearest.px - w.px;
        const dy = nearest.py - w.py;
        const len = Math.hypot(dx, dy) || 1;
        w.px += dx / len * 35 * tick;
        w.py += dy / len * 35 * tick;
        w.dir = dx > 0 ? 'right' : 'left';

        if (close < 32) {
          const activelyFighting = nearest.task?.type === 'combat' && nearest.task?.wolfId === w.id;
          const armor = equipmentDefense(nearest);
          const pressure = activelyFighting ? 1.4 : 3.2;
          nearest.health = clamp(nearest.health - tick * pressure * (1 - armor), 0, 100);
          nearest.mood = clamp(nearest.mood - tick * (activelyFighting ? 0.55 : 1.1), 0, 100);
          nearest.note = activelyFighting ? nearest.note : 'Em perigo';
          if (nearest.health <= 0) markColonistDead(nearest, 'morreu durante o ataque do lobo');
        }
      } else if (Math.random() < 0.01 * state.speed) {
        w.target = randomEdgeTile(false);
      }

      if (w.target) {
        const tx = w.target.x * TILE + TILE / 2;
        const ty = w.target.y * TILE + TILE / 2;
        const dx = tx - w.px;
        const dy = ty - w.py;
        const len = Math.hypot(dx, dy) || 1;
        if (len < 4) w.target = null;
        else { w.px += dx / len * 24 * tick; w.py += dy / len * 24 * tick; }
      }

      w.x = Math.round((w.px - TILE / 2) / TILE);
      w.y = Math.round((w.py - TILE / 2) / TILE);
    }
  };

  handleCombatTask = function deathAwareHandleCombatTask(c, task, tick) {
    if (state?.gameOver) return;
    if (!isColonistAlive(c)) {
      markColonistDead(c);
      return;
    }

    const wolf = state.wolves.find(w => w.id === task.wolfId);
    if (!wolf) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }

    ensureWolfState(wolf);
    ensureEquipment(c);

    const power = equipmentCombatPower(c);
    const defense = equipmentDefense(c);
    const roundTime = power < 1.2 ? 4.2 : 3.0;
    c.work += tick * workRate(c, 'defense');
    c.note = `Confronto com lobo ${Math.floor((c.work / roundTime) * 100)}%`;

    if (c.work < roundTime) return;

    c.work = 0;
    task.rounds = (task.rounds || 0) + 1;

    const weaponKey = c.equipment?.weapon;
    const toolKey = c.equipment?.tool;
    const offhandKey = c.equipment?.offhand;
    const bowWithoutArrows = weaponKey === 'bow' && itemCount('arrows') <= 0;
    const weaponName = bowWithoutArrows ? null : (itemDefs[weaponKey]?.label || itemDefs[toolKey]?.label || null);
    const hasRealWeapon = !!weaponKey && !bowWithoutArrows;

    if (bowWithoutArrows && task.rounds === 1) log(`${c.name} está com arco, mas não tem flechas. O confronto fica muito mais perigoso.`);
    if (weaponKey === 'bow' && !bowWithoutArrows) state.items.arrows = Math.max(0, (state.items.arrows || 0) - 1);

    const hasTorch = offhandKey === 'torch';
    const hasShield = offhandKey === 'shield';
    const alliesNearby = state.colonists.filter(other => other.id !== c.id && isColonistAlive(other) && dist(other.x, other.y, c.x, c.y) <= 3).length;
    const groupBonus = alliesNearby * 0.35;
    const chanceRoll = Math.random();
    const attackPower = power + groupBonus + (hasTorch ? 0.35 : 0);
    const damageToWolf = hasRealWeapon ? 18 + attackPower * 8 : 4 + attackPower * 3;
    const danger = clamp((wolf.aggression || 1) * (hasRealWeapon ? 0.42 : 0.92) - defense - groupBonus * 0.12 - (hasTorch ? 0.18 : 0), 0.08, 0.95);
    const injury = Math.max(0, Math.round((hasRealWeapon ? 5 : 14) + danger * 14 - (hasShield ? 6 : 0)));

    if (!hasRealWeapon && chanceRoll < 0.55) {
      c.health = clamp(c.health - injury, 0, 100);
      c.mood = clamp(c.mood - 8, 0, 100);
      wolf.morale = clamp(wolf.morale - 8 - (hasTorch ? 12 : 0), 0, 100);
      log(`${c.name} tentou segurar o lobo sem arma e recuou muito ferido.`);
    } else {
      wolf.hp = clamp(wolf.hp - damageToWolf, 0, 100);
      wolf.morale = clamp(wolf.morale - (hasTorch ? 28 : 12) - groupBonus * 8, 0, 100);
      if (chanceRoll < danger) {
        c.health = clamp(c.health - Math.max(2, Math.floor(injury * 0.55)), 0, 100);
        log(`${c.name} acertou o lobo com ${weaponName || 'um golpe improvisado'}, mas sofreu contra-ataque.`);
      } else {
        log(`${c.name} manteve distância e acertou o lobo com ${weaponName || 'um golpe improvisado'}.`);
      }
    }

    if (c.health <= 0) {
      markColonistDead(c, 'morreu durante o confronto com o lobo');
      return;
    }

    if (wolf.hp <= 0) {
      state.wolves = state.wolves.filter(w => w.id !== wolf.id);
      c.mood = clamp(c.mood + 7, 0, 100);
      c.note = 'Ameaça neutralizada';
      c.task = null;
      log(`${c.name} neutralizou o lobo depois de um confronto difícil.`);
      return;
    }

    if (c.health <= 12) {
      c.task = null;
      c.note = 'Ferido e recuando';
      c.mood = clamp(c.mood - 12, 0, 100);
      log(`${c.name} ficou em condição ruim e abandonou o confronto. É melhor buscar tratamento.`);
      return;
    }

    if (wolf.morale <= 15 || (hasTorch && chanceRoll < 0.42) || (!hasRealWeapon && task.rounds >= 2 && chanceRoll < 0.28)) {
      state.wolves = state.wolves.filter(w => w.id !== wolf.id);
      c.mood = clamp(c.mood + 4, 0, 100);
      c.note = 'Lobo afastado';
      c.task = null;
      log(`O lobo hesitou e fugiu da área. ${c.name} sobreviveu ao confronto.`);
      return;
    }

    if (!hasRealWeapon && task.rounds >= 3) {
      c.task = null;
      c.note = 'Recuou do combate';
      c.mood = clamp(c.mood - 6, 0, 100);
      log(`${c.name} percebeu que lutar desarmado era arriscado demais e recuou.`);
    }
  };

  const previousUpdateWorld = updateWorld;
  updateWorld = function gameOverAwareUpdateWorld(dt) {
    if (state?.gameOver) return;
    previousUpdateWorld(dt);
    checkColonyGameOver();
  };

  const previousLoadGame = loadGame;
  loadGame = function gameOverAwareLoadGame() {
    const result = previousLoadGame();
    if (result && state?.gameOver) setTimeout(showGameOverOverlay, 50);
    return result;
  };

  ensureGameOverStyles();
}
