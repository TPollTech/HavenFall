'use strict';

/**
 * Árvore de Pesquisa - HavenFall / Survival Colony
 * Compatível com o sistema antigo:
 * - baseResearchDefs continua existindo
 * - baseResearchOrder continua existindo
 *
 * Evoluções:
 * - nodes com posição na árvore
 * - pré-requisitos
 * - tiers
 * - categorias
 * - descrições
 * - efeitos futuros
 * - conexões visuais derivadas automaticamente
 */

const researchCategories = Object.freeze({
  survival: {
    label: 'Sobrevivência',
    icon: '⛺',
  },
  construction: {
    label: 'Construção',
    icon: '🪵',
  },
  food: {
    label: 'Alimentos',
    icon: '🥘',
  },
  medicine: {
    label: 'Medicina',
    icon: '🩹',
  },
  crafting: {
    label: 'Produção',
    icon: '⚒️',
  },
  logistics: {
    label: 'Logística',
    icon: '📦',
  },
  defense: {
    label: 'Defesa',
    icon: '🛡️',
  },
  advanced: {
    label: 'Avançado',
    icon: '⚙️',
  },
});

const baseResearchDefs = Object.freeze({
  survival_basics: {
    label: 'Sobrevivência Básica',
    description: 'Ensina o grupo a montar um acampamento mínimo, organizar abrigo inicial e preparar refeições simples.',
    category: 'survival',
    tier: 0,
    pos: [0, 3],
    cost: 10,
    prerequisites: [],
    unlocks: ['campfire', 'sleeping_spot', 'basic_meal'],
    effects: {
      moodBonus: 1,
      survivalSkill: 1,
    },
  },

  basic_tools: {
    label: 'Ferramentas Improvisadas',
    description: 'Libera ferramentas simples para acelerar construções, reparos e trabalhos manuais.',
    category: 'crafting',
    tier: 0,
    pos: [0, 5],
    cost: 12,
    prerequisites: [],
    unlocks: ['toolbench', 'stone_axe', 'repair_kit'],
    effects: {
      buildSpeedBonus: 0.05,
    },
  },

  camp_organization: {
    label: 'Organização do Acampamento',
    description: 'Permite separar áreas de estoque, descanso, trabalho e defesa dentro da base.',
    category: 'logistics',
    tier: 0,
    pos: [0, 7],
    cost: 12,
    prerequisites: [],
    unlocks: ['zone_marker', 'stockpile_zone'],
    effects: {
      storageEfficiency: 0.05,
    },
  },

  carpentry: {
    label: 'Carpintaria Básica',
    description: 'Permite construir estruturas simples de madeira, portas e divisões internas.',
    category: 'construction',
    tier: 1,
    pos: [1, 2],
    cost: 15,
    prerequisites: ['survival_basics', 'basic_tools'],
    unlocks: ['wall', 'door', 'wood_floor'],
    effects: {
      buildSpeedBonus: 0.08,
    },
  },

  cooking: {
    label: 'Cozinha de Sobrevivência',
    description: 'Melhora o preparo de alimentos simples e reduz desperdício de comida.',
    category: 'food',
    tier: 1,
    pos: [1, 3],
    cost: 20,
    prerequisites: ['survival_basics'],
    unlocks: ['stove', 'cooked_meal'],
    effects: {
      foodWasteReduction: 0.08,
      moodBonus: 1,
    },
  },

  medicine: {
    label: 'Primeiros Socorros',
    description: 'Permite tratar ferimentos básicos, reduzir infecções e montar uma área médica simples.',
    category: 'medicine',
    tier: 1,
    pos: [1, 4],
    cost: 22,
    prerequisites: ['survival_basics'],
    unlocks: ['med_station', 'bandage'],
    effects: {
      healingSpeedBonus: 0.1,
    },
  },

  agriculture: {
    label: 'Agricultura',
    description: 'Libera o cultivo de alimentos e permite começar uma produção estável de comida.',
    category: 'food',
    tier: 1,
    pos: [1, 5],
    cost: 30,
    prerequisites: ['survival_basics'],
    unlocks: ['farm'],
    effects: {
      foodProductionBonus: 0.05,
    },
  },

  metalworking: {
    label: 'Metalurgia Básica',
    description: 'Permite trabalhar metais simples, criar peças rudimentares e preparar a base para forjas.',
    category: 'crafting',
    tier: 1,
    pos: [1, 6],
    cost: 24,
    prerequisites: ['basic_tools'],
    unlocks: ['scrap_processing', 'metal_parts'],
    effects: {
      craftingSpeedBonus: 0.06,
    },
  },

  storage: {
    label: 'Logística de Estoque',
    description: 'Libera estruturas de armazenamento melhores, reduzindo perda de itens e bagunça na base.',
    category: 'logistics',
    tier: 1,
    pos: [1, 7],
    cost: 25,
    prerequisites: ['camp_organization'],
    unlocks: ['storage', 'shelf'],
    effects: {
      storageCapacityBonus: 0.15,
    },
  },

  basic_defense: {
    label: 'Defesa Básica',
    description: 'Libera defesas simples para atrasar invasores e proteger entradas da base.',
    category: 'defense',
    tier: 1,
    pos: [1, 8],
    cost: 20,
    prerequisites: ['camp_organization'],
    unlocks: ['spike_trap', 'wooden_barricade'],
    effects: {
      baseDefenseBonus: 1,
    },
  },

  thermal_comfort: {
    label: 'Isolamento Térmico',
    description: 'Melhora o conforto interno da base, reduzindo penalidades por frio, calor e chuva.',
    category: 'construction',
    tier: 2,
    pos: [2, 1],
    cost: 30,
    prerequisites: ['carpentry'],
    unlocks: ['shelter', 'insulated_wall', 'basic_roof'],
    effects: {
      temperatureResistance: 0.15,
      moodBonus: 1,
    },
  },

  preservation: {
    label: 'Preservação de Alimentos',
    description: 'Permite conservar comida por mais tempo usando fumaça, sal e armazenamento seco.',
    category: 'food',
    tier: 2,
    pos: [2, 3],
    cost: 30,
    prerequisites: ['cooking'],
    unlocks: ['smokehouse', 'dried_meat'],
    effects: {
      foodSpoilReduction: 0.18,
    },
  },

  herbal_medicine: {
    label: 'Medicina Herbal',
    description: 'Permite usar plantas medicinais cultivadas ou coletadas para criar tratamentos melhores.',
    category: 'medicine',
    tier: 2,
    pos: [2, 4],
    cost: 36,
    prerequisites: ['medicine', 'agriculture'],
    unlocks: ['herbal_bed', 'herbal_medicine'],
    effects: {
      healingSpeedBonus: 0.15,
      infectionChanceReduction: 0.08,
    },
  },

  farm: {
    label: 'Fazenda',
    description: 'Expande a agricultura básica com canteiros mais eficientes e produção em escala.',
    category: 'food',
    tier: 2,
    pos: [2, 5],
    cost: 30,
    prerequisites: ['agriculture'],
    unlocks: ['crop', 'farm_plot'],
    effects: {
      foodProductionBonus: 0.12,
    },
  },

  forge: {
    label: 'Forja Simples',
    description: 'Libera a forja para fabricar peças metálicas, ferramentas reforçadas e componentes melhores.',
    category: 'crafting',
    tier: 2,
    pos: [2, 6],
    cost: 38,
    prerequisites: ['metalworking'],
    unlocks: ['forge', 'metal_tool'],
    effects: {
      craftingSpeedBonus: 0.12,
    },
  },

  light_hauling: {
    label: 'Carga Leve',
    description: 'Melhora o transporte manual de recursos e reduz tempo perdido em deslocamentos curtos.',
    category: 'logistics',
    tier: 2,
    pos: [2, 7],
    cost: 20,
    prerequisites: ['storage'],
    unlocks: ['cart'],
    effects: {
      carryCapacityBonus: 0.15,
    },
  },

  traps_and_barricades: {
    label: 'Armadilhas e Barricadas',
    description: 'Aprimora defesas primitivas com corredores de contenção, barricadas e armadilhas melhores.',
    category: 'defense',
    tier: 2,
    pos: [2, 8],
    cost: 34,
    prerequisites: ['basic_defense', 'carpentry'],
    unlocks: ['reinforced_barricade', 'trap_corridor'],
    effects: {
      trapDamageBonus: 0.15,
    },
  },

  advanced_carpentry: {
    label: 'Carpintaria Avançada',
    description: 'Permite móveis melhores, estruturas mais resistentes e melhor aproveitamento da madeira.',
    category: 'construction',
    tier: 3,
    pos: [3, 1],
    cost: 44,
    prerequisites: ['thermal_comfort', 'forge'],
    unlocks: ['quality_bed', 'reinforced_door', 'work_table'],
    effects: {
      buildSpeedBonus: 0.15,
      moodBonus: 1,
    },
  },

  field_kitchen: {
    label: 'Cozinha de Campo',
    description: 'Cria uma cozinha organizada para preparar refeições melhores em maior quantidade.',
    category: 'food',
    tier: 3,
    pos: [3, 3],
    cost: 42,
    prerequisites: ['preservation', 'farm'],
    unlocks: ['field_kitchen', 'fine_meal'],
    effects: {
      cookingSpeedBonus: 0.15,
      moodBonus: 2,
    },
  },

  crop_rotation: {
    label: 'Rotação de Culturas',
    description: 'Aumenta o rendimento das plantações e reduz perda de produção por solo desgastado.',
    category: 'food',
    tier: 3,
    pos: [3, 5],
    cost: 46,
    prerequisites: ['farm', 'herbal_medicine'],
    unlocks: ['fertile_plot', 'seed_storage'],
    effects: {
      foodProductionBonus: 0.22,
    },
  },

  stonecutting: {
    label: 'Cantaria',
    description: 'Permite cortar pedra e construir estruturas mais resistentes que madeira.',
    category: 'construction',
    tier: 3,
    pos: [3, 6],
    cost: 48,
    prerequisites: ['forge', 'carpentry'],
    unlocks: ['stone_wall', 'stone_floor', 'stone_blocks'],
    effects: {
      wallHpBonus: 0.25,
    },
  },

  cart: {
    label: 'Carrinho de Mão',
    description: 'Libera carrinhos simples para transportar mais recursos entre estoque, obra e produção.',
    category: 'logistics',
    tier: 3,
    pos: [3, 7],
    cost: 28,
    prerequisites: ['light_hauling', 'carpentry'],
    unlocks: ['handcart'],
    effects: {
      carryCapacityBonus: 0.25,
      haulingSpeedBonus: 0.08,
    },
  },

  guard_post: {
    label: 'Posto de Guarda',
    description: 'Permite organizar pontos defensivos e melhorar a resposta da colônia contra ataques.',
    category: 'defense',
    tier: 3,
    pos: [3, 8],
    cost: 46,
    prerequisites: ['traps_and_barricades'],
    unlocks: ['guard_post', 'watch_spot'],
    effects: {
      raidWarningBonus: 0.1,
      baseDefenseBonus: 2,
    },
  },

  water_purification: {
    label: 'Purificação de Água',
    description: 'Reduz doenças ligadas à água ruim e melhora a estabilidade da colônia.',
    category: 'medicine',
    tier: 4,
    pos: [4, 4],
    cost: 58,
    prerequisites: ['field_kitchen', 'herbal_medicine'],
    unlocks: ['water_filter', 'clean_water_barrel'],
    effects: {
      diseaseChanceReduction: 0.15,
      moodBonus: 1,
    },
  },

  reinforced_walls: {
    label: 'Muros Reforçados',
    description: 'Libera paredes e portas reforçadas para resistir melhor a invasões e eventos climáticos.',
    category: 'construction',
    tier: 4,
    pos: [4, 1],
    cost: 62,
    prerequisites: ['advanced_carpentry', 'stonecutting'],
    unlocks: ['reinforced_wall', 'reinforced_gate'],
    effects: {
      wallHpBonus: 0.45,
    },
  },

  heavy_hauling: {
    label: 'Carga Pesada',
    description: 'Permite transporte pesado com rotas mais eficientes, carrinhos reforçados e menor desgaste dos colonos.',
    category: 'logistics',
    tier: 4,
    pos: [4, 7],
    cost: 54,
    prerequisites: ['cart', 'forge'],
    unlocks: ['handcart', 'hauling_station'],
    effects: {
      carryCapacityBonus: 0.45,
      haulingSpeedBonus: 0.18,
    },
  },

  workshop_efficiency: {
    label: 'Eficiência de Oficina',
    description: 'Organiza produção, ferramentas e fluxo de trabalho para fabricar mais gastando menos tempo.',
    category: 'crafting',
    tier: 4,
    pos: [4, 6],
    cost: 66,
    prerequisites: ['forge', 'heavy_hauling'],
    unlocks: ['advanced_workbench', 'parts_rack'],
    effects: {
      craftingSpeedBonus: 0.22,
      resourceWasteReduction: 0.1,
    },
  },

  compound_defense: {
    label: 'Defesa de Perímetro',
    description: 'Permite criar perímetros defensivos completos com muros, torres e pontos de contenção.',
    category: 'defense',
    tier: 4,
    pos: [4, 8],
    cost: 70,
    prerequisites: ['reinforced_walls', 'guard_post'],
    unlocks: ['watchtower', 'defense_gate', 'alarm_bell'],
    effects: {
      baseDefenseBonus: 4,
      raidWarningBonus: 0.2,
    },
  },

  cold_storage: {
    label: 'Armazenamento Refrigerado',
    description: 'Libera formas rudimentares de conservar alimentos e medicamentos por muito mais tempo.',
    category: 'advanced',
    tier: 5,
    pos: [5, 3],
    cost: 78,
    prerequisites: ['water_purification', 'workshop_efficiency'],
    unlocks: ['cold_storage', 'ice_box'],
    effects: {
      foodSpoilReduction: 0.35,
      medicineSpoilReduction: 0.25,
    },
  },

  colony_planning: {
    label: 'Planejamento de Colônia',
    description: 'Desbloqueia uma organização avançada da base, melhorando rotas, zonas e produtividade geral.',
    category: 'advanced',
    tier: 5,
    pos: [5, 6],
    cost: 86,
    prerequisites: ['workshop_efficiency', 'heavy_hauling'],
    unlocks: ['planning_table', 'priority_board'],
    effects: {
      globalWorkSpeedBonus: 0.08,
      haulingSpeedBonus: 0.12,
    },
  },

  secure_settlement: {
    label: 'Assentamento Seguro',
    description: 'Transforma a base em um assentamento resistente, organizado e preparado contra ameaças maiores.',
    category: 'advanced',
    tier: 5,
    pos: [5, 8],
    cost: 96,
    prerequisites: ['compound_defense', 'colony_planning'],
    unlocks: ['settlement_banner', 'secure_zone'],
    effects: {
      moodBonus: 3,
      baseDefenseBonus: 6,
    },
  },
});

