'use strict';

(() => {
  if (window.HavenfallContext?.planetScanLayoutFixInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.planetScanLayoutFixInstalled = true;

  function injectLayoutFixStyle() {
    let style = document.getElementById('planet-scan-layout-fix-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'planet-scan-layout-fix-style';
      document.head.appendChild(style);
    }

    style.textContent = `
      .planet-scan-screen {
        height: 100vh;
        min-height: 0;
        overflow: hidden !important;
        padding: 0;
        box-sizing: border-box;
      }

      .planet-scan-shell {
        width: min(1280px, calc(100vw - 28px)) !important;
        height: min(780px, calc(100vh - 28px)) !important;
        max-height: none !important;
        margin: 14px auto !important;
        grid-template-columns: minmax(340px, 460px) minmax(0, 1fr) !important;
        align-items: stretch !important;
        overflow: hidden !important;
        min-height: 0 !important;
      }

      .planet-scan-shell,
      .scan-panel,
      .scan-grid,
      .scan-hologram-panel {
        box-sizing: border-box;
      }

      .scan-panel {
        min-height: 0 !important;
      }

      .scan-hologram-panel {
        min-height: 0 !important;
        height: 100% !important;
        display: grid !important;
        grid-template-rows: minmax(260px, 1fr) auto !important;
        place-items: stretch !important;
        align-content: stretch !important;
        padding: 16px !important;
        overflow: hidden !important;
      }

      .scan-radar {
        width: min(100%, 390px, calc(100vh - 250px)) !important;
        max-width: 390px !important;
        min-width: 250px;
        justify-self: center !important;
        align-self: center !important;
      }

      .scan-grid {
        height: 100% !important;
        max-height: 100% !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        align-content: start !important;
        padding: 16px !important;
        gap: 12px !important;
        scrollbar-width: thin;
      }

      .scan-grid::-webkit-scrollbar {
        width: 10px;
      }

      .scan-grid::-webkit-scrollbar-track {
        background: rgba(2,6,23,.72);
        border-radius: 999px;
      }

      .scan-grid::-webkit-scrollbar-thumb {
        background: rgba(125,211,252,.32);
        border: 2px solid rgba(2,6,23,.72);
        border-radius: 999px;
      }

      .scan-title-row {
        margin-bottom: 4px !important;
      }

      .scan-title-row h1 {
        font-size: clamp(24px, 2.8vw, 36px) !important;
        line-height: 1.04 !important;
      }

      .scan-title-row p {
        max-width: 62ch !important;
        font-size: 13px !important;
      }

      .scan-world-card {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        z-index: 1 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        border-radius: 16px !important;
        background: linear-gradient(180deg, rgba(15,23,42,.76), rgba(2,6,23,.58)) !important;
        border: 1px solid rgba(125,211,252,.18) !important;
        backdrop-filter: none !important;
        padding: 12px !important;
        order: 3;
      }

      .scan-world-card h3 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .scan-world-card h3::after {
        content: 'MAPA REAL';
        color: rgba(251,191,36,.78);
        font-size: 10px;
        letter-spacing: .14em;
      }

      .scan-world-map-canvas {
        display: block !important;
        width: 100% !important;
        height: clamp(132px, 21vh, 190px) !important;
        min-height: 132px !important;
        max-height: 190px !important;
        object-fit: contain;
        image-rendering: pixelated;
      }

      .scan-world-summary {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .scan-biome-legend {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        z-index: 4 !important;
        margin-top: 12px !important;
        grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)) !important;
        align-self: end;
      }

      .scan-biome-chip {
        min-width: 0;
        justify-content: center;
      }

      .scan-sector-label {
        z-index: 6 !important;
      }

      .scan-custom-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      .scan-data-row {
        grid-template-columns: minmax(118px, 150px) 1fr 42px !important;
      }

      .scan-actions {
        position: sticky;
        bottom: -16px;
        z-index: 8;
        margin: 2px -16px -16px !important;
        padding: 12px 16px 16px;
        background: linear-gradient(180deg, rgba(3,7,18,0), rgba(3,7,18,.94) 34%, rgba(3,7,18,.98));
      }

      @media (max-width: 1060px) {
        .planet-scan-shell {
          grid-template-columns: minmax(280px, 360px) minmax(0, 1fr) !important;
        }
        .scan-radar {
          width: min(100%, 320px, calc(100vh - 250px)) !important;
          min-width: 230px;
        }
        .scan-custom-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 820px) {
        .planet-scan-screen {
          overflow: auto !important;
        }
        .planet-scan-shell {
          height: auto !important;
          min-height: calc(100vh - 18px) !important;
          width: calc(100vw - 16px) !important;
          margin: 8px auto !important;
          grid-template-columns: 1fr !important;
          overflow: visible !important;
        }
        .scan-grid {
          overflow: visible !important;
          height: auto !important;
        }
        .scan-hologram-panel {
          grid-template-rows: auto auto !important;
        }
        .scan-radar {
          width: min(330px, 82vw) !important;
        }
        .scan-world-summary,
        .scan-custom-grid {
          grid-template-columns: 1fr !important;
        }
        .scan-actions {
          position: relative;
          bottom: auto;
          margin: 8px 0 0 !important;
          background: transparent;
          padding: 0;
        }
      }
    `;
  }

  function targetPreviewAnchor() {
    return document.getElementById('scanSectorMeta')?.closest('.scan-signature-card') || document.querySelector('.scan-title-row');
  }

  function relocateWorldPreviewCard() {
    const card = document.getElementById('scanWorldPreviewCard');
    const grid = document.querySelector('.scan-grid');
    if (!card || !grid) return false;
    const anchor = targetPreviewAnchor();
    const next = anchor?.nextSibling || grid.firstChild;
    if (card.parentElement !== grid || card.previousElementSibling !== anchor) {
      grid.insertBefore(card, next);
    }
    card.setAttribute('aria-label', 'Prévia real do mundo gerado');
    return true;
  }

  function relocateBiomeLegend() {
    const legend = document.getElementById('scanBiomeLegend');
    const panel = document.querySelector('.scan-hologram-panel');
    if (!legend || !panel) return false;
    if (legend.parentElement !== panel) panel.appendChild(legend);
    return true;
  }

  function applyPlanetScanLayoutFix() {
    injectLayoutFixStyle();
    relocateWorldPreviewCard();
    relocateBiomeLegend();
  }

  function patchRefreshPlanetScan() {
    if (typeof refreshPlanetScan !== 'function' || window.HavenfallContext.planetScanRefreshLayoutPatched) return;
    const nativeRefreshPlanetScan = refreshPlanetScan;
    refreshPlanetScan = function refreshPlanetScanWithLayoutFix(...args) {
      const result = nativeRefreshPlanetScan(...args);
      requestAnimationFrame(applyPlanetScanLayoutFix);
      return result;
    };
    window.refreshPlanetScan = refreshPlanetScan;
    window.HavenfallContext.planetScanRefreshLayoutPatched = true;
  }

  const observer = new MutationObserver(() => applyPlanetScanLayoutFix());
  const startObserver = () => {
    const screen = document.getElementById('planetScanScreen');
    if (screen) observer.observe(screen, { childList: true, subtree: true });
  };

  injectLayoutFixStyle();
  patchRefreshPlanetScan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
  requestAnimationFrame(applyPlanetScanLayoutFix);

  window.HavenfallPlanetScanLayoutFix = { apply: applyPlanetScanLayoutFix };
})();