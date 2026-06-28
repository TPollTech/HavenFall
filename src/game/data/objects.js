'use strict';

const baseObjectDefs = {
  tree: { name: 'árvore', img: 'tree', blocks: true, gather: { wood: 8 }, work: 3.2, respawn: false },
  bush: { name: 'arbusto', img: 'bush', blocks: true, gather: { wood: 2 }, work: 1.5 },
  berry: { name: 'frutas silvestres', img: 'berry', blocks: false, gather: { food: 7 }, work: 2.0 },
  rock: { name: 'rocha', img: 'rock', blocks: true, gather: { stone: 7 }, work: 3.4 },
  ore: { name: 'veio de metal', img: 'icon_metal', blocks: true, gather: { stone: 2, metal: 4 }, work: 4.0 },
  logs: { name: 'toras', img: 'logs', blocks: false, gather: { wood: 5 }, work: 1.4 },
  rubble: { name: 'entulho', img: 'rock', blocks: false, work: 1.0, debris: true },
  crop: { name: 'plantação', img: 'crop_patch', blocks: false, gather: { food: 10 }, work: 2.4 },
  bed: { name: 'cama', img: 'bed_single', blocks: true, comfort: 1.25 },
  campfire: { name: 'fogueira', img: 'campfire', blocks: true, warmth: 1 },
  forge: { name: 'forja de metal', img: 'edificios_forge', blocks: true, forge: { input: { stone: 3 }, output: { metal: 1 } }, work: 4.5 },
  stove: { name: 'fogão', img: 'stove', blocks: true, cook: { input: { food: 2, wood: 1 }, output: { food: 4 } }, work: 3.8 },
  med_station: { name: 'estação médica', img: 'med_station', blocks: true, heal: { input: { medicine: 1 }, amount: 28 }, work: 4.2 },
  research_desk: { name: 'mesa de pesquisa', img: 'research_desk', blocks: true, research: 1, work: 5.0 },
  crate: { name: 'depósito', img: 'crate_wood', blocks: true, storage: 1 },
  ruin: { name: 'ruína antiga', img: 'wall_stone', blocks: true, interactable: true, unknown: true, work: 3.8 },
  cache: { name: 'baú abandonado', img: 'chest_large', blocks: true, interactable: true, unknown: true, work: 2.6 },
  supply_crate: { name: 'caixa de suprimentos', img: 'crate_wood', blocks: true, interactable: true, unknown: true, work: 2.2 },
  wall: { name: 'parede', img: 'wall_stone', blocks: true },
  bench: { name: 'bancada', img: 'crafting_bench', blocks: true, craft: 1 },
  door: { name: 'porta', img: 'door_wood', blocks: false, door: true, roofBoundary: true }
};
