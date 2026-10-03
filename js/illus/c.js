/*
 * Illustrations C: module 01 Ballistics + module Equipment.
 *
 * Two kinds of frame are used:
 *  - "Diagonal" scenes: downrange is +x (down-right), the shooter's right is -y.
 *  - "Horizontal" scenes (scale 1, units = px): downrange runs along world (+x, -y),
 *    which is horizontal on screen. hz(d, w, z) maps downrange distance d, depth w
 *    (toward the viewer = shooter's LEFT) and height z to world coordinates. Shapes
 *    drawn in the (d, z) plane are true side views, so trajectories, bullets and
 *    rifle silhouettes read like an engineering elevation sitting on an iso range.
 *
 * Numbers quoted on the figures come from js/ballistics.js (6.5 Creedmoor, 140 gr,
 * G7 0.326, 2,710 fps, 1.9" sight height, 100 yd zero, ICAO standard day) and are
 * recomputed live when window.Ballistics is loaded.
 */
(function () {
  'use strict';
  const ISO = window.ISO, C = ISO.C, P = ISO.parts;
  const COS30 = Math.cos(Math.PI / 6);
  const sh = ISO.shade;

  // ------------------------------------------------------------ helpers

  const hz = (d, w, z) => [d / (2 * COS30) + (w || 0), -d / (2 * COS30) + (w || 0), z || 0];
  const f1 = (v) => (+v).toFixed(1);

  function dot(s, p, r, fill, o) {
    const q = s.P(p);
    s.raw(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${r}" fill="${fill}"${o && o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.5}"` : ''}${o && o.op != null ? ` opacity="${o.op}"` : ''}${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`);
  }

  // Callout whose pill starts (sx >= point) or ends (sx < point) at screen x = sx, centred on y = sy
  function pin(s, p, text, sx, sy, o) {
    const q = s.P(p);
    let dx = sx - q[0];
    if (Math.abs(dx) < 0.5) dx = 0.5;
    lab(s, p, text, Object.assign({}, o || {}, { dx, dy: sy - q[1] }));
  }

  // The engine sizes pills at ~0.56 em per glyph, a little tight for bold UI text.
  // Trailing spaces widen the pill but collapse when the SVG renders.
  function lab(s, p, text, o) { s.label(p, text + ' '.repeat(Math.ceil(String(text).length * 0.09)), o); }

  // deterministic pseudo-random
  function rng(seed) { let x = seed || 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); }

  // Ground strip in a horizontal scene: top face, front edge and an iso grid
  function strip(s, d0, d1, w0, w1, o) {
    o = o || {};
    const t = o.edge != null ? o.edge : 8;
    s.poly([hz(d0, w1, 0), hz(d1, w1, 0), hz(d1, w1, -t), hz(d0, w1, -t)], { fill: o.edgeColor || 'var(--illus-grid)' });
    s.poly([hz(d0, w0, 0), hz(d1, w0, 0), hz(d1, w1, 0), hz(d0, w1, 0)], { fill: o.color || 'var(--illus-floor)' });
    const g = o.grid;
    if (!g) return;
    const k = 2 * COS30;
    // world-x = const lines and world-y = const lines, clipped to the strip
    const xr = [d0 / k + w0, d1 / k + w1], yr = [-d1 / k + w0, -d0 / k + w1];
    for (let x = Math.ceil(xr[0] / g) * g; x < xr[1]; x += g) {
      const a = Math.max(w0, x - d1 / k), b = Math.min(w1, x - d0 / k);
      if (b > a) s.line([hz(k * (x - a), a, 0), hz(k * (x - b), b, 0)], { color: 'var(--illus-grid)', width: 1 });
    }
    for (let y = Math.ceil(yr[0] / g) * g; y < yr[1]; y += g) {
      const a = Math.max(w0, y + d0 / k), b = Math.min(w1, y + d1 / k);
      if (b > a) s.line([hz(k * (a - y), a, 0), hz(k * (b - y), b, 0)], { color: 'var(--illus-grid)', width: 1 });
    }
  }

  // 2D side-view shape in the (d, z) plane of a horizontal scene, with a lit top lip
  function side(s, pts, d, w, z, k, color, o) {
    o = o || {};
    const rot = o.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
    const map = (u, v, dw) => hz(d + (u * cr - v * sr) * k, w + (dw || 0), z + (u * sr + v * cr) * k);
    if (o.lip !== false) s.poly(pts.map(([u, v]) => map(u, v, -(o.lip || 1.6))), { fill: sh(color, 0.28), opacity: o.opacity });
    s.poly(pts.map(([u, v]) => map(u, v)), { fill: color, opacity: o.opacity });
    return map;
  }

  // Bullet profile (axis t from base, radius r) like ISO.parts.bullet
  const SHAPES = {
    flat: { bt: 0, bear: 1.4, og: 1.6, p: 1.6, mep: 0.35 },
    fmj: { bt: 0, bear: 1.5, og: 2.3, p: 1.8, mep: 0.14 },
    otm: { bt: 0.8, bear: 1.6, og: 2.9, p: 2.2, mep: 0.1 },
    vld: { bt: 0.9, bear: 1.2, og: 3.6, p: 2.8, mep: 0.08 },
  };
  function bulletProf(r, type) {
    const s0 = SHAPES[type] || SHAPES.otm;
    const prof = s0.bt ? [[0, r * 0.72], [s0.bt * r, r]] : [[0, r * 0.94], [0.12 * r, r]];
    const b1 = (s0.bt || 0.12) * r + s0.bear * r;
    prof.push([b1, r]);
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      prof.push([b1 + t * s0.og * r, i === 9 ? s0.mep * r : Math.max(s0.mep * r, r * Math.pow(1 - t, 1 / s0.p))]);
    }
    prof.push([b1 + s0.og * r + 0.01, 0]);
    return prof;
  }

  // Side-view bullet (horizontal scenes): silhouette + highlight + shade band
  function sideBullet(s, d, w, z, len, type, o) {
    o = o || {};
    const prof = bulletProf(1, type);
    const L = prof[prof.length - 1][0];
    const k = len / L;
    const col = o.color || C.copper;
    const outline = (f) => prof.map(([t, r]) => [t, r * f]).concat(prof.slice().reverse().map(([t, r]) => [t, -r * f]));
    const band = (a, b) => prof.map(([t, r]) => [t, r * a]).concat(prof.slice().reverse().map(([t, r]) => [t, r * b]));
    side(s, outline(1), d, w, z, k, col, { rot: o.rot, lip: false });
    side(s, band(0.85, 0.3), d, w, z, k, sh(col, 0.32), { rot: o.rot, lip: false });
    side(s, band(-0.45, -1), d, w, z, k, sh(col, -0.22), { rot: o.rot, lip: false });
    const rot = o.rot || 0;
    return { tip: hz(d + len * Math.cos(rot), w, z + len * Math.sin(rot)), base: hz(d, w, z), mid: hz(d + len * 0.5 * Math.cos(rot), w, z + len * 0.5 * Math.sin(rot) + len * 0.12) };
  }

  // Lathe bullet along any axis; dir = -1 points it toward the negative axis
  function bulletAxis(s, x, y, z, r, type, axis, dir, color) {
    let prof = bulletProf(r, type);
    if (dir < 0) prof = prof.map(([t, rr]) => [-t, rr]).reverse();
    s.lathe(x, y, z, prof, { axis, color: color || C.copper, segments: 16 });
  }

  /*
   * Side-view precision rifle for horizontal scenes. Butt at d, ground (bipod feet) at z.
   * k = px per inch. sh = sight height in inches (exaggerate for teaching).
   */
  function sideRifle(s, d, w, z, k, o) {
    o = Object.assign({ stock: C.slate, metal: C.gunmetal, scope: C.ink, sh: 2.6, bipod: true }, o || {});
    const bore = 6.9, sz = bore + o.sh;
    const S = (pts, col, lip) => side(s, pts, d, w, z, k, col, { lip: lip == null ? 1.4 : lip });
    if (o.bipod) {
      s.line([hz(d + 33 * k, w - 1, z + 3.4 * k), hz(d + 35.5 * k, w - 1, z)], { color: o.metal, width: 3 });
    }
    S([[1, 1.4], [13, 2.8], [15.5, 0.4], [18.5, 0.4], [19.5, 3.6], [37, 3.6], [37, 6.2], [20, 6.3], [16, 6.4], [1.4, 6.2]], o.stock);
    S([[0, 1.3], [1.2, 1.3], [1.2, 7], [0, 7]], C.black, 1);
    S([[6, 6.2], [14, 6.2], [14, 7.3], [6, 7.3]], sh(o.stock, -0.15), 1);
    S([[20, 1.2], [22.6, 1.2], [22.6, 3.6], [20, 3.6]], C.black, 1);
    S([[15.5, bore - 0.8], [26.5, bore - 0.8], [26.5, bore + 0.8], [15.5, bore + 0.8]], o.metal);
    S([[26.5, bore - 0.62], [50.5, bore - 0.42], [50.5, bore + 0.42], [26.5, bore + 0.62]], o.metal, 1);
    S([[50.5, bore - 0.6], [53.3, bore - 0.6], [53.3, bore + 0.6], [50.5, bore + 0.6]], C.black, 1);
    // rings / mount (tall when sight height is exaggerated)
    [17.4, 24.4].forEach((x) => S([[x, bore + 0.6], [x + 1.1, bore + 0.6], [x + 1.1, sz], [x, sz]], C.black, 1));
    const sp = [[0, 0.95], [3, 0.95], [4.2, 0.6], [12.5, 0.6], [14, 1.05], [16.5, 1.1]];
    S(sp.map(([t, r]) => [13.5 + t, sz + r]).concat(sp.slice().reverse().map(([t, r]) => [13.5 + t, sz - r])), o.scope);
    S([[20.4, sz + 0.55], [21.6, sz + 0.55], [21.6, sz + 1.6], [20.4, sz + 1.6]], C.amber, 1);
    if (o.bipod) s.line([hz(d + 33 * k, w + 1, z + 3.4 * k), hz(d + 35.5 * k, w + 1, z)], { color: o.metal, width: 3 });
    const at = (u, v) => hz(d + u * k, w, z + v * k);
    return { muzzle: at(53.3, bore), eye: at(13.5, sz), scope: at(21, sz + 1.6), boreAt: (u) => at(u, bore), sightAt: (u) => at(u, sz), d, k, boreZ: z + bore * k, sightZ: z + sz * k, muzzleD: d + 53.3 * k };
  }

  // Trajectory data (inches relative to line of sight, every 50 yd to 1,000)
  const DROP_FALLBACK = [-1.9, -0.3, 0, -1, -3.4, -7.2, -12.6, -19.7, -28.4, -39, -51.6, -66.2, -83.1, -102.2, -123.9, -148.2, -175.3, -205.4, -238.7, -275.4, -315.8];
  const VEL_HI = [[2710, 2.43], [2570, 2.3], [2433, 2.18], [2301, 2.06], [2173, 1.95], [2050, 1.84], [1930, 1.73], [1814, 1.63], [1701, 1.52], [1592, 1.43], [1485, 1.33]];
  const VEL_LO = [[2710, 2.43], [2483, 2.22], [2267, 2.03], [2063, 1.85], [1869, 1.67], [1685, 1.51], [1508, 1.35], [1340, 1.2], [1184, 1.06], [1064, 0.95], [1008, 0.9]];
  function solved(input, ranges) {
    try { if (window.Ballistics && window.Ballistics.solve) return window.Ballistics.solve(input || {}, ranges).rows; } catch (e) { /* fall back */ }
    return null;
  }
  function dropTable() {
    const R = []; for (let y = 0; y <= 1000; y += 50) R.push(y);
    const rows = solved({}, R);
    return R.map((y, i) => ({ yd: y, drop: rows ? rows[i].dropIn : DROP_FALLBACK[i], mil: rows ? rows[i].elevMil : (y ? -DROP_FALLBACK[i] / (y * 0.036) : 0), tof: rows ? rows[i].tofSec : null }));
  }
  function velTable(bc) {
    const R = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const rows = solved({ bc }, R);
    const fb = bc < 0.3 ? VEL_LO : VEL_HI;
    return R.map((y, i) => ({ yd: y, v: rows ? rows[i].velocityFps : fb[i][0], m: rows ? rows[i].mach : fb[i][1] }));
  }
  const TOF_FALLBACK = { 200: 0.23, 400: 0.49, 600: 0.79, 800: 1.12, 1000: 1.5 };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // Air molecules filling a box volume (screen dots)
  function molecules(s, x0, y0, z0, w, d, h, n, seed, col) {
    const r = rng(seed);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([x0 + r() * w, y0 + r() * d, z0 + r() * h]);
    pts.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    pts.forEach((p) => dot(s, p, 3, col || C.blue, { op: 0.75 }));
  }

  // =====================================================================
  // Module heroes
  // =====================================================================

  ISO.module('m-ballistics', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [22, 236], scale: 1 });
    strip(s, -10, 610, -40, 40, { grid: 40, edge: 10 });
    const rf = sideRifle(s, 4, 0, 0, 3.6, { sh: 3 });
    const zl = rf.sightZ, d0 = rf.muzzleD, d1 = 560;
    // target at line of sight
    s.line([hz(d1, 0, 0), hz(d1, 0, zl - 24)], { color: C.wood, width: 6 });
    dot(s, hz(d1, 0, zl), 30, C.white, { stroke: C.slate, sw: 3 });
    dot(s, hz(d1, 0, zl), 13, C.coral);
    s.line([rf.eye, hz(d1, 0, zl)], { color: C.blue, width: 3, dash: '8 8' });
    // trajectory: launched up from the bore, gravity curls it down onto the target
    const L = d1 - d0, a = (zl - rf.boreZ) / L + 0.9;
    const tr = (t) => hz(d0 + L * t, 0, rf.boreZ + a * L * t - (a * L - (zl - rf.boreZ)) * t * t);
    s.curve(tr, 0, 1, { color: C.coral, width: 6, samples: 50 });
    const tB = 0.5, pB = tr(tB);
    s.line([[pB[0], pB[1], pB[2] - 14], [pB[0], pB[1], pB[2] - 90]], { color: C.amber, width: 7, arrow: true, arrowSize: 20 });
    sideBullet(s, d0 + L * tB - 40, 0, pB[2] - 2, 80, 'otm');
    return s.svg();
  });

  ISO.module('m-equipment', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [150, 70], scale: 5.6 });
    s.floor(-6, -14, 76, 36, { grid: 8 });
    P.mat(s, -2, -7, 60, 14, { color: C.teal });
    const r = P.rifle(s, 2, 0, 0.4, { bag: true });
    // rangefinder + weather meter + chronograph on the mat edge
    s.shadow(30, 9, 8, 5); s.box(30, 9, 0, 7, 4, 4, { color: C.gunmetal });
    s.lathe(37, 10.2, 2.6, [[0, 0.9], [0.8, 0.9]], { axis: 'x', color: C.black });
    s.lathe(37, 12, 2.6, [[0, 0.9], [0.8, 0.9]], { axis: 'x', color: C.black });
    s.shadow(44, 10, 4, 3); s.box(44, 10, 0, 3, 1.4, 9, { color: C.amber });
    s.disc(45.5, 10, 10.6, 1.5, { plane: 'xz', fill: C.ink });
    s.shadow(58, -6, 6, 6); s.box(58, -6, 0, 5, 5, 3, { color: C.ink });
    s.poly([[63, -5, 0.6], [63, -2, 0.6], [63, -2, 2.6], [63, -5, 2.6]], { fill: C.sky });
    pin(s, r.scope, 'Scope', 120, 36, { n: 1 });
    pin(s, [33, 11, 4], 'Rangefinder', 160, 262, { n: 2, color: C.coral });
    pin(s, [45.5, 10, 10], 'Weather meter', 470, 270, { n: 3, color: C.amber });
    return s.svg();
  });

  // =====================================================================
  // m-ballistics lessons
  // =====================================================================

  ISO.lesson('what-is-dope', {
    caption: '<b>Three stages, one card.</b> Internal ballistics (chamber → muzzle) sets the muzzle velocity; external ballistics (muzzle → target) is the flight your dope card precomputes; terminal ballistics is what happens on impact.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [20, 250], scale: 1 });
      const st = [[130, C.lilac], [365, C.sky], [600, C.pink]];
      st.forEach(([d, col]) => {
        const c = hz(d, 0, 0);
        s.shadow(c[0] - 55, c[1] - 55, 110, 110, { opacity: 0.12 });
        s.box(c[0] - 55, c[1] - 55, 0, 110, 110, 16, { color: C.white, top: sh(col, 0.45) });
      });
      // 1 · internal: barrel section with the bullet leaving and gas behind it
      // cutaway barrel (side view): chamber + cartridge case, bullet leaving the muzzle
      side(s, [[0, 0], [118, 4], [118, 22], [0, 26]], 52, 0, 34, 1, C.gunmetal);
      side(s, [[4, 6], [40, 6], [46, 9.5], [118, 9.5], [118, 16.5], [46, 16.5], [40, 20], [4, 20]], 52, 0, 34, 1, C.black, { lip: false });
      side(s, [[6, 7], [38, 7], [44, 10.5], [52, 10.5], [52, 15.5], [44, 15.5], [38, 19], [6, 19]], 52, 0, 34, 1, C.brass, { lip: false });
      side(s, [[56, 11], [92, 11], [92, 15], [56, 15]], 52, 0, 34, 1, C.amber, { lip: false, opacity: 0.55 });
      [[0, 7], [12, 10], [22, 6]].forEach(([dd, r]) => dot(s, hz(174 + dd, -2, 47 + (dd % 4)), r, C.white, { op: 0.85 }));
      sideBullet(s, 184, 0, 47, 38, 'otm');
      s.line([hz(150, 0, 76), hz(205, 0, 76)], { color: C.green, width: 3, arrow: true });
      s.text3(hz(150, 0, 82), 'MV 2,710 fps', { size: 12, color: C.green, weight: 700 });
      // arrows between stages
      s.line([hz(210, 0, 34), hz(258, 0, 34)], { color: C.slate, width: 2.5, dash: '5 5', arrow: true });
      s.line([hz(455, 0, 34), hz(500, 0, 34)], { color: C.slate, width: 2.5, dash: '5 5', arrow: true });
      // 2 · external: arc + gravity + wind + the dope card
      const tr = (t) => hz(285 + 160 * t, 0, 46 + 70 * t - 90 * t * t);
      s.curve(tr, 0, 1, { color: C.blue, width: 3, dash: '2 6' });
      const pm = tr(0.55);
      s.line([pm, [pm[0], pm[1], pm[2] - 34]], { color: C.amber, width: 3, arrow: true });
      const cardC = hz(365, 24, 16);
      s.shadow(cardC[0] - 22, cardC[1] - 14, 44, 30);
      s.box(cardC[0] - 22, cardC[1] - 14, 16, 44, 30, 3, { color: C.white });
      for (let i = 0; i < 4; i++) s.line([[cardC[0] - 16 + i * 0, cardC[1] - 9 + i * 7, 19.2], [cardC[0] + 17, cardC[1] - 9 + i * 7, 19.2]], { color: i ? C.steel : C.blue, width: i ? 1.5 : 2.5 });
      // 3 · terminal: steel plate with a hit and ring lines
      const tc = hz(600, 0, 16);
      s.shadow(tc[0] - 20, tc[1] - 20, 40, 40);
      P.plate(s, tc[0], tc[1], 16, 20, { hit: true, color: C.white });
      [[20, -1], [-20, 1]].forEach(([dd]) => s.curve((t) => hz(600 + (dd > 0 ? 34 : -34) + t * (dd > 0 ? 10 : -10), 0, 52 + 26 * Math.sin(t * 3)), 0, 1, { color: C.amber, width: 2, samples: 8 }));
      pin(s, hz(80, 0, 58), 'Internal: chamber → muzzle', 40, 34, { n: 1, color: C.purple });
      pin(s, tr(0.3), 'External: muzzle → target', 280, 72, { n: 2, color: C.blue });
      pin(s, hz(600, 0, 96), 'Terminal: at the target', 700, 34, { n: 3, color: C.pink });
      lab(s, hz(372, 24, 20), 'The dope card lives here', { dx: 30, dy: 50, n: '★', color: C.amber });
      s.text(130, 330, 'Sets MV & SD: ammo, barrel', { anchor: 'middle', size: 12 });
      s.text(365, 330, 'Drop · drift · time of flight', { anchor: 'middle', size: 12 });
      s.text(600, 330, 'Energy · ring / no ring', { anchor: 'middle', size: 12 });
      return s.svg();
    },
  });

  // Key figure 1 (rule): drop vs range from the solver, on tall target boards
  ISO.lesson('gravity-tof', {
    caption: '<b>Drop grows faster than range.</b> Each board is aimed at the blue mark on the line of sight; the bullet lands lower every 200 yd, and the step keeps growing because the slowing bullet spends longer in the air. 1,000 yd needs ~3× the 500 yd hold, not 2×.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [12, 340], scale: 1 });
      const T = dropTable();
      const zl = 222, kz = 0.46, kd = 0.52;
      strip(s, -4, 712, -30, 22, { grid: 30 });
      // firing point hill
      const zp = zl - (6.9 + 2.6) * 2.3;
      s.poly([hz(118, -30, zp), hz(118, 22, zp), hz(176, 22, 0), hz(176, -30, 0)], { fill: C.grassDark });
      s.poly([hz(-4, -30, zp), hz(118, -30, zp), hz(118, 22, zp), hz(-4, 22, zp)], { fill: C.grass });
      s.poly([hz(-4, 22, 0), hz(176, 22, 0), hz(118, 22, zp), hz(-4, 22, zp)], { fill: C.sand });
      [0.3, 0.6].forEach((f) => s.line([hz(-4, 22, zp * f), hz(176 - 58 * f, 22, zp * f)], { color: C.dirt, width: 2, opacity: 0.6 }));
      s.poly([hz(-4, 22, 0), hz(176, 22, 0), hz(176, 22, -8), hz(-4, 22, -8)], { fill: C.dirt });
      const rf = sideRifle(s, 4, 0, zp, 2.3);
      const dAt = (yd) => rf.muzzleD + yd * kd;
      const zAt = (row) => zl + row.drop * kz;
      // tall target boards every 200 yd
      const marks = T.filter((r) => r.yd && r.yd % 200 === 0);
      marks.forEach((r) => {
        const c = hz(dAt(r.yd), 0, 0);
        s.shadow(c[0] - 6, c[1] - 6, 12, 12);
        s.box(c[0] - 3, c[1] - 3, 0, 6, 6, zl + 14, { color: C.white });
        dot(s, hz(dAt(r.yd), 3, zl), 6, C.blue);
      });
      s.line([rf.eye, hz(dAt(1000) + 8, 0, zl)], { color: C.blue, width: 2, dash: '7 6' });
      s.curve((t) => {
        const f = t * 20, i = Math.min(19, Math.floor(f)), u = f - i;
        return hz(dAt(T[i].yd + 50 * u), 0, zl + (T[i].drop + (T[i + 1].drop - T[i].drop) * u) * kz);
      }, 0, 1, { color: C.coral, width: 3, samples: 100 });
      marks.forEach((r) => {
        const z = zAt(r);
        if (zl - z > 8) s.line([hz(dAt(r.yd), 3, zl - 6), hz(dAt(r.yd), 3, z + 4)], { color: C.amber, width: 3, arrow: true, arrowSize: 8 });
        dot(s, hz(dAt(r.yd), 3, z), 4.5, C.coral, { stroke: '#fff', sw: 1.5 });
        const tof = r.tof != null ? r.tof : TOF_FALLBACK[r.yd];
        s.text3(hz(dAt(r.yd), 26, 0), r.yd + ' yd', { anchor: 'middle', size: 12, weight: 700 });
        s.text3(hz(dAt(r.yd), 26, 0), tof.toFixed(2) + ' s', { anchor: 'middle', size: 11, dy: 15, color: 'var(--illus-ink)', weight: 500 });
        s.text3(hz(dAt(r.yd), 3, z), r.mil.toFixed(1) + ' mil', { anchor: 'end', dx: -9, dy: 14, size: 12, weight: 700, color: C.coral });
      });
      // "2× the 500 yd hold" ghost at 1000 yd
      const m500 = T[10].mil, ghostZ = zl - 2 * m500 * 36 * kz;
      dot(s, hz(dAt(1000), 3, ghostZ), 6, 'none', { stroke: C.slate, sw: 2, dash: '3 3' });
      pin(s, hz(dAt(1000), 3, ghostZ), '2× the 500 yd hold would hit high', 704, 60, { size: 11 });
      lab(s, hz(dAt(80), 0, zl), 'Line of sight', { dx: 0, dy: -46, n: 1, color: C.blue });
      lab(s, hz(dAt(500), 0, zAt(T[10])), 'Bullet path', { dx: -150, dy: 50, n: 2, color: C.coral });
      s.text(18, 30, 'Drop at each board (MIL) and time of flight', { size: 14, weight: 700 });
      s.text(18, 48, '6.5 Creedmoor · 140 gr · 2,710 fps · 100 yd zero', { size: 11, weight: 500 });
      return s.svg();
    },
  });

  // Key figure 2: line of sight vs bore line vs trajectory (exaggerated)
  ISO.lesson('gravity-tof', {
    at: 'after:ul',
    caption: '<b>Bore line, line of sight, trajectory.</b> The scope looks along a level line; the bore is tilted slightly up. The bullet starts below the sight line, crosses it, peaks and falls back through it at the zero — yet it never rises above the bore line. Vertical scale hugely exaggerated.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [16, 320], scale: 1 });
      const zp = 34;
      strip(s, -6, 704, -32, 24, { grid: 32 });
      s.poly([hz(-6, -32, zp), hz(222, -32, zp), hz(222, 24, zp), hz(-6, 24, zp)], { fill: C.grass });
      s.poly([hz(-6, 24, 0), hz(222, 24, 0), hz(222, 24, zp), hz(-6, 24, zp)], { fill: C.sand });
      s.poly([hz(-6, 24, 0), hz(222, 24, 0), hz(222, 24, -8), hz(-6, 24, -8)], { fill: C.dirt });
      const rf = sideRifle(s, 4, 0, zp, 3.8, { sh: 6.5 });
      const md = rf.muzzleD, zb = rf.boreZ, H = rf.sightZ - zb;
      const d1 = 80, d2 = 320, lam = 300, dEnd = 460;
      const q = (d) => d * d * (1 + d / lam);
      const b = H / ((q(d2) - q(d1)) * d1 / (d2 - d1) - q(d1));
      const a = b * (q(d2) - q(d1)) / (d2 - d1);
      const traj = (d) => zb + a * d - b * q(d);
      // hold-over zone (bullet below the line of sight)
      const zone = [];
      for (let i = 0; i <= 10; i++) zone.push(hz(md + d1 * i / 10, 0, traj(d1 * i / 10)));
      s.poly(zone.concat([hz(md + d1, 0, rf.sightZ), hz(rf.d + 13.5 * rf.k, 0, rf.sightZ), hz(md, 0, zb)]), { fill: C.amber, opacity: 0.25 });
      // target at the zero
      const tz = hz(md + d2, 0, 0);
      s.shadow(tz[0] - 8, tz[1] - 8, 16, 16);
      s.box(tz[0] - 2, tz[1] - 2, 0, 4, 4, rf.sightZ - 14, { color: C.wood });
      P.plate(s, tz[0], tz[1], rf.sightZ - 28, 14, { color: C.white });
      // bore line, line of sight, trajectory
      const boreEnd = 420;
      s.line([rf.boreAt(16), hz(md + boreEnd, 0, zb + a * boreEnd)], { color: C.slate, width: 2, dash: '8 6' });
      s.line([rf.eye, hz(md + dEnd + 20, 0, rf.sightZ)], { color: C.blue, width: 2.2, dash: '7 6' });
      s.curve((t) => hz(md + dEnd * t, 0, traj(dEnd * t)), 0, 1, { color: C.coral, width: 3.2, samples: 60 });
      // gravity: gap between bore line and path
      [140, 280, 420].forEach((d) => s.line([hz(md + d, 0, zb + a * d - 3), hz(md + d, 0, traj(d) + 5)], { color: C.amber, width: 2.5, arrow: true, arrowSize: 8 }));
      // sight-height bracket
      const bx = rf.d + 31 * rf.k;
      s.line([hz(bx, -10, zb), hz(bx, -10, rf.sightZ)], { color: C.purple, width: 2.5 });
      s.line([hz(bx - 5, -10, zb), hz(bx + 5, -10, zb)], { color: C.purple, width: 2.5 });
      s.line([hz(bx - 5, -10, rf.sightZ), hz(bx + 5, -10, rf.sightZ)], { color: C.purple, width: 2.5 });
      dot(s, hz(md + d1, 0, rf.sightZ), 5, C.white, { stroke: C.coral, sw: 2.5 });
      dot(s, hz(md + d2, 0, rf.sightZ), 5, C.white, { stroke: C.coral, sw: 2.5 });
      pin(s, hz(md + 12, 0, rf.sightZ), 'Line of sight', 130, 116, { n: 1, color: C.blue });
      pin(s, hz(md + 330, 0, zb + a * 330), 'Bore line (tilted up)', 360, 40, { n: 2, color: C.slate });
      pin(s, hz(bx, -10, (zb + rf.sightZ) / 2), 'Sight height', 40, 70, { n: 3, color: C.purple });
      pin(s, hz(md + d1 * 0.55, 0, (traj(d1 * 0.55) + rf.sightZ) / 2), 'Below the line: hold over', 200, 334, { n: 4, color: C.amber });
      pin(s, hz(md + d2, 0, rf.sightZ), 'Zero: crosses back down', 700, 116, { n: 5, color: C.coral });
      pin(s, hz(md + 280, 0, (zb + a * 280 + traj(280)) / 2), 'Gravity: never above the bore', 470, 334, { n: 6, color: C.amber });
      s.text(704, 348, 'not to scale', { anchor: 'end', size: 10, weight: 500 });
      return s.svg();
    },
  });

  // Drag: the bullet shoving through air
  ISO.lesson('drag-bc', {
    caption: '<b>Drag is air in the way.</b> The nose shoves molecules aside (pressure drag), the base leaves a low-pressure wake, and the force grows with air density × v². BC measures how well this shape carries its speed through that air.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [230, 196], scale: 8 });
      s.floor(-16, -8, 50, 16, { grid: 4 });
      const r = 3.2, z = 7.5, x0 = -2;
      const prof = bulletProf(r, 'vld');
      const L = prof[prof.length - 1][0];
      const tipX = x0 + L;
      s.shadow(x0, -2.5, L, 5);
      // molecules: pushed away from the nose, sparse in the wake
      const rnd = rng(11);
      const mol = [];
      for (let i = 0; i < 95; i++) {
        let x = -15 + rnd() * 48, y = -7.5 + rnd() * 15, zz = 1.5 + rnd() * 12;
        const dy = y, dz = zz - z, rr = Math.hypot(dy, dz);
        if (x < x0 - 1 && rr < 4 + (x0 - x) * 0.18 && rnd() < 0.8) continue; // wake
        if (x > x0 - 1 && x < tipX + 6) {
          const env = x < tipX ? Math.max(r, r * 1.2) + 1.2 : 1.2 + (tipX + 6 - x) * 0.5;
          if (rr < env) { const k = env / Math.max(rr, 0.01); y = dy * k; zz = z + dz * k; }
        }
        mol.push([x, y, zz]);
      }
      // compressed layer just ahead of / around the nose
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * Math.PI * 2, rr = 4.2 + (i % 3) * 0.6;
        mol.push([tipX - 1.5 - Math.abs(Math.cos(a)) * 1.2, Math.cos(a) * rr, z + Math.sin(a) * rr]);
      }
      const depth = (p) => p[0] + p[1] + p[2] * 0.5;
      const bd = x0 + L / 2 + z * 0.5;
      mol.filter((p) => depth(p) < bd).sort((p, q) => depth(p) - depth(q)).forEach((p) => dot(s, p, 2.6, C.blue, { op: 0.55 }));
      s.lathe(x0, 0, z, prof, { axis: 'x', color: C.copper, segments: 26 });
      mol.filter((p) => depth(p) >= bd).sort((p, q) => depth(p) - depth(q)).forEach((p) => dot(s, p, 2.6, C.blue, { op: 0.55 }));
      // wake swirls
      [[-4, 0.5], [-9, -0.6], [-14, 0.4]].forEach(([x, k]) => s.curve((t) => [x0 + x + Math.cos(t) * 1.5 * k, Math.sin(t) * 2, z + Math.sin(t * 1.3) * 2.2], 0, 5.5, { color: C.lilac, width: 2, samples: 24 }));
      s.line([[tipX + 1, 0, z + 5.8], [tipX + 10, 0, z + 5.8]], { color: C.green, width: 3.5, arrow: true, arrowSize: 11 });
      s.text3([tipX + 4, 0, z + 7.2], 'velocity v', { size: 12, weight: 700, color: C.green });
      s.line([[x0 + 2, 0, z - 4.6], [x0 - 9, 0, z - 4.6]], { color: C.coral, width: 3.5, arrow: true, arrowSize: 11 });
      s.text3([x0 - 9, 0, z - 4.6], 'drag ∝ ρ · v²', { size: 13, weight: 800, color: C.coral, anchor: 'end', dx: -6, dy: 12 });
      pin(s, [tipX, 0, z], 'Nose pushes air aside', 500, 250, { n: 1, color: C.blue });
      pin(s, [x0 - 3, 0, z], 'Low-pressure wake pulls back', 20, 250, { n: 2, color: C.purple });
      pin(s, mol[5], 'Air density ρ: molecules per volume', 20, 30, { n: 3, color: C.teal });
      pin(s, [x0 + L * 0.55, 0, z + r], 'BC: how well it keeps its speed', 470, 40, { n: 4, color: C.amber });
      return s.svg();
    },
  });

  // Drag: high vs low BC speed decay
  ISO.lesson('drag-bc', {
    at: 'before:.callout.warn',
    caption: '<b>Higher BC, slower decay.</b> Same 2,710 fps start, solver-computed speed every 100 yd. The flat-base bullet sheds speed fast and is transonic (amber) by 800 yd; the long boat-tail still has 1,485 fps at 1,000 yd.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [14, 200], scale: 1 });
      const lanes = [
        { w: -64, bc: 0.326, type: 'vld', name: 'High BC', sub: 'long boat-tail · G7 0.326', col: C.blue },
        { w: 98, bc: 0.2, type: 'flat', name: 'Low BC', sub: 'flat base · G7 ≈ 0.20', col: C.coral },
      ];
      lanes.forEach((ln) => {
        strip(s, 0, 700, ln.w - 30, ln.w + 30, { edge: 6 });
        const V = velTable(ln.bc);
        sideBullet(s, 22, ln.w, 26, 100, ln.type);
        V.forEach((row, i) => {
          const d = 196 + i * 48, h = row.v * 0.04;
          const c = hz(d, ln.w, 0);
          const col = row.m >= 1.2 ? C.green : C.amber;
          s.shadow(c[0] - 9, c[1] - 9, 18, 18, { opacity: 0.1 });
          s.box(c[0] - 8, c[1] - 8, 0, 16, 16, h, { color: col });
          if (i % 5 === 0) s.text3(hz(d, ln.w, h), fmt(row.v), { anchor: 'middle', dy: -12, size: 12, weight: 700 });
          if (i === 10) s.text3(hz(d, ln.w, h), 'fps', { anchor: 'middle', dy: -26, size: 10, weight: 500 });
          if (ln.w > 0) s.text3(hz(d, ln.w + 30, 0), row.yd ? String(row.yd) : '0 yd', { anchor: 'middle', dy: 22, size: 11, weight: 500 });
        });
        s.text3(hz(14, ln.w, 0), ln.name, { dy: -76, size: 15, weight: 800, color: ln.col });
        s.text3(hz(14, ln.w, 0), ln.sub, { dy: -60, size: 11, weight: 600 });
      });
      s.raw(`<g font-size="11" font-weight="600"><rect x="520" y="16" width="12" height="12" rx="3" fill="${C.green}"/><text x="537" y="26" fill="var(--illus-ink)">Mach ≥ 1.2</text><rect x="610" y="16" width="12" height="12" rx="3" fill="${C.amber}"/><text x="627" y="26" fill="var(--illus-ink)">transonic</text></g>`);
      return s.svg();
    },
  });

  ISO.lesson('transonic', {
    caption: '<b>Mach number sets the airflow.</b> Supersonic, the shock cone is sharp and steady (half-angle = asin(1/M)). Through Mach 1.2 → 0.8 the shocks move across the bullet and drag spikes; below that the flow is calm but a marginal bullet can tumble. For this 6.5 CM load Mach 1.2 arrives near 1,150 yd.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 350, origin: [10, 270], scale: 1 });
      const M0 = 2.2, M1 = 0.5, D = 700;
      const dOf = (m) => (M0 - m) / (M0 - M1) * D;
      const bands = [[0, dOf(1.2), C.green], [dOf(1.2), dOf(0.8), C.amber], [dOf(0.8), D, C.coral]];
      s.poly([hz(0, 40, 0), hz(D, 40, 0), hz(D, 40, -8), hz(0, 40, -8)], { fill: 'var(--illus-grid)' });
      bands.forEach(([a, b, col]) => s.poly([hz(a, -40, 0), hz(b, -40, 0), hz(b, 40, 0), hz(a, 40, 0)], { fill: col, opacity: 0.32 }));
      [2.0, 1.5, 1.2, 1.0, 0.8].forEach((m) => {
        s.line([hz(dOf(m), 30, 0), hz(dOf(m), 40, 0)], { color: C.ink, width: 1.5, opacity: 0.5 });
        s.text3(hz(dOf(m), 40, 0), 'M' + m.toFixed(1), { anchor: 'middle', dy: 24, size: 12, weight: 700 });
      });
      s.text3(hz(dOf(1.2), 40, 0), '≈ 1,340 fps', { anchor: 'middle', dy: 40, size: 10, weight: 500 });
      s.text3(hz(dOf(1.0), 40, 0), '≈ 1,120 fps', { anchor: 'middle', dy: 40, size: 10, weight: 500 });
      s.text3(hz(dOf(1.7), 0, 0), 'SUPERSONIC · solver reliable', { anchor: 'middle', dy: 4, size: 12, weight: 800, color: sh(C.green, -0.35) });
      s.text3(hz((dOf(1.2) + dOf(0.8)) / 2, 0, 0), 'TRANSONIC', { anchor: 'middle', dy: 4, size: 12, weight: 800, color: sh(C.amber, -0.45) });
      s.text3(hz((dOf(0.8) + D) / 2, 0, 0), 'SUBSONIC', { anchor: 'middle', dy: 4, size: 12, weight: 800, color: sh(C.coral, -0.35) });
      const z = 120, len = 64;
      // supersonic bullet: sharp attached cone
      const m1 = 2.0, t1 = dOf(1.75), a1 = Math.asin(1 / m1);
      [-1, 1].forEach((sg) => {
        s.line([hz(t1, 0, z), hz(t1 - 120 * Math.cos(a1), 0, z + sg * 120 * Math.sin(a1))], { color: C.blue, width: 2.5 });
        s.line([hz(t1 - len, 0, z + sg * 4), hz(t1 - len - 100 * Math.cos(a1), 0, z + sg * (4 + 100 * Math.sin(a1)))], { color: C.blue, width: 1.5, opacity: 0.6 });
      });
      sideBullet(s, t1 - len, 0, z, len, 'otm');
      s.line([hz(t1 + 8, 0, z), hz(t1 + 40, 0, z)], { color: C.green, width: 3, arrow: true });
      // transonic bullet: detached, moving shocks + turbulent wake, slight yaw
      const t2 = dOf(1.0) + 20, rot = 0.09;
      s.curve((u) => hz(t2 + 16 - 10 * u * u, 0, z + u * 46), -1, 1, { color: C.blue, width: 2.5, samples: 20 });
      s.curve((u) => hz(t2 - 26 - 6 * u * u + 3 * Math.sin(u * 9), 0, z - 2 + u * 22), -1, 1, { color: C.blue, width: 1.8, samples: 20, opacity: 0.7 });
      for (let i = 0; i < 4; i++) {
        s.curve((u) => hz(t2 - len - u * 150, 0, z - 8 + i * 5 + Math.sin(u * 24 + i) * (2 + u * 10)), 0, 1, { color: C.purple, width: 1.6, samples: 50, opacity: 0.7 });
      }
      sideBullet(s, t2 - len, 0, z - len * Math.sin(rot) * 0.5, len, 'otm', { rot });
      // subsonic bullet: smooth streamlines, tumbling risk arrow
      const t3 = dOf(0.65);
      [-14, -7, 7, 14].forEach((o) => s.curve((u) => hz(t3 - 90 + 120 * u, 0, z + o * (1 + 0.5 * Math.sin(u * Math.PI))), 0, 1, { color: C.sky, width: 1.6, samples: 20 }));
      sideBullet(s, t3 - len, 0, z, len, 'otm', { rot: -0.18 });
      s.curve((u) => hz(t3 - len / 2 + 44 * Math.cos(u), 0, z + 44 * Math.sin(u)), 0.5, 1.3, { color: C.coral, width: 2.2, arrow: true, samples: 12 });
      lab(s, hz(t1 - 50, 0, z + 60), 'Sharp shock cone, steady drag', { dx: -40, dy: -80, n: 1, color: C.green });
      lab(s, hz(t2 + 8, 0, z + 40), 'Shocks shift, drag spikes, yaw grows', { dx: -120, dy: -60, n: 2, color: C.amber });
      lab(s, hz(t3, 0, z + 20), 'Calm, but may tumble', { dx: -40, dy: -110, n: 3, color: C.coral });
      return s.svg();
    },
  });

  ISO.lesson('atmosphere', {
    caption: '<b>Thinner air, less drop.</b> Same volume of air: a hot day at a 6,000 ft range holds about 24% fewer molecules than a standard day at sea level. That is a density altitude near 9,000 ft and roughly 1 mil less elevation at 1,000 yd. Feed the solver station pressure, not the sea-level corrected number.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [10, 330], scale: 1 });
      strip(s, -4, 712, -46, 34, { grid: 36 });
      s.poly([hz(-4, -46, 0.1), hz(120, -46, 0.1), hz(80, 34, 0.1), hz(-4, 34, 0.1)], { fill: C.sky, opacity: 0.55 });
      // mountain with a plateau
      const mc = hz(540, -6, 0);
      s.lathe(mc[0], mc[1], 0, [[0, 150], [60, 92], [118, 46], [124, 0.1]], { axis: 'z', color: C.grassDark, colors: [C.grassDark, C.slate, C.white], capColor: C.white, segments: 14 });
      const cols = [
        { c: hz(200, -6, 0), z0: 0, n: 64, col: C.blue },
        { c: [mc[0], mc[1], 0], z0: 120, n: 49, col: C.coral },
      ];
      cols.forEach((k, i) => {
        const [x, y] = k.c, w = 64, h = 150;
        if (!i) s.shadow(x - 32, y - 32, w, w);
        molecules(s, x - 30, y - 30, k.z0 + 4, w - 4, w - 4, h - 8, k.n, 5 + i, k.col);
        s.box(x - 32, y - 32, k.z0, w, w, h, { color: C.sky, opacity: 0.2 });
        s.line([[x + 32, y - 32, k.z0 + h], [x + 32, y + 32, k.z0 + h], [x - 32, y + 32, k.z0 + h]], { color: C.blue, width: 1.2, opacity: 0.5 });
      });
      // density-altitude gauge (screen space)
      const gx = 360, gy = 128, R = 52;
      const ang = (ft) => Math.PI * (1 - ft / 10000);
      let g = `<path d="M ${gx - R} ${gy} A ${R} ${R} 0 0 1 ${gx + R} ${gy}" fill="none" stroke="${C.steel}" stroke-width="10" stroke-linecap="round" opacity=".5"/>`;
      g += `<path d="M ${gx - R} ${gy} A ${R} ${R} 0 0 1 ${f1(gx + R * Math.cos(ang(9000)))} ${f1(gy - R * Math.sin(ang(9000)))}" fill="none" stroke="${C.coral}" stroke-width="10" stroke-linecap="round" opacity=".55"/>`;
      [0, 5000, 10000].forEach((ft) => { const a = ang(ft); g += `<text x="${f1(gx + (R + 18) * Math.cos(a))}" y="${f1(gy - (R + 18) * Math.sin(a) + 4)}" font-size="10" font-weight="600" text-anchor="middle" fill="var(--illus-ink)">${ft / 1000}k</text>`; });
      [[0, C.blue], [9000, C.coral]].forEach(([ft, col]) => { const a = ang(ft); g += `<line x1="${gx}" y1="${gy}" x2="${f1(gx + (R - 8) * Math.cos(a))}" y2="${f1(gy - (R - 8) * Math.sin(a))}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`; });
      g += `<circle cx="${gx}" cy="${gy}" r="5" fill="${C.ink}"/><text x="${gx}" y="${gy + 22}" font-size="12" font-weight="700" text-anchor="middle" fill="var(--illus-ink)">Density altitude (ft)</text>`;
      s.raw(g);
      lab(s, hz(200, -6, 150), 'Sea level · 59°F · 29.92 inHg', { dx: -150, dy: -40, n: 1, color: C.blue });
      lab(s, hz(200, 26, 40), 'DA 0 ft → 8.8 mil @ 1,000 yd', { dx: -150, dy: 54, n: '↑', color: C.blue });
      lab(s, [mc[0], mc[1], 270], '6,000 ft · 85°F · 23.98 inHg station', { dx: -120, dy: -16, n: 2, color: C.coral });
      lab(s, [mc[0] + 30, mc[1] + 30, 150], 'DA ≈ 9,000 ft → 7.8 mil (−24% air)', { dx: 30, dy: 120, n: '↓', color: C.coral });
      return s.svg();
    },
  });

  // Wind 1: crosswind across the range, drift growing downrange
  ISO.lesson('wind', {
    caption: '<b>Crosswind pushes the bullet sideways, more and more.</b> Wind from 3 o\'clock is full value. The drift grows with lag time, so most of it happens in the second half of the flight; see the bullet\'s ground track curve away from the aim line.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [150, 100], scale: 3.3 });
      s.floor(-8, -24, 140, 58, { grid: 8 });
      const rose = [16, 24];
      s.disc(rose[0], rose[1], 0.05, 10, { fill: C.white, stroke: C.steel, width: 1.5 });
      for (let h = 1; h <= 12; h++) {
        const th = h * Math.PI / 6;
        const p = [rose[0] + Math.cos(th) * 8.2, rose[1] - Math.sin(th) * 8.2, 0.1];
        s.text3(p, String(h), { anchor: 'middle', dy: 4, size: h % 3 ? 9 : 12, weight: h % 3 ? 500 : 800, color: h === 3 ? C.coral : 'var(--illus-ink)' });
      }
      s.line([[rose[0] + 0.5, rose[1] - 13, 0.2], [rose[0] + 0.5, rose[1] - 2.5, 0.2]], { color: C.coral, width: 3, arrow: true });
      s.line([[rose[0] + 10.5, rose[1], 0.2], [rose[0] + 15, rose[1], 0.2]], { color: C.ink, width: 2, arrow: true });
      P.mat(s, -2, -6, 58, 12, { color: C.teal });
      const rf = P.rifle(s, 0, 0, 0.4, { bag: true });
      P.flag(s, 70, -20, 18, 1, { color: C.coral });
      P.flag(s, 104, -20, 18, 1, { color: C.coral });
      const tx = 128, tz = 0;
      const plate = P.plate(s, tx, 0, tz, 3.6);
      const m = rf.muzzle, drift = 5.2;
      const path = (t) => [m[0] + (tx - m[0]) * t, drift * t * t * (0.6 + 0.4 * t), m[2] + (plate.center[2] - m[2]) * t + 3.2 * Math.sin(Math.PI * t)];
      // ground tracks: aim line vs actual
      s.line([[m[0], 0, 0.1], [tx, 0, 0.1]], { color: C.slate, width: 2, dash: '5 5' });
      s.curve((t) => { const p = path(t); return [p[0], p[1], 0.1]; }, 0, 1, { color: C.coral, width: 2, opacity: 0.55 });
      s.line([m, plate.center], { color: C.blue, width: 2, dash: '6 6' });
      s.curve(path, 0, 1, { color: C.coral, width: 3, samples: 50 });
      [60, 84, 108].forEach((x) => s.line([[x, -22, 11], [x, 12, 11]], { color: C.teal, width: 3, arrow: true, arrowSize: 10 }));
      [50, 92].forEach((x) => s.line([[x, -22, 5], [x, 6, 5]], { color: C.teal, width: 2, arrow: true, opacity: 0.6 }));
      const end = path(1);
      dot(s, end, 4.5, C.coral, { stroke: '#fff', sw: 1.5 });
      s.line([[tx, 0, 0.1], [tx, end[1], 0.1]], { color: C.amber, width: 3 });
      pin(s, [108, -14, 11], 'Crosswind from 3 o\'clock (full value)', 300, 30, { n: 1, color: C.teal });
      pin(s, [tx, end[1] * 0.5, 0.1], 'Drift = crosswind × lag time', 700, 350, { n: 2, color: C.amber });
      pin(s, [rose[0], rose[1] + 9, 0.1], 'Clock: target = 12', 20, 350, { n: 3, color: C.coral });
      pin(s, [70, -20, 18], 'Flags show it', 270, 70, { n: 4, color: C.slate });
      pin(s, [m[0] + 30, path(0.4)[1], path(0.4)[2]], 'Aim line vs bullet path', 20, 250, { n: 5, color: C.blue });
      return s.svg();
    },
  });

  // Wind 2: wind value from the clock
  ISO.lesson('wind', {
    at: 'after:table',
    caption: '<b>Only the sideways part counts.</b> Split each wind into a crosswind (coral) and a head/tail part (grey). Crosswind = wind × |sin(clock × 30°)|: 3 o\'clock is full value, 2 o\'clock ≈ 0.87 (treat as full), 1 o\'clock is half.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 260, origin: [0, 118], scale: 1 });
      const Rr = 62, k = Math.SQRT1_2;
      const Dh = [k, -k], Rt = [-k, -k];
      [[3, 130], [2, 360], [1, 590]].forEach(([hr, d]) => {
        const c = hz(d, 0, 0);
        const at = (h, rr) => { const th = h * Math.PI / 6; return [c[0] + rr * (Math.cos(th) * Dh[0] + Math.sin(th) * Rt[0]), c[1] + rr * (Math.cos(th) * Dh[1] + Math.sin(th) * Rt[1]), 0]; };
        s.shadow(c[0] - 50, c[1] - 50, 100, 100, { opacity: 0.1 });
        s.disc(c[0], c[1], 0, Rr + 8, { fill: 'var(--illus-floor)', stroke: C.steel, width: 1.5 });
        for (let h = 1; h <= 12; h++) s.text3(at(h, Rr - 4), String(h), { anchor: 'middle', dy: 4, size: h % 3 ? 9 : 12, weight: h % 3 ? 500 : 800, color: h === hr ? C.amber : 'var(--illus-ink)' });
        s.line([c, at(12, Rr - 18)], { color: C.ink, width: 1.5, dash: '3 4', opacity: 0.6 });
        const th = hr * Math.PI / 6, sv = Math.sin(th), cv = Math.cos(th);
        const src = at(hr, Rr - 16);
        s.line([src, [c[0], c[1], 0]], { color: C.amber, width: 4, arrow: true, arrowSize: 11 });
        // components of the wind vector (toward -hour direction)
        const L = Rr - 16;
        const cross = [c[0] - L * sv * Rt[0], c[1] - L * sv * Rt[1], 0];
        const head = [c[0] - L * cv * Dh[0], c[1] - L * cv * Dh[1], 0];
        if (Math.abs(cv) > 0.05) s.line([c, head], { color: C.slate, width: 2.5, dash: '4 3', arrow: true });
        s.line([c, cross], { color: C.coral, width: 4, arrow: true, arrowSize: 11 });
        dot(s, c, 4, C.ink);
        const val = Math.abs(sv);
        s.text(d, 222, hr + ' o\'clock', { anchor: 'middle', size: 14, weight: 800 });
        s.text(d, 241, 'value ' + (val > 0.99 ? '1.0 · full' : val > 0.8 ? val.toFixed(2) + ' · near full' : val.toFixed(1) + ' · half'), { anchor: 'middle', size: 12, color: C.coral, weight: 700 });
      });
      s.text(20, 26, 'Top view · you at the centre · 12 = the target (downrange →)', { size: 12, weight: 600 });
      return s.svg();
    },
  });

  ISO.lesson('stability', {
    caption: '<b>Spin keeps the nose forward.</b> The rifling twist spins the bullet like a gyroscope. A fast enough twist for its length (A, 1:8 → Sg ≈ 1.6) flies point-first; the same long bullet from a slow 1:12 twist (B, Sg ≈ 0.7) is overpowered by the air and tumbles.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 400, origin: [236, 84], scale: 6.6 });
      s.floor(-3, -5, 63, 37, { grid: 4 });
      const z = 5;
      const lanes = [{ y: 0, pitch: 4, tag: 'A' }, { y: 15, pitch: 7, tag: 'B' }];
      lanes.forEach((ln, li) => {
        const y = ln.y;
        s.shadow(0, y - 2, 12, 4);
        s.lathe(0, y, z, [[0, 1.9], [12, 1.9]], { axis: 'x', color: C.gunmetal, capColor: C.black });
        s.disc(12, y, z, 1.05, { plane: 'yz', fill: C.black });
        // visible rifling helix stripes
        for (let off = 0; off < 1; off += 1 / 3) {
          let seg = [];
          const flush = () => { if (seg.length > 1) s.line(seg, { color: C.amber, width: 2 }); seg = []; };
          for (let i = 0; i <= 120; i++) {
            const x = i / 10, ph = 2 * Math.PI * (x / ln.pitch + off);
            const cy = Math.cos(ph), cz = Math.sin(ph);
            if (cy + cz > 0.15) seg.push([x, y + 1.92 * cy, z + 1.92 * cz]); else flush();
          }
          flush();
        }
        if (li === 0) {
          [18, 31, 44].forEach((x, k) => {
            s.shadow(x, y - 1, 5.5, 2, { opacity: 0.08 });
            bulletAxis(s, x, y, z, 1, 'vld', 'x', 1);
            s.disc(x + 2.2, y, z, 1.7, { plane: 'yz', stroke: C.green, width: 2 });
            const a = s.P([x + 2.2, y + 1.7 * Math.cos(2.2), z + 1.7 * Math.sin(2.2)]);
            s.raw(`<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="3.4" fill="${C.green}"/>`);
          });
          s.line([[13, y, z], [58, y, z]], { color: C.green, width: 1.5, dash: '3 5' });
        } else {
          bulletAxis(s, 17, y, z, 1, 'vld', 'x', 1);
          bulletAxis(s, 30, y, z - 2.5, 1, 'vld', 'z', 1);
          bulletAxis(s, 44, y, z, 1, 'vld', 'x', -1);
          bulletAxis(s, 54, y, z + 2.8, 1, 'vld', 'z', -1);
          s.curve((t) => [17 + 40 * t, y, z + 4.8 + Math.sin(t * Math.PI * 3) * 1.2], 0, 1, { color: C.coral, width: 2, dash: '4 4', arrow: true, samples: 40 });
        }
      });
      // Sg gauge on the floor
      const gy = 26, k = 20, x0 = 4;
      [[0, 1.0, C.coral], [1.0, 1.4, C.amber], [1.4, 2.4, C.green]].forEach(([a, b, col]) => s.box(x0 + a * k, gy, 0, (b - a) * k, 3, 0.8, { color: col }));
      [[1.0, '1.0'], [1.4, '1.4'], [2.4, 'Sg 2.4']].forEach(([v, t]) => s.text3([x0 + v * k, gy + 3, 0], t, { anchor: 'middle', dy: 16, size: 11, weight: 700 }));
      [[1.59, 'A', C.green], [0.71, 'B', C.coral]].forEach(([v, t, col]) => {
        const x = x0 + v * k;
        s.lathe(x, gy + 1.5, 0.8, [[0, 1], [2.6, 0.05]], { axis: 'z', color: col, segments: 14 });
        s.text3([x, gy + 1.5, 3.6], t, { anchor: 'middle', dy: -2, size: 13, weight: 800, color: col });
      });
      pin(s, [3, 0, z + 1.9], 'A · 1:8 twist (fast)', 20, 30, { n: 'A', color: C.green });
      pin(s, [33, 0, z + 1], 'Spins like a gyroscope: nose-first', 470, 40, { n: 1, color: C.green });
      pin(s, [3, 15, z + 1.9], 'B · 1:12 twist (slow)', 20, 150, { n: 'B', color: C.coral });
      pin(s, [44, 15, z + 1], 'Under-spun: tumbles', 560, 250, { n: 2, color: C.coral });
      pin(s, [x0 + 2.0 * k, gy + 3, 0.8], 'Sg: < 1.0 unstable · 1.0–1.4 marginal · > 1.4 good', 700, 384, { n: 'Sg', color: C.slate, size: 11 });
      return s.svg();
    },
  });

  ISO.lesson('small-effects', {
    caption: '<b>Three small pushes.</b> Right-twist spin drift curves the bullet right, more with time of flight. In the northern hemisphere Coriolis deflects every shot right. A crosswind at the muzzle tips a right-twist bullet: wind from the left throws it high (from the right, low).',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 330, origin: [128, 170], scale: 6 });
      const off = (k) => [k * 22, -k * 22];
      // A · spin drift (top-down on the floor; shooter's right = -y)
      {
        const [ox, oy] = off(0);
        s.floor(ox - 12, oy - 8, 24, 16, { grid: 4 });
        s.line([[ox - 11, oy + 3, 0.1], [ox + 13, oy + 3, 0.1]], { color: C.slate, width: 2, dash: '5 5' });
        const p = (t) => [ox - 11 + 24 * t, oy + 3 - 7 * Math.pow(t, 2.2), 0.2];
        s.curve(p, 0, 1, { color: C.coral, width: 3, arrow: true, samples: 30 });
        bulletAxis(s, ox - 11, oy + 3, 1.2, 0.9, 'otm', 'x', 1);
        s.disc(ox - 9, oy + 3, 1.2, 1.6, { plane: 'yz', stroke: C.green, width: 2 });
        s.text(128, 34, 'SPIN DRIFT', { anchor: 'middle', size: 14, weight: 800 });
        pin(s, p(1), 'Right twist → drifts right', 20, 300, { n: 1, color: C.coral, size: 11 });
      }
      // B · Coriolis globe
      {
        const [ox, oy] = off(1);
        const R = 8.5, cz = 10;
        s.shadow(ox - 7, oy - 7, 14, 14);
        s.sphere(ox, oy, cz, R, { color: C.sky, rings: 12, segments: 22 });
        const sp = (lat, lon, rr) => { rr = rr || R + 0.05; const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [ox + rr * Math.cos(la) * Math.cos(lo), oy + rr * Math.cos(la) * Math.sin(lo), cz + rr * Math.sin(la)]; };
        s.curve((lo) => sp(0, lo), -50, 140, { color: C.blue, width: 1.6, samples: 30, opacity: 0.8 });
        s.line([sp(90, 0, R + 4), sp(90, 0, R)], { color: C.ink, width: 2 });
        s.curve((u) => [ox + 3.4 * Math.cos(u), oy + 3.4 * Math.sin(u), cz + R + 2.6], -0.6, 3.6, { color: C.ink, width: 2, arrow: true, samples: 20 });
        s.curve((t) => sp(12 + 46 * t, 45), 0, 1, { color: C.white, width: 2, dash: '3 3', samples: 16 });
        s.curve((t) => sp(12 + 46 * t, 45 + 30 * t * t), 0, 1, { color: C.coral, width: 3, arrow: true, samples: 20 });
        s.text(356, 34, 'CORIOLIS', { anchor: 'middle', size: 14, weight: 800 });
        pin(s, sp(58, 75), 'North: always right', 300, 62, { n: 2, color: C.coral, size: 11 });
        pin(s, sp(-30, 45), 'South: left', 300, 300, { n: 'S', color: C.slate, size: 11 });
      }
      // C · aerodynamic jump (wind from the shooter's left = +y)
      {
        const [ox, oy] = off(2);
        s.floor(ox - 12, oy - 8, 24, 16, { grid: 4 });
        const z = 4;
        s.lathe(ox - 14, oy, z, [[0, 0.75], [9, 0.6]], { axis: 'x', color: C.gunmetal });
        s.lathe(ox - 5, oy, z, [[0, 0.8], [2, 0.8]], { axis: 'x', color: C.black });
        s.line([[ox - 3, oy, z], [ox + 13, oy, z]], { color: C.slate, width: 2, dash: '5 5' });
        s.curve((t) => [ox - 3 + 16 * t, oy, z + 3.4 * t], 0, 1, { color: C.coral, width: 3, arrow: true });
        [-6, 0, 6].forEach((x) => s.line([[ox + x, oy + 8, z + 1], [ox + x, oy + 3, z + 1]], { color: C.teal, width: 2.5, arrow: true }));
        s.text(584, 34, 'AERO JUMP', { anchor: 'middle', size: 14, weight: 800 });
        pin(s, [ox + 13, oy, z + 3.4], 'Wind from left → high', 700, 62, { n: 3, color: C.coral, size: 11 });
        pin(s, [ox - 6, oy + 6, z + 1], 'Crosswind at the muzzle', 700, 300, { n: '~', color: C.teal, size: 11 });
      }
      return s.svg();
    },
  });

  // =====================================================================
  // m-equipment lessons
  // =====================================================================

  ISO.lesson('kit-priorities', {
    caption: '<b>Buy in tiers.</b> Laid out in the order that removes the biggest error first: safety (0), a rifle under a scope that tracks (1), support (2), measurement (3), then refinement (4).',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 420, origin: [338, 22], scale: 6 });
      const tiers = [C.coral, C.blue, C.green, C.purple, C.amber];
      const names = ['Safety', 'Rifle + scope', 'Support', 'Measurement', 'Refinement'];
      tiers.forEach((col, i) => s.floor(0, i * 10 + 0.6, 64, 8.8, { color: col + '30' }));
      // 0 · safety: glasses, ear muffs, chamber flag
      let y = 5;
      s.disc(40, y - 1.4, 0.4, 1.8, { fill: C.sky, stroke: C.ink, width: 2 });
      s.disc(40, y + 1.4, 0.4, 1.8, { fill: C.sky, stroke: C.ink, width: 2 });
      s.line([[40, y - 3.2, 0.4], [35, y - 3.4, 0.4]], { color: C.ink, width: 2 });
      s.line([[40, y + 3.2, 0.4], [35, y + 3.4, 0.4]], { color: C.ink, width: 2 });
      s.shadow(47, y - 4, 6, 8);
      s.curve((t) => [50, y + 3 * Math.cos(t), 2.2 + 3.4 * Math.sin(t)], 0, Math.PI, { color: C.ink, width: 4, samples: 14 });
      s.lathe(50, y - 3.2, 2.2, [[0, 2.2], [1.6, 2.2]], { axis: 'y', color: C.amber });
      s.lathe(50, y + 1.6, 2.2, [[0, 2.2], [1.6, 2.2]], { axis: 'y', color: C.amber });
      s.box(56, y - 0.6, 0, 6, 1.2, 0.4, { color: C.amber });
      s.box(56, y - 2, 0, 2.2, 4, 0.6, { color: C.coral });
      // 1 · rifle + scope + torque wrench
      y = 15;
      s.shadow(1, y - 3, 54, 6);
      const r = P.rifle(s, 1, y, 0, { bipod: false });
      s.lathe(56.5, y + 2, 0.6, [[0, 0.5], [6, 0.35]], { axis: 'x', color: C.steel });
      s.box(62.3, y + 1.2, 0.1, 1.4, 1.6, 1.1, { color: C.gunmetal });
      // 2 · support: bipod, rear bag, level
      y = 25;
      s.box(4, y - 1, 0, 3, 2, 1.6, { color: C.gunmetal });
      s.line([[7, y - 0.5, 0.8], [17, y - 1.2, 0.5]], { color: C.gunmetal, width: 3 });
      s.line([[7, y + 0.5, 0.8], [17, y + 1.2, 0.5]], { color: C.gunmetal, width: 3 });
      s.shadow(24, y - 3, 10, 6);
      s.extrude([[0, 0], [10, 0], [9, 3.2], [1, 3.2]], -2.6, 5.2, { plane: 'xz', at: [24, y, 0], color: C.sand });
      s.box(42, y - 1.2, 0, 4, 2.4, 1.4, { color: C.ink });
      s.disc(44, y, 1.45, 0.8, { fill: C.green });
      // 3 · measurement: Doppler chronograph, rangefinder, phone
      y = 35;
      s.shadow(4, y - 3, 7, 6); s.box(4, y - 3, 0, 6, 6, 1.6, { color: C.ink, top: C.gunmetal });
      s.disc(7, y, 1.65, 1.6, { fill: C.sky });
      s.shadow(18, y - 2, 8, 5); s.box(18, y - 2, 0, 7, 4.5, 3, { color: C.gunmetal });
      s.lathe(25, y - 0.9, 1.6, [[0, 1], [0.6, 1]], { axis: 'x', color: C.black });
      s.lathe(25, y + 1.3, 1.6, [[0, 1], [0.6, 1]], { axis: 'x', color: C.black });
      s.box(34, y - 2.2, 0, 7.5, 4, 0.5, { color: C.ink, top: C.blue });
      // 4 · refinement: weather meter, barricade bag, tripod, suppressor
      y = 45;
      s.box(4, y - 1, 0, 8, 2.4, 0.8, { color: C.amber });
      s.disc(10, y + 0.2, 0.85, 0.8, { fill: C.ink });
      s.shadow(16, y - 3, 12, 6);
      s.extrude([[0, 0], [12, 0], [12, 3.6], [0, 3.6]], -3, 6, { plane: 'xz', at: [16, y, 0], color: C.green });
      s.box(19, y - 3.05, 1.5, 0.6, 6.1, 0.6, { color: C.ink });
      s.box(24.5, y - 3.05, 1.5, 0.6, 6.1, 0.6, { color: C.ink });
      [[-1.2, 0], [0, 0], [1.2, 0]].forEach(([dy]) => s.line([[33, y + dy, 0.6], [46, y + dy * 0.4, 0.6]], { color: C.slate, width: 3 }));
      s.box(31.4, y - 1.3, 0, 2, 2.6, 1.4, { color: C.ink });
      s.lathe(50, y, 1.1, [[0, 1.1], [9, 1.1]], { axis: 'x', color: C.gunmetal, capColor: C.black });
      names.forEach((n, i) => lab(s, [0, i * 10 + 5, 0], n, { dx: -24, dy: -12, n: i, color: tiers[i] }));
      lab(s, r.scope, 'Scope that tracks = best buy', { dx: 40, dy: -16, n: '★', color: C.amber });
      return s.svg();
    },
  });

  ISO.lesson('optics-gear', {
    caption: '<b>A scope is a measuring instrument.</b> Matched MIL turrets with 0.1 mil clicks and a zero stop, a 34–35 mm tube for travel, parallax adjustment, and a mount that never moves: torqued rings on a canted base plus a bubble level.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [170, 112], scale: 21 });
      s.floor(-1.5, -4, 21, 8, { grid: 1 });
      s.shadow(0, -1.2, 18, 2.4);
      // base rail, taller at the rear (canted ≈6 mil) + rings
      s.extrude([[0, 0], [17, 0], [17, 0.35], [0, 0.55]], -0.55, 1.1, { plane: 'xz', at: [0.2, 0, 0], color: C.gunmetal });
      const zc = 2.5, TE = 9.6;
      [6.9, 12.1].forEach((x) => {
        s.box(x, -0.5, 0.4, 1.2, 1, zc - 0.6, { color: C.black });
        s.lathe(x, 0, zc, [[0, 0.84], [1.2, 0.84]], { axis: 'x', color: C.black });
      });
      // scope body along +x: eyepiece (rear) → power ring → tube → objective bell (front)
      const fwd = [[0, 1.25], [2.6, 1.25], [3.8, 0.66], [10.5, 0.66], [11.2, 0.95], [12.8, 0.95], [13.1, 0.82], [15.2, 0.82], [15.4, 0.95], [17.2, 0.98]];
      const prof = fwd.map(([t, r]) => [17.2 - t, r]).reverse();
      const cols = [C.ink, C.ink, C.ink, C.ink, C.blue, C.ink, C.ink, C.ink, C.ink].reverse();
      s.lathe(0, 0, zc, prof, { axis: 'x', color: C.ink, colors: cols, capColor: C.sky });
      for (let k = 0; k < 5; k++) s.lathe(4.65 + k * 0.28, 0, zc, [[0, 0.98], [0.12, 0.98]], { axis: 'x', color: C.blue, segments: 22 });
      // turrets: elevation on top, windage on the right (-y), parallax on the left (+y)
      s.lathe(TE, 0, zc + 0.6, [[0, 0.75], [0.6, 0.75], [0.6, 0.95], [1.5, 0.95]], { axis: 'z', color: C.amber, segments: 24 });
      s.lathe(TE, 0, zc + 2.1, [[0, 0.95], [0.12, 0.0]], { axis: 'z', color: C.amber });
      s.lathe(TE, -0.6, zc, [[-0.9, 0.6], [0, 0.6]], { axis: 'y', color: C.steel });
      s.lathe(TE, 0.6, zc, [[0, 0.62], [0.5, 0.62], [0.5, 0.95], [1.1, 0.95]], { axis: 'y', color: C.gunmetal });
      // bubble level on the tube behind the turret
      s.box(6.0, -0.5, zc + 0.62, 0.8, 1, 0.5, { color: C.black });
      s.disc(6.4, 0, zc + 1.14, 0.3, { fill: C.green });
      pin(s, [5.3, 0.98, zc], 'Magnification ring · 4–25×', 20, 250, { n: 1 });
      pin(s, [TE, 0, zc + 2.2], 'Elevation: 0.1 mil clicks, zero stop', 330, 30, { n: 2, color: C.amber });
      pin(s, [TE, -1.5, zc], 'Windage (right side)', 560, 76, { n: 3, color: C.slate });
      pin(s, [TE, 1.7, zc], 'Parallax / side focus', 20, 300, { n: 4, color: C.blue });
      pin(s, [11.5, 0.66, zc + 0.3], '34–35 mm tube: more travel', 690, 250, { n: 5, color: C.purple });
      pin(s, [13.3, 0.5, 1.4], 'Rings on a canted (≈6 mil) base, torqued', 330, 352, { n: 6, color: C.slate });
      pin(s, [6.4, 0, zc + 1.2], 'Bubble level: no cant', 20, 76, { n: 7, color: C.green });
      pin(s, [17.2, 0.6, zc + 0.6], 'FFP MIL reticle · MIL turrets', 700, 300, { n: 8, color: C.coral });
      return s.svg();
    },
  });

  ISO.lesson('measure', {
    caption: '<b>Every number on the card is measured.</b> A Doppler chronograph tracks the bullet to give MV and its spread (SD, ES); a laser rangefinder gives line-of-sight range; a weather meter reads temperature, station pressure and DA, and the wind only where you stand.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 390, origin: [125, 92], scale: 4.2 });
      s.floor(-6, -28, 124, 50, { grid: 10 });
      P.mat(s, -2, -6, 58, 12, { color: C.teal });
      const rf = P.rifle(s, 0, 0, 0.4, { bag: true });
      // 1 · Doppler chronograph beside the muzzle, beam downrange
      const cx = 46, cy = -10;
      s.shadow(cx, cy - 2, 6, 5);
      s.box(cx, cy - 2, 0, 5, 4, 3.2, { color: C.ink, top: C.gunmetal });
      s.poly([[cx + 5.05, cy - 1.5, 0.6], [cx + 5.05, cy + 1.5, 0.6], [cx + 5.05, cy + 1.5, 2.8], [cx + 5.05, cy - 1.5, 2.8]], { fill: C.sky });
      s.poly([[cx + 5, cy, 1.7], [cx + 70, cy - 9, 9], [cx + 70, cy + 9, 18]], { fill: C.sky, opacity: 0.32 });
      for (let k = 1; k < 4; k++) s.curve((t) => [cx + 5 + k * 9, cy + (t - 0.5) * k * 1.6, 1.7 + k * 1.1 + (t - 0.5) * k * 1.6], 0, 1, { color: C.blue, width: 2, samples: 6, opacity: 0.8 });
      // bullet in flight
      bulletAxis(s, 82, 0, 7.7, 0.6, 'otm', 'x', 1);
      // 2 · rangefinder on the right of the mat, laser to the plate
      const tx = 112, ty = -22;
      const pl = P.plate(s, tx, ty, 0, 3.2);
      const lx = 20, ly = 12, lz = 0;
      s.shadow(lx, ly - 1, 7, 4);
      s.box(lx, ly - 1, lz, 6, 3.6, 3.2, { color: C.gunmetal });
      s.lathe(lx + 6, ly + 0, 2, [[0, 0.8], [0.6, 0.8]], { axis: 'x', color: C.black });
      s.lathe(lx + 6, ly + 2, 2, [[0, 0.8], [0.6, 0.8]], { axis: 'x', color: C.black });
      s.line([[lx + 6.6, ly + 1, 2], pl.center], { color: C.red, width: 1.8 });
      dot(s, pl.center, 4, C.red, { op: 0.8 });
      // 3 · weather meter with impeller, wind past it
      const wx = 2, wy = 16;
      s.shadow(wx, wy, 3, 2);
      s.box(wx, wy, 0, 2.4, 1.2, 9, { color: C.amber });
      s.disc(wx + 1.2, wy + 0.6, 10.5, 1.4, { plane: 'xz', fill: C.ink });
      s.poly([[wx + 0.4, wy + 1.22, 3], [wx + 2, wy + 1.22, 3], [wx + 2, wy + 1.22, 7], [wx + 0.4, wy + 1.22, 7]], { fill: C.mint });
      [8, 11.5].forEach((z) => s.line([[wx - 10, wy - 9, z], [wx + 8, wy + 9, z]].map(([x, y, zz]) => [x + 2, y - 10 + 10, zz]), { color: C.teal, width: 2.4, arrow: true }));
      pin(s, [cx + 2.5, cy, 3.2], 'Doppler chronograph → MV, SD, ES', 330, 40, { n: 1, color: C.blue });
      pin(s, [lx + 3, ly + 1, 3.2], 'Laser rangefinder → line-of-sight range', 330, 350, { n: 2, color: C.red });
      pin(s, [wx + 1.2, wy + 0.6, 7], 'Weather meter → temp, pressure, DA, wind here', 20, 300, { n: 3, color: C.amber });
      return s.svg();
    },
  });

  ISO.lesson('support', {
    caption: '<b>Stability is precision.</b> The dashed ring at each muzzle is the wobble you fight. Prone on a bipod with a rear bag is the smallest; a tripod with an ARCA clamp and a barricade bag make standing and prop positions steady enough to hit.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [60, 196], scale: 3.6 });
      const st = (k) => [k * 31, -k * 31];
      const wob = (m, r) => { s.disc(m[0] + 3, m[1], m[2], r, { plane: 'yz', stroke: C.coral, width: 2, dash: '4 3' }); dot(s, [m[0] + 3, m[1], m[2]], 2.5, C.coral); };
      // 1 · prone: bipod + rear bag on a mat
      {
        const [x, y] = st(0);
        s.floor(x - 6, y - 12, 66, 24, { grid: 8 });
        P.mat(s, x - 2, y - 6, 58, 12, { color: C.teal });
        const r = P.rifle(s, x, y, 0.4, { bag: true });
        wob(r.muzzle, 1.6);
        lab(s, r.bipod, 'Bipod: prone foundation', { dx: 20, dy: 70, n: 1, color: C.blue });
        lab(s, [x + 6, y, 3.6], 'Rear bag: squeeze to fine-tune', { dx: -40, dy: 100, n: 2, color: C.amber });
      }
      // 2 · tripod with ARCA clamp
      {
        const [x, y] = st(1);
        s.floor(x - 6, y - 12, 66, 24, { grid: 8 });
        const H = 26, hx = x + 27;
        s.shadow(hx - 7, y - 7, 14, 14);
        [[-7, -5], [-5, 7], [7, 0]].forEach(([dx, dy]) => s.line([[hx + dx, y + dy, 0], [hx, y, H - 1.5]], { color: C.slate, width: 3.5 }));
        s.box(hx - 1.5, y - 1.5, H - 2, 3, 3, 1.6, { color: C.ink });
        s.box(hx - 3, y - 1.2, H - 0.4, 6, 2.4, 0.8, { color: C.gunmetal });
        const r = P.rifle(s, x, y, H - 3.4 + 0.4, { bipod: false });
        wob(r.muzzle, 3);
        lab(s, [hx, y, H - 1], 'Tripod + ARCA clamp', { dx: 40, dy: -70, n: 3, color: C.purple });
      }
      // 3 · barricade with a bag
      {
        const [x, y] = st(2);
        s.floor(x - 6, y - 12, 66, 24, { grid: 8 });
        const bx = x + 28, H = 22;
        s.shadow(bx - 2, y - 9, 6, 18);
        s.box(bx - 1, y - 8, 0, 3, 3, H, { color: C.wood });
        s.box(bx - 1, y + 5, 0, 3, 3, H, { color: C.wood });
        s.box(bx - 1, y - 8, H, 3, 16, 2, { color: sh(C.wood, 0.15) });
        s.extrude([[0, 0], [7, 0], [6.2, 3], [0.8, 3]], -2.6, 5.2, { plane: 'xz', at: [bx - 2.2, y, H + 2], color: C.green });
        const r = P.rifle(s, x, y, H + 2 + 3 - 3.4, { bipod: false });
        wob(r.muzzle, 2.2);
        lab(s, [bx + 1, y + 2.6, H + 4], 'Barricade bag', { dx: 30, dy: 90, n: 4, color: C.green });
      }
      lab(s, [st(0)[0] + 56, st(0)[1], 7.3], 'Wobble', { dx: 20, dy: -70, n: '◌', color: C.coral });
      return s.svg();
    },
  });
})();
