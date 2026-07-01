'use strict';

(() => {
  let installed = false;
  let originalIsBlocked = null;
  let originalMoveAlongPath = null;
  const OPEN = () => window.DoorState?.OPEN || 'open';
  const CLOSED = () => window.DoorState?.CLOSED || 'closed';

  function doorAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    return obj?.type === 'door' ? obj : null;
  }

  function isClosedDoor(obj) {
    return obj?.type === 'door' && (obj.state || CLOSED()) !== OPEN();
  }

  function openDoorForColonist(obj, c = null) {
    if (!isClosedDoor(obj)) return false;
    obj.state = OPEN();
    obj.doorState = OPEN();
    obj.texture_id = 'door_wood_open';
    obj.lastOpenedBy = c?.id || null;
    obj.lastOpenedAt = performance.now();
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (c) c.note = 'Abrindo porta';
    return true;
  }

  function collisionForPathing(x, y, target = null) {
    if (typeof collisionAt === 'function') {
      const collision = collisionAt(x, y, target);
      if (collision === window.CollisionType?.DOOR_CLOSED) return false;
      if (collision === window.CollisionType?.DOOR_OPEN) return false;
      if (collision === window.CollisionType?.WALKABLE) return false;
      if (collision === window.CollisionType?.MOUNTAIN || collision === window.CollisionType?.WALL || collision === window.CollisionType?.BLOCK_PATH) return true;
    }

    const door = doorAt(x, y);
    if (door) return false;
    return originalIsBlocked ? originalIsBlocked(x, y, target) : false;
  }

  function moveAlongPathDoorAware(c, tick) {
    const next = c?.path?.[0];
    if (next) {
      const door = doorAt(next.x, next.y);
      if (isClosedDoor(door)) {
        const adjacent = Math.abs(Math.round(c.x) - next.x) + Math.abs(Math.round(c.y) - next.y) <= 1;
        if (adjacent) openDoorForColonist(door, c);
      }
    }
    return originalMoveAlongPath ? originalMoveAlongPath(c, tick) : undefined;
  }

  function taskTargetObject(task) {
    if (!task || !state?.objects) return null;
    if (task.objId) return state.objects.find(o => o.id === task.objId) || null;
    if (task.bedId) return state.objects.find(o => o.id === task.bedId) || null;
    return null;
  }

  function isAtTaskTile(c, task) {
    if (!task || !Number.isFinite(task.x) || !Number.isFinite(task.y)) return true;
    return Math.round(c.x) === Math.round(task.x) && Math.round(c.y) === Math.round(task.y);
  }

  function repairStalledPath(c, dt) {
    if (!c?.task || !state || c.task.type === 'sleep') return;
    const task = c.task;

    if (task.type === 'build') {
      const bp = state.objects?.find(o => o.id === task.objId);
      if (!bp || bp.type !== 'blueprint') {
        c.task = null;
        c.path = [];
        c.work = 0;
        c.note = 'Ocioso';
        return;
      }
    }

    if (c.path?.length || isAtTaskTile(c, task)) {
      c._stuckPathTime = 0;
      c._stuckPathRequestKey = null;
      return;
    }

    if (!Number.isFinite(task.x) || !Number.isFinite(task.y) || typeof findPath !== 'function') return;

    const target = taskTargetObject(task);
    const requestKey = `repair:${c.id}:${task.type}:${task.x},${task.y}:${state?.pathVersion || 0}`;
    if (window.PathfindingQueue?.request) {
      if (!c._stuckPathRequestKey) {
        c._stuckPathRequestKey = requestKey;
        window.PathfindingQueue.request({
          ownerId: c.id,
          key: requestKey,
          startX: c.x,
          startY: c.y,
          endX: task.x,
          endY: task.y,
          target: target || null,
          apply(path) {
            if (!c?.task || c.task !== task) return;
            c._stuckPathRequestKey = null;
            if (path?.length) {
              c.path = path;
              c._stuckPathTime = 0;
              c.note = 'Retomando caminho';
            } else {
              c._stuckPathTime = Math.max(Number(c._stuckPathTime || 0), 1.81);
            }
          }
        });
      }
    } else {
      const nextPath = findPath(c.x, c.y, task.x, task.y, target || null);
      if (nextPath?.length) {
        c.path = nextPath;
        c._stuckPathTime = 0;
        c._stuckPathRequestKey = null;
        c.note = 'Retomando caminho';
        return;
      }
    }

    c._stuckPathTime = (c._stuckPathTime || 0) + dt;
    if (c._stuckPathTime > 1.8 && !c._stuckPathRequestKey) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c._stuckPathTime = 0;
      c._stuckPathRequestKey = null;
      c.note = 'Sem caminho';
      if (typeof log === 'function') log(`${c.name} cancelou uma tarefa sem caminho válido.`);
    }
  }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted || !window.HavenfallRenderCollisionSystem) {
      setTimeout(install, 120);
      return;
    }

    installed = true;
    originalIsBlocked = typeof isBlocked === 'function' ? isBlocked : null;
    originalMoveAlongPath = typeof moveAlongPath === 'function' ? moveAlongPath : null;

    try { isBlocked = collisionForPathing; } catch (_) {}
    try { moveAlongPath = moveAlongPathDoorAware; } catch (_) {}

    window.openDoorForColonist = openDoorForColonist;
    window.GameSystems?.registerBeforeColonistUpdate?.('colonist-path-repair', repairStalledPath, { order: 2 });
    window.HavenfallColonistPathingSystem = 'door-aware-pathing';
    console.info('[Colonist Pathing] Portas automáticas e reparo de caminho carregados.');
  }

  install();
})();
