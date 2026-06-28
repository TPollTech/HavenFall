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

function characterBuilderCard(c, i) {
  const remaining = Number(c.pointsRemaining ?? CharacterBuilder.remainingPointsFor(c.skills));
  const valid = remaining >= 0;
  const presetOptions = Object.entries(CHARACTER_CLASS_PRESETS)
    .map(([key, preset]) => `<option value="${key}" ${c.presetId === key ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`)
    .join('') + `<option value="custom" ${c.presetId === 'custom' ? 'selected' : ''}>Personalizado</option>`;
  const positiveOptions = traitOptions('positive', c.positiveTraitIds?.[0]);
  const negativeOptions = traitOptions('negative', c.negativeTraitIds?.[0]);
  const roleOptions = COLONIST_ROLES.map(role => `<option value="${escapeHtml(role)}" ${c.role === role ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('');
  const workOptions = Object.entries(colonistWorkPreferenceDefs).map(([key, def]) => `<option value="${key}" ${c.workPreferenceId === key ? 'selected' : ''}>${escapeHtml(def.label)}</option>`).join('');
  const spriteOptions = COLONIST_SPRITES.map(sprite => `<option value="${sprite}" ${c.sprite === sprite ? 'selected' : ''}>${sprite.replace('colonist', 'Modelo ')}</option>`).join('');
  const used = c.pointsUsed || CharacterBuilder.usedPointsFor(c.skills);

  return `<article class="colonist-card builder-card bio-dossier-card ${valid ? '' : 'invalid'}" data-builder-index="${i}">
    <div class="bio-dossier-header">
      <div class="bio-file-id">
        <span>BIO-DOSSIER</span>
        <b>HF-INTAKE-${String(i + 1).padStart(2, '0')}</b>
      </div>
      <div class="bio-status ${valid ? 'ok' : 'danger'}">${valid ? 'TRIAGEM ATIVA' : 'POOL INVÁLIDO'}</div>
    </div>

    <div class="bio-dossier-body">
      <aside class="bio-candidate-file">
        <div class="bio-scan-frame">
          <div class="bio-scan-lines" aria-hidden="true"></div>
          <img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt="">
        </div>
        <input class="builder-name-input bio-name-input" value="${escapeHtml(c.name)}" maxlength="18" data-builder-field="name" data-builder-index="${i}" aria-label="Nome do colono">
        <div class="bio-candidate-meta">
          <span>${escapeHtml(c.role || 'Candidato')}</span>
          <span>${escapeHtml(workPreferenceLabel(c.workPreferenceId || c.workPreference))}</span>
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
      </section>

      <section class="bio-controls-panel">
        <div class="builder-select-grid bio-select-grid">
          <label>Classe rápida<select data-builder-preset="${i}">${presetOptions}</select></label>
          <label>Papel<select data-builder-field="role" data-builder-index="${i}">${roleOptions}</select></label>
          <label>Preferência<select data-builder-field="workPreferenceId" data-builder-index="${i}">${workOptions}</select></label>
          <label>Visual<select data-builder-field="sprite" data-builder-index="${i}">${spriteOptions}</select></label>
          <label>Traço positivo<select data-builder-field="positiveTraitId" data-builder-index="${i}">${positiveOptions}</select></label>
          <label>Traço negativo<select data-builder-field="negativeTraitId" data-builder-index="${i}">${negativeOptions}</select></label>
        </div>
        <div class="builder-skills bio-skill-console">${COLONIST_SKILL_KEYS.map(key => builderSkillRow(c, i, key)).join('')}</div>
      </section>
    </div>

    <div class="builder-summary bio-dossier-footer ${valid ? '' : 'danger'}">PROTOCOLO HF-RECRUIT · Pool ${used}/${CHARACTER_BUILDER_POINTS} · mínimo ${CHARACTER_BUILDER_MIN_SKILL}, máximo ${CHARACTER_BUILDER_MAX_SKILL} por competência.</div>
  </article>`;
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
  if (bestValue >= 7) return `Alta aptidão para ${bestLabel.toLowerCase()} detectada.`;
  if (weakValue <= 2) return `Lacuna crítica em ${weakLabel.toLowerCase()} registrada.`;
  return `Perfil estável com tendência para ${bestLabel.toLowerCase()}.`;
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