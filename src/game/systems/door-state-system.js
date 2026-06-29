'use strict';

(() => {
  if (window.HavenfallContext?.doorStateSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.doorStateSystemInstalled = true;

  const CLOSED = 'closed';
  const OPEN = 'open';
  const NORMAL_DELAY = 1200;
  const SAFE_HOLD = 240;
  let pulse = 0;

  window.DoorState = window.DoorState || Object.freeze({ CLOSED, OPEN });

  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const doors = () => (state?.objects || []).filter(o => o?.type === 'door');
  const isDoor = o => o?.type === 'door';
  const isOpen = o => isDoor(o) && (o.state || CLOSED) === OPEN;
  const tileDistance = (e, x, y) => Math.hypot(Math.round(e?.x ?? 9999) - x, Math.round(e?.y ?? 9999) - y);

  function setDoor(door, next, actor = null, reason = 'auto') {
    if (!isDoor(door)) return false;
    if ((door.state || CLOSED) === next) return false;
    const t = clock();
    door.state = next;
    door.doorState = next;
    door.texture_id = next === OPEN ? 'door_wood_open' : 'door_wood_closed';
    door.lastDoorChangeAt = t;
    door.lastDoorReason = reason;
    if (next === OPEN) {
      door.lastOpenedAt = t;
      door.lastOpenedBy = actor?.id || null;
    } else {
      door.lastClosedAt = t;
      door.lastOpenedBy = null;
      door.closeRequested = false;
    }
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return true;
  }

  function openDoor(door, actor = null, reason = 'path') {
    if (!isDoor(door)) return false;
    if (isOpen(door)) {
      door.lastOpenedAt = clock();
      door.lastOpenedBy = actor?.id || door.lastOpenedBy || null;
      return false;
    }
    if (actor) actor.note = 'Abrindo porta';
    return setDoor(door, OPEN, actor, reason);
  }

  function entityOnDoor(door) {
    const x = door.x;
    const y = door.y;
    const entities = [ ...(state?.colonists || []), ...(state?.visitors || []), ...(state?.mobs || []) ];
    return entities.some(e => Math.round(e.x) === x && Math.round(e.y) === y);
  }

  function colonistNear(door) {
    return (state?.colonists || []).some(c => !c.isUnconscious && tileDistance(c, door.x, door.y) <= 1.35);
  }

  function canCloseDoor(door) {
    return isOpen(door) && !entityOnDoor(door) && clock() - Number(door.lastOpenedAt || 0) >= SAFE_HOLD;
  }

  function closeDoor(door, reason = 'auto') {
    if (!isOpen(door)) return false;
    if (!canCloseDoor(door)) {
      door.closeRequested = true;
      door.closeRequestedAt = clock();
      return false;
    }
    return setDoor(door, CLOSED, null, reason);
  }

  function toggleDoorState(door, actor = null) {
    if (!isDoor(door)) return false;
    return isOpen(door) ? closeDoor(door, 'manual') : openDoor(door, actor, 'manual');
  }

  function normalizeDoor(door) {
    door.state = door.state || CLOSED;
    door.doorState = door.state;
    door.texture_id = door.state === OPEN ? 'door_wood_open' : 'door_wood_closed';
    door.lastDoorChangeAt = Number(door.lastDoorChangeAt || clock());
  }

  function shouldCloseDoor(door) {
    if (!isOpen(door)) return false;
    const elapsed = clock() - Number(door.lastOpenedAt || door.lastDoorChangeAt || 0);
    if (door.closeRequested && canCloseDoor(door)) return true;
    if (!colonistNear(door) && elapsed >= NORMAL_DELAY) return true;
    if (elapsed >= NORMAL_DELAY * 3) return true;
    return false;
  }

  function updateDoors(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    pulse += dt * Number(state.speed || 1);
    if (pulse < 0.08) return;
    pulse = 0;
    for (const door of doors()) {
      normalizeDoor(door);
      if (shouldCloseDoor(door)) closeDoor(door, 'auto');
    }
  }

  const previousOpen = typeof window.openDoorForColonist === 'function' ? window.openDoorForColonist : null;
  window.openDoorForColonist = function managedDoorOpen(door, colonist = null) {
    if (!isDoor(door)) return false;
    if (previousOpen) previousOpen(door, colonist);
    return openDoor(door, colonist, 'path');
  };

  window.toggleDoorState = toggleDoorState;
  window.HavenfallDoorSystem = { openDoor, closeDoor, toggleDoorState, isOpen, canCloseDoor };
  window.GameSystems?.registerTick?.('doors.auto-close', updateDoors, { order: 18 });
})();