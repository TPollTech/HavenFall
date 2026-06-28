'use strict';

(() => {
  const DOOR_STATE = Object.freeze({ CLOSED: 'closed', OPEN: 'open' });

  const WALL_CONFIG = Object.freeze({
    wood: Object.freeze({
      key: 'wood',
      label: 'Madeira',
      hp: 100,
      texture_id: 'wall_wood',
      cost: Object.freeze({ wood: 4 }),
      work: 3,
      fill: '#8a5a36',
      stroke: '#4f2f1d',
      highlight: 'rgba(255, 226, 174, .30)'
    }),
    stone: Object.freeze({
      key: 'stone',
      label: 'Pedra',
      hp: 260,
      texture_id: 'wall_stone',
      cost: Object.freeze({ stone: 6 }),
      work: 4,
      fill: '#737b83',
      stroke: '#3c4349',
      highlight: 'rgba(232, 238, 242, .28)'
    }),
    metal: Object.freeze({
      key: 'metal',
      label: 'Metal',
      hp: 520,
      texture_id: 'wall_metal',
      cost: Object.freeze({ stone: 2, metal: 6 }),
      work: 5,
      fill: '#596673',
      stroke: '#242c34',
      highlight: 'rgba(185, 214, 232, .32)'
    })
  });

  const BUILD_ASSET_CONFIG = Object.freeze({
    wall: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'center', layer: 'structure' }),
    door: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'center', layer: 'structure' }),
    floor: Object.freeze({ tile_width: 1, tile_height: 1, anchor: 'top-left', layer: 'floor' })
  });

  window.DoorState = DOOR_STATE;
  window.WallConfig = WALL_CONFIG;
  window.BuildAssetConfig = BUILD_ASSET_CONFIG;

  let buildDragSelection = null;
  let originalDrawObject = typeof drawObject === 'function' ? drawObject : null;
  let originalUpdateUI = typeof updateUI === 'function' ? updateUI : null;
  let originalRoutePrimaryObjectAction = typeof routePrimaryObjectAction === 'function' ? routePrimaryObjectAction : null;

  function copyCost(cost = {}) {
    return Object.fromEntries(Object.entries(cost || {}).map(([key, value]) => [key, value]));
  }

  function installBuildDefinitions() {
    if (typeof buildDefs !== 'object' || typeof objectDefs !== 'object') return;

    buildDefs.wall = {
      ...(buildDefs.wall || {}),
      label: 'Parede de Madeira',
      type: 'wall',
      wallMaterial: 'wood',
      cost: copyCost(WALL_CONFIG.wood.cost),
      work: WALL_CONFIG.wood.work
    };

    buildDefs.wall_wood = {
      label: 'Parede de Madeira',
      type: 'wall',
      wallMaterial: 'wood',
      cost: copyCost(WALL_CONFIG.wood.cost),
      work: WALL_CONFIG.wood.work
    };

    buildDefs.wall_stone = {
      label: 'Parede de Pedra',
      type: 'wall',
      wallMaterial: 'stone',
      cost: copyCost(WALL_CONFIG.stone.cost),
      work: WALL_CONFIG.stone.work
    };

    buildDefs.wall_metal = {
      label: 'Parede de Metal',
      type: 'wall',
      wallMaterial: 'metal',
      cost: copyCost(WALL_CONFIG.metal.cost),
      work: WALL_CONFIG.metal.work
    };

    buildDefs.door = {
      ...(buildDefs.door || {}),
      label: 'Porta de Madeira',
      type: 'door',
      cost: { wood: 6 },
      work: 4,
      defaultState: DOOR_STATE.CLOSED
    };

    objectDefs.wall = {
      ...(objectDefs.wall || {}),
      name: 'parede',
      img: 'wall_stone',
      blocks: true,
      roofBoundary: true
    };

    objectDefs.door = {
      ...(objectDefs.door || {}),
      name: 'porta',
      img: 'door_wood',
      blocks: false,
      door: true,
      roofBoundary: true
    };
  }

  function tileToWorldAlpha(x, y, anchor = 'center') {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);
    const left = tx * tileSize;
    const top = ty * tileSize;

    if (anchor === 'top-left' || anchor === 'topLeft') return { x: left, y: top };
    if (anchor === 'bottom-center' || anchor === 'bottomCenter') return { x: left + tileSize / 2, y: top + tileSize };
    if (anchor === 'bottom-left' || anchor === 'bottomLeft') return { x: left, y: top + tileSize };
    return { x: left + tileSize / 2, y: top + tileSize / 2 };
  }

  function worldToTileAlpha(worldX, worldY) {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    return {
      x: Math.floor((Number(worldX) || 0) / tileSize),
      y: Math.floor((Number(worldY) || 0) / tileSize)
    };
  }

  function canvasClientToWorldAlpha(clientX, clientY) {
    if (!canvas || !viewTransform || !canvas.width || !canvas.height) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: (px - viewTransform.offsetX) / viewTransform.scale,
      y: (py - viewTransform.offsetY) / viewTransform.scale
    };
  }

  function tileFromPointerEventAlpha(event) {
    const world = canvasClientToWorldAlpha(event.clientX, event.clientY);
    return world ? worldToTileAlpha(world.x, world.y) : null;
  }

  function normalizeTile(tile) {
    if (!tile) return null;
    return { x: Math.round(Number(tile.x) || 0), y: Math.round(Number(tile.y) || 0) };
  }

  function tileRectBetweenAlpha(a, b) {
    const start = normalizeTile(a);
    const end = normalizeTile(b);
    if (!start || !end) return null;
    return {
      minX: Math.min(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxX: Math.max(start.x, end.x),
      maxY: Math.max(start.y, end.y)
    };
  }

  function forEachTileInRectAlpha(start, end, callback) {
    const rect = tileRectBetweenAlpha(start, end);
    if (!rect || typeof callback !== 'function') return 0;
    let count = 0;
    for (let y = rect.minY; y <= rect.maxY; y++) {
      for (let x = rect.minX; x <= rect.maxX; x++) {
        callback({ x, y }, count);
        count++;
      }
    }
    return count;
  }

  function exposeGridApi() {
    window.tileToWorld = tileToWorldAlpha;
    window.worldToTile = worldToTileAlpha;
    window.canvasClientToWorld = canvasClientToWorldAlpha;
    window.tileRectBetween = tileRectBetweenAlpha;
    window.forEachTileInRect = forEachTileInRectAlpha;
    window.tileFromPointerEvent = tileFromPointerEventAlpha;

    try { tileFromEvent = tileFromPointerEventAlpha; } catch (_) {}
  }

  function buildTypeForKey(buildKey) {
    return buildDefs?.[buildKey]?.type || buildKey || null;
  }

  function isWallBuild(buildKey) {
    return buildTypeForKey(buildKey) === 'wall';
  }

  function isDoorBuild(buildKey) {
    return buildTypeForKey(buildKey) === 'door';
  }

  function wallMaterialForBuild(buildKey) {
    const material = buildDefs?.[buildKey]?.wallMaterial || (buildKey === 'wall_stone' ? 'stone' : buildKey === 'wall_metal' ? 'metal' : 'wood');
    return WALL_CONFIG[material] ? material : 'wood';
  }

  function wallConfigForObject(obj) {
    const material = obj?.wallMaterial || wallMaterialForBuild(obj?.buildType || 'wall');
    return WALL_CONFIG[material] || WALL_CONFIG.wood;
  }

  function isWallAnchorAtAlpha(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    if (!obj) return false;
    if (obj.type === 'wall') return true;
    return obj.type === 'blueprint' && buildTypeForKey(obj.buildType) === 'wall';
  }

  function hasAdjacentWallForDoorAlpha(x, y) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWallAnchorAtAlpha(x + dx, y + dy));
  }

  function isColonistOccupyingTile(x, y) {
    return !!state?.colonists?.some(c => Math.round(c.x) === x && Math.round(c.y) === y);
  }

  function canPlaceBuild(buildKey, x, y) {
    const def = buildDefs?.[buildKey];
    const type = def?.type || buildKey;
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);

    if (!def || !state) return false;
    if (typeof isInside === 'function' && !isInside(tx, ty)) return false;
    if (tx < 1 || ty < 1 || tx > getWorldCols() - 2 || ty > getWorldRows() - 2) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tx, ty)) return false;
    if (typeof isMountainBlocked === 'function' && isMountainBlocked(tx, ty)) return false;
    if (typeof getObjectAt === 'function' && getObjectAt(tx, ty)) return false;
    if (isColonistOccupyingTile(tx, ty)) return false;
    if (type === 'door' && !hasAdjacentWallForDoorAlpha(tx, ty)) return false;
    return state.terrain?.[ty]?.[tx] !== 'stone' || type === 'wall';
  }

  function canPlaceAlpha(type, x, y, buildKey = null) {
    const key = buildKey || (currentBuild && buildDefs?.[currentBuild]?.type === type ? currentBuild : null) || (type === 'wall' ? 'wall' : type);
    return canPlaceBuild(key, x, y);
  }

  function buildCostText(buildKey) {
    const def = buildDefs?.[buildKey];
    if (!def) return 'construção inválida';
    return typeof itemCostText === 'function'
      ? itemCostText(def.cost || {}, def.itemCost || {})
      : Object.entries(def.cost || {}).map(([k, v]) => `${v} ${k}`).join(' + ');
  }

  function hasBuildPayment(buildKey) {
    const def = buildDefs?.[buildKey];
    if (!def) return false;
    return (!def.cost || hasCost(def.cost)) && (!def.itemCost || hasItems(def.itemCost));
  }

  function applyBuildMetadata(obj, def) {
    if (!obj || !def) return obj;

    if (def.type === 'wall') {
      const material = def.wallMaterial || wallMaterialForBuild(obj.buildType || 'wall');
      const cfg = WALL_CONFIG[material] || WALL_CONFIG.wood;
      obj.wallMaterial = cfg.key;
      obj.hp = Number.isFinite(obj.hp) ? obj.hp : cfg.hp;
      obj.maxHp = Number.isFinite(obj.maxHp) ? obj.maxHp : cfg.hp;
      obj.texture_id = cfg.texture_id;
      obj.tile_width = 1;
      obj.tile_height = 1;
      obj.anchor = BUILD_ASSET_CONFIG.wall.anchor;
    }

    if (def.type === 'door') {
      obj.state = obj.state || def.defaultState || DOOR_STATE.CLOSED;
      obj.doorState = obj.state;
      obj.hp = Number.isFinite(obj.hp) ? obj.hp : 120;
      obj.maxHp = Number.isFinite(obj.maxHp) ? obj.maxHp : 120;
      obj.texture_id = obj.state === DOOR_STATE.OPEN ? 'door_wood_open' : 'door_wood_closed';
      obj.tile_width = 1;
      obj.tile_height = 1;
      obj.anchor = BUILD_ASSET_CONFIG.door.anchor;
    }

    return obj;
  }

  function queueConstruction(buildKey, x, y, options = {}) {
    const def = buildDefs?.[buildKey];
    const tx = Math.round(Number(x) || 0);
    const ty = Math.round(Number(y) || 0);

    if (!def) return { ok: false, reason: 'Construção inválida.' };
    if (typeof isBuildUnlocked === 'function' && !isBuildUnlocked(buildKey)) {
      return { ok: false, reason: `Precisa pesquisar ${researchDefs?.[def.requires]?.label || 'tecnologia'} antes de construir ${def.label}.` };
    }
    if (!canPlaceBuild(buildKey, tx, ty)) {
      if (def.type === 'door' && !hasAdjacentWallForDoorAlpha(tx, ty)) return { ok: false, reason: 'A porta precisa encostar em uma parede existente ou em uma blueprint de parede.' };
      return { ok: false, reason: 'Não dá para construir nesse lugar.' };
    }
    if (!hasBuildPayment(buildKey)) return { ok: false, reason: `Recursos insuficientes. Precisa de ${buildCostText(buildKey)}.` };

    payCost(def.cost || {});
    payItems(def.itemCost || {});

    const rotation = typeof isBuildRotatable === 'function' && isBuildRotatable(buildKey) ? normalizeBuildRotation(currentBuildRotation) : 0;
    const blueprint = applyBuildMetadata({
      id: uid('obj'),
      type: 'blueprint',
      buildType: buildKey,
      x: tx,
      y: ty,
      progress: 0,
      rotation
    }, def);

    state.objects.push(blueprint);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();

    if (!options.silent && typeof log === 'function') {
      const rot = rotation ? ` (${typeof buildRotationLabel === 'function' ? buildRotationLabel(rotation) : `${rotation * 90}°`})` : '';
      log(`Planta de ${def.label} posicionada${rot}.`);
    }

    return { ok: true, blueprint };
  }

  function placeBlueprintAlpha(buildKey, x, y) {
    const result = queueConstruction(buildKey, x, y, { silent: false });
    if (!result.ok) {
      if (typeof log === 'function') log(result.reason);
      return false;
    }

    const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
    if (c && result.blueprint && typeof assignBuild === 'function') assignBuild(c, result.blueprint);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function placeBlueprintRect(buildKey, start, end) {
    if (!buildDefs?.[buildKey]) return 0;

    let attempted = 0;
    let placed = 0;
    let firstBlueprint = null;
    let firstFailure = null;

    forEachTileInRectAlpha(start, end, tile => {
      attempted++;
      const result = queueConstruction(buildKey, tile.x, tile.y, { silent: true });
      if (result.ok) {
        placed++;
        firstBlueprint ||= result.blueprint;
      } else {
        firstFailure ||= result.reason;
      }
    });

    if (placed > 0) {
      const def = buildDefs[buildKey];
      if (typeof log === 'function') log(`${placed}/${attempted} planta${placed > 1 ? 's' : ''} de ${def.label} enfileirada${placed > 1 ? 's' : ''} por arrasto.`);
      const c = typeof selectedColonist === 'function' ? selectedColonist() : null;
      if (c && firstBlueprint && typeof assignBuild === 'function') assignBuild(c, firstBlueprint);
    } else if (firstFailure && typeof log === 'function') {
      log(firstFailure);
    }

    if (typeof updateUI === 'function') updateUI(true);
    return placed;
  }

  function toggleDoorState(obj) {
    if (!obj || obj.type !== 'door') return false;
    obj.state = obj.state === DOOR_STATE.OPEN ? DOOR_STATE.CLOSED : DOOR_STATE.OPEN;
    obj.doorState = obj.state;
    obj.texture_id = obj.state === DOOR_STATE.OPEN ? 'door_wood_open' : 'door_wood_closed';
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    if (typeof log === 'function') log(`Porta ${obj.state === DOOR_STATE.OPEN ? 'aberta' : 'fechada'} em ${obj.x},${obj.y}.`);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function routePrimaryObjectActionAlpha(c, obj) {
    if (obj?.type === 'door') {
      toggleDoorState(obj);
      return;
    }
    if (originalRoutePrimaryObjectAction) return originalRoutePrimaryObjectAction(c, obj);
  }

  function isBlockedAlpha(x, y, target = null) {
    if (!state) return true;
    if (typeof isInside === 'function' && !isInside(x, y)) return true;
    if (target && target.x === x && target.y === y) return false;

    const registeredBlock = window.GameSystems?.pathBlocked?.(x, y, target);
    if (registeredBlock !== null && registeredBlock !== undefined) return registeredBlock;

    if (typeof isMountainBlocked === 'function' && isMountainBlocked(x, y)) return true;

    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    if (obj && obj.type !== 'blueprint') {
      if (obj.type === 'door') return (obj.state || DOOR_STATE.CLOSED) !== DOOR_STATE.OPEN;
      if (objectDefs[obj.type]?.blocks) return true;
    }

    const colonists = state?.colonists || [];
    for (let i = 0; i < colonists.length; i++) {
      const c = colonists[i];
      if (Math.round(c.x) === x && Math.round(c.y) === y && Math.abs(c.px - (x * TILE + TILE / 2)) < 5 && Math.abs(c.py - (y * TILE + TILE / 2)) < 5) return false;
    }

    return false;
  }

  function installBuildButtons() {
    const grid = document.querySelector('#buildPanel .build-grid');
    if (!grid) return;

    const wallButton = grid.querySelector('[data-build="wall"]');
    if (wallButton) wallButton.innerHTML = 'Parede Madeira<br><small>4 madeira</small>';

    const doorButton = grid.querySelector('[data-build="door"]');
    const insertionPoint = doorButton || wallButton;
    const additions = [
      { key: 'wall_stone', html: 'Parede Pedra<br><small>6 pedra</small>' },
      { key: 'wall_metal', html: 'Parede Metal<br><small>2 pedra + 6 metal</small>' }
    ];

    additions.reverse().forEach(item => {
      if (grid.querySelector(`[data-build="${item.key}"]`)) return;
      const btn = document.createElement('button');
      btn.dataset.build = item.key;
      btn.innerHTML = item.html;
      if (insertionPoint) grid.insertBefore(btn, insertionPoint);
      else grid.appendChild(btn);
    });

    const hint = document.querySelector('#buildPanel .panel-hint');
    if (hint) hint.textContent = 'Escolha uma construção. Clique para 1 tile ou clique, arraste e solte para construir em área.';
  }

  function selectBuildToolAlpha(buildKey) {
    if (!buildDefs?.[buildKey]) return;
    if (state && typeof isBuildUnlocked === 'function' && !isBuildUnlocked(buildKey)) {
      const req = buildDefs?.[buildKey]?.requires;
      if (typeof log === 'function') log(`Bloqueado: pesquise ${researchDefs?.[req]?.label || 'tecnologia'} primeiro.`);
      if (typeof updateUI === 'function') updateUI(true);
      return;
    }

    if (typeof clearZoneTool === 'function') clearZoneTool('construção selecionada');
    currentBuild = buildKey;
    if (typeof resetBuildRotationIfNeeded === 'function') resetBuildRotationIfNeeded(buildKey);
    if (typeof updateUI === 'function') updateUI(true);
  }

  function handleBuildButtonCapture(event) {
    const target = event.target?.closest?.('[data-build], [data-tab]');
    if (!target) return;
    if (!target.closest('#hud, #bottomActionBar, #buildPanel')) return;

    const build = target.closest('[data-build]');
    if (build) {
      event.preventDefault();
      event.stopPropagation();
      selectBuildToolAlpha(build.dataset.build);
      return;
    }

    const tab = target.closest('[data-tab]');
    if (tab && typeof setHudTab === 'function') {
      event.preventDefault();
      event.stopPropagation();
      if (tab.dataset.tab !== 'zones' && typeof clearZoneTool === 'function') clearZoneTool('aba trocada');
      setHudTab(tab.dataset.tab);
      if (typeof updateUI === 'function') updateUI(true);
    }
  }

  function handleBuildDragMouseDown(event) {
    if (event.button !== 0 || appScreen !== SCREEN.PLAYING || !state || !currentBuild) return;
    const tile = tileFromPointerEventAlpha(event);
    if (!tile || (typeof isInside === 'function' && !isInside(tile.x, tile.y))) return;

    buildDragSelection = {
      start: tile,
      current: tile,
      active: false,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    try { mouseTile = tile; } catch (_) {}
  }

  function handleBuildDragMouseMove(event) {
    if (!buildDragSelection || !currentBuild) return;
    const tile = tileFromPointerEventAlpha(event);
    if (!tile || (typeof isInside === 'function' && !isInside(tile.x, tile.y))) return;

    buildDragSelection.current = tile;
    try { mouseTile = tile; } catch (_) {}

    const movedPx = Math.hypot(event.clientX - buildDragSelection.startClientX, event.clientY - buildDragSelection.startClientY);
    const changedTile = tile.x !== buildDragSelection.start.x || tile.y !== buildDragSelection.start.y;
    if (changedTile || movedPx > 5) buildDragSelection.active = true;
  }

  function handleBuildDragMouseUp(event) {
    if (event.button !== 0 || !buildDragSelection || !currentBuild) return;

    const selection = buildDragSelection;
    buildDragSelection = null;

    if (!selection.active) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = true;
    placeBlueprintRect(currentBuild, selection.start, selection.current);
  }

  function handleBuildDragMouseLeave() {
    if (buildDragSelection && !buildDragSelection.active) buildDragSelection = null;
  }

  function drawRoundedRectLocal(x, y, w, h, r, fill = true, stroke = true) {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawTileValidity(tile, valid) {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    ctx.fillStyle = valid ? 'rgba(155, 211, 106, .18)' : 'rgba(230, 120, 102, .24)';
    ctx.strokeStyle = valid ? 'rgba(155, 211, 106, .82)' : 'rgba(230, 120, 102, .82)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(tile.x * tileSize, tile.y * tileSize, tileSize, tileSize);
    ctx.strokeRect(tile.x * tileSize + 0.5, tile.y * tileSize + 0.5, tileSize - 1, tileSize - 1);
  }

  function constructionRotation(objOrBuild) {
    const rotation = Number(objOrBuild?.rotation ?? currentBuildRotation ?? 0);
    return ((rotation % 4) + 4) % 4;
  }

  function drawWallShape(tile, material = 'wood', rotation = 0, alpha = 1) {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const cfg = WALL_CONFIG[material] || WALL_CONFIG.wood;
    const x = tile.x * tileSize;
    const y = tile.y * tileSize;
    const horizontal = rotation % 2 === 0;
    const thickness = Math.max(9, Math.round(tileSize * 0.22));
    const margin = Math.max(5, Math.round(tileSize * 0.11));

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = cfg.fill;
    ctx.strokeStyle = cfg.stroke;
    ctx.lineWidth = 2;

    if (horizontal) {
      drawRoundedRectLocal(x + margin, y + tileSize / 2 - thickness / 2, tileSize - margin * 2, thickness, 4, true, true);
      ctx.fillStyle = cfg.highlight;
      ctx.fillRect(x + margin + 3, y + tileSize / 2 - thickness / 2 + 2, tileSize - margin * 2 - 6, 3);
    } else {
      drawRoundedRectLocal(x + tileSize / 2 - thickness / 2, y + margin, thickness, tileSize - margin * 2, 4, true, true);
      ctx.fillStyle = cfg.highlight;
      ctx.fillRect(x + tileSize / 2 - thickness / 2 + 2, y + margin + 3, 3, tileSize - margin * 2 - 6);
    }

    ctx.restore();
  }

  function drawDoorShape(tile, stateValue = DOOR_STATE.CLOSED, rotation = 0, alpha = 1) {
    const tileSize = typeof getTileSize === 'function' ? getTileSize() : TILE;
    const x = tile.x * tileSize;
    const y = tile.y * tileSize;
    const horizontal = rotation % 2 === 0;
    const open = stateValue === DOOR_STATE.OPEN;
    const thickness = Math.max(7, Math.round(tileSize * 0.17));
    const margin = Math.max(8, Math.round(tileSize * 0.16));

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b2415';
    ctx.fillStyle = '#a66b3d';

    if (!open) {
      if (horizontal) drawRoundedRectLocal(x + margin, y + tileSize / 2 - thickness / 2, tileSize - margin * 2, thickness, 4, true, true);
      else drawRoundedRectLocal(x + tileSize / 2 - thickness / 2, y + margin, thickness, tileSize - margin * 2, 4, true, true);
      ctx.fillStyle = '#ffe2a3';
      ctx.beginPath();
      ctx.arc(horizontal ? x + tileSize * 0.63 : x + tileSize * 0.57, horizontal ? y + tileSize * 0.48 : y + tileSize * 0.63, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#d6a24a';
      ctx.beginPath();
      ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.34, horizontal ? Math.PI : -Math.PI / 2, horizontal ? Math.PI * 1.5 : 0);
      ctx.stroke();
      ctx.strokeStyle = '#3b2415';
      ctx.fillStyle = '#a66b3d';
      if (horizontal) {
        ctx.translate(x + tileSize / 2, y + tileSize / 2);
        ctx.rotate(-Math.PI / 4);
        drawRoundedRectLocal(0, -thickness / 2, tileSize * 0.37, thickness, 4, true, true);
      } else {
        ctx.translate(x + tileSize / 2, y + tileSize / 2);
        ctx.rotate(Math.PI / 4);
        drawRoundedRectLocal(-thickness / 2, 0, thickness, tileSize * 0.37, 4, true, true);
      }
    }

    ctx.restore();
  }

  function drawConstructionObject(obj, alpha = 1) {
    const tile = { x: obj.x, y: obj.y };
    const type = obj.type === 'blueprint' ? buildTypeForKey(obj.buildType) : obj.type;
    const rotation = constructionRotation(obj);

    if (type === 'wall') {
      drawWallShape(tile, wallConfigForObject(obj).key, rotation, alpha);
      return true;
    }

    if (type === 'door') {
      drawDoorShape(tile, obj.state || DOOR_STATE.CLOSED, rotation, alpha);
      return true;
    }

    return false;
  }

  function drawObjectAlpha(obj) {
    if (!obj) return;
    if (window.GameSystems?.drawObject(obj)) return;
    const def = obj.type === 'blueprint' ? buildDefs?.[obj.buildType] : objectDefs?.[obj.type];
    const type = obj.type === 'blueprint' ? def?.type : obj.type;

    if (type === 'wall' || type === 'door') {
      const center = tileToWorldAlpha(obj.x, obj.y, 'center');
      const alpha = obj.type === 'blueprint' ? 0.42 : 1;
      drawConstructionObject(obj, alpha);
      if (obj.type === 'blueprint' && def) drawProgress(center.x, obj.y * TILE + 8, (obj.progress || 0) / def.work, '#9bd36a');
      if (obj.type === 'door') {
        ctx.save();
        ctx.fillStyle = obj.state === DOOR_STATE.OPEN ? 'rgba(155, 211, 106, .95)' : 'rgba(230, 120, 102, .95)';
        ctx.font = '900 9px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(obj.state === DOOR_STATE.OPEN ? 'ABERTA' : 'FECHADA', center.x, obj.y * TILE + 10);
        ctx.restore();
      }
      return;
    }

    if (originalDrawObject) originalDrawObject(obj);
  }

  function drawBuildGhostTile(buildKey, tile) {
    const def = buildDefs?.[buildKey];
    if (!def || !tile) return;

    const valid = canPlaceBuild(buildKey, tile.x, tile.y) && hasBuildPayment(buildKey);
    drawTileValidity(tile, valid);

    const type = def.type;
    if (type === 'wall') {
      drawWallShape(tile, wallMaterialForBuild(buildKey), currentBuildRotation, 0.72);
      return;
    }

    if (type === 'door') {
      drawDoorShape(tile, DOOR_STATE.CLOSED, currentBuildRotation, 0.72);
      return;
    }

    const img = images?.[objectDefs?.[type]?.img];
    if (img && typeof drawAsset === 'function') {
      drawAsset(img, tile.x * TILE + TILE / 2, (tile.y + 1) * TILE, objectScale(type, img), 0.5, 1, false, 0);
    }
  }

  function drawBuildPreviewAlpha() {
    if (!currentBuild) return;
    const currentTile = buildDragSelection?.current || (typeof mouseTile !== 'undefined' ? mouseTile : null);
    if (!currentTile) return;

    ctx.save();
    ctx.globalAlpha = 0.72;

    if (buildDragSelection?.active) {
      const rect = tileRectBetweenAlpha(buildDragSelection.start, buildDragSelection.current);
      if (rect) {
        ctx.save();
        ctx.setLineDash([7, 5]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 226, 163, .92)';
        ctx.strokeRect(rect.minX * TILE, rect.minY * TILE, (rect.maxX - rect.minX + 1) * TILE, (rect.maxY - rect.minY + 1) * TILE);
        ctx.restore();
      }
      forEachTileInRectAlpha(buildDragSelection.start, buildDragSelection.current, tile => drawBuildGhostTile(currentBuild, tile));
    } else {
      drawBuildGhostTile(currentBuild, currentTile);
    }

    const rotation = (isWallBuild(currentBuild) || isDoorBuild(currentBuild)) && typeof currentBuildRotation !== 'undefined' ? currentBuildRotation : 0;
    if (rotation) {
      ctx.fillStyle = 'rgba(0,0,0,.62)';
      ctx.fillRect(currentTile.x * TILE + 5, currentTile.y * TILE + 5, 40, 16);
      ctx.fillStyle = '#ffe2a3';
      ctx.font = '900 10px system-ui';
      ctx.fillText(`R ${rotation * 90}°`, currentTile.x * TILE + 9, currentTile.y * TILE + 17);
    }

    ctx.restore();
  }

  function installBuildTaskHandler() {
    if (!window.GameSystems?.registerTaskHandler) return;
    window.GameSystems.registerTaskHandler('build', 'alpha-grid-construction-completion', (c, task, tick) => {
      const bp = state?.objects?.find(o => o.id === task.objId && o.type === 'blueprint');
      if (!bp) return false;

      const def = buildDefs?.[bp.buildType];
      if (!def) {
        c.task = null;
        c.note = 'Ocioso';
        c.work = 0;
        return true;
      }

      bp.progress = (bp.progress || 0) + tick * workRate(c, 'build');
      c.note = `Construindo ${def.label} ${Math.floor((bp.progress / def.work) * 100)}%`;

      if (bp.progress >= def.work) {
        bp.type = def.type;
        if (bp.type === 'crop') bp.growth = 0;
        applyBuildMetadata(bp, def);
        delete bp.buildType;
        delete bp.progress;
        if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
        if (typeof log === 'function') log(`${c.name} terminou: ${def.label}.`);
        c.task = null;
        c.note = 'Ocioso';
        c.work = 0;
      }

      return true;
    }, { order: 1 });
  }

  function updateUIAlpha(force = false) {
    try {
      if (originalUpdateUI) originalUpdateUI(force);
    } catch (error) {
      console.warn('[Alpha Construction] updateUI original falhou, mantendo jogo aberto:', error);
    }

    try {
      installBuildButtons();

      if (typeof dom !== 'undefined' && dom?.buildStatus) {
        dom.buildStatus.textContent = currentBuild
          ? `Construindo: ${buildDefs[currentBuild]?.label || currentBuild}. Clique para 1 tile ou arraste para área. R gira paredes/portas.`
          : 'Nenhuma construção selecionada.';
      }

      document.querySelectorAll('[data-build]').forEach(btn => {
        const key = btn.dataset.build;
        if (!buildDefs?.[key]) return;
        const unlocked = typeof isBuildUnlocked === 'function' ? isBuildUnlocked(key) : true;
        btn.classList.toggle('active', key === currentBuild);
        btn.classList.toggle('locked', !unlocked);
        btn.disabled = !unlocked;
        btn.title = !unlocked ? `Bloqueado: pesquise ${researchDefs?.[buildDefs[key].requires]?.label || buildDefs[key].requires}.` : `${buildDefs[key].label} · ${buildCostText(key)}`;
      });
    } catch (error) {
      console.warn('[Alpha Construction] updateUI Alpha falhou sem derrubar o boot:', error);
    }
  }

  function exposeAlphaApi() {
    window.canPlaceBuild = canPlaceBuild;
    window.QueueConstruction = queueConstruction;
    window.queueConstruction = queueConstruction;
    window.placeBlueprintRect = placeBlueprintRect;
    window.toggleDoorState = toggleDoorState;
    window.applyCompletedBuildMetadata = applyBuildMetadata;
    window.selectBuildToolAlpha = selectBuildToolAlpha;
    window.hasAdjacentWallForDoor = hasAdjacentWallForDoorAlpha;
    window.isWallAnchorAt = isWallAnchorAtAlpha;

    try { canPlace = canPlaceAlpha; } catch (_) {}
    try { placeBlueprint = placeBlueprintAlpha; } catch (_) {}
    try { routePrimaryObjectAction = routePrimaryObjectActionAlpha; } catch (_) {}
    if (!window.GameSystems?.registerCollisionProvider) {
      try { isBlocked = isBlockedAlpha; } catch (_) {}
    }
    if (!window.GameSystems?.registerObjectRenderer) {
      try { drawObject = drawObjectAlpha; } catch (_) {}
    }
    try { drawBuildPreview = drawBuildPreviewAlpha; } catch (_) {}
    try { updateUI = updateUIAlpha; } catch (_) {}
  }

  function installPointerHandlers() {
    if (typeof canvas === 'undefined' || !canvas) return;
    canvas.addEventListener('mousedown', handleBuildDragMouseDown);
    canvas.addEventListener('mousemove', handleBuildDragMouseMove);
    canvas.addEventListener('mouseup', handleBuildDragMouseUp);
    canvas.addEventListener('mouseleave', handleBuildDragMouseLeave);
    document.addEventListener('click', handleBuildButtonCapture, true);
  }

  function installAlphaConstructionSystem() {
    if (window.HavenfallAlphaConstructionInstalled) return;
    window.HavenfallAlphaConstructionInstalled = true;

    try {
      installBuildDefinitions();
      exposeGridApi();
      exposeAlphaApi();
      installBuildButtons();
      installPointerHandlers();
      installBuildTaskHandler();
      window.HavenfallAlphaConstruction = 'grid-drag-door-tier-system';
      console.info('[Alpha Construction] Sistema de construção por grid carregado.');
    } catch (error) {
      window.HavenfallAlphaConstructionInstalled = false;
      window.HavenfallAlphaConstruction = 'failed';
      console.error('[Alpha Construction] Falha ao instalar sistema Alpha:', error);
    }
  }

  function scheduleAlphaConstructionInstall() {
    if (window.HavenfallContext?.gameBooted) {
      installAlphaConstructionSystem();
      return;
    }

    window.HavenfallAlphaConstruction = 'pending-boot-safe-install';
    setTimeout(scheduleAlphaConstructionInstall, 120);
  }

  scheduleAlphaConstructionInstall();
})();
