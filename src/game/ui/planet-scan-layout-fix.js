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
      #planetScanScreen.screen.active {
        display: block !important;
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-height: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      #planetScanScreen .planet-scan-shell {
        position: absolute !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 22px 28px !important;
        display: grid !important;
        grid-template-columns: minmax(300px, 38vw) minmax(0, 1fr) !important;
        gap: 22px !important;
        align-items: stretch !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      #planetScanScreen .scan-panel,
      #planetScanScreen .scan-grid,
      #planetScanScreen .scan-hologram-panel {
        min-width: 0 !important;
        min-height: 0 !important;
        box-sizing: border-box !important;
      }

      #planetScanScreen .scan-hologram-panel {
        height: 100% !important;
        min-height: 0 !important;
        display: grid !important;
        grid-template-rows: minmax(0, 1fr) auto !important;
        padding: 18px !important;
        overflow: hidden !important;
        align-content: stretch !important;
      }

      #planetScanScreen .scan-radar {
        width: min(100%, 420px, calc(100vh - 190px)) !important;
        max-width: 420px !important;
        min-width: 220px !important;
        justify-self: center !important;
        align-self: center !important;
      }

      #planetScanScreen .scan-grid {
        height: 100% !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        align-content: start !important;
        padding: 18px !important;
        gap: 11px !important;
        scrollbar-width: thin;
      }

      #planetScanScreen .scan-grid::-webkit-scrollbar { width: 10px; }
      #planetScanScreen .scan-grid::-webkit-scrollbar-track {
        background: rgba(2, 6, 23, .72);
        border-radius: 999px;
      }
      #planetScanScreen .scan-grid::-webkit-scrollbar-thumb {
        background: rgba(125, 211, 252, .34);
        border: 2px solid rgba(2, 6, 23, .72);
        border-radius: 999px;
      }

      #planetScanScreen .scan-title-row {
        margin-bottom: 2px !important;
        gap: 12px !important;
      }

      #planetScanScreen .scan-title-row h1 {
        font-size: clamp(26px, 3vw, 38px) !important;
        line-height: 1 !important;
        letter-spacing: -.035em !important;
      }

      #planetScanScreen .scan-title-row p {
        max-width: 66ch !important;
        margin: 6px 0 0 !important;
        font-size: 12px !important;
        line-height: 1.35 !important;
      }

      #planetScanScreen .scan-signature-card,
      #planetScanScreen .scan-data-list,
      #planetScanScreen .scan-signature-list,
      #planetScanScreen .scan-log-list,
      #planetScanScreen .scan-world-card {
        margin: 0 !important;
      }

      #planetScanScreen .scan-world-card {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        z-index: 1 !important;
        width: 100% !important;
        box-sizing: border-box !important;
        border-radius: 16px !important;
        padding: 12px !important;
        order: 3;
      }

      #planetScanScreen .scan-world-card h3 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      #planetScanScreen .scan-world-card h3::after {
        content: 'MAPA REAL';
        color: rgba(251, 191, 36, .78);
        font-size: 10px;
        letter-spacing: .14em;
      }

      #planetScanScreen .scan-world-map-canvas {
        display: block !important;
        width: 100% !important;
        height: clamp(118px, 18vh, 170px) !important;
        min-height: 118px !important;
        max-height: 170px !important;
        object-fit: contain;
        image-rendering: pixelated;
      }

      #planetScanScreen .scan-world-summary {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      #planetScanScreen .scan-biome-legend {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        bottom: auto !important;
        z-index: 4 !important;
        margin-top: 12px !important;
        grid-template-columns: repeat(auto-fit, minmax(108px, 1fr)) !important;
        align-self: end;
      }

      #planetScanScreen .scan-biome-chip {
        min-width: 0 !important;
        justify-content: center !important;
      }

      #planetScanScreen .scan-sector-label {
        z-index: 6 !important;
      }

      #planetScanScreen .scan-custom-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      #planetScanScreen .scan-data-row {
        grid-template-columns: minmax(104px, 136px) minmax(0, 1fr) 38px !important;
        gap: 8px !important;
      }

      #planetScanScreen .scan-actions {
        position: sticky !important;
        bottom: -18px !important;
        z-index: 8 !important;
        margin: 2px -18px -18px !important;
        padding: 12px 18px 18px !important;
        background: linear-gradient(180deg, rgba(3, 7, 18, 0), rgba(3, 7, 18, .94) 35%, rgba(3, 7, 18, .98)) !important;
      }

      @media (max-width: 980px) {
        #planetScanScreen.screen.active {
          overflow-y: auto !important;
        }
        #planetScanScreen .planet-scan-shell {
          position: relative !important;
          width: 100% !important;
          height: auto !important;
          min-height: 100vh !important;
          padding: 14px !important;
          grid-template-columns: 1fr !important;
          overflow: visible !important;
        }
        #planetScanScreen .scan-grid {
          height: auto !important;
          overflow: visible !important;
        }
        #planetScanScreen .scan-hologram-panel {
          min-height: 280px !important;
          height: auto !important;
        }
        #planetScanScreen .scan-radar {
          width: min(330px, 82vw) !important;
        }
        #planetScanScreen .scan-world-summary,
        #planetScanScreen .scan-custom-grid {
          grid-template-columns: 1fr !important;
        }
        #planetScanScreen .scan-actions {
          position: relative !important;
          bottom: auto !important;
          margin: 8px 0 0 !important;
          padding: 0 !important;
          background: transparent !important;
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
