/*
 * Range tab: a steel-plate shooting simulator driven by the real solver.
 *
 * The "world" differs from the card in ways a real range does: the wind
 * gusts over time (read it from the flags and mirage), each shot has
 * velocity spread and rifle dispersion, and optionally the true muzzle
 * velocity differs from the card (truing practice).
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;

  const scope = $('#scope');
  const sctx = scope.getContext('2d');
  const flags = $('#flags');
  const fctx = flags.getContext('2d');

  const R = {
    s: null,              // current scenario
    dial: { elev: 0, wind: 0 },
    flight: null,         // { start, tof, result }
    puffs: [],            // transient impact puffs
    swing: { t0: 0, amp: 0 },
    session: { shots: 0, hits: 0, targets: 0, firstHits: 0, streak: 0 },
    best: L.store.get('range.bestStreak', 0),
    shotNo: 0,
    running: false,
    mirage: Array.from({ length: 46 }, () => ({ x: Math.random(), y: 0.25 + Math.random() * 0.7, len: 0.04 + Math.random() * 0.1, ph: Math.random() * 6 })),
    trees: Array.from({ length: 64 }, (_, i) => 0.5 + 0.5 * Math.sin(i * 1.7) * Math.cos(i * 0.63) + Math.random() * 0.4),
    tufts: Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), h: 0.4 + Math.random() * 0.6 })),
  };

  const unit = () => L.profile.unit;
  const click = () => +L.profile.clickSize || L.clickFor(unit());

  // ----------------------------------------------------------- wind

  // Smooth pseudo-random gusting: sum of incommensurate sines.
  function windAt(t, offset) {
    const s = R.s;
    if (!s) return { speed: 0, clock: 3 };
    const tt = t / 1000 + (offset || 0);
    if (s.baseWind === 0) {
      return { speed: 1 + Math.sin(tt * 0.7 + s.ph1), clock: (s.clock + 3 * Math.sin(tt * 0.21 + s.ph2) + 12) % 12 };
    }
    const g = s.gustSpread * (0.62 * Math.sin(tt * 0.43 + s.ph1) + 0.38 * Math.sin(tt * 1.37 + s.ph2));
    return { speed: Math.max(0, s.baseWind + g), clock: s.clock };
  }

  // The bullet feels a blend of the wind along its path; near wind matters most.
  function pathWind(t) {
    const w = [windAt(t, 0), windAt(t, -0.8), windAt(t, -1.6)];
    const speed = 0.4 * w[0].speed + 0.35 * w[1].speed + 0.25 * w[2].speed;
    return { speed, clock: w[0].clock };
  }

  // ------------------------------------------------------- scenario

  function newTarget() {
    const p = L.profile;
    const maxR = Math.max(400, Math.min(1500, +p.rangeEnd || 1000));
    const minR = Math.min(300, maxR - 100);
    const yards = Math.round(L.rand(minR, maxR) / 5) * 5;
    const gusts = $('#opt-gusts').checked;
    const baseWind = L.randInt(0, 14);
    const clock = L.pick([1, 2, 3, 3, 4, 5, 7, 8, 9, 9, 10, 11, 12]);
    const mvOffset = $('#opt-truing').checked ? Math.round(L.pick([-1, 1]) * L.rand(30, 70)) : 0;
    const trueMv = +p.muzzleVelocityFps + mvOffset;
    const zeroAngleRad = B.solve(L.solverInput(p, { muzzleVelocityFps: trueMv, windMph: 0 }), [+p.zeroYards]).zeroAngleRad;

    R.s = {
      unit: p.unit,
      yards,
      baseWind,
      gustSpread: gusts && baseWind ? 2 + Math.floor(baseWind / 5) : 0,
      clock,
      ph1: Math.random() * 10,
      ph2: Math.random() * 10,
      trueMv,
      mvOffset,
      zeroAngleRad,
      plateIn: Math.max(2, +$('#opt-plate').value || 12),
      precisionMoa: Math.max(0, +$('#opt-precision').value || 0),
      marks: [],
      hitOnce: false,
      shotsHere: 0,
    };
    R.session.targets++;
    R.puffs = [];
    setDial('elev', 0, true);
    setDial('wind', 0, true);
    $('#range-feedback').innerHTML = '<span class="hint">Look up the range on your card, read the wind, dial, send it.</span>';
    renderBrief();
    renderHud();
  }

  function windCallText(s) {
    if (s.baseWind === 0) return 'Calm · 0–2 mph, variable';
    const speed = s.gustSpread
      ? `${Math.max(0, s.baseWind - s.gustSpread)}–${s.baseWind + s.gustSpread} mph`
      : `${s.baseWind} mph`;
    return `${speed} from ${s.clock} o'clock`;
  }

  function renderBrief() {
    const s = R.s;
    const plateUnits = L.toUnit(s.plateIn, s.yards, s.unit);
    $('#range-brief').innerHTML = `
      <div class="tile wide"><div class="label">Rangefinder</div><div class="range-num">${s.yards}<small> yd</small></div></div>
      <div class="tile wide"><div class="label">Wind call</div><div style="font-weight:700;font-size:16px">${windCallText(s)}</div></div>
      <div class="tile"><div class="label">Plate</div><div class="value" style="font-size:17px">${s.plateIn}"<small>${plateUnits.toFixed(2)} ${s.unit}</small></div></div>
      <div class="tile"><div class="label">Mode</div><div style="font-weight:700;font-size:13px;margin-top:4px">${s.mvOffset ? 'Truing: MV off' : s.gustSpread ? 'Gusting wind' : 'Steady wind'}</div></div>`;
  }

  function renderHud() {
    const ss = R.session;
    const pct = ss.shots ? Math.round(ss.hits / ss.shots * 100) + '%' : '–';
    const tile = (l, v) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div></div>`;
    $('#range-hud').innerHTML = tile('Shots', ss.shots) + tile('Hits', ss.hits) + tile('Hit %', pct) +
      tile('1st-round', `${ss.firstHits}/${Math.max(0, ss.targets - (R.s && !R.s.shotsHere ? 1 : 0))}`) +
      tile('Streak', `${ss.streak}<small>best ${R.best}</small>`);
  }

  // ---------------------------------------------------------- turrets

  // 100 clicks per revolution; a tick every 2 clicks, a long tick every 20.
  function buildDial(svg) {
    let ticks = '';
    for (let j = 0; j < 50; j++) {
      const a = j * 7.2 * Math.PI / 180;
      const major = j % 10 === 0;
      const r1 = major ? 26 : 30;
      ticks += `<line class="tick${major ? ' major' : ''}" x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * 37}" y2="${-Math.cos(a) * 37}"/>`;
    }
    let knurl = '';
    for (let k = 0; k < 60; k++) {
      const a = k * 6 * Math.PI / 180;
      knurl += `<line x1="${Math.sin(a) * 42}" y1="${-Math.cos(a) * 42}" x2="${Math.sin(a) * 48}" y2="${-Math.cos(a) * 48}" stroke="#4a504c" stroke-width="2"/>`;
    }
    svg.innerHTML = `<circle class="knurl" r="48"/><g class="ring">${knurl}<circle class="face" r="40"/>${ticks}</g>
      <path class="index" d="M0,-41 L-4,-48 L4,-48 Z"/>`;
  }

  function setDial(axis, value, silent) {
    const c = click();
    const v = +B.roundToClick(value, c).toFixed(L.decimalsFor(c));
    const prev = R.dial[axis];
    R.dial[axis] = v;
    const el = $(`.turret[data-axis="${axis}"]`);
    $('input', el).value = v.toFixed(L.decimalsFor(c));
    $('input', el).step = c;
    const clicks = Math.round(v / c);
    $('.ring', el).style.transform = `rotate(${-clicks * 3.6}deg)`;
    const dirWord = axis === 'elev' ? (v > 0 ? 'UP' : v < 0 ? 'DOWN' : '') : (v > 0 ? 'RIGHT' : v < 0 ? 'LEFT' : '');
    $('.dial-value', el).innerHTML = `<div>${Math.abs(v).toFixed(L.decimalsFor(c))}<small>${dirWord || unit()}</small></div>`;
    if (!silent && v !== prev) L.sfx.click();
  }

  function nudge(axis, clicks) {
    setDial(axis, R.dial[axis] + clicks * click());
  }

  $$('.turret').forEach((el) => {
    const axis = el.dataset.axis;
    $$('button', el).forEach((b) => b.addEventListener('click', () => nudge(axis, +b.dataset.step)));
    $('input', el).addEventListener('change', (e) => setDial(axis, parseFloat(e.target.value) || 0));
    // Scroll on the dial to turn it
    $('.dial', el).addEventListener('wheel', (e) => {
      e.preventDefault();
      nudge(axis, e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  });

  // ------------------------------------------------------------- fire

  function fire() {
    const s = R.s;
    if (!s || R.flight) return;
    const p = L.profile;
    const now = performance.now();
    const w = pathWind(now);
    const mv = s.trueMv + L.gauss() * 8; // 8 fps SD
    const row = B.solve(L.solverInput(p, {
      muzzleVelocityFps: mv,
      windMph: w.speed,
      windClock: w.clock,
      zeroAngleRad: s.zeroAngleRad,
      spinDrift: !!p.spinDrift,
    }), [s.yards]).rows[0];

    // Precision = 5-shot group size → sigma ≈ size / 3 per axis
    const sigmaIn = B.moaToInches(s.precisionMoa, s.yards) / 3;
    const upIn = row.dropIn + L.fromUnit(R.dial.elev, s.yards, s.unit) + L.gauss() * sigmaIn;
    const rightIn = row.windIn + L.fromUnit(R.dial.wind, s.yards, s.unit) + L.gauss() * sigmaIn;
    const hit = Math.hypot(upIn, rightIn) <= s.plateIn / 2;

    R.flight = { start: now, tof: row.tofSec * 1000, upIn, rightIn, hit, dialE: R.dial.elev, dialW: R.dial.wind, windMph: w.speed };
    $('#fire-btn').disabled = true;
    L.sfx.shot();
    R.recoilAt = now;
  }

  function land() {
    const f = R.flight;
    const s = R.s;
    R.flight = null;
    $('#fire-btn').disabled = false;
    $('#flight-bar').style.width = '0';
    const up = L.toUnit(f.upIn, s.yards, s.unit);
    const right = L.toUnit(f.rightIn, s.yards, s.unit);
    const first = s.shotsHere === 0;
    s.shotsHere++;
    R.shotNo++;
    const ss = R.session;
    ss.shots++;
    s.marks.push({ up, right, upIn: f.upIn, rightIn: f.rightIn, hit: f.hit, n: R.shotNo });
    R.puffs.push({ up, right, t0: performance.now(), hit: f.hit });

    const soundDelay = $('#opt-delay').checked ? s.yards * 3 / 1125 : 0;
    if (f.hit) {
      ss.hits++;
      ss.streak++;
      if (ss.streak > R.best) { R.best = ss.streak; L.store.set('range.bestStreak', R.best); }
      R.swing = { t0: performance.now(), amp: 0.22 + Math.min(0.2, s.plateIn / 120) };
      if (first) ss.firstHits++;
      s.hitOnce = true;
      L.sfx.ding(soundDelay);
      setHud(`Impact · ding in ${soundDelay.toFixed(1)} s`, soundDelay * 1000 + 900);
      const xp = 10 + Math.floor(s.yards / 100) + (first ? 15 : 0) + (ss.streak >= 3 ? 5 : 0);
      setTimeout(() => {
        L.addXp(xp, first ? 'first-round hit!' : 'hit');
        if (first) {
          const r = scope.getBoundingClientRect();
          L.confetti(r.left + r.width / 2, r.top + r.height / 2);
        }
      }, soundDelay * 1000);
    } else {
      ss.streak = 0;
      L.sfx.thud(soundDelay * 0.6);
      setHud('Miss · read the splash', 1200);
    }

    const c = click();
    const dp = L.decimalsFor(c);
    const vWord = up >= 0 ? 'high' : 'low';
    const hWord = right >= 0 ? 'right' : 'left';
    const corrE = B.roundToClick(f.dialE - up, c);
    const corrW = B.roundToClick(f.dialW - right, c);
    $('#range-feedback').innerHTML = `
      <div class="verdict ${f.hit ? 'hit' : 'miss'}">${f.hit ? (first ? 'FIRST-ROUND HIT' : 'HIT') : 'MISS'}</div>
      <div>Impact <b class="mono">${Math.abs(up).toFixed(2)} ${s.unit} ${vWord}</b>, <b class="mono">${Math.abs(right).toFixed(2)} ${s.unit} ${hWord}</b> of center.</div>
      ${f.hit ? '' : `<div class="hint" style="margin-top:4px">Correction from this impact: elev <b class="mono">${corrE.toFixed(dp)}</b>, wind <b class="mono">${corrW.toFixed(dp)}</b>. One shot isn't a trend — gusts and dispersion add noise.</div>`}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${R.shotNo}</td><td>${s.yards}</td><td>${f.dialE}</td><td>${f.dialW}</td>` +
      `<td>${up.toFixed(2)} / ${right.toFixed(2)}</td><td style="color:var(--${f.hit ? 'good' : 'bad'})">${f.hit ? 'hit' : 'miss'}</td>`;
    $('#shot-log tbody').prepend(tr);
    renderHud();
  }

  let hudTimer = 0;
  function setHud(text, ms) {
    const el = $('#scope-hud');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(hudTimer);
    if (ms) hudTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function reveal() {
    const s = R.s;
    if (!s) return;
    const p = L.profile;
    const c = click();
    const card = B.solve(L.solverInput(p, { windMph: s.baseWind, windClock: s.clock }), [s.yards]).rows[0];
    const truth = B.solve(L.solverInput(p, {
      muzzleVelocityFps: s.trueMv, windMph: s.baseWind, windClock: s.clock,
      zeroAngleRad: s.zeroAngleRad, spinDrift: !!p.spinDrift,
    }), [s.yards]).rows[0];
    const f = (inches) => L.fmtClick(L.toUnit(inches, s.yards, s.unit), c);
    $('#range-feedback').insertAdjacentHTML('beforeend', `
      <pre class="code">Card  (MV ${p.muzzleVelocityFps}): elev ${f(-card.dropIn)}, wind ${f(-card.windIn)} ${s.unit}
True  (MV ${s.trueMv}): elev ${f(-truth.dropIn)}, wind ${f(-truth.windIn)} ${s.unit}
${s.mvOffset ? `Hidden MV error: ${s.mvOffset > 0 ? '+' : ''}${s.mvOffset} fps. To true the card, change MV
on Build Card until its ${s.yards} yd elevation matches what hit.` : 'No MV error: any difference is wind, spin drift or noise.'}
Wind shown for the average call (${s.baseWind} mph); gusts move it.</pre>`);
  }

  $('#fire-btn').addEventListener('click', fire);
  $('#range-new').addEventListener('click', () => { newTarget(); L.sfx.click(); });
  $('#range-reveal').addEventListener('click', reveal);
  $('#range-reset').addEventListener('click', () => { setDial('elev', 0); setDial('wind', 0); });
  ['#opt-plate', '#opt-precision', '#opt-truing', '#opt-gusts'].forEach((id) =>
    $(id).addEventListener('change', () => { newTarget(); L.toast('New target with updated settings'); }));

  document.addEventListener('keydown', (e) => {
    if (L.currentTab !== 'range' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toUpperCase();
    const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (typing) {
      if (e.key === 'Enter' && e.target.closest('.turret')) {
        e.target.dispatchEvent(new Event('change'));
        fire();
      }
      return;
    }
    const k = e.key;
    // Let focused buttons and summaries handle their own activation keys
    if ((tag === 'BUTTON' || tag === 'SUMMARY') && (k === ' ' || k === 'Enter') && e.target.closest('#tab-range')) return;
    const mult = e.shiftKey ? 5 : 1;
    if (k === 'ArrowUp') nudge('elev', mult);
    else if (k === 'ArrowDown') nudge('elev', -mult);
    else if (k === 'ArrowRight') nudge('wind', mult);
    else if (k === 'ArrowLeft') nudge('wind', -mult);
    else if (k === ' ' || k === 'Enter' || k === 'f' || k === 'F') fire();
    else if (k === 'n' || k === 'N') newTarget();
    else if (k === '0') { setDial('elev', 0); setDial('wind', 0); }
    else return;
    e.preventDefault();
  });

  // ------------------------------------------------------------ drawing

  function fitCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr);
    const h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return dpr;
  }

  function drawScope(now) {
    const s = R.s;
    const dpr = fitCanvas(scope);
    const S = scope.width;
    if (!S || !s) return;
    const ctx = sctx;
    const cx = S / 2, cy = S / 2;
    const half = s.unit === 'MOA' ? 18 : 5;
    const px = (S / 2) / half;
    const toPx = (inches) => L.toUnit(inches, s.yards, s.unit) * px;

    // recoil: brief upward jolt and blur-ish shake
    let jy = 0, jx = 0;
    if (R.recoilAt && now - R.recoilAt < 260 && !L.reducedMotion()) {
      const k = 1 - (now - R.recoilAt) / 260;
      jy = -S * 0.06 * k * k;
      jx = S * 0.01 * Math.sin(now / 15) * k;
    }

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.translate(jx, jy);

    // --- scene (fixed to the world, so it moves with recoil)
    const groundY = Math.min(S * 1.2, cy + toPx(40));
    const sky = ctx.createLinearGradient(0, 0, 0, S);
    sky.addColorStop(0, '#8fb0c6'); sky.addColorStop(1, '#d6e2e6');
    ctx.fillStyle = sky; ctx.fillRect(-S, -S, S * 3, S * 3);

    // treeline
    const treeTop = Math.min(groundY - S * 0.05, S * 0.28);
    ctx.fillStyle = '#3d5a3c';
    ctx.beginPath();
    ctx.moveTo(-S, groundY);
    R.trees.forEach((h, i) => {
      const x = -S * 0.1 + i / (R.trees.length - 1) * S * 1.2;
      ctx.lineTo(x, treeTop - h * S * 0.07);
    });
    ctx.lineTo(S * 2, groundY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(30, 50, 32, 0.5)';
    ctx.fillRect(-S, treeTop + S * 0.03, S * 3, groundY - treeTop);

    // berm + ground
    const ground = ctx.createLinearGradient(0, groundY, 0, S * 1.3);
    ground.addColorStop(0, '#8c7a50'); ground.addColorStop(0.12, '#7c8a4c'); ground.addColorStop(1, '#556236');
    ctx.fillStyle = ground; ctx.fillRect(-S, groundY, S * 3, S * 2);
    ctx.fillStyle = '#9a8657';
    ctx.beginPath(); ctx.ellipse(cx, groundY, toPx(70), toPx(9) + 4, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 55, 25, 0.55)';
    ctx.lineWidth = Math.max(1, S / 400);
    R.tufts.forEach((t) => {
      const x = t.x * S, y = groundY + 6 + t.y * (S - groundY);
      if (y > S) return;
      const h = t.h * S * 0.018;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h * 0.3, y - h); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.3, y - h); ctx.stroke();
    });

    // mirage: shimmer drifting with the crosswind
    const w = windAt(now);
    const cross = Math.sin(w.clock * Math.PI / 6) * w.speed; // + = from right
    R.mirage.forEach((m) => {
      m.x -= cross * 0.00018 * (1 + m.len * 4);
      if (m.x < -0.2) m.x += 1.4;
      if (m.x > 1.2) m.x -= 1.4;
      const y = m.y * S + Math.sin(now / 300 + m.ph) * 2;
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(now / 500 + m.ph) ** 2})`;
      ctx.lineWidth = S * 0.004;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const xx = (m.x + m.len * i / 10) * S;
        const yy = y + Math.sin(i * 0.9 + now / 180 + m.ph) * S * 0.003;
        if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    });

    // target stand + plate
    const pr = toPx(s.plateIn / 2);
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
    if (R.swing.amp) {
      const t = (now - R.swing.t0) / 1000;
      ang = R.swing.amp * Math.exp(-t * 1.6) * Math.sin(t * 9);
      if (t > 4) R.swing.amp = 0;
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
    plate.addColorStop(0, '#ffffff'); plate.addColorStop(1, '#cfd3d6');
    ctx.fillStyle = plate;
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, pr * 0.04); ctx.stroke();
    // lead splatter from hits
    s.marks.filter((m) => m.hit).forEach((m) => {
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

    // misses: spotter rings with shot numbers
    ctx.font = `600 ${Math.round(11 * dpr)}px JetBrains Mono, monospace`;
    s.marks.forEach((m, i) => {
      if (m.hit) return;
      const last = i === s.marks.length - 1;
      const x = cx + m.right * px, y = cy - m.up * px;
      const xx = Math.max(10 * dpr, Math.min(S - 10 * dpr, x));
      const yy = Math.max(10 * dpr, Math.min(S - 10 * dpr, y));
      ctx.strokeStyle = last ? '#ef4444' : 'rgba(239,68,68,0.5)';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(xx, yy, (last ? 6 : 4.5) * dpr, 0, Math.PI * 2); ctx.stroke();
      if (xx !== x || yy !== y) {
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + Math.sign(x - xx) * 8 * dpr, yy + Math.sign(y - yy) * 8 * dpr); ctx.stroke();
      }
      ctx.fillStyle = last ? '#ef4444' : 'rgba(239,68,68,0.6)';
      ctx.fillText(String(m.n), xx + 8 * dpr, yy - 7 * dpr);
    });

    // dust / spark puffs
    R.puffs = R.puffs.filter((p) => now - p.t0 < 1300);
    R.puffs.forEach((p) => {
      const k = (now - p.t0) / 1300;
      const x = cx + p.right * px, y = cy - p.up * px;
      const r = (8 + k * 34) * dpr;
      ctx.fillStyle = p.hit ? `rgba(255,240,200,${0.7 * (1 - k)})` : `rgba(150,120,80,${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x, y - k * 10 * dpr, r, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();

    // --- reticle (fixed to the scope, drawn after restore)
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(10,10,10,0.92)';
    ctx.fillStyle = 'rgba(10,10,10,0.92)';
    ctx.lineWidth = Math.max(1, dpr);
    const step = s.unit === 'MOA' ? 2 : 1;
    // thick outer posts
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(cx - half * 0.82 * px, cy);
    ctx.moveTo(S, cy); ctx.lineTo(cx + half * 0.82 * px, cy);
    ctx.moveTo(cx, S); ctx.lineTo(cx, cy + half * 0.82 * px);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(cx - half * 0.82 * px, cy); ctx.lineTo(cx + half * 0.82 * px, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, cy + half * 0.82 * px);
    ctx.stroke();
    ctx.font = `600 ${Math.round(10 * dpr)}px JetBrains Mono, monospace`;
    for (let v = step / 2; v < half * 0.82; v += step / 2) {
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const len = (major ? 7 : 3.5) * dpr;
      [-1, 1].forEach((sg) => {
        const d = sg * v * px;
        ctx.beginPath();
        ctx.moveTo(cx + d, cy - len); ctx.lineTo(cx + d, cy + len);
        ctx.moveTo(cx - len, cy + d); ctx.lineTo(cx + len, cy + d);
        ctx.stroke();
      });
      if (major) {
        ctx.fillText(String(v), cx + v * px - 3 * dpr, cy + 18 * dpr);
        ctx.fillText(String(v), cx + 10 * dpr, cy + v * px + 4 * dpr);
      }
    }
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(cx, cy, 2.2 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(10,10,10,0.8)';
    ctx.fillText(s.unit, 12 * dpr, cy - 10 * dpr);

    // vignette
    const vg = ctx.createRadialGradient(cx, cy, S * 0.36, cx, cy, S * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);
    ctx.restore();
  }

  function drawFlags(now) {
    const dpr = fitCanvas(flags);
    const W = flags.width, H = flags.height;
    if (!W || !R.s) return;
    const ctx = fctx;
    ctx.clearRect(0, 0, W, H);
    const spots = [{ x: 0.16, k: 1, off: 0, name: 'NEAR' }, { x: 0.5, k: 0.82, off: -0.8, name: 'MID' }, { x: 0.82, k: 0.66, off: -1.6, name: 'FAR' }];
    spots.forEach((sp) => {
      const w = windAt(now, sp.off);
      const sinC = Math.sin(w.clock * Math.PI / 6);
      const baseX = sp.x * W;
      const groundY = H * 0.72;
      const poleH = H * 0.6 * sp.k;
      const topY = groundY - poleH;
      ctx.strokeStyle = '#3b3b3b';
      ctx.lineWidth = 2 * dpr * sp.k;
      ctx.beginPath(); ctx.moveTo(baseX, groundY); ctx.lineTo(baseX, topY); ctx.stroke();

      const sp01 = Math.min(1, w.speed / 18);
      const droop = (1 - sp01) * 1.25; // radians below horizontal
      const dir = sinC > 0.05 ? -1 : sinC < -0.05 ? 1 : (Math.cos(w.clock * Math.PI / 6) > 0 ? 1 : -1);
      const len = W * 0.12 * sp.k * Math.max(0.3, Math.abs(sinC));
      const wid = 12 * dpr * sp.k;
      const n = 12;
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const wave = Math.sin(now / (110 - sp01 * 50) - s * 6 + sp.off * 3) * s * 4 * dpr * (0.4 + sp01);
        const ax = baseX + dir * Math.cos(droop) * len * s;
        const ay = topY + Math.sin(droop) * len * s + wave;
        const hw = wid * (1 - s * 0.7);
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
  }

  function frame(now) {
    if (L.currentTab === 'range') {
      if (R.flight) {
        const k = Math.min(1, (now - R.flight.start) / R.flight.tof);
        $('#flight-bar').style.width = (k * 100) + '%';
        setHud(`Bullet in flight · ${((now - R.flight.start) / 1000).toFixed(2)} s`);
        if (k >= 1) land();
      }
      drawScope(now);
      drawFlags(now);
    }
    requestAnimationFrame(frame);
  }

  function onShown() {
    const u = unit();
    $$('.turret').forEach((el) => buildDial($('svg', el)));
    $('#your-card-mini').innerHTML = L.cardHtml(L.profile, L.computeCard(L.profile), true);
    if (!R.s || R.s.unit !== u) newTarget();
    else { setDial('elev', R.dial.elev, true); setDial('wind', R.dial.wind, true); }
    renderHud();
    if (!R.running) { R.running = true; requestAnimationFrame(frame); }
  }

  L.onTab('range', onShown);
  L.onProfile(() => { if (L.currentTab === 'range') onShown(); else R.s = null; });
})();
