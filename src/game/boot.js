'use strict';

(() => {
  const core = [
    ['state','src/game/state.js'],['id_generator','src/game/core/id-generator.js'],['game_systems','src/game/core/game-systems.js'],
    ['data_research','src/game/data/research.js'],['data_priorities','src/game/data/priorities.js'],['data_objects','src/game/data/objects.js'],['data_buildings','src/game/data/buildings.js'],['data_items','src/game/data/items.js'],['data_recipes','src/game/data/recipes.js'],['definitions','src/game/data/definitions.js'],
    ['game_state','src/game/core/game-state.js'],['module_boundary','src/game/core/module-boundary.js'],['menu_branding','src/game/ui/menu-branding.js'],
    ['asset_manifest','assets/manifest.js'],['fire_vfx_manifest','src/game/ui/fire-vfx-manifest.js'],['asset_audit','src/game/asset-audit.js'],
    ['game_setup','src/game/game-setup.js'],['settings_manager','src/game/core/settings-manager.js'],['colonist_generation','src/game/colonist-generation.js'],['research_system','src/game/research-system.js'],['research_defs','src/game/research-defs.js'],['colonist_mechanics','src/game/colonist-mechanics.js'],['screen_manager','src/game/screen-manager.js'],['world_generator','src/game/world-generator.js'],['asset_policy','src/game/core/asset-policy.js'],
    ['biome_registry','src/game/biomes/biome-registry.js'],['biome_forest','src/game/biomes/biome-forest.js'],['biome_desert','src/game/biomes/biome-desert.js'],['biome_snow','src/game/biomes/biome-snow.js'],['biome_engine','src/game/biomes/biome-engine.js'],['biomes','src/game/biomes.js'],
    ['exploration_system','src/game/exploration-system.js'],['map_pathfinding','src/game/map-pathfinding.js'],['geology_system','src/game/systems/geology-system.js'],['geology_mass_patch','src/game/systems/geology-mass-patch.js'],['schedule_manager','src/game/systems/schedule-manager.js'],['world_systems','src/game/world-systems.js'],['mining_task_handler','src/game/systems/mining-task-handler.js'],['mining_orders','src/game/systems/mining-orders.js'],
    ['renderer','src/game/renderer.js'],['fog_of_war_render_hook','src/game/ui/fog-of-war-render-hook.js'],['geology_backdrop_render_hook','src/game/ui/geology-backdrop-render-hook.js'],['fire_vfx_render_hooks','src/game/ui/fire-vfx-render-hooks.js'],['canvas_input_building','src/game/canvas-input-building.js'],['orders_canvas_input_hook','src/game/ui/orders-canvas-input-hook.js'],['hud_ui','src/game/ui/hud-ui.js'],
    ['planet_scan_profile','src/game/systems/planet-scan-profile.js'],['planet_scan_ui','src/game/ui/planet-scan-ui.js'],['recruitment_dossier_ui','src/game/ui/recruitment-dossier-ui.js'],['recruitment_dossier_layout_ui','src/game/ui/recruitment-dossier-layout-ui.js'],['recruitment_coverage_ui','src/game/ui/recruitment-coverage-ui.js'],['recruitment_render_ui','src/game/ui/recruitment-render-ui.js'],['recruitment_polish_ui','src/game/ui/recruitment-polish-ui.js'],
    ['zones','src/game/zones.js'],['advanced_zones','src/game/systems/advanced-zones.js'],['advanced_zone_labels','src/game/systems/advanced-zones-labels.js'],['deconstruct_dumping_hook','src/game/systems/deconstruct-dumping-hook.js'],['environment','src/game/environment.js'],['workstations_tools','src/game/workstations-tools.js'],['defense','src/game/defense.js'],['hauling_adv','src/game/hauling-adv.js'],['climate_adv','src/game/climate-adv.js'],
    ['mobs','src/game/mobs.js'],['blood_wolf','src/game/mobs/blood-wolf.js'],['living_world','src/game/systems/living-world.js'],['performance_render_hooks','src/game/systems/performance-render-hooks.js'],['performance_runtime_hooks','src/game/systems/performance-runtime-hooks.js'],
    ['pawn_core','src/game/rendering/pawns/pawn-core.js'],['pawn_style','src/game/rendering/pawns/pawn-style.js'],['colonist_renderer','src/game/rendering/pawns/colonist-renderer.js'],['npc_renderer','src/game/rendering/pawns/npc-renderer.js'],['animal_renderer','src/game/rendering/pawns/animal-renderer.js'],['hostile_renderer','src/game/rendering/pawns/hostile-renderer.js'],['pawn_renderer','src/game/rendering/pawn-renderer.js'],
    ['living_world','src/game/systems/living-world.js'],
    ['workstation_core','src/game/rendering/workstations/workstation-core.js'],['workstation_style','src/game/rendering/workstations/workstation-style.js'],['workstation_renderer','src/game/rendering/workstations/workstation-renderer.js'],['simple_object_renderer','src/game/rendering/simple-object-renderer.js'],
    ['mob_interactions','src/game/mob-interactions.js'],['ui_icon_safety','src/game/ui/icon-safety.js'],['research_overlay','src/game/ui/research-overlay.js'],['colonist_modal','src/game/ui/colonist-modal.js'],['ui_manager','src/game/ui/ui-manager.js'],['pause_menu','src/game/ui/pause-menu.js'],['performance_settings_ui','src/game/ui/performance-settings-ui.js'],['performance_settings_backfix','src/game/ui/performance-settings-backfix.js'],
    ['tab_crafting','src/game/ui/tab-crafting.js'],['tab_zones','src/game/ui/tab-zones.js'],['tab_colonists','src/game/ui/tab-colonists.js'],['tab_tasks','src/game/ui/tab-tasks.js'],['tab_orders','src/game/ui/tab-orders.js'],['tab_schedule','src/game/ui/tab-schedule.js'],['tab_events','src/game/ui/tab-events.js'],['dock_tab_router','src/game/ui/dock-tab-router.js'],['dock_panel_state_fix','src/game/ui/dock-panel-state-fix.js'],['save_load','src/game/save-load.js'],['game_loop','src/game/game-loop.js'],['event_listeners','src/game/event-listeners.js'],['manual_control','src/game/systems/manual-control-system.js'],
    ['construction_system','src/game/systems/construction-system.js'],['render_collision_system','src/game/systems/render-collision-system.js'],['colonist_pathing_system','src/game/systems/colonist-pathing-system.js'],['wall_door_renderer','src/game/rendering/wall-door-renderer.js'],['task_reservation_system','src/game/systems/task-reservation-system.js']
  ].map(([id,file]) => Object.freeze({ id, file }));

  const CORE_BLUEPRINTS = Object.freeze(core);
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
