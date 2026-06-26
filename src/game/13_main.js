'use strict';

settings = loadSettings();
showDebugGrid = !!settings.showGrid;

function bootGame() {
  loadImages().then(() => {
    setupEventListeners();
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    state = createInitialState({ ...defaultNewGameConfig, colonyName: 'First Haven', seed: 'preview-menu' });
    activeSession = false;
    ensureResearchState();
    refreshMenuSaveInfo();
    refreshLoadScreen();
    updateUI(true);
    setScreen(SCREEN.MAIN_MENU);
    resizeGameCanvas();
    window.addEventListener('resize', resizeGameCanvas);
    requestAnimationFrame(gameLoop);
  }).catch(err => {
    console.error(err);
    alert('Falha ao carregar assets do jogo. Veja o console.');
  });
}

function loadScript(src) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function installCleanOnlineAndStationMenus() {
  const ONLINE_SCREEN = 'ONLINE';
  const stationKinds = ['bench', 'forge', 'stove', 'med_station'];
  let activeStationId = null;
  let onlineStatusTimer = null;

  const isVisitor = () => sessionStorage.getItem('havenfall-online-mode') === 'join' || window.havenfallOnlineMode === 'join';
  const sprite = name => typeof spriteSrc === 'function' ? spriteSrc(name) : `assets/sprites/${name}.png`;
  const isStation = obj => !!obj && stationKinds.includes(obj.type);
  const stationTitle = type => stationLabels[type] || objectDefs[type]?.name || type;
  const stationIcon = type => ({ bench: 'crafting_bench', forge: 'stove', stove: 'stove', med_station: 'med_station' })[type] || objectDefs[type]?.img || 'tool_hammer';
  const stationDesc = type => ({
    bench: 'Ferramentas, armas simples e peças básicas.',
    forge: 'Metal, armas melhores e equipamentos reforçados.',
    stove: 'Comida preparada e receitas de sobrevivência.',
    med_station: 'Itens de tratamento e apoio médico.'
  })[type] || 'Receitas desta estação.';

  function ensurePatchStyles() {
    if (document.getElementById('cleanOnlineStationStyles')) return;
    const style = document.createElement('style');
    style.id = 'cleanOnlineStationStyles';
    style.textContent = `
      button[data-tab="crafting"], #craftingPanel { display:none!important; }
      .online-card { max-width: 980px; }
      .online-grid { display:grid; grid-template-columns:repeat(2,minmax(260px,1fr)); gap:12px; margin:14px 0; }
      .online-mode-card,.online-status-box,.online-share-box { background:rgba(18,22,31,.68); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:13px; }
      .online-mode-card button { width:100%; margin-top:10px; }
      .online-mode-card p,.online-share-box p,.online-status-box span { color:rgba(232,241,255,.74); }
      #onlineShareLink { min-width:0; }
      .station-overlay { position:fixed; inset:0; z-index:140; display:none; place-items:center; background:rgba(2,4,8,.60); backdrop-filter:blur(3px); padding:18px; }
      .station-overlay.show { display:grid; }
      .station-window { position:relative; width:min(1080px,96vw); max-height:88vh; overflow:auto; border-radius:22px; border:1px solid rgba(255,255,255,.14); background:linear-gradient(145deg,rgba(14,18,27,.98),rgba(27,31,42,.98)); box-shadow:0 24px 80px rgba(0,0,0,.48); padding:18px; }
      .station-close { position:absolute; right:14px; top:12px; width:36px; height:36px; border-radius:50%; }
      .station-head { display:flex; gap:14px; align-items:center; padding-right:44px; }
      .station-head img { width:72px; height:72px; object-fit:contain; background:rgba(255,255,255,.04); border-radius:14px; padding:7px; }
      .station-head h1 { margin:2px 0 4px; }
      .station-head p { margin:0; color:rgba(232,241,255,.72); }
      .station-meta { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0; }
      .station-meta span { border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.045); border-radius:999px; padding:6px 9px; color:rgba(232,241,255,.78); font-size:12px; font-weight:800; }
      .station-layout { display:grid; grid-template-columns:220px 1fr; gap:14px; }
      .station-list,.station-recipes { border:1px solid rgba(255,255,255,.1); background:rgba(7,11,17,.35); border-radius:16px; padding:12px; }
      .station-switch { width:100%; margin-bottom:8px; text-align:left; display:flex; justify-content:space-between; gap:8px; }
      .station-switch.active,.station-recipe:not(.locked):hover { border-color:rgba(155,211,106,.62); box-shadow:0 0 0 2px rgba(155,211,106,.13) inset; }
      .station-recipe-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }
      .station-recipe { min-height:178px; text-align:left; display:flex; flex-direction:column; align-items:flex-start; gap:5px; }
      .station-recipe img { width:42px; height:42px; object-fit:contain; background:rgba(26,32,48,.86); border-radius:8px; padding:4px; }
      .station-recipe small,.station-recipe em { color:rgba(232,241,255,.68); font-size:11px; }
      .station-recipe.locked { opacity:.58; }
      @media(max-width:820px){ .station-layout,.online-grid{ grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function ensureOnlineScreen() {
    let screen = document.getElementById('onlineScreenClean');
    if (screen) return screen;
    screen = document.createElement('section');
    screen.id = 'onlineScreenClean';
    screen.className = 'screen setup-screen';
    screen.innerHTML = `
      <div class="menu-card wide-card online-card">
        <div class="screen-title-row"><div><div class="kicker">Online</div><h1>Multiplayer</h1><p>Hosteie tua partida ou entre em um mundo ativo pelo próprio menu.</p></div><button id="onlineBackCleanBtn" class="secondary">Voltar</button></div>
        <div id="onlineStatusClean" class="online-status-box">Verificando...</div>
        <div class="online-grid">
          <div class="online-mode-card"><h2>Hostear mundo</h2><p>Abre tua partida atual para visitantes acompanharem.</p><button id="onlineHostCleanBtn">Hostear / continuar</button></div>
          <div class="online-mode-card"><h2>Entrar em mundo</h2><p>Entra como visitante em um host ativo.</p><button id="onlineJoinCleanBtn">Entrar no mundo</button></div>
        </div>
        <div class="online-share-box"><h3>Convite</h3><p>Copie o link desta sessão. Quem receber entra pelo menu Online.</p><div class="inline-field"><input id="onlineShareCleanInput" type="text" readonly><button id="onlineCopyCleanBtn" class="secondary">Copiar link</button></div></div>
      </div>`;
    document.getElementById('app').appendChild(screen);
    document.getElementById('onlineBackCleanBtn').addEventListener('click', () => setScreen(SCREEN.MAIN_MENU));
    document.getElementById('onlineHostCleanBtn').addEventListener('click', hostFromOnlineMenu);
    document.getElementById('onlineJoinCleanBtn').addEventListener('click', joinFromOnlineMenu);
    document.getElementById('onlineCopyCleanBtn').addEventListener('click', copyOnlineLink);
    return screen;
  }

  function ensureOnlineButton() {
    const menu = document.querySelector('.classic-menu-list');
    if (!menu || document.getElementById('openOnlineCleanBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'openOnlineCleanBtn';
    btn.className = 'classic-menu-item';
    btn.textContent = 'Online';
    menu.insertBefore(btn, document.getElementById('openSettingsBtn') || null);
    btn.addEventListener('click', () => setScreen(ONLINE_SCREEN));
  }

  function sessionUrl() { return `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}`; }
  function onlineBox(html) { const el = document.getElementById('onlineStatusClean'); if (el) el.innerHTML = html; }

  async function refreshOnlineStatus() {
    ensureOnlineScreen();
    const input = document.getElementById('onlineShareCleanInput');
    if (input) input.value = sessionUrl();
    try {
      const res = await fetch('/api/multiplayer/status', { cache: 'no-store' });
      const data = await res.json();
      if (!data.online) onlineBox('<b>Status:</b> nenhum host ativo agora.');
      else onlineBox(`<b>Status:</b> mundo online disponível.<br><span>Mundo: <b>${escapeHtml(data.colonyName || 'Colônia')}</b> · Dia ${escapeHtml(data.day || '?')} · Seed ${escapeHtml(data.seed || '?')}</span>`);
    } catch (_) { onlineBox('<b>Status:</b> servidor online indisponível nesta sessão.'); }
  }

  async function copyOnlineLink() {
    try { await navigator.clipboard.writeText(sessionUrl()); onlineBox('<b>Status:</b> link copiado.'); }
    catch (_) { onlineBox(`<b>Link:</b> ${escapeHtml(sessionUrl())}`); }
  }

  function hostFromOnlineMenu() {
    if (activeSession && state && state.config?.seed !== 'preview-menu') { window.havenfallHostOnline?.(); setScreen(SCREEN.PLAYING); return; }
    if (localStorage.getItem(SAVE_KEY) && loadGame()) { activeSession = true; window.havenfallHostOnline?.(); setScreen(SCREEN.PLAYING); return; }
    writeNewGameConfig({ ...defaultNewGameConfig, seed: generateRandomSeed() });
    setScreen(SCREEN.NEW_GAME_SETUP);
  }

  function joinFromOnlineMenu() {
    sessionStorage.setItem('havenfall-online-mode', 'join');
    window.havenfallJoinOnline?.();
    onlineBox('<b>Status:</b> entrando como visitante...');
  }

  const previousSetScreen = setScreen;
  setScreen = function cleanOnlineSetScreen(screen) {
    if (screen === ONLINE_SCREEN) {
      previousScreen = appScreen;
      appScreen = ONLINE_SCREEN;
      Object.values(dom.screens).forEach(el => el && el.classList.remove('active'));
      ensureOnlineScreen().classList.add('active');
      if (dom.pauseOverlay) dom.pauseOverlay.classList.remove('show');
      if (state) state.paused = true;
      refreshOnlineStatus();
      if (onlineStatusTimer) clearInterval(onlineStatusTimer);
      onlineStatusTimer = setInterval(refreshOnlineStatus, 2000);
      return;
    }
    if (onlineStatusTimer) clearInterval(onlineStatusTimer);
    onlineStatusTimer = null;
    document.getElementById('onlineScreenClean')?.classList.remove('active');
    previousSetScreen(screen);
  };

  function ensureStationOverlay() {
    let overlay = document.getElementById('stationOverlayClean');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'stationOverlayClean';
    overlay.className = 'station-overlay';
    overlay.innerHTML = '<div class="station-window"><button id="stationCloseCleanBtn" class="station-close">×</button><div id="stationContentClean"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('#stationCloseCleanBtn')) return closeStationMenu();
      const craft = event.target.closest('[data-station-craft]');
      if (craft) {
        const station = activeStation();
        const c = selectedColonist();
        if (isVisitor()) { log('Visitante não pode fabricar nesta versão.'); return; }
        if (station && c) assignCraft(c, craft.dataset.stationCraft, station);
        renderStationMenu(station);
        updateUI(true);
        return;
      }
      const sw = event.target.closest('[data-station-switch]');
      if (sw) {
        const station = state.objects.find(o => o.id === Number(sw.dataset.stationSwitch));
        if (station) openStationMenu(station);
      }
    });
    return overlay;
  }

  function activeStation() { return activeStationId ? state?.objects?.find(o => o.id === activeStationId) : null; }
  function closeStationMenu() { activeStationId = null; document.getElementById('stationOverlayClean')?.classList.remove('show'); }

  function recipeReady(key, recipe, c) { return !isVisitor() && !!c && recipeUnlocked(key) && hasRecipeCost(recipe); }
  function recipeHint(key, recipe, c) {
    if (isVisitor()) return 'Disponível para o host.';
    if (!c) return 'Selecione um colono.';
    if (!recipeUnlocked(key)) return `Pesquise ${researchDefs[recipe.unlock]?.label || recipe.unlock}.`;
    if (!hasRecipeCost(recipe)) return `Faltam: ${itemCostText(recipe.cost, recipe.itemCost)}.`;
    return recipe.desc || 'Pronto.';
  }

  function renderStationMenu(station) {
    const content = document.getElementById('stationContentClean');
    if (!content || !station) return;
    const c = selectedColonist();
    const stations = state.objects.filter(isStation);
    const recipes = Object.entries(recipeDefs).filter(([, recipe]) => recipe.station === station.type);
    content.innerHTML = `
      <div class="station-head"><img src="${sprite(stationIcon(station.type))}" alt=""><div><div class="kicker">Estação</div><h1>${escapeHtml(stationTitle(station.type))}</h1><p>${escapeHtml(stationDesc(station.type))}</p></div></div>
      <div class="station-meta"><span>${station.x},${station.y}</span><span>${c ? escapeHtml(c.name) : 'sem colono'}</span><span>${isVisitor() ? 'visitante' : 'host/local'}</span></div>
      <div class="station-layout"><aside class="station-list"><h3>Estações</h3>${stations.map(o => `<button class="station-switch ${o.id === station.id ? 'active' : ''}" data-station-switch="${o.id}">${escapeHtml(stationTitle(o.type))}<small>${o.x},${o.y}</small></button>`).join('') || '<span class="empty">Nenhuma estação.</span>'}</aside><section class="station-recipes"><h3>Receitas</h3><div class="station-recipe-grid">${recipes.map(([key, recipe]) => { const iconKey = Object.keys(recipe.output?.items || {})[0]; const icon = itemDefs[iconKey]?.icon || (recipe.output?.resources?.food ? 'icon_food' : stationIcon(station.type)); const ok = recipeReady(key, recipe, c); return `<button class="station-recipe ${ok ? '' : 'locked'}" data-station-craft="${key}" ${ok ? '' : 'disabled'}><img src="${sprite(icon)}" alt=""><b>${escapeHtml(recipe.label)}</b><small>${escapeHtml(itemCostText(recipe.cost, recipe.itemCost))}</small><small>${escapeHtml(outputText(recipe.output))}</small><em>${escapeHtml(recipeHint(key, recipe, c))}</em></button>`; }).join('') || '<span class="empty">Sem receitas.</span>'}</div></section></div>`;
  }

  function openStationMenu(station) {
    if (!isStation(station)) return false;
    ensureStationOverlay();
    activeStationId = station.id;
    selectedCraftStationId = station.id;
    renderStationMenu(station);
    document.getElementById('stationOverlayClean')?.classList.add('show');
    updateCraftingUI();
    return true;
  }

  window.openWorkstationMenu = openStationMenu;
  const prevOpenCraft = openCraftingForStation;
  openCraftingForStation = function patchedOpenCraftingForStation(obj) { if (isStation(obj)) return openStationMenu(obj); return prevOpenCraft(obj); };
  const prevRoute = routePrimaryObjectAction;
  routePrimaryObjectAction = function patchedRoutePrimaryObjectAction(c, obj) { if (isStation(obj)) return openStationMenu(obj); return prevRoute(c, obj); };
  const prevContext = makeContextActions;
  makeContextActions = function patchedContextActions(c, target, tile) {
    const actions = prevContext(c, target, tile);
    if (target?.kind === 'object' && isStation(target.obj)) actions.unshift({ label: 'Abrir estação', hint: 'receitas desta estação', run: () => openStationMenu(target.obj) });
    return actions;
  };

  const prevUpdateUI = updateUI;
  updateUI = function cleanPatchUpdateUI(force = false) {
    if (activeHudTab === 'crafting') setHudTab('build');
    prevUpdateUI(force);
    ensureOnlineButton();
    const station = activeStation();
    if (station && document.getElementById('stationOverlayClean')?.classList.contains('show')) renderStationMenu(station);
  };

  const prevSetup = setupEventListeners;
  setupEventListeners = function cleanPatchSetupListeners() {
    prevSetup();
    ensureOnlineButton();
    ensureOnlineScreen();
    ensureStationOverlay();
    if (activeHudTab === 'crafting') setHudTab('build');
  };

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('stationOverlayClean')?.classList.contains('show')) {
      event.preventDefault();
      closeStationMenu();
    }
  }, true);

  ensurePatchStyles();
}

async function loadQolPatchesThenBoot() {
  await loadScript('src/game/14_qol_patch.js');
  if (typeof installQolPatch === 'function') installQolPatch();

  await loadScript('src/game/15_crafting_wall_fix.js');
  if (typeof installCraftingWallFixPatch === 'function') installCraftingWallFixPatch();

  await loadScript('src/game/16_building_roof_ai_fix.js');
  if (typeof installBuildingRoofAiFixPatch === 'function') installBuildingRoofAiFixPatch();

  await loadScript('src/game/17_ui_sprite_cleanup.js');
  if (typeof installUiSpriteCleanupPatch === 'function') installUiSpriteCleanupPatch();

  await loadScript('src/game/18_combat_death_fix.js');
  if (typeof installCombatDeathFixPatch === 'function') installCombatDeathFixPatch();

  await loadScript('src/game/22_mob_vision_patch.js');
  if (typeof installMobVisionPatch === 'function') installMobVisionPatch();

  await loadScript('src/game/19_sandbox_multiplayer_patch.js');
  if (typeof installSandboxMultiplayerPatch === 'function') installSandboxMultiplayerPatch();

  installCleanOnlineAndStationMenus();

  await loadScript('src/game/23_multiplayer_lobby_patch.js');
  if (typeof installMultiplayerLobbyPatch === 'function') installMultiplayerLobbyPatch();

  bootGame();
}

loadQolPatchesThenBoot();
