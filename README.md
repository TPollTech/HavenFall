# Havenfall - Arquitetura atual

Esta versão remove a ideia de correções em cascata por arquivos `*_patch.js` e passa a carregar módulos com nomes semânticos, separados por responsabilidade.

## Rodar

```bash
npm run dev
```

Abra `http://localhost:5173`.

## Estrutura principal

```text
src/game/
  global.js                  # Constantes, DOM centralizado, definições e estado global mínimo
  gameSetup.js               # Configuração de nova partida, seed e settings
  screenManager.js           # Telas, HUD, cards de colonos e UI de saves
  worldGenerator.js          # Geração procedural, POIs, estado inicial e recursos iniciais
  explorationSystem.js       # Neblina/exploração otimizada por tiles visíveis
  colonistGeneration.js      # Geração determinística de colonos sem HTML
  researchSystem.js          # Pesquisa e desbloqueio de tecnologia
  colonistMechanics.js       # Prioridade, biologia básica, eficiência e metadados dos colonos

  05_map_and_pathfinding.js  # Utilitários, recursos, itens, pathfinding e seleção
  06_tasks_and_world_systems.js
  07_renderer.js
  08_canvas_input_and_building.js
  10_save_load.js
  11_utils_and_loop.js
  12_event_listeners.js
  13_main.js
```

## Regra de manutenção

Nada de criar `14_algum_patch.js`, `15_algum_fix.js` ou arquivos cronológicos para corrigir bugs. Se o bug é de construção, corrija no sistema de construção. Se é de tela, corrija no `screenManager.js`. Se é de geração de mundo, corrija no `worldGenerator.js`.

## Observação técnica

O jogo ainda usa scripts clássicos carregados pelo HTML para manter baixo risco no navegador. A próxima etapa ideal é converter essa estrutura para ES Modules com `import/export`, depois migrar gradualmente para TypeScript.
