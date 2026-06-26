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
  if (!state.research.current || state.research.unlocked[state.research.current] || !isResearchAvailable(state.research.current)) state.research.current = nextResearchKey();
  state.research.progress = state.research.progress || 0;
}

function isResearched(key) {
  return !!state?.research?.unlocked?.[key];
}

function isResearchAvailable(key) {
  const def = researchDefs[key];
  if (!def) return false;
  const requires = Array.isArray(def.requires) ? def.requires : def.requires ? [def.requires] : [];
  return requires.every(req => isResearched(req));
}

function nextResearchKey() {
  return researchOrder.find(key => !state.research?.unlocked?.[key] && isResearchAvailable(key)) || null;
}

function isBuildUnlocked(buildKey) {
  const def = buildDefs[buildKey];
  return !def?.requires || isResearched(def.requires);
}

function unlockResearch(key) {
  const def = researchDefs[key];
  if (!def) return;
  state.research.unlocked[key] = true;
  if (!state.research.completed.includes(key)) state.research.completed.push(key);
  state.research.progress = 0;
  state.research.current = nextResearchKey();
  const unlocks = Array.isArray(def.unlocks) ? def.unlocks : [];
  const unlockedNames = unlocks.map(k => buildDefs[k]?.label || itemDefs[k]?.label || zoneDefs?.[k]?.label || k).join(', ') || 'novas opções';
  log(`Pesquisa concluída: ${def.label}. Desbloqueado: ${unlockedNames}.`);
}

window.isResearched = isResearched;
