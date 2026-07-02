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
  farming: { label: 'Agricultura', priority: 'farming' },
  crafting: { label: 'Artesanato', priority: 'crafting' },
  research: { label: 'Pesquisa', priority: 'research' },
  cooking: { label: 'Culinária', priority: null },
  medicine: { label: 'Medicina', priority: null }
});

const COLONIST_FIRST_NAMES = Object.freeze(['Lia','Téo','Nico','Bia','Gael','Mira','Davi','Luma','Caio','Iris','Noa','Eva','Ravi','Mila','Otto','Nina']);
const COLONIST_ROLES = Object.freeze(['Coletor', 'Construtor', 'Generalista']);
const COLONIST_SPRITES = Object.freeze(['colonistA', 'colonistB', 'colonistC']);
const COLONIST_SKILL_KEYS = Object.freeze(['coleta', 'construcao', 'defesa', 'pesquisa', 'medicina']);
const COLONIST_SKILL_LABELS = Object.freeze({ coleta: 'Coleta', construcao: 'Construção', defesa: 'Defesa', pesquisa: 'Pesquisa', medicina: 'Medicina' });
const CHARACTER_BUILDER_POINTS = 20;
const CHARACTER_BUILDER_MIN_SKILL = 1;
const CHARACTER_BUILDER_MAX_SKILL = 8;

const CHARACTER_CLASS_PRESETS = Object.freeze({
  balanced: { label: 'Sobrevivente', role: 'Generalista', workPreferenceId: 'gather', skills: { coleta: 4, construcao: 4, defesa: 4, pesquisa: 4, medicina: 4 }, positive: 'calm', negative: 'stubborn' },
  lumberjack: { label: 'Coletor', role: 'Coletor', workPreferenceId: 'gather', skills: { coleta: 8, construcao: 4, defesa: 3, pesquisa: 2, medicina: 3 }, positive: 'organized', negative: 'impatient' },
  builder: { label: 'Construtor', role: 'Construtor', workPreferenceId: 'build', skills: { coleta: 3, construcao: 8, defesa: 3, pesquisa: 3, medicina: 3 }, positive: 'focused', negative: 'stubborn' },
  guard: { label: 'Guarda', role: 'Generalista', workPreferenceId: 'defense', skills: { coleta: 3, construcao: 3, defesa: 8, pesquisa: 2, medicina: 4 }, positive: 'brave', negative: 'fearful' },
  researcher: { label: 'Pesquisador', role: 'Generalista', workPreferenceId: 'research', skills: { coleta: 2, construcao: 3, defesa: 2, pesquisa: 8, medicina: 5 }, positive: 'curious', negative: 'distracted' },
  medic: { label: 'Médico', role: 'Generalista', workPreferenceId: 'medicine', skills: { coleta: 2, construcao: 3, defesa: 3, pesquisa: 4, medicina: 8 }, positive: 'patient', negative: 'pessimistic' }
});
const STARTING_PRESET_ORDER = Object.freeze(['lumberjack', 'builder', 'guard', 'researcher', 'medic', 'balanced', 'balanced', 'balanced']);

const TRAIT_KEYS_CACHE = Object.freeze({
  physical: Object.freeze(Object.keys(colonistTraitDefs.physical)),
  positive: Object.freeze(Object.keys(colonistTraitDefs.positive)),
  negative: Object.freeze(Object.keys(colonistTraitDefs.negative)),
  workPrefs: Object.freeze(Object.keys(colonistWorkPreferenceDefs))
});

class CharacterBuilder {
  constructor(index = 0, config = defaultNewGameConfig, data = {}) {
    const preset = CHARACTER_CLASS_PRESETS[data.presetId] || CHARACTER_CLASS_PRESETS.balanced;
    const seed = `${config?.seed || 'default-seed'}-builder-${index}`;
    const nameIndex = typeof hashSeed === 'function' ? hashSeed(seed) % COLONIST_FIRST_NAMES.length : index % COLONIST_FIRST_NAMES.length;
    this.index = index;
    this.setupId = data.setupId || `builder_${index}_${nameIndex}`;
    this.presetId = data.presetId || 'balanced';
    this.name = data.name || COLONIST_FIRST_NAMES[(nameIndex + index) % COLONIST_FIRST_NAMES.length];
    this.age = Number(data.age || 22 + (index * 3) % 26);
    this.sprite = data.sprite || COLONIST_SPRITES[index % COLONIST_SPRITES.length];
    this.role = data.role || preset.role || 'Generalista';
    this.workPreferenceId = data.workPreferenceId || preset.workPreferenceId || 'gather';
    this.physicalTraitIds = Array.isArray(data.physicalTraitIds) && data.physicalTraitIds.length ? data.physicalTraitIds.slice(0, 2) : ['resilient'];
    this.positiveTraitIds = Array.isArray(data.positiveTraitIds) && data.positiveTraitIds.length ? data.positiveTraitIds.slice(0, 1) : [preset.positive || 'calm'];
    this.negativeTraitIds = Array.isArray(data.negativeTraitIds) && data.negativeTraitIds.length ? data.negativeTraitIds.slice(0, 1) : [preset.negative || 'stubborn'];
    this.skills = CharacterBuilder.normalizeSkills(data.skills || preset.skills || CHARACTER_CLASS_PRESETS.balanced.skills);
    this.needs = data.needs || { hunger: 82, energy: 82, mood: 78, health: 94 };
  }

