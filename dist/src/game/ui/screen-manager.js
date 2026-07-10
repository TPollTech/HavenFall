'use strict';

const SCREEN_DOM_MAP = Object.freeze({
  [SCREEN.MAIN_MENU]: 'main',
  [SCREEN.NEW_GAME_SETUP]: 'setup',
  [SCREEN.PLANET_SCAN]: 'scan',
  [SCREEN.COLONIST_SELECT]: 'colonists',
  [SCREEN.LOAD_GAME]: 'load',
  [SCREEN.SETTINGS]: 'settings',
  [SCREEN.PLAYING]: 'game',
  [SCREEN.PAUSED]: 'game'
});

let activeRecruitmentCandidateIndex = 0;

function setScreen(screen) {
  previousScreen = appScreen;
  appScreen = screen;
  const activeKey = SCREEN_DOM_MAP[screen];
  Object.entries(dom.screens).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', key === activeKey);
  });
  if (dom.pauseOverlay) dom.pauseOverlay.classList.toggle('show', screen === SCREEN.PAUSED);
  if (state) state.paused = screen !== SCREEN.PLAYING;
  started = screen === SCREEN.PLAYING;
  triggerScreenSideEffects();
}

function triggerScreenSideEffects() {
  if (typeof refreshMenuSaveInfo === 'function') refreshMenuSaveInfo();
  if (typeof refreshLoadScreen === 'function') refreshLoadScreen();
  if (typeof updateSetupSummary === 'function') updateSetupSummary();
  if (appScreen === SCREEN.PLANET_SCAN && typeof refreshPlanetScan === 'function') refreshPlanetScan();
  if (appScreen === SCREEN.COLONIST_SELECT && typeof renderColonistSelection === 'function') renderColonistSelection();
  if (state && typeof updateUI === 'function') updateUI(true);
}

function goBackFromSettings() {
  setScreen(previousScreen === SCREEN.PAUSED || previousScreen === SCREEN.PLAYING ? SCREEN.PAUSED : SCREEN.MAIN_MENU);
}

function selectRecruitmentCandidate(index) {
  const next = Math.max(0, Math.min((colonistCandidates?.length || 1) - 1, Number(index) || 0));
  activeRecruitmentCandidateIndex = next;
  if (typeof renderColonistSelection === 'function') renderColonistSelection();
}

