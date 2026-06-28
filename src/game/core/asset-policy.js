'use strict';

(() => {
  const NATURE_KEYS = new Set([
    'tile_grass', 'tile_dirt', 'tile_sand', 'tile_stone',
    'tree', 'bush', 'rock', 'logs', 'berry', 'crop_patch'
  ]);

  const NATURE_PREFIXES = [
    'edificios_tile_',
    'hand_painted_game_terrain_tileset_cut_'
  ];

  const PROCEDURAL_PREFIXES = [
    'colonist',
    'personagens_',
    'wolf_',
    'creature_sprite_sheet_with_various_animals_cut_',
    'cartoon_rpg_character_sprite_sheet_cut_',
    'colonist_equipped_raw_v19b_cut_',
    'modular_medieval_building_tiles_sprite_sheet_cut_',
    '2d_rpg_sprite_sheet_and_assets_cut_',
    'chatgpt_image_',
    'edificios_',
    'ferramentas_',
    'station_',
    'stations_raw_v19b_cut_'
  ];

  const PROCEDURAL_EXACT = new Set([
    'bed_single', 'table_wood', 'crate_wood', 'stool', 'wall_stone', 'door_wood',
    'campfire', 'chest_large', 'crafting_bench', 'research_desk', 'stove', 'med_station',
    'forge', 'bench', 'smokehouse', 'sewing_table',
    'icon_food', 'icon_wood', 'icon_stone', 'icon_metal', 'icon_warn', 'icon_health', 'icon_mood', 'icon_pause', 'icon_play', 'icon_sleep',
    'weapon_axe', 'tool_pickaxe', 'tool_mattock', 'tool_shovel', 'tool_hammer', 'tool_sledgehammer', 'tool_chisel', 'tool_sickle', 'tool_wrench', 'tool_pliers',
    'weapon_knife', 'weapon_machete', 'weapon_sword', 'weapon_spear', 'weapon_bow', 'weapon_arrows', 'weapon_club', 'weapon_shield', 'weapon_torch', 'toolkit',
    'res_rope', 'res_nails', 'res_leather', 'res_cloth', 'res_stew', 'res_raw_meat', 'res_berries', 'res_herbs', 'res_scrap'
  ]);

  function assetEntry(key) {
    return window.HavenfallAssets?.assets?.[key] || null;
  }

  function assetPath(key) {
    return String(assetEntry(key)?.path || '');
  }

  function hasAnyPrefix(key, prefixes) {
    return prefixes.some(prefix => key.startsWith(prefix));
  }

  function isNatureRuntimeAsset(name) {
    const key = String(name || '');
    const path = assetPath(key);
    if (NATURE_KEYS.has(key)) return true;
    if (hasAnyPrefix(key, NATURE_PREFIXES)) return true;
    if (path.includes('/tiles/') && !path.includes('modular_medieval_building')) return true;
    return false;
  }

  function isProceduralRuntimeAssetPolicy(name) {
    const key = String(name || '');
    const path = assetPath(key);
    if (!key) return true;
    if (isNatureRuntimeAsset(key)) return false;
    if (PROCEDURAL_EXACT.has(key)) return true;
    if (hasAnyPrefix(key, PROCEDURAL_PREFIXES)) return true;
    if (path.includes('/mobs/')) return true;
    if (path.includes('/ui/')) return true;
    return false;
  }

  function shouldLoadRuntimeSprite(name) {
    const key = String(name || '');
    if (!key) return false;
    return isNatureRuntimeAsset(key) && !isProceduralRuntimeAssetPolicy(key);
  }

  function classify(name) {
    const key = String(name || '');
    return {
      key,
      path: assetPath(key),
      mode: shouldLoadRuntimeSprite(key) ? 'PNG_NATURE_RUNTIME' : 'JS_PROCEDURAL_OR_UNUSED',
      keepPngRuntime: shouldLoadRuntimeSprite(key)
    };
  }

  function report() {
    return Object.keys(window.HavenfallAssets?.assets || {}).map(classify);
  }

  function installGlobalBindings() {
    try { window.isProceduralRuntimeAsset = isProceduralRuntimeAssetPolicy; } catch (_) {}
    window.HavenfallContext = window.HavenfallContext || {};
    window.HavenfallContext.assetPolicy = {
      rule: 'Natureza e terreno orgânico podem usar PNG; gameplay, estruturas, pawns, mobs, ferramentas, UI e objetos modulares ficam em JS.',
      loadedNatureKeys: [...NATURE_KEYS]
    };
  }

  window.HavenfallAssetPolicy = Object.freeze({
    isNatureRuntimeAsset,
    isProceduralRuntimeAsset: isProceduralRuntimeAssetPolicy,
    shouldLoadRuntimeSprite,
    classify,
    report,
    installGlobalBindings,
    natureKeys: [...NATURE_KEYS],
    rule: 'Natureza e terreno orgânico podem usar PNG; gameplay, estruturas, pawns, mobs, ferramentas, UI e objetos modulares ficam em JS.'
  });

  installGlobalBindings();
})();
