/*
 * Illustrations B: m-types (ammo & bullet types), m-calibers (calibers &
 * cartridges) and m-optics (optics & the MIL).
 *
 * Local conventions on top of core.js:
 *  - Upright objects (bullets, cartridges on plinths) are lathed along z.
 *  - Line-ups run along (+x, -y), which is horizontal on screen.
 *  - Downrange scenes that need target faces visible run along -y (targets
 *    lie in the x-z plane, whose +y side faces the viewer).
 *  - Sight pictures (what you see through the scope) are flat 2D insets.
 */
(function () {
  'use strict';
  const ISO = window.ISO, C = ISO.C, P = ISO.parts;
  const sh = ISO.shade;

  // ------------------------------------------------------------ helpers

  // Bullet profile [[t, r]...] + per-segment colours for an upright/along-axis
  // bullet. Base at t = 0. Shapes follow ISO.parts.bullet.
  const SHAPES = {
    fmj: { bt: 0.55, bear: 1.5, og: 2.4, p: 1.8, mep: 0.14 },
    spitzer: { bt: 0, bear: 1.3, og: 2.9, p: 2.1, mep: 0.08 },
    otm: { bt: 0.8, bear: 1.6, og: 2.9, p: 2.2, mep: 0.12, open: true },
    vld: { bt: 0.9, bear: 1.2, og: 3.7, p: 2.9, mep: 0.08, open: true },
    hybrid: { bt: 0.9, bear: 1.5, og: 3.4, p: 2.45, mep: 0.08, open: true },
    tip: { bt: 0.8, bear: 1.5, og: 3.1, p: 2.3, mep: 0.05, tip: true },
    mono: { bt: 0.9, bear: 2.0, og: 3.3, p: 2.4, mep: 0.07, grooves: true },
    soft: { bt: 0, bear: 1.6, og: 2.4, p: 1.9, mep: 0.32, softTip: true },
  };
  function bulletProfile(type, r, o) {
    o = o || {};
    const s = SHAPES[type] || SHAPES.otm;
    const col = o.color || (type === 'mono' ? C.copper : type === 'fmj' ? '#d98e52' : C.copper);
    const prof = [], cols = [];
    const add = (t, rr, c) => { if (prof.length) cols.push(c); prof.push([t, rr]); };
    if (s.bt) { add(0, r * 0.7, col); add(s.bt * r, r, col); } else { add(0, r * 0.93, col); add(0.1 * r, r, col); }
    const b0 = s.bt ? s.bt * r : 0.1 * r, b1 = b0 + s.bear * r;
    if (s.grooves) {
      const n = 3, seg = (b1 - b0) / (n * 2 + 1);
      for (let i = 0; i < n; i++) {
        add(b0 + seg * (2 * i + 1), r, col);
        add(b0 + seg * (2 * i + 1) + 0.01, r * 0.93, col);
        add(b0 + seg * (2 * i + 2), r * 0.93, sh(col, -0.25));
        add(b0 + seg * (2 * i + 2) + 0.01, r, col);
      }
    }
    add(b1, r, col);
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const rr = Math.max(s.mep * r, r * Math.pow(1 - t, 1 / s.p));
      let c = col;
      if (s.tip && i >= n - 2) c = C.red;
      if (s.softTip && i >= n - 3) c = C.lead;
      add(b1 + t * s.og * r, i === n ? s.mep * r : rr, c);
    }
    const len = b1 + s.og * r;
    if (s.open) { add(len, s.mep * r * 0.5, sh(col, -0.45)); add(len - 0.02 * r, 0, sh(col, -0.6)); }
    else add(len + 0.01, 0, s.tip ? C.red : s.softTip ? C.lead : col);
    return { prof, cols, len, b0, b1 };
  }
  // Upright bullet standing on its base at (x, y, z)
  function uprightBullet(s, x, y, z, r, type, o) {
    o = o || {};
    const b = bulletProfile(type, r, o);
    s.lathe(x, y, z, b.prof, { axis: 'z', colors: b.cols, color: b.cols[0], segments: o.segments || 22 });
    return { tip: [x, y, z + b.len], mid: [x, y, z + (b.b0 + b.b1) / 2], ogive: [x, y, z + b.b1 + (b.len - b.b1) * 0.4], len: b.len };
  }

  /*
   * Cartridge dimensions (inches): rim, base, shoulder, neck diameters,
   * shoulder start, neck start, case length, OAL, bullet diameter, belt.
   */
  const CART = {
    '.22 LR': { rim: 0.275, base: 0.226, sh: 0.226, neck: 0.226, s0: 0.6, s1: 0.6, len: 0.613, oal: 1.0, bd: 0.223, rimfire: true, bullet: 'lead' },
    '.223 Rem': { rim: 0.378, base: 0.376, sh: 0.354, neck: 0.253, s0: 1.438, s1: 1.564, len: 1.76, oal: 2.26, bd: 0.224 },
    '6mm CM': { rim: 0.473, base: 0.470, sh: 0.462, neck: 0.276, s0: 1.54, s1: 1.65, len: 1.92, oal: 2.80, bd: 0.243 },
    '6.5 CM': { rim: 0.473, base: 0.470, sh: 0.462, neck: 0.296, s0: 1.56, s1: 1.66, len: 1.92, oal: 2.825, bd: 0.264 },
    '6.5 PRC': { rim: 0.532, base: 0.532, sh: 0.515, neck: 0.298, s0: 1.66, s1: 1.77, len: 2.03, oal: 2.955, bd: 0.264 },
    '.308 Win': { rim: 0.473, base: 0.470, sh: 0.454, neck: 0.344, s0: 1.56, s1: 1.71, len: 2.015, oal: 2.80, bd: 0.308 },
    '.30-06': { rim: 0.473, base: 0.470, sh: 0.441, neck: 0.340, s0: 1.95, s1: 2.08, len: 2.494, oal: 3.34, bd: 0.308 },
    '.300 Win Mag': { rim: 0.532, base: 0.513, sh: 0.491, neck: 0.339, s0: 2.20, s1: 2.31, len: 2.62, oal: 3.34, bd: 0.308, belt: 0.532 },
    '.300 PRC': { rim: 0.532, base: 0.532, sh: 0.515, neck: 0.339, s0: 2.17, s1: 2.27, len: 2.58, oal: 3.70, bd: 0.308 },
    '.338 Lapua': { rim: 0.588, base: 0.587, sh: 0.544, neck: 0.372, s0: 2.24, s1: 2.38, len: 2.724, oal: 3.681, bd: 0.338 },
    '.243 Win': { rim: 0.473, base: 0.470, sh: 0.454, neck: 0.276, s0: 1.61, s1: 1.80, len: 2.045, oal: 2.71, bd: 0.243 },
    '.260 Rem': { rim: 0.473, base: 0.470, sh: 0.454, neck: 0.297, s0: 1.59, s1: 1.76, len: 2.035, oal: 2.80, bd: 0.264 },
    '7mm-08': { rim: 0.473, base: 0.470, sh: 0.454, neck: 0.315, s0: 1.58, s1: 1.74, len: 2.035, oal: 2.80, bd: 0.284 },
  };

  // Cartridge lathe profile (head at t = 0). k = units per inch.
  function cartProfile(name, k, o) {
    o = o || {};
    const d = CART[name];
    const brass = o.caseColor || C.brass, cu = o.bulletColor || (d.bullet === 'lead' ? C.lead : C.copper);
    const prof = [], cols = [];
    const add = (t, r, c) => { if (prof.length) cols.push(c); prof.push([t * k, r * k]); };
    const R = d.rim / 2, B = d.base / 2;
    if (d.rimfire) {
      add(0, R, brass); add(0.043, R, brass); add(0.046, B, brass);
    } else {
      add(0, R, brass); add(0.05, R, brass); add(0.06, R * 0.83, sh(brass, -0.15)); add(0.11, R * 0.83, brass); add(0.15, B, brass);
      if (d.belt) { add(0.2, d.belt / 2, brass); add(0.21, B, sh(brass, -0.1)); }
    }
    add(d.s0, d.sh / 2, brass);
    add(d.s1, d.neck / 2, brass);
    add(d.len, d.neck / 2, brass);
    // bullet: exposed bearing, then ogive
    const r = d.bd / 2, exp = d.oal - d.len;
    add(d.len + 0.005, r, sh(brass, -0.2));
    const og = Math.min(exp * 0.86, d.bd * 3.1), bear = exp - og;
    add(d.len + bear, r, cu);
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      add(d.len + bear + og * t, i === n ? r * 0.12 : r * Math.pow(1 - t, 1 / 2.2), cu);
    }
    add(d.oal + 0.004, 0, cu);
    return { prof, cols, d, ogiveAt: (d.len + bear) * k, bearAt: (d.len + bear * 0.5) * k };
  }
  // Clip a lathe profile to t >= t0 (for cutaways)
  function clipProfile(prof, cols, t0) {
    const out = [], oc = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      if (b[0] <= t0) continue;
      if (!out.length) out.push(a[0] >= t0 ? a : [t0, a[1] + (b[1] - a[1]) * (t0 - a[0]) / ((b[0] - a[0]) || 1)]);
      out.push(b); oc.push(cols[i]);
    }
    return { prof: out, cols: oc };
  }

  // Upright cartridge standing on its head at (x, y, z). k = units per inch.
  function uprightCart(s, x, y, z, name, k, o) {
    o = o || {};
    const c = cartProfile(name, k, o), d = c.d;
    s.lathe(x, y, z, c.prof, { axis: 'z', colors: c.cols, color: C.brass, capColor: sh(C.brass, -0.1), segments: o.segments || 18 });
    return { tip: [x, y, z + d.oal * k], neck: [x, y, z + (d.s1 + 0.1) * k], body: [x, y, z + d.s0 * 0.5 * k], head: [x, y, z], bullet: [x, y, z + c.bearAt], d };
  }

  // Plinth with a coloured top
  function plinth(s, x, y, w, d, h, color, o) {
    o = o || {};
    s.shadow(x - 0.3 * w / 4, y - 0.1, w + w * 0.15, d + d * 0.15, { opacity: 0.12 });
    s.box(x, y, o.z || 0, w, d, h, { color: o.side || C.white, top: color });
  }

  // Flat sight picture (2D inset): circle with a mil reticle.
  // opt: { r, mil (px per mil), cant (deg), hash (mil count each side), dark }
  function sightPicture(s, cx, cy, o) {
    o = o || {};
    const r = o.r || 50, m = o.mil || 10, n = o.hash != null ? o.hash : Math.floor((r - 4) / m);
    const id = 'sp' + Math.round(cx) + '_' + Math.round(cy) + '_' + Math.round(Math.random() * 1e6);
    let g = `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="${C.ink}"/>`;
    g += `<g clip-path="url(#${id})"><rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${o.bg || '#e9f3ff'}"/>`;
    if (o.ground !== false) g += `<rect x="${cx - r}" y="${cy + r * (o.horizon != null ? o.horizon : 0.35)}" width="${2 * r}" height="${r}" fill="${o.groundColor || '#d9ead2'}"/>`;
    g += o.scene || '';
    const rot = o.cant ? ` transform="rotate(${o.cant} ${cx} ${cy})"` : '';
    const col = o.reticle || C.ink;
    g += `<g${rot}><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="${col}" stroke-width="1.2"/><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${col}" stroke-width="1.2"/>`;
    for (let i = -n; i <= n; i++) {
      if (!i) continue;
      const L = i % 5 === 0 ? 5 : 3;
      g += `<line x1="${cx + i * m}" y1="${cy - L}" x2="${cx + i * m}" y2="${cy + L}" stroke="${col}" stroke-width="1.2"/>`;
      g += `<line x1="${cx - L}" y1="${cy + i * m}" x2="${cx + L}" y2="${cy + i * m}" stroke="${col}" stroke-width="1.2"/>`;
    }
    g += (o.overlay || '') + '</g></g>';
    g += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
    s.raw(g, 5);
  }

  // Rounded 2D pill in screen space (for formulas / read-outs)
  function pill(s, x, y, text, o) {
    o = o || {};
    const fs = o.size || 12, w = o.w || (String(text).length * fs * 0.58 + 22);
    const x0 = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
    s.raw(`<rect x="${x0}" y="${y - fs * 1.05}" width="${w}" height="${fs * 2.1}" rx="${fs * 1.05}" fill="${o.fill || C.ink}"/>`
      + `<text x="${x0 + w / 2}" y="${y + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${o.color || '#fff'}"${o.mono ? ' font-family="JetBrains Mono, monospace"' : ''}>${esc(text)}</text>`, 6);
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Screen-horizontal row position: i steps along (+x, -y)
  const row = (x0, y0, i, step) => [x0 + i * step, y0 - i * step];

  // =====================================================================
  // m-types — Ammo & bullet types
  // =====================================================================

  ISO.module('m-types', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [320, 175], scale: 11 });
    s.floor(-12, -12, 24, 24, { grid: 3 });
    plinth(s, -7, -7, 14, 14, 2, C.blue);
    [['fmj', -3.5, 3.5], ['otm', 0, 0], ['tip', 3.5, -3.5]].forEach(([t, x, y]) => uprightBullet(s, x - 2.4, y - 2.4, 2, 1.05, t, { segments: 20 }));
    uprightCart(s, 2.6, 2.6, 2, '6.5 CM', 5.4);
    return s.svg();
  });

  ISO.lesson('rimfire-centerfire', {
    caption: '<b>Where the primer sits decides everything.</b> The rimfire\'s firing pin crushes the hollow rim, which holds the priming compound — one-use brass. The centerfire\'s pin strikes a separate primer cup in the center, which a reloader can replace.',
    draw: () => {
      const s = ISO.scene({ w: 700, h: 360, origin: [350, 215], scale: 3.0 });
      // loading block with the two cases standing head-up (units: 0.01")
      s.floor(-62, -62, 124, 124, { grid: 12 });
      s.shadow(-46, -46, 92, 92);
      s.box(-40, -40, 0, 80, 80, 10, { color: C.wood, top: sh(C.wood, 0.3) });
      // centres: rimfire left, centerfire right (screen-horizontal)
      const L = [-20, 20], Rr = [18, -18];
      const top = 10;
      // rimfire case stub: body .226, rim .275 (scaled x1 in 0.01")
      s.lathe(L[0], L[1], top, [[0, 11.3], [16, 11.3], [16.2, 13.75], [20.5, 13.75]], { axis: 'z', color: C.brass, capColor: sh(C.brass, 0.05), segments: 32 });
      // priming compound ring visible "through" the head (cutaway hint)
      const rim = (cx, cy, z, r1, r2, fill, op) => {
        const ring = [];
        for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; ring.push([cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), z]); }
        for (let i = 40; i >= 0; i--) { const a = i / 40 * Math.PI * 2; ring.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), z]); }
        s.poly(ring, { fill, opacity: op });
      };
      rim(L[0], L[1], top + 20.5, 9.6, 13.2, C.coral, 0.75);
      // rimfire strike: rectangular dent on the rim edge (toward the viewer)
      const dz = top + 20.6;
      s.poly([[L[0] + 7.2, L[1] + 7.2 + 1.8, dz], [L[0] + 9.6, L[1] + 9.6 - 0.6, dz], [L[0] + 8.0, L[1] + 8.0 - 2.4, dz], [L[0] + 5.6, L[1] + 5.6 + 0.6, dz]].map((p) => p), { fill: C.ink, opacity: 0.7 });
      // rimfire firing pin: flat chisel hovering over the edge
      s.box(L[0] + 6.6, L[1] + 6.6 - 1.2, dz + 9, 2.4, 2.4, 16, { color: C.steel });
      s.line([[L[0] + 7.8, L[1] + 7.8, dz + 7.5], [L[0] + 7.8, L[1] + 7.8, dz + 2]], { color: C.coral, width: 3, arrow: true });

      // centerfire stub (6.5 CM head .473, extractor groove, body .470) — painted bottom-up
      s.lathe(Rr[0], Rr[1], top, [[0, 23.5], [18, 23.5]], { axis: 'z', color: C.brass, segments: 36 });
      s.lathe(Rr[0], Rr[1], top + 18, [[0, 23.5], [3, 19.6], [8, 19.6]], { axis: 'z', color: sh(C.brass, -0.12), segments: 36 });
      s.lathe(Rr[0], Rr[1], top + 26, [[0, 22.6], [1, 23.6], [6, 23.6]], { axis: 'z', color: C.brass, capColor: sh(C.brass, 0.05), segments: 36 });
      const cz = top + 32.05;
      s.disc(Rr[0], Rr[1], cz, 10.5, { fill: C.silver, stroke: sh(C.silver, -0.35), width: 1.6 });
      s.disc(Rr[0], Rr[1], cz + 0.05, 7.5, { fill: 'none', stroke: sh(C.silver, -0.2), width: 1 });
      s.disc(Rr[0], Rr[1], cz + 0.1, 2.4, { fill: C.ink, opacity: 0.7 });
      // primer pocket compound (small amber spot) + flash hole hint
      // centerfire firing pin: round, hemispherical nose
      s.lathe(Rr[0], Rr[1], cz + 9, [[0, 0], [0.8, 1.6], [2, 2.3], [16, 2.3]], { axis: 'z', color: C.steel, segments: 16 });
      s.line([[Rr[0], Rr[1], cz + 7.5], [Rr[0], Rr[1], cz + 2]], { color: C.blue, width: 3, arrow: true });

      s.label([L[0] - 11, L[1] - 6, top + 20.6], 'Priming compound in the hollow rim', { dx: -60, dy: -40, n: 1, color: C.coral });
      s.label([L[0] + 7.8, L[1] + 7.8, dz + 18], 'Pin crushes the rim edge', { dx: -90, dy: 0, n: 2, color: C.coral });
      s.label([Rr[0] + 8, Rr[1] + 3, cz], 'Separate primer cup (replaceable)', { dx: 40, dy: 60, n: 3, color: C.blue });
      s.label([Rr[0], Rr[1], cz + 22], 'Pin strikes the center', { dx: 60, dy: 0, n: 4, color: C.blue });
      s.text(120, 318, 'RIMFIRE · .22 LR', { size: 15, weight: 800, anchor: 'middle' });
      s.text(120, 336, 'cheap · low power · not reloadable', { size: 11, weight: 500, anchor: 'middle' });
      s.text(585, 318, 'CENTERFIRE · 6.5 CM', { size: 15, weight: 800, anchor: 'middle' });
      s.text(585, 336, 'powerful · reloadable', { size: 11, weight: 500, anchor: 'middle' });
      return s.svg();
    },
  });

  // Scene whose line-up of n items (spaced `px` apart on screen) is centred
  // horizontally; returns { s, st } where st is the world step along (+x, -y).
  function rowScene(n, px, sc, w, h, baseY) {
    const st = px / (2 * 0.866 * sc);
    const ox = w / 2 - (n - 1) * px / 2;
    return { s: ISO.scene({ w, h, origin: [ox, baseY], scale: sc }), st };
  }

  ISO.lesson('bullets', {
    caption: '<b>Same caliber, different jobs.</b> Long boat-tailed, sharp-nosed match bullets (OTM, VLD, hybrid, tipped) hold their speed best; FMJ is cheap but less consistent; monolithic and soft-point designs serve lead-free and hunting needs.',
    draw: () => {
      const { s, st } = rowScene(7, 98, 20, 720, 330, 220);
      const types = [
        ['fmj', 'FMJ', 'cheap practice', C.slate],
        ['otm', 'OTM / HPBT', 'match standard', C.blue],
        ['vld', 'VLD', 'highest BC', C.purple],
        ['hybrid', 'Hybrid', 'BC + forgiving', C.teal],
        ['tip', 'Polymer tip', 'uniform BC', C.coral],
        ['mono', 'Monolithic', 'solid copper', C.amber],
        ['soft', 'Soft point', 'hunting', C.green],
      ];
      types.forEach(([type, name, what, col], i) => {
        const [x, y] = row(0, 0, i, st);
        plinth(s, x - 1.1, y - 1.1, 2.2, 2.2, 0.7, col);
        uprightBullet(s, x, y, 0.7, 1, type, { segments: 20 });
        const q = s.P([x + 1.1, y + 1.1, 0]);
        s.text(q[0], q[1] + 22, name, { size: 12.5, weight: 800, anchor: 'middle' });
        s.text(q[0], q[1] + 38, what, { size: 10.5, weight: 500, anchor: 'middle' });
      });
      const [bx, by] = row(0, 0, 1, st);
      s.label([bx + 0.7, by - 0.7, 0.7 + 0.5], 'Boat tail', { dx: -48, dy: 38, n: 'a', color: C.blue });
      s.label([bx + 0.55, by - 0.55, 0.7 + 4.6], 'Ogive (nose)', { dx: -40, dy: -60, n: 'b', color: C.blue });
      const [px, py] = row(0, 0, 4, st);
      s.label([px, py, 0.7 + 6.1], 'Tip closes the meplat', { dx: 26, dy: -36, n: 'c', color: C.coral });
      const [mx, my] = row(0, 0, 5, st);
      s.label([mx + 0.7, my - 0.7, 0.7 + 2.2], 'Relief grooves', { dx: 30, dy: -120, n: 'd', color: C.amber });
      return s.svg();
    },
  });

  // Ogive nose radius u(z) for z in [0, Lo] (r = shank radius)
  function noseFn(kind, r, Lo) {
    const Rt = (Lo * Lo + r * r) / (2 * r);
    const circThrough = (A, B, R) => { // centre of the convex arc through A, B (u,z)
      const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, du = B[0] - A[0], dz = B[1] - A[1], d = Math.hypot(du, dz);
      const h = Math.sqrt(Math.max(0, R * R - d * d / 4));
      const c1 = [mx - dz / d * h, mz + du / d * h], c2 = [mx + dz / d * h, mz - du / d * h];
      return c1[0] < c2[0] ? c1 : c2;
    };
    const arcU = (c, R, z) => c[0] + Math.sqrt(Math.max(0, R * R - (z - c[1]) * (z - c[1])));
    if (kind === 'tangent') return (z) => r - Rt + Math.sqrt(Math.max(0, Rt * Rt - z * z));
    if (kind === 'secant') { const R = Rt * 2.4, c = circThrough([r, 0], [0, Lo], R); return (z) => arcU(c, R, z); }
    // hybrid: tangent (large radius) for the rear of the nose, secant to the tip
    const R1 = Rt * 2.2, q = Lo * 0.36;
    const uq = r - R1 + Math.sqrt(R1 * R1 - q * q);
    const R2 = Rt * 2.0, c2 = circThrough([uq, q], [0, Lo], R2);
    return (z) => (z <= q ? r - R1 + Math.sqrt(R1 * R1 - z * z) : arcU(c2, R2, z));
  }

  ISO.lesson('bullets', {
    at: 'end',
    caption: '<b>Tangent vs secant ogive.</b> A tangent nose leaves the shank smoothly — forgiving of how far the bullet jumps to the rifling. A secant nose starts at an angle (the kink): slimmer, higher BC, but pickier about seating depth. A hybrid keeps the smooth junction at the shank and puts the secant profile up front.',
    draw: () => {
      const { s, st } = rowScene(3, 230, 24, 720, 360, 255);
      const r = 1, bt = 0.8, z0 = 2.6, Lo = 4.0;
      const kinds = [['tangent', 'TANGENT', 'smooth · forgiving', C.green], ['secant', 'SECANT (VLD)', 'kink · highest BC · jump-sensitive', C.purple], ['hybrid', 'HYBRID', 'smooth at shank · secant up front', C.teal]];
      kinds.forEach(([kind, name, what, col], i) => {
        const [x, y] = row(0, 0, i, st);
        plinth(s, x - 1.5, y - 1.5, 3, 3, 0.5, col);
        const f = noseFn(kind, r, Lo);
        const prof = [[0, 0.72 * r], [bt, r], [z0, r]];
        const N = 16;
        for (let k = 1; k <= N; k++) { const z = Lo * k / N; prof.push([z0 + z, Math.max(0.05, f(z))]); }
        prof.push([z0 + Lo + 0.01, 0]);
        s.lathe(x, y, 0.5, prof, { axis: 'z', color: C.copper, segments: 24 });
        // right-hand silhouette: dashed shank extension + highlighted nose curve
        const sil = (u, z) => [x + u / Math.SQRT2, y - u / Math.SQRT2, 0.5 + z];
        s.line([sil(r, z0 - 0.4), sil(r, z0 + 2.0)], { color: C.ink, width: 1.4, dash: '4 4', opacity: 0.75 });
        const pts = [];
        for (let k = 0; k <= 30; k++) { const z = Lo * k / 30; pts.push(sil(f(z), z0 + z)); }
        s.line(pts, { color: col, width: 4 });
        const J = sil(r, z0);
        if (kind === 'secant') {
          const h = 1.6;
          s.poly([J, sil(r, z0 + h), sil(f(h), z0 + h)], { fill: C.coral, opacity: 0.6 });
          s.label(J, 'Kink at the junction', { dx: 26, dy: 40, n: '!', color: C.coral });
        } else if (kind === 'tangent') {
          s.label(J, 'Leaves the shank smoothly', { dx: 26, dy: 40, n: '✓', color: C.green });
        } else {
          const qz = Lo * 0.36;
          s.label(J, 'Smooth here', { dx: 30, dy: 40, n: '✓', color: C.teal });
          s.label(sil(f(qz), z0 + qz), 'Secant from here', { dx: 30, dy: -30, n: '2', color: C.teal });
        }
        const q = s.P([x + 1.5, y + 1.5, 0]);
        s.text(q[0], q[1] + 26, name, { size: 14, weight: 800, anchor: 'middle' });
        s.text(q[0], q[1] + 43, what, { size: 11, weight: 500, anchor: 'middle' });
      });
      return s.svg();
    },
  });

  ISO.lesson('ammo-purpose', {
    caption: '<b>Every load has one priority.</b> Match ammo buys consistency, hunting ammo buys terminal effect, practice ammo buys volume, subsonic buys quiet and frangible buys safety on close steel. Your dope card belongs to exactly one load.',
    draw: () => {
      const { s, st } = rowScene(5, 136, 13, 720, 300, 195);
      const cats = [
        ['MATCH', 'consistency', C.blue],
        ['HUNTING', 'terminal effect', C.green],
        ['PRACTICE', 'low cost', C.amber],
        ['SUBSONIC', 'quiet (suppressed)', C.purple],
        ['FRANGIBLE', 'safe on close steel', C.coral],
      ];
      cats.forEach(([name, what, col], i) => {
        const [x, y] = row(0, 0, i, st);
        const bx = x - 2.2, by = y - 1.8;
        s.shadow(bx - 0.4, by - 0.2, 5, 4.2);
        s.box(bx, by, 0, 4.4, 3.6, 2, { color: col });
        s.box(bx - 0.1, by - 0.1, 2, 4.6, 3.8, 0.7, { color: C.white, top: sh(col, 0.75) });
        const z = 2.7, cx = x, cy = y;
        if (name === 'MATCH') {
          s.line([[cx - 0.5, cy - 0.5, z], [cx - 0.5, cy - 0.5, z + 0.6]], { color: C.ink, width: 2 });
          [[2.0, C.white], [1.5, C.blue], [1.0, C.white], [0.5, C.coral]].forEach(([r, f]) => s.disc(cx - 0.5, cy - 0.5, z + 2.6, r, { plane: 'xz', fill: f, stroke: C.ink, width: 1 }));
          uprightBullet(s, cx + 1.3, cy + 1.1, z, 0.42, 'otm', { segments: 16 });
        } else if (name === 'HUNTING') {
          P.tree(s, cx - 1.3, cy - 0.3, 5.5);
          // expanded ("mushroomed") bullet
          s.lathe(cx + 1.2, cy - 0.6, z, [[0, 0.45], [1.3, 0.45], [1.6, 0.7], [1.9, 1.15], [2.05, 1.2], [2.15, 0.5], [2.2, 0]], { axis: 'z', color: C.copper, colors: [C.copper, C.copper, C.copper, C.copper, sh(C.lead, 0.2), sh(C.lead, 0.2)], segments: 16 });
        } else if (name === 'PRACTICE') {
          for (let k = 0; k < 5; k++) s.lathe(cx - 0.4, cy - 0.4, z + k * 0.45, [[0, 1.3], [0.4, 1.3]], { axis: 'z', color: k % 2 ? C.amber : C.yellow, segments: 22 });
          s.text3([cx - 0.4, cy - 0.4, z + 2.25], '$', { size: 15, weight: 800, anchor: 'middle', dy: 5, color: sh(C.amber, -0.5) });
          s.lathe(cx + 1.4, cy + 1.3, z, [[0, 0.9], [0.4, 0.9]], { axis: 'z', color: C.yellow, segments: 18 });
        } else if (name === 'SUBSONIC') {
          s.lathe(cx - 2.0, cy + 0.2, z + 1, [[0, 0.8], [4.0, 0.8], [4.3, 0.45]], { axis: 'x', color: C.gunmetal, segments: 18 });
          // faint, crossed-out sound waves
          [0.9, 1.6].forEach((rr, k) => s.curve((a) => [cx + 2.4 + rr * Math.sin(a) * 0.5, cy + 0.2 - rr * Math.sin(a) * 0.5, z + 1 + rr * Math.cos(a)], -1.1, 1.1, { color: C.purple, width: 2.2, opacity: 0.7 - k * 0.25, samples: 14 }));
          s.line([[cx + 2.6, cy - 0.6, z + 2.4], [cx + 3.6, cy + 0.4, z - 0.2]], { color: C.coral, width: 2.5 });
        } else {
          // steel plate with fragments spraying off
          s.box(cx - 0.2, cy - 1.6, z, 0.3, 3.2, 3.6, { color: C.steel });
          [[-1.2, 0.4, 2.4], [-1.8, -0.5, 1.5], [-1.0, 1.4, 1.1], [-2.3, 0.7, 3.0], [-1.5, -1.3, 3.0], [-0.9, -0.6, 0.6]].forEach(([dx, dy, dz]) => s.box(cx + dx, cy + dy, z + dz, 0.32, 0.32, 0.32, { color: C.gunmetal }));
          s.line([[cx - 0.3, cy, z + 2], [cx - 2.4, cy + 0.6, z + 2.9]], { color: C.coral, width: 1.5, dash: '2 3' });
          s.line([[cx - 0.3, cy, z + 2], [cx - 2.2, cy - 1.4, z + 1.4]], { color: C.coral, width: 1.5, dash: '2 3' });
          s.line([[cx - 0.3, cy, z + 2], [cx - 1.2, cy + 1.6, z + 0.9]], { color: C.coral, width: 1.5, dash: '2 3' });
        }
        const q = s.P([x + 2.2, y + 1.8, 0]);
        s.text(q[0], q[1] + 24, name, { size: 13.5, weight: 800, anchor: 'middle' });
        s.text(q[0], q[1] + 41, what, { size: 11, weight: 500, anchor: 'middle' });
      });
      return s.svg();
    },
  });
  ISO.lesson('consistency', {
    caption: '<b>Velocity spread becomes vertical spread.</b> Each line is one shot: a faster bullet drops less and hits high, a slower one hits low. Triple the SD and you roughly triple the vertical — the horizontal stays the same.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 370, origin: [118, 262], scale: 5 });
      s.floor(-14, -72, 52, 84, { grid: 6 });
      const L = 62;
      const lanes = [
        { x: 0, spread: [0.2, -0.5, 0.6, -0.1, 0.3], col: C.green, sd: 'SD 5 fps', res: 'Tight vertical' },
        { x: 26, spread: [1.4, -2.2, 2.6, -0.6, 0.8], col: C.coral, sd: 'SD 15 fps', res: 'Vertical stringing (3×)' },
      ];
      lanes.forEach((ln, k) => {
        const x = ln.x, aim = 8.5;
        // target board (faces the viewer: x-z plane at y = -L)
        s.line([[x - 3.4, -L, 0], [x - 3.4, -L, 13]], { color: C.wood, width: 3 });
        s.line([[x + 3.4, -L, 0], [x + 3.4, -L, 13]], { color: C.wood, width: 3 });
        s.poly([[x - 4, -L, 3], [x + 4, -L, 3], [x + 4, -L, 14], [x - 4, -L, 14]], { fill: C.white, stroke: C.slate, width: 1.4 });
        [3, 2, 1].forEach((r, i) => s.disc(x, -L, aim, r, { plane: 'xz', fill: i % 2 ? C.white : sh(ln.col, 0.55), stroke: C.slate, width: 1 }));
        // muzzle + chronograph
        s.box(x - 1.2, -6, 0, 2.4, 3, 1.2, { color: C.gunmetal });
        s.lathe(x, 0, 3, [[0, 0.5], [9, 0.55]], { axis: 'y', color: C.gunmetal, segments: 14 });
        // shots
        ln.spread.forEach((dz, i) => {
          const zi = aim + dz;
          s.curve((t) => [x + (i - 2) * 0.12 * t, -L * t, 3 + (zi - 3) * t + 7 * Math.sin(Math.PI * t) * (1 - 0.15 * dz / 3)], 0, 1, { color: ln.col, width: 1.6, opacity: 0.8, samples: 30 });
        });
        ln.spread.forEach((dz, i) => s.disc(x + (i - 2) * 0.12, -L + 0.05, aim + dz, 0.42, { plane: 'xz', fill: C.ink }));
        // vertical-spread bracket
        const lo = Math.min(...ln.spread) + aim, hi = Math.max(...ln.spread) + aim;
        s.line([[x + 5, -L, lo], [x + 5, -L, hi]], { color: ln.col, width: 3 });
        s.line([[x + 4.6, -L, lo], [x + 5.4, -L, lo]], { color: ln.col, width: 2 });
        s.line([[x + 4.6, -L, hi], [x + 5.4, -L, hi]], { color: ln.col, width: 2 });
        s.label([x, -3, 1.2], ln.sd, { dx: k ? 30 : -30, dy: 46, n: k + 1, color: ln.col });
        s.label([x + 5, -L, (lo + hi) / 2], ln.res, { dx: 26, dy: 0, n: k + 1, color: ln.col });
      });
      s.text(600, 350, 'vertical exaggerated · chronograph under the muzzle', { size: 10.5, weight: 500, anchor: 'middle' });
      return s.svg();
    },
  });

  ISO.lesson('powder-barrel', {
    caption: '<b>Warm powder, faster bullet.</b> With 0.8 fps/°F sensitivity, the same 6.5 CM load chronographed at 2,710 fps on a 59 °F day runs ~2,739 fps at 95 °F and ~2,679 fps at 20 °F. Keep ammo shaded and enter the sensitivity in your solver.',
    draw: () => {
      const { s, st } = rowScene(3, 200, 11, 720, 360, 268);
      const temps = [[20, C.sky, 'COLD'], [59, C.green, 'CHRONO DAY'], [95, C.coral, 'HOT']];
      temps.forEach(([T, col, name], i) => {
        const mv = Math.round(2710 + 0.8 * (T - 59));
        const [x, y] = row(0, 0, i, st);
        s.shadow(x - 3.4, y - 2, 7.6, 4.4, { opacity: 0.12 });
        s.box(x - 3.4, y - 2, 0, 7.4, 4, 0.6, { color: C.white, top: sh(col, 0.7) });
        // thermometer: bulb, fluid column, glass
        const tx = x - 1.8, ty = y, lvl = 1.4 + (T + 10) / 120 * 9;
        s.sphere(tx, ty, 1.5, 0.85, { color: C.red, rings: 8 });
        s.lathe(tx, ty, 1.8, [[0, 0.32], [lvl - 1.8, 0.32]], { axis: 'z', color: C.red, segments: 14 });
        s.lathe(tx, ty, lvl, [[0, 0.32], [11 - lvl, 0.32], [11.3 - lvl, 0]], { axis: 'z', color: C.white, segments: 14 });
        // MV bar (baseline 2,600 fps), cartridge in front
        const h = (mv - 2600) / 10;
        s.box(x + 0.4, y - 1.2, 0.6, 2.2, 2.2, h, { color: col });
        s.text3([x + 1.5, y - 0.1, 0.6 + h], mv.toLocaleString('en-US') + ' fps', { size: 13, weight: 800, anchor: 'middle', dy: -10, mono: true });
        uprightCart(s, x + 3.0, y + 1.3, 0.6, '6.5 CM', 2.6, { segments: 14 });
        if (T === 95) {
          s.sphere(x + 4.6, y - 3.6, 13, 1.3, { color: C.amber, rings: 8 });
          for (let a = 0; a < 8; a++) { const an = a / 8 * Math.PI * 2; s.line([[x + 4.6 + Math.cos(an) * 1.9, y - 3.6 - Math.cos(an) * 1.9 * 0, 13 + Math.sin(an) * 1.9], [x + 4.6 + Math.cos(an) * 2.5, y - 3.6, 13 + Math.sin(an) * 2.5]], { color: C.amber, width: 2.5 }); }
        }
        const q = s.P([x + 0.4, y + 2, 0]);
        s.text(q[0], q[1] + 24, `${name} · ${T} °F`, { size: 13, weight: 800, anchor: 'middle' });
      });
      pill(s, 360, 28, 'MV = 2,710 + 0.8 fps/°F × (T − 59 °F)', { size: 13, anchor: 'middle', mono: true, fill: C.navy });
      s.text(708, 352, 'bars start at 2,600 fps', { size: 10.5, weight: 500, anchor: 'end' });
      return s.svg();
    },
  });

  ISO.lesson('powder-barrel', {
    at: 'before:h4',
    caption: '<b>Throat erosion moves the rifling away from the bullet.</b> Hot gas burns the start of the lands (the throat). On a worn barrel the bullet jumps farther before it engages, pressure and MV usually drop — re-chronograph and update the card.',
    draw: () => {
      const sc = 150;
      const s = ISO.scene({ w: 720, h: 380, origin: [-30, 40], scale: sc });
      const X0 = 1.35, X1 = 3.35, OUT = 0.5, T = 0.55;
      const rows = [
        { y: -1.5, gap: 0.03, worn: false, name: 'NEW BARREL' },
        { y: 0.0, gap: 0.17, worn: true, name: 'WORN (~2,500 rds, 6.5 CM)' },
      ];
      const cp = cartProfile('6.5 CM', 1);
      const d = cp.d, ch = 0.006;
      // chamber/bore half-profile (groove radius in the bore)
      const rG = 0.1325, rL = 0.1, ogX = cp.ogiveAt;
      const inner = (x) => (x < d.s0 ? d.sh / 2 + ch : x < d.s1 ? d.sh / 2 + ch + (d.neck / 2 - d.sh / 2) * (x - d.s0) / (d.s1 - d.s0) : x < d.len ? d.neck / 2 + ch : rG);
      rows.forEach((rw, k) => {
        const y = rw.y, landX = ogX + rw.gap;
        const pts = [];
        for (let i = 0; i <= 40; i++) { const x = X0 + (X1 - X0) * i / 40; pts.push([x, inner(x)]); }
        [d.s0, d.s1, d.len, d.len + 0.0001].forEach((x) => { if (x > X0) pts.push([x, inner(x)]); });
        pts.sort((a, b) => a[0] - b[0]);
        // cavity backdrop (inside of the far chamber wall)
        s.poly([...pts.map(([x, r]) => [x, y - T * 0.5, r]), ...pts.slice().reverse().map(([x, r]) => [x, y - T * 0.5, -r])], { fill: sh(C.gunmetal, -0.3) });
        // lower half then upper half of the barrel, cut at y = 0
        const lower = [[X0, -OUT], [X1, -OUT], ...pts.slice().reverse().map(([x, r]) => [x, -r])];
        const upper = [[X0, OUT], ...pts.map(([x, r]) => [x, r]), [X1, OUT]];
        s.extrude(lower, -T, T, { plane: 'xz', at: [0, y, 0], color: C.steel });
        // lands (rifling), eroded edge on the worn barrel
        const edge = rw.worn ? [[landX, rG], [landX - 0.03, rG - 0.008], [landX + 0.02, rG - 0.016], [landX - 0.02, rG - 0.024], [landX + 0.025, rL]] : [[landX - 0.03, rG], [landX, rL]];
        const landU = [...edge, [X1, rL], [X1, rG]];
        const landD = landU.map(([x, r]) => [x, -r]);
        s.extrude(landD, -T * 0.999, T * 0.999, { plane: 'xz', at: [0, y, 0], color: rw.worn ? C.copper : C.slate });
        s.extrude(upper, -T, T, { plane: 'xz', at: [0, y, 0], color: C.steel });
        s.extrude(landU, -T * 0.999, T * 0.999, { plane: 'xz', at: [0, y, 0], color: rw.worn ? C.copper : C.slate });
        if (rw.worn) [[landX + 0.08, rG + 0.03], [landX + 0.18, rG + 0.06], [landX + 0.04, rG + 0.09], [landX + 0.26, rG + 0.02]].forEach(([x, z]) => s.line([[x - 0.02, y + 0.001, z], [x + 0.015, y + 0.001, z + 0.025], [x + 0.03, y + 0.001, z]], { color: sh(C.coral, -0.3), width: 1.4 }));
        // cartridge (clipped to the cut-away region)
        const cl = clipProfile(cp.prof, cp.cols, X0);
        s.lathe(X0, y, 0, cl.prof.map(([t, r]) => [t - X0, r]), { axis: 'x', colors: cl.cols, color: C.brass, segments: 22 });
        // jump bracket
        const zb = -0.2;
        s.line([[ogX, y, zb], [landX, y, zb]], { color: rw.worn ? C.coral : C.green, width: 3 });
        s.line([[ogX, y, zb + 0.04], [ogX, y, zb - 0.04]], { color: C.ink, width: 1.5 });
        s.line([[landX, y, zb + 0.04], [landX, y, zb - 0.04]], { color: C.ink, width: 1.5 });
        s.label([(ogX + landX) / 2, y, zb], rw.worn ? 'Long jump → MV drops' : 'Short jump to the lands', { dx: rw.worn ? -40 : -60, dy: 50, n: k ? 2 : 1, color: rw.worn ? C.coral : C.green });
        const q = s.P([X0, y, OUT]);
        s.text(q[0] + 4, q[1] - 14, rw.name, { size: 13, weight: 800 });
      });
      s.label([ogX + 0.17 + 0.1, 0, rG + 0.06], 'Fire-cracked, eroded throat', { dx: 30, dy: -30, n: '!', color: C.coral });
      s.label([2.9, -1.5, rL], 'Lands (rifling)', { dx: 40, dy: -30, n: 'i', color: C.slate });
      return s.svg();
    },
  });
})();
