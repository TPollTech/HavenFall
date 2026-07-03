'use strict';

const baseRecipeDefs = {
  stoneAxe: { label: 'Machado de pedra', station: 'bench', cost: { wood: 3, stone: 2 }, duration: 5, output: { items: { stoneAxe: 1 } }, unlock: null, desc: 'Ferramenta inicial para madeira e defesa.' },
  pickaxe: { label: 'Picareta', station: 'bench', cost: { wood: 3, stone: 4 }, duration: 6, output: { items: { pickaxe: 1 } }, unlock: null, desc: 'Aumenta coleta de pedra e metal.' },
  hammer: { label: 'Martelo', station: 'bench', cost: { wood: 2, stone: 3 }, duration: 5, output: { items: { hammer: 1 } }, unlock: null, desc: 'Acelera construção.' },
  club: { label: 'Porrete', station: 'bench', cost: { wood: 4 }, duration: 4, output: { items: { club: 1 } }, unlock: null, desc: 'Defesa básica barata.' },
  spear: { label: 'Lança improvisada', station: 'bench', cost: { wood: 4, stone: 2 }, duration: 6, output: { items: { spear: 1 } }, unlock: null, desc: 'Boa contra lobos.' },
  bow: { label: 'Arco simples', station: 'bench', cost: { wood: 5 }, itemCost: { rope: 1 }, duration: 7, output: { items: { bow: 1 } }, unlock: null, desc: 'Permite atacar com distância se houver flechas.' },
  arrows: { label: 'Flechas x6', station: 'bench', cost: { wood: 2, stone: 1 }, duration: 4, output: { items: { arrows: 6 } }, unlock: null, desc: 'Munição para arco.' },
  torch: { label: 'Tocha', station: 'bench', cost: { wood: 2 }, duration: 3, output: { items: { torch: 1 } }, unlock: 'lighting', desc: 'Ajuda contra animais à noite.' },
  knife: { label: 'Faca simples', station: 'forge', cost: { metal: 3, wood: 1 }, duration: 7, output: { items: { knife: 1 } }, unlock: 'metalworking', desc: 'Arma curta de metal.' },
  toolkit: { label: 'Kit de ferramentas', station: 'forge', cost: { metal: 5, wood: 2 }, itemCost: { nails: 2 }, duration: 9, output: { items: { toolkit: 1 } }, unlock: 'metalworking', desc: 'Ferramenta avançada.' },
  shield: { label: 'Escudo improvisado', station: 'forge', cost: { wood: 4, metal: 2 }, duration: 8, output: { items: { shield: 1 } }, unlock: 'metalworking', desc: 'Reduz risco em combate.' },
  simpleMeal: { label: 'Refeição cozida x3', station: 'stove', cost: { food: 5, wood: 1 }, duration: 5, output: { resources: { food: 6 }, items: { simpleMeal: 2 } }, unlock: 'cooking', desc: 'Prepara refeições no fogão com eficiência moderada.' },
  bandage: { label: 'Curativo x2', station: 'med_station', cost: { medicine: 1 }, itemCost: { cloth: 1 }, duration: 5, output: { items: { bandage: 2 } }, unlock: 'medicine', desc: 'Item médico básico.' },
  driedPotato: { label: 'Batata seca', station: 'stove', cost: { wood: 1 }, itemCost: { potato: 4 }, duration: 6, output: { resources: { food: 8 } }, unlock: 'cooking', desc: 'Desidrata batatas para conservação prolongada.' },
  cannedCarrot: { label: 'Cenoura em conserva', station: 'stove', cost: { wood: 1 }, itemCost: { carrot: 3 }, duration: 5, output: { resources: { food: 6 } }, unlock: 'cooking', desc: 'Conserva cenouras em vidro para armazenamento.' },
  cornmeal: { label: 'Farinha de milho', station: 'bench', cost: {}, itemCost: { corn: 4 }, duration: 5, output: { resources: { food: 8 } }, unlock: 'cooking', desc: 'Mói milho em farinha de longa duração.' },
  strawberryPreserve: { label: 'Geleia de morango', station: 'stove', cost: { wood: 1 }, itemCost: { strawberry: 3 }, duration: 4, output: { resources: { food: 5 } }, unlock: 'cooking', desc: 'Prepara geleia doce para melhorar o humor.' },
  potatoSeed: { label: 'Semente de batata x2', station: 'bench', cost: {}, itemCost: { potato: 1 }, duration: 3, output: { items: { potato_seed: 2 } }, unlock: 'agriculture', desc: 'Extrai sementes de batatas para plantio.' },
  carrotSeed: { label: 'Semente de cenoura x2', station: 'bench', cost: {}, itemCost: { carrot: 1 }, duration: 3, output: { items: { carrot_seed: 2 } }, unlock: 'agriculture', desc: 'Extrai sementes de cenouras para plantio.' },
  cornSeed: { label: 'Semente de milho x2', station: 'bench', cost: {}, itemCost: { corn: 1 }, duration: 4, output: { items: { corn_seed: 2 } }, unlock: 'agriculture', desc: 'Extrai sementes de milho para plantio.' },
  strawberrySeed: { label: 'Semente de morango x2', station: 'bench', cost: {}, itemCost: { strawberry: 1 }, duration: 3, output: { items: { strawberry_seed: 2 } }, unlock: 'agriculture', desc: 'Extrai sementes de morango para plantio.' },

  // Trituração de minério (Pilão)
  crushIron: { label: 'Triturar ferro bruto', station: 'pestle', cost: {}, itemCost: { rawIron: 2 }, duration: 5, output: { items: { crushedIron: 2 } }, unlock: 'basic_prospecting', desc: 'Tritura minério de ferro no pilão.' },
  crushCopper: { label: 'Triturar cobre bruto', station: 'pestle', cost: {}, itemCost: { rawCopper: 2 }, duration: 5, output: { items: { crushedCopper: 2 } }, unlock: 'basic_prospecting', desc: 'Tritura minério de cobre no pilão.' },
  crushCoal: { label: 'Triturar carvão bruto', station: 'pestle', cost: {}, itemCost: { rawCoal: 2 }, duration: 4, output: { items: { crushedCoal: 2 } }, unlock: 'basic_prospecting', desc: 'Tritura carvão bruto no pilão.' },
  crushTin: { label: 'Triturar estanho bruto', station: 'pestle', cost: {}, itemCost: { rawTin: 2 }, duration: 5, output: { items: { crushedTin: 2 } }, unlock: 'basic_prospecting', desc: 'Tritura minério de estanho no pilão.' },

  // Seleção de minério (Mesa de Seleção)
  separateIron: { label: 'Selecionar ferro triturado', station: 'selectionTable', cost: {}, itemCost: { crushedIron: 3 }, duration: 5, output: { items: { preparedIron: 2, gravel: 1 } }, unlock: 'ore_processing', desc: 'Separa o ferro útil do cascalho.' },
  separateCopper: { label: 'Selecionar cobre triturado', station: 'selectionTable', cost: {}, itemCost: { crushedCopper: 3 }, duration: 5, output: { items: { preparedCopper: 2, gravel: 1 } }, unlock: 'ore_processing', desc: 'Separa o cobre útil do cascalho.' },
  separateCoal: { label: 'Limpar carvão triturado', station: 'selectionTable', cost: {}, itemCost: { crushedCoal: 3 }, duration: 4, output: { items: { preparedCoal: 2 } }, unlock: 'ore_processing', desc: 'Limpa as impurezas do carvão triturado.' },
  separateTin: { label: 'Selecionar estanho triturado', station: 'selectionTable', cost: {}, itemCost: { crushedTin: 3 }, duration: 5, output: { items: { preparedTin: 2, gravel: 1 } }, unlock: 'ore_processing', desc: 'Separa o estanho útil do cascalho.' },

  // Fundição (Fornalha Simples)
  smeltIron: { label: 'Fundir ferro', station: 'furnace', cost: { wood: 1 }, itemCost: { preparedIron: 3 }, duration: 8, output: { items: { ironIngot: 2 } }, unlock: 'basic_smelting', desc: 'Funde minério de ferro preparado em lingotes.' },
  smeltCopper: { label: 'Fundir cobre', station: 'furnace', cost: { wood: 1 }, itemCost: { preparedCopper: 3 }, duration: 8, output: { items: { copperIngot: 2 } }, unlock: 'basic_smelting', desc: 'Funde minério de cobre preparado em lingotes.' },
  smeltTin: { label: 'Fundir estanho', station: 'furnace', cost: { wood: 1 }, itemCost: { preparedTin: 3 }, duration: 7, output: { items: { tinIngot: 2 } }, unlock: 'basic_smelting', desc: 'Funde minério de estanho preparado em lingotes.' },

  // Forjaria (Bigorna)
  forgeIronPlate: { label: 'Forjar chapa de ferro', station: 'anvil', cost: {}, itemCost: { ironIngot: 2 }, duration: 6, output: { items: { ironPlate: 1 } }, unlock: 'basic_metalworking', desc: 'Forja lingotes em chapas de ferro.' },
  forgeCopperWire: { label: 'Forjar fio de cobre', station: 'anvil', cost: {}, itemCost: { copperIngot: 1 }, duration: 4, output: { items: { copperWire: 3 } }, unlock: 'basic_metalworking', desc: 'Forja lingotes em fios de cobre.' },
  forgeGear: { label: 'Forjar engrenagem', station: 'anvil', cost: {}, itemCost: { ironIngot: 1 }, duration: 5, output: { items: { gear: 2 } }, unlock: 'basic_metalworking', desc: 'Forja engrenagens de ferro.' },
  forgeIronBar: { label: 'Forjar barra de ferro', station: 'anvil', cost: {}, itemCost: { ironIngot: 1 }, duration: 4, output: { items: { ironBar: 2 } }, unlock: 'basic_metalworking', desc: 'Forja lingotes em barras de ferro.' },

  // Ferramentas de mineração
  copperPickaxe: { label: 'Picareta de cobre', station: 'anvil', cost: { wood: 2 }, itemCost: { copperIngot: 3 }, duration: 6, output: { items: { copperPickaxe: 1 } }, unlock: 'copper_tools', desc: 'Picareta de cobre, melhor que a de pedra.' },
  ironPickaxe: { label: 'Picareta de ferro', station: 'anvil', cost: { wood: 2 }, itemCost: { ironIngot: 3 }, duration: 7, output: { items: { ironPickaxe: 1 } }, unlock: 'iron_tools', desc: 'Picareta de ferro, excelente para mineração.' },
  geologicalHammer: { label: 'Martelo geológico', station: 'bench', cost: { wood: 1, stone: 2 }, itemCost: {}, duration: 4, output: { items: { geologicalHammer: 1 } }, unlock: 'basic_prospecting', desc: 'Martelo que revela pureza de veios.' }
};

