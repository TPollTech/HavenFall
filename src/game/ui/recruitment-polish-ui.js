'use strict';

(() => {
  function injectRecruitmentPolishStyle() {
    if (document.getElementById('recruitment-polish-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'recruitment-polish-ui-style';
    style.textContent = `
      .colonist-select-screen .screen-title-row h1::before {
        content: none !important;
        display: none !important;
      }

      .colonist-select-screen .kicker {
        color: rgba(94, 234, 212, .88) !important;
      }

      .colonist-select-screen .menu-card.max-card {
        position: relative;
        grid-template-rows: auto minmax(0, 1fr) 58px !important;
      }

      .colonist-select-screen .colonist-cards {
        grid-template-columns: minmax(420px, .95fr) minmax(560px, 1.05fr) !important;
        grid-template-rows: minmax(0, 1fr) auto !important;
      }

      .colonist-select-screen .screen-title-row {
        padding-right: 0 !important;
      }

      .colonist-select-screen .screen-title-row .secondary#colonistBackBtn {
        position: absolute;
        left: 28px;
        bottom: 16px;
        z-index: 5;
        min-width: 118px;
      }

      .colonist-select-screen .menu-actions.row.spread {
        justify-content: flex-end !important;
        padding-left: 150px;
        min-height: 58px;
      }

      .colonist-select-screen #startSelectedGameBtn {
        min-width: 170px;
      }

      .bio-dossier-card {
        border-color: rgba(167, 243, 208, .16) !important;
        background:
          linear-gradient(180deg, rgba(8, 19, 26, .92), rgba(2, 6, 23, .96)),
          repeating-linear-gradient(90deg, rgba(167, 243, 208, .035) 0 1px, transparent 1px 44px) !important;
      }

      .bio-dossier-card::before {
        background-image:
          linear-gradient(rgba(167, 243, 208, .035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(167, 243, 208, .028) 1px, transparent 1px) !important;
        background-size: 32px 32px !important;
        mask-image: linear-gradient(90deg, black, rgba(0,0,0,.72) 60%, transparent 100%) !important;
      }

      .bio-file-id span {
        color: rgba(167, 243, 208, .70) !important;
      }

      .bio-file-id b {
        color: #d1fae5 !important;
      }

      .bio-medical-frame {
        background:
          radial-gradient(circle at center, rgba(167, 243, 208, .12), transparent 52%),
          linear-gradient(180deg, rgba(6, 78, 59, .20), rgba(2, 6, 23, .92)) !important;
        border-color: rgba(167, 243, 208, .20) !important;
      }

      .bio-medical-frame::before {
        content: '';
        position: absolute;
        inset: 10px 18px;
        border-left: 1px solid rgba(167, 243, 208, .16);
        border-right: 1px solid rgba(167, 243, 208, .16);
        border-radius: 999px;
        opacity: .8;
        pointer-events: none;
      }

      .bio-vital-line {
        position: absolute;
        left: 10px;
        right: 10px;
        bottom: 18px;
        height: 22px;
        opacity: .42;
        background: linear-gradient(90deg,
          transparent 0 8%, rgba(167, 243, 208, .78) 8% 9%, transparent 9% 18%,
          rgba(167, 243, 208, .78) 18% 19%, transparent 19% 25%,
          rgba(167, 243, 208, .78) 25% 26%, transparent 26% 42%,
          rgba(167, 243, 208, .78) 42% 43%, transparent 43% 54%,
          rgba(167, 243, 208, .78) 54% 55%, transparent 55% 100%);
        filter: drop-shadow(0 0 5px rgba(167, 243, 208, .30));
      }

      .bio-dossier-active .bio-dossier-body {
        grid-template-columns: minmax(220px, .86fr) minmax(320px, 1.14fr) !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        gap: 12px !important;
        overflow: hidden !important;
      }

      .bio-dossier-active .bio-candidate-file {
        grid-column: 1;
        grid-row: 1;
        grid-template-columns: 96px minmax(0, 1fr);
        align-items: center;
        align-content: start;
        padding: 10px !important;
      }

      .bio-dossier-active .bio-scan-frame {
        grid-row: span 4;
        min-height: 104px;
      }

      .bio-dossier-active .bio-scan-frame img {
        width: 68px;
        height: 68px;
      }

      .bio-dossier-active .bio-chart-panel {
        grid-column: 1;
        grid-row: 2;
        grid-template-rows: auto minmax(120px, 1fr) auto !important;
        min-height: 0;
        overflow: hidden;
        padding: 10px !important;
      }

      .bio-dossier-active .bio-controls-panel {
        grid-column: 2;
        grid-row: 1 / span 2;
        overflow: hidden !important;
        padding: 10px !important;
        gap: 8px !important;
      }

      .bio-dossier-active .bio-spider-wrap {
        min-height: 138px !important;
      }

      .bio-dossier-active .bio-spider-chart {
        width: min(174px, 100%) !important;
        max-height: 174px !important;
      }

      .bio-dossier-active .bio-diagnostic-box {
        padding: 8px !important;
      }

      .bio-dossier-active .bio-diagnostic-box b {
        font-size: 11px !important;
        line-height: 1.25 !important;
      }

      .bio-clinical-panel {
        display: none;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .bio-clinical-panel div {
        border: 1px solid rgba(167, 243, 208, .12);
        border-radius: 12px;
        background: rgba(6, 78, 59, .08);
        padding: 8px;
        min-width: 0;
      }

      .bio-clinical-panel span {
        display: block;
        margin-bottom: 3px;
        color: rgba(148, 163, 184, .80);
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .10em;
        text-transform: uppercase;
      }

      .bio-clinical-panel b {
        display: block;
        color: #d1fae5;
        font-size: 11px;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .bio-clinical-panel .warn b {
        color: #fde68a;
      }

      .bio-clinical-panel .ok b {
        color: #99f6e4;
      }

      .bio-diagnostic-box {
        background: rgba(6, 78, 59, .10) !important;
        border-color: rgba(167, 243, 208, .16) !important;
      }

      .bio-select-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        max-width: 100%;
      }

      .bio-dossier-active .bio-select-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }

      .bio-select-grid label,
      .bio-select-grid select {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .bio-select-grid label {
        gap: 3px !important;
        font-size: 9px !important;
      }

      .bio-select-grid select {
        min-height: 30px !important;
        padding: 5px 8px !important;
        font-size: 10px !important;
        text-overflow: ellipsis;
      }

      .bio-skill-row {
        grid-template-columns: minmax(78px, 92px) 24px minmax(0, 1fr) 24px !important;
        gap: 5px !important;
        padding: 3px 6px !important;
        max-width: 100%;
        min-height: 30px !important;
      }

      .bio-skill-row button {
        min-height: 22px !important;
        height: 22px !important;
        padding: 0 !important;
      }

      .bio-skill-console {
        gap: 5px !important;
      }

      .bio-skill-row > span {
        font-size: 10px !important;
      }

      .bio-skill-row .builder-skill-bar {
        height: 10px !important;
      }

      .bio-skill-row .builder-skill-bar {
        min-width: 0 !important;
      }

      .personnel-file-main em {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: center;
        gap: 7px;
      }

      .personnel-prof-meter {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 2px;
        min-width: 54px;
      }

      .personnel-prof-meter i {
        height: 7px;
        border-radius: 999px;
        background: rgba(51, 65, 85, .8);
        border: 1px solid rgba(255,255,255,.04);
      }

      .personnel-prof-meter i.on {
        background: linear-gradient(180deg, rgba(167, 243, 208, .95), rgba(20, 184, 166, .72));
        box-shadow: 0 0 7px rgba(94, 234, 212, .18);
      }

      .squad-sync-panel {
        border-color: rgba(167, 243, 208, .16) !important;
        background:
          linear-gradient(90deg, rgba(6, 78, 59, .16), rgba(2, 6, 23, .80)),
          rgba(2, 6, 23, .68) !important;
        animation: squadSyncPulse .28s ease;
      }

      @keyframes squadSyncPulse {
        from { box-shadow: 0 0 0 rgba(167, 243, 208, 0); }
        45% { box-shadow: 0 0 22px rgba(167, 243, 208, .18); }
        to { box-shadow: 0 0 0 rgba(167, 243, 208, 0); }
      }

      @media (max-width: 1180px) {
        .colonist-select-screen .colonist-cards {
          grid-template-columns: minmax(300px, .9fr) minmax(440px, 1.1fr) !important;
        }

        .bio-dossier-active .bio-dossier-body {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto auto auto !important;
          overflow: auto !important;
        }

        .bio-dossier-active .bio-candidate-file,
        .bio-dossier-active .bio-chart-panel,
        .bio-dossier-active .bio-controls-panel {
          grid-column: 1 !important;
          grid-row: auto !important;
        }

        .bio-dossier-active .bio-controls-panel {
          overflow: visible !important;
        }

        .bio-clinical-panel {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectRecruitmentPolishStyle, { once: true });
  } else {
    injectRecruitmentPolishStyle();
  }
})();