  static normalizeSkills(skills = {}) {
    const out = {};
    for (const key of COLONIST_SKILL_KEYS) {
      out[key] = Math.max(CHARACTER_BUILDER_MIN_SKILL, Math.min(CHARACTER_BUILDER_MAX_SKILL, Number(skills[key] ?? CHARACTER_BUILDER_MIN_SKILL)));
    }
    return out;
  }

  static usedPointsFor(skills = {}) {
    const normalized = CharacterBuilder.normalizeSkills(skills);
    return COLONIST_SKILL_KEYS.reduce((sum, key) => sum + Number(normalized[key] || 0), 0);
  }

  static remainingPointsFor(skills = {}) {
    return CHARACTER_BUILDER_POINTS - CharacterBuilder.usedPointsFor(skills);
  }

  static fromCandidate(candidate, index = 0, config = defaultNewGameConfig) {
    return new CharacterBuilder(index, config, candidate || {});
  }

  applyPreset(presetId) {
    const preset = CHARACTER_CLASS_PRESETS[presetId] || CHARACTER_CLASS_PRESETS.balanced;
    this.presetId = presetId in CHARACTER_CLASS_PRESETS ? presetId : 'balanced';
    this.role = preset.role || this.role;
    this.workPreferenceId = preset.workPreferenceId || this.workPreferenceId;
    this.skills = CharacterBuilder.normalizeSkills(preset.skills);
    this.positiveTraitIds = [preset.positive || this.positiveTraitIds[0] || 'calm'];
    this.negativeTraitIds = [preset.negative || this.negativeTraitIds[0] || 'stubborn'];
    return this;
  }

  adjustSkill(key, delta) {
    if (!COLONIST_SKILL_KEYS.includes(key)) return false;
    const next = Math.max(CHARACTER_BUILDER_MIN_SKILL, Math.min(CHARACTER_BUILDER_MAX_SKILL, Number(this.skills[key] || 1) + Number(delta || 0)));
    if (next === this.skills[key]) return false;
    const copy = { ...this.skills, [key]: next };
    if (CharacterBuilder.remainingPointsFor(copy) < 0) return false;
    this.skills = copy;
    this.presetId = 'custom';
    return true;
  }

  updateField(field, value) {
    if (field === 'name') this.name = String(value || '').slice(0, 18) || this.name;
    if (field === 'role' && COLONIST_ROLES.includes(value)) this.role = value;
    if (field === 'sprite' && COLONIST_SPRITES.includes(value)) this.sprite = value;
    if (field === 'workPreferenceId' && colonistWorkPreferenceDefs[value]) this.workPreferenceId = value;
    if (field === 'positiveTraitId' && colonistTraitDefs.positive[value]) this.positiveTraitIds = [value];
    if (field === 'negativeTraitId' && colonistTraitDefs.negative[value]) this.negativeTraitIds = [value];
    this.presetId = field === 'presetId' ? this.presetId : 'custom';
    return this;
  }

  validate() {
    const remaining = CharacterBuilder.remainingPointsFor(this.skills);
    const validSkills = COLONIST_SKILL_KEYS.every(key => this.skills[key] >= CHARACTER_BUILDER_MIN_SKILL && this.skills[key] <= CHARACTER_BUILDER_MAX_SKILL);
    return { ok: validSkills && remaining >= 0, remaining, used: CharacterBuilder.usedPointsFor(this.skills) };
  }

  toCandidate() {
    const positiveTraitIds = this.positiveTraitIds.slice(0, 1);
    const negativeTraitIds = this.negativeTraitIds.slice(0, 1);
    const physicalTraitIds = this.physicalTraitIds.slice(0, 2);
    const validation = this.validate();
    return {
      setupId: this.setupId,
      builderMode: true,
      presetId: this.presetId,
      name: this.name,
      age: this.age,
      sprite: this.sprite,
      role: this.role,
      physicalTraitIds,
      positiveTraitIds,
      negativeTraitIds,
      physicalTraits: physicalTraitIds.map(id => colonistTraitLabel('physical', id)),
      positiveTraits: positiveTraitIds.map(id => colonistTraitLabel('positive', id)),
      negativeTraits: negativeTraitIds.map(id => colonistTraitLabel('negative', id)),
      skills: { ...this.skills },
      pointsUsed: validation.used,
      pointsRemaining: validation.remaining,
      valid: validation.ok,
      workPreferenceId: this.workPreferenceId,
      workPreference: workPreferenceLabel(this.workPreferenceId),
      needs: { ...this.needs }
    };
  }
}

