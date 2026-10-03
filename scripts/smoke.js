#!/usr/bin/env node
/*
 * Browser smoke test for the static app. Opens index.html via file:// in
 * headless Chromium (Playwright) and drives every tab.
 *
 *   npm run smoke            (or: node scripts/smoke.js)
 *   SMOKE_HEADED=1 npm run smoke   to watch it
 *
 * Every check runs in a fresh browser context (empty localStorage). Any
 * uncaught page error or console error (Google Fonts failures excepted) fails
 * the check it happened in. Exits non-zero if any check fails.
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  const root = require('child_process').execSync('npm root -g').toString().trim();
  return require(path.join(root, 'playwright'));
}
const { chromium } = loadPlaywright();

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const TABS = ['academy', 'lab', 'build', 'drill', 'range'];
const DESKTOP = { width: 1366, height: 1000 };
const MOBILE = { width: 390, height: 844 };
const T0 = Date.now();

// ------------------------------------------------------------ harness

const results = [];   // { name, ok, details[], warnings[], ms }
let browser;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isFontNoise(text, url) {
  const s = `${text || ''} ${url || ''}`;
  return /fonts\.(googleapis|gstatic)\.com/.test(s) || /ERR_CERT_AUTHORITY_INVALID/.test(s);
}

/** A fresh context + page with error capture. */
async function newPage(opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || DESKTOP,
    colorScheme: opts.colorScheme || 'dark',
    reducedMotion: 'reduce',
  });
  // Fonts cannot load in the sandbox; fail them fast instead of waiting on TLS.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location() || {};
    if (isFontNoise(msg.text(), loc.url)) return;
    errors.push(`console.error: ${msg.text()}${loc.url ? ` (${loc.url.split('/').pop()}:${loc.lineNumber})` : ''}`);
  });
  page.on('requestfailed', (req) => {
    if (isFontNoise('', req.url())) return;
    errors.push(`request failed: ${req.url()} (${req.failure() && req.failure().errorText})`);
  });
  return { context, page, errors };
}

async function gotoTab(page, tab) {
  // A hash-only change is a same-document navigation; force a real load.
  if (page.url().startsWith(APP_URL)) await page.goto('about:blank');
  await page.goto(`${APP_URL}#${tab}`, { waitUntil: 'load' });
  await page.waitForFunction((t) => window.LRPS && window.LRPS.currentTab === t, tab);
}

async function clickTab(page, tab) {
  await page.click(`.tab[data-tab="${tab}"]`);
  await page.waitForFunction((t) => window.LRPS.currentTab === t, tab);
}

/**
 * Run one check. fn(ctx) gets { page, errors, fail, warn, info } and may
 * throw; any captured page/console error also fails it.
 */
async function check(name, fn, pageOpts) {
  const t = Date.now();
  const r = { name, ok: true, details: [], warnings: [], ms: 0 };
  let ctx;
  try {
    ctx = await newPage(pageOpts);
    const api = {
      page: ctx.page,
      errors: ctx.errors,
      fail: (msg) => { r.ok = false; r.details.push(msg); },
      warn: (msg) => r.warnings.push(msg),
      info: (msg) => r.details.push(msg),
    };
    await fn(api);
  } catch (e) {
    r.ok = false;
    r.details.push(`threw: ${(e && e.message ? e.message : String(e)).split('\n')[0]}`);
  }
  if (ctx) {
    if (ctx.errors.length) {
      r.ok = false;
      [...new Set(ctx.errors)].forEach((e) => r.details.push(e));
    }
    await ctx.context.close().catch(() => {});
  }
  r.ms = Date.now() - t;
  results.push(r);
  const tag = r.ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}  (${(r.ms / 1000).toFixed(1)}s)`);
  r.details.forEach((d) => console.log(`      ${r.ok ? '·' : '✗'} ${d}`));
  r.warnings.forEach((w) => console.log(`      ! ${w}`));
  return r;
}

// ------------------------------------------------------------ 1. tabs

const TAB_CONTENT = {
  academy: '#ac-main',
  lab: '#lab-controls',
  build: '#card-output',
  drill: '#drill-body',
  range: '#kestrel',
};

async function checkTabs(colorScheme) {
  await check(`Load every tab · ${colorScheme} · 1366×1000`, async ({ page, fail, info }) => {
    await gotoTab(page, 'academy');
    for (const tab of TABS) {
      await clickTab(page, tab);
      const st = await page.evaluate(({ tab, sel }) => {
        const panel = document.getElementById('tab-' + tab);
        const el = document.querySelector(sel);
        return {
          active: !!panel && panel.classList.contains('active'),
          visible: !!panel && panel.getBoundingClientRect().height > 0,
          content: el ? el.innerHTML.trim().length : -1,
        };
      }, { tab, sel: TAB_CONTENT[tab] });
      if (!st.active || !st.visible) fail(`${tab}: panel not shown`);
      if (st.content <= 0) fail(`${tab}: ${TAB_CONTENT[tab]} is empty`);
    }
    // Direct hash loads route to the right tab too
    for (const tab of TABS) await gotoTab(page, tab);
    info(`all ${TABS.length} tabs rendered (click + #hash)`);
  }, { colorScheme });
}

