'use strict';

const RAW_ASSET_PIPELINE_NOTE = 'Assets brutos em assets/raw são fonte de produção. O runtime carrega sprites organizados em assets/mobs, assets/tiles, assets/vfx e assets/ui via assets/manifest.js.';

const assetAudit = {
  available: new Set([...assetNames, ...Object.keys(window.HavenfallAssets?.assets || {})]),
  rawSourcePath: 'assets/raw',
  rawSourceOnly: true,
  pipelineNote: RAW_ASSET_PIPELINE_NOTE,

  categories: {
    animals: {
      rabbit: {
        candidates: [
          'rabbit', 'bunny',
          'creature_sprite_sheet_with_various_animals_cut_019',
          'creature_sprite_sheet_with_various_animals_cut_020',
          'creature_sprite_sheet_with_various_animals_cut_021',
          'creature_sprite_sheet_with_various_animals_cut_022',
          'creature_sprite_sheet_with_various_animals_cut_023'
        ],
        fallback: 'res_raw_meat',
        rawRequired: false
      },
      spider: {
        candidates: [
          'spider',
          'creature_sprite_sheet_with_various_animals_cut_035',
          'creature_sprite_sheet_with_various_animals_cut_036',
          'creature_sprite_sheet_with_various_animals_cut_037',
          'creature_sprite_sheet_with_various_animals_cut_038',
          'creature_sprite_sheet_with_various_animals_cut_039'
        ],
        fallback: 'icon_warn',
        rawRequired: false
      },
      wolf: { candidates: ['wolf_0', 'wolf_1', 'wolf_2', 'wolf_3', 'wolf_4'], fallback: 'wolf_0', rawRequired: false }
    },
    vegetation: {
      oak_tree: { candidates: ['oak_tree'], fallback: 'tree', rawRequired: true },
      birch_tree: { candidates: ['birch_tree'], fallback: 'tree', rawRequired: true },
      pine_tree: { candidates: ['pine_tree'], fallback: 'tree', rawRequired: true },
      palm_tree: { candidates: ['palm_tree'], fallback: 'tree', rawRequired: true },
      willow_tree: { candidates: ['willow_tree'], fallback: 'tree', rawRequired: true }
    },
    workstations: {
      forge: { candidates: ['edificios_forge', 'forge', 'advanced_forge'], fallback: 'edificios_forge', rawRequired: false },
      blueprint_bench: { candidates: ['station_blueprint_bench', 'stations_raw_v19b_cut_002'], fallback: 'crafting_bench', rawRequired: false },
      carpentry_bench: { candidates: ['station_carpentry_bench', 'stations_raw_v19b_cut_003'], fallback: 'crafting_bench', rawRequired: false },
      sewing_table: { candidates: ['station_sewing_table', 'stations_raw_v19b_cut_004'], fallback: 'table_wood', rawRequired: false },
      smokehouse: { candidates: ['stations_raw_v19b_cut_005', 'survival_crafting_game_asset_collection_cut_004'], fallback: 'campfire', rawRequired: false },
      crate: { candidates: ['container_crate_large', 'stations_raw_v19b_cut_010'], fallback: 'crate_wood', rawRequired: false },
      chest: { candidates: ['container_chest_large_alt', 'stations_raw_v19b_cut_012'], fallback: 'chest_large', rawRequired: false },
      weapon_rack: { candidates: ['weapon_rack_alt', 'stations_raw_v19b_cut_011'], fallback: 'weapon_rack_alt', rawRequired: false },
      tool_rack: { candidates: ['tool_rack_alt', 'stations_raw_v19b_cut_013'], fallback: 'tool_rack_alt', rawRequired: false }
    },
    tools: {
      sickle: { candidates: ['tool_sickle', 'sickle'], fallback: 'tool_sickle', rawRequired: false },
      advanced_pickaxe: { candidates: ['tool_pickaxe', 'advanced_pickaxe'], fallback: 'tool_pickaxe', rawRequired: false },
      knife: { candidates: ['weapon_knife', 'knife'], fallback: 'weapon_knife', rawRequired: false },
      handcart: { candidates: ['handcart'], fallback: 'toolkit', rawRequired: true }
    }
  },

  normalizeEntry(entry) {
    if (Array.isArray(entry)) return { candidates: entry, fallback: 'icon_warn', rawRequired: true };
    return entry || { candidates: [], fallback: 'icon_warn', rawRequired: true };
  },

  resolve(entry, fallbackOverride = null) {
    const normalized = this.normalizeEntry(entry);
    const list = Array.isArray(normalized.candidates) ? normalized.candidates : [normalized.candidates];
    for (const key of list) {
      if (this.available.has(key)) return key;
    }
    const fallback = fallbackOverride || normalized.fallback || 'icon_warn';
    return this.available.has(fallback) ? fallback : 'icon_warn';
  },

  isNativeReady(entry) {
    const normalized = this.normalizeEntry(entry);
    const list = Array.isArray(normalized.candidates) ? normalized.candidates : [normalized.candidates];
    return list.some(key => this.available.has(key));
  },

  animal(key) {
    return this.resolve(this.categories.animals[key]);
  },

  vegetation(key) {
    return this.resolve(this.categories.vegetation[key], 'tree');
  },

  workstation(key) {
    return this.resolve(this.categories.workstations[key], 'crafting_bench');
  },

  tool(key) {
    return this.resolve(this.categories.tools[key], 'toolkit');
  },

  report() {
    const lines = [];
    for (const [category, entries] of Object.entries(this.categories)) {
      for (const [id, entry] of Object.entries(entries)) {
        const normalized = this.normalizeEntry(entry);
        const nativeReady = this.isNativeReady(normalized);
        lines.push({
          category,
          id,
          resolved: this.resolve(normalized),
          nativeReady,
          fallbackActive: !nativeReady,
          rawSourceOnly: !!normalized.rawRequired && !nativeReady,
          note: nativeReady ? 'sprite pronto no assetNames' : 'fallback registrado; raw não é carregado no runtime'
        });
      }
    }
    return lines;
  },

  missingRawExports() {
    return this.report().filter(row => row.rawSourceOnly);
  },

  printReport() {
    console.info('[Asset Audit]', this.pipelineNote);
    console.table?.(this.report());
  }
};

window.assetAudit = assetAudit;
window.HavenfallContext = window.HavenfallContext || {};
window.HavenfallContext.assetAuditReport = assetAudit.report();
window.HavenfallContext.rawAssetPipelineNote = RAW_ASSET_PIPELINE_NOTE;

if (new URLSearchParams(window.location.search).has('assetAudit')) {
  assetAudit.printReport();
}
