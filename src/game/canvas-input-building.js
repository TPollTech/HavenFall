'use strict';

let mouseTile = null;

canvas.addEventListener('mousedown', handleCanvasMouseDown);
canvas.addEventListener('mousemove', handleCanvasMouseMove);
canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
canvas.addEventListener('mouseup', handleCanvasMouseUp);
canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('contextmenu', handleCanvasContextMenu);

const CRAFT_STATION_TYPES = ['bench', 'forge', 'stove', 'med_station', 'sewing_table', 'smokehouse'];

function handleCanvasMouseDown(e) {
  if (e.button !== 0 || appScreen !== SCREEN.PLAYING || !state || currentBuild) return;
  const tile = tileFromEvent(e);
  if (!tile || !isInside(tile.x, tile.y)) return;

  gatherSelection = {
    start: tile,
    current: tile,
    startClientX: e.clientX,
    startClientY: e.clientY,
    active: false
  };
}

function handleCanvasMouseMove(e) {
  const tile = tileFromEvent(e);
  mouseTile = tile;

  if (!gatherSelection || !tile || !isInside(tile.x, tile.y)) return;

  gatherSelection.current = tile;
  const scale = Math.max(0.35, viewTransform?.scale || 1);
  const moved = Math.hypot(e.clientX - gatherSelection.startClientX, e.clientY - gatherSelection.startClientY);
  if (moved > 10 * scale) gatherSelection.active = true;
}

function handleCanvasMouseLeave() {
  mouseTile = null;
}

function handleCanvasMouseUp(e) {
  if (e.button !== 0 || !gatherSelection) return;

  const sel = gatherSelection;
  gatherSelection = null;

  if (!sel.active) return;

  suppressNextClick = true;
  markGatherObjectsInRect(sel.start, sel.current);
  updateUI(true);
}

function handleCanvasClick(e) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }

  hideContextMenu?.();
  if (appScreen !== SCREEN.PLAYING || !state) return;

  const tile = tileFromEvent(e);
  if (!tile || !isInside(tile.x, tile.y)) return;

  const clickedColonist = state.colonists.find(c => Math.abs(c.px - (tile.x * TILE + TILE / 2)) < 24 && Math.abs(c.py - (tile.y * TILE + TILE / 2)) < 34);
  if (clickedColonist) {
    selectedColonistId = clickedColonist.id;
    selectedWorldObjectId = null;
    updateUI(true);
    return;
  }

  if (currentBuild) {
    placeBlueprint(currentBuild, tile.x, tile.y);
    return;
  }

  const c = selectedColonist();
  const wolf = isTileVisible(tile.x, tile.y) ? getWolfAt(tile.x, tile.y) : null;
  if (wolf) {
    assignScare(c, wolf);
    return;
  }

  const obj = isTileDiscovered(tile.x, tile.y) ? getObjectAt(tile.x, tile.y) : null;
  if (obj) {
    selectedWorldObjectId = obj.id;
    if (e.shiftKey && isGatherableReady(obj)) {
      toggleGatherMark(obj);
    } else {
      routePrimaryObjectAction(c, obj);
    }
    updateUI(true);
    return;
  }

  selectedWorldObjectId = null;
  assignMove(c, tile.x, tile.y);
  updateUI(true);
}

function handleCanvasContextMenu(e) {
  e.preventDefault();
  if (appScreen !== SCREEN.PLAYING || !state) return;

  const tile = tileFromEvent(e);
  if (!tile || !isInside(tile.x, tile.y)) return;

  openContextMenuForTile(e, tile);
}

function routePrimaryObjectAction(c, obj) {
  if (!c || !obj) return;
  if (obj.type === 'blueprint') assignBuild(c, obj);
  else if (CRAFT_STATION_TYPES.includes(obj.type)) openCraftingForStation(obj);
  else if (obj.type === 'research_desk') assignResearch(c, obj);
  else if (objectDefs[obj.type]?.interactable) assignInspect(c, obj);
  else if (obj.type === 'crop' && (obj.growth || 0) < 100) log('Essa plantação ainda está crescendo.');
  else if (objectDefs[obj.type]?.gather) assignGather(c, obj);
  else log(`${objectDefs[obj.type]?.name || 'Objeto'} já está construído.`);
}

