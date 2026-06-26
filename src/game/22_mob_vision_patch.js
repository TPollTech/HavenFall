'use strict';

function installMobVisionPatch() {
  const WOLF_VIEW_TILES = 6.5;
  const WOLF_MEMORY_SECONDS = 4.5;
  const WOLF_LEASH_TILES = 10;
  const WOLF_WANDER_SPEED = 16;
  const WOLF_CHASE_SPEED = 28;
  const WOLF_ATTACK_RADIUS = 28;

  function isAlive(c) {
    return !!c && !c.dead && (c.health ?? 100) > 0;
  }

  function ensureWolfAi(w) {
    ensureWolfState(w);
    if (typeof w.homePx !== 'number') w.homePx = w.px;
    if (typeof w.homePy !== 'number') w.homePy = w.py;
    if (typeof w.alertTimer !== 'number') w.alertTimer = 0;
    if (typeof w.targetColonistId !== 'number') w.targetColonistId = 0;
    if (typeof w.wanderTimer !== 'number') w.wanderTimer = 0;
  }

  function tileDistancePx(aPx, aPy, bPx, bPy) {
    return Math.hypot(aPx - bPx, aPy - bPy) / TILE;
  }

  function hasLineOfSight(w, c) {
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
      if (obj && ['wall', 'door'].includes(obj.type)) return false;
    }
    return true;
  }

  function visibleColonistFor(w) {
    const viewTiles = WOLF_VIEW_TILES * (w.aggression || 1);
    return (state.colonists || [])
      .filter(isAlive)
      .map(c => ({ c, d: tileDistancePx(w.px, w.py, c.px, c.py) }))
      .filter(hit => hit.d <= viewTiles && (hit.d <= 2.2 || hasLineOfSight(w, hit.c)))
      .sort((a, b) => a.d - b.d)[0]?.c || null;
  }

  function moveWolfToward(w, tx, ty, speed, tick) {
    const dx = tx - w.px;
    const dy = ty - w.py;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 3) return true;
    w.px += dx / len * speed * tick;
    w.py += dy / len * speed * tick;
    w.dir = dx > 0 ? 'right' : 'left';
    return false;
  }

  function chooseWanderTarget(w) {
    const radius = 4;
    const hx = Math.round((w.homePx - TILE / 2) / TILE);
    const hy = Math.round((w.homePy - TILE / 2) / TILE);
    for (let tries = 0; tries < 12; tries++) {
      const x = clamp(Math.round(hx + (Math.random() * 2 - 1) * radius), 1, getWorldCols() - 2);
      const y = clamp(Math.round(hy + (Math.random() * 2 - 1) * radius), 1, getWorldRows() - 2);
      if (!isBlocked(x, y)) return { x, y };
    }
    return { x: hx, y: hy };
  }

  updateWolves = function visionAwareUpdateWolves(dt) {
    if (!state || state.gameOver) return;

    for (const w of state.wolves) {
      ensureWolfAi(w);
      const tick = dt * state.speed;
      w.anim += tick;
      w.alertTimer = Math.max(0, w.alertTimer - tick);
      w.wanderTimer = Math.max(0, w.wanderTimer - tick);

      const seen = visibleColonistFor(w);
      if (seen) {
        w.targetColonistId = seen.id;
        w.alertTimer = WOLF_MEMORY_SECONDS;
      }

      let target = state.colonists.find(c => c.id === w.targetColonistId && isAlive(c));
      const leash = tileDistancePx(w.px, w.py, w.homePx, w.homePy);
      if (!target || w.alertTimer <= 0 || leash > WOLF_LEASH_TILES) {
        target = null;
        w.targetColonistId = 0;
        w.alertTimer = 0;
      }

      if (target) {
        const close = Math.hypot(target.px - w.px, target.py - w.py);
        moveWolfToward(w, target.px, target.py, WOLF_CHASE_SPEED * (w.aggression || 1), tick);

        if (close < WOLF_ATTACK_RADIUS) {
          const fighting = target.task?.type === 'combat' && target.task?.wolfId === w.id;
          const armor = equipmentDefense(target);
          const pressure = fighting ? 0.85 : 1.65;
          target.health = clamp(target.health - tick * pressure * (1 - armor), 0, 100);
          target.mood = clamp(target.mood - tick * (fighting ? 0.35 : 0.75), 0, 100);
          target.note = fighting ? target.note : 'Ameaçado por lobo';
          if (target.health <= 0) {
            target.dead = true;
            target.note = 'Morto';
            target.task = null;
            target.path = [];
            if (typeof window.havenfallCheckGameOver === 'function') window.havenfallCheckGameOver();
          }
        }
      } else {
        if (!w.target || w.wanderTimer <= 0) {
          w.target = chooseWanderTarget(w);
          w.wanderTimer = 2.5 + Math.random() * 4;
        }
        const tx = w.target.x * TILE + TILE / 2;
        const ty = w.target.y * TILE + TILE / 2;
        if (moveWolfToward(w, tx, ty, WOLF_WANDER_SPEED, tick)) w.target = null;
      }

      w.x = Math.round((w.px - TILE / 2) / TILE);
      w.y = Math.round((w.py - TILE / 2) / TILE);
    }
  };
}
