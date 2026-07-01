'use strict';

(() => {
  const DOOR_STATE = Object.freeze({ CLOSED: 'closed', OPEN: 'open' });
  const WALL_CONFIG = Object.freeze({
    wood: Object.freeze({ key: 'wood', label: 'Madeira', hp: 100, texture_id: 'wall_wood', cost: Object.freeze({ wood: 4 }), work: 3, fill: '#8a5a36', stroke: '#4f2f1d' }),
    stone: Object.freeze({ key: 'stone', label: 'Pedra', hp: 260, texture_id: 'wall_stone', cost: Object.freeze({ stone: 6 }), work: 4, fill: '#737b83', stroke: '#3c4349' }),
    metal: Object.freeze({ key: 'metal', label: 'Metal', hp: 520, texture_id: 'wall_metal', cost: Object.freeze({ stone: 2, metal: 6 }), work: 5, fill: '#596673', stroke: '#242c34' })
  });

  let installed = false;
  let drag = null;
  let originalUpdateUI = null;
  let originalRoutePrimaryObjectAction = null;

  window.DoorState = window.DoorState || DOOR_STATE;
  window.WallConfig = window.WallConfig || WALL_CONFIG;
  window.BuildAssetConfig = window.BuildAssetConfig || Object.freeze({ wall: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'center', layer: 'structure' }), door: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'center', layer: 'structure' }), floor: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'top-left', layer: 'floor' }) });

  function copy(cost = {}) { return Object.fromEntries(Object.entries(cost || {})); }
  function tileSize() { return typeof getTileSize === 'function' ? getTileSize() : TILE; }
  function materialForBuild(key) { return buildDefs?.[key]?.wallMaterial || (key === 'wall_stone' ? 'stone' : key === 'wall_metal' ? 'metal' : 'wood'); }
  function typeForBuild(key) { return buildDefs?.[key]?.type || key || null; }
  function tileToWorldGrid(x, y, anchor = 'center') { const s = tileSize(); const left = Math.round(Number(x) || 0) * s; const top = Math.round(Number(y) || 0) * s; if (anchor === 'top-left' || anchor === 'topLeft') return { x: left, y: top }; if (anchor === 'bottom-center' || anchor === 'bottomCenter') return { x: left + s / 2, y: top + s }; return { x: left + s / 2, y: top + s / 2 }; }
  function worldToTileGrid(worldX, worldY) { const s = tileSize(); return { x: Math.floor((Number(worldX) || 0) / s), y: Math.floor((Number(worldY) || 0) / s) }; }
  function canvasClientToWorldGrid(clientX, clientY) { if (!canvas || !viewTransform) return null; const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return null; const px = (clientX - rect.left) * (canvas.width / rect.width); const py = (clientY - rect.top) * (canvas.height / rect.height); return { x: (px - viewTransform.offsetX) / viewTransform.scale, y: (py - viewTransform.offsetY) / viewTransform.scale }; }
  function tileFromPointer(event) { const world = canvasClientToWorldGrid(event.clientX, event.clientY); return world ? worldToTileGrid(world.x, world.y) : null; }
  function rectBetween(a, b) { if (!a || !b) return null; return { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) }; }
  function eachTile(start, end, fn) { const r = rectBetween(start, end); if (!r || typeof fn !== 'function') return 0; let count = 0; for (let y = r.minY; y <= r.maxY; y++) for (let x = r.minX; x <= r.maxX; x++) fn({ x, y }, count++); return count; }

  function installDefinitions() {
    if (typeof buildDefs !== 'object' || typeof objectDefs !== 'object') return;
    buildDefs.wall = { ...(buildDefs.wall || {}), label: 'Parede de Madeira', type: 'wall', wallMaterial: 'wood', cost: copy(WALL_CONFIG.wood.cost), work: WALL_CONFIG.wood.work };
    buildDefs.wall_wood = { label: 'Parede de Madeira', type: 'wall', wallMaterial: 'wood', cost: copy(WALL_CONFIG.wood.cost), work: WALL_CONFIG.wood.work };
    buildDefs.wall_stone = { label: 'Parede de Pedra', type: 'wall', wallMaterial: 'stone', cost: copy(WALL_CONFIG.stone.cost), work: WALL_CONFIG.stone.work };
    buildDefs.wall_metal = { label: 'Parede de Metal', type: 'wall', wallMaterial: 'metal', cost: copy(WALL_CONFIG.metal.cost), work: WALL_CONFIG.metal.work };
    buildDefs.door = { ...(buildDefs.door || {}), label: 'Porta de Madeira', type: 'door', cost: { wood: 6 }, work: 4, defaultState: DOOR_STATE.CLOSED };
    objectDefs.wall = { ...(objectDefs.wall || {}), name: 'parede', img: 'wall_stone', blocks: true, roofBoundary: true, doorBoundary: true, structural: true };
    objectDefs.door = { ...(objectDefs.door || {}), name: 'porta', img: 'door_wood', blocks: false, door: true, roofBoundary: true, doorBoundary: true, structural: true };
  }

  function objectBuildType(obj) { return obj?.type === 'blueprint' ? typeForBuild(obj.buildType) : obj?.type; }
  function objectCanBeReplacedByDoor(obj) { const kind = objectBuildType(obj); return kind === 'wall' || (obj?.type === 'blueprint' && kind === 'wall'); }
  function isNaturalDoorBoundaryAt(x, y) { return typeof isMountainBlocked === 'function' && isMountainBlocked(x, y); }
  function isDoorBoundaryAt(x, y) {
    if (isNaturalDoorBoundaryAt(x, y)) return true;
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    if (!obj) return false;
    const kind = objectBuildType(obj);
    if (kind === 'wall' || kind === 'door') return true;
    const def = objectDefs?.[obj.type];
    if (def?.doorBoundary || def?.roofBoundary || def?.structural) return true;
    if (def?.blocks && !def?.gather && !obj.carried && !obj.stored) return true;
    return false;
  }
  function isWallAnchorAt(x, y) { return isDoorBoundaryAt(x, y); }
  function hasDoorOpeningFrame(x, y) { return (isDoorBoundaryAt(x - 1, y) && isDoorBoundaryAt(x + 1, y)) || (isDoorBoundaryAt(x, y - 1) && isDoorBoundaryAt(x, y + 1)); }
  function hasAdjacentWallForDoor(x, y) { return hasDoorOpeningFrame(x, y); }
  function isWaterTerrain(x, y) { return state?.terrain?.[y]?.[x] === 'water'; }
  function hasAdjacentWater(x, y) { return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => isWaterTerrain(x + dx, y + dy)); }
  function occupiedByColonist(x, y) { return !!state?.colonists?.some(c => Math.round(c.x) === x && Math.round(c.y) === y); }

  function isDoorOpeningTile(x, y) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    if (!state) return false;
    if (typeof isInside === 'function' && !isInside(tx, ty)) return false;
    if (tx < 1 || ty < 1 || tx > getWorldCols() - 2 || ty > getWorldRows() - 2) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tx, ty)) return false;
    if (typeof isMountainBlocked === 'function' && isMountainBlocked(tx, ty)) return false;
    if (isWaterTerrain(tx, ty)) return false;
    if (occupiedByColonist(tx, ty)) return false;
    const obj = typeof getObjectAt === 'function' ? getObjectAt(tx, ty) : null;
    if (!obj) return true;
    return objectCanBeReplacedByDoor(obj);
  }

  function resolveDoorPlacementTile(x, y) {
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    const candidates = [
      { x: tx, y: ty },
      { x: tx + 1, y: ty },
      { x: tx - 1, y: ty },
      { x: tx, y: ty + 1 },
      { x: tx, y: ty - 1 },
      { x: tx + 1, y: ty + 1 },
      { x: tx - 1, y: ty + 1 },
      { x: tx + 1, y: ty - 1 },
      { x: tx - 1, y: ty - 1 }
    ];
    return candidates.find(tile => isDoorOpeningTile(tile.x, tile.y) && hasDoorOpeningFrame(tile.x, tile.y)) || null;
  }

  function canPlaceBuild(key, x, y) {
    const def = buildDefs?.[key]; const tx = Math.round(Number(x) || 0); const ty = Math.round(Number(y) || 0);
    if (!def || !state) return false;
    if (def.type === 'door') return !!resolveDoorPlacementTile(tx, ty);
    if (typeof isInside === 'function' && !isInside(tx, ty)) return false;
    if (tx < 1 || ty < 1 || tx > getWorldCols() - 2 || ty > getWorldRows() - 2) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tx, ty)) return false;
    if (typeof isMountainBlocked === 'function' && isMountainBlocked(tx, ty)) return false;
    if (typeof getObjectAt === 'function' && getObjectAt(tx, ty)) return false;
    if (occupiedByColonist(tx, ty)) return false;
    if (state.terrain?.[ty]?.[tx] === 'water' && def.type !== 'bridge') return false;
    if (def.placeOnWater) return isWaterTerrain(tx, ty);
    if (def.needsAdjacentWater && !hasAdjacentWater(tx, ty)) return false;
    if (isWaterTerrain(tx, ty)) return false;
    return state.terrain?.[ty]?.[tx] !== 'stone' || def.type === 'wall';
  }

  function buildCostText(key) { const def = buildDefs?.[key]; if (!def) return 'construção inválida'; return typeof itemCostText === 'function' ? itemCostText(def.cost || {}, def.itemCost || {}) : Object.entries(def.cost || {}).map(([k, v]) => `${v} ${k}`).join(' + '); }
  function hasPayment(key) { const def = buildDefs?.[key]; return !!def && (!def.cost || hasCost(def.cost)) && (!def.itemCost || hasItems(def.itemCost)); }

  function applyBuildMetadata(obj, def) {
    if (!obj || !def) return obj;
    if (def.type === 'wall') { const cfg = WALL_CONFIG[def.wallMaterial || materialForBuild(obj.buildType || 'wall')] || WALL_CONFIG.wood; obj.wallMaterial = cfg.key; obj.hp = Number.isFinite(obj.hp) ? obj.hp : cfg.hp; obj.maxHp = Number.isFinite(obj.maxHp) ? obj.maxHp : cfg.hp; obj.texture_id = cfg.texture_id; obj.tile_width = 1; obj.tile_height = 1; obj.anchor = 'center'; }
    if (def.type === 'door') { obj.state = obj.state || def.defaultState || DOOR_STATE.CLOSED; obj.doorState = obj.state; obj.hp = Number.isFinite(obj.hp) ? obj.hp : 120; obj.maxHp = Number.isFinite(obj.maxHp) ? obj.maxHp : 120; obj.texture_id = obj.state === DOOR_STATE.OPEN ? 'door_wood_open' : 'door_wood_closed'; obj.tile_width = 1; obj.tile_height = 1; obj.anchor = 'center'; }
    return obj;
  }

  function queueConstruction(key, x, y, options = {}) {
    const def = buildDefs?.[key]; let tx = Math.round(Number(x) || 0); let ty = Math.round(Number(y) || 0);
    if (!def) return { ok: false, reason: 'Construção inválida.' };
    if (typeof isBuildUnlocked === 'function' && !isBuildUnlocked(key)) return { ok: false, reason: `Precisa pesquisar ${researchDefs?.[def.requires]?.label || 'tecnologia'} antes.` };
    let replacing = null;
    if (def.type === 'door') {
      const resolved = resolveDoorPlacementTile(tx, ty);
      if (!resolved) return { ok: false, reason: 'A porta precisa de uma abertura entre rocha, parede ou estrutura.' };
      tx = resolved.x;
      ty = resolved.y;
      const obj = typeof getObjectAt === 'function' ? getObjectAt(tx, ty) : null;
      if (obj && objectCanBeReplacedByDoor(obj)) replacing = obj;
    } else if (!canPlaceBuild(key, tx, ty)) {
      return { ok: false, reason: 'Não dá para construir nesse lugar.' };
    }
    if (!hasPayment(key)) return { ok: false, reason: `Recursos insuficientes. Precisa de ${buildCostText(key)}.` };
    payCost(def.cost || {}); payItems(def.itemCost || {});
    if (replacing?.id && Array.isArray(state.objects)) state.objects = state.objects.filter(obj => obj.id !== replacing.id);
    const rotation = typeof isBuildRotatable === 'function' && isBuildRotatable(key) ? normalizeBuildRotation(currentBuildRotation) : 0;
    const blueprint = applyBuildMetadata({ id: uid('obj'), type: 'blueprint', buildType: key, x: tx, y: ty, progress: 0, rotation, replacesObjectId: replacing?.id || null }, def);
    state.objects.push(blueprint);
    if (state.world && state.world.objects) state.world.objects = state.objects;
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (!options.silent && typeof log === 'function') log(replacing ? `Parede convertida em planta de ${def.label}.` : `Planta de ${def.label} posicionada.`);
    return { ok: true, blueprint };
  }

  function placeBuildBlueprint(key, x, y) { const result = queueConstruction(key, x, y); if (!result.ok) { if (typeof log === 'function') log(result.reason); return false; } const c = typeof selectedColonist === 'function' ? selectedColonist() : null; if (c && result.blueprint && typeof assignBuild === 'function') assignBuild(c, result.blueprint); if (typeof updateUI === 'function') updateUI(true); return true; }
  function placeRect(key, start, end) { let placed = 0, attempted = 0, first = null, fail = null; eachTile(start, end, tile => { attempted++; const result = queueConstruction(key, tile.x, tile.y, { silent: true }); if (result.ok) { placed++; first ||= result.blueprint; } else fail ||= result.reason; }); if (placed) { if (typeof log === 'function') log(`${placed}/${attempted} planta${placed > 1 ? 's' : ''} enfileirada${placed > 1 ? 's' : ''}.`); const c = typeof selectedColonist === 'function' ? selectedColonist() : null; if (c && first && typeof assignBuild === 'function') assignBuild(c, first); } else if (fail && typeof log === 'function') log(fail); if (typeof updateUI === 'function') updateUI(true); return placed; }

  function toggleDoorState(obj) { if (!obj || obj.type !== 'door') return false; obj.state = obj.state === DOOR_STATE.OPEN ? DOOR_STATE.CLOSED : DOOR_STATE.OPEN; obj.doorState = obj.state; obj.texture_id = obj.state === DOOR_STATE.OPEN ? 'door_wood_open' : 'door_wood_closed'; if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid(); if (typeof updateUI === 'function') updateUI(true); return true; }
  function routePrimaryObjectActionWrapper(c, obj) { if (obj?.type === 'door') { toggleDoorState(obj); return; } if (originalRoutePrimaryObjectAction) return originalRoutePrimaryObjectAction(c, obj); }

  function installBuildButtons() { const grid = document.querySelector('#buildPanel .build-grid'); if (!grid) return; const wallBtn = grid.querySelector('[data-build="wall"]'); if (wallBtn) wallBtn.innerHTML = 'Parede Madeira<br><small>4 madeira</small>'; const doorBtn = grid.querySelector('[data-build="door"]'); const ref = doorBtn || wallBtn; [{ key: 'wall_stone', html: 'Parede Pedra<br><small>6 pedra</small>' }, { key: 'wall_metal', html: 'Parede Metal<br><small>2 pedra + 6 metal</small>' }, { key: 'bridge', html: 'Ponte<br><small>8 madeira</small>' }, { key: 'butcher_table', html: 'Açougue<br><small>14 madeira + 4 pedra</small>' }].reverse().forEach(item => { if (grid.querySelector(`[data-build="${item.key}"]`)) return; const btn = document.createElement('button'); btn.dataset.build = item.key; btn.innerHTML = item.html; if (ref) grid.insertBefore(btn, ref); else grid.appendChild(btn); }); }
  function selectBuildTool(key) { if (!buildDefs?.[key]) return; if (typeof clearZoneTool === 'function') clearZoneTool('construção selecionada'); currentBuild = key; if (typeof resetBuildRotationIfNeeded === 'function') resetBuildRotationIfNeeded(key); if (typeof updateUI === 'function') updateUI(true); }
  function buildButtonCapture(event) { const build = event.target?.closest?.('[data-build]'); if (!build || !build.closest('#hud, #bottomActionBar, #buildPanel')) return; event.preventDefault(); event.stopPropagation(); selectBuildTool(build.dataset.build); }
  function mouseDown(event) { if (event.button !== 0 || appScreen !== SCREEN.PLAYING || !state || !currentBuild) return; const tile = tileFromPointer(event); if (!tile) return; drag = { start: tile, current: tile, active: false, x: event.clientX, y: event.clientY }; try { mouseTile = tile; } catch (_) {} }
  function mouseMove(event) { if (!drag || !currentBuild) return; const tile = tileFromPointer(event); if (!tile) return; drag.current = tile; try { mouseTile = tile; } catch (_) {} if (tile.x !== drag.start.x || tile.y !== drag.start.y || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) drag.active = true; }
  function mouseUp(event) { if (event.button !== 0 || !drag || !currentBuild) return; const selection = drag; drag = null; if (!selection.active) return; event.preventDefault(); event.stopPropagation(); suppressNextClick = true; placeRect(currentBuild, selection.start, selection.current); }

  function buildTaskHandler(c, task, tick) {
    const bp = state?.objects?.find(o => o.id === task.objId && o.type === 'blueprint');
    if (!bp) return false;
    const buildType = bp.buildType;
    const def = buildDefs?.[buildType];
    if (!def) { c.task = null; c.work = 0; c.note = 'Ocioso'; return true; }
    bp.progress = (bp.progress || 0) + tick * workRate(c, 'build');
    c.note = `Construindo ${def.label} ${Math.floor((bp.progress / def.work) * 100)}%`;
    if (bp.progress >= def.work) {
      const x = bp.x;
      const y = bp.y;
      bp.type = def.type;
      if (bp.type === 'crop') bp.growth = 0;
      applyBuildMetadata(bp, def);
      delete bp.buildType;
      delete bp.progress;
      window.HavenfallWorkFeedback?.notifyComplete?.('build', { buildType, objectType: def.type }, x, y);
      if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
      if (typeof log === 'function') log(`${c.name} terminou: ${def.label}.`);
      c.task = null;
      c.work = 0;
      c.note = 'Ocioso';
    }
    return true;
  }
  function updateUIWrapper(force = false) { if (originalUpdateUI) originalUpdateUI(force); installBuildButtons(); if (typeof dom !== 'undefined' && dom?.buildStatus) dom.buildStatus.textContent = currentBuild ? `Construindo: ${buildDefs[currentBuild]?.label || currentBuild}. Clique ou arraste.` : 'Nenhuma construção selecionada.'; document.querySelectorAll('[data-build]').forEach(btn => { const key = btn.dataset.build; if (!buildDefs?.[key]) return; btn.classList.toggle('active', key === currentBuild); btn.title = `${buildDefs[key].label} · ${buildCostText(key)}`; }); }

  function install() {
    if (installed) return;
    if (!window.HavenfallContext?.gameBooted) { setTimeout(install, 120); return; }
    installed = true;
    originalUpdateUI = typeof updateUI === 'function' ? updateUI : null;
    originalRoutePrimaryObjectAction = typeof routePrimaryObjectAction === 'function' ? routePrimaryObjectAction : null;
    installDefinitions();
    window.tileToWorld = tileToWorldGrid; window.worldToTile = worldToTileGrid; window.canvasClientToWorld = canvasClientToWorldGrid; window.tileFromPointerEvent = tileFromPointer; window.tileRectBetween = rectBetween; window.forEachTileInRect = eachTile; window.canPlaceBuild = canPlaceBuild; window.queueConstruction = queueConstruction; window.QueueConstruction = queueConstruction; window.placeBlueprintRect = placeRect; window.placeBlueprint = placeBuildBlueprint; window.toggleDoorState = toggleDoorState; window.applyCompletedBuildMetadata = applyBuildMetadata; window.hasAdjacentWallForDoor = hasAdjacentWallForDoor; window.isWallAnchorAt = isWallAnchorAt; window.isDoorBoundaryAt = isDoorBoundaryAt; window.isDoorOpeningTile = isDoorOpeningTile; window.hasDoorOpeningFrame = hasDoorOpeningFrame; window.resolveDoorPlacementTile = resolveDoorPlacementTile; window.hasAdjacentWater = hasAdjacentWater;
    try { tileFromEvent = tileFromPointer; } catch (_) {}
    try { canPlace = (type, x, y) => canPlaceBuild(type === 'wall' ? 'wall' : type, x, y); } catch (_) {}
    try { placeBlueprint = placeBuildBlueprint; } catch (_) {}
    try { routePrimaryObjectAction = routePrimaryObjectActionWrapper; } catch (_) {}
    try { updateUI = updateUIWrapper; } catch (_) {}
    canvas?.addEventListener('mousedown', mouseDown); canvas?.addEventListener('mousemove', mouseMove); canvas?.addEventListener('mouseup', mouseUp); canvas?.addEventListener('mouseleave', () => { if (drag && !drag.active) drag = null; }); document.addEventListener('click', buildButtonCapture, true);
    window.GameSystems?.registerTaskHandler?.('build', 'construction.completion', buildTaskHandler, { order: 1 });
    installBuildButtons();
    window.HavenfallConstructionSystem = 'smart-opening-door-construction';
    console.info('[Construction System] Portas inteligentes por abertura carregadas.');
  }

  install();
})();
