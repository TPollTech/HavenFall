'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [
  ['package.json', 'package.json'],
  ['electron-main.cjs', 'electron-main.cjs'],
  ['electron-preload.cjs', 'electron-preload.cjs'],
  ['index.html', 'index.html'],
  ['save-load.js', 'src/game/save-load.js'],
  ['node_modules/electron', 'node_modules/electron']
];

let ok = true;
console.log('\nHavenFall Desktop Doctor');
console.log('='.repeat(32));
console.log(`Node: ${process.version}`);
console.log(`Pasta: ${root}`);
console.log('');

for (const [label, rel] of checks) {
  const full = path.join(root, rel);
  const exists = fs.existsSync(full);
  if (!exists) ok = false;
  console.log(`${exists ? 'OK ' : 'ERRO'} ${label}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  console.log('');
  console.log(`Main: ${pkg.main || '(ausente)'}`);
  console.log(`Script desktop: ${pkg.scripts?.desktop || '(ausente)'}`);
  console.log(`Electron dep: ${pkg.devDependencies?.electron || '(ausente)'}`);
} catch (error) {
  ok = false;
  console.log(`ERRO lendo package.json: ${error.message}`);
}

console.log('');
if (ok) {
  console.log('Diagnóstico básico OK. Rode: npm.cmd run desktop');
  process.exit(0);
}
console.log('Diagnóstico encontrou problemas. Rode: npm.cmd install');
process.exit(1);
