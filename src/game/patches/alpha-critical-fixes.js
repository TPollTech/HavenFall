'use strict';

(() => {
  window.HavenfallContext = window.HavenfallContext || {};
  if (window.HavenfallContext.alphaCriticalFixesInstalled) return;
  window.HavenfallContext.alphaCriticalFixesInstalled = true;

  const CSS_MODULES = Object.freeze([
    'src/css/01_global.css',
    'src/css/02_game_canvas.css',
    'src/css/03_hud_top.css',
    'src/css/04_hud_bottom.css',
    'src/css/05_modals.css'
  ]);

  const SAFE_SPAWN_RADIUS_TILES = 15;
  const MAX_TOTAL_MOBILE_ENTITIES = 18;
  const MAX_HOSTILE_ENTITIES = 6;
  const MOB_SEPARATION_PX = 26;
  const HIT_PARTICLE_LIFETIME = 0.58;
  const IMPACT_TIMER_MAX = 0.18;

  function injectCssModules() {
    const head = document.head;
    if (!head) return;
    CSS_MODULES.forEach((href) => {
      if (head.querySelector(`link[href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.havenfallCssModule = 'true';
      head.appendChild(link);
    });
  }

  function tileDistance(a, b) {
    return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
  }

  function hostileCount() {
    const mobs = Array.isArray(state?.mobs) ? state.mobs : [];
    const wolves = Array.isArray(state?.wolves) ? state.wolves : [];
    return wolves.length + mobs.filter((m) => m?.type === 'wolf' || m?.type === 'spider').length;
  }

  function totalMobileCount() {
    return (state?.wolves?.length || 0) + (state?.mobs?.length || 0);
  }

  function isHostileType(type) {
    return type === 'wolf' || type === 'spider';
  }

  function isInSafeZone(x, y, radius = SAFE_SPAWN_RADIUS_TILES) {
    const colonists = Array.isArray(state?.colonists) ? state.colonists : [];
    if (!colonists.length) return false;
    return colonists.some((c) => tileDistance({ x, y }, c) < radius);
  }

  function hasMobileOnTile(x, y) {
    const mobs = Array.isArray(state?.mobs) ? state.mobs : [];
    const wolves = Array.isArray(state?.wolves) ? state.wolves : [];
    for (const mob of mobs) {
      if (Math.round(mob?.x) === x && Math.round(mob?.y) === y) return true;
    }
    for (const wolf of wolves) {
      if (Math.round(wolf?.x) === x && Math.round(wolf?.y) === y) return true;
    }
    return false;
  }

  function isSpawnTileAllowed(type, tile) {
    if (!tile || typeof isInside !== 'function' || !isInside(tile.x, tile.y)) return false;
    if (typeof isBlocked === 'function' && isBlocked(tile.x, tile.y)) return false;
    if (typeof getObjectAt === 'function' && getObjectAt(tile.x, tile.y)) return false;
    if (hasMobileOnTile(tile.x, tile.y)) return false;
    if (isHostileType(type) && isInSafeZone(tile.x, tile.y)) return false;
    return true;
  }

  function randomTileAwayFromColonists(type, preferEdge = false) {
    const cols = typeof getWorldCols === 'function' ? getWorldCols() : 64;
    const rows = typeof getWorldRows === 'function' ? getWorldRows() : 46;
    for (let i = 0; i < 140; i++) {
      let tile;
      if (preferEdge || (isHostileType(type) && i < 90)) {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) tile = { x: 1, y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
        else if (side === 1) tile = { x: Math.max(1, cols - 2), y: 1 + Math.floor(Math.random() * Math.max(1, rows - 2)) };
        else if (side === 2) tile = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: 1 };
        else tile = { x: 1 + Math.floor(Math.random() * Math.max(1, cols - 2)), y: Math.max(1, rows - 2) };
      } else {
        tile = {
          x: 2 + Math.floor(Math.random() * Math.max(1, cols - 4)),
          y: 2 + Math.floor(Math.random() * Math.max(1, rows - 4))
        };
      }
      if (isSpawnTileAllowed(type, tile)) return tile;
    }
    return null;
  }

  function nudgeMobile(entity, dx, dy, strength = 1) {
    if (!entity) return;
    const len = Math.hypot(dx, dy) || 1;
    const amount = strength / len;
    const worldW = typeof getWorldWidth === 'function' ? getWorldWidth() : 99999;
    const worldH = typeof getWorldHeight === 'function' ? getWorldHeight() : 99999;
    const tile = typeof TILE === 'number' ? TILE : 48;
    entity.px = Math.max(tile / 2, Math.min(worldW - tile / 2, (entity.px || entity.x * tile + tile / 2) + dx * amount));
    entity.py = Math.max(tile / 2, Math.min(worldH - tile / 2, (entity.py || entity.y * tile + tile / 2) + dy * amount));
    entity.x = Math.round((entity.px - tile / 2) / tile);
    entity.y = Math.round((entity.py - tile / 2) / tile);
  }

  function mobileEntities() {
    return [
      ...(Array.isArray(state?.mobs) ? state.mobs : []),
      ...(Array.isArray(state?.wolves) ? state.wolves : [])
    ].filter(Boolean);
  }

  function resolveMobileOverlap() {
    const list = mobileEntities();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ax = a.px ?? (a.x * TILE + TILE / 2);
        const ay = a.py ?? (a.y * TILE + TILE / 2);
        const bx = b.px ?? (b.x * TILE + TILE / 2);
        const by = b.py ?? (b.y * TILE + TILE / 2);
        let dx = ax - bx;
        let dy = ay - by;
        let d = Math.hypot(dx, dy);
        if (d >= MOB_SEPARATION_PX) continue;
        if (d < 0.001) {
          const angle = ((i + 1) * 1.917 + (j + 1) * 0.731) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const push = (MOB_SEPARATION_PX - d) * 0.5;
        nudgeMobile(a, dx, dy, push);
        nudgeMobile(b, -dx, -dy, push);
      }
    }
  }

  function ensureParticles() {
    window.bloodParticles = Array.isArray(window.bloodParticles) ? window.bloodParticles : [];
    return window.bloodParticles;
  }

  function emitHitParticles(x, y, amount = 7) {
    const particles = ensureParticles();
    const now = performance.now() / 1000;
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 18 + Math.random() * 52;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        age: 0,
        bornAt: now,
        life: HIT_PARTICLE_LIFETIME * (0.72 + Math.random() * 0.55),
        size: 1.8 + Math.random() * 2.8
      });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }

  function markImpact(attacker, target, amount = 12) {
    if (!attacker || !target) return;
    const dx = (target.px || target.x * TILE) - (attacker.px || attacker.x * TILE);
    const dy = (target.py || target.y * TILE) - (attacker.py || attacker.y * TILE);
    const len = Math.hypot(dx, dy) || 1;
    attacker.attackAnimTimer = IMPACT_TIMER_MAX;
    attacker.attackOffsetX = (dx / len) * amount;
    attacker.attackOffsetY = (dy / len) * amount;
    target.hitAnimTimer = IMPACT_TIMER_MAX;
    target.hitOffsetX = -(dx / len) * Math.max(4, amount * 0.45);
    target.hitOffsetY = -(dy / len) * Math.max(4, amount * 0.45);
  }

  function decayEntityImpact(entity, tick) {
    if (!entity) return;
    if (entity.attackAnimTimer > 0) entity.attackAnimTimer = Math.max(0, entity.attackAnimTimer - tick);
    if (entity.hitAnimTimer > 0) entity.hitAnimTimer = Math.max(0, entity.hitAnimTimer - tick);
  }

  function impactOffset(entity) {
    const attackT = Math.max(0, entity?.attackAnimTimer || 0) / IMPACT_TIMER_MAX;
    const hitT = Math.max(0, entity?.hitAnimTimer || 0) / IMPACT_TIMER_MAX;
    return {
      x: (entity?.attackOffsetX || 0) * attackT + (entity?.hitOffsetX || 0) * hitT,
      y: (entity?.attackOffsetY || 0) * attackT + (entity?.hitOffsetY || 0) * hitT
    };
  }

  function drawHitParticles() {
    const particles = ensureParticles();
    if (!particles.length || typeof ctx === 'undefined') return;
    const now = performance.now() / 1000;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age = now - p.bornAt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      const fade = 1 - p.age / p.life;
      const x = p.x + p.vx * p.age;
      const y = p.y + p.vy * p.age;
      ctx.globalAlpha = Math.max(0, fade) * 0.75;
      ctx.fillStyle = '#b9332d';
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.55 + fade * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function knockUnconscious(c, reason = 'Ferimento grave') {
    if (!c || c.isUnconscious) return;
    c.isUnconscious = true;
    c.health = Math.max(1, c.health || 1);
    c.energy = Math.min(c.energy || 0, 4);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = `${reason} — aguardando resgate`;
    c.statuses = Array.isArray(c.statuses) ? c.statuses : [];
    if (!c.statuses.includes('inconsciente')) c.statuses.push('inconsciente');
    if (typeof log === 'function') log(`${c.name} caiu inconsciente e precisa de resgate.`);
  }

  function wakeColonist(c, note = 'Recuperando') {
    if (!c) return;
    c.isUnconscious = false;
    c.health = Math.max(c.health || 1, 18);
    c.energy = Math.max(c.energy || 0, 18);
    c.statuses = (Array.isArray(c.statuses) ? c.statuses : []).filter((s) => s !== 'inconsciente');
    c.note = note;
  }

  function findRescueTarget(rescuer) {
    const colonists = Array.isArray(state?.colonists) ? state.colonists : [];
    return colonists
      .filter((c) => c?.id !== rescuer?.id && c.isUnconscious)
      .filter((c) => !colonists.some((o) => o?.task?.type === 'rescueAlly' && o.task.patientId === c.id))
      .sort((a, b) => tileDistance(rescuer, a) - tileDistance(rescuer, b))[0] || null;
  }

  function nearestMedicalDestination(c) {
    const objects = Array.isArray(state?.objects) ? state.objects : [];
    const candidates = objects.filter((o) => o?.type === 'med_station' || o?.type === 'bed');
    return candidates.sort((a, b) => {
      const rankA = a.type === 'med_station' ? 0 : 1;
      const rankB = b.type === 'med_station' ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return tileDistance(c, a) - tileDistance(c, b);
    })[0] || null;
  }

  function assignRescue(c, patient) {
    const destination = nearestMedicalDestination(patient || c);
    if (!destination) return false;
    const adj = (typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(destination.x, destination.y, c.x, c.y) : null) || { x: destination.x, y: destination.y };
    c.task = { type: 'rescueAlly', patientId: patient.id, stationId: destination.id, x: adj.x, y: adj.y };
    c.path = typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, destination) : [];
    c.work = 0;
    c.note = `Resgatando ${patient.name}`;
    return true;
  }

  function handleRescueTask(c, task, tick) {
    const patient = state?.colonists?.find((item) => item.id === task.patientId);
    const destination = state?.objects?.find((obj) => obj.id === task.stationId);
    if (!patient || !patient.isUnconscious || !destination) {
      c.task = null;
      c.work = 0;
      c.note = 'Ocioso';
      return;
    }
    c.work += tick * 1.15;
    c.note = `Carregando ${patient.name} para ${objectDefs[destination.type]?.name || 'abrigo'} ${Math.floor((c.work / 2.2) * 100)}%`;
    if (c.work < 2.2) return;

    patient.x = task.x;
    patient.y = task.y;
    patient.px = task.x * TILE + TILE / 2;
    patient.py = task.y * TILE + TILE / 2;
    if (destination.type === 'med_station' && state.resources?.medicine > 0) {
      state.resources.medicine -= 1;
      wakeColonist(patient, 'Recebendo tratamento na estação médica');
      patient.health = Math.max(patient.health, 32);
      log(`${c.name} levou ${patient.name} até a estação médica e usou 1 remédio.`);
    } else {
      wakeColonist(patient, destination.type === 'bed' ? 'Deitado na cama, recuperando' : 'Resgatado, recuperando');
      log(`${c.name} levou ${patient.name} para um local seguro.`);
    }
    c.task = null;
    c.work = 0;
    c.note = 'Resgate concluído';
  }

  function installSpawnAndDensityPatches() {
    if (window.HavenfallContext.spawnDensityPatched) return;

    if (window.mobSpawnConfig) {
      if (window.mobSpawnConfig.wolf) window.mobSpawnConfig.wolf.maxCount = Math.min(window.mobSpawnConfig.wolf.maxCount || 4, 3);
      if (window.mobSpawnConfig.spider) window.mobSpawnConfig.spider.maxCount = Math.min(window.mobSpawnConfig.spider.maxCount || 6, 4);
    }

    if (typeof canSpawnMob === 'function') {
      const nativeCanSpawnMob = canSpawnMob;
      canSpawnMob = function canSpawnMobWithDensity(type) {
        if (totalMobileCount() >= MAX_TOTAL_MOBILE_ENTITIES) return false;
        if (isHostileType(type) && hostileCount() >= MAX_HOSTILE_ENTITIES) return false;
        return nativeCanSpawnMob(type);
      };
      window.canSpawnMob = canSpawnMob;
    }

    if (typeof mobSpawnTile === 'function') {
      const nativeMobSpawnTile = mobSpawnTile;
      mobSpawnTile = function mobSpawnTileSafe(type) {
        const preferEdge = isHostileType(type);
        for (let i = 0; i < 80; i++) {
          const t = nativeMobSpawnTile(type);
          if (isSpawnTileAllowed(type, t)) return t;
        }
        return randomTileAwayFromColonists(type, preferEdge);
      };
    }

    if (typeof spawnMob === 'function') {
      const nativeSpawnMob = spawnMob;
      spawnMob = function spawnMobSafe(type, tile = null) {
        if (totalMobileCount() >= MAX_TOTAL_MOBILE_ENTITIES) return null;
        if (isHostileType(type) && hostileCount() >= MAX_HOSTILE_ENTITIES) return null;
        const chosen = tile && isSpawnTileAllowed(type, tile) ? tile : null;
        if (tile && !chosen) return null;
        return nativeSpawnMob(type, chosen);
      };
      window.spawnMob = spawnMob;
    }

    if (typeof spawnWolf === 'function') {
      spawnWolf = function spawnWolfSafe() {
        if (!state || !Array.isArray(state.wolves)) return null;
        if (totalMobileCount() >= MAX_TOTAL_MOBILE_ENTITIES || hostileCount() >= MAX_HOSTILE_ENTITIES) return null;
        const tile = randomTileAwayFromColonists('wolf', true) || randomTileAwayFromColonists('wolf', false);
        if (!tile) return null;
        const wolf = {
          id: typeof uid === 'function' ? uid() : `${Date.now()}_${Math.random()}`,
          x: tile.x,
          y: tile.y,
          px: tile.x * TILE + TILE / 2,
          py: tile.y * TILE + TILE / 2,
          anim: 0,
          dir: 'left',
          hp: 100,
          morale: 100,
          aggression: 1 + Math.random() * 0.25,
          state: 'hunting'
        };
        state.wolves.push(wolf);
        return wolf;
      };
      window.spawnWolf = spawnWolf;
    }

    window.HavenfallContext.spawnDensityPatched = true;
  }

  function installSimulationPatches() {
    if (window.HavenfallContext.simulationSafetyPatched) return;

    if (typeof updateMobsTick === 'function') {
      const nativeUpdateMobsTick = updateMobsTick;
      updateMobsTick = function updateMobsTickWithSeparation(dt) {
        nativeUpdateMobsTick(dt);
        const tick = (dt || 0) * (state?.speed || 1);
        for (const entity of mobileEntities()) decayEntityImpact(entity, tick);
        resolveMobileOverlap();
      };
      window.updateMobsTick = updateMobsTick;
    }

    if (typeof updateWorld === 'function') {
      const nativeUpdateWorld = updateWorld;
      updateWorld = function updateWorldWithColonySafety(dt) {
        nativeUpdateWorld(dt);
        const tick = (dt || 0) * (state?.speed || 1);
        for (const c of state?.colonists || []) decayEntityImpact(c, tick);
        resolveMobileOverlap();
      };
    }

    if (typeof updateColonist === 'function') {
      const nativeUpdateColonist = updateColonist;
      updateColonist = function updateColonistWithUnconsciousState(c, dt) {
        if (!c) return;
        if (c.isUnconscious) {
          c.task = null;
          c.path = [];
          c.work = 0;
          c.anim = (c.anim || 0) + (dt || 0) * (state?.speed || 1) * 0.2;
          c.x = Math.round((c.px - TILE / 2) / TILE);
          c.y = Math.round((c.py - TILE / 2) / TILE);
          c.note = c.note || 'Inconsciente — aguardando resgate';
          return;
        }
        nativeUpdateColonist(c, dt);
        if ((c.health || 0) <= 1) knockUnconscious(c);
      };
    }

    if (typeof assignAutoTask === 'function') {
      const nativeAssignAutoTask = assignAutoTask;
      assignAutoTask = function assignAutoTaskWithRescuePriority(c) {
        if (!c || c.isUnconscious) return false;
        const rescueTarget = findRescueTarget(c);
        if (rescueTarget && assignRescue(c, rescueTarget)) return true;
        return nativeAssignAutoTask(c);
      };
    }

    if (typeof handleTaskAtTarget === 'function') {
      const nativeHandleTaskAtTarget = handleTaskAtTarget;
      handleTaskAtTarget = function handleTaskAtTargetWithRescue(c, tick) {
        if (c?.task?.type === 'rescueAlly') return handleRescueTask(c, c.task, tick);
        return nativeHandleTaskAtTarget(c, tick);
      };
    }

    window.HavenfallContext.simulationSafetyPatched = true;
  }

  function installCombatFeedbackPatches() {
    if (window.HavenfallContext.combatFeedbackPatched) return;

    if (typeof handleCombatTask === 'function') {
      const nativeHandleCombatTask = handleCombatTask;
      handleCombatTask = function handleCombatTaskWithFeedback(c, task, tick) {
        const wolf = state?.wolves?.find((w) => w.id === task?.wolfId);
        const wolfBefore = wolf ? { hp: wolf.hp, px: wolf.px, py: wolf.py } : null;
        const healthBefore = c?.health;
        nativeHandleCombatTask(c, task, tick);
        if (wolfBefore && wolf && (wolf.hp || 0) < (wolfBefore.hp || 0)) {
          markImpact(c, wolf, 13);
          emitHitParticles(wolfBefore.px, wolfBefore.py, 8);
        }
        if (c && (c.health || 0) < (healthBefore || 0)) {
          if (wolf) markImpact(wolf, c, 10);
          emitHitParticles(c.px, c.py, 5);
          if ((c.health || 0) <= 1) knockUnconscious(c, 'Ataque recebido');
        }
      };
    }

    if (typeof handleHuntMobTask === 'function') {
      const nativeHandleHuntMobTask = handleHuntMobTask;
      handleHuntMobTask = function handleHuntMobTaskWithFeedback(c, task, tick) {
        const mob = state?.mobs?.find((m) => m.id === task?.mobId);
        const before = mob ? { hp: mob.hp, px: mob.px, py: mob.py } : null;
        nativeHandleHuntMobTask(c, task, tick);
        if (before && mob && (mob.hp || 0) < (before.hp || 0)) {
          markImpact(c, mob, mob.type === 'rabbit' ? 9 : 12);
          emitHitParticles(before.px, before.py, mob.type === 'rabbit' ? 4 : 7);
        }
      };
    }

    if (typeof updateWolves === 'function') {
      const nativeUpdateWolves = updateWolves;
      updateWolves = function updateWolvesWithFeedback(dt) {
        const before = new Map((state?.colonists || []).map((c) => [c.id, c.health]));
        nativeUpdateWolves(dt);
        for (const c of state?.colonists || []) {
          const prev = before.get(c.id);
          if (prev !== undefined && (c.health || 0) < prev && performance.now() - (c.lastHitParticleAt || 0) > 280) {
            c.lastHitParticleAt = performance.now();
            emitHitParticles(c.px, c.py, 3);
            if ((c.health || 0) <= 1) knockUnconscious(c, 'Ataque recebido');
          }
        }
      };
    }

    window.HavenfallContext.combatFeedbackPatched = true;
  }

  function installRendererPatches() {
    if (window.HavenfallContext.rendererCriticalPatched) return;

    if (typeof resizeGameCanvas === 'function' && typeof rendererLayoutCache !== 'undefined') {
      resizeGameCanvas = function resizeGameCanvasDynamicDpr(force = false) {
        const rect = canvas.getBoundingClientRect();
        const cssWidth = Math.max(320, Math.floor(rect.width || window.innerWidth));
        const cssHeight = Math.max(240, Math.floor(rect.height || window.innerHeight));
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
        rendererLayoutCache.canvasCssWidth = cssWidth;
        rendererLayoutCache.canvasCssHeight = cssHeight;
        const physicalWidth = Math.max(320, Math.round(cssWidth * dpr));
        const physicalHeight = Math.max(240, Math.round(cssHeight * dpr));
        if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
          canvas.width = physicalWidth;
          canvas.height = physicalHeight;
        }
        if (typeof measureRendererLayout === 'function') measureRendererLayout(force || true);
        viewTransform.scale = camera.zoom * dpr;
        if (typeof clampCamera === 'function') clampCamera();
        const safe = typeof cameraSafeViewport === 'function' ? cameraSafeViewport() : { height: physicalHeight };
        viewTransform.offsetX = physicalWidth / 2 - camera.x * viewTransform.scale;
        viewTransform.offsetY = safe.height / 2 - camera.y * viewTransform.scale;
      };
      window.resizeGameCanvas = resizeGameCanvas;
    }

    if (typeof drawColonist === 'function') {
      const nativeDrawColonist = drawColonist;
      drawColonist = function drawColonistWithDownedState(c) {
        if (!c?.isUnconscious) {
          const o = impactOffset(c);
          if (!o.x && !o.y) return nativeDrawColonist(c);
          ctx.save();
          ctx.translate(o.x, o.y);
          nativeDrawColonist(c);
          ctx.restore();
          return;
        }
        drawDownedColonist(c);
      };
    }

    if (typeof drawWolf === 'function') {
      const nativeDrawWolf = drawWolf;
      drawWolf = function drawWolfWithImpact(wolf) {
        const o = impactOffset(wolf);
        if (!o.x && !o.y) return nativeDrawWolf(wolf);
        ctx.save();
        ctx.translate(o.x, o.y);
        nativeDrawWolf(wolf);
        ctx.restore();
      };
    }

    if (typeof drawMob === 'function') {
      const nativeDrawMob = drawMob;
      drawMob = function drawMobWithImpact(mob) {
        const o = impactOffset(mob);
        if (!o.x && !o.y) return nativeDrawMob(mob);
        ctx.save();
        ctx.translate(o.x, o.y);
        nativeDrawMob(mob);
        ctx.restore();
      };
    }

    if (typeof draw === 'function') {
      const nativeDraw = draw;
      draw = function drawWithHitParticles() {
        nativeDraw();
        drawHitParticles();
      };
    }

    window.HavenfallContext.rendererCriticalPatched = true;
  }

  function drawDownedColonist(c) {
    const selected = c.id === selectedColonistId;
    if (selected) {
      ctx.save();
      ctx.fillStyle = 'rgba(231, 189, 88, .22)';
      ctx.strokeStyle = '#e7bd58';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.px, c.py + 19, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const img = images[`${c.sprite || 'colonistA'}_${c.dir || 'down'}_0`] || images[`${c.sprite || 'colonistA'}_down_0`];
    const o = impactOffset(c);
    ctx.save();
    ctx.translate(c.px + o.x, c.py + 24 + o.y);
    ctx.rotate(Math.PI / 2);
    if (img?.width && img?.height) {
      const scale = 0.48;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, -w / 2, -h, w, h);
    } else {
      ctx.fillStyle = '#d8c59b';
      ctx.fillRect(-16, -30, 32, 44);
    }
    ctx.restore();

    if (typeof drawTinyBars === 'function') drawTinyBars(c);
    if (typeof drawName === 'function') drawName(`${c.name} · inconsciente`, c.px, c.py - 38);
  }

  function installBuildPanelPatch() {
    if (window.HavenfallContext.buildPanelCardsPatched) return;
    const panel = document.getElementById('buildPanel');
    const grid = panel?.querySelector('.build-grid');
    if (!panel || !grid || typeof buildDefs === 'undefined') return;

    const categories = [
      { id: 'structures', label: 'Estruturas', items: ['wall', 'door', 'crate', 'crop'] },
      { id: 'furniture', label: 'Mobília', items: ['bed', 'campfire', 'bench', 'research_desk'] },
      { id: 'security', label: 'Segurança', items: ['forge', 'stove', 'med_station'] }
    ];
    const descriptions = {
      bed: 'Recuperação e descanso dos colonos.',
      campfire: 'Aquecimento e ponto inicial de abrigo.',
      crate: 'Organização do acampamento.',
      wall: 'Bloqueio simples para defesa e layout.',
      door: 'Passagem controlada entre paredes.',
      crop: 'Produção inicial de comida.',
      bench: 'Base para ferramentas e armas simples.',
      research_desk: 'Desbloqueia tecnologias da colônia.',
      forge: 'Produção metálica após pesquisa.',
      stove: 'Cozinha e melhora de comida.',
      med_station: 'Tratamento e resgate de colonos.'
    };
    const icon = { food: '🥩', wood: '🪵', stone: '🪨', metal: '🪙', medicine: '💊' };
    const categoryTabs = document.createElement('div');
    categoryTabs.className = 'build-category-tabs';
    categoryTabs.innerHTML = categories.map((cat, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-build-category="${cat.id}">${cat.label}</button>`).join('');

    const cardGrid = document.createElement('div');
    cardGrid.className = 'build-card-grid';
    cardGrid.innerHTML = categories.map((cat, index) => `
      <div class="build-category-page ${index === 0 ? 'active' : ''}" data-build-page="${cat.id}">
        ${cat.items.map((key) => {
          const def = buildDefs[key];
          if (!def) return '';
          const costs = Object.entries(def.cost || {}).map(([resource, value]) => `<span class="cost-badge">${icon[resource] || ''} ${resourceLabel?.(resource) || resource} x${value}</span>`).join('');
          const req = def.requires ? `<span class="cost-badge locked-badge">🔒 ${researchDefs?.[def.requires]?.label || def.requires}</span>` : '';
          return `<button type="button" class="build-card" data-build="${key}">
            <strong>${def.label}</strong>
            <small>${descriptions[key] || 'Construção disponível para a colônia.'}</small>
            <span class="build-card-costs">${costs || '<span class="cost-badge">sem custo</span>'}${req}</span>
          </button>`;
        }).join('')}
      </div>
    `).join('');

    grid.replaceWith(categoryTabs, cardGrid);
    categoryTabs.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-build-category]');
      if (!btn) return;
      const id = btn.dataset.buildCategory;
      categoryTabs.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === btn));
      cardGrid.querySelectorAll('[data-build-page]').forEach((page) => page.classList.toggle('active', page.dataset.buildPage === id));
    });
    window.HavenfallContext.buildPanelCardsPatched = true;
  }

  injectCssModules();
  installSpawnAndDensityPatches();
  installSimulationPatches();
  installCombatFeedbackPatches();
  installRendererPatches();
  installBuildPanelPatch();
})();
