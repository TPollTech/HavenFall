# Havenfall V1.9E — Rodapé, comportamento dos colonos, paredes e mineração

Patch incremental em cima da V1.9D, focado nas ideias anotadas durante revisão da gameplay.

## Correções aplicadas

- Rodapé e logs:
  - conteúdo do rodapé fica limitado em altura;
  - log de eventos ganha corte visual e botão `Mais`;
  - eventos longos não estouram para fora do HUD.

- Colonos menos incontroláveis:
  - adicionada trava de calma para trabalho automático;
  - colonos ociosos não ficam pegando tarefa nova a cada instante;
  - tarefas automáticas ficam um pouco mais espaçadas para reduzir movimentação excessiva.

- Paredes rotacionáveis:
  - tecla `R` alterna orientação da parede em modo construção;
  - orientação fica registrada como `horizontal` ou `vertical` na blueprint/parede.

- Mineração mais coerente:
  - objetos de metal em barra soltos no mapa são ocultados/removidos em saneamento de mundo;
  - coleta de rocha passa a ter chance de render metal extra;
  - coleta de veio de metal continua sendo fonte mais confiável.

## Atalhos novos/ajustados

- `R`: rotacionar parede em modo construção.
- `G`: debug grid.
- `H`: esconder/mostrar HUD.
- `C`: centralizar câmera no colono.

## Arquivos alterados/novos

- `src/game/14_qol_patch.js`
- `PATCH_NOTES_V1.9E.md`
