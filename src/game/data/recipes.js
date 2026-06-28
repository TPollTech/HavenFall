'use strict';

const baseRecipeDefs = {
  stoneAxe: { label: 'Machado de pedra', station: 'bench', cost: { wood: 3, stone: 2 }, duration: 5, output: { items: { stoneAxe: 1 } }, unlock: null, desc: 'Ferramenta inicial para madeira e defesa.' },
  pickaxe: { label: 'Picareta', station: 'bench', cost: { wood: 3, stone: 4 }, duration: 6, output: { items: { pickaxe: 1 } }, unlock: null, desc: 'Aumenta coleta de pedra e metal.' },
  hammer: { label: 'Martelo', station: 'bench', cost: { wood: 2, stone: 3 }, duration: 5, output: { items: { hammer: 1 } }, unlock: null, desc: 'Acelera construção.' },
  club: { label: 'Porrete', station: 'bench', cost: { wood: 4 }, duration: 4, output: { items: { club: 1 } }, unlock: null, desc: 'Defesa básica barata.' },
  spear: { label: 'Lança improvisada', station: 'bench', cost: { wood: 4, stone: 2 }, duration: 6, output: { items: { spear: 1 } }, unlock: null, desc: 'Boa contra lobos.' },
  bow: { label: 'Arco simples', station: 'bench', cost: { wood: 5 }, itemCost: { rope: 1 }, duration: 7, output: { items: { bow: 1 } }, unlock: null, desc: 'Arma de distância; usa flechas.' },
  arrows: { label: 'Flechas x6', station: 'bench', cost: { wood: 2, stone: 1 }, duration: 4, output: { items: { arrows: 6 } }, unlock: null, desc: 'Munição para arco.' },
  torch: { label: 'Tocha', station: 'bench', cost: { wood: 2 }, duration: 3, output: { items: { torch: 1 } }, unlock: null, desc: 'Ajuda contra animais à noite.' },
  knife: { label: 'Faca simples', station: 'forge', cost: { metal: 3, wood: 1 }, duration: 7, output: { items: { knife: 1 } }, unlock: 'metalworking', desc: 'Arma curta de metal.' },
  toolkit: { label: 'Kit de ferramentas', station: 'forge', cost: { metal: 5, wood: 2 }, itemCost: { nails: 2 }, duration: 9, output: { items: { toolkit: 1 } }, unlock: 'metalworking', desc: 'Ferramenta avançada.' },
  shield: { label: 'Escudo improvisado', station: 'forge', cost: { wood: 4, metal: 2 }, duration: 8, output: { items: { shield: 1 } }, unlock: 'metalworking', desc: 'Reduz risco em combate.' },
  simpleMeal: { label: 'Refeição cozida x3', station: 'stove', cost: { food: 2, wood: 1 }, duration: 4, output: { resources: { food: 4 }, items: { simpleMeal: 1 } }, unlock: 'cooking', desc: 'Cozinha comida e melhora o estoque.' },
  bandage: { label: 'Curativo x2', station: 'med_station', cost: { medicine: 1 }, itemCost: { cloth: 1 }, duration: 5, output: { items: { bandage: 2 } }, unlock: 'medicine', desc: 'Item médico básico.' }
};

const baseStationLabels = { bench: 'Bancada', forge: 'Forja', stove: 'Fogão', med_station: 'Estação Médica', research_desk: 'Mesa de Pesquisa' };
const baseNames = ['Lia', 'Téo', 'Nico'];