function openContextMenuForTile(e, tile) {
  const c = selectedColonist();
  const target = getContextTarget(tile);
  const actions = makeContextActions(c, target, tile);
  if (!actions.length) return;
  showContextMenu(e.clientX, e.clientY, actions, target);
}

function getContextTarget(tile) {
  const wolf = isTileVisible(tile.x, tile.y) ? getWolfAt(tile.x, tile.y) : null;
  if (wolf) return { kind: 'wolf', wolf, label: 'Lobo' };

  const obj = isTileDiscovered(tile.x, tile.y) ? getObjectAt(tile.x, tile.y) : null;
  if (obj) return { kind: 'object', obj, label: objectDefs[obj.type]?.name || 'Objeto' };

  const poi = getPoiAt(tile.x, tile.y);
  if (poi) return { kind: 'poi', poi, label: poi.name || 'Ponto desconhecido' };

  return { kind: 'tile', tile, label: 'Terreno' };
}

function getPoiAt(x, y) {
  if (!state?.world?.pointsOfInterest || !isTileDiscovered(x, y)) return null;
  return state.world.pointsOfInterest.find(p => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1 && !p.inspected) || null;
}

function makeContextActions(c, target, tile) {
  const actions = [];
  if (!c) return actions;

  if (target.kind === 'wolf') {
    actions.push({ label: 'Enfrentar ameaça', hint: 'combate narrado; arma faz diferença', run: () => assignScare(c, target.wolf) });
    return actions;
  }

  if (target.kind === 'poi') {
    actions.push({ label: 'Investigar local', hint: 'revela história e marca o ponto', run: () => assignPoiInspect(c, target.poi) });
    actions.push({ label: 'Mover até perto', hint: `${target.poi.x},${target.poi.y}`, run: () => assignMoveNearTarget(c, target.poi) });
    return actions;
  }

  if (target.kind === 'object') {
    const obj = target.obj;
    const def = objectDefs[obj.type] || {};
    selectedWorldObjectId = obj.id;

    if (def.interactable) {
      actions.push({ label: obj.inspected ? 'Examinar novamente' : 'Investigar', hint: 'lore, pistas e contexto', run: () => assignInspect(c, obj) });
      actions.push({ label: obj.looted ? 'Já vasculhado' : 'Vasculhar / abrir', hint: obj.looted ? 'sem loot restante' : 'coleta suprimentos do local', disabled: !!obj.looted, run: () => assignLoot(c, obj) });
    }
    if (obj.type === 'blueprint') actions.push({ label: 'Construir', hint: buildDefs[obj.buildType]?.label || 'obra', run: () => assignBuild(c, obj) });
    if (def.gather) {
      actions.push({ label: obj.markedForGather ? 'Desmarcar coleta' : 'Marcar para coleta', hint: 'fila automática de coleta', run: () => toggleGatherMark(obj) });
      actions.push({ label: 'Coletar agora', hint: def.name || obj.type, run: () => assignGather(c, obj) });
    }
    if (CRAFT_STATION_TYPES.includes(obj.type)) actions.push({ label: 'Abrir crafting', hint: stationLabels[obj.type] || def.name, run: () => openCraftingForStation(obj) });
    if (obj.type === 'forge') actions.push({ label: 'Forjar metal rápido', hint: '3 pedra → 1 metal', run: () => assignForge(c, obj) });
    if (obj.type === 'research_desk') actions.push({ label: 'Pesquisar', hint: 'avança a pesquisa atual', run: () => assignResearch(c, obj) });
    if (obj.type === 'stove') actions.push({ label: 'Preparar comida rápida', hint: 'receita básica', run: () => assignCook(c, obj) });
    if (obj.type === 'med_station') actions.push({ label: 'Receber tratamento', hint: 'usa remédio', run: () => assignHeal(c, obj) });
    actions.push({ label: 'Mover até perto', hint: `${obj.x},${obj.y}`, run: () => assignMoveNearTarget(c, obj) });
    return actions;
  }

  actions.push({ label: 'Mover para cá', hint: `${tile.x},${tile.y}`, run: () => assignMove(c, tile.x, tile.y) });
  return actions;
}

