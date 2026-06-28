# Política oficial de assets do HavenFall

## Regra principal

O runtime do HavenFall deve carregar PNG apenas quando o asset for natureza, terreno orgânico ou detalhe natural.

Todo asset de gameplay modular deve ser desenhado em JS/procedural.

## Mantém PNG no runtime

- Tiles orgânicos de terreno.
- Árvores.
- Arbustos.
- Rochas naturais.
- Toras.
- Frutas/plantas.
- Recortes de terreno pintado que representem solo/bioma.

Exemplos:

```txt
tile_grass
tile_dirt
tile_sand
tile_stone
tree
bush
rock
logs
berry
crop_patch
edificios_tile_*
hand_painted_game_terrain_tileset_cut_*
```

## Não mantém PNG no runtime

Essas categorias devem ser JS/procedural ou UI puramente DOM/CSS:

- Colonos.
- NPCs.
- Animais.
- Inimigos.
- Paredes.
- Portas.
- Cama.
- Caixas.
- Fogueira.
- Bancadas.
- Forja/fogão/estações.
- Ferramentas e armas.
- Ícones do HUD.
- Recortes antigos de spritesheets genéricas.
- Tiles modulares de construção medieval.

## Sistemas que seguem essa política

```txt
src/game/core/asset-policy.js
src/game/rendering/pawns/colonist-renderer.js
src/game/rendering/pawns/animal-renderer.js
src/game/rendering/pawns/hostile-renderer.js
src/game/rendering/simple-object-renderer.js
src/game/rendering/workstations/workstation-renderer.js
src/game/rendering/wall-door-renderer.js
```

## Como conferir no navegador

No console:

```js
window.HavenfallAssetPolicy.report()
```

Para ver só os PNG que continuam permitidos no runtime:

```js
window.HavenfallAssetPolicy.report().filter(a => a.keepPngRuntime)
```

Para ver o que virou JS/procedural ou não deve ser carregado:

```js
window.HavenfallAssetPolicy.report().filter(a => !a.keepPngRuntime)
```

## Observação importante

Arquivos antigos podem continuar no repositório enquanto ainda servirem como fonte/backup visual, mas não devem ser carregados automaticamente no runtime se estiverem classificados como `JS_PROCEDURAL_OR_UNUSED`.

A remoção física dos PNGs antigos deve ser feita em etapa separada, depois de confirmar que nenhum sistema ainda depende deles.
