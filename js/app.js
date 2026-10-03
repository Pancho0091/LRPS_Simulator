/* global Ballistics */
(function () {
  'use strict';

  const B = Ballistics;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ------------------------------------------------------------------ data

  const PRESETS = [
    { name: '6.5 Creedmoor 140 ELD-M', muzzleVelocityFps: 2710, bc: 0.326, dragModel: 'G7', bulletWeightGr: 140 },
    { name: '.308 Win 175 SMK', muzzleVelocityFps: 2600, bc: 0.243, dragModel: 'G7', bulletWeightGr: 175 },
    { name: '6mm Creedmoor 108 ELD-M', muzzleVelocityFps: 2960, bc: 0.283, dragModel: 'G7', bulletWeightGr: 108 },
    { name: '.300 Win Mag 215 Hybrid', muzzleVelocityFps: 2850, bc: 0.354, dragModel: 'G7', bulletWeightGr: 215 },
    { name: '.223 Rem 77 TMK', muzzleVelocityFps: 2750, bc: 0.205, dragModel: 'G7', bulletWeightGr: 77 },
  ];

  const DEFAULT_PROFILE = Object.assign({}, PRESETS[0], {
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

  const STORAGE_KEY = 'lrps.profile.v1';

  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULT_PROFILE, JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return Object.assign({}, DEFAULT_PROFILE);
  }

  function saveProfile(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }

  let profile = loadProfile();

  // ------------------------------------------------------------- helpers

  function decimalsFor(click) {
    const s = String(click);
    return s.includes('.') ? s.split('.')[1].length : 0;
  }

  function fmtClick(value, click) {
    return B.roundToClick(value, click).toFixed(decimalsFor(click));
  }

  function toUnit(inches, yards, unit) {
    return unit === 'MOA' ? B.inchesToMoa(inches, yards) : B.inchesToMil(inches, yards);
  }

  function fromUnit(value, yards, unit) {
    return unit === 'MOA' ? B.moaToInches(value, yards) : B.milToInches(value, yards);
  }

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function parseBrackets(text) {
    return String(text).split(/[,\s]+/).map(Number).filter((n) => n > 0);
  }

  function rangeList(p) {
    const out = [];
    const step = Math.max(5, Number(p.rangeStep) || 50);
    for (let r = Number(p.rangeStart); r <= Number(p.rangeEnd) + 1e-9; r += step) out.push(r);
    return out.filter((r) => r > 0);
  }

  function solverInput(p, extra) {
    return Object.assign({
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
  }

  /*
   * Compute everything that goes on a card.
   * Elevation comes from a no-wind solve; each wind bracket is a separate
   * full-value (3 o'clock) solve so the card shows the hold for that speed.
   */
  function computeCard(p) {
    const ranges = rangeList(p);
    const brackets = parseBrackets(p.windBrackets);
    const base = B.solve(solverInput(p, { windMph: 0 }), ranges);
    const winds = brackets.map((mph) => B.solve(solverInput(p, { windMph: mph, windClock: 3 }), ranges));
    const rows = base.rows.map((r, i) => {
      const elev = toUnit(-r.dropIn, r.yards, p.unit);
      return {
        yards: r.yards,
        elev,
        clicks: B.toClicks(elev, +p.clickSize),
        // wind from the right drifts the bullet left; the hold is right (+)
        winds: winds.map((w) => toUnit(-w.rows[i].windIn, r.yards, p.unit)),
        spin: p.spinDrift ? toUnit(-B.spinDriftIn(1.5, r.tofSec, 'right'), r.yards, p.unit) : null,
        velocityFps: r.velocityFps,
        mach: r.mach,
        tofSec: r.tofSec,
        energyFtLb: r.energyFtLb,
      };
    });
    return { rows, brackets, atmosphere: base.atmosphere };
  }

  // --------------------------------------------------------------- tabs

  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
      $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab));
      if (btn.dataset.tab === 'range') onRangeShown();
      if (btn.dataset.tab === 'drill' && !drill.current) newDrill();
    });
  });

  // ------------------------------------------------------------ build tab

  const form = $('#profile-form');
  const presetSel = $('#preset');
  presetSel.innerHTML = '<option value="">— custom —</option>' +
    PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');

  function fillForm(p) {
    $$('input, select', form).forEach((el) => {
      if (!el.name || !(el.name in p)) return;
      if (el.type === 'checkbox') el.checked = !!p[el.name];
      else el.value = p[el.name];
    });
  }

  function readForm() {
    const p = Object.assign({}, profile);
    $$('input, select', form).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') p[el.name] = el.checked;
      else if (el.type === 'number') p[el.name] = el.value === '' ? p[el.name] : Number(el.value);
      else p[el.name] = el.value;
    });
    return p;
  }

  presetSel.addEventListener('change', () => {
    const preset = PRESETS[presetSel.value];
    if (!preset) return;
    fillForm(Object.assign(readForm(), preset));
  });

  form.unit.addEventListener('change', () => {
    form.clickSize.value = form.unit.value === 'MOA' ? 0.25 : 0.1;
  });

  function cardHtml(p, card, compact) {
    const unit = p.unit;
    const click = +p.clickSize;
    const atm = card.atmosphere;
    const windHeads = card.brackets.map((b) => `<th>${b} mph</th>`).join('');
    const rows = card.rows.map((r) => {
      const cls = r.mach < 1.0 ? 'subsonic' : r.mach < 1.2 ? 'transonic' : '';
      const winds = r.winds.map((w) => `<td>${fmtClick(w, click)}</td>`).join('');
      const spin = p.spinDrift ? `<td>${fmtClick(r.spin, click)}</td>` : '';
      const extra = compact ? '' :
        `<td>${r.velocityFps.toFixed(0)}</td><td>${r.tofSec.toFixed(2)}</td>`;
      return `<tr class="${cls}"><td>${r.yards}</td><td><b>${fmtClick(r.elev, click)}</b></td>` +
        `<td>${r.clicks}</td>${winds}${spin}${extra}</tr>`;
    }).join('');
    const meta = compact ? '' : `
      <div class="card-meta">
        <span><b>Load:</b> ${escapeHtml(p.name || 'custom')}</span>
        <span><b>MV:</b> ${p.muzzleVelocityFps} fps</span>
        <span><b>BC:</b> ${p.bc} ${p.dragModel}</span>
        <span><b>Zero:</b> ${p.zeroYards} yd</span>
        <span><b>Sight ht:</b> ${p.sightHeightIn} in</span>
        <span><b>Turret:</b> ${click} ${unit}/click</span>
        <span><b>Alt / Temp:</b> ${p.altitudeFt} ft / ${p.tempF}°F</span>
        <span><b>Density alt:</b> ${Math.round(atm.densityAltitudeFt)} ft</span>
        ${+p.shotAngleDeg ? `<span><b>Angle:</b> ${p.shotAngleDeg}°</span>` : ''}
      </div>`;
    return `
      <div class="dope-card">
        ${compact ? `<h3>Your card (${unit})</h3>` : `<h3>DOPE — ${escapeHtml(p.name || 'custom')}</h3>`}
        ${meta}
        <div class="table-wrap">
        <table class="grid num">
          <thead>
            <tr><th rowspan="2">Yds</th><th rowspan="2">Elev ${unit} ↑</th><th rowspan="2">Clicks</th>
              <th colspan="${card.brackets.length}">Wind ${unit} (full value, hold into wind)</th>
              ${p.spinDrift ? '<th rowspan="2">Spin drift</th>' : ''}
              ${compact ? '' : '<th rowspan="2">Vel fps</th><th rowspan="2">TOF s</th>'}</tr>
            <tr>${windHeads}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
        <div class="legend-note">Values rounded to the nearest click.
          <span style="color:var(--warn)">Amber</span> = transonic approach (&lt; Mach 1.2),
          <span style="color:var(--bad)">red</span> = subsonic: solver predictions are least reliable here.
          ${p.spinDrift ? 'Spin drift column is the correction for a right-twist barrel; add it to your wind hold.' : ''}</div>
      </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let lastCard = null;

  function renderCard() {
    profile = readForm();
    saveProfile(profile);
    lastCard = computeCard(profile);
    $('#card-output').innerHTML = cardHtml(profile, lastCard, false);
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); renderCard(); });
  $('#print-card').addEventListener('click', () => { renderCard(); window.print(); });
  $('#export-csv').addEventListener('click', () => {
    renderCard();
    const p = profile;
    const head = ['yards', `elev_${p.unit}`, 'clicks']
      .concat(lastCard.brackets.map((b) => `wind_${b}mph_${p.unit}`))
      .concat(p.spinDrift ? [`spin_${p.unit}`] : [])
      .concat(['velocity_fps', 'tof_s', 'energy_ftlb']);
    const lines = lastCard.rows.map((r) => [r.yards, r.elev.toFixed(3), r.clicks]
      .concat(r.winds.map((w) => w.toFixed(3)))
      .concat(p.spinDrift ? [r.spin.toFixed(3)] : [])
      .concat([r.velocityFps.toFixed(0), r.tofSec.toFixed(3), r.energyFtLb.toFixed(0)]).join(','));
    const blob = new Blob([head.join(',') + '\n' + lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (p.name || 'dope').replace(/[^\w.-]+/g, '_') + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  fillForm(profile);
  renderCard();

  // ------------------------------------------------------------- drills

  const drill = { current: null, correct: 0, total: 0 };

  function drillUnit() {
    const unit = $('#drill-unit').value;
    return { unit, click: unit === 'MOA' ? 0.25 : 0.1 };
  }

  function randomLoad() {
    const base = pick(PRESETS);
    return Object.assign({}, DEFAULT_PROFILE, base, {
      muzzleVelocityFps: Math.round(base.muzzleVelocityFps + rand(-80, 80)),
      altitudeFt: pick([0, 1000, 2500, 4000, 5500]),
      tempF: randInt(30, 95),
    });
  }

  function within(answer, exact, tol) {
    return Number.isFinite(answer) && Math.abs(answer - exact) <= tol + 1e-9;
  }

  function updateScore() {
    $('#drill-score').textContent = drill.total ? `Score: ${drill.correct} / ${drill.total} cells` : '';
  }

  function newDrill() {
    const type = $('#drill-type').value;
    const { unit, click } = drillUnit();
    const load = randomLoad();
    if (type === 'convert') drill.current = makeConvertDrill(load, unit, click);
    else if (type === 'interp') drill.current = makeInterpDrill(load, unit, click);
    else drill.current = makeWindDrill(load, unit, click);
    $('#drill-body').innerHTML = drill.current.html;
    $('#drill-check').addEventListener('click', checkDrill);
  }

  function checkDrill() {
    const d = drill.current;
    if (!d || d.checked) return;
    d.checked = true;
    let ok = 0;
    d.cells.forEach((c) => {
      const input = $(`#${c.id}`);
      const val = parseFloat(input.value);
      const good = c.grade(val);
      input.parentElement.classList.add(good ? 'ok' : 'no');
      if (!good) input.title = 'Expected ' + c.expected;
      if (good) ok++;
    });
    drill.correct += ok;
    drill.total += d.cells.length;
    updateScore();
    $('#drill-explain').innerHTML = `<p><b>${ok} / ${d.cells.length} correct.</b> Hover a red cell for the expected value.</p>` + d.explain;
  }

  function inputCell(id) {
    return `<td><input id="${id}" type="number" step="any"></td>`;
  }

  // Drill 1: raw solver inches -> card cells
  function makeConvertDrill(load, unit, click) {
    const ranges = [];
    const pool = [200, 300, 400, 500, 600, 700, 800, 900, 1000];
    while (ranges.length < 4) {
      const r = pick(pool);
      if (!ranges.includes(r)) ranges.push(r);
    }
    ranges.sort((a, b) => a - b);
    const sol = B.solve(solverInput(load, { windMph: 10, windClock: 3 }), ranges).rows;
    const k = unit === 'MOA' ? B.IN_PER_MOA_100 : B.IN_PER_MIL_100;
    const cells = [];
    const tol = click / 2;
    const body = sol.map((r, i) => {
      const elev = toUnit(-r.dropIn, r.yards, unit);
      const w10 = toUnit(-r.windIn, r.yards, unit);
      const ids = ['e', 'c', 'w10', 'w5'].map((s) => `cv-${s}-${i}`);
      cells.push(
        { id: ids[0], expected: fmtClick(elev, click), grade: (v) => within(v, elev, tol) },
        { id: ids[1], expected: B.toClicks(elev, click), grade: (v) => within(v, elev / click, 0.5) },
        { id: ids[2], expected: fmtClick(w10, click), grade: (v) => within(v, w10, tol) },
        { id: ids[3], expected: fmtClick(w10 / 2, click), grade: (v) => within(v, w10 / 2, tol) },
      );
      return `<tr><td>${r.yards}</td><td>${(-r.dropIn).toFixed(1)}</td><td>${(-r.windIn).toFixed(1)}</td>` +
        ids.map(inputCell).join('') + '</tr>';
    }).join('');

    const explain = `<div class="explain"><pre class="code">${sol.map((r) => {
      const inch = (k * r.yards / 100).toFixed(3);
      const e = toUnit(-r.dropIn, r.yards, unit);
      const w = toUnit(-r.windIn, r.yards, unit);
      return `${r.yards} yd: 1 ${unit} = ${k} × ${r.yards}/100 = ${inch} in\n` +
        `  elev  = ${(-r.dropIn).toFixed(1)} / ${inch} = ${e.toFixed(3)} → ${fmtClick(e, click)} ${unit} = ${B.toClicks(e, click)} clicks\n` +
        `  wind10= ${(-r.windIn).toFixed(1)} / ${inch} = ${w.toFixed(3)} → ${fmtClick(w, click)};  wind5 = half → ${fmtClick(w / 2, click)}`;
    }).join('\n')}</pre></div>`;

    return {
      cells,
      explain,
      html: `<div class="drill-card">
        <p><b>Task:</b> A solver gave you raw output in inches for a ${escapeHtml(load.name)} (MV ${load.muzzleVelocityFps} fps, ${load.zeroYards} yd zero).
        Fill in the card cells in <b>${unit}</b>, rounded to the nearest click (${click} ${unit}).</p>
        <p class="hint">Drop = inches the bullet falls below the line of sight (you dial UP this much). Drift = inches pushed left by a 10 mph full-value wind (you hold RIGHT this much).</p>
        <div class="table-wrap"><table class="grid num">
          <thead><tr><th>Yds</th><th>Drop (in)</th><th>Drift @10 (in)</th><th>Elev ${unit}</th><th>Clicks</th><th>Wind 10 mph</th><th>Wind 5 mph</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        <div class="actions"><button id="drill-check" class="primary">Check</button></div>
        <div id="drill-explain"></div>
      </div>`,
    };
  }

  // Drill 2: read between card rows
  function makeInterpDrill(load, unit, click) {
    const p = Object.assign({}, load, { unit, clickSize: click, rangeStart: 100, rangeEnd: 1000, rangeStep: 100, windBrackets: '10' });
    const card = computeCard(p);
    const lo = randInt(3, 9) * 100;
    const target = lo + randInt(1, 19) * 5;
    const a = card.rows.find((r) => r.yards === lo);
    const b = card.rows.find((r) => r.yards === lo + 100);
    // The shooter interpolates the values as printed on the card
    const ea = B.roundToClick(a.elev, click), eb = B.roundToClick(b.elev, click);
    const wa = B.roundToClick(a.winds[0], click), wb = B.roundToClick(b.winds[0], click);
    const f = (target - lo) / 100;
    const eInterp = ea + (eb - ea) * f;
    const wInterp = wa + (wb - wa) * f;
    const truth = B.solve(solverInput(p, { windMph: 10, windClock: 3 }), [target]).rows[0];
    const eTrue = toUnit(-truth.dropIn, target, unit);
    const wTrue = toUnit(-truth.windIn, target, unit);
    const tol = click / 2;
    const okE = (v) => within(v, eInterp, tol) || within(v, eTrue, tol);
    const okW = (v) => within(v, wInterp, tol) || within(v, wTrue, tol);
    const cells = [
      { id: 'ip-e', expected: fmtClick(eInterp, click), grade: okE },
      { id: 'ip-w', expected: fmtClick(wInterp, click), grade: okW },
    ];
    const explain = `<div class="explain"><pre class="code">fraction = (${target} − ${lo}) / 100 = ${f.toFixed(2)}
elev = ${ea.toFixed(decimalsFor(click))} + (${eb.toFixed(decimalsFor(click))} − ${ea.toFixed(decimalsFor(click))}) × ${f.toFixed(2)} = ${eInterp.toFixed(3)} → ${fmtClick(eInterp, click)} ${unit}
wind = ${wa.toFixed(decimalsFor(click))} + (${wb.toFixed(decimalsFor(click))} − ${wa.toFixed(decimalsFor(click))}) × ${f.toFixed(2)} = ${wInterp.toFixed(3)} → ${fmtClick(wInterp, click)} ${unit}

Solver truth at ${target} yd: elev ${eTrue.toFixed(3)}, wind ${wTrue.toFixed(3)} ${unit}.
Linear interpolation slightly OVER-estimates elevation: the drop curve bends
upward (it is convex), so the straight line between two rows sits above it. The error grows with row spacing and range — this
is why long-range cards use 25–50 yd steps past ~600 yd.</pre></div>`;
    return {
      cells,
      explain,
      html: `<div class="drill-card">
        <p><b>Task:</b> Your rangefinder reads <b>${target} yd</b>. Your card only has 100 yd rows.
        Interpolate the elevation and the 10 mph wind hold, to the nearest click.</p>
        ${cardHtml(p, { rows: card.rows.filter((r) => r.yards >= lo - 100 && r.yards <= lo + 200), brackets: card.brackets, atmosphere: card.atmosphere }, true)}
        <table class="grid num" style="margin-top:12px; max-width:420px">
          <thead><tr><th>Range</th><th>Elev ${unit}</th><th>Wind 10 mph</th></tr></thead>
          <tbody><tr><td>${target}</td>${inputCell('ip-e')}${inputCell('ip-w')}</tr></tbody>
        </table>
        <div class="actions"><button id="drill-check" class="primary">Check</button></div>
        <div id="drill-explain"></div>
      </div>`,
    };
  }

  // Drill 3: apply speed and clock direction to the card's 10 mph value
  function clockFactor(clock) { return Math.abs(Math.sin(clock * Math.PI / 6)); }
  function clockLabel(clock) { return (clock % 1 ? `${Math.floor(clock)}:30` : String(clock)); }

  function makeWindDrill(load, unit, click) {
    const p = Object.assign({}, load, { unit, clickSize: click });
    const rows = [];
    const cells = [];
    const tol = click / 2 + click * 0.5; // wind calls are coarse: allow one click
    for (let i = 0; i < 3; i++) {
      const yards = randInt(4, 10) * 100;
      const w10 = toUnit(-B.solve(solverInput(p, { windMph: 10, windClock: 3 }), [yards]).rows[0].windIn, yards, unit);
      const w10card = B.roundToClick(w10, click);
      const speed = randInt(3, 18);
      const clock = pick([1, 1.5, 2, 3, 4, 4.5, 5, 7, 7.5, 8, 9, 10, 10.5, 11, 12]);
      // From the right (1–5 o'clock) pushes left → hold right (+). From the left → hold left (−).
      const sign = clock > 0 && clock < 6 ? 1 : clock > 6 && clock < 12 ? -1 : 0;
      const answer = sign * w10card * speed / 10 * clockFactor(clock);
      const id = `wd-${i}`;
      cells.push({ id, expected: fmtClick(answer, click), grade: (v) => within(v, answer, tol) });
      rows.push({ yards, w10card, speed, clock, answer, id });
    }
    const body = rows.map((r) => `<tr><td>${r.yards}</td><td>${r.w10card.toFixed(decimalsFor(click))}</td><td>${r.speed} mph</td><td>${clockLabel(r.clock)} o'clock</td>${inputCell(r.id)}</tr>`).join('');
    const explain = `<div class="explain"><pre class="code">hold = card_10mph × (speed / 10) × |sin(clock × 30°)|, sign: wind from right → hold right (+)
${rows.map((r) => `${r.yards} yd: ${r.w10card.toFixed(decimalsFor(click))} × ${r.speed}/10 × ${clockFactor(r.clock).toFixed(2)} = ${r.answer.toFixed(3)} → ${fmtClick(r.answer, click)} ${unit}`).join('\n')}

Clock value cheat sheet:
  3 / 9            → 1.0  (full value)
  2, 4, 8, 10      → 0.87 (≈ full)
  1:30, 4:30 ...   → 0.71
  1, 5, 7, 11      → 0.5  (half value)
  12 / 6           → 0    (head/tail: affects elevation slightly, not drift)</pre></div>`;
    return {
      cells,
      explain,
      html: `<div class="drill-card">
        <p><b>Task:</b> Your card gives the hold for a <b>10 mph full-value</b> wind. Convert each wind call into a hold in <b>${unit}</b>.
        Enter <b>+ for right</b>, <b>− for left</b>. Graded to within one click.</p>
        <div class="table-wrap"><table class="grid num">
          <thead><tr><th>Yds</th><th>Card: 10 mph</th><th>Wind speed</th><th>Wind from</th><th>Your hold</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        <div class="actions"><button id="drill-check" class="primary">Check</button></div>
        <div id="drill-explain"></div>
      </div>`,
    };
  }

  $('#drill-new').addEventListener('click', newDrill);
  $('#drill-type').addEventListener('change', newDrill);
  $('#drill-unit').addEventListener('change', newDrill);

  // -------------------------------------------------------------- range

  const range = { scenario: null, shotNo: 0 };
  const canvas = $('#scope');
  const ctx = canvas.getContext('2d');

  function onRangeShown() {
    $$('#tab-range .u').forEach((el) => { el.textContent = profile.unit; });
    const step = profile.unit === 'MOA' ? 0.25 : 0.1;
    $('#dial-elev').step = step;
    $('#dial-wind').step = step;
    $('#your-card-mini').innerHTML = cardHtml(profile, computeCard(profile), true);
    if (!range.scenario || range.scenario.unit !== profile.unit) newTarget();
    else drawScope();
  }

  function newTarget() {
    const p = profile;
    const maxR = Math.max(400, +p.rangeEnd);
    const minR = Math.min(300, maxR - 100);
    const yards = Math.round(rand(minR, maxR) / 5) * 5;
    const gusts = $('#opt-gusts').checked;
    const baseWind = randInt(0, 14);
    const clock = pick([1, 2, 3, 3, 4, 5, 7, 8, 9, 9, 10, 11, 12]);
    const mvOffset = $('#opt-truing').checked ? Math.round(pick([-1, 1]) * rand(30, 70)) : 0;
    const trueMv = +p.muzzleVelocityFps + mvOffset;
    const zeroAngleRad = B.solve(solverInput(p, { muzzleVelocityFps: trueMv, windMph: 0 }), [+p.zeroYards]).zeroAngleRad;

    range.scenario = {
      unit: p.unit,
      yards,
      baseWind,
      gustSpread: gusts ? 2 + Math.floor(baseWind / 5) : 0,
      clock,
      trueMv,
      mvOffset,
      zeroAngleRad,
      plateIn: Math.max(2, +$('#opt-plate').value || 12),
      precisionMoa: Math.max(0, +$('#opt-precision').value || 0),
      shots: [],
      revealed: false,
    };
    $('#dial-elev').value = 0;
    $('#dial-wind').value = 0;
    $('#range-feedback').innerHTML = '';
    renderBrief();
    drawScope();
  }

  function windCallText(s) {
    if (s.baseWind === 0) return 'Calm (0–2 mph, no consistent direction)';
    const speed = s.gustSpread
      ? `${Math.max(0, s.baseWind - s.gustSpread)}–${s.baseWind + s.gustSpread} mph`
      : `${s.baseWind} mph`;
    return `${speed} from ${s.clock} o'clock`;
  }

  function renderBrief() {
    const s = range.scenario;
    const plateUnits = toUnit(s.plateIn, s.yards, s.unit);
    $('#range-brief').innerHTML = `
      <div>Target: <span class="big">${s.yards} yd</span></div>
      <div>Wind call: <b>${windCallText(s)}</b></div>
      <div>Plate: ${s.plateIn}" (${plateUnits.toFixed(2)} ${s.unit} wide)</div>
      ${s.mvOffset ? '<div class="hint">Truing mode: your real MV differs from the card. Watch the vertical at long range.</div>' : ''}`;
  }

  function fireShot(e) {
    e.preventDefault();
    const s = range.scenario;
    if (!s) return;
    const p = profile;
    const dialE = parseFloat($('#dial-elev').value) || 0;
    const dialW = parseFloat($('#dial-wind').value) || 0;

    const windMph = s.baseWind === 0
      ? rand(0, 2)
      : Math.max(0, s.baseWind + (s.gustSpread ? rand(-s.gustSpread, s.gustSpread) : 0));
    const clock = s.baseWind === 0 ? rand(0, 12) : s.clock;
    const mv = s.trueMv + gauss() * 8; // 8 fps standard deviation
    const row = B.solve(solverInput(p, {
      muzzleVelocityFps: mv,
      windMph,
      windClock: clock,
      zeroAngleRad: s.zeroAngleRad,
      spinDrift: !!p.spinDrift,
    }), [s.yards]).rows[0];

    // Dispersion: treat stated precision as a 5-shot group size → sigma ≈ size / 3
    const sigmaIn = B.moaToInches(s.precisionMoa, s.yards) / 3;
    const upIn = row.dropIn + fromUnit(dialE, s.yards, s.unit) + gauss() * sigmaIn;
    const rightIn = row.windIn + fromUnit(dialW, s.yards, s.unit) + gauss() * sigmaIn;
    const hit = Math.hypot(upIn, rightIn) <= s.plateIn / 2;

    const up = toUnit(upIn, s.yards, s.unit);
    const right = toUnit(rightIn, s.yards, s.unit);
    range.shotNo++;
    s.shots.push({ up, right, hit });

    const click = s.unit === 'MOA' ? 0.25 : 0.1;
    const vWord = up >= 0 ? 'high' : 'low';
    const hWord = right >= 0 ? 'right' : 'left';
    const corrE = B.roundToClick(dialE - up, click);
    const corrW = B.roundToClick(dialW - right, click);
    $('#range-feedback').innerHTML = `
      <div class="${hit ? 'hit' : 'miss'}">${hit ? 'HIT — ding.' : 'MISS.'}</div>
      <div>Impact ${Math.abs(up).toFixed(2)} ${s.unit} ${vWord}, ${Math.abs(right).toFixed(2)} ${s.unit} ${hWord} of center.</div>
      ${hit ? '' : `<div class="hint">If that impact is representative, next dial: elev ${corrE.toFixed(decimalsFor(click))}, wind ${corrW.toFixed(decimalsFor(click))}. One shot is not a trend — dispersion and gusts add noise.</div>`}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${range.shotNo}</td><td>${s.yards}</td><td>${dialE}</td><td>${dialW}</td>` +
      `<td>${up.toFixed(2)} / ${right.toFixed(2)}</td><td>${hit ? 'hit' : 'miss'}</td>`;
    $('#shot-log tbody').prepend(tr);
    drawScope();
  }

  function revealSolution() {
    const s = range.scenario;
    if (!s) return;
    const p = profile;
    const click = s.unit === 'MOA' ? 0.25 : 0.1;
    const card = B.solve(solverInput(p, { windMph: s.baseWind, windClock: s.clock }), [s.yards]).rows[0];
    const truth = B.solve(solverInput(p, {
      muzzleVelocityFps: s.trueMv, windMph: s.baseWind, windClock: s.clock,
      zeroAngleRad: s.zeroAngleRad, spinDrift: !!p.spinDrift,
    }), [s.yards]).rows[0];
    const f = (inches) => fmtClick(toUnit(inches, s.yards, s.unit), click);
    $('#range-feedback').innerHTML += `
      <pre class="code">Card solution  (MV ${p.muzzleVelocityFps}): elev ${f(-card.dropIn)}, wind ${f(-card.windIn)} ${s.unit}
True solution  (MV ${s.trueMv}): elev ${f(-truth.dropIn)}, wind ${f(-truth.windIn)} ${s.unit}
${s.mvOffset ? `Hidden MV error: ${s.mvOffset > 0 ? '+' : ''}${s.mvOffset} fps. To true the card, change MV on the
Build tab until its elevation at ${s.yards} yd matches the elevation that hit.` : 'No MV error: any difference is wind, spin drift, or noise.'}</pre>`;
  }

  function drawScope() {
    const s = range.scenario;
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
    const css = getComputedStyle(document.documentElement);
    const lineColor = css.getPropertyValue('--scope-line').trim() || '#000';
    const bg = css.getPropertyValue('--scope-bg').trim() || '#eee';
    const unit = s ? s.unit : profile.unit;
    const half = unit === 'MOA' ? 18 : 5; // field of view half-width in units
    const px = (W / 2) / half;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (s) {
      // Steel plate centred on the aim point
      const r = toUnit(s.plateIn / 2, s.yards, unit) * px;
      ctx.fillStyle = 'rgba(140, 145, 150, 0.85)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }

    // Reticle: crosshair with a hash every unit (MIL) or every 2 MOA
    ctx.strokeStyle = lineColor;
    ctx.fillStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.stroke();
    const step = unit === 'MOA' ? 2 : 1;
    ctx.font = '11px system-ui, sans-serif';
    for (let v = step; v <= half; v += step) {
      [-1, 1].forEach((sgn) => {
        const d = sgn * v * px;
        ctx.beginPath();
        ctx.moveTo(cx + d, cy - 6); ctx.lineTo(cx + d, cy + 6);
        ctx.moveTo(cx - 6, cy + d); ctx.lineTo(cx + 6, cy + d);
        ctx.stroke();
      });
      ctx.fillText(String(v), cx + v * px - 3, cy + 18);
      ctx.fillText(String(v), cx + 9, cy + v * px + 4);
    }
    // half-unit hashes
    for (let v = step / 2; v <= half; v += step) {
      [-1, 1].forEach((sgn) => {
        const d = sgn * v * px;
        ctx.beginPath();
        ctx.moveTo(cx + d, cy - 3); ctx.lineTo(cx + d, cy + 3);
        ctx.moveTo(cx - 3, cy + d); ctx.lineTo(cx + 3, cy + d);
        ctx.stroke();
      });
    }
    ctx.fillText(unit, 8, H / 2 - 8);

    if (!s) return;
    s.shots.forEach((shot, i) => {
      const last = i === s.shots.length - 1;
      let x = cx + shot.right * px;
      let y = cy - shot.up * px;
      const off = x < 6 || x > W - 6 || y < 6 || y > H - 6;
      x = Math.min(W - 6, Math.max(6, x));
      y = Math.min(H - 6, Math.max(6, y));
      ctx.beginPath();
      ctx.arc(x, y, last ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = shot.hit ? '#2f7a3a' : '#b23a2e';
      ctx.globalAlpha = last ? 1 : 0.5;
      if (off) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.stroke(); }
      else ctx.fill();
      ctx.globalAlpha = 1;
      if (last) {
        ctx.fillStyle = lineColor;
        ctx.fillText(String(i + 1), x + 8, y - 8);
      }
    });
  }

  $('#range-new').addEventListener('click', newTarget);
  $('#fire-form').addEventListener('submit', fireShot);
  $('#range-reveal').addEventListener('click', revealSolution);
})();