function characterBuilderCard(c, i) {
  if (colonistCandidates?.length && activeRecruitmentCandidateIndex >= colonistCandidates.length) activeRecruitmentCandidateIndex = 0;
  const remaining = Number(c.pointsRemaining ?? CharacterBuilder.remainingPointsFor(c.skills));
  const valid = remaining >= 0;
  if (i !== activeRecruitmentCandidateIndex) return personnelFileCard(c, i, valid, remaining);

  const presetOptions = Object.entries(CHARACTER_CLASS_PRESETS)
    .map(([key, preset]) => `<option value="${key}" ${c.presetId === key ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`)
    .join('') + `<option value="custom" ${c.presetId === 'custom' ? 'selected' : ''}>Personalizado</option>`;
  const positiveOptions = traitOptions('positive', c.positiveTraitIds?.[0]);
  const negativeOptions = traitOptions('negative', c.negativeTraitIds?.[0]);
  const roleOptions = COLONIST_ROLES.map(role => `<option value="${escapeHtml(role)}" ${c.role === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('');
  const workOptions = Object.entries(colonistWorkPreferenceDefs).map(([key, def]) => `<option value="${key}" ${c.workPreferenceId === key ? 'selected' : ''}>${escapeHtml(def.label)}</option>`).join('');
  const spriteOptions = COLONIST_SPRITES.map(sprite => `<option value="${sprite}" ${c.sprite === sprite ? 'selected' : ''}>${sprite.replace('colonist', 'Modelo ')}</option>`).join('');
  const used = c.pointsUsed || CharacterBuilder.usedPointsFor(c.skills);

  return `<article class="colonist-card builder-card bio-dossier-card bio-dossier-active ${valid ? '' : 'invalid'}" data-builder-index="${i}">
    <div class="bio-dossier-header">
      <div class="bio-file-id">
        <span>COLONO SELECIONADO</span>
        <b>CANDIDATO ${String(i + 1).padStart(2, '0')}</b>
      </div>
      <div class="bio-status ${valid ? 'ok' : 'danger'}">${valid ? 'APTO PARA O POUSO' : 'REVISÃO NECESSÁRIA'}</div>
    </div>

    <div class="bio-dossier-body">
      <aside class="bio-candidate-file">
        <div class="bio-scan-frame bio-medical-frame">
          <div class="bio-vital-line" aria-hidden="true"></div>
          <div class="bio-scan-lines" aria-hidden="true"></div>
          ${colonistAvatarHtml(c, 'large')}
        </div>
        <input class="builder-name-input bio-name-input" value="${escapeHtml(c.name)}" maxlength="18" data-builder-field="name" data-builder-index="${i}" aria-label="Nome do colono">
        <div class="bio-candidate-meta">
          <span>${escapeHtml(c.age || '?')} anos · ${escapeHtml(c.role || 'Candidato')}</span>
          <span>Prioridade: ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</span>
          <span>${escapeHtml(bioTraitLine(c))}</span>
        </div>
        <div class="builder-points bio-points ${remaining < 0 ? 'danger' : remaining > 0 ? 'warn' : 'ok'}">${remaining} ponto${Math.abs(remaining) === 1 ? '' : 's'} restante${Math.abs(remaining) === 1 ? '' : 's'}</div>
      </aside>

      <section class="bio-chart-panel">
        <div class="bio-panel-title">
          <span>Matriz de Competência</span>
          <b>${used}/${CHARACTER_BUILDER_POINTS}</b>
        </div>
        ${bioDossierSpiderChart(c)}
        <div class="bio-diagnostic-box">
          <span>Diagnóstico de Aptidão</span>
          <b>${escapeHtml(bioDossierDiagnosis(c))}</b>
        </div>
        ${bioDossierClinicalPanel(c)}
      </section>

      <section class="bio-controls-panel">
        <div class="builder-select-grid bio-select-grid">
          <label>Perfil<select data-builder-preset="${i}">${presetOptions}</select></label>
          <label>Função<select data-builder-field="role" data-builder-index="${i}">${roleOptions}</select></label>
          <label>Prioridade<select data-builder-field="workPreferenceId" data-builder-index="${i}">${workOptions}</select></label>
          <label>Visual<select data-builder-field="sprite" data-builder-index="${i}">${spriteOptions}</select></label>
          <label>Traço positivo<select data-builder-field="positiveTraitId" data-builder-index="${i}">${positiveOptions}</select></label>
          <label>Traço negativo<select data-builder-field="negativeTraitId" data-builder-index="${i}">${negativeOptions}</select></label>
        </div>
        <div class="builder-skills bio-skill-console">${COLONIST_SKILL_KEYS.map(key => builderSkillRow(c, i, key)).join('')}</div>
      </section>
    </div>

    <div class="builder-summary bio-dossier-footer ${valid ? '' : 'danger'}">Pontos de aptidão ${used}/${CHARACTER_BUILDER_POINTS} · mínimo ${CHARACTER_BUILDER_MIN_SKILL}, máximo ${CHARACTER_BUILDER_MAX_SKILL} por competência.</div>
  </article>`;
}

function personnelFileCard(c, i, valid, remaining) {
  const entries = COLONIST_SKILL_KEYS.map(key => [key, Number(c.skills?.[key] || 1)]).sort((a, b) => b[1] - a[1]);
  const [bestKey, bestValue] = entries[0] || ['coleta', 1];
  const bestLabel = COLONIST_SKILL_LABELS[bestKey] || bestKey;
  return `<button type="button" class="colonist-card builder-card personnel-file-card ${valid ? '' : 'invalid'}" data-recruitment-candidate="${i}" aria-label="Abrir arquivo de ${escapeHtml(c.name)}">
    <span class="personnel-file-index">C-${String(i + 1).padStart(2, '0')}</span>
    <span class="personnel-file-avatar">${colonistAvatarHtml(c, 'small')}</span>
    <span class="personnel-file-main">
      <b>${escapeHtml(c.name || `Candidato ${i + 1}`)}</b>
      <small>${escapeHtml(c.role || 'Candidato')} · ${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</small>
      <em><span>${escapeHtml(bestLabel)}</span>${proficiencyMeter(bestValue)}</em>
    </span>
    <span class="personnel-file-status ${valid ? 'ok' : 'danger'}">${valid ? 'APTO' : 'REVISAR'}</span>
    <span class="personnel-file-points ${remaining < 0 ? 'danger' : remaining > 0 ? 'warn' : 'ok'}">${remaining}</span>
  </button>`;
}

function proficiencyMeter(value) {
  const safe = Math.max(1, Math.min(8, Number(value || 1)));
  return `<span class="personnel-prof-meter" title="Proficiência ${safe}/8">${Array.from({ length: 8 }, (_, i) => `<i class="${i < safe ? 'on' : ''}"></i>`).join('')}</span>`;
}

function bioDossierSpiderChart(c) {
  const size = 220;
  const center = size / 2;
  const radius = 74;
  const keys = COLONIST_SKILL_KEYS;
  const angleStep = (Math.PI * 2) / keys.length;
  const max = CHARACTER_BUILDER_MAX_SKILL || 8;

  const axis = keys.map((key, index) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    const labelX = center + Math.cos(angle) * (radius + 24);
    const labelY = center + Math.sin(angle) * (radius + 24);
    const label = String(COLONIST_SKILL_LABELS[key] || key).slice(0, 3).toUpperCase();
    return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"></line><text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}">${escapeHtml(label)}</text>`;
  }).join('');

  const rings = [0.25, 0.5, 0.75, 1].map(level => {
    const points = keys.map((_, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const x = center + Math.cos(angle) * radius * level;
      const y = center + Math.sin(angle) * radius * level;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${points}"></polygon>`;
  }).join('');

  const valuePoints = keys.map((key, index) => {
    const value = Math.max(CHARACTER_BUILDER_MIN_SKILL, Math.min(max, Number(c.skills?.[key] || 1)));
    const angle = -Math.PI / 2 + index * angleStep;
    const scale = value / max;
    const x = center + Math.cos(angle) * radius * scale;
    const y = center + Math.sin(angle) * radius * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `<div class="bio-spider-wrap">
    <svg class="bio-spider-chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="Matriz de competência do candidato">
      <g class="bio-spider-rings">${rings}</g>
      <g class="bio-spider-axis">${axis}</g>
      <polygon class="bio-spider-value" points="${valuePoints}"></polygon>
      <circle class="bio-spider-core" cx="${center}" cy="${center}" r="3"></circle>
    </svg>
  </div>`;
}

function bioDossierDiagnosis(c) {
  const entries = COLONIST_SKILL_KEYS.map(key => [key, Number(c.skills?.[key] || 1)]).sort((a, b) => b[1] - a[1]);
  const [bestKey, bestValue] = entries[0] || ['coleta', 1];
  const [weakKey, weakValue] = entries[entries.length - 1] || ['medicina', 1];
  const bestLabel = COLONIST_SKILL_LABELS[bestKey] || bestKey;
  const weakLabel = COLONIST_SKILL_LABELS[weakKey] || weakKey;
  if (bestValue >= 7) return `Alta aptidão para ${bestLabel.toLowerCase()} detectada. Indicado para assumir tarefas críticas dessa área.`;
  if (weakValue <= 2) return `Lacuna crítica em ${weakLabel.toLowerCase()} registrada. Recomendado compensar com outro membro da equipe.`;
  return `Perfil estável com tendência para ${bestLabel.toLowerCase()}. Bom candidato para equipe generalista.`;
}

function bioDossierClinicalPanel(c) {
  const positive = (c.positiveTraitIds || []).map(id => colonistTraitLabel('positive', id)).join(', ') || 'sem registro';
  const negative = (c.negativeTraitIds || []).map(id => colonistTraitLabel('negative', id)).join(', ') || 'sem alerta';
  const physical = (c.physicalTraitIds || []).map(id => colonistTraitLabel('physical', id)).join(', ') || 'padrão';
  const risk = operationalRiskLevel(c);
  return `<div class="bio-clinical-panel">
    <div><span>Idade</span><b>${escapeHtml(c.age || '?')} anos</b></div>
    <div><span>Condição física</span><b>${escapeHtml(physical)}</b></div>
    <div><span>Traço positivo</span><b>${escapeHtml(positive)}</b></div>
    <div><span>Alerta psicológico</span><b>${escapeHtml(negative)}</b></div>
    <div class="${risk.level}"><span>Risco operacional</span><b>${escapeHtml(risk.label)}</b></div>
  </div>`;
}

function operationalRiskLevel(c) {
  const negative = c.negativeTraitIds?.[0] || '';
  const weakMedicine = Number(c.skills?.medicina || 1) <= 2;
  const weakDefense = Number(c.skills?.defesa || 1) <= 2;
  if (['fearful', 'clumsy', 'distracted', 'pessimistic'].includes(negative) || (weakMedicine && weakDefense)) return { level: 'warn', label: 'atenção' };
  if (['focused', 'calm', 'organized', 'patient'].includes(c.positiveTraitIds?.[0])) return { level: 'ok', label: 'baixo' };
  return { level: 'stable', label: 'moderado' };
}

function bioTraitLine(c) {
  const positive = c.positiveTraitIds?.[0] ? colonistTraitLabel('positive', c.positiveTraitIds[0]) : 'sem traço';
  const negative = c.negativeTraitIds?.[0] ? colonistTraitLabel('negative', c.negativeTraitIds[0]) : 'sem alerta';
  return `Psique: ${positive} / ${negative}`;
}

function builderSkillRow(c, index, key) {
  const value = Number(c.skills?.[key] || 1);
  const remaining = Number(c.pointsRemaining ?? 0);
  const canDec = value > CHARACTER_BUILDER_MIN_SKILL;
  const canInc = value < CHARACTER_BUILDER_MAX_SKILL && remaining > 0;
  const pct = Math.round((value / CHARACTER_BUILDER_MAX_SKILL) * 100);
  return `<div class="builder-skill-row bio-skill-row">
    <span>${escapeHtml(COLONIST_SKILL_LABELS[key] || key)}</span>
    <button type="button" data-builder-skill="${key}" data-builder-index="${index}" data-builder-delta="-1" ${canDec ? '' : 'disabled'}>-</button>
    <div class="builder-skill-bar"><i style="width:${pct}%"></i><b>${value}</b></div>
    <button type="button" data-builder-skill="${key}" data-builder-index="${index}" data-builder-delta="1" ${canInc ? '' : 'disabled'}>+</button>
  </div>`;
}

function traitOptions(kind, selected) {
  return Object.entries(colonistTraitDefs[kind] || {})
    .map(([key, def]) => `<option value="${key}" ${selected === key ? 'selected' : ''}>${escapeHtml(def.label)}</option>`)
    .join('');
}
