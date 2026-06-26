# Assets brutos

Esta pasta guarda artes brutas ainda não recortadas.

O jogo **não deve carregar estes arquivos diretamente** no runtime.

## Fluxo correto

1. Separar/recortar o asset bruto em sprites individuais.
2. Exportar cada sprite final para a pasta carregada pelo jogo, normalmente `assets/sprites`.
3. Nomear em kebab/código consistente com o motor, por exemplo:
   - `rabbit`
   - `spider`
   - `oak_tree`
   - `pine_tree`
   - `sewing_table`
   - `handcart`
4. Adicionar o nome no `assetNames`, em `src/game/state.js`.
5. Atualizar o mapeamento em `src/game/asset-audit.js`, caso o nome final seja diferente.

## Importante

Enquanto o sprite não for recortado/exportado, o motor usa fallback visual seguro para não quebrar a renderização.

Exemplo:

```txt
rabbit ainda não recortado -> fallback temporário
rabbit recortado e adicionado em assetNames -> sprite real passa a carregar
```
