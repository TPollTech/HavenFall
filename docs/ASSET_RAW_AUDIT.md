# Auditoria de Assets RAW — HavenFall

Gerado por `node assets/audit-raw-assets.cjs`.

## Resumo

- RAW encontrados: **21**
- Sprites finais em assets/{mobs,tiles,vfx,ui}: **231**
- Assets declarados em assetNames: **101**
- assetNames sem PNG/SVG correspondente: **0**
- RAW provavelmente ainda pendentes: **21**

## AssetNames sem arquivo final correspondente

- Nenhum.

## RAW provavelmente pendentes de separar/implementar

- `assets/raw/2d_rpg_sprite_sheet_and_assets.png` — spritesheet / pack bruto
- `assets/raw/cartoon_rpg_character_sprite_sheet.png` — spritesheet / pack bruto
- `assets/raw/ChatGPT Image 24 de jun. de 2026, 22_20_24 (1).png` — raw não classificado
- `assets/raw/ChatGPT Image 24 de jun. de 2026, 22_20_24 (2).png` — raw não classificado
- `assets/raw/ChatGPT Image 24 de jun. de 2026, 22_20_24 (3).png` — raw não classificado
- `assets/raw/ChatGPT Image 24 de jun. de 2026, 22_20_24 (4).png` — raw não classificado
- `assets/raw/ChatGPT Image 25 de jun. de 2026, 22_13_44 (1).png` — raw não classificado
- `assets/raw/ChatGPT Image 25 de jun. de 2026, 22_13_45 (2).png` — raw não classificado
- `assets/raw/ChatGPT Image 25 de jun. de 2026, 22_13_45 (3).png` — raw não classificado
- `assets/raw/ChatGPT Image 25 de jun. de 2026, 22_13_45 (4).png` — raw não classificado
- `assets/raw/colonist_equipped_raw_v19b.png` — spritesheet / pack bruto
- `assets/raw/colorful_hand_painted_game_icon_collection.png` — raw não classificado
- `assets/raw/creature_sprite_sheet_with_various_animals.png` — spritesheet / pack bruto
- `assets/raw/hand_painted_game_terrain_tileset.png` — terreno/tile
- `assets/raw/medieval_fantasy_interior_furniture_icons.png` — construção/estação
- `assets/raw/modular_medieval_building_tiles_sprite_sheet.png` — spritesheet / pack bruto
- `assets/raw/nature_and_survival_resource_icons (1).png` — raw não classificado
- `assets/raw/resources_raw_v19b.png` — spritesheet / pack bruto
- `assets/raw/stations_raw_v19b.png` — spritesheet / pack bruto
- `assets/raw/survival_crafting_game_asset_collection.png` — raw não classificado
- `assets/raw/tools_weapons_raw_v19b.png` — spritesheet / pack bruto

## RAW provavelmente já cobertos por sprites finais

- Nenhum detectado.

## Próximo passo recomendado

1. Abrir cada RAW pendente.
2. Recortar/exportar cada sprite individual em `assets/mobs`, `assets/tiles`, `assets/vfx` ou `assets/ui`.
3. Nomear exatamente igual ao `assetNames` quando o sprite for usado pelo jogo.
4. Para spritesheets de personagem, exportar no padrão `colonistX_down_0`, `colonistX_down_1`, etc.
5. Rodar este auditor de novo até zerar os pendentes importantes.
