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

  const F = nrm3([1, 1, 0]); // toward the viewer, perpendicular to H
  const Z = [0, 0, 1];
  // Draw shaded faces (each {pts, n, col}) with culling + depth sort, like ISO's mesh
  function faces3(s, faces, opt) {
    opt = opt || {};
    const vis = faces.filter((f) => dot3(f.n, VIEW) > 1e-6).map((f) => {
      const c = f.pts.reduce((a, p) => add3(a, p, 1 / f.pts.length), [0, 0, 0]);
      return { pts: f.pts, fill: tone(f.col, f.n), depth: c[0] + c[1] + c[2] };
    }).sort((a, b) => a.depth - b.depth);
    const op = opt.opacity != null ? ` opacity="${opt.opacity}"` : '';
    s.raw('<g>' + vis.map((f) => `<polygon points="${f.pts.map((p) => s.P(p).map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.6" stroke-linejoin="round"${op}/>`).join('') + '</g>');
  }
  // Prism: 2D profile (u along U, v along V) extruded along W from w0..w1, at origin o
  function oext(s, o, prof, w0, w1, color, opt) {
    opt = opt || {};
    const U = opt.U || H, V = opt.V || Z, W = opt.W || F;
    let area = 0;
    for (let i = 0; i < prof.length; i++) { const p = prof[i], q = prof[(i + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const pr = area > 0 ? prof : prof.slice().reverse();
    const at = (u, v, w) => add3(add3(add3(o, U, u), V, v), W, w);
    const faces = [
      { pts: pr.map(([u, v]) => at(u, v, w1)), n: W, col: opt.face || color },
      { pts: pr.map(([u, v]) => at(u, v, w0)), n: W.map((c) => -c), col: opt.face || color },
    ];
    for (let i = 0; i < pr.length; i++) {
      const j = (i + 1) % pr.length, du = pr[j][0] - pr[i][0], dv = pr[j][1] - pr[i][1];
      const n = nrm3(add3(U.map((c) => c * dv), V, -du));
      faces.push({ pts: [at(pr[i][0], pr[i][1], w0), at(pr[j][0], pr[j][1], w0), at(pr[j][0], pr[j][1], w1), at(pr[i][0], pr[i][1], w1)], n, col: opt.side || color });
    }
    faces3(s, faces, opt);
  }
  // Box aligned with H (length), F (depth, centred) and Z (height); o = left-bottom-centre
  function obox(s, o, L, D, Ht, color, opt) { oext(s, o, [[0, 0], [L, 0], [L, Ht], [0, Ht]], -D / 2, D / 2, color, opt); }
  // Text on the viewer-facing side of an H-aligned object is plain screen text
  // Horizontal precision rifle along H (butt at o, o[2] = ground). Returns anchors.
  // o: { stock, metal, blen, br (barrel radius), sporter, scope (len), scopeR, bipod, brake, rest, bag }
  // Tilted axis: runs ~10° below screen-horizontal, so depth still reads as iso
  const T = nrm3([1, -0.62, 0]);
  const perp = (U) => nrm3([-U[1], U[0], 0]); // horizontal, toward the viewer
  // Floor tile aligned with axis U (length L) and its perpendicular (depth ±D), grid g
  function tile(s, o, U, L, D, g) {
    const W = perp(U);
    const at = (u, w) => add3(add3([o[0], o[1], 0], U, u), W, w);
    s.poly([at(0, -D), at(L, -D), at(L, D), at(0, D)], { fill: 'var(--illus-floor)' });
    if (g) {
      for (let u = g; u < L - 0.01; u += g) s.line([at(u, -D), at(u, D)], { color: 'var(--illus-grid)', width: 1 });
      for (let w = -D + g; w < D - 0.01; w += g) s.line([at(0, w), at(L, w)], { color: 'var(--illus-grid)', width: 1 });
    }
  }
  function hRifle(s, o, opt) {
    opt = Object.assign({ U: H, stock: C.slate, metal: C.gunmetal, blen: 24, br: 0.42, sporter: false, scope: 14, scopeR: 0.8, bipod: true, brake: true, rest: false, bag: false, mag: true }, opt || {});
    const U = opt.U, W = perp(U), ax3 = { U, W };
    const zb = o[2] + 3.4, ax = zb + 3.5;
    const A = (u, v) => along([o[0], o[1], 0], U, u, v);
    const bipodAt = 31;
    if (opt.bipod) s.line([A(bipodAt, zb), add3(A(bipodAt - 1.5, o[2]), W, -1.8)], { color: opt.metal, width: 3 });
    if (opt.bag) obox(s, A(2.5, o[2]), 6, 3.6, zb - o[2] + 0.3, C.sand, ax3);
    const prof = opt.sporter
      ? [[0, 1.6], [7, 2.6], [13, 3.4], [16.5, 2.4], [18.5, 3.6], [33, 4.4], [34, 5.5], [17, 5.8], [12.5, 5.2], [0.4, 6.2]]
      : [[0, 1.2], [12, 2.6], [14.5, 0.2], [17.5, 0.2], [18.5, 3.4], [36, 3.4], [36, 6], [19, 6.1], [15, 6.2], [0.4, 6]];
    if (opt.rest) { obox(s, A(30, o[2]), 4, 3.2, zb - o[2] - 0.4, C.slate, ax3); obox(s, A(30.5, zb - 0.6), 3, 2.4, 0.6, C.black, ax3); }
    oext(s, A(0.9, zb - 3.4), prof, -0.9, 0.9, opt.stock, ax3);
    obox(s, A(0, zb - 2.2), 1.1, 2.1, opt.sporter ? 5.8 : 5.6, C.black, ax3);
    if (!opt.sporter) obox(s, A(5, zb + 2.6), 8, 1.5, 1.1, ISO.shade(opt.stock, -0.15), ax3);
    if (opt.mag) obox(s, A(20, zb - 2.2), 2.6, 1.3, 2.4, C.black, ax3);
    lathe3(s, A(15.5, ax), U, [[0, 0.8], [11, 0.8]], { color: opt.metal, segments: 14 });
    lathe3(s, A(26.5, ax), U, [[0, opt.br * 1.45], [3, opt.br * 1.35], [opt.blen, opt.br]], { color: opt.metal, segments: 14 });
    const knob = add3(A(21.6, ax - 0.9), W, 2.4);
    if (opt.handle !== false) { s.line([A(21.6, ax), knob], { color: C.steel, width: 2.6 }); s.sphere(...knob, 0.55, { color: C.steel, rings: 5, segments: 10 }); }
    let muz = 26.5 + opt.blen;
    if (opt.brake) { lathe3(s, A(muz, ax), U, [[0, opt.br * 1.5], [2.8, opt.br * 1.5]], { color: C.black, segments: 12 }); muz += 2.8; }
    const sz = ax + 1.6 + opt.scopeR * 1.2;
    let sc = null;
    if (opt.scope) {
      const L = opt.scope, sR = opt.scopeR, s0 = 13.5;
      obox(s, A(17.2, ax + 0.5), 1, 1.1, sz - ax - 0.7, C.black, ax3);
      obox(s, A(s0 + L * 0.72, ax + 0.5), 1, 1.1, sz - ax - 0.7, C.black, ax3);
      lathe3(s, A(s0, sz), U, [[0, sR * 1.2], [3, sR * 1.2], [4.2, sR * 0.75], [L - 2.5, sR * 0.75], [L - 1, sR * 1.35], [L + 1.5, sR * 1.4]], { color: C.ink, segments: 14 });
      s.lathe(...A(s0 + L * 0.5, sz + sR * 0.6), [[0, 0.55], [0.9, 0.55]], { axis: 'z', color: C.amber, segments: 12 });
      sc = A(s0 + L * 0.5, sz + sR);
    }
    if (opt.bipod) s.line([A(bipodAt, zb), add3(A(bipodAt - 1.5, o[2]), W, 1.8)], { color: opt.metal, width: 3 });
    return { A, U, W, zb, ax, sz, knob, muzzle: A(muz, ax), scope: sc, eye: A(13.5, sz), cheek: A(9, zb + 3.7), butt: A(0.5, zb + 0.5), trigger: A(17.9, zb - 1), grip: A(16, zb - 1.5), mag: A(21.3, zb - 1.6), action: A(21, ax + 0.8), barrel: A(26.5 + opt.blen * 0.6, ax), forend: A(28, zb), len: muz };
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

  // ------------------------------------------------------------ m-history

  ISO.lesson('history-rifling', {
    caption: '<b>Spin was the missing ingredient.</b> A smoothbore ball leaves with random wobble and tumbles off course (useful only to ~50–100 yd). Spiral rifling spins the bullet so it stays point-first like a gyroscope, and the Minié ball made rifles as fast to load as muskets.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 310, origin: [60, 128], scale: 8 });
      const z = 5;
      const lane = (o, rifled) => {
        band(s, o[0] - 1.5, o[1] + 1.5, 45, 3, 3);
        const b = [o[0], o[1], z];
                if (rifled) helix3(s, b, H, 21, 0.95, 5, { color: C.slate, width: 1.4, opacity: 0.5 }, 'back');
        if (!rifled) s.sphere(...along(b, H, 17.5), 0.85, { color: C.lead, rings: 6, segments: 12 });
        else { const bp = bulletProf(0.85, 'minie'); lathe3(s, along(b, H, 15), H, bp.prof, { color: C.lead, segments: 12 }); }
        lathe3(s, b, H, [[0, 1.5], [3, 1.5], [3.4, 1.25], [21, 1.15]], { color: rifled ? C.gunmetal : C.wood, opacity: 0.38, segments: 16 });
        if (rifled) helix3(s, b, H, 21, 0.95, 5, { color: C.ink, width: 1.6, opacity: 0.8 }, 'front');
      };
      const A = [0, 0], B = [17, 17];
      // lane A: smoothbore, tumbling ball
      lane(A, false);
      const bA = [A[0], A[1], z];
      s.poly([along(bA, H, 21.5, 0.8), along(bA, H, 62, 4.4), along(bA, H, 62, -4.4), along(bA, H, 21.5, -0.8)], { fill: C.coral, opacity: 0.13 });
      const wob = [[28, 0.6], [37, -1.5], [46, 1.9], [55, -3.3]];
      s.curve((t) => { const u = 21.5 + t * 36; const v = 0.6 * Math.sin(t * 7.5) * (0.4 + t * 5) ; return along(bA, H, u, v * 0.62 + (t > 0.9 ? -0.4 : 0)); }, 0, 1, { color: C.coral, width: 2, dash: '3 5', samples: 60 });
      wob.forEach(([u, v], i) => {
        const c = along(bA, H, u, v);
        s.sphere(...c, 0.95, { color: C.lead, rings: 6, segments: 12 });
        const ph = i * 1.7;
        s.curve((t) => add3(add3(c, H, 1.5 * Math.cos(t + ph)), [0, 0, 1], 1.5 * Math.sin(t + ph)), 0, 2.4, { color: C.coral, width: 1.6, arrow: true, arrowSize: 6, samples: 14 });
      });
      // lane B: rifled, spinning Minié
      lane(B, true);
      const bB = [B[0], B[1], z];
      s.poly([along(bB, H, 21.5, 0.5), along(bB, H, 62, 1.1), along(bB, H, 62, -1.1), along(bB, H, 21.5, -0.5)], { fill: C.green, opacity: 0.16 });
      s.line([along(bB, H, 21.5), along(bB, H, 62)], { color: C.green, width: 2, dash: '3 5' });
      const bp = bulletProf(1, 'minie');
      [30, 44, 58].forEach((u) => {
        lathe3(s, along(bB, H, u - bp.len / 2), H, bp.prof, { color: C.lead, segments: 12 });
        s.curve((t) => add3(add3(along(bB, H, u - 0.6), [-0.7071, -0.7071, 0], 1.7 * Math.cos(t)), [0, 0, 1], 1.7 * Math.sin(t)), -2.6, 1.6, { color: C.green, width: 1.8, arrow: true, arrowSize: 6, samples: 18 });
      });
      s.text3(along(bA, H, -0.5, 4.2), 'Smoothbore musket · 1500s–1800s', { size: 14, weight: 800, color: C.coral });
      s.text3(along(bB, H, -0.5, 4.2), 'Rifled barrel + Minié ball · 1849', { size: 14, weight: 800, color: '#239e6f' });
      s.label(along(bA, H, 46, 1.9 + 0.8), 'No spin → the ball tumbles', { dx: 30, dy: -30, n: 1, color: C.coral });
      s.label(along(bA, H, 62, 4.4), 'Wide spread past ~100 yd', { dx: -20, dy: 66, n: 2, color: C.coral });
      s.label(along(bB, H, 12, 1.1), 'Spiral grooves (rifling)', { dx: 10, dy: 56, n: 3, color: '#239e6f' });
      s.label(along(bB, H, 44 - 0.6, 1.7), 'Spin keeps it point-first', { dx: 20, dy: 52, n: 4, color: '#239e6f' });
      return s.svg();
    },
  });

  ISO.lesson('history-rifling', {
    at: 'after:.timeline',
    caption: '<b>The Minié ball: loose going in, tight going out.</b> It is smaller than the bore, so it drops down the barrel as fast as a musket ball. On firing, gas pressure flares its hollow skirt outward into the grooves, so it still grips the rifling and spins.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 320, origin: [50, 160], scale: 13 });
      const Rl = 2.5, Rg = 3, Ro = 4.1;
      const sec = (o, pts, fill, stroke) => s.poly(pts.map(([t, v]) => along(o, H, t, v)), { fill, stroke: stroke || 'none', width: 1.2 });
      const barrel = (o, L) => {
                lathe3(s, o, H, [[0, Rg], [L, Rg]], { color: C.steel, from: -Math.PI / 2, to: Math.PI / 2, inner: true, segments: 14 });
        for (let k = 0; k < 4; k++) helix3(s, o, H, L, Rg * 0.98, 16, { color: ISO.shade(C.steel, -0.35), width: 3, opacity: 0.55, phase: k * TAU / 4 }, 'back');
        [1, -1].forEach((sg) => {
          const pts = [[0, sg * Ro]];
          for (let t = 0; t < L - 0.01; t += 1.6) pts.push([t, sg * (Math.floor(t / 1.6) % 2 ? Rl : Rg)], [Math.min(L, t + 1.6), sg * (Math.floor(t / 1.6) % 2 ? Rl : Rg)]);
          pts.push([L, sg * Ro]);
          sec(o, pts, ISO.shade(C.steel, sg > 0 ? -0.05 : -0.2), ISO.shade(C.steel, -0.4));
        });
      };
      const minie = (o, b, base, rb) => {
        const top = [[b, base], [b + 1.6, rb], [b + 3.6, rb], [b + 3.8, rb - 0.25], [b + 4.1, rb], [b + 4.4, rb], [b + 4.6, rb - 0.25], [b + 4.9, rb]];
        for (let i = 1; i <= 8; i++) { const t = i / 8; top.push([b + 4.9 + t * 2.6, Math.max(0.4, rb * Math.pow(1 - t, 1 / 1.5))]); }
        top.push([b + 7.6, 0]);
        const pts = top.concat(top.slice(0, -1).reverse().map(([t, v]) => [t, -v]));
        sec(o, pts, ISO.shade(C.lead, 0.25), ISO.shade(C.lead, -0.35));
        sec(o, [[b, base * 0.62], [b + 2.4, 0.35], [b + 2.6, 0], [b + 2.4, -0.35], [b, -base * 0.62]], ISO.shade(C.lead, -0.45));
        return { cav: [b + 1, 0], tip: b + 7.6 };
      };
      const o1 = [0, 0, 0], o2 = [14.8, -14.8, 0];
      // stage 1: loading
      barrel(o1, 18);
      const m1 = minie(o1, 7.5, 2.1, 2.1);
      s.line([along(o1, H, 17, Ro + 1.1), along(o1, H, 10, Ro + 1.1)], { color: C.blue, width: 2.6, arrow: true, arrowSize: 9 });
      // stage 2: firing
      barrel(o2, 18);
      sec(o2, [[0.2, Rg], [4.8, Rg], [4.8, -Rg], [0.2, -Rg]], C.amber);
      const m2 = minie(o2, 5, Rg, Rl + 0.05);
      [[0.8, 1.1], [0.8, 0], [0.8, -1.1]].forEach(([t, v]) => s.line([along(o2, H, t, v), along(o2, H, t + 5.6 - Math.abs(v) * 1.6, v)], { color: C.coral, width: 2.4, arrow: true, arrowSize: 8 }));
      [1, -1].forEach((sg) => s.line([along(o2, H, 6.1, sg * 1.1), along(o2, H, 6.1, sg * 2.6)], { color: C.coral, width: 2.2, arrow: true, arrowSize: 7 }));
      s.text3(along(o1, H, 0, Ro + 1.0), 'Loading', { size: 15, weight: 800, color: C.blue });
      s.text3(along(o2, H, 0, Ro + 1.0), 'Firing', { size: 15, weight: 800, color: C.coral });
      s.label(along(o1, H, 11, -2.1), 'Smaller than the bore: slides in', { dx: -40, dy: 74, n: 1, color: C.blue });
      s.label(along(o1, H, 8.4, 0.6), 'Hollow base', { dx: 30, dy: -104, n: 2, color: C.slate });
      s.label(along(o2, H, 2.5, 1.1), 'Gas pressure', { dx: -30, dy: -82, n: 3, color: C.coral });
      s.label(along(o2, H, 5.6, -Rg + 0.15), 'Skirt flares into the grooves', { dx: -30, dy: 76, n: 4, color: C.coral });
      s.label(along(o2, H, 15.4, Rl), 'Lands & grooves (rifling)', { dx: -20, dy: -76, n: 5, color: C.slate });
      return s.svg();
    },
  });

  ISO.lesson('history-smokeless', {
    caption: '<b>Bullets evolved toward lower drag.</b> Each step kept speed longer: a conical Minié replaced the ball, smokeless powder and jackets allowed high velocity, and the pointed spitzer nose and tapered boat tail cut air drag — the shape you shoot today.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 300, origin: [86, 150], scale: 9 });
      const st = 8.1;
      const items = [
        ['round', 1.6, C.lead, 'Round ball', '1500s'],
        ['minie', 1.6, C.lead, 'Minié ball', '1849'],
        ['flat', 1.45, C.copper, 'Flat-nose', '1886'],
        ['spitzer', 1.35, C.copper, 'Spitzer', '~1905'],
        ['otm', 1.25, C.copper, 'Boat-tail', 'today'],
      ];
      const lens = { round: 3, minie: 3.12, flat: 3.12, spitzer: 4.32, otm: 5.3 };
      items.forEach(([type, r, col, name, date], i) => {
        const x = st * i, y = -st * i, h = 1.8 + i * 0.9;
        s.floor(x - 1, y - 1, 9, 9, { grid: 3 });
        block(s, x, y, 0, 7, 7, h, i === 4 ? C.blue : ISO.shade(C.blue, 0.45 - i * 0.08));
        faceText(s, [x + 3.5, y + 7, h / 2], date, 'y', { size: 14, color: i >= 3 ? '#fff' : C.navy });
        const L = lens[type] * r;
        if (type === 'round') s.sphere(x + 3.5, y + 3.5, h + r, r, { color: col, rings: 8, segments: 16 });
        else P.bullet(s, x + 3.5 - L / 2, y + 3.5, h + r, r, type, { color: col, segments: 16 });
        s.text3([x + 7.6, y + 7.6, 0], name, { size: 13.5, weight: 800, anchor: 'middle', dy: 14 });
      });
      s.line([[3.5 + 11, 3.5 + 11, 0], [st * 4 + 3.5 + 11, -st * 4 + 3.5 + 11, 0]], { color: C.green, width: 3, arrow: true, arrowSize: 11 });
      s.text3([st * 2 + 3.5 + 11, -st * 2 + 3.5 + 11, 0], 'less drag · keeps its speed longer', { size: 12.5, weight: 700, anchor: 'middle', dy: -7, color: '#239e6f' });
      return s.svg();
    },
  });

  ISO.lesson('history-modern', {
    caption: '<b>Modern precision = measure, then compute.</b> The rangefinder measures distance, the weather meter measures the air, the Doppler chronograph measures muzzle velocity, and a solver turns those into a MIL correction for the reticle. The dope card is the paper backup of the same model.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [214, 92], scale: 7.4 });
      s.floor(-6, -8, 64, 30, { grid: 4 });
      P.mat(s, -2, -6, 58, 11, { color: C.teal });
      // Doppler radar chronograph beside the muzzle, beam downrange
      s.poly([[52, -6.5, 1.6], [62, -11, 0.5], [62, -2, 4.5]], { fill: C.mint, opacity: 0.35 });
      block(s, 49.5, -8, 0, 2.6, 3, 3.2, C.green);
      s.disc(52.12, -6.5, 1.8, 1, { plane: 'yz', fill: ISO.shade(C.green, 0.5), stroke: ISO.shade(C.green, -0.3) });
      const r = P.rifle(s, 0, 0, 0.4, { bag: true });
      // dope card
      block(s, 2, 9.5, 0, 6, 4.4, 0.15, C.paper);
      for (let i = 0; i < 4; i++) s.line([[2.6, 10.4 + i * 0.9, 0.16], [7.4, 10.4 + i * 0.9, 0.16]], { color: C.steel, width: 1.2 });
      // phone with solver
      block(s, 11, 9.5, 0, 7.2, 3.6, 0.4, C.ink);
      s.poly([[11.4, 9.9, 0.42], [17.8, 9.9, 0.42], [17.8, 12.7, 0.42], [11.4, 12.7, 0.42]], { fill: '#1d3557' });
      s.curve((t) => [11.8 + t * 5.6, 11.3 + 0.0, 0.43 + 0 * t], 0, 1, { color: C.sky, width: 1 });
      s.curve((t) => [11.8 + t * 5.6, 12.4 - Math.sin(Math.PI * t * 0.9) * 2.0 + t * 0.6, 0.43], 0, 1, { color: C.amber, width: 2 });
      // weather meter
      block(s, 22, 10.2, 0, 2.2, 1.3, 4.2, C.amber);
      s.poly([[22.3, 11.52, 1.2], [23.9, 11.52, 1.2], [23.9, 11.52, 2.8], [22.3, 11.52, 2.8]], { fill: C.ink });
      s.lathe(23.1, 10.2, 5.3, [[0, 1], [1.3, 1]], { axis: 'y', color: C.ink, segments: 18 });
      s.disc(23.1, 11.52, 5.3, 0.7, { plane: 'xz', fill: C.silver, stroke: C.slate });
      // laser rangefinder
      block(s, 28, 9.8, 0, 4.6, 2.4, 2.6, C.slate);
      s.lathe(32.6, 10.4, 1.5, [[0, 0.5], [0.3, 0.5]], { axis: 'x', color: C.ink, segments: 14 });
      s.lathe(32.6, 11.6, 1.5, [[0, 0.5], [0.3, 0.5]], { axis: 'x', color: C.ink, segments: 14 });
      s.line([[33, 11.6, 1.5], [44, 11.6, 1.5]], { color: C.red, width: 2, dash: '5 4' });
      s.label(r.scope, 'Mil reticle · 1970s', { dx: -60, dy: -46, n: 1 });
      s.label([2.6, 13.9, 0.2], 'Dope card: paper backup', { dx: -90, dy: 30, n: 6, color: C.slate });
      s.label([14, 12.8, 0.5], 'Ballistic solver · 2000s', { dx: -100, dy: 60, n: 4, color: C.purple });
      s.label([23.1, 11.5, 1.2], 'Weather meter · 1990s', { dx: -60, dy: 74, n: 3, color: '#d9912a' });
      s.label([30, 12.2, 2.6], 'Laser rangefinder · 1990s', { dx: 30, dy: 64, n: 2, color: C.coral });
      s.label([51, -6.5, 3.2], 'Doppler chronograph · 2010s', { dx: 10, dy: -60, n: 5, color: C.green });
      return s.svg();
    },
  });

  // ---------------------------------------------------------- m-platforms

  // Row offset that moves straight down the screen when using axis T
  const rowOff = (r) => add3(perp(T).map((c) => c * r), T, 0.235 * r);

  ISO.lesson('actions', {
    caption: '<b>Bolt action: you cycle it. Semi-auto: the shot cycles it.</b> On a bolt gun nothing moves during the shot until your hand lifts, pulls, pushes and closes the bolt. A semi-auto taps gas from the barrel to drive the bolt carrier back, and a spring returns it — faster, but with more parts moving.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 400, origin: [60, 150], scale: 9 });
      const ax3 = { U: T, W: perp(T) }, W = perp(T);
      // --- row 1: bolt action
      tile(s, add3([0, 0, 0], W, 0), T, 52, 3.6, 4);
      const r = hRifle(s, [0, 0, 0], { U: T, blen: 22 });
      const kn = add3(r.knob, W, 0.6);
      const up = add3(kn, Z, 2.8);
      s.curve((t) => add3(add3(kn, Z, 2.6 * Math.sin(t * Math.PI / 2)), W, -0.8 * (1 - Math.cos(t * Math.PI / 2))), 0.15, 1, { color: C.blue, width: 3, arrow: true, arrowSize: 9, samples: 12 });
      s.line([add3(add3(up, W, -0.8), T, -0.4), add3(add3(up, W, -0.8), T, -7)], { color: C.blue, width: 3, arrow: true, arrowSize: 9 });
      s.line([add3(add3(kn, Z, 1.2), T, -7), add3(add3(kn, Z, 1.2), T, -1)], { color: C.green, width: 3, arrow: true, arrowSize: 9 });
      s.curve((t) => add3(add3(add3(kn, T, -0.6), Z, 1.0 - 1.2 * t), W, 0.4 * t), 0, 1, { color: C.green, width: 3, arrow: true, arrowSize: 9, samples: 6 });
      [['1', add3(add3(kn, T, 1.4), Z, 1.6)], ['2', add3(add3(up, T, -7.8), Z, 0)], ['3', add3(add3(kn, T, -8), Z, 1.2)], ['4', add3(add3(kn, T, -1.6), Z, -0.6)]].forEach(([t, p], i) => s.text3(p, t, { size: 14, weight: 800, color: i < 2 ? C.blue : '#239e6f', anchor: 'middle', dy: 5 }));
      s.text3(r.A(0, 13), 'Bolt action', { size: 17, weight: 800, color: C.blue });
      s.text3(r.A(0, 13), '1 lift · 2 pull back · 3 push forward · 4 close — by hand', { size: 12.5, weight: 500, dy: 18 });
      // --- row 2: semi-auto (AR style) with the gas loop
      const o2 = rowOff(24);
      tile(s, o2, T, 52, 3.6, 4);
      const A = (u, v) => along([o2[0], o2[1], 0], T, u, v);
      const zb = 3.4, ax = zb + 3.6;
      s.line([A(33, zb + 1), add3(A(31.5, 0), W, -1.8)], { color: C.gunmetal, width: 3 });
      lathe3(s, A(2, ax - 0.6), T, [[0, 0.75], [10, 0.75]], { color: C.black, segments: 12 });
      oext(s, A(0, zb - 1.6), [[0, 0], [1.2, 0], [5.5, 3.6], [6, 5.4], [1, 5.6], [0, 4.8]], -0.8, 0.8, C.black, ax3);
      oext(s, A(15, zb - 2.6), [[0, 0], [1.5, 0], [3.4, 2.8], [1.8, 2.9]], -0.7, 0.7, C.black, ax3);
      oext(s, A(19.6, zb - 3.4), [[0.4, 0], [3, 0.4], [3.1, 4], [0, 4]], -0.7, 0.7, C.black, ax3);
      obox(s, A(13.5, ax - 0.9), 8, 1.2, 1.6, C.amber, ax3); // bolt carrier
      obox(s, A(12, zb + 0.2), 14, 2.2, 4.4, C.gunmetal, Object.assign({ opacity: 0.45 }, ax3)); // receiver (see-through)
      lathe3(s, A(26, ax), T, [[0, 0.45], [28, 0.42]], { color: C.gunmetal, segments: 12 });
      obox(s, A(38, ax - 0.7), 1.6, 1.4, 2.6, C.slate, ax3);
      s.line([A(38.8, ax + 1.6), A(22, ax + 1.6), A(22, ax + 0.4)], { color: C.coral, width: 3.2 });
      lathe3(s, A(26, ax + 0.2), T, [[0, 1.6], [12, 1.6]], { color: C.slate, opacity: 0.32, segments: 14 });
      obox(s, A(15, ax + 2.2), 1, 1.1, 1.0, C.black, ax3); obox(s, A(23, ax + 2.2), 1, 1.1, 1.0, C.black, ax3);
      lathe3(s, A(11.5, ax + 3.6), T, [[0, 0.95], [2.5, 0.95], [3.5, 0.6], [12, 0.6], [13, 1.0], [15, 1.05]], { color: C.ink, segments: 14 });
      s.line([A(33, zb + 1), add3(A(31.5, 0), W, 1.8)], { color: C.gunmetal, width: 3 });
      s.line([A(38, ax + 6.4), A(29, ax + 6.4)], { color: C.coral, width: 3, arrow: true, arrowSize: 10 });
      s.line([add3(A(13.5, ax - 1.6), W, 1.8), add3(A(6.5, ax - 1.6), W, 1.8)], { color: C.blue, width: 3, arrow: true, arrowSize: 9 });
      s.line([add3(A(6.5, ax - 3.1), W, 1.8), add3(A(13.5, ax - 3.1), W, 1.8)], { color: C.green, width: 3, arrow: true, arrowSize: 9 });
      s.text3(A(0, 13), 'Semi-automatic', { size: 17, weight: 800, color: C.coral });
      s.text3(A(0, 13), 'the fired round’s own gas cycles the bolt', { size: 12.5, weight: 500, dy: 18 });
      s.label(A(34, ax + 1.6), 'Gas tapped from the barrel runs back', { dx: 30, dy: -46, n: 1, color: C.coral });
      s.label(add3(A(10, ax - 1.6), W, 1.8), 'Carrier slams back, spring returns it', { dx: 40, dy: 66, n: 2, color: C.blue });
      s.label(r.A(24, r.ax + 0.6), 'Locked shut during the shot', { dx: 70, dy: -40, n: '✓', color: C.green });
      return s.svg();
    },
  });

  ISO.lesson('barrels', {
    caption: '<b>The rifling is a spiral: lands grip, grooves give room.</b> Twist rate is how far the bullet travels for one full turn — 1:8 means one turn every 8 inches. The muzzle crown is the last thing the bullet touches, so damage there ruins accuracy.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [40, 120], scale: 13.5 });
      const o = [0, 0, 0], L = 21, Rb = 1.9, Ro = 3.1, pitch = 8;
      helix3(s, add3(o, H, 2), H, 16, Rb, pitch, { color: C.coral, width: 3, opacity: 0.3, phase: Math.PI }, 'back');
      helix3(s, add3(o, H, 2), H, 16, Rb, pitch, { color: '#d6343a', width: 3, opacity: 0.35 }, 'back');
      lathe3(s, o, H, [[0, Ro], [L, Ro * 0.94]], { color: C.steel, opacity: 0.3, segments: 22 });
      helix3(s, add3(o, H, 2), H, 16, Rb, pitch, { color: C.coral, width: 2.6, opacity: 0.6, phase: Math.PI }, 'front');
      helix3(s, add3(o, H, 2), H, 16, Rb, pitch, { color: '#d6343a', width: 4 }, 'front');
      const [e1] = basis(H);
      [0, 1, 2].forEach((k) => s.sphere(...add3(add3(o, H, 2 + k * pitch), e1, Rb), 0.32, { color: '#d6343a', rings: 4, segments: 8 }));
      const dz = -Ro - 1.4;
      s.line([along(o, H, 2, dz), along(o, H, 2 + 2 * pitch, dz)], { color: C.ink, width: 1.8 });
      [2, 2 + pitch, 2 + 2 * pitch].forEach((u) => s.line([along(o, H, u, dz - 0.5), along(o, H, u, dz + 0.5)], { color: C.ink, width: 1.8 }));
      s.text3(along(o, H, 2 + pitch / 2, dz - 1.3), '8 in = 1 full turn', { size: 13, weight: 800, anchor: 'middle', color: 'var(--illus-ink)' });
      s.text3(along(o, H, 2 + pitch * 1.5, dz - 1.3), '8 in = next turn', { size: 12, weight: 600, anchor: 'middle', color: C.slate });
      s.text3(along(o, H, 0, Ro + 1.6), 'Twist 1:8', { size: 18, weight: 800, color: C.coral });
      // the muzzle end-on: a slice standing on its own (its +x face looks at us)
      const cx = 35, cy = -12, cz = 4.4, R = 4.2, rb = 1.3, rg = 1.65, n = 6;
      s.shadow(cx - 1.4, cy - R, 3, R * 2);
      s.lathe(cx - 1.8, cy, cz, [[0, R], [1.8, R]], { axis: 'x', color: C.steel, segments: 28 });
      const ring = [];
      for (let i = 0; i < n * 2; i++) {
        const a0 = i / (n * 2) * TAU, a1 = (i + 1) / (n * 2) * TAU, rr = i % 2 ? rb : rg;
        for (let j = 0; j <= 3; j++) { const a = a0 + (a1 - a0) * j / 3; ring.push([cx, cy + rr * Math.cos(a), cz + rr * Math.sin(a)]); }
      }
      s.disc(cx, cy, cz, R * 0.8, { plane: 'yz', fill: ISO.shade(C.steel, 0.25), stroke: ISO.shade(C.steel, -0.25), width: 1.4 });
      s.poly(ring, { fill: C.ink, stroke: C.gunmetal, width: 1 });
      const ang = (k) => TAU * k / 12;
      s.label([cx, cy + rb * Math.cos(ang(1.5)), cz + rb * Math.sin(ang(1.5))], 'Land (ridge)', { dx: 60, dy: -46, n: 1, color: C.slate });
      s.label([cx, cy + rg * Math.cos(ang(6.5)), cz + rg * Math.sin(ang(6.5))], 'Groove (channel)', { dx: 60, dy: 56, n: 2, color: C.slate });
      s.label([cx, cy - R * 0.9, cz + 1.4], 'Crown: protect it', { dx: -40, dy: -60, n: 3, color: C.coral });
      s.text3([cx, cy, cz - R], 'Muzzle, end-on', { size: 13, weight: 700, anchor: 'middle', dy: 24 });
      return s.svg();
    },
  });

  ISO.lesson('barrels', {
    at: 'after:table',
    caption: '<b>A longer barrel buys velocity, slowly.</b> The gas keeps pushing as long as the bullet is still in the bore — typically ~15–35 fps per extra inch (≈25 shown). A heavier contour adds no speed, but it stays steadier and heats up more slowly.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [60, 86], scale: 9.4 });
      const ax3 = { U: T, W: perp(T) };
      const rows = [[20, 2600, C.sky], [24, 2700, C.blue], [28, 2800, C.navy]];
      const bx = 40;
      rows.forEach(([len, v, col], i) => {
        const o = rowOff(12.5 * i);
        const A = (u, z) => along(o, T, u, z);
        tile(s, o, T, 60, 2.8, 4);
        obox(s, A(0, 0), 6, 2.6, 3.4, C.gunmetal, ax3);
        lathe3(s, A(6, 2.2), T, [[0, 0.7], [3, 0.62], [len * 1.05, 0.48]], { color: C.gunmetal, segments: 14 });
        s.text3(A(6 + len * 0.55, 2.2), len + '" barrel', { size: 13, weight: 800, anchor: 'middle', dy: -13, color: 'var(--illus-ink)' });
        const bl = (v - 2300) / 25 * 0.5;
        obox(s, A(bx, 0), bl, 2.4, 1.8, col, ax3);
        s.text3(A(bx + bl + 0.8, 0.9), v.toLocaleString('en-US') + ' fps', { size: 14, weight: 800, dy: 6 });
      });
      s.text3(along([0, 0, 0], T, 0, 6.5), 'Same ammo, three barrel lengths', { size: 15, weight: 800, color: C.blue });
      s.label(along(rowOff(25), T, 6 + 28 * 1.05, 2.2), '+8 in ≈ +200 fps', { dx: -60, dy: 50, n: '+', color: C.green });
      return s.svg();
    },
  });

  ISO.lesson('stocks-triggers', {
    caption: '<b>Fit puts your eye right behind the scope, every time.</b> Set length of pull so your finger falls naturally on the trigger, then raise the cheek riser until your eye lines up with the scope without lifting your head. The ARCA rail lets bipods and tripods clamp on anywhere.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [52, 214], scale: 11.4 });
      const W = perp(T);
      tile(s, [0, 0, 0], T, 50, 3.6, 4);
      const r = hRifle(s, [0, 0, 0], { U: T, blen: 18 });
      const A = r.A;
      obox(s, A(24, r.zb - 0.5), 12, 1.2, 0.5, C.silver, { U: T, W });
      for (let u = 24.6; u < 36; u += 1.2) s.line([add3(A(u, r.zb - 0.5), W, 0.61), add3(A(u, r.zb), W, 0.61)], { color: C.slate, width: 1 });
      s.line([A(1.6, r.sz), A(13.4, r.sz)], { color: C.green, width: 2.4, dash: '5 4' });
      s.sphere(...A(1.2, r.sz), 0.6, { color: C.green, rings: 5, segments: 10 });
      const lz = -1.4;
      s.line([A(17.9, lz), A(0.1, lz)], { color: C.blue, width: 2.4, arrow: true, arrowSize: 9 });
      s.line([A(0.1, lz), A(17.9, lz)], { color: C.blue, width: 2.4, arrow: true, arrowSize: 9 });
      s.line([A(0.05, lz - 0.5), A(0.05, r.zb - 2)], { color: C.blue, width: 1.2, dash: '3 3' });
      s.line([A(17.9, lz - 0.5), A(17.9, r.zb - 1.4)], { color: C.blue, width: 1.2, dash: '3 3' });
      s.text3(A(9, lz), 'Length of pull (LOP)', { size: 13, weight: 800, anchor: 'middle', dy: 18, color: C.blue });
      s.line([A(9, r.zb + 4.2), A(9, r.zb + 6.2)], { color: C.coral, width: 2.8, arrow: true, arrowSize: 8 });
      s.line([A(9, r.zb + 4.2), A(9, r.zb + 2.4)], { color: C.coral, width: 2.8, arrow: true, arrowSize: 8 });
      s.label(A(9, r.zb + 6.2), 'Cheek riser height', { dx: -20, dy: -50, n: 1, color: C.coral });
      s.label(A(1.2, r.sz + 0.6), 'Eye centred behind the scope', { dx: 130, dy: -60, n: 2, color: C.green });
      s.label(r.trigger, 'Trigger: clean break, ~1.5–3 lb', { dx: 20, dy: 96, n: 3, color: C.ink });
      s.label(r.mag, 'Detachable magazine', { dx: 120, dy: 50, n: 4, color: C.slate });
      s.label(A(31, r.zb - 0.4), 'ARCA rail', { dx: 60, dy: 40, n: 5, color: C.slate });
      s.label(r.action, 'Rigid action bedding', { dx: 90, dy: -76, n: 6, color: C.blue });
      return s.svg();
    },
  });

  ISO.lesson('platforms-by-use', {
    caption: '<b>Same system, tuned for a different constraint.</b> Hunters carry their rifle all day, so it is light. PRS rifles are heavy for stability and fast spotting. F-Class rifles sit on a front rest and are as heavy as the rules allow. ELR rifles go big in every dimension to reach 1,500+ yd.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 430, origin: [40, 70], scale: 5.6 });
      const ax3 = { U: T, W: perp(T) };
      const rows = [
        ['Hunting', '7–10 lb · light, carried all day', C.green, { sporter: true, stock: C.wood, blen: 22, br: 0.32, scope: 11, scopeR: 0.7, bipod: false, brake: false }],
        ['Rimfire (NRL22)', '.22 LR trainer · same skills, cheap', C.purple, { stock: C.purple, blen: 18, br: 0.38, scope: 12, brake: false }],
        ['PRS / NRL', '14–18 lb · chassis, brake, bipod', C.blue, { blen: 24, br: 0.46 }],
        ['F-Class', 'very heavy · long barrel, front rest', C.amber, { stock: C.sky, blen: 30, br: 0.52, scope: 16, scopeR: 0.95, bipod: false, rest: true, brake: false }],
        ['ELR', '25+ lb · magnum, 1,500–3,500 yd', C.coral, { stock: C.navy, blen: 31, br: 0.62, scope: 17, scopeR: 1.05 }],
      ];
      rows.forEach(([name, sub, col, opt], i) => {
        const o = rowOff(18 * i);
        const A = (u, z) => along(o, T, u, z);
        obox(s, A(-1, 0), 63, 5, 0.9, ISO.shade(col, 0.5), ax3);
        hRifle(s, [o[0], o[1], 0.9], Object.assign({ U: T }, opt));
        s.text3(A(64, 2), name, { size: 15, weight: 800, color: col === C.amber ? '#c9861c' : col, dy: -6 });
        s.text3(A(64, 2), sub, { size: 11.5, weight: 500, dy: 10 });
      });
      return s.svg();
    },
  });

})();
