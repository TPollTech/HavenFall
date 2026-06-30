'use strict';

(() => {
  if (window.HavenfallContext?.geologyMassSystemInstalled) return;
  window.HavenfallContext = window.HavenfallContext || {};
  window.HavenfallContext.geologyMassSystemInstalled = true;

  const FINAL_VERSION = 'dense-mountains';
  const LEGACY_VERSION = 'dense-mountains-v2';

  function loadLegacyGeology() {
    return new Promise((resolve, reject) => {
      if (window.HavenfallGeologyMassPatch) {
        resolve(window.HavenfallGeologyMassPatch);
        return;
      }
      const script = document.createElement('script');
      script.src = 'src/game/systems/geology-mass-patch.js';
      script.dataset.blueprintId = 'geology_mass_legacy';
      script.onload = () => resolve(window.HavenfallGeologyMassPatch || null);
      script.onerror = () => reject(new Error('Falha ao carregar o sistema geológico legado.'));
      document.body.appendChild(script);
    });
  }

  function normalizeVersion(world = state?.world) {
    if (!world) return;
    if (world.geologyMassVersion === LEGACY_VERSION) world.geologyMassVersion = FINAL_VERSION;
  }

  function prepareLegacyVersion(world = state?.world) {
    if (!world) return;
    if (world.geologyMassVersion === FINAL_VERSION) world.geologyMassVersion = LEGACY_VERSION;
  }

  function installFacade(legacy) {
    if (!legacy || window.HavenfallGeologyMassSystem?.version === FINAL_VERSION) return;

    function applyDenseGeology(world = state?.world) {
      prepareLegacyVersion(world);
      const result = legacy.applyDenseGeology?.(world) || false;
      normalizeVersion(world);
      return result;
    }

    function cleanupVegetationOnGeology() {
      const result = legacy.cleanupVegetationOnGeology?.() || 0;
      normalizeVersion(state?.world);
      return result;
    }

    function purgeLooseResourcesOnGeology(layer = state?.world?.geologyLayer, roofLayer = state?.world?.naturalRoofLayer) {
      const result = legacy.purgeLooseResourcesOnGeology?.(layer, roofLayer) || 0;
      normalizeVersion(state?.world);
      return result;
    }

    window.HavenfallGeologyMassSystem = {
      version: FINAL_VERSION,
      applyDenseGeology,
      cleanupVegetationOnGeology,
      purgeLooseResourcesOnGeology,
      objectInvalidForLayer: legacy.objectInvalidForLayer
    };
    window.HavenfallGeologyMassPatch = window.HavenfallGeologyMassSystem;

    window.GameSystems?.registerTick?.('geology.mass-system', () => {
      if (!state?.world || appScreen !== SCREEN.PLAYING) return;
      applyDenseGeology(state.world);
      cleanupVegetationOnGeology();
    }, { order: 11 });
  }

  loadLegacyGeology()
    .then(installFacade)
    .catch(error => console.error('[Geology]', error));
})();
