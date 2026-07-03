'use strict';

(() => {
  if (window.HavenfallContext?.miningProcessingInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.miningProcessingInstalled = true;

  const VEIN_TYPES = Object.freeze({
    iron: { label: 'Ferro', rawItem: 'rawIron', purityWeights: [0.20, 0.50, 0.25, 0.05], baseYield: 2, work: 8.0, color: '#7f1d1d', glowColor: 'rgba(200,50,50,0.25)' },
    copper: { label: 'Cobre', rawItem: 'rawCopper', purityWeights: [0.25, 0.45, 0.25, 0.05], baseYield: 2, work: 8.0, color: '#b85c1e', glowColor: 'rgba(220,120,40,0.25)' },
    coal: { label: 'Carvão', rawItem: 'rawCoal', purityWeights: [0.30, 0.45, 0.20, 0.05], baseYield: 3, work: 6.0, color: '#1f2937', glowColor: 'rgba(50,50,50,0.20)' },
    tin: { label: 'Estanho', rawItem: 'rawTin', purityWeights: [0.30, 0.50, 0.18, 0.02], baseYield: 2, work: 7.0, color: '#71717a', glowColor: 'rgba(150,150,160,0.20)' }
  });

  const PURITY_LABELS = Object.freeze(['Impuro', 'Normal', 'Rico', 'Excepcional']);
  const PURITY_COLORS = Object.freeze(['#9ca3af', '#fbbf24', '#f59e0b', '#ef4444']);

  const VEIN_MINE_COOLDOWN_MS = 800;
  const VEIN_MINE_RANGE = 1.85;

  function veinDefFor(obj) {
    if (!obj?.veinType) return null;
    return VEIN_TYPES[obj.veinType] || null;
  }

  function ensureVeinState(obj) {
    if (!obj) return null;
    if (!Number.isInteger(obj.veinPurity) || obj.veinPurity < 0 || obj.veinPurity >= PURITY_LABELS.length) {
      const weights = veinDefFor(obj)?.purityWeights || VEIN_TYPES.iron.purityWeights;
      const roll = Math.random();
      let cumulative = 0;
      obj.veinPurity = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (roll <= cumulative) { obj.veinPurity = i; break; }
      }
    }
    if (!Number.isFinite(obj.veinHp)) obj.veinHp = 100;
    if (!Number.isFinite(obj.veinMaxHp)) obj.veinMaxHp = 100;
    if (obj.veinPurityKnown === undefined) obj.veinPurityKnown = false;
    return obj;
  }

  function colonistCanRevealVeinPurity(c) {
    return c?.equipment?.tool === 'geologicalHammer';
  }

  function isVeinPurityKnown(obj) {
    ensureVeinState(obj);
    return !!obj?.veinPurityKnown;
  }

  function revealVeinPurity(obj, c = null) {
    ensureVeinState(obj);
    if (colonistCanRevealVeinPurity(c)) obj.veinPurityKnown = true;
    return !!obj?.veinPurityKnown;
  }

  function purityText(obj, options = {}) {
    ensureVeinState(obj);
    const known = revealVeinPurity(obj, options.colonist) || isVeinPurityKnown(obj) || !!options.forceReveal;
    if (!known) return options.includeUnknown === false ? '' : 'pureza desconhecida';
    return PURITY_LABELS[obj.veinPurity] || 'Normal';
  }

  function getVeinYield(obj, c) {
    const def = veinDefFor(obj);
    if (!def) return 0;
    ensureVeinState(obj);
    const purity = obj.veinPurity || 0;
    const purityMultiplier = [0.6, 1.0, 1.6, 2.5][purity] || 1;
    let toolMultiplier = 1.0;
    if (c) {
      const tool = c.equipment?.tool;
      if (tool === 'ironPickaxe') toolMultiplier = 1.6;
      else if (tool === 'copperPickaxe') toolMultiplier = 1.35;
      else if (tool === 'pickaxe') toolMultiplier = 1.2;
      const energyPenalty = c.energy < 20 ? 0.6 : c.energy < 40 ? 0.8 : 1;
      toolMultiplier *= energyPenalty;
    }
    return Math.max(1, Math.round(def.baseYield * purityMultiplier * toolMultiplier));
  }

  function veinProgressPerTick(c, obj) {
    const def = veinDefFor(obj);
    if (!def) return 1;
    let speed = 1.0;
    const tool = c?.equipment?.tool;
    if (tool === 'ironPickaxe') speed = 1.8;
    else if (tool === 'copperPickaxe') speed = 1.4;
    else if (tool === 'pickaxe') speed = 1.15;
    else if (tool === 'geologicalHammer') speed = 1.0;
    return speed / def.work;
  }

  function findNearestVein(c, range = 4) {
    if (!c || !state?.objects) return null;
    let best = null;
    let bestDist = Infinity;
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    for (const obj of state.objects) {
      if (!obj?.vein) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) continue;
      const d = Math.hypot(obj.x - cx, obj.y - cy);
      if (d <= range && d < bestDist) {
        bestDist = d;
        best = obj;
      }
    }
    return best;
  }

  function isNearVein(c, obj) {
    if (!c || !obj) return false;
    const cx = Math.round(c.x);
    const cy = Math.round(c.y);
    return Math.hypot(obj.x - cx, obj.y - cy) <= VEIN_MINE_RANGE;
  }

  function veinInteraction(c) {
    const vein = findNearestVein(c, 3);
    if (!vein) return null;
    const def = veinDefFor(vein);
    if (!def) return null;
    ensureVeinState(vein);
    const purity = purityText(vein, { colonist: c });
    return {
      kind: 'veinMine',
      obj: vein,
      label: purity ? `Minerar ${def.label} (${purity})` : `Minerar ${def.label}`,
      priority: 91
    };
  }

  function cancelVeinTask(c) {
    if (!c) return;
    c.task = null;
    c.path = [];
    c.work = 0;
    c._veinMineCooldown = 0;
    c.note = 'Ocioso';
  }

  function assignVeinMine(c, obj) {
    if (!c || !obj) return false;
    revealVeinPurity(obj, c);
    const adj = typeof nearestFreeAdjacent === 'function'
      ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y)
      : null;
    if (!adj) return false;
    const alreadyAt = Math.round(c.x) === adj.x && Math.round(c.y) === adj.y;
    const path = alreadyAt ? [] : (typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, obj) : []);
    if (!alreadyAt && (!Array.isArray(path) || path.length === 0)) return false;
    c.task = { type: 'veinMine', objId: obj.id, x: adj.x, y: adj.y };
    c.path = path;
    c.work = 0;
    c._veinMineCooldown = 0;
    const def = veinDefFor(obj);
    c.note = alreadyAt ? `Minerando ${def?.label || 'veio'}` : `Indo minerar ${def?.label || 'veio'}`;
    return true;
  }

  function handleVeinMineTask(c, task, tick) {
    if (task?.type !== 'veinMine') return false;
    const obj = state?.objects?.find(o => o.id === task.objId && o.vein);
    if (!obj) {
      cancelVeinTask(c);
      return true;
    }
    const def = veinDefFor(obj);
    if (!def) {
      cancelVeinTask(c);
      return true;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (c._veinMineCooldown && now < c._veinMineCooldown) return true;
    const atWork = Math.round(c.x) === Math.round(task.x) && Math.round(c.y) === Math.round(task.y);
    const adjacent = Math.abs(Math.round(c.x) - Math.round(obj.x)) + Math.abs(Math.round(c.y) - Math.round(obj.y)) <= 1;
    if (!atWork || !adjacent) {
      const adj = typeof nearestFreeAdjacent === 'function'
        ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y)
        : null;
      if (adj) {
        task.x = adj.x;
        task.y = adj.y;
        c.path = typeof findPath === 'function' ? findPath(c.x, c.y, adj.x, adj.y, obj) : [];
        c.note = `Indo minerar ${def.label}`;
      } else {
        cancelVeinTask(c);
      }
      return true;
    }
    const workRate = typeof window.workRate === 'function' ? window.workRate(c, 'gather') : 1;
    const progress = tick * 12 * workRate * veinProgressPerTick(c, obj);
    c.work += progress;
    ensureVeinState(obj);
    obj.veinHp = Math.max(0, (obj.veinHp || 100) - progress);
    if (obj.veinHp <= 0) {
      const yieldCount = getVeinYield(obj, c);
      const wasKnown = isVeinPurityKnown(obj);
      obj.veinPurityKnown = true;
      if (typeof addItems === 'function') {
        addItems({ [def.rawItem]: yieldCount }, { reason: 'vein-mine', actorId: c.id, x: obj.x, y: obj.y });
      }
      window.HavenfallWorkFeedback?.notifyComplete?.('veinMine', { veinType: obj.veinType, yield: yieldCount, purity: obj.veinPurity }, obj.x, obj.y);
      obj.veinHp = obj.veinMaxHp || 100;
      c._veinMineCooldown = now + VEIN_MINE_COOLDOWN_MS;
      c.work = 0;
      const purity = PURITY_LABELS[obj.veinPurity || 0] || 'Normal';
      const logMsg = wasKnown
        ? `${c.name} minerou ${def.label} (${purity}). Obtido: +${yieldCount} ${def.label}.`
        : `${c.name} confirmou pureza ${purity} em ${def.label}. Obtido: +${yieldCount} ${def.label}.`;
      if (typeof log === 'function') log(logMsg);
      c.note = `Minerando ${def.label}`;
    } else {
      const pct = Math.floor((1 - (obj.veinHp / (obj.veinMaxHp || 100))) * 100);
      const purity = purityText(obj, { includeUnknown: false });
      c.note = purity
        ? `Minerando ${def.label} ${pct}% (${purity})`
        : `Minerando ${def.label} ${pct}%`;
    }
    return true;
  }

  function nearestVeinForAutoMine(c) {
    if (!c || !state?.objects) return null;
    let best = null;
    let bestDist = Infinity;
    for (const obj of state.objects) {
      if (!obj?.vein) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) continue;
      const adj = typeof nearestFreeAdjacent === 'function'
        ? nearestFreeAdjacent(obj.x, obj.y, c.x, c.y)
        : null;
      if (!adj) continue;
      const d = Math.abs(c.x - obj.x) + Math.abs(c.y - obj.y);
      if (d < bestDist) {
        bestDist = d;
        best = obj;
      }
    }
    return best;
  }

  function autoVeinMineProvider(c) {
    if (!c || c.task) return false;
    if (typeof getColonistTaskPriority === 'function' && getColonistTaskPriority(c, 'gather') <= 0) return false;
    const energy = Number(c.energy ?? 100);
    if (energy < 20) return false;
    const target = nearestVeinForAutoMine(c);
    if (!target) return false;
    return assignVeinMine(c, target);
  }

  function findAutoVeinMineForMarked(c) {
    if (!c || c.task) return false;
    if (typeof getColonistTaskPriority === 'function' && getColonistTaskPriority(c, 'gather') <= 0) return false;
    const target = nearestVeinForAutoMine(c);
    if (!target) return false;
    return assignVeinMine(c, target);
  }

  function drawVeinOverlay() {
    if (!state?.objects?.length || appScreen !== SCREEN.PLAYING) return;
    ctx.save();
    ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
    ctx.scale(viewTransform.scale, viewTransform.scale);
    for (const obj of state.objects) {
      if (!obj?.vein) continue;
      if (typeof isTileDiscovered === 'function' && !isTileDiscovered(obj.x, obj.y)) continue;
      const def = veinDefFor(obj);
      if (!def) continue;
      ensureVeinState(obj);
      const cx = obj.x * TILE + TILE / 2;
      const cy = obj.y * TILE + TILE / 2;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = def.color;
      ctx.fillRect(obj.x * TILE + 1, obj.y * TILE + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = isVeinPurityKnown(obj) ? (PURITY_COLORS[obj.veinPurity] || '#fbbf24') : '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(obj.x * TILE + 3, obj.y * TILE + 3, TILE - 6, TILE - 6);
      ctx.setLineDash([]);
      const hpPct = Math.max(0.15, Math.min(1, (obj.veinHp || 100) / (obj.veinMaxHp || 100)));
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(obj.x * TILE + 5, obj.y * TILE + TILE - 7, (TILE - 10) * hpPct, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function installDefs() {
    stationLabels.pestle = stationLabels.pestle || 'Pilão de Pedra';
    stationLabels.selectionTable = stationLabels.selectionTable || 'Mesa de Seleção';
    stationLabels.furnace = stationLabels.furnace || 'Fornalha Simples';
    stationLabels.anvil = stationLabels.anvil || 'Bigorna';
  }

  function installBuildButtons() {
    const grid = document.querySelector('.build-grid');
    if (!grid) return;
    const entries = [
      ['pestle', 'Pilão de Pedra<br><small>6 pedra + 4 madeira</small>'],
      ['selectionTable', 'Mesa de Seleção<br><small>8 madeira + 2 pedra</small>'],
      ['furnace', 'Fornalha Simples<br><small>10 pedra + 4 madeira</small>'],
      ['anvil', 'Bigorna<br><small>8 pedra + 4 metal</small>']
    ];
    const existing = new Set();
    grid.querySelectorAll('[data-build]').forEach(btn => existing.add(btn.dataset.build));
    const ref = grid.querySelector('[data-build="butcher_table"]') || grid.querySelector('[data-build="bridge"]');
    for (const [key, html] of entries) {
      if (existing.has(key)) continue;
      const btn = document.createElement('button');
      btn.dataset.build = key;
      btn.innerHTML = html;
      if (ref) grid.insertBefore(btn, ref);
      else grid.appendChild(btn);
    }
  }

  function updateTick(dt) {
    if (!state || appScreen !== SCREEN.PLAYING) return;
    installDefs();
    installBuildButtons();
  }

  window.veinDefFor = veinDefFor;
  window.ensureVeinState = ensureVeinState;
  window.getVeinYield = getVeinYield;
  window.findNearestVein = findNearestVein;
  window.veinInteraction = veinInteraction;
  window.assignVeinMine = assignVeinMine;
  window.nearestVeinForAutoMine = nearestVeinForAutoMine;
  window.VEIN_TYPES = VEIN_TYPES;
  window.PURITY_LABELS = PURITY_LABELS;
  window.PURITY_COLORS = PURITY_COLORS;
  window.revealVeinPurity = revealVeinPurity;
  window.isVeinPurityKnown = isVeinPurityKnown;

  window.GameSystems?.registerTick('mining-processing', updateTick, { order: 65 });
  window.GameSystems?.registerTaskHandler('veinMine', 'mining-processing.vein', handleVeinMineTask, { order: 15 });
  window.GameSystems?.registerDrawOverlay('mining-processing.veins', drawVeinOverlay, { order: 20 });
})();
