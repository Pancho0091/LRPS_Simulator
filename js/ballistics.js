/*
 * Point-mass ballistic solver.
 *
 * Model: the bullet is a point acted on by gravity and aerodynamic drag.
 * Drag deceleration = rho * v_rel^2 * Cd(Mach) * (pi/8) / (BC * 703.07)
 * where Cd(Mach) comes from a standard reference projectile (G1 or G7) and
 * BC (lb/in^2) scales the reference to the real bullet.
 *
 * Coordinates are in the line-of-sight frame:
 *   x = downrange along the line of sight, y = up (perpendicular to LOS),
 *   z = right. The bore starts at y = -sightHeight.
 * Works in SI internally; the public API takes and returns shooter units.
 */
(function (root) {
  'use strict';

  // Standard drag tables: [Mach, Cd]
  const G1 = [
    [0.00, 0.2629], [0.05, 0.2558], [0.10, 0.2487], [0.15, 0.2413], [0.20, 0.2344],
    [0.25, 0.2278], [0.30, 0.2214], [0.35, 0.2155], [0.40, 0.2104], [0.45, 0.2061],
    [0.50, 0.2032], [0.55, 0.2020], [0.60, 0.2034], [0.70, 0.2165], [0.725, 0.2230],
    [0.75, 0.2313], [0.775, 0.2417], [0.80, 0.2546], [0.825, 0.2706], [0.85, 0.2901],
    [0.875, 0.3136], [0.90, 0.3415], [0.925, 0.3734], [0.95, 0.4084], [0.975, 0.4448],
    [1.00, 0.4805], [1.025, 0.5136], [1.05, 0.5427], [1.075, 0.5677], [1.10, 0.5883],
    [1.125, 0.6053], [1.15, 0.6191], [1.20, 0.6393], [1.25, 0.6518], [1.30, 0.6589],
    [1.35, 0.6621], [1.40, 0.6625], [1.45, 0.6607], [1.50, 0.6573], [1.55, 0.6528],
    [1.60, 0.6474], [1.65, 0.6413], [1.70, 0.6347], [1.75, 0.6280], [1.80, 0.6210],
    [1.85, 0.6141], [1.90, 0.6072], [1.95, 0.6003], [2.00, 0.5934], [2.05, 0.5867],
    [2.10, 0.5804], [2.15, 0.5743], [2.20, 0.5685], [2.25, 0.5630], [2.30, 0.5577],
    [2.35, 0.5527], [2.40, 0.5481], [2.45, 0.5438], [2.50, 0.5397], [2.60, 0.5325],
    [2.70, 0.5264], [2.80, 0.5211], [2.90, 0.5168], [3.00, 0.5133], [3.10, 0.5105],
    [3.20, 0.5084], [3.30, 0.5067], [3.40, 0.5054], [3.50, 0.5040], [3.60, 0.5030],
    [3.70, 0.5022], [3.80, 0.5016], [3.90, 0.5010], [4.00, 0.5006], [4.20, 0.4998],
    [4.40, 0.4995], [4.60, 0.4992], [4.80, 0.4990], [5.00, 0.4988],
  ];

  const G7 = [
    [0.00, 0.1198], [0.05, 0.1197], [0.10, 0.1196], [0.15, 0.1194], [0.20, 0.1193],
    [0.25, 0.1194], [0.30, 0.1194], [0.35, 0.1194], [0.40, 0.1193], [0.45, 0.1193],
    [0.50, 0.1194], [0.55, 0.1193], [0.60, 0.1194], [0.65, 0.1197], [0.70, 0.1202],
    [0.725, 0.1207], [0.75, 0.1215], [0.775, 0.1226], [0.80, 0.1242], [0.825, 0.1266],
    [0.85, 0.1306], [0.875, 0.1368], [0.90, 0.1464], [0.925, 0.1660], [0.95, 0.2054],
    [0.975, 0.2993], [1.00, 0.3803], [1.025, 0.4015], [1.05, 0.4043], [1.075, 0.4034],
    [1.10, 0.4014], [1.125, 0.3987], [1.15, 0.3955], [1.20, 0.3884], [1.25, 0.3810],
    [1.30, 0.3732], [1.35, 0.3657], [1.40, 0.3580], [1.50, 0.3440], [1.55, 0.3376],
    [1.60, 0.3315], [1.65, 0.3260], [1.70, 0.3209], [1.75, 0.3160], [1.80, 0.3117],
    [1.85, 0.3078], [1.90, 0.3042], [1.95, 0.3010], [2.00, 0.2980], [2.05, 0.2951],
    [2.10, 0.2922], [2.15, 0.2892], [2.20, 0.2864], [2.25, 0.2835], [2.30, 0.2807],
    [2.35, 0.2779], [2.40, 0.2752], [2.45, 0.2725], [2.50, 0.2697], [2.55, 0.2670],
    [2.60, 0.2643], [2.65, 0.2615], [2.70, 0.2588], [2.75, 0.2561], [2.80, 0.2533],
    [2.85, 0.2506], [2.90, 0.2479], [2.95, 0.2451], [3.00, 0.2424], [3.10, 0.2368],
    [3.20, 0.2313], [3.30, 0.2258], [3.40, 0.2205], [3.50, 0.2154], [3.60, 0.2106],
    [3.70, 0.2060], [3.80, 0.2017], [3.90, 0.1975], [4.00, 0.1935], [4.20, 0.1861],
    [4.40, 0.1793], [4.60, 0.1730], [4.80, 0.1672], [5.00, 0.1618],
  ];

  const DRAG_TABLES = { G1, G7 };

  // Unit constants
  const FT = 0.3048;
  const YD = 0.9144;
  const IN = 0.0254;
  const MPH = 0.44704;
  const GRAIN_KG = 6.479891e-5;
  const BC_SI = 703.0696; // 1 lb/in^2 in kg/m^2
  const G = 9.80665;

  // Angular units: inches subtended per 100 yards
  const IN_PER_MOA_100 = 1.0472; // true MOA
  const IN_PER_MIL_100 = 3.6;

  function cdAt(table, mach) {
    if (mach <= table[0][0]) return table[0][1];
    const last = table[table.length - 1];
    if (mach >= last[0]) return last[1];
    let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid][0] <= mach) lo = mid; else hi = mid;
    }
    const [m0, c0] = table[lo];
    const [m1, c1] = table[hi];
    return c0 + (c1 - c0) * (mach - m0) / (m1 - m0);
  }

  /*
   * Atmosphere from shooter inputs.
   * If stationPressureInHg is given it is used directly; otherwise pressure
   * is derived from altitude via the ICAO standard atmosphere.
   */
  function atmosphere({ altitudeFt = 0, tempF = 59, humidityPct = 0, stationPressureInHg = null } = {}) {
    const T = (tempF - 32) * 5 / 9 + 273.15;
    const P = stationPressureInHg != null
      ? stationPressureInHg * 3386.389
      : 101325 * Math.pow(1 - 2.25577e-5 * altitudeFt * FT, 5.25588);
    const tc = T - 273.15;
    const pSat = 610.78 * Math.pow(10, 7.5 * tc / (tc + 237.3));
    const pV = Math.max(0, Math.min(100, humidityPct)) / 100 * pSat;
    const rho = (P - pV) / (287.058 * T) + pV / (461.495 * T);
    const speedOfSound = 331.3 * Math.sqrt(1 + tc / 273.15);
    return { rho, speedOfSound, pressurePa: P, tempK: T, densityAltitudeFt: densityAltitude(rho) };
  }

  // Altitude in the standard atmosphere that has the same air density.
  function densityAltitude(rho) {
    const rho0 = 1.225;
    const h = (1 - Math.pow(rho / rho0, 1 / 4.255876)) / 2.25577e-5;
    return h / FT;
  }

  /*
   * Integrate one trajectory and sample it at the requested ranges (yards).
   * launchAngle is the bore angle relative to the line of sight, radians.
   */
  function integrate(p, atm, launchAngle, sampleYards, maxYards) {
    const table = DRAG_TABLES[p.dragModel] || G7;
    const k = atm.rho * Math.PI / 8 / (p.bc * BC_SI);
    const shotAngle = (p.shotAngleDeg || 0) * Math.PI / 180;
    const gx = -G * Math.sin(shotAngle);
    const gy = -G * Math.cos(shotAngle);

    // Wind: clock direction it blows FROM. 3 o'clock = from the right.
    const windSpeed = (p.windMph || 0) * MPH;
    const clock = (p.windClock || 0) % 12;
    const theta = clock / 12 * 2 * Math.PI;
    // wind velocity (air movement) in the shooter frame
    const wx = -windSpeed * Math.cos(theta); // from 12 o'clock = headwind = -x
    const wz = -windSpeed * Math.sin(theta); // from 3 o'clock pushes left = -z

    const v0 = p.muzzleVelocityFps * FT;
    let x = 0, y = -p.sightHeightIn * IN, z = 0;
    let vx = v0 * Math.cos(launchAngle), vy = v0 * Math.sin(launchAngle), vz = 0;
    let t = 0;
    const dt = 0.0005;
    const maxX = maxYards * YD;
    const samples = [];
    let si = 0;
    const targets = sampleYards.map((r) => r * YD);

    function accel(vx_, vy_, vz_) {
      const rx = vx_ - wx, ry = vy_, rz = vz_ - wz;
      const vr = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const cd = cdAt(table, vr / atm.speedOfSound);
      const d = k * cd * vr;
      return [-d * rx + gx, -d * ry + gy, -d * rz];
    }

    while (x < maxX && si < targets.length && t < 20) {
      // Midpoint (RK2) step
      const a1 = accel(vx, vy, vz);
      const mvx = vx + a1[0] * dt / 2, mvy = vy + a1[1] * dt / 2, mvz = vz + a1[2] * dt / 2;
      const a2 = accel(mvx, mvy, mvz);
      const nx = x + mvx * dt, ny = y + mvy * dt, nz = z + mvz * dt;
      const nvx = vx + a2[0] * dt, nvy = vy + a2[1] * dt, nvz = vz + a2[2] * dt;
      const nt = t + dt;

      while (si < targets.length && nx >= targets[si]) {
        const f = (targets[si] - x) / (nx - x);
        const sx = vx + (nvx - vx) * f, sy = vy + (nvy - vy) * f, sz = vz + (nvz - vz) * f;
        samples.push({
          x: targets[si],
          y: y + (ny - y) * f,
          z: z + (nz - z) * f,
          v: Math.sqrt(sx * sx + sy * sy + sz * sz),
          t: t + dt * f,
        });
        si++;
      }
      x = nx; y = ny; z = nz; vx = nvx; vy = nvy; vz = nvz; t = nt;
    }
    return samples;
  }

  /*
   * Find the bore angle that puts the bullet on the line of sight at the
   * zero range. Zeroing is done in zero conditions with no wind or angle.
   */
  function solveZeroAngle(p, atm) {
    const zp = Object.assign({}, p, { windMph: 0, shotAngleDeg: 0 });
    let lo = -0.01, hi = 0.05;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const s = integrate(zp, atm, mid, [p.zeroYards], p.zeroYards + 1);
      if (!s.length || s[0].y < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // Litz's empirical spin-drift approximation, inches. Positive = right.
  function spinDriftIn(sg, tof, twist) {
    if (!sg || tof <= 0) return 0;
    const dir = twist === 'left' ? -1 : 1;
    return dir * 1.25 * (sg + 1.2) * Math.pow(tof, 1.83);
  }

  function inchesToMoa(inches, yards) { return yards > 0 ? inches / (IN_PER_MOA_100 * yards / 100) : 0; }
  function inchesToMil(inches, yards) { return yards > 0 ? inches / (IN_PER_MIL_100 * yards / 100) : 0; }
  function moaToInches(moa, yards) { return moa * IN_PER_MOA_100 * yards / 100; }
  function milToInches(mil, yards) { return mil * IN_PER_MIL_100 * yards / 100; }

  const DEFAULTS = {
    muzzleVelocityFps: 2710,
    bc: 0.326,
    dragModel: 'G7',
    bulletWeightGr: 140,
    sightHeightIn: 1.9,
    zeroYards: 100,
    altitudeFt: 0,
    tempF: 59,
    humidityPct: 0,
    stationPressureInHg: null,
    // zero conditions default to the firing conditions
    zeroAtmosphere: null,
    windMph: 10,
    windClock: 3,
    shotAngleDeg: 0,
    spinDrift: false,
    sg: 1.5,
    twist: 'right',
    zeroAngleRad: null,
  };

  /*
   * Solve a full table.
   * Returns one row per range with drop/wind in inches, MOA and MIL,
   * plus velocity, energy and time of flight.
   * Sign convention: elevation > 0 means dial UP; wind > 0 means hold/dial RIGHT.
   */
  function solve(input, ranges) {
    const p = Object.assign({}, DEFAULTS, input);
    const atm = atmosphere(p);
    const zeroAtm = p.zeroAtmosphere ? atmosphere(p.zeroAtmosphere) : atm;
    // A fixed zeroAngleRad models a rifle whose zero was set with a
    // different load or velocity than the one being fired now.
    const angle = p.zeroAngleRad != null ? p.zeroAngleRad : solveZeroAngle(p, zeroAtm);
    const maxR = Math.max.apply(null, ranges);
    const samples = integrate(p, atm, angle, ranges, maxR + 1);
    const massKg = p.bulletWeightGr * GRAIN_KG;

    return {
      atmosphere: atm,
      zeroAngleRad: angle,
      rows: samples.map((s, i) => {
        const yards = ranges[i];
        const dropIn = s.y / IN; // negative = below line of sight
        let windIn = s.z / IN;
        if (p.spinDrift) windIn += spinDriftIn(p.sg, s.t, p.twist);
        const vFps = s.v / FT;
        const energyFtLb = 0.5 * massKg * s.v * s.v * 0.737562;
        // Correction = what you must dial to bring the impact back to the
        // aim point, i.e. the negative of the deviation.
        const elevIn = -dropIn;
        const windCorrIn = -windIn;
        return {
          yards,
          dropIn,
          windIn,
          elevMoa: inchesToMoa(elevIn, yards),
          elevMil: inchesToMil(elevIn, yards),
          windMoa: inchesToMoa(windCorrIn, yards),
          windMil: inchesToMil(windCorrIn, yards),
          velocityFps: vFps,
          mach: s.v / atm.speedOfSound,
          energyFtLb,
          tofSec: s.t,
        };
      }),
    };
  }

  // Round a correction to the nearest turret click.
  function toClicks(value, clickSize) {
    return Math.round(value / clickSize);
  }

  function roundToClick(value, clickSize) {
    return toClicks(value, clickSize) * clickSize;
  }

  const api = {
    G1, G7, DRAG_TABLES, DEFAULTS,
    cdAt, atmosphere, densityAltitude, solve, spinDriftIn,
    inchesToMoa, inchesToMil, moaToInches, milToInches, toClicks, roundToClick,
    IN_PER_MOA_100, IN_PER_MIL_100,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ballistics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
