'use strict';

function installAlphaStateSystemPatch() {
  if (window.__havenfallAlphaStateSystemInstalled) return;
  window.__havenfallAlphaStateSystemInstalled = true;

  const fx = [];
  const IMPACT_COOLDOWN = 0.34;
  const DOWNED_TIME_LIMIT = 115;
  const RECOVER_HEALTH_TARGET = 42;

  function alive(c) {
    return !!c && !c.dead && !c.downed && (c.health ?? 100) > 0;
  }

  function canRescue(c) {
    return alive(c) && !c.carriedBy && c.task?.type !== 'rescueCarry' && c.task?.type !== 'rescuePickup';
  }

  function ensureAlphaWorld() {
    if (!state) return;
    state.alpha = state.alpha || { version: '1.0B', corpses: [] };
    state.alpha.corpses = state.alpha.corpses || [];
  }

  function ensureAlphaMeta(c) {
    if (!c) return;
    c.alphaState = c.alphaState || 'idle';
    c.alphaStateTimer = c.alphaStateTimer || 0;
    c.downedTime = c.downedTime || 0;
    c.recoverWork = c.recoverWork || 0;
  }

  function setAlphaState(c, next) {
    if (!c || c.alphaState === next) return;
    c.alphaState = next;
    c.alphaStateTimer = 0;
  }

  function addFx(type, x, y, extra = {}) {
    fx.push({ type, x, y, t: 0, life: extra.life || 0.75, vx: extra.vx || 0, vy: extra.vy || 0, color: extra.color || null, size: extra.size || 1 });
    if (fx.length > 140) fx.splice(0, fx.length - 140);
  }

  function addBurst(type, x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 35;
      addFx(type, x + (Math.random() * 12 - 6), y + (Math.random() * 8 - 4), {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 12,
        life: 0.45 + Math.random() * 0.38,
        size: 0.75 + Math.random() * 0.7
      });
    }
  }

  function tickFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const item = fx[i];
      item.t += dt * (state?.speed || 1);
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vy += 26 * dt;
      if (item.t >= item.life) fx.splice(i, 1);
    }
  }

  function worldPx(tile) {
    return { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 };
  }

  function bedForColonist(c) {
    if (!state?.objects) return null;
    if (c?.bedId) {
      const owned = state.objects.find(o => o.type === 'bed' && o.id === c.bedId);
      if (owned) return owned;
    }
    return null;
  }

  function bestBedFor(c) {
    if (!state?.objects) return null;
    const owned = bedForColonist(c);
    if (owned) return owned;
    const beds = state.objects.filter(o => o.type === 'bed');
    if (!beds.length) return null;
    const unowned = beds.filter(b => !b.ownerId || b.ownerId === c.id);
    return (unowned.length ? unowned : beds).sort((a, b) => dist(c.x, c.y, a.x, a.y) - dist(c.x, c.y, b.x, b.y))[0];
  }

  function reserveBedFor(c, bed) {
    if (!c || !bed) return;
    bed.ownerId = c.id;
    bed.occupantId = c.id;
    c.bedId = bed.id;
  }

  function releaseBedsFor(c) {
    if (!state?.objects || !c) return;
    for (const bed of state.objects) {
      if (bed.type === 'bed' && bed.occupantId === c.id) delete bed.occupantId;
    }
  }

  function downColonist(c, reason = 'ficou incapacitado') {
    if (!c || c.dead || c.downed) return;
    ensureAlphaWorld();
    ensureAlphaMeta(c);
    c.health = Math.max(1, c.health || 1);
    c.downed = true;
    c.downedTime = 0;
    c.rescueReservedBy = null;
    c.carriedBy = null;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = 'Incapacitado — precisa de resgate';
    setAlphaState(c, 'downed');
    addFx('hurt', c.px, c.py - 16, { life: 0.9, size: 1.2 });
    log(`${c.name} ${reason} e precisa ser levado para uma cama.`);
  }

  function killColonist(c, reason = 'não resistiu') {
    if (!c || c.dead) return;
    ensureAlphaWorld();
    c.dead = true;
    c.downed = false;
    c.health = 0;
    c.task = null;
    c.path = [];
    c.work = 0;
    c.carriedBy = null;
    c.rescueReservedBy = null;
    c.note = 'Morto';
    setAlphaState(c, 'dead');
    releaseBedsFor(c);
    state.alpha.corpses.push({ id: uid(), kind: 'colonist', name: c.name, sprite: c.sprite, x: c.x, y: c.y, px: c.px, py: c.py, createdDay: state.day || 1 });
    if (selectedColonistId === c.id) {
      const next = state.colonists.find(alive);
      if (next) selectedColonistId = next.id;
    }
    log(`${c.name} ${reason}.`);
    window.havenfallCheckGameOver?.();
  }

  function downedColonistsNeedingRescue() {
    return (state?.colonists || [])
      .filter(c => c.downed && !c.dead && !c.carriedBy && !c.task?.type?.startsWith?.('recover'))
      .sort((a, b) => a.downedTime - b.downedTime);
  }

  function assignRescue(rescuer, patient) {
    if (!canRescue(rescuer) || !patient || patient.dead || !patient.downed) return false;
    const adj = nearestFreeAdjacent(patient.x, patient.y, rescuer.x, rescuer.y) || { x: patient.x, y: patient.y };
    const path = findPath(rescuer.x, rescuer.y, adj.x, adj.y, patient);
    if (!(adj.x === rescuer.x && adj.y === rescuer.y) && !path.length) return false;
    rescuer.task = { type: 'rescuePickup', patientId: patient.id, x: adj.x, y: adj.y };
    rescuer.path = path;
    rescuer.work = 0;
    rescuer.note = `Indo resgatar ${patient.name}`;
    patient.rescueReservedBy = rescuer.id;
    setAlphaState(rescuer, 'walk');
    return true;
  }

  function autoAssignRescue(c) {
    if (!canRescue(c) || c.task) return false;
    const candidates = downedColonistsNeedingRescue().filter(p => p.id !== c.id && (!p.rescueReservedBy || p.rescueReservedBy === c.id));
    for (const patient of candidates) {
      if (assignRescue(c, patient)) return true;
    }
    return false;
  }

  function startCarryToBed(rescuer, patient) {
    const bed = bestBedFor(patient);
    if (!bed) {
      patient.rescueReservedBy = null;
      rescuer.task = null;
      rescuer.note = 'Sem cama para resgate';
      log(`Não há cama disponível para resgatar ${patient.name}.`);
      return;
    }
    const adj = nearestFreeAdjacent(bed.x, bed.y, rescuer.x, rescuer.y) || { x: bed.x, y: bed.y };
    const path = findPath(rescuer.x, rescuer.y, adj.x, adj.y, bed);
    if (!(adj.x === rescuer.x && adj.y === rescuer.y) && !path.length) {
      patient.rescueReservedBy = null;
      rescuer.task = null;
      rescuer.note = 'Sem caminho para cama';
      log(`${rescuer.name} não encontrou caminho até a cama para resgatar ${patient.name}.`);
      return;
    }
    patient.carriedBy = rescuer.id;
    patient.rescueReservedBy = rescuer.id;
    setAlphaState(patient, 'carried');
    setAlphaState(rescuer, 'carry');
    rescuer.task = { type: 'rescueCarry', patientId: patient.id, bedId: bed.id, x: adj.x, y: adj.y };
    rescuer.path = path;
    rescuer.work = 0;
    rescuer.note = `Levando ${patient.name} para a cama`;
  }

  function finishRescueAtBed(rescuer, patient, bed) {
    reserveBedFor(patient, bed);
    const pos = worldPx(bed);
    patient.px = pos.x;
    patient.py = pos.y;
    patient.x = bed.x;
    patient.y = bed.y;
    patient.downed = false;
    patient.carriedBy = null;
    patient.rescueReservedBy = null;
    patient.health = clamp(Math.max(patient.health, 8), 1, 100);
    patient.task = { type: 'recoverBed', bedId: bed.id, x: bed.x, y: bed.y };
    patient.path = [];
    patient.recoverWork = 0;
    patient.note = 'Recuperando na cama';
    setAlphaState(patient, 'sleep');
    rescuer.task = null;
    rescuer.path = [];
    rescuer.work = 0;
    rescuer.note = 'Resgate concluído';
    setAlphaState(rescuer, 'idle');
    addFx('heal', pos.x, pos.y - 20, { life: 1.2, size: 1.2 });
    log(`${rescuer.name} levou ${patient.name} para uma cama. Recuperação iniciada.`);
  }

  function handleRescueTaskAtTarget(c, task, tick) {
    const patient = state.colonists.find(p => p.id === task.patientId);
    if (!patient || patient.dead) { c.task = null; c.note = 'Ocioso'; return true; }

    if (task.type === 'rescuePickup') {
      c.work += tick;
      c.note = `Pegando ${patient.name}`;
      setAlphaState(c, 'carry');
      if (c.work >= 0.75) startCarryToBed(c, patient);
      return true;
    }

    if (task.type === 'rescueCarry') {
      const bed = state.objects.find(o => o.id === task.bedId && o.type === 'bed');
      if (!bed) { c.task = null; patient.carriedBy = null; patient.rescueReservedBy = null; return true; }
      finishRescueAtBed(c, patient, bed);
      return true;
    }

    return false;
  }

  function handleRecoverTask(c, task, tick) {
    const bed = state.objects.find(o => o.id === task.bedId && o.type === 'bed');
    if (!bed) {
      c.task = null;
      c.note = 'Sem cama para recuperação';
      releaseBedsFor(c);
      return true;
    }
    reserveBedFor(c, bed);
    const pos = worldPx(bed);
    c.px = pos.x;
    c.py = pos.y;
    c.x = bed.x;
    c.y = bed.y;
    c.health = clamp(c.health + tick * 2.1, 1, 100);
    c.energy = clamp(c.energy + tick * 2.4, 0, 100);
    c.mood = clamp(c.mood + tick * 0.35, 0, 100);
    c.note = `Recuperando ${Math.floor((c.health / RECOVER_HEALTH_TARGET) * 100)}%`;
    setAlphaState(c, 'sleep');
    if (Math.random() < 0.028 * state.speed) addFx('heal', c.px + Math.random() * 14 - 7, c.py - 20, { life: 0.9 });
    if (c.health >= RECOVER_HEALTH_TARGET && c.energy >= 32) {
      c.task = null;
      c.recoverWork = 0;
      c.note = 'Recuperado';
      releaseBedsFor(c);
      setAlphaState(c, 'idle');
      log(`${c.name} se recuperou o suficiente para voltar às tarefas.`);
    }
    return true;
  }

  const originalNearestBed = nearestBed;
  nearestBed = function alphaNearestBed(c) {
    return bestBedFor(c) || originalNearestBed(c);
  };

  const originalStartSleep = startSleep;
  startSleep = function alphaStartSleep(c) {
    const bed = bestBedFor(c);
    if (bed) {
      reserveBedFor(c, bed);
      const adj = nearestFreeAdjacent(bed.x, bed.y, c.x, c.y) || { x: bed.x, y: bed.y };
      c.task = { type: 'sleep', x: adj.x, y: adj.y, bedId: bed.id };
      c.path = findPath(c.x, c.y, adj.x, adj.y, bed);
      c.note = bed.ownerId === c.id ? 'Indo para sua cama' : 'Indo dormir';
      setAlphaState(c, 'walk');
      return;
    }
    originalStartSleep(c);
  };

  const originalHandleTaskAtTarget = handleTaskAtTarget;
  handleTaskAtTarget = function alphaHandleTaskAtTarget(c, tick) {
    const task = c?.task;
    if (!task) return originalHandleTaskAtTarget(c, tick);

    if (task.type === 'rescuePickup' || task.type === 'rescueCarry') return handleRescueTaskAtTarget(c, task, tick);
    if (task.type === 'recoverBed') return handleRecoverTask(c, task, tick);

    if (task.type === 'sleep') {
      const bed = task.bedId ? state.objects.find(o => o.id === task.bedId && o.type === 'bed') : null;
      if (bed) {
        reserveBedFor(c, bed);
        setAlphaState(c, 'sleep');
        if (Math.random() < 0.018 * state.speed) addFx('sleep', bed.x * TILE + TILE / 2, bed.y * TILE + 2, { life: 1.1 });
      }
      originalHandleTaskAtTarget(c, tick);
      if (!c.task || c.task.type !== 'sleep') releaseBedsFor(c);
      return;
    }

    if (task.type === 'gather') {
      const obj = state.objects.find(o => o.id === task.objId);
      if (obj) {
        const chop = obj.type === 'tree' || obj.type === 'logs' || obj.type === 'bush' || obj.type === 'berry';
        const mine = obj.type === 'rock' || obj.type === 'ore';
        setAlphaState(c, chop ? 'gather_chop' : mine ? 'gather_mine' : 'gather_pick');
        obj.hitFlash = Math.max(obj.hitFlash || 0, 0.18);
        obj.hitProgress = Math.max(obj.hitProgress || 0, c.work || 0);
        obj.lastWorkedAt = performance.now();
        const def = objectDefs[obj.type];
        if (def && (!obj.fxCooldown || obj.fxCooldown <= 0)) {
          const p = worldPx(obj);
          addBurst(chop ? 'wood' : mine ? 'stone' : 'dust', p.x, p.y + 4, 4);
          obj.fxCooldown = IMPACT_COOLDOWN;
        }
      }
      originalHandleTaskAtTarget(c, tick);
      return;
    }

    if (task.type === 'build') setAlphaState(c, 'build');
    else if (task.type === 'combat' || task.type === 'scare') setAlphaState(c, 'attack_melee');
    else if (task.type === 'craft' || task.type === 'forge' || task.type === 'cook' || task.type === 'heal' || task.type === 'research') setAlphaState(c, 'work');

    originalHandleTaskAtTarget(c, tick);
  };

  function syncCarriedColonist(c) {
    const carrier = state.colonists.find(o => o.id === c.carriedBy && !o.dead);
    if (!carrier) {
      c.carriedBy = null;
      c.rescueReservedBy = null;
      setAlphaState(c, 'downed');
      return false;
    }
    c.px = carrier.px - 8;
    c.py = carrier.py + 7;
    c.x = carrier.x;
    c.y = carrier.y;
    c.note = `Sendo carregado por ${carrier.name}`;
    setAlphaState(c, 'carried');
    return true;
  }

  const originalUpdateColonist = updateColonist;
  updateColonist = function alphaUpdateColonist(c, dt) {
    if (!c || !state || state.gameOver) return;
    ensureAlphaWorld();
    ensureAlphaMeta(c);
    const tick = dt * state.speed;
    c.alphaStateTimer += tick;

    if (c.dead) {
      setAlphaState(c, 'dead');
      return;
    }

    if (c.carriedBy) {
      syncCarriedColonist(c);
      return;
    }

    if (c.health <= 0 && !c.downed) downColonist(c, 'caiu em estado crítico');

    if (c.downed) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.downedTime += tick;
      c.mood = clamp(c.mood - tick * 0.08, 0, 100);
      c.note = `Incapacitado — ${Math.max(0, Math.ceil(DOWNED_TIME_LIMIT - c.downedTime))}s para resgate`;
      setAlphaState(c, 'downed');
      if (c.downedTime > DOWNED_TIME_LIMIT) killColonist(c, 'não resistiu antes do resgate');
      return;
    }

    if (!c.task) autoAssignRescue(c);

    const beforeTask = c.task?.type || '';
    originalUpdateColonist(c, dt);

    if (c.health <= 0 && !c.dead) {
      downColonist(c, 'foi incapacitado');
      return;
    }

    if (!c.task) setAlphaState(c, beforeTask === 'sleep' ? 'idle' : 'idle');
    else if (c.path?.length) setAlphaState(c, c.task.type === 'rescueCarry' ? 'carry' : 'walk');
  };

  function isColonistTargetable(c) {
    return !!c && !c.dead && !c.downed && !c.carriedBy && (c.health ?? 100) > 0;
  }

  function ensureWolfAi(w) {
    ensureWolfState(w);
    if (typeof w.homePx !== 'number') w.homePx = w.px;
    if (typeof w.homePy !== 'number') w.homePy = w.py;
    if (typeof w.alertTimer !== 'number') w.alertTimer = 0;
    if (typeof w.targetColonistId !== 'number') w.targetColonistId = 0;
    if (typeof w.wanderTimer !== 'number') w.wanderTimer = 0;
  }

  function wolfHasLineOfSight(w, c) {
    const x0 = Math.round((w.px - TILE / 2) / TILE);
    const y0 = Math.round((w.py - TILE / 2) / TILE);
    const x1 = Math.round((c.px - TILE / 2) / TILE);
    const y1 = Math.round((c.py - TILE / 2) / TILE);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 1; i < steps; i++) {
      const x = Math.round(x0 + (x1 - x0) * (i / steps));
      const y = Math.round(y0 + (y1 - y0) * (i / steps));
      if (!isInside(x, y)) return false;
      const obj = getObjectAt(x, y);
      if (obj && obj.type === 'wall') return false;
    }
    return true;
  }

  function wolfMoveToward(w, tx, ty, speed, tick) {
    const dx = tx - w.px;
    const dy = ty - w.py;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 3) return true;
    const nx = w.px + dx / len * speed * tick;
    const ny = w.py + dy / len * speed * tick;
    const tileX = Math.round((nx - TILE / 2) / TILE);
    const tileY = Math.round((ny - TILE / 2) / TILE);
    if (!isBlocked(tileX, tileY)) {
      w.px = nx;
      w.py = ny;
    }
    w.dir = dx > 0 ? 'right' : 'left';
    return false;
  }

  function wolfCorpse(w) {
    ensureAlphaWorld();
    state.alpha.corpses.push({ id: uid(), kind: 'wolf', x: Math.round(w.x), y: Math.round(w.y), px: w.px, py: w.py, createdDay: state.day || 1 });
    addFx('dust', w.px, w.py, { life: 1.1, size: 1.4 });
  }

  updateWolves = function alphaUpdateWolves(dt) {
    if (!state || state.gameOver) return;
    const WOLF_VIEW_TILES = 6.5;
    const WOLF_MEMORY_SECONDS = 4.5;
    const WOLF_LEASH_TILES = 10;
    const WOLF_WANDER_SPEED = 16;
    const WOLF_CHASE_SPEED = 28;
    const WOLF_ATTACK_RADIUS = 28;

    for (const w of state.wolves) {
      ensureWolfAi(w);
      const tick = dt * state.speed;
      w.anim += tick;
      w.alertTimer = Math.max(0, w.alertTimer - tick);
      w.wanderTimer = Math.max(0, w.wanderTimer - tick);

      const seen = (state.colonists || [])
        .filter(isColonistTargetable)
        .map(c => ({ c, d: Math.hypot(w.px - c.px, w.py - c.py) / TILE }))
        .filter(hit => hit.d <= WOLF_VIEW_TILES * (w.aggression || 1) && (hit.d <= 2.2 || wolfHasLineOfSight(w, hit.c)))
        .sort((a, b) => a.d - b.d)[0]?.c || null;

      if (seen) {
        w.targetColonistId = seen.id;
        w.alertTimer = WOLF_MEMORY_SECONDS;
      }

      let target = state.colonists.find(c => c.id === w.targetColonistId && isColonistTargetable(c));
      const leash = Math.hypot(w.px - w.homePx, w.py - w.homePy) / TILE;
      if (!target || w.alertTimer <= 0 || leash > WOLF_LEASH_TILES) {
        target = null;
        w.targetColonistId = 0;
        w.alertTimer = 0;
      }

      if (target) {
        const close = Math.hypot(target.px - w.px, target.py - w.py);
        wolfMoveToward(w, target.px, target.py, WOLF_CHASE_SPEED * (w.aggression || 1), tick);
        if (close < WOLF_ATTACK_RADIUS) {
          const fighting = target.task?.type === 'combat' && target.task?.wolfId === w.id;
          const armor = equipmentDefense(target);
          const pressure = fighting ? 0.75 : 1.45;
          target.health = clamp(target.health - tick * pressure * (1 - armor), -4, 100);
          target.mood = clamp(target.mood - tick * (fighting ? 0.30 : 0.65), 0, 100);
          target.note = fighting ? target.note : 'Ameaçado por lobo';
          setAlphaState(target, fighting ? 'attack_melee' : 'hurt');
          if (Math.random() < 0.020 * state.speed) addFx('hit', target.px, target.py - 18, { life: 0.55 });
          if (target.health <= 0) downColonist(target, 'foi incapacitado durante o ataque');
        }
      } else {
        if (!w.target || w.wanderTimer <= 0) {
          const hx = Math.round((w.homePx - TILE / 2) / TILE);
          const hy = Math.round((w.homePy - TILE / 2) / TILE);
          w.target = { x: clamp(Math.round(hx + (Math.random() * 8 - 4)), 1, getWorldCols() - 2), y: clamp(Math.round(hy + (Math.random() * 8 - 4)), 1, getWorldRows() - 2) };
          w.wanderTimer = 2.5 + Math.random() * 4;
        }
        const tx = w.target.x * TILE + TILE / 2;
        const ty = w.target.y * TILE + TILE / 2;
        if (wolfMoveToward(w, tx, ty, WOLF_WANDER_SPEED, tick)) w.target = null;
      }

      w.x = Math.round((w.px - TILE / 2) / TILE);
      w.y = Math.round((w.py - TILE / 2) / TILE);
    }
  };

  handleCombatTask = function alphaHandleCombatTask(c, task, tick) {
    if (state?.gameOver || !c || c.dead || c.downed) return;
    const wolf = state.wolves.find(w => w.id === task.wolfId);
    if (!wolf) { c.task = null; c.note = 'Ocioso'; c.work = 0; return; }
    ensureWolfState(wolf);
    ensureEquipment(c);
    setAlphaState(c, 'attack_melee');

    const power = equipmentCombatPower(c);
    const defense = equipmentDefense(c);
    const roundTime = power < 1.2 ? 4.2 : 3.0;
    c.work += tick * workRate(c, 'defense');
    c.note = `Confronto com lobo ${Math.floor((c.work / roundTime) * 100)}%`;
    if (Math.random() < 0.014 * state.speed) addFx('hit', wolf.px, wolf.py - 14, { life: 0.50 });
    if (c.work < roundTime) return;

    c.work = 0;
    task.rounds = (task.rounds || 0) + 1;
    const weaponKey = c.equipment?.weapon;
    const toolKey = c.equipment?.tool;
    const offhandKey = c.equipment?.offhand;
    const bowWithoutArrows = weaponKey === 'bow' && itemCount('arrows') <= 0;
    const weaponName = bowWithoutArrows ? null : (itemDefs[weaponKey]?.label || itemDefs[toolKey]?.label || null);
    const hasRealWeapon = !!weaponKey && !bowWithoutArrows;
    if (bowWithoutArrows && task.rounds === 1) log(`${c.name} está com arco, mas não tem flechas.`);
    if (weaponKey === 'bow' && !bowWithoutArrows) state.items.arrows = Math.max(0, (state.items.arrows || 0) - 1);

    const hasTorch = offhandKey === 'torch';
    const hasShield = offhandKey === 'shield';
    const alliesNearby = state.colonists.filter(other => other.id !== c.id && alive(other) && dist(other.x, other.y, c.x, c.y) <= 3).length;
    const groupBonus = alliesNearby * 0.35;
    const chanceRoll = Math.random();
    const attackPower = power + groupBonus + (hasTorch ? 0.35 : 0);
    const damageToWolf = hasRealWeapon ? 18 + attackPower * 8 : 4 + attackPower * 3;
    const danger = clamp((wolf.aggression || 1) * (hasRealWeapon ? 0.42 : 0.92) - defense - groupBonus * 0.12 - (hasTorch ? 0.18 : 0), 0.08, 0.95);
    const injury = Math.max(0, Math.round((hasRealWeapon ? 5 : 14) + danger * 14 - (hasShield ? 6 : 0)));

    wolf.hp = clamp(wolf.hp - damageToWolf, 0, 100);
    wolf.morale = clamp(wolf.morale - (hasTorch ? 28 : 12) - groupBonus * 8, 0, 100);
    addBurst('hit', wolf.px, wolf.py - 12, 5);

    if (!hasRealWeapon && chanceRoll < 0.55) {
      c.health = clamp(c.health - injury, -4, 100);
      c.mood = clamp(c.mood - 8, 0, 100);
      log(`${c.name} tentou conter o lobo sem arma e ficou em risco.`);
    } else if (chanceRoll < danger) {
      c.health = clamp(c.health - Math.max(2, Math.floor(injury * 0.55)), -4, 100);
      log(`${c.name} acertou o lobo com ${weaponName || 'um golpe improvisado'}, mas sofreu contra-ataque.`);
    } else {
      log(`${c.name} manteve distância e acertou o lobo com ${weaponName || 'um golpe improvisado'}.`);
    }

    if (c.health <= 0) { downColonist(c, 'foi incapacitado durante o confronto'); return; }

    if (wolf.hp <= 0) {
      state.wolves = state.wolves.filter(w => w.id !== wolf.id);
      wolfCorpse(wolf);
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
      log(`O lobo fugiu da área. ${c.name} sobreviveu ao confronto.`);
    }
  };

  function drawEntityBody(sprite, x, y, scale = 0.48, tint = null) {
    const img = images[`${sprite || 'colonistA'}_down_0`] || images.colonistA_down_0;
    ctx.save();
    ctx.translate(x, y + 18);
    ctx.rotate(Math.PI / 2);
    if (tint) ctx.globalAlpha = tint;
    drawAsset(img, 0, 0, scale, 0.5, 0.5, false);
    ctx.restore();
  }

  function drawAlphaTag(text, x, y, color = '#f1d08a') {
    if (!text) return;
    ctx.save();
    ctx.font = '900 10px system-ui';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundRect(x - w / 2, y - 12, w, 15, 7, true, false);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y - 1);
    ctx.restore();
  }

  const originalDrawColonist = drawColonist;
  drawColonist = function alphaDrawColonist(c) {
    ensureAlphaMeta(c);
    if (c.dead || c.alphaState === 'dead') {
      drawEntityBody(c.sprite, c.px, c.py, 0.48, 0.82);
      drawAlphaTag(c.name, c.px, c.py - 21, '#d7c7bd');
      return;
    }
    if (c.downed || c.alphaState === 'downed') {
      drawEntityBody(c.sprite, c.px, c.py, 0.48, 0.92);
      drawProgress(c.px, c.py - 25, Math.max(0, 1 - (c.downedTime || 0) / DOWNED_TIME_LIMIT), '#e7bd58');
      drawAlphaTag('incapacitado', c.px, c.py - 37, '#ffe08a');
      return;
    }
    if (c.alphaState === 'sleep' || c.task?.type === 'recoverBed') {
      const bed = c.task?.bedId ? state.objects.find(o => o.id === c.task.bedId && o.type === 'bed') : bedForColonist(c);
      const pos = bed ? worldPx(bed) : { x: c.px, y: c.py };
      drawEntityBody(c.sprite, pos.x, pos.y + 3, 0.46, 0.95);
      drawAlphaTag(c.task?.type === 'recoverBed' ? 'recuperando' : 'dormindo', pos.x, pos.y - 28, '#c9eaff');
      drawTinyBars(c);
      return;
    }

    originalDrawColonist(c);

    if (['gather_chop', 'gather_mine', 'build', 'attack_melee', 'carry', 'work'].includes(c.alphaState)) {
      const label = {
        gather_chop: 'cortando', gather_mine: 'minerando', build: 'construindo', attack_melee: 'lutando', carry: 'resgatando', work: 'trabalhando'
      }[c.alphaState];
      drawAlphaTag(label, c.px, c.py - 52, '#f3cf8a');
    }
  };

  const originalDrawObject = drawObject;
  drawObject = function alphaDrawObject(obj) {
    originalDrawObject(obj);
    if (!state || !obj) return;

    if (obj.type === 'bed' && obj.occupantId) {
      const c = state.colonists.find(row => row.id === obj.occupantId && !row.dead);
      if (c) {
        const p = worldPx(obj);
        ctx.save();
        ctx.fillStyle = 'rgba(121,199,232,.12)';
        ctx.strokeStyle = 'rgba(121,199,232,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 10, 26, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    const workers = state.colonists.filter(c => c.task?.type === 'gather' && c.task.objId === obj.id);
    if (!workers.length) return;
    const def = objectDefs[obj.type];
    if (!def?.work) return;
    const progress = Math.max(...workers.map(c => c.work || 0)) / def.work;
    const p = worldPx(obj);
    drawProgress(p.x, p.y - 26, progress, obj.type === 'tree' ? '#e3a93f' : '#b8c4d6');
    ctx.save();
    ctx.strokeStyle = obj.type === 'tree' ? 'rgba(244,179,80,.70)' : 'rgba(214,226,238,.62)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 13, 22 + progress * 10, 10 + progress * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  function drawCorpse(item) {
    if (item.kind === 'wolf') {
      ctx.save();
      ctx.translate(item.px, item.py + 16);
      ctx.rotate(-0.18);
      drawAsset(images.wolf_0, 0, 0, 0.32, 0.5, 0.5, true);
      ctx.restore();
      drawAlphaTag('carcaça', item.px, item.py - 10, '#d7c7bd');
      return;
    }
    drawEntityBody(item.sprite || 'colonistA', item.px, item.py, 0.46, 0.64);
  }

  function drawAlphaFx() {
    ctx.save();
    for (const item of fx) {
      const k = clamp(1 - item.t / item.life, 0, 1);
      ctx.globalAlpha = k;
      if (item.type === 'wood') ctx.fillStyle = '#c28a45';
      else if (item.type === 'stone') ctx.fillStyle = '#b9c0c8';
      else if (item.type === 'heal') ctx.fillStyle = '#9bd36a';
      else if (item.type === 'sleep') ctx.fillStyle = '#bfe8ff';
      else if (item.type === 'hit') ctx.fillStyle = '#f0b46d';
      else if (item.type === 'hurt') ctx.fillStyle = '#e67866';
      else ctx.fillStyle = '#d6c7a8';

      if (item.type === 'sleep') {
        ctx.font = `${Math.round(11 * item.size)}px system-ui`;
        ctx.fillText('Z', item.x, item.y - item.t * 10);
      } else if (item.type === 'heal') {
        ctx.font = `${Math.round(13 * item.size)}px system-ui`;
        ctx.fillText('+', item.x, item.y - item.t * 8);
      } else {
        ctx.beginPath();
        ctx.arc(item.x, item.y, 2.5 * item.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const originalDraw = draw;
  draw = function alphaDraw() {
    originalDraw();
    if (!state) return;
    ensureAlphaWorld();
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (const corpse of state.alpha.corpses || []) {
      if (isWorldPointInView(corpse.px, corpse.py)) drawCorpse(corpse);
    }
    drawAlphaFx();
    ctx.restore();
  };

  const originalUpdateWorld = updateWorld;
  updateWorld = function alphaUpdateWorld(dt) {
    ensureAlphaWorld();
    if (state?.objects) {
      for (const obj of state.objects) {
        if (obj.fxCooldown > 0) obj.fxCooldown = Math.max(0, obj.fxCooldown - dt * (state.speed || 1));
        if (obj.hitFlash > 0) obj.hitFlash = Math.max(0, obj.hitFlash - dt * (state.speed || 1));
      }
    }
    tickFx(dt);
    originalUpdateWorld(dt);
  };

  const originalStartNewGame = startNewGame;
  startNewGame = function alphaStartNewGame(config, selectedColonists) {
    originalStartNewGame(config, selectedColonists);
    ensureAlphaWorld();
    for (const c of state.colonists || []) {
      ensureAlphaMeta(c);
      c.downed = false;
      c.dead = false;
      c.carriedBy = null;
      c.rescueReservedBy = null;
    }
  };

  const originalLoadGame = loadGame;
  loadGame = function alphaLoadGame() {
    const result = originalLoadGame();
    if (result) {
      ensureAlphaWorld();
      for (const c of state.colonists || []) ensureAlphaMeta(c);
    }
    return result;
  };

  window.havenfallDownColonist = downColonist;
  window.havenfallKillColonist = killColonist;
}

if (typeof window !== 'undefined' && typeof updateColonist === 'function') {
  installAlphaStateSystemPatch();
}
