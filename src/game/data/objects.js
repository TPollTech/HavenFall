'use strict';

const baseObjectDefs = {
  tree: { name: 'árvore', img: 'tree', blocks: true, gather: { wood: 8 }, work: 3.2, respawn: false },
  oak_tree: { name: 'carvalho', img: 'tree_oak', blocks: true, gather: { wood: 8 }, work: 3.2, respawn: false },
  birch_tree: { name: 'bétula', img: 'tree_birch', blocks: true, gather: { wood: 7 }, work: 3.0, respawn: false },
  pine_tree: { name: 'pinheiro', img: 'tree_pine', blocks: true, gather: { wood: 10 }, work: 3.8, respawn: false },
  palm_tree: { name: 'palmeira', img: 'tree_palm', blocks: true, gather: { wood: 6 }, work: 2.8, respawn: false },
  willow_tree: { name: 'salgueiro', img: 'tree_willow', blocks: true, gather: { wood: 8 }, work: 3.4, respawn: false },
  eucalypt_tree: { name: 'eucalipto', img: 'tree_eucalyptus', blocks: true, gather: { wood: 9 }, work: 3.5, respawn: false },
  bush: { name: 'arbusto', img: 'bush', blocks: true, gather: { wood: 3 }, work: 1.5 },
  berry: { name: 'frutas silvestres', img: 'berry', blocks: false, gather: { food: 7 }, work: 2.0 },
  rock: { name: 'rocha', img: 'rock', blocks: true, gather: { stone: 7 }, work: 3.4 },
  ore: { name: 'veio de metal', img: 'icon_metal', blocks: true, gather: { stone: 3, metal: 6 }, work: 4.5 },
  logs: { name: 'toras', img: 'logs', blocks: false, gather: { wood: 5 }, work: 1.4 },
  stockpile: { name: 'pilha de estoque', img: 'logs', blocks: false, stored: true },
  rubble: { name: 'entulho', img: 'rock', blocks: false, work: 1.0, debris: true },
  bed: { name: 'cama', img: 'bed_single', blocks: true, comfort: 1.25 },
  campfire: { name: 'fogueira', img: 'campfire', blocks: true, warmth: 1, light: { radius: 7, power: 1.0, color: '#ffb35c', flicker: 0.12 } },
  torch: { name: 'tocha', img: 'campfire', blocks: false, light: { radius: 4, power: 0.72, color: '#ffc16a', flicker: 0.18 } },
  forge: { name: 'forja de metal', img: 'edificios_forge', blocks: true, forge: { input: { stone: 2 }, output: { metal: 1 } }, work: 3.0, light: { radius: 5, power: 0.78, color: '#ff9a4f', flicker: 0.14, requiresActivity: true } },
  stove: { name: 'fogão', img: 'stove', blocks: true, cook: { input: { food: 2, wood: 1 }, output: { food: 4 } }, work: 3.0 },
  med_station: { name: 'estação médica', img: 'med_station', blocks: true, heal: { input: { medicine: 1 }, amount: 28 }, work: 4.2 },
  research_desk: { name: 'mesa de pesquisa', img: 'research_desk', blocks: true, research: 1, work: 5.0 },
  crate: { name: 'depósito', img: 'crate_wood', blocks: true, storage: 1, storageCapacity: 80 },
  ruin: { name: 'ruína antiga', img: 'wall_stone', blocks: true, interactable: true, unknown: true, work: 3.8 },
  cache: { name: 'baú abandonado', img: 'chest_large', blocks: true, interactable: true, unknown: true, work: 2.6 },
  supply_crate: { name: 'caixa de suprimentos', img: 'crate_wood', blocks: true, interactable: true, unknown: true, work: 2.2 },
  wall: { name: 'parede', img: 'wall_stone', blocks: true },
  bench: { name: 'bancada', img: 'crafting_bench', blocks: true, craft: 1 },
  door: { name: 'porta', img: 'door_wood', blocks: false, door: true, roofBoundary: true },

  // Veios fixos de minério (persistentes, não somem ao minerar)
  ironVein: { name: 'veio de ferro', img: 'mining_vein_iron', blocks: true, vein: true, veinType: 'iron', work: 8.0 },
  copperVein: { name: 'veio de cobre', img: 'mining_vein_copper', blocks: true, vein: true, veinType: 'copper', work: 8.0 },
  coalVein: { name: 'veio de carvão', img: 'mining_vein_coal', blocks: true, vein: true, veinType: 'coal', work: 6.0 },
  tinVein: { name: 'veio de estanho', img: 'mining_vein_tin', blocks: true, vein: true, veinType: 'tin', work: 7.0 },
  silverVein: { name: 'veio de prata', img: 'mining_vein_silver', blocks: true, vein: true, veinType: 'silver', work: 9.0 },

  // Bancadas de processamento de minério
  pestle: { name: 'pilão de pedra', img: 'mining_station_stone_mortar', blocks: true, craft: 1 },
  selectionTable: { name: 'mesa de seleção', img: 'mining_station_sorting_table', blocks: true, craft: 1 },
  furnace: { name: 'fornalha simples', img: 'mining_station_simple_furnace', blocks: true, craft: 1, light: { radius: 4, power: 0.7, color: '#ff8c42', flicker: 0.15 } },
  anvil: { name: 'bigorna', img: 'mining_station_anvil', blocks: true, craft: 1 }
};
