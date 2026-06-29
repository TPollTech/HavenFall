'use strict';

(() => {
  if (window.HavenfallContext?.autoRoofSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.autoRoofSystemInstalled = true;

  const VERSION = 'auto-roof-v1';
  const ROOM_BOUNDARY_TYPES = new Set(['wall', 'door']);
  let scanTimer = 0;

  function ensureRoofState() {
    if (!state?.world) return null;
    const rows = Number(state.world.rows || state.terrain?.length || 0);
    const cols = Number(state.world.cols || state.terrain?.[0]?.length || 0);
    const validLayer = layer => Array.isArray(layer) && layer.length === rows && layer[0]?.length === cols;
    if (!validLayer(state.world.builtRoofLayer)) state.world.builtRoofLayer = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    if (!Array.isArray(state.world.pendingRoofJobs)) state.world.pendingRoofJobs = [];
    state.world.roofSystemVersion = VERSION;
    return state.world;
  }

  function isBoundaryAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    if (!obj) return false;
    if (ROOM_BOUNDARY_TYPES.has(obj.type)) return true;
    return obj.type === 'blueprint' && ROOM_BOUNDARY_TYPES.has(buildDefs?.[obj.buildType]?.type);
  }

  function isSolidFinishedBoundaryAt(x, y) {
    const obj = typeof getObjectAt === 'function' ? getObjectAt(x, y) : null;
    return !!obj && ROOM_BOUNDARY_TYPES.has(obj.type);
  }

  function isRoofableTile(x, y) {
    if (!state?.terrain?.[y]?.[x]) return false;
    if (isBoundaryAt(x, y)) return false;
    if (state.terrain[y][x] === 'water' || state.terrain[y][x] === 'stone') return false;
    if (typeof getRockAt === 'function' && getRockAt(x, y)?.solid) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) return false;
    return true;
  }

  function hasRoofAt(x, y) {
    const world = ensureRoofState();
    return !!world?.builtRoofLayer?.[y]?.[x];
  }

  function hasPendingJobAt(x, y) {
    const world = ensureRoofState();
    return !!world?.pendingRoofJobs?.some(job => job.x === x && job.y === y);
  }

  function detectEnclosedTiles() {
    const world = ensureRoofState();
    if (!world) return [];
    const rows = Number(world.rows || state.terrain.length || 0);
    const cols = Number(world.cols || state.terrain[0]?.length || 0);
    const outside = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
    const queue = [];

    function push(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      if (outside[y][x] || isSolidFinishedBoundaryAt(x, y)) return;
      outside[y][x] = true;
      queue.push({ x, y });
    }

    for (let x = 0; x < cols; x++) { push(x, 0); push(x, rows - 1); }
    for (let y = 0; y < rows; y++) { push(0, y); push(cols - 1, y); }

    while (queue.length) {
      const p = queue.shift();
      push(p.x + 1, p.y);
      push(p.x - 1, p.y);
      push(p.x, p.y + 1);
      push(p.x, p.y - 1);
    }

    const enclosed = [];
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (outside[y][x] || !isRoofableTile(x, y) || hasRoofAt(x, y) || hasPendingJobAt(x, y)) continue;
        enclosed.push({ x, y });
      }
    }
    return enclosed;
  }

  function addRoofJobsForClosedRooms(limit = 36) {
    const world = ensureRoofState();
    if (!world) return 0;
    const tiles = detectEnclosedTiles();
    let added = 0;
    for (const tile of tiles) {
      if (added >= limit) break;
      world.pendingRoofJobs.push({ id: `roof_${tile.x}_${tile.y}_${world.pendingRoofJobs.length}`, x: tile.x, y: tile.y, progress: 0 });
      added++;
    }
    if (added > 0 && typeof log === 'function') log(`${added} telhado${added > 1 ? 's' : ''} automático${added > 1 ? 's' : ''} planejado${added > 1 ? 's' : ''} para área fechada.`);
    return added;
  }

  function nearestRoofJob(c) {
    const world = ensureRoofState();
    if (!world?.pendingRoofJobs?.length) return null;
    let best = null;
    let bestRoute = null;
    let bestScore = Infinity;
    for (const job of world.pendingRoofJobs) {
      if (hasRoofAt(job.x, job.y)) continue;
      const adj = typeof nearestFreeAdjacent === 'function' ? nearestFreeAdjacent(job.x, job.y, c.x, c.y) : { x: job.x, y: job.y };
      if (!adj) continue;
      const alreadyThere = c.x === adj.x && c.y === adj.y;
      const path = alreadyThere ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y) : []);
      if (!alreadyThere && (!Array.isArray(path) || path.length === 0)) continue;
      const score = Math.abs(c.x - job.x) + Math.abs(c.y - job.y);
      if (score < bestScore) {
        best = job;
        bestRoute = { adj, path };
        bestScore = score;
      }
    }
    return best ? { job: best, route: bestRoute } : null;
  }

  function workHour(c) {
    const manager = window.ScheduleManager;
    if (!manager?.getScheduleState) return true;
    return manager.getScheduleState(c, state?.hour || 0) === manager.SCHEDULE?.WORK;
  }

  function assignRoofJob(c) {
    if (!state || !c || c.task || c.health <= 15 || c.energy <= 14) return false;
    if (typeof taskPriorityValue === 'function' && taskPriorityValue(c, 'build') <= 0) return false;
    if (!workHour(c)) return false;
    const target = nearestRoofJob(c);
    if (!target) return false;
    c.task = { type: 'buildRoof', roofX: target.job.x, roofY: target.job.y, x: target.route.adj.x, y: target.route.adj.y };
    c.path = target.route.path;
    c.work = 0;
    c.note = 'Indo construir telhado';
    return true;
  }

  function handleRoofBuildTask(c, task, tick) {
    const world = ensureRoofState();
    if (!world) return true;
    const job = world.pendingRoofJobs.find(j => j.x === task.roofX && j.y === task.roofY);
    if (!job || hasRoofAt(task.roofX, task.roofY)) {
      c.task = null; c.note = 'Ocioso'; c.work = 0;
      return true;
    }
    const workNeeded = 1.8;
    job.progress = Math.min(workNeeded, Number(job.progress || 0) + tick * workRate(c, 'build'));
    c.work = job.progress;
    c.note = `Construindo telhado ${Math.floor((job.progress / workNeeded) * 100)}%`;
    if (job.progress >= workNeeded) {
      world.builtRoofLayer[task.roofY][task.roofX] = true;
      world.pendingRoofJobs = world.pendingRoofJobs.filter(j => j !== job);
      c.task = null; c.note = 'Telhado concluído'; c.work = 0;
    }
    return true;
  }

  function drawRoofTile(x, y) {
    const world = ensureRoofState();
    if (!world) return;
    const built = !!world.builtRoofLayer?.[y]?.[x];
    const pending = world.pendingRoofJobs?.some(job => job.x === x && job.y === y);
    if (!built && !pending) return;
    const t = typeof getTileSize === 'function' ? getTileSize() : TILE;
    ctx.save();
    if (built) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(x * t + 3, y * t + 3, t - 6, t - 6);
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = '#f3c46b';
      ctx.strokeRect(x * t + 6, y * t + 6, t - 12, t - 12);
    } else {
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x * t + 7, y * t + 7, t - 14, t - 14);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function updateAutoRoof(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    ensureRoofState();
    scanTimer += dt * Number(state.speed || 1);
    if (scanTimer < 1.25) return;
    scanTimer = 0;
    addRoofJobsForClosedRooms(28);
  }

  window.HavenfallRoofSystem = {
    version: VERSION,
    ensureRoofState,
    detectEnclosedTiles,
    addRoofJobsForClosedRooms,
    hasPendingJobs() { return !!ensureRoofState()?.pendingRoofJobs?.length; }
  };

  window.GameSystems?.registerTick?.('auto-roof.scan', updateAutoRoof, { order: 22 });
  window.GameSystems?.registerAutoTaskProvider?.('auto-roof.build', assignRoofJob, { order: 2 });
  window.GameSystems?.registerTaskHandler?.('buildRoof', 'auto-roof.build-handler', handleRoofBuildTask, { order: 1 });
  window.GameSystems?.registerTileRenderer?.('auto-roof.overlay', drawRoofTile, { order: 7 });
})();