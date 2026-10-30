import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { statusFixture, economyFixture } from '../tests/fixtures.mjs';

// A bounded foreground validation: this process owns and closes its server and browsers.
const root = resolve('dist');
const outArgument = process.argv.indexOf('--out');
const output = resolve(outArgument === -1 ? 'test/scratch/interaction-validation' : process.argv[outArgument + 1]);
const live = process.argv.includes('--live');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const results = { mode: live ? 'live public API' : 'deterministic intercepted API', browsers: [], checks: [], limitations: [] };
await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/preview/')) { response.writeHead(404).end(); return; }
    const path = resolve(root, pathname.slice('/preview/'.length) || 'index.html');
    if (!path.startsWith(root + sep) && path !== resolve(root, 'index.html')) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const check = (browser, name, details) => { results.checks.push({ browser, name, passed: true, ...details }); console.log(`PASS ${browser}: ${name}`); };
async function tabTo(page, locator) {
  for (let step = 0; step < 30; step++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('The expected control could not be reached with Tab.');
}

async function validateBrowser(browserType, name) {
  let browser;
  try { browser = await browserType.launch({ headless: true, ...(name === 'Chromium' ? { args: ['--no-sandbox'] } : {}) }); }
  catch (error) { results.limitations.push(`${name} could not launch: ${error.message}`); return; }
  results.browsers.push({ name, version: browser.version() });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const scriptErrors = [], failedLocal = [];
  page.on('pageerror', (error) => scriptErrors.push(error.message));
  page.on('response', (response) => { if (response.url().startsWith(url) && response.status() >= 400) failedLocal.push(`${response.status()} ${response.url()}`); });
  let statusCalls = 0, economyCalls = 0;
  const mode = { active: false, statusFail: false, economyFail: false, invalid: false, unavailable: false, stale: false, fault: false, missing: false, round: '610' };
  if (!live) {
    await page.clock.install({ time: new Date('2026-10-30T19:30:00Z') });
    await page.route('https://api.squeekchain.com/v1/**', async (route) => {
      const status = new URL(route.request().url()).pathname === '/v1/status';
      if (status) statusCalls++; else economyCalls++;
      if (status && mode.statusFail || !status && mode.economyFail) { await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test outage"}' }); return; }
      if (status && mode.invalid) { await route.fulfill({ json: { unsupported: true } }); return; }
      const time = await page.evaluate(() => Date.now());
      const body = status ? statusFixture(time - (mode.stale ? 180000 : 0), { active: mode.active }) : mode.unavailable ? { status: 'unavailable', reason: 'test_indexer_unavailable' } : economyFixture(time, mode.round);
      if (status && mode.fault) body.measurement.coreStatus = 'COUNTER_FAULT';
      if (status && mode.missing) { body.measurement = null; body.builder = { status: 'unavailable', reason: 'no_measurement' }; }
      await route.fulfill({ json: body });
    });
  }
  try {
    await page.goto(url);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => [...document.fonts].some((font) => font.family === 'Manrope' && font.status === 'loaded')));
    const socialImage = await page.getAttribute('meta[property="og:image"]', 'content');
    const socialResponse = await page.request.get(new URL(socialImage, url).href);
    assert.equal(socialResponse.status(), 200);
    assert.equal(socialResponse.headers()['content-type'], 'image/png');
    const png = await socialResponse.body();
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    check(name, 'local Manrope font loads; share image is a reachable 1200×630 PNG');
    const reading = await page.getByTestId('rpm').innerText();
    if (live) {
      assert.notEqual(reading, '–', 'live status must produce a reading');
      assert.notEqual(await page.getByTestId('mined').innerText(), '–', 'live economy must produce a reading');
      check(name, 'both public endpoints render actual readings', { rpm: reading, mined: await page.getByTestId('mined').innerText(), round: await page.getByTestId('round').innerText() });
    } else {
      assert.equal(reading, '0');
      assert.equal(await page.getByTestId('next-block').innerText(), '#4,136');
      assert.equal(await page.getByTestId('block-percent').innerText(), '3.58%');
      assert.equal(await page.getByTestId('mined').innerText(), '16.45M');
      assert.equal(await page.getByTestId('round').innerText(), '610');
      check(name, 'realistic idle fields, precision, block units and settlement mappings');
    }
    const top = await page.locator('h1').boundingBox();
    const action = await page.getByRole('button', { name: 'Refresh now', exact: true }).boundingBox();
    const wheel = await page.getByRole('heading', { name: 'Inside the wheel' }).boundingBox();
    assert(top.y + top.height < 844 && action.y + action.height < 844 && wheel.y + wheel.height < 844);
    check(name, 'product and primary action on the first 390px screen', { headingBottom: top.y + top.height, actionBottom: action.y + action.height, wheelHeadingBottom: wheel.y + wheel.height });
    await page.screenshot({ path: resolve(output, `${name.toLowerCase()}-390.png`), fullPage: true });

    await page.getByRole('button', { name: 'Explain Squeek blocks' }).click();
    assert.equal(await page.getByRole('button', { name: 'Hide block explanation' }).getAttribute('aria-expanded'), 'true');
    assert(await page.locator('#block-explanation').isVisible());
    await page.getByRole('button', { name: 'Hide block explanation' }).click();
    await page.getByRole('button', { name: 'Distance', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Distance', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Activity time range').selectOption('60');
    assert.equal(await page.getByLabel('Activity time range').inputValue(), '60');
    await page.getByText('View readings as a table', { exact: true }).click();
    assert(await page.getByRole('columnheader', { name: 'Distance (m)' }).isVisible());
    await page.getByText('Behind the readings', { exact: true }).click();
    assert.equal(await page.getByRole('link', { name: '/v1/status', exact: false }).getAttribute('href'), 'https://api.squeekchain.com/v1/status');
    check(name, 'block explanation, chart metric/range, accessible table and source disclosure');
    await page.getByRole('link', { name: 'Activity', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#activity');
    await page.getByRole('link', { name: 'Squeekchain dashboard home', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('nav a[href="#overview"]').getAttribute('aria-current') === 'location');
    assert.equal(new URL(page.url()).hash, '#overview');
    check(name, 'native hash navigation and home link update the current section');

    if (!live) {
      const before = statusCalls;
      await page.clock.fastForward(15001);
      await page.waitForFunction(() => !document.querySelector('.button-primary').disabled);
      assert.equal(statusCalls, before + 1);
      assert.equal(economyCalls, statusCalls);
      await page.getByRole('button', { name: 'Pause updates', exact: true }).click();
      const paused = statusCalls;
      await page.clock.fastForward(45000);
      assert.equal(statusCalls, paused);
      assert(await page.getByText('Updates paused', { exact: true }).isVisible());
      mode.active = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="rpm"]').textContent === '12.35');
      assert.equal(statusCalls, paused + 1);
      assert.equal(await page.getByTestId('speed').innerText(), '1.25');
      assert.equal(await page.getByTestId('distance').innerText(), '123.46');
      assert(await page.getByText('Running', { exact: true }).isVisible());
      await page.getByRole('button', { name: 'Resume updates', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('.button-primary').disabled);
      assert.equal(statusCalls, paused + 2);
      check(name, '15-second polling, pause, manual refresh while paused, active state and resume');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      assert.equal(await page.locator('.wheel-spokes').evaluate((element) => getComputedStyle(element).animationName), 'refresh-spin');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.wheel-spokes').evaluate((element) => getComputedStyle(element).animationName), 'none');
      assert(await page.getByText('Running', { exact: true }).isVisible());
      check(name, 'active wheel motion stops for reduced motion while the textual state remains');

      mode.statusFail = true; mode.round = '611';
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="round"]').textContent === '611');
      assert.equal(await page.getByTestId('rpm').innerText(), '12.35');
      assert(await page.getByText('Some data could not refresh.', { exact: true }).isVisible());
      assert(await page.getByText('Stale reading', { exact: true }).isVisible());
      mode.statusFail = false; mode.invalid = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.getByText('The API returned an unsupported data format.', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('rpm').innerText(), '12.35');
      mode.invalid = false; mode.unavailable = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="round"]').textContent === '–');
      assert.equal(await page.getByTestId('mined').innerText(), '–');
      mode.unavailable = false; mode.stale = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.getByText('Stale data', { exact: true }).waitFor();
      assert(await page.getByText('Stale reading', { exact: true }).isVisible());
      mode.stale = false; mode.fault = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.getByText('Counter fault', { exact: true }).waitFor();
      mode.fault = false; mode.missing = true;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.getByText('No reading', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('rpm').innerText(), '–');
      assert(await page.getByText('Block builder is unavailable.', { exact: true }).isVisible());
      mode.missing = false;
      await page.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await page.getByText('Running', { exact: true }).waitFor();
      check(name, 'partial failure retains good data; malformed/unavailable/stale/fault/missing states recover');

      await context.setOffline(true);
      await page.getByText('You’re offline.', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('rpm').innerText(), '12.35');
      await context.setOffline(false);
      await page.getByText('Live feed', { exact: true }).waitFor();
      check(name, 'offline notice, snapshot retention and reconnect refresh');
    }

    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    await writeFile(resolve(output, `${name.toLowerCase()}-axe.json`), JSON.stringify(audit.violations, null, 2));
    assert.equal(audit.violations.length, 0, `axe violations: ${audit.violations.map((item) => item.id).join(', ')}`);
    check(name, 'axe WCAG A/AA automated scan with both disclosures open', { violations: audit.violations.length, passes: audit.passes.length });

    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      assert(overflow.content <= overflow.viewport + 1, `horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
      assert(await page.getByRole('button', { name: 'Pause updates', exact: true }).isVisible(), `pause button has an accessible name at ${width}`);
      if (width === 1440) await page.screenshot({ path: resolve(output, `${name.toLowerCase()}-1440.png`), fullPage: true });
    }
    check(name, 'no horizontal overflow at 320, 390, 768, 1024 and 1440px');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    const enlarged = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    await page.screenshot({ path: resolve(output, `${name.toLowerCase()}-text-200.png`), fullPage: true });
    assert(enlarged.content <= enlarged.viewport + 1, `horizontal overflow at 200% text: ${JSON.stringify(enlarged)}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    check(name, '200% root text enlargement at 1440px remains within the viewport');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await page.getByRole('button', { name: 'Refresh now', exact: true }).waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to dashboard');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => ({ name: document.activeElement.textContent, outline: getComputedStyle(document.activeElement).outlineStyle, width: getComputedStyle(document.activeElement).outlineWidth }));
    assert(focused.name.includes('Pause updates'));
    assert.equal(focused.outline, 'solid');
    assert.equal(focused.width, '3px');
    await page.screenshot({ path: resolve(output, `${name.toLowerCase()}-focus.png`) });
    await page.keyboard.press('Space');
    assert(await page.getByRole('button', { name: 'Resume updates', exact: true }).isVisible());
    await tabTo(page, page.getByRole('button', { name: 'Refresh now', exact: true }));
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Refresh now', exact: true }).waitFor();
    await tabTo(page, page.getByRole('button', { name: 'Explain Squeek blocks', exact: true }));
    await page.keyboard.press('Enter');
    assert(await page.locator('#block-explanation').isVisible());
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Distance', exact: true }));
    await page.keyboard.press('Space');
    assert.equal(await page.getByRole('button', { name: 'Distance', exact: true }).getAttribute('aria-pressed'), 'true');
    await tabTo(page, page.getByLabel('Activity time range'));
    await tabTo(page, page.locator('.reading-details > summary'));
    await page.keyboard.press('Enter');
    assert(await page.getByRole('region', { name: 'Scrollable observed readings' }).isVisible());
    await tabTo(page, page.locator('.sources-section summary'));
    await page.keyboard.press('Enter');
    assert(await page.getByRole('link', { name: '/v1/status', exact: false }).isVisible());
    check(name, 'keyboard skip link, focus, refresh, pause, chart selection and disclosures');

    assert.deepEqual(scriptErrors, []);
    assert.deepEqual(failedLocal, []);
    check(name, 'no uncaught script errors or failed local asset requests');

    if (!live) {
      const loadingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const loadingPage = await loadingContext.newPage();
      await loadingPage.clock.install({ time: new Date('2026-10-30T19:30:00Z') });
      let release;
      const gate = new Promise((done) => { release = done; });
      let holding = true;
      await loadingPage.route('https://api.squeekchain.com/v1/**', async (route) => {
        if (holding) await gate;
        const status = new URL(route.request().url()).pathname === '/v1/status';
        await route.fulfill({ json: status ? statusFixture(Date.parse('2026-10-30T19:30:00Z')) : economyFixture(Date.parse('2026-10-30T19:30:00Z')) });
      });
      await loadingPage.goto(url);
      const loadingButton = loadingPage.getByRole('button', { name: 'Refreshing…', exact: true });
      await loadingButton.waitFor();
      assert(await loadingButton.isDisabled());
      assert.equal(await loadingPage.getByTestId('rpm').innerText(), '–');
      assert.equal(await loadingPage.getByTestId('mined').innerText(), '–');
      await loadingPage.getByText('View readings as a table', { exact: true }).click();
      assert(await loadingPage.getByText('Readings will appear here after the public API responds.', { exact: true }).isVisible());
      holding = false; release();
      await loadingPage.getByRole('button', { name: 'Refresh now', exact: true }).waitFor();
      assert.equal(await loadingPage.getByTestId('rpm').innerText(), '0');
      await loadingPage.route('https://api.squeekchain.com/v1/**', async () => { /* Deliberately leave the test request pending for the app timeout. */ });
      await loadingPage.getByRole('button', { name: 'Refresh now', exact: true }).click();
      await loadingPage.getByRole('button', { name: 'Refreshing…', exact: true }).waitFor();
      await loadingPage.clock.fastForward(10001);
      await loadingPage.getByRole('button', { name: 'Refresh now', exact: true }).waitFor();
      assert(await loadingPage.getByText('Some data could not refresh.', { exact: true }).isVisible());
      assert.equal(await loadingPage.getByTestId('rpm').innerText(), '0');
      await loadingContext.close();
      check(name, 'initial loading/empty states show no invented zeros; 10-second timeout retains snapshot');
    }
  } finally { await context.close(); await browser.close(); }
}

try {
  await validateBrowser(chromium, 'Chromium');
  await validateBrowser(webkit, 'WebKit');
  assert(results.browsers.length > 0, 'No browser could launch');
} catch (error) {
  results.failure = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  await new Promise((done) => server.close(done));
  console.log(JSON.stringify({ passed: results.checks.length, browsers: results.browsers, limitations: results.limitations, failure: results.failure || null }, null, 2));
}
