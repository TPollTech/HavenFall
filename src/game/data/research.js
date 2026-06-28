'use strict';

const researchCategories = Object.freeze({
  survival: { label: 'Sobrevivência', icon: '◇' },
  construction: { label: 'Construção', icon: '▧' },
  food: { label: 'Alimentos', icon: '◌' },
  care: { label: 'Cuidados', icon: '✚' },
  crafting: { label: 'Produção', icon: '⚒' },
  logistics: { label: 'Logística', icon: '▣' },
  planning: { label: 'Planejamento', icon: '◎' },
});

const baseResearchDefs = {
  survival_basics: { label: 'Sobrevivência Básica', category: 'survival', tier: 0, pos: [0, 3], cost: 10, requires: [], prerequisites: [], unlocks: ['campfire'], description: 'Base inicial da colônia: rotina, descanso e preparo simples.' },
  camp_organization: { label: 'Organização do Acampamento', category: 'logistics', tier: 0, pos: [0, 6], cost: 12, requires: [], prerequisites: [], unlocks: ['zone_marker'], description: 'Organiza zonas, estoque inicial e circulação dentro da base.' },
  basic_tools: { label: 'Ferramentas Improvisadas', category: 'crafting', tier: 0, pos: [0, 8], cost: 12, requires: [], prerequisites: [], unlocks: ['toolbench'], description: 'Melhora trabalhos manuais e prepara produção mais eficiente.' },

  carpentry: { label: 'Carpintaria Básica', category: 'construction', tier: 1, pos: [1, 2], cost: 15, requires: ['survival_basics', 'basic_tools'], prerequisites: ['survival_basics', 'basic_tools'], unlocks: ['wall', 'door'], description: 'Libera paredes, portas e acabamento simples de madeira.' },
  cooking: { label: 'Cozinha de Sobrevivência', category: 'food', tier: 1, pos: [1, 3], cost: 20, requires: ['survival_basics'], prerequisites: ['survival_basics'], unlocks: ['stove'], description: 'Melhora preparo de comida e reduz desperdício.' },
  medicine: { label: 'Cuidados Básicos', category: 'care', tier: 1, pos: [1, 4], cost: 22, requires: ['survival_basics'], prerequisites: ['survival_basics'], unlocks: ['med_station'], description: 'Organiza uma área de cuidados e recuperação da colônia.' },
  agriculture: { label: 'Agricultura', category: 'food', tier: 1, pos: [1, 5], cost: 30, requires: ['survival_basics'], prerequisites: ['survival_basics'], unlocks: ['farm'], description: 'Libera cultivo e produção estável de comida.' },
  storage: { label: 'Logística de Estoque', category: 'logistics', tier: 1, pos: [1, 6], cost: 25, requires: ['camp_organization'], prerequisites: ['camp_organization'], unlocks: ['storage'], description: 'Melhora armazenamento e reduz bagunça da base.' },
  basic_defense: { label: 'Planejamento de Entradas', category: 'planning', tier: 1, pos: [1, 7], cost: 20, requires: ['camp_organization'], prerequisites: ['camp_organization'], unlocks: ['entry_marker'], description: 'Organiza entradas, rotas e sinalização da colônia.' },
  metalworking: { label: 'Metalurgia Básica', category: 'crafting', tier: 1, pos: [1, 8], cost: 24, requires: ['basic_tools'], prerequisites: ['basic_tools'], unlocks: ['metal_parts'], description: 'Prepara componentes metálicos e produção mais robusta.' },

  thermal_comfort: { label: 'Isolamento Térmico', category: 'construction', tier: 2, pos: [2, 1], cost: 30, requires: ['carpentry'], prerequisites: ['carpentry'], unlocks: ['shelter'], description: 'Melhora conforto interno contra variações de clima.' },
  preservation: { label: 'Preservação de Alimentos', category: 'food', tier: 2, pos: [2, 3], cost: 30, requires: ['cooking'], prerequisites: ['cooking'], unlocks: ['smokehouse'], description: 'Aumenta o tempo de conservação dos alimentos.' },
  farm: { label: 'Fazenda', category: 'food', tier: 2, pos: [2, 5], cost: 30, requires: ['agriculture'], prerequisites: ['agriculture'], unlocks: ['crop'], description: 'Expande o cultivo com canteiros mais eficientes.' },
  light_hauling: { label: 'Carga Leve', category: 'logistics', tier: 2, pos: [2, 6], cost: 20, requires: ['storage'], prerequisites: ['storage'], unlocks: ['cart'], description: 'Aumenta eficiência de transporte curto.' },
  cart: { label: 'Carrinho de Mão', category: 'logistics', tier: 3, pos: [3, 6], cost: 28, requires: ['light_hauling', 'carpentry'], prerequisites: ['light_hauling', 'carpentry'], unlocks: ['handcart'], description: 'Permite transportar mais recursos pela base.' },
  heavy_hauling: { label: 'Carga Pesada', category: 'logistics', tier: 4, pos: [4, 6], cost: 54, requires: ['cart', 'metalworking'], prerequisites: ['cart', 'metalworking'], unlocks: ['handcart'], description: 'Melhora transporte pesado e rotas longas.' },
};

const baseResearchOrder = Object.keys(baseResearchDefs).sort((a, b) => {
  const pa = baseResearchDefs[a].pos || [0, 0];
  const pb = baseResearchDefs[b].pos || [0, 0];
  return pa[0] - pb[0] || pa[1] - pb[1] || a.localeCompare(b);
});

const baseResearchConnections = baseResearchOrder.flatMap((researchId) => {
  const requirements = baseResearchDefs[researchId].prerequisites || [];
  return requirements.map((prerequisiteId) => ({ from: prerequisiteId, to: researchId }));
});
