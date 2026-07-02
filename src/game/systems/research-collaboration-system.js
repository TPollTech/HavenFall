'use strict';

(() => {
  if (window.HavenfallContext?.researchCollaborationInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.researchCollaborationInstalled = true;

  function activeResearchersForCurrentTech() {
    const current = state?.research?.current;
    if (!current || !Array.isArray(state?.colonists)) return 0;
    return state.colonists.filter(c => c?.task?.type === 'research' && c.health > 0).length;
  }

  function collaborationMultiplier(count) {
    const researchers = Math.max(1, Number(count || 1));
    const extra = researchers - 1;
    return 1 + Math.min(extra, 4) * 0.22 + Math.max(0, extra - 4) * 0.08;
  }

  function handleResearchTask(c, task, tick) {
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
    const teamRate = collaborationMultiplier(researchers);
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

  window.HavenfallResearchCollaboration = Object.freeze({
    activeResearchersForCurrentTech,
    collaborationMultiplier,
    handleResearchTask
  });

  window.GameSystems?.registerTaskHandler('research', 'research.collaboration', handleResearchTask, { order: 12 });
})();
