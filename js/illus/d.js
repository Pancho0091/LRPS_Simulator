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
      const s = ISO.scene({ w: 720, h: 290, origin: [62, 150], scale: 3.6 });
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
      tag(s, (a1[0] + a2[0]) / 2, 262, '=', 'You missed → don\'t dial', C.coral, 'middle');
      tag(s, (b1[0] + b2[0]) / 2, 262, '≠', 'Data missed → correct 0.2 L', C.green, 'middle');
      return s.svg();
    },
  });


  // ------------------------------------------------------------- m-cards

  // One consistent example card: 6.5 CM 140 gr, MV 2710, 100 yd zero, DA 3,000 ft
  const DOPE = [[300, 0.9, 0.2, 0.4], [400, 1.7, 0.3, 0.6], [500, 2.6, 0.4, 0.8], [600, 3.7, 0.5, 1.0], [700, 4.8, 0.6, 1.2],
    [800, 6.0, 0.7, 1.4], [900, 7.4, 0.8, 1.6], [1000, 8.9, 1.0, 1.9], [1100, 10.6, 1.1, 2.2], [1200, 12.5, 1.3, 2.5]];
  const TRANS = 1200;

  // Dope card face in local units (w × h); returns svg
  function cardSvg(w, rows, o) {
    o = o || {};
    const rh = o.rh || 2.3, hh = o.hh || 6, fs = o.fs || 1.55;
    const h = hh + 2.6 + rows.length * rh + 1;
    const cx = [w * 0.05, w * 0.27, w * 0.46, w * 0.66, w * 0.85];
    let g = `<rect x="0" y="0" width="${w}" height="${h}" rx="1.2" fill="${C.paper}"/>`;
    g += `<rect x="0" y="0" width="${w}" height="${hh}" rx="1.2" fill="${C.ink}"/><rect x="0" y="${hh - 1.2}" width="${w}" height="1.2" fill="${C.ink}"/>`;
    g += T(w * 0.04, hh * 0.42, o.title || '6.5 CM · 140 ELD-M · MV 2710', { size: fs * 1.05, color: '#fff' });
    g += T(w * 0.04, hh * 0.82, o.sub || 'ZERO 100 YD · DA 3,000 FT · MIL', { size: fs * 0.9, color: C.amber });
    const hy = hh + 2;
    ['YD', 'MIL', 'CLK', '5 MPH', '10 MPH'].forEach((c, i) => { g += T(cx[i], hy, c, { size: fs * 0.78, color: C.slate }); });
    g += `<rect x="${w * 0.63}" y="${hh + 0.3}" width="${w * 0.36}" height="${rows.length * rh + 2.5}" fill="${C.sky}" opacity=".18"/>`;
    rows.forEach((r, i) => {
      const y = hy + 0.6 + (i + 1) * rh;
      if (r[0] === TRANS) g += `<rect x="0.3" y="${y - rh * 0.78}" width="${w - 0.6}" height="${rh}" fill="${C.coral}" opacity=".22"/>`;
      else if (i % 2) g += `<rect x="0.3" y="${y - rh * 0.78}" width="${w - 0.6}" height="${rh}" fill="${C.ink}" opacity=".04"/>`;
      g += T(cx[0], y, r[0], { size: fs, mono: true });
      g += T(cx[1], y, r[1].toFixed(1), { size: fs * 1.08, mono: true, weight: 800, color: C.blue });
      g += T(cx[2], y, Math.round(r[1] * 10), { size: fs * 0.95, mono: true, color: C.slate });
      g += T(cx[3], y, r[2].toFixed(1), { size: fs, mono: true });
      g += T(cx[4], y, r[3].toFixed(1), { size: fs, mono: true });
      if (r[0] === TRANS) g += T(w * 0.985, y, 'TRANS', { size: fs * 0.7, color: C.red, anchor: 'end' });
    });
    return { svg: g, h, rowY: (i) => hy + 0.6 + (i + 1) * rh, cx };
  }
  // Card lying flat (reads along +x); returns local→world mapper
  // Card lying flat, text rising up-right (columns along -y, rows along +x).
  // (x, y) is the near-left corner of its footprint: x..x+h, y-w..y.
  function flatCard(s, x, y, z, w, rows, o) {
    const c = cardSvg(w, rows, o);
    s.shadow(x, y - w, c.h, w, { opacity: 0.12 });
    s.box(x, y - w, z, c.h, w, 0.5, { color: C.white, top: C.paper });
    onTopY(s, [x, y, z + 0.5], c.svg);
    return Object.assign(c, { at: (u, v) => [x + v, y - u, z + 0.5] });
  }

  ISO.lesson('workflow', {
    caption: '<b>Measure → zero → solve → true → print → maintain.</b> Every station feeds the next with measured numbers, and the card is only trustworthy after step 5 has checked it against real impacts at distance.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 300, origin: [70, 184], scale: 3.4 });
      const N = 6, SP = 20, B = 17, Z = 3;
      const cols = [C.mint, C.sky, C.lilac, C.amber, C.pink, C.green];
      const names = [['Chronograph', 'MV + SD, 10+ shots'], ['Inputs', 'BC · twist · sight'], ['Zero', '100 yd groups'], ['Solve', 'at expected DA'], ['True', 'at 600–1000 yd'], ['Print card', 'clicks · wind']];
      // maintain loop (in front)
      const st = [5 * SP + B * 0.3, -5 * SP + B + 2, 0.2], en = [B * 0.7, B + 2, 0.2];
      for (let i = N - 1; i >= 0; i--) {
        const x = i * SP, y = -i * SP, cx = x + B / 2, cy = y + B / 2;
        s.shadow(x, y, B, B);
        s.box(x, y, 0, B, B, Z, { color: cols[i], top: ISO.shade(cols[i], 0.6) });
        if (i < N - 1) s.line([[x + B + 0.5, cy - 1, 0.2], [x + SP + 1.5, cy - 2, 0.2]], { color: C.slate, width: 2.5, arrow: true, arrowSize: 7 });
        if (i === 0) {           // doppler chronograph + bullet path
          s.box(cx - 4, cy - 3, Z, 6, 6, 5, { color: C.ink });
          s.disc(cx + 2.05, cy, Z + 2.6, 2.1, { plane: 'yz', fill: C.sky, stroke: C.white, width: 1 });
          onTop(s, [cx - 3.4, cy - 2.2, Z + 5], `<rect x="0" y="0" width="4.6" height="2.4" rx="0.3" fill="${C.green}"/>` + T(0.4, 1.75, '2710', { size: 1.5, mono: true, color: C.ink }));
          s.line([[x - 2, cy + 5, Z + 4], [x + B + 2, cy + 5, Z + 4]], { color: C.copper, width: 2, dash: '3 3' });
        } else if (i === 1) {    // stack of input chips
          [[C.blue, 'BC'], [C.teal, 'TWIST'], [C.purple, 'SIGHT HT'], [C.amber, 'CLICK 0.1']].forEach(([c, n], k) => {
            s.box(cx - 5, cy - 4 + k * 0.4, Z + k * 2, 10, 8, 1.8, { color: c });
            onFront(s, [cx - 5, cy + 4 + k * 0.4, Z + k * 2 + 1.8], T(0.6, 1.4, n, { size: 1.25, color: '#fff' }));
          });
        } else if (i === 2) {    // zero: rifle + 100 yd target with tight group
          slimRifle(s, [x + 1, cy + 3, Z + 0.8], [1, 0, 0], 0.22);
          panel(s, x + 9, cy - 4, Z, 6, 9, `<rect x="0" y="0" width="6" height="9" fill="#fff"/><circle cx="3" cy="3.6" r="2.2" fill="none" stroke="${C.ink}" stroke-width="0.25"/>` + L(0.4, 3.6, 5.6, 3.6, C.ink, 0.15) + L(3, 1, 3, 6.2, C.ink, 0.15) + [[2.8, 3.4], [3.3, 3.7], [3, 3.9], [3.2, 3.3], [2.9, 3.8]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="0.28" fill="${C.coral}"/>`).join('') + T(3, 8.2, '100', { size: 1.6, anchor: 'middle', mono: true }), { legs: false });
        } else if (i === 3) {    // laptop solver
          s.box(cx - 6, cy - 3, Z, 12, 9, 0.8, { color: C.steel });
          let sc = `<rect x="0" y="0" width="12" height="8" rx="0.5" fill="${C.ink}"/>`;
          let d = 'M1 1.8'; for (let k = 1; k <= 20; k++) { const u = k / 20; d += ` L${(1 + u * 10).toFixed(2)} ${(1.8 + u * u * 4.8).toFixed(2)}`; }
          sc += `<path d="${d}" fill="none" stroke="${C.mint}" stroke-width="0.4"/>` + T(1, 7.4, '800 → 6.0', { size: 1.3, mono: true, color: C.amber });
          s.box(cx - 6, cy - 3.6, Z + 0.8, 12, 0.6, 8, { color: C.gunmetal });
          onFront(s, [cx - 6, cy - 3, Z + 8.8], sc);
        } else if (i === 4) {    // truing plate: predicted vs actual
          s.line([[cx, cy - 4, Z], [cx, cy - 4, Z + 13]], { color: C.wood, width: 2.5 });
          s.line([[cx, cy + 4, Z], [cx, cy + 4, Z + 13]], { color: C.wood, width: 2.5 });
          s.disc(cx, cy, Z + 8.5, 3.6, { plane: 'yz', fill: C.white, stroke: C.slate, width: 1.4 });
          s.disc(cx, cy, Z + 8.5, 1, { plane: 'yz', stroke: C.blue, width: 1.5, dash: '2 2' });
          [[0.3, -1.6], [-0.5, -1.9], [0.1, -2.2]].forEach(([a, b]) => s.disc(cx, cy + a, Z + 8.5 + b, 0.4, { plane: 'yz', fill: C.coral }));
        } else {                 // printed card + data book
          s.box(cx - 6.5, cy + 1, Z, 7, 5.5, 1.4, { color: C.blue });
          s.box(cx - 6.3, cy + 1.2, Z + 1.4, 6.6, 5.1, 0.2, { color: C.white });
          flatCard(s, cx - 3, cy + 0.5, Z, 11, DOPE.slice(3, 8), { fs: 0.8, rh: 1.2, hh: 2.8, title: '6.5 CM · MV 2710', sub: 'DA 3,000 · MIL' });
        }
      }
      s.curve((k) => { const p = lerp(st, en, k), b = Math.sin(Math.PI * k) * 16; return [p[0] + b, p[1] + b, 0.2]; }, 0, 1, { color: C.purple, width: 2.5, dash: '6 5', arrow: true, arrowSize: 9, samples: 50 });
      const lp = s.P([2.5 * SP + B / 2 + 16, -2.5 * SP + B / 2 + 16, 0]);
      tag(s, lp[0], lp[1] + 4, 7, 'Maintain: data book, re-chrono new lots', C.purple, 'middle');
      for (let i = 0; i < N; i++) {
        const q = s.P([i * SP + B / 2, -i * SP + B / 2, Z + 16]);
        caption2(s, q[0], q[1] - 40, i + 1, names[i][0], names[i][1], ISO.shade(cols[i], -0.35));
      }
      return s.svg();
    },
  });

  ISO.lesson('anatomy', {
    caption: '<b>A card is a UI for a stressed brain.</b> Header says when it is valid; one row per range; elevation in mil <i>and</i> 0.1-mil clicks; wind brackets you can scale; the transonic row flagged where the data stops being trustworthy.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [118, 186], scale: 7.0 });
      s.floor(-4, -50, 42, 54, { round: 8 });
      const c = flatCard(s, 0, 0, 0.6, 46, DOPE, { fs: 1.6, rh: 2.35, hh: 6 });
      // grease pencil
      s.lathe(36.5, -30, 0.9, [[0, 0.6], [12, 0.6], [13.6, 0.15]], { axis: 'y', color: C.amber, colors: [C.amber, C.ink] });
      const w = 46;
      s.label(c.at(w * 0.62, 1), 'Header: load, MV, zero, DA, unit', { dx: 40, dy: -40, n: 1 });
      s.label(c.at(c.cx[0], c.rowY(5) - 0.6), 'Range steps', { dx: -110, dy: 10, n: 2 });
      s.label(c.at(c.cx[1], c.rowY(8) - 0.6), 'Elevation (mil)', { dx: -150, dy: 46, n: 3 });
      s.label(c.at(c.cx[2] + 0.5, c.rowY(9) - 0.6), 'Clicks (0.1 mil)', { dx: -40, dy: 74, n: 4 });
      s.label(c.at(w * 0.9, c.rowY(1) - 0.6), 'Wind brackets 5 / 10 mph', { dx: 60, dy: -10, n: 5 });
      s.label(c.at(w * 0.96, c.rowY(9) - 0.6), 'Transonic: data limit', { dx: 60, dy: 40, n: 6, color: C.coral });
      return s.svg();
    },
  });

  ISO.lesson('wind-formats', {
    caption: '<b>Brackets scale linearly.</b> 15 mph is three times 5 mph at every range. Pick the column for your call, then scale by speed and clock value: 7 mph from 2 o\'clock at 800 yd → 1.4 × 0.7 × 0.87 ≈ 0.85 mil.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [70, 300], scale: 4.1 });
      const G = DOPE.slice(1, 8), SP = 13.5, BW = 3, K = 15;
      const cols = [C.mint, C.teal, C.blue];
      s.floor(-4, -4 - SP * (G.length - 1), SP * (G.length - 1) + 16, SP * (G.length - 1) + 14, { grid: SP });
      for (let i = G.length - 1; i >= 0; i--) {
        const [rng, , w5, w10] = G[i];
        const vals = [w5, w10, +(w10 * 1.5).toFixed(1)];
        const x = i * SP, y = -i * SP;
        const hi = rng === 800;
        if (hi) s.floor(x - 1.5, y - 1.5, 12, 7.5, { color: C.yellow, z: 0.05 });
        for (let j = 2; j >= 0; j--) {
          const bx = x + j * 3.4, by = y;
          s.box(bx, by, 0, BW, BW, vals[j] * K, { color: cols[j] });
          if (hi || i === G.length - 1) s.text3([bx + BW / 2, by + BW / 2, vals[j] * K + 1.2], vals[j].toFixed(1), { anchor: 'middle', size: hi ? 12.5 : 11, weight: 800, mono: true, dy: -4 });
        }
        s.text3([x + 5, y + 7, 0], rng + ' yd', { anchor: 'middle', size: 12, weight: hi ? 800 : 600, dy: 18, dx: -12 });
      }
      // legend + formula
      [['5 mph', cols[0]], ['10 mph', cols[1]], ['15 mph', cols[2]]].forEach(([n, c], i) => {
        s.raw(`<rect x="${26 + i * 76}" y="30" width="14" height="14" rx="3" fill="${c}"/>`, 2);
        s.text(46 + i * 76, 42, n, { size: 12, weight: 700 });
      });
      s.text(26, 70, 'Full-value hold (mil)', { size: 11.5, weight: 600 });
      s.text(26, 104, 'hold = ref × speed/ref × clock', { size: 12.5, weight: 800, mono: true });
      s.text(26, 124, '800 yd, 7 mph @ 2 o\'clock:', { size: 11.5, weight: 600 });
      s.text(26, 142, '1.4 × 0.7 × 0.87 ≈ 0.85 mil', { size: 12.5, weight: 800, mono: true, color: C.blue });
      // clock value chips
      s.text(26, 176, 'Clock value: 3/9 = 1 · 2,4,8,10 ≈ 0.87', { size: 11, weight: 600 });
      s.text(26, 192, '1,5,7,11 = 0.5 · 12/6 = 0', { size: 11, weight: 600 });
      return s.svg();
    },
  });

  ISO.lesson('truing', {
    caption: '<b>True the velocity first.</b> At 800 yd (still supersonic) the group lands 0.3 mil below the card\'s prediction — the real MV is lower than entered. Lower MV in the solver until predicted = actual, then fine-tune BC/DSF near transonic.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [150, 120], scale: 2.4 });
      s.floor(-10, -40, 170, 64, { grid: 10 });
      P.mat(s, -6, -8, 40, 16, { color: C.teal });
      const rf = P.rifle(s, -4, 0, 0.4, { bag: true });
      // board in the y-z plane at x = 140 (1 mil = 12 units on the board)
      const bx = 140, M = 12, bz = 30;
      s.box(bx, -16, 0, 2, 2, bz + 16, { color: C.wood }); s.box(bx, 14, 0, 2, 2, bz + 16, { color: C.wood });
      let g = `<rect x="0" y="0" width="34" height="34" fill="#fff"/>`;
      for (let k = 1; k < 10; k++) g += L(k * 3.4, 0, k * 3.4, 34, C.sky, 0.15) + L(0, k * 3.4, 34, k * 3.4, C.sky, 0.15);
      g += L(17, 0, 17, 34, C.ink, 0.3) + L(0, 17, 34, 17, C.ink, 0.3);
      g += `<circle cx="17" cy="17" r="2.6" fill="none" stroke="${C.blue}" stroke-width="0.5" stroke-dasharray="1 0.7"/>`;
      const gy = 17 + 0.3 * M * 0.95 * 3.4 / 3.4 * (34 / (M * 10 / 3.4)) ;
      const low = 17 + 0.3 * 34; // board shows ±0.5 mil → 34 units per mil
      [[-0.6, -0.4], [0.5, 0.3], [0.1, 0.9], [-0.2, -0.8]].forEach(([a, b]) => { g += `<circle cx="${17 + a}" cy="${low + b}" r="0.75" fill="${C.coral}"/>`; });
      g += `<circle cx="17" cy="${low}" r="2.6" fill="none" stroke="${C.coral}" stroke-width="0.45"/>`;
      g += `<path d="M20.5 17.5 L20.5 ${low - 0.8}" stroke="${C.ink}" stroke-width="0.35" marker-end=""/>` + T(21.3, (17 + low) / 2 + 0.6, '0.3', { size: 2.2, mono: true });
      face(s, [bx + 2.1, 17, bz + 17], [0, -1, 0], [0, 0, -1], g);
      // trajectories: predicted (dashed blue) vs actual (solid coral)
      const m = rf.muzzle;
      s.curve((k) => [m[0] + (bx - m[0]) * k, 0, m[2] + 34 * Math.sin(Math.PI * k * 0.92) + (bz - m[2]) * k], 0, 1, { color: C.blue, width: 2.5, dash: '6 5', samples: 50 });
      s.curve((k) => [m[0] + (bx - m[0]) * k, 0, m[2] + 34 * Math.sin(Math.PI * k * 0.92) * (1 - 0.06 * k) + (bz - 10.2 - m[2]) * k], 0, 1, { color: C.coral, width: 2.5, samples: 50 });
      // solver knob
      const kx = 60, ky = 22;
      s.shadow(kx - 6, ky - 6, 12, 12);
      s.lathe(kx, ky, 0, [[0, 6], [3, 6], [3.6, 5.2]], { axis: 'z', color: C.ink, colors: [C.gunmetal, C.ink] });
      s.lathe(kx, ky, 3.6, [[0, 5.2], [0.4, 0]], { axis: 'z', color: C.purple });
      s.line([[kx, ky, 4.1], [kx - 3.6, ky - 2.4, 4.1]], { color: '#fff', width: 3 });
      s.curve((k) => { const a = -0.2 - k * 1.3; return [kx + 8 * Math.cos(a), ky + 8 * Math.sin(a), 4]; }, 0, 1, { color: C.purple, width: 2.5, arrow: true, arrowSize: 8 });
      s.label([kx, ky + 3, 3], 'MV 2710 → 2680 fps', { dx: -150, dy: 40, n: 4, color: C.purple });
      s.label([bx, 0, bz + 18], 'Card predicts here', { dx: -140, dy: -50, n: 2, color: C.blue });
      s.label([bx, 0, bz + 4], 'Group: 0.3 mil low', { dx: 40, dy: 70, n: 3, color: C.coral });
      s.label(rf.scope, 'Zero + tracking confirmed', { dx: -40, dy: -70, n: 1 });
      s.text(704, 30, '800 yd · supersonic', { size: 12.5, weight: 800, anchor: 'end' });
      s.text(704, 48, 'then BC / DSF near transonic', { size: 11.5, weight: 600, anchor: 'end', color: C.slate });
      return s.svg();
    },
  });

  ISO.lesson('conditions', {
    caption: '<b>A card is valid for the DA on its header.</b> Thinner air (higher density altitude) means less drag and less elevation. Keep a card per band and pick the closest one — today\'s 3,400 ft uses the 3,000 ft card.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 350, origin: [70, 236], scale: 4.0 });
      const bands = [['DA 0 FT', [3.8, 6.2, 9.4], C.sky, 3], ['DA 3,000 FT', [3.7, 6.0, 8.9], C.green, 10], ['DA 6,000 FT', [3.6, 5.7, 8.4], C.purple, 17]];
      const SP = 30, W = 26;
      s.floor(-6, -6 - SP * 2, SP * 2 + 34, SP * 2 + 26, { grid: 7 });
      for (let i = 2; i >= 0; i--) {
        const [name, v, col, hz] = bands[i];
        const x = i * SP, y = -i * SP;
        s.shadow(x, y - 2, W, 10);
        s.box(x, y - 2, 0, W, 10, hz, { color: col, top: ISO.shade(col, 0.6) });
        let g = `<rect x="0" y="0" width="${W - 4}" height="17" rx="0.8" fill="${C.paper}"/><rect x="0" y="0" width="${W - 4}" height="4.6" rx="0.8" fill="${C.ink}"/>`;
        g += T(1.2, 3.3, name, { size: 2.6, color: '#fff' });
        ['600', '800', '1000'].forEach((r, k) => { g += T(1.4, 8.4 + k * 3.6, r, { size: 2.4, mono: true }) + T(W - 5.6, 8.4 + k * 3.6, v[k].toFixed(1), { size: 2.6, mono: true, anchor: 'end', color: C.blue }); });
        panel(s, x + 2, y + 2, hz, W - 4, 17, g, { legs: false });
        if (i === 1) {
          s.label([x + W / 2, y + 2.9, hz + 17.5], 'Today DA 3,400 ft → use this card', { dx: -60, dy: -60, n: '✓', color: C.green });
        }
      }
      s.text(26, 330, 'Higher DA → thinner air → less drag → less elevation (1,000 yd: 9.4 → 8.4 mil)', { size: 12, weight: 600 });
      return s.svg();
    },
  });

  ISO.lesson('conditions', {
    at: 'before:pre.code',
    caption: '<b>Uphill or downhill, dial for the horizontal distance.</b> Gravity only bends the path across the horizontal part of the flight: 600 yd line of sight at 30° → dial for 600 × cos 30° ≈ 520 yd. Angle always means <i>less</i> elevation.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 340, origin: [96, 262], scale: 4.0 });
      const X = 90, ang = 30 * Math.PI / 180, H = X * Math.tan(ang);
      const d = [Math.SQRT1_2, -Math.SQRT1_2, 0], n = [Math.SQRT1_2, Math.SQRT1_2, 0];
      const at = (u, z, off) => [d[0] * u + n[0] * off, d[1] * u + n[1] * off, z];
      track(s, [0, 0], [X * Math.SQRT1_2, -X * Math.SQRT1_2], 14, { ext: 14 });
      // hill wedge: slope top + front triangle (in the plane facing the viewer)
      const w = 9, h0 = 18;
      s.poly([at(h0, 0, -w), at(X, H, -w), at(X, H, w), at(h0, 0, w)], { fill: ISO.shade(C.grass, 0.15), stroke: ISO.shade(C.grass, 0.15), width: 0.6 });
      s.poly([at(X, H, -w), at(X + 10, H, -w), at(X + 10, H, w), at(X, H, w)], { fill: ISO.shade(C.grass, 0.25) });
      s.poly([at(h0, 0, w), at(X, H, w), at(X + 10, H, w), at(X + 10, 0, w)], { fill: C.grassDark, stroke: C.grassDark, width: 0.6 });
      const pl = at(X + 3, H, 0);
      P.plate(s, pl[0], pl[1], H, 2.4);
      // shooter
      const m0 = at(-6, 0, 0);
      P.mat(s, m0[0] - 6, m0[1] - 6, 16, 12, { color: C.teal });
      slimRifle(s, at(-6, 1.2, 0), [d[0] * Math.cos(ang), d[1] * Math.cos(ang), Math.sin(ang)], 0.3);
      // triangle on the hill's front face
      const A = at(4, 4, w + 1), Bp = at(X, 4, w + 1), Cp = at(X, H + 4, w + 1);
      s.line([A, Cp], { color: C.blue, width: 3.5 });
      s.line([A, Bp], { color: C.coral, width: 3.5, dash: '8 6' });
      s.line([Bp, Cp], { color: '#fff', width: 2, dash: '3 4' });
      s.curve((k) => { const a = ang * k; return at(4 + 18 * Math.cos(a), 4 + 18 * Math.sin(a), w + 1); }, 0, 1, { color: C.ink, width: 1.8 });
      s.text3(at(24, 6, w + 1), '30°', { size: 13, weight: 800, dx: 4, dy: 2 });
      s.line([at(X - 14, H + 30, w + 1), at(X - 14, H + 14, w + 1)], { color: C.slate, width: 3, arrow: true });
      s.label(lerp(A, Cp, 0.45), 'Line of sight: 600 yd', { dx: -150, dy: -70, n: 1, color: C.blue });
      s.label(lerp(A, Bp, 0.5), 'Dial for 600 × cos 30° ≈ 520 yd', { dx: -60, dy: 50, n: 2, color: C.coral });
      s.label(at(X - 14, H + 26, w + 1), 'Gravity: only the horizontal part', { dx: -270, dy: -10, n: 3 });
      s.text(706, 300, 'cos 10° = 0.985 · 20° = 0.940 · 30° = 0.866', { size: 11.5, weight: 700, anchor: 'end', mono: true });
      s.text(706, 320, 'same rule uphill and downhill', { size: 11.5, weight: 600, anchor: 'end' });
      return s.svg();
    },
  });

  ISO.lesson('card-formats', {
    caption: '<b>Put the card where your eyes already are.</b> A scope-cap card needs no head movement but holds only elevation; a stock panel fits both columns; a wrist coach holds several DA cards; the data book records every string so you can true and learn.',
    draw: () => {
      const s = ISO.scene({ w: 720, h: 360, origin: [150, 150], scale: 6.0 });
      s.floor(-6, -10, 66, 34, { grid: 4 });
      s.shadow(0, -4, 56, 8);
      const r = P.rifle(s, 0, 0, 0, { bag: false });
      // 1 scope cap card: flip-up panel standing above the ocular
      const ocx = 13.5, sz = r.scope[2] - 1.2;
      const cap = cardSvg(7, DOPE.slice(4, 8).map((d) => [d[0], d[1], d[2], d[3]]), { fs: 0.5, rh: 0.95, hh: 1.8, title: 'ELEV', sub: 'MIL' });
      s.box(ocx - 0.6, -1.8, sz + 0.9, 0.5, 3.6, 4.4, { color: C.ink });
      face(s, [ocx - 0.08, 1.7, sz + 5.2], [0, -1, 0], [0, 0, -1], `<rect x="0" y="0" width="3.4" height="4.2" fill="${C.paper}"/>` + [0, 1, 2, 3].map((k) => T(0.3, 1.2 + k * 0.9, DOPE[4 + k][0] + ' ' + DOPE[4 + k][1].toFixed(1), { size: 0.62, mono: true })).join(''));
      // 2 stock panel on the +y side of the buttstock
      const zb = 3.4;
      face(s, [3.2, 1.02, zb + 2.6], [1, 0, 0], [0, 0, -1], `<rect x="0" y="0" width="9" height="4.6" rx="0.3" fill="${C.paper}" stroke="${C.ink}" stroke-width="0.08"/>` + DOPE.slice(3, 9).map((d, k) => T(0.4 + (k % 2) * 4.5, 1.2 + Math.floor(k / 2) * 1.3, d[0] + ' ' + d[1].toFixed(1) + '|' + d[3].toFixed(1), { size: 0.62, mono: true })).join(''));
      // 3 wrist coach (forearm + window)
      pill(s, [30, 15, 2], [44, 18, 3.4], 1.9, SKIN);
      s.box(35, 14.2, 2.1, 5.5, 4, 1.8, { color: C.navy });
      onTop(s, [35.6, 14.6, 3.95], `<rect x="0" y="0" width="4.3" height="3.2" fill="${C.paper}"/>` + [0, 1, 2].map((k) => R(0.3, 0.5 + k * 0.9, 3.7, 0.5, [C.sky, C.green, C.lilac][k])).join(''));
      // 4 data book + pencil
      s.box(4, 12, 0, 13, 9, 1.2, { color: C.coral });
      s.box(4.2, 12.2, 1.2, 12.6, 8.6, 0.2, { color: C.white });
      onTop(s, [4.8, 12.6, 1.42], T(0, 1, 'DATE  LOT  DA  RANGE  DIAL  IMPACT', { size: 0.62, mono: true }) + [1, 2, 3, 4, 5].map((k) => L(0, 1.5 + k * 1.25, 11.4, 1.5 + k * 1.25, C.sky, 0.08) + (k < 4 ? T(0, 1.3 + k * 1.25, '6/12 B17 3.2k 800 6.0 -0.3', { size: 0.6, mono: true, color: C.slate }) : '')).join(''));
      s.lathe(10, 22, 0.5, [[0, 0.35], [8, 0.35], [9, 0.05]], { axis: 'x', color: C.amber, colors: [C.amber, C.sand] });
      // 5 phone app
      s.box(48, -14, 0, 4.5, 8, 0.6, { color: C.ink });
      onTop(s, [48.4, -13.6, 0.62], `<rect x="0" y="0" width="3.7" height="7.2" rx="0.4" fill="${C.navy}"/>` + T(0.4, 2, '6.0', { size: 1.2, mono: true, color: C.mint }) + T(0.4, 3.4, 'MIL', { size: 0.6, color: C.white }));
      s.label([ocx - 0.3, 0, sz + 4.6], 'Scope cap: no head movement', { dx: -60, dy: -60, n: 1 });
      s.label([7, 1.05, zb + 1.5], 'Stock panel: both columns', { dx: -110, dy: 40, n: 2 });
      s.label([37.5, 16, 4], 'Wrist coach: DA bands, stage notes', { dx: 40, dy: 44, n: 3 });
      s.label([10, 16, 1.5], 'Data book: every string', { dx: -90, dy: 84, n: 4, color: C.coral });
      s.label([50, -10, 0.6], 'App / LRF: exact, needs batteries', { dx: 20, dy: -60, n: 5, color: C.slate });
      return s.svg();
    },
  });

  ISO.module('m-cards', () => {
    const s = ISO.scene({ w: 520, h: 270, origin: [150, 152], scale: 5.0 });
    s.floor(-4, -44, 42, 48, { round: 8 });
    flatCard(s, 0, 0, 0.6, 40, DOPE.slice(2, 9), { fs: 2.1, rh: 3.2, hh: 7 });
    s.lathe(33, -3, 0.9, [[0, 0.8], [16, 0.8], [18, 0.2]], { axis: 'y', color: C.amber, colors: [C.amber, C.ink] });
    return s.svg();
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
