'use strict';

const baseItemDefs = {
  rope: { label: 'Corda', icon: 'res_rope', kind: 'material', note: 'Material encontrado ou saqueado.' },
  nails: { label: 'Pregos', icon: 'res_nails', kind: 'material', note: 'Material para crafting avançado.' },
  cloth: { label: 'Tecido', icon: 'res_cloth', kind: 'material', note: 'Material para itens médicos.' },
  leather: { label: 'Couro', icon: 'res_leather', kind: 'material', note: 'Material resistente.' },
  stoneAxe: { label: 'Machado de pedra', icon: 'weapon_axe', slot: 'tool', kind: 'tool', gatherBonus: { wood: 0.35 }, combat: 1.5, note: 'Corta madeira melhor e ajuda em defesa.' },
  pickaxe: { label: 'Picareta', icon: 'tool_pickaxe', slot: 'tool', kind: 'tool', gatherBonus: { stone: 0.35, metal: 0.35 }, combat: 1.2, note: 'Minera pedra e metal mais rápido.' },
  hammer: { label: 'Martelo', icon: 'tool_hammer', slot: 'tool', kind: 'tool', buildBonus: 0.28, combat: 1.1, note: 'Acelera construção.' },
  toolkit: { label: 'Kit de ferramentas', icon: 'toolkit', slot: 'tool', kind: 'tool', buildBonus: 0.45, craftBonus: 0.25, combat: 1.0, note: 'Ferramenta avançada para construir e fabricar.' },
  knife: { label: 'Faca simples', icon: 'weapon_knife', slot: 'weapon', kind: 'weapon', combat: 2.1, note: 'Defesa básica, melhor que lutar desarmado.' },
  spear: { label: 'Lança improvisada', icon: 'weapon_spear', slot: 'weapon', kind: 'weapon', combat: 3.0, range: 1, note: 'Boa contra animais.' },
  bow: { label: 'Arco simples', icon: 'weapon_bow', slot: 'weapon', kind: 'weapon', combat: 2.7, needsAmmo: 'arrows', note: 'Permite atacar com distância se houver flechas.' },
  club: { label: 'Porrete', icon: 'weapon_club', slot: 'weapon', kind: 'weapon', combat: 1.8, note: 'Arma simples e pesada.' },
  shield: { label: 'Escudo improvisado', icon: 'weapon_shield', slot: 'offhand', kind: 'shield', defense: 0.35, note: 'Reduz risco em combate.' },
  torch: { label: 'Tocha', icon: 'weapon_torch', slot: 'offhand', kind: 'utility', defense: 0.18, scare: 0.35, note: 'Ajuda a afastar animais e ilumina à noite.' },
  arrows: { label: 'Flechas', icon: 'weapon_arrows', kind: 'ammo', note: 'Munição para arco.' },
  bandage: { label: 'Curativo', icon: 'res_cloth', kind: 'medical', note: 'Pode ser usado em futuras ações médicas.' },
  simpleMeal: { label: 'Refeição cozida', icon: 'res_stew', kind: 'food', note: 'Comida preparada no fogão.' }
};
