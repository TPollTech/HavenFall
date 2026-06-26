'use strict';

function installSandboxMultiplayerPatch() {
  const controlKeys = new Set();
  let multiplayerRevision = 0;
  let pulling = false;
  let publishing = false;
  let pullTimer = null;
  let publishTimer = null;

  function isJoinMode() {
    return window.havenfallOnlineMode === 'join'
      || sessionStorage.getItem('havenfall-online-mode') === 'join'
      || new URLSearchParams(window.location.search).has('join');
  }

  function setOnlineMode(mode) {
    window.havenfallOnlineMode = mode === 'join' ? 'join' : 'host';
    sessionStorage.setItem('havenfall-online-mode', window.havenfallOnlineMode);
    document.body.classList.toggle('online-join-mode', window.havenfallOnlineMode === 'join');
    document.body.classList.toggle('online-host-mode', window.havenfallOnlineMode !== 'join');
  }

  function alive(c) {
    return !!c && !c.dead && (c.health ?? 100) > 0;
  }

  function buildTypeSet() {
    const set = new Set(Object.values(buildDefs).map(def => def.type));
    set.add('door');
    return set;
  }

  function buildKeyForObject(obj) {
    if (!obj) return null;
    if (obj.type === 'blueprint') return obj.buildType || null;
    return Object.entries(buildDefs).find(([, def]) => def.type === obj.type)?.[0] || null;
  }

  function canDemolish(obj) {
    if (!obj) return false;
    if (obj.type === 'blueprint') return true;
    if (objectDefs[obj.type]?.interactable) return false;
    return buildTypeSet().has(obj.type);
  }

  function refundFor(obj) {
    const key = buildKeyForObject(obj);
    const cost = key ? buildDefs[key]?.cost || {} : {};
    const factor = obj.type === 'blueprint' ? 0.85 : 0.5;
    const refund = {};
    for (const [res, value] of Object.entries(cost)) {
      const amount = Math.floor(value * factor);
      if (amount > 0) refund[res] = amount;
    }
    return refund;
  }

  function refundLabel(refund) {
    const entries = Object.entries(refund).filter(([, v]) => v > 0);
    if (!entries.length) return 'sem recursos recuperados';
    return entries.map(([k, v]) => `+${v} ${resourceLabel(k)}`).join(', ');
  }

  window.demolishObject = function demolishObject(obj) {
    if (isJoinMode()) { log('Visitante online: demolição fica bloqueada neste protótipo.'); return false; }
    if (!obj || !state) return false;
    if (!canDemolish(obj)) {
      log('Esse objeto não é uma construção demolível.');
      return false;
    }

    const label = obj.type === 'blueprint'
      ? buildDefs[obj.buildType]?.label || 'obra'
      : objectDefs[obj.type]?.name || obj.type;
    const refund = refundFor(obj);
    if (Object.keys(refund).length) addResources(refund);

    state.objects = state.objects.filter(o => o.id !== obj.id);
    for (const c of state.colonists || []) {
      if (c.task?.objId === obj.id) {
        c.task = null;
        c.path = [];
        c.work = 0;
        c.note = 'Tarefa cancelada';
      }
    }

    if (selectedWorldObjectId === obj.id) selectedWorldObjectId = null;
    if (selectedCraftStationId === obj.id) selectedCraftStationId = null;
    if (typeof markStructureDirty === 'function') markStructureDirty();
    if (typeof updateRoofMap === 'function') updateRoofMap(true);

    log(`${label} demolido. Recuperado: ${refundLabel(refund)}.`);
    updateUI(true);
    return true;
  };

  const previousMakeContextActions = makeContextActions;
  makeContextActions = function sandboxContextActions(c, target, tile) {
    const actions = previousMakeContextActions(c, target, tile);
    if (target?.kind === 'object' && canDemolish(target.obj)) {
      const moveIndex = actions.findIndex(a => a.label === 'Mover até perto');
      const demolish = {
        label: isJoinMode() ? 'Demolir construção (host)' : 'Demolir construção',
        hint: isJoinMode() ? 'visitante não altera o mundo ainda' : 'remove do mapa e recupera parte dos recursos',
        disabled: isJoinMode(),
        run: () => window.demolishObject(target.obj)
      };
      if (moveIndex >= 0) actions.splice(moveIndex, 0, demolish);
      else actions.push(demolish);
    }
    return actions;
  };

  function setDemolishMode(enabled) {
    if (isJoinMode()) { log('Visitante online: modo demolir fica bloqueado.'); return; }
    window.havenfallDemolishMode = !!enabled;
    document.body.classList.toggle('demolish-mode', !!enabled);
    if (enabled) {
      currentBuild = null;
      log('Modo demolir ligado. Clique em uma construção para remover.');
    } else {
      log('Modo demolir desligado.');
    }
    updateUI(true);
  }

  function selectedObject() {
    return selectedWorldObjectId ? state?.objects?.find(o => o.id === selectedWorldObjectId) : null;
  }

  function setDirectControl(enabled) {
    if (isJoinMode()) { log('Visitante online: controle direto fica bloqueado neste protótipo.'); return; }
    const c = selectedColonist();
    if (enabled && (!c || !alive(c))) {
      log('Selecione um colono vivo para tomar controle.');
      return;
    }
    window.havenfallDirectControl = enabled ? c.id : null;
    controlKeys.clear();
    if (c && enabled) {
      c.task = null;
      c.path = [];
      c.work = 0;
      c.note = 'Controle manual';
      log(`Controle manual ativado em ${c.name}. Use WASD para mover e clique nos objetos para interagir.`);
      centerCameraOnSelectedColonist();
    } else {
      log('Controle manual desligado.');
    }
    document.body.classList.toggle('direct-control-mode', !!window.havenfallDirectControl);
    updateUI(true);
  }

  function controlledColonist() {
    if (!window.havenfallDirectControl || isJoinMode()) return null;
    const c = state?.colonists?.find(col => col.id === window.havenfallDirectControl);
    return alive(c) ? c : null;
  }

  const previousUpdateColonist = updateColonist;
  updateColonist = function directControlUpdateColonist(c, dt) {
    if (controlledColonist()?.id !== c.id) return previousUpdateColonist(c, dt);

    const tick = dt * state.speed;
    c.anim += tick;
    c.hunger = clamp(c.hunger - tick * 0.18, 0, 100);
    c.energy = clamp(c.energy - tick * 0.10, 0, 100);
    c.mood = clamp(c.mood - tick * (c.hunger < 25 || c.energy < 20 ? 0.13 : 0.02), 0, 100);
    if (c.hunger < 18) c.health = clamp(c.health - tick * 0.08, 0, 100);
    if (c.health <= 0 && typeof markColonistDead === 'function') markColonistDead(c);

    let dx = 0;
    let dy = 0;
    if (controlKeys.has('KeyW') || controlKeys.has('ArrowUp')) dy -= 1;
    if (controlKeys.has('KeyS') || controlKeys.has('ArrowDown')) dy += 1;
    if (controlKeys.has('KeyA') || controlKeys.has('ArrowLeft')) dx -= 1;
    if (controlKeys.has('KeyD') || controlKeys.has('ArrowRight')) dx += 1;

    c.task = null;
    c.path = [];
    c.work = 0;
    c.note = 'Controle manual';

    if (dx || dy) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = 92 * (c.energy < 20 ? 0.72 : 1) * (c.mood < 20 ? 0.82 : 1);
      const nextPx = c.px + (dx / len) * speed * tick;
      const nextPy = c.py + (dy / len) * speed * tick;
      const nextX = Math.round((nextPx - TILE / 2) / TILE);
      const nextY = Math.round((nextPy - TILE / 2) / TILE);
      const currentX = Math.round((c.px - TILE / 2) / TILE);
      const currentY = Math.round((c.py - TILE / 2) / TILE);
      if ((nextX === currentX && nextY === currentY) || !isBlocked(nextX, nextY)) {
        c.px = nextPx;
        c.py = nextPy;
      }
      if (Math.abs(dx) > Math.abs(dy)) c.dir = dx > 0 ? 'right' : 'left';
      else c.dir = dy > 0 ? 'down' : 'up';
    }

    c.x = Math.round((c.px - TILE / 2) / TILE);
    c.y = Math.round((c.py - TILE / 2) / TILE);
  };

  const previousUpdateCamera = updateCamera;
  updateCamera = function sandboxUpdateCamera(dt) {
    const c = controlledColonist();
    if (!c) return previousUpdateCamera(dt);
    camera.x += ((c.px || c.x * TILE) - camera.x) * Math.min(1, dt * 8);
    camera.y += ((c.py || c.y * TILE) - camera.y) * Math.min(1, dt * 8);
    clampCamera();
  };

  function ensureSandboxButtons() {
    const buildGrid = document.querySelector('#buildPanel .build-grid');
    if (buildGrid && !document.getElementById('demolishModeBtn')) {
      const btn = document.createElement('button');
      btn.id = 'demolishModeBtn';
      btn.innerHTML = 'Demolir<br><small>X / Delete</small>';
      btn.addEventListener('click', () => setDemolishMode(!window.havenfallDemolishMode));
      buildGrid.appendChild(btn);
    }

    const selectedInfo = dom.selectedInfo;
    if (selectedInfo && selectedColonist() && !document.getElementById('directControlBtn')) {
      const btn = document.createElement('button');
      btn.id = 'directControlBtn';
      btn.className = 'mini direct-control-btn';
      selectedInfo.appendChild(btn);
      btn.addEventListener('click', () => setDirectControl(window.havenfallDirectControl !== selectedColonistId));
    }
    const controlBtn = document.getElementById('directControlBtn');
    if (controlBtn) {
      const active = window.havenfallDirectControl === selectedColonistId;
      controlBtn.textContent = isJoinMode() ? 'Visitante' : (active ? 'Soltar controle' : 'Tomar controle');
      controlBtn.disabled = isJoinMode();
      controlBtn.classList.toggle('active', active);
    }

    const demolishBtn = document.getElementById('demolishModeBtn');
    if (demolishBtn) {
      demolishBtn.classList.toggle('active', !!window.havenfallDemolishMode);
      demolishBtn.disabled = isJoinMode();
    }
  }

  canvas.addEventListener('click', event => {
    if (!window.havenfallDemolishMode || appScreen !== SCREEN.PLAYING || !state) return;
    const tile = tileFromEvent(event);
    const obj = tile && isInside(tile.x, tile.y) ? getObjectAt(tile.x, tile.y) : null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (obj && canDemolish(obj)) window.demolishObject(obj);
    else log('Escolha uma construção para demolir.');
  }, true);

  window.addEventListener('keydown', event => {
    if (appScreen !== SCREEN.PLAYING || !state) return;
    if (window.havenfallDirectControl && ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(event.code)) {
      controlKeys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyC' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      setDirectControl(window.havenfallDirectControl !== selectedColonistId);
    }
    if (event.code === 'KeyX' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      setDemolishMode(!window.havenfallDemolishMode);
    }
    if (event.code === 'Delete' || event.code === 'Backspace') {
      const obj = selectedObject();
      if (obj && canDemolish(obj)) {
        event.preventDefault();
        window.demolishObject(obj);
      }
    }
  }, true);

  window.addEventListener('keyup', event => {
    controlKeys.delete(event.code);
  }, true);

  function installStyles() {
    if (document.getElementById('sandboxPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'sandboxPatchStyles';
    style.textContent = `
      #demolishModeBtn.active,
      .direct-control-btn.active {
        border-color: #e67866 !important;
        box-shadow: 0 0 0 2px rgba(230,120,102,.22) inset;
      }
      body.demolish-mode #game { cursor: crosshair; }
      body.direct-control-mode #game { cursor: default; }
      .multiplayer-pill {
        position: fixed;
        right: 14px;
        top: 14px;
        z-index: 80;
        padding: 8px 11px;
        border-radius: 999px;
        background: rgba(7, 11, 17, .76);
        border: 1px solid rgba(255,255,255,.12);
        color: #dff5ff;
        font: 800 12px system-ui;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function multiplayerPill() {
    let el = document.getElementById('multiplayerPill');
    if (!el) {
      el = document.createElement('div');
      el.id = 'multiplayerPill';
      el.className = 'multiplayer-pill';
      document.body.appendChild(el);
    }
    return el;
  }

  function setMpStatus(text) {
    multiplayerPill().textContent = text;
  }

  async function publishState() {
    if (publishing || isJoinMode() || !state || appScreen !== SCREEN.PLAYING) return;
    publishing = true;
    try {
      const res = await fetch('/api/multiplayer/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: state })
      });
      if (res.ok) {
        const data = await res.json();
        multiplayerRevision = data.revision || multiplayerRevision;
      }
    } catch (_) {
      // servidor antigo ou modo offline: ignora
    } finally {
      publishing = false;
    }
  }

  async function pullState() {
    if (pulling) return;
    pulling = true;
    try {
      const res = await fetch('/api/multiplayer/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('sem host');
      const data = await res.json();
      if (data.snapshot && (data.revision || 0) > multiplayerRevision) {
        state = data.snapshot;
        multiplayerRevision = data.revision || multiplayerRevision;
        activeSession = true;
        if (!selectedColonistId || !state.colonists?.some(c => c.id === selectedColonistId)) selectedColonistId = state.colonists?.[0]?.id || 1;
        ensureResearchState();
        setScreen(SCREEN.PLAYING);
        updateUI(true);
      }
      setMpStatus(`Online: conectado ao host · rev ${data.revision || 0}`);
    } catch (_) {
      setMpStatus('Online: aguardando host ativo');
    } finally {
      pulling = false;
    }
  }

  function startPublishLoop() {
    if (publishTimer) return;
    publishTimer = setInterval(publishState, 900);
  }

  function startPullLoop() {
    if (pullTimer) return;
    pullTimer = setInterval(pullState, 650);
  }

  function stopPullLoop() {
    if (pullTimer) clearInterval(pullTimer);
    pullTimer = null;
  }

  window.havenfallHostOnline = function havenfallHostOnline() {
    setOnlineMode('host');
    stopPullLoop();
    setMpStatus('Host online: jogue normalmente; visitantes entram pelo menu Online.');
    startPublishLoop();
    publishState();
  };

  window.havenfallJoinOnline = function havenfallJoinOnline() {
    setOnlineMode('join');
    window.havenfallDirectControl = null;
    window.havenfallDemolishMode = false;
    document.body.classList.remove('direct-control-mode', 'demolish-mode');
    currentBuild = null;
    setMpStatus('Online: entrando no mundo do host...');
    startPullLoop();
    pullState();
  };

  const previousUpdateWorld = updateWorld;
  updateWorld = function sandboxMultiplayerUpdateWorld(dt) {
    if (isJoinMode()) return;
    previousUpdateWorld(dt);
  };

  const previousUpdateUI = updateUI;
  updateUI = function sandboxUpdateUI(force = false) {
    previousUpdateUI(force);
    ensureSandboxButtons();
  };

  const previousBootGame = bootGame;
  bootGame = function sandboxBootGame() {
    previousBootGame();
    setTimeout(() => {
      installStyles();
      ensureSandboxButtons();
      if (isJoinMode()) {
        window.havenfallJoinOnline();
      } else {
        window.havenfallHostOnline();
      }
    }, 800);
  };

  installStyles();
}
