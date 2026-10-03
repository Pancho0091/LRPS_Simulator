'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/book/model.js');
const B = require('../js/ballistics.js');

// ------------------------------------------------------------ conditions

test('density altitude: standard day at sea level is ~0 ft', () => {
  const da = M.densityAltitude({ altFt: 0, tempF: 59, pressureInHg: 29.92, humidityPct: 0 });
  assert.ok(Math.abs(da) < 30, `DA ${da}`);
});

test('density altitude rises with heat and altitude, falls with pressure', () => {
  const base = M.densityAltitude({ altFt: 1000, tempF: 59, pressureInHg: M.stdPressureInHg(1000), humidityPct: 0 });
  const hot = M.densityAltitude({ altFt: 1000, tempF: 95, pressureInHg: M.stdPressureInHg(1000), humidityPct: 0 });
  const high = M.densityAltitude({ altFt: 6000, tempF: 59, pressureInHg: M.stdPressureInHg(6000), humidityPct: 0 });
  const dense = M.densityAltitude({ altFt: 1000, tempF: 59, pressureInHg: 30.5, humidityPct: 0 });
  assert.ok(hot > base + 1500, `hot ${hot} vs ${base}`);
  assert.ok(high > base + 4000, `high ${high} vs ${base}`);
  assert.ok(dense < base, `dense ${dense} vs ${base}`);
});

test('density altitude uses the solver\'s own atmosphere (station pressure wins over altitude)', () => {
  const cond = { altFt: 5000, tempF: 80, pressureInHg: 24.9, humidityPct: 20 };
  const mine = M.densityAltitude(cond);
  const solver = Math.round(B.atmosphere({ altitudeFt: 5000, tempF: 80, humidityPct: 20, stationPressureInHg: 24.9 }).densityAltitudeFt);
  assert.equal(mine, solver);
  // a pressure of 0/blank falls back to altitude
  const noP = M.densityAltitude({ altFt: 5000, tempF: 80, humidityPct: 20 });
  const solverNoP = Math.round(B.atmosphere({ altitudeFt: 5000, tempF: 80, humidityPct: 20 }).densityAltitudeFt);
  assert.equal(noP, solverNoP);
});

test('stdPressureInHg: 29.92 at sea level, ~24.9 at 5000 ft', () => {
  assert.ok(Math.abs(M.stdPressureInHg(0) - 29.92) < 0.01);
  assert.ok(Math.abs(M.stdPressureInHg(5000) - 24.9) < 0.1);
});

test('snapshot stores the inputs and the DA they gave; normalizeCond keeps a stored DA as evidence', () => {
  const s = M.snapshot({ altFt: 2500, tempF: 90, pressureInHg: 27.3, humidityPct: 15, source: 'gps' });
  assert.deepEqual(Object.keys(s).sort(), ['altFt', 'daFt', 'humidityPct', 'pressureInHg', 'source', 'tempF']);
  assert.equal(s.source, 'gps');
  assert.equal(s.daFt, M.densityAltitude(s));
  // a stored snapshot is never recomputed: a stale daFt stays what was written
  const kept = M.normalizeCond({ altFt: 2500, tempF: 90, pressureInHg: 27.3, humidityPct: 15, daFt: 1234 });
  assert.equal(kept.daFt, 1234);
  // but a missing one is filled once
  assert.equal(M.normalizeCond({ altFt: 2500, tempF: 90, pressureInHg: 27.3, humidityPct: 15 }).daFt, s.daFt);
  assert.equal(M.normalizeCond('garbage').source, 'typed');
});

// ------------------------------------------------------------ chrono

test('chronoStats: n, avg, sample SD, ES; ignores garbage', () => {
  const st = M.chronoStats([2700, 2710, 2720, 2690, 2705]);
  assert.equal(st.n, 5);
  assert.equal(st.avg, 2705);
  assert.equal(st.es, 30);
  assert.ok(Math.abs(st.sd - 11.2) < 0.1, `sd ${st.sd}`);
  assert.deepEqual(M.chronoStats([]), { n: 0, avg: 0, sd: 0, es: 0, min: 0, max: 0 });
  assert.equal(M.chronoStats(['2700', 'x', -5, 0, 2710]).n, 2);
  assert.equal(M.chronoStats([2700]).sd, 0);
});

