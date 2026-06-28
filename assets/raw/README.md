# Assets raw

Esta pasta guarda spritesheets e artes brutas que ainda nao devem ser carregadas diretamente pelo jogo.

## Fluxo atual

1. Adicione o arquivo bruto em `assets/raw`.
2. Se for GIF animado, rode `npm run assets:process`; ele sera convertido para spritesheet horizontal em `assets/vfx`.
3. Se for PNG em grid fixo, configure `assets/raw/slices.json` usando `slices.example.json` como base.
4. Rode `npm run assets:process`.
5. O script atualiza `assets/manifest.js` e `assets/manifest.json`.

O runtime carrega sprites por chave via `spriteSrc(name)`, usando estes destinos:

- `assets/mobs`
- `assets/tiles`
- `assets/vfx`
- `assets/ui`

## Quando nao houver config de corte

O script gera `assets/generated/raw-slice-map.json` com dimensoes e sugestoes de grid para cada PNG raw. Use esse arquivo como apoio para preencher `slices.json`.

## Exemplo rapido

```json
{
  "sheets": [
    {
      "file": "meu_lobo.png",
      "category": "mobs",
      "prefix": "lobo_walk",
      "frameWidth": 64,
      "frameHeight": 64,
      "columns": 4,
      "rows": 1,
      "frames": 4
    }
  ]
}
```
