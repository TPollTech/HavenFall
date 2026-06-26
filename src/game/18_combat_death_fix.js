'use strict';

function installCombatDeathFixPatch() {
  function isColonistAlive(c) {
    return !!c && !c.dead && (c.health ?? 100) > 0;
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
  }

  const previousUpdateColonist = updateColonist;
  updateColonist = function deathAwareUpdateColonist(c, dt) {
    if (!c) return;
    if (c.dead || c.health <= 0) {
      markColonistDead(c);
      return;
    }
    previousUpdateColonist(c, dt);
    if (c.health <= 0) markColonistDead(c);
  };

  updateWolves = function deathAwareUpdateWolves(dt) {
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
}
