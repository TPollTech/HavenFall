'use strict';

/**
 * ecosystem-rules.js — Fonte única da verdade para regras de ecossistema.
 *
 * NENHUM outro arquivo deve ter regras próprias de onde objetos podem nascer.
 * Sempre consultar este módulo.
 *
 * Hard rules = quebram o jogo se violadas.
 * Soft rules = preferências visuais/gameplay.
 */

(() => {
  if (window.HavenfallContext?.ecosystemRulesInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.ecosystemRulesInstalled = true;

  // ============================================================
  // 1. TIPOS DE TERRENO
  // ============================================================
  const TERRAIN = Object.freeze({
    GRASS: 'grass',
    DIRT: 'dirt',
    STONE: 'stone',
    WATER: 'water',
    SAND: 'sand',
    SNOW: 'snow',
    FOREST: 'forest',
    DESERT: 'desert',
    MOUNTAIN: 'mountain',
    ROCK: 'rock'
  });

  const TERRAIN_TAGS = Object.freeze({
    [TERRAIN.GRASS]: ['solid', 'walkable', 'buildable', 'growable'],
    [TERRAIN.DIRT]: ['solid', 'walkable', 'buildable', 'growable'],
    [TERRAIN.STONE]: ['solid', 'walkable', 'hard'],
    [TERRAIN.WATER]: ['liquid', 'blocked'],
    [TERRAIN.SAND]: ['solid', 'walkable', 'buildable', 'dry'],
    [TERRAIN.SNOW]: ['solid', 'walkable', 'cold'],
    [TERRAIN.FOREST]: ['solid', 'walkable', 'growable', 'vegetated'],
    [TERRAIN.DESERT]: ['solid', 'walkable', 'dry'],
    [TERRAIN.MOUNTAIN]: ['solid', 'blocked', 'hard', 'elevated'],
    [TERRAIN.ROCK]: ['solid', 'blocked', 'hard']
  });

  // ============================================================
  // 2. REGRAS DE ECOSSISTEMA (Hard + Soft)
  // ============================================================

  /**
   * ONDE cada tipo de objeto PODE nascer (hard rules).
   * Se o tile NÃO estiver nesta lista, o objeto é inválido.
   */
  const ALLOWED_TERRAIN = Object.freeze({
    // Recursos naturais
    tree: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.FOREST],
    palm_tree: [TERRAIN.SAND, TERRAIN.DIRT, TERRAIN.GRASS],
    cactus: [TERRAIN.SAND, TERRAIN.DIRT, TERRAIN.DESERT],
    bush: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.FOREST],
    berry: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.FOREST],
    mushrooms: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.FOREST],
    herb: [TERRAIN.GRASS, TERRAIN.DIRT],
    stick: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.SAND, TERRAIN.FOREST],
    stone_loose: [TERRAIN.GRASS, TERRAIN.DIRT, TERRAIN.STONE, TERRAIN.ROCK],
    ore: [TERRAIN.STONE, TERRAIN.DIRT, TERRAIN.ROCK, TERRAIN.MOUNTAIN],
    flint: [TERRAIN.STONE, TERRAIN.DIRT, TERRAIN.ROCK],
    clay: [TERRAIN.DIRT, TERRAIN.SAND],
    reed: [TERRAIN.SAND, TERRAIN.DIRT],
    fiber: [TERRAIN.GRASS, TERRAIN.FOREST],

    // Estruturas do jogador
    campfire: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND],
    chest: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND],
    bed: [TERRAIN.DIRT, TERRAIN.GRASS],
    workbench: [TERRAIN.DIRT, TERRAIN.GRASS],
    wall: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.STONE],
    floor: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND, TERRAIN.STONE],
    door: [TERRAIN.DIRT, TERRAIN.GRASS],
    farm_plot: [TERRAIN.DIRT, TERRAIN.GRASS],
    stockpile: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND],

    // POIs / Ruínas
    ruin: [TERRAIN.DIRT, TERRAIN.SAND, TERRAIN.GRASS],
    ancient_ruin: [TERRAIN.DIRT, TERRAIN.SAND, TERRAIN.GRASS],
    cache: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND],
    shrine: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.STONE],
    dungeon_entrance: [TERRAIN.STONE, TERRAIN.DIRT, TERRAIN.ROCK],
    mysterious_obelisk: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND, TERRAIN.STONE],

    // Spawn e área inicial
    spawn: [TERRAIN.GRASS, TERRAIN.DIRT],
    spawn_chest: [TERRAIN.DIRT, TERRAIN.GRASS, TERRAIN.SAND]
  });

  /**
   * PREFERÊNCIAS visuais/gameplay (soft rules).
   * Quebrar não trava o jogo, mas fica feio/esquisito.
   */
  const PREFERRED_TERRAIN = Object.freeze({
    tree: { [TERRAIN.FOREST]: 2.0, [TERRAIN.GRASS]: 1.5, [TERRAIN.DIRT]: 0.8 },
    palm_tree: { [TERRAIN.SAND]: 1.8, [TERRAIN.DIRT]: 1.2, [TERRAIN.GRASS]: 0.7 },
    cactus: { [TERRAIN.SAND]: 2.1, [TERRAIN.DIRT]: 1.0 },
    ruin: { [TERRAIN.DIRT]: 1.5, [TERRAIN.SAND]: 1.3, [TERRAIN.GRASS]: 0.7 },
    ore: { [TERRAIN.MOUNTAIN]: 2.0, [TERRAIN.STONE]: 1.8, [TERRAIN.ROCK]: 1.5, [TERRAIN.DIRT]: 0.3 },
    campfire: { [TERRAIN.GRASS]: 1.2, [TERRAIN.DIRT]: 1.0, [TERRAIN.SAND]: 0.6 }
  });

  /**
   * DISTÂNCIAS MÍNIMAS entre objetos (para evitar sobreposição visual).
   */
  const MIN_DISTANCE = Object.freeze({
    tree_to_tree: 2,
    tree_to_ruin: 3,
    ruin_to_ruin: 6,
    spawn_to_mountain: 8,
    spawn_to_water: 5,
    spawn_to_ruin: 4,
    chest_to_spawn: 3,
    campfire_to_spawn: 2
  });

  // ============================================================
  // 3. FUNÇÕES DE CONSULTA
  // ============================================================

  /**
   * Mapa de aliases: tipos que o world-generator usa → tipos do ecosystem-rules.
   * Isso evita guerra de nomes entre sistemas.
   */
  const TYPE_ALIASES = Object.freeze({
    rock: 'stone_loose',       // world-generator usa 'rock' para pedra solta
    crate: 'chest',             // baú inicial
    logs: 'stick',              // toras seguem regra de recurso seco
    supply_crate: 'cache',      // suprimentos seguem regra de cache
    tree_stump: 'tree',         // toco segue mesma regra de árvore
    stone_ore: 'ore',           // minério de pedra
    iron_ore: 'ore',            // minério de ferro
    coal_ore: 'ore',            // minério de carvão
    gold_ore: 'ore',            // minério de ouro
    berry_bush: 'berry',        // arbusto de fruta
    medicinal_herb: 'herb',     // erva medicinal
    fiber_plant: 'fiber',       // planta de fibra
    oak_tree: 'tree',
    birch_tree: 'tree',
    pine_tree: 'tree',
    willow_tree: 'tree',
    herbs: 'herb',
    dry_twigs: 'stick'
  });

  /**
   * Um objeto pode existir num tile específico? (HARD RULE)
   * Usa aliases para compatibilidade com world-generator.
   */
  function canObjectExistOnTile(objectType, tileType) {
    const normalized = TYPE_ALIASES[objectType] || objectType;
    const allowed = ALLOWED_TERRAIN[normalized];
    if (!allowed) return true; // tipo desconhecido = permitido por fallback
    return allowed.includes(tileType);
  }

  /**
   * Retorna o fator de preferência para um objeto num tile (SOFT RULE).
   * 1.0 = neutro, >1 = preferido, <1 = evitado, 0 = não listado (neutro)
   */
  function terrainPreference(objectType, tileType) {
    const prefs = PREFERRED_TERRAIN[objectType];
    if (!prefs) return 1.0;
    return prefs[tileType] ?? 1.0;
  }

  /**
   * Verifica se um tile é caminhável (walkable).
   */
  function isWalkable(tileType) {
    const tags = TERRAIN_TAGS[tileType];
    return tags ? tags.includes('walkable') : false;
  }

  /**
   * Verifica se um tile é bloqueado (impassável).
   */
  function isBlocked(tileType) {
    const tags = TERRAIN_TAGS[tileType];
    return tags ? tags.includes('blocked') : false;
  }

  /**
   * Verifica se um tile é construível.
   */
  function isBuildable(tileType) {
    const tags = TERRAIN_TAGS[tileType];
    return tags ? tags.includes('buildable') : false;
  }

  /**
   * Um ponto de spawn é válido? (HARD RULE)
   * - Deve estar em terreno caminhável
   * - Não pode estar em água
   * - Não pode estar em montanha
   * - Deve ter área ao redor livre
   */
  function canSpawnExistAt(world, x, y) {
    const tile = world.terrain?.[y]?.[x];
    if (!tile) return false;
    if (tile === TERRAIN.WATER) return false;
    if (tile === TERRAIN.MOUNTAIN) return false;
    if (tile === TERRAIN.ROCK) return false;
    if (!isWalkable(tile)) return false;

    // Área 5x5 ao redor precisa ser caminhável
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nt = world.terrain?.[y + dy]?.[x + dx];
        if (!nt || isBlocked(nt)) return false;
      }
    }

    return true;
  }

  /**
   * Uma ruína pode existir na posição? (HARD RULE)
   * - Não pode estar em montanha
   * - Não pode estar em água
   * - Deve estar em terreno permitido
   */
  function canPoiExistAt(world, poiType, x, y) {
    const tile = world.terrain?.[y]?.[x];
    if (!tile) return false;
    if (!canObjectExistOnTile(poiType, tile)) return false;
    return true;
  }

  /**
   * Verifica se há uma massa de montanha numa área (para evitar POIs dentro).
   */
  function isMountainMass(world, x, y, radius = 3) {
    let mountainCount = 0;
    let totalCount = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tile = world.terrain?.[y + dy]?.[x + dx];
        if (!tile) continue;
        totalCount++;
        if (tile === TERRAIN.MOUNTAIN || tile === TERRAIN.ROCK) mountainCount++;
      }
    }
    if (totalCount === 0) return false;
    return (mountainCount / totalCount) > 0.5;
  }

  /**
   * Retorna a distância mínima entre dois tipos de objeto.
   */
  function getMinDistance(typeA, typeB) {
    const key = `${typeA}_to_${typeB}`;
    if (MIN_DISTANCE[key] !== undefined) return MIN_DISTANCE[key];
    const reverseKey = `${typeB}_to_${typeA}`;
    if (MIN_DISTANCE[reverseKey] !== undefined) return MIN_DISTANCE[reverseKey];
    return 0;
  }

  /**
   * Verifica se colocar um objeto na posição respeita distâncias mínimas.
   */
  function respectsMinDistance(objects, type, x, y) {
    for (const obj of objects) {
      const minDist = getMinDistance(type, obj.type);
      if (minDist > 0) {
        const dist = Math.hypot(obj.x - x, obj.y - y);
        if (dist < minDist) return false;
      }
    }
    return true;
  }

  /**
   * Encontra o melhor tile para um objeto baseado em preferências.
   * Retorna null se não encontrar nenhum tile válido.
   */
  function findBestTile(world, objectType, preferNearX, preferNearY, searchRadius = 20) {
    const terrain = world.terrain;
    const cols = world.cols;
    const rows = world.rows;
    let bestScore = -Infinity;
    let bestPos = null;

    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const x = preferNearX + dx;
        const y = preferNearY + dy;
        if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) continue;

        const tile = terrain[y]?.[x];
        if (!tile) continue;

        // Hard check
        if (!canObjectExistOnTile(objectType, tile)) continue;

        // Soft check — score baseado em preferência + distância
        const pref = terrainPreference(objectType, tile);
        const distScore = 1 - (Math.hypot(dx, dy) / (searchRadius * 1.5));
        const totalScore = pref * 10 + distScore * 5;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestPos = { x, y };
        }
      }
    }

    return bestPos;
  }

  // ============================================================
  // 4. EXPORT
  // ============================================================
  window.HavenfallEcosystemRules = Object.freeze({
    TERRAIN,
    TERRAIN_TAGS,
    ALLOWED_TERRAIN,
    PREFERRED_TERRAIN,
    MIN_DISTANCE,
    canObjectExistOnTile,
    terrainPreference,
    isWalkable,
    isBlocked,
    isBuildable,
    canSpawnExistAt,
    canPoiExistAt,
    isMountainMass,
    getMinDistance,
    respectsMinDistance,
    findBestTile
  });
})();
