'use strict';
/*
 * Physics audit of js/ballistics.js and the headless parts of its consumers.
 * Tests whose name starts with "[KNOWN BUG]" are expected to FAIL until the
 * finding they document is fixed; see the audit report.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const B = require('../js/ballistics.js');

const FT = 0.3048, YD = 0.9144, IN = 0.0254, OMEGA = 7.2921159e-5;
const CM65 = { muzzleVelocityFps: 2710, bc: 0.326, dragModel: 'G7', bulletWeightGr: 140, sightHeightIn: 1.9, zeroYards: 100, windMph: 0 };
const SYS65 = Object.assign({}, CM65, { bulletDiameterIn: 0.264, bulletLengthIn: 1.37, twistIn: 8 });
const solve = (extra, ranges, base) => B.solve(Object.assign({}, base || CM65, extra), ranges);
const row = (extra, yards, base) => solve(extra, [yards], base).rows[0];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const within = (v, lo, hi, msg) => assert.ok(v >= lo && v <= hi, `${msg || ''} ${v} not in [${lo}, ${hi}]`);

// ------------------------------------------------------------ constants & tables

test('BC scaling constant is 1 lb/in^2 in kg/m^2', () => {
  // the constant is not exported; check the one that is used indirectly via a vacuum-vs-drag ratio below,
  // and here the arithmetic the comment claims
  near(0.45359237 / (0.0254 * 0.0254), 703.0696, 1e-3);
});

test('G1 and G7 drag tables match published reference points', () => {
  // McCoy / JBM standard projectile tables
  const G1 = { 0.5: 0.2032, 0.9: 0.3415, 1.0: 0.4805, 1.4: 0.6625, 2.0: 0.5934, 3.0: 0.5133, 5.0: 0.4988 };
  const G7 = { 0.5: 0.1194, 0.9: 0.1464, 1.0: 0.3803, 1.05: 0.4043, 1.5: 0.3440, 2.0: 0.2980, 3.0: 0.2424, 5.0: 0.1618 };
  Object.entries(G1).forEach(([m, cd]) => near(B.cdAt(B.G1, +m), cd, 1e-4, `G1 M${m}`));
  Object.entries(G7).forEach(([m, cd]) => near(B.cdAt(B.G7, +m), cd, 1e-4, `G7 M${m}`));
  // G7 peaks just above Mach 1, G1 at ~Mach 1.4
  assert.equal(B.G7.reduce((a, b) => (b[1] > a[1] ? b : a))[0], 1.05);
  assert.equal(B.G1.reduce((a, b) => (b[1] > a[1] ? b : a))[0], 1.40);
});

test('drag tables are strictly increasing in Mach and cdAt interpolates/clamps', () => {
  [B.G1, B.G7].forEach((t) => { for (let i = 1; i < t.length; i++) assert.ok(t[i][0] > t[i - 1][0]); });
  near(B.cdAt(B.G7, 1.0125), (0.3803 + 0.4015) / 2, 1e-9, 'midpoint interpolation');
  assert.equal(B.cdAt(B.G7, -1), B.G7[0][1]);
  assert.equal(B.cdAt(B.G7, 9), B.G7[B.G7.length - 1][1]);
});

test('angular unit constants: 1 mil = 3.6 in @100 yd, 1 MOA = 1.0472 in @100 yd', () => {
  assert.equal(B.IN_PER_MIL_100, 3.6);
  near(B.IN_PER_MOA_100, 100 * 36 * Math.tan(Math.PI / 180 / 60), 1e-4);
  near(B.inchesToMil(36, 1000), 1, 1e-12);
  near(B.inchesToMoa(10.472, 1000), 1, 1e-4);
  near(B.milToInches(1, 100) / B.moaToInches(1, 100), 3.4377, 1e-3, 'mil/MOA ratio');
  assert.equal(B.inchesToMil(10, 0), 0);
});

// ------------------------------------------------------------ atmosphere

test('ICAO standard atmosphere: pressure vs altitude', () => {
  const inHg = (alt) => B.atmosphere({ altitudeFt: alt }).pressurePa / 3386.389;
  near(inHg(0), 29.92, 0.005);
  near(inHg(5000), 24.90, 0.01);
  near(inHg(10000), 20.58, 0.01);
  near(B.atmosphere({ altitudeFt: 36089 }).pressurePa, 22632, 30, 'tropopause');
});

test('standard day density, speed of sound and temperature scaling', () => {
  const a = B.atmosphere({});
  near(a.rho, 1.2250, 5e-4);
  near(a.speedOfSound / FT, 1116.4, 0.5, 'speed of sound 59F fps');
  near(a.tempK, 288.15, 1e-9);
  near(B.atmosphere({ tempF: 100 }).speedOfSound / FT, 1159.7, 0.5);
  near(B.atmosphere({ tempF: 0 }).speedOfSound / FT, 1051.0, 0.5);
  // temperature: ideal gas, density inversely proportional to T
  near(B.atmosphere({ tempF: 100 }).rho / a.rho, 288.15 / (100 - 32) * 5 / 9 / 273.15 * 0 + 288.15 / ((100 - 32) * 5 / 9 + 273.15), 1e-6);
});

test('humidity lowers density via vapour pressure (and is clamped to 0..100)', () => {
  const dry = B.atmosphere({ tempF: 95, humidityPct: 0 }).rho;
  const wet = B.atmosphere({ tempF: 95, humidityPct: 100 }).rho;
  within(1 - wet / dry, 0.015, 0.03, 'density drop at 95F/100%RH');
  // saturation pressure at 95F (35C) is ~5.63 kPa (Tetens)
  const T = (95 - 32) * 5 / 9 + 273.15;
  const pSat = (dry - wet) / (1 / (287.058 * T) - 1 / (461.495 * T));
  near(pSat, 5630, 60, 'pSat 35C');
  assert.equal(B.atmosphere({ tempF: 95, humidityPct: 150 }).rho, wet);
  assert.equal(B.atmosphere({ tempF: 95, humidityPct: -5 }).rho, dry);
  assert.ok(B.atmosphere({ tempF: 0, humidityPct: 100 }).rho > B.atmosphere({ tempF: 0, humidityPct: 100 }).rho * 0.999, 'cold humid air barely changes');
});

test('density altitude inverts the standard atmosphere and is driven by density only', () => {
  // ISA temperature falls 3.566 F per 1000 ft; at that temperature DA == altitude
  const isaF = (h) => 59 - 0.0065 * h * FT * 9 / 5;
  [0, 2500, 5000, 10000, 20000].forEach((h) => near(B.atmosphere({ altitudeFt: h, tempF: isaF(h) }).densityAltitudeFt, h, 2, `DA at ${h}`));
  // a 59F day at 5000 ft is 18F warmer than ISA, so DA is well above field elevation
  within(B.atmosphere({ altitudeFt: 5000 }).densityAltitudeFt, 6000, 6300);
  near(B.densityAltitude(1.225), 0, 1e-6);
  // hot day raises DA, cold day lowers it below field elevation
  assert.ok(B.atmosphere({ altitudeFt: 5000, tempF: 95 }).densityAltitudeFt > 7500);
  assert.ok(B.atmosphere({ altitudeFt: 5000, tempF: 0 }).densityAltitudeFt < 3000);
  assert.ok(B.atmosphere({ tempF: -100 }).densityAltitudeFt < 0);
});

test('station pressure overrides altitude (absolute pressure, not corrected to sea level)', () => {
  const a = B.atmosphere({ altitudeFt: 0, stationPressureInHg: 24.9 });
  const b = B.atmosphere({ altitudeFt: 9999, stationPressureInHg: 24.9 });
  assert.equal(a.rho, b.rho);
  near(a.densityAltitudeFt, 6145, 20);
});

test('atmosphere stays finite for extreme but plausible inputs', () => {
  [-100, 130].forEach((t) => assert.ok(Number.isFinite(B.atmosphere({ tempF: t }).rho)));
  [-1500, 36000].forEach((h) => assert.ok(Number.isFinite(B.atmosphere({ altitudeFt: h }).rho)));
});

// ------------------------------------------------------------ integrator

test('vacuum limit (huge BC) reproduces the analytic parabola in the LOS frame', () => {
  const pv = { muzzleVelocityFps: 2000, bc: 1e9, dragModel: 'G7', bulletWeightGr: 140, sightHeightIn: 2, zeroYards: 300, windMph: 0 };
  const res = B.solve(pv, [100, 300, 600, 1000]);
  const g = 9.80665, v0 = 2000 * FT, th = res.zeroAngleRad;
  res.rows.forEach((r) => {
    const x = r.yards * YD;
    const y = -2 * IN + x * Math.tan(th) - g * x * x / (2 * v0 * v0 * Math.cos(th) ** 2);
    near(r.dropIn, y / IN, 2e-3, `vacuum drop @${r.yards}`);
    near(r.tofSec, x / (v0 * Math.cos(th)), 1e-4, `vacuum tof @${r.yards}`);
    near(r.velocityFps, Math.hypot(v0 * Math.cos(th), v0 * Math.sin(th) - g * r.tofSec) / FT, 0.05, 'vacuum speed');
  });
  near(th, Math.atan((2 * IN + g * (300 * YD) ** 2 / (2 * v0 * v0)) / (300 * YD)), 2e-7, 'vacuum zero angle');
});

test('RK2 at dt=0.5 ms is converged: halving/quartering dt changes 1000 yd drop by < 0.01 in', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ballistics.js'), 'utf8');
  assert.ok(src.includes('const dt = 0.0005;'), 'step size changed; update this test');
  const load = (dt) => { const m = { exports: {} }; vm.runInNewContext(src.replace('const dt = 0.0005;', `const dt = ${dt};`), { module: m }); return m.exports; };
  const p = Object.assign({}, CM65, { windMph: 10, windClock: 3 });
  const ref = load(0.00005).solve(p, [1000]).rows[0];
  const cur = B.solve(p, [1000]).rows[0];
  near(cur.dropIn, ref.dropIn, 0.01);
  near(cur.windIn, ref.windIn, 0.01);
  near(cur.velocityFps, ref.velocityFps, 0.05);
  near(cur.tofSec, ref.tofSec, 1e-5);
});

test('zero bisection puts the bullet on the line of sight at the zero range (several loads)', () => {
  const lr = { muzzleVelocityFps: 1070, bc: 0.13, dragModel: 'G1', bulletWeightGr: 40, sightHeightIn: 1.5, windMph: 0 };
  [[CM65, 100], [CM65, 1000], [lr, 50], [lr, 300]].forEach(([l, z]) => near(row({ zeroYards: z }, z, l).dropIn, 0, 1e-6, `zero ${z}`));
  // sight height shows up as drop at the muzzle end
  near(row({}, 1).dropIn, -1.9, 0.05);
});

test('rows are sampled at exactly the requested ranges, in order', () => {
  const R = [100, 150, 325, 980];
  const rows = solve({}, R).rows;
  assert.deepEqual(rows.map((r) => r.yards), R);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].tofSec > rows[i - 1].tofSec && rows[i].velocityFps < rows[i - 1].velocityFps);
});

// ------------------------------------------------------------ published data

test('6.5 CM 140 ELD-M (G7 .326 @ 2710) at 1000 yd, sea level: ~8.8 mil / 30 MOA, ~1.9 mil per 10 mph', () => {
  const r = row({}, 1000), w = row({ windMph: 10, windClock: 3 }, 1000);
  within(r.elevMil, 8.5, 9.1, 'elev mil');
  within(r.elevMoa, 29.2, 31.3, 'elev MOA');
  within(w.windMil, 1.8, 2.0, 'wind mil');
  within(r.velocityFps, 1400, 1520, 'velocity');
  within(r.tofSec, 1.42, 1.55, 'tof');
  near(r.elevMil / r.elevMoa, 1 / 3.4377, 1e-3);
});

test('.308 175 SMK (G7 .243 @ 2600): ~11.9 mil at 1000, goes transonic around 900–1000', () => {
  const p = { muzzleVelocityFps: 2600, bc: 0.243, dragModel: 'G7', bulletWeightGr: 175, sightHeightIn: 1.9, zeroYards: 100, windMph: 0 };
  const r = row({}, 1000, p), w = row({ windMph: 10, windClock: 3 }, 1000, p);
  within(r.elevMil, 11.5, 12.3);
  within(w.windMil, 2.9, 3.3);
  within(r.velocityFps, 1050, 1150);
  const rows = solve({}, [800, 900, 1000], p).rows;
  assert.ok(rows[0].mach > 1.1 && rows[2].mach < 1.02);
});

test('.338 LM 300 gr Hybrid (G7 .419 @ 2750): ~7.5 mil at 1000, ~1.35 mil wind', () => {
  const p = { muzzleVelocityFps: 2750, bc: 0.419, dragModel: 'G7', bulletWeightGr: 300, sightHeightIn: 1.9, zeroYards: 100, windMph: 0 };
  within(row({}, 1000, p).elevMil, 7.3, 7.8);
  within(row({ windMph: 10, windClock: 3 }, 1000, p).windMil, 1.25, 1.45);
  within(row({}, 1000, p).velocityFps, 1700, 1800);
});

test('.223 77 TMK (G7 .210 @ 2750): ~11.9 mil at 1000 and subsonic by 1000', () => {
  const p = { muzzleVelocityFps: 2750, bc: 0.210, dragModel: 'G7', bulletWeightGr: 77, sightHeightIn: 1.9, zeroYards: 100, windMph: 0 };
  within(row({}, 1000, p).elevMil, 11.4, 12.4);
  assert.ok(row({}, 1000, p).mach < 1);
});

test('G1 path: .308 168 SMK (G1 .462 @ 2650) ~40 MOA at 1000', () => {
  const p = { muzzleVelocityFps: 2650, bc: 0.462, dragModel: 'G1', bulletWeightGr: 168, sightHeightIn: 1.5, zeroYards: 100, windMph: 0 };
  within(row({}, 1000, p).elevMoa, 38.5, 42);
});

test('.22 LR 40 gr (G1 .13 @ 1070, 50 yd zero): ~7 in low at 100, TOF ~0.30 s', () => {
  const p = { muzzleVelocityFps: 1070, bc: 0.13, dragModel: 'G1', bulletWeightGr: 40, sightHeightIn: 1.5, zeroYards: 50, windMph: 0 };
  within(row({}, 100, p).dropIn, -8.5, -6);
  within(row({}, 100, p).tofSec, 0.29, 0.32);
});

test('energy and Mach columns are consistent with velocity', () => {
  const r = row({}, 1);
  near(r.energyFtLb, 140 * r.velocityFps ** 2 / 450437, 1, 'E = m v^2 / 450437');
  within(r.energyFtLb, 2200, 2290, 'muzzle energy 6.5 CM 140');
  const atm = B.atmosphere({});
  near(r.mach, r.velocityFps * FT / atm.speedOfSound, 1e-9);
});

test('density altitude reduces elevation by a sensible amount (6.5 CM, 1000 yd, 6000 ft ≈ -0.9 mil)', () => {
  const d = row({}, 1000).elevMil - row({ altitudeFt: 6000 }, 1000).elevMil;
  within(d, 0.7, 1.1);
});

// ------------------------------------------------------------ wind

test('wind clock decomposes correctly: 3 = full from right, 1 = half, 2 = 0.87, 12/6 = none, fractional and wrapped clocks', () => {
  const w = (c) => row({ windMph: 10, windClock: c }, 600).windMil;
  const full = w(3);
  assert.ok(full > 0, 'from the right -> correct right (+)');
  near(w(9), -full, 1e-6);
  near(w(1) / full, 0.5, 0.03);
  near(w(2) / full, Math.sin(Math.PI / 3), 0.03);
  near(w(1.5) / full, Math.sin(Math.PI / 4), 0.03);
  near(w(4.5) / full, Math.sin(Math.PI / 4), 0.03);
  near(w(12), 0, 1e-6); near(w(6), 0, 1e-6); near(w(0), 0, 1e-6);
  near(w(15), full, 1e-6, 'clock wraps mod 12');
  near(w(-3), -full, 1e-6, 'negative clock = from the left');
});

test('head/tail wind changes elevation only, in the right direction', () => {
  const flat = row({}, 1000).elevMil;
  const head = row({ windMph: 20, windClock: 12 }, 1000), tail = row({ windMph: 20, windClock: 6 }, 1000);
  assert.ok(head.elevMil > flat && tail.elevMil < flat);
  within(head.elevMil - flat, 0.05, 0.2);
  near(head.windMil, 0, 1e-6);
});

test('wind drift is a lag-time effect: lower BC drifts more, drift grows faster than linearly with range', () => {
  const hi = row({ windMph: 10, windClock: 3 }, 800).windIn, lo = row({ windMph: 10, windClock: 3, bc: 0.25 }, 800).windIn;
  assert.ok(Math.abs(lo) > Math.abs(hi) * 1.2);
  const w400 = row({ windMph: 10, windClock: 3 }, 400).windIn, w800 = row({ windMph: 10, windClock: 3 }, 800).windIn;
  assert.ok(Math.abs(w800) > 3 * Math.abs(w400));
});

// ------------------------------------------------------------ shot angle

test('shot angle: gravity is split (drop scales ~cos), up and down nearly symmetric, 60° and 89° sane', () => {
  const flat = row({}, 600), up = row({ shotAngleDeg: 30 }, 600), dn = row({ shotAngleDeg: -30 }, 600);
  // in the LOS frame, the gravity drop (not the elevation) scales by cos(angle)
  const gravDrop = (r, z) => -(r.dropIn - z); // remove the straight-line zero component
  const zeroLine = (yards) => { const z100 = row({}, 100), s = (row({}, 1), 0); return (z100.dropIn - s) ; };
  assert.ok(up.elevMil < flat.elevMil && dn.elevMil < flat.elevMil);
  near(up.elevMil, dn.elevMil, 0.05, 'up vs down differ only by the along-LOS gravity component');
  assert.ok(up.elevMil > dn.elevMil, 'uphill needs slightly more than downhill (bullet decelerated along LOS)');
  const r60 = row({ shotAngleDeg: 60 }, 600);
  within(r60.elevMil, 1.2, 1.5, '60 deg (improved rifleman rule ≈ 1.34)');
  // nearly straight up: the bullet rides the bore line (zero angle above the LOS, minus sight height)
  // with only g*cos(89deg) of gravity drop (~0.1 mil at 600)
  const r89 = row({ shotAngleDeg: 89 }, 600);
  const boreLine = -(B.solve(CM65, [600]).zeroAngleRad * 1000) + B.inchesToMil(1.9, 600);
  within(r89.elevMil, boreLine, boreLine + 0.15);
  void gravDrop; void zeroLine;
});

test('rifleman\'s rule is the known under-estimate at steep angles, close at shallow ones', () => {
  const truth25 = row({ shotAngleDeg: 25 }, 700).elevMil, rule25 = row({}, Math.round(700 * Math.cos(25 * Math.PI / 180))).elevMil;
  near(truth25, rule25, 0.25);
  assert.ok(truth25 > rule25);
});

// ------------------------------------------------------------ Coriolis

test('Coriolis: sign by hemisphere and azimuth, Eötvös by east/west, azimuth wraps, poles', () => {
  const plain = row({}, 1000);
  const c = (lat, az) => row({ coriolis: true, latitudeDeg: lat, azimuthDeg: az }, 1000);
  const dH = (r) => r.windIn - plain.windIn, dV = (r) => r.dropIn - plain.dropIn;
  within(dH(c(45, 0)), 2.0, 3.0, 'NH right ~2.5 in @1000 for 6.5 CM');
  // not an exact mirror: the small ox*vy term (horizontal rotation x vertical velocity) keeps its sign
  near(dH(c(-45, 0)), -dH(c(45, 0)), 0.05, 'SH mirror');
  near(dV(c(45, 0)), 0, 1e-3, 'north: no vertical (second-order ox*vz coupling only)');
  within(dV(c(45, 90)), 2.0, 3.0, 'east: high');
  near(dV(c(45, 270)), -dV(c(45, 90)), 1e-3, 'west: low (mirror to second order)');
  near(dV(c(0, 90)), dV(c(45, 90)) * Math.SQRT2, 0.05, 'Eötvös max at equator');
  near(dH(c(0, 0)), 0, 0.05, 'no first-order horizontal at equator (only -2*ox*vy from the falling bullet)');
  near(dH(c(90, 0)), dH(c(45, 0)) * Math.SQRT2, 0.05, 'max at pole');
  near(dH(c(90, 123)), dH(c(90, 0)), 1e-6, 'at the pole azimuth is irrelevant');
  near(dH(c(45, 720)), dH(c(45, 0)), 1e-6, 'azimuth wrap');
  near(dV(c(45, -90)), dV(c(45, 270)), 1e-6, 'negative azimuth');
});

test('Coriolis in vacuum equals Ω·X·T·sin(lat); with drag it is ~10% smaller (lateral drag damping)', () => {
  const pv = Object.assign({}, CM65, { bc: 1e9 });
  const p = row({}, 1000, pv), c = row({ coriolis: true, latitudeDeg: 45, azimuthDeg: 0 }, 1000, pv);
  near(c.windIn - p.windIn, OMEGA * Math.SQRT1_2 * 1000 * YD * p.tofSec / IN, 0.02);
  const pd = row({}, 1000), cd = row({ coriolis: true, latitudeDeg: 45, azimuthDeg: 0 }, 1000);
  const classic = OMEGA * Math.SQRT1_2 * 1000 * YD * pd.tofSec / IN;
  within((cd.windIn - pd.windIn) / classic, 0.85, 1.0);
});

// ------------------------------------------------------------ stability, spin drift, aero jump

test('Miller stability: formula, velocity / temperature / pressure corrections', () => {
  const sg = B.millerStability({ bulletWeightGr: 140, bulletDiameterIn: 0.264, bulletLengthIn: 1.37, twistIn: 8, muzzleVelocityFps: 2800, tempF: 59, pressureInHg: 29.92 });
  const t = 8 / 0.264, l = 1.37 / 0.264;
  near(sg, 30 * 140 / (t * t * 0.264 ** 3 * l * (1 + l * l)), 1e-9, 'base formula at 2800 fps, standard air');
  within(sg, 1.65, 1.80, '6.5 140 in 1:8 (Berger/JBM ~1.7)');
  within(B.millerStability({ bulletWeightGr: 175, bulletDiameterIn: 0.308, bulletLengthIn: 1.24, twistIn: 10, muzzleVelocityFps: 2600 }), 2.2, 2.6, '175 SMK 1:10');
  within(B.millerStability({ bulletWeightGr: 168, bulletDiameterIn: 0.308, bulletLengthIn: 1.215, twistIn: 12, muzzleVelocityFps: 2650 }), 1.55, 1.85, '168 SMK 1:12');
  const base = { bulletWeightGr: 140, bulletDiameterIn: 0.264, bulletLengthIn: 1.37, twistIn: 8, muzzleVelocityFps: 2800 };
  near(B.millerStability(Object.assign({}, base, { muzzleVelocityFps: 2800 * 8 })), sg * 2, 1e-9, 'fv = (V/2800)^(1/3)');
  near(B.millerStability(Object.assign({}, base, { tempF: 59 + 519 })), sg * 2, 1e-9, 'fa temperature');
  near(B.millerStability(Object.assign({}, base, { pressureInHg: 14.96 })), sg * 2, 1e-9, 'fa pressure');
  assert.equal(B.millerStability(Object.assign({}, base, { twistIn: 0 })), null);
  near(B.millerStability(Object.assign({}, base, { twistIn: 16 })), sg / 4, 1e-9, 'Sg ∝ 1/twist^2');
});

test('solve() computes Sg from bullet dimensions at firing conditions and falls back to 1.5', () => {
  assert.equal(B.solve(CM65, [100]).sg, 1.5);
  const sea = B.solve(SYS65, [100]).sg, high = B.solve(Object.assign({}, SYS65, { altitudeFt: 8000, tempF: 90 }), [100]).sg;
  within(sea, 1.65, 1.8);
  assert.ok(high > sea * 1.25, 'thin, warm air is more stable');
  assert.equal(B.solve(Object.assign({}, SYS65, { sg: 2.2 }), [100]).sg, 2.2, 'explicit sg wins');
});

test('Litz spin drift: 1.25·(Sg+1.2)·t^1.83 inches, right for right twist, left for left twist', () => {
  near(B.spinDriftIn(1.7, 1.5, 'right'), 1.25 * 2.9 * Math.pow(1.5, 1.83), 1e-9);
  near(B.spinDriftIn(1.7, 1.5, 'left'), -1.25 * 2.9 * Math.pow(1.5, 1.83), 1e-9);
  assert.equal(B.spinDriftIn(1.7, 0, 'right'), 0);
  assert.equal(B.spinDriftIn(null, 1, 'right'), 0);
  const plain = row({}, 1000, SYS65), sd = row({ spinDrift: true }, 1000, SYS65), sdl = row({ spinDrift: true, twist: 'left' }, 1000, SYS65);
  near(sd.windIn - plain.windIn, B.spinDriftIn(sd.windIn && B.solve(SYS65, [1000]).sg, sd.tofSec, 'right'), 1e-9);
  within(B.inchesToMil(sd.windIn - plain.windIn, 1000), 0.17, 0.25, '~0.2 mil at 1000 for 6.5 CM');
  near(sdl.windIn - plain.windIn, -(sd.windIn - plain.windIn), 1e-9);
  assert.ok(sd.windMil < plain.windMil, 'correction for spin drift is to the left (negative)');
  assert.equal(sd.dropIn, plain.dropIn, 'spin drift does not touch elevation');
});

test('aerodynamic jump magnitude: 0.01·Sg − 0.0024·L + 0.032 MOA per mph, applied as an angle', () => {
  near(B.aeroJumpMoaPerMph(1.7, 1.37, 0.264), 0.01 * 1.7 - 0.0024 * (1.37 / 0.264) + 0.032, 1e-12);
  assert.equal(B.aeroJumpMoaPerMph(null, 1.37, 0.264), 0);
  assert.equal(B.aeroJumpMoaPerMph(1.7, 0, 0.264), 0);
  const w = { windMph: 10, windClock: 3, aeroJump: true };
  const res = B.solve(Object.assign({}, SYS65, w), [300, 600]);
  const plain = B.solve(Object.assign({}, SYS65, { windMph: 10, windClock: 3 }), [300, 600]);
  near(Math.abs(res.aeroJumpMoa), 10 * B.aeroJumpMoaPerMph(res.sg, 1.37, 0.264), 1e-9);
  within(Math.abs(res.aeroJumpMoa), 0.3, 0.45, '~0.35 MOA per 10 mph for a 6.5 CM 140');
  const d300 = res.rows[0].dropIn - plain.rows[0].dropIn, d600 = res.rows[1].dropIn - plain.rows[1].dropIn;
  near(d600, 2 * d300, 1e-6, 'fixed angle: grows linearly with range');
  near(d600, B.moaToInches(res.aeroJumpMoa, 600), 1e-9);
  near(B.solve(Object.assign({}, SYS65, { windMph: 10, windClock: 12, aeroJump: true }), [600]).aeroJumpMoa, 0, 1e-12, 'no jump for head/tail wind');
  near(B.solve(Object.assign({}, CM65, w), [600]).aeroJumpMoa, 0, 1e-12, 'no jump without bullet dimensions (Sg fallback has no L)');
});

test.todo('[KNOWN BUG] aerodynamic jump sign: right twist, wind from the RIGHT (3 o\'clock) throws the shot HIGH, from the left LOW', () => {
  // Physics: wind from the left puts the bullet's nose to the right of the relative wind; the overturning
  // moment at the CP then torques the nose about -y, and a right-hand spin (L along +x) precesses that
  // nose-right offset DOWN. Hornady 4DOF tech paper: "if the wind is blowing from right to left, the
  // aerodynamic jump is up"; Litz/AB: right twist, 9 o'clock wind = low, 3 o'clock wind = high.
  // js/ballistics.js:301 (and its comment at :226-230) have the sign reversed.
  const w = { windMph: 10, aeroJump: true };
  const noAj = row({ windMph: 10, windClock: 3 }, 600, SYS65);
  const fromRight = row(Object.assign({ windClock: 3 }, w), 600, SYS65);
  const fromLeft = row(Object.assign({ windClock: 9 }, w), 600, SYS65);
  assert.ok(fromRight.dropIn > noAj.dropIn, `right twist + wind from the right must be HIGH (got ${fromRight.dropIn - noAj.dropIn} in)`);
  assert.ok(fromLeft.dropIn < noAj.dropIn, 'right twist + wind from the left must be LOW');
  const leftTwist = row(Object.assign({ windClock: 3, twist: 'left' }, w), 600, SYS65);
  assert.ok(leftTwist.dropIn < noAj.dropIn, 'left twist mirrors');
});

// ------------------------------------------------------------ powder temperature, fixed zero

test('powder temperature sensitivity: MV shifts by sens × (powder − chrono temp); powderTempF overrides air temp; ignored without mvTempF', () => {
  const mv = (extra) => B.solve(Object.assign({}, CM65, { tempSensitivity: 0.8, mvTempF: 59 }, extra), [100]).muzzleVelocityFps;
  near(mv({ tempF: 99 }), 2710 + 32, 1e-9);
  near(mv({ tempF: 19 }), 2710 - 32, 1e-9);
  near(mv({ tempF: 99, powderTempF: 59 }), 2710, 1e-9, 'ammo in the shade');
  near(B.solve(Object.assign({}, CM65, { tempSensitivity: 0.8, tempF: 99 }), [100]).muzzleVelocityFps, 2710, 1e-9, 'no reference temp -> no shift');
  // the hot load is flatter
  assert.ok(row({ tempSensitivity: 0.8, mvTempF: 59, tempF: 99 }, 800).elevMil < row({ tempF: 99 }, 800).elevMil);
});

test('zero is re-solved with the temperature-adjusted MV (documented behaviour: hot ammo still crosses the LOS at the zero range)', () => {
  near(row({ tempSensitivity: 1, mvTempF: 59, tempF: 100 }, 100).dropIn, 0, 1e-6);
});

test('fixed zeroAngleRad reproduces the solved zero and models a stale zero', () => {
  const z = B.solve(CM65, [100]).zeroAngleRad;
  within(z * 1000, 1.1, 1.35, '100 yd zero: bore ≈ 1.2 mil above LOS (2.6 in gravity drop + 1.9 in sight height per 100 yd)');
  const a = solve({}, [300, 800]).rows, b = solve({ zeroAngleRad: z }, [300, 800]).rows;
  a.forEach((r, i) => near(r.dropIn, b[i].dropIn, 1e-9));
  const hot = row({ zeroAngleRad: z, muzzleVelocityFps: 2790 }, 100);
  assert.ok(hot.dropIn > 0.02 && hot.dropIn < 0.2, 'a faster load through the same zero prints slightly high at 100');
  const thin = row({ zeroAngleRad: z, altitudeFt: 8000 }, 100);
  assert.ok(thin.dropIn > 0 && thin.dropIn < 0.1, 'thin air through a sea-level zero prints a hair high at 100');
});

test('zeroAtmosphere: zero set at sea level, fired at altitude', () => {
  const r = B.solve(Object.assign({}, CM65, { altitudeFt: 8000, zeroAtmosphere: { altitudeFt: 0, tempF: 59 } }), [100, 1000]).rows;
  within(r[0].dropIn, 0, 0.1, '100 yd prints barely high');
  assert.ok(r[1].elevMil < row({}, 1000).elevMil - 1, 'much less elevation at 8000 ft');
});

// ------------------------------------------------------------ clicks

test('toClicks / roundToClick', () => {
  assert.equal(B.toClicks(1.26, 0.1), 13);
  assert.equal(B.toClicks(-1.26, 0.1), -13);
  near(B.roundToClick(0.35, 0.1), 0.3, 0.05 + 1e-9);
  assert.equal(B.toClicks(0, 0.1), 0);
});

test.todo('[KNOWN BUG][nit] toClicks rounds exact half-clicks asymmetrically (Math.round is round-half-up, not symmetric)', () => {
  assert.equal(B.toClicks(0.25, 0.1), 3);
  assert.equal(B.toClicks(-0.25, 0.1), -3, '−0.25 should round to −3 clicks like +0.25 rounds to +3');
});

// ------------------------------------------------------------ edge cases

test('ranges beyond reach: rows are a prefix of the requested ranges (never a mismatched index), no throw', () => {
  const res = B.solve(CM65, [100, 3000, 6000]);
  assert.ok(res.rows.length < 3);
  res.rows.forEach((r, i) => assert.equal(r.yards, [100, 3000, 6000][i]));
  assert.ok(res.rows[res.rows.length - 1].tofSec < 20);
});

test('empty ranges, NaN / zero BC, zero or negative MV return empty rows without throwing', () => {
  assert.deepEqual(B.solve(CM65, []).rows, []);
  assert.deepEqual(B.solve(Object.assign({}, CM65, { bc: NaN }), [100]).rows, []);
  assert.deepEqual(B.solve(Object.assign({}, CM65, { bc: 0 }), [100]).rows, []);
  assert.deepEqual(B.solve(Object.assign({}, CM65, { muzzleVelocityFps: 0 }), [100]).rows, []);
  assert.deepEqual(B.solve(Object.assign({}, CM65, { muzzleVelocityFps: -100 }), [100]).rows, []);
});

test.todo('[KNOWN BUG] unsorted ranges give wrong samples (solve assumes ascending input)', () => {
  const sorted = solve({}, [100, 300, 500]).rows, unsorted = solve({}, [500, 100, 300]).rows;
  const by = (rows) => Object.fromEntries(rows.map((r) => [r.yards, r]));
  const s = by(sorted), u = by(unsorted);
  [100, 300, 500].forEach((y) => near(u[y].dropIn, s[y].dropIn, 1e-6, `drop @${y}`));
});

test('zero farther than the target: negative elevation (dial down) between muzzle and zero, zero at zero', () => {
  const rows = solve({ zeroYards: 600 }, [100, 300, 600]).rows;
  assert.ok(rows[0].elevMil < -3 && rows[1].elevMil < 0);
  near(rows[2].elevMil, 0, 1e-6);
});

test('subsonic and very slow bullets integrate sanely and never speed up', () => {
  const p = { muzzleVelocityFps: 900, bc: 0.08, dragModel: 'G1', bulletWeightGr: 150, sightHeightIn: 1.5, zeroYards: 100, windMph: 0 };
  const rows = B.solve(p, [100, 300, 600, 1000]).rows;
  assert.ok(rows.length >= 3);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].velocityFps < rows[i - 1].velocityFps && rows[i].mach < 1);
  assert.ok(rows.every((r) => Number.isFinite(r.dropIn) && Number.isFinite(r.windIn)));
});

test('latitude ±90, azimuth outside 0–360, 100% humidity, temperature extremes: finite output', () => {
  const r = row({ coriolis: true, latitudeDeg: 90, azimuthDeg: -725, humidityPct: 100, tempF: 125, shotAngleDeg: -60, windMph: 30, windClock: 7.5 }, 1200);
  ['dropIn', 'windIn', 'elevMil', 'windMil', 'velocityFps', 'mach', 'energyFtLb', 'tofSec'].forEach((k) => assert.ok(Number.isFinite(r[k]), k));
  const cold = row({ tempF: -60, altitudeFt: 12000 }, 1000);
  assert.ok(Number.isFinite(cold.elevMil));
});

// ------------------------------------------------------------ consumer: js/range/world.js (headless via a stubbed window)

function loadRangeModules() {
  const L = {
    B,
    rand: (a, b) => a + 0.5 * (b - a),
    randInt: (a, b) => Math.floor(a + 0.5 * (b + 1 - a)),
    pick: (arr) => arr[0],
    gauss: () => 0,
  };
  const win = { LRPS: L };
  const ctx = { window: win, performance, Math, Number, Object, Array };
  ['data.js', 'world.js'].forEach((f) => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'range', f), 'utf8'), ctx));
  return win.LRPS_RANGE;
}

test('range catalogue: box MV scales per inch of barrel; loads are consistent with presets', () => {
  const R = loadRangeModules();
  const l = R.load('horn-65-140');
  assert.equal(R.boxMv(l, 24), 2710);
  assert.equal(R.boxMv(l, 20), 2710 - 4 * 22);
  assert.equal(R.boxMv(R.load('sk-std-40'), 16), 1070, 'rimfire is flat');
  R.LOADS.forEach((x) => {
    const sg = B.millerStability({ bulletWeightGr: x.bulletGr, bulletDiameterIn: x.diaIn, bulletLengthIn: x.lenIn, twistIn: R.cartridge(x.cart).twists[0], muzzleVelocityFps: x.mvFps });
    assert.ok(sg > 1.0, `${x.id} Sg ${sg} with the fastest offered twist`);
  });
});

test('range world: station pressure follows ICAO at the location altitude; clock helpers wrap; sound speed', () => {
  const R = loadRangeModules();
  const w = R.newWorld({ location: 'mountain', sky: 'partly', preset: 'training' }, { sun: false, gusts: false });
  near(w.stationPressureInHg, B.atmosphere({ altitudeFt: 6200 }).pressurePa / 3386.389, 0.02);
  near(w.atm.rho, B.atmosphere({ altitudeFt: 6200, tempF: w.tempF, humidityPct: w.humidityPct, stationPressureInHg: w.stationPressureInHg }).rho, 1e-12);
  assert.equal(R.toClock(0), 12); assert.equal(R.toClock(359), 12); assert.equal(R.toClock(90), 3); assert.equal(R.toClock(7), 12);
  assert.equal(R.toClockHalf(352), 11.5); assert.equal(R.toClockHalf(0), 12); assert.equal(R.toClockHalf(45), 1.5);
  near(R.soundYps(w), w.atm.speedOfSound / YD, 1e-9);
});

test('range wind: pathWind weights sum to one and its clock matches the solver\'s convention (from 90° = from the right = hold right)', () => {
  const R = loadRangeModules();
  const w = R.newWorld({ location: 'midwest', sky: 'partly', preset: 'training' }, { sun: false, gusts: false });
  // force a uniform 10 mph wind from 90° (3 o'clock); field base must be non-zero or zoneWind takes its "calm breeze" branch
  w.wind.base = 10;
  w.wind.zones.forEach((z) => { z.base = 10; z.dir = 90; z.shift = 0; z.gust = 0; z.swing = 0; z.lull = 0; });
  const pw = R.pathWind(w, w.start, 800), mw = R.meanWind(w, 800);
  near(pw.speed, 10, 1e-9); near(pw.clock, 3, 1e-9); near(mw.clock, 3, 1e-9);
  assert.ok(row({ windMph: pw.speed, windClock: pw.clock }, 800).windMil > 0, 'solver: hold right');
  w.wind.zones.forEach((z) => { z.dir = 270; });
  near(R.pathWind(w, w.start, 800).clock, 9, 1e-9);
  // a near-zone wind counts more than a far-zone wind
  w.wind.zones.forEach((z, i) => { z.base = i === 0 ? 10 : 0; z.dir = 90; });
  const nearOnly = R.pathWind(w, w.start, 800).speed;
  w.wind.zones.forEach((z, i) => { z.base = i === 2 ? 10 : 0; });
  const farOnly = R.pathWind(w, w.start, 800).speed;
  near(nearOnly, 4.5, 1e-9); near(farOnly, 2.2, 1e-9);
  near(R.windCallText(w).length > 0, true, 0);
});

test('range instruments: LRF reads the true range (±1 yd) when good; stats SD is the sample SD', () => {
  const R = loadRangeModules();
  const r = R.lase({ yards: 640, plateIn: 12, angleDeg: 7 }, { lrfError: false });
  assert.equal(r.yards, 640); assert.equal(r.angleDeg, 7); assert.equal(r.bad, false);
  const s = R.stats([2700, 2710, 2720]);
  near(s.avg, 2710, 1e-9); near(s.sd, 10, 1e-9); assert.equal(s.es, 20);
  assert.equal(R.stats([]).n, 0);
});

test('range rifle: hidden zero is solved at standard conditions with the true MV; hit test geometry is MIL-consistent', () => {
  const R = loadRangeModules();
  const setup = Object.assign({}, R.DEFAULT_SETUP);
  const rifle = R.newRifle(setup, {});
  near(rifle.zeroAngleRad, B.solve(Object.assign({}, rifle.solverBase, { windMph: 0, altitudeFt: 0, tempF: 59, humidityPct: 0 }), [100]).zeroAngleRad, 1e-12);
  within(rifle.mvRef / rifle.boxMv, 0.97, 1.03);
  // a shot through that zero on a standard day with turrets at 0 lands at the boresight error only
  const r = B.solve(Object.assign({}, rifle.solverBase, { tempSensitivity: 0, mvTempF: null, windMph: 0, zeroAngleRad: rifle.zeroAngleRad }), [100]).rows[0];
  near(B.inchesToMil(r.dropIn, 100), 0, 1e-6);
  // 1 mil at 640 yd is 23.04 in: a 12 in plate is 0.52 mil wide
  near(B.inchesToMil(12, 640), 0.52, 0.001);
});
