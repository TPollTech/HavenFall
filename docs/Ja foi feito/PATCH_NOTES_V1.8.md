# Havenfall V1.8 — Larger World + Seeded Exploration

Aplicar por cima do projeto V1.7. Este patch também mantém o sistema de câmera WASD/zoom.

## Principais mudanças

- Mundo dinâmico por `state.world.cols`, `state.world.rows`, `state.world.tileSize`.
- Tamanhos de mapa reais:
  - pequeno: 42x30
  - padrão: 64x46
  - grande: 88x64
  - enorme: 118x84
  - fronteira vasta: 150x104
- `generateWorldFromSeed(config)` agora gera:
  - terreno por seed;
  - áreas secas, férteis, rochosas e florestais;
  - árvores, pedras, berries, arbustos, toras e metal;
  - pontos especiais como ruínas, caches, groves e campos de minério;
  - spawn determinístico;
  - matriz de exploração/fog-of-war;
  - padrão climático inicial.
- Renderer otimizado: desenha somente tiles/objetos visíveis pela câmera.
- Fog of war:
  - 0 = nunca visto;
  - 1 = descoberto, mas fora da visão atual;
  - 2 = visível.
- Exploração revela área ao redor dos colonos.
- Eventos e spawns adaptados para mapas grandes.
- Save/load migra saves antigos para `state.world`.

## Arquivos incluídos

- `index.html`
- `src/game/00_globals.js`
- `src/game/01_settings_and_screens.js`
- `src/game/03_session_and_world.js`
- `src/game/05_map_and_pathfinding.js`
- `src/game/06_tasks_and_world_systems.js`
- `src/game/07_renderer.js`
- `src/game/08_canvas_input_and_building.js`
- `src/game/09_hud_ui.js`
- `src/game/10_save_load.js`
- `src/game/11_utils_and_loop.js`
- `src/game/12_event_listeners.js`

## Observação

Para testar mundos grandes, iniciar novo jogo e escolher `Enorme` ou `Fronteira vasta` em Tamanho do mapa.
