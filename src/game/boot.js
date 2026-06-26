'use strict';

(() => {
  const CORE_BLUEPRINTS = Object.freeze([
    { id: 'state', file: 'src/game/state.js' },
    { id: 'game_setup', file: 'src/game/game-setup.js' },
    { id: 'colonist_generation', file: 'src/game/colonist-generation.js' },
    { id: 'research_system', file: 'src/game/research-system.js' },
    { id: 'colonist_mechanics', file: 'src/game/colonist-mechanics.js' },
    { id: 'screen_manager', file: 'src/game/screen-manager.js' },
    { id: 'world_generator', file: 'src/game/world-generator.js' },
    { id: 'exploration_system', file: 'src/game/exploration-system.js' },
    { id: 'map_pathfinding', file: 'src/game/map-pathfinding.js' },
    { id: 'world_systems', file: 'src/game/world-systems.js' },
    { id: 'renderer', file: 'src/game/renderer.js' },
    { id: 'canvas_input_building', file: 'src/game/canvas-input-building.js' },
    { id: 'hud_ui', file: 'src/game/hud-ui.js' },
    { id: 'modal_compat', file: 'src/game/modal-compat.js' },
    { id: 'zones', file: 'src/game/zones.js' },
    { id: 'environment', file: 'src/game/environment.js' },
    { id: 'ui_modals', file: 'src/game/ui-modals.js' },
    { id: 'save_load', file: 'src/game/save-load.js' },
    { id: 'game_loop', file: 'src/game/game-loop.js' },
    { id: 'event_listeners', file: 'src/game/event-listeners.js' }
  ]);

  const PATCH_BLUEPRINTS = Object.freeze([
    { id: 'asset_pack_clean', file: 'src/game/patches/asset-pack-clean.js', optional: true },
    { id: 'ui_icon_safety', file: 'src/game/patches/ui-icon-safety.js', optional: true }
  ]);

  const ENTRY_BLUEPRINT = Object.freeze({ id: 'main', file: 'src/game/core/main.js' });

  function loadScript(blueprint) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = blueprint.file;
      script.dataset.blueprintId = blueprint.id;
      script.onload = () => resolve(blueprint);
      script.onerror = () => {
        const err = new Error(`Falha ao carregar módulo: ${blueprint.id} (${blueprint.file})`);
        if (blueprint.optional) resolve({ ...blueprint, skipped: true, error: err });
        else reject(err);
      };
      document.body.appendChild(script);
    });
  }

  async function loadBlueprintsInOrder(blueprints) {
    const loaded = [];
    for (const blueprint of blueprints) {
      loaded.push(await loadScript(blueprint));
    }
    return loaded;
  }

  function showBootError(error) {
    console.error(error);
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:20px;z-index:9999;display:grid;place-items:center;background:rgba(2,4,8,.82);color:#f4efe4;font:16px system-ui;text-align:center;padding:24px;';
    box.innerHTML = `<div style="max-width:720px;background:#121722;border:1px solid rgba(227,169,63,.35);border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.45)"><h1 style="margin:0 0 10px">Falha ao iniciar Havenfall</h1><p style="color:#b8b0a0">${String(error.message || error)}</p><p style="color:#b8b0a0;font-size:13px">Confira o console e confirme se os módulos do manifesto existem no caminho correto.</p></div>`;
    document.body.appendChild(box);
  }

  async function bootFromManifest() {
    window.HavenfallBootManifest = Object.freeze({
      core: CORE_BLUEPRINTS,
      patches: PATCH_BLUEPRINTS,
      entry: ENTRY_BLUEPRINT
    });

    try {
      await loadBlueprintsInOrder(CORE_BLUEPRINTS);
      await loadBlueprintsInOrder(PATCH_BLUEPRINTS);
      await loadScript(ENTRY_BLUEPRINT);
    } catch (error) {
      showBootError(error);
    }
  }

  bootFromManifest();
})();
