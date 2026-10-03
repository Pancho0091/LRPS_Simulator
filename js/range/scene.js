/*
 * Canvas scene for the Range: the scope view (terrain, mirage, target,
 * impacts, FFP mil reticle, bubble level) and the wind-flag strip.
 * Pure drawing: it reads a state object and never touches the DOM.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const RANGE = (window.LRPS_RANGE = window.LRPS_RANGE || {});
  const B = L.B;

  const seed = { mirage: [], trees: [], tufts: [], rocks: [] };
  seed.mirage = Array.from({ length: 52 }, () => ({ x: Math.random(), y: 0.2 + Math.random() * 0.75, len: 0.04 + Math.random() * 0.1, ph: Math.random() * 6 }));
  seed.trees = Array.from({ length: 64 }, (_, i) => 0.5 + 0.5 * Math.sin(i * 1.7) * Math.cos(i * 0.63) + Math.random() * 0.4);
  seed.tufts = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), h: 0.4 + Math.random() * 0.6 }));
  seed.rocks = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), r: 0.3 + Math.random() * 0.7 }));

  function fitCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }
  RANGE.fitCanvas = fitCanvas;

  /*
   * st: { target:{yards, plateIn, kind:'steel'|'paper', shape}, halfFov, sway:{x,y},
   *       cant, recoilAt, marks:[{upIn,rightIn,hit,n}], puffs:[{up,right,t0,hit}],
   *       swing:{t0,amp}, spotter, bubble, world, sky, reduced, angleDeg, dim }
   */
  RANGE.drawScope = function (cv, st, now) {
    const dpr = fitCanvas(cv);
    const S = cv.width;
    const t = st.target;
    if (!S || !t) return;
    const ctx = cv.getContext('2d');
    const cx = S / 2, cy = S / 2;
    const px = (S / 2) / st.halfFov;
    const yards = t.yards;
    const toMil = (inches) => B.inchesToMil(inches, yards);
    const toPx = (inches) => toMil(inches) * px;

    let jy = 0, jx = 0;
    if (st.recoilAt && now - st.recoilAt < 300 && !st.reduced) {
      const k = 1 - (now - st.recoilAt) / 300;
      jy = -S * 0.07 * st.recoil * k * k;
      jx = S * 0.012 * st.recoil * Math.sin(now / 14) * k;
    }
    const sw = st.sway;

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    // World moves opposite to the wandering reticle and tilts against cant
    ctx.translate(cx + jx - sw.x * px, cy + jy + sw.y * px);
    ctx.rotate(-st.cant * Math.PI / 180);
    ctx.translate(-cx, -cy);

    const groundY = Math.min(S * 1.2, cy + toPx(t.kind === 'paper' ? 30 : 40));
    const sun = st.sky ? st.sky.sun : 0.6;
    const sky = ctx.createLinearGradient(0, 0, 0, S);
    sky.addColorStop(0, sun > 0.8 ? '#7fa9c9' : sun > 0.3 ? '#8fb0c6' : '#9aa7b0');
    sky.addColorStop(1, sun > 0.3 ? '#d6e2e6' : '#c7ced2');
    ctx.fillStyle = sky; ctx.fillRect(-S, -S, S * 3, S * 3);

    // Far ridge / tree line
    const treeTop = Math.min(groundY - S * 0.05, S * 0.28);
    ctx.fillStyle = sun > 0.3 ? '#3d5a3c' : '#405045';
    ctx.beginPath();
    ctx.moveTo(-S, groundY);
    seed.trees.forEach((h, i) => ctx.lineTo(-S * 0.3 + i / (seed.trees.length - 1) * S * 1.6, treeTop - h * S * 0.07));
    ctx.lineTo(S * 2, groundY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(30, 50, 32, 0.5)';
    ctx.fillRect(-S, treeTop + S * 0.03, S * 3, groundY - treeTop);

    const ground = ctx.createLinearGradient(0, groundY, 0, S * 1.3);
    ground.addColorStop(0, '#8c7a50'); ground.addColorStop(0.12, '#7c8a4c'); ground.addColorStop(1, '#556236');
    ctx.fillStyle = ground; ctx.fillRect(-S, groundY, S * 3, S * 2);
    // Berm behind the target
    ctx.fillStyle = '#9a8657';
    ctx.beginPath(); ctx.ellipse(cx, groundY, Math.max(toPx(90), S * 0.3), toPx(12) + 4, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 55, 25, 0.55)';
    ctx.lineWidth = Math.max(1, S / 400);
    seed.tufts.forEach((tf) => {
      const x = -S * 0.2 + tf.x * S * 1.4, y = groundY + 6 + tf.y * (S * 1.1 - groundY);
      const h = tf.h * S * 0.018;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h * 0.3, y - h); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.3, y - h); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(90, 80, 60, 0.55)';
    seed.rocks.forEach((rk) => {
      const x = -S * 0.2 + rk.x * S * 1.4, y = groundY + 10 + rk.y * (S * 1.1 - groundY);
      ctx.beginPath(); ctx.ellipse(x, y, rk.r * S * 0.012, rk.r * S * 0.006, 0, 0, Math.PI * 2); ctx.fill();
    });

    // Mirage follows the mid-range crosswind: boils when calm, runs with wind, flattens past ~12 mph
    if (st.world) {
      const mid = RANGE.zoneWind(st.world, now, 1);
      const cross = Math.sin(mid.dirDeg * Math.PI / 180) * mid.speed;
      const strength = (st.sky ? st.sky.mirage : 0.8) * RANGE.clamp((st.world.tempF - 35) / 50, 0.15, 1.3) * Math.min(1.4, 0.5 + yards / 500);
      const boil = Math.max(0, 1 - Math.abs(cross) / 3);
      const fade = Math.max(0.15, 1 - Math.abs(cross) / 16) * strength;
      const anim = st.reduced ? 0 : 1;
      seed.mirage.forEach((m) => {
        if (anim) {
          m.x -= cross * 0.00018 * (1 + m.len * 4);
          if (m.x < -0.3) m.x += 1.6;
          if (m.x > 1.3) m.x -= 1.6;
        }
        const y = m.y * S + anim * (Math.sin(now / 300 + m.ph) * 2 - boil * ((now / 40 + m.ph * 50) % 20));
        ctx.strokeStyle = `rgba(255,255,255,${(0.05 + 0.05 * Math.sin(now / 500 + m.ph) ** 2) * fade})`;
        ctx.lineWidth = S * 0.004;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const xx = (m.x + m.len * i / 10) * S;
          const yy = y + Math.sin(i * 0.9 + now / 180 * anim + m.ph) * S * 0.003;
          if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      });
    }

    if (t.kind === 'paper') drawPaper(ctx, st, cx, cy, groundY, toPx, px, dpr);
    else drawSteel(ctx, st, cx, cy, groundY, toPx, px, dpr, now);

    // misses: lingering dust and (if a spotter is calling) numbered rings
    st.puffs = st.puffs.filter((p) => now - p.t0 < 5200);
    st.puffs.forEach((p) => {
      const age = now - p.t0;
      const x = cx + p.right * px, y = cy - p.up * px;
      if (age < 1300) {
        const k = age / 1300;
        const r = (8 + k * 34) * dpr;
        ctx.fillStyle = p.hit ? `rgba(255,240,200,${0.7 * (1 - k)})` : `rgba(150,120,80,${0.55 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x, y - k * 10 * dpr, r, 0, Math.PI * 2); ctx.fill();
      }
      if (!p.hit) {
        // a dust smudge stays on the berm long enough to read against the reticle
        const k = Math.min(1, age / 400), f = age > 3400 ? 1 - (age - 3400) / 1800 : 1;
        ctx.fillStyle = `rgba(120,95,60,${0.5 * k * f})`;
        ctx.beginPath(); ctx.ellipse(x, y, 7 * dpr, 4 * dpr, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
    if (st.spotter) {
      ctx.font = `600 ${Math.round(11 * dpr)}px JetBrains Mono, monospace`;
      st.marks.forEach((m, i) => {
        if (m.hit || m.paper) return;
        const last = i === st.marks.length - 1;
        const x = cx + toPx(m.rightIn), y = cy - toPx(m.upIn);
        ctx.strokeStyle = last ? '#ef4444' : 'rgba(239,68,68,0.5)';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(x, y, (last ? 6 : 4.5) * dpr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = last ? '#ef4444' : 'rgba(239,68,68,0.6)';
        ctx.fillText(String(m.n), x + 8 * dpr, y - 7 * dpr);
      });
    }
    ctx.restore();

    drawReticle(ctx, S, cx, cy, px, st, dpr);
  };

  function drawSteel(ctx, st, cx, cy, groundY, toPx, px, dpr, now) {
    const t = st.target;
    const pr = toPx(t.plateIn / 2);
    const chain = Math.max(pr * 0.5, 3);
    const barY = cy - pr - chain;
    const postX = pr * 1.7 + 2;
    ctx.strokeStyle = '#5b4630';
    ctx.lineWidth = Math.max(2, pr * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - postX, groundY); ctx.lineTo(cx - postX, barY);
    ctx.lineTo(cx + postX, barY); ctx.lineTo(cx + postX, groundY);
    ctx.stroke();

    let ang = 0;
    if (st.swing.amp && !st.reduced) {
      const tt = (now - st.swing.t0) / 1000;
      ang = st.swing.amp * Math.exp(-tt * 1.6) * Math.sin(tt * 9);
      if (tt > 4) st.swing.amp = 0;
    }
    ctx.save();
    ctx.translate(cx, barY);
    ctx.rotate(ang);
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = Math.max(1, pr * 0.05);
    ctx.beginPath();
    ctx.moveTo(-pr * 0.45, 0); ctx.lineTo(-pr * 0.45, chain + pr * 0.2);
    ctx.moveTo(pr * 0.45, 0); ctx.lineTo(pr * 0.45, chain + pr * 0.2);
    ctx.stroke();
    ctx.translate(0, chain + pr);
    const plate = ctx.createRadialGradient(-pr * 0.3, -pr * 0.3, pr * 0.1, 0, 0, pr);
    const painted = t.paint || 'white';
    plate.addColorStop(0, painted === 'orange' ? '#ffb15c' : '#ffffff');
    plate.addColorStop(1, painted === 'orange' ? '#d9772a' : '#cfd3d6');
    ctx.fillStyle = plate;
    ctx.beginPath();
    if (t.shape === 'square') ctx.rect(-pr, -pr, pr * 2, pr * 2); else ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, pr * 0.04); ctx.stroke();
    st.marks.filter((m) => m.hit).forEach((m) => {
      const x = toPx(m.rightIn), y = -toPx(m.upIn);
      const r = Math.max(2.5, pr * 0.1);
      ctx.fillStyle = 'rgba(70,72,76,0.85)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(70,72,76,0.5)'; ctx.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + m.n;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 2.2); ctx.stroke();
      }
    });
    ctx.restore();
  }

  /* A paper zero target: 1" grid, orange centre, bullet holes. */
  function drawPaper(ctx, st, cx, cy, groundY, toPx, px, dpr) {
    const w = toPx(18), h = toPx(24);
    const top = cy - h / 2;
    // stand
    ctx.strokeStyle = '#6b5a3e';
    ctx.lineWidth = Math.max(2, toPx(1));
    ctx.beginPath(); ctx.moveTo(cx - w * 0.4, groundY); ctx.lineTo(cx - w * 0.4, top + h * 0.3);
    ctx.moveTo(cx + w * 0.4, groundY); ctx.lineTo(cx + w * 0.4, top + h * 0.3); ctx.stroke();
    ctx.fillStyle = '#f7f3e8';
    ctx.fillRect(cx - w / 2, top, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = dpr; ctx.strokeRect(cx - w / 2, top, w, h);
    // 1-inch grid, every 5" bold
    const inch = toPx(1);
    ctx.lineWidth = Math.max(0.5, dpr * 0.5);
    for (let i = -9; i <= 9; i++) {
      const bold = i % 5 === 0;
      ctx.strokeStyle = bold ? 'rgba(40,40,40,0.5)' : 'rgba(40,40,40,0.16)';
      ctx.beginPath(); ctx.moveTo(cx + i * inch, top); ctx.lineTo(cx + i * inch, top + h); ctx.stroke();
    }
    for (let i = -12; i <= 12; i++) {
      const bold = i % 5 === 0;
      ctx.strokeStyle = bold ? 'rgba(40,40,40,0.5)' : 'rgba(40,40,40,0.16)';
      ctx.beginPath(); ctx.moveTo(cx - w / 2, cy + i * inch); ctx.lineTo(cx + w / 2, cy + i * inch); ctx.stroke();
    }
    // aiming diamond 1" and rings
    ctx.fillStyle = '#f26a1b';
    ctx.beginPath(); ctx.moveTo(cx, cy - inch * 0.75); ctx.lineTo(cx + inch * 0.75, cy); ctx.lineTo(cx, cy + inch * 0.75); ctx.lineTo(cx - inch * 0.75, cy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = dpr;
    [2, 4].forEach((r) => { ctx.beginPath(); ctx.arc(cx, cy, inch * r, 0, Math.PI * 2); ctx.stroke(); });
    // bullet holes
    const cal = Math.max(2.5 * dpr, toPx(st.target.calIn || 0.3) / 2);
    st.marks.forEach((m, i) => {
      const x = cx + toPx(m.rightIn), y = cy - toPx(m.upIn);
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(x, y, cal, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, dpr * 0.8);
      ctx.beginPath(); ctx.arc(x, y, cal + dpr, 0, Math.PI * 2); ctx.stroke();
      if (i === st.marks.length - 1) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(x, y, cal + 5 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  function drawReticle(ctx, S, cx, cy, px, st, dpr) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    const ink = 'rgba(10,10,10,0.92)';
    ctx.strokeStyle = ink; ctx.fillStyle = ink;
    const hf = st.halfFov;
    const edge = hf * 0.82 * px;
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(cx - edge, cy);
    ctx.moveTo(S, cy); ctx.lineTo(cx + edge, cy);
    ctx.moveTo(cx, S); ctx.lineTo(cx, cy + edge);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, dpr * (hf > 8 ? 0.8 : 1));
    ctx.beginPath();
    ctx.moveTo(cx - edge, cy); ctx.lineTo(cx + edge, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, cy + edge);
    ctx.stroke();
    ctx.font = `600 ${Math.round(10 * dpr)}px JetBrains Mono, monospace`;
    const minor = hf > 8 ? 1 : 0.5;
    const labelEvery = hf > 8 ? 2 : 1;
    for (let v = minor; v < hf * 0.82; v += minor) {
      const major = Math.abs(v % 1) < 1e-9;
      const len = (major ? 7 : 3.5) * dpr * (hf > 8 ? 0.8 : 1);
      [-1, 1].forEach((sg) => {
        const d = sg * v * px;
        ctx.beginPath();
        ctx.moveTo(cx + d, cy - len); ctx.lineTo(cx + d, cy + len);
        ctx.moveTo(cx - len, cy + d); ctx.lineTo(cx + len, cy + d);
        ctx.stroke();
      });
      if (major && v % labelEvery === 0) {
        ctx.fillText(String(v), cx + v * px - 3 * dpr, cy + 18 * dpr);
        ctx.fillText(String(v), cx + 10 * dpr, cy + v * px + 4 * dpr);
      }
    }
    // Christmas-tree hold dots under the centre, every 0.5 mil
    ctx.fillStyle = 'rgba(10,10,10,0.6)';
    for (let v = 1; v < hf * 0.8; v += 1) {
      for (let hx = 0.5; hx <= Math.min(v * 0.5, hf * 0.5); hx += 0.5) {
        [-1, 1].forEach((sg) => { ctx.beginPath(); ctx.arc(cx + sg * hx * px, cy + v * px, 1.1 * dpr, 0, Math.PI * 2); ctx.fill(); });
      }
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx, cy, 2.2 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(10,10,10,0.8)';
    ctx.fillText(`MIL ${st.zoomX || ''}×`.trim(), 12 * dpr, cy - 10 * dpr);

    const vg = ctx.createRadialGradient(cx, cy, S * 0.36, cx, cy, S * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);

    if (st.bubble) {
      const vw = S * 0.2, vh = S * 0.035, vx = cx - vw / 2, vy = S * 0.83;
      ctx.fillStyle = 'rgba(20,30,20,0.85)';
      ctx.beginPath(); ctx.roundRect(vx - 4 * dpr, vy - 4 * dpr, vw + 8 * dpr, vh + 8 * dpr, 8 * dpr); ctx.fill();
      ctx.fillStyle = Math.abs(st.cant) < 0.5 ? '#c7e86b' : '#e8c36b';
      ctx.beginPath(); ctx.roundRect(vx, vy, vw, vh, vh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(cx - vh * 0.7, vy); ctx.lineTo(cx - vh * 0.7, vy + vh); ctx.moveTo(cx + vh * 0.7, vy); ctx.lineTo(cx + vh * 0.7, vy + vh); ctx.stroke();
      const bx = cx - Math.max(-1, Math.min(1, st.cant / 4)) * (vw / 2 - vh / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.ellipse(bx, vy + vh / 2, vh * 0.6, vh * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* Three flags: near, mid, far. Direction and droop follow the zone wind. */
  RANGE.drawFlags = function (cv, world, now, reduced) {
    const dpr = fitCanvas(cv);
    const W = cv.width, H = cv.height;
    if (!W || !world) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const spots = [{ x: 0.16, k: 1, z: 0, name: 'NEAR' }, { x: 0.5, k: 0.82, z: 1, name: 'MID' }, { x: 0.82, k: 0.66, z: 2, name: 'FAR' }];
    spots.forEach((sp) => {
      const w = RANGE.zoneWind(world, now, sp.z);
      const a = w.dirDeg * Math.PI / 180;
      const sinC = Math.sin(a);
      const baseX = sp.x * W;
      const groundY = H * 0.72;
      const topY = groundY - H * 0.6 * sp.k;
      ctx.strokeStyle = '#3b3b3b';
      ctx.lineWidth = 2 * dpr * sp.k;
      ctx.beginPath(); ctx.moveTo(baseX, groundY); ctx.lineTo(baseX, topY); ctx.stroke();
      const sp01 = Math.min(1, w.speed / 18);
      const droop = (1 - sp01) * 1.25;
      const dir = sinC > 0.05 ? -1 : sinC < -0.05 ? 1 : (Math.cos(a) > 0 ? 1 : -1);
      const len = W * 0.12 * sp.k * Math.max(0.3, Math.abs(sinC));
      const wid = 12 * dpr * sp.k;
      const n = 12;
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const q = i / n;
        const wave = reduced ? 0 : Math.sin(now / (110 - sp01 * 50) - q * 6 + sp.z * 2.4) * q * 4 * dpr * (0.4 + sp01);
        const ax = baseX + dir * Math.cos(droop) * len * q;
        const ay = topY + Math.sin(droop) * len * q + wave;
        const hw = wid * (1 - q * 0.7);
        top.push([ax, ay]);
        bot.push([ax - dir * Math.sin(droop) * hw, ay + Math.cos(droop) * hw]);
      }
      ctx.fillStyle = '#ef6c2f';
      ctx.beginPath();
      top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      bot.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `700 ${Math.round(9 * dpr)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(sp.name, baseX, H - 6 * dpr);
    });
  };
})();