function assignMoveNearTarget(c, target) {
  const adj = nearestFreeAdjacent(target.x, target.y, c.x, c.y);
  if (adj) assignMove(c, adj.x, adj.y);
  else log(`${c.name} não encontrou caminho até esse ponto.`);
}

function ensureContextMenuElement() {
  let el = document.getElementById('contextMenu');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'contextMenu';
  el.className = 'context-menu';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  el.addEventListener('click', event => {
    const btn = event.target.closest('[data-context-action]');
    if (!btn || !contextMenuState) return;
    const action = contextMenuState.actions[Number(btn.dataset.contextAction)];
    hideContextMenu();
    if (action && !action.disabled) {
      action.run();
      updateUI(true);
    }
  });
  return el;
}

function showContextMenu(clientX, clientY, actions, target) {
  const el = ensureContextMenuElement();
  contextMenuState = { actions, target };
  const title = escapeHtml(target.label || 'Interação');
  el.innerHTML = `
    <div class="context-title">${title}</div>
    <div class="context-subtitle">Botão direito · ação contextual</div>
    ${actions.map((action, i) => `
      <button class="context-action ${action.disabled ? 'disabled' : ''}" ${action.disabled ? 'disabled' : ''} data-context-action="${i}">
        <span>${escapeHtml(action.label)}</span>
        ${action.hint ? `<small>${escapeHtml(action.hint)}</small>` : ''}
      </button>
    `).join('')}
  `;
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  const pad = 12;
  const rect = el.getBoundingClientRect();
  const x = Math.min(window.innerWidth - rect.width - pad, Math.max(pad, clientX));
  const y = Math.min(window.innerHeight - rect.height - pad, Math.max(pad, clientY));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function hideContextMenu() {
  const el = document.getElementById('contextMenu');
  if (el) {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }
  contextMenuState = null;
}

function tileFromEvent(e) {
  if (!canvas || !viewTransform || !canvas.width || !canvas.height) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const px = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py = (e.clientY - rect.top) * (canvas.height / rect.height);
  const worldX = (px - viewTransform.offsetX) / viewTransform.scale;
  const worldY = (py - viewTransform.offsetY) / viewTransform.scale;
  const x = Math.floor(worldX / TILE);
  const y = Math.floor(worldY / TILE);
  return { x, y };
}

function isWallAnchorAt(x, y) {
  const obj = getObjectAt(x, y);
  return !!obj && (obj.type === 'wall' || (obj.type === 'blueprint' && obj.buildType === 'wall'));
}

function hasAdjacentWallForDoor(x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWallAnchorAt(x + dx, y + dy));
}

function canPlace(type, x, y) {
  if (!isInside(x, y) || x < 1 || y < 1 || x > getWorldCols() - 2 || y > getWorldRows() - 2) return false;
  if (!isTileDiscovered(x, y)) return false;
  if (getObjectAt(x, y)) return false;
  if (state.colonists.some(c => Math.round(c.x) === x && Math.round(c.y) === y)) return false;
  if (type === 'door' && !hasAdjacentWallForDoor(x, y)) return false;
  return state.terrain[y]?.[x] !== 'stone' || type === 'wall';
}

function placeBlueprint(buildKey, x, y) {
  const def = buildDefs[buildKey];
  if (!def) return;
  if (!isBuildUnlocked(buildKey)) { log(`Precisa pesquisar ${researchDefs[def.requires]?.label || 'tecnologia'} antes de construir ${def.label}.`); return; }
  if (def.type === 'door' && !hasAdjacentWallForDoor(x, y)) { log('A porta precisa encostar em uma parede existente ou em uma blueprint de parede.'); return; }
  if (!canPlace(def.type, x, y)) { log('Não dá para construir nesse lugar.'); return; }
  if (!hasCost(def.cost || {}) || !hasItems(def.itemCost || {})) { log(`Recursos insuficientes para essa construção. Precisa de ${itemCostText(def.cost, def.itemCost)}.`); return; }
  payCost(def.cost || {});
  payItems(def.itemCost || {});
  state.objects.push({ id: uid(), type: 'blueprint', buildType: buildKey, x, y, progress: 0 });
  if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
  log(`Planta de ${def.label} posicionada.`);
  const c = selectedColonist();
  const bp = getObjectAt(x, y);
  if (c && bp) assignBuild(c, bp);
}
