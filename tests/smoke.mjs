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
      systems: window.GameSystems ? true : false
    }));

    if (!stateSummary.hasState || stateSummary.colonists < 1 || !stateSummary.systems) {
      throw new Error(`Estado invalido apos iniciar partida: ${JSON.stringify(stateSummary)}`);
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
