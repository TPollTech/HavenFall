# HavenFall — Phaser Visual Layer V1

Este pacote aplica a primeira fatia segura da migração Phaser:

- Phaser fica **opcional** via `?phaser=1` ou `localStorage.setItem('havenfall:phaser', '1')`.
- A simulação, save/load, pathfinding, estado, HUD, câmera e input antigo continuam no HavenFall.
- O Phaser renderiza **somente o terreno**.
- O Canvas antigo fica por cima em modo híbrido para objetos, colonos, overlays, fog, chuva, preview de construção e input.
- Se Phaser não carregar, o jogo continua no renderer Canvas padrão.

## Como aplicar

No Windows PowerShell, dentro da pasta do HavenFall:

```powershell
cd "C:\Projetos git\HavenFall"
node "CAMINHO_DO_ZIP_EXTRAIDO\apply-phaser-v1.cjs" .
npm install
npm run check:types
npm run test:logic
npm run test:smoke
```

Teste manual:

```powershell
npm run web
```

Abra:

```txt
http://localhost:5173/?phaser=1
```

## Smoke opcional do Phaser

Depois de `npm install`, pode rodar:

```powershell
node tests/smoke-phaser.mjs
```

## Commit recomendado

```powershell
git status
git add package.json package-lock.json index.html src/styles.css src/game/boot.js src/game/runtime/game-loop.js src/game/rendering/renderer.js src/game/rendering/phaser tests/smoke-phaser.mjs
git commit -m "Add optional Phaser terrain renderer"
git push origin main
```

## Arquivos criados

```txt
src/game/rendering/phaser/phaser-engine.js
src/game/rendering/phaser/havenfall-scene.js
src/game/rendering/phaser/asset-loader.js
src/game/rendering/phaser/world-layer.js
src/game/rendering/phaser/input-bridge.js
tests/smoke-phaser.mjs
```

## Arquivos alterados pelo script

```txt
package.json
index.html
src/styles.css
src/game/boot.js
src/game/runtime/game-loop.js
src/game/rendering/renderer.js
```

## Observação importante

O script é idempotente: se rodar uma segunda vez, ele tenta não duplicar os blocos já aplicados.
