'use strict';

(() => {
  if (window.HavenfallContext?.manualControlInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.manualControlInstalled = true;

  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
  const input = new Set();
  const interactionCache = { target: null, updatedAt: 0 };

  function isTypingTarget(el = document.activeElement) {
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable;
  }

  function selectedPawn() {
    if (!state?.colonists?.length) return null;
    return state.colonists.find(c => String(c.id) === String(selectedColonistId)) || state.colonists[0] || null;
  }

  function selectedPawnName() {
    return selectedPawn()?.name || 'NPC';
  }

  function isManualActive() {
    return !!state && state.controlMode === 'manual';
  }

  function consume(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function setManualMode(enabled) {
    if (!state) return false;
    const c = selectedPawn();
    if (!c) {
      if (typeof log === 'function') log('Selecione um colono antes de ativar o controle manual.');
      return false;
    }

    selectedColonistId = c.id;
    state.controlMode = enabled ? 'manual' : 'auto';
    state.manualControl = state.manualControl || {};
    state.manualControl.enabled = !!enabled;
    state.manualControl.selectedColonistId = enabled ? c.id : null;
    input.clear();

    if (enabled) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.manualAction = false;
      c.note = 'Controle manual ativo';
      if (typeof log === 'function') log(`Controle manual: ${c.name}. WASD/setas movem, E interage, ESC sai.`);
    } else {
      if (c.manualAction) cancelManualAction(c);
      c.note = 'Controle automático';
      if (typeof log === 'function') log('Controle manual desligado. Colonos voltaram para a IA.');
    }

    syncButton();
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function setControlMode(mode) {
    return setManualMode(mode === 'manual');
  }

  function toggleManualMode() {
    setManualMode(!isManualActive());
  }

  function isManualColonist(c) {
    return !!c && isManualActive() && String(c.id) === String(selectedColonistId);
  }

  function ensureButton() {
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
    style.textContent = `
      #bottom-navigation-dock [data-control-mode-toggle]{min-width:150px;border-color:rgba(248,215,138,.32);font-weight:950;letter-spacing:.02em}
      #bottom-navigation-dock [data-control-mode-toggle].is-manual{background:linear-gradient(180deg,#f8d78a,#b7791f);border-color:#fff4c7;color:#1f1303;box-shadow:0 0 0 1px rgba(248,215,138,.35),0 0 18px rgba(248,215,138,.28)}
      .manual-control-help{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:7400;display:flex;gap:10px;align-items:center;padding:10px 14px;border:1px solid rgba(248,215,138,.55);border-radius:999px;background:rgba(2,6,23,.88);color:#f8fafc;font:850 12px system-ui;box-shadow:0 12px 34px rgba(0,0,0,.45);pointer-events:none}
      .manual-control-help b{color:#f8d78a}.manual-control-help kbd{padding:3px 7px;border-radius:7px;background:#111827;border:1px solid rgba(255,255,255,.16);color:#e5edf8;font:900 11px system-ui}
    `;
    document.head.appendChild(style);
  }

  function syncButton() {
    ensureStyle();
    const button = ensureButton();
    if (!button) return;
    const manual = isManualActive();
    const name = selectedPawnName();
    button.textContent = manual ? `Controlando: ${name}` : `Controlar: ${name}`;
    button.title = manual
      ? 'Controle manual ativo. WASD/setas movem o colono selecionado; E interage; ESC sai do controle manual.'
      : 'Clique para controlar manualmente o colono selecionado. Primeiro selecione um colono no mapa ou na lista.';
    button.classList.toggle('is-manual', manual);
  }

  function ensureHelp() {
    let help = document.getElementById('manualControlHelp');
    if (!isManualActive() || appScreen !== SCREEN.PLAYING) {
      help?.remove();
      return;
    }
    if (!help) {
      help = document.createElement('div');
      help.id = 'manualControlHelp';
      help.className = 'manual-control-help';
      document.body.appendChild(help);
    }
    help.innerHTML = `<b>${selectedPawnName()}</b><span><kbd>WASD</kbd>/<kbd>SETAS</kbd> mover</span><span><kbd>E</kbd> interagir</span><span><kbd>ESC</kbd> sair</span>`;
  }

  function cancelManualAction(c) {
    if (!c) return false;
    const hadAction = !!(c.task || c.path?.length || c.manualAction);
    c.task = null;
    c.path = [];
    c.work = 0;
    c.manualAction = false;
    c.note = 'Controle manual ativo';
    return hadAction;
  }

  function stationTypes() {
    const types = new Set();
    for (const recipe of Object.values(recipeDefs || {})) if (recipe?.station) types.add(recipe.station);
    return types;
  }

  function isNearby(c, x, y, radius = 1.85) {
    return Math.hypot((x + 0.5) - (c.px / TILE), (y + 0.5) - (c.py / TILE)) <= radius;
  }

  function objectInteraction(c, obj) {
    if (!obj || !isNearby(c, obj.x, obj.y)) return null;
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

  function markManualTask(c) {
    if (c?.task) c.manualAction = true;
  }

  function interact(c = selectedPawn()) {
    const action = findBestInteraction(c);
    if (!action) {
      if (typeof log === 'function') log('Nada próximo para interagir.');
      return false;
    }

    input.clear();
    if (action.kind === 'gather') {
      if (typeof assignGather === 'function') assignGather(c, action.obj);
      markManualTask(c);
    } else if (action.kind === 'mine') {
      if (typeof assignMine === 'function') assignMine(c, action.x, action.y, true);
      markManualTask(c);
    } else if (action.kind === 'research') {
      if (typeof assignResearch === 'function') assignResearch(c, action.obj);
      markManualTask(c);
    } else if (action.kind === 'station') {
      selectedCraftStationId = action.obj.id;
      if (window.HavenfallUI?.renderDockPanel) window.HavenfallUI.renderDockPanel('crafting');
      else if (typeof openCraftingForStation === 'function') openCraftingForStation(action.obj);
      c.note = `Usando ${stationLabels?.[action.obj.type] || action.obj.type}`;
    } else if (action.kind === 'door') {
      if (typeof toggleDoorState === 'function') toggleDoorState(action.obj);
    } else if (action.kind === 'inspect') {
      if (typeof assignInspect === 'function') assignInspect(c, action.obj);
      markManualTask(c);
    } else if (action.kind === 'loot') {
      if (typeof assignLoot === 'function') assignLoot(c, action.obj);
      markManualTask(c);
    } else if (action.kind === 'leisure') {
      const adj = nearestFreeAdjacent?.(action.obj.x, action.obj.y, c.x, c.y) || { x: action.obj.x, y: action.obj.y };
      c.task = { type: 'leisure', x: adj.x, y: adj.y, objId: action.obj.id };
      c.path = findPath(c.x, c.y, adj.x, adj.y, action.obj);
      c.work = 0;
      c.manualAction = true;
      c.note = 'Indo relaxar';
    }

    if (typeof log === 'function') log(`Interação manual: ${action.label || 'Interagir'}.`);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function onClick(event) {
    const button = event.target?.closest?.('[data-control-mode-toggle]');
    if (!button) return;
    consume(event);
    toggleManualMode();
  }

  function onKeyDown(event) {
    if (isTypingTarget() || appScreen !== SCREEN.PLAYING || !isManualActive()) return;
    const c = selectedPawn();
    if (!c) return;
    if (event.code === 'Escape' || event.key === 'Escape') {
      consume(event);
      if (c.task || c.path?.length || c.manualAction) cancelManualAction(c);
      else setManualMode(false);
      return;
    }
    if (event.code === 'KeyE') {
      consume(event);
      interact(c);
      return;
    }
    if (!MOVE_KEYS.has(event.code)) return;
    consume(event);
    input.add(event.code);
    if (c.task || c.path?.length || c.manualAction) cancelManualAction(c);
  }

  function onKeyUp(event) {
    if (MOVE_KEYS.has(event.code)) input.delete(event.code);
  }

  function directionVector() {
    let dx = 0, dy = 0;
    if (input.has('KeyW') || input.has('ArrowUp')) dy -= 1;
    if (input.has('KeyS') || input.has('ArrowDown')) dy += 1;
    if (input.has('KeyA') || input.has('ArrowLeft')) dx -= 1;
    if (input.has('KeyD') || input.has('ArrowRight')) dx += 1;
    return { dx, dy };
  }

  function canMoveTo(c, tileX, tileY) {
    if (tileX === c.x && tileY === c.y) return true;
    if (typeof isInside === 'function' && !isInside(tileX, tileY)) return false;
    if (typeof isBlocked === 'function' && isBlocked(tileX, tileY)) return false;
    return true;
  }

  function manualTick(dt) {
    syncButton();
    ensureHelp();
    if (!state || appScreen !== SCREEN.PLAYING || !isManualActive()) return;
    const c = selectedPawn();
    if (!c || c.isUnconscious) return;

    const { dx, dy } = directionVector();
    if (!dx && !dy) {
      if (!c.task) c.note = 'Controle manual ativo';
      interactionCache.target = findBestInteraction(c);
      interactionCache.updatedAt = performance.now();
      return;
    }

    const len = Math.hypot(dx, dy) || 1;
    const tick = dt * Number(state.speed || 1);
    const movementMultiplier = window.GameSystems?.movementMultiplier?.(c) ?? 1;
    const speed = 88 * (c.energy < 20 ? 0.65 : 1) * (c.mood < 20 ? 0.75 : 1) * movementMultiplier;
    const nextPx = c.px + (dx / len) * speed * tick;
    const nextPy = c.py + (dy / len) * speed * tick;
    const nextX = Math.round((nextPx - TILE / 2) / TILE);
    const nextY = Math.round((nextPy - TILE / 2) / TILE);
    if (!canMoveTo(c, nextX, nextY)) {
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
    if (typeof revealAround === 'function') revealAround(c.x, c.y, 4);
  }

  function blockAutoTaskForManual(c) {
    if (!isManualColonist(c)) return false;
    if (c.manualAction && c.task) return false;
    c.note = input.size ? 'Controle manual' : 'Aguardando comando manual';
    return true;
  }

  function drawManualMarker() {
    if (!state || appScreen !== SCREEN.PLAYING || !isManualActive()) return;
    const c = selectedPawn();
    if (!c) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(248,215,138,.95)';
    ctx.fillStyle = 'rgba(248,215,138,.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(c.px, c.py + 17, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  document.addEventListener('click', onClick, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => input.clear());
  window.GameSystems?.registerTick?.('manual-control', manualTick, { order: 96 });
  window.GameSystems?.registerAutoTaskProvider?.('manual-control.block-auto', blockAutoTaskForManual, { order: 0 });
  window.GameSystems?.registerDrawOverlay?.('manual-control.marker', drawManualMarker, { order: 79 });

  window.HavenfallManualControl = { setManualMode, setControlMode, toggleManualMode, isManualActive, selectedPawn, interact, findBestInteraction };
})();