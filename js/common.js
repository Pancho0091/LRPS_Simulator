/* global Ballistics */
/*
 * Shared state and UI services for every tab:
 * profile storage, unit helpers, card computation, sound, XP, toasts,
 * confetti, tab routing, theme, and a small SVG line chart.
 */
(function () {
  'use strict';

  const B = Ballistics;
  const L = (window.LRPS = { B });
  const $ = (L.$ = (sel, root) => (root || document).querySelector(sel));
  const $$ = (L.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel)));

  // ------------------------------------------------------------ storage

  L.store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('lrps.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('lrps.' + key, JSON.stringify(value)); } catch (e) { /* unavailable */ }
    },
  };

  // ------------------------------------------------------------ profile

  L.PRESETS = [
    { name: '6.5 Creedmoor 140 ELD-M', muzzleVelocityFps: 2710, bc: 0.326, dragModel: 'G7', bulletWeightGr: 140 },
    { name: '.308 Win 175 SMK', muzzleVelocityFps: 2600, bc: 0.243, dragModel: 'G7', bulletWeightGr: 175 },
    { name: '6mm Creedmoor 108 ELD-M', muzzleVelocityFps: 2960, bc: 0.283, dragModel: 'G7', bulletWeightGr: 108 },
    { name: '.300 Win Mag 215 Hybrid', muzzleVelocityFps: 2850, bc: 0.354, dragModel: 'G7', bulletWeightGr: 215 },
    { name: '.223 Rem 77 TMK', muzzleVelocityFps: 2750, bc: 0.205, dragModel: 'G7', bulletWeightGr: 77 },
  ];

  L.DEFAULT_PROFILE = Object.assign({}, L.PRESETS[0], {
    sightHeightIn: 1.9,
    zeroYards: 100,
    unit: 'MIL',
    clickSize: 0.1,
    altitudeFt: 0,
    tempF: 59,
    humidityPct: 0,
    shotAngleDeg: 0,
    spinDrift: false,
    rangeStart: 100,
    rangeEnd: 1000,
    rangeStep: 50,
    windBrackets: '5, 10, 15',
  });

  L.profile = Object.assign({}, L.DEFAULT_PROFILE, L.store.get('profile.v1', {}));
  const profileListeners = [];
  L.onProfile = (fn) => profileListeners.push(fn);
  L.setProfile = (p) => {
    L.profile = p;
    L.store.set('profile.v1', p);
    profileListeners.forEach((fn) => fn(p));
  };

  // ------------------------------------------------------------ helpers

  L.decimalsFor = (click) => {
    const s = String(click);
    return s.includes('.') ? s.split('.')[1].length : 0;
  };
  L.fmtClick = (value, click) => B.roundToClick(value, click).toFixed(L.decimalsFor(click));
  L.clickFor = (unit) => (unit === 'MOA' ? 0.25 : 0.1);
  L.toUnit = (inches, yards, unit) => (unit === 'MOA' ? B.inchesToMoa(inches, yards) : B.inchesToMil(inches, yards));
  L.fromUnit = (value, yards, unit) => (unit === 'MOA' ? B.moaToInches(value, yards) : B.milToInches(value, yards));
  L.rand = (min, max) => min + Math.random() * (max - min);
  L.randInt = (min, max) => Math.floor(L.rand(min, max + 1));
  L.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  L.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  L.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  L.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  L.parseBrackets = (text) => String(text).split(/[,\s]+/).map(Number).filter((n) => n > 0);

  L.rangeList = (p) => {
    const out = [];
    const step = Math.max(5, Number(p.rangeStep) || 50);
    const end = Math.min(2500, Number(p.rangeEnd) || 1000);
    for (let r = Number(p.rangeStart) || step; r <= end + 1e-9; r += step) out.push(r);
    return out.filter((r) => r > 0);
  };

  L.solverInput = (p, extra) => Object.assign({
    muzzleVelocityFps: +p.muzzleVelocityFps,
    bc: +p.bc,
    dragModel: p.dragModel,
    bulletWeightGr: +p.bulletWeightGr,
    sightHeightIn: +p.sightHeightIn,
    zeroYards: +p.zeroYards,
    altitudeFt: +p.altitudeFt,
    tempF: +p.tempF,
    humidityPct: +p.humidityPct,
    shotAngleDeg: +p.shotAngleDeg,
    spinDrift: false,
  }, extra || {});

  /*
   * Everything that goes on a card. Elevation comes from a no-wind solve;
   * each wind bracket is a separate full-value (3 o'clock) solve.
   */
  L.computeCard = (p) => {
    const ranges = L.rangeList(p);
    const brackets = L.parseBrackets(p.windBrackets);
    const base = B.solve(L.solverInput(p, { windMph: 0 }), ranges);
    const winds = brackets.map((mph) => B.solve(L.solverInput(p, { windMph: mph, windClock: 3 }), ranges));
    const rows = base.rows.map((r, i) => {
      const elev = L.toUnit(-r.dropIn, r.yards, p.unit);
      return {
        yards: r.yards,
        elev,
        clicks: B.toClicks(elev, +p.clickSize),
        winds: winds.map((w) => L.toUnit(-w.rows[i].windIn, r.yards, p.unit)),
        spin: p.spinDrift ? L.toUnit(-B.spinDriftIn(1.5, r.tofSec, 'right'), r.yards, p.unit) : null,
        velocityFps: r.velocityFps,
        mach: r.mach,
        tofSec: r.tofSec,
        energyFtLb: r.energyFtLb,
      };
    });
    return { rows, brackets, atmosphere: base.atmosphere };
  };

  /* Render a dope card. `compact` drops the header, velocity and TOF columns. */
  L.cardHtml = (p, card, compact) => {
    const unit = p.unit;
    const click = +p.clickSize;
    const atm = card.atmosphere;
    const windHeads = card.brackets.map((b) => `<th>${b}</th>`).join('');
    const rows = card.rows.map((r) => {
      const cls = r.mach < 1.0 ? 'subsonic' : r.mach < 1.2 ? 'transonic' : '';
      const winds = r.winds.map((w) => `<td>${L.fmtClick(w, click)}</td>`).join('');
      const spin = p.spinDrift ? `<td>${L.fmtClick(r.spin, click)}</td>` : '';
      const extra = compact ? '' : `<td>${r.velocityFps.toFixed(0)}</td><td>${r.tofSec.toFixed(2)}</td>`;
      return `<tr class="${cls}"><td>${r.yards}</td><td class="elev">${L.fmtClick(r.elev, click)}</td>` +
        `<td>${r.clicks}</td>${winds}${spin}${extra}</tr>`;
    }).join('');
    const head = compact ? '' : `
      <div class="dope-head">
        <div><div class="dope-tag">DOPE CARD · ${unit}</div><h3>${L.escapeHtml(p.name || 'Custom load')}</h3></div>
      </div>
      <div class="chips">
        <span class="chip">MV <b>${p.muzzleVelocityFps}</b> fps</span>
        <span class="chip">BC <b>${p.bc}</b> ${p.dragModel}</span>
        <span class="chip">Zero <b>${p.zeroYards}</b> yd</span>
        <span class="chip">Sight <b>${p.sightHeightIn}</b>"</span>
        <span class="chip">Click <b>${click}</b> ${unit}</span>
        <span class="chip">Alt <b>${p.altitudeFt}</b> ft · <b>${p.tempF}</b>°F</span>
        <span class="chip">DA <b>${Math.round(atm.densityAltitudeFt)}</b> ft</span>
        ${+p.shotAngleDeg ? `<span class="chip">Angle <b>${p.shotAngleDeg}</b>°</span>` : ''}
      </div>`;
    return `
      <div class="${compact ? '' : 'dope-card'}">
        ${head}
        <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th rowspan="2">Yds</th><th rowspan="2">Elev ↑</th><th rowspan="2">Clk</th>
              <th colspan="${card.brackets.length}" style="text-align:center">Wind hold · mph</th>
              ${p.spinDrift ? '<th rowspan="2">Spin</th>' : ''}
              ${compact ? '' : '<th rowspan="2">fps</th><th rowspan="2">TOF</th>'}</tr>
            <tr>${windHeads}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
        <div class="legend"><span class="l-trans">Transonic (&lt; Mach 1.2)</span><span class="l-sub">Subsonic</span>
          <span>Wind = full value (3/9 o'clock), hold into the wind</span></div>
      </div>`;
  };

  // ------------------------------------------------------------ toasts

  L.toast = (msg, kind) => {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  // ------------------------------------------------------------ sound

  let audio = null;
  let soundOn = L.store.get('sound', true);

  function ac() {
    if (!soundOn) return null;
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function noiseSource(c, seconds) {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function envGain(c, t, peak, decay) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  function tone(c, freq, t, peak, decay, type) {
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    const g = envGain(c, t, peak, decay);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + decay + 0.05);
    return o;
  }

  L.sfx = {
    click() {
      const c = ac(); if (!c) return;
      tone(c, 2600, c.currentTime, 0.05, 0.03, 'square');
    },
    shot() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      const n = noiseSource(c, 0.6);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
      n.connect(f).connect(envGain(c, t, 0.7, 0.55)).connect(c.destination);
      n.start(t);
      const o = tone(c, 110, t, 0.6, 0.3);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    },
    ding(delay) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + (delay || 0);
      [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(c, 640 * m, t, 0.16 / (i + 1), 1.8 / (1 + i * 0.6)));
    },
    thud(delay) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + (delay || 0);
      const n = noiseSource(c, 0.3);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 350;
      n.connect(f).connect(envGain(c, t, 0.25, 0.25)).connect(c.destination);
      n.start(t);
    },
    good() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(c, f, t + i * 0.07, 0.08, 0.25, 'triangle'));
    },
    bad() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      tone(c, 220, t, 0.08, 0.18, 'triangle');
      tone(c, 165, t + 0.12, 0.08, 0.25, 'triangle');
    },
  };

  const ICONS = {
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  };

  const soundBtn = $('#sound-toggle');
  function renderSound() { soundBtn.innerHTML = soundOn ? ICONS.soundOn : ICONS.soundOff; }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    L.store.set('sound', soundOn);
    renderSound();
    if (soundOn) L.sfx.click();
  });
  renderSound();

  // ------------------------------------------------------------ theme

  const THEMES = ['auto', 'light', 'dark'];
  let theme = L.store.get('theme', 'auto');
  const themeBtn = $('#theme-toggle');
  function applyTheme() {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    themeBtn.innerHTML = ICONS[theme];
    themeBtn.title = 'Theme: ' + theme;
  }
  themeBtn.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    L.store.set('theme', theme);
    applyTheme();
    window.dispatchEvent(new Event('themechange'));
  });
  applyTheme();

  // ------------------------------------------------------------ XP

  const RANKS = [
    [0, 'Recruit'], [100, 'Shooter'], [300, 'Marksman'], [600, 'Sharpshooter'],
    [1000, 'Expert'], [1600, 'Precision Rifleman'], [2500, 'Distinguished'], [4000, 'Legend'],
  ];
  let xp = L.store.get('xp', 0);

  function rankInfo(v) {
    let i = 0;
    while (i + 1 < RANKS.length && v >= RANKS[i + 1][0]) i++;
    const floor = RANKS[i][0];
    const next = RANKS[i + 1] ? RANKS[i + 1][0] : floor + 2000;
    return { level: i + 1, name: RANKS[i][1], pct: Math.min(100, (v - floor) / (next - floor) * 100), next };
  }

  function renderXp() {
    const r = rankInfo(xp);
    $('#xp-level').textContent = r.level;
    $('#xp-rank').textContent = r.name;
    $('#xp-bar').style.width = r.pct + '%';
    $('.xp-chip').title = `${xp} XP · next rank at ${r.next}`;
  }

  L.addXp = (n, why) => {
    if (!n) return;
    const before = rankInfo(xp).level;
    xp += n;
    L.store.set('xp', xp);
    renderXp();
    L.toast(`+${n} XP · ${why}`, 'xp');
    const after = rankInfo(xp);
    if (after.level > before) {
      setTimeout(() => {
        L.toast(`Rank up: ${after.name}!`, 'xp big');
        L.confetti();
        L.sfx.good();
      }, 400);
    }
  };
  renderXp();

  // ------------------------------------------------------------ confetti

  L.confetti = (originX, originY) => {
    if (L.reducedMotion()) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = originX != null ? originX : innerWidth / 2;
    const oy = originY != null ? originY : innerHeight / 3;
    const colors = ['#f59e0b', '#34d399', '#60a5fa', '#f472b6', '#facc15', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 9;
      return {
        x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        c: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    const start = performance.now();
    (function frame(now) {
      const age = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 1800);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (age < 1800) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(start);
  };

  // ------------------------------------------------------------ tabs

  const tabListeners = {};
  L.onTab = (name, fn) => { (tabListeners[name] = tabListeners[name] || []).push(fn); };
  L.showTab = (name) => {
    if (!$('#tab-' + name)) name = 'learn';
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    L.currentTab = name;
    (tabListeners[name] || []).forEach((fn) => fn());
  };
  $$('.tab').forEach((btn) => btn.addEventListener('click', () => {
    history.replaceState(null, '', '#' + btn.dataset.tab);
    L.showTab(btn.dataset.tab);
    window.scrollTo({ top: 0 });
  }));
  window.addEventListener('DOMContentLoaded', () => L.showTab((location.hash || '#learn').slice(1)));

  /* Segmented control helper: calls onChange(value) on selection. */
  L.seg = (el, onChange) => {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      $$('button', el).forEach((x) => x.classList.toggle('on', x === b));
      onChange(b.dataset.v);
    });
    return () => $('button.on', el).dataset.v;
  };

  // ------------------------------------------------------------ chart

  function niceStep(span, count) {
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  /*
   * Minimal responsive SVG line chart with a hover readout.
   * o.series: [{ points: [[x, y]], cls: 'accent'|'2'|'info'|'ghost', label, area }]
   * o.shadeFrom: x where a shaded "transonic" band starts
   * o.tip(x, ys): tooltip HTML for the hovered x
   */
  L.lineChart = (el, o) => {
    const W = 640, H = 320, P = { l: 52, r: 14, t: 14, b: 40 };
    const pts = o.series.flatMap((s) => s.points);
    if (!pts.length) { el.innerHTML = ''; return; }
    const xMax = o.xMax || Math.max(...pts.map((p) => p[0]));
    let yMin = Math.min(...pts.map((p) => p[1]));
    let yMax = Math.max(...pts.map((p) => p[1]));
    if (o.includeZero !== false) { yMin = Math.min(yMin, 0); yMax = Math.max(yMax, 0); }
    if (yMax - yMin < 1e-6) { yMax += 1; yMin -= 1; }
    const step = niceStep(yMax - yMin, 5);
    yMin = Math.floor(yMin / step) * step;
    yMax = Math.ceil(yMax / step) * step;
    const X = (x) => P.l + x / xMax * (W - P.l - P.r);
    const Y = (y) => P.t + (1 - (y - yMin) / (yMax - yMin)) * (H - P.t - P.b);
    const dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0;

    let svg = '';
    if (o.shadeFrom != null && o.shadeFrom < xMax) {
      svg += `<rect class="shade" x="${X(o.shadeFrom)}" y="${P.t}" width="${X(xMax) - X(o.shadeFrom)}" height="${H - P.t - P.b}"/>`;
      svg += `<text class="shade-label" x="${X(o.shadeFrom) + 6}" y="${P.t + 14}">transonic</text>`;
    }
    for (let v = yMin; v <= yMax + step / 2; v += step) {
      svg += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      svg += `<text class="axis-text" x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${(+v.toFixed(4)).toFixed(dec)}</text>`;
    }
    const xStep = xMax > 1000 ? 200 : xMax > 500 ? 100 : 50;
    for (let x = 0; x <= xMax; x += xStep) {
      svg += `<text class="axis-text" x="${X(x)}" y="${H - P.b + 18}" text-anchor="middle">${x}</text>`;
    }
    if (yMin < 0 && yMax > 0) svg += `<line class="zero-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    svg += `<text class="axis-label" x="${W - P.r}" y="${H - 4}" text-anchor="end">${o.xLabel || 'yards'}</text>`;
    svg += `<text class="axis-label" x="${P.l - 44}" y="${P.t - 2}">${o.yLabel || ''}</text>`;
    o.series.forEach((s) => {
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
      if (s.area) {
        const base = Y(Math.max(yMin, Math.min(yMax, 0)));
        svg += `<path class="area a-${s.cls}" d="${d}L${X(s.points[s.points.length - 1][0])},${base}L${X(s.points[0][0])},${base}Z"/>`;
      }
      svg += `<path class="series s-${s.cls}" d="${d}"/>`;
    });
    svg += `<g class="hover" style="display:none"><line class="hover-line" y1="${P.t}" y2="${H - P.b}"/>` +
      o.series.map((s) => `<circle class="hover-dot d-${s.cls}" r="5"/>`).join('') + '</g>';
    svg += `<rect x="${P.l}" y="${P.t}" width="${W - P.l - P.r}" height="${H - P.t - P.b}" fill="transparent" class="hit"/>`;

    const legend = o.series.filter((s) => s.label).map((s) =>
      `<span><i style="background:var(--${s.cls === '2' ? 'accent-2' : s.cls === 'ghost' ? 'muted' : s.cls})"></i>${s.label}</span>`).join('');
    el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${svg}</svg><div class="chart-tip"></div></div>` +
      (legend ? `<div class="chart-legend">${legend}</div>` : '');

    const svgEl = $('svg', el);
    const g = $('.hover', el);
    const line = $('.hover-line', el);
    const dots = $$('.hover-dot', el);
    const tip = $('.chart-tip', el);
    function move(ev) {
      const rect = svgEl.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      const xData = Math.max(0, Math.min(xMax, ((cx / rect.width) * W - P.l) / (W - P.l - P.r) * xMax));
      const ys = o.series.map((s) => {
        let best = s.points[0];
        s.points.forEach((p) => { if (Math.abs(p[0] - xData) < Math.abs(best[0] - xData)) best = p; });
        return best;
      });
      const x = ys[0][0];
      g.style.display = '';
      line.setAttribute('x1', X(x)); line.setAttribute('x2', X(x));
      ys.forEach((p, i) => { dots[i].setAttribute('cx', X(p[0])); dots[i].setAttribute('cy', Y(p[1])); });
      tip.innerHTML = o.tip ? o.tip(x, ys.map((p) => p[1])) : `${x}: ${ys[0][1].toFixed(2)}`;
      tip.style.left = (X(x) / W * rect.width) + 'px';
      tip.style.top = (Y(ys[0][1]) / H * rect.height) + 'px';
      tip.style.opacity = 1;
    }
    function leave() { g.style.display = 'none'; tip.style.opacity = 0; }
    const hit = $('.hit', el);
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchmove', move, { passive: true });
    hit.addEventListener('mouseleave', leave);
    hit.addEventListener('touchend', leave);
  };
})();
