import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.SMOKE_PORT || 5183);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.stack || err.message || String(err)));

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#mainMenuScreen.active', { timeout: 15000 });
    await page.click('#newGameBtn');
    await page.waitForSelector('#newGameSetupScreen.active', { timeout: 5000 });
    await page.click('#setupNextBtn');
    await page.waitForSelector('#planetScanScreen.active #scanProceedBtn', { timeout: 5000 });
    await page.click('#scanProceedBtn');
    await page.waitForSelector('#colonistSelectScreen.active .colonist-card', { timeout: 5000 });
    await page.click('#startSelectedGameBtn');
    await page.waitForSelector('#gameScreen.active', { timeout: 15000 });

    const stateSummary = await page.evaluate(() => ({
      screen: window.Havenfall?.screen,
      hasState: !!window.Havenfall?.state,
      colonists: window.Havenfall?.state?.colonists?.length || 0,
      objects: window.Havenfall?.state?.objects?.length || 0,
      systems: window.GameSystems ? true : false,
      canvasPixels: (() => {
        const canvas = document.getElementById('game');
        if (!canvas?.width || !canvas?.height) return { sampled: 0, lit: 0, average: 0 };
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let sampled = 0;
        let lit = 0;
        let total = 0;
        for (let y = 0; y < canvas.height; y += 8) {
          for (let x = 0; x < canvas.width; x += 8) {
            const i = (y * canvas.width + x) * 4;
            const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
            sampled++;
            total += lum;
            if (lum > 12) lit++;
          }
        }
        return { sampled, lit, average: sampled ? total / sampled : 0 };
      })()
    }));

    if (!stateSummary.hasState || stateSummary.colonists < 1 || !stateSummary.systems) {
      throw new Error(`Estado invalido apos iniciar partida: ${JSON.stringify(stateSummary)}`);
    }
    if (stateSummary.canvasPixels.lit < Math.max(10, stateSummary.canvasPixels.sampled * 0.01)) {
      throw new Error(`Canvas nao desenhou mapa visivel apos iniciar partida: ${JSON.stringify(stateSummary.canvasPixels)}`);
    }

    const cameraBefore = await page.evaluate(() => ({ x: window.Havenfall?.camera?.x, y: window.Havenfall?.camera?.y }));
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(350);
    await page.keyboard.up('KeyD');
    const cameraAfter = await page.evaluate(() => ({ x: window.Havenfall?.camera?.x, y: window.Havenfall?.camera?.y }));
    if (!(cameraAfter.x > cameraBefore.x + 5)) {
      throw new Error(`Camera nao respondeu ao WASD: antes=${JSON.stringify(cameraBefore)} depois=${JSON.stringify(cameraAfter)}`);
    }

    await page.click('#bottom-navigation-dock [data-ui-panel="orders"]');
    await page.waitForSelector('#anchored-ui-panel[data-active-dock-tab="orders"]', { timeout: 5000 });
    await page.click('#anchored-ui-panel [data-order-tool="mine"]');
    const activeOrderTool = await page.evaluate(() => window.getOrderTool?.());
    if (activeOrderTool !== 'mine') {
      throw new Error(`Aba Ordens nao ativou a ferramenta Minerar: ${JSON.stringify(activeOrderTool)}`);
    }

    const dragTarget = await page.evaluate(() => {
      window.GeologySystem?.ensureGeologyState?.();
      const c = window.Havenfall?.state?.colonists?.[0];
      const world = window.Havenfall?.state?.world;
      if (!c || !world?.geologyLayer) return null;
      window.Havenfall.camera.x = c.px;
      window.Havenfall.camera.y = c.py;
      window.resizeGameCanvas?.(true);
      const y = Math.max(2, Math.min(world.rows - 3, Math.round(c.y) - 5));
      const startX = Math.max(2, Math.min(world.cols - 6, Math.round(c.x) + 3));
      const rocks = [];
      for (let dx = 0; dx < 3; dx++) {
        const x = startX + dx;
        world.geologyLayer[y][x] = {
          type: 'granite',
          hp: 90,
          maxHp: 90,
          isRoof: true,
          mineable: true,
          solid: true,
          markedForMining: false,
          resource: 'stone',
          yield: 4,
          biomeId: world.biomes?.[y]?.[x] || 'forest',
          insulation: 0.7,
          collapseRisk: 0
        };
        if (world.roofLayer?.[y]) world.roofLayer[y][x] = true;
        if (world.terrain?.[y]) world.terrain[y][x] = 'stone';
        if (world.exploration?.[y]) world.exploration[y][x] = 2;
        rocks.push({ x, y });
      }
      for (const colonist of window.Havenfall.state.colonists || []) {
        colonist.task = null;
        colonist.path = [];
        colonist.work = 0;
      }
      const vt = window.Havenfall.viewTransform;
      const toScreen = tile => ({ x: vt.offsetX + (tile.x * 48 + 24) * vt.scale, y: vt.offsetY + (tile.y * 48 + 24) * vt.scale });
      return { rocks, from: toScreen(rocks[0]), to: toScreen(rocks[2]), hpBefore: 90 };
    });
    if (!dragTarget) throw new Error('Nao foi possivel preparar rochas para testar arrasto de mineracao.');
    await page.mouse.move(dragTarget.from.x, dragTarget.from.y);
    await page.mouse.down();
    await page.mouse.move(dragTarget.to.x, dragTarget.to.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const markedByDrag = await page.evaluate(rocks => rocks.filter(({ x, y }) => window.getRockAt?.(x, y)?.markedForMining).length, dragTarget.rocks);
    if (markedByDrag !== dragTarget.rocks.length) {
      throw new Error(`Arrasto de Minerar nao marcou todas as rochas: ${markedByDrag}/${dragTarget.rocks.length}`);
    }
    const miningAfterDrag = await page.evaluate((probe) => {
      const rocks = probe.rocks.map(({ x, y }) => {
        const rock = window.getRockAt?.(x, y);
        const adjacentWorker = (window.Havenfall?.state?.colonists || []).some(c => Math.abs(c.x - x) + Math.abs(c.y - y) === 1);
        return { x, y, hp: rock?.hp ?? null, marked: !!rock?.markedForMining, adjacentWorker };
      });
      return {
        rocks,
        directRemoteMining: rocks.some(rock => rock.hp !== null && rock.hp < probe.hpBefore && !rock.adjacentWorker),
        activeMineTasks: (window.Havenfall?.state?.colonists || []).filter(c => c.task?.type === 'mine').map(c => ({
          name: c.name,
          x: c.x,
          y: c.y,
          mineX: c.task.mineX,
          mineY: c.task.mineY,
          pathLength: c.path?.length || 0
        }))
      };
    }, dragTarget);
    if (miningAfterDrag.directRemoteMining) {
      throw new Error(`Mineracao fantasma apos marcar rochas: ${JSON.stringify(miningAfterDrag)}`);
    }

    if (consoleErrors.length || pageErrors.length) {
      throw new Error([
        'Erros no browser durante smoke test:',
        ...consoleErrors.map(line => `[console] ${line}`),
        ...pageErrors.map(line => `[pageerror] ${line}`)
      ].join('\n'));
    }

    console.log(`Smoke OK: ${stateSummary.colonists} colonos, ${stateSummary.objects} objetos.`);
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
