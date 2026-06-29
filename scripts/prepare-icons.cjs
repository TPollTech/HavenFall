'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'logo.png');
const outDir = path.join(root, 'build');
const out = path.join(outDir, 'icon.ico');
const ICON_SIZE = 256;

function nearestResizePng(input, size = ICON_SIZE) {
  const png = PNG.sync.read(input);
  const output = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    const sy = Math.min(png.height - 1, Math.floor((y / size) * png.height));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(png.width - 1, Math.floor((x / size) * png.width));
      const src = (sy * png.width + sx) * 4;
      const dst = (y * size + x) * 4;
      output.data[dst] = png.data[src];
      output.data[dst + 1] = png.data[src + 1];
      output.data[dst + 2] = png.data[src + 2];
      output.data[dst + 3] = png.data[src + 3] ?? 255;
    }
  }
  return PNG.sync.write(output);
}

function icoFromPng(pngBuffer, size = ICON_SIZE) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

function main() {
  if (!fs.existsSync(source)) {
    console.error(`[icons] logo não encontrada: ${source}`);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const input = fs.readFileSync(source);
  const png = nearestResizePng(input, ICON_SIZE);
  fs.writeFileSync(out, icoFromPng(png, ICON_SIZE));
  console.log(`[icons] ícone Windows gerado em ${path.relative(root, out)}`);
}

main();
