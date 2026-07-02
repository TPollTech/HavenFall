# Mining Automation Asset Roadmap

Status: asset pack generated for planning and future integration.

## Goal

Create a clean SVG pack for the mining, metallurgy, power and automation roadmap without interfering with the current gameplay worktree.

## Output

- Root folder: `assets/ui/mining_automation`
- Local pack manifest: `assets/ui/mining_automation/asset-pack.json`
- Visual overview: `assets/ui/mining_automation/overview.svg`
- Total assets: `114`

## Integration note

The global runtime manifest in `assets/manifest.js` was intentionally left untouched in this pass. The current repository has stale UI manifest references that do not match the files on disk, so regenerating the global manifest right now would be disruptive. This pack is therefore self-contained and ready for manual runtime registration once the UI asset pipeline is cleaned up.

## Recommended implementation order

1. Manual mining package
   Use `tools`, `resources`, `deposits` and `workstations` first.
2. Manual processing package
   Wire `workstations`, `metals` and `components` into inventory and recipes.
3. Early power package
   Use `energy` icons for research, build menu and machine status.
4. Logistics package
   Add `logistics` assets to placement previews and machine ports.
5. Industrial automation package
   Add `machines` after belts and power are stable.

## Category counts

- tools: 9
- workstations: 6
- resources: 26
- deposits: 13
- metals: 12
- components: 12
- energy: 10
- logistics: 9
- machines: 17

## tools

- Maos nuas -> `assets/ui/mining_automation/tools/mining_tool_bare_hands.svg`
- Picareta de pedra -> `assets/ui/mining_automation/tools/mining_tool_pickaxe_stone.svg`
- Picareta de cobre -> `assets/ui/mining_automation/tools/mining_tool_pickaxe_copper.svg`
- Picareta de ferro -> `assets/ui/mining_automation/tools/mining_tool_pickaxe_iron.svg`
- Picareta de aco -> `assets/ui/mining_automation/tools/mining_tool_pickaxe_steel.svg`
- Broca manual -> `assets/ui/mining_automation/tools/mining_tool_manual_drill.svg`
- Martelo geologico -> `assets/ui/mining_automation/tools/mining_tool_geological_hammer.svg`
- Lanterna de mineracao -> `assets/ui/mining_automation/tools/mining_tool_lantern.svg`
- Capacete com luz -> `assets/ui/mining_automation/tools/mining_tool_helmet_lamp.svg`

## workstations

- Bancada simples -> `assets/ui/mining_automation/workstations/mining_station_simple_bench.svg`
- Pilao de pedra -> `assets/ui/mining_automation/workstations/mining_station_stone_mortar.svg`
- Mesa de selecao -> `assets/ui/mining_automation/workstations/mining_station_sorting_table.svg`
- Fornalha simples -> `assets/ui/mining_automation/workstations/mining_station_simple_furnace.svg`
- Bigorna -> `assets/ui/mining_automation/workstations/mining_station_anvil.svg`
- Caixa de carvao -> `assets/ui/mining_automation/workstations/mining_station_coal_crate.svg`

## resources

