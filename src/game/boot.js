'use strict';

(() => {
  const CORE_BLUEPRINTS = Object.freeze([
    { id: 'state', file: 'src/game/global.js' },
    { id: 'setup', file: 'src/game/gameSetup.js' },
    { id: 'colonist_generation', file: 'src/game/colonistGeneration.js' },
    { id: 'research', file: 'src/game/researchSystem.js' },
    { id: 'colonist_mechanics', file: 'src/game/colonistMechanics.js' },
    { id: 'ui', file: 'src/game/screenManager.js' },
    { id: 'world_generator', file: 'src/game/worldGenerator.js' },
    { id: 'exploration', file: 'src/game/explorationSystem.js' },
    { id: 'map_pathfinding', file: 'src/game/05_map_and_pathfinding.js' },
    { id: 'tasks_world', file: 'src/game/06_tasks_and_world_systems.js' },
    { id: 'render', file: 'src/game/07_renderer.js' },
    { id: 'canvas_input_building', file: 'src/game/08_canvas_input_and_building.js' },
    { id: 'save_load', file: 'src/game/10_save_load.js' },
    { id: 'game_loop', file: 'src/game/11_utils_and_loop.js' },
    { id: 'event_listeners', file: 'src/game/12_event_listeners.js' }
  ]);

  const PATCH_BLUEPRINTS = Object.freeze([
    { id: 'asset_pack_clean', file: 'src/game/patches/asset_pack_clean.js', optional: true }
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
