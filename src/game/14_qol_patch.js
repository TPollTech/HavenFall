'use strict';

function installQolPatch() {
  const defaults = {
    uiScale: 'normal',
    autosave: 'on',
    showGrid: false,
    cameraSpeed: 720,
    defaultZoom: 1.12
  };

  settings = { ...defaults, ...(settings || {}) };
  let eventLogExpanded = false;
  let wallBuildOrientation = 'horizontal';
  let worldSanitizedForQol = false;
  let lastAlphaTierKey = null;
  let lastAlphaDoneSignature = '';

  const alphaTiers = [
    {
      key: 'survival',
      label: 'Tier 1 — Sobrevivência',
      note: 'Estabeleça o básico para sobreviver ao começo.',
      goals: [
        { key: 'wood20', label: 'Coletar 20 madeira', done: () => (state?.resources?.wood || 0) >= 20 },
        { key: 'stone12', label: 'Coletar 12 pedra', done: () => (state?.resources?.stone || 0) >= 12 },
        { key: 'bed1', label: 'Construir pelo menos 1 cama', done: () => hasBuiltObject('bed') },
        { key: 'bench1', label: 'Construir uma bancada', done: () => hasBuiltObject('bench') }
      ]
    },
    {
      key: 'tools',
      label: 'Tier 2 — Ferramentas e Base',
      note: 'Comece a acelerar coleta, construção e defesa.',
      goals: [
        { key: 'tool1', label: 'Fabricar ou equipar uma ferramenta', done: () => hasAnyItemOrEquipped(['stoneAxe', 'pickaxe', 'hammer', 'toolkit']) },
        { key: 'weapon1', label: 'Fabricar ou equipar uma arma simples', done: () => hasAnyItemOrEquipped(['knife', 'spear', 'club', 'bow']) },
        { key: 'walls4', label: 'Construir 4 paredes para iniciar uma base', done: () => countBuiltObject('wall') >= 4 },
        { key: 'storage1', label: 'Construir um depósito', done: () => hasBuiltObject('crate') }
      ]
    },
    {
      key: 'research',
      label: 'Tier 3 — Pesquisa e Produção',
      note: 'Desbloqueie estruturas que mudam o ritmo da colônia.',
      goals: [
        { key: 'researchDesk', label: 'Construir uma mesa de pesquisa', done: () => hasBuiltObject('research_desk') },
        { key: 'metalworking', label: 'Concluir Metalurgia básica', done: () => hasResearch('metalworking') },
        { key: 'forge1', label: 'Construir uma forja', done: () => hasBuiltObject('forge') },
        { key: 'cooking', label: 'Concluir Cozinha de sobrevivência', done: () => hasResearch('cooking') }
      ]
    },
    {
      key: 'advanced',
      label: 'Tier 4 — Colônia Estável',
      note: 'Prepare a base para eventos mais difíceis e exploração.',
      goals: [
        { key: 'stove1', label: 'Construir um fogão', done: () => hasBuiltObject('stove') },
        { key: 'medicine', label: 'Concluir Primeiros socorros', done: () => hasResearch('medicine') },
        { key: 'medStation', label: 'Construir uma estação médica', done: () => hasBuiltObject('med_station') },
        { key: 'day3', label: 'Sobreviver até o dia 3', done: () => (state?.day || 1) >= 3 }
      ]
    }
  ];

  function applyRuntimeSettings() {
    document.body.dataset.uiScale = settings.uiScale || 'normal';
    showDebugGrid = !!settings.showGrid;
    camera.speed = Number(settings.cameraSpeed || 720);
  }

  const originalSaveSettings = saveSettings;
  saveSettings = function patchedSaveSettings() {
    originalSaveSettings();
    applyRuntimeSettings();
  };

  function injectQolStyles() {
    if (document.getElementById('qolPatchStyles')) return;
    const style = document.createElement('style');
    style.id = 'qolPatchStyles';
    style.textContent = `
      body[data-ui-scale="compact"] { --top-h: 56px; --bottom-h: 164px; }
      body[data-ui-scale="large"] { --top-h: 76px; --bottom-h: 226px; }
      .settings-actions { margin-top: 14px; flex-wrap: wrap; }
      .controls-cheatsheet { font-size: 13px; line-height: 1.55; }
      button:focus-visible, input:focus-visible, select:focus-visible {
        outline: 2px solid rgba(121, 199, 232, .88);
        outline-offset: 2px;
      }
      body.hud-hidden .topbar,
      body.hud-hidden .bottom-command-panel {
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity .12s ease, transform .12s ease;
      }
      body.hud-hidden::after {
        content: "HUD oculto · pressione H para mostrar";
        position: fixed;
        right: 16px;
        bottom: 14px;
        z-index: 20;
        color: rgba(244,239,228,.76);
        background: rgba(8, 11, 16, .58);
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 999px;
        padding: 7px 11px;
        font-size: 12px;
        backdrop-filter: blur(10px);
      }

      .bottom-command-panel {
        max-height: min(34vh, 250px);
        overflow: hidden;
      }
      .bottom-panel-content {
        min-height: 0;
        max-height: calc(min(34vh, 250px) - 52px);
        overflow: hidden;
      }
      .bottom-tab-panel.active {
        min-height: 0;
        max-height: calc(min(34vh, 250px) - 62px);
        overflow: hidden;
      }
      .compact-grid,
      .recipe-grid,
      .colonist-strip,
      .resource-strip,
      .item-strip {
        overflow: hidden;
        align-content: start;
      }
      #eventLogPanel.active {
        overflow: hidden;
      }
      #eventLogPanel #log {
        max-height: 112px;
        overflow: hidden;
        position: relative;
      }
      #eventLogPanel:not(.expanded) #log::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 38px;
        pointer-events: none;
        background: linear-gradient(to bottom, rgba(16,19,26,0), rgba(16,19,26,.96));
      }
      #eventLogPanel.expanded #log {
        max-height: calc(min(52vh, 420px) - 92px);
        overflow: auto;
      }
      #eventLogPanel.expanded {
        max-height: min(52vh, 420px);
        overflow: hidden;
      }
      .event-log-more-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }
      .event-log-more-row button {
        min-height: 28px;
        padding: 5px 12px;
        border-radius: 999px;
      }
      .wall-orientation-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 8px;
        padding: 4px 9px;
        border-radius: 999px;
        border: 1px solid rgba(244, 179, 80, .38);
        background: rgba(244, 179, 80, .10);
        color: #f3cf8a;
        font-size: 12px;
        font-weight: 800;
      }
      .alpha-progress-card {
        display: grid;
        gap: 8px;
      }
      .alpha-progress-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .alpha-progress-head b {
        color: #eaf6ff;
      }
      .alpha-tier-pill {
        white-space: nowrap;
        border: 1px solid rgba(155, 211, 106, .32);
        background: rgba(155, 211, 106, .10);
        color: #c8f09a;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 900;
      }
      .alpha-goal-list {
        display: grid;
        gap: 5px;
      }
      .alpha-goal {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 24px;
        padding: 5px 7px;
        border-radius: 10px;
        background: rgba(255,255,255,.035);
        color: rgba(232,241,255,.78);
        font-size: 12px;
        font-weight: 800;
      }
      .alpha-goal.done {
        color: #c8f09a;
        background: rgba(155, 211, 106, .07);
      }
      .alpha-goal span:first-child {
        width: 18px;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  function toggleFullscreenMode() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      root.requestFullscreen?.().catch?.(() => log?.('Não foi possível entrar em fullscreen.'));
    } else {
      document.exitFullscreen?.();
    }
  }

  function setHudHidden(hidden, shouldLog = true) {
    document.body.classList.toggle('hud-hidden', !!hidden);
    if (shouldLog && state) log(hidden ? 'HUD oculto. Pressione H para mostrar novamente.' : 'HUD visível.');
  }

  function injectSettingsControls() {
    const grid = document.querySelector('#settingsScreen .form-grid');
    if (!grid || document.getElementById('showGridSelect')) return;

    grid.insertAdjacentHTML('beforeend', `
      <label>Grade de debug
        <select id="showGridSelect">
          <option value="off">Desligada</option>
          <option value="on">Ligada</option>
        </select>
      </label>
      <label>Velocidade da câmera
        <select id="cameraSpeedSelect">
          <option value="560">Lenta</option>
          <option value="720">Normal</option>
          <option value="920">Rápida</option>
          <option value="1180">Muito rápida</option>
        </select>
      </label>
      <label>Zoom padrão
        <select id="defaultZoomSelect">
          <option value="0.85">Afastado</option>
          <option value="1.12">Normal</option>
          <option value="1.35">Aproximado</option>
          <option value="1.65">Bem próximo</option>
        </select>
      </label>
      <label>Modo tela cheia
        <button id="fullscreenToggleBtn" type="button" class="secondary">Alternar fullscreen</button>
      </label>
    `);

    const card = document.querySelector('#settingsScreen .menu-card');
    card?.insertAdjacentHTML('beforeend', `
      <div class="menu-actions row settings-actions">
        <button id="centerCameraBtn" type="button" class="secondary">Centralizar câmera no colono</button>
        <button id="resetViewBtn" type="button" class="secondary">Resetar zoom/câmera</button>
      </div>
      <div class="subtle-box controls-cheatsheet">
        <b>Atalhos:</b> WASD/setas movem a câmera · Shift acelera · Scroll/+/- ajusta zoom · 0 reseta zoom · C centraliza no colono · R rotaciona parede · G liga/desliga grade · H oculta HUD · F alterna fullscreen · ESC pausa.
      </div>
    `);
  }

  function syncSettingsControls() {
    const gridSelect = document.getElementById('showGridSelect');
    const speedSelect = document.getElementById('cameraSpeedSelect');
    const zoomSelect = document.getElementById('defaultZoomSelect');
    if (gridSelect) gridSelect.value = settings.showGrid ? 'on' : 'off';
    if (speedSelect) speedSelect.value = String(settings.cameraSpeed || 720);
    if (zoomSelect) zoomSelect.value = String(settings.defaultZoom || 1.12);
  }

  function attachQolControlEvents() {
    document.getElementById('showGridSelect')?.addEventListener('change', e => {
      settings.showGrid = e.target.value === 'on';
      saveSettings();
      log(settings.showGrid ? 'Grade de debug ligada pelas configurações.' : 'Grade de debug desligada pelas configurações.');
      updateUI(true);
    });

    document.getElementById('cameraSpeedSelect')?.addEventListener('change', e => {
      settings.cameraSpeed = Number(e.target.value || 720);
      saveSettings();
      log(`Velocidade da câmera ajustada para ${settings.cameraSpeed}.`);
    });

    document.getElementById('defaultZoomSelect')?.addEventListener('change', e => {
      settings.defaultZoom = Number(e.target.value || 1.12);
      saveSettings();
      setCameraZoom(settings.defaultZoom);
      log('Zoom padrão atualizado.');
    });

    document.getElementById('fullscreenToggleBtn')?.addEventListener('click', toggleFullscreenMode);
    document.getElementById('centerCameraBtn')?.addEventListener('click', () => {
      centerCameraOnSelectedColonist();
      setScreen(SCREEN.PLAYING);
    });
    document.getElementById('resetViewBtn')?.addEventListener('click', () => {
      setCameraZoom(Number(settings.defaultZoom || 1.12));
      centerCameraOnSelectedColonist();
      setScreen(SCREEN.PLAYING);
    });
  }

  function toggleWallOrientation() {
    wallBuildOrientation = wallBuildOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    if (state) log(`Orientação da parede: ${wallBuildOrientation === 'horizontal' ? 'horizontal' : 'vertical'}.`);
    updateUI(true);
  }

  function attachQolShortcuts() {
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleFullscreenMode();
        return;
      }
      if (!state || appScreen !== SCREEN.PLAYING) return;
      if (e.code === 'KeyR' && currentBuild === 'wall') {
        e.preventDefault();
        toggleWallOrientation();
        return;
      }
      if (e.code === 'KeyC') {
        e.preventDefault();
        centerCameraOnSelectedColonist();
        return;
      }
      if (e.code === 'KeyH') {
        e.preventDefault();
        setHudHidden(!document.body.classList.contains('hud-hidden'));
        return;
      }
      if (e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        setCameraZoom(Number(settings.defaultZoom || 1.12));
        centerCameraOnSelectedColonist();
      }
    });
  }

  function installEventLogClamp() {
    const panel = document.getElementById('eventLogPanel');
    if (!panel || document.getElementById('eventLogMoreBtn')) return;
    const row = document.createElement('div');
    row.className = 'event-log-more-row';
    row.innerHTML = '<button id="eventLogMoreBtn" class="secondary" type="button">Mais</button>';
    panel.appendChild(row);
    row.querySelector('button').addEventListener('click', () => {
      eventLogExpanded = !eventLogExpanded;
      panel.classList.toggle('expanded', eventLogExpanded);
      row.querySelector('button').textContent = eventLogExpanded ? 'Menos' : 'Mais';
    });
  }

  function sanitizeWorldForQol(force = false) {
    if (!state?.objects || (worldSanitizedForQol && !force)) return;
    worldSanitizedForQol = true;
    let hiddenOre = 0;
    for (const obj of state.objects) {
      if (obj.type === 'ore') {
        obj.imgOverride = 'rock';
        obj.nameOverride = 'rocha mineralizada';
        obj.unknown = false;
        hiddenOre++;
      }
    }
    if (objectDefs.ore) {
      objectDefs.ore.img = 'rock';
      objectDefs.ore.name = 'rocha mineralizada';
      objectDefs.ore.gather = { stone: 4, metal: 2 };
      objectDefs.ore.work = Math.max(objectDefs.ore.work || 4, 4.2);
    }
    if (hiddenOre && state.log && !state._qolOreNoteLogged) {
      state._qolOreNoteLogged = true;
      log('Depósitos de metal agora aparecem como rochas mineralizadas, não como barras soltas no mapa.');
    }
  }

  function resetStaleOnlineForSingleplayer() {
    if (!state || window.havenfallOnlineSessionActive === true || state.config?.multiplayer) return;
    sessionStorage.removeItem('havenfall-online-mode');
    window.havenfallOnlineMode = null;
    document.body.classList.remove('online-join-mode', 'online-host-mode');
  }

  function hasBuiltObject(type) {
    return !!state?.objects?.some(o => o.type === type);
  }

  function countBuiltObject(type) {
    return state?.objects?.filter(o => o.type === type).length || 0;
  }

  function hasResearch(key) {
    return !!state?.research?.completed?.includes(key);
  }

  function hasAnyItemOrEquipped(keys) {
    const set = new Set(keys);
    if (Object.entries(state?.items || {}).some(([key, qty]) => set.has(key) && qty > 0)) return true;
    return !!state?.colonists?.some(c => [c.equipment?.tool, c.equipment?.weapon, c.equipment?.offhand].some(key => set.has(key)));
  }

  function alphaGoalSignature() {
    return alphaTiers.flatMap(tier => tier.goals.map(goal => `${goal.key}:${goal.done() ? 1 : 0}`)).join('|');
  }

  function alphaTierProgress(tier) {
    const done = tier.goals.filter(goal => goal.done()).length;
    return { done, total: tier.goals.length, complete: done >= tier.goals.length };
  }

  function currentAlphaTier() {
    return alphaTiers.find(tier => !alphaTierProgress(tier).complete) || alphaTiers[alphaTiers.length - 1];
  }

  function announceAlphaProgression() {
    if (!state || !state.log) return;
    const tier = currentAlphaTier();
    const signature = alphaGoalSignature();
    if (lastAlphaTierKey === null) lastAlphaTierKey = tier.key;
    if (lastAlphaDoneSignature === '') lastAlphaDoneSignature = signature;
    if (tier.key !== lastAlphaTierKey) {
      lastAlphaTierKey = tier.key;
      log(`Novo avanço: ${tier.label}.`);
    }
    lastAlphaDoneSignature = signature;
  }

  function renderAlphaProgression() {
    if (!dom.goalList || !state) return;
    const tier = currentAlphaTier();
    const progress = alphaTierProgress(tier);
    const completedTiers = alphaTiers.filter(t => alphaTierProgress(t).complete).length;
    dom.goalList.innerHTML = `
      <div class="alpha-progress-card">
        <div class="alpha-progress-head">
          <div><b>Alpha 1.0 — Progressão</b><br><span class="empty">${escapeHtml(tier.note)}</span></div>
          <span class="alpha-tier-pill">${completedTiers}/${alphaTiers.length} tiers</span>
        </div>
        <div><b>${escapeHtml(tier.label)}</b> <span class="empty">${progress.done}/${progress.total}</span></div>
        <div class="alpha-goal-list">
          ${tier.goals.map(goal => `<div class="alpha-goal ${goal.done() ? 'done' : ''}"><span>${goal.done() ? '✓' : '•'}</span><span>${escapeHtml(goal.label)}</span></div>`).join('')}
        </div>
      </div>
    `;
    announceAlphaProgression();
  }

  function candidateGatherTiles(obj, c) {
    const dirs = [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    return dirs
      .map(([dx, dy]) => ({ x: obj.x + dx, y: obj.y + dy }))
      .filter(tile => isInside(tile.x, tile.y) && !isBlocked(tile.x, tile.y))
      .map(tile => ({ ...tile, distance: dist(c.x, c.y, tile.x, tile.y), path: findPath(c.x, c.y, tile.x, tile.y, obj) }))
      .filter(tile => (tile.x === c.x && tile.y === c.y) || tile.path.length)
      .sort((a, b) => (a.path.length || 0) - (b.path.length || 0) || a.distance - b.distance);
  }

  function assignGatherStable(c, obj, options = {}) {
    if (!c || !obj || !state) return false;
    const def = objectDefs[obj.type];
    if (!def?.gather) return false;
    if (obj.type === 'crop' && (obj.growth || 0) < 100) {
      if (!options.silent) log('Essa plantação ainda não está pronta para coleta.');
      return false;
    }

    const choices = candidateGatherTiles(obj, c);
    if (!choices.length) {
      if (!options.silent) log(`${c.name} não encontrou caminho livre até ${def.name}.`);
      return false;
    }

    const target = choices[0];
    obj.markedForGather = true;
    c.task = { type: 'gather', objId: obj.id, x: target.x, y: target.y };
    c.path = (target.x === c.x && target.y === c.y) ? [] : target.path;
    c.work = 0;
    c.note = `Indo coletar ${def.name}`;
    if (!options.silent) log(`${c.name} vai coletar ${def.name}.`);
    updateUI(true);
    return true;
  }

  function nearestUsableColonist(tile) {
    const list = (state?.colonists || []).filter(c => !c.dead && c.health > 15 && c.energy > 10);
    const selected = selectedColonist();
    if (selected && list.includes(selected)) return selected;
    return list.sort((a, b) => dist(a.x, a.y, tile.x, tile.y) - dist(b.x, b.y, tile.x, tile.y))[0] || null;
  }

  function clearBadGatherTasks() {
    if (!state?.colonists) return;
    for (const c of state.colonists) {
      if (c.task?.type !== 'gather') continue;
      const obj = state.objects.find(o => o.id === c.task.objId);
      if (!obj || !objectDefs[obj.type]?.gather) {
        c.task = null;
        c.path = [];
        c.work = 0;
        c.note = 'Coleta cancelada';
        continue;
      }
      const atTarget = c.x === c.task.x && c.y === c.task.y;
      if (!atTarget && (!c.path || !c.path.length)) {
        const choices = candidateGatherTiles(obj, c);
        if (choices.length) {
          c.task.x = choices[0].x;
          c.task.y = choices[0].y;
          c.path = choices[0].path;
          c.note = `Recalculando coleta de ${objectDefs[obj.type].name}`;
        } else {
          c.task = null;
          c.path = [];
          c.work = 0;
          c.note = 'Sem caminho para coleta';
        }
      }
    }
  }

  const originalAssignGather = assignGather;
  assignGather = function patchedAssignGather(c, obj) {
    return assignGatherStable(c, obj) || originalAssignGather(c, obj);
  };

  const originalToggleGatherMark = toggleGatherMark;
  toggleGatherMark = function patchedToggleGatherMark(obj) {
    if (!obj || !isGatherableReady(obj)) return originalToggleGatherMark(obj);
    obj.markedForGather = !obj.markedForGather;
    log(`${objectDefs[obj.type]?.name || 'Recurso'} ${obj.markedForGather ? 'marcado para coleta' : 'desmarcado'}.`);
    if (obj.markedForGather) assignMarkedGatherTasks();
    updateUI(true);
  };

  const originalAssignMarkedGatherTasks = assignMarkedGatherTasks;
  assignMarkedGatherTasks = function patchedAssignMarkedGatherTasks() {
    const idle = state?.colonists?.filter(c => !c.task && c.energy > 14 && c.health > 15) || [];
    let assigned = 0;
    for (const c of idle) {
      const target = nearestGatherable(c, true);
      if (!target) break;
      if (assignGatherStable(c, target, { silent: true })) assigned++;
      else target.markedForGather = false;
    }
    if (!assigned) originalAssignMarkedGatherTasks();
  };

  const originalMakeContextActions = makeContextActions;
  makeContextActions = function patchedGatherContextActions(c, target, tile) {
    const actions = originalMakeContextActions(c, target, tile);
    const obj = target?.kind === 'object' ? target.obj : null;
    if (!obj || !isGatherableReady(obj)) return actions;

    const clean = actions.filter(action => !/coletar|coleta|marcar/i.test(action.label || ''));
    clean.unshift({
      label: `Coletar ${objectDefs[obj.type]?.name || 'recurso'}`,
      hint: 'manda o colono selecionado ir até um tile livre e coletar',
      run: () => {
        const worker = nearestUsableColonist({ x: obj.x, y: obj.y });
        if (!worker) { log('Nenhum colono disponível para coletar agora.'); return; }
        selectedColonistId = worker.id;
        assignGatherStable(worker, obj);
      }
    });
    clean.unshift({
      label: obj.markedForGather ? 'Desmarcar coleta' : 'Marcar para coleta',
      hint: 'deixa esse recurso na fila automática de coleta',
      run: () => toggleGatherMark(obj)
    });
    return clean;
  };

  const originalAssignAutoTask = assignAutoTask;
  assignAutoTask = function patchedAssignAutoTask(c) {
    if (!c) return false;
    c.autoThinkCooldown = c.autoThinkCooldown ?? (1.2 + Math.random() * 2.2);
    if (c.autoThinkCooldown > 0) {
      if (!c.note || c.note === 'Ocioso') c.note = 'Aguardando ordem';
      return false;
    }
    const assigned = originalAssignAutoTask(c);
    c.autoThinkCooldown = assigned ? 2.8 + Math.random() * 3.5 : 5.5 + Math.random() * 6;
    return assigned;
  };

  const originalRandomWander = randomWander;
  randomWander = function patchedRandomWander(c) {
    if (!c) return;
    c.wanderCooldown = c.wanderCooldown ?? (22 + Math.random() * 18);
    if (c.wanderCooldown > 0) return;
    c.wanderCooldown = 34 + Math.random() * 28;
    originalRandomWander(c);
  };

  const originalUpdateColonist = updateColonist;
  updateColonist = function patchedUpdateColonist(c, dt) {
    const tick = dt * (state?.speed || 1);
    if (c.autoThinkCooldown > 0) c.autoThinkCooldown = Math.max(0, c.autoThinkCooldown - tick);
    if (c.wanderCooldown > 0) c.wanderCooldown = Math.max(0, c.wanderCooldown - tick);
    originalUpdateColonist(c, dt);
  };

  const originalHandleTaskAtTarget = handleTaskAtTarget;
  handleTaskAtTarget = function patchedHandleTaskAtTarget(c, tick) {
    const task = c?.task;
    if (task?.type !== 'gather') return originalHandleTaskAtTarget(c, tick);

    const obj = state.objects.find(o => o.id === task.objId);
    if (!obj) { c.task = null; c.note = 'Ocioso'; return; }
    const def = objectDefs[obj.type];
    if (!def?.gather) return originalHandleTaskAtTarget(c, tick);

    c.work += tick * workRate(c, 'gather', obj);
    c.note = `Coletando ${def.name} ${Math.min(100, Math.floor((c.work / def.work) * 100))}%`;

    if (c.work < def.work) return;

    const gain = { ...def.gather };
    if (obj.type === 'rock') {
      const hasPickaxe = c.equipment?.tool === 'pickaxe';
      const chance = hasPickaxe ? 0.34 : 0.20;
      if (Math.random() < chance) {
        gain.metal = (gain.metal || 0) + 1;
        log(`${c.name} encontrou um pequeno veio metálico dentro da rocha.`);
      }
    }
    if (obj.type === 'ore') {
      gain.stone = Math.max(gain.stone || 0, 2);
      gain.metal = Math.max(gain.metal || 0, 2);
    }

    addResources(gain);
    state.objects = state.objects.filter(o => o.id !== obj.id);
    if (obj.type === 'tree') state.objects.push({ id: uid(), type: 'logs', x: obj.x, y: obj.y });
    if (obj.type === 'crop') state.objects.push({ id: uid(), type: 'crop', x: obj.x, y: obj.y, growth: 0 });
    log(`${c.name} coletou ${def.name}.`);
    c.task = null; c.note = 'Ocioso'; c.work = 0;
    updateUI(true);
  };

  const originalPlaceBlueprint = placeBlueprint;
  placeBlueprint = function patchedPlaceBlueprint(buildKey, x, y) {
    const before = state?.objects?.length || 0;
    originalPlaceBlueprint(buildKey, x, y);
    if (buildKey !== 'wall' || !state?.objects || state.objects.length <= before) return;
    const placed = [...state.objects].reverse().find(o => o.type === 'blueprint' && o.buildType === 'wall' && o.x === x && o.y === y);
    if (placed) {
      placed.orientation = wallBuildOrientation;
      placed.rotation = wallBuildOrientation === 'vertical' ? 90 : 0;
    }
  };

  const originalDrawObject = drawObject;
  drawObject = function patchedDrawObject(obj) {
    const isWall = obj?.type === 'wall' || (obj?.type === 'blueprint' && obj?.buildType === 'wall');
    if (!isWall) return originalDrawObject(obj);

    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2;
    const isBlueprint = obj.type === 'blueprint';
    const type = isBlueprint ? buildDefs[obj.buildType].type : obj.type;
    const img = images[objectDefs[type]?.img];
    const vertical = obj.orientation === 'vertical' || obj.rotation === 90;

    ctx.save();
    if (isBlueprint) ctx.globalAlpha = 0.42;
    ctx.translate(cx, cy + 22);
    if (vertical) ctx.rotate(Math.PI / 2);
    drawAsset(img, 0, 0, objectScale(type), 0.5, 0.5, false);
    ctx.restore();

    if (isBlueprint) drawProgress(cx, obj.y * TILE + 8, (obj.progress || 0) / buildDefs[obj.buildType].work, '#9bd36a');
  };

  const originalDrawBuildPreview = drawBuildPreview;
  drawBuildPreview = function patchedDrawBuildPreview() {
    if (currentBuild !== 'wall') return originalDrawBuildPreview();
    if (!mouseTile || !isInside(mouseTile.x, mouseTile.y)) return;
    const def = buildDefs.wall;
    const can = canPlace(def.type, mouseTile.x, mouseTile.y);
    const cx = mouseTile.x * TILE + TILE / 2;
    const cy = mouseTile.y * TILE + TILE / 2;
    ctx.save();
    ctx.globalAlpha = can ? 0.55 : 0.25;
    ctx.translate(cx, cy + 22);
    if (wallBuildOrientation === 'vertical') ctx.rotate(Math.PI / 2);
    drawAsset(images[objectDefs.wall.img], 0, 0, objectScale('wall'), 0.5, 0.5, false);
    ctx.restore();
  };

  function refreshWallBuildStatus() {
    if (!dom.buildStatus || currentBuild !== 'wall') return;
    const orientation = wallBuildOrientation === 'horizontal' ? 'horizontal' : 'vertical';
    dom.buildStatus.innerHTML = `Construindo: Parede. Clique no chão do mapa. <span class="wall-orientation-pill">R: ${orientation}</span>`;
  }

  function checkAlphaGameOver() {
    if (!state || state.gameOver || appScreen !== SCREEN.PLAYING || !activeSession) return;
    const colonists = state.colonists || [];
    if (!colonists.length) return;
    const alive = colonists.some(c => !c.dead && (c.health ?? 100) > 0);
    if (alive) return;
    state.gameOver = true;
    state.paused = true;
    log('Fim da colônia: nenhum colono sobreviveu.');
    updateUI(true);
  }

  const originalUpdateUI = updateUI;
  updateUI = function patchedUpdateUI(force = false) {
    resetStaleOnlineForSingleplayer();
    sanitizeWorldForQol();
    clearBadGatherTasks();
    originalUpdateUI(force);
    installEventLogClamp();
    refreshWallBuildStatus();
    renderAlphaProgression();
    checkAlphaGameOver();
  };

  const originalStartNewGame = startNewGame;
  startNewGame = function patchedStartNewGame(config, selectedColonists) {
    worldSanitizedForQol = false;
    lastAlphaTierKey = null;
    lastAlphaDoneSignature = '';
    originalStartNewGame(config, selectedColonists);
    sanitizeWorldForQol(true);
    resetStaleOnlineForSingleplayer();
    updateUI(true);
  };

  const originalLoadGame = loadGame;
  loadGame = function patchedLoadGame() {
    const result = originalLoadGame();
    worldSanitizedForQol = false;
    sanitizeWorldForQol(true);
    resetStaleOnlineForSingleplayer();
    updateUI(true);
    return result;
  };

  const originalSetupEventListeners = setupEventListeners;
  setupEventListeners = function patchedSetupEventListeners() {
    injectSettingsControls();
    syncSettingsControls();
    originalSetupEventListeners();
    attachQolControlEvents();
    attachQolShortcuts();
  };

  const originalSetScreen = setScreen;
  setScreen = function patchedSetScreen(screen) {
    originalSetScreen(screen);
    if (screen === SCREEN.SETTINGS) syncSettingsControls();
    if (screen === SCREEN.PLAYING) renderAlphaProgression();
  };

  injectQolStyles();
  applyRuntimeSettings();
}
