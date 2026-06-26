'use strict';

function installBuildingRoofAiFixPatch() {
  if (window.BuildingRoofSystem?.installed) return;

  const system = {
    installed: true,
    wallIndex,
    solidWallIndex,
    doorIndex,
    roofSet,
    roofArrayRef,
    wallIndexDirty,
    lastWallObjectCount,
    roofTick,

    tileKey(x, y) {
      return `${Math.round(x)},${Math.round(y)}`;
    },

    isWallLike(obj) {
      return !!obj && (
        obj.type === 'wall' ||
        obj.type === 'door' ||
        objectDefs[obj.type]?.roofBoundary ||
        (obj.type === 'blueprint' && (obj.buildType === 'wall' || obj.buildType === 'door'))
      );
    },

    isSolidWallLike(obj) {
      return !!obj && (
        obj.type === 'wall' ||
        (obj.type === 'blueprint' && obj.buildType === 'wall')
      );
    },

    isDoorLike(obj) {
      return !!obj && (
        obj.type === 'door' ||
        (obj.type === 'blueprint' && obj.buildType === 'door')
      );
    },

    markStructureDirty() {
      this.wallIndexDirty = true;
      wallIndexDirty = true;
    },

    ensureBuildingDefs() {
      if (!objectDefs.door) {
        objectDefs.door = {
          name: 'porta',
          img: 'door_wood',
          blocks: false,
          door: true,
          roofBoundary: true
        };
      }
      if (!buildDefs.door) {
        buildDefs.door = {
          label: 'Porta',
          type: 'door',
          cost: { wood: 6 },
          work: 4
        };
      }
    },

    rebuildWallIndex(force = false) {
      const objects = state?.objects || [];
      if (!force && !this.wallIndexDirty && this.lastWallObjectCount === objects.length) return;

      this.wallIndex = wallIndex = new Map();
      this.solidWallIndex = solidWallIndex = new Map();
      this.doorIndex = doorIndex = new Map();

      for (const obj of objects) {
        if (!this.isWallLike(obj)) continue;
        const key = this.tileKey(obj.x, obj.y);
        this.wallIndex.set(key, obj);
        if (this.isSolidWallLike(obj)) this.solidWallIndex.set(key, obj);
        if (this.isDoorLike(obj)) this.doorIndex.set(key, obj);
      }

      this.lastWallObjectCount = lastWallObjectCount = objects.length;
      this.wallIndexDirty = wallIndexDirty = false;
    },

    wallAt(x, y) {
      this.rebuildWallIndex();
      return this.wallIndex.get(this.tileKey(x, y));
    },

    solidWallAt(x, y) {
      this.rebuildWallIndex();
      return this.solidWallIndex.get(this.tileKey(x, y));
    },

    doorAt(x, y) {
      this.rebuildWallIndex();
      return this.doorIndex.get(this.tileKey(x, y));
    },

    setRoofedTiles(roofed) {
      if (!state) return;
      state.roofs = roofed;
      this.roofArrayRef = roofArrayRef = roofed;
      this.roofSet = roofSet = new Set(roofed);
      state.roofCount = roofed.length;
    },

    syncRoofSetFromState() {
      if (!state?.roofs) {
        this.roofArrayRef = roofArrayRef = null;
        this.roofSet = roofSet = new Set();
        return;
      }
      if (this.roofArrayRef !== state.roofs) {
        this.roofArrayRef = roofArrayRef = state.roofs;
        this.roofSet = roofSet = new Set(state.roofs);
      }
    },

    updateRoofMap(force = false) {
      if (!state?.objects || !state?.world) return;
      this.roofTick = roofTick = roofTick + 1;
      if (!force && this.roofTick % 60 !== 0) return;

      this.rebuildWallIndex(force || this.wallIndexDirty);

      const cols = getWorldCols();
      const rows = getWorldRows();
      const outside = Array.from({ length: rows }, () => new Uint8Array(cols));
      const queueX = [];
      const queueY = [];

      const push = (x, y) => {
        if (!isInside(x, y) || outside[y][x] || this.wallIndex.has(this.tileKey(x, y))) return;
        outside[y][x] = 1;
        queueX.push(x);
        queueY.push(y);
      };

      for (let x = 0; x < cols; x++) {
        push(x, 0);
        push(x, rows - 1);
      }
      for (let y = 0; y < rows; y++) {
        push(0, y);
        push(cols - 1, y);
      }

      for (let i = 0; i < queueX.length; i++) {
        const x = queueX[i];
        const y = queueY[i];
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }

      const roofed = [];
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          if (!outside[y][x] && !this.wallIndex.has(this.tileKey(x, y))) roofed.push(`${x},${y}`);
        }
      }

      this.setRoofedTiles(roofed);
    },

    isRoofedTile(x, y) {
      this.syncRoofSetFromState();
      return this.roofSet.has(this.tileKey(x, y));
    },

    applyWeatherConsequences(dt) {
      if (!state?.colonists?.length) return;
      const tick = dt * (state.speed || 1);
      for (const c of state.colonists) {
        if (!c || c.dead || c.downed) continue;
        const beforeMood = c.mood;
        const roofed = this.isRoofedTile(c.x, c.y);
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
      }
    },

    drawRoofShade() {
      this.syncRoofSetFromState();
      if (!this.roofSet.size || typeof visibleTileBounds !== 'function') return;
      const bounds = visibleTileBounds(1);
      ctx.save();
      ctx.fillStyle = 'rgba(22, 32, 38, .22)';
      for (let y = bounds.startY; y <= bounds.endY; y++) {
        for (let x = bounds.startX; x <= bounds.endX; x++) {
          if (this.roofSet.has(this.tileKey(x, y))) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
      ctx.restore();
    },

    bestStockItemFor(predicate, scoreFn) {
      return Object.keys(state?.items || {})
        .filter(k => (state.items[k] || 0) > 0 && predicate(itemDefs[k] || {}, k))
        .sort((a, b) => scoreFn(itemDefs[b], b) - scoreFn(itemDefs[a], a))[0] || null;
    },

    equipBestFor(c, slot, itemKey) {
      if (!c || !itemKey) return;
      ensureEquipment(c);
      if (c.equipment?.[slot] === itemKey) return;
      const current = c.equipment?.[slot];
      const currentScore = current ? ((itemDefs[current]?.combat || 0) + (itemDefs[current]?.buildBonus || 0) + (itemDefs[current]?.craftBonus || 0)) : 0;
      const nextScore = (itemDefs[itemKey]?.combat || 0) + (itemDefs[itemKey]?.buildBonus || 0) + (itemDefs[itemKey]?.craftBonus || 0) + 0.01;
      if (!current || nextScore >= currentScore) equipItem(c, itemKey);
    },

    prepareColonistForAction(c, action, obj = null) {
      if (!c || !state?.items) return;
      ensureEquipment(c);
      if (action === 'combat') {
        const equipment = this.bestStockItemFor(
          def => def.slot === 'weapon' && (!def.needsAmmo || itemCount(def.needsAmmo) > 0),
          def => def.combat || 0
        );
        const offhand = this.bestStockItemFor(def => def.slot === 'offhand', def => (def.defense || 0) + (def.scare || 0));
        this.equipBestFor(c, 'weapon', equipment);
        this.equipBestFor(c, 'offhand', offhand);
        return;
      }
      if (action === 'gather') {
        const key = obj?.type === 'tree' || obj?.type === 'logs' || obj?.type === 'bush'
          ? 'wood'
          : (obj?.type === 'rock' || obj?.type === 'ore' ? 'stone' : null);
        if (!key) return;
        const tool = this.bestStockItemFor(def => def.slot === 'tool' && def.gatherBonus?.[key], def => def.gatherBonus?.[key] || 0);
        this.equipBestFor(c, 'tool', tool);
        return;
      }
      if (action === 'build' || action === 'craft') {
        const tool = this.bestStockItemFor(def => def.slot === 'tool' && (def.buildBonus || def.craftBonus), def => (def.buildBonus || 0) + (def.craftBonus || 0));
        this.equipBestFor(c, 'tool', tool);
      }
    },

    update(dt) {
      this.ensureBuildingDefs();
      if (this.wallIndexDirty || this.lastWallObjectCount !== (state?.objects?.length || 0)) this.rebuildWallIndex(true);
      this.updateRoofMap(false);
      this.applyWeatherConsequences(dt);
    },

    initialize() {
      this.ensureBuildingDefs();
      this.markStructureDirty();
      this.rebuildWallIndex(true);
      this.updateRoofMap(true);
    }
  };

  window.BuildingRoofSystem = system;
  system.initialize();
}
