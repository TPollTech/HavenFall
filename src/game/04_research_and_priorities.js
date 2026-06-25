'use strict';

function makeResearchState() {
  return {
    unlocked: {},
    current: researchOrder[0],
    progress: 0,
    completed: []
  };
}

function ensureResearchState() {
  if (!state.research) state.research = makeResearchState();
  state.research.unlocked = state.research.unlocked || {};
  state.research.completed = state.research.completed || [];
  if (!state.research.current || state.research.unlocked[state.research.current]) state.research.current = nextResearchKey();
  state.research.progress = state.research.progress || 0;
}

function nextResearchKey() {
  return researchOrder.find(key => !state.research?.unlocked?.[key]) || null;
}

function isBuildUnlocked(buildKey) {
  const def = buildDefs[buildKey];
  return !def?.requires || !!state.research?.unlocked?.[def.requires];
}

function unlockResearch(key) {
  const def = researchDefs[key];
  if (!def) return;
  state.research.unlocked[key] = true;
  if (!state.research.completed.includes(key)) state.research.completed.push(key);
  state.research.progress = 0;
  state.research.current = nextResearchKey();
  const unlockedNames = def.unlocks.map(k => buildDefs[k]?.label || k).join(', ');
  log(`Pesquisa concluída: ${def.label}. Desbloqueado: ${unlockedNames}.`);
}

function defaultPriorityForRole(role) {
  if (role === 'Coletora') return 'gather';
  if (role === 'Construtor') return 'build';
  return 'defense';
}

function roleBonusText(c) {
  if (c.role === 'Coletora') return '+25% em coleta';
  if (c.role === 'Construtor') return '+25% em construção';
  if (c.role === 'Faz-tudo') return '+10% em tarefas gerais';
  return 'sem bônus';
}

function workRate(c, kind) {
  let rate = 1;
  if (c.role === 'Coletora' && kind === 'gather') rate += 0.25;
  if (c.role === 'Construtor' && kind === 'build') rate += 0.25;
  if (c.role === 'Faz-tudo' && ['gather','build','research','forge','cook','heal','defense'].includes(kind)) rate += 0.10;
  if (c.priority === 'build' && kind === 'build') rate += 0.10;
  if (c.priority === 'gather' && kind === 'gather') rate += 0.10;
  if (c.priority === 'defense' && kind === 'defense') rate += 0.10;
  return rate;
}

function ensureColonistMeta(c) {
  if (!priorityDefs[c.priority]) c.priority = defaultPriorityForRole(c.role);
  c.path = c.path || [];
  c.px = c.px ?? c.x * TILE + TILE / 2;
  c.py = c.py ?? c.y * TILE + TILE / 2;
  c.note = c.note || 'Ocioso';
  c.work = c.work || 0;
}

function makeColonist(id, name, sprite, x, y, role) {
  return {
    id, name, role, sprite,
    x, y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2,
    dir: 'down', frame: 0, anim: 0,
    hunger: 78 + Math.random() * 10,
    energy: 82 + Math.random() * 8,
    mood: 76 + Math.random() * 12,
    health: 100,
    priority: defaultPriorityForRole(role),
    task: null,
    path: [],
    work: 0,
    note: 'Ocioso'
  };
}
