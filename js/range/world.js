/*
 * The range environment and the hidden truth of the rifle.
 *
 *  World  = weather on the day (atmosphere, sun, powder temperature drift)
 *           + a wind field in three zones with gusts, lulls and switches.
 *  Rifle  = what the shooter owns but does not know exactly: true MV and SD,
 *           boresight error, cold-bore shift, heat walk, scope tracking.
 *
 * Nothing here draws or touches the DOM; range.js drives it.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const RANGE = (window.LRPS_RANGE = window.LRPS_RANGE || {});
  const B = L.B;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  RANGE.clamp = clamp;

  /* ================================================================ world */

  /*
   * Build a range day. opts: { location, sky, useCard (bool), realistic }
   * `realistic` draws weather from the location's climate; otherwise the day
   * is a textbook standard-ish day so a beginner's paper dope lines up.
   */
  RANGE.newWorld = function (setup, toggles) {
    const loc = RANGE.location(setup.location) || L.pick(RANGE.LOCATIONS);
    const sky = RANGE.sky(setup.sky);
    const real = typeof setup.realistic === 'boolean' ? setup.realistic : setup.preset === 'realistic';
    const tempF = real ? Math.round(L.rand(loc.temp[0], loc.temp[1])) : Math.round(clamp(59 + L.gauss() * 6, loc.temp[0], loc.temp[1]));
    const humidityPct = real ? L.randInt(loc.hum[0], loc.hum[1]) : L.randInt(30, 60);
    // Weather systems move station pressure a few tenths either side of standard
    const stdInHg = 29.92 * Math.pow(1 - 2.25577e-5 * loc.alt * 0.3048, 5.25588);
    const pressOff = real ? L.rand(-0.45, 0.45) : L.rand(-0.1, 0.1);
    const stationPressureInHg = +(stdInHg + pressOff).toFixed(2);
    const w = {
      loc, sky, tempF, humidityPct, stationPressureInHg, altitudeFt: loc.alt,
      latitudeDeg: loc.lat, azimuthDeg: L.randInt(0, 359), start: performance.now(),
      sunHeat: toggles.sun ? sky.sun * L.rand(8, 16) : 0, // °F the ammo gains after a while in the sun
      ammoInShade: false,
    };
    w.atm = B.atmosphere({ altitudeFt: loc.alt, tempF, humidityPct, stationPressureInHg });
    w.wind = newWindField(loc, toggles, real);
    return w;
  };

  /* Powder temperature right now: air temp plus sun soak that builds over the session. */
  RANGE.powderTempF = function (w, now) {
    if (!w.sunHeat || w.ammoInShade) return w.tempF;
    const mins = (now - w.start) / 60000;
    return w.tempF + w.sunHeat * (1 - Math.exp(-mins / 6));
  };

  /* ----------------------------------------------------------- wind field */

  function newWindField(loc, toggles, real) {
    const base = real ? L.pick([2, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 16, 18]) : L.pick([0, 3, 4, 5, 6, 7, 8, 8, 9, 10, 10, 12]);
    const dirDeg = L.randInt(0, 359); // where the wind blows FROM; 0 = head-on (12 o'clock)
    const vary = toggles.gusts;
    const zones = [0, 1, 2].map((z) => ({
      base: Math.max(0, base * loc.zoneK[z] * (vary ? L.rand(0.8, 1.2) : 1)),
      dir: dirDeg + (vary ? L.gauss() * 12 : 0),
      gust: vary ? 0.9 + base * 0.32 : 0,
      swing: vary ? 10 + base * 0.6 : 0,
      ph: [Math.random() * 20, Math.random() * 20, Math.random() * 20, Math.random() * 20],
      // slow switch: direction eases toward a new heading every so often
      shift: 0, shiftTarget: 0, nextSwitch: 20 + Math.random() * 60, shiftStart: 0,
      lull: 0, lullStart: -100, lullDur: 0,
    }));
    return { base, dirDeg, zones, vary, switchy: loc.id === 'canyon' || loc.id === 'northern' };
  }

  /* Advance the stochastic parts of the field (switches, lulls). dt in seconds. */
  RANGE.tickWind = function (w, now) {
    const t = (now - w.start) / 1000;
    const f = w.wind;
    if (!f.vary) return;
    f.zones.forEach((zn) => {
      if (t > zn.nextSwitch) {
        zn.shiftTarget = (Math.random() < 0.5 ? -1 : 1) * L.rand(12, f.switchy ? 60 : 35);
        if (Math.random() < 0.35) zn.shiftTarget = 0;
        zn.shiftStart = t;
        zn.nextSwitch = t + L.rand(25, f.switchy ? 60 : 110);
        if (Math.random() < 0.4) { zn.lullStart = t + L.rand(3, 12); zn.lullDur = L.rand(4, 12); }
      }
      // ease the direction shift over ~8 s
      const k = clamp((t - zn.shiftStart) / 8, 0, 1);
      zn.shift += (zn.shiftTarget - zn.shift) * (0.02 + 0.1 * k);
      const lt = t - zn.lullStart;
      zn.lull = lt > 0 && lt < zn.lullDur ? Math.sin(Math.PI * lt / zn.lullDur) : 0;
    });
  };

  /* Wind at one zone (0 near, 1 mid, 2 far) at time now. */
  RANGE.zoneWind = function (w, now, z) {
    const f = w.wind;
    const zn = f.zones[z];
    const t = (now - w.start) / 1000;
    if (f.base === 0 && !zn.base) {
      return { speed: Math.max(0, 0.8 + 0.8 * Math.sin(t * 0.5 + zn.ph[0])), dirDeg: (zn.dir + 90 * Math.sin(t * 0.17 + zn.ph[1]) + 360) % 360 };
    }
    const g = zn.gust * (0.5 * Math.sin(t * 0.37 + zn.ph[0]) + 0.3 * Math.sin(t * 1.21 + zn.ph[1]) + 0.2 * Math.sin(t * 3.3 + zn.ph[2]));
    const speed = Math.max(0, (zn.base + g) * (1 - 0.7 * zn.lull));
    const dir = zn.dir + zn.shift + zn.swing * (0.6 * Math.sin(t * 0.23 + zn.ph[3]) + 0.4 * Math.sin(t * 0.9 + zn.ph[2]));
    return { speed, dirDeg: ((dir % 360) + 360) % 360 };
  };

  /* Clock direction (1–12) from a "from" heading in degrees; 0° = 12 o'clock. */
  RANGE.toClock = (dirDeg) => { let c = Math.round(dirDeg / 30) % 12; if (c === 0) c = 12; return c; };
  RANGE.toClockHalf = (dirDeg) => { let c = Math.round(dirDeg / 15) / 2 % 12; if (c === 0) c = 12; return c; };

  /*
   * The wind the bullet flies through, as a single equivalent vector for the
   * solver (speed, clock). A bullet's deflection from wind in a segment is
   * proportional to the lag time it accumulates afterwards, so wind near the
   * muzzle counts most: 0.45 / 0.33 / 0.22.
   */
  RANGE.pathWind = function (w, now, yards) {
    const wts = yards < 250 ? [0.75, 0.25, 0] : yards < 500 ? [0.5, 0.4, 0.1] : [0.45, 0.33, 0.22];
    let x = 0, y = 0;
    [0, 1, 2].forEach((z) => {
      const zw = RANGE.zoneWind(w, now, z);
      const a = zw.dirDeg * Math.PI / 180;
      x += wts[z] * zw.speed * Math.sin(a);
      y += wts[z] * zw.speed * Math.cos(a);
    });
    const speed = Math.hypot(x, y);
    const dirDeg = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
    return { speed, dirDeg, clock: dirDeg / 30 };
  };

  /* Average field conditions (no gusts) for a target distance. */
  RANGE.meanWind = function (w, yards) {
    const wts = yards < 250 ? [0.75, 0.25, 0] : yards < 500 ? [0.5, 0.4, 0.1] : [0.45, 0.33, 0.22];
    let x = 0, y = 0;
    w.wind.zones.forEach((zn, z) => {
      const a = (zn.dir + zn.shift) * Math.PI / 180;
      x += wts[z] * zn.base * Math.sin(a);
      y += wts[z] * zn.base * Math.cos(a);
    });
    const dirDeg = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
    return { speed: Math.hypot(x, y), dirDeg, clock: dirDeg / 30 };
  };

  /* The RO's wind call: a bracket and a clock, as you would hear it on the line. */
  RANGE.windCallText = function (w) {
    const f = w.wind;
    if (f.base === 0) return 'Calm, 0–2 mph, switching';
    const lo = Math.max(0, Math.round(f.base - f.zones[1].gust));
    const hi = Math.round(f.base + f.zones[1].gust);
    const c = RANGE.toClockHalf(f.dirDeg);
    return `${lo === hi ? lo : lo + '–' + hi} mph from ${c} o'clock${f.vary ? ', gusting' : ''}`;
  };

  /* ================================================================ rifle */

  /*
   * The rifle the shooter owns. Everything here is hidden from the UI until
   * the debrief; the shooter discovers it with the chronograph, the zero
   * target and the steel.
   */
  RANGE.newRifle = function (setup, toggles) {
    const load = RANGE.load(setup.load);
    const cart = RANGE.cartridge(setup.cart);
    const rifle = RANGE.rifle(setup.rifle);
    const optic = RANGE.optic(setup.optic);
    const boxMv = RANGE.boxMv(load, setup.barrelIn);
    // Your barrel is not the test barrel: typically 1–2.5% off the box
    const mvOff = clamp(L.gauss() * boxMv * 0.012 + (Math.random() < 0.6 ? -boxMv * 0.006 : 0), -boxMv * 0.03, boxMv * 0.03);
    const mvRef = Math.round(boxMv + mvOff);       // true MV at 59°F powder temperature
    const sdFps = clamp(load.sdFps * L.rand(0.75, 1.35), 4, 30);
    const solverBase = {
      muzzleVelocityFps: mvRef, bc: load.bc, dragModel: load.dragModel, bulletWeightGr: load.bulletGr,
      sightHeightIn: +setup.sightHeightIn, zeroYards: +setup.zeroYd,
      bulletDiameterIn: load.diaIn, bulletLengthIn: load.lenIn, twistIn: +setup.twistIn,
      tempSensitivity: load.tempSens, mvTempF: 59,
    };
    // A perfect zero at standard conditions defines the bore angle; the
    // real rifle leaves the shop boresighted a little off that.
    const zeroSolve = B.solve(Object.assign({}, solverBase, { windMph: 0, altitudeFt: 0, tempF: 59, humidityPct: 0 }), [+setup.zeroYd]);
    const a = Math.random() * Math.PI * 2;
    const cb = toggles.coldBore ? rifle.coldBore * L.rand(0.6, 1.3) : 0;
    const ha = Math.random() * Math.PI * 2;
    return {
      load, cart, cls: rifle, optic, boxMv, mvRef, sdFps,
      solverBase,
      zeroAngleRad: zeroSolve.zeroAngleRad,
      sg: zeroSolve.sg,
      boreE: L.gauss() * 1.1 + L.pick([-1, 1]) * 0.5,   // mil, + = shoots high with turrets at mechanical zero
      boreW: L.gauss() * 0.8 + L.pick([-1, 1]) * 0.4,   // mil, + = shoots right
      coldBore: { e: Math.sin(a) * cb, w: Math.cos(a) * cb, mv: toggles.coldBore ? -L.rand(6, 18) : 0 },
      heatDir: { e: Math.sin(ha), w: Math.cos(ha) },
      contour: rifle.contour,
      precisionMil: rifle.precisionMil * L.rand(0.85, 1.2),
      trackErr: toggles.tracking ? clamp(L.gauss() * optic.trackErr * 0.7, -optic.trackErr, optic.trackErr) : 0,
      heat: 0, lastShotAt: -1e9, rounds: 0,
      slip: { elev: 0, wind: 0 },   // raw turret value at which the shooter "set zero"
    };
  };

  /* Heat decays with a ~2 minute time constant (compressed from real life). */
  RANGE.heatNow = function (r, now) {
    const dt = Math.max(0, (now - r.lastShotAt) / 1000);
    return r.heat * Math.exp(-dt / 120);
  };

  /*
   * One shot's muzzle velocity and the rifle-side POI offsets (mil).
   * Returns { mv, dE, dW, sigmaMil, coldBore }.
   */
  RANGE.shotBallistics = function (r, w, toggles, now) {
    const heat = RANGE.heatNow(r, now);
    const idleMin = (now - r.lastShotAt) / 60000;
    const cold = toggles.coldBore && (r.rounds === 0 || idleMin > 8);
    const powderT = RANGE.powderTempF(w, now);
    let mv = r.mvRef + r.load.tempSens * (powderT - 59) + L.gauss() * r.sdFps;
    let dE = 0, dW = 0;
    if (toggles.heat) {
      mv += 1.4 * heat;
      const walk = heat * 0.035 * r.contour;
      dE += r.heatDir.e * walk; dW += r.heatDir.w * walk;
    }
    if (cold) { mv += r.coldBore.mv; dE += r.coldBore.e; dW += r.coldBore.w; }
    const sigmaMil = r.precisionMil / 3 * (1 + (toggles.heat ? 0.04 * heat : 0));
    return { mv, dE, dW, sigmaMil, coldBore: cold, powderT, heat };
  };

  RANGE.recordShot = function (r, now) {
    r.heat = RANGE.heatNow(r, now) + 1;
    r.lastShotAt = now;
    r.rounds++;
  };

  /* ============================================================ instruments */

  /*
   * A laser rangefinder reading. Beam divergence means a small, far plate may
   * not return the laser: you get the berm behind it or brush in front.
   */
  RANGE.lase = function (target, toggles) {
    const yards = target.yards;
    const plateMil = B.inchesToMil(target.plateIn, yards);
    let reading = yards + L.gauss() * 0.6;
    let bad = false;
    if (toggles.lrfError) {
      const beamMil = 1.3; // effective divergence incl. hand shake
      const pGood = 1 - Math.exp(-Math.pow(plateMil / 0.35, 2)); // a 0.5 mil plate returns clean ~87% of the time; coin-flips only below ~0.3 mil
      if (Math.random() > pGood) {
        bad = true;
        reading = Math.random() < 0.75 ? yards + L.rand(12, 90) : yards - L.rand(8, 40);
      }
    }
    return { yards: Math.round(reading), bad, angleDeg: Math.round(target.angleDeg + L.gauss() * 0.4) };
  };

  /* A chronograph reading of a true velocity (±0.1% device noise). */
  RANGE.chronoRead = (mv) => Math.round(mv + L.gauss() * mv * 0.0008);

  RANGE.stats = function (arr) {
    if (!arr.length) return { n: 0, avg: 0, sd: 0, es: 0, min: 0, max: 0 };
    const n = arr.length;
    const avg = arr.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(arr.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
    const min = Math.min.apply(null, arr), max = Math.max.apply(null, arr);
    return { n, avg, sd, es: max - min, min, max };
  };

  /* Speed of sound in today's air, in yards per second. */
  RANGE.soundYps = (w) => w.atm.speedOfSound / 0.9144;
})();
