'use strict';

const colonistTraitDefs = Object.freeze({
  physical: {
    resilient: { label: 'resistente' },
    short: { label: 'baixo' },
    tall: { label: 'alto' },
    agile: { label: 'ágil' },
    good_vision: { label: 'visão boa' },
    steady_hands: { label: 'mãos firmes' },
    tires_fast: { label: 'cansa rápido' },
    light_step: { label: 'passo leve' }
  },
  positive: {
    calm: { label: 'calmo' },
    curious: { label: 'curioso' },
    optimistic: { label: 'otimista' },
    focused: { label: 'focado' },
    brave: { label: 'corajoso' },
    organized: { label: 'organizado' },
    patient: { label: 'paciente' }
  },
  negative: {
    stubborn: { label: 'teimoso' },
    fearful: { label: 'medroso' },
    impatient: { label: 'impaciente' },
    clumsy: { label: 'desastrado' },
    nocturnal: { label: 'noturno' },
    pessimistic: { label: 'pessimista' },
    distracted: { label: 'distraído' }
  }
});

const colonistWorkPreferenceDefs = Object.freeze({
  build: { label: 'Construção', priority: 'build' },
  gather: { label: 'Coleta', priority: 'gather' },
  defense: { label: 'Defesa', priority: 'defense' },
  research: { label: 'Pesquisa', priority: null },
  cooking: { label: 'Culinária', priority: null },
  medicine: { label: 'Medicina', priority: null }
});

const COLONIST_FIRST_NAMES = Object.freeze(['Lia','Téo','Nico','Bia','Gael','Mira','Davi','Luma','Caio','Iris','Noa','Eva','Ravi','Mila','Otto','Nina']);
const COLONIST_ROLES = Object.freeze(['Coletora', 'Construtor', 'Faz-tudo']);
const COLONIST_SPRITES = Object.freeze(['colonistA', 'colonistB', 'colonistC']);

const TRAIT_KEYS_CACHE = Object.freeze({
  physical: Object.freeze(Object.keys(colonistTraitDefs.physical)),
  positive: Object.freeze(Object.keys(colonistTraitDefs.positive)),
  negative: Object.freeze(Object.keys(colonistTraitDefs.negative)),
  workPrefs: Object.freeze(Object.keys(colonistWorkPreferenceDefs))
});