// ------------------------------------------------------------ 2. academy

/** Open a lesson by id the way a user would (select), with fallbacks. */
async function openLesson(page, id) {
  return page.evaluate((id) => {
    const sel = document.getElementById('ac-select');
    if (sel && [...sel.options].some((o) => o.value === id)) {
      sel.value = id;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return 'select';
    }
    const btn = document.querySelector(`[data-lesson="${id}"]:not([disabled]), [data-open="${id}"]:not([disabled])`);
    if (btn) { btn.click(); return 'button'; }
    return null;
  }, id);
}

/** Lesson unlock state as the UI shows it (select option, else sidebar button). */
async function lessonLocked(page, id) {
  return page.evaluate((id) => {
    const opt = [...document.querySelectorAll('#ac-select option')].find((o) => o.value === id);
    if (opt) return opt.disabled;
    const b = document.querySelector(`[data-lesson="${id}"]`);
    return b ? b.disabled : null;
  }, id);
}

/** Lesson heading text without decorations such as the "03.2" lesson code. */
async function waitLessonTitle(page, title, timeout) {
  await page.waitForFunction((t) => {
    const h = document.querySelector('#ac-main .ac-title');
    if (!h) return false;
    const c = h.cloneNode(true);
    c.querySelectorAll('.ac-title-code, svg').forEach((x) => x.remove());
    const txt = c.textContent.replace(/\s+/g, ' ').trim();
    return txt === t || txt.endsWith(t);
  }, title, timeout ? { timeout } : undefined);
}

