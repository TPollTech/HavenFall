'use strict';

(() => {
  if (window.HavenfallContext?.farmingSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.farmingSystemInstalled = true;

  const CELL_PHASES = Object.freeze({
    EMPTY: 'empty',
    PREPARE: 'prepare',
    READY_TO_SOW: 'readyToSow',
    SOWN: 'sown',
    GROWING: 'growing',
    MATURE: 'mature',
    HARVESTED: 'harvested',
    NEEDS_REPLANT: 'needsReplant'
  });

  const WORK = Object.freeze({
    prepareSoil: { duration: 1.35, note: 'Preparando solo' },
    sowCrop: { duration: 1.10, note: 'Semeando cultivo' },
    tendCrop: { duration: 0.90, note: 'Cuidando do cultivo' },
    harvestCrop: { duration: 1.25, note: 'Colhendo cultivo' }
  });

  function uidFor(prefix) {
    return typeof uid === 'function' ? uid(prefix) : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function cropDef(cropId) {
    return window.cropDefs?.[cropId] || null;
  }

  function firstCropId() {
    return Object.keys(window.cropDefs || {})[0] || 'potato';
  }

  function ensureFarmingState() {
    if (!state) return null;
    state.farming = state.farming || { plots: {}, cells: {}, foodLots: [], nextPlotIndex: 1 };
    state.farming.plots = state.farming.plots || {};
    state.farming.cells = state.farming.cells || {};
    state.farming.foodLots = state.farming.foodLots || [];
    state.farming.nextPlotIndex = Number(state.farming.nextPlotIndex || 1);
    return state.farming;
  }

  function ensureStartingSeeds() {
    const farming = ensureFarmingState();
    if (!farming || farming.seedInventoryInitialized) return;
    farming.seedInventoryInitialized = true;
    state.items = state.items || {};
    for (const def of Object.values(window.cropDefs || {})) {
      if (!def?.seedItem) continue;
      state.items[def.seedItem] = Math.max(Number(state.items[def.seedItem] || 0), 4);
    }
  }

  function createPlot(cropId = firstCropId()) {
    const farming = ensureFarmingState();
    if (!farming) return null;
    const id = uidFor('plot');
    const index = farming.nextPlotIndex++;
    farming.plots[id] = {
      id,
      name: `Talhão ${index}`,
      cropId,
      priority: 2,
      allowReplant: true,
      status: 'novo'
    };
    return farming.plots[id];
  }

  function cellsForPlot(plotId) {
    return Object.values(ensureFarmingState()?.cells || {}).filter(cell => cell.plotId === plotId);
  }

  function updatePlotStatus(plotId) {
    const farming = ensureFarmingState();
    const plot = farming?.plots?.[plotId];
    if (!plot) return;
    const cells = cellsForPlot(plotId);
    if (!cells.length) {
      delete farming.plots[plotId];
      return;
    }
    const mature = cells.filter(cell => cell.phase === CELL_PHASES.MATURE).length;
    const growing = cells.filter(cell => cell.phase === CELL_PHASES.GROWING || cell.phase === CELL_PHASES.SOWN).length;
    const pending = cells.length - mature - growing;
    plot.status = mature ? 'pronto para colher' : growing ? 'crescendo' : pending ? 'precisa trabalho' : 'ok';
    plot.cellCount = cells.length;
    plot.matureCount = mature;
  }

  function removeCellAt(x, y) {
    const farming = ensureFarmingState();
    const key = cellKey(x, y);
    const old = farming?.cells?.[key];
    if (!old) return;
    delete farming.cells[key];
    updatePlotStatus(old.plotId);
  }

  function addCellToPlot(plot, x, y) {
    const farming = ensureFarmingState();
    if (!farming || !plot) return null;
    const key = cellKey(x, y);
    const existing = farming.cells[key];
    if (existing?.plotId && existing.plotId !== plot.id) updatePlotStatus(existing.plotId);
    farming.cells[key] = {
      x,
      y,
      plotId: plot.id,
      phase: existing?.phase || CELL_PHASES.PREPARE,
      growth: Number(existing?.growth || 0),
      health: Number(existing?.health || 100),
      water: Number(existing?.water || 45),
      plantedAt: existing?.plantedAt || null,
      lastWorkedAt: existing?.lastWorkedAt || null
    };
    return farming.cells[key];
  }

  function plotForPaintedArea(bounds) {
    const farming = ensureFarmingState();
    if (!farming || !bounds) return createPlot();
    const touched = new Set();
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const cell = farming.cells[cellKey(x, y)];
        if (cell?.plotId) touched.add(cell.plotId);
      }
    }
    const keep = [...touched].find(id => farming.plots[id]);
    if (keep) return farming.plots[keep];
    return createPlot();
  }

  function onZonePaint(bounds, zoneType) {
    const farming = ensureFarmingState();
    if (!farming || !bounds) return;
    if (zoneType === 'growing') {
      const plot = plotForPaintedArea(bounds);
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
          if (zoneSystem.getZoneAt(x, y) === 'growing') addCellToPlot(plot, x, y);
        }
      }
      updatePlotStatus(plot.id);
      return;
    }
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        if (zoneSystem.getZoneAt(x, y) !== 'growing') removeCellAt(x, y);
      }
    }
  }

  function installZoneIntegration() {
    if (!zoneSystem || zoneSystem._farmingIntegrated) return;
    const nativeSetZoneRect = zoneSystem.setZoneRect.bind(zoneSystem);
    zoneSystem.setZoneRect = function setZoneRectWithFarming(startX, startY, endX, endY, zoneType) {
      const changed = nativeSetZoneRect(startX, startY, endX, endY, zoneType);
      const bounds = {
        minX: Math.min(startX, endX),
        maxX: Math.max(startX, endX),
        minY: Math.min(startY, endY),
        maxY: Math.max(startY, endY)
      };
      if (zoneType === 'growing' || zoneType === 'none' || changed) onZonePaint(bounds, zoneType);
      return changed;
    };
    zoneSystem._farmingIntegrated = true;
  }

  function hasItem(itemKey, amount = 1) {
    return Number(state?.items?.[itemKey] || 0) >= amount;
  }

  function removeItem(itemKey, amount = 1) {
    if (!hasItem(itemKey, amount)) return false;
    state.items[itemKey] = Math.max(0, Number(state.items[itemKey] || 0) - amount);
    return true;
  }

  function addItem(itemKey, amount = 1) {
    state.items = state.items || {};
    state.items[itemKey] = Number(state.items[itemKey] || 0) + amount;
  }

  function addFoodLot(itemKey, amount, cropId) {
    const farming = ensureFarmingState();
    const def = cropDef(cropId);
    if (!farming || !itemKey || amount <= 0) return;
    addItem(itemKey, amount);
    farming.foodLots.push({
      id: uidFor('foodlot'),
      itemKey,
      cropId,
      amount,
      fresh: amount,
      stale: 0,
      spoiled: 0,
      ageHours: 0,
      perishHours: Number(def?.perishHours || 72),
      needsCooling: !!def?.needsCooling,
      cooled: false
    });
  }

  function isGoodFoodLot(lot) {
    return lot && Number(lot.amount || 0) > Number(lot.spoiled || 0);
  }

  function updateFoodAggregate() {
    if (!state?.resources) return;
    const farming = ensureFarmingState();
    const fromLots = (farming?.foodLots || []).reduce((sum, lot) => sum + Math.max(0, Number(lot.amount || 0) - Number(lot.spoiled || 0)), 0);
    const itemFood = Object.entries(state.items || {}).reduce((sum, [key, amount]) => {
      const def = itemDefs?.[key];
      if (def?.kind === 'food' || def?.resourceKey === 'food') return sum + Math.max(0, Number(amount || 0));
      return sum;
    }, 0);
    state.resources.food = Math.max(0, fromLots || itemFood);
  }

  function updatePerish(hours) {
    const farming = ensureFarmingState();
    if (!farming) return;
    for (const lot of farming.foodLots) {
      if (!lot || lot.stableFood || lot.amount <= 0) continue;
      const multiplier = lot.cooled ? 0.35 : lot.needsCooling ? 1.7 : 1;
      lot.ageHours = Number(lot.ageHours || 0) + hours * multiplier;
      const perish = Math.max(1, Number(lot.perishHours || 72));
      const staleAt = perish * 0.55;
      if (lot.ageHours >= staleAt) lot.stale = Math.max(lot.stale || 0, Math.floor(lot.amount * 0.35));
      if (lot.ageHours >= perish) {
        const spoiled = Math.min(lot.amount, Math.max(lot.spoiled || 0, Math.floor(lot.amount * 0.5)));
        if (spoiled > (lot.spoiled || 0)) {
          const delta = spoiled - Number(lot.spoiled || 0);
          lot.spoiled = spoiled;
          state.items[lot.itemKey] = Math.max(0, Number(state.items[lot.itemKey] || 0) - delta);
        }
      }
    }
    farming.foodLots = farming.foodLots.filter(isGoodFoodLot);
    updateFoodAggregate();
  }

  function consumeBestFoodForColonist(c) {
    const farming = ensureFarmingState();
    if (!farming || !c) return false;
    const lots = farming.foodLots
      .filter(isGoodFoodLot)
      .sort((a, b) => {
        const defA = itemDefs?.[a.itemKey] || {};
        const defB = itemDefs?.[b.itemKey] || {};
        return Number(b.stale || 0) - Number(a.stale || 0)
          || Number(defB.nutrition || 0) - Number(defA.nutrition || 0)
          || Number(defB.moodBonus || 0) - Number(defA.moodBonus || 0);
      });
    const lot = lots[0];
    if (!lot) return false;
    const def = itemDefs?.[lot.itemKey] || {};
    lot.amount = Math.max(0, Number(lot.amount || 0) - 1);
    state.items[lot.itemKey] = Math.max(0, Number(state.items?.[lot.itemKey] || 0) - 1);
    c.hunger = Math.min(100, Number(c.hunger || 0) + Number(def.nutrition || cropDef(lot.cropId)?.hungerRestore || 20));
    c.mood = Math.min(100, Number(c.mood || 0) + Number(def.moodBonus || 0));
    updateFoodAggregate();
    if (typeof log === 'function') log(`${c.name} comeu ${def.label || lot.itemKey}.`);
    return true;
  }

  function terrainSupportsCrop(tile, cropId) {
    const def = cropDef(cropId);
    const terrain = state?.terrain?.[tile.y]?.[tile.x];
    return !def?.soilPreference?.length || def.soilPreference.includes(terrain);
  }

  function cellWorkType(cell, plot) {
    if (!cell || !plot?.cropId) return null;
    if (cell._retryCooldown && cell._retryCooldown > Date.now()) return null;
    if (cell.phase === CELL_PHASES.PREPARE || cell.phase === CELL_PHASES.EMPTY) return 'prepareSoil';
    if (cell.phase === CELL_PHASES.READY_TO_SOW || cell.phase === CELL_PHASES.NEEDS_REPLANT || cell.phase === CELL_PHASES.HARVESTED) return plot.allowReplant === false ? null : 'sowCrop';
    if ((cell.phase === CELL_PHASES.SOWN || cell.phase === CELL_PHASES.GROWING) && (cell.water < 24 || cell.health < 72)) return 'tendCrop';
    if (cell.phase === CELL_PHASES.MATURE) return 'harvestCrop';
    return null;
  }

  function findPendingCell(c) {
    const farming = ensureFarmingState();
    if (!farming) return null;
    return Object.values(farming.cells)
      .map(cell => ({ cell, plot: farming.plots[cell.plotId] }))
      .filter(entry => entry.plot && cellWorkType(entry.cell, entry.plot))
      .sort((a, b) => (b.plot.priority || 0) - (a.plot.priority || 0) || dist(c.x, c.y, a.cell.x, a.cell.y) - dist(c.x, c.y, b.cell.x, b.cell.y))[0] || null;
  }

  function assignFarmingTask(c) {
    if (!c || c.task) return false;
    const pending = findPendingCell(c);
    if (!pending) return false;
    const type = cellWorkType(pending.cell, pending.plot);
    if (!type) return false;
    const target = { x: pending.cell.x, y: pending.cell.y };
    c.task = { type, x: target.x, y: target.y, cellKey: cellKey(target.x, target.y), plotId: pending.plot.id };
    c.path = typeof findPath === 'function' ? findPath(c.x, c.y, target.x, target.y) : [];
    c.work = 0;
    c.note = WORK[type]?.note || 'Trabalhando no talhão';
    return true;
  }

  function finishPrepare(cell) {
    cell.phase = CELL_PHASES.READY_TO_SOW;
    cell.growth = 0;
    cell.water = Math.max(cell.water || 0, 45);
    cell.health = Math.max(cell.health || 0, 90);
  }

  function finishSow(cell, plot) {
    const def = cropDef(plot.cropId);
    if (!def || !terrainSupportsCrop(cell, plot.cropId)) return false;
    if (def.seedItem && !removeItem(def.seedItem, 1)) return false;
    cell.phase = CELL_PHASES.SOWN;
    cell.growth = 0;
    cell.health = Math.max(cell.health || 0, 88);
    cell.water = Math.max(cell.water || 0, 38);
    cell.plantedAt = Date.now();
    return true;
  }

  function finishTend(cell) {
    cell.phase = cell.phase === CELL_PHASES.SOWN ? CELL_PHASES.GROWING : cell.phase;
    cell.water = Math.min(100, Number(cell.water || 0) + 38);
    cell.health = Math.min(100, Number(cell.health || 0) + 14);
  }

  function finishHarvest(cell, plot) {
    const def = cropDef(plot.cropId);
    if (!def) return false;
    for (const [itemKey, amount] of Object.entries(def.yieldItems || {})) addFoodLot(itemKey, amount, plot.cropId);
    cell.phase = plot.allowReplant === false ? CELL_PHASES.HARVESTED : CELL_PHASES.NEEDS_REPLANT;
    cell.growth = 0;
    cell.plantedAt = null;
    return true;
  }

  function handleFarmingTask(c, task, tick) {
    if (!task || !WORK[task.type]) return false;
    const farming = ensureFarmingState();
    const cell = farming?.cells?.[task.cellKey];
    const plot = cell ? farming.plots[cell.plotId] : null;
    if (!cell || !plot) { c.task = null; c.work = 0; c.note = 'Ocioso'; return true; }
    c.work = Number(c.work || 0) + tick * (typeof workRate === 'function' ? workRate(c, 'handle') : 1);
    c.note = `${WORK[task.type].note} ${Math.floor((c.work / WORK[task.type].duration) * 100)}%`;
    if (c.work < WORK[task.type].duration) return true;
    let ok = true;
    if (task.type === 'prepareSoil') finishPrepare(cell);
    else if (task.type === 'sowCrop') ok = finishSow(cell, plot);
    else if (task.type === 'tendCrop') finishTend(cell);
    else if (task.type === 'harvestCrop') ok = finishHarvest(cell, plot);
    cell.lastWorkedAt = Date.now();
    updatePlotStatus(plot.id);
    c.task = null;
    c.work = 0;
    if (!ok) {
      cell._retryCooldown = Date.now() + 12000;
      c._farmingFailCooldown = 6;
      c.note = 'Falta semente ou solo adequado';
      if (typeof log === 'function' && plot?.cropId) {
        const def = cropDef(plot.cropId);
        log(`${c.name} não conseguiu semear ${def?.label || plot.cropId}. Aguardando sementes...`);
      }
    } else {
      c.note = 'Ocioso';
    }
    return true;
  }

  function updateGrowth(hours) {
    const farming = ensureFarmingState();
    if (!farming) return;
    const raining = state?.weather === 'chuva' || state?.weather === 'rain';
    for (const cell of Object.values(farming.cells)) {
      const plot = farming.plots[cell.plotId];
      const def = cropDef(plot?.cropId);
      if (!plot || !def) continue;
      if (cell.phase === CELL_PHASES.SOWN) cell.phase = CELL_PHASES.GROWING;
      if (cell.phase !== CELL_PHASES.GROWING) continue;
      cell.water = Math.max(0, Math.min(100, Number(cell.water || 0) + (raining ? 12 : -5) * hours));
      const rainBoost = raining && def.rainResponse === 'benefits' ? 1.12 : 1;
      const overwaterPenalty = raining && (def.rainResponse === 'rot_risk' || def.rainResponse === 'overwater_risk') ? 0.88 : 1;
      const waterPenalty = cell.water < 20 ? 0.45 : cell.water > 92 ? 0.72 : 1;
      cell.health = Math.max(0, Math.min(100, Number(cell.health || 100) + (cell.water < 18 || cell.water > 94 ? -8 : 2) * hours));
      cell.growth = Math.min(100, Number(cell.growth || 0) + (100 / Math.max(1, def.growHours)) * hours * rainBoost * overwaterPenalty * waterPenalty);
      if (cell.growth >= 100) cell.phase = CELL_PHASES.MATURE;
      updatePlotStatus(cell.plotId);
    }
  }

  function migrateLegacyCropObjects() {
    if (!state?.objects?.length || state.farming?.legacyCropsMigrated) return;
    const legacy = state.objects.filter(obj => obj.type === 'crop');
    if (!legacy.length) { ensureFarmingState().legacyCropsMigrated = true; return; }
    const plot = createPlot(firstCropId());
    for (const obj of legacy) {
      const cell = addCellToPlot(plot, obj.x, obj.y);
      if (cell) {
        cell.phase = obj.growth >= 100 ? CELL_PHASES.MATURE : CELL_PHASES.GROWING;
        cell.growth = Number(obj.growth || 0);
      }
    }
    state.objects = state.objects.filter(obj => obj.type !== 'crop');
    if (typeof invalidateSpatialGrid === 'function') invalidateSpatialGrid();
    updatePlotStatus(plot.id);
    ensureFarmingState().legacyCropsMigrated = true;
    if (typeof log === 'function') log('Cultivos antigos convertidos para talhões.');
  }

  function updateFarmingSystem(tick) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    ensureFarmingState();
    ensureStartingSeeds();
    migrateLegacyCropObjects();
    const hours = Math.max(0, Number(tick || 0)) / 60;
    updateGrowth(hours);
    updatePerish(hours);
    for (const c of state.colonists || []) {
      if (c.task || c.energy < 18 || c.health < 20) continue;
      if (c._farmingFailCooldown > 0) { c._farmingFailCooldown -= 1; continue; }
      assignFarmingTask(c);
    }
  }

  function setPlotCrop(plotId, cropId) {
    const farming = ensureFarmingState();
    if (!farming?.plots?.[plotId] || !cropDef(cropId)) return false;
    farming.plots[plotId].cropId = cropId;
    updatePlotStatus(plotId);
    if (typeof updateUI === 'function') updateUI(true);
    return true;
  }

  function inspectPlotAt(x, y) {
    const farming = ensureFarmingState();
    const cell = farming?.cells?.[cellKey(x, y)];
    const plot = cell ? farming.plots[cell.plotId] : null;
    return plot ? { plot, cell, crop: cropDef(plot.cropId), cells: cellsForPlot(plot.id) } : null;
  }

  window.HavenfallFarming = Object.freeze({
    CELL_PHASES,
    ensureFarmingState,
    setPlotCrop,
    inspectPlotAt,
    assignFarmingTask,
    consumeBestFoodForColonist,
    updateFoodAggregate,
    onZonePaint,
    cellKey,
    cropDef
  });

  installZoneIntegration();
  window.GameSystems?.registerTick('farming', updateFarmingSystem, { order: 92 });
  for (const type of Object.keys(WORK)) window.GameSystems?.registerTaskHandler(type, `farming.${type}`, handleFarmingTask, { order: 24 });
})();
