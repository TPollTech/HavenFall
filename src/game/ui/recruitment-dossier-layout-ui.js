'use strict';

(() => {
  function injectRecruitmentLayoutStyle() {
    if (document.getElementById('recruitment-dossier-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'recruitment-dossier-layout-style';
    style.textContent = `
      .colonist-select-screen .colonist-cards {
        display: grid !important;
        grid-template-columns: 310px minmax(0, 1fr);
        grid-auto-flow: dense;
        align-items: start;
        gap: 14px;
        max-height: min(68vh, 760px);
        overflow: auto;
      }

      .bio-dossier-active {
        grid-column: 2;
        grid-row: 1 / span 24;
        min-width: 0;
      }

      .personnel-file-card {
        grid-column: 1;
        width: 100%;
        min-height: 96px;
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

      .personnel-file-avatar img {
        width: 32px;
        height: 32px;
        object-fit: contain;
        image-rendering: pixelated;
        filter: drop-shadow(0 0 9px rgba(94, 234, 212, .26));
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

      @media (max-width: 1080px) {
        .colonist-select-screen .colonist-cards {
          grid-template-columns: 1fr !important;
        }

        .bio-dossier-active,
        .personnel-file-card {
          grid-column: 1;
          grid-row: auto;
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
