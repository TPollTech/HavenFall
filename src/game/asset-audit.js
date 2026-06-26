'use strict';

const RAW_ASSET_PIPELINE_NOTE = 'Assets brutos em assets/raw são fonte de produção. O runtime carrega apenas sprites exportados em assets/sprites e registrados em assetNames.';

const assetAudit = {
  available: new Set(assetNames),
  rawSourcePath: 'assets/raw',
  rawSourceOnly: true,
  pipelineNote: RAW_ASSET_PIPELINE_NOTE,

  categories: {
    animals: {
      rabbit: { candidates: ['rabbit', 'bunny'], fallback: 'res_raw_meat', rawRequired: true },
      spider: { candidates: ['spider'], fallback: 'icon_warn', rawRequired: true },
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
      forge: { candidates: ['forge', 'advanced_forge'], fallback: 'stove', rawRequired: true },
      sewing_table: { candidates: ['sewing_table'], fallback: 'table_wood', rawRequired: true },
      smokehouse: { candidates: ['smokehouse'], fallback: 'campfire', rawRequired: true }
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
