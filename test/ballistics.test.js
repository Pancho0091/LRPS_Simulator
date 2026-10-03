'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/ballistics.js');

const LOAD = { muzzleVelocityFps: 2710, bc: 0.326, dragModel: 'G7', bulletWeightGr: 140, sightHeightIn: 1.9, zeroYards: 100 };
const solve = (extra, ranges) => B.solve(Object.assign({}, LOAD, { windMph: 0 }, extra), ranges).rows;

test('bullet crosses the line of sight at the zero range', () => {
  const [r] = solve({}, [100]);
  assert.ok(Math.abs(r.dropIn) < 0.05, `drop at zero = ${r.dropIn}`);
});

test('6.5 CM 140 gr at 1000 yd is in the published ballpark', () => {
  const [r] = solve({ windMph: 10, windClock: 3 }, [1000]);
  assert.ok(r.elevMoa > 28 && r.elevMoa < 32, `elev ${r.elevMoa} MOA`);
  assert.ok(r.windMoa > 5.5 && r.windMoa < 7.5, `wind ${r.windMoa} MOA`);
});

test('elevation increases monotonically past the zero', () => {
  const rows = solve({}, [200, 400, 600, 800, 1000]);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].elevMil > rows[i - 1].elevMil);
});

test('wind drift scales roughly linearly with speed', () => {
  const [w5] = solve({ windMph: 5, windClock: 3 }, [800]);
  const [w10] = solve({ windMph: 10, windClock: 3 }, [800]);
  assert.ok(Math.abs(w10.windMil / w5.windMil - 2) < 0.05);
});

test('wind from the right requires a right (+) correction; from the left, left (-)', () => {
  const [right] = solve({ windMph: 10, windClock: 3 }, [600]);
  const [left] = solve({ windMph: 10, windClock: 9 }, [600]);
  assert.ok(right.windMil > 0);
  assert.ok(left.windMil < 0);
  assert.ok(Math.abs(right.windMil + left.windMil) < 1e-6);
});

test('half-value wind at 1 o\'clock is about half of full value', () => {
  const [full] = solve({ windMph: 10, windClock: 3 }, [700]);
  const [half] = solve({ windMph: 10, windClock: 1 }, [700]);
  assert.ok(Math.abs(half.windMil / full.windMil - 0.5) < 0.05);
});

test('higher density altitude means less elevation', () => {
  const [low] = solve({ altitudeFt: 0 }, [1000]);
  const [high] = solve({ altitudeFt: 6000 }, [1000]);
  assert.ok(high.elevMil < low.elevMil);
});

test('more muzzle velocity means less elevation', () => {
  const [slow] = solve({ muzzleVelocityFps: 2650 }, [800]);
  const [fast] = solve({ muzzleVelocityFps: 2770 }, [800]);
  assert.ok(fast.elevMil < slow.elevMil);
});

test('shooting at an angle needs less elevation', () => {
  const [flat] = solve({}, [600]);
  const [up] = solve({ shotAngleDeg: 20 }, [600]);
  const [down] = solve({ shotAngleDeg: -20 }, [600]);
  assert.ok(up.elevMil < flat.elevMil);
  assert.ok(down.elevMil < flat.elevMil);
});

test('unit conversions round-trip', () => {
  assert.ok(Math.abs(B.inchesToMil(B.milToInches(2.3, 650), 650) - 2.3) < 1e-12);
  assert.ok(Math.abs(B.inchesToMoa(B.moaToInches(7.25, 900), 900) - 7.25) < 1e-12);
  assert.equal(B.toClicks(1.26, 0.1), 13);
  assert.equal(B.toClicks(5.1, 0.25), 20);
});

test('standard day air density is ~1.225 kg/m^3 and DA ~0 ft', () => {
  const atm = B.atmosphere({ altitudeFt: 0, tempF: 59, humidityPct: 0 });
  assert.ok(Math.abs(atm.rho - 1.225) < 0.002);
  assert.ok(Math.abs(atm.densityAltitudeFt) < 50);
});

test('fixed zero angle: a faster load fired through the same zero hits high', () => {
  const zeroAngleRad = B.solve(Object.assign({}, LOAD, { windMph: 0 }), [100]).zeroAngleRad;
  const [same] = solve({ zeroAngleRad }, [600]);
  const [fast] = solve({ zeroAngleRad, muzzleVelocityFps: 2760 }, [600]);
  assert.ok(fast.dropIn > same.dropIn);
});

const SYS = Object.assign({}, LOAD, { bulletDiameterIn: 0.264, bulletLengthIn: 1.37, twistIn: 8 });

test('Miller stability for 6.5 mm 140 gr in 1:8 twist is in the stable band', () => {
  const sg = B.millerStability(Object.assign({ tempF: 59, pressureInHg: 29.92 }, SYS));
  assert.ok(sg > 1.5 && sg < 2.0, `sg ${sg}`);
  const slow = B.millerStability(Object.assign({}, SYS, { twistIn: 10 }));
  assert.ok(slow < 1.2, 'a slower twist is less stable');
});

test('Coriolis: northern hemisphere deflects right; shooting east hits high', () => {
  const base = { windMph: 0, coriolis: true, latitudeDeg: 45 };
  const [plain] = B.solve(Object.assign({}, LOAD, { windMph: 0 }), [1000]).rows;
  const [north] = B.solve(Object.assign({}, LOAD, base, { azimuthDeg: 0 }), [1000]).rows;
  const [east] = B.solve(Object.assign({}, LOAD, base, { azimuthDeg: 90 }), [1000]).rows;
  const [west] = B.solve(Object.assign({}, LOAD, base, { azimuthDeg: 270 }), [1000]).rows;
  assert.ok(north.windIn > 1 && north.windIn < 6, `north drift ${north.windIn}`);
  assert.ok(east.dropIn > plain.dropIn && west.dropIn < plain.dropIn);
  const [south] = B.solve(Object.assign({}, LOAD, base, { latitudeDeg: -45 }), [1000]).rows;
  assert.ok(south.windIn < 0, 'southern hemisphere deflects left');
});

test('aerodynamic jump: right twist, wind from the left throws the shot up', () => {
  const w = { windMph: 10, windClock: 9 };
  const [noAj] = B.solve(Object.assign({}, SYS, w), [600]).rows;
  const [aj] = B.solve(Object.assign({}, SYS, w, { aeroJump: true }), [600]).rows;
  assert.ok(aj.dropIn > noAj.dropIn);
  const [ajRight] = B.solve(Object.assign({}, SYS, w, { aeroJump: true, windClock: 3 }), [600]).rows;
  assert.ok(ajRight.dropIn < noAj.dropIn);
});

test('powder temperature sensitivity: hot ammo leaves the muzzle faster', () => {
  const t = { tempSensitivity: 1, mvTempF: 59 };
  const cold = B.solve(Object.assign({}, LOAD, t, { windMph: 0, tempF: 20 }), [800]);
  const hot = B.solve(Object.assign({}, LOAD, t, { windMph: 0, tempF: 100 }), [800]);
  assert.equal(Math.round(cold.muzzleVelocityFps), 2710 - 39);
  assert.equal(Math.round(hot.muzzleVelocityFps), 2710 + 41);
});

test('spin drift uses the computed stability factor', () => {
  const [r] = B.solve(Object.assign({}, SYS, { windMph: 0, spinDrift: true }), [1000]).rows;
  assert.ok(r.windIn > 5 && r.windIn < 20, `spin drift ${r.windIn} in`);
});
