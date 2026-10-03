/*
 * Illustrations (d): modules m-positions, m-cards, m-field, m-glossary.
 * Conventions: see js/illus/core.js (+x downrange, paint back to front).
 * MIL only; 0.1-mil clicks.
 */
(function () {
  'use strict';
  const ISO = window.ISO, C = ISO.C, P = ISO.parts;
  const SKIN = '#f1c19d', SKIN_D = '#d9a07a';
  const LIGHT = norm([-0.45, 0.55, 0.85]);
  const SPH = 1.2247; // a world radius r projects to r * scale * SPH px

  // ------------------------------------------------------------ helpers

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const f1 = (n) => (+n).toFixed(1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Flat 2D content (local units = world units) mapped onto a plane through o
  // spanned by world vectors u (local +x) and v (local +y, i.e. "down" for text).
  function face(s, o, u, v, inner) {
    const p0 = s.P(o), pu = s.P(add(o, u)), pv = s.P(add(o, v));
    const m = [pu[0] - p0[0], pu[1] - p0[1], pv[0] - p0[0], pv[1] - p0[1], p0[0], p0[1]].map((n) => n.toFixed(3)).join(' ');
    s.raw(`<g transform="matrix(${m})">${inner}</g>`);
  }
  // Shorthands for the three visible planes
  const onTop = (s, o, inner) => face(s, o, [1, 0, 0], [0, 1, 0], inner);        // lying flat, reads along +x
  const onTopY = (s, o, inner) => face(s, o, [0, -1, 0], [1, 0, 0], inner);      // lying flat, reads along -y
  const onFront = (s, o, inner) => face(s, o, [1, 0, 0], [0, 0, -1], inner);     // +y face, reads along +x
  const onSide = (s, o, inner) => face(s, o, [0, -1, 0], [0, 0, -1], inner);     // +x face, reads along -y
  const T = (x, y, txt, o) => {
    o = o || {};
    return `<text x="${x}" y="${y}" font-size="${o.size || 1.6}" font-weight="${o.weight || 700}" fill="${o.color || C.ink}" text-anchor="${o.anchor || 'start'}"${o.mono ? ' font-family="JetBrains Mono, monospace"' : ''}${o.op ? ` opacity="${o.op}"` : ''}>${esc(txt)}</text>`;
  };
  const R = (x, y, w, h, fill, o) => {
    o = o || {};
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 0}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 0.2}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}/>`;
  };
  const L = (x1, y1, x2, y2, col, w, o) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w || 0.2}" stroke-linecap="round"${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o && o.op ? ` opacity="${o.op}"` : ''}/>`;

  // Soft shaded pill between two 3D points (screen-space, Airbnb-style limbs)
  const scaleOf = (s) => { const a = s.P([0, 0, 0]), b = s.P([0, 0, 1]); return Math.abs(a[1] - b[1]); };
  function pillSvg(s, a, b, r, color) {
    const A = s.P(a), B = s.P(b), sc = scaleOf(s);
    const w = r * sc * SPH * 2;
    const seg = (dx, dy, ww, col, op) => `<line x1="${f1(A[0] + dx)}" y1="${f1(A[1] + dy)}" x2="${f1(B[0] + dx)}" y2="${f1(B[1] + dy)}" stroke="${col}" stroke-width="${f1(ww)}" stroke-linecap="round"${op ? ` opacity="${op}"` : ''}/>`;
    return seg(0, 0, w, ISO.shade(color, -0.22)) + seg(-w * 0.08, -w * 0.1, w * 0.78, color) + seg(-w * 0.2, -w * 0.24, w * 0.26, ISO.shade(color, 0.35), 0.8);
  }
  function pill(s, a, b, r, color) { s.raw(pillSvg(s, a, b, r, color)); }
  function ball(s, p, r, color) { pill(s, p, p, r, color); }

  // Low-poly flat-shaded tube between arbitrary points (for rifles at angles)
  function tube(s, a, b, r, color, seg) {
    seg = seg || 10;
    const d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let u = Math.abs(d[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
    u = norm([d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]]);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const ring = (c) => Array.from({ length: seg }, (_, i) => { const t = i / seg * Math.PI * 2; return add(c, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t)))); });
    const ra = ring(a), rb = ring(b);
    const faces = [];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg, t = (i + 0.5) / seg * Math.PI * 2;
      const n = norm(add(mul(u, Math.cos(t)), mul(v, Math.sin(t))));
      faces.push({ p: [ra[i], ra[j], rb[j], rb[i]], n });
    }
    faces.push({ p: rb, n: d }, { p: ra, n: mul(d, -1) });
    const vis = faces.filter((f) => f.n[0] + f.n[1] + f.n[2] > 0.01)
      .map((f) => ({ f, depth: f.p.reduce((q, p) => q + p[0] + p[1] + p[2], 0) / f.p.length }))
      .sort((x, y) => x.depth - y.depth);
    vis.forEach(({ f }) => {
      const dd = f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2];
      const col = dd > 0.45 ? ISO.shade(color, (dd - 0.45) * 0.55) : ISO.shade(color, -(0.45 - dd) * 0.55);
      s.poly(f.p, { fill: col, stroke: col, width: 0.6 });
    });
  }

  // Compact rifle from tubes along any direction d (unit) from the butt point.
  // k = length scale (1 ≈ 46" rifle). Returns muzzle / scope / bore points.
  function slimRifle(s, butt, d, k, o) {
    o = o || {};
    d = norm(d);
    const at = (t, up) => add(add(butt, mul(d, t * k)), [0, 0, (up || 0) * k]);
    tube(s, at(0, 0.6), at(15, 1.6), 1.7 * k, o.stock || C.slate, 8);           // butt stock
    tube(s, at(15, 1.6), at(30, 1.9), 1.5 * k, o.stock || C.slate, 8);          // forend
    tube(s, at(14, 3.3), at(25, 3.3), 0.9 * k, C.gunmetal, 8);                  // action
    tube(s, at(25, 3.3), at(46, 3.3), 0.45 * k, C.gunmetal, 6);                 // barrel
    tube(s, at(11, 5.6), at(27, 5.6), 0.95 * k, o.scope || C.ink, 8);           // scope
    return { muzzle: at(46, 3.3), scope: at(19, 6.6), bore: at(30, 3.3), butt: at(0, 1.5), grip: at(14, 0.8), fore: at(26, 1) };
  }

  // ------------------------------------------------- pill person + poses
  // Joints in world space; parts painted back-to-front by depth.
  function person(s, J, o) {
    o = Object.assign({ shirt: C.blue, pants: C.navy, cap: C.coral, shoe: C.ink }, o || {});
    const mid = (a, b) => lerp(a, b, 0.5);
    const parts = [];
    const K = J.k || 1;
    const add2 = (a, b, r, col) => parts.push({ a, b, r: r * K, col, depth: (a[0] + b[0] + a[1] + b[1]) / 2 + (a[2] + b[2]) * 0.25 });
    const hips = mid(J.hipL, J.hipR), shoulders = mid(J.shL, J.shR);
    add2(J.hipL, J.kneeL, 2.5, o.pants); add2(J.kneeL, J.footL, 2.1, o.pants);
    add2(J.hipR, J.kneeR, 2.5, o.pants); add2(J.kneeR, J.footR, 2.1, o.pants);
    if (J.toeL) add2(J.footL, J.toeL, 1.9, o.shoe);
    if (J.toeR) add2(J.footR, J.toeR, 1.9, o.shoe);
    add2(hips, shoulders, 4.7, o.shirt);
    add2(J.shL, J.elL, 1.8, o.shirt); add2(J.elL, J.handL, 1.6, o.shirt);
    add2(J.shR, J.elR, 1.8, o.shirt); add2(J.elR, J.handR, 1.6, o.shirt);
    add2(J.handL, J.handL, 1.7, SKIN); add2(J.handR, J.handR, 1.7, SKIN);
    add2(J.head, J.head, 4.0, SKIN);
    // torso first among overlapping parts reads better: bias it back a bit
    parts.sort((p, q) => p.depth - q.depth);
    if (o.front) o.front.forEach((name) => { const i = parts.findIndex((p) => p.a === J[name] && p.b === J[name]); if (i >= 0) parts.push(parts.splice(i, 1)[0]); });
    let svg = '';
    parts.forEach((p) => { svg += pillSvg(s, p.a, p.b, p.r, p.col); });
    // cap: a coloured dome on the head + brim pointing along the gaze
    const hd = s.P(J.head), hr = 4.0 * K * scaleOf(s) * SPH;
    const g = J.gaze ? s.P(add(J.head, J.gaze)) : [hd[0] + 1, hd[1] + 0.5];
    const gx = g[0] - hd[0], gy = g[1] - hd[1], gl = Math.hypot(gx, gy) || 1;
    svg += `<path d="M${f1(hd[0] - hr)} ${f1(hd[1] - hr * 0.05)} A${f1(hr)} ${f1(hr)} 0 0 1 ${f1(hd[0] + hr)} ${f1(hd[1] - hr * 0.05)} Z" fill="${o.cap}"/>`;
    svg += `<line x1="${f1(hd[0] + gx / gl * hr * 0.3)}" y1="${f1(hd[1] - hr * 0.08)}" x2="${f1(hd[0] + gx / gl * hr * 1.45)}" y2="${f1(hd[1] - hr * 0.08 + gy / gl * hr * 0.4)}" stroke="${ISO.shade(o.cap, -0.25)}" stroke-width="${f1(hr * 0.32)}" stroke-linecap="round"/>`;
    s.raw(svg);
    return { head: J.head, hips, shoulders };
  }

  // Pose builders: local frame forward=+x, left=+y, up=+z, then placed at p.
  let poseK = 1; // size factor applied by place(); set via sized()
  function place(p, yaw, pts) {
    const c = Math.cos(yaw || 0), sn = Math.sin(yaw || 0), out = {}, k = poseK;
    Object.keys(pts).forEach((n) => { const q = pts[n].map((v) => v * k); out[n] = n === 'gaze' ? q : [p[0] + q[0] * c - q[1] * sn, p[1] + q[0] * sn + q[1] * c, p[2] + q[2]]; });
    out.k = k;
    return out;
  }
  function sized(k, fn) { poseK = k; try { return fn(); } finally { poseK = 1; } }
  // Prone: p = rifle butt (x,y) at ground z; body slightly left of the bore line
  function pronePose(p, yaw, o) {
    o = o || {};
    const dy = o.legSpread || 0;
    return place(p, yaw, {
      head: [7.5, 2.4, 10.4], shR: [-1, -0.5, 6.6], shL: [-3.5, 12.5, 6.2],
      hipR: [-27, 3.5, 4.2], hipL: [-28, 11.5, 4.2],
      kneeR: [-45, 0 - dy, 2.6], kneeL: [-46, 15 + dy, 2.6], footR: [-63, -2 - dy, 2.6], footL: [-64, 18 + dy, 2.6],
      toeR: [-65, -2.3 - dy, 0.6], toeL: [-66, 18.3 + dy, 0.6],
      elR: [5, -7.5, 1.6], handR: [16, -1.5, 4.6], elL: [1, 14, 1.6], handL: o.handL || [6, 3.2, 2.6],
      gaze: [1, 0, 0],
    });
  }
  function standPose(p, yaw) {   // standing, rifle on a tripod in front (bore height ~52)
    return place(p, yaw, {
      head: [3, 1.5, 61], shR: [0, -6.5, 53], shL: [1, 7, 53], hipR: [-1, -3.5, 34], hipL: [-1, 3.5, 34],
      kneeR: [-2, -5, 18], kneeL: [3, 5, 18], footR: [-3, -6, 2], footL: [5, 6, 2], toeR: [0, -6, 1], toeL: [8, 6, 1],
      elR: [5, -12, 44], handR: [10, -2.5, 47], elL: [12, 8, 46], handL: [20, 1, 48], gaze: [1, 0, 0],
    });
  }
  function kneelPose(p, yaw) {   // kneeling on the right knee, rifle on a low tripod (bore ~36)
    return place(p, yaw, {
      head: [3, 1.5, 44], shR: [0, -6.5, 36], shL: [1, 7, 36], hipR: [-2, -3.5, 19], hipL: [-2, 3.5, 19],
      kneeR: [-6, -5, 3], kneeL: [12, 5, 17], footR: [-20, -5, 3], footL: [12, 5, 1.6], toeR: [-23, -5, 1], toeL: [15, 5, 1],
      elR: [5, -12, 28], handR: [10, -2.5, 31], elL: [14, 6, 22], handL: [20, 1, 31], gaze: [1, 0, 0],
    });
  }
  function sitPose(p, yaw) {     // seated at a bench (bench top ~30), rifle on the bench
    return place(p, yaw, {
      head: [6, 0, 44], shR: [1, -6.5, 36], shL: [2, 7, 36], hipR: [-6, -3.5, 19], hipL: [-6, 3.5, 19],
      kneeR: [10, -4.5, 20], kneeL: [10, 4.5, 20], footR: [11, -5, 2], footL: [11, 5, 2], toeR: [14, -5, 1], toeL: [14, 5, 1],
      elR: [10, -10, 31], handR: [13, -2.5, 33], elL: [12, 9, 31], handL: [10, 3, 32], gaze: [1, 0, 0],
    });
  }

  function tripod(s, top, h, k) {
    [[-0.6, -0.7], [-0.6, 0.7], [0.9, 0]].forEach(([dx, dy]) => s.line([top, [top[0] + dx * h * 0.42, top[1] + dy * h * 0.42, top[2] - h]], { color: C.gunmetal, width: 2.2 * (k || 1) }));
  }

  // Mil "scope bubble" in screen space: wobble area vs a 0.42-mil plate
  function wobbleBubble(s, cx, cy, wobble, pxPerMil, R0) {
    const plate = 0.42 * pxPerMil / 2, wr = Math.max(1.6, wobble * pxPerMil / 2);
    const col = wobble < 0.3 ? C.green : wobble < 0.5 ? C.amber : C.coral;
    let g = `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="#fff" stroke="${C.ink}" stroke-opacity=".15" stroke-width="1.2"/>`;
    g += `<line x1="${cx - R0}" y1="${cy}" x2="${cx + R0}" y2="${cy}" stroke="${C.ink}" stroke-opacity=".25"/><line x1="${cx}" y1="${cy - R0}" x2="${cx}" y2="${cy + R0}" stroke="${C.ink}" stroke-opacity=".25"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${f1(plate)}" fill="${C.steel}"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${f1(wr)}" fill="${col}" fill-opacity=".28" stroke="${col}" stroke-width="1.6" stroke-dasharray="${wr > 6 ? '3 2' : 'none'}"/>`;
    return g;
  }


  // Thin standing sign/panel along x (face is the +y side). inner() gets local
  // coords: (0,0) top-left, w right, h down, in world units.
  function panel(s, x, y, z, w, h, inner, o) {
    o = o || {};
    s.box(x, y, z, w, 0.9, h, { color: o.color || C.white, top: o.top });
    if (o.legs !== false && z > 0) [x + w * 0.2, x + w * 0.8].forEach((lx) => s.box(lx - 0.4, y + 0.1, 0, 0.8, 0.7, z, { color: C.steel }));
    onFront(s, [x, y + 0.9, z + h], inner);
  }
  // 2D mil reticle drawn in local units (u = units per mil) around (cx, cy)
  function reticle2d(cx, cy, rad, u, o) {
    o = o || {};
    let g = `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${o.bg || '#fff'}" stroke="${C.ink}" stroke-width="${rad * 0.03}"/>`;
    if (o.plate) g += `<circle cx="${cx + (o.plateDx || 0)}" cy="${cy + (o.plateDy || 0)}" r="${o.plate}" fill="${C.steel}"/>`;
    g += L(cx - rad, cy, cx + rad, cy, C.ink, rad * 0.025) + L(cx, cy - rad, cx, cy + rad, C.ink, rad * 0.025);
    for (let m = -Math.floor(rad / u); m <= rad / u; m++) {
      if (!m) continue;
      const tk = rad * 0.07;
      g += L(cx + m * u, cy - tk, cx + m * u, cy + tk, C.ink, rad * 0.02) + L(cx - tk, cy + m * u, cx + tk, cy + m * u, C.ink, rad * 0.02);
    }
    return g;
  }

  // Screen-space numbered pill (for callouts on 2D insets)
  function tag(s, x, y, n, text, color, anchor) {
    const fs = 12, tw = text.length * fs * 0.56 + (n != null ? 22 : 0) + 16;
    const x0 = anchor === 'middle' ? x - tw / 2 : anchor === 'end' ? x - tw : x;
    let g = `<rect x="${f1(x0)}" y="${f1(y - fs * 0.95)}" width="${f1(tw)}" height="${fs * 1.9}" rx="${fs * 0.95}" fill="#fff" stroke="rgba(31,39,51,.14)"/>`;
    let tx = x0 + 10;
    if (n != null) {
      g += `<circle cx="${f1(x0 + fs * 0.95)}" cy="${y}" r="${fs * 0.68}" fill="${color || C.blue}"/><text x="${f1(x0 + fs * 0.95)}" y="${f1(y + fs * 0.36)}" text-anchor="middle" font-size="${fs * 0.85}" font-weight="700" fill="#fff">${esc(n)}</text>`;
      tx = x0 + fs * 1.9 + 4;
    }
    g += `<text x="${f1(tx)}" y="${f1(y + fs * 0.36)}" font-size="${fs}" font-weight="600" fill="${C.ink}">${esc(text)}</text>`;
    s.raw(g, 2);
  }

  // ---------------------------------------------------------- m-positions

  // The stability ladder: bench → standing, wobble vs a 0.42-mil plate
  function ladderScene(opts) {
    const o = Object.assign({ w: 740, h: 390 }, opts || {});
    const s = ISO.scene({ w: o.w, h: o.h, origin: [62, 292], scale: 1.12 });
    const steps = [
      { name: 'Bench', wob: 0.04, h: 4, len: 104 },
      { name: 'Prone+bag', wob: 0.1, h: 12, len: 128 },
      { name: 'Bipod only', wob: 0.2, h: 20, len: 128 },
      { name: 'Barricade', wob: 0.4, h: 28, len: 70 },
      { name: 'Kneeling', wob: 0.75, h: 36, len: 62 },
      { name: 'Standing', wob: 1.3, h: 44, len: 58 },
    ];
    const SP = 59, D = 40;
    s.floor(-70, -370, 440, 420, { grid: 20 });
    // paint from the back (right) to the front (left)
    const tops = [];
    for (let i = steps.length - 1; i >= 0; i--) {
      const st = steps[i];
      const cx = i * SP, cy = -i * SP;
      const x0 = cx - st.len / 2, y0 = cy - D / 2, z = st.h;
      s.shadow(x0, y0, st.len, D);
      s.box(x0, y0, 0, st.len, D, st.h, { color: i < 3 ? C.mint : i < 4 ? C.yellow : C.pink, top: C.white });
      const gy = cy + 2;
      let top;
      if (i === 0) {          // bench: table + seated shooter
        s.box(x0 + 30, gy - 16, z + 26, 60, 26, 4, { color: C.wood });
        [[x0 + 32, gy - 14], [x0 + 86, gy - 14], [x0 + 32, gy + 7], [x0 + 86, gy + 7]].forEach(([x, y]) => s.box(x, y, z, 2.5, 2.5, 26, { color: ISO.shade(C.wood, -0.2) }));
        s.box(x0 + 2, gy - 6, z, 16, 12, 17, { color: C.slate });
        s.box(x0 + 66, gy - 4, z + 30, 8, 6, 4, { color: C.sand });
        s.box(x0 + 36, gy - 4, z + 30, 7, 6, 3, { color: C.sand });
        slimRifle(s, [x0 + 30, gy, z + 31], [1, 0, 0], 1.25);
        person(s, sitPose([x0 + 20, gy, z]), {});
        top = [cx, cy, z + 50];
      } else if (i <= 2) {     // prone with / without rear bag
        const bx = x0 + 70;
        s.box(bx - 2, gy - 7, z, 50, 14, 0.6, { color: C.green });
        if (i === 1) s.box(bx + 3, gy - 2.5, z, 7, 5, 3, { color: C.sand });
        const rf = slimRifle(s, [bx, gy, z + 3.4], [1, 0, 0], 1.15);
        s.line([[bx + 34, gy - 0.5, z + 5.2], [bx + 32, gy - 3, z]], { color: C.gunmetal, width: 1.6 });
        s.line([[bx + 34, gy + 0.5, z + 5.2], [bx + 32, gy + 3, z]], { color: C.gunmetal, width: 1.6 });
        person(s, pronePose([bx, gy, z], 0), {});
        top = [rf.scope[0] - 6, cy, z + 14];
      } else if (i === 3) {    // barricade: wall with a bag, standing shooter
        const wx = cx + 12;
        s.box(wx, cy - 16, z, 4, 32, 58, { color: C.wood });
        s.box(wx - 2, gy - 4, z + 42, 7, 8, 3.5, { color: C.sand });
        person(s, standPose([wx - 28, gy, z]), {});
        slimRifle(s, [wx - 30, gy - 3.5, z + 44], [1, 0, 0], 1.1);
        top = [wx - 20, cy, z + 70];
      } else {                 // kneeling / standing on a tripod
        const stand = i === 5;
        const bx = cx - 14;
        const bore = stand ? 46 : 30;
        tripod(s, [bx + 30, gy, z + bore], bore, 1);
        person(s, (stand ? standPose : kneelPose)([bx, gy, z]), {});
        slimRifle(s, [bx - 2, gy - 3.5, z + bore - 1], [1, 0, 0], 1.1);
        top = [bx + 6, cy, z + (stand ? 70 : 52)];
      }
      tops[i] = top;
    }
    // bubbles + names (screen space, left to right)
    const ppm = 46;
    steps.forEach((st, i) => {
      const p = s.P([i * SP, -i * SP, 0]);
      const q = s.P(tops[i]);
      const bx = p[0] + 22, by = 72;
      s.raw(`<line x1="${f1(q[0])}" y1="${f1(q[1])}" x2="${f1(bx)}" y2="${by + 48}" stroke="${C.ink}" stroke-opacity=".3" stroke-dasharray="2 3"/>`, 1);
      s.raw(wobbleBubble(s, bx, by, st.wob, ppm, 32), 1);
      s.text(bx, by + 47, st.wob.toFixed(2).replace(/0$/, '') + ' mil', { anchor: 'middle', size: 12, weight: 800, mono: true });
      s.text(bx, 26, (i + 1) + ' · ' + st.name, { anchor: 'middle', size: 12.5, weight: 800 });
    });
    return s;
  }

  ISO.lesson('positions', {
    caption: '<b>Climb the ladder only when you must.</b> Each step up removes ground contact and the wobble (coloured circle) grows. A 12" plate at 800 yd is just 0.42 mil (grey disc): only bench and prone keep the wobble inside it.',
    draw: () => {
      const s = ladderScene();
      s.text(18, 374, 'Wobble (coloured) vs 12" plate at 800 yd = 0.42 mil (grey)', { size: 12, weight: 600 });
      return s.svg();
    },
  });

  // Contact points: prone vs standing
  ISO.lesson('positions', {
    at: 'before:.callout.analog',
    caption: '<b>Count the contact points.</b> Prone puts chest, hips, both elbows and legs on the ground and the rifle on bipod + bag (green). Standing balances everything on two feet and muscle — so the wobble grows.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [330, 200], scale: 2.35 });
      s.floor(-80, -84, 170, 112, { grid: 10 });
      const g = (x, y, r) => s.disc(x, y, 0.15, r, { fill: C.green, opacity: 0.35, stroke: C.green, width: 1.5 });
      // standing (behind, right)
      const sx = 70, sy = -56;
      g(sx - 3, sy - 6, 3.5); g(sx + 5, sy + 6, 3.5);
      [[-0.6, -0.7], [-0.6, 0.7], [0.9, 0]].forEach(([dx, dy]) => g(sx + 30 + dx * 20.6, sy + dy * 20.6, 2.5));
      tripod(s, [sx + 30, sy, 49], 49, 1.3);
      person(s, standPose([sx, sy, 0]), { shirt: C.purple });
      slimRifle(s, [sx - 2, sy - 3.5, 48], [1, 0, 0], 1.15);
      // prone (front)
      P.mat(s, -72, -12, 128, 34, { color: C.mint });
      [[-48, 7, 5], [-62, 8, 4], [-30, 7, 6], [-12, 8, 6], [1, -7, 3], [1, 14, 3], [6, 0, 4], [32, 0, 4]].forEach(([x, y, r]) => g(x, y, r));
      P.rifle(s, 0, 0, 0.4, { bag: true });
      person(s, pronePose([0, 0, 0.4], 0));
      s.label([-30, 7, 4], 'Chest + hips + legs down', { dx: -110, dy: -50, n: 1, color: C.green });
      s.label([1, 14, 1.5], 'Elbows: bone, not muscle', { dx: -150, dy: 64, n: 2, color: C.green });
      s.label([32, 0, 0.4], 'Bipod + rear bag', { dx: -70, dy: 64, n: 3, color: C.green });
      s.label([sx + 5, sy + 6, 0.2], 'Two feet + tripod', { dx: 30, dy: 64, n: '!', color: C.coral });
      s.label([sx + 1, sy - 4, 44], 'Muscle holds it up', { dx: -190, dy: -10, n: '!', color: C.coral });
      s.text(24, 36, 'PRONE  ≈ 0.1–0.2 mil wobble', { size: 13, weight: 800, color: C.green });
      s.text(24, 54, 'many bone + ground contacts', { size: 11.5, weight: 600 });
      s.text(706, 326, 'STANDING  ≈ 1.3 mil', { size: 13, weight: 800, color: C.coral, anchor: 'end' });
      return s.svg();
    },
  });

  ISO.lesson('prone', {
    caption: '<b>Build it so it points at the target when you relax.</b> Body behind the bore, bipod pre-loaded, rear bag under the toe, same cheek weld every time — then check natural point of aim and fix it with your body, not your arms.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [318, 178], scale: 3.55 });
      s.floor(-76, -20, 134, 50, { grid: 6 });
      P.mat(s, -72, -12, 126, 36, { color: C.teal });
      // 1. bore line extended back through the body
      const rf = P.rifle(s, 0, 0, 0.4, { bag: true });
      const J = pronePose([0, 0, 0.4], 0);
      person(s, J);
      s.line([[-74, 0, 0.6], [0, 0, 7.7]], { color: C.coral, width: 2.5, dash: '7 6', opacity: 0.9 });
      // 2. bipod pre-load arrow
      s.line([[24, 7, 0.6], [36, 7, 0.6]], { color: C.blue, width: 3.5, arrow: true });
      // 6. NPA inset
      const sp = s.P(rf.scope);
      const bx = 626, by = 96;
      s.raw(`<line x1="${f1(sp[0] + 10)}" y1="${f1(sp[1] - 4)}" x2="${bx - 50}" y2="${by + 18}" stroke="${C.ink}" stroke-opacity=".35" stroke-dasharray="3 4"/>`, 1);
      let b = `<circle cx="${bx}" cy="${by}" r="52" fill="#fff" stroke="${C.ink}" stroke-opacity=".15" stroke-width="1.2"/>`;
      b += `<circle cx="${bx}" cy="${by}" r="15" fill="${C.steel}"/>`;
      b += `<line x1="${bx - 52}" y1="${by}" x2="${bx + 52}" y2="${by}" stroke="${C.ink}" stroke-width="1.2"/><line x1="${bx}" y1="${by - 52}" x2="${bx}" y2="${by + 52}" stroke="${C.ink}" stroke-width="1.2"/>`;
      b += `<circle cx="${bx + 32}" cy="${by - 6}" r="5" fill="none" stroke="${C.coral}" stroke-width="2" stroke-dasharray="2 2"/>`;
      b += `<path d="M${bx + 26} ${by - 4} Q ${bx + 16} ${by + 10} ${bx + 5} ${by + 3}" fill="none" stroke="${C.coral}" stroke-width="1.8"/>`;
      s.raw(b, 1);
      tag(s, bx, by - 70, 6, 'Check NPA', C.blue, 'middle');
      s.text(bx, by + 70, 'Relaxed reticle drifted?', { anchor: 'middle', size: 11, weight: 600 });
      s.text(bx, by + 85, 'Move your body, not arms', { anchor: 'middle', size: 11, weight: 700 });
      s.label([-60, 0, 1.6], 'Align: body behind the bore', { dx: -20, dy: 74, n: 1, color: C.coral });
      s.label([36, 7, 0.6], 'Lean into the bipod', { dx: 10, dy: 46, n: 2 });
      s.label([5.5, -2.2, 2.5], 'Rear bag under the toe', { dx: 70, dy: -86, n: 3 });
      s.label(add(J.head, [0, 0, 3]), 'Cheek weld: same spot', { dx: -120, dy: -78, n: 4 });
      s.label(J.handL, 'Support hand on the bag', { dx: -160, dy: 60, n: 5 });
      return s.svg();
    },
  });


  // Ground strip along the screen-horizontal diagonal (+x,-y) from c0 to c1
  function track(s, c0, c1, hw, o) {
    o = o || {};
    const d = [Math.SQRT1_2, -Math.SQRT1_2], n = [Math.SQRT1_2, Math.SQRT1_2], e = o.ext || 10;
    const pt = (c, sd, sn) => [c[0] + d[0] * sd + n[0] * sn, c[1] + d[1] * sd + n[1] * sn, 0];
    s.poly([pt(c0, -e, -hw), pt(c1, e, -hw), pt(c1, e, hw), pt(c0, -e, hw)], { fill: o.fill || 'var(--illus-floor)' });
  }
  const caption2 = (s, x, y, n, title, sub, color) => {
    s.raw(`<circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="${color}"/><text x="${f1(x)}" y="${f1(y + 4)}" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">${n}</text>`, 2);
    s.text(x, y + 28, title, { anchor: 'middle', size: 12.5, weight: 800 });
    if (sub) s.text(x, y + 44, sub, { anchor: 'middle', size: 11, weight: 500 });
  };

  ISO.lesson('shot-process', {
    caption: '<b>Same six steps, every shot.</b> Position and NPA remove your muscles from the aim, dial/level/parallax remove setup errors, a short breathing pause and a straight-back press remove the trigger error — and the call tells you what happened.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 290, origin: [72, 142], scale: 2.92 });
      const N = 6, SP = 22, B = 18, Z = 4;
      const cols = [C.mint, C.sky, C.amber, C.lilac, C.pink, C.green];
      const names = [['Position', 'bone, not muscle'], ['NPA', 'relaxed = on target'], ['Dial · level', '+ parallax'], ['Breathe', 'pause ≤ 5–8 s'], ['Press', 'straight back'], ['Follow through', 'call the shot']];
      for (let i = N - 1; i >= 0; i--) {
        const x = i * SP, y = -i * SP, cx = x + B / 2, cy = y + B / 2;
        s.shadow(x, y, B, B);
        s.box(x, y, 0, B, B, Z, { color: cols[i], top: ISO.shade(cols[i], 0.55) });
        if (i < N - 1) s.line([[x + B + 0.5, cy - 2, 0.2], [x + SP + 1.5, cy - 2 - 1, 0.2]], { color: C.slate, width: 2.5, arrow: true, arrowSize: 7 });
        if (i === 0) {
          s.box(x + 1, cy - 4, Z, 16, 8, 0.4, { color: C.green });
          sized(0.2, () => { slimRifle(s, [x + 10.5, cy - 1, Z + 0.9], [1, 0, 0], 0.155); person(s, pronePose([x + 10.5, cy - 1, Z + 0.4], 0)); });
        } else if (i === 1) {
          panel(s, x + 2, cy - 1, Z, 14, 14, reticle2d(7, 7, 6.4, 2.6, { plate: 1.7 }) + `<circle cx="11.2" cy="5" r="1.1" fill="none" stroke="${C.coral}" stroke-width="0.4" stroke-dasharray="0.6 0.4"/><path d="M10.4 6 Q9.3 8.6 7.8 7.6" fill="none" stroke="${C.coral}" stroke-width="0.45"/>`, { legs: false });
        } else if (i === 2) {
          s.lathe(cx - 3, cy - 2, Z, [[0, 3.4], [6, 3.4], [6.6, 2.6]], { axis: 'z', color: C.ink, colors: [C.gunmetal, C.ink] });
          s.lathe(cx - 3, cy - 2, Z + 6.6, [[0, 2.6], [0.5, 0]], { axis: 'z', color: C.amber });
          s.box(cx + 0.5, cy + 3, Z, 7.5, 3.4, 3, { color: C.white });
          s.lathe(cx + 1.2, cy + 5, Z + 1.5, [[0, 0.8], [6, 0.8]], { axis: 'x', color: C.mint });
          s.sphere(cx + 4.2, cy + 5.3, Z + 1.7, 0.6, { color: C.green });
        } else if (i === 3) {
          let w = `<rect x="0" y="0" width="15" height="11" rx="1" fill="#fff"/>`;
          let d = '';
          for (let k = 0; k <= 48; k++) { const xx = 0.8 + k * 0.28; const ph = k / 48 * Math.PI * 3.1; const yy = 6.5 - Math.sin(ph) * 2.8; d += (k ? ' L' : 'M') + xx.toFixed(2) + ' ' + yy.toFixed(2); }
          w += `<rect x="7.2" y="2.6" width="3" height="7.6" fill="${C.green}" opacity=".25"/>`;
          w += `<path d="${d}" fill="none" stroke="${C.purple}" stroke-width="0.5" stroke-linejoin="round"/>`;
          w += T(7.2, 2.1, 'pause', { size: 1.5, color: ISO.shade(C.green, -0.3) });
          panel(s, x + 1.5, cy - 1, Z, 15, 11, w, { legs: false });
        } else if (i === 4) {
          s.box(cx - 6, cy - 1.8, Z + 7, 12, 3.6, 2, { color: C.gunmetal });
          s.extrude([[0, 7], [1.8, 7], [2, 3.4], [1.3, 0.6], [0, 0], [-0.7, 0.7], [0.3, 3.4]], -0.9, 1.8, { plane: 'xz', at: [cx + 0.5, cy, Z], color: C.ink });
          s.line([[cx + 8, cy + 3, Z + 3], [cx - 6, cy + 3, Z + 3]], { color: C.coral, width: 3.5, arrow: true });
        } else {
          s.line([[x + 7, cy, Z], [x + 7, cy, Z + 14]], { color: C.wood, width: 3 });
          s.disc(x + 7, cy, Z + 9, 4.2, { plane: 'yz', fill: C.white, stroke: C.slate, width: 1.4 });
          s.disc(x + 7, cy - 0.9, Z + 9.8, 0.8, { plane: 'yz', fill: C.lead });
          s.disc(x + 7, cy - 0.9, Z + 9.8, 2.4, { plane: 'yz', stroke: C.coral, width: 1.6, dash: '2 2' });
        }
      }
      for (let i = 0; i < N; i++) {
        const q = s.P([i * SP + B, -i * SP + B, 0]);
        caption2(s, q[0], q[1] + 22, i + 1, names[i][0], names[i][1], ISO.shade(cols[i], -0.35));
      }
      return s.svg();
    },
  });

  ISO.lesson('recoil-follow', {
    caption: '<b>Recoil goes straight back along the bore.</b> With your body behind the rifle (left) it pushes into you and settles back on target, so you can watch the impact. Angled behind it (right), the rifle pivots and the muzzle jumps off target.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [214, 226], scale: 2.0 });
      s.floor(-78, -96, 170, 122, { grid: 10 });
      const setups = [{ x: 80, y: -78, yaw: 0.42, ok: false }, { x: 0, y: 0, yaw: 0, ok: true }];
      setups.forEach((u) => {
        const col = u.ok ? C.green : C.coral;
        P.mat(s, u.x - 72, u.y - 14, 128, 38, { color: u.ok ? C.mint : ISO.shade(C.pink, 0.35) });
        P.rifle(s, u.x, u.y, 0.4, { bag: true });
        person(s, pronePose([u.x, u.y, 0.4], u.yaw));
        if (u.ok) s.line([[u.x - 4, u.y, 9], [u.x - 40, u.y + 5, 9]], { color: col, width: 4, arrow: true, arrowSize: 12 });
        else {
          s.line([[u.x - 4, u.y, 9], [u.x - 22, u.y, 9]], { color: col, width: 4 });
          s.curve((k) => [u.x - 22 - 12 * k, u.y + 18 * k * k, 9], 0, 1, { color: col, width: 4, arrow: true, arrowSize: 12 });
          s.curve((k) => [u.x + 56, u.y - 16 * k, 8 + 10 * k * k], 0, 1, { color: col, width: 3, arrow: true, arrowSize: 10, dash: '5 4' });
        }
      });
      const inset = (cx, cy, ok) => {
        let g = `<circle cx="${cx}" cy="${cy}" r="38" fill="#fff" stroke="${C.ink}" stroke-opacity=".15"/>`;
        g += `<circle cx="${ok ? cx : cx - 21}" cy="${ok ? cy : cy + 14}" r="10" fill="${C.steel}"/>`;
        g += `<line x1="${cx - 38}" y1="${cy}" x2="${cx + 38}" y2="${cy}" stroke="${C.ink}" stroke-width="1.2"/><line x1="${cx}" y1="${cy - 38}" x2="${cx}" y2="${cy + 38}" stroke="${C.ink}" stroke-width="1.2"/>`;
        if (ok) g += `<circle cx="${cx + 3}" cy="${cy - 3}" r="3" fill="${C.amber}"/><circle cx="${cx + 3}" cy="${cy - 3}" r="7" fill="none" stroke="${C.amber}" stroke-width="1.5"/>`;
        s.raw(g, 1);
      };
      inset(60, 60, true); inset(660, 60, false);
      s.text(108, 50, 'Settles back on target', { size: 12, weight: 800, color: ISO.shade(C.green, -0.3) });
      s.text(108, 66, '→ you see the hit', { size: 11.5, weight: 600 });
      s.text(612, 50, 'Pivots off target', { size: 12, weight: 800, color: C.coral, anchor: 'end' });
      s.text(612, 66, 'no call, no spotting', { size: 11.5, weight: 600, anchor: 'end' });
      s.label([-30, 3.8, 9], 'Recoil straight back into you', { dx: -70, dy: 90, n: '✓', color: C.green });
      s.label([136, -94, 14], 'Muzzle jumps sideways', { dx: 10, dy: 56, n: '✗', color: C.coral });
      return s.svg();
    },
  });

  ISO.lesson('recoil-follow', {
    at: 'before:pre.code',
    caption: '<b>Compare the call with the impact.</b> If they agree, the data was right and you missed — do not touch the dial. If you called a clean, centred shot and it still landed 0.2 right, the data or wind was off — correct 0.2 left.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 310, origin: [62, 150], scale: 3.6 });
      const W = 26, H = 24, Z = 3, SP = 18.5;
      const MIL = 22; // local units per mil
      const pan = (slot, title, callDx, hitDx) => {
        const x = slot * SP, y = -slot * SP;
        s.shadow(x, y - 2, W, 4);
        let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
        g += T(1.6, 3.6, title, { size: 2.6, weight: 800, color: callDx != null ? C.blue : ISO.shade(C.amber, -0.35) });
        const cx = W / 2, cy = 13.8, rad = 8.6;
        g += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#f2f5fa"/><circle cx="${cx}" cy="${cy}" r="${0.21 * MIL}" fill="${C.steel}"/>`;
        const px = cx + (callDx || 0) * MIL;
        g += L(px - rad * 0.9, cy, px + rad * 0.9, cy, C.ink, 0.3) + L(px, cy - rad * 0.9, px, cy + rad * 0.9, C.ink, 0.3);
        if (hitDx != null) g += `<circle cx="${cx + hitDx * MIL}" cy="${cy - 0.4}" r="0.9" fill="${C.amber}"/><circle cx="${cx + hitDx * MIL}" cy="${cy - 0.4}" r="2" fill="none" stroke="${C.amber}" stroke-width="0.35"/>`;
        panel(s, x, y - 0.45, Z, W, H, g);
        const q = s.P([x + W / 2, y, 0]);
        return q;
      };
      const a1 = pan(0, 'CALL', 0.2, null), a2 = pan(1.25, 'IMPACT', null, 0.2);
      const b1 = pan(3.05, 'CALL', 0, null), b2 = pan(4.3, 'IMPACT', null, 0.2);
      [[a1, 'broke 0.2 right'], [a2, 'hit 0.2 right'], [b1, 'clean, centred'], [b2, 'hit 0.2 right']].forEach(([q, txt]) => s.text(q[0], q[1] + 22, txt, { anchor: 'middle', size: 12, weight: 600 }));
      tag(s, (a1[0] + a2[0]) / 2, 278, '=', 'You missed → don\'t dial', C.coral, 'middle');
      tag(s, (b1[0] + b2[0]) / 2, 278, '≠', 'Data missed → correct 0.2 L', C.green, 'middle');
      return s.svg();
    },
  });

  ISO.module('m-positions', () => {
    const s = ISO.scene({ w: 520, h: 260, origin: [210, 120], scale: 2.6 });
    s.floor(-80, -30, 160, 60, { grid: 10 });
    P.mat(s, -62, -12, 115, 26, { color: C.green });
    P.plate(s, 70, -26, 0, 4);
    s.box(2.5, -2.5, 0.4, 7, 5, 3.2, { color: C.sand });
    P.rifle(s, 0, 0, 0.4, { bag: false });
    person(s, pronePose([0, 0, 0.4], 0));
    return s.svg();
  });
})();
