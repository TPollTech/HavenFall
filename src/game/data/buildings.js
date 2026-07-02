'use strict';

const baseBuildDefs = {
  bed: { label: 'Cama', type: 'bed', cost: { wood: 12 }, work: 5 },
  campfire: { label: 'Fogueira', type: 'campfire', cost: { wood: 6, stone: 2 }, work: 4 },
  torch: { label: 'Tocha', type: 'torch', cost: { wood: 2 }, work: 1.2 },
  crate: { label: 'Depósito', type: 'crate', cost: { wood: 10 }, work: 4 },
  wall: { label: 'Parede', type: 'wall', cost: { wood: 4 }, work: 3 },
  door: { label: 'Porta', type: 'door', cost: { wood: 6 }, work: 4 },
  floor_dirt: { label: 'Chão Batido', type: 'floor', floorType: 'packed_dirt', cost: {}, work: 1.2 },
  floor_wood: { label: 'Piso de Madeira', type: 'floor', floorType: 'wood_floor', cost: { wood: 2 }, work: 1.6 },
  floor_stone: { label: 'Piso de Pedra', type: 'floor', floorType: 'stone_floor', cost: { stone: 2 }, work: 1.8 },
  bench: { label: 'Bancada', type: 'bench', cost: { wood: 12, stone: 4 }, work: 5 },
  research_desk: { label: 'Mesa de Pesquisa', type: 'research_desk', cost: { wood: 20, stone: 6 }, work: 7 },
  forge: { label: 'Forja', type: 'forge', cost: { wood: 14, stone: 12 }, work: 8, requires: 'metalworking' },
  stove: { label: 'Fogão', type: 'stove', cost: { wood: 12, stone: 10, metal: 2 }, work: 7, requires: 'cooking' },
  med_station: { label: 'Estação Médica', type: 'med_station', cost: { wood: 10, stone: 4, metal: 4 }, work: 8, requires: 'medicine' },
  pestle: { label: 'Pilão de Pedra', type: 'pestle', cost: { stone: 6, wood: 4 }, work: 4, requires: 'basic_prospecting' },
  selectionTable: { label: 'Mesa de Seleção', type: 'selectionTable', cost: { wood: 8, stone: 2 }, work: 3, requires: 'ore_processing' },
  furnace: { label: 'Fornalha Simples', type: 'furnace', cost: { stone: 10, wood: 4 }, work: 5, requires: 'basic_smelting' },
  anvil: { label: 'Bigorna', type: 'anvil', cost: { stone: 8, metal: 4 }, work: 6, requires: 'basic_metalworking' }
};
