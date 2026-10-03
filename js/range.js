/*
 * Range tab: a range day driven by the real solver.
 *
 *   Setup → Chronograph → Zero → Shoot → Debrief
 *
 * The app plays the RANGE, not the solver: it hands the shooter what a real
 * range hands them (a rangefinder reading, a weather meter, chronograph
 * velocities, splash and steel) and nothing else. Dope lives on the
 * shooter's own paper. The hidden truth (true MV, boresight, cold bore,
 * barrel heat, tracking error, today's air) only comes out in the debrief.
 *
 * Catalogue, environment and drawing live in js/range/*.js; this file is the
 * session flow and the UI. All angles are MIL.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;
  let RANGE = null; // window.LRPS_RANGE, resolved at init (its scripts load after this one)

  const CLICK = 0.1;
  const toMil = (inches, yards) => B.inchesToMil(inches, yards);
  const milIn = (mil, yards) => B.milToInches(mil, yards);
  const fmt1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
  const fmt2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
  const esc = L.escapeHtml;

  // ------------------------------------------------------------ state

  const S = {
    inited: false,
    step: 'setup',
    setup: null,
    toggles: {},
    world: null,
    rifle: null,
    dial: { elev: 0, wind: 0 },   // what the turret reads
    target: null,
    mode: 'kd',
    stage: null,
    chrono: { shots: [] },
    log: [],
    shotNo: 0,
    flight: null,
    puffs: [],
    swing: { t0: 0, amp: 0 },
    cant: 0, cantTarget: 0,
    breath: { holding: false, start: 0, releasedAt: -1e9 },
    recoilAt: 0,
    zoomIdx: 1,
    session: { shots: 0, hits: 0, targets: 0, firstHits: 0, streak: 0, byRange: {} },
    best: L.store.get('range.bestStreak', 0),
    running: false,
    lrfBad: 0,
  };

  const reduced = () => L.reducedMotion();
  const halfFov = () => 125 / zoomX();
  const zoomX = () => (S.rifle ? S.rifle.optic : RANGE.optic(S.setup.optic)).zooms[S.zoomIdx];

  // ------------------------------------------------------------ setup UI

  function option(value, label, selected) {
    return `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  }

  function buildSetupForm() {
    const st = S.setup;
    $('#rig-cart').innerHTML = RANGE.CARTRIDGES.map((c) => option(c.id, c.name, c.id === st.cart)).join('');
    $('#rig-rifle').innerHTML = RANGE.RIFLES.map((r) => option(r.id, r.name, r.id === st.rifle)).join('');
    $('#rig-optic').innerHTML = RANGE.OPTICS.map((o) => option(o.id, o.name, o.id === st.optic)).join('');
    $('#rig-sh').innerHTML = RANGE.SIGHT_HEIGHTS.map((h) => option(h, h.toFixed(1) + '"', +st.sightHeightIn === h)).join('');
    $('#rig-loc').innerHTML = RANGE.LOCATIONS.map((l) => option(l.id, l.name, l.id === st.location)).join('');
    $('#rig-sky').innerHTML = RANGE.SKY.map((s) => option(s.id, s.name, s.id === st.sky)).join('');
    $('#opt-position').innerHTML = RANGE.POSITIONS.map((p) => option(p.id, p.name, p.id === st.position)).join('');
    $('#range-toggles').innerHTML = RANGE.TOGGLES.map(([id, label]) =>
      `<label class="check"><input type="checkbox" id="opt-${id}" data-toggle="${id}"> ${esc(label)}</label>`).join('');
    fillCartridgeDependents();
    $('#rig-zero').value = st.zeroYd;
    applyToggles();
  }

  function fillCartridgeDependents() {
    const st = S.setup;
    const cart = RANGE.cartridge(st.cart);
    const loads = RANGE.loadsFor(cart.id);
    if (!loads.some((l) => l.id === st.load)) st.load = loads[0].id;
    $('#rig-load').innerHTML = loads.map((l) => option(l.id, `${l.brand} ${l.name}`, l.id === st.load)).join('');
    if (!cart.barrels.includes(+st.barrelIn)) st.barrelIn = cart.barrels.includes(24) ? 24 : cart.barrels[Math.floor(cart.barrels.length / 2)];
    $('#rig-barrel').innerHTML = cart.barrels.map((b) => option(b, b + '"', +st.barrelIn === b)).join('');
    if (!cart.twists.includes(+st.twistIn)) st.twistIn = cart.twists[0];
    $('#rig-twist').innerHTML = cart.twists.map((t) => option(t, '1:' + t, +st.twistIn === t)).join('');
    if (cart.id === '22lr' && +st.zeroYd > 100) st.zeroYd = 50;
    $('#rig-zero').value = st.zeroYd;
  }

  function readSetupForm() {
    const st = S.setup;
    st.cart = $('#rig-cart').value;
    st.load = $('#rig-load').value;
    st.barrelIn = +$('#rig-barrel').value;
    st.twistIn = +$('#rig-twist').value;
    st.rifle = $('#rig-rifle').value;
    st.optic = $('#rig-optic').value;
    st.sightHeightIn = +$('#rig-sh').value;
    st.zeroYd = +$('#rig-zero').value;
    st.location = $('#rig-loc').value;
    st.sky = $('#rig-sky').value;
    st.position = $('#opt-position').value;
    L.store.set('range.setup', st);
  }

  function applyToggles() {
    RANGE.TOGGLES.forEach(([id]) => { const el = $('#opt-' + id); if (el) el.checked = !!S.toggles[id]; });
    const n = RANGE.TOGGLES.filter(([id]) => S.toggles[id]).length;
    $('#range-settings-sum').textContent = `· ${n}/${RANGE.TOGGLES.length} on`;
  }

  function readToggles() {
    RANGE.TOGGLES.forEach(([id]) => { S.toggles[id] = $('#opt-' + id).checked; });
    L.store.set('range.toggles', S.toggles);
    const n = RANGE.TOGGLES.filter(([id]) => S.toggles[id]).length;
    $('#range-settings-sum').textContent = `· ${n}/${RANGE.TOGGLES.length} on`;
  }

  function setPreset(name, silent) {
    S.setup.realistic = name === 'realistic';
    S.setup.preset = name;
    S.toggles = Object.assign({}, RANGE.PRESETS[name]);
    L.store.set('range.toggles', S.toggles);
    L.store.set('range.setup', S.setup);
    $$('#range-preset button').forEach((b) => b.classList.toggle('on', b.dataset.v === name));
    applyToggles();
    if (!silent) L.toast(name === 'realistic' ? 'Realistic: real weather, no calls, every effect on' : 'Training: standard-ish day, spotter and wind call on');
  }

  function renderSetupSummary() {
    const st = S.setup;
    const cart = RANGE.cartridge(st.cart), load = RANGE.load(st.load), rifle = RANGE.rifle(st.rifle), optic = RANGE.optic(st.optic);
    const boxMv = RANGE.boxMv(load, st.barrelIn);
    const sg = B.millerStability({ bulletWeightGr: load.bulletGr, bulletDiameterIn: load.diaIn, bulletLengthIn: load.lenIn, twistIn: st.twistIn, muzzleVelocityFps: boxMv, tempF: 59, pressureInHg: 29.92 });
    const sgCls = sg < 1 ? 'bad' : sg < 1.4 ? 'warn' : 'good';
    const sgWord = sg < 1 ? 'unstable' : sg < 1.4 ? 'marginal' : 'stable';
    const std = B.solve({ muzzleVelocityFps: boxMv, bc: load.bc, dragModel: load.dragModel, bulletWeightGr: load.bulletGr, sightHeightIn: st.sightHeightIn, zeroYards: st.zeroYd, windMph: 0 }, [cart.maxYd]).rows[0] || { velocityFps: 0, mach: 0, tofSec: 0, energyFtLb: 0, dropIn: 0 };
    const tile = (l, v, u, cls) => `<div class="tile${cls ? ' ' + cls : ''}"><div class="label">${l}</div><div class="value">${v}<small>${u || ''}</small></div></div>`;
    $('#rig-summary').innerHTML = `
      <div class="card-title"><h3>${esc(cart.name)}</h3><span class="chip">box data · approx.</span></div>
      <div class="rig-line"><b>${esc(load.brand)} ${esc(load.name)}</b> · ${esc(rifle.name)}, ${st.barrelIn}" 1:${st.twistIn} · ${esc(optic.name)} · sight ${(+st.sightHeightIn).toFixed(1)}" · zero ${st.zeroYd} yd</div>
      <div class="tiles rig-tiles">
        ${tile('Box velocity', boxMv, ` fps · ${st.barrelIn}"`)}
        ${tile('Bullet', load.bulletGr, ` gr · ${load.lenIn}"`)}
        ${tile('BC ' + load.dragModel, load.bc.toFixed(3), '')}
        ${tile('Stability Sg', sg.toFixed(2), ' ' + sgWord, 'sg-' + sgCls)}
        ${tile('Typical SD', load.sdFps, ' fps')}
        ${tile('Temp sens.', load.tempSens.toFixed(1), ' fps/°F')}
        ${tile(`Mach @${cart.maxYd}`, std.mach.toFixed(2), std.mach < 1 ? ' subsonic' : std.mach < 1.2 ? ' transonic' : '')}
        ${tile('Rifle weight', rifle.weightLb, ` lb rifle`)}
      </div>
      <p class="hint" style="margin:10px 0 0">${esc(load.src)}. ${esc(cart.note)}<br>
        Box velocity is scaled ${cart.fpsPerIn ? `${cart.fpsPerIn} fps per inch from the ${load.refBarrelIn}" test barrel` : 'flat for rimfire past 16"'}.
        ${sg < 1.4 ? `<b>Sg ${sg.toFixed(2)}: this twist is ${sgWord} for this bullet — expect a lower effective BC and more drift.</b>` : ''}</p>`;
    $('#rig-rifle-desc').textContent = rifle.desc;
    $('#rig-optic-desc').textContent = optic.desc + ` Magnification ${optic.zooms.join(' / ')}×.`;
    const loc = RANGE.location(st.location);
    $('#rig-loc-desc').textContent = loc ? `${loc.terrain} Elevation ${loc.alt} ft, berms to ${loc.maxYd} yd, ${loc.lat}°N.` : '';
  }

  // Zero distance of the rifle in use (setup changes only apply to a new session)
  const zeroYd = () => +((S.rifle && S.rifle.setup) || S.setup).zeroYd || 100;

  function previewWorld() {
    readSetupForm(); readToggles();
    windHist.length = 0;
    S.world = RANGE.newWorld(S.setup, S.toggles);
    renderKestrel(performance.now());
  }

  // ------------------------------------------------------------ steps

  const STEPS = ['setup', 'chrono', 'zero', 'shoot', 'debrief'];

  function setStep(step, enter = true) {
    if (enter && S.flight) { L.toast('Wait for the round to land'); return; }
    S.step = step;
    $('#r-setup').hidden = step !== 'setup';
    $('#r-line').hidden = !(step === 'chrono' || step === 'zero' || step === 'shoot');
    $('#r-debrief').hidden = step !== 'debrief';
    $$('#r-steps button').forEach((b) => {
      const i = STEPS.indexOf(b.dataset.step), cur = STEPS.indexOf(step);
      b.classList.toggle('on', b.dataset.step === step);
      b.classList.toggle('done', i < cur);
      b.disabled = !S.rifle && b.dataset.step !== 'setup';
    });
    // the instruments (weather meter + flags) follow the shooter
    const inst = $('#instruments');
    const slot = step === 'setup' ? $('#setup-instruments-card') : $('#instruments-slot');
    if (inst.parentElement !== slot) slot.appendChild(inst);
    releaseBreath();
    if (enter) {
      if (step === 'chrono') enterChrono();
      else if (step === 'zero') enterZero();
      else if (step === 'shoot') enterShoot();
      else if (step === 'debrief') renderDebrief();
    } else if (step === 'debrief') renderDebrief();
    else if (S.target) renderStation();
    $('#station-next').hidden = step === 'shoot' && S.mode === 'stage' && S.stage && !S.stage.over;
    $('#station-next').textContent = step === 'chrono' ? 'Done → Zero' : step === 'zero' ? 'Zero confirmed → Shoot' : 'End session → Debrief';
    $('#range-new').hidden = step !== 'shoot';
    if (enter) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  }

  function startSession() {
    readSetupForm(); readToggles();
    windHist.length = 0;
    if (!S.world) S.world = RANGE.newWorld(S.setup, S.toggles);
    S.world.start = performance.now();
    S.rifle = RANGE.newRifle(S.setup, S.toggles);
    S.rifle.setup = Object.assign({}, S.setup); // the rifle keeps the zero distance it was zeroed at
    S.log = []; S.shotNo = 0; S.lrfBad = 0;
    S.chrono = { shots: [] };
    S.session = { shots: 0, hits: 0, targets: 0, firstHits: 0, streak: 0, byRange: {} };
    S.stage = null;
    S.mode = 'kd';
    S.zoomIdx = 1;
    S.debriefed = false;
    $('#shot-log tbody').innerHTML = '';
    $('#shot-log-sum').textContent = '';
    setDial('elev', 0, true); setDial('wind', 0, true);
    $$('.turret').forEach((el) => buildDial($('svg', el)));
    setStep('chrono');
    L.sfx.click();
  }

  // ------------------------------------------------------------ targets

  function paperTarget() {
    const y = zeroYd();
    return { yards: y, plateIn: 24, kind: 'paper', shape: 'square', angleDeg: 0, calIn: S.rifle.load.diaIn, marks: [], shotsHere: 0, lrf: null, known: true };
  }

  function setTarget(t) {
    S.target = t;
    S.puffs = [];
    S.swing = { t0: 0, amp: 0 };
    if (S.toggles.cant && S.step === 'shoot') { S.cant = L.gauss() * 2.2; S.cantTarget = S.cant; } else { S.cant = 0; S.cantTarget = 0; }
    renderStation();
    renderHud();
  }

  function enterChrono() {
    setTarget(paperTarget());
    $('#range-feedback').innerHTML = '<span class="hint">Shoot a string over the chronograph. Write down every velocity, the average and the SD.</span>';
  }

  function enterZero() {
    setTarget(paperTarget());
    $('#range-feedback').innerHTML = '<span class="hint">Fire a group, read it against the grid (1" squares) and the reticle, dial the correction, then set zero.</span>';
  }

  function enterShoot() {
    if (S.mode === 'stage') startStage();
    else if (S.mode === 'ukd') newUkdTarget();
    else newKdTarget(kdLanes()[Math.min(2, kdLanes().length - 1)].yards);
  }

  function kdLanes() {
    const cart = S.rifle.cart;
    return RANGE.kdLanes(cart, S.world.loc.maxYd);
  }

  function newKdTarget(yards) {
    const lane = kdLanes().find((l) => l.yards === yards) || kdLanes()[0];
    setTarget({ yards: lane.yards, plateIn: lane.plateIn, kind: 'steel', shape: lane.yards % 200 === 0 ? 'square' : 'round', angleDeg: 0, marks: [], shotsHere: 0, lrf: { yards: lane.yards, angleDeg: 0, bad: false }, known: true });
    $('#range-feedback').innerHTML = '<span class="hint">Known distance. Dial from your paper, read the wind, send it.</span>';
  }

  function newUkdTarget() {
    const cart = S.rifle.cart;
    const far = Math.min(cart.maxYd, S.world.loc.maxYd);
    const near = cart.id === '22lr' ? 40 : 250;
    const yards = Math.round(L.rand(near, far) / 5) * 5;
    const plates = cart.id === '22lr' ? [2, 3, 4, 4, 6, 8] : [8, 10, 12, 12, 14, 16, 18, 20];
    const angle = S.toggles.angle ? Math.round(RANGE.clamp(L.gauss() * 7, -20, 20)) : 0;
    setTarget({ yards, plateIn: L.pick(plates), kind: 'steel', shape: Math.random() < 0.3 ? 'square' : 'round', angleDeg: angle, marks: [], shotsHere: 0, lrf: null, known: false });
    $('#range-feedback').innerHTML = `<span class="hint">${S.toggles.lrf ? 'Lase it (R), then dial from your paper.' : 'No rangefinder: mil the plate, work out the range on paper, then dial.'}</span>`;
  }

  function nextTarget() {
    if (S.step !== 'shoot' || S.flight) return;
    if (S.mode === 'stage') startStage();
    else if (S.mode === 'ukd') newUkdTarget();
    else {
      const lanes = kdLanes();
      const i = lanes.findIndex((l) => l.yards === S.target.yards);
      newKdTarget(lanes[(i + 1) % lanes.length].yards);
    }
    L.sfx.click();
  }

  function lase() {
    const t = S.target;
    if (!t || S.step !== 'shoot' || S.flight || !S.toggles.lrf || t.known || t.stage) return;
    const r = RANGE.lase(t, S.toggles);
    if (r.bad) S.lrfBad++;
    t.lrf = r;
    t.lases = (t.lases || 0) + 1;
    L.sfx.click();
    renderStation();
    const el = $('#lrf-num');
    if (el && !reduced()) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  // ------------------------------------------------------------ station panel

  function renderStation() {
    const t = S.target;
    const box = $('#station');
    if (!t) { box.innerHTML = ''; return; }
    if (S.step === 'chrono') box.innerHTML = chronoHtml();
    else if (S.step === 'zero') box.innerHTML = zeroHtml();
    else box.innerHTML = shootHtml();
    renderStage();
    bindStation();
  }

  function chronoHtml() {
    const sh = S.chrono.shots;
    const st = RANGE.stats(sh);
    const last = sh.length ? sh[sh.length - 1] : null;
    return `
      <div class="chrono">
        <div class="k-head"><span>CHRONOGRAPH</span><span>${S.setup.zeroYd} yd paper · ${esc(S.rifle.load.brand)} ${esc(S.rifle.load.name)}</span></div>
        <div class="chrono-big">${last != null ? last : '— — — —'}<small>fps</small></div>
        <div class="chrono-list">${sh.map((v, i) => `<span><i>${i + 1}</i>${v}</span>`).join('') || '<span class="hint">no shots yet</span>'}</div>
        <div class="chrono-stats">
          <div><small>n</small><b>${st.n}</b></div>
          <div><small>avg</small><b>${st.n ? Math.round(st.avg) : '–'}</b></div>
          <div><small>SD</small><b>${st.n > 1 ? st.sd.toFixed(1) : '–'}</b></div>
          <div><small>ES</small><b>${st.n > 1 ? st.es : '–'}</b></div>
        </div>
        <div class="actions" style="margin-top:8px"><button type="button" class="btn" id="chrono-clear">Clear string</button></div>
      </div>
      <p class="hint" style="margin:10px 0 0">Air ${S.world.tempF}°F · ammo ${S.world.ammoInShade ? 'in the shade' : S.toggles.sun ? 'in the sun' : 'at air temperature'}.
        A 5-shot string gives a rough average; 10 shots gives a usable SD. Your box says ${S.rifle.boxMv} fps.</p>`;
  }

  function zeroHtml() {
    const marks = S.target.marks;
    let group = '';
    if (marks.length >= 2) {
      const n = marks.length;
      const cu = marks.reduce((a, m) => a + toMil(m.upIn, S.target.yards), 0) / n;
      const cr = marks.reduce((a, m) => a + toMil(m.rightIn, S.target.yards), 0) / n;
      let maxD = 0;
      marks.forEach((a) => marks.forEach((b) => { maxD = Math.max(maxD, Math.hypot(a.upIn - b.upIn, a.rightIn - b.rightIn)); }));
      group = S.toggles.spotter
        ? `<div class="tiles" style="grid-template-columns:1fr 1fr 1fr"><div class="tile"><div class="label">Group</div><div class="value">${toMil(maxD, S.target.yards).toFixed(2)}<small>mil</small></div></div>
           <div class="tile"><div class="label">Centre ↑</div><div class="value">${fmt2(cu)}<small>mil</small></div></div>
           <div class="tile"><div class="label">Centre →</div><div class="value">${fmt2(cr)}<small>mil</small></div></div></div>`
        : `<div class="tiles" style="grid-template-columns:1fr"><div class="tile"><div class="label">Group</div><div class="value">${toMil(maxD, S.target.yards).toFixed(2)}<small>mil · ${maxD.toFixed(2)}"</small></div></div></div>`;
    }
    return `
      <div class="k-head"><span>ZERO TARGET</span><span>${S.setup.zeroYd} yd · 1" grid</span></div>
      ${group || '<p class="hint" style="margin:0">Shots on paper so far: ' + marks.length + '</p>'}
      <ol class="zero-steps">
        <li>Fire 3–5 rounds at the diamond.</li>
        <li>Read the group centre: <b>1" = ${toMil(1, S.setup.zeroYd).toFixed(2)} mil</b> at ${S.setup.zeroYd} yd.</li>
        <li>Dial the opposite: group high → come down, group left → come right.</li>
        <li>Confirm with a shot, then <b>Set zero</b> to slip the turrets to 0.0.</li>
      </ol>
      <div class="actions"><button type="button" class="btn" id="zero-set">Set zero (slip turrets)</button><button type="button" class="btn" id="zero-paper">Fresh paper</button></div>
      <p class="hint" style="margin:8px 0 0">Turrets slipped so far: elev ${fmt1(S.rifle.slip.elev)} · wind ${fmt1(S.rifle.slip.wind)} from mechanical zero.</p>`;
  }

  function shootHtml() {
    const t = S.target;
    const lanes = kdLanes();
    const modeSeg = `<div class="seg r-mode" id="range-mode">
        <button type="button" data-v="kd"${S.mode === 'kd' ? ' class="on"' : ''}>Known</button>
        <button type="button" data-v="ukd"${S.mode === 'ukd' ? ' class="on"' : ''}>Unknown</button>
        <button type="button" data-v="stage"${S.mode === 'stage' ? ' class="on"' : ''}>Stage</button></div>`;
    let picker = '';
    if (S.mode === 'kd') {
      picker = `<div class="lanes">${lanes.map((l) => `<button type="button" class="lane${l.yards === t.yards ? ' on' : ''}" data-yd="${l.yards}">${l.yards}<small>${l.plateIn}"</small></button>`).join('')}</div>`;
    }
    const lrfOn = S.toggles.lrf && S.mode !== 'stage';
    let rf;
    if (t.known) rf = `<div class="range-num">${t.yards}<small> yd</small></div><div class="hint">Known distance · berm sign</div>`;
    else if (t.stage) rf = `<div class="range-num">${t.lrf.yards}<small> yd</small></div><div class="hint">Lased in prep${t.angleDeg ? ` · ${t.angleDeg > 0 ? '▲' : '▼'} ${Math.abs(t.angleDeg)}°` : ' · flat'}</div>`;
    else if (!lrfOn) rf = `<div class="range-num">?<small> mil it</small></div><div class="hint">No rangefinder · plate is <b>${t.plateIn}"</b> ${t.shape}${t.angleDeg ? ` · ${t.angleDeg > 0 ? '▲' : '▼'}${Math.abs(t.angleDeg)}° incline` : ''}</div>`;
    else if (!t.lrf) rf = `<div class="range-num" id="lrf-num">— — —<small> yd</small></div><div class="hint">Press <b>Lase</b> (R)</div>`;
    else rf = `<div class="range-num${t.lrf.bad ? ' bad' : ''}" id="lrf-num">${t.lrf.yards}<small> yd</small></div><div class="hint">${t.lrf.angleDeg ? `${t.lrf.angleDeg > 0 ? '▲' : '▼'} ${Math.abs(t.lrf.angleDeg)}° · cos ${Math.cos(t.lrf.angleDeg * Math.PI / 180).toFixed(3)}` : 'Flat · 0°'} · reading ${t.lases || 1}</div>`;
    const windCall = S.toggles.windCall ? RANGE.windCallText(S.world) : 'None — read the flags, mirage and meter';
    const plateMil = t.known || t.stage ? toMil(t.plateIn, t.yards).toFixed(2) + ' mil' : (lrfOn ? 'steel' : 'mil it');
    return `
      ${modeSeg}${picker}
      <div class="brief">
        <div class="tile wide lrf-tile"><div class="label">${t.known ? 'Distance' : t.stage ? 'Stage brief' : lrfOn ? 'Laser rangefinder' : 'Rangefinder unavailable'}</div>${rf}
          ${!t.known && !t.stage && lrfOn ? '<button type="button" class="btn lase-btn" id="lase-btn">Lase</button>' : ''}</div>
        <div class="tile wide"><div class="label">Wind call</div><div class="brief-wind">${esc(windCall)}</div></div>
        <div class="tile"><div class="label">Plate</div><div class="value" style="font-size:17px">${t.plateIn}"<small> ${plateMil}</small></div></div>
        <div class="tile"><div class="label">Position</div><div class="brief-pos">${esc(RANGE.position(S.setup.position).name)}</div></div>
      </div>`;
  }

  function bindStation() {
    const cc = $('#chrono-clear'); if (cc) cc.addEventListener('click', () => { S.chrono.shots = []; renderStation(); L.sfx.click(); });
    const zs = $('#zero-set'); if (zs) zs.addEventListener('click', setZero);
    const zp = $('#zero-paper'); if (zp) zp.addEventListener('click', () => { S.target.marks = []; S.target.shotsHere = 0; renderStation(); L.sfx.click(); });
    const lb = $('#lase-btn'); if (lb) lb.addEventListener('click', lase);
    const seg = $('#range-mode');
    if (seg) L.seg(seg, (v) => { if (S.flight) { L.toast('Wait for the round to land'); return; } S.mode = v; S.stage = null; enterShoot(); $('#station-next').hidden = v === 'stage'; });
    $$('.lane').forEach((b) => b.addEventListener('click', () => { if (S.flight) return; newKdTarget(+b.dataset.yd); L.sfx.click(); }));
  }

  function setZero() {
    const r = S.rifle;
    r.slip.elev += S.dial.elev;
    r.slip.wind += S.dial.wind;
    S.dial.elev = 0; S.dial.wind = 0;
    setDial('elev', 0, true); setDial('wind', 0, true);
    L.sfx.click();
    L.toast('Turrets slipped: this is now 0.0 / 0.0');
    renderStation();
  }

  // ------------------------------------------------------------ instruments

  let kestrelAt = 0;
  const windHist = [];
  function renderKestrel(now) {
    const w = S.world;
    if (!w) return;
    RANGE.tickWind(w, now);
    const near = RANGE.zoneWind(w, now, 0);
    windHist.push(near.speed);
    if (windHist.length > 20) windHist.shift();
    const avg = windHist.reduce((a, b) => a + b, 0) / windHist.length;
    const max = Math.max.apply(null, windHist);
    const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(w.azimuthDeg / 45) % 8];
    const box = $('#kestrel');
    if (!$('.k-grid', box)) {
      box.innerHTML = `<div class="k-head"><span>WEATHER METER</span><span class="k-loc"></span></div><div class="k-grid"></div>`;
    }
    $('.k-loc', box).textContent = `${w.loc.name} · ${w.sky.name}`;
    $('.k-grid', box).innerHTML = `
        <div><small>Temp</small><b>${w.tempF}°F</b></div>
        <div><small>Station</small><b>${w.stationPressureInHg.toFixed(2)}"</b></div>
        <div><small>Humidity</small><b>${w.humidityPct}%</b></div>
        <div><small>DA</small><b>${Math.round(w.atm.densityAltitudeFt)} ft</b></div>
        <div><small>Wind</small><b>${near.speed.toFixed(1)} mph</b></div>
        <div><small>Avg / max</small><b>${avg.toFixed(1)} / ${max.toFixed(1)}</b></div>
        <div><small>From</small><b>${RANGE.toClockHalf(near.dirDeg)} o'clock</b></div>
        <div><small>Azimuth</small><b>${w.azimuthDeg}° ${dir} · ${w.latitudeDeg}°N</b></div>`;
    kestrelAt = now;
  }

  function renderHud() {
    const ss = S.session;
    const tile = (l, v) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div></div>`;
    let html;
    if (S.step === 'chrono') {
      const st = RANGE.stats(S.chrono.shots);
      html = tile('String', st.n) + tile('Average', st.n ? Math.round(st.avg) : '–') + tile('SD', st.n > 1 ? st.sd.toFixed(1) : '–') + tile('ES', st.n > 1 ? st.es : '–') + tile('Rounds', S.rifle.rounds);
    } else if (S.step === 'zero') {
      html = tile('On paper', S.target ? S.target.marks.length : 0) + tile('Elev dial', S.dial.elev.toFixed(1)) + tile('Wind dial', S.dial.wind.toFixed(1)) + tile('Rounds', S.rifle.rounds) + tile('Zoom', zoomX() + '×');
    } else {
      const pct = ss.shots ? Math.round(ss.hits / ss.shots * 100) + '%' : '–';
      html = tile('Shots', ss.shots) + tile('Hits', ss.hits) + tile('Hit %', pct) +
        tile('1st-round', `${ss.firstHits}/${Math.max(0, ss.targets - (S.target && !S.target.shotsHere ? 1 : 0))}`) +
        tile('Streak', `${ss.streak}<small>best ${S.best}</small>`);
    }
    $('#range-hud').innerHTML = html;
  }

  // ------------------------------------------------------------ stage

  function startStage() {
    S.stage = null;
    const lanes = kdLanes();
    const far = lanes[lanes.length - 1].yards, near = Math.max(lanes[0].yards, S.rifle.cart.id === '22lr' ? 40 : 250);
    const n = 5;
    const yards = Array.from({ length: n }, (_, i) => Math.round((near + (far - near) * (i + L.rand(0.1, 0.9)) / n) / 5) * 5);
    S.stage = {
      targets: yards.map((y) => ({ yards: y, plateIn: RANGE.platesFor(S.rifle.cart, y) + L.pick([0, 2, 4]), angleDeg: S.toggles.angle ? Math.round(RANGE.clamp(L.gauss() * 6, -15, 15)) : 0, result: null })),
      i: 0, start: 0, par: 150, over: false,
    };
    goStageTarget(0);
    $('#range-feedback').innerHTML = `<div class="verdict">STAGE READY</div><div>${n} targets, one shot each, ${S.stage.par} s par. Distances were lased during prep. The clock starts on your first shot.</div>`;
    $('#station-next').hidden = true;
  }

  function goStageTarget(i) {
    const st = S.stage;
    st.i = i;
    const t = st.targets[i];
    setTarget({ yards: t.yards, plateIn: t.plateIn, kind: 'steel', shape: 'round', angleDeg: t.angleDeg, marks: [], shotsHere: 0, lrf: { yards: t.yards, angleDeg: t.angleDeg, bad: false }, known: false, stage: true });
  }

  function renderStage() {
    const st = S.stage;
    const box = $('#stage-list');
    $('#range-new').textContent = st && S.mode === 'stage' ? 'Restart stage' : 'Next target';
    if (!st || S.mode !== 'stage' || S.step !== 'shoot') { box.innerHTML = ''; $('#scope-stage').textContent = ''; return; }
    box.innerHTML = `<div class="stage-list"><div class="k-head"><span>STAGE · ${st.targets.length} TARGETS</span><span>par ${st.par} s</span></div>
      ${st.targets.map((t, i) => `<div class="st-row${i === st.i && !st.over ? ' on' : ''}">
        <span class="st-n">T${i + 1}</span><span>${t.yards} yd${t.angleDeg ? ` ${t.angleDeg > 0 ? '▲' : '▼'}${Math.abs(t.angleDeg)}°` : ''}</span><span>${t.plateIn}"</span>
        <span class="st-r ${t.result === true ? 'hit' : t.result === false ? 'miss' : ''}">${t.result === true ? 'HIT' : t.result === false ? 'MISS' : i === st.i && !st.over ? '◀' : ''}</span></div>`).join('')}</div>`;
  }

  function stageShotLanded(hit) {
    const st = S.stage;
    st.targets[st.i].result = hit;
    renderStage();
    const next = st.i + 1;
    if (next < st.targets.length && !st.over) setTimeout(() => { if (S.stage === st && !st.over) goStageTarget(next); }, 1100);
    else finishStage();
  }

  function finishStage() {
    const st = S.stage;
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
      <div class="actions"><button type="button" class="btn primary" id="stage-again">Run another stage</button></div>`;
    $('#stage-again').addEventListener('click', startStage);
    $('#station-next').hidden = false;
    if (hits === st.targets.length) { L.confetti(); L.sfx.good(); }
    L.addXp(xp, 'stage complete');
  }

  // ------------------------------------------------------------ turrets

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
    const travel = S.rifle ? S.rifle.optic.travelMil : 30;
    const v = +B.roundToClick(RANGE.clamp(value, axis === 'elev' ? -5 : -travel / 2, axis === 'elev' ? travel : travel / 2), CLICK).toFixed(1);
    const prev = S.dial[axis];
    S.dial[axis] = v;
    const el = $(`.turret[data-axis="${axis}"]`);
    $('input', el).value = v.toFixed(1);
    $('input', el).step = CLICK;
    const clicks = Math.round(v / CLICK);
    $('.ring', el).style.transform = `rotate(${-clicks * 3.6}deg)`;
    const dirWord = axis === 'elev' ? (v > 0 ? 'UP' : v < 0 ? 'DOWN' : 'MIL') : (v > 0 ? 'RIGHT' : v < 0 ? 'LEFT' : 'MIL');
    const rev = axis === 'elev' && Math.abs(clicks) >= 100 ? ` · rev ${Math.floor(Math.abs(clicks) / 100) + 1}` : '';
    $('.dial-value', el).innerHTML = `<div>${Math.abs(v).toFixed(1)}<small>${dirWord + rev}</small></div>`;
    if (!silent && v !== prev) {
      L.sfx.click();
      if (!reduced()) { const d = $('.dial', el); d.classList.remove('tick'); void d.offsetWidth; d.classList.add('tick'); }
    }
    if (S.step === 'zero') renderHud();
  }

  function nudge(axis, clicks) { setDial(axis, S.dial[axis] + clicks * CLICK); }

  // ------------------------------------------------------- the shooter

  function level() {
    if (!S.toggles.cant) return;
    S.cantTarget = L.gauss() * 0.25;
    L.sfx.click();
  }

  function breathFactor(now) {
    const b = S.breath;
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
    if (S.breath.holding) return;
    S.breath.holding = true;
    S.breath.start = performance.now();
    $('#breath-btn').classList.add('on');
  }
  function releaseBreath(now) {
    if (!S.breath.holding) return;
    S.breath.holding = false;
    S.breath.releasedAt = now || performance.now();
    $('#breath-btn').classList.remove('on');
  }

  // Reticle sway in MIL: figure-8 wobble + breathing, scaled by position; bench-steady at the chrono/zero stations
  function sway(now) {
    const pos = RANGE.position(S.setup.position);
    const A = S.step === 'shoot' ? pos.wobble : Math.min(pos.wobble, 0.06);
    if (reduced()) return { x: 0, y: 0 };
    const t = now / 1000;
    const f = breathFactor(now);
    const breathing = S.breath.holding ? 0 : Math.sin(t * 2 * Math.PI / 4.2) * 0.8;
    const x = A * f * (0.6 * Math.sin(1.3 * t + 0.7) + 0.25 * Math.sin(3.1 * t));
    const y = A * (f * (0.45 * Math.sin(2.1 * t + 1.9) + 0.2 * Math.sin(4.3 * t)) + breathing) + A * 0.08 * Math.max(0, Math.sin(t * 7.5)) ** 8;
    return { x, y };
  }

  // ------------------------------------------------------------- fire

  function solveShot(extra) {
    const r = S.rifle, w = S.world, t = S.target;
    const adv = !!S.toggles.adv;
    return B.solve(Object.assign({}, r.solverBase, {
      tempSensitivity: 0, mvTempF: null,
      altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, stationPressureInHg: w.stationPressureInHg,
      shotAngleDeg: t.angleDeg,
      zeroAngleRad: r.zeroAngleRad,
      spinDrift: adv, aeroJump: adv, coriolis: adv,
      latitudeDeg: w.latitudeDeg, azimuthDeg: w.azimuthDeg,
    }, extra), [t.yards]).rows[0];
  }

  /* Where the turrets really put the line of sight, including cant, tracking and boresight. */
  function turretOffsets(dialE, dialW) {
    const r = S.rifle;
    const effE = (dialE + r.slip.elev) * (1 + r.trackErr);
    const effW = (dialW + r.slip.wind) * (1 + r.trackErr);
    const th = S.cant * Math.PI / 180;
    const c = Math.cos(th), s = Math.sin(th);
    return {
      up: effE * c - effW * s + r.boreE * c - r.boreW * s,
      right: effW * c + effE * s + r.boreW * c + r.boreE * s,
    };
  }

  function fire() {
    const t = S.target;
    if (!t || S.flight || !S.rifle || (S.stage && S.mode === 'stage' && S.step === 'shoot' && S.stage.over)) return;
    // One round per stage target: a second press during the advance delay is ignored
    if (S.step === 'shoot' && S.mode === 'stage' && S.stage && S.stage.targets[S.stage.i] && S.stage.targets[S.stage.i].result != null) return;
    if (S.step === 'shoot' && S.mode === 'stage' && S.stage && !S.stage.start) S.stage.start = performance.now();
    const now = performance.now();
    const w = RANGE.pathWind(S.world, now, t.yards);
    const sb = RANGE.shotBallistics(S.rifle, S.world, S.toggles, now);
    const row = solveShot({ muzzleVelocityFps: sb.mv, windMph: w.speed, windClock: w.clock });
    if (!row) { L.toast('That load cannot reach this target'); return; }
    const pos = RANGE.position(S.setup.position);
    const to = turretOffsets(S.dial.elev, S.dial.wind);
    const sw = sway(now);
    const sig = sb.sigmaMil;
    const up = toMil(row.dropIn, t.yards) + to.up + sb.dE + sw.y + L.gauss() * (pos.trigger + sig);
    const right = toMil(row.windIn, t.yards) + to.right + sb.dW + sw.x + L.gauss() * (pos.trigger + sig);
    const upIn = milIn(up, t.yards), rightIn = milIn(right, t.yards);
    let hit;
    if (t.kind === 'paper') hit = Math.abs(upIn) <= 15 && Math.abs(rightIn) <= 12;
    else hit = t.shape === 'square' ? Math.max(Math.abs(upIn), Math.abs(rightIn)) <= t.plateIn / 2 : Math.hypot(upIn, rightIn) <= t.plateIn / 2;

    RANGE.recordShot(S.rifle, now);
    S.flight = { start: now, tof: row.tofSec * 1000, up, right, upIn, rightIn, hit, dialE: S.dial.elev, dialW: S.dial.wind, mv: sb.mv, wind: w, cold: sb.coldBore, heat: sb.heat, powderT: sb.powderT, target: t, step: S.step };
    $('#fire-btn').disabled = true;
    L.sfx.shot();
    S.recoilAt = now;
    releaseBreath(now);
  }

  function land() {
    const f = S.flight, t = f.target || S.target;
    S.flight = null;
    $('#fire-btn').disabled = false;
    $('#flight-bar').style.width = '0';
    const first = t.shotsHere === 0;
    if (first && f.step === 'shoot' && t.kind === 'steel') S.session.targets++;
    t.shotsHere++;
    S.shotNo++;
    const mark = { up: f.up, right: f.right, upIn: f.upIn, rightIn: f.rightIn, hit: f.hit, n: S.shotNo, paper: t.kind === 'paper' };
    t.marks.push(mark);
    const entry = { n: S.shotNo, station: S.step, yards: t.yards, angleDeg: t.angleDeg, dialE: f.dialE, dialW: f.dialW, up: f.up, right: f.right, hit: f.hit, mv: f.mv, wind: f.wind, cold: f.cold, heat: f.heat, powderT: f.powderT, lrf: t.lrf ? t.lrf.yards : null, plateIn: t.plateIn, kind: t.kind, known: !!t.known, stage: !!t.stage };
    S.log.push(entry);

    if (f.step === 'chrono') landChrono(entry);
    else if (f.step === 'zero') landZero(entry);
    else landSteel(entry, first);
    logRow(entry);
    renderHud();
  }

  function landChrono(e) {
    if (!e.hit) S.puffs.push({ up: e.up, right: e.right, t0: performance.now(), hit: false });
    const v = RANGE.chronoRead(e.mv);
    S.chrono.shots.push(v);
    e.chrono = v;
    L.sfx.click();
    renderStation();
    const st = RANGE.stats(S.chrono.shots);
    $('#range-feedback').innerHTML = `<div class="verdict">${v} <small>fps</small></div><div class="hint">Shot ${st.n}${st.n > 1 ? ` · avg ${Math.round(st.avg)} · SD ${st.sd.toFixed(1)} · ES ${st.es}` : ''}. Write it down.</div>`;
    setHud(`${v} fps`, 1200);
  }

  function landZero(e) {
    if (!e.hit) S.puffs.push({ up: e.up, right: e.right, t0: performance.now(), hit: false });
    renderStation();
    const call = S.toggles.spotter ? `Spotter: <b class="mono">${e.up >= 0 ? 'high' : 'low'} ${Math.abs(e.up).toFixed(1)}</b>, <b class="mono">${e.right >= 0 ? 'right' : 'left'} ${Math.abs(e.right).toFixed(1)}</b>.` : (e.hit ? 'On paper. Read it against the grid.' : 'Off the paper. Look wider, or check the turrets.');
    e.call = S.toggles.spotter ? `${fmt1(e.up)} / ${fmt1(e.right)}` : '';
    $('#range-feedback').innerHTML = `<div class="verdict ${e.hit ? '' : 'miss'}">${e.hit ? 'ON PAPER' : 'OFF PAPER'}</div><div>${call}</div>`;
    setHud(e.hit ? 'Paper' : 'Off paper', 900);
  }

  function landSteel(e, first) {
    const t = S.target, ss = S.session;
    ss.shots++;
    const br = (ss.byRange[t.yards] = ss.byRange[t.yards] || { shots: 0, hits: 0, dialE: [], dialW: [], ups: [], rights: [], angleDeg: t.angleDeg });
    br.shots++; br.dialE.push(e.dialE); br.dialW.push(e.dialW); br.ups.push(e.up); br.rights.push(e.right);
    S.puffs.push({ up: e.up, right: e.right, t0: performance.now(), hit: e.hit });
    const soundDelay = S.toggles.delay ? t.yards / RANGE.soundYps(S.world) : 0;
    if (e.hit) {
      ss.hits++; ss.streak++; br.hits++;
      if (ss.streak > S.best) { S.best = ss.streak; L.store.set('range.bestStreak', S.best); }
      S.swing = { t0: performance.now(), amp: 0.22 + Math.min(0.2, t.plateIn / 120) };
      if (first) ss.firstHits++;
      L.sfx.ding(soundDelay);
      setHud(`Impact · ding in ${soundDelay.toFixed(1)} s`, soundDelay * 1000 + 900);
      const xp = 10 + Math.floor(t.yards / 100) + (first ? 15 : 0) + (ss.streak >= 3 ? 5 : 0) + (S.toggles.spotter ? 0 : 5) + (t.known ? 0 : 5);
      setTimeout(() => {
        L.addXp(xp, first ? 'first-round hit!' : 'hit');
        if (first && S.mode !== 'stage') {
          const r = $('#scope').getBoundingClientRect();
          L.confetti(r.left + r.width / 2, r.top + r.height / 2);
        }
      }, soundDelay * 1000);
    } else {
      ss.streak = 0;
      L.sfx.thud(soundDelay * 0.6);
      setHud('Miss · read the splash', 1200);
    }
    const visible = Math.abs(e.up) < halfFov() && Math.abs(e.right) < halfFov();
    let detail;
    if (S.toggles.spotter) {
      const corrE = B.roundToClick(e.dialE - e.up, CLICK);
      const corrW = B.roundToClick(e.dialW - e.right, CLICK);
      e.call = `${fmt1(e.up)} / ${fmt1(e.right)}`;
      detail = `<div>Spotter: <b class="mono">${e.up >= 0 ? 'high' : 'low'} ${Math.abs(e.up).toFixed(1)}</b>, <b class="mono">${e.right >= 0 ? 'right' : 'left'} ${Math.abs(e.right).toFixed(1)}</b>.</div>
        ${e.hit ? '' : `<div class="hint" style="margin-top:4px">Correct to elev <b class="mono">${corrE.toFixed(1)}</b>, wind <b class="mono">${corrW.toFixed(1)}</b> — then write what worked.</div>`}`;
    } else {
      e.call = '';
      detail = e.hit ? '<div>Steel rang. Write the dope that worked.</div>'
        : `<div>${visible ? 'Splash on the berm — read it against the reticle before it settles.' : 'No splash seen in the scope. Check the revolution, the range and the wind.'}</div>`;
    }
    $('#range-feedback').innerHTML = `<div class="verdict ${e.hit ? 'hit' : 'miss'}">${e.hit ? (first ? 'FIRST-ROUND HIT' : 'HIT') : 'MISS'}</div>${detail}`;
    if (S.mode === 'stage' && S.stage) stageShotLanded(e.hit);
  }

  function logRow(e) {
    const tr = document.createElement('tr');
    const station = e.station === 'chrono' ? 'Chrono' : e.station === 'zero' ? 'Zero' : (e.stage ? 'Stage' : e.known ? 'KD' : 'UKD');
    const result = e.station === 'chrono' ? `${e.chrono} fps` : e.station === 'zero' ? (e.hit ? 'paper' : 'off') : (e.hit ? 'hit' : 'miss');
    const cls = e.station === 'chrono' ? 'var(--info)' : e.hit ? 'var(--good)' : 'var(--bad)';
    tr.innerHTML = `<td>${e.n}</td><td>${station}</td><td>${e.station === 'shoot' && e.lrf == null && !e.known ? '?' : (e.lrf != null ? e.lrf : e.yards)}${e.angleDeg ? `<small> ${e.angleDeg > 0 ? '▲' : '▼'}${Math.abs(e.angleDeg)}°</small>` : ''}</td><td>${e.dialE.toFixed(1)}</td><td>${e.dialW.toFixed(1)}</td><td>${e.call || '–'}</td><td style="color:${cls}">${result}</td>`;
    $('#shot-log tbody').prepend(tr);
    $('#shot-log-sum').textContent = `· ${S.log.length} rounds`;
  }

  let hudTimer = 0;
  function setHud(text, ms) {
    const el = $('#scope-hud');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(hudTimer);
    if (ms) hudTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------ debrief

  function renderDebrief() {
    const r = S.rifle, w = S.world, ss = S.session;
    if (!r) { $('#debrief').innerHTML = '<p class="hint">No session yet.</p>'; return; }
    const now = performance.now();
    const chrono = RANGE.stats(S.chrono.shots);
    const powderNow = RANGE.powderTempF(w, now);
    const mvNow = r.mvRef + r.load.tempSens * (powderNow - 59);
    const zeroResid = residualZero();
    const tile = (l, v, u) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}<small>${u || ''}</small></div></div>`;
    const pct = ss.shots ? Math.round(ss.hits / ss.shots * 100) : 0;

    // Per-range truth vs what you dialed
    const ranges = Object.keys(ss.byRange).map(Number).sort((a, b) => a - b);
    const rows = ranges.map((y) => {
      const br = ss.byRange[y];
      const sol = trueDope(y, br.angleDeg);
      const avg = (a) => a.reduce((p, q) => p + q, 0) / a.length;
      return `<tr><td>${y}${br.angleDeg ? ` <small>${br.angleDeg > 0 ? '▲' : '▼'}${Math.abs(br.angleDeg)}°</small>` : ''}</td>
        <td class="mono"><b>${sol.elev.toFixed(1)}</b></td><td class="mono">${avg(br.dialE).toFixed(1)}</td>
        <td class="mono"><b>${fmt1(sol.wind)}</b></td><td class="mono">${fmt1(avg(br.dialW))}</td>
        <td class="mono">${sol.windMph.toFixed(0)} @ ${(Math.round(sol.windClock * 2) / 2) || 12}</td>
        <td class="mono" style="color:var(--${br.hits ? 'good' : 'bad'})">${br.hits}/${br.shots}</td></tr>`;
    }).join('');

    // Layers: what a box-data solver would say vs the truth, at the farthest range engaged
    const farY = ranges.length ? ranges[ranges.length - 1] : kdLanes()[Math.min(3, kdLanes().length - 1)].yards;
    const layers = layerTable(farY, ss.byRange[farY] ? ss.byRange[farY].angleDeg : 0);

    const xp = Math.min(60, ss.hits * 2 + ranges.length * 5 + (chrono.n >= 5 ? 10 : 0) + (Math.abs(zeroResid.e) < 0.15 && Math.abs(zeroResid.w) < 0.15 ? 10 : 0));
    if (!S.debriefed) { S.debriefed = true; if (xp) L.addXp(xp, 'session debrief'); }

    $('#debrief').innerHTML = `
      <div class="card-title"><h3>Debrief · ${esc(r.cart.name)} · ${esc(w.loc.name)}</h3><span class="chip">${esc(S.setup.preset)}</span></div>
      <div class="tiles">
        ${tile('Rounds', r.rounds)}${tile('Steel hits', `${ss.hits}/${ss.shots}`, ` ${pct}%`)}${tile('First-round', `${ss.firstHits}/${ss.targets}`)}${tile('Best streak', S.best)}
      </div>
      <h3 style="margin-top:18px">What you measured vs the truth</h3>
      <div class="table-wrap"><table class="tbl text">
        <thead><tr><th>Item</th><th>You measured</th><th>Truth</th><th>Note</th></tr></thead>
        <tbody>
          <tr><td>Muzzle velocity</td><td class="mono">${chrono.n ? `${Math.round(chrono.avg)} fps (n=${chrono.n})` : 'not chronographed'}</td><td class="mono">${Math.round(mvNow)} fps now · ${r.mvRef} @ 59°F</td><td>Box said ${r.boxMv}. Powder ${Math.round(powderNow)}°F × ${r.load.tempSens} fps/°F.</td></tr>
          <tr><td>Velocity SD</td><td class="mono">${chrono.n > 1 ? chrono.sd.toFixed(1) : '–'}</td><td class="mono">${r.sdFps.toFixed(1)} fps</td><td>Small strings under-estimate SD; 10+ shots is honest.</td></tr>
          <tr><td>Zero</td><td class="mono">slipped ${fmt1(r.slip.elev)} / ${fmt1(r.slip.wind)}</td><td class="mono">residual ${fmt2(zeroResid.e)} / ${fmt2(zeroResid.w)} mil</td><td>${Math.abs(zeroResid.e) < 0.1 && Math.abs(zeroResid.w) < 0.1 ? 'Tight zero.' : 'A zero error rides along to every distance.'}</td></tr>
          <tr><td>Scope tracking</td><td class="mono">assumed 0.1 mil/click</td><td class="mono">${r.trackErr ? `${(r.trackErr * 100).toFixed(1)}% ${r.trackErr > 0 ? 'over' : 'under'}` : 'true'}</td><td>${r.trackErr ? `10 mil dialed moves ${(10 * (1 + r.trackErr)).toFixed(2)} mil. Tall-target test it.` : 'Clicks are honest.'}</td></tr>
          <tr><td>Cold bore</td><td>–</td><td class="mono">${S.toggles.coldBore ? `${fmt2(r.coldBore.e)} / ${fmt2(r.coldBore.w)} mil, ${Math.round(r.coldBore.mv)} fps` : 'off'}</td><td>First shot of the day (and after a long pause).</td></tr>
          <tr><td>Barrel heat</td><td>–</td><td class="mono">${S.toggles.heat ? `walks ${(0.035 * r.contour * 10).toFixed(2)} mil per 10 rapid rounds` : 'off'}</td><td>${S.toggles.heat ? `Peak heat ${Math.max(0, ...S.log.map((e) => e.heat || 0)).toFixed(1)} rounds-worth this session.` : 'Toggle was off this session.'}</td></tr>
          <tr><td>Rangefinder</td><td class="mono">${S.lrfBad} bad return${S.lrfBad === 1 ? '' : 's'}</td><td>–</td><td>Re-lase small far plates; a jump of 20+ yd is the berm.</td></tr>
          <tr><td>Air</td><td class="mono">${w.tempF}°F · ${w.stationPressureInHg.toFixed(2)}" · ${w.humidityPct}%</td><td class="mono">DA ${Math.round(w.atm.densityAltitudeFt)} ft</td><td>${esc(w.loc.terrain)}</td></tr>
        </tbody></table></div>
      ${rows ? `<h3 style="margin-top:18px">True dope from your zero vs what you dialed</h3>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Yds</th><th>True elev</th><th>You</th><th>True wind</th><th>You</th><th>Avg wind</th><th>Hits</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="hint">"True" uses today's air, your real MV, the average wind the bullet flew through and everything switched on. Gusts move single shots around it.</p>` : '<p class="hint" style="margin-top:14px">No steel engaged this session.</p>'}
      <h3 style="margin-top:18px">What changed at ${farY} yd, layer by layer</h3>
      ${layers}
      <div class="actions" style="margin-top:14px">
        <button type="button" class="btn primary" id="debrief-again">Shoot more</button>
        <button type="button" class="btn" id="debrief-new">New day, same rifle</button>
        <button type="button" class="btn" id="debrief-setup">Change setup</button>
        <button type="button" class="btn" id="debrief-print">Print blank data book</button>
      </div>`;
    $('#debrief-again').addEventListener('click', () => setStep('shoot'));
    $('#debrief-new').addEventListener('click', () => { S.world = null; S.debriefed = false; startSession(); });
    $('#debrief-setup').addEventListener('click', () => { S.debriefed = false; setStep('setup'); previewWorld(); });
    $('#debrief-print').addEventListener('click', printSheet);
  }

  /* The dial that centres the group at `yards` in mean conditions, from the shooter's own zero. */
  function trueDope(yards, angleDeg) {
    const r = S.rifle, w = S.world;
    const mw = RANGE.meanWind(w, yards);
    const powderT = RANGE.powderTempF(w, performance.now());
    const adv = !!S.toggles.adv;
    const row = B.solve(Object.assign({}, r.solverBase, {
      muzzleVelocityFps: r.mvRef + r.load.tempSens * (powderT - 59), tempSensitivity: 0, mvTempF: null,
      altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, stationPressureInHg: w.stationPressureInHg,
      shotAngleDeg: angleDeg || 0, zeroAngleRad: r.zeroAngleRad,
      windMph: mw.speed, windClock: mw.clock,
      spinDrift: adv, aeroJump: adv, coriolis: adv, latitudeDeg: w.latitudeDeg, azimuthDeg: w.azimuthDeg,
    }), [yards]).rows[0];
    if (!row) return { elev: NaN, wind: NaN, windMph: mw.speed, windClock: mw.clock };
    const k = 1 + r.trackErr;
    return {
      elev: B.roundToClick(-(toMil(row.dropIn, yards) + r.boreE) / k - r.slip.elev, CLICK),
      wind: B.roundToClick(-(toMil(row.windIn, yards) + r.boreW) / k - r.slip.wind, CLICK),
      windMph: mw.speed, windClock: mw.clock,
    };
  }

  function residualZero() {
    const r = S.rifle;
    const k = 1 + r.trackErr;
    // group centre at the zero range with the turrets reading 0.0, today
    const w = S.world;
    const row = B.solve(Object.assign({}, r.solverBase, {
      tempSensitivity: 0, mvTempF: null, windMph: 0,
      altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, stationPressureInHg: w.stationPressureInHg,
      zeroAngleRad: r.zeroAngleRad,
    }), [zeroYd()]).rows[0];
    if (!row) return { e: 0, w: 0 };
    return { e: toMil(row.dropIn, zeroYd()) + r.boreE + r.slip.elev * k, w: toMil(row.windIn, zeroYd()) + r.boreW + r.slip.wind * k };
  }

  function layerTable(yards, angleDeg) {
    const r = S.rifle, w = S.world;
    const mw = RANGE.meanWind(w, yards);
    const powderT = RANGE.powderTempF(w, performance.now());
    const box = { muzzleVelocityFps: r.boxMv, altitudeFt: 0, tempF: 59, humidityPct: 0, stationPressureInHg: null, windMph: mw.speed, windClock: mw.clock, tempSensitivity: 0, mvTempF: null, shotAngleDeg: 0 };
    const steps = [
      ['Box velocity, standard day, perfect zero', box],
      ['Your real MV (at 59°F)', { muzzleVelocityFps: r.mvRef }],
      ["Today's air + powder temperature", { altitudeFt: w.altitudeFt, tempF: w.tempF, humidityPct: w.humidityPct, stationPressureInHg: w.stationPressureInHg, muzzleVelocityFps: r.mvRef + r.load.tempSens * (powderT - 59) }],
      ['Shot angle', { shotAngleDeg: angleDeg || 0 }],
      ['Spin drift, Coriolis, aero jump', S.toggles.adv ? { spinDrift: true, aeroJump: true, coriolis: true, latitudeDeg: w.latitudeDeg, azimuthDeg: w.azimuthDeg } : {}],
    ];
    let acc = Object.assign({}, r.solverBase, { zeroAngleRad: null });
    let prev = null;
    const trs = steps.map(([name, extra]) => {
      acc = Object.assign({}, acc, extra);
      const row = B.solve(acc, [yards]).rows[0] || { dropIn: NaN, windIn: NaN };
      const e = -toMil(row.dropIn, yards), wd = -toMil(row.windIn, yards);
      const de = prev ? e - prev.e : null, dw = prev ? wd - prev.w : null;
      prev = { e, w: wd };
      const d = (v) => (v == null ? '' : fmt2(v));
      return `<tr><td>${name}</td><td class="mono">${d(de)}</td><td class="mono">${d(dw)}</td><td class="mono"><b>${L.fmtClick(e, CLICK)}</b></td><td class="mono"><b>${L.fmtClick(wd, CLICK)}</b></td></tr>`;
    });
    const k = 1 + r.trackErr;
    const zr = residualZero();
    const eFinal = (prev.e - zr.e) / k, wFinal = (prev.w - zr.w) / k;
    trs.push(`<tr><td>Your zero residual + scope tracking</td><td class="mono">${fmt2(eFinal - prev.e)}</td><td class="mono">${fmt2(wFinal - prev.w)}</td><td class="mono"><b>${L.fmtClick(eFinal, CLICK)}</b></td><td class="mono"><b>${L.fmtClick(wFinal, CLICK)}</b></td></tr>`);
    return `<div class="table-wrap"><table class="tbl text">
      <thead><tr><th>Layer</th><th>Δ elev</th><th>Δ wind</th><th>Elev mil</th><th>Wind mil</th></tr></thead>
      <tbody>${trs.join('')}</tbody></table></div>
      <p class="hint">Average wind ${mw.speed.toFixed(1)} mph from ${(Math.round(mw.clock * 2) / 2) || 12} o'clock. The last row is what your turret must read.</p>`;
  }

  // ------------------------------------------------------------ print

  function buildSheet() {
    readSetupForm();
    const st = S.setup;
    const cart = RANGE.cartridge(st.cart), load = RANGE.load(st.load), rifle = RANGE.rifle(st.rifle), optic = RANGE.optic(st.optic);
    const lanes = RANGE.kdLanes(cart, S.world ? S.world.loc.maxYd : cart.maxYd);
    const step = cart.id === '22lr' ? 25 : 50;
    const yds = [];
    for (let y = cart.id === '22lr' ? 25 : 100; y <= lanes[lanes.length - 1].yards; y += step) yds.push(y);
    const blank = '<span class="pl"></span>';
    const line = (l) => `<div class="pf"><span>${l}</span>${blank}</div>`;
    $('#range-print-sheet').innerHTML = `
      <div class="ps-head"><div><div class="ps-tag">DATA BOOK · MIL</div><h1>${esc(cart.name)}</h1></div><div class="ps-meta">Date ______ · Location ________________</div></div>
      <div class="ps-grid3">
        ${line('Ammo')}${line('Rifle')}${line('Barrel / twist')}
        ${line('Optic')}${line('Sight height')}${line('Zero')}
        ${line('Chrono avg (fps)')}${line('SD / ES')}${line('Ammo temp')}
        ${line('Air temp')}${line('Station press.')}${line('Humidity / DA')}
      </div>
      <p class="ps-note">Chosen setup: ${esc(load.brand)} ${esc(load.name)} · ${esc(rifle.name)} ${st.barrelIn}" 1:${st.twistIn} · ${esc(optic.name)} · sight ${(+st.sightHeightIn).toFixed(1)}" · zero ${st.zeroYd} yd. Box velocity is a starting point only.</p>
      <div class="ps-cols">
        <div>
          <h2>Chronograph string</h2>
          <table class="ps-tbl"><thead><tr><th>#</th><th>fps</th><th>#</th><th>fps</th></tr></thead><tbody>
            ${[1, 2, 3, 4, 5].map((i) => `<tr><td>${i}</td><td></td><td>${i + 5}</td><td></td></tr>`).join('')}
            <tr><td colspan="2">Average</td><td colspan="2">SD / ES</td></tr></tbody></table>
          <h2>Zero</h2>
          <div class="ps-zero"><div class="ps-paper"></div><div>Group ____ mil<br>Centre ↑ ____ → ____<br>Dialed ____ / ____<br>Set zero at ______</div></div>
        </div>
        <div>
          <h2>Dope</h2>
          <table class="ps-tbl ps-dope"><thead><tr><th>Yds</th><th>Elev</th><th>5 mph</th><th>10 mph</th><th>15 mph</th><th>Confirmed / notes</th></tr></thead><tbody>
            ${yds.map((y) => `<tr><td>${y}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
          </tbody></table>
        </div>
      </div>
      <h2>Wind &amp; notes</h2>
      <div class="ps-notes">${'<div></div>'.repeat(6)}</div>
      <div class="ps-foot">Full-value wind = 3 / 9 o'clock. range (yd) = size (in) × 27.78 ÷ mil. Hold into the wind.</div>`;
  }

  function printSheet() {
    buildSheet();
    document.body.classList.add('print-range');
    setTimeout(() => window.print(), 30);
  }

  // ------------------------------------------------------------ zoom

  function renderZoom() {
    const zooms = (S.rifle ? S.rifle.optic : RANGE.optic(S.setup.optic)).zooms;
    $('#scope-zoom').innerHTML = zooms.map((z, i) => `<button type="button" class="${i === S.zoomIdx ? 'on' : ''}" data-z="${i}">${z}×</button>`).join('');
    $$('#scope-zoom button').forEach((b) => b.addEventListener('click', () => { S.zoomIdx = +b.dataset.z; renderZoom(); L.sfx.click(); }));
  }
  function cycleZoom() {
    const n = (S.rifle ? S.rifle.optic : RANGE.optic(S.setup.optic)).zooms.length;
    S.zoomIdx = (S.zoomIdx + 1) % n;
    renderZoom(); L.sfx.click();
  }

  // ------------------------------------------------------------ frame loop

  function frame(now) {
    try { frameBody(now); } catch (e) { console.error('range frame', e); }
    requestAnimationFrame(frame);
  }

  function frameBody(now) {
    if (L.currentTab === 'range') {
      if (S.step === 'setup') {
        if (now - kestrelAt > 1000) renderKestrel(now);
        RANGE.drawFlags($('#flags'), S.world, now, reduced());
      } else if (S.target && S.step !== 'debrief') {
        if (S.flight) {
          const k = Math.min(1, (now - S.flight.start) / S.flight.tof);
          $('#flight-bar').style.width = (k * 100) + '%';
          setHud(`Bullet in flight · ${((now - S.flight.start) / 1000).toFixed(2)} s`);
          if (k >= 1) land();
        }
        if (S.step === 'shoot' && S.mode === 'stage' && S.stage) {
          const st = S.stage;
          if (st.start && !st.over) {
            const t = (now - st.start) / 1000;
            $('#scope-stage').textContent = `T${st.i + 1}/${st.targets.length} · ${t.toFixed(1)} / ${st.par} s`;
            if (t > st.par && !S.flight) finishStage();
          } else $('#scope-stage').textContent = st.over ? 'Stage over' : `T${st.i + 1}/${st.targets.length} · clock starts on first shot`;
        } else $('#scope-stage').textContent = S.step === 'chrono' ? 'CHRONO · ' + S.setup.zeroYd + ' yd' : S.step === 'zero' ? 'ZERO · ' + S.setup.zeroYd + ' yd' : '';
        if (S.breath.holding) setHud(`Holding breath · ${((now - S.breath.start) / 1000).toFixed(1)} s`);
        if (now - kestrelAt > 1000) renderKestrel(now);
        S.cant += (S.cantTarget - S.cant) * 0.08;
        S.puffs = S.puffs.filter((p) => now - p.t0 < 5200);
        RANGE.drawScope($('#scope'), {
          target: S.target, halfFov: halfFov(), zoomX: zoomX(), sway: sway(now), cant: S.cant, recoilAt: S.recoilAt,
          recoil: S.rifle ? Math.min(1.6, S.rifle.cart.recoil * 12 / S.rifle.cls.weightLb) : 0.6,
          marks: S.target.marks, puffs: S.puffs, swing: S.swing, spotter: S.toggles.spotter && S.step === 'shoot',
          bubble: S.toggles.cant && S.step === 'shoot', world: S.world, sky: S.world.sky, reduced: reduced(),
        }, now);
        RANGE.drawFlags($('#flags'), S.world, now, reduced());
      }
    }
  }

  // ------------------------------------------------------------ init

  function ensureInit() {
    if (S.inited) return;
    RANGE = window.LRPS_RANGE;
    if (!RANGE || !RANGE.newWorld || !RANGE.drawScope) return; // module scripts not loaded yet
    S.inited = true;
    S.setup = Object.assign({}, RANGE.DEFAULT_SETUP, L.store.get('range.setup', {}));
    ['zeroYd', 'barrelIn', 'twistIn', 'sightHeightIn'].forEach((k) => {
      S.setup[k] = Number.isFinite(+S.setup[k]) && +S.setup[k] > 0 ? +S.setup[k] : RANGE.DEFAULT_SETUP[k];
    });
    if (!['training', 'realistic', 'custom'].includes(S.setup.preset)) S.setup.preset = 'training';
    if (typeof S.setup.realistic !== 'boolean') S.setup.realistic = S.setup.preset === 'realistic';
    S.toggles = Object.assign({}, RANGE.PRESETS[S.setup.preset] || RANGE.PRESETS[S.setup.realistic ? 'realistic' : 'training'], L.store.get('range.toggles', {}));
    buildSetupForm();
    $$('#range-preset button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.setup.preset));
    renderSetupSummary();
    previewWorld();
    renderZoom();

    $('#rig-form').addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'rig-cart') { readSetupForm(); fillCartridgeDependents(); }
      if (e.target.dataset.toggle) { readToggles(); $$('#range-preset button').forEach((b) => b.classList.remove('on')); S.setup.preset = 'custom'; }
      readSetupForm();
      renderSetupSummary();
      if (S.rifle) {
        // A session is running: the day stays the same; toggles apply to the next shot
        if (e.target.dataset.toggle) {
          if (S.world && S.world.wind && e.target.dataset.toggle === 'gusts') S.world.wind.vary = !!S.toggles.gusts;
          L.toast('Applies to the next shot');
        } else if (!/pos/.test(id)) {
          L.toast('Rifle and range changes take effect when you start a new session');
        }
      } else if (['rig-loc', 'rig-sky'].includes(id) || e.target.dataset.toggle) previewWorld();
    });
    $('#rig-form').addEventListener('submit', (e) => e.preventDefault());
    L.seg($('#range-preset'), (v) => { setPreset(v); if (S.rifle) L.toast('Applies to the next shot'); else previewWorld(); });
    $('#setup-go').addEventListener('click', startSession);
    $('#range-print').addEventListener('click', printSheet);
    $$('#r-steps button').forEach((b) => b.addEventListener('click', () => {
      const s = b.dataset.step;
      if (s === 'setup') { setStep('setup'); if (!S.world) previewWorld(); return; }
      if (!S.rifle) { L.toast('Start a session first'); return; }
      setStep(s);
    }));
    $('#station-next').addEventListener('click', () => {
      if (S.step === 'chrono') setStep('zero');
      else if (S.step === 'zero') setStep('shoot');
      else setStep('debrief');
      L.sfx.click();
    });

    $$('.turret').forEach((el) => {
      const axis = el.dataset.axis;
      buildDial($('svg', el));
      $$('button', el).forEach((b) => b.addEventListener('click', () => nudge(axis, +b.dataset.step)));
      $('input', el).addEventListener('change', (e) => setDial(axis, parseFloat(e.target.value) || 0));
      $('.dial', el).addEventListener('wheel', (e) => { e.preventDefault(); nudge(axis, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    });
    $('#fire-btn').addEventListener('click', fire);
    $('#range-new').addEventListener('click', nextTarget);
    $('#range-reset').addEventListener('click', () => { setDial('elev', 0); setDial('wind', 0); });
    $('#level-btn').addEventListener('click', level);
    const bb = $('#breath-btn');
    bb.addEventListener('pointerdown', (e) => { e.preventDefault(); holdBreath(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bb.addEventListener(ev, () => releaseBreath()));

    document.addEventListener('keydown', (e) => {
      if (L.currentTab !== 'range' || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter' && e.target.closest('.turret')) { e.target.dispatchEvent(new Event('change')); fire(); }
        return;
      }
      if (S.step === 'setup' || S.step === 'debrief') return;
      const k = e.key;
      if (tag === 'SUMMARY') return; // disclosure widgets keep Space/Enter
      if (tag === 'BUTTON' && k === 'Enter') return;
      const mult = e.shiftKey ? 5 : 1;
      if (k === 'ArrowUp') nudge('elev', mult);
      else if (k === 'ArrowDown') nudge('elev', -mult);
      else if (k === 'ArrowRight') nudge('wind', mult);
      else if (k === 'ArrowLeft') nudge('wind', -mult);
      else if (k === ' ' || k === 'Enter' || k === 'f' || k === 'F') { if (tag === 'BUTTON') e.target.blur(); fire(); }
      else if (k === 'b' || k === 'B') { if (!e.repeat) holdBreath(); }
      else if (k === 'l' || k === 'L') level();
      else if (k === 'n' || k === 'N') nextTarget();
      else if (k === 'r' || k === 'R') lase();
      else if (k === 'z' || k === 'Z' || k === '+' || k === '=' || k === '-') cycleZoom();
      else if (k === '0') { setDial('elev', 0); setDial('wind', 0); }
      else return;
      e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { if (e.key === 'b' || e.key === 'B') releaseBreath(); });
    window.addEventListener('beforeprint', () => { if (L.currentTab === 'range') { buildSheet(); document.body.classList.add('print-range'); } });
    window.addEventListener('afterprint', () => document.body.classList.remove('print-range'));
  }

  function onShown() {
    ensureInit();
    if (!S.inited) return;
    if (!S.world) previewWorld();
    setStep(S.step, false);
    if (S.rifle) { setDial('elev', S.dial.elev, true); setDial('wind', S.dial.wind, true); }
    renderHud();
    if (!S.running) { S.running = true; requestAnimationFrame(frame); }
  }

  L.onTab('range', onShown);
  window.addEventListener('DOMContentLoaded', ensureInit);
})();