async function checkAcademy() {
  // Course metadata, computed the same way academy.js does
  const courseInfo = (page) => page.evaluate(() => {
    const bank = {};
    (window.LRPS_ACADEMY || []).forEach((ch) => ch.lessons.forEach((l) => { bank[l.id] = l; }));
    const all = [];
    const order = [];
    window.LRPS_COURSE.forEach((m) => m.lessons.forEach((x) => {
      const l = Object.assign({}, x.ref ? bank[x.ref] : {}, x, { id: x.ref || x.id });
      const info = { id: l.id, title: l.title, module: m.title, reference: !!m.reference, missingRef: !!(x.ref && !bank[x.ref]),
        quiz: (l.quiz || []).map((q) => q.answer) };
      all.push(info);
      if (!m.reference) order.push(info);
    }));
    return { all, order };
  });

  await check('Academy · linear unlock + quiz', async ({ page, fail, info, warn }) => {
    await gotoTab(page, 'academy');
    const { order } = await courseInfo(page);
    const [first, second] = order;
    if (!first || !second) { fail('course has fewer than 2 lessons'); return; }

    // Course map
    const map = await page.evaluate(() => ({
      mods: document.querySelectorAll('.path-mod').length,
      lockedMods: document.querySelectorAll('.path-mod[disabled], .path-mod.locked').length,
      cont: !!document.getElementById('ac-continue'),
    }));
    if (!map.cont) fail('#ac-continue missing on the course map');
    if (!map.mods) warn('no .path-mod buttons on the course map (layout changed?)');
    else if (!map.lockedMods) warn('course map: no .path-mod marked locked/disabled on a fresh profile (layout changed?)');
    else info(`course map: ${map.mods} modules, ${map.lockedMods} locked`);

    if ((await lessonLocked(page, first.id)) !== false) fail(`first lesson "${first.title}" is not unlocked`);
    if ((await lessonLocked(page, second.id)) !== true) fail(`second lesson "${second.title}" is not locked`);

    // Continue → first lesson
    if (map.cont) await page.click('#ac-continue');
    else await openLesson(page, first.id);
    await waitLessonTitle(page, first.title);

    // Answer the quiz correctly (or mark as read if it has none)
    if (first.quiz.length) {
      const qs = await page.$$('#ac-quiz .qz');
      if (qs.length !== first.quiz.length) fail(`quiz shows ${qs.length} questions, course data has ${first.quiz.length}`);
      for (let qi = 0; qi < first.quiz.length; qi++) {
        await page.click(`#ac-quiz .qz[data-q="${qi}"] .qz-opt[data-o="${first.quiz[qi]}"]`);
      }
      await page.waitForSelector('#qz-result .result-banner.good');
    } else {
      await page.click('#ac-done');
    }
    await page.waitForFunction(({ id }) => {
      const opt = [...document.querySelectorAll('#ac-select option')].find((o) => o.value === id);
      const b = document.querySelector(`[data-lesson="${id}"]`);
      return (opt && !opt.disabled) || (b && !b.disabled);
    }, { id: second.id });
    const nextBtn = await page.$(`#ac-navrow [data-open="${second.id}"]`);
    if (!nextBtn) fail('lesson nav row has no enabled "next lesson" button after a perfect quiz');
    else {
      await nextBtn.click();
      await waitLessonTitle(page, second.title);
    }
    const third = order[2];
    if (third && (await lessonLocked(page, third.id)) !== true) fail(`third lesson "${third.title}" unlocked too early`);
    info(`passed "${first.title}" quiz → "${second.title}" unlocked`);

    // Persistence: reload keeps progress
    await page.reload();
    await page.waitForFunction(() => window.LRPS && window.LRPS.currentTab === 'academy');
    if ((await lessonLocked(page, second.id)) !== false) fail('progress not persisted across reload');
  });

  await check('Academy · review mode, every lesson renders', async ({ page, fail, info }) => {
    await gotoTab(page, 'academy');
    const { all } = await courseInfo(page);
    const missing = all.filter((l) => l.missingRef);
    missing.forEach((l) => fail(`course lesson ref "${l.id}" not found in LRPS_ACADEMY bank`));

    await page.check('#ac-review');
    await page.waitForFunction(() => [...document.querySelectorAll('#ac-select option')].every((o) => !o.disabled));

    let widgets = 0;
    for (const l of all) {
      const how = await openLesson(page, l.id);
      if (!how) { fail(`${l.id}: no way to open it (not in #ac-select or sidebar)`); continue; }
      try {
        await waitLessonTitle(page, l.title, 3000);
      } catch (e) {
        const got = await page.$eval('#ac-main', (m) => (m.querySelector('.ac-title, h2') || m).textContent.trim().slice(0, 60)).catch(() => '?');
        fail(`${l.id}: title "${l.title}" not rendered (got "${got}")`);
        continue;
      }
      const st = await page.evaluate(() => {
        const main = document.getElementById('ac-main');
        const ws = [...main.querySelectorAll('[data-widget]')];
        return {
          body: (main.querySelector('.ac-body') || main).textContent.trim().length,
          widgets: ws.length,
          empty: ws.filter((w) => !w.innerHTML.trim()).map((w) => w.dataset.widget),
        };
      });
      widgets += st.widgets;
      if (st.body < 40) fail(`${l.id}: lesson body nearly empty (${st.body} chars)`);
      st.empty.forEach((w) => fail(`${l.id}: widget "${w}" rendered empty`));
    }
    info(`${all.length} lessons opened, ${widgets} widgets mounted`);
  });
}

// ------------------------------------------------------------ 3. build

async function checkBuild() {
  await check('Build · muzzle velocity re-renders the card', async ({ page, fail, info }) => {
    await gotoTab(page, 'build');
    const mv = page.locator('#profile-form input[name="muzzleVelocityFps"]');
    const before = await mv.inputValue();
    const cardBefore = await page.locator('#card-output').innerText();
    const tilesBefore = await page.locator('#build-tiles').innerText();
    if (!cardBefore.trim()) fail('#card-output empty before edit');
    const next = String(Math.round(+before) + 150);
    await mv.fill(next);
    try {
      await page.waitForFunction((b) => document.getElementById('card-output').innerText !== b, cardBefore, { timeout: 4000 });
    } catch (e) { fail(`card did not change after MV ${before} → ${next}`); return; }
    const tilesAfter = await page.locator('#build-tiles').innerText();
    if (tilesAfter === tilesBefore) fail('#build-tiles did not change');
    const saved = await page.evaluate(() => window.LRPS.profile.muzzleVelocityFps);
    if (+saved !== +next) fail(`LRPS.profile.muzzleVelocityFps is ${saved}, expected ${next}`);
    info(`MV ${before} → ${next}: card + tiles re-rendered`);
  });
}

