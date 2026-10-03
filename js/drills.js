/* Drills tab: graded card-writing exercises with streaks, a timer and XP. */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;

  const st = {
    type: 'convert',
    unit: 'MIL',
    current: null,
    started: 0,
    tick: 0,
    streak: 0,
    cellsRight: L.store.get('drill.right', 0),
    cellsTotal: L.store.get('drill.total', 0),
  };

  L.seg($('#drill-type'), (v) => { st.type = v; newDrill(); });
  L.seg($('#drill-unit'), (v) => { st.unit = v; newDrill(); });
  $('#drill-new').addEventListener('click', newDrill);

  function renderStats() {
    $('#drill-streak').textContent = st.streak;
    $('#drill-acc').textContent = st.cellsTotal ? Math.round(st.cellsRight / st.cellsTotal * 100) + '%' : '–';
  }

  function startTimer() {
    clearInterval(st.tick);
    st.started = Date.now();
    const el = $('#drill-timer');
    const draw = () => {
      const s = Math.floor((Date.now() - st.started) / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    draw();
    st.tick = setInterval(draw, 500);
  }

  function randomLoad() {
    const base = L.pick(L.PRESETS);
    return Object.assign({}, L.DEFAULT_PROFILE, base, {
      muzzleVelocityFps: Math.round(base.muzzleVelocityFps + L.rand(-80, 80)),
      altitudeFt: L.pick([0, 1000, 2500, 4000, 5500]),
      tempF: L.randInt(30, 95),
    });
  }

  const within = (answer, exact, tol) => Number.isFinite(answer) && Math.abs(answer - exact) <= tol + 1e-9;
  const inputCell = (id) => `<td class="cell"><input class="drill-input" id="${id}" type="number" step="any" inputmode="decimal"></td>`;

  function newDrill() {
    const unit = st.unit;
    const click = L.clickFor(unit);
    const load = randomLoad();
    const make = { convert: makeConvert, interp: makeInterp, wind: makeWind }[st.type];
    st.current = make(load, unit, click);
    $('#drill-body').innerHTML = `<div class="card">${st.current.html}
      <div class="actions"><button id="drill-check" class="btn primary">Check answers</button></div>
      <div id="drill-explain"></div></div>`;
    $('#drill-check').addEventListener('click', check);
    const first = $('#drill-body input');
    if (first) first.focus({ preventScroll: true });
    startTimer();
  }

  function check() {
    const d = st.current;
    if (!d || d.checked) return;
    d.checked = true;
    clearInterval(st.tick);
    const secs = Math.round((Date.now() - st.started) / 1000);
    let ok = 0;
    d.cells.forEach((c) => {
      const input = $('#' + c.id);
      const good = c.grade(parseFloat(input.value));
      const td = input.parentElement;
      td.classList.add(good ? 'ok' : 'no');
      if (!good) td.insertAdjacentHTML('beforeend', `<span class="exp">→ ${c.expected}</span>`);
      if (good) ok++;
    });
    const n = d.cells.length;
    st.cellsRight += ok;
    st.cellsTotal += n;
    L.store.set('drill.right', st.cellsRight);
    L.store.set('drill.total', st.cellsTotal);
    const perfect = ok === n;
    st.streak = perfect ? st.streak + 1 : 0;
    renderStats();

    const fast = perfect && secs <= 20 * n;
    const xp = ok * 5 + (perfect ? 20 : 0) + (fast ? 15 : 0) + (perfect && st.streak >= 3 ? 10 : 0);
    const cls = perfect ? 'good' : ok >= n / 2 ? 'mid' : 'bad';
    const msg = perfect
      ? `Perfect — ${n}/${n} in ${secs}s${fast ? ' (speed bonus)' : ''}${st.streak >= 2 ? ` · ${st.streak} in a row` : ''}`
      : `${ok}/${n} correct. Red cells show the expected value. Read the worked solution below.`;
    $('#drill-explain').innerHTML = `<div class="result-banner ${cls}">${msg}</div>
      <h3 style="margin-top:16px">Worked solution</h3>${d.explain}
      <div class="actions"><button class="btn primary" id="drill-next">Next problem →</button></div>`;
    $('#drill-next').addEventListener('click', newDrill);
    $('#drill-next').focus({ preventScroll: true });
    if (perfect) {
      L.sfx.good();
      const r = $('#drill-check').getBoundingClientRect();
      L.confetti(r.left + r.width / 2, r.top);
    } else {
      L.sfx.bad();
    }
    L.addXp(xp, perfect ? 'perfect drill' : 'drill');
  }

  // Enter checks, then advances
  $('#drill-body').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (st.current && !st.current.checked) {
      const inputs = $$('#drill-body input');
      const i = inputs.indexOf(e.target);
      const nextEmpty = inputs.slice(i + 1).find((x) => x.value === '');
      if (i >= 0 && nextEmpty) nextEmpty.focus();
      else check();
    } else {
      newDrill();
    }
  });

  // --------------------------------------------------------- generators

  function makeConvert(load, unit, click) {
    const pool = [200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const ranges = [];
    while (ranges.length < 4) {
      const r = L.pick(pool);
      if (!ranges.includes(r)) ranges.push(r);
    }
    ranges.sort((a, b) => a - b);
    const sol = B.solve(L.solverInput(load, { windMph: 10, windClock: 3 }), ranges).rows;
    const k = unit === 'MOA' ? B.IN_PER_MOA_100 : B.IN_PER_MIL_100;
    const tol = click / 2;
    const cells = [];
    const body = sol.map((r, i) => {
      const elev = L.toUnit(-r.dropIn, r.yards, unit);
      const w10 = L.toUnit(-r.windIn, r.yards, unit);
      const ids = ['e', 'c', 'w10', 'w5'].map((s) => `cv-${s}-${i}`);
      cells.push(
        { id: ids[0], expected: L.fmtClick(elev, click), grade: (v) => within(v, elev, tol) },
        { id: ids[1], expected: B.toClicks(elev, click), grade: (v) => within(v, elev / click, 0.5) },
        { id: ids[2], expected: L.fmtClick(w10, click), grade: (v) => within(v, w10, tol) },
        { id: ids[3], expected: L.fmtClick(w10 / 2, click), grade: (v) => within(v, w10 / 2, tol) },
      );
      return `<tr><td>${r.yards}</td><td>${(-r.dropIn).toFixed(1)}</td><td>${(-r.windIn).toFixed(1)}</td>` +
        ids.map(inputCell).join('') + '</tr>';
    }).join('');
    const explain = `<pre class="code">${sol.map((r) => {
      const inch = (k * r.yards / 100).toFixed(3);
      const e = L.toUnit(-r.dropIn, r.yards, unit);
      const w = L.toUnit(-r.windIn, r.yards, unit);
      return `${r.yards} yd: 1 ${unit} = ${k} × ${r.yards}/100 = ${inch} in\n` +
        `  elev   = ${(-r.dropIn).toFixed(1)} / ${inch} = ${e.toFixed(3)} → ${L.fmtClick(e, click)} ${unit} = ${B.toClicks(e, click)} clicks\n` +
        `  wind10 = ${(-r.windIn).toFixed(1)} / ${inch} = ${w.toFixed(3)} → ${L.fmtClick(w, click)}   wind5 = half → ${L.fmtClick(w / 2, click)}`;
    }).join('\n')}</pre>`;
    return {
      cells,
      explain,
      html: `<div class="eyebrow">Convert</div>
        <p class="drill-task">The solver gave raw output in <b>inches</b> for a ${L.escapeHtml(load.name)} (MV ${load.muzzleVelocityFps} fps, ${load.zeroYards} yd zero).
        Write the card cells in <b>${unit}</b>, rounded to the nearest click (${click}).</p>
        <p class="hint">Drop = inches below the line of sight (dial UP). Drift = inches pushed left by a 10 mph full-value wind (hold RIGHT).</p>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Yds</th><th>Drop in</th><th>Drift @10</th><th>Elev ${unit}</th><th>Clicks</th><th>Wind 10</th><th>Wind 5</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>`,
    };
  }

  function makeInterp(load, unit, click) {
    const p = Object.assign({}, load, { unit, clickSize: click, rangeStart: 100, rangeEnd: 1000, rangeStep: 100, windBrackets: '10' });
    const card = L.computeCard(p);
    const lo = L.randInt(3, 9) * 100;
    const target = lo + L.randInt(1, 19) * 5;
    const a = card.rows.find((r) => r.yards === lo);
    const b = card.rows.find((r) => r.yards === lo + 100);
    const ea = B.roundToClick(a.elev, click), eb = B.roundToClick(b.elev, click);
    const wa = B.roundToClick(a.winds[0], click), wb = B.roundToClick(b.winds[0], click);
    const f = (target - lo) / 100;
    const eInterp = ea + (eb - ea) * f;
    const wInterp = wa + (wb - wa) * f;
    const truth = B.solve(L.solverInput(p, { windMph: 10, windClock: 3 }), [target]).rows[0];
    const eTrue = L.toUnit(-truth.dropIn, target, unit);
    const wTrue = L.toUnit(-truth.windIn, target, unit);
    const tol = click / 2;
    const dp = L.decimalsFor(click);
    const cells = [
      { id: 'ip-e', expected: L.fmtClick(eInterp, click), grade: (v) => within(v, eInterp, tol) || within(v, eTrue, tol) },
      { id: 'ip-w', expected: L.fmtClick(wInterp, click), grade: (v) => within(v, wInterp, tol) || within(v, wTrue, tol) },
    ];
    const explain = `<pre class="code">fraction = (${target} − ${lo}) / 100 = ${f.toFixed(2)}
elev = ${ea.toFixed(dp)} + (${eb.toFixed(dp)} − ${ea.toFixed(dp)}) × ${f.toFixed(2)} = ${eInterp.toFixed(3)} → ${L.fmtClick(eInterp, click)} ${unit}
wind = ${wa.toFixed(dp)} + (${wb.toFixed(dp)} − ${wa.toFixed(dp)}) × ${f.toFixed(2)} = ${wInterp.toFixed(3)} → ${L.fmtClick(wInterp, click)} ${unit}

Solver truth at ${target} yd: elev ${eTrue.toFixed(3)}, wind ${wTrue.toFixed(3)} ${unit}.
Linear interpolation slightly OVER-estimates elevation: the drop curve bends
upward (it is convex), so the straight line between two rows sits above it.
This is why long-range cards use 25–50 yd steps past ~600 yd.</pre>`;
    const slice = { rows: card.rows.filter((r) => r.yards >= lo - 100 && r.yards <= lo + 200), brackets: card.brackets, atmosphere: card.atmosphere };
    return {
      cells,
      explain,
      html: `<div class="eyebrow">Interpolate</div>
        <p class="drill-task">Your rangefinder reads <b class="mono" style="font-size:20px">${target} yd</b>. Your card only has 100 yd rows.
        Interpolate the elevation and the 10 mph wind hold, to the nearest click.</p>
        ${L.cardHtml(p, slice, true)}
        <div class="table-wrap" style="margin-top:14px"><table class="tbl" style="max-width:420px">
          <thead><tr><th>Range</th><th>Elev ${unit}</th><th>Wind 10 mph</th></tr></thead>
          <tbody><tr><td>${target}</td>${inputCell('ip-e')}${inputCell('ip-w')}</tr></tbody>
        </table></div>`,
    };
  }

  const clockFactor = (clock) => Math.abs(Math.sin(clock * Math.PI / 6));
  const clockLabel = (clock) => (clock % 1 ? `${Math.floor(clock)}:30` : String(clock));

  function makeWind(load, unit, click) {
    const p = Object.assign({}, load, { unit, clickSize: click });
    const rows = [];
    const cells = [];
    const tol = click; // wind calls are coarse: allow one click
    for (let i = 0; i < 3; i++) {
      const yards = L.randInt(4, 10) * 100;
      const w10 = L.toUnit(-B.solve(L.solverInput(p, { windMph: 10, windClock: 3 }), [yards]).rows[0].windIn, yards, unit);
      const w10card = B.roundToClick(w10, click);
      const speed = L.randInt(3, 18);
      const clock = L.pick([1, 1.5, 2, 3, 4, 4.5, 5, 7, 7.5, 8, 9, 10, 10.5, 11, 12]);
      // From the right (1–5 o'clock) pushes left → hold right (+). From the left → hold left (−).
      const sign = clock > 0 && clock < 6 ? 1 : clock > 6 && clock < 12 ? -1 : 0;
      const ans = sign * w10card * speed / 10 * clockFactor(clock);
      const id = `wd-${i}`;
      cells.push({ id, expected: (ans > 0 ? '+' : '') + L.fmtClick(ans, click), grade: (v) => within(v, ans, tol) });
      rows.push({ yards, w10card, speed, clock, ans, id });
    }
    const dp = L.decimalsFor(click);
    const body = rows.map((r) => `<tr><td>${r.yards}</td><td>${r.w10card.toFixed(dp)}</td><td>${r.speed} mph</td>` +
      `<td>${clockDial(r.clock)} ${clockLabel(r.clock)}</td>${inputCell(r.id)}</tr>`).join('');
    const explain = `<pre class="code">hold = card_10mph × (speed / 10) × |sin(clock × 30°)|   sign: from right → hold right (+)
${rows.map((r) => `${r.yards} yd: ${r.w10card.toFixed(dp)} × ${r.speed}/10 × ${clockFactor(r.clock).toFixed(2)} = ${r.ans.toFixed(3)} → ${L.fmtClick(r.ans, click)} ${unit}`).join('\n')}

Clock values:  3 / 9 → 1.0   2, 4, 8, 10 → 0.87   1:30, 4:30… → 0.71
               1, 5, 7, 11 → 0.5   12 / 6 → 0 (head/tail: no drift)</pre>`;
    return {
      cells,
      explain,
      html: `<div class="eyebrow">Wind call</div>
        <p class="drill-task">Your card gives the hold for a <b>10 mph full-value</b> wind. Convert each wind call into a hold in <b>${unit}</b>.
        Enter <b>+ for right</b>, <b>− for left</b>. Graded to within one click.</p>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Yds</th><th>Card 10 mph</th><th>Speed</th><th>From</th><th>Your hold</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>`,
    };
  }

  // Tiny clock face showing where the wind comes from (shooter at center, target at 12)
  function clockDial(clock) {
    const a = clock * Math.PI / 6;
    const x = Math.sin(a) * 8, y = -Math.cos(a) * 8;
    return `<svg width="22" height="22" viewBox="-11 -11 22 22" style="vertical-align:middle">
      <circle r="10" fill="none" stroke="currentColor" stroke-opacity=".35"/>
      <line x1="${x}" y1="${y}" x2="0" y2="0" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="${x}" cy="${y}" r="2.6" fill="var(--accent)"/></svg>`;
  }

  renderStats();
  L.onTab('drill', () => { if (!st.current) newDrill(); });
})();
