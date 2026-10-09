// Offline end-to-end check for the installed app.
//   npm run offline
// Stages the site twice (release A and B) with the same script the deploy uses,
// serves it over HTTP under /LRPS_Simulator/ like GitHub Pages, and proves:
//   1. first visit precaches every file and says "Ready to work offline"
//   2. with the server DOWN, a reload still opens, every tab renders, fonts load,
//      and the Data Book records a shot that survives another offline reload
//   3. with the server HANGING (weak signal), the page still opens within the 3 s budget
//   4. a new release (B) deployed while the app is open raises the update bar by itself
//      (version, build, notes, Reload), release A's cache is gone, and B then works offline too
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { stage } from './stage.mjs';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = loadPlaywright();

const BASE = '/LRPS_Simulator/';
const TABS = ['academy', 'lab', 'build', 'drill', 'range', 'book'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrps-offline-'));
const A = stage(path.join(tmp, 'a'), 'relA0001');
const B = stage(path.join(tmp, 'b'), 'relB0002');

// ------------------------------------------------------------ server with three modes

let root = A.out, mode = 'up';
const sockets = new Set();
const server = http.createServer((req, res) => {
  if (mode === 'hang') return; // accept the connection, never answer: a weak signal
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404); return res.end(); }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  fs.createReadStream(file).pipe(res);
});
server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
const listen = () => new Promise((r) => server.listen(0, '127.0.0.1', r));
await listen();
const PORT = server.address().port;
const URL0 = `http://127.0.0.1:${PORT}${BASE}`;
const down = () => new Promise((r) => { server.close(() => r()); sockets.forEach((s) => s.destroy()); });
const up = () => new Promise((r) => server.listen(PORT, '127.0.0.1', r));

// ------------------------------------------------------------ harness

const results = [];
let failures = 0;
async function check(name, fn) {
  const errs = [];
  const t0 = Date.now();
  try { await fn(errs); } catch (e) { errs.push('threw: ' + e.message.split('\n')[0]); }
  const ok = !errs.length;
  if (!ok) failures++;
  results.push([ok, name]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  errs.forEach((e) => console.log('      ✗ ' + e));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  // a deliberately downed/hanging server shows up as failed navigations/updates: not app errors
  if (/ERR_CONNECTION_REFUSED|ERR_INTERNET_DISCONNECTED|Failed to load resource|An unknown error occurred when fetching the script/.test(t)) return;
  consoleErrors.push(t);
});

const cacheKeys = () => page.evaluate(async () => {
  const names = await caches.keys();
  const out = {};
  for (const n of names) out[n] = (await (await caches.open(n)).keys()).length;
  return out;
});
const toasts = () => page.$$eval('#toasts .toast', (els) => els.map((e) => e.dataset.msg || e.textContent));
const waitToast = (re, timeout = 15000) => page.waitForFunction((src) => [...document.querySelectorAll('#toasts .toast')].some((e) => new RegExp(src).test(e.dataset.msg || e.textContent)), re.source, { timeout });
async function setVal(sel, v) {
  await page.evaluate(({ sel, v }) => {
    const el = document.querySelector(sel);
    el.focus(); el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }, { sel, v });
}
async function everyTab(errs) {
  for (const t of TABS) {
    await page.click(`.tab[data-tab="${t}"]`);
    await page.waitForTimeout(150);
    const len = await page.$eval(`#tab-${t}`, (e) => e.innerText.trim().length);
    if (len < 40) errs.push(`tab ${t} rendered ${len} chars`);
  }
}

// ------------------------------------------------------------ 1. first visit

await check('First visit: service worker installs, every file precached, "Ready to work offline"', async (errs) => {
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 });
  try { await waitToast(/Ready to work offline/); } catch (e) { errs.push(`no "Ready to work offline" toast (toasts: ${await toasts()})`); }
  const keys = await cacheKeys();
  if (keys['lrps-relA0001'] < A.precache.length) errs.push(`cache holds ${keys['lrps-relA0001']} of ${A.precache.length}: ${JSON.stringify(keys)}`);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  if (manifest.display !== 'standalone' || !manifest.icons.some((i) => i.purpose === 'maskable')) errs.push('manifest incomplete');
  const persisted = await page.evaluate(() => navigator.storage.persisted());
  if (typeof persisted !== 'boolean') errs.push('storage.persisted() unavailable');
});

// Seed a rifle + lot online so the offline steps exercise a real book
await check('Data Book: rifle + lot set up online', async (errs) => {
  await page.click('.tab[data-tab="book"]');
  await page.click('[data-act="new-rifle"]');
  await setVal('#be-name', 'Offline rifle');
  await page.click('#book-edit button[type="submit"]');
  await page.click('[data-act="new-lot"]');
  await page.selectOption('#be-load', 'horn-65-140');
  await page.click('#book-edit button[type="submit"]');
  if (!(await page.$('#book-kind'))) errs.push('session panel did not appear');
});

// ------------------------------------------------------------ 2. server down

await check('Server down: reload opens, every tab renders, fonts load, "Offline" pill shows', async (errs) => {
  await down();
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  const title = await page.title();
  if (!/LRPS/.test(title)) errs.push(`page did not open offline: title "${title}"`);
  await everyTab(errs);
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map((f) => f.family + ':' + f.status); });
  if (!fonts.length || fonts.some((f) => !/:loaded$/.test(f))) errs.push(`fonts offline: ${fonts}`);
  if (await page.$eval('#net-pill', (e) => e.hidden)) errs.push('"Offline" pill hidden while offline');
});

