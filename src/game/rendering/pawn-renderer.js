'use strict';

(() => {
  function drawMobPawn(mob) {
    return window.HavenfallAnimalRenderer?.drawMob?.(mob) || window.HavenfallHostileRenderer?.drawMob?.(mob) || false;
  }

  function loadSimulationUpgrade() {
    if (window.HavenfallContext?.simulationUpgradeRequested) return;
    window.HavenfallContext.simulationUpgradeRequested = true;
    const script = document.createElement('script');
    script.src = 'src/game/systems/simulation-upgrade-system.js';
    script.dataset.blueprintId = 'simulation_upgrade';
    script.onerror = () => console.error('[Simulation] Falha ao carregar sistema de simulação avançada.');
    document.body.appendChild(script);
  }

  function installPawnRenderer() {
    if (window.HavenfallContext?.pawnRendererInstalled) return;
    window.HavenfallContext = window.HavenfallContext || {};

    if (typeof drawColonist === 'function') {
      drawColonist = window.HavenfallColonistRenderer.drawColonist;
    }
    if (typeof drawUnconsciousColonist === 'function') {
      drawUnconsciousColonist = window.HavenfallColonistRenderer.drawUnconsciousColonist;
    }
    if (typeof drawWolf === 'function') {
      drawWolf = window.HavenfallHostileRenderer.drawWolf;
    }
    if (typeof drawMob === 'function') {
      drawMob = drawMobPawn;
    }

    window.HavenfallPawnRenderer = Object.freeze({
      core: window.HavenfallPawnCore,
      style: window.HavenfallPawnStyle,
      colonists: window.HavenfallColonistRenderer,
      npcs: window.HavenfallNpcRenderer,
      animals: window.HavenfallAnimalRenderer,
      hostiles: window.HavenfallHostileRenderer,
      drawColonist: window.HavenfallColonistRenderer.drawColonist,
      drawUnconsciousColonist: window.HavenfallColonistRenderer.drawUnconsciousColonist,
      drawNpc: window.HavenfallNpcRenderer.drawNpc,
      drawMob: drawMobPawn,
      drawWolf: window.HavenfallHostileRenderer.drawWolf
    });
    window.HavenfallContext.pawnRendererInstalled = true;
    loadSimulationUpgrade();
  }

  installPawnRenderer();
})();