const baseStationLabels = { bench: 'Bancada', forge: 'Forja', stove: 'Fogão', med_station: 'Estação Médica', research_desk: 'Mesa de Pesquisa', pestle: 'Pilão de Pedra', selectionTable: 'Mesa de Seleção', furnace: 'Fornalha Simples', anvil: 'Bigorna' };
const baseNames = ['Lia', 'Téo', 'Nico'];

function normalizeResearchUnlockKeysWhenReady(attempt = 0) {
  if (typeof researchDefs !== 'object' || typeof itemDefs !== 'object' || typeof recipeDefs !== 'object') {
    if (attempt < 20) setTimeout(() => normalizeResearchUnlockKeysWhenReady(attempt + 1), 25);
    return;
  }

  itemDefs.growing = itemDefs.growing || { label: 'Zona de cultivo', icon: 'icon_warn', kind: 'system', note: 'Ferramenta de zona para plantio automático.' };
  itemDefs.storage = itemDefs.storage || { label: 'Zona de armazenamento', icon: 'icon_warn', kind: 'system', note: 'Ferramenta de zona para logística de estoque.' };

  if (researchDefs.agriculture && !researchDefs.agriculture.unlocks?.length) researchDefs.agriculture.unlocks = ['crop', 'growing'];
  if (researchDefs.storage && !researchDefs.storage.unlocks?.length) researchDefs.storage.unlocks = ['crate', 'storage'];
  if (researchDefs.preservation && !researchDefs.preservation.unlocks?.length) researchDefs.preservation.unlocks = ['smokehouse'];
  if (researchDefs.thermal_comfort && !researchDefs.thermal_comfort.unlocks?.length) researchDefs.thermal_comfort.unlocks = ['thermalClothes'];
  if (recipeDefs.torch && recipeDefs.torch.unlock === 'lighting') delete recipeDefs.torch.unlock;

  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.researchUnlockKeysNormalized = true;
}

setTimeout(() => normalizeResearchUnlockKeysWhenReady(), 0);
