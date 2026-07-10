'use strict';

(() => {
  function injectRecruitmentLayoutStyle() {
    if (document.getElementById('recruitment-dossier-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'recruitment-dossier-layout-style';
    style.textContent = `
      .colonist-select-screen.active {
        display: block !important;
        padding: 0 !important;
        overflow: hidden !important;
        width: 100vw;
        height: 100vh;
        min-height: 100vh;
        align-items: stretch !important;
        justify-content: stretch !important;
      }

      .colonist-select-screen .menu-card.max-card {
        width: 100vw !important;
        height: 100vh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        border: 0 !important;
        padding: 22px 28px 16px !important;
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 14px;
        overflow: hidden !important;
        background:
          radial-gradient(circle at 14% 12%, rgba(34, 211, 238, .10), transparent 32%),
          radial-gradient(circle at 86% 8%, rgba(16, 185, 129, .075), transparent 30%),
          linear-gradient(135deg, rgba(3, 7, 18, .97), rgba(7, 13, 25, .98) 56%, rgba(2, 6, 23, .99)) !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }

      .colonist-select-screen .screen-title-row {
        margin: 0 !important;
        min-height: 82px;
        align-items: start;
      }

      .colonist-select-screen .screen-title-row h1 {
        font-size: clamp(30px, 3vw, 52px);
        line-height: .98;
      }

      .colonist-select-screen .screen-title-row p {
        margin: 6px 0 0;
      }

      .colonist-select-screen .menu-actions.row.spread {
        margin: 0 !important;
        padding-top: 12px;
        border-top: 1px solid rgba(125, 211, 252, .12);
        align-items: center;
      }

      .colonist-select-screen .colonist-cards {
        display: grid !important;
        grid-template-columns: minmax(270px, 360px) minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
        grid-template-areas:
          'files dossier'
          'coverage coverage';
        align-items: stretch;
        gap: 14px;
        height: 100%;
        max-height: none !important;
        min-height: 0;
        overflow: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .personnel-files-column {
        grid-area: files;
        display: grid;
        grid-auto-rows: max-content;
        gap: 10px;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
        overflow: auto;
        padding-right: 4px;
      }

      .personnel-files-title {
        border: 1px solid rgba(125, 211, 252, .14);
        border-radius: 16px;
        background: rgba(2, 6, 23, .50);
        padding: 11px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        position: sticky;
        top: 0;
        z-index: 2;
        backdrop-filter: blur(8px);
      }

      .personnel-files-title span {
        color: rgba(94, 234, 212, .86);
        font: 900 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .18em;
      }

      .personnel-files-title b {
        color: rgba(203, 213, 225, .75);
        font: 800 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: nowrap;
      }

      .dossier-stage {
        grid-area: dossier;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .dossier-stage .bio-dossier-card {
        width: 100%;
        height: 100%;
        margin: 0;
      }

      .bio-dossier-active {
        grid-column: auto;
        grid-row: auto;
        min-width: 0;
        max-width: none;
      }

      .bio-dossier-card.bio-dossier-active {
        min-height: 0;
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) auto;
        overflow: hidden;
      }

      .bio-dossier-active .bio-dossier-header {
        margin-bottom: 10px;
      }

      .bio-dossier-active .bio-dossier-body {
        min-height: 0;
        overflow: hidden;
        grid-template-columns: minmax(140px, 180px) minmax(220px, .75fr) minmax(280px, 1.15fr);
        align-items: stretch;
      }

      .bio-dossier-active .bio-candidate-file,
      .bio-dossier-active .bio-chart-panel,
      .bio-dossier-active .bio-controls-panel {
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }

      .bio-dossier-active .bio-controls-panel {
        overflow: auto;
      }

      .bio-dossier-active .bio-spider-wrap {
        min-height: 180px;
      }

      .bio-dossier-active .bio-spider-chart {
        width: min(220px, 100%);
        max-height: 220px;
      }

      .personnel-file-card {
        width: 100%;
        min-height: 92px;
        appearance: none;
        border: 1px solid rgba(125, 211, 252, .16) !important;
        border-radius: 18px !important;
        background:
          linear-gradient(90deg, rgba(8, 47, 73, .34), rgba(2, 6, 23, .84)),
          linear-gradient(180deg, rgba(15, 23, 42, .84), rgba(2, 6, 23, .90)) !important;
        color: #e0f2fe;
        padding: 11px !important;
        display: grid !important;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        grid-template-areas:
          'idx main status'
          'avatar main points';
        gap: 8px 10px;
        align-items: center;
        text-align: left;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform .14s ease, border-color .14s ease, background .14s ease;
      }

      .personnel-file-card.active {
        border-color: rgba(94, 234, 212, .45) !important;
        background:
          linear-gradient(90deg, rgba(20, 184, 166, .18), rgba(2, 6, 23, .88)),
          linear-gradient(180deg, rgba(15, 23, 42, .94), rgba(2, 6, 23, .94)) !important;
        box-shadow: inset 3px 0 0 rgba(94, 234, 212, .70), 0 0 22px rgba(45, 212, 191, .10);
      }

      .personnel-file-card:hover {
        transform: translateX(3px);
        border-color: rgba(94, 234, 212, .38) !important;
        background:
          linear-gradient(90deg, rgba(14, 116, 144, .34), rgba(2, 6, 23, .82)),
          linear-gradient(180deg, rgba(15, 23, 42, .90), rgba(2, 6, 23, .92)) !important;
      }

      .personnel-file-card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(94, 234, 212, .16), transparent);
        transform: translateX(-110%);
        opacity: 0;
      }

      .personnel-file-card:hover::before {
        animation: personnelTransmit .72s ease;
      }

      .personnel-file-card.invalid {
        border-color: rgba(251, 146, 60, .34) !important;
      }

      .personnel-file-index {
        grid-area: idx;
        color: rgba(94, 234, 212, .90);
        font: 800 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
      }

      .personnel-file-avatar {
        grid-area: avatar;
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        border: 1px solid rgba(94, 234, 212, .18);
        background: radial-gradient(circle at center, rgba(94, 234, 212, .16), rgba(15, 23, 42, .88));
        overflow: hidden;
      }

      .personnel-file-avatar .procedural-colonist-avatar {
        width: 31px;
        height: 36px;
      }

      .personnel-file-main {
        grid-area: main;
        min-width: 0;
        display: grid;
        gap: 3px;
      }

      .personnel-file-main b {
        color: #ecfeff;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .personnel-file-main small,
      .personnel-file-main em {
        color: rgba(203, 213, 225, .72);
        font-size: 10px;
        font-style: normal;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .personnel-file-main em {
        color: rgba(167, 243, 208, .82);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .personnel-file-status {
        grid-area: status;
        justify-self: end;
        border-radius: 999px;
        padding: 4px 6px;
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
      }

      .personnel-file-status.ok {
        color: #99f6e4;
        background: rgba(20, 184, 166, .10);
        border: 1px solid rgba(94, 234, 212, .22);
      }

      .personnel-file-status.danger {
        color: #fed7aa;
        background: rgba(124, 45, 18, .18);
        border: 1px solid rgba(251, 146, 60, .32);
      }

      .personnel-file-points {
        grid-area: points;
        justify-self: end;
        min-width: 26px;
        height: 24px;
        display: grid;
        place-items: center;
        border-radius: 8px;
        font: 900 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: rgba(15, 23, 42, .76);
        border: 1px solid rgba(148, 163, 184, .14);
      }

      .personnel-file-points.ok { color: #99f6e4; }
      .personnel-file-points.warn { color: #fde68a; }
      .personnel-file-points.danger { color: #fed7aa; }

      @keyframes personnelTransmit {
        from { transform: translateX(-110%); opacity: 0; }
        35% { opacity: 1; }
        to { transform: translateX(110%); opacity: 0; }
      }

      @media (max-width: 1180px) {
        .colonist-select-screen .colonist-cards {
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
        }

        .bio-dossier-active .bio-dossier-body {
          grid-template-columns: minmax(140px, 170px) minmax(250px, 1fr);
        }

        .bio-dossier-active .bio-controls-panel {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 900px) {
        .colonist-select-screen .menu-card.max-card {
          padding: 16px !important;
        }

        .colonist-select-screen .colonist-cards {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto auto auto;
          grid-template-areas:
            'files'
            'dossier'
            'coverage';
          overflow: auto !important;
        }

        .personnel-files-column {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          overflow: visible;
        }

        .personnel-files-title {
          grid-column: 1 / -1;
          position: static;
        }

        .bio-dossier-active .bio-dossier-body {
          grid-template-columns: 1fr;
          overflow: visible;
        }

        .bio-dossier-card.bio-dossier-active,
        .dossier-stage {
          height: auto;
          overflow: visible;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectRecruitmentLayoutStyle, { once: true });
  } else {
    injectRecruitmentLayoutStyle();
  }
})();
