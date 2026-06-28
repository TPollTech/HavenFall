import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PNG } from 'pngjs';

const root = process.cwd();
const assetsDir = path.join(root, 'assets');
const rawDir = path.join(assetsDir, 'raw');
const legacySpritesDir = path.join(assetsDir, 'sprites');
const generatedDir = path.join(assetsDir, 'generated');
const categories = ['mobs', 'tiles', 'vfx', 'ui'];
const categoryDirs = Object.fromEntries(categories.map(category => [category, path.join(assetsDir, category)]));

const rawSliceConfigPath = path.join(rawDir, 'slices.json');
const manifestJsonPath = path.join(assetsDir, 'manifest.json');
const manifestJsPath = path.join(assetsDir, 'manifest.js');
const rawSliceMapPath = path.join(generatedDir, 'raw-slice-map.json');

const imageExtensions = new Set(['.png']);
const manifestExtensions = new Set(['.png', '.svg']);
const gifExtensions = new Set(['.gif']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function relativeAssetPath(filePath) {
  return toPosix(path.relative(root, filePath));
}

function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_') || 'asset';
}

function runtimeKeyFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function readPng(file) {
  return PNG.sync.read(await readFile(file));
}

async function writePng(file, png) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, PNG.sync.write(png));
}

function cropPng(source, left, top, width, height) {
  const output = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = left + x;
      const srcY = top + y;
      if (srcX < 0 || srcY < 0 || srcX >= source.width || srcY >= source.height) continue;
      const srcIndex = (srcY * source.width + srcX) * 4;
      const dstIndex = (y * width + x) * 4;
      source.data.copy(output.data, dstIndex, srcIndex, srcIndex + 4);
    }
  }
  return output;
}

function categorize(filePath) {
  const name = runtimeKeyFromFile(filePath).toLowerCase();
  const rel = toPosix(path.relative(assetsDir, filePath)).toLowerCase();

  if (
    name.startsWith('tile_') ||
    rel.includes('/tiles/') ||
    rel.includes('/edificios/tile_') ||
    ['grass', 'dirt', 'sand', 'stone'].some(token => name.includes(`tile_${token}`))
  ) return 'tiles';

  if (
    name.startsWith('wolf_') ||
    name.startsWith('colonist') ||
    rel.includes('/personagens/') ||
    ['rabbit', 'spider', 'mob', 'animal', 'creature', 'lobo', 'wolf'].some(token => name.includes(token))
  ) return 'mobs';

  if (
    ['fire', 'fogo', 'flame', 'torch', 'tocha', 'campfire', 'fogueira', 'stove', 'fogao', 'brazier', 'cauldron'].some(token => name.includes(token))
  ) return 'vfx';

  return 'ui';
}

