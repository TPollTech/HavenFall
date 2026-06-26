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

function createColonistCandidate(index, config, forceSeed = null) {
  const seed = forceSeed || `${config?.seed || 'default-seed'}-candidate-${index}`;
  const rand = seededRandom(seed);
  const firstNames = ['Lia','Téo','Nico','Bia','Gael','Mira','Davi','Luma','Caio','Iris','Noa','Eva','Ravi','Mila','Otto','Nina'];
  const roles = ['Coletora', 'Construtor', 'Faz-tudo'];
  const sprites = ['colonistA', 'colonistB', 'colonistC'];
  const workPrefs = Object.keys(colonistWorkPreferenceDefs);
  const workPreferenceId = workPrefs[Math.floor(rand() * workPrefs.length)];
  const physicalTraitIds = pickMany(Object.keys(colonistTraitDefs.physical), 2, rand);
  const positiveTraitIds = pickMany(Object.keys(colonistTraitDefs.positive), 2, rand);
  const negativeTraitIds = pickMany(Object.keys(colonistTraitDefs.negative), 1, rand);
  const skills = {
    coleta: 1 + Math.floor(rand() * 5),
    construcao: 1 + Math.floor(rand() * 5),
    defesa: 1 + Math.floor(rand() * 5),
    pesquisa: 1 + Math.floor(rand() * 5),
    medicina: 1 + Math.floor(rand() * 5)
  };
  const role = roles[Math.floor(rand() * roles.length)];
  return {
    setupId: `candidate_${index}_${hashSeed(seed).toString(36)}`,
    locked: false,
    rerollCount: 0,
    name: firstNames[Math.floor(rand() * firstNames.length)],
    age: 18 + Math.floor(rand() * 38),
    sprite: sprites[index % sprites.length],
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
  const copy = list.slice();
  const out = [];
  while (out.length < amount && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
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
  colonistCandidates = Array.from({ length: config.colonistCount }, (_, i) => createColonistCandidate(i, config, `${config.seed}-candidate-${i}`));
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
  return colonistCandidates;
}

function rerollColonist(index) {
  const current = colonistCandidates[index];
  if (current?.locked) return;
  const rerollCount = (current?.rerollCount || 0) + 1;
  const next = createColonistCandidate(index, newGameConfig, `${newGameConfig.seed}-reroll-${index}-${rerollCount}`);
  next.rerollCount = rerollCount;
  colonistCandidates[index] = next;
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function rerollUnlockedColonists() {
  colonistCandidates = colonistCandidates.map((c, i) => {
    if (c.locked) return c;
    const rerollCount = (c.rerollCount || 0) + 1;
    const next = createColonistCandidate(i, newGameConfig, `${newGameConfig.seed}-reroll-all-${i}-${rerollCount}`);
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
