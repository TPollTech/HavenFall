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
        padding: 16px 22px 14px !important;
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) auto;
        gap: 10px;
        overflow: hidden !important;
        background:
          radial-gradient(circle at 14% 12%, rgba(34, 211, 238, .08), transparent 32%),
          radial-gradient(circle at 86% 8%, rgba(16, 185, 129, .06), transparent 30%),
          linear-gradient(135deg, rgba(3, 7, 18, .97), rgba(7, 13, 25, .98) 56%, rgba(2, 6, 23, .99)) !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }

      .colonist-select-screen .screen-title-row {
        margin: 0 !important;
        min-height: 60px;
        align-items: start;
      }

      .colonist-select-screen .screen-title-row h1 {
        font-size: clamp(26px, 2.8vw, 44px);
        line-height: .98;
      }

      .colonist-select-screen .screen-title-row p {
        margin: 4px 0 0;
        font-size: 11px;
      }

      .colonist-select-screen .menu-actions.row.spread {
        margin: 0 !important;
        padding-top: 10px;
        border-top: 1px solid rgba(125, 211, 252, .10);
        align-items: center;
      }

      .colonist-select-screen .colonist-cards {
        display: grid !important;
        grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) auto;
        grid-template-areas:
          'files dossier'
          'coverage coverage';
        align-items: stretch;
        gap: 10px;
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
        gap: 6px;
        min-width: 0;
        min-height: 0;
        align-self: stretch;
        overflow: auto;
        padding-right: 4px;
      }

      .personnel-files-title {
        border: 1px solid rgba(125, 211, 252, .12);
        border-radius: 14px;
        background: rgba(2, 6, 23, .50);
        padding: 8px 10px;
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
        font: 900 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .18em;
      }

      .personnel-files-title b {
        color: rgba(203, 213, 225, .75);
        font: 800 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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
        margin-bottom: 8px;
      }

      .bio-dossier-active .bio-dossier-body {
        min-height: 0;
        overflow: hidden;
        grid-template-columns: minmax(180px, .7fr) minmax(0, 1fr);
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
        min-height: 140px;
      }

      .bio-dossier-active .bio-spider-chart {
        width: min(180px, 100%);
        max-height: 180px;
      }

      .personnel-file-card {
        width: 100%;
        min-height: 78px;
        appearance: none;
        border: 1px solid rgba(125, 211, 252, .14) !important;
        border-radius: 14px !important;
        background:
          linear-gradient(90deg, rgba(8, 47, 73, .30), rgba(2, 6, 23, .82)),
          linear-gradient(180deg, rgba(15, 23, 42, .82), rgba(2, 6, 23, .88)) !important;
        color: #e0f2fe;
        padding: 9px !important;
        display: grid !important;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        grid-template-areas:
          'idx main status'
          'avatar main points';
        gap: 6px 8px;
        align-items: center;
        text-align: left;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform .14s ease, border-color .14s ease, background .14s ease;
      }

      .personnel-file-card.active {
        border-color: rgba(94, 234, 212, .40) !important;
        background:
          linear-gradient(90deg, rgba(20, 184, 166, .16), rgba(2, 6, 23, .86)),
          linear-gradient(180deg, rgba(15, 23, 42, .92), rgba(2, 6, 23, .92)) !important;
        box-shadow: inset 3px 0 0 rgba(94, 234, 212, .65), 0 0 18px rgba(45, 212, 191, .08);
      }

      .personnel-file-card:hover {
        transform: translateX(3px);
        border-color: rgba(94, 234, 212, .34) !important;
        background:
          linear-gradient(90deg, rgba(14, 116, 144, .30), rgba(2, 6, 23, .80)),
          linear-gradient(180deg, rgba(15, 23, 42, .88), rgba(2, 6, 23, .90)) !important;
      }

      .personnel-file-card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(94, 234, 212, .14), transparent);
        transform: translateX(-110%);
        opacity: 0;
      }

      .personnel-file-card:hover::before {
        animation: personnelTransmit .72s ease;
      }

      .personnel-file-card.invalid {
        border-color: rgba(251, 146, 60, .30) !important;
      }

      .personnel-file-index {
        grid-area: idx;
        color: rgba(94, 234, 212, .88);
        font: 800 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
      }

      .personnel-file-avatar {
        grid-area: avatar;
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        border: 1px solid rgba(94, 234, 212, .16);
        background: radial-gradient(circle at center, rgba(94, 234, 212, .14), rgba(15, 23, 42, .86));
        overflow: hidden;
      }

      .personnel-file-avatar .procedural-colonist-avatar {
        width: 28px;
        height: 32px;
      }

      .personnel-file-main {
        grid-area: main;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .personnel-file-main b {
        color: #ecfeff;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .personnel-file-main small,
      .personnel-file-main em {
        color: rgba(203, 213, 225, .70);
        font-size: 9px;
        font-style: normal;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .personnel-file-main em {
        color: rgba(167, 243, 208, .80);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .personnel-file-status {
        grid-area: status;
        justify-self: end;
        border-radius: 999px;
        padding: 3px 6px;
        font: 800 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
      }

      .personnel-file-status.ok {
        color: #99f6e4;
        background: rgba(20, 184, 166, .10);
        border: 1px solid rgba(94, 234, 212, .20);
      }

      .personnel-file-status.danger {
        color: #fed7aa;
        background: rgba(124, 45, 18, .16);
        border: 1px solid rgba(251, 146, 60, .28);
      }

      .personnel-file-points {
        grid-area: points;
        justify-self: end;
        min-width: 22px;
        height: 20px;
        display: grid;
        place-items: center;
        border-radius: 7px;
        font: 900 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: rgba(15, 23, 42, .74);
        border: 1px solid rgba(148, 163, 184, .12);
      }

      .personnel-file-points.ok { color: #99f6e4; }
      .personnel-file-points.warn { color: #fde68a; }
      .personnel-file-points.danger { color: #fed7aa; }

      @keyframes personnelTransmit {
        from { transform: translateX(-110%); opacity: 0; }
        35% { opacity: 1; }
        to { transform: translateX(110%); opacity: 0; }
      }

      @media (max-width: 1080px) {
        .colonist-select-screen .colonist-cards {
          grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
        }

        .bio-dossier-active .bio-dossier-body {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 860px) {
        .colonist-select-screen .menu-card.max-card {
          padding: 12px !important;
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