function svgWall(material, shape, colors) {
  const dirs = {
    end_n: ['M48 48 L48 8'],
    end_e: ['M48 48 L88 48'],
    end_s: ['M48 48 L48 88'],
    end_w: ['M48 48 L8 48'],
    straight_horizontal: ['M8 48 L88 48'],
    straight_vertical: ['M48 8 L48 88'],
    corner_ne: ['M48 48 L48 8', 'M48 48 L88 48'],
    corner_nw: ['M48 48 L48 8', 'M48 48 L8 48'],
    corner_se: ['M48 48 L48 88', 'M48 48 L88 48'],
    corner_sw: ['M48 48 L48 88', 'M48 48 L8 48'],
    t_n: ['M8 48 L88 48', 'M48 48 L48 88'],
    t_e: ['M48 8 L48 88', 'M48 48 L8 48'],
    t_s: ['M8 48 L88 48', 'M48 48 L48 8'],
    t_w: ['M48 8 L48 88', 'M48 48 L88 48'],
    cross: ['M8 48 L88 48', 'M48 8 L48 88']
  };
  const paths = dirs[shape] || dirs.cross;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="none"/>
  <g stroke="${colors.stroke}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</g>
  <g stroke="${colors.fill}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</g>
  <g stroke="${colors.light}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".72">${paths.map(d => `<path d="${d}"/>`).join('')}</g>
  <circle cx="48" cy="48" r="11" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="3"/>
  <text x="48" y="88" text-anchor="middle" font-family="monospace" font-size="7" fill="${colors.stroke}" opacity=".42">${material}</text>
</svg>
`;
}

function svgDoor(material, open, colors) {
  const door = open
    ? '<path d="M24 50 L69 23" stroke-linecap="round"/><path d="M24 50 A38 38 0 0 1 62 12" fill="none" stroke-width="4" opacity=".55"/>'
    : '<path d="M18 48 L78 48" stroke-linecap="round"/><circle cx="61" cy="44" r="3" fill="#fff2b8" stroke="none"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="none"/>
  <g stroke="${colors.stroke}" stroke-width="24" stroke-linejoin="round">${door}</g>
  <g stroke="${colors.fill}" stroke-width="18" stroke-linejoin="round">${door}</g>
  <path d="M12 48 L25 48 M71 48 L84 48" stroke="${colors.stroke}" stroke-width="10" stroke-linecap="round"/>
  <text x="48" y="88" text-anchor="middle" font-family="monospace" font-size="7" fill="${colors.stroke}" opacity=".42">${material}</text>
</svg>
`;
}

