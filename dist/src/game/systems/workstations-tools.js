'use strict';

function installWorkbenchExpansionDefs() {
  if (window.HavenfallContext?.workbenchExpansionInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  itemDefs.rawMeat = { label: 'Carne crua', icon: 'res_raw_meat', kind: 'food', note: 'Ingrediente obtido de caça.' };
  itemDefs.bones = { label: 'Ossos', icon: assetAudit?.resolve?.({ candidates: ['res_bones'], fallback: 'res_scrap' }) || 'res_scrap', kind: 'material', note: 'Material para futuras ferramentas e decoração.' };
  itemDefs.feathers = { label: 'Penas', icon: assetAudit?.resolve?.({ candidates: ['res_feather', 'recursos_feathers'], fallback: 'res_cloth' }) || 'res_cloth', kind: 'material', note: 'Material leve obtido de aves.' };
  itemDefs.venom = { label: 'Veneno', icon: 'icon_warn', kind: 'material', note: 'Recurso raro de aranhas.' };
  itemDefs.sickle = { label: 'Foice', icon: assetAudit?.tool?.('sickle') || 'tool_sickle', slot: 'tool', kind: 'tool', gatherBonus: { food: 1.0, medicine: 1.0 }, combat: 0.8, maxDurability: 30, note: 'Dobra a eficiência em plantações e ervas.' };
  itemDefs.advancedPickaxe = { label: 'Picareta reforçada', icon: assetAudit?.tool?.('advanced_pickaxe') || 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.7, metal: 0.7 }, combat: 1.4, maxDurability: 50, note: 'Mineração durável para biomas rochosos.' };
  itemDefs.thermalClothes = { label: 'Roupa térmica', icon: 'res_cloth', slot: 'offhand', kind: 'clothing', defense: 0.08, coldResist: 0.45, note: 'Ajuda contra frio e chuva.' };
  itemDefs.fishingRod = { label: 'Vara de pesca', icon: assetAudit?.resolve?.({ candidates: ['tool_fishing_rod', 'fishing_rod'], fallback: 'tool_spear' }) || 'tool_spear', slot: 'tool', kind: 'tool', gatherBonus: { food: 0.8 }, combat: 0.6, maxDurability: 20, note: 'Permite pescar em corpos d\'água.' };
  itemDefs.fieldRations = { label: 'Rações de campo', icon: assetAudit?.resolve?.({ candidates: ['res_field_rations', 'rations'], fallback: 'res_stew' }) || 'res_stew', kind: 'food', nutrition: 30, moodBonus: 1, stableFood: true, resourceKey: 'food', note: 'Comida compacta de longa duração.' };

  objectDefs.bench = { ...(objectDefs.bench || {}), img: assetAudit?.workstation?.('carpentry_bench') || objectDefs.bench?.img || 'crafting_bench' };
  objectDefs.crate = { ...(objectDefs.crate || {}), img: assetAudit?.workstation?.('crate') || objectDefs.crate?.img || 'crate_wood' };
  objectDefs.cache = { ...(objectDefs.cache || {}), img: assetAudit?.workstation?.('chest') || objectDefs.cache?.img || 'chest_large' };
  objectDefs.sewing_table = { name: 'mesa de alfaiataria', img: assetAudit?.workstation?.('sewing_table') || 'table_wood', blocks: true, craft: 1, work: 4.5 };
  objectDefs.smokehouse = { name: 'mesa de defumação', img: assetAudit?.workstation?.('smokehouse') || 'campfire', blocks: true, cook: { input: { wood: 2 }, output: {} }, craft: 1, work: 5.5 };
  objectDefs.butcher_table = { name: 'açougue', img: assetAudit?.workstation?.('butcher_table') || 'table_wood', blocks: true, craft: 1, work: 4.5 };

  buildDefs.sewing_table = { label: 'Alfaiataria', type: 'sewing_table', cost: { wood: 16 }, itemCost: { leather: 2 }, work: 7, requires: 'medicine' };
  buildDefs.smokehouse = { label: 'Defumador', type: 'smokehouse', cost: { wood: 14, stone: 6 }, work: 7, requires: 'preservation' };
  buildDefs.butcher_table = { label: 'Açougue', type: 'butcher_table', cost: { wood: 14, stone: 4 }, work: 6, requires: 'butchery' };

  stationLabels.sewing_table = 'Mesa de Alfaiataria';
  stationLabels.smokehouse = 'Defumador';
  stationLabels.butcher_table = 'Açougue';

  recipeDefs.sickle = { label: 'Foice', station: 'forge', cost: { wood: 2, metal: 4 }, duration: 7, output: { items: { sickle: 1 } }, unlock: 'agriculture', desc: 'Ferramenta de colheita e ervas.' };
  recipeDefs.advancedPickaxe = { label: 'Picareta reforçada', station: 'forge', cost: { wood: 3, metal: 6 }, itemCost: { nails: 2 }, duration: 9, output: { items: { advancedPickaxe: 1 } }, unlock: 'metalworking', desc: 'Mineração avançada.' };
  recipeDefs.thermalClothes = { label: 'Roupa térmica', station: 'sewing_table', itemCost: { leather: 3, cloth: 2 }, duration: 8, output: { items: { thermalClothes: 1 } }, unlock: 'thermal_comfort', desc: 'Proteção contra frio e chuva.' };
  recipeDefs.cookedMeat = { label: 'Carne cozida x3', station: 'stove', cost: { wood: 1 }, itemCost: { rawMeat: 2 }, duration: 4, output: { resources: { food: 6 } }, unlock: 'cooking', desc: 'Transforma caça em comida segura.' };
  recipeDefs.medicine = { label: 'Remédio herbal', station: 'med_station', cost: { food: 3, wood: 1 }, itemCost: { cloth: 1 }, duration: 6, output: { resources: { medicine: 3 } }, unlock: 'medicine', desc: 'Prepara remédios com ervas e tecido para tratamento.' };
  recipeDefs.smokedMeat = { label: 'Carne defumada x4', station: 'smokehouse', cost: { wood: 2 }, itemCost: { rawMeat: 3 }, duration: 7, output: { resources: { food: 10 } }, unlock: 'preservation', desc: 'Conserva carne de caça com alto rendimento.' };

  window.HavenfallContext.workbenchExpansionInstalled = true;
}