function randomFrom(list, rand) {
  return list[Math.floor(rand() * list.length)];
}

function createColonistCandidate(index, config, forceSeed = null) {
  const seed = forceSeed || `${config?.seed || 'default-seed'}-candidate-${index}`;
  const rand = typeof seededRandom === 'function' ? seededRandom(seed) : Math.random;
  const candidate = new CharacterBuilder(index, config).toCandidate();
  candidate.name = randomFrom(COLONIST_FIRST_NAMES, rand);
  candidate.age = 18 + Math.floor(rand() * 38);
  candidate.sprite = COLONIST_SPRITES[index % COLONIST_SPRITES.length];
  return candidate;
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
  const count = typeof clampColonistCount === 'function'
    ? clampColonistCount(config?.colonistCount || defaultNewGameConfig.colonistCount || 3)
    : Math.max(1, Number(config?.colonistCount || defaultNewGameConfig.colonistCount || 3));
  const usedNames = new Set();
  colonistCandidates = Array.from({ length: count }, (_, i) => {
    const presetId = STARTING_PRESET_ORDER[i % STARTING_PRESET_ORDER.length] || 'balanced';
    const candidate = new CharacterBuilder(i, config, { presetId }).applyPreset(presetId).toCandidate();
    candidate.name = uniqueColonistName(candidate.name, usedNames, i);
    usedNames.add(candidate.name.toLowerCase());
    return candidate;
  });
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
  return colonistCandidates;
}

function uniqueColonistName(name, usedNames, index) {
  const base = String(name || COLONIST_FIRST_NAMES[index % COLONIST_FIRST_NAMES.length]).trim() || `Colono ${index + 1}`;
  if (!usedNames.has(base.toLowerCase())) return base;
  for (const alt of COLONIST_FIRST_NAMES) {
    if (!usedNames.has(alt.toLowerCase())) return alt;
  }
  return `${base} ${index + 1}`;
}

function updateColonistBuilderSkill(index, skill, delta) {
  const builder = CharacterBuilder.fromCandidate(colonistCandidates[index], index, newGameConfig || defaultNewGameConfig);
  builder.adjustSkill(skill, delta);
  colonistCandidates[index] = builder.toCandidate();
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function applyColonistBuilderPreset(index, presetId) {
  const builder = CharacterBuilder.fromCandidate(colonistCandidates[index], index, newGameConfig || defaultNewGameConfig);
  builder.applyPreset(presetId);
  colonistCandidates[index] = builder.toCandidate();
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function updateColonistBuilderField(index, field, value) {
  const builder = CharacterBuilder.fromCandidate(colonistCandidates[index], index, newGameConfig || defaultNewGameConfig);
  builder.updateField(field, value);
  colonistCandidates[index] = builder.toCandidate();
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function validateColonistBuilders() {
  const list = colonistCandidates || [];
  const invalid = list.filter(c => CharacterBuilder.fromCandidate(c).validate().ok === false);
  return { ok: list.length > 0 && invalid.length === 0, invalidCount: invalid.length };
}

function rerollColonist(index) {
  applyColonistBuilderPreset(index, 'balanced');
}

function rerollUnlockedColonists() {
  colonistCandidates = (colonistCandidates || []).map((c, i) => new CharacterBuilder(i, newGameConfig || defaultNewGameConfig).toCandidate());
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function candidateToColonist(candidate, id, x, y) {
  const builderCandidate = CharacterBuilder.fromCandidate(candidate, id - 1, newGameConfig || defaultNewGameConfig).toCandidate();
  const c = makeColonist(id, builderCandidate.name, builderCandidate.sprite, x, y, builderCandidate.role);
  const workPreferenceId = builderCandidate.workPreferenceId || legacyWorkPreferenceId(builderCandidate.workPreference);
  c.age = builderCandidate.age;
  c.appearance = builderCandidate.sprite;
  c.physicalTraitIds = builderCandidate.physicalTraitIds || [];
  c.positiveTraitIds = builderCandidate.positiveTraitIds || [];
  c.negativeTraitIds = builderCandidate.negativeTraitIds || [];
  c.physicalTraits = builderCandidate.physicalTraits || c.physicalTraitIds.map(t => colonistTraitLabel('physical', t));
  c.positiveTraits = builderCandidate.positiveTraits || c.positiveTraitIds.map(t => colonistTraitLabel('positive', t));
  c.negativeTraits = builderCandidate.negativeTraits || c.negativeTraitIds.map(t => colonistTraitLabel('negative', t));
  c.skills = builderCandidate.skills;
  c.workPreferenceId = workPreferenceId;
  c.workPreference = workPreferenceLabel(workPreferenceId);
  c.hunger = builderCandidate.needs.hunger;
  c.energy = builderCandidate.needs.energy;
  c.mood = builderCandidate.needs.mood;
  c.health = builderCandidate.needs.health;
  c.priority = priorityFromWorkPreference(workPreferenceId, builderCandidate.role);
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