- Pedra comum -> `assets/ui/mining_automation/resources/rocks/mining_resource_stone.svg`
- Granito -> `assets/ui/mining_automation/resources/rocks/mining_resource_granite.svg`
- Ardosia -> `assets/ui/mining_automation/resources/rocks/mining_resource_slate.svg`
- Arenito -> `assets/ui/mining_automation/resources/rocks/mining_resource_sandstone.svg`
- Basalto -> `assets/ui/mining_automation/resources/rocks/mining_resource_basalt.svg`
- Calcario -> `assets/ui/mining_automation/resources/rocks/mining_resource_limestone.svg`
- Minerio bruto de ferro -> `assets/ui/mining_automation/resources/ores/mining_ore_iron_raw.svg`
- Minerio bruto de cobre -> `assets/ui/mining_automation/resources/ores/mining_ore_copper_raw.svg`
- Estanho bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_tin_raw.svg`
- Carvao bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_coal_raw.svg`
- Chumbo bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_lead_raw.svg`
- Prata bruta -> `assets/ui/mining_automation/resources/ores/mining_ore_silver_raw.svg`
- Ouro bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_gold_raw.svg`
- Quartzo bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_quartz_raw.svg`
- Bauxita -> `assets/ui/mining_automation/resources/ores/mining_ore_bauxite_raw.svg`
- Niquel bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_nickel_raw.svg`
- Titanio bruto -> `assets/ui/mining_automation/resources/ores/mining_ore_titanium_raw.svg`
- Minerio energetico raro -> `assets/ui/mining_automation/resources/ores/mining_ore_energy_raw.svg`
- Cascalho -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_gravel.svg`
- Poeira mineral -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_mineral_dust.svg`
- Silica -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_silica.svg`
- Argila -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_clay.svg`
- Enxofre -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_sulfur.svg`
- Salitre -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_saltpeter.svg`
- Cristais raros -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_rare_crystals.svg`
- Gemas -> `assets/ui/mining_automation/resources/byproducts/mining_byproduct_gems.svg`

## deposits

- Fragmento superficial -> `assets/ui/mining_automation/deposits/mining_deposit_surface_fragment.svg`
- Restos metalicos -> `assets/ui/mining_automation/deposits/mining_deposit_scrap_metal.svg`
- Veio de ferro -> `assets/ui/mining_automation/deposits/mining_vein_iron.svg`
- Veio de cobre -> `assets/ui/mining_automation/deposits/mining_vein_copper.svg`
- Veio de carvao -> `assets/ui/mining_automation/deposits/mining_vein_coal.svg`
- Veio de quartzo -> `assets/ui/mining_automation/deposits/mining_vein_quartz.svg`
- Pureza impura -> `assets/ui/mining_automation/deposits/mining_purity_impure.svg`
- Pureza normal -> `assets/ui/mining_automation/deposits/mining_purity_normal.svg`
- Pureza rica -> `assets/ui/mining_automation/deposits/mining_purity_rich.svg`
- Pureza excepcional -> `assets/ui/mining_automation/deposits/mining_purity_exceptional.svg`
- Scanner geologico -> `assets/ui/mining_automation/deposits/mining_scanner_geologic.svg`
- Sonda de profundidade -> `assets/ui/mining_automation/deposits/mining_probe_depth.svg`
- Analise sismica -> `assets/ui/mining_automation/deposits/mining_sensor_seismic.svg`

## metals

- Lingote de ferro -> `assets/ui/mining_automation/metals/mining_ingot_iron.svg`
- Lingote de cobre -> `assets/ui/mining_automation/metals/mining_ingot_copper.svg`
- Lingote de estanho -> `assets/ui/mining_automation/metals/mining_ingot_tin.svg`
- Lingote de chumbo -> `assets/ui/mining_automation/metals/mining_ingot_lead.svg`
- Lingote de prata -> `assets/ui/mining_automation/metals/mining_ingot_silver.svg`
- Lingote de ouro -> `assets/ui/mining_automation/metals/mining_ingot_gold.svg`
- Liga de bronze -> `assets/ui/mining_automation/metals/mining_alloy_bronze.svg`
- Liga de aco -> `assets/ui/mining_automation/metals/mining_alloy_steel.svg`
- Liga de latao -> `assets/ui/mining_automation/metals/mining_alloy_brass.svg`
- Liga de aluminio -> `assets/ui/mining_automation/metals/mining_alloy_aluminum.svg`
- Aco reforcado -> `assets/ui/mining_automation/metals/mining_alloy_reinforced_steel.svg`
- Liga de titanio -> `assets/ui/mining_automation/metals/mining_alloy_titanium.svg`

## components

- Chapa de ferro -> `assets/ui/mining_automation/components/mining_part_iron_plate.svg`
- Barra de ferro -> `assets/ui/mining_automation/components/mining_part_iron_bar.svg`
- Engrenagem -> `assets/ui/mining_automation/components/mining_part_gear.svg`
- Eixo -> `assets/ui/mining_automation/components/mining_part_shaft.svg`
- Parafuso -> `assets/ui/mining_automation/components/mining_part_screw.svg`
- Tubo de cobre -> `assets/ui/mining_automation/components/mining_part_copper_pipe.svg`
- Fio de cobre -> `assets/ui/mining_automation/components/mining_part_copper_wire.svg`
- Bobina -> `assets/ui/mining_automation/components/mining_part_coil.svg`
- Placa metalica -> `assets/ui/mining_automation/components/mining_part_metal_plate.svg`
- Componente mecanico -> `assets/ui/mining_automation/components/mining_part_mechanical_component.svg`
- Componente eletrico -> `assets/ui/mining_automation/components/mining_part_electrical_component.svg`
- Circuito simples -> `assets/ui/mining_automation/components/mining_part_simple_circuit.svg`

## energy

- Gerador a lenha -> `assets/ui/mining_automation/energy/mining_power_wood_generator.svg`
- Gerador a carvao -> `assets/ui/mining_automation/energy/mining_power_coal_generator.svg`
- Dinamo manual -> `assets/ui/mining_automation/energy/mining_power_hand_dynamo.svg`
- Roda d'agua -> `assets/ui/mining_automation/energy/mining_power_water_wheel.svg`
- Motor a vapor -> `assets/ui/mining_automation/energy/mining_power_steam_engine.svg`
- Poste simples -> `assets/ui/mining_automation/energy/mining_power_pole.svg`
- Conector -> `assets/ui/mining_automation/energy/mining_power_connector.svg`
- Bateria pequena -> `assets/ui/mining_automation/energy/mining_power_small_battery.svg`
- Quadro de energia -> `assets/ui/mining_automation/energy/mining_power_panel.svg`
- Fusivel -> `assets/ui/mining_automation/energy/mining_power_fuse.svg`

## logistics

- Esteira simples -> `assets/ui/mining_automation/logistics/mining_logistics_conveyor_basic.svg`
- Esteira rapida -> `assets/ui/mining_automation/logistics/mining_logistics_conveyor_fast.svg`
- Divisor -> `assets/ui/mining_automation/logistics/mining_logistics_splitter.svg`
- Unificador -> `assets/ui/mining_automation/logistics/mining_logistics_merger.svg`
- Entrada de maquina -> `assets/ui/mining_automation/logistics/mining_logistics_machine_input.svg`
- Saida de maquina -> `assets/ui/mining_automation/logistics/mining_logistics_machine_output.svg`
- Caixa industrial -> `assets/ui/mining_automation/logistics/mining_logistics_industrial_crate.svg`
- Elevador simples -> `assets/ui/mining_automation/logistics/mining_logistics_lift_basic.svg`
- Filtro -> `assets/ui/mining_automation/logistics/mining_logistics_filter_sorter.svg`

## machines

- Mineradora assistida -> `assets/ui/mining_automation/machines/mining_machine_miner_assisted.svg`
- Mineradora MK1 -> `assets/ui/mining_automation/machines/mining_machine_miner_mk1.svg`
- Mineradora MK2 -> `assets/ui/mining_automation/machines/mining_machine_miner_mk2.svg`
- Mineradora pesada -> `assets/ui/mining_automation/machines/mining_machine_miner_heavy.svg`
- Broca profunda -> `assets/ui/mining_automation/machines/mining_machine_deep_drill.svg`
- Escavadora industrial -> `assets/ui/mining_automation/machines/mining_machine_excavator_industrial.svg`
- Britador -> `assets/ui/mining_automation/machines/mining_machine_crusher.svg`
- Peneira -> `assets/ui/mining_automation/machines/mining_machine_sieve.svg`
- Lavador -> `assets/ui/mining_automation/machines/mining_machine_washer.svg`
- Fornalha industrial -> `assets/ui/mining_automation/machines/mining_machine_industrial_furnace.svg`
- Fundicao eletrica -> `assets/ui/mining_automation/machines/mining_machine_electric_smelter.svg`
- Prensa -> `assets/ui/mining_automation/machines/mining_machine_press.svg`
- Cortadora -> `assets/ui/mining_automation/machines/mining_machine_cutter.svg`
- Bobinadeira -> `assets/ui/mining_automation/machines/mining_machine_coiler.svg`
- Montadora -> `assets/ui/mining_automation/machines/mining_machine_assembler.svg`
- Misturador -> `assets/ui/mining_automation/machines/mining_machine_mixer.svg`
- Refinaria -> `assets/ui/mining_automation/machines/mining_machine_refinery.svg`
