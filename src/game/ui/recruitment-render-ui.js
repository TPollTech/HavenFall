'use strict';

function renderColonistSelection() {
  if (!dom.colonistCards) return;

  if (typeof characterBuilderCard === 'function') {
    const validation = typeof validateColonistBuilders === 'function' ? validateColonistBuilders() : { ok: true };
    if (dom.buttons?.startSelectedGame) {
      dom.buttons.startSelectedGame.disabled = !validation.ok;
      dom.buttons.startSelectedGame.title = validation.ok ? 'Iniciar com estes colonos.' : 'Corrija a distribuição de pontos antes de iniciar.';
    }
    if (dom.buttons?.rerollAll) dom.buttons.rerollAll.hidden = true;

    if (!colonistCandidates.length) {
      dom.colonistCards.innerHTML = '<div class="empty">Nenhum candidato disponível.</div>';
      return;
    }

    if (typeof activeRecruitmentCandidateIndex === 'number') {
      activeRecruitmentCandidateIndex = Math.max(0, Math.min(colonistCandidates.length - 1, activeRecruitmentCandidateIndex));
    }
    const activeIndex = typeof activeRecruitmentCandidateIndex === 'number' ? activeRecruitmentCandidateIndex : 0;
    const activeCandidate = colonistCandidates[activeIndex];
    const files = colonistCandidates.map((c, i) => {
      const remaining = Number(c.pointsRemaining ?? CharacterBuilder.remainingPointsFor(c.skills));
      const valid = remaining >= 0;
      return personnelFileCard(c, i, valid, remaining).replace('personnel-file-card', `personnel-file-card ${i === activeIndex ? 'active' : ''}`);
    }).join('');
    const dossier = characterBuilderCard(activeCandidate, activeIndex);
    const coverage = typeof renderRecruitmentCoveragePanel === 'function' ? renderRecruitmentCoveragePanel() : '';

    dom.colonistCards.innerHTML = `<div class="personnel-files-column"><div class="personnel-files-title"><span>EQUIPE INICIAL</span><b>${colonistCandidates.length} colono${colonistCandidates.length === 1 ? '' : 's'}</b></div>${files}</div><div class="dossier-stage">${dossier}</div>${coverage}`;
    return;
  }

  dom.colonistCards.innerHTML = colonistCandidates.map((c, i) => `
    <article class="colonist-card ${c.locked ? 'locked' : ''}">
      <div class="colonist-head"><div class="colonist-preview"><img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt=""></div><div><h2>${escapeHtml(c.name)}, ${c.age}</h2><div class="empty">${escapeHtml(c.role)} · Prefere ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</div></div></div>
      <div class="tags">${colonistTraitTags(c.physicalTraitIds, 'physical')}${colonistTraitTags(c.positiveTraitIds, 'positive', '+ ', 'good')}${colonistTraitTags(c.negativeTraitIds, 'negative', '- ', 'bad')}</div>
      <div class="empty">Habilidades: coleta ${c.skills.coleta}, construção ${c.skills.construcao}, defesa ${c.skills.defesa}, pesquisa ${c.skills.pesquisa}, medicina ${c.skills.medicina}</div>
      <div class="empty">Necessidades: comida ${c.needs.hunger}%, energia ${c.needs.energy}%, humor ${c.needs.mood}%, saúde ${c.needs.health}%</div>
    </article>`).join('');
}
