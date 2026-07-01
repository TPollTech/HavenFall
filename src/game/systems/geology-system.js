'use strict';

(() => {
  const ROCK_DEFS = Object.freeze({
    granite: { label: 'Granito', hp: 180, resource: 'stone', yield: 9, mineSpeed: 0.82, insulation: 0.72, color: '#4b5563' },
    sandstone: { label: 'Arenito', hp: 105, resource: 'stone', yield: 5, mineSpeed: 1.2, insulation: 0.38, color: '#a16207' },
    slate: { label: 'Ardósia', hp: 145, resource: 'stone', yield: 7, mineSpeed: 1.0, insulation: 0.55, color: '#334155' },
    iron: { label: 'Veio de ferro', hp: 165, resource: 'metal', yield: 5, mineSpeed: 0.9, insulation: 0.48, color: '#7f1d1d' }
  });

  const MINING_PATH_COOLDOWN_MS = 7000;

  function rockTypeForBiome(biomeId, x, y, seed) {
    const n = typeof worldNoise === 'function' ? worldNoise(seed, x, y, 'rock-type') : Math.random();
    if (biomeId === 'desert') return n > 0.78 ? 'slate' : 'sandstone';
    if (biomeId === 'snow') return n > 0.70 ? 'iron' : 'granite';
    if (n > 0.86) return 'iron';
    if (n > 0.58) return 'slate';
    return 'granite';
  }

  function shouldBecomeMountain(world, x, y, seed) {
    const terrain = world?.terrain?.[y]?.[x];
    if (terrain !== 'stone') return false;
    const spawn = world.spawn || { x: 0, y: 0 };
    if (Math.hypot(x - spawn.x, y - spawn.y) < 8) return false;
    const biomeId = getBiomeIdForWorld(world, x, y);
    const mass = countNearbyStoneTerrain(world, x, y, 1);
    if (mass >= 4) return true;
    if (mass <= 1 && worldNoise(seed, x, y, 'mountain-isolated-rock') > 0.18) return false;
    const ridge = typeof worldNoise === 'function' ? worldNoise(seed, Math.floor(x / 3), Math.floor(y / 3), 'mountain-ridge') : Math.random();
    const core = typeof worldNoise === 'function' ? worldNoise(seed, x, y, 'mountain-core') : Math.random();
    const threshold = biomeId === 'snow' ? 0.50 : biomeId === 'desert' ? 0.64 : 0.56;
    return ridge > threshold - mass * 0.035 || core > 0.82 - mass * 0.04;
  }

  function countNearbyStoneTerrain(world, x, y, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) {
      if (xx === x && yy === y) continue;
      if (world?.terrain?.[yy]?.[xx] === 'stone') count++;
    }
    return count;
  }

  function getBiomeIdForWorld(world, x, y) {
    return world?.biomes?.[y]?.[x] || (window.BiomeEngine?.getBiomeIdAt?.(world, x, y)) || 'forest';
  }

  function makeEmptyLayer(rows, cols, valueFactory) {
    return Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => valueFactory(x, y)));
  }

  function createRockTile(world, x, y, seed) {
    const biomeId = getBiomeIdForWorld(world, x, y);
    const type = rockTypeForBiome(biomeId, x, y, seed);
    const def = ROCK_DEFS[type] || ROCK_DEFS.granite;
    const hpMultiplier = biomeId === 'desert' ? 0.78 : biomeId === 'snow' ? 1.18 : 1;
    const resourceMultiplier = biomeId === 'desert' ? 0.72 : biomeId === 'snow' ? 1.05 : 1;
    const maxHp = Math.max(40, Math.round(def.hp * hpMultiplier));
    return { type, hp: maxHp, maxHp, isRoof: true, mineable: true, solid: true, markedForMining: false, resource: def.resource, yield: Math.max(1, Math.round(def.yield * resourceMultiplier)), biomeId, insulation: def.insulation, collapseRisk: 0 };
  }

  function createGeologyLayer(world) {
    const rows = Number(world?.rows || world?.terrain?.length || 0);
    const cols = Number(world?.cols || world?.terrain?.[0]?.length || 0);
    const seed = world?.seed || state?.config?.seed || 'geology';
    const layer = makeEmptyLayer(rows, cols, (x, y) => shouldBecomeMountain(world, x, y, seed) ? createRockTile(world, x, y, seed) : null);
    pruneSmallRockClusters(layer, 9);
    return layer;
  }

  function pruneSmallRockClusters(layer, minSize) {
    const rows = layer.length;
    const cols = layer[0]?.length || 0;
    const seen = new Set();
    const key = (x, y) => `${x},${y}`;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!layer[y]?.[x]?.solid || seen.has(key(x, y))) continue;
        const stack = [[x, y]];
        const cells = [];
        seen.add(key(x, y));
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            const k = key(nx, ny);
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(k) || !layer[ny]?.[nx]?.solid) continue;
            seen.add(k);
            stack.push([nx, ny]);
          }
        }
        if (cells.length < minSize) for (const [cx, cy] of cells) layer[cy][cx] = null;
      }
    }
  }

  function createRoofLayer(world) {
    const rows = Number(world?.rows || world?.terrain?.length || 0);
    const cols = Number(world?.cols || world?.terrain?.[0]?.length || 0);
    const geology = world?.geologyLayer || [];
    return makeEmptyLayer(rows, cols, (x, y) => !!geology[y]?.[x]?.solid);
  }

  function ensureGeologyState(world = state?.world) {
    if (!world) return null;
    const rows = Number(world.rows || world.terrain?.length || state?.terrain?.length || 0);
    const cols = Number(world.cols || world.terrain?.[0]?.length || state?.terrain?.[0]?.length || 0);
    world.rows = world.rows || rows;
    world.cols = world.cols || cols;
    if (!world.terrain && state?.terrain) world.terrain = state.terrain;
    if (!Array.isArray(world.geologyLayer) || world.geologyLayer.length !== rows || world.geologyLayer[0]?.length !== cols) world.geologyLayer = createGeologyLayer(world);
    if (!Array.isArray(world.naturalRoofLayer) || world.naturalRoofLayer.length !== rows || world.naturalRoofLayer[0]?.length !== cols) {
      const legacyRoof = Array.isArray(world.roofLayer) && typeof world.roofLayer?.[0]?.[0] === 'boolean' ? world.roofLayer : null;
      world.naturalRoofLayer = legacyRoof || createRoofLayer(world);
    }
    world.geologyVersion = '1.2-backdrop';
    return world.geologyLayer;
  }

  function getRockAt(x, y, world = state?.world) { ensureGeologyState(world); return world?.geologyLayer?.[Math.round(y)]?.[Math.round(x)] || null; }
  function hasNaturalRoofAt(x, y, world = state?.world) { ensureGeologyState(world); return !!world?.naturalRoofLayer?.[Math.round(y)]?.[Math.round(x)]; }
  function isMountainBlocked(x, y) { return !!getRockAt(x, y)?.solid; }

  function markRockForMining(x, y, marked = true) { const rock = getRockAt(x, y); if (!rock?.mineable || !rock.solid) return false; rock.markedForMining = !!marked; return true; }
  function toggleRockMiningMark(x, y) { const rock = getRockAt(x, y); if (!rock?.mineable || !rock.solid) return false; rock.markedForMining = !rock.markedForMining; return rock.markedForMining; }

  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  function miningTargetKey(x, y) { return `${Math.round(Number(x) || 0)},${Math.round(Number(y) || 0)}`; }

  function ensureMiningPathMemory(c) {
    if (!c) return null;
    c._blockedMiningTargets = c._blockedMiningTargets && typeof c._blockedMiningTargets === 'object' ? c._blockedMiningTargets : {};
    const now = nowMs();
    for (const [key, entry] of Object.entries(c._blockedMiningTargets)) {
      if (Number(entry?.until || 0) <= now) delete c._blockedMiningTargets[key];
    }
    return c._blockedMiningTargets;
  }

  function isMiningTargetBlockedFor(c, x, y) {
    const memory = ensureMiningPathMemory(c);
    if (!memory) return false;
    const entry = memory[miningTargetKey(x, y)];
    return !!(entry && Number(entry.until || 0) > nowMs());
  }

  function rememberMiningTargetBlocked(c, x, y, reason = 'sem caminho para mineração') {
    const memory = ensureMiningPathMemory(c);
    if (!memory) return;
    memory[miningTargetKey(x, y)] = { until: nowMs() + MINING_PATH_COOLDOWN_MS, reason };
  }

  function clearMiningTargetBlocked(c, x, y) {
    const memory = ensureMiningPathMemory(c);
    if (memory) delete memory[miningTargetKey(x, y)];
  }

  function miningAdjacentCandidates(c, x, y) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return dirs
      .map(([dx, dy]) => ({ x: Math.round(Number(x) || 0) + dx, y: Math.round(Number(y) || 0) + dy }))
      .filter(tile => {
        if (typeof isInside === 'function' && !isInside(tile.x, tile.y)) return false;
        if (typeof isTileDiscovered === 'function' && !isTileDiscovered(tile.x, tile.y)) return false;
        if (typeof isBlocked === 'function' && isBlocked(tile.x, tile.y)) return false;
        return true;
      })
      .sort((a, b) => {
        const da = Math.abs((c?.x || 0) - a.x) + Math.abs((c?.y || 0) - a.y);
        const db = Math.abs((c?.x || 0) - b.x) + Math.abs((c?.y || 0) - b.y);
        return da - db;
      });
  }

  function findReachableMiningAdjacent(c, x, y, options = {}) {
    if (!c || typeof findPath !== 'function') return null;
    const rock = getRockAt(x, y);
    if (!rock?.mineable || !rock.solid) return null;
    if (!options.ignoreCooldown && isMiningTargetBlockedFor(c, x, y)) return null;

    for (const adj of miningAdjacentCandidates(c, x, y)) {
      const alreadyAtWorkTile = Math.round(c.x) === adj.x && Math.round(c.y) === adj.y;
      const path = alreadyAtWorkTile ? [] : findPath(c.x, c.y, adj.x, adj.y, null, { maxVisited: options.maxVisited || 6200 });
      if (alreadyAtWorkTile || (Array.isArray(path) && path.length > 0)) {
        clearMiningTargetBlocked(c, x, y);
        return { adj, path, rock, alreadyAtWorkTile };
      }
    }

    if (options.rememberFailure !== false) rememberMiningTargetBlocked(c, x, y);
    return null;
  }

  function nearestMarkedMine(c) {
    if (!c || !state?.world) return null;
    ensureGeologyState();
    let best = null;
    let bestScore = Infinity;
    const layer = state.world.geologyLayer || [];
    for (let y = 0; y < layer.length; y++) {
      for (let x = 0; x < (layer[y]?.length || 0); x++) {
        const rock = layer[y][x];
        if (!rock?.solid || !rock.mineable || !rock.markedForMining) continue;
        if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) continue;
        const access = findReachableMiningAdjacent(c, x, y, { rememberFailure: true });
        if (!access) continue;
        const pathCost = access.alreadyAtWorkTile ? 0 : access.path.length;
        const rockDistance = Math.abs(c.x - x) + Math.abs(c.y - y);
        const score = pathCost * 10 + rockDistance;
        if (score < bestScore) { bestScore = score; best = { x, y, rock, adj: access.adj, path: access.path, alreadyAtWorkTile: access.alreadyAtWorkTile }; }
      }
    }
    return best;
  }

  function recalculateRoofLayer(world = state?.world, center = null, radius = 7) {
    if (!world) return null;
    ensureGeologyState(world);
    const rows = world.rows;
    const cols = world.cols;
    const startX = center ? Math.max(0, Math.floor(center.x - radius)) : 0;
    const endX = center ? Math.min(cols - 1, Math.ceil(center.x + radius)) : cols - 1;
    const startY = center ? Math.max(0, Math.floor(center.y - radius)) : 0;
    const endY = center ? Math.min(rows - 1, Math.ceil(center.y + radius)) : rows - 1;
    let changed = false;
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const rock = world.geologyLayer[y]?.[x];
        const before = !!world.naturalRoofLayer[y][x];
        if (rock?.solid) {
          world.naturalRoofLayer[y][x] = true;
          rock.isRoof = true;
          rock.collapseRisk = 0;
          if (!before) changed = true;
          continue;
        }
        const supported = countNearbySolidRock(world, x, y, 2) >= 2;
        const deep = countNearbySolidRock(world, x, y, 4) >= 7;
        world.naturalRoofLayer[y][x] = !!(supported && deep);
        if (world.naturalRoofLayer[y][x] !== before) changed = true;
      }
    }
    if (changed) window.LightingSystem?.invalidate?.('natural-roof-change', world);
    return world.naturalRoofLayer;
  }

  function countNearbySolidRock(world, x, y, radius) {
    let count = 0;
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) if (!(xx === x && yy === y) && world.geologyLayer?.[yy]?.[xx]?.solid) count++;
    return count;
  }

  function mineRockAt(x, y, power = 1, world = state?.world) {
    const rock = getRockAt(x, y, world);
    if (!rock?.mineable || !rock.solid) return { done: false, removed: false, reason: 'not-mineable' };
    const def = ROCK_DEFS[rock.type] || ROCK_DEFS.granite;
    rock.hp = Math.max(0, Number(rock.hp || 0) - Math.max(1, Number(power || 1)) * def.mineSpeed);
    if (rock.hp > 0) return { done: true, removed: false, hp: rock.hp, maxHp: rock.maxHp };
    const gain = { [rock.resource || 'stone']: rock.yield || 1 };
    if (typeof addResources === 'function') addResources(gain);
    world.geologyLayer[y][x] = null;
    if (world.terrain?.[y]?.[x] === 'stone') world.terrain[y][x] = rock.biomeId === 'desert' ? 'sand' : 'dirt';
    recalculateRoofLayer(world, { x, y }, 8);
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    return { done: true, removed: true, gain, roof: !!world.naturalRoofLayer?.[y]?.[x] };
  }

  function geologyLabelAt(x, y) {
    const rock = getRockAt(x, y);
    if (!rock) return hasNaturalRoofAt(x, y) ? 'Teto natural' : 'Sem rocha';
    const def = ROCK_DEFS[rock.type] || ROCK_DEFS.granite;
    return `${def.label} ${Math.ceil(rock.hp)}/${rock.maxHp}`;
  }

  function rockFillColor(rock) { return (ROCK_DEFS[rock?.type] || ROCK_DEFS.granite).color || '#4b5563'; }

  function drawRockBody(x, y, rock) {
    if (!ctx || !rock?.solid) return false;
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = rockFillColor(rock);
    ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.fillRect(x * TILE + 2, y * TILE + TILE * 0.55, TILE - 4, TILE * 0.38);
    ctx.restore();
    ctx.globalAlpha = 1;
    return true;
  }

  function drawGeologyTileBackdrop(x, y) {
    if (!state?.world || appScreen !== SCREEN.PLAYING) return false;
    const layer = Array.isArray(state.world.geologyLayer) ? state.world.geologyLayer : ensureGeologyState();
    return drawRockBody(x, y, layer?.[y]?.[x]);
  }

  function drawGeologyBackdrop(bounds = null) {
    if (!state?.world || appScreen !== SCREEN.PLAYING) return;
    ensureGeologyState();
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(2) : { startX: 0, startY: 0, endX: getWorldCols() - 1, endY: getWorldRows() - 1 });
    ctx.save();
    for (let y = b.startY; y <= b.endY; y++) {
      for (let x = b.startX; x <= b.endX; x++) {
        const rock = state.world.geologyLayer?.[y]?.[x];
        if (!rock?.solid) continue;
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = rockFillColor(rock);
        ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        ctx.fillRect(x * TILE + 2, y * TILE + TILE * 0.55, TILE - 4, TILE * 0.38);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawGeologyOverlay(bounds = null) {
    if (!state?.world || appScreen !== SCREEN.PLAYING) return;
    ensureGeologyState();
    const b = bounds || (typeof visibleTileBounds === 'function' ? visibleTileBounds(2) : { startX: 0, startY: 0, endX: getWorldCols() - 1, endY: getWorldRows() - 1 });
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (let y = b.startY; y <= b.endY; y++) {
      for (let x = b.startX; x <= b.endX; x++) {
        const rock = state.world.geologyLayer?.[y]?.[x];
        const roof = state.world.naturalRoofLayer?.[y]?.[x];
        if (rock?.solid) {
          if (rock.markedForMining) {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
            ctx.setLineDash([]);
          }
          if (rock.hp < rock.maxHp) {
            const hpPct = Math.max(0.15, Math.min(1, Number(rock.hp || 0) / Math.max(1, Number(rock.maxHp || 1))));
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(x * TILE + 7, y * TILE + TILE - 9, (TILE - 14) * hpPct, 3);
          }
        } else if (roof) {
          ctx.globalAlpha = 0.10;
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x * TILE + 5, y * TILE + 5, TILE - 10, TILE - 10);
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function updateGeologyTick() { ensureGeologyState(); }

  window.GeologySystem = { ROCK_DEFS, ensureGeologyState, getRockAt, hasNaturalRoofAt, isMountainBlocked, markRockForMining, toggleRockMiningMark, nearestMarkedMine, findReachableMiningAdjacent, rememberMiningTargetBlocked, clearMiningTargetBlocked, mineRockAt, recalculateRoofLayer, geologyLabelAt, createGeologyLayer, createRoofLayer, drawGeologyTileBackdrop, drawGeologyBackdrop, drawGeologyOverlay };
  window.ensureGeologyState = ensureGeologyState;
  window.getRockAt = getRockAt;
  window.hasNaturalRoofAt = hasNaturalRoofAt;
  window.isMountainBlocked = isMountainBlocked;
  window.markRockForMining = markRockForMining;
  window.toggleRockMiningMark = toggleRockMiningMark;
  window.nearestMarkedMine = nearestMarkedMine;
  window.findReachableMiningAdjacent = findReachableMiningAdjacent;
  window.rememberMiningTargetBlocked = rememberMiningTargetBlocked;
  window.clearMiningTargetBlocked = clearMiningTargetBlocked;
  window.mineRockAt = mineRockAt;
  window.drawGeologyTileBackdrop = drawGeologyTileBackdrop;
  window.drawGeologyBackdrop = drawGeologyBackdrop;
  window.drawGeologyOverlay = drawGeologyOverlay;
  window.updateGeologyTick = updateGeologyTick;
  window.GameSystems?.registerTick('geology', updateGeologyTick, { order: 10 });
  // Mountain visuals are handled by the dedicated terrain renderer to avoid duplicate tile passes.
  window.GameSystems?.registerTileRenderer('geology.backdrop', drawGeologyTileBackdrop, { order: 5, enabled: false, renderPass: 'static' });
  window.GameSystems?.registerDrawOverlay('geology', drawGeologyOverlay, { order: 10 });
})();
