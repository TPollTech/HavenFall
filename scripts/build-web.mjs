import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const COPY_FILES = [
  'index.html',
  'logo.png',
  'menu.png',
  'package.json',
];

const COPY_DIRS = [
  'assets',
  'src',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Building web assets...');
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

for (const file of COPY_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
    console.log(`  copied ${file}`);
  }
}

for (const dir of COPY_DIRS) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) {
    copyRecursive(src, path.join(DIST, dir));
    console.log(`  copied ${dir}/`);
  }
}

console.log('Build complete:', DIST);