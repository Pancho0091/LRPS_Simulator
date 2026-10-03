/*
 * Range tab: a steel-plate shooting simulator driven by the real solver.
 *
 * The world differs from the card the way a real range does:
 *  - weather on the day (density altitude, powder temperature → MV)
 *  - shot angle, wind that varies near/mid/far and gusts over time
 *  - second-order effects (spin drift, Coriolis, aerodynamic jump)
 *  - the shooter: position wobble, breathing, cant, MV spread, dispersion
 * Training mode turns most of this off; Realistic turns it on.
 * All angles are in MIL.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;

  const scope = $('#scope');
  const sctx = scope.getContext('2d');
  const flags = $('#flags');
  const fctx = flags.getContext('2d');

  const LOCATIONS = [
    { name: 'Coastal range', alt: 50, lat: 34, temp: [50, 82] },
    { name: 'Midwest range', alt: 900, lat: 41, temp: [20, 95] },
    { name: 'Desert range', alt: 2500, lat: 33, temp: [60, 108] },
    { name: 'Mountain range', alt: 6200, lat: 39, temp: [25, 85] },
    { name: 'Northern range', alt: 1200, lat: 61, temp: [5, 70] },
  ];

  // Wobble amplitude in MIL for each position
  const POSITIONS = { bench: 0.035, 'prone-bag': 0.09, prone: 0.18, barricade: 0.4, kneeling: 0.75, standing: 1.3 };

  const PRESETS = {
    training: { 'opt-weather': false, 'opt-angle': false, 'opt-rf': true, 'opt-call': true, 'opt-spotter': true, 'opt-gusts': true, 'opt-cant': false, 'opt-adv': false, 'opt-truing': false, position: 'prone-bag' },
    realistic: { 'opt-weather': true, 'opt-angle': true, 'opt-rf': true, 'opt-call': false, 'opt-spotter': false, 'opt-gusts': true, 'opt-cant': true, 'opt-adv': true, 'opt-truing': false, position: 'prone' },
  };

  const HALF_FOV = 5; // mil from center to edge of the scope view

  const R = {
    s: null,
    world: null,          // weather + wind field, shared by all targets in a stage
    dial: { elev: 0, wind: 0 },
    flight: null,
    puffs: [],
    swing: { t0: 0, amp: 0 },
    cant: 0, cantTarget: 0,
    breath: { holding: false, start: 0, releasedAt: -1e9 },
    session: { shots: 0, hits: 0, targets: 0, firstHits: 0, streak: 0 },
    best: L.store.get('range.bestStreak', 0),
    stage: null,
    shotNo: 0,
    running: false,
    mirage: Array.from({ length: 46 }, () => ({ x: Math.random(), y: 0.25 + Math.random() * 0.7, len: 0.04 + Math.random() * 0.1, ph: Math.random() * 6 })),
    trees: Array.from({ length: 64 }, (_, i) => 0.5 + 0.5 * Math.sin(i * 1.7) * Math.cos(i * 0.63) + Math.random() * 0.4),
    tufts: Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), h: 0.4 + Math.random() * 0.6 })),
  };

  const opt = (id) => $('#' + id).checked;
  const CLICK = 0.1;
  const toMil = (inches, yards) => B.inchesToMil(inches, yards);
  const milIn = (mil, yards) => B.milToInches(mil, yards);

  // ------------------------------------------------------------ presets

  function applyPreset(name) {
    const p = PRESETS[name];
    Object.keys(p).forEach((k) => { if (k !== 'position') $('#' + k).checked = p[k]; });
    $('#opt-position').value = p.position;
    $('#opt-plate').value = name === 'realistic' ? 'random' : '12';
    L.store.set('range.preset', name);
    if (R.stage) startStage(); else newWorld();
  }

  L.seg($('#range-preset'), (v) => { applyPreset(v); L.toast(v === 'realistic' ? 'Realistic: no wind call, no spotter, real weather' : 'Training: helpers on'); });
  L.seg($('#range-mode'), (v) => {
    if (v === 'stage') startStage();
    else { R.stage = null; renderStage(); newTarget(); }
  });

  // ------------------------------------------------------------ world

  // Weather and the wind field. Kept for a whole stage so conditions stay coherent.
  function newWorld() {
    const p = L.profile;
    let w;
    if (opt('opt-weather')) {
      const loc = L.pick(LOCATIONS);
      w = {
        loc: loc.name,
        altitudeFt: loc.alt,
        tempF: Math.round(L.rand(loc.temp[0], loc.temp[1])),
        humidityPct: L.randInt(10, 90),
        latitudeDeg: loc.lat,
        azimuthDeg: L.randInt(0, 359),
      };
    } else {
      w = { loc: 'Your card conditions', altitudeFt: +p.altitudeFt, tempF: +p.tempF, humidityPct: +p.humidityPct, latitudeDeg: 40, azimuthDeg: L.randInt(0, 359) };
    }
    w.atm = B.atmosphere(w);
    // Ammo in the sun runs hotter than the air
    w.powderTempF = w.tempF + (opt('opt-weather') ? L.randInt(0, 12) : 0);

    const base = L.pick([0, 2, 4, 5, 6, 7, 8, 8, 9, 10, 10, 11, 12, 13, 14, 16]);
    const clock = L.pick([1, 2, 3, 3, 4, 5, 7, 8, 9, 9, 10, 11, 12]);
    const vary = opt('opt-gusts');
    w.wind = {
      base,
      clock,
      gust: vary && base ? 2 + Math.floor(base / 5) : 0,
      zones: [0, 1, 2].map(() => ({
        base: vary ? base * L.rand(0.75, 1.25) : base,
        clock: vary && Math.random() < 0.3 ? ((clock + L.pick([-1, 1]) + 11) % 12) + 1 : clock,
        ph1: Math.random() * 10,
        ph2: Math.random() * 10,
      })),
    };
    R.world = w;
    newTarget();
  }

  // Wind at one zone (0 near, 1 mid, 2 far) at time t (ms)
  function zoneWind(t, z) {
    const w = R.world.wind;
    const zn = w.zones[z];
    const tt = t / 1000;
    if (w.base === 0) {
      return { speed: Math.max(0, 1 + Math.sin(tt * 0.7 + zn.ph1)), clock: (zn.clock + 3 * Math.sin(tt * 0.21 + zn.ph2) + 12) % 12 };
    }
    const g = w.gust * (0.62 * Math.sin(tt * 0.43 + zn.ph1) + 0.38 * Math.sin(tt * 1.37 + zn.ph2));
    return { speed: Math.max(0, zn.base + g), clock: zn.clock };
  }

  // Vector blend of the three zones; wind near the muzzle is weighted most
  function blend(winds) {
    const wts = [0.4, 0.35, 0.25];
    let cross = 0, head = 0;
    winds.forEach((w, z) => {
      const a = w.clock * Math.PI / 6;
      cross += wts[z] * w.speed * Math.sin(a);
      head += wts[z] * w.speed * Math.cos(a);
    });
    let clock = Math.atan2(cross, head) / (Math.PI / 6);
    if (clock <= 0) clock += 12;
    return { speed: Math.hypot(cross, head), clock };
  }
  const pathWind = (t) => blend([0, 1, 2].map((z) => zoneWind(t, z)));
  const meanWind = () => blend(R.world.wind.zones.map((zn) => ({ speed: zn.base, clock: zn.clock })));

  // ------------------------------------------------------------ targets

  function randomPlate() {
    const v = $('#opt-plate').value;
    return v === 'random' ? L.pick([8, 10, 12, 12, 14, 16, 18]) : +v;
  }

  function newTarget(forced) {
    if (!R.world) { newWorld(); return; }
    const p = L.profile;
    const maxR = Math.max(400, Math.min(1500, +p.rangeEnd || 1000));
    const minR = Math.min(300, maxR - 100);
    const yards = forced ? forced.yards : Math.round(L.rand(minR, maxR) / 5) * 5;
    const angle = opt('opt-angle') ? Math.round(Math.max(-15, Math.min(15, L.gauss() * 6))) : 0;
    let mvOffset = 0;
    if (opt('opt-truing')) mvOffset = R.stage && R.stage.mvOffset != null ? R.stage.mvOffset : Math.round(L.pick([-1, 1]) * L.rand(30, 70));
    if (R.stage) R.stage.mvOffset = mvOffset;
    // The rifle was zeroed at home, at card conditions, with the real load
    const zeroAngleRad = B.solve(L.solverInput(p, { muzzleVelocityFps: +p.muzzleVelocityFps + mvOffset, windMph: 0 }), [+p.zeroYards]).zeroAngleRad;
    const rfErr = Math.round(L.gauss() * (1 + yards / 600));

    R.s = {
      yards,
      rfYards: yards + rfErr,
      angle,
      mvOffset,
      zeroAngleRad,
      plateIn: forced ? forced.plateIn : randomPlate(),
      precisionMil: Math.max(0, +$('#opt-precision').value || 0),
      marks: [],
      shotsHere: 0,
    };
    if (opt('opt-cant')) { R.cant = L.gauss() * 2.2; R.cantTarget = R.cant; } else { R.cant = 0; R.cantTarget = 0; }
    R.session.targets++;
    R.puffs = [];
    if (!R.stage) { setDial('elev', 0, true); setDial('wind', 0, true); }
    $('#range-feedback').innerHTML = R.stage ? '' : '<span class="hint">Range it, read the wind, dial from your card, send it.</span>';
    $('#whatchanged-card').hidden = true;
    renderBrief();
    renderHud();
  }

  // ------------------------------------------------------------ brief

  function windCallText() {
    const w = R.world.wind;
    if (w.base === 0) return 'Calm · 0–2 mph, variable';
    const sp = w.gust ? `${Math.max(0, w.base - w.gust)}–${w.base + w.gust} mph` : `${w.base} mph`;
    return `${sp} from ${w.clock} o'clock`;
  }

  function renderBrief() {
    const s = R.s;
    const rf = opt('opt-rf')
      ? `<div class="range-num">${s.rfYards}<small> yd</small></div>`
      : '<div class="range-num">—<small> mil it</small></div>';
    const ang = s.angle
      ? `<div class="hint">${s.angle > 0 ? '▲ uphill' : '▼ downhill'} ${Math.abs(s.angle)}° · cos ${Math.cos(s.angle * Math.PI / 180).toFixed(3)}</div>`
      : '<div class="hint">Flat · 0°</div>';
    $('#range-brief').innerHTML = `
      <div class="tile wide"><div class="label">${opt('opt-rf') ? 'Rangefinder (line of sight)' : 'Rangefinder unavailable'}</div>${rf}${ang}</div>
      <div class="tile wide"><div class="label">Wind call</div><div style="font-weight:700;font-size:16px">${opt('opt-call') ? windCallText() : 'None — read the flags, mirage and meter'}</div></div>
      <div class="tile"><div class="label">Plate</div><div class="value" style="font-size:17px">${s.plateIn}"<small>${opt('opt-rf') ? toMil(s.plateIn, s.yards).toFixed(2) + ' mil' : 'steel'}</small></div></div>
      <div class="tile"><div class="label">Position</div><div style="font-weight:700;font-size:13px;margin-top:4px">${$('#opt-position').selectedOptions[0].textContent}</div></div>`;
    $('#level-btn').hidden = !opt('opt-cant');
    renderKestrel(performance.now());
  }

  let kestrelAt = 0;
  function renderKestrel(now) {
    const w = R.world;
    if (!w) return;
    const near = zoneWind(now, 0);
    const inHg = w.atm.pressurePa / 3386.389;
    const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(w.azimuthDeg / 45) % 8];
    const grid = `
        <div><small>Temp</small><b>${w.tempF}°F</b></div>
        <div><small>Station</small><b>${inHg.toFixed(2)}"</b></div>
        <div><small>Humidity</small><b>${w.humidityPct}%</b></div>
        <div><small>DA</small><b>${Math.round(w.atm.densityAltitudeFt)} ft</b></div>
        <div><small>Wind here</small><b>${near.speed.toFixed(1)} mph</b></div>
        <div><small>From</small><b>~${Math.round(near.clock) || 12} o'clock</b></div>
        <div><small>Latitude</small><b>${w.latitudeDeg}°N</b></div>
        <div><small>Azimuth</small><b>${w.azimuthDeg}° ${dir}</b></div>`;
    const box = $('#kestrel');
    if (!$('.k-grid', box)) {
      box.innerHTML = `<div class="k-head"><span>WEATHER METER</span><span class="k-loc"></span></div><div class="k-grid"></div>
        <button class="btn k-btn" id="k-load" type="button">Load today's weather into my card</button>`;
      $('#k-load').addEventListener('click', () => {
        const ww = R.world;
        L.setProfile(Object.assign({}, L.profile, { altitudeFt: ww.altitudeFt, tempF: ww.tempF, humidityPct: ww.humidityPct }));
        L.toast(`Card recomputed for ${Math.round(ww.atm.densityAltitudeFt)} ft DA`);
      });
    }
    $('.k-loc', box).textContent = w.loc;
    $('.k-grid', box).innerHTML = grid;
    kestrelAt = now;
  }

  function renderHud() {
    const ss = R.session;
    const pct = ss.shots ? Math.round(ss.hits / ss.shots * 100) + '%' : '–';
    const tile = (l, v) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div></div>`;
    $('#range-hud').innerHTML = tile('Shots', ss.shots) + tile('Hits', ss.hits) + tile('Hit %', pct) +
      tile('1st-round', `${ss.firstHits}/${Math.max(0, ss.targets - (R.s && !R.s.shotsHere ? 1 : 0))}`) +
      tile('Streak', `${ss.streak}<small>best ${R.best}</small>`);
  }

  // ------------------------------------------------------------ stage

  function startStage() {
    R.stage = null;
    newWorld();
    const p = L.profile;
    const maxR = Math.max(500, Math.min(1500, +p.rangeEnd || 1000));
    const n = 5;
    const yards = Array.from({ length: n }, (_, i) => Math.round((300 + (maxR - 300) * (i + L.rand(0.1, 0.9)) / n) / 5) * 5);
    R.stage = {
      targets: yards.map((y) => ({ yards: y, plateIn: L.pick([10, 12, 12, 14, 16, 18]), result: null })),
      i: 0,
      start: 0,
      par: 150,
      over: false,
      mvOffset: null,
    };
    setDial('elev', 0, true); setDial('wind', 0, true);
    goStageTarget(0);
    $('#range-feedback').innerHTML = `<div class="verdict">STAGE READY</div><div>${n} targets, one shot each, ${R.stage.par} s par. The clock starts on your first shot — plan your dope from the list first.</div>`;
  }

  function goStageTarget(i) {
    R.stage.i = i;
    const t = R.stage.targets[i];
    newTarget({ yards: t.yards, plateIn: t.plateIn });
    renderStage();
  }

  function renderStage() {
    const st = R.stage;
    $('#range-new').textContent = st ? 'Restart stage' : 'New target';
    if (!st) { $('#stage-list').innerHTML = ''; $('#scope-stage').textContent = ''; return; }
    const rf = opt('opt-rf');
    $('#stage-list').innerHTML = `<div class="stage-list"><div class="k-head"><span>STAGE · ${st.targets.length} TARGETS</span><span>par ${st.par} s</span></div>
      ${st.targets.map((t, i) => `<div class="st-row${i === st.i && !st.over ? ' on' : ''}">
        <span class="st-n">T${i + 1}</span><span>${rf ? t.yards + ' yd' : '?? yd'}</span><span>${t.plateIn}"</span>
        <span class="st-r ${t.result === true ? 'hit' : t.result === false ? 'miss' : ''}">${t.result === true ? 'HIT' : t.result === false ? 'MISS' : i === st.i && !st.over ? '◀' : ''}</span></div>`).join('')}</div>`;
  }

  function stageShotLanded(hit) {
    const st = R.stage;
    st.targets[st.i].result = hit;
    renderStage();
    const next = st.i + 1;
    if (next < st.targets.length && !st.over) setTimeout(() => { if (R.stage === st && !st.over) goStageTarget(next); }, 1100);
    else finishStage();
  }

  function finishStage() {
    const st = R.stage;
    if (!st || st.over) return;
    st.over = true;
    const secs = st.start ? (performance.now() - st.start) / 1000 : 0;
    st.targets.forEach((t) => { if (t.result == null) t.result = false; });
    const hits = st.targets.filter((t) => t.result === true).length;
    const inTime = secs <= st.par;
    const xp = hits * 15 + (hits === st.targets.length ? 40 : 0) + (inTime && hits ? 10 : 0);
    renderStage();
    $('#range-feedback').innerHTML = `<div class="verdict ${hits >= 3 ? 'hit' : 'miss'}">STAGE: ${hits}/${st.targets.length}</div>
      <div>Time ${secs.toFixed(1)} s ${inTime ? '(inside par)' : '(over par — unshot targets scored as misses)'}.</div>
      <div class="actions"><button class="btn primary" id="stage-again">Run another stage</button></div>`;
    $('#stage-again').addEventListener('click', startStage);
    if (hits === st.targets.length) { L.confetti(); L.sfx.good(); }
    L.addXp(xp, 'stage complete');
  }

  // ------------------------------------------------------------ turrets

  // 100 clicks (10 mil) per revolution; a tick every 2 clicks, a long tick every 20.
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
    const v = +B.roundToClick(value, CLICK).toFixed(1);
    const prev = R.dial[axis];
    R.dial[axis] = v;
    const el = $(`.turret[data-axis="${axis}"]`);
    $('input', el).value = v.toFixed(1);
    $('input', el).step = CLICK;
    const clicks = Math.round(v / CLICK);
    $('.ring', el).style.transform = `rotate(${-clicks * 3.6}deg)`;
    const dirWord = axis === 'elev' ? (v > 0 ? 'UP' : v < 0 ? 'DOWN' : 'MIL') : (v > 0 ? 'RIGHT' : v < 0 ? 'LEFT' : 'MIL');
    const rev = axis === 'elev' && Math.abs(clicks) >= 100 ? ` · rev ${Math.floor(Math.abs(clicks) / 100) + 1}` : '';
    $('.dial-value', el).innerHTML = `<div>${Math.abs(v).toFixed(1)}<small>${dirWord + rev}</small></div>`;
    if (!silent && v !== prev) L.sfx.click();
  }

  function nudge(axis, clicks) { setDial(axis, R.dial[axis] + clicks * CLICK); }

  $$('.turret').forEach((el) => {
    const axis = el.dataset.axis;
    $$('button', el).forEach((b) => b.addEventListener('click', () => nudge(axis, +b.dataset.step)));
    $('input', el).addEventListener('change', (e) => setDial(axis, parseFloat(e.target.value) || 0));
    $('.dial', el).addEventListener('wheel', (e) => { e.preventDefault(); nudge(axis, e.deltaY < 0 ? 1 : -1); }, { passive: false });
  });

  // ------------------------------------------------------- the shooter

  function level() {
    if (!opt('opt-cant')) return;
    R.cantTarget = L.gauss() * 0.25;
    L.sfx.click();
  }

  // Breath control: a short hold steadies you, a long one makes you shake
  function breathFactor(now) {
    const b = R.breath;
    if (b.holding) {
      const t = (now - b.start) / 1000;
      if (t > 10) { releaseBreath(now); return 1.5; }
      if (t < 0.7) return 1 - 0.65 * (t / 0.7);
      if (t < 6) return 0.35;
      return 0.35 + (t - 6) / 4 * 1.25;
    }
    const since = (now - b.releasedAt) / 1000;
    return since < 3 ? 1.5 - since / 6 : 1;
  }
  function holdBreath() {
    if (R.breath.holding) return;
    R.breath.holding = true;
    R.breath.start = performance.now();
    $('#breath-btn').classList.add('on');
  }
  function releaseBreath(now) {
    if (!R.breath.holding) return;
    R.breath.holding = false;
    R.breath.releasedAt = now || performance.now();
    $('#breath-btn').classList.remove('on');
  }

  // Reticle sway in MIL: figure-8 hold wobble + breathing cycle, scaled by position
  function sway(now) {
    const A = POSITIONS[$('#opt-position').value] || 0.09;
    const t = now / 1000;
    const f = breathFactor(now);
    const breathing = R.breath.holding ? 0 : Math.sin(t * 2 * Math.PI / 4.2) * 0.8;
    const x = A * f * (0.6 * Math.sin(1.3 * t + 0.7) + 0.25 * Math.sin(3.1 * t));
    const y = A * (f * (0.45 * Math.sin(2.1 * t + 1.9) + 0.2 * Math.sin(4.3 * t)) + breathing) + A * 0.08 * Math.max(0, Math.sin(t * 7.5)) ** 8;
    return { x, y };
  }

  // ------------------------------------------------------------- fire

  function shotInputs(extra) {
    const p = L.profile, s = R.s, w = R.world;
    const adv = opt('opt-adv');
    return L.solverInput(p, Object.assign({
      muzzleVelocityFps: +p.muzzleVelocityFps + s.mvOffset,
      altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, powderTempF: w.powderTempF,
      shotAngleDeg: s.angle,
      zeroAngleRad: s.zeroAngleRad,
      spinDrift: adv, aeroJump: adv, coriolis: adv,
      latitudeDeg: w.latitudeDeg, azimuthDeg: w.azimuthDeg,
    }, extra));
  }

  function fire() {
    const s = R.s;
    if (!s || R.flight || (R.stage && R.stage.over)) return;
    if (R.stage && !R.stage.start) R.stage.start = performance.now();
    const p = L.profile;
    const now = performance.now();
    const w = pathWind(now);
    const sd = +p.sdFps || 10;
    const row = B.solve(shotInputs({
      muzzleVelocityFps: +p.muzzleVelocityFps + s.mvOffset + L.gauss() * sd,
      windMph: w.speed, windClock: w.clock,
    }), [s.yards]).rows[0];

    // Cant rotates the dialed correction (clockwise cant moves it right and down)
    const th = R.cant * Math.PI / 180;
    const eIn = milIn(R.dial.elev, s.yards);
    const wIn = milIn(R.dial.wind, s.yards);
    const dialUp = eIn * Math.cos(th) - wIn * Math.sin(th);
    const dialRight = wIn * Math.cos(th) + eIn * Math.sin(th);

    // Where the reticle was when the shot broke
    const sw = sway(now);
    // Precision = 5-shot group size; sigma ≈ size / 3 per axis
    const sigmaIn = milIn(s.precisionMil, s.yards) / 3;
    const upIn = row.dropIn + dialUp + milIn(sw.y, s.yards) + L.gauss() * sigmaIn;
    const rightIn = row.windIn + dialRight + milIn(sw.x, s.yards) + L.gauss() * sigmaIn;
    const hit = Math.hypot(upIn, rightIn) <= s.plateIn / 2;

    R.flight = { start: now, tof: row.tofSec * 1000, upIn, rightIn, hit, dialE: R.dial.elev, dialW: R.dial.wind };
    $('#fire-btn').disabled = true;
    L.sfx.shot();
    R.recoilAt = now;
    releaseBreath(now);
  }

  function land() {
    const f = R.flight;
    const s = R.s;
    R.flight = null;
    $('#fire-btn').disabled = false;
    $('#flight-bar').style.width = '0';
    const up = toMil(f.upIn, s.yards);
    const right = toMil(f.rightIn, s.yards);
    const first = s.shotsHere === 0;
    s.shotsHere++;
    R.shotNo++;
    const ss = R.session;
    ss.shots++;
    s.marks.push({ up, right, upIn: f.upIn, rightIn: f.rightIn, hit: f.hit, n: R.shotNo });
    R.puffs.push({ up, right, t0: performance.now(), hit: f.hit });

    const soundDelay = opt('opt-delay') ? s.yards * 3 / 1125 : 0;
    if (f.hit) {
      ss.hits++;
      ss.streak++;
      if (ss.streak > R.best) { R.best = ss.streak; L.store.set('range.bestStreak', R.best); }
      R.swing = { t0: performance.now(), amp: 0.22 + Math.min(0.2, s.plateIn / 120) };
      if (first) ss.firstHits++;
      L.sfx.ding(soundDelay);
      setHud(`Impact · ding in ${soundDelay.toFixed(1)} s`, soundDelay * 1000 + 900);
      const xp = 10 + Math.floor(s.yards / 100) + (first ? 15 : 0) + (ss.streak >= 3 ? 5 : 0) + (opt('opt-spotter') ? 0 : 5);
      setTimeout(() => {
        L.addXp(xp, first ? 'first-round hit!' : 'hit');
        if (first && !R.stage) {
          const r = scope.getBoundingClientRect();
          L.confetti(r.left + r.width / 2, r.top + r.height / 2);
        }
      }, soundDelay * 1000);
    } else {
      ss.streak = 0;
      L.sfx.thud(soundDelay * 0.6);
      setHud('Miss · read the splash', 1200);
    }

    const visible = Math.abs(up) < HALF_FOV && Math.abs(right) < HALF_FOV;
    let detail;
    if (opt('opt-spotter')) {
      const corrE = B.roundToClick(f.dialE - up, CLICK);
      const corrW = B.roundToClick(f.dialW - right, CLICK);
      detail = `<div>Spotter: <b class="mono">${up >= 0 ? 'high' : 'low'} ${Math.abs(up).toFixed(1)}</b>, <b class="mono">${right >= 0 ? 'right' : 'left'} ${Math.abs(right).toFixed(1)}</b>.</div>
        ${f.hit ? '' : `<div class="hint" style="margin-top:4px">From this impact: elev <b class="mono">${corrE.toFixed(1)}</b>, wind <b class="mono">${corrW.toFixed(1)}</b>. Gusts, wobble and dispersion add noise.</div>`}`;
    } else {
      detail = f.hit ? '<div>Steel rang. Note your dope.</div>'
        : `<div>${visible ? 'You caught the splash — read it against the reticle and correct.' : 'No splash seen in the scope. Check your dial, revolution and range.'}</div>`;
    }
    $('#range-feedback').innerHTML = `<div class="verdict ${f.hit ? 'hit' : 'miss'}">${f.hit ? (first ? 'FIRST-ROUND HIT' : 'HIT') : 'MISS'}</div>${detail}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${R.shotNo}</td><td>${s.yards}</td><td>${f.dialE.toFixed(1)}</td><td>${f.dialW.toFixed(1)}</td>` +
      `<td>${up.toFixed(2)} / ${right.toFixed(2)}</td><td style="color:var(--${f.hit ? 'good' : 'bad'})">${f.hit ? 'hit' : 'miss'}</td>`;
    $('#shot-log tbody').prepend(tr);
    renderHud();
    if (R.stage) stageShotLanded(f.hit);
  }

  let hudTimer = 0;
  function setHud(text, ms) {
    const el = $('#scope-hud');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(hudTimer);
    if (ms) hudTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // Break the true solution into the layers a card doesn't include
  function reveal() {
    const s = R.s, w = R.world;
    if (!s) return;
    const p = L.profile;
    const mw = meanWind();
    const adv = opt('opt-adv');
    const solveAt = (extra) => B.solve(L.solverInput(p, Object.assign({ windMph: mw.speed, windClock: mw.clock }, extra)), [s.yards]).rows[0];
    const today = { altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, powderTempF: w.powderTempF };
    const withAngle = Object.assign({}, today, { shotAngleDeg: s.angle });
    const withMv = Object.assign({}, withAngle, { muzzleVelocityFps: +p.muzzleVelocityFps + s.mvOffset, zeroAngleRad: s.zeroAngleRad });
    const withAdv = Object.assign({}, withMv, { spinDrift: adv, aeroJump: adv, coriolis: adv, latitudeDeg: w.latitudeDeg, azimuthDeg: w.azimuthDeg });
    const steps = [
      ['Your card (card conditions, flat)', {}],
      ["Today's weather + powder temp", today],
      ['Shot angle', withAngle],
      ['Zero set at home + MV error', withMv],
      ['Spin drift, Coriolis, aero jump', withAdv],
    ];
    let prev = null;
    const rows = steps.map(([name, extra]) => {
      const r = solveAt(extra);
      const e = toMil(-r.dropIn, s.yards), wd = toMil(-r.windIn, s.yards);
      const de = prev ? e - prev.e : null, dw = prev ? wd - prev.w : null;
      prev = { e, w: wd };
      const fmtD = (d) => (d == null ? '' : `${d >= 0 ? '+' : ''}${d.toFixed(2)}`);
      return `<tr><td>${name}</td><td class="mono">${fmtD(de)}</td><td class="mono">${fmtD(dw)}</td><td class="mono"><b>${L.fmtClick(e, CLICK)}</b></td><td class="mono"><b>${L.fmtClick(wd, CLICK)}</b></td></tr>`;
    });
    $('#whatchanged').innerHTML = `<div class="table-wrap"><table class="tbl text">
      <thead><tr><th>Layer</th><th>Δ elev</th><th>Δ wind</th><th>Elev mil</th><th>Wind mil</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>
      <p class="hint">True range ${s.yards} yd${opt('opt-rf') ? ` (rangefinder read ${s.rfYards})` : ''} · average wind ${mw.speed.toFixed(1)} mph from ${(Math.round(mw.clock * 2) / 2) || 12} o'clock ·
      DA ${Math.round(w.atm.densityAltitudeFt)} ft · powder ${w.powderTempF}°F${s.mvOffset ? ` · hidden MV error ${s.mvOffset > 0 ? '+' : ''}${s.mvOffset} fps` : ''}.
      Gusts move the wind around this average; your position adds wobble.</p>`;
    $('#whatchanged-card').hidden = false;
    $('#whatchanged-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#fire-btn').addEventListener('click', fire);
  $('#range-new').addEventListener('click', () => { if (R.stage) startStage(); else newTarget(); L.sfx.click(); });
  $('#range-reveal').addEventListener('click', reveal);
  $('#range-reset').addEventListener('click', () => { setDial('elev', 0); setDial('wind', 0); });
  $('#level-btn').addEventListener('click', level);
  const bb = $('#breath-btn');
  bb.addEventListener('pointerdown', (e) => { e.preventDefault(); holdBreath(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bb.addEventListener(ev, () => releaseBreath()));
  $$('#range-settings input, #range-settings select').forEach((el) => el.addEventListener('change', () => {
    $$('#range-preset button').forEach((b) => b.classList.remove('on'));
    if (R.stage) { startStage(); return; }
    if (['opt-weather', 'opt-gusts'].includes(el.id)) newWorld();
    else if (['opt-position', 'opt-call', 'opt-rf', 'opt-spotter', 'opt-delay'].includes(el.id)) renderBrief();
    else newTarget();
  }));

  document.addEventListener('keydown', (e) => {
    if (L.currentTab !== 'range' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Enter' && e.target.closest('.turret')) { e.target.dispatchEvent(new Event('change')); fire(); }
      return;
    }
    const k = e.key;
    // Enter keeps its normal meaning on a focused button; Space always fires
    if ((tag === 'BUTTON' || tag === 'SUMMARY') && k === 'Enter') return;
    const mult = e.shiftKey ? 5 : 1;
    if (k === 'ArrowUp') nudge('elev', mult);
    else if (k === 'ArrowDown') nudge('elev', -mult);
    else if (k === 'ArrowRight') nudge('wind', mult);
    else if (k === 'ArrowLeft') nudge('wind', -mult);
    else if (k === ' ' || k === 'Enter' || k === 'f' || k === 'F') { if (tag === 'BUTTON') e.target.blur(); fire(); }
    else if (k === 'b' || k === 'B') { if (!e.repeat) holdBreath(); }
    else if (k === 'l' || k === 'L') level();
    else if (k === 'n' || k === 'N') { if (R.stage) startStage(); else newTarget(); }
    else if (k === '0') { setDial('elev', 0); setDial('wind', 0); }
    else return;
    e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { if (e.key === 'b' || e.key === 'B') releaseBreath(); });

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
    const px = (S / 2) / HALF_FOV;
    const toPx = (inches) => toMil(inches, s.yards) * px;

    R.cant += (R.cantTarget - R.cant) * 0.08; // leveling eases in

    let jy = 0, jx = 0;
    if (R.recoilAt && now - R.recoilAt < 260 && !L.reducedMotion()) {
      const k = 1 - (now - R.recoilAt) / 260;
      jy = -S * 0.06 * k * k;
      jx = S * 0.01 * Math.sin(now / 15) * k;
    }
    const sw = sway(now);

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    // The world moves opposite to where the reticle wanders, and tilts against cant
    ctx.translate(cx + jx - sw.x * px, cy + jy + sw.y * px);
    ctx.rotate(-R.cant * Math.PI / 180);
    ctx.translate(-cx, -cy);

    const groundY = Math.min(S * 1.2, cy + toPx(40));
    const sky = ctx.createLinearGradient(0, 0, 0, S);
    sky.addColorStop(0, '#8fb0c6'); sky.addColorStop(1, '#d6e2e6');
    ctx.fillStyle = sky; ctx.fillRect(-S, -S, S * 3, S * 3);

    const treeTop = Math.min(groundY - S * 0.05, S * 0.28);
    ctx.fillStyle = '#3d5a3c';
    ctx.beginPath();
    ctx.moveTo(-S, groundY);
    R.trees.forEach((h, i) => ctx.lineTo(-S * 0.3 + i / (R.trees.length - 1) * S * 1.6, treeTop - h * S * 0.07));
    ctx.lineTo(S * 2, groundY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(30, 50, 32, 0.5)';
    ctx.fillRect(-S, treeTop + S * 0.03, S * 3, groundY - treeTop);

    const ground = ctx.createLinearGradient(0, groundY, 0, S * 1.3);
    ground.addColorStop(0, '#8c7a50'); ground.addColorStop(0.12, '#7c8a4c'); ground.addColorStop(1, '#556236');
    ctx.fillStyle = ground; ctx.fillRect(-S, groundY, S * 3, S * 2);
    ctx.fillStyle = '#9a8657';
    ctx.beginPath(); ctx.ellipse(cx, groundY, toPx(70), toPx(9) + 4, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(40, 55, 25, 0.55)';
    ctx.lineWidth = Math.max(1, S / 400);
    R.tufts.forEach((t) => {
      const x = -S * 0.2 + t.x * S * 1.4, y = groundY + 6 + t.y * (S * 1.1 - groundY);
      const h = t.h * S * 0.018;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h * 0.3, y - h); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.3, y - h); ctx.stroke();
    });

    // Mirage tracks the mid-range crosswind: boils when calm, runs with wind, fades above ~12 mph
    const mid = zoneWind(now, 1);
    const cross = Math.sin(mid.clock * Math.PI / 6) * mid.speed;
    const boil = Math.max(0, 1 - Math.abs(cross) / 3);
    const fade = Math.max(0.15, 1 - Math.abs(cross) / 16);
    R.mirage.forEach((m) => {
      m.x -= cross * 0.00018 * (1 + m.len * 4);
      if (m.x < -0.3) m.x += 1.6;
      if (m.x > 1.3) m.x -= 1.6;
      const y = m.y * S + Math.sin(now / 300 + m.ph) * 2 - boil * ((now / 40 + m.ph * 50) % 20);
      ctx.strokeStyle = `rgba(255,255,255,${(0.05 + 0.05 * Math.sin(now / 500 + m.ph) ** 2) * fade})`;
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

    // misses: spotter rings with shot numbers (shown only when a spotter is calling)
    if (opt('opt-spotter')) {
      ctx.font = `600 ${Math.round(11 * dpr)}px JetBrains Mono, monospace`;
      s.marks.forEach((m, i) => {
        if (m.hit) return;
        const last = i === s.marks.length - 1;
        const x = cx + m.right * px, y = cy - m.up * px;
        ctx.strokeStyle = last ? '#ef4444' : 'rgba(239,68,68,0.5)';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(x, y, (last ? 6 : 4.5) * dpr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = last ? '#ef4444' : 'rgba(239,68,68,0.6)';
        ctx.fillText(String(m.n), x + 8 * dpr, y - 7 * dpr);
      });
    }

    R.puffs = R.puffs.filter((p) => now - p.t0 < 1300);
    R.puffs.forEach((p) => {
      const k = (now - p.t0) / 1300;
      const x = cx + p.right * px, y = cy - p.up * px;
      const r = (8 + k * 34) * dpr;
      ctx.fillStyle = p.hit ? `rgba(255,240,200,${0.7 * (1 - k)})` : `rgba(150,120,80,${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(x, y - k * 10 * dpr, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // --- mil reticle (fixed to the scope)
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = 'rgba(10,10,10,0.92)';
    ctx.fillStyle = 'rgba(10,10,10,0.92)';
    const edge = HALF_FOV * 0.82 * px;
    ctx.lineWidth = 4 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(cx - edge, cy);
    ctx.moveTo(S, cy); ctx.lineTo(cx + edge, cy);
    ctx.moveTo(cx, S); ctx.lineTo(cx, cy + edge);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(cx - edge, cy); ctx.lineTo(cx + edge, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, cy + edge);
    ctx.stroke();
    ctx.font = `600 ${Math.round(10 * dpr)}px JetBrains Mono, monospace`;
    for (let v = 0.5; v < HALF_FOV * 0.82; v += 0.5) {
      const major = v % 1 === 0;
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
    ctx.fillText('MIL', 12 * dpr, cy - 10 * dpr);

    const vg = ctx.createRadialGradient(cx, cy, S * 0.36, cx, cy, S * 0.5);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);

    // scope-mounted bubble level: the bubble floats to the high side
    if (opt('opt-cant')) {
      const vw = S * 0.2, vh = S * 0.035, vx = cx - vw / 2, vy = S * 0.83;
      ctx.fillStyle = 'rgba(20,30,20,0.85)';
      ctx.beginPath(); ctx.roundRect(vx - 4 * dpr, vy - 4 * dpr, vw + 8 * dpr, vh + 8 * dpr, 8 * dpr); ctx.fill();
      ctx.fillStyle = Math.abs(R.cant) < 0.5 ? '#c7e86b' : '#e8c36b';
      ctx.beginPath(); ctx.roundRect(vx, vy, vw, vh, vh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(cx - vh * 0.7, vy); ctx.lineTo(cx - vh * 0.7, vy + vh); ctx.moveTo(cx + vh * 0.7, vy); ctx.lineTo(cx + vh * 0.7, vy + vh); ctx.stroke();
      const bx = cx - Math.max(-1, Math.min(1, R.cant / 4)) * (vw / 2 - vh / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.ellipse(bx, vy + vh / 2, vh * 0.6, vh * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawFlags(now) {
    const dpr = fitCanvas(flags);
    const W = flags.width, H = flags.height;
    if (!W || !R.world) return;
    const ctx = fctx;
    ctx.clearRect(0, 0, W, H);
    const spots = [{ x: 0.16, k: 1, z: 0, name: 'NEAR' }, { x: 0.5, k: 0.82, z: 1, name: 'MID' }, { x: 0.82, k: 0.66, z: 2, name: 'FAR' }];
    spots.forEach((sp) => {
      const w = zoneWind(now, sp.z);
      const sinC = Math.sin(w.clock * Math.PI / 6);
      const baseX = sp.x * W;
      const groundY = H * 0.72;
      const topY = groundY - H * 0.6 * sp.k;
      ctx.strokeStyle = '#3b3b3b';
      ctx.lineWidth = 2 * dpr * sp.k;
      ctx.beginPath(); ctx.moveTo(baseX, groundY); ctx.lineTo(baseX, topY); ctx.stroke();
      const sp01 = Math.min(1, w.speed / 18);
      const droop = (1 - sp01) * 1.25;
      const dir = sinC > 0.05 ? -1 : sinC < -0.05 ? 1 : (Math.cos(w.clock * Math.PI / 6) > 0 ? 1 : -1);
      const len = W * 0.12 * sp.k * Math.max(0.3, Math.abs(sinC));
      const wid = 12 * dpr * sp.k;
      const n = 12;
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const q = i / n;
        const wave = Math.sin(now / (110 - sp01 * 50) - q * 6 + sp.z * 2.4) * q * 4 * dpr * (0.4 + sp01);
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
  }

  function frame(now) {
    if (L.currentTab === 'range' && R.s) {
      if (R.flight) {
        const k = Math.min(1, (now - R.flight.start) / R.flight.tof);
        $('#flight-bar').style.width = (k * 100) + '%';
        setHud(`Bullet in flight · ${((now - R.flight.start) / 1000).toFixed(2)} s`);
        if (k >= 1) land();
      }
      if (R.stage && R.stage.start && !R.stage.over) {
        const t = (now - R.stage.start) / 1000;
        $('#scope-stage').textContent = `T${R.stage.i + 1}/${R.stage.targets.length} · ${t.toFixed(1)} / ${R.stage.par} s`;
        if (t > R.stage.par && !R.flight) finishStage();
      } else if (R.stage) {
        $('#scope-stage').textContent = R.stage.over ? 'Stage over' : `T${R.stage.i + 1}/${R.stage.targets.length} · clock starts on first shot`;
      }
      if (R.breath.holding) setHud(`Holding breath · ${((now - R.breath.start) / 1000).toFixed(1)} s`);
      if (now - kestrelAt > 1000) renderKestrel(now);
      drawScope(now);
      drawFlags(now);
    }
    requestAnimationFrame(frame);
  }

  function onShown() {
    $$('.turret').forEach((el) => buildDial($('svg', el)));
    $('#your-card-mini').innerHTML = L.cardHtml(L.profile, L.computeCard(L.profile), true);
    if (!R.world || !R.s) newWorld();
    else { setDial('elev', R.dial.elev, true); setDial('wind', R.dial.wind, true); renderBrief(); }
    renderHud();
    if (!R.running) { R.running = true; requestAnimationFrame(frame); }
  }

  // Restore the last preset's toggles
  const savedPreset = L.store.get('range.preset', 'training');
  Object.entries(PRESETS[savedPreset] || PRESETS.training).forEach(([k, v]) => {
    if (k === 'position') $('#opt-position').value = v; else $('#' + k).checked = v;
  });
  if (savedPreset === 'realistic') {
    $('#opt-plate').value = 'random';
    $$('#range-preset button').forEach((b) => b.classList.toggle('on', b.dataset.v === 'realistic'));
  }

  L.onTab('range', onShown);
  // A changed card (e.g. today's weather loaded) keeps the current target
  L.onProfile(() => { if (L.currentTab === 'range') { $('#your-card-mini').innerHTML = L.cardHtml(L.profile, L.computeCard(L.profile), true); } });
})();