// ------------------------------------------------------------ 4. drills

async function checkDrills() {
  await check('Drills · every type, check answers', async ({ page, fail, info }) => {
    await gotoTab(page, 'drill');
    const types = await page.$$eval('#drill-type button[data-v]', (bs) => bs.map((b) => b.dataset.v));
    if (!types.length) { fail('no #drill-type buttons'); return; }
    for (const t of types) {
      await page.click(`#drill-type button[data-v="${t}"]`);
      await page.waitForSelector('#drill-check');
      const inputs = page.locator('#drill-body .drill-input');
      const n = await inputs.count();
      if (!n) fail(`${t}: no answer inputs`);
      for (let i = 0; i < n; i++) await inputs.nth(i).fill('1');
      await page.click('#drill-check');
      try {
        await page.waitForFunction(() => document.getElementById('drill-explain').textContent.trim().length > 0, null, { timeout: 3000 });
      } catch (e) { fail(`${t}: #drill-explain stayed empty after check`); continue; }
      const next = await page.$('#drill-next');
      if (!next) fail(`${t}: no "next problem" button after check`);
      else await next.click();
      info(`${t}: ${n} cells graded`);
    }
  });
}

// ------------------------------------------------------------ 5. range

const verdict = (page) => page.$eval('#range-feedback', (el) => {
  const v = el.querySelector('.verdict');
  return v ? v.textContent.trim() : '';
});

async function waitShot(page, timeout = 8000) {
  await page.waitForFunction(() => {
    const v = document.querySelector('#range-feedback .verdict');
    return v && /HIT|MISS/.test(v.textContent) && !document.getElementById('fire-btn').disabled;
  }, null, { timeout });
}

async function checkRange() {
  await check('Range · training: dial up, fire', async ({ page, fail, info }) => {
    await gotoTab(page, 'range');
    await page.click('#range-preset button[data-v="training"]');
    await page.waitForSelector('#fire-btn:not([disabled])');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const e0 = +(await page.inputValue('#dial-elev'));
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Shift+ArrowUp');
    const e1 = +(await page.inputValue('#dial-elev'));
    if (!(e1 > e0)) fail(`ArrowUp did not raise elevation (${e0} → ${e1})`);
    else if (Math.abs(e1 - e0 - 1.0) > 0.051) fail(`5×↑ + Shift↑ should add 1.0 mil, got ${(e1 - e0).toFixed(2)}`);
    const w0 = +(await page.inputValue('#dial-wind'));
    await page.keyboard.press('ArrowRight');
    const w1 = +(await page.inputValue('#dial-wind'));
    if (!(w1 > w0)) fail(`ArrowRight did not move windage (${w0} → ${w1})`);
    await page.keyboard.press('Space');
    try { await waitShot(page); } catch (e) { fail('no HIT/MISS in #range-feedback within 8 s of Space'); return; }
    const rows = await page.$$eval('#shot-log tbody tr', (r) => r.length);
    if (rows !== 1) fail(`shot log has ${rows} rows, expected 1`);
    info(`dial ${e0} → ${e1.toFixed(1)} mil, Space fired: ${await verdict(page)}`);
  });

  await check('Range · realistic: fire, reveal, what changed', async ({ page, fail, info }) => {
    await gotoTab(page, 'range');
    await page.click('#range-preset button[data-v="realistic"]');
    await page.waitForSelector('#fire-btn:not([disabled])');
    await page.click('#fire-btn');
    try { await waitShot(page); } catch (e) { fail('no HIT/MISS in #range-feedback within 8 s'); return; }
    const v = await verdict(page);
    await page.click('#range-reveal');
    await page.waitForFunction(() => !document.getElementById('whatchanged-card').hidden);
    const rows = await page.$$eval('#whatchanged tbody tr', (r) => r.length);
    if (rows < 2) fail(`#whatchanged has ${rows} rows`);
    info(`fired (${v}), reveal → ${rows} "what changed" rows`);
  });

  await check('Range · PRS stage: 5 shots → summary', async ({ page, fail, info }) => {
    await gotoTab(page, 'range');
    await page.click('#range-mode button[data-v="stage"]');
    await page.waitForFunction(() => /STAGE READY/.test(document.getElementById('range-feedback').textContent));
    const n = await page.$$eval('#stage-list .st-row', (r) => r.length);
    if (n !== 5) fail(`stage list shows ${n} targets, expected 5`);
    for (let i = 0; i < n; i++) {
      await page.waitForFunction((i) => {
        const row = document.querySelectorAll('#stage-list .st-row')[i];
        return row && row.classList.contains('on') && !document.getElementById('fire-btn').disabled;
      }, i, { timeout: 8000 });
      await page.click('#fire-btn');
      await page.waitForFunction((i) => {
        const r = document.querySelectorAll('#stage-list .st-row')[i];
        return r && /HIT|MISS/.test(r.querySelector('.st-r').textContent);
      }, i, { timeout: 8000 });
    }
    try {
      await page.waitForFunction(() => /STAGE:\s*\d+\/\d+/.test(document.getElementById('range-feedback').textContent), null, { timeout: 5000 });
    } catch (e) { fail('no "STAGE: x/5" summary after 5 shots'); return; }
    const summary = (await verdict(page)) || '';
    const extra = await page.$('#range-feedback #stage-again');
    if (!extra) fail('stage summary has no "Run another stage" button');
    // Firing after the stage is over must do nothing
    await page.click('#fire-btn');
    await sleep(150);
    if (!/STAGE:/.test(await verdict(page))) fail('firing after stage end replaced the summary');
    info(`${summary}`);
  });
}

