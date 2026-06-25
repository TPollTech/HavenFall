'use strict';

function installBuildingRoofAiFixPatch() {
  const transparentSpriteUrl = new Map();
  let roofTick = 0;

  function installStyles() {
    if (document.getElementById('buildingRoofAiFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'buildingRoofAiFixStyles';
    style.textContent = `
      #rotateWallBtn,
      .wall-rotate-btn,
      .wall-orientation-pill {
        display: none !important;
      }
      #buildStatus {
        min-height: 0;
      }
      body.clean-terrain canvas#game {
        background: #101821;
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add('clean-terrain');
  }

  function ensureBuildingDefs() {
    if (!objectDefs.door) {
      objectDefs.door = { name: 'porta', img: 'door_wood', blocks: false, door: true, roofBoundary: true };
    }
    if (!buildDefs.door) {
      buildDefs.door = { label: 'Porta', type: 'door', cost: { wood: 6 }, work: 4 };
    }
    const grid = document.querySelector('#buildPanel .build-grid');
    if (grid && !grid.querySelector('[data-build="door"]')) {
      const btn = document.createElement('button');
      btn.dataset.build = 'door';
      btn.innerHTML = 'Porta<br><small>6 madeira</small>';
      grid.insertBefore(btn, grid.querySelector('[data-build="research_desk"]') || null);
      btn.addEventListener('click', () => {
        currentBuild = 'door';
        setHudTab('build');
        updateUI(true);
      });
    }
  }

  function terrainColor(type) {
    return ({
      grass: '#25351f',
      dirt: '#473421',
      sand: '#5c5231',
      stone: '#343a3e'
    })[type] || '#25351f';
  }

  const previousDrawTile = drawTile;
  drawTile = function cleanDrawTile(x, y, type) {
    const base = terrainColor(type);
    const px = x * TILE;
    const py = y * TILE;
    ctx.save();
    ctx.fillStyle = base;
    ctx.fillRect(px - 0.5, py - 0.5, TILE + 1, TILE + 1);
    const hash = Math.abs(Math.sin((x * 127.1 + y * 311.7) * 12.9898) * 43758.5453) % 1;
    ctx.globalAlpha = 0.08 + hash * 0.05;
    ctx.fillStyle = hash > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(px + 5 + (hash * 13) % 21, py + 6 + (hash * 19) % 19, 9, 5);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(px + 28, py + 31, 13, 7);
    ctx.restore();
  };

  function isWallLike(obj) {
    return !!obj && (obj.type === 'wall' || obj.type === 'door' || (obj.type === 'blueprint' && (obj.buildType === 'wall' || obj.buildType === 'door')));
  }

  function wallAt(x, y) {
    return state?.objects?.find(o => o.x === x && o.y === y && isWallLike(o));
  }

  function solidWallAt(x, y) {
    return state?.objects?.find(o => o.x === x && o.y === y && (o.type === 'wall' || (o.type === 'blueprint' && o.buildType === 'wall')));
  }

  function doorAt(x, y) {
    return state?.objects?.find(o => o.x === x && o.y === y && (o.type === 'door' || (o.type === 'blueprint' && o.buildType === 'door')));
  }

  function drawConnectedWall(cx, cy, obj, alpha = 1) {
    const x = obj.x;
    const y = obj.y;
    const north = !!wallAt(x, y - 1);
    const south = !!wallAt(x, y + 1);
    const west = !!wallAt(x - 1, y);
    const east = !!wallAt(x + 1, y);
    const hasConnection = north || south || west || east;
    const orientation = obj.orientation === 'vertical' || obj.rotation === 90 ? 'vertical' : 'horizontal';

    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = '#191b1d';
    ctx.fillStyle = '#585b5c';
    ctx.lineWidth = 2;

    const centerW = hasConnection ? 18 : (orientation === 'vertical' ? 18 : 42);
    const centerH = hasConnection ? 18 : (orientation === 'vertical' ? 42 : 18);
    roundRect(cx - centerW / 2, cy - centerH / 2, centerW, centerH, 5, true, true);

    function arm(x1, y1, w, h) {
      ctx.fillStyle = '#595c5d';
      ctx.strokeStyle = '#1e2022';
      roundRect(x1, y1, w, h, 3, true, true);
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.fillRect(x1 + 2, y1 + 2, Math.max(2, w - 4), 1);
    }

    if (north) arm(cx - 8, cy - TILE / 2, 16, TILE / 2);
    if (south) arm(cx - 8, cy, 16, TILE / 2);
    if (west) arm(cx - TILE / 2, cy - 8, TILE / 2, 16);
    if (east) arm(cx, cy - 8, TILE / 2, 16);

    if (!hasConnection && orientation === 'vertical') {
      arm(cx - 8, cy - 21, 16, 42);
    }
    if (!hasConnection && orientation === 'horizontal') {
      arm(cx - 21, cy - 8, 42, 16);
    }

    ctx.restore();
  }

  function drawDoor(cx, cy, obj, alpha = 1) {
    const vertical = !!(wallAt(obj.x, obj.y - 1) || wallAt(obj.x, obj.y + 1)) && !(wallAt(obj.x - 1, obj.y) || wallAt(obj.x + 1, obj.y));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = '#6b4424';
    ctx.strokeStyle = '#25190d';
    ctx.lineWidth = 2;
    if (vertical) {
      roundRect(cx - 9, cy - 22, 18, 44, 5, true, true);
      ctx.fillStyle = '#d5a45d'; ctx.beginPath(); ctx.arc(cx + 4, cy, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      roundRect(cx - 22, cy - 9, 44, 18, 5, true, true);
      ctx.fillStyle = '#d5a45d'; ctx.beginPath(); ctx.arc(cx, cy + 4, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  const previousDrawObject = drawObject;
  drawObject = function connectedWallDrawObject(obj) {
    const isBlueprint = obj?.type === 'blueprint';
    const buildType = isBlueprint ? obj.buildType : obj?.type;
    if (buildType !== 'wall' && buildType !== 'door') return previousDrawObject(obj);

    const cx = obj.x * TILE + TILE / 2;
    const cy = obj.y * TILE + TILE / 2 + 14;
    const alpha = isBlueprint ? 0.48 : 1;
    if (buildType === 'door') drawDoor(cx, cy, obj, alpha);
    else drawConnectedWall(cx, cy, obj, alpha);
    if (isBlueprint) drawProgress(cx, obj.y * TILE + 8, (obj.progress || 0) / buildDefs[obj.buildType].work, '#9bd36a');
  };

  const previousDrawBuildPreview = drawBuildPreview;
  drawBuildPreview = function connectedWallDrawBuildPreview() {
    if (currentBuild !== 'wall' && currentBuild !== 'door') return previousDrawBuildPreview();
    if (!mouseTile || !isInside(mouseTile.x, mouseTile.y)) return;
    const can = canPlace(currentBuild, mouseTile.x, mouseTile.y);
    const fake = { type: 'blueprint', buildType: currentBuild, x: mouseTile.x, y: mouseTile.y, orientation: window.havenfallWallOrientation || 'horizontal' };
    const cx = mouseTile.x * TILE + TILE / 2;
    const cy = mouseTile.y * TILE + TILE / 2 + 14;
    if (currentBuild === 'door') drawDoor(cx, cy, fake, can ? 0.58 : 0.25);
    else drawConnectedWall(cx, cy, fake, can ? 0.58 : 0.25);
  };

  const previousPlaceBlueprint = placeBlueprint;
  placeBlueprint = function buildingPlaceBlueprint(buildKey, x, y) {
    const before = state?.objects?.length || 0;
    previousPlaceBlueprint(buildKey, x, y);
    const placed = [...(state.objects || [])].reverse().find(o => o.type === 'blueprint' && o.x === x && o.y === y && o.id);
    if (placed && state.objects.length > before) {
      if (buildKey === 'wall') {
        placed.orientation = window.havenfallWallOrientation || 'horizontal';
        placed.rotation = placed.orientation === 'vertical' ? 90 : 0;
      }
      if (buildKey === 'door') {
        placed.orientation = inferDoorOrientation(x, y);
        placed.rotation = placed.orientation === 'vertical' ? 90 : 0;
      }
      updateRoofMap(true);
    }
  };

  function inferDoorOrientation(x, y) {
    const northSouth = !!(solidWallAt(x, y - 1) || solidWallAt(x, y + 1));
    const eastWest = !!(solidWallAt(x - 1, y) || solidWallAt(x + 1, y));
    if (northSouth && !eastWest) return 'vertical';
    return 'horizontal';
  }

  function isRoofBoundary(x, y) {
    const obj = wallAt(x, y);
    if (!obj) return false;
    const type = obj.type === 'blueprint' ? obj.buildType : obj.type;
    return type === 'wall' || type === 'door';
  }

  function updateRoofMap(force = false) {
    if (!state?.objects || !state?.world) return;
    roofTick++;
    if (!force && roofTick % 35 !== 0) return;

    const cols = getWorldCols();
    const rows = getWorldRows();
    const outside = Array.from({ length: rows }, () => Array(cols).fill(false));
    const queue = [];

    function push(x, y) {
      if (!isInside(x, y) || outside[y][x] || isRoofBoundary(x, y)) return;
      outside[y][x] = true;
      queue.push([x, y]);
    }

    for (let x = 0; x < cols; x++) { push(x, 0); push(x, rows - 1); }
    for (let y = 0; y < rows; y++) { push(0, y); push(cols - 1, y); }

    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }

    const roofed = [];
    let count = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (!outside[y][x] && !isRoofBoundary(x, y)) {
          roofed.push(`${x},${y}`);
          count++;
        }
      }
    }
    state.roofs = roofed;
    state.roofCount = count;
  }

  function isRoofedTile(x, y) {
    if (!state?.roofs) return false;
    return state.roofs.includes(`${Math.round(x)},${Math.round(y)}`);
  }

  function drawRoofShade() {
    if (!state?.roofs?.length) return;
    const bounds = visibleTileBounds(1);
    const set = new Set(state.roofs);
    ctx.save();
    ctx.fillStyle = 'rgba(22, 32, 38, .22)';
    for (let y = bounds.startY; y <= bounds.endY; y++) {
      for (let x = bounds.startX; x <= bounds.endX; x++) {
        if (set.has(`${x},${y}`)) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    ctx.restore();
  }

  const previousDrawFogOfWar = drawFogOfWar;
  drawFogOfWar = function roofAwareFog(bounds) {
    drawRoofShade();
    previousDrawFogOfWar(bounds);
  };

  const previousUpdateWorld = updateWorld;
  updateWorld = function buildingUpdateWorld(dt) {
    previousUpdateWorld(dt);
    updateRoofMap(false);
  };

  const previousUpdateColonist = updateColonist;
  updateColonist = function roofConsequenceUpdateColonist(c, dt) {
    const beforeMood = c.mood;
    previousUpdateColonist(c, dt);
    if (!state || !c) return;
    const tick = dt * (state.speed || 1);
    const roofed = isRoofedTile(c.x, c.y);
    if (state.weather === 'chuva' && !roofed) {
      c.mood = clamp(c.mood - tick * 0.035, 0, 100);
      c.energy = clamp(c.energy - tick * 0.015, 0, 100);
      if (beforeMood >= 35 && c.mood < 35 && !c._rainNoRoofWarned) {
        c._rainNoRoofWarned = true;
        log(`${c.name} está ficando incomodado por trabalhar sem cobertura na chuva.`);
      }
    } else if (roofed && c.mood < 95) {
      c.mood = clamp(c.mood + tick * 0.01, 0, 100);
    }
  };

  function bestStockItemFor(predicate, scoreFn) {
    return Object.keys(state.items || {})
      .filter(k => (state.items[k] || 0) > 0 && predicate(itemDefs[k] || {}, k))
      .sort((a, b) => scoreFn(itemDefs[b], b) - scoreFn(itemDefs[a], a))[0] || null;
  }

  function equipBestFor(c, slot, itemKey) {
    if (!c || !itemKey) return;
    ensureEquipment(c);
    if (c.equipment?.[slot] === itemKey) return;
    const current = c.equipment?.[slot];
    const currentScore = current ? ((itemDefs[current]?.combat || 0) + (itemDefs[current]?.buildBonus || 0) + (itemDefs[current]?.craftBonus || 0)) : 0;
    const nextScore = (itemDefs[itemKey]?.combat || 0) + (itemDefs[itemKey]?.buildBonus || 0) + (itemDefs[itemKey]?.craftBonus || 0) + 0.01;
    if (!current || nextScore >= currentScore) equipItem(c, itemKey);
  }

  function autoEquipForAction(c, action, obj = null) {
    if (!c || !state?.items) return;
    ensureEquipment(c);
    if (action === 'combat') {
      const weapon = bestStockItemFor(
        def => def.slot === 'weapon' && (!def.needsAmmo || itemCount(def.needsAmmo) > 0),
        def => def.combat || 0
      );
      const offhand = bestStockItemFor(def => def.slot === 'offhand', def => (def.defense || 0) + (def.scare || 0));
      equipBestFor(c, 'weapon', weapon);
      equipBestFor(c, 'offhand', offhand);
      return;
    }
    if (action === 'gather') {
      const key = obj?.type === 'tree' || obj?.type === 'logs' || obj?.type === 'bush' ? 'wood' : (obj?.type === 'rock' || obj?.type === 'ore' ? 'stone' : null);
      if (!key) return;
      const tool = bestStockItemFor(def => def.slot === 'tool' && def.gatherBonus?.[key], def => def.gatherBonus?.[key] || 0);
      equipBestFor(c, 'tool', tool);
      return;
    }
    if (action === 'build' || action === 'craft') {
      const tool = bestStockItemFor(def => def.slot === 'tool' && (def.buildBonus || def.craftBonus), def => (def.buildBonus || 0) + (def.craftBonus || 0));
      equipBestFor(c, 'tool', tool);
    }
  }

  const previousAssignGather = assignGather;
  assignGather = function smartAssignGather(c, obj) {
    autoEquipForAction(c, 'gather', obj);
    return previousAssignGather(c, obj);
  };

  const previousAssignBuild = assignBuild;
  assignBuild = function smartAssignBuild(c, bp) {
    autoEquipForAction(c, 'build', bp);
    return previousAssignBuild(c, bp);
  };

  const previousAssignCraft = assignCraft;
  assignCraft = function smartAssignCraft(c, recipeKey, stationOverride = null) {
    autoEquipForAction(c, 'craft', stationOverride);
    return previousAssignCraft(c, recipeKey, stationOverride);
  };

  const previousAssignScare = assignScare;
  assignScare = function smartAssignScare(c, wolf) {
    autoEquipForAction(c, 'combat', wolf);
    return previousAssignScare(c, wolf);
  };

  function createTransparentSpriteSource(name) {
    if (transparentSpriteUrl.has(name)) return transparentSpriteUrl.get(name);
    const img = images[name];
    if (!img || !img.complete || !img.width || !img.height) return null;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ictx = c.getContext('2d');
    ictx.drawImage(img, 0, 0);
    let data;
    try { data = ictx.getImageData(0, 0, c.width, c.height); }
    catch { return null; }
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const neutralChecker = max > 185 && max - min < 22;
      const lightChecker = r > 214 && g > 214 && b > 214;
      const magentaKey = r > 180 && b > 180 && g < 120;
      if (neutralChecker || lightChecker || magentaKey) px[i + 3] = 0;
    }
    ictx.putImageData(data, 0, 0);
    const url = c.toDataURL('image/png');
    transparentSpriteUrl.set(name, url);
    return url;
  }

  function cleanCraftingDomImages() {
    document.querySelectorAll('img[src*="weapon_"], img[src*="tool_"], img[src*="toolkit"], img[src*="res_"]').forEach(img => {
      const match = img.getAttribute('src')?.match(/\/([^\/]+)\.png$/);
      const name = match?.[1];
      if (!name || img.dataset.cleanedSprite === '1') return;
      const url = createTransparentSpriteSource(name);
      if (url) {
        img.src = url;
        img.dataset.cleanedSprite = '1';
      }
    });
  }

  const previousUpdateUI = updateUI;
  updateUI = function buildingFixUpdateUI(force = false) {
    ensureBuildingDefs();
    previousUpdateUI(force);
    if (dom.buildStatus && currentBuild === 'wall') dom.buildStatus.textContent = 'Parede selecionada.';
    if (dom.buildStatus && currentBuild === 'door') dom.buildStatus.textContent = 'Porta selecionada.';
    cleanCraftingDomImages();
  };

  const previousStartNewGame = startNewGame;
  startNewGame = function buildingStartNewGame(config, selectedColonists) {
    const result = previousStartNewGame(config, selectedColonists);
    ensureBuildingDefs();
    updateRoofMap(true);
    return result;
  };

  const previousLoadGame = loadGame;
  loadGame = function buildingLoadGame() {
    const result = previousLoadGame();
    ensureBuildingDefs();
    updateRoofMap(true);
    return result;
  };

  window.addEventListener('keydown', e => {
    if (e.code === 'KeyG' && appScreen === SCREEN.PLAYING) {
      e.preventDefault();
      settings.showGrid = !settings.showGrid;
      showDebugGrid = settings.showGrid;
      saveSettings();
      log(settings.showGrid ? 'Grade de debug ligada.' : 'Grade de debug desligada.');
      updateUI(true);
    }
  }, true);

  installStyles();
  ensureBuildingDefs();
}
