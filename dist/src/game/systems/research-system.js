'use strict';

const RESEARCH_TIER_COST_FLOORS = Object.freeze({
  0: 140,
  1: 300,
  2: 560,
  3: 900,
  4: 1280
});

function makeResearchState() {
  return {
    unlocked: {},
    current: null,
    progress: 0,
    completed: []
  };
}

function balancedResearchCost(def) {
  const tier = Math.max(0, Math.min(4, Number(def?.tier || 0)));
  const floor = RESEARCH_TIER_COST_FLOORS[tier] || RESEARCH_TIER_COST_FLOORS[4];
  const original = Math.max(1, Number(def?.cost || 1));
  const scaled = floor + Math.round(original * (tier + 2));
  return Math.max(original, scaled);
}

function normalizeResearchCosts() {
  for (const def of Object.values(researchDefs || {})) {
    if (!def || def._balancedCostApplied) continue;
    def.originalCost = Number(def.cost || 0);
    def.cost = balancedResearchCost(def);
    def._balancedCostApplied = true;
  }
}

function ensureResearchState() {
  if (!state.research) state.research = makeResearchState();
  state.research.unlocked = state.research.unlocked || {};
  state.research.completed = state.research.completed || [];
  state.research.progress = state.research.progress || 0;
  normalizeResearchCosts();

  for (const key of state.research.completed) {
    if (researchDefs[key]) state.research.unlocked[key] = true;
  }

  if (
    !state.research.current ||
    state.research.unlocked[state.research.current] ||
    !isResearchAvailable(state.research.current)
  ) {
    state.research.current = nextResearchKey();
  }
}

function researchRequirements(key) {
  const def = researchDefs[key];
  if (!def) return [];

  const requirements = def.prerequisites || def.requires || [];
  return Array.isArray(requirements) ? requirements : [requirements];
}

function isResearched(key) {
  return !!state?.research?.unlocked?.[key];
}

function isResearchAvailable(key) {
  const def = researchDefs[key];
  if (!def || isResearched(key)) return false;
  return researchRequirements(key).every(req => isResearched(req));
}

function nextResearchKey() {
  return researchOrder.find(key => !state.research?.unlocked?.[key] && isResearchAvailable(key)) || null;
}

function isBuildUnlocked(buildKey) {
  const def = buildDefs[buildKey];
  if (!def?.requires) return true;

  const requirements = Array.isArray(def.requires) ? def.requires : [def.requires];
  return requirements.every(req => isResearched(req));
}

function unlockResearch(key) {
  const def = researchDefs[key];
  if (!def) return;

  state.research.unlocked[key] = true;
  if (!state.research.completed.includes(key)) state.research.completed.push(key);
  state.research.progress = 0;
  state.research.current = nextResearchKey();

  const unlocks = Array.isArray(def.unlocks) ? def.unlocks : [];
  const unlockedNames = unlocks
    .map(k => buildDefs[k]?.label || itemDefs[k]?.label || zoneDefs?.[k]?.label || k)
    .join(', ') || 'novas opções';

  log(`Pesquisa concluída: ${def.label}. Desbloqueado: ${unlockedNames}.`);
}

function activeResearchersForCurrentTech() {
  const current = state?.research?.current;
  if (!current || !Array.isArray(state?.colonists)) return 0;
  return state.colonists.filter(c => c?.task?.type === 'research' && c.health > 0).length;
}

function researchCollaborationMultiplier(count) {
  const researchers = Math.max(1, Number(count || 1));
  const extra = researchers - 1;
  return 1 + Math.min(extra, 4) * 0.22 + Math.max(0, extra - 4) * 0.08;
}

function handleCollaborativeResearchTask(c, task, tick) {
  if (!c || task?.type !== 'research') return false;
  ensureResearchState();
  const desk = state.objects.find(o => o.id === task.objId && o.type === 'research_desk');
  if (!desk) { c.task = null; c.note = 'Ocioso'; return true; }
  const key = state.research.current;
  if (!key) { c.task = null; c.note = 'Todas as pesquisas concluídas'; return true; }
  const def = researchDefs[key];
  if (!def) { c.task = null; c.note = 'Pesquisa inválida'; return true; }

  const researchers = activeResearchersForCurrentTech();
  const weatherPenalty = state.weather === 'chuva' ? 0.9 : 1;
  const personalRate = typeof workRate === 'function' ? workRate(c, 'research') : 1;
  const teamRate = researchCollaborationMultiplier(researchers);
  const gain = tick * 4.5 * weatherPenalty * personalRate * teamRate;

  state.research.progress = clamp((state.research.progress || 0) + gain, 0, def.cost);
  const pct = Math.floor((state.research.progress / def.cost) * 100);
  c.note = researchers > 1
    ? `Pesquisando ${def.label} ${pct}% (${researchers} pesquisadores)`
    : `Pesquisando ${def.label} ${pct}%`;

  if (state.research.progress >= def.cost) {
    unlockResearch(key);
    notifyWorkComplete?.('research', { researchKey: key, researchers }, desk.x, desk.y);
    c.mood = clamp(c.mood + 5, 0, 100);
    c.task = null;
    c.note = 'Pesquisa concluída';
    c.work = 0;
    for (const other of state.colonists || []) {
      if (other !== c && other.task?.type === 'research') {
        other.task = null;
        other.work = 0;
        other.note = 'Pesquisa concluída';
      }
    }
  }
  return true;
}

window.isResearched = isResearched;
window.isResearchAvailable = isResearchAvailable;
window.HavenfallResearch = Object.freeze({
  activeResearchersForCurrentTech,
  collaborationMultiplier: researchCollaborationMultiplier,
  handleCollaborativeResearchTask
});
window.GameSystems?.registerTaskHandler('research', 'research.collaboration', handleCollaborativeResearchTask, { order: 12 });
