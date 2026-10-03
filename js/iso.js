/*
 * ISO — a tiny isometric illustration engine that outputs SVG strings.
 *
 * World axes: x → down-right, y → down-left, z → up. 1 unit = `scale` px.
 * Every solid is a mesh of planar faces with outward winding; faces that
 * point away from the viewer are culled and the rest are flat-shaded from a
 * fixed light, giving the three-tone look of modern product illustrations.
 *
 *   const s = ISO.scene({ w: 640, h: 340, origin: [320, 90], scale: 8 });
 *   s.floor(-10, -10, 40, 30);                         // ground tile
 *   s.box(0, 0, 0, 6, 4, 3, { color: ISO.C.blue });    // x, y, z, w(x), d(y), h(z)
 *   s.lathe(0, 2, 5, [[0, 0.5], [6, 0.5], [8, 0]], { axis: 'x', color: ISO.C.brass });
 *   s.label([3, 2, 3], 'Action', { dx: -60, dy: -40, n: 1 });
 *   el.innerHTML = s.svg();
 *
 * Draw order is insertion order (paint back to front); labels and 2D text
 * always render last. Per-object faces are depth-sorted automatically.
 */
(function (root) {
  'use strict';

  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = 0.5;
  const LIGHT = normalize([-0.45, 0.55, 0.85]);
  let uid = 0;

  // Airbnb / Google-style pastel-but-saturated palette
  const C = {
    blue: '#4f7cff', sky: '#8ec5ff', navy: '#2b3a67', coral: '#ff6b6b', red: '#e5484d',
    amber: '#ffb547', yellow: '#ffd166', green: '#38c793', mint: '#7fe0c2', teal: '#22a6a6',
    purple: '#8b7cf6', lilac: '#c4b8ff', pink: '#ff8fb1', slate: '#5b6b7f', steel: '#a9b4c2',
    silver: '#d5dce5', white: '#f7f9fc', ink: '#1f2733', gunmetal: '#3b4552', black: '#262b33',
    brass: '#e3b04b', copper: '#c8763d', lead: '#8a8f99', wood: '#b9805a', sand: '#e9d7b5',
    dirt: '#c9a978', grass: '#9fd49a', grassDark: '#6fb36b', sky2: '#cfe6ff', paper: '#fffaf0',
  };

  function normalize(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function hexToRgb(h) {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r) { return '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  // amt > 0 mixes toward white, < 0 toward a deep shade of the same hue
  function shade(hex, amt) {
    const c = hexToRgb(hex);
    if (amt >= 0) return rgbToHex(c.map((v) => v + (255 - v) * amt));
    const deep = c.map((v) => v * 0.35 + 20);
    return rgbToHex(c.map((v, i) => v + (deep[i] - v) * -amt));
  }
  // Brightness for a face normal: top light, +y face mid, +x face dark
  function faceColor(hex, n) {
    const d = dot(n, LIGHT);
    return d > 0.45 ? shade(hex, (d - 0.45) * 0.55) : shade(hex, -(0.45 - d) * 0.55);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function scene(opts) {
    const o = Object.assign({ w: 640, h: 340, origin: [320, 100], scale: 10, bg: true, radius: 18 }, opts || {});
    const id = 'iso' + (++uid);
    const items = [];   // { layer, svg }
    const overlay = [];
    let seq = 0;

    const P = (p) => [o.origin[0] + (p[0] - p[1]) * COS30 * o.scale, o.origin[1] + (p[0] + p[1]) * SIN30 * o.scale - p[2] * o.scale];
    const pts = (arr) => arr.map((p) => { const q = P(p); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    const push = (svg, layer) => items.push({ layer: layer || 0, seq: seq++, svg });

    // Projected signed area: > 0 means the face is wound toward the viewer
    function facing(face) {
      let a = 0;
      for (let i = 0; i < face.length; i++) {
        const p = P(face[i]), q = P(face[(i + 1) % face.length]);
        a += p[0] * q[1] - q[0] * p[1];
      }
      return a;
    }

    // Draw a set of faces (each a CCW-from-outside polygon) as one object
    function mesh(faces, color, opt) {
      opt = opt || {};
      const vis = [];
      faces.forEach((f) => {
        const pts3 = f.pts || f;
        if (pts3.length < 3) return;
        if (!opt.twoSided && facing(pts3) <= 0) return;
        const n = normalize(cross(sub(pts3[1], pts3[0]), sub(pts3[2], pts3[0])));
        const depth = pts3.reduce((s, p) => s + p[0] + p[1] + p[2] * 0.5, 0) / pts3.length;
        vis.push({ pts3, n, depth, color: f.color || color });
      });
      vis.sort((a, b) => a.depth - b.depth);
      const stroke = opt.outline ? ` stroke="${opt.outline}" stroke-width="${opt.outlineWidth || 1}"` : '';
      const body = vis.map((f) => {
        const fill = opt.flat ? f.color : faceColor(f.color, f.n);
        return `<polygon points="${pts(f.pts3)}" fill="${fill}" stroke="${opt.outline || fill}" stroke-width="${opt.outline ? (opt.outlineWidth || 1) : 0.6}" stroke-linejoin="round"${opt.opacity != null ? ` opacity="${opt.opacity}"` : ''}/>`;
      }).join('');
      push(`<g${stroke ? '' : ''}>${body}</g>`, opt.layer);
    }

    const api = {
      P,
      C,

      // Flat ground tile (top face only) at height z
      floor(x, y, w, d, opt) {
        opt = opt || {};
        const z = opt.z || 0;
        const c = opt.color || 'var(--illus-floor)';
        const r = opt.round != null ? opt.round : 0;
        push(`<polygon points="${pts([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]])}" fill="${c}"${opt.stroke ? ` stroke="${opt.stroke}"` : ''} stroke-linejoin="round" ${r ? `rx="${r}"` : ''}/>`, opt.layer);
        if (opt.grid) {
          let g = '';
          for (let i = 1; i < w / opt.grid; i++) g += `<polyline points="${pts([[x + i * opt.grid, y, z], [x + i * opt.grid, y + d, z]])}" fill="none" stroke="var(--illus-grid)" stroke-width="1"/>`;
          for (let j = 1; j < d / opt.grid; j++) g += `<polyline points="${pts([[x, y + j * opt.grid, z], [x + w, y + j * opt.grid, z]])}" fill="none" stroke="var(--illus-grid)" stroke-width="1"/>`;
          push(g, opt.layer);
        }
      },

      // Soft ground shadow under an object footprint
      shadow(x, y, w, d, opt) {
        opt = opt || {};
        push(`<polygon points="${pts([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]])}" fill="#0b1a2a" opacity="${opt.opacity || 0.14}" filter="url(#${id}-blur)"/>`, opt.layer);
      },

      // Axis-aligned box: x,y,z corner, w along x, d along y, h along z
      box(x, y, z, w, d, h, opt) {
        opt = opt || {};
        const a = [x, y, z], b = [x + w, y, z], c = [x + w, y + d, z], e = [x, y + d, z];
        const A = [x, y, z + h], Bb = [x + w, y, z + h], Cc = [x + w, y + d, z + h], E = [x, y + d, z + h];
        const top = opt.top || opt.color;
        mesh([
          { pts: [A, Bb, Cc, E], color: top },        // top
          [a, e, c, b],                              // bottom
          [a, b, Bb, A],                             // -y
          [e, E, Cc, c],                             // +y
          [a, A, E, e],                              // -x
          [b, c, Cc, Bb],                            // +x
        ], opt.color || C.steel, opt);
      },

      // Solid of revolution along an axis. profile: [[t, r], ...] (t along axis)
      lathe(x, y, z, profile, opt) {
        opt = opt || {};
        const axis = opt.axis || 'x';
        const N = opt.segments || 28;
        const at = (t, r, th) => {
          const u = r * Math.cos(th), v = r * Math.sin(th);
          if (axis === 'x') return [x + t, y + u, z + v];
          if (axis === 'y') return [x + u, y + t, z + v];
          return [x + u, y + v, z + t];
        };
        const rings = profile.map(([t, r]) => Array.from({ length: N }, (_, i) => at(t, r, (i / N) * Math.PI * 2)));
        const faces = [];
        const colors = opt.colors || [];
        for (let k = 0; k < rings.length - 1; k++) {
          const A = rings[k], Bc = rings[k + 1];
          const col = colors[k] || opt.color;
          for (let i = 0; i < N; i++) {
            const j = (i + 1) % N;
            const f = [A[i], A[j], Bc[j], Bc[i]];
            if (profile[k][1] < 1e-6) f.splice(0, 1);
            else if (profile[k + 1][1] < 1e-6) f.splice(2, 1);
            faces.push({ pts: axisFlip(f, axis), color: col });
          }
        }
        const first = profile[0], last = profile[profile.length - 1];
        if (first[1] > 1e-6) faces.push({ pts: axisFlip(rings[0].slice(), axis, true), color: opt.capColor || opt.color });
        if (last[1] > 1e-6) faces.push({ pts: axisFlip(rings[rings.length - 1].slice().reverse(), axis, true), color: opt.capColor || opt.color });
        mesh(faces, opt.color || C.steel, opt);
      },

      // Prism: 2D profile [[u, v], ...] in a plane, extruded by depth.
      // plane 'xz' extrudes along y; 'yz' along x; 'xy' along z.
      extrude(profile, offset, depth, opt) {
        opt = opt || {};
        const plane = opt.plane || 'xz';
        const [ox, oy, oz] = opt.at || [0, 0, 0];
        const map = (u, v, t) => (plane === 'xz' ? [ox + u, oy + t, oz + v] : plane === 'yz' ? [ox + t, oy + u, oz + v] : [ox + u, oy + v, oz + t]);
        let area = 0;
        for (let i = 0; i < profile.length; i++) {
          const p = profile[i], q = profile[(i + 1) % profile.length];
          area += p[0] * q[1] - q[0] * p[1];
        }
        const pr = area > 0 ? profile : profile.slice().reverse(); // CCW in (u, v)
        const o0 = map(0, 0, 0);
        const vec = (u, v, t) => sub(map(u, v, t), o0);
        const dir = vec(0, 0, 1);
        const near = pr.map(([u, v]) => map(u, v, offset + depth));
        const far = pr.map(([u, v]) => map(u, v, offset));
        // Wind each face so its geometric normal matches the known outward normal
        const orient = (face, want) => {
          const n = cross(sub(face[1], face[0]), sub(face[2], face[0]));
          return dot(n, want) >= 0 ? face : face.slice().reverse();
        };
        const faces = [
          { pts: orient(near.slice(), dir), color: opt.face || opt.color },
          { pts: orient(far.slice(), dir.map((c) => -c)), color: opt.face || opt.color },
        ];
        for (let i = 0; i < pr.length; i++) {
          const j = (i + 1) % pr.length;
          const du = pr[j][0] - pr[i][0], dv = pr[j][1] - pr[i][1];
          const out = vec(dv, -du, 0); // outward edge normal of a CCW polygon
          faces.push({ pts: orient([far[i], far[j], near[j], near[i]], out), color: opt.side || opt.color });
        }
        mesh(faces, opt.color || C.steel, opt);
      },

      sphere(x, y, z, r, opt) {
        opt = opt || {};
        const prof = [];
        const n = opt.rings || 10;
        for (let i = 0; i <= n; i++) {
          const a = -Math.PI / 2 + (i / n) * Math.PI;
          prof.push([r * Math.sin(a), r * Math.cos(a)]);
        }
        api.lathe(x, y, z, prof, Object.assign({ axis: 'z', segments: 20 }, opt));
      },

      // Arbitrary filled polygon in 3D
      poly(points, opt) {
        opt = opt || {};
        push(`<polygon points="${pts(points)}" fill="${opt.fill || 'none'}" stroke="${opt.stroke || 'none'}" stroke-width="${opt.width || 1.5}" stroke-linejoin="round"${opt.dash ? ` stroke-dasharray="${opt.dash}"` : ''}${opt.opacity != null ? ` opacity="${opt.opacity}"` : ''}/>`, opt.layer);
      },

      // Polyline / arrow through 3D points
      line(points, opt) {
        opt = opt || {};
        const col = opt.color || C.ink;
        let svg = `<polyline points="${pts(points)}" fill="none" stroke="${col}" stroke-width="${opt.width || 2}" stroke-linecap="round" stroke-linejoin="round"${opt.dash ? ` stroke-dasharray="${opt.dash}"` : ''}${opt.opacity != null ? ` opacity="${opt.opacity}"` : ''}/>`;
        if (opt.arrow) {
          const a = P(points[points.length - 2]), b = P(points[points.length - 1]);
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const s = opt.arrowSize || 9;
          const l = [b[0] - s * Math.cos(ang - 0.45), b[1] - s * Math.sin(ang - 0.45)];
          const r = [b[0] - s * Math.cos(ang + 0.45), b[1] - s * Math.sin(ang + 0.45)];
          svg += `<polygon points="${b[0]},${b[1]} ${l[0]},${l[1]} ${r[0]},${r[1]}" fill="${col}"${opt.opacity != null ? ` opacity="${opt.opacity}"` : ''}/>`;
        }
        push(svg, opt.layer);
      },

      // Smooth curve through 3D points (sampled), e.g. a trajectory
      curve(fn, t0, t1, opt) {
        const n = (opt && opt.samples) || 40;
        const ptsArr = [];
        for (let i = 0; i <= n; i++) ptsArr.push(fn(t0 + (t1 - t0) * i / n));
        api.line(ptsArr, opt);
      },

      // Ellipse lying in a plane (circle in 3D), e.g. a target face or a dial
      disc(cx, cy, cz, r, opt) {
        opt = opt || {};
        const plane = opt.plane || 'xy';
        const n = 40;
        const ring = [];
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2;
          const u = r * Math.cos(a), v = r * Math.sin(a);
          ring.push(plane === 'xy' ? [cx + u, cy + v, cz] : plane === 'xz' ? [cx + u, cy, cz + v] : [cx, cy + u, cz + v]);
        }
        api.poly(ring, opt);
      },

      // Callout: dot on the object, leader line, pill label (optionally numbered)
      label(p, text, opt) {
        opt = opt || {};
        const a = P(p);
        const dx = opt.dx != null ? opt.dx : 40, dy = opt.dy != null ? opt.dy : -30;
        const b = [a[0] + dx, a[1] + dy];
        const fs = opt.size || 12;
        const tw = String(text).length * fs * 0.6 + (opt.n != null ? 22 : 0) + 16;
        const left = dx < 0;
        // keep the pill inside the frame
        const x0 = Math.max(6, Math.min(o.w - tw - 6, left ? b[0] - tw : b[0]));
        b[1] = Math.max(fs + 6, Math.min(o.h - fs - 6, b[1]));
        if (b[0] < x0) b[0] = x0; else if (b[0] > x0 + tw) b[0] = x0 + tw;
        let svg = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${C.ink}" stroke-width="1.2" opacity="0.55"/>`;
        svg += `<circle cx="${a[0]}" cy="${a[1]}" r="3.2" fill="#fff" stroke="${C.ink}" stroke-width="1.4"/>`;
        svg += `<rect x="${x0}" y="${b[1] - fs * 0.95}" width="${tw}" height="${fs * 1.9}" rx="${fs * 0.95}" fill="#fff" stroke="rgba(31,39,51,.12)" filter="url(#${id}-lift)"/>`;
        let tx = x0 + 10;
        if (opt.n != null) {
          svg += `<circle cx="${x0 + fs * 0.95}" cy="${b[1]}" r="${fs * 0.68}" fill="${opt.color || C.blue}"/><text x="${x0 + fs * 0.95}" y="${b[1] + fs * 0.36}" text-anchor="middle" font-size="${fs * 0.85}" font-weight="700" fill="#fff">${esc(opt.n)}</text>`;
          tx = x0 + fs * 1.9 + 4;
        }
        svg += `<text x="${tx}" y="${b[1] + fs * 0.36}" font-size="${fs}" font-weight="600" fill="${C.ink}">${esc(text)}</text>`;
        overlay.push(svg);
      },

      // Free 2D text in screen coordinates (titles, units, annotations)
      text(x, y, text, opt) {
        opt = opt || {};
        overlay.push(`<text x="${x}" y="${y}" font-size="${opt.size || 12}" font-weight="${opt.weight || 600}" fill="${opt.color || 'var(--illus-ink)'}" text-anchor="${opt.anchor || 'start'}"${opt.mono ? ' font-family="JetBrains Mono, monospace"' : ''}>${esc(text)}</text>`);
      },

      // Text placed at a 3D point
      text3(p, text, opt) { const q = P(p); api.text(q[0] + ((opt && opt.dx) || 0), q[1] + ((opt && opt.dy) || 0), text, opt); },

      // Raw SVG (screen space) for special cases
      raw(svg, layer) { push(svg, layer); },

      svg() {
        items.sort((a, b) => a.layer - b.layer || a.seq - b.seq);
        const bg = o.bg ? `<rect width="${o.w}" height="${o.h}" rx="${o.radius}" fill="url(#${id}-bg)"/>
          <circle cx="${o.w * 0.86}" cy="${o.h * 0.18}" r="${o.h * 0.38}" fill="var(--illus-blob)" opacity=".55"/>
          <circle cx="${o.w * 0.1}" cy="${o.h * 0.92}" r="${o.h * 0.28}" fill="var(--illus-blob2)" opacity=".5"/>` : '';
        return `<svg viewBox="0 0 ${o.w} ${o.h}" class="iso-svg" role="img" font-family="Inter, system-ui, sans-serif">
          <defs>
            <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--illus-bg1)"/><stop offset="1" stop-color="var(--illus-bg2)"/></linearGradient>
            <filter id="${id}-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
            <filter id="${id}-lift" x="-10%" y="-30%" width="120%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0b1a2a" flood-opacity=".18"/></filter>
          </defs>
          ${bg}${items.map((i) => i.svg).join('')}${overlay.join('')}</svg>`;
      },
    };
    return api;
  }

  // Lathe ring winding depends on the axis handedness; flip so faces wind outward
  function axisFlip(face, axis, cap) {
    const flip = axis === 'y' ? !cap : !!cap;
    return flip ? face.slice().reverse() : face;
  }

  // Registry so illustration files can attach figures to lessons and modules
  const registry = { lesson: {}, module: {} };
  function lesson(id, fig) { (registry.lesson[id] = registry.lesson[id] || []).push(fig); }
  function module(id, draw) { registry.module[id] = draw; }

  root.ISO = { scene, C, shade, lesson, module, registry };
})(typeof window !== 'undefined' ? window : globalThis);
