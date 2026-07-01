import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.SMOKE_PORT || 5185);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_SEED = process.env.SMOKE_SEED || 'HF-REGION-DESERT-LIGHT';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (err) {
    console.error('Playwright nao esta instalado. Rode: npm install');
    console.error(err?.message || err);
    process.exit(1);
  }
}

function waitForHttp(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, res => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) reject(new Error(`Servidor nao respondeu em ${url}`));
      else setTimeout(attempt, 250);
    };
    attempt();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function chooseDesertLanding(page) {
  await page.waitForFunction(() => {
    const debug = window.HavenfallPlanetScanDebug;
    return Array.isArray(debug?.landingSites) && debug.landingSites.length > 0 && typeof window.selectLandingSite === 'function';
  }, null, { timeout: 15000 });

  const selected = await page.evaluate(() => {
    const debug = window.HavenfallPlanetScanDebug;
    const sites = Array.isArray(debug?.landingSites) ? [...debug.landingSites] : [];
    const scoreSite = site => {
      const primaryDesert = site?.biomes?.primary === 'desert' ? 1000 : 0;
      const sandPreview = (site?.preview?.terrainSample || []).flat().filter(cell => cell?.type === 'sand').length;
      const desertMix = Number(site?.biomes?.mix?.desert || 0);
      const waterPenalty = Number(site?.resources?.water || 0) * -1;
      const nameBonus = /dourada|seca|areial|vermelha|desert/i.test(String(site?.name || '')) ? 200 : 0;
      return primaryDesert + sandPreview + desertMix * 4 + waterPenalty + nameBonus;
    };
    const best = sites.sort((a, b) => scoreSite(b) - scoreSite(a))[0] || null;
    if (!best) return null;
    window.selectLandingSite(best.id);
    return {
      id: best.id,
      name: best.name,
      primary: best.biomes?.primary || null,
      sandPreviewTiles: (best.preview?.terrainSample || []).flat().filter(cell => cell?.type === 'sand').length
    };
  });

  assert(selected?.id, 'Nenhum local de pouso foi selecionado no scan orbital.');
  await page.waitForFunction(id => window.HavenfallPlanetScanDebug?.selectedLandingSite?.id === id, selected.id, { timeout: 5000 });
  return selected;
}

async function startSystemsWorld(page) {
  const selected = await page.evaluate(seed => {
    const scoreSite = site => {
      const primaryDesert = site?.biomes?.primary === 'desert' ? 1000 : 0;
      const sandPreview = (site?.preview?.terrainSample || []).flat().filter(cell => cell?.type === 'sand').length;
      const desertMix = Number(site?.biomes?.mix?.desert || 0);
      const waterPenalty = Number(site?.resources?.water || 0) * -1;
      const nameBonus = /dourada|seca|areial|vermelha|desert/i.test(String(site?.name || '')) ? 200 : 0;
      return primaryDesert + sandPreview + desertMix * 4 + waterPenalty + nameBonus;
    };

    let config = typeof normalizeNewGameConfig === 'function'
      ? normalizeNewGameConfig({
          ...defaultNewGameConfig,
          seed,
          difficulty: 'normal',
          colonistCount: 3,
          resourcesPreset: 'standard',
          eventIntensity: 'normal',
          mapSize: 'infinite_chunks'
        })
      : {
          ...defaultNewGameConfig,
          seed,
          difficulty: 'normal',
          colonistCount: 3,
          resourcesPreset: 'standard',
          eventIntensity: 'normal',
          mapSize: 'infinite_chunks'
        };

    if (typeof ensurePlanetScanOnConfig === 'function') config = ensurePlanetScanOnConfig(config);
    const sites = Array.isArray(config?.planetScan?.landingSites) ? [...config.planetScan.landingSites] : [];
    const best = sites.sort((a, b) => scoreSite(b) - scoreSite(a))[0] || null;
    if (!best) return null;

    if (typeof selectLandingSiteInConfig === 'function') config = selectLandingSiteInConfig(config, best.id);
    else {
      config.selectedLandingSiteId = best.id;
      config.selectedLandingSite = best;
      config.landingSiteId = best.id;
    }

    newGameConfig = config;
    window.__smokeSystemsConfig = config;
    setTimeout(() => {
      if (typeof generateColonistCandidates === 'function') generateColonistCandidates(config);
      startNewGame(config, Array.isArray(colonistCandidates) && colonistCandidates.length ? colonistCandidates : null);
      window.HavenfallRuntime?.markGameplayState?.(state);
    }, 0);

    return {
      id: best.id,
      name: best.name,
      primary: best.biomes?.primary || null,
      sandPreviewTiles: (best.preview?.terrainSample || []).flat().filter(cell => cell?.type === 'sand').length
    };
  }, TEST_SEED);

  assert(selected?.id, 'Falha ao iniciar mundo de teste com pouso desertico.');
  return selected;
}

