'use strict';

function makeResearchState() {
  return {
    unlocked: {},
    current: null,
    progress: 0,
    completed: []
  };
}

function ensureResearchState() {
  if (!state.research) state.research = makeResearchState();
  state.research.unlocked = state.research.unlocked || {};
  state.research.completed = state.research.completed || [];
  state.research.progress = state.research.progress || 0;

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

window.isResearched = isResearched;
window.isResearchAvailable = isResearchAvailable;
