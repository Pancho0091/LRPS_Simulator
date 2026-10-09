// Stage the deployable site into <outDir>, exactly as GitHub Pages serves it.
//   node scripts/stage.mjs <outDir> [version]
// Used by .github/workflows/pages.yml and by scripts/offline-check.mjs, so the
// file the tests exercise is the file that ships.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHIPPED = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'fonts', 'icons'];

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

// One version per release, in four places that must agree (test/pwa.test.js checks the repo copies)
export function releaseInfo() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const rel = JSON.parse(fs.readFileSync(path.join(ROOT, 'release.json'), 'utf8'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const meta = (html.match(/<meta name="app-version" content="([^"]+)">/) || [])[1];
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error(`package.json version "${pkg.version}" is not semver`);
  if (rel.version !== pkg.version) throw new Error(`release.json ${rel.version} ≠ package.json ${pkg.version}`);
  if (meta !== pkg.version) throw new Error(`index.html app-version ${meta} ≠ package.json ${pkg.version}`);
  if (!Array.isArray(rel.notes) || !rel.notes.length || rel.notes.some((n) => typeof n !== 'string' || !n.trim())) throw new Error('release.json needs non-empty notes');
  return { version: pkg.version, date: rel.date, title: rel.title || '', notes: rel.notes };
}

// `version` is the build id (the commit on deploy): it names the service-worker cache, so every deploy is a new cache
export function stage(outDir, version = 'dev') {
  if (!/^[\w.-]{1,40}$/.test(version)) throw new Error(`bad version "${version}"`);
  const release = releaseInfo();
  const out = path.resolve(outDir);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const item of SHIPPED) fs.cpSync(path.join(ROOT, item), path.join(out, item), { recursive: true });

  // Cache-bust every stylesheet and script with the release, so a fresh page never runs stale assets
  const indexPath = path.join(out, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8')
    .replace(/(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))"/g, `$1="$2?v=${version}"`)
    .replace(/(<meta name="app-version" content="[^"]+">)/, `$1\n  <meta name="app-build" content="${version}">`);
  fs.writeFileSync(indexPath, html);

  // What the update bar shows: this release's version, build and notes
  fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ ...release, build: version }, null, 2) + '\n');

  // Precache: the page, every asset it references, and every font and icon (fonts are referenced from CSS)
  const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  const files = ['fonts', 'icons'].flatMap((d) => listFiles(path.join(out, d)).map((f) => `${d}/${f}`));
  const precache = [...new Set(['./', 'version.json', ...refs, ...files])];
  for (const url of precache) {
    const file = url === './' ? 'index.html' : url.split('?')[0];
    if (!fs.existsSync(path.join(out, file))) throw new Error(`precache entry has no file: ${url}`);
  }

  const swPath = path.join(out, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  const swap = (tag, value) => {
    const re = new RegExp(`/\\*@${tag}\\*/[\\s\\S]*?/\\*@end\\*/`);
    if (!re.test(sw)) throw new Error(`sw.js is missing the @${tag} marker`);
    sw = sw.replace(re, value);
  };
  swap('version', JSON.stringify(version));
  swap('precache', JSON.stringify(precache));
  fs.writeFileSync(swPath, sw);

  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  return { out, version, release, precache };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outDir, version] = process.argv.slice(2);
  if (!outDir) { console.error('usage: node scripts/stage.mjs <outDir> [version]'); process.exit(2); }
  const r = stage(outDir, version);
  console.log(`staged ${r.out} · v${r.release.version} build ${r.version} · ${r.precache.length} files precached`);
}