async function collectRuntimeSummary(page, selectedLanding) {
  return await page.evaluate(({ selectedLanding }) => {
    const runtimeState = window.Havenfall?.state || null;
    const world = runtimeState?.world;
    const rows = Number(world?.rows || 0);
    const cols = Number(world?.cols || 0);
    const terrainCounts = {};
    const biomeCounts = {};
    const desertTerrain = { sand: 0, dirt: 0, grass: 0, stone: 0, other: 0 };
    const objectCounts = {};
    const desertObjectCounts = {};
    let desertTiles = 0;

    const terrainAt = (x, y) => world?.terrain?.[y]?.[x] || null;
    const biomeAt = (x, y) => String(world?.biomes?.[y]?.[x] || '');
    const countKey = (bucket, key) => {
      bucket[key] = Number(bucket[key] || 0) + 1;
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const terrain = terrainAt(x, y) || 'unknown';
        const biome = biomeAt(x, y) || 'none';
        countKey(terrainCounts, terrain);
        countKey(biomeCounts, biome);
        if (biome.includes('desert')) {
          desertTiles++;
          if (Object.prototype.hasOwnProperty.call(desertTerrain, terrain)) desertTerrain[terrain]++;
          else desertTerrain.other++;
        }
      }
    }

    for (const obj of world?.objects || []) {
      const type = String(obj?.type || 'unknown');
      countKey(objectCounts, type);
      const biome = biomeAt(obj?.x, obj?.y);
      if (biome.includes('desert')) countKey(desertObjectCounts, type);
    }

    const spawn = world?.spawn || { x: 8, y: 8 };
    const litX = Math.min(cols - 4, Math.max(4, spawn.x + 8));
    const farX = Math.max(4, spawn.x - 8);
    const probeY = Math.min(rows - 4, Math.max(4, spawn.y));
    const originalHour = Number(runtimeState?.hour || 12);
    const originalWeather = runtimeState?.weather || 'limpo';
    const originalObjects = Array.isArray(world?.objects) ? world.objects.slice() : [];

    world.builtRoofLayer = Array.isArray(world.builtRoofLayer)
      ? world.builtRoofLayer
      : Array.from({ length: rows }, () => Array(cols).fill(false));

    const paintRoofPatch = (cx, cy, enabled) => {
      for (let y = cy - 3; y <= cy + 3; y++) {
        for (let x = cx - 3; x <= cx + 3; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          if (!Array.isArray(world.builtRoofLayer[y])) world.builtRoofLayer[y] = Array(cols).fill(false);
          world.builtRoofLayer[y][x] = enabled;
        }
      }
    };

    paintRoofPatch(litX, probeY, true);
    paintRoofPatch(farX, probeY, true);
    if (runtimeState) {
      runtimeState.hour = 23;
      runtimeState.weather = 'limpo';
    }

    const torchId = '__smoke_systems_torch__';
    world.objects = (world.objects || []).filter(obj => obj?.id !== torchId);
    world.objects.push({ id: torchId, type: 'torch', x: litX, y: probeY, fuel: 100, lit: true });

    window.LightingSystem?.invalidate?.('smoke-systems-probe', world);
    window.LightingSystem?.recomputeLighting?.(null, world, 'smoke-systems-probe');

    const roofDetected = window.LightingSystem?.hasRoofAt?.(litX, probeY, world) === true;
    const litAtTorch = Number(window.LightingSystem?.getLightAt?.(litX, probeY, world) || 0);
    const litAtFarRoof = Number(window.LightingSystem?.getLightAt?.(farX, probeY, world) || 0);
    const lightSources = Number(window.LightingSystem?.collectLightSources?.(world)?.sources?.length || 0);
    const activeRegions = window.WorldRegionSystem?.updateActiveRegions?.(world) || [];
    const regionSnapshots = window.WorldRegionSystem?.snapshotActiveRegions?.(world) || [];

    const cleanup = () => {
      world.objects = originalObjects;
      if (runtimeState) {
        runtimeState.hour = originalHour;
        runtimeState.weather = originalWeather;
      }
      window.LightingSystem?.invalidate?.('smoke-systems-cleanup', world);
      window.LightingSystem?.recomputeLighting?.(null, world, 'smoke-systems-cleanup');
    };
    cleanup();

    const desertSignatureObjects = Number(objectCounts.cactus || 0)
      + Number(objectCounts.palm_tree || 0)
      + Number(objectCounts.dry_twigs || 0);

    return {
      screen: window.Havenfall?.screen || null,
      hasState: !!window.Havenfall?.state,
      mapSize: world?.mapSize || null,
      generationVersion: String(world?.generationVersion || ''),
      biomeRebalanceVersion: world?.biomeRebalanceVersion || null,
      regionMode: !!world?.regionMode,
      regionEnabled: !!window.WorldRegionSystem?.isRegionModeEnabled?.(world),
      regionSize: Number(world?.regionSize || 0),
      activeRegions: activeRegions.length,
      regionSnapshots: regionSnapshots.length,
      hasLightingSystem: !!window.LightingSystem,
      hasWorldRegionSystem: !!window.WorldRegionSystem,
      roofDetected,
      lightSources,
      litAtTorch,
      litAtFarRoof,
      terrainCounts,
      biomeCounts,
      desertTiles,
      desertTerrain,
      objectCounts,
      desertObjectCounts,
      desertSignatureObjects,
      selectedLanding
    };
  }, { selectedLanding });
}

