/*
 * Shared isometric parts + reference illustrations.
 *
 * Conventions for every scene in js/illus/*.js:
 *  - Shooting direction is +x (down-right on screen). Rifles, bullets and
 *    cartridges lie along x with the muzzle / nose at higher x.
 *  - Rifle-scale scenes use 1 unit = 1 inch; range-scale scenes are schematic.
 *  - Paint back to front: farther (lower x + y, lower z) first.
 *  - Use ISO.C palette colours; labels via s.label(..., { n }) for numbered callouts.
 */
(function () {
  'use strict';
  const ISO = window.ISO;
  const C = ISO.C;

  // --------------------------------------------------------------- parts

  const parts = {};

  /*
   * Precision bolt rifle lying along +x. Butt at x, centreline at y.
   * z is the ground under the bipod feet. ~50 units long, ~10 tall.
   * opts: { stock, metal, scope, bipod (true), bag (false), brake (true), explode (0) }
   */
  parts.rifle = function (s, x, y, z, o) {
    o = Object.assign({ stock: C.slate, metal: C.gunmetal, scope: C.ink, bipod: true, bag: false, brake: true, explode: 0 }, o || {});
    const e = o.explode; // lift parts apart for exploded views
    const zb = z + 3.4;   // bottom of the forend
    const axisZ = zb + 3.5; // bore line height
    if (o.bag) {
      s.shadow(x + 3, y - 2.5, 6, 5);
      s.extrude([[0, 0], [7, 0], [6.3, 3.2], [0.7, 3.2]], -2.2, 4.4, { plane: 'xz', at: [x + 2.5, y, z], color: C.sand });
    }
    if (o.bipod) s.line([[x + 33, y - 0.6, zb], [x + 31, y - 3.2, z]], { color: o.metal, width: 3.5 });
    // stock / chassis
    s.extrude([[0, 1.2], [12, 2.6], [14.5, 0.2], [17.5, 0.2], [18.5, 3.4], [36, 3.4], [36, 6], [19, 6.1], [15, 6.2], [0.4, 6]], -1, 2, { plane: 'xz', at: [x + 1, y, zb - 3.4 + (e ? -e : 0)], color: o.stock });
    s.box(x, y - 1.05, zb - 2.1 + (e ? -e : 0), 1.2, 2.1, 5.6, { color: C.black }); // butt pad
    s.box(x + 5, y - 0.8, zb + 2.6 + (e ? -e * 0.5 : 0), 8, 1.6, 1.1, { color: shadeC(o.stock, -0.15) }); // cheek riser
    // magazine + trigger
    s.box(x + 20, y - 0.7, zb - 2.2 - e * 1.4, 2.6, 1.4, 2.4, { color: C.black });
    s.extrude([[0, 0], [0.5, 0], [0.9, 1.8], [0.4, 1.8]], -0.25, 0.5, { plane: 'xz', at: [x + 17.2, y, zb - 1.2 - e * 0.6], color: C.ink });
    // action + bolt
    s.lathe(x + 15.5, y, axisZ + e, [[0, 0.8], [11, 0.8]], { axis: 'x', color: o.metal });
    s.lathe(x + 18.3, y + 0.6, axisZ - 0.2 + e * 1.6, [[0, 0.22], [2.2, 0.22], [2.25, 0.55], [2.9, 0.55], [3.1, 0]], { axis: 'y', color: C.steel });
    // barrel + brake
    s.lathe(x + 26.5, y, axisZ + e * 0.4, [[0, 0.62], [3, 0.58], [24, 0.42]], { axis: 'x', color: o.metal });
    if (o.brake) s.lathe(x + 50.5 + e * 2, y, axisZ + e * 0.4, [[0, 0.6], [2.8, 0.6]], { axis: 'x', color: C.black, colors: [C.black] });
    // rings + scope
    s.box(x + 17.4, y - 0.55, axisZ + 0.6 + e * 2, 1.1, 1.1, 1.3, { color: C.black });
    s.box(x + 24.4, y - 0.55, axisZ + 0.6 + e * 2, 1.1, 1.1, 1.3, { color: C.black });
    const sz = axisZ + 2.6 + e * 3;
    s.lathe(x + 13.5, y, sz, [[0, 0.95], [3, 0.95], [4.2, 0.6], [12.5, 0.6], [14, 1.05], [16.5, 1.1]], { axis: 'x', color: o.scope });
    s.lathe(x + 21, y, sz + 0.55, [[0, 0.62], [1.1, 0.62]], { axis: 'z', color: C.amber }); // elevation turret
    s.lathe(x + 21, y + 0.55, sz, [[0, 0.5], [0.9, 0.5]], { axis: 'y', color: C.steel });  // windage turret
    if (o.bipod) s.line([[x + 33, y + 0.6, zb], [x + 31, y + 3.2, z]], { color: o.metal, width: 3.5 });
    return { muzzle: [x + 53, y, axisZ + e * 0.4], scope: [x + 21, y, sz + 1.2], action: [x + 21, y, axisZ + e], stock: [x + 6, y + 1, zb + 1], grip: [x + 16, y + 1, zb - 1.5], mag: [x + 21, y + 0.7, zb - 1.6 - e * 1.4], barrel: [x + 38, y, axisZ + e * 0.4], bipod: [x + 31.5, y + 2.6, z + 1], butt: [x + 0.6, y + 1, zb], bolt: [x + 21.3, y + 3.7, axisZ - 0.2 + e * 1.6], trigger: [x + 17.9, y + 0.25, zb - 0.6 - e * 0.6], cheek: [x + 9, y + 0.8, zb + 3.7] };
  };

  function shadeC(c, a) { return ISO.shade(c, a); }

  /*
   * Bullet along +x, base at x. r = radius (scale by passing bigger numbers).
   * type: 'round' | 'minie' | 'flat' | 'fmj' | 'spitzer' | 'otm' | 'vld' | 'hybrid' | 'tip' | 'mono' | 'soft'
   */
  parts.bullet = function (s, x, y, z, r, type, o) {
    o = o || {};
    const col = o.color || (type === 'mono' ? C.copper : type === 'round' || type === 'minie' ? C.lead : C.copper);
    if (type === 'round') { s.sphere(x + r, y, z, r, { color: col }); return; }
    const shapes = {
      minie: { bt: 0, bear: 1.6, og: 1.4, p: 1.4, mep: 0.25 },
      flat: { bt: 0, bear: 1.4, og: 1.6, p: 1.6, mep: 0.35 },
      fmj: { bt: 0, bear: 1.5, og: 2.3, p: 1.8, mep: 0.14 },
      spitzer: { bt: 0, bear: 1.3, og: 2.9, p: 2.1, mep: 0.08 },
      otm: { bt: 0.8, bear: 1.6, og: 2.9, p: 2.2, mep: 0.1 },
      vld: { bt: 0.9, bear: 1.2, og: 3.6, p: 2.8, mep: 0.08 },
      hybrid: { bt: 0.9, bear: 1.5, og: 3.4, p: 2.5, mep: 0.08 },
      tip: { bt: 0.8, bear: 1.5, og: 3.0, p: 2.3, mep: 0.06, tip: true },
      mono: { bt: 0.9, bear: 2.0, og: 3.4, p: 2.5, mep: 0.08, grooves: true },
      soft: { bt: 0, bear: 1.6, og: 2.4, p: 1.9, mep: 0.3, softTip: true },
    };
    const sh = shapes[type] || shapes.otm;
    const prof = [];
    if (sh.bt) { prof.push([0, r * 0.72]); prof.push([sh.bt * r, r]); } else { prof.push([0, r * 0.94]); prof.push([0.12 * r, r]); }
    const b0 = (sh.bt || 0.12) * r, b1 = b0 + sh.bear * r;
    prof.push([b1, r]);
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const rr = Math.max(sh.mep * r, r * Math.pow(1 - t, 1 / sh.p) * (1 - t * 0.0));
      prof.push([b1 + t * sh.og * r, i === n ? sh.mep * r : rr]);
    }
    const colors = prof.slice(0, -1).map((p, i) => {
      if (sh.tip && i >= prof.length - 4) return C.red;
      if (sh.softTip && i >= prof.length - 4) return C.lead;
      if (sh.grooves && p[0] > b0 && p[0] < b1 && i % 2 === 1) return ISO.shade(col, -0.18);
      return col;
    });
    if (sh.grooves) { // add ring grooves on the bearing surface
      const g = [];
      prof.forEach((p) => g.push(p));
    }
    prof.push([b1 + sh.og * r + 0.01, 0]);
    colors.push(sh.tip ? C.red : sh.softTip ? C.lead : col);
    s.lathe(x, y, z, prof, { axis: 'x', color: col, colors, segments: o.segments || 26 });
    return { tip: [x + b1 + sh.og * r, y, z], base: [x, y, z], bearing: [x + (b0 + b1) / 2, y, z + r], ogive: [x + b1 + sh.og * r * 0.45, y, z + r * 0.8], boattail: [x + b0 * 0.5, y, z + r * 0.85], length: b1 + sh.og * r };
  };

  /*
   * Bottleneck centrefire cartridge along +x, head at x. k scales it (1 ≈ 6.5 Creedmoor at 8 px/unit... use 1 unit = 0.1").
   * opts: { k, bullet: 'otm', caseColor }
   */
  parts.cartridge = function (s, x, y, z, o) {
    o = Object.assign({ k: 1, bullet: 'otm', caseColor: C.brass }, o || {});
    const k = o.k;
    const R = 2.35 * k;
    const prof = [[0, R], [0.55 * k, R], [0.6 * k, R * 0.8], [1.3 * k, R * 0.8], [1.6 * k, R], [14.3 * k, R * 0.93], [15.6 * k, R * 0.63], [18.9 * k, R * 0.63]];
    s.lathe(x, y, z, prof, { axis: 'x', color: o.caseColor, capColor: ISO.shade(o.caseColor, -0.2) });
    const b = parts.bullet(s, x + 17.2 * k, y, z, R * 0.56, o.bullet, { color: o.bulletColor });
    return { head: [x + 0.2 * k, y, z + R], rim: [x + 1, y, z + R * 0.8], body: [x + 8 * k, y, z + R], shoulder: [x + 15 * k, y, z + R * 0.8], neck: [x + 17.5 * k, y, z + R * 0.63], bullet: b, length: 17.2 * k + b.length };
  };

  // Steel plate on a frame, facing back up-range (plate lies in the y-z plane)
  parts.plate = function (s, x, y, z, r, o) {
    o = o || {};
    const top = z + r * 2 + r * 1.2;
    s.line([[x, y - r * 1.5, z], [x, y - r * 1.5, top]], { color: C.wood, width: 3 });
    s.line([[x, y + r * 1.5, z], [x, y + r * 1.5, top]], { color: C.wood, width: 3 });
    s.line([[x, y - r * 1.5, top], [x, y + r * 1.5, top]], { color: C.wood, width: 3 });
    s.line([[x, y - r * 0.4, top], [x, y - r * 0.4, z + r * 2 + r]], { color: C.ink, width: 1.2 });
    s.line([[x, y + r * 0.4, top], [x, y + r * 0.4, z + r * 2 + r]], { color: C.ink, width: 1.2 });
    s.disc(x, y, z + r * 2, r, { plane: 'yz', fill: o.color || C.white, stroke: C.slate, width: 1.4 });
    if (o.hit) s.disc(x, y + r * 0.2, z + r * 2.1, r * 0.18, { plane: 'yz', fill: C.lead });
    return { center: [x, y, z + r * 2] };
  };

  // Earth berm along y (behind targets)
  parts.berm = function (s, x, y, len, h, o) {
    o = o || {};
    s.extrude([[0, 0], [h * 2.4, 0], [h * 1.6, h], [h * 0.6, h]], 0, len, { plane: 'xz', at: [x, y, 0], color: o.color || C.dirt, face: o.color || C.dirt });
  };

  // Low-poly tree
  parts.tree = function (s, x, y, h, o) {
    o = o || {};
    s.lathe(x, y, 0, [[0, h * 0.06], [h * 0.3, h * 0.05]], { axis: 'z', color: C.wood, segments: 10 });
    s.lathe(x, y, h * 0.25, [[0, h * 0.28], [h * 0.45, h * 0.12], [h * 0.75, 0]], { axis: 'z', color: o.color || C.grassDark, segments: 12 });
  };

  // Range flag; dir = -1 streams toward -y (wind from +y), +1 toward +y
  parts.flag = function (s, x, y, h, dir, o) {
    o = o || {};
    const len = o.len || h * 0.4;
    const droop = o.droop != null ? o.droop : 0.2;
    s.line([[x, y, 0], [x, y, h]], { color: C.slate, width: 2.5 });
    s.poly([[x, y, h], [x, y + dir * len, h - len * droop - h * 0.04], [x, y, h - h * 0.22]], { fill: o.color || C.coral, stroke: o.color || C.coral, width: 1 });
  };

  // Shooting mat (thin slab)
  parts.mat = function (s, x, y, w, d, o) {
    o = o || {};
    s.shadow(x, y, w, d, { opacity: 0.1 });
    s.box(x, y, 0, w, d, 0.4, { color: o.color || C.green });
  };

  // Small rounded "info chip" stack (e.g. data blocks)
  parts.chip = function (s, x, y, z, w, d, h, color) { s.box(x, y, z, w, d, h, { color }); };

  ISO.parts = parts;

  // ------------------------------------------------ reference illustrations

  // Course hero: a precision range from the firing line to 1,000 yd.
  // Downrange runs along (+x, -y), which is horizontal on screen — ideal for a wide banner.
  ISO.module('course', () => {
    const s = ISO.scene({ w: 960, h: 330, origin: [120, 150], scale: 3.3 });
    s.floor(-14, -150, 196, 166, { grid: 12 });
    [[60, -120], [95, -140], [130, -148], [165, -150], [40, -100], [150, -130]].forEach(([x, y]) => parts.tree(s, x, y, 20));
    parts.berm(s, 168, -142, 30, 10);
    const T = [[70, -56, 1.8, '300 yd'], [110, -92, 2.4, '600 yd'], [160, -128, 3, '1,000 yd']];
    parts.flag(s, 50, -40, 18, 1, { color: C.coral });
    parts.flag(s, 95, -82, 18, 1, { color: C.amber });
    parts.flag(s, 140, -118, 18, 1, { color: C.coral });
    T.forEach(([x, y, r]) => parts.plate(s, x, y, 0, r, { hit: x === 70 }));
    parts.mat(s, -4, -4, 42, 12, { color: C.green });
    const rf = parts.rifle(s, 0, 2, 0.4, { bag: true });
    const [tx, ty] = [160, -128];
    s.curve((t) => [rf.muzzle[0] + (tx - rf.muzzle[0]) * t, rf.muzzle[1] + (ty - rf.muzzle[1]) * t, rf.muzzle[2] + 34 * Math.sin(Math.PI * t) + (6 - rf.muzzle[2]) * t], 0, 1, { color: C.blue, width: 2.5, dash: '2 7', samples: 70 });
    T.forEach(([x, y, r, name]) => s.label([x, y, r * 3.2], name, { dx: 14, dy: -34 }));
    s.label(rf.scope, 'You + your dope card', { dx: -10, dy: -60, n: '★', color: C.amber });
    return s.svg();
  });

  // Module 00 hero: safe rifle on the firing line, muzzle downrange
  ISO.module('m-basics', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [190, 60], scale: 4.2 });
    s.floor(-8, -20, 110, 44, { grid: 8 });
    parts.berm(s, 80, -20, 40, 8);
    parts.plate(s, 76, 4, 0, 2.6);
    s.poly([[-6, -16, 0.05], [-6, 20, 0.05], [-1, 20, 0.05], [-1, -16, 0.05]], { fill: C.coral, opacity: 0.18 });
    s.line([[-1, -16, 0.1], [-1, 20, 0.1]], { color: C.coral, width: 2.5, dash: '6 5' });
    parts.mat(s, 0, -6, 38, 12, { color: C.teal });
    const r = parts.rifle(s, 2, 0, 0.4, { bag: true });
    s.line([r.muzzle, [76, 0, r.muzzle[2]]], { color: C.green, width: 3, arrow: true, dash: '8 6' });
    s.label([-3, 10, 0.2], 'Firing line', { dx: -40, dy: 30, color: C.coral, n: '!' });
    s.label([66, 0, r.muzzle[2]], 'Muzzle downrange', { dx: -20, dy: -60, n: 2, color: C.green });
    s.label([100, -10, 8], 'Backstop (berm)', { dx: 10, dy: -40, n: 4 });
    return s.svg();
  });

  ISO.lesson('safety', {
    caption: '<b>Defence in depth.</b> Every rule removes one condition an accident needs: the muzzle stays in the safe zone (green), nobody is downrange of the firing line (red), and the berm stops every bullet.',
    draw: () => {
      const s = ISO.scene({ w: 680, h: 340, origin: [210, 70], scale: 4.2 });
      s.floor(-12, -24, 118, 52, { grid: 8 });
      parts.berm(s, 84, -24, 48, 9);
      [[-20, -10], [-6, 10]].forEach(() => {});
      // safe zone wedge
      s.poly([[46, 0, 0.05], [84, -22, 0.05], [84, 22, 0.05]], { fill: C.green, opacity: 0.16 });
      s.poly([[-10, -22, 0.05], [-10, 26, 0.05], [-2, 26, 0.05], [-2, -22, 0.05]], { fill: C.coral, opacity: 0.18 });
      s.line([[-2, -22, 0.1], [-2, 26, 0.1]], { color: C.coral, width: 2.5, dash: '6 5' });
      parts.plate(s, 80, 6, 0, 2.6);
      parts.mat(s, 0, -6, 38, 12, { color: C.teal });
      const r = parts.rifle(s, 2, 0, 0.4, { bag: true });
      s.label([-6, 18, 0.2], 'Rule 2: nobody in front of the line', { dx: -40, dy: 40, n: 2, color: C.coral });
      s.label([64, 0, 0.2], 'Safe muzzle zone', { dx: 30, dy: 50, n: 2, color: C.green });
      s.label(r.trigger, 'Rule 3: finger off the trigger', { dx: -60, dy: 70, n: 3 });
      s.label([100, -14, 9], 'Rule 4: know the backstop', { dx: 10, dy: -40, n: 4 });
      s.label(r.action, 'Rule 1: treat as loaded', { dx: -60, dy: -70, n: 1 });
      return s.svg();
    },
  });

  ISO.lesson('rifle-anatomy', {
    at: 'top',
    caption: '<b>The precision rifle as a system.</b> Exploded slightly so each part is visible: optic (aim) → stock (stability) → action (lockup) → barrel (launch).',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [170, 80], scale: 7.2 });
      s.floor(-4, -12, 62, 26, { grid: 4 });
      s.shadow(0, -4, 56, 8);
      const r = parts.rifle(s, 0, 0, 0, { explode: 1.4, bag: true });
      s.label(r.scope, 'Optic', { dx: -40, dy: -50, n: 1 });
      s.label(r.action, 'Action', { dx: 60, dy: -80, n: 2 });
      s.label(r.bolt, 'Bolt', { dx: 20, dy: 40, n: 3 });
      s.label(r.barrel, 'Barrel', { dx: 40, dy: -60, n: 4 });
      s.label(r.muzzle, 'Muzzle device', { dx: 20, dy: -30, n: 5 });
      s.label(r.mag, 'Magazine', { dx: 20, dy: 60, n: 6 });
      s.label(r.trigger, 'Trigger', { dx: -40, dy: 70, n: 7 });
      s.label(r.stock, 'Stock / chassis', { dx: -60, dy: 50, n: 8 });
      s.label(r.cheek, 'Cheek riser', { dx: -40, dy: -50, n: 9 });
      s.label(r.bipod, 'Bipod', { dx: 30, dy: 40, n: 10 });
      return s.svg();
    },
  });
})();
