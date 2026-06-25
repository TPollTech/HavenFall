# Havenfall V1.9G — Construção, portas, telhado e auto-equipamento

Patch aplicado direto na `main`.

## Correções e melhorias

- Remove visualmente o botão/texto `Rotacionar parede (R)` do rodapé.
- O terreno deixa de depender do tile com aparência de grade; agora é desenhado proceduralmente sem linhas aparentes.
- `G` passa a alternar a grade de debug de verdade.
- Paredes agora se conectam automaticamente com paredes/portas vizinhas.
- Porta adicionada ao menu de construção.
- Porta funciona como parte do fechamento de cômodos, mas não bloqueia passagem.
- Sistema simples de telhado automático:
  - quando paredes + porta fecham uma área, tiles internos viram área coberta;
  - área coberta recebe sombra sutil;
  - chuva penaliza colonos que ficam sem cobertura.
- Auto-equipamento por contexto:
  - lobo/combate: tenta equipar melhor arma e apoio;
  - madeira: tenta equipar machado;
  - pedra/minério: tenta equipar picareta;
  - construção/crafting: tenta equipar martelo/toolkit.
- Limpeza runtime dos ícones de ferramentas/armas/materiais com fundo xadrez, usando chroma key/canvas sem precisar trocar os PNGs agora.

## Observação técnica

Como ainda não existe asset vertical específico para parede, a parede passou a ser desenhada proceduralmente no Canvas e conectada por vizinhança. Isso permite encaixe correto sem depender de sprites extras.

## Arquivos alterados/novos

- `src/game/13_main.js`
- `src/game/16_building_roof_ai_fix.js`
- `PATCH_NOTES_V1.9G.md`