const baseResearchOrder = Object.freeze(
  Object.keys(baseResearchDefs).sort((a, b) => {
    const pa = baseResearchDefs[a].pos;
    const pb = baseResearchDefs[b].pos;

    return pa[0] - pb[0] || pa[1] - pb[1] || a.localeCompare(b);
  })
);

const baseResearchConnections = Object.freeze(
  baseResearchOrder.flatMap((researchId) => {
    const def = baseResearchDefs[researchId];

    return (def.prerequisites || []).map((prerequisiteId) => ({
      from: prerequisiteId,
      to: researchId,
    }));
  })
);

function normalizeResearchSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  if (typeof value === 'object') {
    return new Set(
      Object.entries(value)
        .filter(([, completed]) => Boolean(completed))
        .map(([id]) => id)
    );
  }

  return new Set();
}

function getResearchDef(researchId) {
  return baseResearchDefs[researchId] || null;
}

function getResearchPrerequisites(researchId) {
  return getResearchDef(researchId)?.prerequisites || [];
}

function areResearchPrerequisitesCompleted(researchId, completedResearch) {
  const completed = normalizeResearchSet(completedResearch);
  const prerequisites = getResearchPrerequisites(researchId);

  return prerequisites.every((id) => completed.has(id));
}

function getResearchStatus(researchId, state = {}) {
  const completed = normalizeResearchSet(state.completedResearch || state.completed || []);
  const currentResearch = state.currentResearch || null;
  const researchPoints = Number(state.researchPoints ?? state.points ?? 0);

  const def = getResearchDef(researchId);
  if (!def) return 'missing';

  if (completed.has(researchId)) return 'completed';
  if (currentResearch === researchId) return 'current';

  const prerequisitesCompleted = areResearchPrerequisitesCompleted(researchId, completed);

  if (!prerequisitesCompleted) return 'locked';
  if (researchPoints < def.cost) return 'expensive';

  return 'available';
}

function canStartResearch(researchId, state = {}) {
  return getResearchStatus(researchId, state) === 'available';
}

function getAvailableResearch(state = {}) {
  return baseResearchOrder.filter((researchId) => canStartResearch(researchId, state));
}

function getUnlockedBuildingsFromResearch(completedResearch) {
  const completed = normalizeResearchSet(completedResearch);
  const unlocked = new Set();

  completed.forEach((researchId) => {
    const def = getResearchDef(researchId);
    if (!def) return;

    for (const unlockId of def.unlocks || []) {
      unlocked.add(unlockId);
    }
  });

  return Array.from(unlocked);
}

function getResearchUnlockSummary(researchId) {
  const def = getResearchDef(researchId);
  if (!def) return '';

  if (!def.unlocks || def.unlocks.length === 0) {
    return 'Não desbloqueia construções diretamente.';
  }

  return `Desbloqueia: ${def.unlocks.join(', ')}`;
}