# Havenfall V1.7 - Codebase Refactor

Esta versão mantém a gameplay da V1.6, mas refatora o antigo `src/game.js` monolítico em arquivos menores dentro de `src/game/`.

## Rodar

```bash
npm run dev
```

Abra `http://localhost:5173`.

## O que mudou

- `src/game.js` deixou de concentrar o jogo inteiro.
- O monolito original foi preservado em `src/legacy/game.monolith.v1.6.js`.
- A lógica foi separada por responsabilidade:

```text
src/game/
  00_globals.js
  01_settings_and_screens.js
  02_colonist_generation.js
  03_session_and_world.js
  04_research_and_priorities.js
  05_map_and_pathfinding.js
  06_tasks_and_world_systems.js
  07_renderer.js
  08_canvas_input_and_building.js
  09_hud_ui.js
  10_save_load.js
  11_utils_and_loop.js
  12_event_listeners.js
  13_main.js
```

## Observação técnica

Essa é uma refatoração estrutural de baixo risco: o jogo continua usando scripts clássicos no navegador para evitar build complexa neste momento. A próxima etapa ideal é transformar essa separação em módulos ES (`import/export`) ou migrar para TypeScript.

