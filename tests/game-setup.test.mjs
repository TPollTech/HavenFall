import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function runBrowserScript(path, context) {
  const code = readFileSync(path, 'utf8');
  vm.runInContext(code, context, { filename: path });
}

function createContext(extra = {}) {
  const context = vm.createContext({ console, ...extra });
  context.window = context;
  return context;
}

test('Game setup summary renders without recursive overflow', () => {
  const mapSizeInput = {
    value: 'giant',
    options: [
      { value: 'large', textContent: '' },
      { value: 'huge', textContent: '' },
      { value: 'giant', textContent: '' },
      { value: 'infinite_chunks', textContent: '' }
    ]
  };
  const context = createContext({
    SETTINGS_KEY: 'hf-settings',
    settings: {},
    localStorage: {
      getItem() { return null; },
      setItem() {}
    },
    escapeHtml(value) { return String(value); },
    dom: {
      inputs: {
        colonyName: { value: 'Nova Base' },
        worldSeed: { value: 'seed-123' },
        difficulty: { value: 'normal' },
        colonistCount: { value: '3' },
        resourcesPreset: { value: 'standard' },
        eventIntensity: { value: 'normal' },
        mapSize: mapSizeInput
      },
      setupSummary: { innerHTML: '' }
    }
  });

  runBrowserScript('src/game/core/game-setup.js', context);
  context.updateSetupSummary();

  assert.match(context.dom.setupSummary.innerHTML, /Nova Base/);
  assert.doesNotMatch(context.dom.setupSummary.innerHTML, /refreshMapSizeOptionLabels/);
  assert.equal(mapSizeInput.options[2].textContent.includes('Gigante'), true);
});
