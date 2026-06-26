'use strict';

function installWorkbenchExpansionDefs() {
  if (window.HavenfallContext?.workbenchExpansionInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};

  itemDefs.rawMeat = { label: 'Carne crua', icon: 'res_raw_meat', kind: 'food', note: 'Ingrediente obtido de caça.' };
  itemDefs.bones = { label: 'Ossos', icon: 'res_scrap', kind: 'material', note: 'Material para futuras ferramentas e decoração.' };
  itemDefs.venom = { label: 'Veneno', icon: 'icon_warn', kind: 'material', note: 'Recurso raro de aranhas.' };
  itemDefs.sickle = { label: 'Foice', icon: assetAudit?.tool?.('sickle') || 'tool_sickle', slot: 'tool', kind: 'tool', gatherBonus: { food: 1.0, medicine: 1.0 }, combat: 0.8, note: 'Dobra a eficiência em plantações e ervas.' };
  itemDefs.advancedPickaxe = { label: 'Picareta reforçada', icon: assetAudit?.tool?.('advanced_pickaxe') || 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.7, metal: 0.7 }, combat: 1.4, note: 'Mineração durável para biomas rochosos.' };
  itemDefs.thermalClothes = { label: 'Roupa térmica', icon: 'res_cloth', slot: 'offhand', kind: 'clothing', defense: 0.08, coldResist: 0.45, note: 'Ajuda contra frio e chuva.' };

  objectDefs.sewing_table = { name: 'mesa de alfaiataria', img: assetAudit?.workstation?.('sewing_table') || 'table_wood', blocks: true, craft: 1, work: 4.5 };
  objectDefs.smokehouse = { name: 'defumador simples', img: assetAudit?.workstation?.('smokehouse') || 'campfire', blocks: true, cook: { input: { wood: 2 }, output: {} }, work: 5.5 };

  buildDefs.sewing_table = { label: 'Alfaiataria', type: 'sewing_table', cost: { wood: 16 }, itemCost: { leather: 2 }, work: 7, requires: 'medicine' };
  buildDefs.smokehouse = { label: 'Defumador', type: 'smokehouse', cost: { wood: 14, stone: 6 }, work: 7, requires: 'preservation' };

  stationLabels.sewing_table = 'Mesa de Alfaiataria';
  stationLabels.smokehouse = 'Defumador';

  recipeDefs.sickle = { label: 'Foice', station: 'forge', cost: { wood: 2, metal: 4 }, duration: 7, output: { items: { sickle: 1 } }, unlock: 'agriculture', desc: 'Ferramenta de colheita e ervas.' };
  recipeDefs.advancedPickaxe = { label: 'Picareta reforçada', station: 'forge', cost: { wood: 3, metal: 6 }, itemCost: { nails: 2 }, duration: 9, output: { items: { advancedPickaxe: 1 } }, unlock: 'metalworking', desc: 'Mineração avançada.' };
  recipeDefs.thermalClothes = { label: 'Roupa térmica', station: 'sewing_table', itemCost: { leather: 3, cloth: 2 }, duration: 8, output: { items: { thermalClothes: 1 } }, unlock: 'thermal_comfort', desc: 'Proteção contra frio e chuva.' };
  recipeDefs.cookedMeat = { label: 'Carne cozida x3', station: 'stove', cost: { wood: 1 }, itemCost: { rawMeat: 2 }, duration: 4, output: { resources: { food: 6 } }, unlock: 'cooking', desc: 'Transforma caça em comida segura.' };

  window.HavenfallContext.workbenchExpansionInstalled = true;
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
  const nativeWorkRate = workRate;
  workRate = function workRateWithUtilityTools(c, kind, target = null) {
    let rate = nativeWorkRate(c, kind, target);
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
  };
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

window.updateWorkbenchToolsTick = updateWorkbenchToolsTick;

installWorkbenchExpansionDefs();
installWorkbenchBuildButtons();
installToolWorkRatePatch();
