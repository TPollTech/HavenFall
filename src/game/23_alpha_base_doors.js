'use strict';

function installAlphaDoorSystemPatch() {
  if (window.__havenfallAlphaDoorSystemInstalled) return;
  window.__havenfallAlphaDoorSystemInstalled = true;

  const DOOR_AUTO_CLOSE_SECONDS = 2.2;
  const DOOR_MAX_HP = 80;

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
    objectDefs.door.img = objectDefs.door.img || 'door_wood';
    objectDefs.door.name = objectDefs.door.name || 'porta';
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

  function ensureDoorState(door) {
    if (!isDoor(door)) return door;
    if (typeof door.open !== 'boolean') door.open = false;
    if (typeof door.openTimer !== 'number') door.openTimer = 0;
    if (typeof door.hp !== 'number') door.hp = objectDefs.door.maxHp || DOOR_MAX_HP;
    if (!door.orientation) door.orientation = guessDoorOrientation(door);
    return door;
  }

  function wallLikeAt(x, y) {
    const obj = getObjectAt(x, y);
    return !!obj && (obj.type === 'wall' || obj.type === 'door' || (obj.type === 'blueprint' && ['wall', 'door'].includes(obj.buildType)));
  }

  function guessDoorOrientation(door) {
    const horizontal = wallLikeAt(door.x - 1, door.y) || wallLikeAt(door.x + 1, door.y);
    const vertical = wallLikeAt(door.x, door.y - 1) || wallLikeAt(door.x, door.y + 1);
    if (vertical && !horizontal) return 'vertical';
    return 'horizontal';
  }

  function openDoor(door, actor = null, silent = true) {
    ensureDoorState(door);
    if (!door || door.open) {
      if (door) door.openTimer = Math.max(door.openTimer || 0, DOOR_AUTO_CLOSE_SECONDS);
      return;
    }
    door.open = true;
    door.openTimer = DOOR_AUTO_CLOSE_SECONDS;
    door.lastOpenedBy = actor?.id || null;
    door.lastOpenedByName = actor?.name || null;
    door.anim = 1;
    if (!silent && actor) log(`${actor.name} abriu a porta.`);
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

  function isDoorOccupiedOrAdjacent(door) {
    if (!state?.colonists) return false;
    return state.colonists.some(c => !c.dead && !c.downed && Math.abs(c.x - door.x) <= 1 && Math.abs(c.y - door.y) <= 1);
  }

  function closedDoorAt(x, y) {
    const obj = getObjectAt(x, y);
    if (!isDoor(obj)) return null;
    ensureDoorState(obj);
    return obj.open ? null : obj;
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
      const name = objectDefs.door.name;
      state.objects = state.objects.filter(o => o.id !== door.id);
      log(`${sourceLabel} destruiu uma ${name}.`);
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

  const previousUpdateWolves = updateWolves;
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
          if (typeof setAlphaState === 'function') setAlphaState(target, fighting ? 'attack_melee' : 'hurt');
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

  const previousMakeContextActions = makeContextActions;
  makeContextActions = function alphaDoorContextActions(c, target, tile) {
    const actions = previousMakeContextActions(c, target, tile);
    const door = target?.kind === 'object' && isDoor(target.obj) ? target.obj : null;
    if (!door) return actions;
    ensureDoorState(door);
    actions.unshift({
      label: door.open ? 'Fechar porta' : 'Abrir porta',
      hint: door.open ? 'fecha se não houver colono passando' : 'abre manualmente por alguns segundos',
      run: () => {
        if (door.open) closeDoor(door, false);
        else openDoor(door, c, false);
      }
    });
    return actions;
  };

  const previousDrawObject = drawObject;
  drawObject = function alphaDoorDrawObject(obj) {
    if (!isDoor(obj)) return previousDrawObject(obj);
    ensureDoorState(obj);
    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2;
    const vertical = obj.orientation === 'vertical';
    const openAngle = obj.open ? -Math.PI / 3.2 : 0;
    const hpRatio = clamp((obj.hp ?? DOOR_MAX_HP) / DOOR_MAX_HP, 0, 1);

    ctx.save();
    ctx.translate(cx, cy + 16);
    if (vertical) ctx.rotate(Math.PI / 2);
    if (obj.open) ctx.rotate(openAngle);
    ctx.globalAlpha = obj.open ? 0.84 : 1;
    drawAsset(images.door_wood || images.wall_stone, 0, 0, obj.open ? 0.58 : 0.66, 0.5, 0.5, false);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = obj.open ? 'rgba(155,211,106,.16)' : 'rgba(227,169,63,.12)';
    ctx.strokeStyle = obj.open ? 'rgba(155,211,106,.40)' : 'rgba(227,169,63,.34)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 18, obj.open ? 24 : 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (hpRatio < 0.98) drawProgress(cx, cy - 24, hpRatio, '#ef796d');
  };

  const previousDrawBuildPreview = drawBuildPreview;
  drawBuildPreview = function alphaDoorBuildPreview() {
    if (currentBuild !== 'door') return previousDrawBuildPreview();
    if (!mouseTile || !isInside(mouseTile.x, mouseTile.y)) return;
    const can = canPlace('door', mouseTile.x, mouseTile.y);
    const cx = mouseTile.x * TILE + TILE / 2;
    const cy = mouseTile.y * TILE + TILE / 2;
    const fake = { x: mouseTile.x, y: mouseTile.y, type: 'door', open: false, hp: DOOR_MAX_HP };
    fake.orientation = guessDoorOrientation(fake);
    ctx.save();
    ctx.globalAlpha = can ? 0.58 : 0.26;
    drawAsset(images.door_wood || images.wall_stone, cx, cy + 16, 0.66, 0.5, 0.5, false);
    ctx.restore();
  };

  const previousUpdateWorld = updateWorld;
  updateWorld = function alphaDoorUpdateWorld(dt) {
    installDoorDefs();
    ensureDoorBuildButton();
    if (state?.objects) {
      for (const obj of state.objects) {
        if (isDoor(obj)) {
          ensureDoorState(obj);
          obj.orientation = guessDoorOrientation(obj);
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
    previousUpdateUI(force);
  };

  const previousStartNewGame = startNewGame;
  startNewGame = function alphaDoorStartNewGame(config, selectedColonists) {
    installDoorDefs();
    previousStartNewGame(config, selectedColonists);
    ensureDoorBuildButton();
  };

  installDoorDefs();
  ensureDoorBuildButton();

  window.havenfallOpenDoor = openDoor;
  window.havenfallCloseDoor = closeDoor;
}

if (typeof window !== 'undefined' && typeof updateWorld === 'function') {
  installAlphaDoorSystemPatch();
}
