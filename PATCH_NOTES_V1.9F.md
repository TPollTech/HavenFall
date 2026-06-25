# Havenfall V1.9F — Crafting compacto e parede rotacionável

Patch incremental em cima da branch `v1.9d-qol-fixes`.

## Correções

- Painel de crafting:
  - remove visualmente o título grande e a descrição longa;
  - libera mais espaço para os cards de receita;
  - receitas agora usam área rolável própria dentro do painel;
  - inventário fica compacto para não bloquear a fabricação.

- Parede rotacionável:
  - `R` agora é capturado em alta prioridade durante construção de parede;
  - adicionado botão `Rotacionar parede (R)` no painel de construção;
  - orientação da parede é registrada na blueprint e na parede final;
  - como não existe asset vertical específico separado, a parede passa a ser desenhada proceduralmente no Canvas em horizontal/vertical, evitando depender de sprite extra.

## Arquivos alterados/novos

- `src/game/13_main.js`
- `src/game/15_crafting_wall_fix.js`
- `PATCH_NOTES_V1.9F.md`
