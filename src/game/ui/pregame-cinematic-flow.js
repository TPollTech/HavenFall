'use strict';

(() => {
  if (window.HavenfallContext?.pregameCinematicFlowInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.pregameCinematicFlowInstalled = true;

  const STYLE_ID = 'pregame-cinematic-flow-style';
  const DECORATED_ATTR = 'data-pregame-cinematic-ready';
  const BRIEFING_SCREEN = 'EXPEDITION_BRIEFING';

  const PREGAME_STEPS = Object.freeze([
    { id: 'newGameSetupScreen', key: 'setup', number: '01', label: 'Configuração' },
    { id: 'planetScanScreen', key: 'scan', number: '02', label: 'Varredura' },
    { id: 'colonistSelectScreen', key: 'colonists', number: '03', label: 'Tripulação' },
    { id: 'expeditionBriefingScreen', key: 'briefing', number: '04', label: 'Pouso' }
  ]);

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

  function progressMarkup(activeKey) {
    return `<div class="pregame-progress" aria-label="Etapas antes do pouso">${PREGAME_STEPS.map(step => `<span class="${step.key === activeKey ? 'active' : ''}" data-step="${step.number}">${step.label}</span>`).join('')}</div>`;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* HavenFall V1.9F — telas pré-gameplay cinematográficas. */
      .pregame-cinematic-screen.screen {
        position: fixed;
        inset: 0;
        min-height: 100vh;
        padding: 0;
        overflow: hidden;
        background: #05070b;
        color: #f4efe4;
        isolation: isolate;
      }

      .pregame-cinematic-screen.screen.active { display: block; }

      .pregame-atmosphere,
      .pregame-vignette,
      .pregame-scanlines {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .pregame-atmosphere {
        z-index: 0;
        background:
          radial-gradient(circle at 74% 22%, rgba(88, 137, 183, .25), transparent 31%),
          radial-gradient(circle at 18% 82%, rgba(215, 155, 70, .19), transparent 34%),
          linear-gradient(135deg, #07090d 0%, #101621 42%, #06070a 100%);
        transform: scale(1.025);
      }

      .pregame-atmosphere::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(rgba(255,255,255,.026) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.020) 1px, transparent 1px);
        background-size: 72px 72px;
        opacity: .38;
        mask-image: radial-gradient(circle at center, black 0%, transparent 75%);
      }

      .pregame-atmosphere::after {
        content: '';
        position: absolute;
        width: min(62vw, 760px);
        aspect-ratio: 1;
        right: clamp(-220px, -8vw, -80px);
        top: clamp(34px, 8vh, 120px);
        border-radius: 50%;
        border: 1px solid rgba(125, 211, 252, .16);
        box-shadow:
          0 0 0 34px rgba(125, 211, 252, .025),
          0 0 0 82px rgba(215, 155, 70, .020),
          0 0 90px rgba(125, 211, 252, .10),
          inset 0 0 70px rgba(125, 211, 252, .055);
        opacity: .85;
      }

      .pregame-vignette {
        z-index: 1;
        background:
          linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.12) 48%, rgba(0,0,0,.66)),
          radial-gradient(circle at center, transparent 34%, rgba(0,0,0,.82) 100%);
      }

      .pregame-scanlines {
        z-index: 2;
        background: linear-gradient(transparent 48%, rgba(125, 211, 252, .030) 50%, transparent 52%);
        background-size: 100% 7px;
        opacity: .45;
        mix-blend-mode: screen;
      }

      .pregame-progress {
        position: absolute;
        z-index: 7;
        left: clamp(28px, 4vw, 70px);
        right: clamp(28px, 4vw, 70px);
        top: clamp(18px, 3.2vh, 42px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: rgba(230, 236, 245, .58);
        text-transform: uppercase;
        letter-spacing: .16em;
        font-size: 11px;
        font-weight: 950;
      }

      .pregame-progress::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1px;
        background: linear-gradient(90deg, rgba(215,155,70,.55), rgba(125,211,252,.25), rgba(215,155,70,.18));
        opacity: .48;
        z-index: -1;
      }

      .pregame-progress span {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.09);
        background: rgba(5, 8, 13, .66);
        backdrop-filter: blur(12px);
        white-space: nowrap;
      }

      .pregame-progress span::before {
        content: attr(data-step);
        color: rgba(255,216,144,.92);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .pregame-progress span.active {
        color: #fff3df;
        border-color: rgba(215, 155, 70, .48);
        box-shadow: 0 0 28px rgba(215,155,70,.12), inset 0 1px 0 rgba(255,255,255,.08);
      }

      .pregame-cinematic-screen > .menu-card,
      .pregame-cinematic-screen > .planet-scan-shell,
      .pregame-cinematic-screen > .expedition-briefing-shell {
        position: relative !important;
        z-index: 5 !important;
        width: min(1480px, calc(100vw - clamp(28px, 6vw, 92px))) !important;
        min-height: calc(100vh - clamp(88px, 13vh, 132px)) !important;
        max-height: calc(100vh - clamp(88px, 13vh, 132px)) !important;
        margin: clamp(68px, 10vh, 96px) auto clamp(20px, 3vh, 36px) !important;
        padding: clamp(22px, 3.1vw, 52px) !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        overflow: hidden !important;
      }

      .pregame-cinematic-screen .screen-title-row,
      .pregame-cinematic-screen .scan-title-row,
      .pregame-cinematic-screen .expedition-title-row {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
        gap: clamp(16px, 2vw, 30px);
        margin: 0 0 clamp(18px, 2.4vh, 34px) !important;
      }

      .pregame-cinematic-screen .screen-title-row h1,
      .pregame-cinematic-screen .scan-title-row h1,
      .pregame-cinematic-screen .expedition-title-row h1 {
        margin: 0 !important;
        max-width: 980px;
        font-size: clamp(44px, 6.6vw, 104px) !important;
        line-height: .88 !important;
        letter-spacing: -.055em !important;
        text-transform: uppercase;
        color: #f7efe2 !important;
        text-shadow:
          0 2px 0 rgba(255,255,255,.055),
          0 18px 52px rgba(0,0,0,.72),
          0 0 36px rgba(204,147,65,.18);
      }

      .pregame-cinematic-screen .screen-title-row p,
      .pregame-cinematic-screen .scan-title-row p,
      .pregame-cinematic-screen .expedition-title-row p {
        max-width: 760px !important;
        margin: clamp(8px, 1.2vh, 14px) 0 0 !important;
        color: rgba(230, 236, 245, .68) !important;
        font-size: clamp(13px, 1.25vw, 17px);
      }

      .pregame-cinematic-screen .kicker {
        color: #d79b46 !important;
        letter-spacing: .22em;
      }

      .pregame-cinematic-screen .screen-title-row > button,
      .pregame-cinematic-screen .scan-title-row .scan-status-pill,
      .pregame-cinematic-screen .scan-actions button,
      .pregame-cinematic-screen .menu-actions button,
      .pregame-cinematic-screen .expedition-actions button {
        border-color: rgba(215,155,70,.28);
        background: linear-gradient(180deg, rgba(24, 30, 42, .82), rgba(8, 11, 17, .72));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 12px 32px rgba(0,0,0,.22);
        backdrop-filter: blur(12px);
      }

      .pregame-cinematic-screen .menu-actions button:not(.secondary),
      .pregame-cinematic-screen .scan-actions button.primary,
      .pregame-cinematic-screen #setupNextBtn,
      .pregame-cinematic-screen #startSelectedGameBtn,
      .pregame-cinematic-screen #briefingStartBtn {
        border-color: rgba(255, 216, 144, .58) !important;
        background: linear-gradient(180deg, rgba(215,155,70,.34), rgba(104,63,20,.42)) !important;
        color: #fff7e6 !important;
      }

      .pregame-cinematic-screen .setup-layout {
        position: relative;
        z-index: 2;
        grid-template-columns: minmax(0, 1.18fr) minmax(340px, .82fr) !important;
        gap: clamp(18px, 2.4vw, 34px) !important;
        align-items: stretch;
      }

      .pregame-cinematic-screen .setup-section,
      .pregame-cinematic-screen .setup-briefing-panel,
      .pregame-cinematic-screen .colonist-card,
      .pregame-cinematic-screen .bio-dossier-card,
      .pregame-cinematic-screen .personnel-file-card,
      .pregame-cinematic-screen .scan-panel,
      .pregame-cinematic-screen .scan-custom-panel,
      .pregame-cinematic-screen .scan-signature-card,
      .pregame-cinematic-screen .scan-world-card,
      .pregame-cinematic-screen .expedition-stat,
      .pregame-cinematic-screen .expedition-colonist,
      .pregame-cinematic-screen .expedition-log-line,
      .pregame-cinematic-screen .expedition-orbital,
      .pregame-cinematic-screen .subtle-box,
      .pregame-cinematic-screen .load-slot {
        border: 1px solid rgba(255,255,255,.10) !important;
        background:
          linear-gradient(180deg, rgba(17, 22, 32, .70), rgba(5, 8, 13, .54)) !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.055) !important;
        backdrop-filter: blur(14px) saturate(1.14);
      }

      .pregame-cinematic-screen .setup-section {
        padding: clamp(14px, 1.6vw, 22px) !important;
        border-radius: 18px;
        border-top: 1px solid rgba(255,255,255,.10) !important;
      }

      .pregame-cinematic-screen .setup-controls-panel { gap: clamp(12px, 1.5vw, 18px) !important; }

      .pregame-cinematic-screen .setup-briefing-panel {
        grid-template-rows: minmax(210px, 32vh) auto auto !important;
        border-radius: 22px !important;
        padding: clamp(16px, 1.8vw, 24px) !important;
      }

      .pregame-cinematic-screen .setup-sector-visual { min-height: 100%; }
      .pregame-cinematic-screen .form-grid,
      .pregame-cinematic-screen .setup-form-grid { gap: clamp(12px, 1.3vw, 18px) !important; }

      .pregame-cinematic-screen input,
      .pregame-cinematic-screen select {
        background: rgba(5, 8, 13, .74) !important;
        border-color: rgba(215,155,70,.27) !important;
        color: #fff3df !important;
      }

      .pregame-cinematic-screen label { color: rgba(244, 239, 228, .72) !important; }

      .planet-scan-screen.pregame-cinematic-screen > .planet-scan-shell {
        display: grid !important;
        grid-template-columns: minmax(360px, .92fr) minmax(520px, 1.08fr) !important;
        gap: clamp(18px, 2.4vw, 36px) !important;
        align-items: stretch !important;
      }

      .planet-scan-screen.pregame-cinematic-screen .scan-hologram-panel {
        min-height: 0 !important;
        display: grid;
        place-items: center;
        border-radius: 0 !important;
      }

      .planet-scan-screen.pregame-cinematic-screen .scan-radar {
        width: min(590px, 38vw) !important;
        max-width: 100%;
      }

      .planet-scan-screen.pregame-cinematic-screen .scan-grid {
        min-height: 0;
        overflow: auto;
        padding-right: 4px;
        align-content: start;
      }

      .planet-scan-screen.pregame-cinematic-screen .scan-grid::-webkit-scrollbar,
      .colonist-select-screen.pregame-cinematic-screen .colonist-cards::-webkit-scrollbar,
      .expedition-briefing-screen .expedition-scroll::-webkit-scrollbar { width: 8px; }

      .planet-scan-screen.pregame-cinematic-screen .scan-grid::-webkit-scrollbar-thumb,
      .colonist-select-screen.pregame-cinematic-screen .colonist-cards::-webkit-scrollbar-thumb,
      .expedition-briefing-screen .expedition-scroll::-webkit-scrollbar-thumb {
        background: rgba(215,155,70,.34);
        border-radius: 999px;
      }

      .planet-scan-screen.pregame-cinematic-screen .scan-actions {
        position: sticky;
        bottom: 0;
        z-index: 8;
        padding-top: 14px;
        background: linear-gradient(180deg, transparent, rgba(5,7,11,.82) 42%, rgba(5,7,11,.96));
      }

      .colonist-select-screen.pregame-cinematic-screen .max-card {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
      }

      .colonist-select-screen.pregame-cinematic-screen .colonist-cards {
        min-height: 0;
        overflow: auto;
        align-content: start;
        padding: 2px 4px 10px 2px;
      }

      .colonist-select-screen.pregame-cinematic-screen .menu-actions.spread {
        position: relative;
        z-index: 4;
        margin-top: clamp(14px, 2vh, 24px);
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,.09);
      }

      .pregame-cinematic-screen .colonist-card,
      .pregame-cinematic-screen .personnel-file-card { border-radius: 18px !important; }
      .pregame-cinematic-screen .bio-dossier-body { min-height: 0; }

      .expedition-briefing-shell {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
      }

      .expedition-scroll {
        min-height: 0;
        overflow: auto;
        display: grid;
        grid-template-columns: minmax(0, .96fr) minmax(320px, .72fr);
        gap: clamp(18px, 2.4vw, 34px);
        padding-right: 4px;
      }

      .expedition-primary,
      .expedition-secondary {
        min-width: 0;
        display: grid;
        align-content: start;
        gap: 14px;
      }

      .expedition-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .expedition-stat,
      .expedition-colonist,
      .expedition-log-line,
      .expedition-orbital {
        border-radius: 16px;
        padding: 13px;
      }

      .expedition-stat small,
      .expedition-colonist small,
      .expedition-log-line small,
      .expedition-orbital span {
        display: block;
        color: rgba(255,216,144,.78);
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .12em;
        text-transform: uppercase;
        margin-bottom: 5px;
      }

      .expedition-stat b,
      .expedition-colonist b,
      .expedition-log-line b,
      .expedition-orbital b {
        display: block;
        color: #fff3df;
        font-size: 14px;
      }

      .expedition-colonist span {
        display: block;
        margin-top: 5px;
        color: rgba(230,236,245,.68);
        font-size: 12px;
      }

      .expedition-colonist-grid,
      .expedition-log-grid {
        display: grid;
        gap: 10px;
      }

      .expedition-orbital {
        min-height: 260px;
        display: grid;
        place-items: center;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .expedition-orbital::before {
        content: '';
        position: absolute;
        width: min(360px, 80%);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 1px solid rgba(125,211,252,.22);
        box-shadow: 0 0 0 28px rgba(125,211,252,.035), 0 0 0 72px rgba(215,155,70,.025), inset 0 0 50px rgba(125,211,252,.08);
      }

      .expedition-orbital > div {
        position: relative;
        z-index: 1;
      }

      .expedition-orbital b {
        font-size: clamp(30px, 4vw, 58px);
        letter-spacing: .04em;
      }

      .expedition-actions {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,.09);
      }

      #eventModal.game-popup-modal.show { display: none !important; }

      @media (max-width: 980px), (max-height: 760px) {
        .pregame-cinematic-screen.screen { overflow: auto; }

        .pregame-cinematic-screen > .menu-card,
        .pregame-cinematic-screen > .planet-scan-shell,
        .pregame-cinematic-screen > .expedition-briefing-shell {
          width: min(100%, calc(100vw - 24px)) !important;
          min-height: auto !important;
          max-height: none !important;
          margin: 86px auto 24px !important;
          padding: 18px !important;
          overflow: visible !important;
        }

        .pregame-cinematic-screen .screen-title-row,
        .pregame-cinematic-screen .scan-title-row,
        .pregame-cinematic-screen .expedition-title-row { grid-template-columns: 1fr; }

        .pregame-cinematic-screen .setup-layout,
        .planet-scan-screen.pregame-cinematic-screen > .planet-scan-shell,
        .expedition-scroll { grid-template-columns: 1fr !important; }

        .planet-scan-screen.pregame-cinematic-screen .scan-grid,
        .colonist-select-screen.pregame-cinematic-screen .colonist-cards,
        .expedition-scroll { overflow: visible; }

        .planet-scan-screen.pregame-cinematic-screen .scan-radar { width: min(430px, 82vw) !important; }

        .pregame-progress {
          overflow-x: auto;
          justify-content: flex-start;
          padding-bottom: 6px;
        }

        .pregame-progress::before { display: none; }
      }

      @media (max-width: 620px) {
        .pregame-progress {
          left: 12px;
          right: 12px;
          top: 12px;
          font-size: 9px;
          letter-spacing: .08em;
        }

        .pregame-progress span { padding: 6px 8px; }

        .pregame-cinematic-screen > .menu-card,
        .pregame-cinematic-screen > .planet-scan-shell,
        .pregame-cinematic-screen > .expedition-briefing-shell { margin-top: 74px !important; }

        .pregame-cinematic-screen .screen-title-row h1,
        .pregame-cinematic-screen .scan-title-row h1,
        .pregame-cinematic-screen .expedition-title-row h1 {
          font-size: clamp(36px, 13vw, 60px) !important;
        }

        .expedition-stat-grid { grid-template-columns: 1fr; }
        .expedition-actions { flex-direction: column; }
      }
    `;
    document.head.appendChild(style);
  }

  function decorateScreen(step) {
    const screen = document.getElementById(step.id);
    if (!screen || screen.getAttribute(DECORATED_ATTR) === 'true') return;
    screen.classList.add('pregame-cinematic-screen', `pregame-cinematic-${step.key}`);
    screen.insertAdjacentHTML('afterbegin', `
      <div class="pregame-atmosphere" aria-hidden="true"></div>
      <div class="pregame-vignette" aria-hidden="true"></div>
      <div class="pregame-scanlines" aria-hidden="true"></div>
      ${progressMarkup(step.key)}
    `);
    screen.setAttribute(DECORATED_ATTR, 'true');
  }

  function ensureBriefingScreen() {
    let root = document.getElementById('expeditionBriefingScreen');
    if (root) return root;
    const app = document.getElementById('app') || document.body;
    root = document.createElement('section');
    root.id = 'expeditionBriefingScreen';
    root.className = 'screen expedition-briefing-screen';
    root.dataset.screen = BRIEFING_SCREEN;
    root.innerHTML = `
      <div class="expedition-briefing-shell">
        <div class="expedition-title-row">
          <div>
            <div class="kicker">Resumo da expedição</div>
            <h1>Pouso autorizado</h1>
            <p>Confirme o setor, a equipe e o risco antes de abrir o mundo. Esta é a última checagem antes da primeira noite.</p>
          </div>
          <button id="briefingBackBtn" class="secondary" type="button">Voltar para Colonos</button>
        </div>
        <div class="expedition-scroll">
          <section class="expedition-primary">
            <div id="expeditionBriefingSummary"></div>
            <div>
              <div class="kicker">Equipe inicial</div>
              <div id="expeditionBriefingColonists" class="expedition-colonist-grid"></div>
            </div>
          </section>
          <aside class="expedition-secondary">
            <div id="expeditionOrbitalMark" class="expedition-orbital"></div>
            <div>
              <div class="kicker">Log de pouso</div>
              <div id="expeditionBriefingLog" class="expedition-log-grid"></div>
            </div>
          </aside>
        </div>
        <div class="expedition-actions">
          <button id="briefingBackBtnBottom" class="secondary" type="button">Revisar equipe</button>
          <button id="briefingStartBtn" type="button">Iniciar Pouso</button>
        </div>
      </div>
    `;
    const game = document.getElementById('gameScreen');
    app.insertBefore(root, game || null);
    return root;
  }

  function polishCopy() {
    const setupHint = document.querySelector('#newGameSetupScreen .screen-title-row p');
    if (setupHint) setupHint.textContent = 'Defina a identidade da expedição, o risco operacional, os suprimentos iniciais e o tamanho do setor antes da varredura orbital.';

    const scanHint = document.querySelector('#planetScanScreen .scan-title-row p');
    if (scanHint) scanHint.textContent = 'Leitura orbital em tela cheia: clima, recursos, biomas, risco e assinaturas que serão usados pelo gerador do mundo.';

    const colonistHint = document.querySelector('#colonistSelectScreen .screen-title-row p');
    if (colonistHint) colonistHint.textContent = 'Revise os dossiês da equipe inicial, ajuste aptidões e confirme quem vai sobreviver ao primeiro pouso.';
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
    const root = ensureBriefingScreen();
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
      risk.note || 'Perfil de risco confirmado.',
      'Sem modais de pré-jogo: entrada direta para a gameplay após esta confirmação.'
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

  function applyCinematicFlow() {
    injectStyle();
    ensureBriefingScreen();
    PREGAME_STEPS.forEach(decorateScreen);
    polishCopy();
  }

  function activateBriefingScreen() {
    applyCinematicFlow();
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
      applyCinematicFlow();
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
    const back = event.target?.closest?.('#briefingBackBtn, #briefingBackBtnBottom');
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
    if (typeof updateUI === 'function') updateUI(true);
  }

  function hideLegacyPregameModal() {
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('show');
    }
  }

  applyCinematicFlow();
  patchScreenManager();
  hideLegacyPregameModal();
  document.addEventListener('click', openBriefingFromRecruitment, true);
  document.addEventListener('click', startFromBriefing, true);

  window.HavenfallPregameFlow = Object.freeze({
    BRIEFING_SCREEN,
    renderExpeditionBriefing,
    apply: applyCinematicFlow,
    openBriefing: () => setScreen(BRIEFING_SCREEN)
  });
})();
