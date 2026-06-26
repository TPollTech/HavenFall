'use strict';

const expandedResearchDefs = Object.freeze({
  carpentry: {
    tier: 1,
    label: 'Carpintaria Básica',
    description: 'Permite estruturas residenciais, abrigo e base inicial.',
    cost: 15,
    requires: [],
    unlocks: ['wall', 'door']
  },
  agriculture: {
    tier: 1,
    label: 'Cultivo de Subsistência',
    description: 'Base para zonas de plantio e comida estável.',
    cost: 10,
    requires: [],
    unlocks: ['crop', 'zone_farming']
  },
  cooking: {
    tier: 1,
    label: 'Culinária de Acampamento',
    description: 'Processamento básico de alimentos para nutrição e humor.',
    cost: 10,
    requires: [],
    unlocks: ['stove', 'simpleMeal']
  },
  storage: {
    tier: 2,
    label: 'Logística de Estoque',
    description: 'Ativa organização melhor de estoque, zonas e baús.',
    cost: 25,
    requires: ['carpentry'],
    unlocks: ['crate', 'zone_storage']
  },
  lighting: {
    tier: 2,
    label: 'Iluminação e Calor',
    description: 'Fontes de fogo estáveis para calor, defesa e noite.',
    cost: 20,
    requires: ['carpentry'],
    unlocks: ['torch']
  },
  basic_defense: {
    tier: 2,
    label: 'Segurança de Perímetro',
    description: 'Defesas passivas contra predadores ao redor da colônia.',
    cost: 20,
    requires: ['carpentry'],
    unlocks: ['spike_trap']
  },
  metalworking: {
    tier: 2,
    label: 'Metalurgia Básica',
    description: 'Permite forja e ferramentas de metal simples.',
    cost: 24,
    requires: ['basic_defense'],
    unlocks: ['forge']
  },
  medicine: {
    tier: 3,
    label: 'Medicina de Campo',
    description: 'Tratamento de gripes, ferimentos e exposição à chuva.',
    cost: 40,
    requires: ['storage', 'lighting'],
    unlocks: ['med_station', 'bandage']
  },
  preservation: {
    tier: 3,
    label: 'Preservação de Alimentos',
    description: 'Métodos simples para conservar comida por mais tempo.',
    cost: 30,
    requires: ['cooking', 'storage'],
    unlocks: ['smokehouse']
  },
  heavy_hauling: {
    tier: 3,
    label: 'Logística de Carga Pesada',
    description: 'Carrinhos de mão e aumento de capacidade de carga.',
    cost: 35,
    requires: ['storage'],
    unlocks: ['handcart']
  },
  thermal_comfort: {
    tier: 3,
    label: 'Isolamento Térmico',
    description: 'Tetos e paredes retêm melhor o calor das tochas.',
    cost: 30,
    requires: ['lighting', 'agriculture'],
    unlocks: ['roof_insulation']
  }
});

function installExpandedResearchTree() {
  Object.keys(researchDefs).forEach(key => delete researchDefs[key]);
  Object.assign(researchDefs, expandedResearchDefs);
  researchOrder.length = 0;
  researchOrder.push('carpentry', 'agriculture', 'cooking', 'storage', 'lighting', 'basic_defense', 'metalworking', 'medicine', 'preservation', 'heavy_hauling', 'thermal_comfort');

  buildDefs.wall.requires = 'carpentry';
  buildDefs.door.requires = 'carpentry';
  buildDefs.crop.requires = 'agriculture';
  buildDefs.crate.requires = 'storage';
  buildDefs.stove.requires = 'cooking';
  buildDefs.forge.requires = 'metalworking';
  buildDefs.med_station.requires = 'medicine';
}

installExpandedResearchTree();
window.researchTreeDefs = expandedResearchDefs;
