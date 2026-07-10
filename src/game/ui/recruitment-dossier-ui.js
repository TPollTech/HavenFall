'use strict';

(() => {
  function injectRecruitmentDossierStyle() {
    if (document.getElementById('recruitment-dossier-ui-style')) return;
    const style = document.createElement('style');
    style.id = 'recruitment-dossier-ui-style';
    style.textContent = `
      .colonist-select-screen {
        background:
          radial-gradient(circle at 18% 22%, rgba(34, 211, 238, .10), transparent 28%),
          radial-gradient(circle at 82% 18%, rgba(16, 185, 129, .075), transparent 28%),
          linear-gradient(135deg, #030712 0%, #08111d 52%, #020617 100%);
      }

      .colonist-select-screen .menu-card.max-card {
        width: min(1180px, calc(100vw - 24px));
        max-height: calc(100vh - 24px);
        border: 1px solid rgba(125, 211, 252, .14);
        background: linear-gradient(180deg, rgba(15, 23, 42, .72), rgba(2, 6, 23, .86));
        box-shadow: 0 24px 80px rgba(0,0,0,.50), inset 0 1px 0 rgba(255,255,255,.04);
      }

      .colonist-select-screen .screen-title-row h1::before {
        content: 'BIO-DOSSIER';
        display: block;
        margin-bottom: 4px;
        color: rgba(94, 234, 212, .88);
        font: 700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .26em;
      }

      .colonist-select-screen .screen-title-row h1 { color: #ecfeff; letter-spacing: .035em; }
      .colonist-select-screen .screen-title-row p { color: rgba(203, 213, 225, .76); }

      .colonist-cards {
        display: grid;
        gap: 14px;
        max-height: min(66vh, 720px);
        overflow: auto;
        padding-right: 6px;
      }

      .bio-dossier-card {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(125, 211, 252, .18) !important;
        background:
          linear-gradient(90deg, rgba(8, 47, 73, .30), rgba(2, 6, 23, .78) 42%, rgba(6, 78, 59, .16)),
          linear-gradient(180deg, rgba(15, 23, 42, .86), rgba(2, 6, 23, .92)) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.055), 0 18px 60px rgba(0,0,0,.34);
      }

      .bio-dossier-card::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(125, 211, 252, .045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(125, 211, 252, .035) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: linear-gradient(90deg, black, transparent 78%);
      }

      .bio-dossier-card.invalid { border-color: rgba(251, 146, 60, .45) !important; }
      .bio-dossier-header, .bio-dossier-body, .bio-dossier-footer { position: relative; z-index: 1; }

      .bio-dossier-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .bio-file-id { display: grid; gap: 3px; }
      .bio-file-id span, .bio-panel-title span, .bio-diagnostic-box span {
        color: rgba(148, 163, 184, .86);
        font: 700 10px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .20em;
        text-transform: uppercase;
      }

      .bio-file-id b, .bio-panel-title b, .bio-diagnostic-box b, .bio-status, .bio-points {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .bio-file-id b { color: #cffafe; font-size: 14px; }

      .bio-status {
        border: 1px solid rgba(94, 234, 212, .28);
        background: rgba(20, 184, 166, .08);
        color: #99f6e4;
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 11px;
        letter-spacing: .14em;
      }

      .bio-status.danger {
        border-color: rgba(251, 146, 60, .45);
        background: rgba(124, 45, 18, .18);
        color: #fed7aa;
      }

      .bio-dossier-body {
        display: grid;
        grid-template-columns: 1fr 1.3fr;
        gap: 12px;
        align-items: stretch;
      }

      .bio-candidate-file, .bio-chart-panel, .bio-controls-panel {
        border: 1px solid rgba(148, 163, 184, .11);
        border-radius: 14px;
        background: rgba(2, 6, 23, .38);
        padding: 11px;
      }

      .bio-candidate-file { display: grid; gap: 10px; align-content: start; }

      .bio-scan-frame {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 110px;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid rgba(94, 234, 212, .20);
        background:
          radial-gradient(circle at center, rgba(45, 212, 191, .11), transparent 58%),
          linear-gradient(180deg, rgba(8, 47, 73, .32), rgba(2, 6, 23, .86));
      }

      .bio-scan-frame img {
        position: relative;
        z-index: 1;
        width: 72px;
        height: 72px;
        object-fit: contain;
        image-rendering: pixelated;
        filter: drop-shadow(0 0 14px rgba(94, 234, 212, .26));
      }

      .bio-scan-lines {
        position: absolute;
        inset: -40% 0;
        z-index: 2;
        pointer-events: none;
        background: linear-gradient(180deg, transparent 0%, rgba(94, 234, 212, .34) 49%, transparent 54%);
        animation: dossierScanPass 2.8s linear infinite;
        mix-blend-mode: screen;
      }

      .bio-name-input {
        width: 100%;
        border: 1px solid rgba(125, 211, 252, .20) !important;
        background: rgba(15, 23, 42, .74) !important;
        color: #ecfeff !important;
        font-weight: 800;
        letter-spacing: .03em;
      }

      .bio-candidate-meta { display: grid; gap: 5px; }
      .bio-candidate-meta span {
        border-left: 2px solid rgba(94, 234, 212, .45);
        padding-left: 8px;
        color: rgba(226, 232, 240, .78);
        font-size: 11px;
      }

      .bio-points {
        border-radius: 12px;
        padding: 8px 9px;
        background: rgba(15, 23, 42, .72);
        border: 1px solid rgba(148, 163, 184, .14);
        font-size: 11px;
      }

      .bio-points.ok { color: #99f6e4; }
      .bio-points.warn { color: #fde68a; }
      .bio-points.danger { color: #fed7aa; }

      .bio-chart-panel {
        display: grid;
        grid-template-rows: auto minmax(160px, 1fr) auto;
        gap: 8px;
      }

      .bio-panel-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .bio-panel-title b { color: #a7f3d0; }
      .bio-spider-wrap { display: grid; place-items: center; min-height: 170px; }
      .bio-spider-chart { width: min(200px, 100%); max-height: 200px; overflow: visible; }

      .bio-spider-rings polygon { fill: transparent; stroke: rgba(148, 163, 184, .20); stroke-width: .8; }
      .bio-spider-axis line { stroke: rgba(125, 211, 252, .19); stroke-width: .8; }
      .bio-spider-axis text {
        fill: rgba(203, 213, 225, .72);
        font: 700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        text-anchor: middle;
        dominant-baseline: middle;
        letter-spacing: .08em;
      }

      .bio-spider-value {
        fill: rgba(45, 212, 191, .22);
        stroke: rgba(94, 234, 212, .92);
        stroke-width: 2;
        filter: drop-shadow(0 0 10px rgba(45, 212, 191, .36));
        transition: all .18s ease;
      }

      .bio-spider-core { fill: #ecfeff; filter: drop-shadow(0 0 8px rgba(236, 254, 255, .55)); }

      .bio-diagnostic-box {
        display: grid;
        gap: 5px;
        border-radius: 14px;
        border: 1px solid rgba(94, 234, 212, .18);
        background: rgba(6, 78, 59, .13);
        padding: 10px;
      }

      .bio-diagnostic-box b { color: #ccfbf1; font-size: 12px; line-height: 1.35; }
      .bio-controls-panel { display: grid; gap: 12px; min-width: 0; }

      .bio-select-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px !important; }
      .bio-select-grid label {
        display: grid;
        gap: 5px;
        color: rgba(203, 213, 225, .72);
        font-size: 10px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .bio-select-grid select {
        min-width: 0;
        border: 1px solid rgba(125, 211, 252, .18) !important;
        background: rgba(15, 23, 42, .82) !important;
        color: #e0f2fe !important;
        border-radius: 10px !important;
      }

      .bio-skill-console { display: grid; gap: 8px; }
      .bio-skill-row {
        display: grid !important;
        grid-template-columns: 94px 28px minmax(110px, 1fr) 28px !important;
        align-items: center;
        gap: 8px !important;
        border: 1px solid rgba(148, 163, 184, .11);
        background: rgba(15, 23, 42, .42);
        border-radius: 12px;
        padding: 7px !important;
      }

      .bio-skill-row > span {
        color: rgba(226, 232, 240, .78);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .bio-skill-row button {
        border: 1px solid rgba(94, 234, 212, .20) !important;
        background: rgba(6, 78, 59, .20) !important;
        color: #ccfbf1 !important;
        border-radius: 8px !important;
        min-height: 26px;
      }

      .bio-skill-row button:disabled { opacity: .35; }
      .bio-skill-row .builder-skill-bar {
        position: relative;
        height: 12px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(15, 23, 42, .95) !important;
        border: 1px solid rgba(148, 163, 184, .12);
      }

      .bio-skill-row .builder-skill-bar i {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, rgba(14, 165, 233, .75), rgba(45, 212, 191, .95)) !important;
        box-shadow: 0 0 12px rgba(45, 212, 191, .28);
      }

      .bio-skill-row .builder-skill-bar b {
        position: absolute;
        inset: -2px 6px auto auto;
        color: #ecfeff;
        font: 700 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .bio-dossier-footer {
        margin-top: 12px;
        color: rgba(148, 163, 184, .82) !important;
        font: 700 10px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      .bio-dossier-footer.danger { color: #fed7aa !important; }

      @keyframes dossierScanPass {
        from { transform: translateY(-30%); opacity: .15; }
        42% { opacity: .75; }
        to { transform: translateY(55%); opacity: .15; }
      }

      @media (max-width: 1080px) {
        .bio-dossier-body { grid-template-columns: 1fr; }
        .bio-candidate-file { grid-template-columns: 110px minmax(0, 1fr); align-items: center; }
        .bio-scan-frame { grid-row: span 4; }
      }

      @media (max-width: 720px) {
        .bio-select-grid { grid-template-columns: 1fr; }
        .bio-candidate-file { grid-template-columns: 1fr; }
        .bio-skill-row { grid-template-columns: 1fr 24px minmax(80px, 1fr) 24px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectRecruitmentDossierStyle, { once: true });
  } else {
    injectRecruitmentDossierStyle();
  }
})();
