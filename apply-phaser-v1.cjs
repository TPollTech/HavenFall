#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const packageRoot = __dirname;
const sourceRoot = path.join(packageRoot, 'files');

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function write(file, content) {
  fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, file), content, 'utf8');
  console.log(`alterado: ${file}`);
}

function ensureRepoRoot() {
  const pkgPath = path.join(repoRoot, 'package.json');
  const statePath = path.join(repoRoot, 'src/game/state.js');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(statePath)) {
    throw new Error(`Pasta inválida. Rode dentro da raiz do HavenFall ou passe o caminho: node apply-phaser-v1.cjs C:\\Projetos git\\HavenFall`);
  }
}

function copyDir(src, dstRelative) {
  const dst = path.join(repoRoot, dstRelative);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, path.join(dstRelative, entry.name));
    else {
      fs.copyFileSync(srcPath, dstPath);
      console.log(`alterado: ${path.relative(repoRoot, dstPath).replace(/\\/g, '/')}`);
    }
  }
}

function patchPackageJson() {
  const file = 'package.json';
  const pkg = JSON.parse(read(file));
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies.phaser) pkg.dependencies.phaser = '^3.90.0';
  pkg.build = pkg.build || {};
  pkg.build.files = Array.isArray(pkg.build.files) ? pkg.build.files : [];
  if (!pkg.build.files.includes('node_modules/phaser/dist/phaser.min.js')) {
    const idx = pkg.build.files.indexOf('electron-main.cjs');
    if (idx >= 0) pkg.build.files.splice(idx, 0, 'node_modules/phaser/dist/phaser.min.js');
    else pkg.build.files.push('node_modules/phaser/dist/phaser.min.js');
  }
  write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

function patchIndexHtml() {
  const file = 'index.html';
  let content = read(file);
  if (content.includes('id="phaserGameLayer"')) {
    console.log('ok: index.html já possui phaserGameLayer');
    return;
  }

  const oldInline = '<section class="gameplay-viewport" aria-label="Área de gameplay"><canvas id="game" aria-label="Mapa do jogo"></canvas></section>';
  const next = `<section class="gameplay-viewport" aria-label="Área de gameplay">\n          <div id="phaserGameLayer" aria-hidden="true"></div>\n          <canvas id="game" aria-label="Mapa do jogo"></canvas>\n        </section>`;
  if (content.includes(oldInline)) {
    content = content.replace(oldInline, next);
    write(file, content);
    return;
  }

  content = content.replace(/<section class="gameplay-viewport"([^>]*)>\s*<canvas id="game"([^>]*)><\/canvas>\s*<\/section>/, '<section class="gameplay-viewport"$1>\n          <div id="phaserGameLayer" aria-hidden="true"></div>\n          <canvas id="game"$2></canvas>\n        </section>');
  if (!content.includes('id="phaserGameLayer"')) throw new Error('Não consegui inserir #phaserGameLayer em index.html.');
  write(file, content);
}

function patchStylesCss() {
  const file = 'src/styles.css';
  let content = read(file);
  if (content.includes('Phaser Visual Layer V1')) {
    console.log('ok: src/styles.css já possui bloco Phaser Visual Layer V1');
    return;
  }

  content += `\n\n/* Phaser Visual Layer V1 */\n.gameplay-viewport {\n  position: absolute;\n  inset: 0;\n  overflow: hidden;\n  background: #05070b;\n}\n\n#phaserGameLayer,\n#game {\n  position: absolute;\n  inset: 0;\n}\n\n#phaserGameLayer {\n  z-index: 1;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  pointer-events: none;\n  opacity: 0;\n  background: #070b11;\n}\n\n#phaserGameLayer canvas {\n  display: block;\n  width: 100% !important;\n  height: 100% !important;\n}\n\n#game {\n  z-index: 2;\n  display: block;\n  width: 100%;\n  height: 100%;\n  touch-action: none;\n  image-rendering: auto;\n  background: transparent;\n}\n\nbody.phaser-visual-active #phaserGameLayer {\n  opacity: 1;\n}\n\nbody.phaser-visual-active #game {\n  background: transparent;\n}\n`;
  write(file, content);
}

