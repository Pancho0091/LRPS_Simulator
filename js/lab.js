/*
 * Learn tab: live Ballistics Lab (sliders → charts) and "predict, then
 * reveal" challenges that test the user's mental model of each variable.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;

  const state = { mv: 2710, bc: 0.326, alt: 0, temp: 59, wind: 10, clock: 3, zero: 100, unit: 'MIL' };
  let baseline = null;

  const SLIDERS = [
    { key: 'mv', label: 'Muzzle velocity', min: 2200, max: 3300, step: 10, fmt: (v) => `${v} fps` },
    { key: 'bc', label: 'Ballistic coefficient (G7)', min: 0.15, max: 0.42, step: 0.005, fmt: (v) => v.toFixed(3) },
    { key: 'alt', label: 'Altitude', min: 0, max: 9000, step: 250, fmt: (v) => `${v} ft` },
    { key: 'temp', label: 'Temperature', min: 0, max: 110, step: 1, fmt: (v) => `${v}°F` },
    { key: 'wind', label: 'Wind speed', min: 0, max: 25, step: 1, fmt: (v) => `${v} mph` },
    { key: 'clock', label: 'Wind from (clock)', min: 1, max: 12, step: 0.5, fmt: (v) => `${v % 1 ? Math.floor(v) + ':30' : v} o'clock` },
    { key: 'zero', label: 'Zero range', min: 100, max: 300, step: 25, fmt: (v) => `${v} yd` },
  ];

  const controls = $('#lab-controls');
  controls.innerHTML = '<div class="card-title"><h3>Inputs</h3><button class="btn" id="lab-reset" type="button">Reset</button></div>' +
    SLIDERS.map((s) => `
      <div class="slider">
        <div class="slider-head"><label for="lab-${s.key}">${s.label}</label><output id="lab-${s.key}-out"></output></div>
        <input type="range" id="lab-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">
      </div>`).join('') +
    '<p class="hint">Bullet: 140 gr, 1.9" sight height. Readouts are at 1000 yd.</p>';

  function syncSliders() {
    SLIDERS.forEach((s) => {
      $(`#lab-${s.key}`).value = state[s.key];
      $(`#lab-${s.key}-out`).textContent = s.fmt(state[s.key]);
    });
  }

  SLIDERS.forEach((s) => {
    $(`#lab-${s.key}`).addEventListener('input', (e) => {
      state[s.key] = Number(e.target.value);
      $(`#lab-${s.key}-out`).textContent = s.fmt(state[s.key]);
      schedule();
    });
  });

  $('#lab-reset').addEventListener('click', () => {
    Object.assign(state, { mv: 2710, bc: 0.326, alt: 0, temp: 59, wind: 10, clock: 3, zero: 100 });
    syncSliders();
    render();
  });

  $('#lab-pin').addEventListener('click', () => { baseline = compute(state); render(); L.toast('Baseline pinned'); });
  $('#lab-clear').addEventListener('click', () => { baseline = null; render(); });

  const RANGES = [];
  for (let r = 25; r <= 1200; r += 25) RANGES.push(r);

  function compute(s) {
    const res = B.solve({
      muzzleVelocityFps: s.mv, bc: s.bc, dragModel: 'G7', bulletWeightGr: 140, sightHeightIn: 1.9,
      zeroYards: s.zero, altitudeFt: s.alt, tempF: s.temp, windMph: s.wind, windClock: s.clock,
    }, RANGES);
    const rows = res.rows;
    const at = (y) => rows.find((r) => r.yards === y);
    const trans = rows.find((r) => r.mach < 1.2);
    return { s: Object.assign({}, s), rows, atm: res.atmosphere, r1000: at(1000), transYards: trans ? trans.yards : null };
  }

  function metric(res, key, unit) {
    const r = res.r1000;
    if (key === 'elev') return L.toUnit(-r.dropIn, 1000, unit);
    if (key === 'wind') return L.toUnit(-r.windIn, 1000, unit);
    return r[key];
  }

  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; render(); });
  }

  function tile(label, value, unit, base, dec, invert) {
    let delta = '';
    if (base != null) {
      const d = value - base;
      if (Math.abs(d) >= Math.pow(10, -dec) / 2) {
        const cls = (d > 0) !== !!invert ? 'up' : 'down';
        delta = `<div class="delta ${cls}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(dec)}</div>`;
      } else delta = '<div class="delta">=</div>';
    }
    return `<div class="tile"><div class="label">${label}</div><div class="value">${value.toFixed(dec)}<small>${unit}</small></div>${delta}</div>`;
  }

  function render() {
    const u = state.unit;
    const res = compute(state);
    const b = baseline;
    const dec = 2;
    $('#lab-tiles').innerHTML =
      tile('Elevation @1000', metric(res, 'elev', u), u, b && metric(b, 'elev', u), dec) +
      tile('Wind @1000', Math.abs(metric(res, 'wind', u)), u, b && Math.abs(metric(b, 'wind', u)), dec) +
      tile('Velocity @1000', res.r1000.velocityFps, 'fps', b && b.r1000.velocityFps, 0, true) +
      tile('Time of flight', res.r1000.tofSec, 's', b && b.r1000.tofSec, 2) +
      tile('Density alt.', res.atm.densityAltitudeFt, 'ft', b && b.atm.densityAltitudeFt, 0, true) +
      `<div class="tile"><div class="label">Transonic at</div><div class="value">${res.transYards ? res.transYards : '>1200'}<small>yd</small></div></div>`;

    const path = (r) => [[0, -1.9]].concat(r.rows.map((x) => [x.yards, x.dropIn]));
    const pathSeries = [{ points: path(res), cls: 'accent', label: 'Bullet path (in)', area: true }];
    if (b) pathSeries.push({ points: path(b), cls: 'ghost', label: 'Baseline' });
    L.lineChart($('#chart-path'), {
      series: pathSeries, xMax: 1200, yLabel: 'inches', shadeFrom: res.transYards,
      tip: (x, ys) => `${x} yd<br>${ys[0] >= 0 ? '+' : ''}${ys[0].toFixed(1)} in` + (b ? `<br>base ${ys[1].toFixed(1)}` : ''),
    });

    const corr = (r, key) => r.rows.map((x) => [x.yards, L.toUnit(key === 'elev' ? -x.dropIn : Math.abs(x.windIn), x.yards, u)]);
    const corrSeries = [
      { points: corr(res, 'elev'), cls: 'accent', label: `Elevation (${u})` },
      { points: corr(res, 'wind'), cls: '2', label: `Wind hold (${u})` },
    ];
    if (b) corrSeries.push({ points: corr(b, 'elev'), cls: 'ghost', label: 'Baseline elevation' });
    L.lineChart($('#chart-corr'), {
      series: corrSeries, xMax: 1200, yLabel: u, shadeFrom: res.transYards,
      tip: (x, ys) => `${x} yd<br>elev ${ys[0].toFixed(2)}<br>wind ${ys[1].toFixed(2)}`,
    });
  }

  // -------------------------------------------------------- challenges

  const CHALLENGES = [
    {
      q: 'The temperature rises 40°F since you made your card. At 1000 yd, do you need MORE or LESS elevation?',
      metric: 'elev', pre: (s) => (s.temp > 70 ? { temp: 40 } : {}), apply: (s) => ({ temp: s.temp + 40 }),
      why: 'Warm air is less dense → less drag → the bullet keeps more speed → less time to fall → less drop.',
    },
    {
      q: 'You drive from a sea-level range to one at 6,000 ft. MORE or LESS elevation at 1000 yd?',
      metric: 'elev', pre: () => ({ alt: 0 }), apply: () => ({ alt: 6000 }),
      why: 'Thinner air at altitude = less drag. This is why your card needs a density-altitude band.',
    },
    {
      q: 'Cold ammo runs 100 fps slower than your chrono data. MORE or LESS elevation at 1000 yd?',
      metric: 'elev', pre: (s) => (s.mv < 2400 ? { mv: 2710 } : {}), apply: (s) => ({ mv: s.mv - 100 }),
      why: 'Slower bullet → longer time of flight → gravity acts longer → more drop. Velocity is the variable you true first.',
    },
    {
      q: 'You switch to a bullet with a BC 0.05 higher (same MV). MORE or LESS elevation at 1000 yd?',
      metric: 'elev', pre: (s) => (s.bc > 0.36 ? { bc: 0.3 } : {}), apply: (s) => ({ bc: +(s.bc + 0.05).toFixed(3) }),
      why: 'Higher BC → less deceleration → higher average velocity → less drop. Watch the transonic line move out too.',
    },
    {
      q: 'The wind swings from 3 o\'clock to 1 o\'clock, same speed. Does your wind hold get BIGGER or SMALLER?',
      metric: 'wind', pre: (s) => ({ clock: 3, wind: Math.max(8, s.wind) }), apply: () => ({ clock: 1 }),
      why: '1 o\'clock is a 30° angle: sin(30°) = 0.5, so it is "half value". Only the crosswind component pushes the bullet sideways.',
    },
    {
      q: 'You re-zero at 200 yd instead of 100. Do you dial MORE or LESS elevation for 1000 yd?',
      metric: 'elev', pre: () => ({ zero: 100 }), apply: () => ({ zero: 200 }),
      why: 'A farther zero tilts the bore up more, so part of the drop is already built into the zero. The bullet\'s path is identical — only the reference changes.',
    },
    {
      q: 'Wind speed doubles from 6 to 12 mph. Does the hold get BIGGER or SMALLER — and by roughly how much?',
      metric: 'wind', pre: (s) => ({ wind: 6, clock: s.clock === 12 || s.clock === 6 ? 3 : s.clock }), apply: () => ({ wind: 12 }),
      why: 'Drift scales almost linearly with crosswind speed: double the wind ≈ double the hold. That\'s why cards list 5/10/15 mph brackets.',
    },
    {
      q: 'Muzzle velocity goes UP 75 fps. Does your WIND hold at 1000 yd get BIGGER or SMALLER?',
      metric: 'wind', pre: (s) => ({ wind: Math.max(8, s.wind), clock: 3, mv: Math.min(s.mv, 3100) }), apply: (s) => ({ mv: s.mv + 75 }),
      why: 'Wind drift depends on the lag time (actual TOF minus vacuum TOF). A faster, less-delayed bullet gives the wind less time to act.',
    },
  ];

  let order = CHALLENGES.map((_, i) => i).sort(() => Math.random() - 0.5);
  let ci = 0;
  let correct = L.store.get('lab.correct', 0);

  function showChallenge() {
    const c = CHALLENGES[order[ci % order.length]];
    const up = c.metric === 'elev' ? 'More elevation' : 'Bigger hold';
    const down = c.metric === 'elev' ? 'Less elevation' : 'Smaller hold';
    $('#challenge').innerHTML = `
      <div class="card-title" style="margin-bottom:0">
        <div class="eyebrow" style="margin:0">Predict, then reveal</div>
        <span class="challenge-count">${correct} correct · #${(ci % order.length) + 1}/${order.length}</span>
      </div>
      <div class="q">${c.q}</div>
      <div class="actions" style="margin-top:0">
        <button class="btn" data-a="up">▲ ${up}</button>
        <button class="btn" data-a="down">▼ ${down}</button>
      </div>
      <div id="challenge-answer"></div>`;
    $$('#challenge [data-a]').forEach((btn) => btn.addEventListener('click', () => answer(c, btn.dataset.a)));
  }

  function answer(c, guess) {
    $$('#challenge [data-a]').forEach((b) => { b.disabled = true; });
    Object.assign(state, c.pre(state));
    syncSliders();
    baseline = compute(state);
    const before = Math.abs(metric(baseline, c.metric, state.unit));
    Object.assign(state, c.apply(state));
    syncSliders();
    render();
    const after = Math.abs(metric(compute(state), c.metric, state.unit));
    const truth = after > before ? 'up' : 'down';
    const right = truth === guess;
    const dec = 2;
    $('#challenge-answer').innerHTML = `
      <div class="answer ${right ? 'right' : 'wrong'}">
        <b>${right ? 'Correct.' : 'Not quite.'}</b>
        ${c.metric === 'elev' ? 'Elevation' : 'Wind hold'} at 1000 yd:
        <span class="mono">${before.toFixed(dec)} → ${after.toFixed(dec)} ${state.unit}</span>
        (${after > before ? '+' : ''}${(after - before).toFixed(dec)}).
        <div style="margin-top:6px">${c.why}</div>
        <div class="hint" style="margin-top:6px">The dashed line on the charts is where you started.</div>
      </div>
      <div class="actions"><button class="btn primary" id="challenge-next">Next challenge →</button></div>`;
    $('#challenge-next').addEventListener('click', () => { ci++; showChallenge(); });
    if (right) {
      correct++;
      L.store.set('lab.correct', correct);
      L.sfx.good();
      L.addXp(15, 'correct prediction');
    } else {
      L.sfx.bad();
    }
  }

  syncSliders();
  render();
  showChallenge();
  window.addEventListener('themechange', render);
})();
