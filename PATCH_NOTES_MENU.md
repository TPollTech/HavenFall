# Havenfall V1.8 — Classic Main Menu Patch

Arquivos alterados:

- `index.html`
- `src/styles.css`
- `src/game/03_session_and_world.js`

## Mudanças

- Menu inicial refeito para um formato convencional de jogo.
- Removido visual de card/modal do menu principal.
- Título do jogo centralizado no topo.
- Opções do menu alinhadas à esquerda, como menu de game tradicional.
- Opções visíveis:
  - Novo Jogo
  - Carregar / Continuar
  - Configurações
  - Sair
- O botão `Carregar` vira `Continuar` automaticamente quando existe save ou sessão ativa.
- Ajustada a paleta visual dos menus para tons mais escuros, frios e cinematográficos.
- Mantidos os IDs usados pelo JavaScript para não quebrar o fluxo existente.

## Aplicação

Extrair este patch na raiz do projeto e substituir os arquivos existentes.
