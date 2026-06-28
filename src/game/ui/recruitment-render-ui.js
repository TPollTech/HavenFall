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
    const cards = colonistCandidates.map((c, i) => characterBuilderCard(c, i)).join('');
    const coverage = typeof renderRecruitmentCoveragePanel === 'function' ? renderRecruitmentCoveragePanel() : '';
    dom.colonistCards.innerHTML = `${cards}${coverage}`;
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