function recipeStationBuilt(stationType) {
  if (!stationType) return false;
  if (!state?.objects?.length) return false;
  return state.objects.some(o => o.type === stationType);
}

function installWorkbenchBuildButtons() {
  const grid = document.querySelector('.build-grid');
  if (!grid) return;
  const entries = [
    ['sewing_table', 'Alfaiataria<br><small>pele + madeira</small>'],
    ['smokehouse', 'Defumador<br><small>preservação</small>']
  ];
  for (const [key, html] of entries) {
    if (grid.querySelector(`[data-build="${key}"]`)) continue;
    const btn = document.createElement('button');
    btn.dataset.build = key;
    btn.innerHTML = html;
    grid.appendChild(btn);
  }
}

function installToolWorkRatePatch() {
  if (window.HavenfallContext?.toolWorkRatePatchInstalled || typeof workRate !== 'function') return;
  window.GameSystems?.registerWorkRateModifier('workstations.utilityTools', (rate, c, kind, target = null) => {
    ensureEquipment(c);
    const tool = itemDefs[c.equipment?.tool];
    if (kind === 'gather' && tool?.gatherBonus && target) {
      const gather = objectDefs[target.type]?.gather || {};
      for (const resource of Object.keys(gather)) {
        rate *= 1 + (tool.gatherBonus[resource] || 0);
      }
    }
    if (c.equipment?.offhand === 'thermalClothes' && c.statuses?.includes('molhado')) rate *= 1.08;
    return rate;
  }, { order: 30 });
  window.HavenfallContext.toolWorkRatePatchInstalled = true;
}

function updateWorkbenchToolsTick() {
  installWorkbenchExpansionDefs();
  installWorkbenchBuildButtons();
  installToolWorkRatePatch();
  if (!state) return;
  for (const c of state.colonists || []) {
    if (c.equipment?.offhand === 'thermalClothes' && c.wetness > 0) c.wetness = Math.max(0, c.wetness - 0.03 * (state.speed || 1));
  }
}

window.recipeStationBuilt = recipeStationBuilt;
window.updateWorkbenchToolsTick = updateWorkbenchToolsTick;

installWorkbenchExpansionDefs();
installWorkbenchBuildButtons();
installToolWorkRatePatch();
window.GameSystems?.registerTick('workstations', updateWorkbenchToolsTick, { order: 70 });
