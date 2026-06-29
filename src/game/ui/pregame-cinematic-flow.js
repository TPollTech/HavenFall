'use strict';

(() => {
  if (window.HavenfallContext?.pregameCinematicFlowInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.pregameCinematicFlowInstalled = true;

  const BRIEFING_SCREEN = 'EXPEDITION_BRIEFING';

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  }

  function label(value, map, fallback = value) {
    return map[value] || fallback || value;
  }

  function mapSizeLabel(value) {
    return typeof labelMapSize === 'function' ? labelMapSize(value) : label(value, {
      large: 'grande', huge: 'enorme', giant: 'gigante', infinite_chunks: 'infinito por chunks'
    });
  }

  function difficultyLabel(value) {
    return typeof labelDifficulty === 'function' ? labelDifficulty(value) : label(value, {
      easy: 'Fácil', normal: 'Normal', hard: 'Difícil', hardcore: 'Hardcore'
    });
  }

  function eventLabel(value) {
    return typeof labelEventIntensity === 'function' ? labelEventIntensity(value) : label(value, {
      low: 'baixa', normal: 'normal', high: 'alta'
    });
  }

  function resourcesLabel(value) {
    return typeof labelResourcesPreset === 'function' ? labelResourcesPreset(value) : label(value, {
      scarce: 'escassos', standard: 'padrão', rich: 'abundantes'
    });
  }

  function readConfig() {
    const fallback = typeof defaultNewGameConfig !== 'undefined' ? defaultNewGameConfig : {};
    const base = (typeof newGameConfig !== 'undefined' && newGameConfig)
      || (typeof readNewGameConfigSafe === 'function' ? readNewGameConfigSafe() : fallback);
    const cfg = typeof ensurePlanetScanOnConfig === 'function' ? ensurePlanetScanOnConfig(base) : base;
    if (typeof newGameConfig !== 'undefined') newGameConfig = cfg;
    return cfg;
  }

  function sectorId(config) {
    const profile = config?.planetScan;
    if (profile?.sectorId) return profile.sectorId;
    const hash = typeof hashSeed === 'function' ? hashSeed(config?.seed || 'scan') : Math.floor(Math.random() * 99999);
    return `HV-${String(hash).slice(0, 5).toUpperCase()}`;
  }

  function dominantBiome(config) {
    const biome = config?.planetScan?.dominantBiome || config?.selectedLandingSite?.biomes?.primary || 'forest';
    return ({ forest: 'Floresta', desert: 'Deserto', snow: 'Neve', rock: 'Rochoso', water: 'Bacia hídrica' })[biome] || biome;
  }

  function skillLabel(key) {
    const labels = typeof COLONIST_SKILL_LABELS !== 'undefined' ? COLONIST_SKILL_LABELS : null;
    return labels?.[key] || key || 'aptidão';
  }

  function colonistSummary(c, index) {
    const skills = Object.entries(c?.skills || {}).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    const [bestKey, bestValue] = skills[0] || ['coleta', 1];
    const trait = c?.positiveTraitIds?.[0] && typeof colonistTraitLabel === 'function'
      ? colonistTraitLabel('positive', c.positiveTraitIds[0])
      : 'perfil estável';
    return `<div class="expedition-colonist">
      <small>Candidato ${String(index + 1).padStart(2, '0')}</small>
      <b>${esc(c?.name || `Colono ${index + 1}`)}</b>
      <span>${esc(c?.role || 'Sobrevivente')} · ${esc(skillLabel(bestKey))} ${Number(bestValue || 1)}/8 · ${esc(trait)}</span>
    </div>`;
  }

  function stat(labelText, value) {
    return `<div class="expedition-stat"><small>${esc(labelText)}</small><b>${esc(value)}</b></div>`;
  }

  function renderExpeditionBriefing() {
    const root = document.getElementById('expeditionBriefingScreen');
    if (!root) return;
    const cfg = readConfig();
    const candidates = typeof colonistCandidates !== 'undefined' && Array.isArray(colonistCandidates) ? colonistCandidates : [];
    const profile = cfg.planetScan || {};
    const risk = typeof setupRiskLabel === 'function' ? setupRiskLabel(cfg) : { label: 'Moderado', note: 'Expedição equilibrada.' };
    const landing = cfg.selectedLandingSite;

    const stats = [
      stat('Colônia', cfg.colonyName || 'Primeiro Refúgio'),
      stat('Seed', cfg.seed || 'sem seed'),
      stat('Setor', sectorId(cfg)),
      stat('Bioma dominante', dominantBiome(cfg)),
      stat('Dificuldade', difficultyLabel(cfg.difficulty)),
      stat('Mapa', mapSizeLabel(cfg.mapSize)),
      stat('Eventos', eventLabel(cfg.eventIntensity)),
      stat('Suprimentos', resourcesLabel(cfg.resourcesPreset)),
      stat('Risco orbital', risk.label || 'Moderado'),
      stat('Pouso', landing?.name || profile?.landingPriority || 'Local confirmado')
    ].join('');

    const colonists = candidates.length
      ? candidates.slice(0, Number(cfg.colonistCount || candidates.length)).map(colonistSummary).join('')
      : '<div class="expedition-colonist"><small>Equipe</small><b>Nenhum colono gerado</b><span>Volte para seleção e gere a equipe inicial.</span></div>';

    const logs = [
      `Varredura do setor ${sectorId(cfg)} concluída.`,
      `Mapa ${mapSizeLabel(cfg.mapSize)} preparado para pouso.`,
      `${Number(cfg.colonistCount || candidates.length || 0)} colono(s) liberado(s) para a primeira noite.`,
      risk.note || 'Perfil de risco confirmado.'
    ].map(line => `<div class="expedition-log-line"><small>LOG</small><b>${esc(line)}</b></div>`).join('');

    const summary = document.getElementById('expeditionBriefingSummary');
    if (summary) summary.innerHTML = `<div class="expedition-stat-grid">${stats}</div>`;

    const colonistBox = document.getElementById('expeditionBriefingColonists');
    if (colonistBox) colonistBox.innerHTML = colonists;

    const logBox = document.getElementById('expeditionBriefingLog');
    if (logBox) logBox.innerHTML = logs;

    const orbital = document.getElementById('expeditionOrbitalMark');
    if (orbital) orbital.innerHTML = `<div><span>Pouso autorizado</span><b>${esc(sectorId(cfg))}</b></div>`;
  }

  function activateBriefingScreen() {
    previousScreen = appScreen;
    appScreen = BRIEFING_SCREEN;
    if (typeof dom !== 'undefined' && dom?.screens) {
      dom.screens.briefing = document.getElementById('expeditionBriefingScreen');
      Object.entries(dom.screens).forEach(([key, el]) => {
        if (el) el.classList.toggle('active', key === 'briefing');
      });
    }
    if (typeof dom !== 'undefined' && dom.pauseOverlay) dom.pauseOverlay.classList.remove('show');
    if (typeof state !== 'undefined' && state) state.paused = true;
    started = false;
    renderExpeditionBriefing();
  }

  function patchScreenManager() {
    if (typeof setScreen !== 'function' || window.HavenfallContext.pregameSetScreenPatched) return;
    const originalSetScreen = setScreen;
    setScreen = function cinematicSetScreen(screen) {
      const briefing = document.getElementById('expeditionBriefingScreen');
      if (screen === BRIEFING_SCREEN) {
        activateBriefingScreen();
        return;
      }
      if (briefing) briefing.classList.remove('active');
      originalSetScreen(screen);
    };
    window.setScreen = setScreen;
    window.HavenfallContext.pregameSetScreenPatched = true;
  }

  function validRecruitment() {
    const validation = typeof validateColonistBuilders === 'function' ? validateColonistBuilders() : { ok: true };
    if (!validation.ok) {
      if (typeof renderColonistSelection === 'function') renderColonistSelection();
      return false;
    }
    return true;
  }

  function openBriefingFromRecruitment(event) {
    if (!event.target?.closest?.('#startSelectedGameBtn')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!validRecruitment()) return;
    newGameConfig = typeof ensurePlanetScanOnConfig === 'function'
      ? ensurePlanetScanOnConfig(newGameConfig || readNewGameConfig())
      : (newGameConfig || readNewGameConfig());
    renderExpeditionBriefing();
    setScreen(BRIEFING_SCREEN);
  }

  function startFromBriefing(event) {
    const back = event.target?.closest?.('#briefingBackBtn');
    const start = event.target?.closest?.('#briefingStartBtn');
    if (!back && !start) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (back) {
      setScreen(SCREEN.COLONIST_SELECT);
      return;
    }
    if (!validRecruitment()) {
      setScreen(SCREEN.COLONIST_SELECT);
      return;
    }
    const cfg = typeof ensurePlanetScanOnConfig === 'function'
      ? ensurePlanetScanOnConfig(newGameConfig || readNewGameConfig())
      : (newGameConfig || readNewGameConfig());
    startNewGame(cfg, colonistCandidates);
    window.HavenfallRuntime?.markGameplayState?.(state);
    document.getElementById('eventModal')?.classList.remove('show');
  }

  function hideLegacyPregameModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('show');
    }
  }

  patchScreenManager();
  hideLegacyPregameModal();
  document.addEventListener('click', openBriefingFromRecruitment, true);
  document.addEventListener('click', startFromBriefing, true);

  window.HavenfallPregameFlow = Object.freeze({
    BRIEFING_SCREEN,
    renderExpeditionBriefing,
    openBriefing: () => setScreen(BRIEFING_SCREEN)
  });
})();
