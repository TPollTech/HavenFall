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