function svgMountain(shape) {
  const notch = {
    mountain_edge_n: 'M6 18 L30 8 L55 15 L90 9 L90 90 L6 90 Z',
    mountain_edge_e: 'M6 6 L72 6 L90 30 L82 58 L90 88 L6 90 Z',
    mountain_edge_s: 'M6 6 L90 6 L90 72 L65 89 L36 80 L7 90 Z',
    mountain_edge_w: 'M24 6 L90 6 L90 90 L24 90 L7 61 L15 35 L6 12 Z',
    mountain_corner_ne: 'M6 18 L32 6 L72 8 L90 28 L90 90 L6 90 Z',
    mountain_corner_nw: 'M8 29 L27 8 L90 8 L90 90 L7 90 Z',
    mountain_corner_se: 'M6 6 L90 6 L90 70 L69 90 L6 90 Z',
    mountain_corner_sw: 'M6 6 L90 6 L90 90 L27 89 L7 69 Z',
    mountain_inner: 'M5 5 L91 5 L91 91 L5 91 Z'
  }[shape] || 'M5 5 L91 5 L91 91 L5 91 Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="none"/>
  <path d="${notch}" fill="#4b5563" stroke="#111827" stroke-width="3" stroke-linejoin="round"/>
  <path d="M14 68 C30 60 47 72 64 63 C74 58 83 62 90 66 L90 91 L6 91 L6 73 C9 71 11 70 14 68 Z" fill="#111827" opacity=".28"/>
  <path d="M18 22 L42 15 M50 22 L78 16 M24 44 L66 38" stroke="#9ca3af" stroke-width="4" stroke-linecap="round" opacity=".28"/>
</svg>
`;
}

async function ensureProceduralRoadmapAssets() {
  const materialColors = {
    wood: { fill: '#9a6439', stroke: '#3f2414', light: '#d9a465' },
    stone: { fill: '#747b84', stroke: '#303740', light: '#b8c0c9' },
    metal: { fill: '#607080', stroke: '#1f2933', light: '#a8c7dd' }
  };
  const wallShapes = ['end_n', 'end_e', 'end_s', 'end_w', 'straight_horizontal', 'straight_vertical', 'corner_ne', 'corner_nw', 'corner_se', 'corner_sw', 't_n', 't_e', 't_s', 't_w', 'cross'];
  const mountainShapes = ['mountain_edge_n', 'mountain_edge_e', 'mountain_edge_s', 'mountain_edge_w', 'mountain_corner_ne', 'mountain_corner_nw', 'mountain_corner_se', 'mountain_corner_sw', 'mountain_inner'];
  const written = [];

  for (const [material, colors] of Object.entries(materialColors)) {
    for (const shape of wallShapes) {
      const file = path.join(categoryDirs.ui, `wall_${material}_${shape}.svg`);
      if (!existsSync(file)) {
        await writeFile(file, svgWall(material, shape, colors));
        written.push(relativeAssetPath(file));
      }
    }
    for (const state of ['closed', 'open']) {
      const file = path.join(categoryDirs.ui, `door_${material}_${state}.svg`);
      if (!existsSync(file)) {
        await writeFile(file, svgDoor(material, state === 'open', colors));
        written.push(relativeAssetPath(file));
      }
    }
  }

  for (const shape of mountainShapes) {
    const file = path.join(categoryDirs.tiles, `${shape}.svg`);
    if (!existsSync(file)) {
      await writeFile(file, svgMountain(shape));
      written.push(relativeAssetPath(file));
    }
  }

  return written;
}

async function ensureDirs() {
  await mkdir(assetsDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });
  for (const dir of Object.values(categoryDirs)) await mkdir(dir, { recursive: true });
}

async function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function uniquePath(targetPath) {
  if (!existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let index = 2;
  while (true) {
    const next = path.join(dir, `${base}_${index}${ext}`);
    if (!existsSync(next)) return next;
    index += 1;
  }
}

async function moveExistingSprites() {
  const moved = [];
  const files = (await walkFiles(legacySpritesDir))
    .filter(file => imageExtensions.has(path.extname(file).toLowerCase()));

  for (const file of files) {
    const category = categorize(file);
    const parent = path.basename(path.dirname(file));
    const baseName = path.basename(file);
    const prefix = parent !== 'sprites' && parent !== category ? `${slugify(parent)}_` : '';
    const target = await uniquePath(path.join(categoryDirs[category], `${prefix}${baseName}`));

    if (path.resolve(file) === path.resolve(target)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await rename(file, target);
    moved.push({ from: relativeAssetPath(file), to: relativeAssetPath(target), category });
  }

  return moved;
}

async function moveLegacySpriteMetadata() {
  if (!existsSync(legacySpritesDir)) return [];
  const moved = [];
  const files = (await walkFiles(legacySpritesDir))
    .filter(file => ['.json', '.js'].includes(path.extname(file).toLowerCase()));

  for (const file of files) {
    const ext = path.extname(file);
    const base = slugify(path.basename(file, ext));
    const target = await uniquePath(path.join(generatedDir, `legacy_${base}${ext}`));
    await rename(file, target);
    moved.push({ from: relativeAssetPath(file), to: relativeAssetPath(target) });
  }

  return moved;
}

async function loadSliceConfig() {
  if (!existsSync(rawSliceConfigPath)) return {};
  return JSON.parse(await readFile(rawSliceConfigPath, 'utf8'));
}

function configuredSheets(config) {
  if (Array.isArray(config.sheets)) return config.sheets;
  return Object.entries(config).map(([file, value]) => ({ file, ...value }));
}

function frameName(sheet, index) {
  if (Array.isArray(sheet.names) && sheet.names[index]) return sheet.names[index];
  const startIndex = Number(sheet.startIndex ?? 1);
  const pad = Number(sheet.pad ?? 2);
  return `${slugify(sheet.prefix || path.basename(sheet.file, path.extname(sheet.file)))}_${String(startIndex + index).padStart(pad, '0')}.png`;
}

async function sliceConfiguredRaw(config) {
  const outputs = [];
  for (const sheet of configuredSheets(config)) {
    if (!sheet.file) continue;
    const input = path.join(rawDir, sheet.file);
    if (!existsSync(input)) continue;

    const frameWidth = Number(sheet.frameWidth || sheet.width);
    const frameHeight = Number(sheet.frameHeight || sheet.height);
    if (!frameWidth || !frameHeight) continue;

    const meta = await readPng(input);
    const marginX = Number(sheet.marginX ?? sheet.margin ?? 0);
    const marginY = Number(sheet.marginY ?? sheet.margin ?? 0);
    const gapX = Number(sheet.gapX ?? sheet.gap ?? 0);
    const gapY = Number(sheet.gapY ?? sheet.gap ?? 0);
    const columns = Number(sheet.columns || Math.floor((meta.width - marginX + gapX) / (frameWidth + gapX)));
    const rows = Number(sheet.rows || Math.floor((meta.height - marginY + gapY) / (frameHeight + gapY)));
    const limit = Number(sheet.frames || columns * rows);
    const category = categories.includes(sheet.category) ? sheet.category : categorize(sheet.file);
    const outDir = path.join(categoryDirs[category], slugify(sheet.outDir || sheet.prefix || path.basename(sheet.file, path.extname(sheet.file))));
    await mkdir(outDir, { recursive: true });

    for (let index = 0; index < limit; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const left = marginX + col * (frameWidth + gapX);
      const top = marginY + row * (frameHeight + gapY);
      if (left + frameWidth > meta.width || top + frameHeight > meta.height) continue;

      const output = path.join(outDir, frameName(sheet, index));
      await writePng(output, cropPng(meta, left, top, frameWidth, frameHeight));
      outputs.push({
        source: relativeAssetPath(input),
        path: relativeAssetPath(output),
        category,
        frame: index,
        box: [left, top, frameWidth, frameHeight]
      });
    }
  }
  return outputs;
}

async function convertGifToSheet(file) {
  const buffer = await readFile(file);
  const gif = parseGIF(buffer);
  const framesData = decompressFrames(gif, true);
  const frames = framesData.length;
  const frameWidth = Number(gif.lsd?.width || framesData[0]?.dims?.width);
  const frameHeight = Number(gif.lsd?.height || framesData[0]?.dims?.height);
  if (frames <= 1 || !frameWidth || !frameHeight) return null;

  const key = slugify(path.basename(file, path.extname(file)));
  const output = path.join(categoryDirs.vfx, `${key}_sheet.png`);
  const sheet = new PNG({ width: frameWidth * frames, height: frameHeight });
  const canvas = Buffer.alloc(frameWidth * frameHeight * 4);
  const delays = [];

  for (let frameIndex = 0; frameIndex < frames; frameIndex++) {
    const frame = framesData[frameIndex];
    delays.push(frame.delay || 100);

    for (let y = 0; y < frame.dims.height; y++) {
      for (let x = 0; x < frame.dims.width; x++) {
        const srcIndex = (y * frame.dims.width + x) * 4;
        const alpha = frame.patch[srcIndex + 3];
        if (alpha === 0) continue;
        const dstX = frame.dims.left + x;
        const dstY = frame.dims.top + y;
        if (dstX < 0 || dstY < 0 || dstX >= frameWidth || dstY >= frameHeight) continue;
        const dstIndex = (dstY * frameWidth + dstX) * 4;
        canvas[dstIndex] = frame.patch[srcIndex];
        canvas[dstIndex + 1] = frame.patch[srcIndex + 1];
        canvas[dstIndex + 2] = frame.patch[srcIndex + 2];
        canvas[dstIndex + 3] = alpha;
      }
    }

    for (let y = 0; y < frameHeight; y++) {
      const srcStart = y * frameWidth * 4;
      const dstStart = (y * sheet.width + frameIndex * frameWidth) * 4;
      canvas.copy(sheet.data, dstStart, srcStart, srcStart + frameWidth * 4);
    }
  }

  await writePng(output, sheet);

  return {
    key,
    path: relativeAssetPath(output),
    source: relativeAssetPath(file),
    frameWidth,
    frameHeight,
    frames,
    frameDelaysMs: delays,
    layout: 'horizontal'
  };
}

async function processRawGifs() {
  const files = (await walkFiles(rawDir)).filter(file => gifExtensions.has(path.extname(file).toLowerCase()));
  const animations = [];
  for (const file of files) {
    const converted = await convertGifToSheet(file);
    if (converted) animations.push(converted);
  }
  return animations;
}

function gridSuggestions(meta) {
  const candidates = [32, 48, 64, 96, 128, 192, 256];
  return candidates
    .filter(size => meta.width >= size && meta.height >= size)
    .map(size => ({
      frameWidth: size,
      frameHeight: size,
      columns: Math.floor(meta.width / size),
      rows: Math.floor(meta.height / size),
      frames: Math.floor(meta.width / size) * Math.floor(meta.height / size)
    }))
    .filter(entry => entry.columns > 1 && entry.rows > 1 && entry.frames > 1);
}

async function writeRawSliceMap(config, slicedOutputs) {
  const configured = new Set(configuredSheets(config).map(sheet => sheet.file));
  const files = (await walkFiles(rawDir)).filter(file => imageExtensions.has(path.extname(file).toLowerCase()));
  const sheets = [];

  for (const file of files) {
    const meta = await readPng(file);
    const filename = path.basename(file);
    sheets.push({
      file: relativeAssetPath(file),
      configured: configured.has(filename),
      width: meta.width,
      height: meta.height,
      format: 'png',
      suggestedCategory: categorize(filename),
      suggestions: gridSuggestions(meta).slice(0, 5)
    });
  }

  await writeFile(rawSliceMapPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: 'Configure assets/raw/slices.json para cortes automaticos. Este arquivo mostra dimensoes e grids candidatos.',
    configuredSlices: slicedOutputs,
    sheets
  }, null, 2));
}

async function collectManifest(animations) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    roots: {
      mobs: 'assets/mobs',
      tiles: 'assets/tiles',
      vfx: 'assets/vfx',
      ui: 'assets/ui',
      raw: 'assets/raw'
    },
    assets: {},
    animations: Object.fromEntries(animations.map(animation => [animation.key, animation]))
  };

  for (const category of categories) {
    const files = (await walkFiles(categoryDirs[category]))
      .filter(file => manifestExtensions.has(path.extname(file).toLowerCase()));
    for (const file of files) {
      const key = runtimeKeyFromFile(file);
      const rel = relativeAssetPath(file);
      if (!manifest.assets[key]) manifest.assets[key] = { path: rel, category };
    }
  }

  return manifest;
}

async function writeManifest(manifest) {
  await writeFile(manifestJsonPath, JSON.stringify(manifest, null, 2));
  const js = `'use strict';\n\n(() => {\n  const manifest = ${JSON.stringify(manifest, null, 2)};\n  window.HavenfallAssets = Object.freeze(manifest);\n  window.spriteSrc = function spriteSrc(name) {\n    return manifest.assets?.[name]?.path || \`assets/ui/\${name}.png\`;\n  };\n  window.assetInfo = function assetInfo(name) {\n    return manifest.assets?.[name] || null;\n  };\n  window.vfxAnimation = function vfxAnimation(name) {\n    return manifest.animations?.[name] || null;\n  };\n})();\n`;
  await writeFile(manifestJsPath, js);
}

async function cleanLegacySpritesDir() {
  if (!existsSync(legacySpritesDir)) return;
  const remaining = await walkFiles(legacySpritesDir);
  if (remaining.length === 0) await rm(legacySpritesDir, { recursive: true, force: true });
}

async function main() {
  await ensureDirs();
  const moved = await moveExistingSprites();
  const movedMetadata = await moveLegacySpriteMetadata();
  const procedural = await ensureProceduralRoadmapAssets();
  const sliceConfig = await loadSliceConfig();
  const sliced = await sliceConfiguredRaw(sliceConfig);
  const animations = await processRawGifs();
  await writeRawSliceMap(sliceConfig, sliced);
  const manifest = await collectManifest(animations);
  await writeManifest(manifest);
  await cleanLegacySpritesDir();

  console.info(`assets:process moved=${moved.length} metadata=${movedMetadata.length} procedural=${procedural.length} sliced=${sliced.length} animations=${animations.length} assets=${Object.keys(manifest.assets).length}`);
  console.info(`manifest: ${relativeAssetPath(manifestJsonPath)}`);
  console.info(`raw map: ${relativeAssetPath(rawSliceMapPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
