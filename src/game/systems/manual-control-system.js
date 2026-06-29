'use strict';

(() => {
  if (window.HavenfallContext?.manualControlInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.manualControlInstalled = true;

  const input = new Set();
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
  const USE_KEY = 'KeyE';
  const interactionCache = { target: null, updatedAt: 0 };

  function ensureControlState() {
    if (!state) return null;
    state.controlMode = state.controlMode === 'manual' ? 'manual' : 'auto';
    state.manualControl = state.manualControl || { enabled: false };
    state.manualControl.enabled = state.controlMode === 'manual';
    return state.manualControl;
  }

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable;
  }

  function selectedManualColonist() {
    if (!state || state.controlMode !== 'manual' || typeof selectedColonist !== 'function') return null;
    const c = selectedColonist();
    return c && !c.isUnconscious ? c : null;
  }

  function setControlMode(mode) {
    if (!state) return;
    const next = mode === 'manual' ? 'manual' : 'auto';
    state.controlMode = next;
    ensureControlState();
    input.clear();
    const c = selectedColonist?.();
    if (next === 'manual' && c) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Controle manual ativo';
    }
    if (typeof log === 'function') log(next === 'manual' ? 'Controle manual ligado: use WASD/setas e E para interagir.' : 'Controle automático ligado: colonos voltaram à IA.' );
    syncControlButton();
    updateUI?.(true);
  }

  function toggleControlMode() {
    setControlMode(state?.controlMode === 'manual' ? 'auto' : 'manual');
  }

  function ensureControlButton() {
    const dock = document.getElementById('bottom-navigation-dock');
    if (!dock) return null;
    let button = dock.querySelector('[data-control-mode-toggle]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.controlModeToggle = 'true';
      const speed = dock.querySelector('[data-speed]');
      dock.insertBefore(button, speed || null);
    }
    return button;
  }

  function ensureStyle() {
    if (document.getElementById('manual-control-style')) return;
    const style = document.createElement('style');
    style.id = 'manual-control-style';
    style.textContent = '#bottom-navigation-dock [data-control-mode-toggle]{min-width:86px;border-color:rgba(148,163,184,.22)}#bottom-navigation-dock [data-control-mode-toggle].is-manual{background:linear-gradient(180deg,#60a5fa,#2563eb);border-color:#bfdbfe;color:#fff;box-shadow:0 0 0 1px rgba(191,219,254,.28),0 0 18px rgba(37,99,235,.42)}';
    document.head.appendChild(style);
  }

  function syncControlButton() {
    ensureStyle();
    const button = ensureControlButton();
    if (!button) return;
    const manual = state?.controlMode === 'manual';
    button.textContent = manual ? 'Manual' : 'Auto';
    button.title = manual ? 'Modo manual: WASD/setas movem; E interage com objetos próximos.' : 'Modo automático: colonos usam IA e tarefas.';
    button.classList.toggle('is-manual', manual);
  }

  function onClick(event) {
    const button = event.target?.closest?.('[data-control-mode-toggle]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleControlMode();
  }

  function onKeyDown(event) {
    if (isTypingTarget() || appScreen !== SCREEN.PLAYING || state?.controlMode !== 'manual') return;
    if (event.code === USE_KEY) {
      const c = selectedManualColonist();
      if (!c) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      executeBestInteraction(c);
      return;
    }
    if (!MOVE_KEYS.has(event.code)) return;
    const c = selectedManualColonist();
    if (!c) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    input.add(event.code);
  }

  function onKeyUp(event) {
    if (MOVE_KEYS.has(event.code)) input.delete(event.code);
  }

  function isManualColonist(c) {
    return !!c && state?.controlMode === 'manual' && c.id === selectedColonistId;
  }

  function blockAutoForManualColonist(c) {
    if (!isManualColonist(c)) return false;
    if (c.task || c.path?.length) {
      c.task = null;
      c.path = [];
      c.work = 0;
    }
    c.note = input.size ? 'Controle manual' : 'Aguardando comando manual';
    return false;
  }

  function claimAutoTaskForManualColonist(c) {
    if (!isManualColonist(c)) return false;
    c.note = input.size ? 'Controle manual' : 'Aguardando comando manual';
    return true;
  }

  function canManualMoveTo(tileX, tileY, c) {
    if (tileX === c.x && tileY === c.y) return true;
    if (typeof isInside === 'function' && !isInside(tileX, tileY)) return false;
    if (typeof isBlocked === 'function' && isBlocked(tileX, tileY)) return false;
    return true;
  }

  function stationTypes() {
    const types = new Set();
    for (const recipe of Object.values(recipeDefs || {})) if (recipe?.station) types.add(recipe.station);
    return types;
  }

  function isNearby(c, x, y, radius = 1.65) {
    return Math.hypot((x + 0.5) - (c.px / TILE), (y + 0.5) - (c.py / TILE)) <= radius;
  }

  function interactionLabel(action) {
    return action?.label || 'Interagir';
  }

  function objectInteraction(c, obj) {
    if (!obj || !isNearby(c, obj.x, obj.y, 1.85)) return null;
    const def = objectDefs?.[obj.type] || {};
    if (obj.type === 'research_desk') return { kind: 'research', obj, label: 'Pesquisar na mesa', priority: 100 };
    if (obj.type === 'door') return { kind: 'door', obj, label: 'Abrir/fechar porta', priority: 95 };
    if (stationTypes().has(obj.type)) return { kind: 'station', obj, label: `Usar ${stationLabels?.[obj.type] || def.name || obj.type}`, priority: 88 };
    if (def.gather && (obj.type !== 'crop' || (obj.growth || 0) >= 100)) return { kind: 'gather', obj, label: `Coletar ${def.name || obj.type}`, priority: 82 };
    if (def.interactable && !obj.looted) return { kind: obj.inspected ? 'loot' : 'inspect', obj, label: obj.inspected ? 'Vasculhar' : 'Investigar', priority: 78 };
    if (obj.type === 'campfire') return { kind: 'leisure', obj, label: 'Relaxar na fogueira', priority: 42 };
    return null;
  }

  function rockInteraction(c) {
    if (typeof getRockAt !== 'function') return null;
    let best = null;
    let bestDist = Infinity;
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const rock = getRockAt(x, y);
        if (!rock?.solid || !rock.mineable) continue;
        if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) continue;
        const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(x, y, c.x, c.y) : null;
        if (!adj) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < bestDist && d <= 2.25) {
          bestDist = d;
          best = { kind: 'mine', x, y, label: `Minerar ${typeof geologyLabelAt === 'function' ? geologyLabelAt(x, y) : 'montanha'}`, priority: 90 };
        }
      }
    }
    return best;
  }

  function findBestInteraction(c) {
    if (!c || !state) return null;
    const actions = [];
    for (const obj of state.objects || []) {
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) continue;
      const action = objectInteraction(c, obj);
      if (action) actions.push(action);
    }
    const rock = rockInteraction(c);
    if (rock) actions.push(rock);
    actions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return actions[0] || null;
  }

  function executeBestInteraction(c) {
    const action = findBestInteraction(c);
    if (!action) {
      if (typeof log === 'function') log('Nada próximo para interagir.');
      return false;
    }
    input.clear();
    if (action.kind === 'gather') {
      if (typeof assignGather === 'function') assignGather(c, action.obj);
    } else if (action.kind === 'mine') {
      if (typeof assignMine === 'function') assignMine(c, action.x, action.y, true);
    } else if (action.kind === 'research') {
      if (typeof assignResearch === 'function') assignResearch(c, action.obj);
    } else if (action.kind === 'station') {
      selectedCraftStationId = action.obj.id;
      if (window.HavenfallUI?.renderDockPanel) window.HavenfallUI.renderDockPanel('crafting');
      else if (typeof openCraftingForStation === 'function') openCraftingForStation(action.obj);
      c.note = `Usando ${stationLabels?.[action.obj.type] || action.obj.type}`;
    } else if (action.kind === 'door') {
      if (typeof toggleDoorState === 'function') toggleDoorState(action.obj);
    } else if (action.kind === 'inspect') {
      if (typeof assignInspect === 'function') assignInspect(c, action.obj);
    } else if (action.kind === 'loot') {
      if (typeof assignLoot === 'function') assignLoot(c, action.obj);
    } else if (action.kind === 'leisure') {
      const adj = nearestFreeAdjacent?.(action.obj.x, action.obj.y, c.x, c.y) || { x: action.obj.x, y: action.obj.y };
      c.task = { type: 'leisure', x: adj.x, y: adj.y, objId: action.obj.id };
      c.path = findPath(c.x, c.y, adj.x, adj.y, action.obj);
      c.work = 0;
      c.note = 'Indo relaxar';
    }
    if (typeof log === 'function') log(`Interação manual: ${interactionLabel(action)}.`);
    updateUI?.(true);
    return true;
  }

  function updateManualMovement(dt) {
    ensureControlState();
    syncControlButton();
    if (!state || appScreen !== SCREEN.PLAYING || state.controlMode !== 'manual') return;
    const c = selectedManualColonist();
    if (!c) return;

    let dx = 0;
    let dy = 0;
    if (input.has('KeyW') || input.has('ArrowUp')) dy -= 1;
    if (input.has('KeyS') || input.has('ArrowDown')) dy += 1;
    if (input.has('KeyA') || input.has('ArrowLeft')) dx -= 1;
    if (input.has('KeyD') || input.has('ArrowRight')) dx += 1;

    c.task = null;
    c.path = [];
    c.work = 0;
    if (!dx && !dy) {
      c.note = 'Aguardando comando manual';
      interactionCache.target = findBestInteraction(c);
      interactionCache.updatedAt = performance.now();
      return;
    }

    const len = Math.hypot(dx, dy) || 1;
    const tick = dt * (state.speed || 1);
    const movementMultiplier = window.GameSystems?.movementMultiplier(c) ?? 1;
    const speed = 86 * (c.energy < 20 ? 0.65 : 1) * (c.mood < 20 ? 0.75 : 1) * movementMultiplier;
    const nextPx = c.px + (dx / len) * speed * tick;
    const nextPy = c.py + (dy / len) * speed * tick;
    const nextX = Math.round((nextPx - TILE / 2) / TILE);
    const nextY = Math.round((nextPy - TILE / 2) / TILE);

    if (!canManualMoveTo(nextX, nextY, c)) {
      c.note = 'Caminho bloqueado';
      return;
    }

    c.px = nextPx;
    c.py = nextPy;
    c.x = nextX;
    c.y = nextY;
    c.anim = (c.anim || 0) + tick;
    c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    c.note = 'Controle manual';
    interactionCache.target = findBestInteraction(c);
    interactionCache.updatedAt = performance.now();
    if (typeof revealAround === 'function') revealAround(c.x, c.y, 4);
  }

  function drawInteractionPrompt() {
    if (!state || appScreen !== SCREEN.PLAYING || state.controlMode !== 'manual') return;
    const c = selectedManualColonist();
    if (!c) return;
    const action = performance.now() - interactionCache.updatedAt < 500 ? interactionCache.target : findBestInteraction(c);
    if (!action) return;
    const x = c.px * viewTransform.scale + viewTransform.offsetX;
    const y = (c.py - 48) * viewTransform.scale + viewTransform.offsetY;
    const text = `[E] ${interactionLabel(action)}`;
    ctx.save();
    ctx.font = '900 13px system-ui';
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = 'rgba(2,6,23,.88)';
    ctx.strokeStyle = 'rgba(248,215,138,.88)';
    ctx.lineWidth = 2;
    if (typeof roundRect === 'function') roundRect(x - w / 2, y - 18, w, 28, 12, true, true);
    else { ctx.fillRect(x - w / 2, y - 18, w, 28); ctx.strokeRect(x - w / 2, y - 18, w, 28); }
    ctx.fillStyle = '#f8d78a';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => input.clear());

  window.GameSystems?.registerBeforeColonistUpdate?.('manual-control.block-auto', blockAutoForManualColonist, { order: 0 });
  window.GameSystems?.registerAutoTaskProvider?.('manual-control.claim-selected', claimAutoTaskForManualColonist, { order: 0 });
  window.GameSystems?.registerTick?.('manual-control.movement', updateManualMovement, { order: 95 });
  window.GameSystems?.registerDrawOverlay?.('manual-control.prompt', drawInteractionPrompt, { order: 80 });

  window.HavenfallManualControl = Object.freeze({ setMode: setControlMode, toggle: toggleControlMode, isManual: () => state?.controlMode === 'manual', interact: executeBestInteraction });
})();