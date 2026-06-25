# Havenfall V1.9B/C Patch — Multi-select, Crafting, Tools, Weapons and Narrated Combat

Aplicar este patch por cima da base atual que já contém V1.9A.

## Conteúdo

### Multi-seleção de coleta
- Arraste com o botão esquerdo no mapa para marcar vários recursos ao mesmo tempo.
- Shift + clique em um recurso alterna marcação de coleta.
- Recursos marcados recebem destaque no mundo.
- Colonos ociosos com prioridade de coleta passam a buscar marcados primeiro.

### V1.9B — Crafting + Tools + Weapons
- Nova aba `Crafting` no HUD.
- Botão direito em Bancada/Forja/Fogão/Estação Médica abre receitas filtradas.
- Receitas de ferramentas, armas, tochas, escudos, refeições e curativos.
- Novo estoque de itens em `state.items`.
- Itens equipáveis por colono: ferramenta, arma e apoio/offhand.
- Ferramentas alteram gameplay:
  - machado melhora madeira;
  - picareta melhora pedra/metal;
  - martelo/toolkit aceleram construção/crafting.

### V1.9C — Narrated Combat
- Lobos agora têm HP, moral e agressividade.
- Combate sem arma é muito mais arriscado.
- Armas aumentam chance de afastar/neutralizar ameaça.
- Tocha e escudo reduzem risco.
- Arco consome flechas.
- Logs narrativos descrevem o confronto sem depender de gore.

## Arquivos alterados
- `index.html`
- `src/styles.css`
- `src/game/00_globals.js`
- `src/game/03_session_and_world.js`
- `src/game/04_research_and_priorities.js`
- `src/game/05_map_and_pathfinding.js`
- `src/game/06_tasks_and_world_systems.js`
- `src/game/07_renderer.js`
- `src/game/08_canvas_input_and_building.js`
- `src/game/09_hud_ui.js`
- `src/game/10_save_load.js`
- `src/game/12_event_listeners.js`

## Novos assets
- PNGs individuais de ferramentas, armas, materiais e estações em `assets/sprites/`.
- Sheets raw do pack V1.9B em `assets/raw/`.
