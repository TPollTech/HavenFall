'use strict';

const expandedResearchDefs = Object.freeze({
  survival_basics: { label: 'Sobrevivência Básica', category: 'survival', tier: 0, pos: [0, 3], cost: 10, requires: [], prerequisites: [], unlocks: ['campfire'], description: 'Rotina mínima de acampamento, calor e preparo simples.' },
  camp_organization: { label: 'Organização do Acampamento', category: 'logistics', tier: 0, pos: [0, 6], cost: 12, requires: [], prerequisites: [], unlocks: ['zone_storage', 'zone_dumping'], description: 'Permite transformar bagunça no chão em fluxo de armazenamento.' },
  basic_tools: { label: 'Ferramentas Improvisadas', category: 'crafting', tier: 0, pos: [0, 8], cost: 12, requires: [], prerequisites: [], unlocks: ['bench', 'stoneAxe', 'pickaxe', 'hammer', 'club'], description: 'Libera a bancada e ferramentas iniciais para trabalho e defesa.' },

  carpentry: { label: 'Carpintaria Básica', category: 'construction', tier: 1, pos: [1, 2], cost: 18, requires: ['survival_basics', 'basic_tools'], prerequisites: ['survival_basics', 'basic_tools'], unlocks: ['wall', 'door', 'bed'], description: 'Estruturas de madeira, abrigo e interiores simples.' },
  cooking: { label: 'Cozinha de Sobrevivência', category: 'food', tier: 1, pos: [1, 3], cost: 18, requires: ['survival_basics'], prerequisites: ['survival_basics'], unlocks: ['stove', 'simpleMeal', 'cookedMeat'], description: 'Transforma comida crua e carne em refeições mais úteis.' },
  watercraft: { label: 'Água e Travessia', category: 'survival', tier: 1, pos: [1, 4], cost: 22, requires: ['survival_basics', 'basic_tools'], prerequisites: ['survival_basics', 'basic_tools'], unlocks: ['bridge', 'fishingRod'], description: 'Pontes simples, leitura de margens e primeiros equipamentos de pesca.' },
  agriculture: { label: 'Agricultura', category: 'food', tier: 1, pos: [1, 5], cost: 24, requires: ['survival_basics'], prerequisites: ['survival_basics'], unlocks: ['crop', 'zone_farming', 'sickle'], description: 'Cultivo planejado, colheita e crescimento estável.' },
  storage: { label: 'Logística de Estoque', category: 'logistics', tier: 1, pos: [1, 6], cost: 24, requires: ['camp_organization'], prerequisites: ['camp_organization'], unlocks: ['crate', 'zone_storage'], description: 'Baús e zonas passam a receber itens soltos do mapa.' },
  basic_defense: { label: 'Segurança de Perímetro', category: 'planning', tier: 1, pos: [1, 7], cost: 22, requires: ['camp_organization', 'basic_tools'], prerequisites: ['camp_organization', 'basic_tools'], unlocks: ['spear', 'bow', 'arrows', 'torch'], description: 'Armas simples, postura defensiva e controle de animais agressivos.' },
  metalworking: { label: 'Metalurgia Básica', category: 'crafting', tier: 1, pos: [1, 8], cost: 28, requires: ['basic_tools'], prerequisites: ['basic_tools'], unlocks: ['forge', 'knife', 'toolkit', 'shield'], description: 'Forja, lâminas e ferramentas de metal.' },

  medicine: { label: 'Medicina de Campo', category: 'care', tier: 2, pos: [2, 4], cost: 36, requires: ['storage', 'cooking'], prerequisites: ['storage', 'cooking'], unlocks: ['med_station', 'bandage', 'sewing_table'], description: 'Tratamento, curativos e primeira estrutura de cuidado.' },
  preservation: { label: 'Preservação de Alimentos', category: 'food', tier: 2, pos: [2, 3], cost: 32, requires: ['cooking', 'storage'], prerequisites: ['cooking', 'storage'], unlocks: ['smokehouse', 'smokedMeat'], description: 'Defumação e melhor aproveitamento da caça.' },
  butchery: { label: 'Açougue de Campo', category: 'food', tier: 2, pos: [2, 2], cost: 28, requires: ['basic_defense', 'cooking'], prerequisites: ['basic_defense', 'cooking'], unlocks: ['butcher_table', 'fieldRations'], description: 'Processa carne e ossos de caça em comida utilizável.' },
  fishing: { label: 'Pesca de Margem', category: 'food', tier: 2, pos: [2, 5], cost: 30, requires: ['watercraft', 'cooking'], prerequisites: ['watercraft', 'cooking'], unlocks: ['fishing'], description: 'Transforma lagos e rios em fonte renovável de alimento.' },
  light_hauling: { label: 'Carga Leve', category: 'logistics', tier: 2, pos: [2, 6], cost: 24, requires: ['storage'], prerequisites: ['storage'], unlocks: ['haul_capacity'], description: 'Colonos carregam melhor recursos soltos até zonas e depósitos.' },
  reinforced_tools: { label: 'Ferramentas Reforçadas', category: 'crafting', tier: 2, pos: [2, 8], cost: 34, requires: ['metalworking'], prerequisites: ['metalworking'], unlocks: ['advancedPickaxe'], description: 'Ferramentas mais fortes para mineração e trabalho pesado.' },

  thermal_comfort: { label: 'Conforto Térmico', category: 'construction', tier: 3, pos: [3, 2], cost: 36, requires: ['carpentry', 'medicine'], prerequisites: ['carpentry', 'medicine'], unlocks: ['thermalClothes'], description: 'Ajuda contra frio, chuva e colonos molhados.' },
  cart: { label: 'Carrinho de Mão', category: 'logistics', tier: 3, pos: [3, 6], cost: 34, requires: ['light_hauling', 'carpentry'], prerequisites: ['light_hauling', 'carpentry'], unlocks: ['handcart'], description: 'Transporte de quantidades maiores de loot e material.' },
  heavy_hauling: { label: 'Carga Pesada', category: 'logistics', tier: 4, pos: [4, 6], cost: 50, requires: ['cart', 'reinforced_tools'], prerequisites: ['cart', 'reinforced_tools'], unlocks: ['handcart'], description: 'Aumenta capacidade de transporte e reduz viagens inúteis.' }
});

function installExpandedResearchTree() {
  Object.keys(researchDefs).forEach(key => delete researchDefs[key]);
  Object.assign(researchDefs, expandedResearchDefs);
  researchOrder.length = 0;
  researchOrder.push(...Object.keys(expandedResearchDefs).sort((a, b) => {
    const pa = expandedResearchDefs[a].pos || [0, 0];
    const pb = expandedResearchDefs[b].pos || [0, 0];
    return pa[0] - pb[0] || pa[1] - pb[1] || a.localeCompare(b);
  }));

  const req = (key, value) => { if (buildDefs[key]) buildDefs[key].requires = value; };
  req('campfire', 'survival_basics');
  req('bench', 'basic_tools');
  req('wall', 'carpentry');
  req('door', 'carpentry');
  req('bed', 'carpentry');
  req('crop', 'agriculture');
  req('crate', 'storage');
  req('stove', 'cooking');
  req('forge', 'metalworking');
  req('med_station', 'medicine');
  req('sewing_table', 'medicine');
  req('smokehouse', 'preservation');
  req('butcher_table', 'butchery');
  req('bridge', 'watercraft');
}

installExpandedResearchTree();
window.researchTreeDefs = expandedResearchDefs;