test('parseFps accepts commas, spaces and newlines', () => {
  assert.deepEqual(M.parseFps('2710, 2718\n2704 abc 0'), [2710, 2718, 2704]);
  assert.deepEqual(M.parseFps(null), []);
});

// ------------------------------------------------------------ records

test('makeRifle / makeLot / makeSession produce the Phase-1 shapes with MIL clicks', () => {
  const r = M.makeRifle({ name: 'Tikka', barrelIn: 24, twistIn: 8, sightHeightIn: 2.0, travelMil: 30, zeroYd: 100 });
  assert.ok(/^r/.test(r.id));
  assert.equal(r.clickMil, 0.1);
  assert.ok(r.createdAt > 0 && r.updatedAt === r.createdAt);
  const l = M.makeLot(r.id, { loadName: '140 ELD-M', lotNo: 'A1', bulletGr: 140, diaIn: 0.264, lenIn: 1.37, bc: 0.326, dragModel: 'G7' });
  assert.equal(l.rifleId, r.id);
  assert.equal(l.chrono, null);
  const z = M.makeSession('zero', r.id, l.id, { altFt: 100, tempF: 70 });
  assert.equal(z.kind, 'zero');
  assert.deepEqual(z.dial, { e: 0, w: 0 });
  assert.equal(z.group.yd, 100);
  assert.equal(z.confirmed, false);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(z.date));
  assert.equal(typeof z.cond.daFt, 'number');
  const c = M.makeSession('chrono', r.id, l.id, {}, { fps: [2700, 2710] });
  assert.equal(c.stats.n, 2);
  const f = M.makeSession('field', r.id, null, {}, { shots: [{ yd: 600, dialE: 3.4, result: 'hit' }, { yd: 'x' }] });
  assert.equal(f.shots.length, 1, 'a shot without a range is dropped');
  assert.equal(f.shots[0].cond.source, 'typed');
  assert.equal(M.makeSession('nope', r.id, null, {}), null);
});

test('normalizeShot coerces results, rounds dials to 0.1 and keeps the conditions snapshot', () => {
  const s = M.normalizeShot({ yd: 812.4, dialE: 5.44, dialW: -0.26, result: 'sideways', offMil: '0.3', windMph: '8', windClock: 2, note: 'x'.repeat(300), cond: { altFt: 4000, tempF: 40, pressureInHg: 25.8, humidityPct: 50, daFt: 3200 } });
  assert.equal(s.yd, 812);
  assert.equal(s.dialE, 5.4);
  assert.equal(s.dialW, -0.3);
  assert.equal(s.result, 'miss');
  assert.equal(s.offMil, 0.3);
  assert.equal(s.windMph, 8);
  assert.equal(s.note.length, 200);
  assert.equal(s.cond.daFt, 3200);
});

// ------------------------------------------------------------ validate / merge

function sampleBook() {
  const r = M.makeRifle({ name: 'R' });
  const l = M.makeLot(r.id, { loadName: 'L' });
  const s = M.makeSession('field', r.id, l.id, {}, { shots: [{ yd: 300, result: 'hit' }] });
  return { v: 1, rifles: [r], lots: [l], sessions: [s] };
}

test('validateBook: garbage never blanks the book, bad records are dropped and counted', () => {
  assert.deepEqual(M.validateBook(null).book, M.blankBook());
  assert.deepEqual(M.validateBook('abc').book, M.blankBook());
  assert.deepEqual(M.validateBook([1, 2]).book, M.blankBook());
  const v = M.validateBook({ v: 1, rifles: 'nope', lots: [{ id: 'l1', rifleId: 'ghost' }], sessions: [null, { id: 's1', rifleId: 'ghost', kind: 'field' }, { id: 's2', kind: 'zero' }] });
  assert.equal(v.ok, false);
  assert.equal(v.book.lots.length, 0, 'orphan lot dropped');
  assert.equal(v.book.sessions.length, 0, 'orphan sessions dropped');
  assert.ok(v.dropped >= 3);
  const good = M.validateBook(sampleBook());
  assert.equal(good.ok, true);
  assert.equal(good.book.sessions[0].shots.length, 1);
});

