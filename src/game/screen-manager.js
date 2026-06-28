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

  return `<article class="colonist-card builder-card ${valid ? '' : 'invalid'}" data-builder-index="${i}">
    <div class="colonist-head builder-head">
      <div class="colonist-preview"><img src="${uiSpriteSrc(`${c.sprite}_down_0`)}" alt=""></div>
      <div class="builder-title-block">
        <input class="builder-name-input" value="${escapeHtml(c.name)}" maxlength="18" data-builder-field="name" data-builder-index="${i}" aria-label="Nome do colono">
        <div class="builder-points ${remaining < 0 ? 'danger' : remaining > 0 ? 'warn' : 'ok'}">${remaining} ponto${Math.abs(remaining) === 1 ? '' : 's'} restante${Math.abs(remaining) === 1 ? '' : 's'}</div>
      </div>
    </div>
    <div class="builder-select-grid">
      <label>Classe rápida<select data-builder-preset="${i}">${presetOptions}</select></label>
      <label>Papel<select data-builder-field="role" data-builder-index="${i}">${roleOptions}</select></label>
      <label>Preferência<select data-builder-field="workPreferenceId" data-builder-index="${i}">${workOptions}</select></label>
      <label>Visual<select data-builder-field="sprite" data-builder-index="${i}">${spriteOptions}</select></label>
      <label>Traço positivo<select data-builder-field="positiveTraitId" data-builder-index="${i}">${positiveOptions}</select></label>
      <label>Traço negativo<select data-builder-field="negativeTraitId" data-builder-index="${i}">${negativeOptions}</select></label>
    </div>
    <div class="builder-skills">${COLONIST_SKILL_KEYS.map(key => builderSkillRow(c, i, key)).join('')}</div>
    <div class="builder-summary ${valid ? '' : 'danger'}">Pool: ${c.pointsUsed || CharacterBuilder.usedPointsFor(c.skills)}/${CHARACTER_BUILDER_POINTS} · mínimo ${CHARACTER_BUILDER_MIN_SKILL}, máximo ${CHARACTER_BUILDER_MAX_SKILL} por habilidade.</div>
  </article>`;
}

function builderSkillRow(c, index, key) {
  const value = Number(c.skills?.[key] || 1);
  const remaining = Number(c.pointsRemaining ?? 0);
  const canDec = value > CHARACTER_BUILDER_MIN_SKILL;
  const canInc = value < CHARACTER_BUILDER_MAX_SKILL && remaining > 0;
  const pct = Math.round((value / CHARACTER_BUILDER_MAX_SKILL) * 100);
  return `<div class="builder-skill-row">
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