// ------------------------------------------------------------ 6. mobile

async function checkMobile() {
  for (const tab of TABS) {
    await check(`Mobile 390×844 · ${tab} · no horizontal overflow`, async ({ page, fail, info }) => {
      await gotoTab(page, tab);
      if (tab === 'range') await page.waitForFunction(() => document.getElementById('kestrel').innerHTML.trim().length > 0);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const views = [{ label: tab, setup: null }];
      if (tab === 'academy') {
        views.push({ label: 'academy lesson 1', setup: async () => { await page.click('#ac-continue'); await page.waitForSelector('#ac-quiz'); } });
      }
      for (const v of views) {
        if (v.setup) await v.setup();
        const r = await measureOverflow(page, MOBILE.width);
        if (r.scrollWidth > MOBILE.width) {
          fail(`${v.label}: documentElement.scrollWidth = ${r.scrollWidth} > ${MOBILE.width}`);
          if (!r.offenders.length) fail('  (no single offending element found — check body/html margins)');
          r.offenders.forEach((o) => fail(`  ${o}`));
        } else {
          info(`${v.label}: scrollWidth ${r.scrollWidth}`);
        }
      }
    }, { viewport: MOBILE, colorScheme: 'light' });
  }
}

/** scrollWidth, plus the outermost elements sticking out past the viewport. */
function measureOverflow(page, vw) {
  return page.evaluate((vw) => {
    const scrollableX = (el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll|hidden|clip)/.test(s.overflowX) && el !== document.documentElement && el !== document.body;
    };
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (p.classList.contains('table-wrap') || scrollableX(p)) return true;
      }
      return false;
    };
    const desc = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      if (el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
      return s;
    };
    const bad = [];
    for (const el of document.body.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right <= vw + 0.5) continue;
      if (el.closest('.panel') && !el.closest('.panel.active')) continue;
      if (inScroller(el)) continue;
      bad.push({ el, right: Math.round(r.right), width: Math.round(r.width) });
    }
    // Keep only the outermost offenders
    const outer = bad.filter((b) => !bad.some((o) => o !== b && o.el.contains(b.el)));
    return {
      scrollWidth: document.documentElement.scrollWidth,
      offenders: outer.slice(0, 15).map((b) => {
        const chain = [];
        for (let p = b.el; p && p !== document.body && chain.length < 4; p = p.parentElement) chain.unshift(desc(p));
        return `${chain.join(' > ')}  right=${b.right}px width=${b.width}px`;
      }),
    };
  }, vw);
}

// ------------------------------------------------------------ main

(async () => {
  console.log(`LRPS smoke test · ${APP_URL}\n`);
  browser = await chromium.launch({ headless: !process.env.SMOKE_HEADED });
  try {
    await checkTabs('dark');
    await checkTabs('light');
    await checkAcademy();
    await checkBuild();
    await checkDrills();
    await checkRange();
    await checkMobile();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(64));
  console.log('SUMMARY');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.warnings.length ? `  (${r.warnings.length} warning${r.warnings.length > 1 ? 's' : ''})` : ''}`));
  console.log('='.repeat(64));
  console.log(`${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - T0) / 1000).toFixed(1)}s` +
    (failed.length ? ` · ${failed.length} FAILED` : ''));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('smoke test crashed:', e);
  process.exit(2);
});
