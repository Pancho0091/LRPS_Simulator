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
    // Stored values are untrusted (the origin is shared): anything whose shape
    // differs from the fallback is discarded.
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('lrps.' + key);
        if (raw == null) return fallback;
        const v = JSON.parse(raw);
        if (v == null) return fallback;
        if (fallback != null && (typeof v !== typeof fallback || Array.isArray(v) !== Array.isArray(fallback))) return fallback;
        return v;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('lrps.' + key, JSON.stringify(value)); } catch (e) { /* unavailable */ }
    },
  };

  // ------------------------------------------------------------ profile

  /*
   * Rifle systems: cartridge + bullet + typical barrel. Values are typical
   * published figures (factory or common handload, 24–27" barrels); your
   * rifle's chronographed MV is what matters.
   */
  L.PRESETS = [
    { name: '.223 Rem 77 TMK', cartridge: '.223 Remington', bullet: '77 gr Sierra TMK', muzzleVelocityFps: 2750, bc: 0.210, dragModel: 'G7', bulletWeightGr: 77, bulletDiameterIn: 0.224, bulletLengthIn: 1.0, twistIn: 7, tempSensitivity: 0.9, sdFps: 12 },
    { name: '6mm Creedmoor 108 ELD-M', cartridge: '6mm Creedmoor', bullet: '108 gr Hornady ELD-M', muzzleVelocityFps: 2960, bc: 0.270, dragModel: 'G7', bulletWeightGr: 108, bulletDiameterIn: 0.243, bulletLengthIn: 1.231, twistIn: 7.5, tempSensitivity: 0.6, sdFps: 9 },
    { name: '6.5 Creedmoor 140 ELD-M', cartridge: '6.5 Creedmoor', bullet: '140 gr Hornady ELD-M', muzzleVelocityFps: 2710, bc: 0.326, dragModel: 'G7', bulletWeightGr: 140, bulletDiameterIn: 0.264, bulletLengthIn: 1.37, twistIn: 8, tempSensitivity: 0.6, sdFps: 10 },
    { name: '6.5 PRC 147 ELD-M', cartridge: '6.5 PRC', bullet: '147 gr Hornady ELD-M', muzzleVelocityFps: 2910, bc: 0.351, dragModel: 'G7', bulletWeightGr: 147, bulletDiameterIn: 0.264, bulletLengthIn: 1.44, twistIn: 8, tempSensitivity: 0.7, sdFps: 10 },
    { name: '.308 Win 175 SMK', cartridge: '.308 Winchester', bullet: '175 gr Sierra MatchKing', muzzleVelocityFps: 2600, bc: 0.243, dragModel: 'G7', bulletWeightGr: 175, bulletDiameterIn: 0.308, bulletLengthIn: 1.24, twistIn: 10, tempSensitivity: 1.0, sdFps: 12 },
    { name: '.300 Win Mag 215 Hybrid', cartridge: '.300 Winchester Magnum', bullet: '215 gr Berger Hybrid', muzzleVelocityFps: 2850, bc: 0.354, dragModel: 'G7', bulletWeightGr: 215, bulletDiameterIn: 0.308, bulletLengthIn: 1.595, twistIn: 10, tempSensitivity: 1.1, sdFps: 12 },
    { name: '.300 PRC 225 ELD-M', cartridge: '.300 PRC', bullet: '225 gr Hornady ELD-M', muzzleVelocityFps: 2810, bc: 0.391, dragModel: 'G7', bulletWeightGr: 225, bulletDiameterIn: 0.308, bulletLengthIn: 1.627, twistIn: 8, tempSensitivity: 0.8, sdFps: 11 },
    { name: '.338 Lapua 300 Hybrid', cartridge: '.338 Lapua Magnum', bullet: '300 gr Berger Hybrid', muzzleVelocityFps: 2750, bc: 0.419, dragModel: 'G7', bulletWeightGr: 300, bulletDiameterIn: 0.338, bulletLengthIn: 1.8, twistIn: 9.4, tempSensitivity: 1.0, sdFps: 12 },
  ];

  L.DEFAULT_PROFILE = Object.assign({}, L.PRESETS[2], {
    mvTempF: 59,
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

  // Older saved profiles lack the system fields: fill them from the matching preset.
  (function loadProfile() {
    const saved = L.store.get('profile.v1', {});
    const preset = L.PRESETS.find((x) => x.name === saved.name) || {};
    L.profile = Object.assign({}, L.DEFAULT_PROFILE, preset, saved);
    ['bulletDiameterIn', 'bulletLengthIn', 'twistIn', 'tempSensitivity', 'sdFps'].forEach((k) => {
      if (saved[k] == null && preset[k] != null) L.profile[k] = preset[k];
    });
    // Coerce to the default's type so a tampered store can neither crash nor inject markup
    Object.keys(L.DEFAULT_PROFILE).forEach((k) => {
      const d = L.DEFAULT_PROFILE[k], v = L.profile[k];
      if (typeof d === 'number') L.profile[k] = v !== '' && v !== null && Number.isFinite(+v) ? +v : d;
      else if (typeof d === 'boolean') L.profile[k] = !!v;
      else if (typeof d === 'string') L.profile[k] = typeof v === 'string' ? v.slice(0, 120) : d;
    });
    L.profile.dragModel = L.profile.dragModel === 'G1' ? 'G1' : 'G7';
    // The app is MIL-only: 0.1 mil clicks
    L.profile.unit = 'MIL';
    L.profile.clickSize = 0.1;
  })();
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
  // The app works in MIL only (0.1 mil clicks); the unit argument is kept for call-site clarity.
  L.clickFor = () => 0.1;
  L.toUnit = (inches, yards) => B.inchesToMil(inches, yards);
  L.fromUnit = (value, yards) => B.milToInches(value, yards);
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
    bulletDiameterIn: +p.bulletDiameterIn || null,
    bulletLengthIn: +p.bulletLengthIn || null,
    twistIn: +p.twistIn || null,
    tempSensitivity: +p.tempSensitivity || 0,
    mvTempF: p.mvTempF != null && p.mvTempF !== '' ? +p.mvTempF : null,
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
    // Ranges the bullet never reaches (null rows) are dropped from the card
    const rows = base.rows.map((r, i) => {
      if (!r || winds.some((w) => !w.rows[i])) return null;
      const elev = L.toUnit(-r.dropIn, r.yards, p.unit);
      return {
        yards: r.yards,
        elev,
        clicks: B.toClicks(elev, +p.clickSize),
        winds: winds.map((w) => L.toUnit(-w.rows[i].windIn, r.yards, p.unit)),
        spin: p.spinDrift ? L.toUnit(-B.spinDriftIn(base.sg, r.tofSec, 'right'), r.yards, p.unit) : null,
        velocityFps: r.velocityFps,
        mach: r.mach,
        tofSec: r.tofSec,
        energyFtLb: r.energyFtLb,
      };
    });
    return { rows: rows.filter(Boolean), brackets, atmosphere: base.atmosphere, sg: base.sg, sgEstimated: base.sgEstimated, mv: base.muzzleVelocityFps };
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
        <span class="chip">MV <b>${+p.muzzleVelocityFps}</b> fps</span>
        <span class="chip">BC <b>${+p.bc}</b> ${L.escapeHtml(p.dragModel)}</span>
        <span class="chip">Zero <b>${+p.zeroYards}</b> yd</span>
        <span class="chip">Sight <b>${+p.sightHeightIn}</b>"</span>
        <span class="chip">Click <b>${click}</b> ${unit}</span>
        <span class="chip">Alt <b>${+p.altitudeFt}</b> ft · <b>${+p.tempF}</b>°F</span>
        <span class="chip">DA <b>${Math.round(atm.densityAltitudeFt)}</b> ft</span>
        ${+p.shotAngleDeg ? `<span class="chip">Angle <b>${+p.shotAngleDeg}</b>°</span>` : ''}
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

  // action: { label, onClick, sticky } adds a button; sticky toasts stay until acted on or closed
  L.toast = (msg, kind, action) => {
    const dup = $$('#toasts .toast').find((t) => t.dataset.msg === msg);
    if (dup) { dup.remove(); }
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '') + (action && action.sticky ? ' sticky' : '');
    el.dataset.msg = msg;
    el.textContent = msg;
    if (action && action.label) {
      el.classList.add('has-action');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-action';
      b.textContent = action.label;
      b.addEventListener('click', () => { el.remove(); if (action.onClick) action.onClick(); });
      el.appendChild(b);
      if (action.sticky) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'toast-close';
        x.setAttribute('aria-label', 'Dismiss');
        x.textContent = '×';
        x.addEventListener('click', () => el.remove());
        el.appendChild(x);
      }
    }
    $('#toasts').appendChild(el);
    if (!(action && action.sticky)) setTimeout(() => el.remove(), 3000);
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
  if (!THEMES.includes(theme)) theme = 'auto';
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
  let xp = Number(L.store.get('xp', 0)) || 0;

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

  /* Re-run a CSS animation class on an element (remove, reflow, add). */
  L.replay = (el, cls, ms) => {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms || 600);
  };

  L.addXp = (n, why) => {
    if (!n) return;
    const before = rankInfo(xp).level;
    xp += n;
    L.store.set('xp', xp);
    renderXp();
    L.toast(`+${n} XP · ${why}`, 'xp');
    // "+N" floats out of the chip and the level badge bumps
    const chip = $('.xp-chip');
    if (chip && !L.reducedMotion()) {
      const f = document.createElement('span');
      f.className = 'xp-float';
      f.textContent = `+${n}`;
      chip.appendChild(f);
      setTimeout(() => f.remove(), 1200);
    }
    L.replay($('#xp-level'), 'bump', 500);
    const after = rankInfo(xp);
    if (after.level > before) {
      setTimeout(() => {
        L.toast(`Rank up: ${after.name}!`, 'xp big');
        L.replay(chip, 'rank-up', 2600);
        L.confetti();
        L.sfx.good();
      }, 400);
    }
  };
  renderXp();

  // ------------------------------------------------------------ confetti

  const confetti = { parts: [], running: false };
  L.confetti = (originX, originY) => {
    if (L.reducedMotion()) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const ox = originX != null ? originX : innerWidth / 2;
    const oy = originY != null ? originY : innerHeight / 3;
    const colors = ['#f59e0b', '#34d399', '#60a5fa', '#f472b6', '#facc15', '#ffffff'];
    const born = performance.now();
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 9;
      confetti.parts.push({
        born, x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        c: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    if (confetti.running) return;
    confetti.running = true;
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // One loop draws every burst, so overlapping bursts share the canvas
    (function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      confetti.parts = confetti.parts.filter((p) => now - p.born < 1800);
      confetti.parts.forEach((p) => {
        const age = now - p.born;
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 1800);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (confetti.parts.length) requestAnimationFrame(frame);
      else { confetti.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    })(born);
  };

  // ------------------------------------------------------------ tabs

  const tabListeners = {};
  L.onTab = (name, fn) => { (tabListeners[name] = tabListeners[name] || []).push(fn); };

  /*
   * Sliding indicator: an absolutely positioned pill inside a container that
   * glides to whichever child matches `activeSel`. Used by the tab bar and
   * every segmented control. Position is written to --x / --w; CSS animates.
   */
  function slidingIndicator(container, activeSel, cls) {
    const ind = document.createElement('span');
    ind.className = cls;
    ind.setAttribute('aria-hidden', 'true');
    container.prepend(ind);
    let raf = 0;
    const place = () => {
      raf = 0;
      const a = $(activeSel, container);
      container.classList.toggle('none', !a);
      if (!a) return;
      ind.style.setProperty('--x', a.offsetLeft + 'px');
      ind.style.setProperty('--w', a.offsetWidth + 'px');
      if (!container.classList.contains('ready')) requestAnimationFrame(() => container.classList.add('ready'));
    };
    const update = () => { if (!raf) raf = requestAnimationFrame(place); };
    if (window.ResizeObserver) new ResizeObserver(update).observe(container);
    else window.addEventListener('resize', update);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    new MutationObserver(update).observe(container, { attributes: true, attributeFilter: ['class'], subtree: true });
    update();
    return update;
  }
  const placeTabIndicator = slidingIndicator($('.tabs'), '.tab.active', 'tab-indicator');

  /* Mark a root with .enter for one frame-set so its children stagger in (CSS .enter rules). */
  const enterTimers = new WeakMap();
  L.enter = (root) => {
    if (!root || L.reducedMotion()) return;
    clearTimeout(enterTimers.get(root));
    root.classList.remove('enter');
    void root.offsetWidth;
    root.classList.add('enter');
    enterTimers.set(root, setTimeout(() => root.classList.remove('enter'), 900));
  };

  const TAB_ORDER = $$('.tab').map((b) => b.dataset.tab);
  L.showTab = (name) => {
    if (name === 'learn') name = 'lab';
    if (!/^[a-z]+$/.test(name || '')) name = 'academy';
    if (!$('#tab-' + name)) name = 'academy';
    // direction-aware panel transition: forward slides from the right, back from the left
    const from = TAB_ORDER.indexOf(L.currentTab), to = TAB_ORDER.indexOf(name);
    $('main').dataset.dir = from >= 0 && to < from ? 'back' : 'fwd';
    $$('.tab').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (L.currentTab !== name) L.enter($('#tab-' + name));
    L.currentTab = name;
    placeTabIndicator();
    (tabListeners[name] || []).forEach((fn) => fn());
  };
  $$('.tab').forEach((btn) => btn.addEventListener('click', () => {
    history.replaceState(null, '', '#' + btn.dataset.tab);
    L.showTab(btn.dataset.tab);
    window.scrollTo({ top: 0 });
  }));
  const tabFromHash = () => { const h = (location.hash || '#academy').slice(1); return /^[a-z]+$/.test(h) ? h : 'academy'; };
  window.addEventListener('DOMContentLoaded', () => L.showTab(tabFromHash()));
  window.addEventListener('hashchange', () => { const t = tabFromHash(); if (t !== L.currentTab) L.showTab(t); });
  // Any element with data-goto="tab" navigates to that tab
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + a.dataset.goto);
    L.showTab(a.dataset.goto);
    window.scrollTo({ top: 0 });
  });

  /* Segmented control helper: calls onChange(value) on selection. */
  L.seg = (el, onChange) => {
    slidingIndicator(el, 'button.on', 'seg-indicator');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (!b.classList.contains('on')) L.sfx.click();
      $$('button', el).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      onChange(b.dataset.v);
    });
    $$('button', el).forEach((x) => x.setAttribute('aria-pressed', x.classList.contains('on')));
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
      const to = Math.min(xMax, o.shadeTo != null ? o.shadeTo : xMax);
      svg += `<rect class="shade" x="${X(o.shadeFrom)}" y="${P.t}" width="${X(to) - X(o.shadeFrom)}" height="${H - P.t - P.b}"/>`;
      svg += `<text class="shade-label" x="${X(o.shadeFrom) + 6}" y="${P.t + 14}">transonic</text>`;
    }
    for (let v = yMin; v <= yMax + step / 2; v += step) {
      svg += `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
      svg += `<text class="axis-text" x="${P.l - 8}" y="${Y(v) + 4}" text-anchor="end">${(+v.toFixed(4)).toFixed(dec)}</text>`;
    }
    const xStep = o.xStep || (xMax > 1000 ? 200 : xMax > 500 ? 100 : 50);
    const xFmt = o.xFmt || ((v) => v);
    for (let i = 0; i * xStep <= xMax + 1e-9; i++) {
      const x = i * xStep;
      svg += `<text class="axis-text" x="${X(x)}" y="${H - P.b + 18}" text-anchor="middle">${xFmt(x)}</text>`;
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
