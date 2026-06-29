'use strict';

(() => {
  if (window.HavenfallContext?.manualControlInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.manualControlInstalled = true;

  const input = new Set();
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

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
    if (typeof log === 'function') log(next === 'manual' ? 'Controle manual ligado: use WASD/setas no colono selecionado.' : 'Controle automático ligado: colonos voltaram à IA.' );
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
    button.title = manual ? 'Modo manual: WASD/setas controlam o colono selecionado.' : 'Modo automático: colonos usam IA e tarefas.';
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
    if (typeof revealAround === 'function') revealAround(c.x, c.y, 4);
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', () => input.clear());

  window.GameSystems?.registerBeforeColonistUpdate?.('manual-control.block-auto', blockAutoForManualColonist, { order: 0 });
  window.GameSystems?.registerAutoTaskProvider?.('manual-control.claim-selected', claimAutoTaskForManualColonist, { order: 0 });
  window.GameSystems?.registerTick?.('manual-control.movement', updateManualMovement, { order: 95 });

  window.HavenfallManualControl = Object.freeze({ setMode: setControlMode, toggle: toggleControlMode, isManual: () => state?.controlMode === 'manual' });
})();