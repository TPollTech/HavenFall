# Havenfall V1.9A — Right Click Interactions + Hidden Grid + Ruins/Loot

Aplicar este patch por cima da base atual V1.8/V1.8 Classic Menu.

## Arquivos alterados

- `src/game/00_globals.js`
- `src/game/01_settings_and_screens.js`
- `src/game/03_session_and_world.js`
- `src/game/06_tasks_and_world_systems.js`
- `src/game/07_renderer.js`
- `src/game/08_canvas_input_and_building.js`
- `src/game/09_hud_ui.js`
- `src/game/10_save_load.js`
- `src/game/12_event_listeners.js`
- `src/game/13_main.js`
- `src/styles.css`

## Features

- Grid visual desligado por padrão.
- Tecla `G` alterna a grade de debug e salva a preferência.
- Botão direito abre menu contextual no mapa.
- Ruínas, baús/caches e caixas especiais aparecem como objetos interativos.
- Objetos desconhecidos aparecem com `?` no mundo.
- Ação `Investigar` revela lore/história.
- Ação `Vasculhar / abrir` gera loot de comida, madeira, pedra, metal e remédios.
- Pontos de interesse agora são mais úteis para exploração.
- Save/load foi migrado para preservar dados de investigação/loot.

## Controles novos

- `Botão direito`: abre ações contextuais.
- `G`: mostra/oculta grid de debug.
