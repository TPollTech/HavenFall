'use strict';

const baseItemDefs = {
  rope: { label: 'Corda', icon: 'res_rope', kind: 'material', note: 'Material encontrado ou saqueado.' },
  nails: { label: 'Pregos', icon: 'res_nails', kind: 'material', note: 'Material para crafting avançado.' },
  cloth: { label: 'Tecido', icon: 'res_cloth', kind: 'material', note: 'Material para itens médicos.' },
  leather: { label: 'Couro', icon: 'res_leather', kind: 'material', note: 'Material resistente.' },
  stoneAxe: { label: 'Machado de pedra', icon: 'weapon_axe', slot: 'tool', kind: 'tool', gatherBonus: { wood: 0.35 }, combat: 1.5, maxDurability: 25, note: 'Corta madeira melhor e ajuda em defesa.' },
  pickaxe: { label: 'Picareta', icon: 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.35, metal: 0.35 }, combat: 1.2, maxDurability: 25, note: 'Minera pedra e metal mais rápido.' },
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
  rawIron: { label: 'Minério de ferro bruto', icon: 'icon_metal', kind: 'rawOre', note: 'Ferro extraído da rocha. Precisa ser triturado, selecionado e fundido.' },
  rawCopper: { label: 'Minério de cobre bruto', icon: 'icon_metal', kind: 'rawOre', note: 'Cobre extraído da rocha. Precisa ser processado em etapas.' },
  rawCoal: { label: 'Carvão bruto', icon: 'icon_coal', kind: 'rawOre', note: 'Carvão extraído, cheio de impurezas.' },
  rawTin: { label: 'Minério de estanho bruto', icon: 'icon_metal', kind: 'rawOre', note: 'Estanho bruto para ligas e peças leves.' },
  rawSilver: { label: 'Minério de prata bruto', icon: 'icon_metal', kind: 'rawOre', note: 'Prata bruta para componentes precisos.' },

  // Minérios processados
  crushedIron: { label: 'Ferro triturado', icon: 'icon_metal', kind: 'crushedOre', note: 'Ferro triturado, pronto para seleção.' },
  crushedCopper: { label: 'Cobre triturado', icon: 'icon_metal', kind: 'crushedOre', note: 'Cobre triturado, pronto para seleção.' },
  crushedCoal: { label: 'Carvão triturado', icon: 'icon_coal', kind: 'crushedOre', note: 'Carvão triturado, precisa ser limpo.' },
  preparedIron: { label: 'Ferro preparado', icon: 'icon_metal', kind: 'smeltable', note: 'Ferro separado e limpo, pronto para fundir.' },
  preparedCopper: { label: 'Cobre preparado', icon: 'icon_metal', kind: 'smeltable', note: 'Cobre separado e limpo, pronto para fundir.' },
  preparedCoal: { label: 'Carvão limpo', icon: 'icon_coal', kind: 'fuel', note: 'Carvão limpo e seco, combustível de qualidade.' },

  // Metais em lingote
  ironIngot: { label: 'Lingote de ferro', icon: 'icon_metal', kind: 'metal', note: 'Ferro fundido em lingote. Base para ferramentas, peças e máquinas.' },
  copperIngot: { label: 'Lingote de cobre', icon: 'icon_metal', kind: 'metal', note: 'Cobre fundido em lingote. Base para fios e componentes elétricos.' },
  tinIngot: { label: 'Lingote de estanho', icon: 'icon_metal', kind: 'metal', note: 'Estanho fundido, usado em ligas de bronze.' },
  silverIngot: { label: 'Lingote de prata', icon: 'icon_metal', kind: 'metal', note: 'Prata refinada para componentes de precisão.' },

  // Peças e componentes
  ironPlate: { label: 'Chapa de ferro', icon: 'icon_metal', kind: 'part', note: 'Chapa de ferro para construção de máquinas e estruturas.' },
  copperWire: { label: 'Fio de cobre', icon: 'icon_wire', kind: 'part', note: 'Fio de cobre para energia e componentes elétricos.' },
  gear: { label: 'Engrenagem', icon: 'icon_gear', kind: 'part', note: 'Engrenagem de metal para maquinário.' },
  ironBar: { label: 'Barra de ferro', icon: 'icon_metal', kind: 'part', note: 'Barra de ferro para construção e peças estruturais.' },

  // Subprodutos
  gravel: { label: 'Cascalho', icon: 'icon_stone', kind: 'material', note: 'Resíduo da britagem de minério. Usado em construção.' },
  silica: { label: 'Sílica', icon: 'icon_stone', kind: 'material', note: 'Pó de quartzo para fabricação de vidro.' },

  // Ferramentas de mineração
  copperPickaxe: { label: 'Picareta de cobre', icon: 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.45, metal: 0.50 }, combat: 1.3, maxDurability: 35, note: 'Picareta de cobre. Melhor rendimento em mineração.' },
  ironPickaxe: { label: 'Picareta de ferro', icon: 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.60, metal: 0.65 }, combat: 1.5, maxDurability: 50, note: 'Picareta de ferro. Excelente para mineração pesada.' },
  geologicalHammer: { label: 'Martelo geológico', icon: 'tool_hammer', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.30, metal: 0.30 }, combat: 1.0, maxDurability: 60, note: 'Martelo especial que revela a pureza de veios minerais.' }
};
