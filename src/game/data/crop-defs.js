'use strict';

const cropDefs = Object.freeze({
  potato: Object.freeze({
    id: 'potato',
    label: 'Batata',
    seedItem: 'potato_seed',
    growHours: 36,
    yieldItems: Object.freeze({ potato: 4 }),
    hungerRestore: 26,
    perishHours: 96,
    needsCooling: false,
    bestUse: 'cozida ou ensopada',
    stages: Object.freeze(['solo', 'broto', 'folhas', 'madura']),
    soilPreference: Object.freeze(['dirt', 'grass']),
    rainResponse: 'benefits'
  }),
  carrot: Object.freeze({
    id: 'carrot',
    label: 'Cenoura',
    seedItem: 'carrot_seed',
    growHours: 30,
    yieldItems: Object.freeze({ carrot: 3 }),
    hungerRestore: 16,
    perishHours: 72,
    needsCooling: false,
    bestUse: 'crua, sopa ou ensopado',
    stages: Object.freeze(['solo', 'broto', 'rama', 'madura']),
    soilPreference: Object.freeze(['dirt', 'grass']),
    rainResponse: 'neutral'
  }),
  corn: Object.freeze({
    id: 'corn',
    label: 'Milho',
    seedItem: 'corn_seed',
    growHours: 54,
    yieldItems: Object.freeze({ corn: 5 }),
    hungerRestore: 22,
    perishHours: 120,
    needsCooling: false,
    bestUse: 'assado, farinha ou ração',
    stages: Object.freeze(['solo', 'muda', 'haste', 'espiga']),
    soilPreference: Object.freeze(['dirt', 'grass']),
    rainResponse: 'overwater_risk'
  }),
  strawberry: Object.freeze({
    id: 'strawberry',
    label: 'Morango',
    seedItem: 'strawberry_seed',
    growHours: 42,
    yieldItems: Object.freeze({ strawberry: 4 }),
    hungerRestore: 14,
    perishHours: 36,
    needsCooling: true,
    bestUse: 'fresco, sobremesa ou conserva',
    stages: Object.freeze(['solo', 'broto', 'flor', 'fruto']),
    soilPreference: Object.freeze(['dirt', 'grass']),
    rainResponse: 'rot_risk'
  })
});

const cropItemDefs = Object.freeze({
  potato_seed: { label: 'Semente de batata', kind: 'seed', cropId: 'potato', stack: 50 },
  carrot_seed: { label: 'Semente de cenoura', kind: 'seed', cropId: 'carrot', stack: 50 },
  corn_seed: { label: 'Semente de milho', kind: 'seed', cropId: 'corn', stack: 50 },
  strawberry_seed: { label: 'Semente de morango', kind: 'seed', cropId: 'strawberry', stack: 50 },
  potato: { label: 'Batata', kind: 'food', nutrition: 26, moodBonus: 0, freshness: true, resourceKey: 'food' },
  carrot: { label: 'Cenoura', kind: 'food', nutrition: 16, moodBonus: 1, freshness: true, resourceKey: 'food' },
  corn: { label: 'Milho', kind: 'food', nutrition: 22, moodBonus: 0, freshness: true, resourceKey: 'food' },
  strawberry: { label: 'Morango', kind: 'food', nutrition: 14, moodBonus: 3, freshness: true, resourceKey: 'food' },
  dried_potato: { label: 'Batata seca', kind: 'food', nutrition: 18, moodBonus: -1, stableFood: true, resourceKey: 'food' },
  canned_carrot: { label: 'Cenoura em conserva', kind: 'food', nutrition: 14, moodBonus: 1, stableFood: true, resourceKey: 'food' },
  cornmeal: { label: 'Farinha de milho', kind: 'food', nutrition: 20, moodBonus: 0, stableFood: true, resourceKey: 'food' },
  strawberry_preserve: { label: 'Geleia de morango', kind: 'food', nutrition: 12, moodBonus: 4, stableFood: true, resourceKey: 'food' }
});

if (typeof itemDefs !== 'undefined') Object.assign(itemDefs, cropItemDefs);

window.cropDefs = cropDefs;
window.cropItemDefs = cropItemDefs;
window.HavenfallCrops = Object.freeze({ cropDefs, cropItemDefs });
