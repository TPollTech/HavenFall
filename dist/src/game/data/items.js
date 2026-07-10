'use strict';

const baseItemDefs = {
  rope: { label: 'Corda', icon: 'res_rope', kind: 'material', note: 'Material encontrado ou saqueado.' },
  nails: { label: 'Pregos', icon: 'res_nails', kind: 'material', note: 'Material para crafting avançado.' },
  cloth: { label: 'Tecido', icon: 'res_cloth', kind: 'material', note: 'Material para itens médicos.' },
  leather: { label: 'Couro', icon: 'res_leather', kind: 'material', note: 'Material resistente.' },
  stoneAxe: { label: 'Machado de pedra', icon: 'weapon_axe', slot: 'tool', kind: 'tool', gatherBonus: { wood: 0.35 }, combat: 1.5, maxDurability: 25, note: 'Corta madeira melhor e ajuda em defesa.' },
  pickaxe: { label: 'Picareta', icon: 'mining_tool_pickaxe_stone', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.35, metal: 0.35 }, combat: 1.2, maxDurability: 25, note: 'Minera pedra e metal mais rápido.' },
  hammer: { label: 'Martelo', icon: 'tool_hammer', slot: 'tool', kind: 'tool', buildBonus: 0.28, combat: 1.1, maxDurability: 30, note: 'Acelera construção.' },
  toolkit: { label: 'Kit de ferramentas', icon: 'toolkit', slot: 'tool', kind: 'tool', buildBonus: 0.45, craftBonus: 0.25, combat: 1.0, maxDurability: 40, note: 'Ferramenta avançada para construir e fabricar.' },
  knife: { label: 'Faca simples', icon: 'weapon_knife', slot: 'weapon', kind: 'weapon', combat: 2.1, note: 'Defesa básica, melhor que lutar desarmado.' },
  spear: { label: 'Lança improvisada', icon: 'weapon_spear', slot: 'weapon', kind: 'weapon', combat: 3.0, range: 1, note: 'Boa contra animais.' },
  bow: { label: 'Arco simples', icon: 'weapon_bow', slot: 'weapon', kind: 'weapon', combat: 2.7, needsAmmo: 'arrows', note: 'Permite atacar com distância se houver flechas.' },
  club: { label: 'Porrete', icon: 'weapon_club', slot: 'weapon', kind: 'weapon', combat: 1.8, note: 'Arma simples e pesada.' },
  shield: { label: 'Escudo improvisado', icon: 'weapon_shield', slot: 'offhand', kind: 'shield', defense: 0.35, note: 'Reduz risco em combate.' },
  torch: { label: 'Tocha', icon: 'weapon_torch', slot: 'offhand', kind: 'utility', defense: 0.18, scare: 0.35, note: 'Ajuda a afastar animais e ilumina à noite.' },
  arrows: { label: 'Flechas', icon: 'weapon_arrows', kind: 'ammo', note: 'Munição para arco.' },
  bandage: { label: 'Curativo', icon: 'res_cloth', kind: 'medical', note: 'Pode ser usado em futuras ações médicas.' },
  simpleMeal: { label: 'Refeição cozida', icon: 'res_stew', kind: 'food', note: 'Comida preparada no fogão.' },

  // Minérios brutos
  rawIron: { label: 'Minério de ferro bruto', icon: 'mining_ore_iron_raw', kind: 'rawOre', note: 'Ferro extraído da rocha. Precisa ser triturado, selecionado e fundido.' },
  rawCopper: { label: 'Minério de cobre bruto', icon: 'mining_ore_copper_raw', kind: 'rawOre', note: 'Cobre extraído da rocha. Precisa ser processado em etapas.' },
  rawCoal: { label: 'Carvão bruto', icon: 'mining_ore_coal_raw', kind: 'rawOre', note: 'Carvão extraído, cheio de impurezas.' },
  rawTin: { label: 'Minério de estanho bruto', icon: 'mining_ore_tin_raw', kind: 'rawOre', note: 'Estanho bruto para ligas e peças leves.' },
  rawSilver: { label: 'Minério de prata bruto', icon: 'mining_ore_silver_raw', kind: 'rawOre', note: 'Prata bruta para componentes precisos.' },

  // Minérios processados
  crushedIron: { label: 'Ferro triturado', icon: 'mining_ore_iron_raw', kind: 'crushedOre', note: 'Ferro triturado, pronto para seleção.' },
  crushedCopper: { label: 'Cobre triturado', icon: 'mining_ore_copper_raw', kind: 'crushedOre', note: 'Cobre triturado, pronto para seleção.' },
  crushedCoal: { label: 'Carvão triturado', icon: 'mining_ore_coal_raw', kind: 'crushedOre', note: 'Carvão triturado, precisa ser limpo.' },
  crushedTin: { label: 'Estanho triturado', icon: 'mining_ore_tin_raw', kind: 'crushedOre', note: 'Estanho triturado, pronto para seleção.' },
  preparedIron: { label: 'Ferro preparado', icon: 'mining_ore_iron_raw', kind: 'smeltable', note: 'Ferro separado e limpo, pronto para fundir.' },
  preparedCopper: { label: 'Cobre preparado', icon: 'mining_ore_copper_raw', kind: 'smeltable', note: 'Cobre separado e limpo, pronto para fundir.' },
  preparedCoal: { label: 'Carvão limpo', icon: 'mining_ore_coal_raw', kind: 'fuel', note: 'Carvão limpo e seco, combustível de qualidade.' },
  preparedTin: { label: 'Estanho preparado', icon: 'mining_ore_tin_raw', kind: 'smeltable', note: 'Estanho separado e limpo, pronto para fundir.' },
  crushedSilver: { label: 'Prata triturada', icon: 'mining_ore_silver_raw', kind: 'crushedOre', note: 'Prata triturada, pronto para seleção.' },
  preparedSilver: { label: 'Prata preparada', icon: 'mining_ore_silver_raw', kind: 'smeltable', note: 'Prata separada e limpa, pronta para fundir.' },

  // Metais em lingote
  ironIngot: { label: 'Lingote de ferro', icon: 'mining_ingot_iron', kind: 'metal', note: 'Ferro fundido em lingote. Base para ferramentas, peças e máquinas.' },
  copperIngot: { label: 'Lingote de cobre', icon: 'mining_ingot_copper', kind: 'metal', note: 'Cobre fundido em lingote. Base para fios e componentes elétricos.' },
  tinIngot: { label: 'Lingote de estanho', icon: 'mining_ingot_tin', kind: 'metal', note: 'Estanho fundido, usado em ligas de bronze.' },
  silverIngot: { label: 'Lingote de prata', icon: 'mining_ingot_silver', kind: 'metal', note: 'Prata refinada para componentes de precisão.' },

  // Peças e componentes
  ironPlate: { label: 'Chapa de ferro', icon: 'mining_part_iron_plate', kind: 'part', note: 'Chapa de ferro para construção de máquinas e estruturas.' },
  copperWire: { label: 'Fio de cobre', icon: 'mining_part_copper_wire', kind: 'part', note: 'Fio de cobre para energia e componentes elétricos.' },
  gear: { label: 'Engrenagem', icon: 'mining_part_gear', kind: 'part', note: 'Engrenagem de metal para maquinário.' },
  ironBar: { label: 'Barra de ferro', icon: 'mining_part_iron_bar', kind: 'part', note: 'Barra de ferro para construção e peças estruturais.' },

  // Subprodutos
  gravel: { label: 'Cascalho', icon: 'mining_byproduct_gravel', kind: 'material', note: 'Resíduo da britagem de minério. Usado em construção.' },
  silica: { label: 'Sílica', icon: 'mining_byproduct_silica', kind: 'material', note: 'Pó de quartzo para fabricação de vidro.' },

  // Ferramentas de mineração
  copperPickaxe: { label: 'Picareta de cobre', icon: 'mining_tool_pickaxe_copper', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.45, metal: 0.50 }, combat: 1.3, maxDurability: 35, note: 'Picareta de cobre. Melhor rendimento em mineração.' },
  ironPickaxe: { label: 'Picareta de ferro', icon: 'mining_tool_pickaxe_iron', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.60, metal: 0.65 }, combat: 1.5, maxDurability: 50, note: 'Picareta de ferro. Excelente para mineração pesada.' },
  geologicalHammer: { label: 'Martelo geológico', icon: 'mining_tool_geological_hammer', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.30, metal: 0.30 }, combat: 1.0, maxDurability: 60, note: 'Martelo especial que revela a pureza de veios minerais.' }
};
