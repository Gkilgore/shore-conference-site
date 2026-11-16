// Optional real-browser checks; uses an already installed Puppeteer via SHORE_BROWSER_DRIVER, never installs packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require(process.env.SHORE_BROWSER_DRIVER || 'puppeteer');
const root = path.resolve(__dirname, '..');
const output = process.env.SHORE_HISTORY_SCREENSHOTS;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relative = pathname.replace(/^\/shore-conference-site\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/shore-conference-site/';
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.SHORE_BROWSER_BINARY || undefined });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(base + 'resources.html#history', { waitUntil: 'networkidle2' });
    await page.waitForSelector('.history-ready');
    assert.equal(await page.$eval('#history', el => el.hidden), false);
    assert.equal(await page.$eval('#about', el => el.hidden), true);
    assert.equal(await page.$eval('#history-original', el => el.open), false);
    assert.equal(await page.$$eval('#history-decades button', els => els.length), 11);
    await page.$$eval('#history-decades button', els => els.find(el => el.textContent === '1970s').click());
    assert.equal(await page.$$eval('#history-events > li:not([hidden])', els => els.length), 3);
    await page.focus('#history-decades [aria-pressed="true"]');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.$eval('#history-decades [aria-pressed="true"]', el => el.textContent), '1980s');
    await page.keyboard.press('Home');
    assert.equal(await page.$eval('#history-decades [aria-pressed="true"]', el => el.textContent), 'All years');
    await page.select('#history-sport', 'Basketball');
    await page.select('#history-era', '2010');
    assert.deepEqual(await page.$$eval('.history-athlete:not([hidden]) h4', els => els.map(el => el.textContent)), ['Marina Mabrey', 'Bryan Antoine', 'Scottie Lewis']);
    await page.select('#history-sport', 'Swimming');
    assert.equal(await page.$eval('#history-empty', el => el.hidden), false);
    await page.click('#history-reset');
    assert.equal(await page.$$eval('.history-athlete:not([hidden])', els => els.length), 14);
    await page.focus('#jack-arden summary');
    await page.keyboard.press('Enter');
    assert.equal(await page.$eval('#jack-arden details', el => el.open), true);
    await page.click('#jack-arden .history-citations a');
    await page.waitForFunction(() => location.hash === '#history-source-founding');
    assert.equal(await page.$eval('#history-source-founding', el => el.closest('details').open), true);
    await page.select('#history-sport', 'Swimming');
    await page.evaluate(() => { location.hash = 'marina-mabrey'; });
    await page.waitForFunction(() => document.querySelector('#history-sport').value === 'all');
    assert.equal(await page.$eval('#marina-mabrey', el => el.hidden), false);
    assert.equal(await page.$eval('#marina-mabrey details', el => el.open), true);
    await page.goto(base + 'resources.html#history-1950', { waitUntil: 'networkidle2' });
    assert.equal(await page.$eval('#history-original', el => el.open), true);
    assert.equal(await page.$eval('#history', el => el.hidden), false);
    await page.click('.side-tab[href="#divisions"]');
    assert.equal(await page.$eval('#divisions', el => el.hidden), false);
    assert.ok(await page.$$eval('#division-teams button', els => els.length) > 0);
    await page.click('#division-teams button');
    assert.equal(await page.$eval('dialog.division-details', el => el.open), true);
    await page.keyboard.press('Escape');
    await page.goBack();
    assert.equal(await page.$eval('#history', el => el.hidden), false);
    for (const width of [390, 768, 1440]) {
      await page.setViewport({ width, height: 1000 });
      await page.goto(base + 'resources.html#history', { waitUntil: 'networkidle2' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow at ' + width);
      await page.$$eval('#history img', imgs => imgs.forEach(img => img.loading = 'eager'));
      await page.waitForFunction(() => [...document.querySelectorAll('#history img')].every(img => img.complete && img.naturalWidth > 0));
      const anchors = await page.$$eval('#history [href^="#"]', els => els.map(el => el.hash.slice(1)).filter(id => !document.getElementById(id)));
      assert.deepEqual(anchors, [], 'all history anchor targets exist');
      const duplicates = await page.$$eval('[id]', els => { const ids = els.map(el => el.id); return ids.filter((id, index) => ids.indexOf(id) !== index); });
      assert.deepEqual(duplicates, []);
      if (output) {
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, 'intro-' + width + '.png') });
        await page.screenshot({ path: path.join(output, 'history-' + width + '.png'), fullPage: true });
        await page.$eval('#history-legends', el => el.scrollIntoView());
        await page.screenshot({ path: path.join(output, 'legends-' + width + '.png') });
      }
    }
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    await page.setJavaScriptEnabled(false);
    await page.goto(base + 'resources.html#history');
    assert.equal(await page.$eval('#history-original', el => el.open), true);
    assert.ok(await page.$eval('#history-1950', el => el.textContent.includes('Rosati')));
    console.log('PASS: decade and combined sport/era filters; keyboard stories; sources; direct/legacy links; back navigation; divisions; images; no overflow at 390/768/1440; no-JS original record.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
