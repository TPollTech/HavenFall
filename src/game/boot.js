'use strict';

(() => {
  const CORE_BLUEPRINTS = Object.freeze([
    { id: 'state', file: 'src/game/state.js' },
    { id: 'id_generator', file: 'src/game/core/id-generator.js' },
    { id: 'game_systems', file: 'src/game/core/game-systems.js' },
    { id: 'data_research', file: 'src/game/data/research.js' },
    { id: 'data_priorities', file: 'src/game/data/priorities.js' },
    { id: 'data_objects', file: 'src/game/data/objects.js' },
    { id: 'data_buildings', file: 'src/game/data/buildings.js' },
    { id: 'data_items', file: 'src/game/data/items.js' },
    { id: 'data_recipes', file: 'src/game/data/recipes.js' },
    { id: 'definitions', file: 'src/game/data/definitions.js' },
    { id: 'game_state', file: 'src/game/core/game-state.js' },
    { id: 'module_boundary', file: 'src/game/core/module-boundary.js' },
    { id: 'menu_branding', file: 'src/game/ui/menu-branding.js' },
    { id: 'asset_manifest', file: 'assets/manifest.js' },
    { id: 'fire_vfx_manifest', file: 'src/game/ui/fire-vfx-manifest.js' },
    { id: 'asset_audit', file: 'src/game/asset-audit.js' },
    { id: 'creature_sprite_sheet', file: 'src/game/creature-sprite-sheet.js' },
    { id: 'game_setup', file: 'src/game/game-setup.js' },
    { id: 'colonist_generation', file: 'src/game/colonist-generation.js' },
    { id: 'research_system', file: 'src/game/research-system.js' },
    { id: 'research_defs', file: 'src/game/research-defs.js' },
    { id: 'colonist_mechanics', file: 'src/game/colonist-mechanics.js' },
    { id: 'screen_manager', file: 'src/game/screen-manager.js' },
    { id: 'world_generator', file: 'src/game/world-generator.js' },
    { id: 'biome_registry', file: 'src/game/biomes/biome-registry.js' },
    { id: 'biome_forest', file: 'src/game/biomes/biome-forest.js' },
    { id: 'biome_desert', file: 'src/game/biomes/biome-desert.js' },
    { id: 'biome_snow', file: 'src/game/biomes/biome-snow.js' },
    { id: 'biome_engine', file: 'src/game/biomes/biome-engine.js' },
    { id: 'biomes', file: 'src/game/biomes.js' },
    { id: 'exploration_system', file: 'src/game/exploration-system.js' },
    { id: 'map_pathfinding', file: 'src/game/map-pathfinding.js' },
    { id: 'geology_system', file: 'src/game/systems/geology-system.js' },
    { id: 'schedule_manager', file: 'src/game/systems/schedule-manager.js' },
    { id: 'world_systems', file: 'src/game/world-systems.js' },
    { id: 'mining_task_handler', file: 'src/game/systems/mining-task-handler.js' },
    { id: 'mining_orders', file: 'src/game/systems/mining-orders.js' },
    { id: 'renderer', file: 'src/game/renderer.js' },
    { id: 'geology_backdrop_render_hook', file: 'src/game/ui/geology-backdrop-render-hook.js' },
    { id: 'fire_vfx_render_hooks', file: 'src/game/ui/fire-vfx-render-hooks.js' },
    { id: 'canvas_input_building', file: 'src/game/canvas-input-building.js' },
    { id: 'orders_canvas_input_hook', file: 'src/game/ui/orders-canvas-input-hook.js' },
    { id: 'hud_ui', file: 'src/game/ui/hud-ui.js' },
    { id: 'planet_scan_profile', file: 'src/game/systems/planet-scan-profile.js' },
    { id: 'planet_scan_ui', file: 'src/game/ui/planet-scan-ui.js' },
    { id: 'recruitment_dossier_ui', file: 'src/game/ui/recruitment-dossier-ui.js' },
    { id: 'recruitment_dossier_layout_ui', file: 'src/game/ui/recruitment-dossier-layout-ui.js' },
    { id: 'recruitment_coverage_ui', file: 'src/game/ui/recruitment-coverage-ui.js' },
    { id: 'recruitment_render_ui', file: 'src/game/ui/recruitment-render-ui.js' },
    { id: 'recruitment_polish_ui', file: 'src/game/ui/recruitment-polish-ui.js' },
    { id: 'zones', file: 'src/game/zones.js' },
    { id: 'environment', file: 'src/game/environment.js' },
    { id: 'workstations_tools', file: 'src/game/workstations-tools.js' },
    { id: 'defense', file: 'src/game/defense.js' },
    { id: 'hauling_adv', file: 'src/game/hauling-adv.js' },
    { id: 'climate_adv', file: 'src/game/climate-adv.js' },
    { id: 'mobs', file: 'src/game/mobs.js' },
    { id: 'blood_wolf', file: 'src/game/mobs/blood-wolf.js' },
    { id: 'creature_renderer', file: 'src/game/creature-renderer.js' },
    { id: 'mob_interactions', file: 'src/game/mob-interactions.js' },
    { id: 'ui_icon_safety', file: 'src/game/ui/icon-safety.js' },
    { id: 'research_overlay', file: 'src/game/ui/research-overlay.js' },
    { id: 'colonist_modal', file: 'src/game/ui/colonist-modal.js' },
    { id: 'ui_manager', file: 'src/game/ui/ui-manager.js' },
    { id: 'pause_menu', file: 'src/game/ui/pause-menu.js' },
    { id: 'tab_crafting', file: 'src/game/ui/tab-crafting.js' },
    { id: 'tab_zones', file: 'src/game/ui/tab-zones.js' },
    { id: 'tab_colonists', file: 'src/game/ui/tab-colonists.js' },
    { id: 'tab_tasks', file: 'src/game/ui/tab-tasks.js' },
    { id: 'tab_orders', file: 'src/game/ui/tab-orders.js' },
    { id: 'tab_schedule', file: 'src/game/ui/tab-schedule.js' },
    { id: 'tab_events', file: 'src/game/ui/tab-events.js' },
    { id: 'dock_tab_router', file: 'src/game/ui/dock-tab-router.js' },
    { id: 'save_load', file: 'src/game/save-load.js' },
    { id: 'game_loop', file: 'src/game/game-loop.js' },
    { id: 'event_listeners', file: 'src/game/event-listeners.js' }
  ]);

  const ENTRY_BLUEPRINT = Object.freeze({ id: 'main', file: 'src/game/core/main.js' });

  function loadScript(blueprint) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = blueprint.file;
      el.dataset.blueprintId = blueprint.id;
      el.onload = () => resolve(blueprint);
      el.onerror = () => reject(new Error(`Falha ao carregar ${blueprint.id}`));
      document.body.appendChild(el);
    });
  }

  async function bootFromManifest() {
    window.HavenfallBootManifest = Object.freeze({ core: CORE_BLUEPRINTS, entry: ENTRY_BLUEPRINT });
    try {
      for (const blueprint of CORE_BLUEPRINTS) await loadScript(blueprint);
      await loadScript(ENTRY_BLUEPRINT);
    } catch (error) {
      console.error(error);
      const box = document.createElement('div');
      box.textContent = `Falha ao iniciar Havenfall: ${error.message || error}`;
      box.style.cssText = 'position:fixed;inset:20px;z-index:9999;display:grid;place-items:center;background:#080b10;color:#f4efe4;font:16px system-ui;text-align:center;padding:24px;';
      document.body.appendChild(box);
    }
  }

  bootFromManifest();
})();