function patchBootJs() {
  const file = 'src/game/boot.js';
  let content = read(file);
  if (content.includes("['phaser_engine','src/game/rendering/phaser/phaser-engine.js']")) {
    console.log('ok: boot.js já possui camada Phaser');
    return;
  }

  const needle = "        ['renderer','src/game/rendering/renderer.js'],";
  const insert = `${needle}\n        ['phaser_input_bridge','src/game/rendering/phaser/input-bridge.js'],\n        ['phaser_asset_loader','src/game/rendering/phaser/asset-loader.js'],\n        ['phaser_world_layer','src/game/rendering/phaser/world-layer.js'],\n        ['phaser_scene','src/game/rendering/phaser/havenfall-scene.js'],\n        ['phaser_engine','src/game/rendering/phaser/phaser-engine.js'],`;
  if (!content.includes(needle)) throw new Error('Não encontrei a entrada renderer em boot.js.');
  content = content.replace(needle, insert);
  content = content.replace("renderer: 'Preparando renderização',", "renderer: 'Preparando renderização',\n    phaser_engine: 'Preparando camada visual Phaser',");
  write(file, content);
}

function patchRendererJs() {
  const file = 'src/game/rendering/renderer.js';
  let content = read(file);
  if (content.includes('function draw(options = {})')) {
    console.log('ok: renderer.js já possui draw híbrido');
    return;
  }

  const headerOld = `function draw() {\n  resizeGameCanvas();\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  ctx.fillStyle = '#070b11';\n  ctx.fillRect(0, 0, canvas.width, canvas.height);\n\n  ctx.save();`;
  const headerNew = `function draw(options = {}) {\n  const skipTerrain = !!options?.skipTerrain;\n  resizeGameCanvas();\n  ctx.clearRect(0, 0, canvas.width, canvas.height);\n  if (!skipTerrain) {\n    ctx.fillStyle = '#070b11';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n  }\n\n  ctx.save();`;
  if (!content.includes(headerOld)) throw new Error('Não encontrei o cabeçalho original de draw() em renderer.js.');
  content = content.replace(headerOld, headerNew);

  const terrainOld = `  const bounds = visibleTileBounds(2);\n  for (let y = bounds.startY; y <= bounds.endY; y++) {\n    const row = state.terrain[y];\n    if (!row) continue;\n    for (let x = bounds.startX; x <= bounds.endX; x++) drawTile(x, y, row[x] || 'grass');\n  }`;
  const terrainNew = `  const bounds = visibleTileBounds(skipTerrain ? 3 : 2);\n  if (!skipTerrain) {\n    for (let y = bounds.startY; y <= bounds.endY; y++) {\n      const row = state.terrain[y];\n      if (!row) continue;\n      for (let x = bounds.startX; x <= bounds.endX; x++) drawTile(x, y, row[x] || 'grass');\n    }\n  }`;
  if (!content.includes(terrainOld)) throw new Error('Não encontrei o bloco de terreno original em renderer.js.');
  content = content.replace(terrainOld, terrainNew);
  write(file, content);
}

function patchGameLoopJs() {
  const file = 'src/game/runtime/game-loop.js';
  let content = read(file);
  if (content.includes("runLoopStep('phaser-sync'")) {
    console.log('ok: game-loop.js já possui sync Phaser');
    return;
  }

  const oldLine = "    runLoopStep('draw', draw);";
  const newBlock = `    const phaserActive = !!window.HavenfallPhaser?.isActive?.();\n    if (phaserActive) {\n      runLoopStep('phaser-sync', () => window.HavenfallPhaser.sync(state));\n      runLoopStep('draw-hybrid', () => draw({ skipTerrain: true }));\n    } else {\n      runLoopStep('phaser-start', () => window.HavenfallPhaser?.sync?.(state));\n      if (window.HavenfallPhaser?.isActive?.()) {\n        runLoopStep('draw-hybrid', () => draw({ skipTerrain: true }));\n      } else {\n        runLoopStep('draw', draw);\n      }\n    }`;
  if (!content.includes(oldLine)) throw new Error('Não encontrei chamada runLoopStep draw em game-loop.js.');
  content = content.replace(oldLine, newBlock);
  write(file, content);
}

function copyNewFiles() {
  copyDir(path.join(sourceRoot, 'src'), 'src');
  copyDir(path.join(sourceRoot, 'tests'), 'tests');
}

function main() {
  ensureRepoRoot();
  copyNewFiles();
  patchPackageJson();
  patchIndexHtml();
  patchStylesCss();
  patchBootJs();
  patchRendererJs();
  patchGameLoopJs();
  console.log('\nPhaser Visual Layer V1 aplicado. Rode: npm install && npm run check:types && npm run test:logic && npm run test:smoke');
  console.log('Teste opcional Phaser: npm run web e abra http://localhost:5173/?phaser=1');
}

main();
