'use strict';

/**
 * world-validator.js — Validador final de mundo.
 *
 * Chamado UMA VEZ no final da geração do mundo (pipeline step 8-12).
 * - Verifica hard rules
 * - Corrige o que dá
 * - Relata o que corrigiu
 * - Se não for recuperável, marca para regeneração
 */

(() => {
  if (window.HavenfallContext?.worldValidatorInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.worldValidatorInstalled = true;

  const CLAMP = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));

  // ============================================================
  // 1. VALIDAÇÃO PRINCIPAL
  // ============================================================

  /**
   * Valida e repara um mundo.
   * @param {Object} world - O mundo gerado
   * @param {Object} config - Configuração da partida
   * @returns {{ world: Object, fixes: string[], playable: boolean, valid: boolean }}
   */
  function validateWorld(world, config) {
    const fixes = [];
    const errors = [];
    const rules = window.HavenfallEcosystemRules;
    if (!rules) {
      errors.push('ecosystem-rules.js não carregado. Validação ignorada.');
      return { world, fixes, errors, playable: true, valid: true };
    }

    // skip validation if no terrain
    if (!world?.terrain || !world.cols || !world.rows) {
      return { world, fixes, errors, playable: true, valid: true };
    }

    const cols = world.cols;
    const rows = world.rows;
    const terrain = world.terrain;
    const objects = world.objects || [];
    const pois = world.pointsOfInterest || [];

    // ============================================================
    // 1.1 VALIDAR SPAWN
    // ============================================================
    if (world.spawn) {
      const spawnValid = rules.canSpawnExistAt(world, world.spawn.x, world.spawn.y);
      if (!spawnValid) {
        const newSpawn = findBestSpawn(world, rules);
        if (newSpawn) {
          world.spawn = newSpawn;
          fixes.push(`Spawn realocado para (${newSpawn.x}, ${newSpawn.y}) — ponto anterior era inválido.`);
          // Recriar spawn points
          world.spawnPoints = makeSpawnPointsSimple(world.spawn, cols, rows);
        } else {
          errors.push('Não foi possível encontrar um spawn válido no mundo.');
        }
      } else {
        fixes.push('Spawn validado: OK.');
      }
    }

    // ============================================================
    // 1.2 VALIDAR OBJETOS EM TERRENO INVÁLIDO
    // ============================================================
    const invalidObjects = [];
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const tile = terrain[obj.y]?.[obj.x];
      if (!tile) {
        objects.splice(i, 1);
        fixes.push(`Objeto ${obj.type} removido — tile inexistente.`);
        continue;
      }

      // Verifica hard rule
      if (!rules.canObjectExistOnTile(obj.type, tile)) {
        // Tenta realocar perto
        const newPos = rules.findBestTile(world, obj.type, obj.x, obj.y, 15);
        if (newPos) {
          obj.x = newPos.x;
          obj.y = newPos.y;
          fixes.push(`${obj.type} realocado de tile inválido (${tile}) para (${newPos.x}, ${newPos.y}).`);
        } else {
          objects.splice(i, 1);
          fixes.push(`${obj.type} removido — não foi possível realocar.`);
        }
        invalidObjects.push(obj);
      }
    }

    // ============================================================
    // 1.3 VALIDAR POIs (ruínas, caches, etc) EM TERRENO INVÁLIDO
    // ============================================================
    for (let i = pois.length - 1; i >= 0; i--) {
      const poi = pois[i];
      const poiType = poi.type || poi.archetype || 'ruin';
      const tile = terrain[poi.y]?.[poi.x];

      if (!tile) {
        pois.splice(i, 1);
        fixes.push(`POI ${poi.name} removido — tile inexistente.`);
        continue;
      }

      // Hard check: POI não pode estar em montanha ou água
      const inMountain = rules.isMountainMass(world, poi.x, poi.y, 3);
      if (inMountain || !rules.canPoiExistAt(world, poiType, poi.x, poi.y)) {
        const newPos = rules.findBestTile(world, poiType, world.spawn?.x || Math.floor(cols/2), world.spawn?.y || Math.floor(rows/2), 30);
        if (newPos) {
          poi.x = newPos.x;
          poi.y = newPos.y;
          fixes.push(`POI ${poi.name} realocado — estava em montanha/terreno inválido.`);
        } else {
          pois.splice(i, 1);
          fixes.push(`POI ${poi.name} removido — não foi possível realocar.`);
        }
      }
    }

    // ============================================================
    // 1.4 GARANTIR RECURSOS ESSENCIAIS PERTO DO SPAWN
    // ============================================================
    if (world.spawn) {
      const essentials = [
        { type: 'tree', count: 8, name: 'Madeira (árvores)' },
        { type: 'stone_loose', count: 4, name: 'Pedra solta' },
        { type: 'berry', count: 3, name: 'Comida (frutas)' }
      ];

      for (const essential of essentials) {
        const nearCount = countObjectsNear(objects, essential.type, world.spawn.x, world.spawn.y, 20);
        if (nearCount < essential.count) {
          const needed = essential.count - nearCount;
          let placed = 0;
          for (let attempt = 0; attempt < needed * 3; attempt++) {
            const pos = rules.findBestTile(world, essential.type, world.spawn.x, world.spawn.y, 18);
            if (pos) {
              // Verifica distância mínima com objetos existentes
              if (rules.respectsMinDistance(objects, essential.type, pos.x, pos.y)) {
                const newObj = {
                  id: generateObjId(essential.type, objects.length, config?.seed),
                  type: essential.type,
                  x: pos.x,
                  y: pos.y
                };
                objects.push(newObj);
                placed++;
                if (placed >= needed) break;
              }
            }
          }
          if (placed > 0) {
            fixes.push(`${placed}x ${essential.name} adicionado(s) perto do spawn (garantia de recursos).`);
          } else {
            fixes.push(`AVISO: Não foi possível adicionar ${essential.name} perto do spawn.`);
          }
        }
      }
    }

    // ============================================================
    // 1.5 GARANTIR CAMINHAVEL NA ÁREA DO SPAWN
    // ============================================================
    if (world.spawn) {
      const spawnX = world.spawn.x;
      const spawnY = world.spawn.y;
      let walkableArea = 0;
      const requiredWalkable = 20; // tiles caminháveis num raio 5x5

      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const tile = terrain[spawnY + dy]?.[spawnX + dx];
          if (tile && rules.isWalkable(tile)) walkableArea++;
        }
      }

      if (walkableArea < requiredWalkable) {
        // Tenta limpar área ao redor do spawn
        let cleared = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const x = spawnX + dx;
            const y = spawnY + dy;
            const tile = terrain[y]?.[x];
            if (tile && !rules.isWalkable(tile)) {
              terrain[y][x] = 'grass';
              cleared++;
            }
            // Remove objetos que estão bloqueando
            for (let i = objects.length - 1; i >= 0; i--) {
              if (Math.abs(objects[i].x - x) <= 1 && Math.abs(objects[i].y - y) <= 1) {
                if (objects[i].type !== 'spawn_chest' && objects[i].type !== 'campfire') {
                  objects.splice(i, 1);
                }
              }
            }
          }
        }
        if (cleared > 0) {
          fixes.push(`${cleared} tile(s) convertido(s) para grama na área do spawn para garantir caminhabilidade.`);
        }
      }
    }

    // ============================================================
    // 1.6 VALIDAR CAMPFIRES E CHESTS DO SPAWN
    // ============================================================
    const campfire = objects.find(o => o.type === 'campfire');
    if (campfire && world.spawn) {
      const distToSpawn = Math.hypot(campfire.x - world.spawn.x, campfire.y - world.spawn.y);
      if (distToSpawn > 5) {
        const newPos = rules.findBestTile(world, 'campfire', world.spawn.x + 2, world.spawn.y + 2, 5);
        if (newPos) {
          campfire.x = newPos.x;
          campfire.y = newPos.y;
          fixes.push('Fogueira inicial realocada para perto do spawn.');
        }
      }
    }

    const chest = objects.find(o => o.type === 'chest' || o.type === 'spawn_chest');
    if (chest && world.spawn) {
      const distToSpawn = Math.hypot(chest.x - world.spawn.x, chest.y - world.spawn.y);
      if (distToSpawn > 6) {
        const newPos = rules.findBestTile(world, 'chest', world.spawn.x + 1, world.spawn.y + 3, 5);
        if (newPos) {
          chest.x = newPos.x;
          chest.y = newPos.y;
          fixes.push('Baú inicial realocado para perto do spawn.');
        }
      }
    }

    // ============================================================
    // 1.7 ATUALIZAR REFERÊNCIAS NO MUNDO
    // ============================================================
    world.objects = objects;
    world.pointsOfInterest = pois;

    // ============================================================
    // DIAGNÓSTICO FINAL
    // ============================================================
    const playable = errors.length === 0;
    const valid = errors.length === 0;

    return {
      world,
      fixes,
      errors,
      playable,
      valid,
      seed: config?.seed || world.seed || 'unknown',
      fixCount: fixes.length,
      errorCount: errors.length
    };
  }

  // ============================================================
  // 2. FUNÇÕES AUXILIARES
  // ============================================================

  function findBestSpawn(world, rules) {
    const cols = world.cols;
    const rows = world.rows;
    const terrain = world.terrain;
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    const searchRadius = Math.min(cols, rows) * 0.3;

    let best = null;
    let bestScore = -Infinity;

    for (let y = Math.max(4, Math.floor(centerY - searchRadius)); y <= Math.min(rows - 5, Math.floor(centerY + searchRadius)); y++) {
      for (let x = Math.max(4, Math.floor(centerX - searchRadius)); x <= Math.min(cols - 5, Math.floor(centerX + searchRadius)); x++) {
        if (!rules.canSpawnExistAt(world, x, y)) continue;

        // Score: centralidade + terreno preferido
        const distToCenter = Math.hypot(x - centerX, y - centerY);
        const tile = terrain[y]?.[x];
        const pref = rules.terrainPreference('spawn', tile);
        const score = pref * 10 - distToCenter * 0.5;

        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }

    return best;
  }

  function countObjectsNear(objects, type, cx, cy, radius) {
    return objects.filter(o => o.type === type && Math.hypot(o.x - cx, o.y - cy) <= radius).length;
  }

  function makeSpawnPointsSimple(spawn, cols, rows) {
    const points = [];
    for (let y = Math.max(0, spawn.y - 2); y <= Math.min(rows - 1, spawn.y + 2); y++) {
      for (let x = Math.max(0, spawn.x - 2); x <= Math.min(cols - 1, spawn.x + 2); x++) {
        points.push({ x, y });
      }
    }
    return points;
  }

  let _objIdCounter = 99999;
  function generateObjId(type, index, seed) {
    _objIdCounter++;
    const hash = (seed ? String(seed) : '') + '-' + _objIdCounter;
    return `validated-${type}-${hash}`;
  }

  // ============================================================
  // 3. EXPORT
  // ============================================================
  const api = {
    validateWorld,
    findBestSpawn
  };

  window.HavenfallWorldValidator = Object.freeze(api);
  window.validateWorld = (world, config) => validateWorld(world, config);
})();