async function main() {
  const { chromium } = await loadPlaywright();
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const serverOutput = [];
  server.stdout.on('data', chunk => serverOutput.push(String(chunk)));
  server.stderr.on('data', chunk => serverOutput.push(String(chunk)));

  let browser;
  const consoleErrors = [];
  const pageErrors = [];

  try {
    await waitForHttp(`${BASE_URL}/`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('Failed to load resource')) consoleErrors.push(text);
    });
    page.on('pageerror', err => pageErrors.push(err.stack || err.message || String(err)));

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#mainMenuScreen.active', { timeout: 15000 });
    const selectedLanding = await startSystemsWorld(page);
    try {
      await page.waitForSelector('#gameScreen.active', { timeout: 20000 });
      await page.waitForFunction(() => !!window.Havenfall?.state?.world?.terrain?.length, null, { timeout: 20000 });
    } catch (error) {
      const runtimeDebug = await page.evaluate(() => ({
        screen: window.Havenfall?.screen || null,
        overlayVisible: document.getElementById('havenfallRuntimeLoadingOverlay')?.classList.contains('show') || false,
        startDisabled: !!document.getElementById('startSelectedGameBtn')?.disabled,
        activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(el => el.id),
        colonistCandidates: Array.isArray(window.colonistCandidates) ? window.colonistCandidates.length : null,
        hasWorld: !!window.Havenfall?.state?.world,
        loadingText: document.getElementById('runtimeLoadingStatus')?.textContent || null
      }));
      throw new Error(`${error.message}\nRuntime debug: ${JSON.stringify(runtimeDebug)}`);
    }

    const summary = await collectRuntimeSummary(page, selectedLanding);

    assert(summary.hasState, `Estado do jogo nao foi iniciado: ${JSON.stringify(summary)}`);
    assert(summary.mapSize === 'infinite_chunks', `Mapa incorreto no runtime: ${summary.mapSize}`);
    assert(summary.regionMode && summary.regionEnabled, `WorldRegionSystem nao entrou em modo regional: ${JSON.stringify(summary)}`);
    assert(summary.regionSize >= 64, `regionSize invalido: ${summary.regionSize}`);
    assert(summary.activeRegions > 0, `Nenhuma regiao ativa encontrada: ${JSON.stringify(summary)}`);
    assert(summary.regionSnapshots > 0, `Nenhum snapshot regional foi gerado: ${JSON.stringify(summary)}`);
    assert(summary.hasLightingSystem && summary.hasWorldRegionSystem, `Sistemas nao expostos no runtime: ${JSON.stringify(summary)}`);
    assert(summary.roofDetected, `LightingSystem nao reconheceu teto construido em runtime: ${JSON.stringify(summary)}`);
    assert(summary.lightSources >= 1, `LightingSystem nao reconheceu fonte de luz ativa: ${JSON.stringify(summary)}`);
    assert(summary.litAtTorch > summary.litAtFarRoof + 0.25, `Iluminacao nao diferenciou area com tocha e area coberta escura: ${JSON.stringify(summary)}`);
    assert(summary.desertTiles >= 150, `Macro-bioma deserto insuficiente no mapa continental: ${JSON.stringify(summary)}`);
    assert((summary.desertTerrain.sand || 0) >= Math.max(40, Math.round(summary.desertTiles * 0.18)), `Deserto sem areia suficiente: ${JSON.stringify(summary.desertTerrain)}`);
    assert((summary.objectCounts.cactus || 0) >= 1, `Nenhum cacto encontrado no mundo: ${JSON.stringify(summary.objectCounts)}`);
    assert(summary.desertSignatureObjects >= 3, `Assinaturas materiais de deserto insuficientes: ${JSON.stringify(summary.objectCounts)}`);
    assert(summary.selectedLanding?.primary === 'desert', `Pouso selecionado nao foi desertico: ${JSON.stringify(summary.selectedLanding)}`);
    assert(summary.selectedLanding?.sandPreviewTiles > 0, `Preview orbital do pouso desertico nao mostrou areia: ${JSON.stringify(summary.selectedLanding)}`);
    assert(summary.generationVersion.includes('macro-biomes'), `generationVersion sem macro-biomes: ${summary.generationVersion}`);
    assert(summary.generationVersion.includes('biome-signatures'), `generationVersion sem biome-signatures: ${summary.generationVersion}`);
    assert(summary.biomeRebalanceVersion === '2.1-terrain-signatures', `Versao de rebalanceamento inesperada: ${summary.biomeRebalanceVersion}`);

    if (consoleErrors.length || pageErrors.length) {
      throw new Error([
        'Erros no browser durante smoke dos sistemas:',
        ...consoleErrors.map(line => `[console] ${line}`),
        ...pageErrors.map(line => `[pageerror] ${line}`)
      ].join('\n'));
    }

    console.log(`Smoke Systems OK: regioes=${summary.activeRegions}, desertTiles=${summary.desertTiles}, cactus=${summary.objectCounts.cactus || 0}.`);
  } catch (err) {
    console.error(serverOutput.join(''));
    throw err;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