function randomFrom(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

function createColonistCandidate(index, config, forceSeed = null) {
  const seed = forceSeed || `${config?.seed || 'default-seed'}-candidate-${index}`;
  const rand = typeof seededRandom === 'function' ? seededRandom(seed) : Math.random;
  const workPreferenceId = randomFrom(TRAIT_KEYS_CACHE.workPrefs, rand);
  const physicalTraitIds = pickMany(TRAIT_KEYS_CACHE.physical, 2, rand);
  const positiveTraitIds = pickMany(TRAIT_KEYS_CACHE.positive, 2, rand);
  const negativeTraitIds = pickMany(TRAIT_KEYS_CACHE.negative, 1, rand);
  const skills = {
    coleta: 1 + Math.floor(rand() * 5),
    construcao: 1 + Math.floor(rand() * 5),
    defesa: 1 + Math.floor(rand() * 5),
    pesquisa: 1 + Math.floor(rand() * 5),
    medicina: 1 + Math.floor(rand() * 5)
  };
  const role = randomFrom(COLONIST_ROLES, rand);
  const hSeed = typeof hashSeed === 'function' ? hashSeed(seed).toString(36) : String(index);

  return {
    setupId: `candidate_${index}_${hSeed}`,
    locked: false,
    rerollCount: 0,
    name: randomFrom(COLONIST_FIRST_NAMES, rand),
    age: 18 + Math.floor(rand() * 38),
    sprite: COLONIST_SPRITES[index % COLONIST_SPRITES.length],
    role,
    physicalTraitIds,
    positiveTraitIds,
    negativeTraitIds,
    physicalTraits: physicalTraitIds.map(id => colonistTraitLabel('physical', id)),
    positiveTraits: positiveTraitIds.map(id => colonistTraitLabel('positive', id)),
    negativeTraits: negativeTraitIds.map(id => colonistTraitLabel('negative', id)),
    skills,
    workPreferenceId,
    workPreference: workPreferenceLabel(workPreferenceId),
    needs: {
      hunger: 72 + Math.floor(rand() * 22),
      energy: 72 + Math.floor(rand() * 22),
      mood: 68 + Math.floor(rand() * 26),
      health: 88 + Math.floor(rand() * 13)
    }
  };
}

function pickMany(list, amount, rand) {
  const len = list.length;
  if (amount <= 0 || len === 0) return [];
  if (amount >= len) return list.slice();
  if (amount === 1) return [randomFrom(list, rand)];

  const out = [];
  while (out.length < amount) {
    const candidate = randomFrom(list, rand);
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}

function colonistTraitLabel(kind, id) {
  return colonistTraitDefs[kind]?.[id]?.label || id;
}

function workPreferenceLabel(id) {
  return colonistWorkPreferenceDefs[id]?.label || id || 'Sem preferência';
}

function generateColonistCandidates(config) {
  const count = Math.max(1, Number(config?.colonistCount || defaultNewGameConfig.colonistCount || 3));
  const seed = config?.seed || 'fallback-seed';
  colonistCandidates = Array.from({ length: count }, (_, i) => createColonistCandidate(i, config, `${seed}-candidate-${i}`));
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
  return colonistCandidates;
}

function rerollColonist(index) {
  const current = colonistCandidates[index];
  if (current?.locked) return;

  const rerollCount = (current?.rerollCount || 0) + 1;
  const cfg = newGameConfig || defaultNewGameConfig;
  const seed = cfg?.seed || 'fallback-seed';
  const next = createColonistCandidate(index, cfg, `${seed}-reroll-${index}-${rerollCount}`);

  next.rerollCount = rerollCount;
  colonistCandidates[index] = next;
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function rerollUnlockedColonists() {
  const cfg = newGameConfig || defaultNewGameConfig;
  const seed = cfg?.seed || 'fallback-seed';

  colonistCandidates = colonistCandidates.map((c, i) => {
    if (c.locked) return c;
    const rerollCount = (c.rerollCount || 0) + 1;
    const next = createColonistCandidate(i, cfg, `${seed}-reroll-all-${i}-${rerollCount}`);
    next.rerollCount = rerollCount;
    return next;
  });

  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function candidateToColonist(candidate, id, x, y) {
  const c = makeColonist(id, candidate.name, candidate.sprite, x, y, candidate.role);
  const workPreferenceId = candidate.workPreferenceId || legacyWorkPreferenceId(candidate.workPreference);
  c.age = candidate.age;
  c.appearance = candidate.sprite;
  c.physicalTraitIds = candidate.physicalTraitIds || [];
  c.positiveTraitIds = candidate.positiveTraitIds || [];
  c.negativeTraitIds = candidate.negativeTraitIds || [];
  c.physicalTraits = candidate.physicalTraits || c.physicalTraitIds.map(t => colonistTraitLabel('physical', t));
  c.positiveTraits = candidate.positiveTraits || c.positiveTraitIds.map(t => colonistTraitLabel('positive', t));
  c.negativeTraits = candidate.negativeTraits || c.negativeTraitIds.map(t => colonistTraitLabel('negative', t));
  c.skills = candidate.skills;
  c.workPreferenceId = workPreferenceId;
  c.workPreference = workPreferenceLabel(workPreferenceId);
  c.hunger = candidate.needs.hunger;
  c.energy = candidate.needs.energy;
  c.mood = candidate.needs.mood;
  c.health = candidate.needs.health;
  c.priority = priorityFromWorkPreference(workPreferenceId, candidate.role);
  return c;
}

function legacyWorkPreferenceId(pref) {
  const legacy = {
    'Construção': 'build',
    'Coleta': 'gather',
    'Defesa': 'defense',
    'Pesquisa': 'research',
    'Culinária': 'cooking',
    'Medicina': 'medicine'
  };
  return legacy[pref] || pref;
}

function priorityFromWorkPreference(prefOrId, role) {
  const id = legacyWorkPreferenceId(prefOrId);
  return colonistWorkPreferenceDefs[id]?.priority || defaultPriorityForRole(role);
}