await check('Server down: Data Book logs a field shot, and it survives another offline reload', async (errs) => {
  await page.click('.tab[data-tab="book"]');
  await page.click('#book-kind button[data-v="field"]');
  await setVal('.bk-step-val[data-f="yd"]', 735);
  await setVal('.bk-step-val[data-f="dialE"]', 5.1);
  await page.click('[data-res="hit"]');
  await page.click('[data-act="field-log"]');
  await page.reload({ waitUntil: 'load' });
  await page.click('.tab[data-tab="book"]');
  const shots = await page.evaluate(() => JSON.parse(localStorage.getItem('lrps.book')).sessions.flatMap((s) => s.shots || []));
  if (!shots.some((s) => s.yd === 735 && s.result === 'hit')) errs.push(`shot lost: ${JSON.stringify(shots)}`);
  const rows = await page.$$eval('#book-rows .bk-row', (els) => els.length).catch(() => 0);
  if (!rows) errs.push('logged row not shown after reload');
});

await check('Server down: Range session starts and fires', async (errs) => {
  await page.click('.tab[data-tab="range"]');
  await page.click('#setup-go');
  await page.waitForTimeout(300);
  await page.click('#fire-btn');
  await page.waitForTimeout(1200);
  const rows = await page.$$eval('#shot-log tbody tr', (r) => r.length);
  if (rows < 1) errs.push('no round logged offline');
});

// ------------------------------------------------------------ 3. weak signal

await check('Weak signal: a server that never answers still opens the cached page within the 3 s budget', async (errs) => {
  await ctx.setOffline(false);
  mode = 'hang';
  await up();
  const t0 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  const ms = Date.now() - t0;
  if (ms > 5000) errs.push(`took ${ms} ms`);
  if (!/LRPS/.test(await page.title())) errs.push('cached page not served');
  await down();
  mode = 'up';
});

// ------------------------------------------------------------ 4. a new release

await check('New release while the app is open: update bar pops up by itself, with version, build and notes', async (errs) => {
  root = B.out;
  await up();
  // No reload: the app is open on release A. Coming back to it (or the 15-min timer) checks for a release.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  try {
    await page.waitForSelector('#update-bar:not([hidden])', { timeout: 20000 });
  } catch (e) { errs.push(`update bar never appeared (toasts: ${await toasts()})`); return; }
  const bar = await page.evaluate(() => ({
    title: document.getElementById('ub-title').textContent, sub: document.getElementById('ub-sub').textContent,
    reload: !document.getElementById('ub-reload').hidden, notesBtn: !document.getElementById('ub-notes-btn').hidden,
    pill: document.getElementById('ver-pill').className,
  }));
  if (!/Update ready — v\d+\.\d+\.\d+/.test(bar.title)) errs.push(`bar title: ${bar.title}`);
  if (!/relB0002/.test(bar.sub)) errs.push(`bar does not name the new build: ${bar.sub}`);
  if (!bar.reload || !bar.notesBtn) errs.push(`bar buttons: ${JSON.stringify(bar)}`);
  if (!/has-update/.test(bar.pill)) errs.push('version pill not flagged');
  await page.click('#ub-notes-btn');
  const notes = await page.$$eval('#ub-notes li', (li) => li.map((e) => e.textContent));
  if (notes.length !== B.release.notes.length) errs.push(`notes shown ${notes.length} of ${B.release.notes.length}`);
  // dismiss → pill reopens it
  await page.click('#ub-close');
  if (!(await page.$eval('#update-bar', (e) => e.hidden))) errs.push('dismiss did not close the bar');
  await page.click('#ver-pill');
  await page.waitForSelector('#update-bar:not([hidden])', { timeout: 5000 }).catch(() => errs.push('version pill did not reopen the update'));
  // release A's cache goes once B has finished activating
  const state = () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).active.state);
  for (let i = 0; i < 50 && (await state()) !== 'activated'; i++) await page.waitForTimeout(200);
  const keys = await cacheKeys();
  if (keys['lrps-relA0001']) errs.push(`release A's cache still present: ${JSON.stringify(keys)}`);
  if (!(keys['lrps-relB0002'] >= B.precache.length)) errs.push(`release B not fully cached: ${JSON.stringify(keys)}`);
});

await check('Reload onto the new release: new build runs, Data Book kept, pill shows the build, B runs offline', async (errs) => {
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#ub-reload')]);
  const ver = await page.$eval('script[src*="common.js"]', (s) => s.getAttribute('src'));
  if (!/relB0002/.test(ver)) errs.push(`still on the old release: ${ver}`);
  if (!(await page.$eval('#update-bar', (e) => e.hidden))) errs.push('update bar still up after reloading onto the release');
  const shots = await page.evaluate(() => JSON.parse(localStorage.getItem('lrps.book')).sessions.flatMap((s) => s.shots || []).length);
  if (!shots) errs.push('Data Book lost in the update');
  await page.click('#ver-pill');
  await page.waitForSelector('#update-bar:not([hidden])', { timeout: 5000 }).catch(() => errs.push('version pill did not open the bar'));
  const info = await page.evaluate(() => ({ title: document.getElementById('ub-title').textContent, sub: document.getElementById('ub-sub').textContent, reload: !document.getElementById('ub-reload').hidden, notes: document.querySelectorAll('#ub-notes li').length }));
  if (!/You're on v/.test(info.title) || !/relB0002/.test(info.sub) || info.reload || !info.notes) errs.push(`version info: ${JSON.stringify(info)}`);
  await page.click('#ub-close');
  await down();
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await everyTab(errs);
  await ctx.setOffline(false);
});

await check('No console or page errors across all of it', async (errs) => {
  consoleErrors.forEach((e) => errs.push(e.slice(0, 200)));
});

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${results.length - failures}/${results.length} offline checks passed${failures ? ` · ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
