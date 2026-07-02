'use strict';

(() => {
  if (window.HavenfallContext?.advancedZonesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.advancedZonesInstalled = true;

  const advancedZoneDefs = Object.freeze({
    growing: {
      label: 'Zona de cultivo',
      short: 'Cultivo',
      hint: 'Cria talhões agrícolas por área pintada.',
      fill: 'rgba(74,222,128,.16)',
      stroke: 'rgba(74,222,128,.82)'
    },
    allowed: {
      label: 'Área permitida',
      short: 'Permitida',
      hint: 'Limita movimentação automática dos colonos.',
      fill: 'rgba(56,189,248,.12)',
      stroke: 'rgba(56,189,248,.72)'
    }
  });

  const baseZoneDefs = typeof zoneDefs !== 'undefined' ? zoneDefs : {};
  const allZoneDefs = () => ({ ...baseZoneDefs, ...advancedZoneDefs });

  window.HavenfallZones = window.HavenfallZones || {};
  window.HavenfallZones.getZoneDef = type => allZoneDefs()[type] || null;
  window.HavenfallZones.getAllZoneDefs = allZoneDefs;

  const nativeEnsureState = zoneSystem.ensureState.bind(zoneSystem);
  zoneSystem.ensureState = function ensureAdvancedZoneState() {
    const zones = nativeEnsureState();
    if (!zones) return null;
    zones.grid = zones.grid || {};
    return zones;
  };

  zoneSystem.setZone = function setAdvancedZone(x, y, zoneType) {
    const zones = this.ensureState();
    if (!zones) return false;
    if (typeof isInside === 'function' && !isInside(x, y)) return false;
    if (typeof isTileDiscovered === 'function' && !isTileDiscovered(x, y)) return false;
    const key = this.key(x, y);
    if (!zoneType || zoneType === 'none') delete zones.grid[key];
    else if (allZoneDefs()[zoneType]) zones.grid[key] = zoneType;
    else return false;
    return true;
  };

  zoneSystem.counts = function advancedZoneCounts() {
    const counts = Object.fromEntries(Object.keys(allZoneDefs()).map(key => [key, 0]));
    const zones = this.ensureState();
    if (!zones) return counts;
    for (const type of Object.values(zones.grid)) counts[type] = (counts[type] || 0) + 1;
    return counts;
  };

  zoneSystem.findFreeTile = function findFreeAdvancedZoneTile(type, predicate = null) {
    for (const tile of this.entries(type)) {
      if (getObjectAt(tile.x, tile.y)) continue;
      if (typeof isBlocked === 'function' && isBlocked(tile.x, tile.y)) continue;
      if (predicate && !predicate(tile)) continue;
      const reserved = state?.colonists?.some(c => c.task?.zoneType === type && c.task.zoneX === tile.x && c.task.zoneY === tile.y);
      if (!reserved) return { x: tile.x, y: tile.y };
    }
    return null;
  };

  zoneSystem.findFreeDumpingTile = function findFreeDumpingTile() {
    return this.findFreeTile('dumping');
  };

  zoneSystem.findFreeGrowingTile = function findFreeGrowingTile() {
    return this.findFreeTile('growing');
  };

  zoneSystem.hasAllowedArea = function hasAllowedArea() {
    return this.count('allowed') > 0;
  };

  zoneSystem.isTileAllowed = function isTileAllowed(x, y) {
    if (!this.hasAllowedArea()) return true;
    const type = this.getZoneAt(x, y);
    return type === 'allowed' || type === 'home' || type === 'safe';
  };

  const nativeAssignMove = typeof assignMove === 'function' ? assignMove : null;
  if (nativeAssignMove) {
    assignMove = function assignMoveWithAllowedArea(c, x, y) {
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(x, y)) {
        if (typeof log === 'function') log(`${c?.name || 'Colono'} não pode sair da área permitida.`);
        return false;
      }
      return nativeAssignMove(c, x, y);
    };
  }

  const nativeUpdateZoneBehaviors = updateZoneBehaviors;
  updateZoneBehaviors = function advancedZoneBehaviorsWithoutCropObjects() {
    nativeUpdateZoneBehaviors?.();
    if (!state || appScreen !== SCREEN.PLAYING) return;
    for (const c of state.colonists || []) {
      if (c.task || c.energy < 18 || c.health < 20) continue;
      if (zoneSystem.hasAllowedArea?.() && !zoneSystem.isTileAllowed?.(c.x, c.y)) {
        if (assignMoveToZone(c, 'allowed', 'Retornando para área permitida')) continue;
      }
      if (window.HavenfallFarming?.assignFarmingTask?.(c)) continue;
    }
  };

  window.zoneSystem = zoneSystem;
})();
