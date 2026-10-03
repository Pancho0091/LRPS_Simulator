/*
 * Illustrations (a): modules m-terms, m-history, m-platforms, m-ammo, and the
 * m-basics lessons what-is-lrps / how-a-shot-fires.
 * Conventions: see js/illus/core.js (+x downrange, paint back to front).
 */
(function () {
  'use strict';
  const ISO = window.ISO, C = ISO.C, P = ISO.parts;
  const K = 0.8660254;
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------ helpers

  // Text printed onto an iso face. face: 'y' (front-left face, reads along +x),
  // 'x' (front-right face, reads along -y), 'top' (reads along +x) or 'top-y' (reads along -y).
  function faceText(s, p, text, face, o) {
    o = o || {};
    const q = s.P(p);
    const m = { y: [K, 0.5, 0, 1], x: [K, -0.5, 0, 1], top: [K, 0.5, -K, 0.5], 'top-y': [K, -0.5, K, 0.5] }[face || 'y'];
    const esc = String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    s.raw(`<text transform="matrix(${m.join(',')},${q[0].toFixed(1)},${q[1].toFixed(1)})" font-size="${o.size || 12}" font-weight="${o.weight || 700}" fill="${o.color || C.ink}" text-anchor="${o.anchor || 'middle'}"${o.mono ? ' font-family="JetBrains Mono, monospace"' : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''} dominant-baseline="central">${esc}</text>`);
  }

  // Box with a soft shadow under it
  function block(s, x, y, z, w, d, h, color, o) {
    if (!z) s.shadow(x - 0.3, y - 0.3, w + 0.6, d + 0.6, { opacity: 0.12 });
    s.box(x, y, z, w, d, h, Object.assign({ color }, o || {}));
  }

  // Front (viewer-facing) / back halves of a helix wrapped round an x-axis cylinder
  function helix(s, x0, x1, y, z, r, pitch, o, side) {
    o = o || {};
    const n = Math.max(24, Math.round((x1 - x0) / pitch * 36));
    let seg = [];
    const flush = () => { if (seg.length > 1) s.line(seg, o); seg = []; };
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n;
      const th = (x - x0) / pitch * TAU + (o.phase || 0);
      const front = Math.cos(th) + Math.sin(th) > 0;
      const p = [x, y + r * Math.cos(th), z + r * Math.sin(th)];
      if ((side === 'front') === front) seg.push(p); else { if (seg.length) seg.push(p); flush(); }
    }
    flush();
  }

  // Curved spin arrow around the x axis at station x
  function spin(s, x, y, z, r, o) {
    o = o || {};
    s.curve((t) => [x, y + r * Math.cos(t), z + r * Math.sin(t)], o.from != null ? o.from : -2.2, o.to != null ? o.to : 1.6, Object.assign({ color: C.coral, width: 2.2, arrow: true, samples: 24 }, o));
  }

  // Standing target board facing the viewer (+y face), centre (cx, y, cz)
  function board(s, cx, y, cz, r, o) {
    o = o || {};
    const half = r * 1.25;
    s.line([[cx - half * 0.7, y + 0.3, 0], [cx - half * 0.7, y + 0.3, cz]], { color: C.wood, width: 3 });
    s.line([[cx + half * 0.7, y + 0.3, 0], [cx + half * 0.7, y + 0.3, cz]], { color: C.wood, width: 3 });
    s.shadow(cx - half, y - 1, half * 2, 3, { opacity: 0.1 });
    s.box(cx - half, y, cz - half, half * 2, 0.5, half * 2, { color: o.color || C.white });
    const fy = y + 0.52;
    [[1, C.white], [0.75, C.sky2], [0.5, C.white], [0.25, C.sky2]].forEach(([k, f]) => s.disc(cx, fy, cz, r * k, { plane: 'xz', fill: f, stroke: C.steel, width: 1 }));
    if (o.cross !== false) {
      const col = o.crossColor || C.blue;
      s.line([[cx - r * 1.1, fy, cz], [cx + r * 1.1, fy, cz]], { color: col, width: 1.6 });
      s.line([[cx, fy, cz - r * 1.1], [cx, fy, cz + r * 1.1]], { color: col, width: 1.6 });
    }
    return { face: (u, v) => [cx + u, fy, cz + v], top: [cx, y, cz + half] };
  }
  function hits(s, b, list, r, color) { list.forEach(([u, v]) => s.disc(...b(u, v), r, { plane: 'xz', fill: color || C.ink })); }

  // Simple scalable rifle silhouette along +x (butt at x). Returns anchors.
  // o: { k, stock, metal, barrel (radius), blen, chassis, scope (length) , bipod, brake, scopeColor }
  function miniRifle(s, x, y, z, o) {
    o = Object.assign({ k: 1, stock: C.slate, metal: C.gunmetal, barrel: 0.45, blen: 22, chassis: true, scope: 13, bipod: true, brake: true, scopeColor: C.ink, scopeR: 0.8 }, o || {});
    const k = o.k;
    const zb = z + 3 * k, ax = zb + 3.2 * k;
    if (o.bipod) s.line([[x + 30 * k, y - 0.5, zb], [x + 28 * k, y - 2.8 * k, z]], { color: o.metal, width: 3 * k });
    const prof = o.chassis
      ? [[0, 1.2], [11, 2.4], [13.5, 0.2], [16.5, 0.2], [17.5, 3.2], [33, 3.2], [33, 5.6], [17, 5.7], [14, 5.8], [0.4, 5.6]]
      : [[0, 1.4], [6, 2.2], [13, 3.4], [16, 2.6], [18, 3.6], [30, 4.2], [31, 5.2], [16, 5.6], [12, 5.2], [0.4, 6]];
    s.extrude(prof.map(([u, v]) => [u * k, v * k]), -0.9 * k, 1.8 * k, { plane: 'xz', at: [x + 0.6 * k, y, zb - 3.2 * k], color: o.stock });
    s.box(x, y - 0.95 * k, zb - 2 * k, 1 * k, 1.9 * k, 5 * k, { color: C.black });
    s.lathe(x + 14.5 * k, y, ax, [[0, 0.75 * k], [10 * k, 0.75 * k]], { axis: 'x', color: o.metal, segments: 16 });
    s.lathe(x + 24.5 * k, y, ax, [[0, o.barrel * 1.3 * k], [3 * k, o.barrel * 1.25 * k], [o.blen * k, o.barrel * k]], { axis: 'x', color: o.metal, segments: 16 });
    const mz = x + (24.5 + o.blen) * k;
    if (o.brake) s.lathe(mz, y, ax, [[0, o.barrel * 1.35 * k], [2.4 * k, o.barrel * 1.35 * k]], { axis: 'x', color: C.black, segments: 14 });
    let sc = null;
    if (o.scope) {
      const sz = ax + 2.3 * k * (o.scopeR / 0.8);
      const L = o.scope;
      s.box(x + 16 * k, y - 0.5 * k, ax + 0.5 * k, 1 * k, 1 * k, sz - ax - 0.8 * k, { color: C.black });
      s.box(x + (16 + L * 0.6) * k, y - 0.5 * k, ax + 0.5 * k, 1 * k, 1 * k, sz - ax - 0.8 * k, { color: C.black });
      s.lathe(x + 13 * k, y, sz, [[0, o.scopeR * 1.15 * k], [2.5 * k, o.scopeR * 1.15 * k], [3.5 * k, o.scopeR * 0.75 * k], [(L - 2) * k, o.scopeR * 0.75 * k], [L * k, o.scopeR * 1.3 * k], [(L + 2) * k, o.scopeR * 1.35 * k]], { axis: 'x', color: o.scopeColor, segments: 16 });
      s.lathe(x + (13 + L * 0.45) * k, y, sz + o.scopeR * 0.7 * k, [[0, 0.5 * k], [0.8 * k, 0.5 * k]], { axis: 'z', color: C.amber, segments: 12 });
      sc = [x + (13 + L * 0.5) * k, y, sz + o.scopeR * k];
    }
    if (o.bipod) s.line([[x + 30 * k, y + 0.5, zb], [x + 28 * k, y + 2.8 * k, z]], { color: o.metal, width: 3 * k });
    return { muzzle: [mz + (o.brake ? 2.4 * k : 0), y, ax], scope: sc, action: [x + 19 * k, y, ax + 0.7 * k], stock: [x + 6 * k, y + 0.9 * k, zb], barrel: [x + (24.5 + o.blen * 0.6) * k, y, ax], butt: [x + 0.5 * k, y + 1, zb + 1 * k], cheek: [x + 7 * k, y + 0.9 * k, zb + 2.4 * k], len: (24.5 + o.blen + (o.brake ? 2.4 : 0)) * k };
  }

  // Bare cartridge case (no bullet) along +x, head at x; same profile as ISO.parts.cartridge
  function caseOnly(s, x, y, z, k, o) {
    o = o || {};
    const R = 2.35 * k;
    s.lathe(x, y, z, [[0, R], [0.55 * k, R], [0.6 * k, R * 0.8], [1.3 * k, R * 0.8], [1.6 * k, R], [14.3 * k, R * 0.93], [15.6 * k, R * 0.63], [18.9 * k, R * 0.63]],
      Object.assign({ axis: 'x', color: C.brass, capColor: ISO.shade(C.brass, -0.2), segments: 24 }, o));
    return { R, mouth: x + 18.9 * k, neckR: R * 0.63 };
  }

  // Thermometer standing on z (bulb at the bottom); fill 0..1
  function thermo(s, x, y, h, fill, color) {
    s.shadow(x - 1.4, y - 1.4, 2.8, 2.8);
    s.lathe(x, y, 0, [[0, 1.2], [1.6, 1.2]], { axis: 'z', color: C.silver, segments: 16 });
    s.lathe(x, y, 1.6, [[0, 0.55], [h, 0.55], [h + 0.5, 0]], { axis: 'z', color: C.white, segments: 16 });
    s.sphere(x, y, 2.2, 1.1, { color, rings: 8 });
    s.lathe(x, y, 2.6, [[0, 0.3], [(h - 1) * fill, 0.3]], { axis: 'z', color, segments: 10 });
    for (let i = 1; i <= 4; i++) s.line([[x + 0.4, y + 0.4, 1.6 + h * i / 5], [x + 0.75, y + 0.75, 1.6 + h * i / 5]], { color: C.slate, width: 1.2 });
    return { top: [x, y, 1.6 + h], level: [x, y, 2.6 + (h - 1) * fill] };
  }

  // Floor band running along (+x,-y) — a horizontal strip on screen, ideal for line-ups.
  // Starts at world (x0,y0), length L along (1,-1), half-width W along (1,1).
  function band(s, x0, y0, L, W, g) {
    const c = (t, u) => [x0 + t + u, y0 - t + u, 0];
    s.poly([c(0, -W), c(L, -W), c(L, W), c(0, W)], { fill: 'var(--illus-floor)' });
    if (!g) return;
    const ln = (a, b) => s.line([a, b], { color: 'var(--illus-grid)', width: 1 });
    for (let cx = Math.ceil((x0 - W) / g) * g; cx <= x0 + L + W; cx += g) {
      const t1 = Math.max(0, cx - x0 - W), t2 = Math.min(L, cx - x0 + W);
      if (t2 - t1 > 0.01) ln([cx, y0 + cx - x0 - 2 * t1, 0], [cx, y0 + cx - x0 - 2 * t2, 0]);
    }
    for (let cy = Math.floor((y0 + W) / g) * g; cy >= y0 - L - W; cy -= g) {
      const t1 = Math.max(0, -W - cy + y0), t2 = Math.min(L, W - cy + y0);
      if (t2 - t1 > 0.01) ln([x0 + cy - y0 + 2 * t1, cy, 0], [x0 + cy - y0 + 2 * t2, cy, 0]);
    }
  }

  // Cartridge with lighter meshes (case + bullet), head at x
  function cart(s, x, y, z, k, bullet, seg) {
    caseOnly(s, x, y, z, k, { segments: seg || 18 });
    return P.bullet(s, x + 17.2 * k, y, z, 2.35 * k * 0.56, bullet || 'otm', { segments: seg || 18 });
  }

  // ---- arbitrary-axis solids (ISO's lathe is axis-aligned only). Used for
  // barrels/bullets that run along (+x,-y), i.e. horizontally on screen.
  const LIGHT = (() => { const v = [-0.45, 0.55, 0.85], l = Math.hypot(...v); return v.map((c) => c / l); })();
  const VIEW = [1, 1, 1];
  const add3 = (a, b, k) => [a[0] + b[0] * (k == null ? 1 : k), a[1] + b[1] * (k == null ? 1 : k), a[2] + b[2] * (k == null ? 1 : k)];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const H = nrm3([1, -1, 0]); // screen-horizontal axis
  function tone(hex, n) { const d = dot3(n, LIGHT); return d > 0.45 ? ISO.shade(hex, (d - 0.45) * 0.55) : ISO.shade(hex, -(0.45 - d) * 0.55); }
  function basis(d) { const e1 = nrm3(Math.abs(d[2]) > 0.9 ? cross3(d, [1, 0, 0]) : cross3(d, [0, 0, 1])); return [e1, cross3(e1, d)]; }
  // o: start point, d: unit axis, prof: [[t, r]...]; opt: color, colors[], segments, from/to (angle range), inner (draw the far half seen from inside), opacity
  function lathe3(s, o, d, prof, opt) {
    opt = opt || {};
    const N = opt.segments || 22;
    const [e1, e2] = basis(d);
    const a0 = opt.from != null ? opt.from : 0, a1 = opt.to != null ? opt.to : TAU;
    const full = opt.from == null;
    const at = (t, r, a) => add3(add3(add3(o, d, t), e1, r * Math.cos(a)), e2, r * Math.sin(a));
    const faces = [];
    for (let k = 0; k < prof.length - 1; k++) {
      const [t0, r0] = prof[k], [t1, r1] = prof[k + 1];
      for (let i = 0; i < N; i++) {
        const aa = a0 + (a1 - a0) * i / N, ab = a0 + (a1 - a0) * (i + 1) / N, am = (aa + ab) / 2;
        const radial = add3([0, 0, 0].map((_, j) => e1[j] * Math.cos(am)), e2, Math.sin(am));
        const n = nrm3(add3(radial.map((c) => c * (t1 - t0)), d, -(r1 - r0)));
        const pts = [at(t0, r0, aa), at(t0, r0, ab), at(t1, r1, ab), at(t1, r1, aa)];
        faces.push({ pts, n, col: (opt.colors && opt.colors[k]) || opt.color || C.steel });
      }
    }
    if (full && !opt.noCaps) {
      const cap = (t, r, sign) => { if (r < 1e-6) return; const pts = []; for (let i = 0; i < N; i++) pts.push(at(t, r, TAU * i / N)); faces.push({ pts, n: d.map((c) => c * sign), col: opt.capColor || opt.color || C.steel }); };
      cap(prof[0][0], prof[0][1], -1); cap(prof[prof.length - 1][0], prof[prof.length - 1][1], 1);
    }
    const vis = [];
    faces.forEach((f) => {
      let n = f.n;
      const front = dot3(n, VIEW) > 0;
      if (opt.inner) { if (front) return; n = n.map((c) => -c); } else if (!front) return;
      const c = f.pts.reduce((a, p) => add3(a, p, 1 / f.pts.length), [0, 0, 0]);
      vis.push({ pts: f.pts, fill: tone(f.col, n), depth: c[0] + c[1] + c[2] });
    });
    vis.sort((a, b) => a.depth - b.depth);
    const op = opt.opacity != null ? ` opacity="${opt.opacity}"` : '';
    s.raw('<g>' + vis.map((f) => `<polygon points="${f.pts.map((p) => s.P(p).map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.6" stroke-linejoin="round"${op}/>`).join('') + '</g>');
  }
  // Helix on an arbitrary axis; side 'front' | 'back'
  function helix3(s, o, d, L, r, pitch, opt, side) {
    const [e1, e2] = basis(d);
    const n = Math.max(24, Math.round(L / pitch * 40));
    let seg = [];
    const flush = () => { if (seg.length > 1) s.line(seg, opt); seg = []; };
    for (let i = 0; i <= n; i++) {
      const t = L * i / n, a = t / pitch * TAU + ((opt && opt.phase) || 0);
      const rad = add3(e1.map((c) => c * Math.cos(a)), e2, Math.sin(a));
      const p = add3(add3(o, d, t), rad, r);
      const front = dot3(rad, VIEW) > 0;
      if ((side === 'front') === front) seg.push(p); else { if (seg.length) seg.push(p); flush(); }
    }
    flush();
  }
  // Point at distance t along axis d from o, offset v up (z)
  const along = (o, d, t, v) => add3(add3(o, d, t), [0, 0, 1], v || 0);
  // Bullet profile (same family as ISO.parts.bullet) for lathe3; returns {prof, colors, len}
  function bulletProf(r, type) {
    const sh = { minie: { bt: 0, bear: 1.6, og: 1.4, p: 1.4, mep: 0.25 }, flat: { bt: 0, bear: 1.4, og: 1.6, p: 1.6, mep: 0.35 }, spitzer: { bt: 0, bear: 1.3, og: 2.9, p: 2.1, mep: 0.08 }, otm: { bt: 0.8, bear: 1.6, og: 2.9, p: 2.2, mep: 0.1 } }[type] || { bt: 0.8, bear: 1.6, og: 2.9, p: 2.2, mep: 0.1 };
    const prof = sh.bt ? [[0, r * 0.72], [sh.bt * r, r]] : [[0, r * 0.94], [0.12 * r, r]];
    const b1 = (sh.bt || 0.12) * r + sh.bear * r;
    prof.push([b1, r]);
    for (let i = 1; i <= 9; i++) { const t = i / 9; prof.push([b1 + t * sh.og * r, i === 9 ? sh.mep * r : Math.max(sh.mep * r, r * Math.pow(1 - t, 1 / sh.p))]); }
    prof.push([b1 + sh.og * r + 0.01, 0]);
    return { prof, len: b1 + sh.og * r };
  }

  // ------------------------------------------------------- module heroes

  ISO.module('m-terms', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [320, 62], scale: 8.4 });
    s.floor(-5, -5, 36, 36, { grid: 4 });
    const keys = [[0, 0, 5, C.blue, 'gr'], [15, 0, 3.5, C.amber, 'fps'], [0, 15, 3.5, C.green, 'yd'], [15, 15, 6, C.coral, 'MIL']];
    keys.forEach(([x, y, h, col, t]) => {
      block(s, x, y, 0, 11, 11, h, col);
      faceText(s, [x + 5.5, y + 5.5, h], t, 'top', { size: 34, color: '#fff', weight: 800 });
    });
    return s.svg();
  });

  ISO.module('m-history', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [250, 72], scale: 8 });
    s.floor(-8, -8, 46, 30, { grid: 4 });
    block(s, -2, 2, 0, 10, 10, 3, C.sand);
    s.sphere(3, 7, 6.6, 3.6, { color: C.lead, rings: 10, segments: 18 });
    block(s, 15, 2, 0, 24, 10, 6, C.blue);
    P.bullet(s, 16.5, 7, 9.2, 3.2, 'otm', { segments: 22 });
    s.line([[7.5, 14, 3.2], [17, 14, 3.2]], { color: C.coral, width: 3, arrow: true, arrowSize: 12 });
    faceText(s, [3, 12, 1.5], '1500s', 'y', { size: 18, color: C.ink });
    faceText(s, [27, 12, 3], 'TODAY', 'y', { size: 22, color: '#fff' });
    return s.svg();
  });

  ISO.module('m-platforms', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [130, 72], scale: 7.2 });
    s.floor(-6, -10, 64, 22, { grid: 4 });
    P.mat(s, -2, -6, 58, 12, { color: C.teal });
    P.rifle(s, 0, 0, 0.4, { bag: true });
    return s.svg();
  });

  ISO.module('m-ammo', () => {
    const s = ISO.scene({ w: 640, h: 300, origin: [230, 62], scale: 8.4 });
    s.floor(-6, -6, 40, 34, { grid: 4 });
    block(s, -2, -2, 0, 31, 22, 2.6, C.navy);
    [0, 6, 12].forEach((yy, i) => cart(s, 1, 2.5 + yy, 5, 1, i === 1 ? 'tip' : 'otm', 14));
    return s.svg();
  });

  // ------------------------------------------------------------- m-basics

  ISO.lesson('what-is-lrps', {
    caption: '<b>Errors add up, but the biggest one dominates.</b> The total miss is roughly the square root of the sum of the squares of every error. Fixing the tallest bar (bad data) shrinks the total from 12.3 to 8.5; fixing the smallest (optics) would barely move it. Fix the biggest error first.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 330, origin: [62, 214], scale: 8 });
      const st = 7.5, kz = 1.6;
      const bars = [['Rifle & ammo', 3, C.purple], ['Data', 9, C.coral], ['Wind', 6, C.sky], ['Optics', 2.5, C.amber], ['Shooter', 4.5, C.green]];
      const tot = Math.sqrt(bars.reduce((a, b) => a + b[1] * b[1], 0));
      const fixed = Math.sqrt(tot * tot - 81);
      const put = (i, v, col, name) => {
        const x = st * i, y = -st * i;
        s.floor(x - 1.2, y - 1.2, 7.4, 7.4, { grid: 3.7 });
        block(s, x, y, 0, 5, 5, v * kz, col);
        faceText(s, [x + 2.5, y + 5, Math.max(1.2, v * kz - 1.6)], v.toFixed(1).replace('.0', ''), 'y', { size: 15, color: '#fff' });
        s.text3([x + 6.2, y + 6.2, 0], name, { size: 13, weight: 700, anchor: 'middle', dy: 14 });
      };
      bars.forEach(([n, v, c], i) => put(i, v, c, n));
      s.text3([st * 4.8 + 2.5, -st * 4.8 + 2.5, 3], '=', { size: 30, weight: 800, anchor: 'middle', color: C.slate });
      const ti = 5.6;
      put(ti, tot, C.ink, 'Total miss');
      const x = st * ti, y = -st * ti;
      s.poly([[x, y + 5.05, fixed * kz], [x + 5, y + 5.05, fixed * kz], [x + 5, y + 5.05, 0], [x, y + 5.05, 0]], { stroke: C.mint, width: 2.5, dash: '5 4' });
      s.label([st + 2.5, -st + 2.5, 9 * kz], 'Biggest error: fix it first', { dx: -40, dy: -30, n: '!', color: C.coral });
      s.label([x + 5, y + 5.05, fixed * kz], 'After fixing Data: 8.5', { dx: -30, dy: 70, n: '✓', color: C.green });
      return s.svg();
    },
  });

  ISO.lesson('what-is-lrps', {
    at: 'after:ul',
    caption: '<b>Precision is group size; accuracy is group position.</b> The blue crosshair is where you aimed. Board 2 is the classic long-range problem: a precise rifle with wrong data. A correct dope card moves that tight group onto the aim point.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 320, origin: [88, 170], scale: 11.4 });
      const R = 3.8, cz = 7.6, st = 8.2;
      const sets = [
        [[0.2, 0.3], [-0.3, -0.2], [0.1, -0.4], [-0.25, 0.25], [0.35, -0.05]],
        [[1.9, 1.6], [2.3, 1.3], [1.7, 1.2], [2.1, 1.9], [2.45, 1.65]],
        [[-2.1, 1.0], [1.6, 2.0], [0.8, -2.2], [-1.4, -1.4], [2.2, -0.4]],
        [[-2.6, 2.3], [-0.6, 0.6], [-2.2, -0.4], [-1.0, 2.9], [0.4, 2.1]],
      ];
      const names = [['Precise + accurate', 'tight, on the aim point'], ['Precise only', 'tight, wrong place'], ['Accurate only', 'centred, but scattered'], ['Neither', 'scattered and off']];
      const cols = [C.green, '#d9912a', C.purple, C.coral];
      sets.forEach((hs, i) => {
        const cx = R * 1.25 + st * i, y = -st * i;
        s.floor(cx - 5.4, y - 2.6, 10.8, 5.2, { grid: 2.7 });
        const b = board(s, cx, y, cz, R);
        hits(s, b.face, hs, 0.36, C.ink);
        s.text3([cx + 2.6, y + 2.6, 0], (i + 1) + ' · ' + names[i][0], { size: 13, weight: 800, anchor: 'middle', color: cols[i], dy: 18 });
        s.text3([cx + 2.6, y + 2.6, 0], names[i][1], { size: 11.5, weight: 500, anchor: 'middle', dy: 34 });
      });
      return s.svg();
    },
  });

  ISO.lesson('how-a-shot-fires', {
    caption: '<b>One chain of energy, a few milliseconds long.</b> The firing pin crushes the primer (1), its flash lights the powder (2), gas pressure shoves the bullet into the rifling (3), which spins it (4) until it leaves the muzzle at muzzle velocity (5). Only the bullet leaves; the case stays in the chamber.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 380, origin: [115, 117], scale: 6.4 });
      s.floor(-12, -8, 102, 16, { grid: 4 });
      const k = 1.15, R = 2.35 * k, bore = R * 0.6, z = 7, y = 0;
      const outer = R * 1.5, L = 78;
      s.shadow(-10, -3, L + 10, 6, { opacity: 0.1 });
      // bolt + firing pin
      s.lathe(-9.5, y, z, [[0, R * 1.15], [8.9, R * 1.15]], { axis: 'x', color: C.steel, segments: 20 });
      s.lathe(-0.6, y, z, [[0, 0.45], [0.7, 0.45]], { axis: 'x', color: C.amber, segments: 10 });
      // burning gas inside the case and the bore
      s.lathe(1.6 * k, y, z, [[0, R * 0.85], [14.3 * k, R * 0.8], [15.6 * k, bore * 0.95], [18.9 * k, bore * 0.95]], { axis: 'x', color: C.amber, segments: 18 });
      s.lathe(18.9 * k, y, z, [[0, bore * 0.95], [38 - 18.9 * k, bore * 0.95]], { axis: 'x', color: ISO.shade(C.amber, 0.25), segments: 18 });
      s.sphere(1.0, y, z, 1.2, { color: C.coral, rings: 6, segments: 12 });
      caseOnly(s, 0, y, z, k, { opacity: 0.55 });
      const b = P.bullet(s, 38, y, z, bore, 'otm', { segments: 20 });
      // barrel, translucent so the inside shows
      s.lathe(-0.4, y, z, [[0, outer], [24, outer], [27, outer * 0.8], [L, outer * 0.74]], { axis: 'x', color: C.steel, opacity: 0.26, segments: 24 });
      s.disc(L, y, z, bore, { plane: 'yz', fill: C.ink, opacity: 0.6 });
      helix(s, 24, L, y, z, bore * 1.04, 8.5, { color: C.slate, width: 1.4, opacity: 0.75 }, 'front');
      spin(s, 43, y, z, bore * 1.9, { from: -2.4, to: 1.4 });
      s.line([[L + 1, y, z], [L + 13, y, z]], { color: C.blue, width: 3, dash: '7 5', arrow: true, arrowSize: 11 });
      s.label([-0.3, y + 0.3, z - 0.3], 'Firing pin hits primer', { dx: -16, dy: 96, n: 1, color: C.coral });
      s.label([12, y, z + R * 0.8], 'Powder burns → hot gas', { dx: 34, dy: -56, n: 2, color: '#d9912a' });
      s.label([30, y, z + bore], 'Gas pressure pushes the bullet', { dx: 50, dy: -60, n: 3, color: '#d9912a' });
      s.label([b.tip[0] - 1, y, z + bore * 1.9], 'Rifling grips and spins it', { dx: 60, dy: -50, n: 4, color: C.coral });
      s.label([L + 8, y, z], 'Leaves at muzzle velocity (MV)', { dx: 30, dy: -60, n: 5, color: C.blue });
      s.label([10, y + R * 0.7, z - R * 0.7], 'Case stays in the chamber', { dx: -10, dy: 96, n: '•', color: C.slate });
      return s.svg();
    },
  });
  // ------------------------------------------------------------- m-terms

  ISO.lesson('units', {
    caption: '<b>Every quantity has its own unit and a typical range.</b> Bullets are weighed in grains, distance is yards <i>or</i> meters (never both on one card), speed is feet per second, and twist is inches per full turn of the rifling.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 290, origin: [104, 128], scale: 10.5 });
      const st = 9.24;
      const tile = (i) => { const x = st * i, y = -st * i; s.floor(x - 1, y - 1, 10, 8, { grid: 2 }); return [x, y]; };
      const cap = (i, a, b, col) => {
        const x = st * i, y = -st * i;
        s.text3([x + 7.5, y + 7.5, 0], a, { size: 14, weight: 800, anchor: 'middle', color: col, dy: 16 });
        s.text3([x + 7.5, y + 7.5, 0], b, { size: 11.5, weight: 500, anchor: 'middle', dy: 32 });
      };
      // 1 · scale
      let [x, y] = tile(0);
      block(s, x + 0.2, y + 0.4, 0, 8.6, 6.2, 2.4, C.silver);
      s.poly([[x + 1.2, y + 6.62, 0.5], [x + 7.8, y + 6.62, 0.5], [x + 7.8, y + 6.62, 1.9], [x + 1.2, y + 6.62, 1.9]], { fill: C.ink });
      faceText(s, [x + 4.5, y + 6.62, 1.2], '140.0 gr', 'y', { size: 13, color: C.mint, mono: true });
      s.lathe(x + 4.5, y + 3.5, 2.4, [[0, 2.8], [0.4, 2.9]], { axis: 'z', color: C.white, segments: 22 });
      P.bullet(s, x + 1.8, y + 3.5, 3.6, 1.15, 'otm', { segments: 16 });
      cap(0, 'grains (gr)', '55–300 gr is typical', '#7a5cff');
      // 2 · rulers: same distance, two numbers
      [x, y] = tile(1);
      const L = 8;
      block(s, x, y + 0.4, 0, L, 2.6, 0.7, C.amber);
      block(s, x, y + 3.8, 0, L, 2.6, 0.7, C.sky);
      for (let t = 0; t <= 10; t++) s.line([[x + t * L / 10, y + 0.4, 0.71], [x + t * L / 10, y + (t % 5 ? 1.1 : 1.6), 0.71]], { color: C.ink, width: 1.1 });
      for (let t = 0; t * 10 <= 91.4; t++) { const xx = x + t * 10 / 91.44 * L; s.line([[xx, y + 3.8, 0.71], [xx, y + (t % 5 ? 4.5 : 5), 0.71]], { color: C.ink, width: 1.1 }); }
      faceText(s, [x + L / 2, y + 2.15, 0.72], '100 yd', 'top', { size: 14, color: C.ink });
      faceText(s, [x + L / 2, y + 5.55, 0.72], '91.4 m', 'top', { size: 14, color: C.ink });
      cap(1, 'yards or meters', 'same distance, pick one', '#c9861c');
      // 3 · velocity
      [x, y] = tile(2);
      s.shadow(x + 1, y + 2, 7, 3, { opacity: 0.1 });
      [[-0.9, 2.4], [0, 3.4], [0.9, 2.4]].forEach(([dz, l]) => s.line([[x + 3.2 - l, y + 3.5, 4.4 + dz], [x + 2.9, y + 3.5, 4.4 + dz]], { color: C.sky, width: 2.2 }));
      const vb = P.bullet(s, x + 3.2, y + 3.5, 4.4, 1.15, 'otm', { segments: 16 });
      s.line([[vb.tip[0] + 0.5, y + 3.5, 4.4], [x + 10.5, y + 3.5, 4.4]], { color: C.blue, width: 3, arrow: true, arrowSize: 10 });
      faceText(s, [x + 5.5, y + 3.5, 7.4], '2,700 fps', 'y', { size: 15, color: C.blue });
      cap(2, 'feet per second', '≈ 2.4× the speed of sound', C.blue);
      // 4 · twist 1:8
      [x, y] = tile(3);
      const ty = y + 2.6, tz = 3.4, r = 2;
      s.shadow(x, ty - 2, 9, 4);
      helix(s, x + 0.5, x + 8.5, ty, tz, r, 8, { color: C.coral, width: 3, opacity: 0.4 }, 'back');
      s.lathe(x, ty, tz, [[0, r], [9, r]], { axis: 'x', color: C.steel, opacity: 0.35, segments: 22 });
      helix(s, x + 0.5, x + 8.5, ty, tz, r, 8, { color: C.coral, width: 3 }, 'front');
      s.disc(x + 0.5, ty + r, tz, 0.35, { plane: 'yz', fill: C.coral });
      s.disc(x + 8.5, ty + r, tz, 0.35, { plane: 'yz', fill: C.coral });
      s.line([[x + 0.5, ty + 3.2, 0.05], [x + 8.5, ty + 3.2, 0.05]], { color: C.ink, width: 1.6 });
      s.line([[x + 0.5, ty + 2.6, 0.05], [x + 0.5, ty + 3.8, 0.05]], { color: C.ink, width: 1.6 });
      s.line([[x + 8.5, ty + 2.6, 0.05], [x + 8.5, ty + 3.8, 0.05]], { color: C.ink, width: 1.6 });
      faceText(s, [x + 4.5, ty + 4.3, 0.05], '8 in = 1 turn', 'top', { size: 12, color: 'var(--illus-ink)' });
      cap(3, 'twist rate 1:8', '1 turn per 8 inches', C.coral);
      return s.svg();
    },
  });

  ISO.lesson('vocabulary', {
    at: 'after:ul',
    caption: '<b>POA is where you aimed, POI is where it hit.</b> A group of shots shows the offset; dialing the turret moves the group onto the aim point. When POA and POI match at 100 yd with nothing dialed, the rifle is <b>zeroed</b>.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [100, 196], scale: 11.6 });
      const R = 4.4, cz = 8.2;
      // board 1: before zero
      s.floor(-1, -3, 13, 6, { grid: 3 });
      const b1 = board(s, 5.5, 0, cz, R);
      const g = [[2.3, 1.9], [2.8, 1.5], [2.1, 1.3], [2.5, 2.4], [3.0, 2.1]];
      hits(s, b1.face, g, 0.38, C.ink);
      s.disc(...b1.face(2.55, 1.85), 1.25, { plane: 'xz', stroke: C.coral, width: 2, dash: '4 3' });
      s.line([b1.face(1.75, 1.2), b1.face(0.35, 0.25)], { color: C.coral, width: 2.4, arrow: true, arrowSize: 8 });
      // turret
      const tx = 17, ty = -12;
      s.floor(tx - 3.5, ty - 3.5, 7, 7, { grid: 3.5 });
      s.shadow(tx - 2.4, ty - 2.4, 4.8, 4.8);
      s.lathe(tx, ty, 0, [[0, 2.4], [1.2, 2.4]], { axis: 'z', color: C.ink, segments: 22 });
      s.lathe(tx, ty, 1.2, [[0, 2], [3.4, 2], [3.6, 1.7]], { axis: 'z', color: C.amber, segments: 22 });
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; if (Math.cos(a) + Math.sin(a) > -0.2) s.line([[tx + 2.02 * Math.cos(a), ty + 2.02 * Math.sin(a), 1.5], [tx + 2.02 * Math.cos(a), ty + 2.02 * Math.sin(a), 4.3]], { color: ISO.shade(C.amber, -0.35), width: 1.2 }); }
      s.curve((t) => [tx + 3.1 * Math.cos(t), ty + 3.1 * Math.sin(t), 5.2], 2.2, 0.0, { color: C.coral, width: 2.6, arrow: true, samples: 20 });
      // board 2: zeroed
      const x2 = 26, y2 = -24;
      s.floor(x2 - 6.5, y2 - 3, 13, 6, { grid: 3 });
      const b2 = board(s, x2, y2, cz, R);
      hits(s, b2.face, g.map(([u, v]) => [u - 2.55, v - 1.85]), 0.38, C.ink);
      s.label(b1.face(0, 0), 'Point of aim (POA)', { dx: -50, dy: 92, n: 1, color: C.blue });
      s.label(b1.face(2.9, 2.6), 'Point of impact (POI)', { dx: -150, dy: -44, n: 2, color: C.ink });
      s.label(b1.face(1.3, 0.5), 'Group: 5 shots, one aim', { dx: 0, dy: 74, n: 3, color: C.coral });
      s.label([tx, ty, 5.2], 'Dial the turret', { dx: -30, dy: -50, n: 4, color: '#d9912a' });
      s.label(b2.face(0, 0), 'Zero: POA = POI', { dx: -10, dy: 104, n: 5, color: C.green });
      return s.svg();
    },
  });

  ISO.lesson('abbreviations', {
    caption: '<b>Sort every abbreviation into its bucket.</b> MV, BC, TOF and DA describe flight (ballistics); SD/ES and OTM describe ammo; FFP and MIL belong to the optic. Knowing the bucket tells you which module explains it.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [108, 60], scale: 8.4 });
      const trays = [
        ['Ballistics', C.coral, ['MV', 'BC', 'TOF', 'DA']],
        ['Ammo', C.amber, ['SD/ES', 'OTM', 'FMJ', 'SAAMI']],
        ['Optics', C.purple, ['FFP', 'SFP', 'MIL']],
        ['Shooting', C.green, ['POA', 'POI', 'NPA']],
        ['Gear & matches', C.blue, ['LRF', 'PRS', 'NRL', 'ELR']],
      ];
      const pos = [[0, 0], [16, -16], [32, -32], [25, 9], [41, -7]];
      const order = [0, 1, 2, 3, 4];
      order.forEach((i) => {
        const [name, col, keys] = trays[i];
        const [x, y] = pos[i];
        block(s, x, y, 0, 15, 11, 0.8, ISO.shade(col, 0.55));
        const slots = [[1, 1], [1, 5.9], [8, 1], [8, 5.9]];
        [0, 2, 1, 3].forEach((k) => {
          if (!keys[k]) return;
          const [u, v] = slots[k];
          s.box(x + u, y + v, 0.8, 6, 4.1, 1.5, { color: col });
          faceText(s, [x + u + 3, y + v + 2.05, 2.3], keys[k], 'top', { size: 12.5, color: '#fff', weight: 800 });
        });
        s.text3([x + 15, y + 11, 0], name, { size: 14, weight: 800, anchor: 'middle', color: col === C.amber ? '#c9861c' : col, dy: 20 });
      });
      return s.svg();
    },
  });

})();