test('validateBook: duplicate ids are dropped, a session whose lot is gone keeps its data', () => {
  const b = sampleBook();
  b.rifles.push(Object.assign({}, b.rifles[0]));
  b.sessions[0].lotId = 'gone';
  const v = M.validateBook(b);
  assert.equal(v.book.rifles.length, 1);
  assert.equal(v.book.sessions.length, 1);
  assert.equal(v.book.sessions[0].lotId, null);
});

test('mergeBooks: merges by id, adds new, never overwrites a newer record', () => {
  const base = sampleBook();
  const inc = JSON.parse(JSON.stringify(base));
  // an older copy of the rifle must not win
  inc.rifles[0].name = 'OLD NAME'; inc.rifles[0].updatedAt = base.rifles[0].updatedAt - 1000;
  // a newer copy of the session must win
  inc.sessions[0].shots.push({ yd: 400, result: 'low', offMil: -0.3 }); inc.sessions[0].updatedAt = base.sessions[0].updatedAt + 1000;
  // and a brand-new session is added
  inc.sessions.push(M.makeSession('chrono', base.rifles[0].id, base.lots[0].id, {}, { fps: [2700, 2712] }));
  const m = M.mergeBooks(base, inc);
  assert.equal(m.book.rifles[0].name, 'R');
  assert.equal(m.book.sessions.find((s) => s.kind === 'field').shots.length, 2);
  assert.equal(m.book.sessions.length, 2);
  assert.deepEqual({ added: m.added, updated: m.updated, kept: m.kept }, { added: 1, updated: 1, kept: 2 });
  // merging garbage changes nothing
  const m2 = M.mergeBooks(base, 'nope');
  assert.deepEqual(m2.book, M.validateBook(base).book);
  assert.equal(m2.added, 0);
});

test('deleteRifle cascades; deleteLot unlinks but keeps sessions', () => {
  const b = M.validateBook(sampleBook()).book;
  const other = M.makeRifle({ name: 'Other' });
  b.rifles.push(other);
  b.sessions.push(M.makeSession('zero', other.id, null, {}));
  const dl = M.deleteLot(b, b.lots[0].id);
  assert.equal(dl.unlinked, 1);
  assert.equal(b.sessions.length, 2);
  assert.equal(b.sessions[0].lotId, null);
  const dr = M.deleteRifle(b, b.rifles[0].id);
  assert.deepEqual(dr, { lots: 0, sessions: 1 });
  assert.equal(b.rifles.length, 1);
  assert.equal(b.sessions.length, 1);
  assert.equal(b.sessions[0].rifleId, other.id);
  assert.equal(M.validateBook(b).ok, true);
});

test('a stored book round-trips through JSON unchanged', () => {
  const b = M.validateBook(sampleBook()).book;
  const again = M.validateBook(JSON.parse(JSON.stringify(b))).book;
  assert.deepEqual(again, b);
});

// ------------------------------------------------------------ summaries

test('sessionSummary is one readable line per kind', () => {
  const r = M.makeRifle({ name: 'R' });
  const z = M.makeSession('zero', r.id, null, {}, { group: { sizeIn: 0.6, yd: 100 }, dial: { e: 0.2, w: -0.1 }, confirmed: true });
  assert.equal(M.sessionSummary(z), '0.6" at 100 yd · dial +0.2 / -0.1 · confirmed');
  const c = M.makeSession('chrono', r.id, null, {}, { fps: [2700, 2710, 2720] });
  assert.equal(M.sessionSummary(c), '3 shots · avg 2710 · SD 10 · ES 20');
  const f = M.makeSession('field', r.id, null, {}, { shots: [{ yd: 300, result: 'hit' }, { yd: 850, result: 'low' }] });
  assert.equal(M.sessionSummary(f), '2 shots · 300–850 yd · 1 hit');
  assert.equal(M.sessionSummary(M.makeSession('field', r.id, null, {})), 'no shots');
});
