'use strict';

const assetAudit = {
  available: new Set(assetNames),
  categories: {
    animals: {
      rabbit: ['rabbit', 'bunny', 'res_raw_meat'],
      spider: ['spider', 'icon_warn'],
      wolf: ['wolf_0', 'wolf_1', 'wolf_2', 'wolf_3', 'wolf_4']
    },
    vegetation: {
      oak_tree: ['oak_tree', 'tree'],
      birch_tree: ['birch_tree', 'tree'],
      pine_tree: ['pine_tree', 'tree'],
      palm_tree: ['palm_tree', 'tree'],
      willow_tree: ['willow_tree', 'tree']
    },
    workstations: {
      forge: ['stove', 'crafting_bench'],
      sewing_table: ['table_wood', 'crafting_bench'],
      advanced_forge: ['stove'],
      smokehouse: ['campfire', 'stove']
    },
    tools: {
      sickle: ['tool_sickle'],
      advanced_pickaxe: ['tool_pickaxe'],
      knife: ['weapon_knife'],
      handcart: ['toolkit']
    }
  },

  resolve(candidates, fallback = 'icon_warn') {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    for (const key of list) {
      if (this.available.has(key)) return key;
    }
    return this.available.has(fallback) ? fallback : 'icon_warn';
  },

  animal(key) {
    return this.resolve(this.categories.animals[key] || key);
  },

  vegetation(key) {
    return this.resolve(this.categories.vegetation[key] || key, 'tree');
  },

  workstation(key) {
    return this.resolve(this.categories.workstations[key] || key, 'crafting_bench');
  },

  tool(key) {
    return this.resolve(this.categories.tools[key] || key, 'toolkit');
  },

  report() {
    const lines = [];
    for (const [category, entries] of Object.entries(this.categories)) {
      for (const [id, candidates] of Object.entries(entries)) {
        const resolved = this.resolve(candidates);
        lines.push({ category, id, resolved, native: candidates.includes(id) && this.available.has(id) });
      }
    }
    return lines;
  }
};

window.assetAudit = assetAudit;
window.HavenfallContext = window.HavenfallContext || {};
window.HavenfallContext.assetAuditReport = assetAudit.report();
console.table?.(window.HavenfallContext.assetAuditReport);
