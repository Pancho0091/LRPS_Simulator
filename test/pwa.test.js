'use strict';
// Offline / install plumbing: manifest, icons, service worker, and the staging step that ships them.
// The end-to-end proof (server down, weak signal, release hand-over) is `npm run offline`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const pngSize = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); assert.equal(b.toString('ascii', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest: installable, standalone, scoped to the site, every icon exists at its stated size', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons', 'theme_color', 'background_color']) assert.ok(m[k], k);
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, './');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'), 'maskable 512');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'), '192');
  for (const i of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)]) {
    assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src);
    if (i.type === 'image/png') assert.deepEqual(pngSize(i.src), i.sizes.split('x').map(Number), i.src);
  }
  for (const s of m.shortcuts) assert.match(s.url, /^\.\/#(book|range|academy)$/);
});

test('index.html links the manifest + touch icon, loads pwa.js last, and the CSP allows the worker', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.match(csp, /worker-src 'self'/);
  assert.match(csp, /manifest-src 'self'/);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(scripts[scripts.length - 1], 'js/pwa.js');
});

test('sw.js compiles and carries the markers the staging step replaces', () => {
  const sw = read('sw.js');
  assert.doesNotThrow(() => new vm.Script(sw, { filename: 'sw.js' }));
  assert.match(sw, /\/\*@version\*\/'dev'\/\*@end\*\//);
  assert.match(sw, /\/\*@precache\*\/\[\]\/\*@end\*\//);
});

test('stage: cache-busts css/js, precaches every shipped file, and stamps the worker with the release', async () => {
  const { stage } = await import(path.join(ROOT, 'scripts/stage.mjs'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lrps-stage-'));
  try {
    const r = stage(out, 'abc12345');
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(assets.length > 20);
    for (const a of assets) assert.match(a, /\?v=abc12345$/, a);
    for (const a of assets) assert.ok(r.precache.includes(a), `not precached: ${a}`);
    for (const f of ['./', 'manifest.webmanifest', 'fonts/inter-latin.woff2', 'fonts/jetbrains-mono-latin.woff2', 'icons/icon-192.png', 'icons/apple-touch-icon.png']) assert.ok(r.precache.includes(f), f);
    const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
    assert.match(sw, /const VERSION = "abc12345";/);
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[^\n]*\]);/)[1]);
    assert.deepEqual(list, r.precache);
    assert.doesNotThrow(() => new vm.Script(sw));
    assert.ok(fs.existsSync(path.join(out, '.nojekyll')));
    assert.throws(() => stage(out, 'bad version!'), /bad version/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------ version control
// A release has one version. It lives in five places; all must agree, or the build fails here.

test('version: package.json, release.json, index.html meta + pill, README badge and newest changelog row agree', () => {
  const v = JSON.parse(read('package.json')).version;
  assert.match(v, /^\d+\.\d+\.\d+$/, 'package.json version is semver');
  const rel = JSON.parse(read('release.json'));
  assert.equal(rel.version, v, 'release.json');
  assert.match(rel.date, /^\d{4}-\d{2}-\d{2}$/, 'release.json date');
  assert.ok(Array.isArray(rel.notes) && rel.notes.length && rel.notes.every((n) => typeof n === 'string' && n.trim()), 'release.json notes');
  const html = read('index.html');
  assert.equal((html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1], v, 'index.html app-version meta');
  assert.equal((html.match(/id="ver-pill"[^>]*>v([^<]+)</) || [])[1], v, 'index.html version pill');
  const readme = read('README.md');
  assert.equal((readme.match(/badge\/version-v([\d.]+)-/) || [])[1], v, 'README version badge');
  const firstRow = readme.match(/^\| \*\*v([\d.]+)\*\* \| (\d{4}-\d{2}-\d{2}) \|/m);
  assert.ok(firstRow, 'README changelog has rows');
  assert.equal(firstRow[1], v, 'README newest changelog row');
  assert.equal(firstRow[2], rel.date, 'README changelog date matches release.json');
});

test('version: the staged site carries version.json with the release notes and the build id', async () => {
  const { stage } = await import(path.join(ROOT, 'scripts/stage.mjs'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lrps-ver-'));
  try {
    const r = stage(out, 'deadbeef');
    const j = JSON.parse(fs.readFileSync(path.join(out, 'version.json'), 'utf8'));
    assert.equal(j.version, JSON.parse(read('package.json')).version);
    assert.equal(j.build, 'deadbeef');
    assert.deepEqual(j.notes, JSON.parse(read('release.json')).notes);
    assert.ok(r.precache.includes('version.json'), 'version.json precached (the bar works offline)');
    assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /<meta name="app-build" content="deadbeef">/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
