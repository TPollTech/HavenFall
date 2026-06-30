import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.SMOKE_PORT || 5184);
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
  try {
    await waitForHttp(`${BASE_URL}/`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const consoleErrors = [];
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('Failed to load resource')) consoleErrors.push(text);
    });

    await page.goto(`${BASE_URL}/?phaser=1`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#mainMenuScreen.active', { timeout: 15000 });
    await page.click('#newGameBtn');
    await page.waitForSelector('#newGameSetupScreen.active', { timeout: 5000 });
    await page.click('#setupNextBtn');
    await page.waitForSelector('#planetScanScreen.active #scanProceedBtn', { timeout: 5000 });
    await page.click('#scanProceedBtn');
    await page.waitForSelector('#colonistSelectScreen.active .colonist-card', { timeout: 5000 });
    await page.click('#startSelectedGameBtn');
    await page.waitForSelector('#gameScreen.active', { timeout: 15000 });
    await page.waitForFunction(() => window.HavenfallPhaser?.isActive?.() === true, null, { timeout: 10000 });
    await page.waitForFunction(() => (window.HavenfallPhaserStats?.activeTiles || 0) > 0, null, { timeout: 10000 });

    const summary = await page.evaluate(() => {
      const layer = document.getElementById('phaserGameLayer');
      const phaserCanvas = layer?.querySelector('canvas');
      return {
        phaserActive: window.HavenfallPhaser?.isActive?.() === true,
        hasLayer: !!layer,
        hasCanvas: !!phaserCanvas,
        bodyClass: document.body.classList.contains('phaser-visual-active'),
        layerSize: layer ? { w: layer.clientWidth, h: layer.clientHeight } : null,
        stats: window.HavenfallPhaserStats || null,
        cameraBefore: { x: window.Havenfall?.camera?.x, y: window.Havenfall?.camera?.y }
      };
    });

    if (!summary.phaserActive || !summary.hasLayer || !summary.hasCanvas || !summary.bodyClass || !summary.stats?.activeTiles) {
      throw new Error(`Phaser nao ficou ativo corretamente: ${JSON.stringify(summary)}`);
    }

    const before = summary.cameraBefore;
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(350);
    await page.keyboard.up('KeyD');
    const after = await page.evaluate(() => ({ x: window.Havenfall?.camera?.x, y: window.Havenfall?.camera?.y }));
    if (!(after.x > before.x + 5)) {
      throw new Error(`Camera nao respondeu ao WASD com Phaser ativo: antes=${JSON.stringify(before)} depois=${JSON.stringify(after)}`);
    }

    if (consoleErrors.length) {
      throw new Error(['Erros no browser durante smoke Phaser:', ...consoleErrors].join('\n'));
    }

    console.log(`Smoke Phaser OK: ${summary.stats.activeTiles} tiles ativos.`);
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
