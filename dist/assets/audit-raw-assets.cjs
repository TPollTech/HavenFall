#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'assets', 'raw');
const FINAL_DIRS = ['mobs', 'tiles', 'vfx', 'ui'].map(dir => path.join(ROOT, 'assets', dir));
const GLOBALS_FILE = path.join(ROOT, 'src', 'game', 'state.js');
const OUT_DIR = path.join(ROOT, 'docs');
const OUT_FILE = path.join(OUT_DIR, 'ASSET_RAW_AUDIT.md');
const RAW_CUTOUT_MAP = path.join(ROOT, 'assets', 'generated', 'raw-cutouts.json');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function stem(file) {
  return path.basename(file, path.extname(file));
}

function imageFiles(dir) {
  return walk(dir).filter(file => IMAGE_EXTS.has(path.extname(file).toLowerCase()));
}

function readAssetNames() {
  if (!fs.existsSync(GLOBALS_FILE)) return [];
  const src = fs.readFileSync(GLOBALS_FILE, 'utf8');
  const match = src.match(/const\s+assetNames\s*=\s*\[([\s\S]*?)\];/);
  if (!match) return [];
  const names = [];
  const re = /['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(match[1]))) names.push(m[1]);
  return [...new Set(names)].sort();
}

function readRawCutouts() {
  if (!fs.existsSync(RAW_CUTOUT_MAP)) return new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(RAW_CUTOUT_MAP, 'utf8'));
    const map = new Map();
    for (const entry of parsed.entries || []) {
      map.set(entry.source, Number(entry.count || 0));
    }
    return map;
  } catch (_) {
    return new Map();
  }
}

function classifyRaw(file) {
  const name = stem(file).toLowerCase();
  const lowerPath = rel(file).toLowerCase();
  if (name.includes('sheet') || name.includes('spritesheet') || name.includes('pack') || name.includes('raw') || name.includes('atlas')) return 'spritesheet / pack bruto';
  if (lowerPath.includes('character') || lowerPath.includes('colonist') || lowerPath.includes('player')) return 'personagem/animação';
  if (lowerPath.includes('tool') || lowerPath.includes('weapon') || lowerPath.includes('item')) return 'item/ferramenta/arma';
  if (lowerPath.includes('tile') || lowerPath.includes('terrain') || lowerPath.includes('floor')) return 'terreno/tile';
  if (lowerPath.includes('build') || lowerPath.includes('station') || lowerPath.includes('furniture')) return 'construção/estação';
  return 'raw não classificado';
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function likelyImplemented(rawStem, spriteNames, assetNames) {
  const n = normalizeName(rawStem);
  const direct = spriteNames.has(n) || assetNames.has(n);
  if (direct) return true;
  for (const s of spriteNames) {
    if (s.includes(n) || n.includes(s)) return true;
  }
  return false;
}

function main() {
  const rawImages = imageFiles(RAW_DIR);
  const spriteImages = FINAL_DIRS.flatMap(dir => imageFiles(dir));
  const assetNames = readAssetNames();
  const rawCutouts = readRawCutouts();

  const spriteNames = new Set(spriteImages.map(file => normalizeName(stem(file))));
  const assetNameSet = new Set(assetNames.map(normalizeName));

  const implementedAssets = assetNames.map(name => {
    const found = spriteImages.find(file => normalizeName(stem(file)) === normalizeName(name));
    return { name, found };
  });

  const missingImplementedSprites = implementedAssets.filter(row => !row.found);

  const rawRows = rawImages.map(file => {
    const rawStem = stem(file);
    return {
      path: rel(file),
      name: rawStem,
      type: classifyRaw(file),
      cutouts: rawCutouts.get(rel(file)) || 0,
      probablyImplemented: likelyImplemented(rawStem, spriteNames, assetNameSet) || (rawCutouts.get(rel(file)) || 0) > 0
    };
  });

  const rawPending = rawRows.filter(row => !row.probablyImplemented);
  const rawProbablyDone = rawRows.filter(row => row.probablyImplemented);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const lines = [];
  lines.push('# Auditoria de Assets RAW — HavenFall');
  lines.push('');
  lines.push('Gerado por `node assets/audit-raw-assets.cjs`.');
  lines.push('');
  lines.push('## Resumo');
  lines.push('');
  lines.push(`- RAW encontrados: **${rawImages.length}**`);
  lines.push(`- Sprites finais em assets/{mobs,tiles,vfx,ui}: **${spriteImages.length}**`);
  lines.push(`- Assets declarados em assetNames: **${assetNames.length}**`);
  lines.push(`- assetNames sem PNG/SVG correspondente: **${missingImplementedSprites.length}**`);
  lines.push(`- RAW com recorte automático registrado: **${rawRows.filter(row => row.cutouts > 0).length}**`);
  lines.push(`- Recortes automáticos exportados: **${rawRows.reduce((sum, row) => sum + row.cutouts, 0)}**`);
  lines.push(`- RAW provavelmente ainda pendentes: **${rawPending.length}**`);
  lines.push('');

  lines.push('## AssetNames sem arquivo final correspondente');
  lines.push('');
  if (!missingImplementedSprites.length) lines.push('- Nenhum.');
  else missingImplementedSprites.forEach(row => lines.push(`- \`${row.name}\` -> esperado no manifest gerado por \`npm run assets:process\``));
  lines.push('');

  lines.push('## RAW provavelmente pendentes de separar/implementar');
  lines.push('');
  if (!rawPending.length) lines.push('- Nenhum RAW pendente detectado pelo nome.');
  else rawPending.forEach(row => lines.push(`- \`${row.path}\` — ${row.type}`));
  lines.push('');

  lines.push('## RAW provavelmente já cobertos por sprites finais');
  lines.push('');
  if (!rawProbablyDone.length) lines.push('- Nenhum detectado.');
  else rawProbablyDone.forEach(row => lines.push(`- \`${row.path}\` — ${row.type}${row.cutouts ? ` — ${row.cutouts} recorte(s)` : ''}`));
  lines.push('');

  lines.push('## Próximo passo recomendado');
  lines.push('');
  if (!rawPending.length) {
    lines.push('1. Usar os recortes em `assets/{mobs,tiles,vfx,ui}/recortes/` conforme forem integrados no jogo.');
    lines.push('2. Quando um recorte virar asset oficial, renomear para uma chave clara e mover para a pasta final principal da categoria.');
    lines.push('3. Rodar `npm run assets:process` para atualizar o manifest.');
  } else {
    lines.push('1. Abrir cada RAW pendente.');
    lines.push('2. Recortar/exportar cada sprite individual em `assets/mobs`, `assets/tiles`, `assets/vfx` ou `assets/ui`.');
    lines.push('3. Nomear exatamente igual ao `assetNames` quando o sprite for usado pelo jogo.');
    lines.push('4. Para spritesheets de personagem, exportar no padrão `colonistX_down_0`, `colonistX_down_1`, etc.');
    lines.push('5. Rodar este auditor de novo até zerar os pendentes importantes.');
  }
  lines.push('');

  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

  console.log(`Auditoria gerada em ${rel(OUT_FILE)}`);
  console.log(`RAW: ${rawImages.length}`);
  console.log(`Sprites finais: ${spriteImages.length}`);
  console.log(`assetNames sem arquivo final: ${missingImplementedSprites.length}`);
  console.log(`RAW com recorte automático: ${rawRows.filter(row => row.cutouts > 0).length}`);
  console.log(`Recortes automáticos exportados: ${rawRows.reduce((sum, row) => sum + row.cutouts, 0)}`);
  console.log(`RAW pendentes prováveis: ${rawPending.length}`);
}

main();
