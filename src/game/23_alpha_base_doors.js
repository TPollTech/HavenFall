'use strict';

function installAlphaDoorSystemPatch() {
  if (window.__havenfallAlphaDoorSystemInstalled) return;
  window.__havenfallAlphaDoorSystemInstalled = true;

  const DOOR_AUTO_CLOSE_SECONDS = 2.2;
  const DOOR_MAX_HP = 80;
  const ROTATABLE_TYPES = new Set(['door', 'bed']);
  const LINE_TYPES = new Set(['wall']);

  let alphaBuildOrientation = window.havenfallAlphaBuildOrientation || 'horizontal';
  let wallDrag = null;
  let suppressNextBuildClick = false;

  function setBuildOrientation(next) {
    alphaBuildOrientation = next === 'vertical' ? 'vertical' : 'horizontal';
    window.havenfallAlphaBuildOrientation = alphaBuildOrientation;
  }

  function toggleBuildOrientation() {
    setBuildOrientation(alphaBuildOrientation === 'horizontal' ? 'vertical' : 'horizontal');
    if (state && currentBuild) {
      const label = alphaBuildOrientation === 'horizontal' ? 'horizontal' : 'vertical';
      log(`Orientação de ${buildDefs[currentBuild]?.label || 'construção'}: ${label}.`);
    }
    updateUI(true);
  }

  function installDoorDefs() {
    objectDefs.door = objectDefs.door || {
      name: 'porta',
      img: 'door_wood',
      blocks: true,
      door: true,
      maxHp: DOOR_MAX_HP,
      autoClose: DOOR_AUTO_CLOSE_SECONDS,
      openableBy: ['colonist', 'humanoid'],
      breakableBy: ['large_mob']
    };
    objectDefs.door.blocks = true;
    objectDefs.door.door = true;
    objectDefs.door.img = 'door_wood';
    objectDefs.door.name = 'porta';
    objectDefs.door.maxHp = objectDefs.door.maxHp || DOOR_MAX_HP;
    objectDefs.door.autoClose = objectDefs.door.autoClose || DOOR_AUTO_CLOSE_SECONDS;

    buildDefs.door = buildDefs.door || {
      label: 'Porta',
      type: 'door',
      cost: { wood: 6, stone: 1 },
      work: 3.5
    };
  }

  function ensureDoorBuildButton() {
    const grid = document.querySelector('#buildPanel .build-grid');
    if (!grid || grid.querySelector('[data-build="door"]')) return;
    const btn = document.createElement('button');
    btn.dataset.build = 'door';
    btn.innerHTML = 'Porta<br><small>6 madeira + 1 pedra</small>';
    const wall = grid.querySelector('[data-build="wall"]');
    if (wall?.nextSibling) grid.insertBefore(btn, wall.nextSibling);
    else grid.appendChild(btn);
    btn.addEventListener('click', () => {
      currentBuild = 'door';
      updateUI(true);
    });
  }

  function isDoor(obj) {
    return !!obj && obj.type === 'door';
  }

  function isWallLikeObject(obj) {
    return !!obj && (obj.type === 'wall' || obj.type === 'door' || (obj.type === 'blueprint' && ['wall', 'door'].includes(obj.buildType)));
  }

  function wallLikeAt(x, y) {
    return isWallLikeObject(getObjectAt(x, y));
  }

  function inferWallOrientation(x, y, fallback = 'horizontal') {
    const horizontal = wallLikeAt(x - 1, y) || wallLikeAt(x + 1, y);
    const vertical = wallLikeAt(x, y - 1) || wallLikeAt(x, y + 1);
    if (vertical && !horizontal) return 'vertical';
    if (horizontal && !vertical) return 'horizontal';
    return fallback;
  }

  function inferDoorOrientation(x, y, fallback = alphaBuildOrientation) {
    return inferWallOrientation(x, y, fallback);
  }

  function ensureDoorState(door) {
    if (!isDoor(door)) return door;
    if (typeof door.open !== 'boolean') door.open = false;
    if (typeof door.openTimer !== 'number') door.openTimer = 0;
    if (typeof door.hp !== 'number') door.hp = objectDefs.door.maxHp || DOOR_MAX_HP;
    if (!door.orientation) door.orientation = inferDoorOrientation(door.x, door.y, alphaBuildOrientation);
    return door;
  }

  function orientationForBuild(buildKey, x, y, opts = {}) {
    const type = buildDefs[buildKey]?.type;
    if (opts.orientation) return opts.orientation;
    if (type === 'door') return inferDoorOrientation(x, y, alphaBuildOrientation);
    if (type === 'wall') return inferWallOrientation(x, y, alphaBuildOrientation);
    if (type === 'bed') return alphaBuildOrientation || 'vertical';
    return alphaBuildOrientation;
  }

  function latestBlueprintAt(buildKey, x, y, previousLength) {
    const candidates = state?.objects?.filter(o => o.type === 'blueprint' && o.buildType === buildKey && o.x === x && o.y === y) || [];
    if (!candidates.length) return null;
    return candidates[candidates.length - 1];
  }

  const previousPlaceBlueprint = placeBlueprint;
  placeBlueprint = function alphaOrientedPlaceBlueprint(buildKey, x, y, opts = {}) {
    const before = state?.objects?.length || 0;
    previousPlaceBlueprint(buildKey, x, y);
    if (!state?.objects || state.objects.length <= before) return;
    const bp = latestBlueprintAt(buildKey, x, y, before);
    if (!bp) return;
    bp.orientation = orientationForBuild(buildKey, x, y, opts);
    if (buildKey === 'door') {
      bp.hp = DOOR_MAX_HP;
      bp.open = false;
      bp.openTimer = 0;
    }
  };

  function openDoor(door, actor = null, silent = true) {
    ensureDoorState(door);
    if (!door) return;
    if (door.open) {
      door.openTimer = Math.max(door.openTimer || 0, DOOR_AUTO_CLOSE_SECONDS);
      return;
    }
    door.open = true;
    door.openTimer = DOOR_AUTO_CLOSE_SECONDS;
    door.lastOpenedBy = actor?.id || null;
    door.lastOpenedByName = actor?.name || null;
    door.anim = 1;
    if (!silent && actor) log(`${actor.name} abriu a porta.`);
  }

  function isDoorOccupiedOrAdjacent(door) {
    if (!state?.colonists) return false;
    return state.colonists.some(c => !c.dead && !c.downed && Math.abs(c.x - door.x) <= 1 && Math.abs(c.y - door.y) <= 1);
  }

  function closeDoor(door, silent = true) {
    ensureDoorState(door);
    if (!door || !door.open) return;
    if (isDoorOccupiedOrAdjacent(door)) {
      door.openTimer = Math.max(door.openTimer || 0, 0.45);
      return;
    }
    door.open = false;
    door.openTimer = 0;
    door.anim = 0;
    if (!silent) log('A porta fechou.');
  }

  function doorAwareBlockedForColonist(x, y, target = null) {
    if (!isInside(x, y)) return true;
    if (target && target.x === x && target.y === y) return false;
    const obj = getObjectAt(x, y);
    if (isDoor(obj)) return false;
    if (obj && obj.type !== 'blueprint' && objectDefs[obj.type]?.blocks) return true;
    return false;
  }

  const previousIsBlocked = isBlocked;
  isBlocked = function alphaDoorIsBlocked(x, y, target = null) {
    if (!isInside(x, y)) return true;
    if (target && target.x === x && target.y === y) return false;
    const obj = getObjectAt(x, y);
    if (isDoor(obj)) {
      ensureDoorState(obj);
      return !obj.open;
    }
    return previousIsBlocked(x, y, target);
  };

  const previousFindPath = findPath;
  findPath = function alphaDoorFindPath(startX, startY, endX, endY, target = null) {
    startX = Math.round(startX); startY = Math.round(startY);
    endX = Math.round(endX); endY = Math.round(endY);
    if (!isInside(endX, endY)) return [];

    const key = (x, y) => `${x},${y}`;
    const queue = [[startX, startY]];
    const came = new Map([[key(startX, startY), null]]);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === endX && y === endY) break;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);
        if (!came.has(k) && !doorAwareBlockedForColonist(nx, ny, target)) {
          came.set(k, [x, y]);
          queue.push([nx, ny]);
        }
      }
    }

    const endKey = key(endX, endY);
    if (!came.has(endKey)) return previousFindPath(startX, startY, endX, endY, target);
    const path = [];
    let cur = [endX, endY];
    while (cur) {
      path.push({ x: cur[0], y: cur[1] });
      cur = came.get(key(cur[0], cur[1]));
    }
    path.reverse();
    path.shift();
    return path;
  };

  const previousMoveAlongPath = moveAlongPath;
  moveAlongPath = function alphaDoorMoveAlongPath(c, tick) {
    const next = c?.path?.[0];
    if (next) {
      const door = getObjectAt(next.x, next.y);
      if (isDoor(door)) {
        openDoor(door, c, true);
        c.note = c.note && c.note !== 'Ocioso' ? c.note : 'Abrindo porta';
      }
    }
    const currentDoor = getObjectAt(c.x, c.y);
    if (isDoor(currentDoor)) openDoor(currentDoor, c, true);
    previousMoveAlongPath(c, tick);
  };

  function doorBlocksSight(x, y) {
    const obj = getObjectAt(x, y);
    if (obj?.type === 'wall') return true;
    if (isDoor(obj)) {
      ensureDoorState(obj);
      return !obj.open;
    }
    return false;
  }

  function lineOfSightDoorAware(aPx, aPy, bPx, bPy) {
    const x0 = Math.round((aPx - TILE / 2) / TILE);
    const y0 = Math.round((aPy - TILE / 2) / TILE);
    const x1 = Math.round((bPx - TILE / 2) / TILE);
    const y1 = Math.round((bPy - TILE / 2) / TILE);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 1; i < steps; i++) {
      const x = Math.round(x0 + (x1 - x0) * (i / steps));
      const y = Math.round(y0 + (y1 - y0) * (i / steps));
      if (!isInside(x, y)) return false;
      if (doorBlocksSight(x, y)) return false;
    }
    return true;
  }

  function mobBlockedAt(x, y, mob = null) {
    if (!isInside(x, y)) return true;
    const obj = getObjectAt(x, y);
    if (isDoor(obj)) {
      ensureDoorState(obj);
      if (obj.open) return false;
      if (mob?.canOpenDoors || mob?.kind === 'humanoid') return false;
      return true;
    }
    if (obj?.type === 'wall') return true;
    return previousIsBlocked(x, y, null);
  }

  function nearestDoorBetween(aPx, aPy, bPx, bPy) {
    const x0 = Math.round((aPx - TILE / 2) / TILE);
    const y0 = Math.round((aPy - TILE / 2) / TILE);
    const x1 = Math.round((bPx - TILE / 2) / TILE);
    const y1 = Math.round((bPy - TILE / 2) / TILE);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 1; i < steps; i++) {
      const x = Math.round(x0 + (x1 - x0) * (i / steps));
      const y = Math.round(y0 + (y1 - y0) * (i / steps));
      const obj = getObjectAt(x, y);
      if (isDoor(obj)) return obj;
    }
    return null;
  }

  function damageDoor(door, amount, sourceLabel = 'ameaça') {
    ensureDoorState(door);
    door.hp = clamp((door.hp ?? DOOR_MAX_HP) - amount, 0, DOOR_MAX_HP);
    door.hitFlash = 0.25;
    if (door.hp <= 0) {
      state.objects = state.objects.filter(o => o.id !== door.id);
      log(`${sourceLabel} destruiu uma porta.`);
      return true;
    }
    return false;
  }

  function canWolfTargetColonist(c) {
    return !!c && !c.dead && !c.downed && !c.carriedBy && (c.health ?? 100) > 0;
  }

  function moveWolfTowardDoorAware(w, tx, ty, speed, tick) {
    const dx = tx - w.px;
    const dy = ty - w.py;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 3) return true;
    const nx = w.px + dx / len * speed * tick;
    const ny = w.py + dy / len * speed * tick;
    const tileX = Math.round((nx - TILE / 2) / TILE);
    const tileY = Math.round((ny - TILE / 2) / TILE);
    const blocker = getObjectAt(tileX, tileY);

    if (isDoor(blocker)) {
      ensureDoorState(blocker);
      if (!blocker.open) {
        if (w.canBreakDoors || w.size === 'large' || w.kind === 'large_mob') {
          w.doorAttackWork = (w.doorAttackWork || 0) + tick;
          if (w.doorAttackWork >= 1) {
            w.doorAttackWork = 0;
            damageDoor(blocker, 12 + (w.aggression || 1) * 5, 'Uma criatura grande');
          }
          w.state = 'breaking_door';
        } else {
          w.state = 'blocked_by_door';
        }
        return false;
      }
    }

    if (!mobBlockedAt(tileX, tileY, w)) {
      w.px = nx;
      w.py = ny;
    }
    w.dir = dx > 0 ? 'right' : 'left';
    return false;
  }

  function chooseDoorAwareWanderTarget(w) {
    const radius = 4;
    const hx = Math.round((w.homePx - TILE / 2) / TILE);
    const hy = Math.round((w.homePy - TILE / 2) / TILE);
    for (let tries = 0; tries < 12; tries++) {
      const x = clamp(Math.round(hx + (Math.random() * 2 - 1) * radius), 1, getWorldCols() - 2);
      const y = clamp(Math.round(hy + (Math.random() * 2 - 1) * radius), 1, getWorldRows() - 2);
      if (!mobBlockedAt(x, y, w)) return { x, y };
    }
    return { x: hx, y: hy };
  }

  updateWolves = function alphaDoorUpdateWolves(dt) {
    if (!state || state.gameOver || !state.wolves) return;
    const WOLF_VIEW_TILES = 6.5;
    const WOLF_MEMORY_SECONDS = 4.5;
    const WOLF_LEASH_TILES = 10;
    const WOLF_WANDER_SPEED = 16;
    const WOLF_CHASE_SPEED = 28;
    const WOLF_ATTACK_RADIUS = 28;

    for (const w of state.wolves) {
      ensureWolfState(w);
      if (typeof w.homePx !== 'number') w.homePx = w.px;
      if (typeof w.homePy !== 'number') w.homePy = w.py;
      if (typeof w.alertTimer !== 'number') w.alertTimer = 0;
      if (typeof w.targetColonistId !== 'number') w.targetColonistId = 0;
      if (typeof w.wanderTimer !== 'number') w.wanderTimer = 0;

      const tick = dt * state.speed;
      w.anim += tick;
      w.alertTimer = Math.max(0, w.alertTimer - tick);
      w.wanderTimer = Math.max(0, w.wanderTimer - tick);

      const seen = (state.colonists || [])
        .filter(canWolfTargetColonist)
        .map(c => ({ c, d: Math.hypot(w.px - c.px, w.py - c.py) / TILE }))
        .filter(hit => hit.d <= WOLF_VIEW_TILES * (w.aggression || 1) && (hit.d <= 2.2 || lineOfSightDoorAware(w.px, w.py, hit.c.px, hit.c.py)))
        .sort((a, b) => a.d - b.d)[0]?.c || null;

      if (seen) {
        w.targetColonistId = seen.id;
        w.alertTimer = WOLF_MEMORY_SECONDS;
      }

      let target = state.colonists.find(c => c.id === w.targetColonistId && canWolfTargetColonist(c));
      const leash = Math.hypot(w.px - w.homePx, w.py - w.homePy) / TILE;
      if (!target || w.alertTimer <= 0 || leash > WOLF_LEASH_TILES) {
        target = null;
        w.targetColonistId = 0;
        w.alertTimer = 0;
      }

      if (target) {
        const close = Math.hypot(target.px - w.px, target.py - w.py);
        const clearAttackLine = lineOfSightDoorAware(w.px, w.py, target.px, target.py);
        moveWolfTowardDoorAware(w, target.px, target.py, WOLF_CHASE_SPEED * (w.aggression || 1), tick);
        if (close < WOLF_ATTACK_RADIUS && clearAttackLine) {
          const fighting = target.task?.type === 'combat' && target.task?.wolfId === w.id;
          const armor = equipmentDefense(target);
          const pressure = fighting ? 0.75 : 1.45;
          target.health = clamp(target.health - tick * pressure * (1 - armor), -4, 100);
          target.mood = clamp(target.mood - tick * (fighting ? 0.30 : 0.65), 0, 100);
          target.note = fighting ? target.note : 'Ameaçado por lobo';
          if (target.health <= 0) {
            if (typeof window.havenfallDownColonist === 'function') window.havenfallDownColonist(target, 'foi incapacitado durante o ataque');
            else { target.dead = true; target.task = null; target.path = []; }
          }
        } else if (!clearAttackLine) {
          const door = nearestDoorBetween(w.px, w.py, target.px, target.py);
          if (door && (w.canBreakDoors || w.size === 'large' || w.kind === 'large_mob')) damageDoor(door, tick * 9, 'Uma criatura grande');
        }
      } else {
        if (!w.target || w.wanderTimer <= 0) {
          w.target = chooseDoorAwareWanderTarget(w);
          w.wanderTimer = 2.5 + Math.random() * 4;
        }
        const tx = w.target.x * TILE + TILE / 2;
        const ty = w.target.y * TILE + TILE / 2;
        if (moveWolfTowardDoorAware(w, tx, ty, WOLF_WANDER_SPEED, tick)) w.target = null;
      }
      w.x = Math.round((w.px - TILE / 2) / TILE);
      w.y = Math.round((w.py - TILE / 2) / TILE);
    }
  };

  function roundedRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawProceduralWall(obj, blueprint = false) {
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2 + 15;
    const orientation = obj.orientation || inferWallOrientation(obj.x, obj.y, 'horizontal');
    const len = TILE - 8;
    const thick = 13;
    const w = orientation === 'horizontal' ? len : thick;
    const h = orientation === 'horizontal' ? thick : len;
    ctx.save();
    ctx.globalAlpha = blueprint ? 0.42 : 1;
    ctx.translate(cx, cy);
    ctx.fillStyle = '#667072';
    ctx.strokeStyle = '#30383a';
    ctx.lineWidth = 2;
    roundedRectPath(-w / 2, -h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,238,232,.24)';
    ctx.lineWidth = 1;
    const cuts = orientation === 'horizontal' ? 3 : 4;
    for (let i = 1; i < cuts; i++) {
      ctx.beginPath();
      if (orientation === 'horizontal') {
        const x = -w / 2 + (w / cuts) * i;
        ctx.moveTo(x, -h / 2 + 2);
        ctx.lineTo(x, h / 2 - 2);
      } else {
        const y = -h / 2 + (h / cuts) * i;
        ctx.moveTo(-w / 2 + 2, y);
        ctx.lineTo(w / 2 - 2, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProceduralDoor(obj, blueprint = false) {
    ensureDoorState(obj);
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2 + 15;
    const closed = obj.orientation || 'horizontal';
    const drawOrientation = obj.open ? (closed === 'horizontal' ? 'vertical' : 'horizontal') : closed;
    const len = TILE - 16;
    const thick = 9;
    const w = drawOrientation === 'horizontal' ? len : thick;
    const h = drawOrientation === 'horizontal' ? thick : len;
    const hpRatio = clamp((obj.hp ?? DOOR_MAX_HP) / DOOR_MAX_HP, 0, 1);

    ctx.save();
    ctx.globalAlpha = blueprint ? 0.46 : (obj.open ? 0.92 : 1);
    ctx.translate(cx, cy);
    ctx.fillStyle = obj.open ? '#936536' : '#7a4e28';
    ctx.strokeStyle = '#39210f';
    ctx.lineWidth = 2;
    roundedRectPath(-w / 2, -h / 2, w, h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e1bc72';
    if (drawOrientation === 'horizontal') ctx.fillRect(w / 2 - 10, -2, 3, 4);
    else ctx.fillRect(-2, h / 2 - 10, 4, 3);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = obj.open ? 'rgba(155,211,106,.15)' : 'rgba(227,169,63,.10)';
    ctx.strokeStyle = obj.open ? 'rgba(155,211,106,.34)' : 'rgba(227,169,63,.26)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 3, obj.open ? 18 : 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (hpRatio < 0.98 && !blueprint) drawProgress(cx, cy - 23, hpRatio, '#ef796d');
  }

  const previousDrawObject = drawObject;
  drawObject = function alphaDoorDrawObject(obj) {
    if (obj?.type === 'blueprint' && obj.buildType === 'wall') {
      drawProceduralWall(obj, true);
      const def = buildDefs[obj.buildType];
      drawProgress(obj.x * TILE + TILE / 2, obj.y * TILE + 8, (obj.progress || 0) / def.work, '#9bd36a');
      return;
    }
    if (obj?.type === 'blueprint' && obj.buildType === 'door') {
      drawProceduralDoor({ ...obj, type: 'door', open: false, hp: DOOR_MAX_HP }, true);
      const def = buildDefs[obj.buildType];
      drawProgress(obj.x * TILE + TILE / 2, obj.y * TILE + 8, (obj.progress || 0) / def.work, '#9bd36a');
      return;
    }
    if (obj?.type === 'wall') {
      drawProceduralWall(obj, false);
      return;
    }
    if (isDoor(obj)) {
      drawProceduralDoor(obj, false);
      return;
    }
    previousDrawObject(obj);
  };

  function bedForSleepingColonist(c) {
    const bedId = c?.task?.bedId || c?.bedId;
    if (!bedId) return null;
    return state?.objects?.find(o => o.id === bedId && o.type === 'bed') || null;
  }

  function drawLyingColonistForBed(c, bed) {
    const pos = bed ? { x: bed.x * TILE + TILE / 2, y: bed.y * TILE + TILE / 2 + 8 } : { x: c.px, y: c.py };
    const vertical = (bed?.orientation || 'vertical') === 'vertical';
    const img = images[`${c.sprite || 'colonistA'}_down_0`] || images.colonistA_down_0;
    ctx.save();
    ctx.translate(pos.x, pos.y + 18);
    if (!vertical) ctx.rotate(Math.PI / 2);
    drawAsset(img, 0, 0, 0.46, 0.5, 0.5, false);
    ctx.restore();

    ctx.save();
    ctx.font = '900 10px system-ui';
    ctx.textAlign = 'center';
    const text = c.task?.type === 'recoverBed' ? 'recuperando' : 'dormindo';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundedRectPath(pos.x - w / 2, pos.y - 30, w, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#c9eaff';
    ctx.fillText(text, pos.x, pos.y - 19);
    ctx.restore();
  }

  const previousDrawColonist = drawColonist;
  drawColonist = function alphaDoorDrawColonist(c) {
    const sleeping = c?.alphaState === 'sleep' || c?.task?.type === 'sleep' || c?.task?.type === 'recoverBed';
    if (sleeping) {
      const bed = bedForSleepingColonist(c);
      drawLyingColonistForBed(c, bed);
      drawTinyBars(c);
      return;
    }
    previousDrawColonist(c);
  };

  function drawBuildGhostTile(buildKey, tile, orientation, alpha = 0.42) {
    const fake = { x: tile.x, y: tile.y, orientation, type: buildDefs[buildKey]?.type || buildKey, buildType: buildKey, open: false, hp: DOOR_MAX_HP };
    ctx.save();
    ctx.globalAlpha = canPlace(buildDefs[buildKey]?.type || buildKey, tile.x, tile.y) ? alpha : 0.18;
    if (buildKey === 'wall') drawProceduralWall(fake, true);
    else if (buildKey === 'door') drawProceduralDoor(fake, true);
    else previousDrawObject(fake);
    ctx.restore();
  }

  function lineTiles(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const tiles = [];
    if (horizontal) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (let x = minX; x <= maxX; x++) tiles.push({ x, y: start.y, orientation: 'horizontal' });
    } else {
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      for (let y = minY; y <= maxY; y++) tiles.push({ x: start.x, y, orientation: 'vertical' });
    }
    return tiles;
  }

  function placeBlueprintLine(buildKey, start, end) {
    const tiles = lineTiles(start, end);
    let placed = 0;
    for (const tile of tiles) {
      const before = state.objects.length;
      placeBlueprint(buildKey, tile.x, tile.y, { orientation: tile.orientation });
      if (state.objects.length > before) placed++;
    }
    if (placed > 1) log(`${placed} segmentos de ${buildDefs[buildKey]?.label || 'construção'} posicionados.`);
  }

  function installWallDragInput() {
    if (window.__havenfallWallDragInputInstalled) return;
    window.__havenfallWallDragInputInstalled = true;

    canvas.addEventListener('mousedown', event => {
      if (event.button !== 0 || appScreen !== SCREEN.PLAYING || !state || !currentBuild) return;
      const type = buildDefs[currentBuild]?.type;
      if (!LINE_TYPES.has(type)) return;
      const tile = tileFromEvent(event);
      if (!tile || !isInside(tile.x, tile.y)) return;
      wallDrag = { buildKey: currentBuild, start: tile, end: tile };
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    canvas.addEventListener('mousemove', event => {
      if (!wallDrag) return;
      const tile = tileFromEvent(event);
      if (!tile || !isInside(tile.x, tile.y)) return;
      wallDrag.end = tile;
      event.preventDefault();
    }, true);

    canvas.addEventListener('mouseup', event => {
      if (event.button !== 0 || !wallDrag) return;
      const drag = wallDrag;
      wallDrag = null;
      suppressNextBuildClick = true;
      suppressNextClick = true;
      placeBlueprintLine(drag.buildKey, drag.start, drag.end);
      updateUI(true);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    canvas.addEventListener('click', event => {
      if (!suppressNextBuildClick) return;
      suppressNextBuildClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  const previousDrawBuildPreview = drawBuildPreview;
  drawBuildPreview = function alphaDoorBuildPreview() {
    if (wallDrag) {
      for (const tile of lineTiles(wallDrag.start, wallDrag.end)) drawBuildGhostTile(wallDrag.buildKey, tile, tile.orientation, 0.48);
      return;
    }
    if (currentBuild === 'door' && mouseTile && isInside(mouseTile.x, mouseTile.y)) {
      drawBuildGhostTile('door', mouseTile, inferDoorOrientation(mouseTile.x, mouseTile.y, alphaBuildOrientation), 0.48);
      return;
    }
    previousDrawBuildPreview();
  };

  function currentBuildType() {
    return buildDefs[currentBuild]?.type || null;
  }

  function refreshBuildOrientationStatus() {
    if (!dom.buildStatus || !currentBuild) return;
    const type = currentBuildType();
    if (type === 'door' || type === 'bed') {
      dom.buildStatus.innerHTML = `Construindo: ${buildDefs[currentBuild]?.label}. <span class="wall-orientation-pill">R: ${alphaBuildOrientation}</span>`;
    } else if (type === 'wall') {
      dom.buildStatus.innerHTML = `Construindo: Parede. Clique e arraste para criar uma linha. <span class="wall-orientation-pill">Arrasto: linha horizontal/vertical</span>`;
    }
  }

  function installRotationShortcut() {
    if (window.__havenfallBuildRotationShortcutInstalled) return;
    window.__havenfallBuildRotationShortcutInstalled = true;
    window.addEventListener('keydown', event => {
      if (appScreen !== SCREEN.PLAYING || !currentBuild) return;
      const type = currentBuildType();
      if (!ROTATABLE_TYPES.has(type)) return;
      if (event.code !== 'KeyR') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleBuildOrientation();
    }, true);
  }

  const previousMakeContextActions = makeContextActions;
  makeContextActions = function alphaDoorContextActions(c, target, tile) {
    const actions = previousMakeContextActions(c, target, tile);
    const door = target?.kind === 'object' && isDoor(target.obj) ? target.obj : null;
    if (!door) return actions;
    ensureDoorState(door);
    actions.unshift({
      label: door.open ? 'Fechar porta' : 'Abrir porta',
      hint: door.open ? 'fecha se não houver colono passando' : 'abre manualmente por alguns segundos',
      run: () => door.open ? closeDoor(door, false) : openDoor(door, c, false)
    });
    return actions;
  };

  const previousUpdateWorld = updateWorld;
  updateWorld = function alphaDoorUpdateWorld(dt) {
    installDoorDefs();
    ensureDoorBuildButton();
    installWallDragInput();
    installRotationShortcut();
    if (state?.objects) {
      for (const obj of state.objects) {
        if (obj.type === 'blueprint' && ['wall', 'door', 'bed'].includes(obj.buildType) && !obj.orientation) {
          obj.orientation = orientationForBuild(obj.buildType, obj.x, obj.y);
        }
        if (obj.type === 'bed' && !obj.orientation) obj.orientation = 'vertical';
        if (obj.type === 'wall' && !obj.orientation) obj.orientation = inferWallOrientation(obj.x, obj.y, 'horizontal');
        if (isDoor(obj)) {
          ensureDoorState(obj);
          if (obj.open) {
            obj.openTimer = Math.max(0, (obj.openTimer || 0) - dt * (state.speed || 1));
            if (obj.openTimer <= 0) closeDoor(obj, true);
          }
          if (obj.hitFlash > 0) obj.hitFlash = Math.max(0, obj.hitFlash - dt * (state.speed || 1));
        }
      }
    }
    previousUpdateWorld(dt);
  };

  const previousUpdateUI = updateUI;
  updateUI = function alphaDoorUpdateUI(force = false) {
    installDoorDefs();
    ensureDoorBuildButton();
    installWallDragInput();
    installRotationShortcut();
    previousUpdateUI(force);
    refreshBuildOrientationStatus();
  };

  const previousStartNewGame = startNewGame;
  startNewGame = function alphaDoorStartNewGame(config, selectedColonists) {
    installDoorDefs();
    previousStartNewGame(config, selectedColonists);
    ensureDoorBuildButton();
    installWallDragInput();
    installRotationShortcut();
  };

  installDoorDefs();
  ensureDoorBuildButton();
  installWallDragInput();
  installRotationShortcut();

  window.havenfallOpenDoor = openDoor;
  window.havenfallCloseDoor = closeDoor;
  window.havenfallAlphaToggleBuildOrientation = toggleBuildOrientation;
}

if (typeof window !== 'undefined' && typeof updateWorld === 'function') {
  installAlphaDoorSystemPatch();
}
