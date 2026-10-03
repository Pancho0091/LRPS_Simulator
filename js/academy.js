/*
 * Academy tab: lesson navigation, progress, quizzes, and interactive
 * widgets that run on the real solver (window.LRPS_ACADEMY holds the content).
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;
  const CHAPTERS = window.LRPS_ACADEMY;

  const lessons = [];
  CHAPTERS.forEach((ch, ci) => ch.lessons.forEach((ls, li) => lessons.push(Object.assign({ ch, ci, li }, ls))));

  let done = L.store.get('academy.done', {});
  let current = L.store.get('academy.last', lessons[0].id);
  if (!lessons.some((l) => l.id === current)) current = lessons[0].id;

  // ------------------------------------------------------------ sidebar

  function renderSide() {
    const total = lessons.length;
    const n = lessons.filter((l) => done[l.id]).length;
    $('#ac-progress').innerHTML = `<div class="ac-prog-top"><b>${n}/${total}</b> lessons · ${Math.round(n / total * 100)}%</div>
      <div class="xp-bar"><span style="width:${n / total * 100}%"></span></div>`;
    $('#ac-nav').innerHTML = CHAPTERS.map((ch, ci) => {
      const chDone = ch.lessons.filter((l) => done[l.id]).length;
      return `<div class="ac-ch">
        <div class="ac-ch-title"><span class="num">${String(ci + 1).padStart(2, '0')}</span>${ch.title}<span class="ac-ch-count">${chDone}/${ch.lessons.length}</span></div>
        ${ch.lessons.map((l) => `<button class="ac-link${l.id === current ? ' on' : ''}${done[l.id] ? ' done' : ''}" data-lesson="${l.id}">
          <span class="ac-dot"></span>${l.title}</button>`).join('')}
      </div>`;
    }).join('');
    $('#ac-select').innerHTML = lessons.map((l) =>
      `<option value="${l.id}"${l.id === current ? ' selected' : ''}>${done[l.id] ? '✓ ' : ''}${l.ci + 1}.${l.li + 1} ${l.title}</option>`).join('');
  }

  $('#ac-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lesson]');
    if (b) open(b.dataset.lesson);
  });
  $('#ac-select').addEventListener('change', (e) => open(e.target.value));

  // ------------------------------------------------------------ lesson

  function open(id, noScroll) {
    current = id;
    L.store.set('academy.last', id);
    const idx = lessons.findIndex((l) => l.id === id);
    const l = lessons[idx];
    const prev = lessons[idx - 1], next = lessons[idx + 1];
    $('#ac-main').innerHTML = `
      <div class="eyebrow">Chapter ${l.ci + 1} · ${l.ch.title}</div>
      <h2 class="ac-title">${l.title}</h2>
      ${l.mins ? `<div class="hint ac-meta">${l.mins} min read${done[l.id] ? ' · <span style="color:var(--good)">completed</span>' : ''}</div>` : ''}
      <div class="ac-body">${l.html}</div>
      <div id="ac-quiz"></div>
      <div class="ac-nav-row">
        ${prev ? `<button class="btn" data-open="${prev.id}">← ${prev.title}</button>` : '<span></span>'}
        ${next ? `<button class="btn primary" data-open="${next.id}">${next.title} →</button>` : ''}
      </div>`;
    // Wide tables scroll inside their own box on small screens
    $$('.ac-body table', $('#ac-main')).forEach((t) => {
      if (t.parentElement.classList.contains('table-wrap')) return;
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });
    $$('[data-open]', $('#ac-main')).forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));
    $$('[data-widget]', $('#ac-main')).forEach((el) => {
      const w = WIDGETS[el.dataset.widget];
      if (w) w(el);
    });
    renderQuiz(l);
    renderSide();
    if (!noScroll) $('#tab-academy').scrollIntoView({ block: 'start' });
  }

  function complete(l, xp) {
    if (done[l.id]) return;
    done[l.id] = true;
    L.store.set('academy.done', done);
    renderSide();
    L.addXp(xp, 'lesson complete');
    const chDone = l.ch.lessons.every((x) => done[x.id]);
    if (chDone && l.ch.lessons.length > 1) {
      setTimeout(() => { L.toast(`Chapter complete: ${l.ch.title}`, 'xp big'); L.confetti(); L.sfx.good(); }, 500);
    }
  }

  function renderQuiz(l) {
    const box = $('#ac-quiz');
    if (!l.quiz || !l.quiz.length) {
      box.innerHTML = done[l.id] ? '' : '<div class="actions"><button class="btn" id="ac-done">Mark as read</button></div>';
      const b = $('#ac-done');
      if (b) b.addEventListener('click', () => { complete(l, 10); renderQuiz(l); });
      return;
    }
    const answers = new Array(l.quiz.length).fill(null);
    box.innerHTML = `<div class="quiz">
      <div class="card-title" style="margin-bottom:6px"><h3>Check your model</h3><span class="hint">${l.quiz.length} question${l.quiz.length > 1 ? 's' : ''}</span></div>
      ${l.quiz.map((q, qi) => `<div class="qz" data-q="${qi}">
        <div class="qz-q">${qi + 1}. ${q.q}</div>
        <div class="qz-opts">${q.options.map((o, oi) => `<button class="qz-opt" data-o="${oi}">${o}</button>`).join('')}</div>
        <div class="qz-why"></div>
      </div>`).join('')}
      <div id="qz-result"></div></div>`;
    $$('.qz', box).forEach((qel) => {
      const qi = +qel.dataset.q;
      const q = l.quiz[qi];
      $$('.qz-opt', qel).forEach((b) => b.addEventListener('click', () => {
        if (answers[qi] != null) return;
        const oi = +b.dataset.o;
        answers[qi] = oi;
        const right = oi === q.answer;
        b.classList.add(right ? 'right' : 'wrong');
        $$('.qz-opt', qel)[q.answer].classList.add('right');
        $$('.qz-opt', qel).forEach((x) => { x.disabled = true; });
        $('.qz-why', qel).innerHTML = `<b>${right ? 'Correct.' : 'Not quite.'}</b> ${q.why}`;
        (right ? L.sfx.good : L.sfx.bad)();
        if (answers.every((a) => a != null)) finish();
      }));
    });
    function finish() {
      const score = answers.filter((a, i) => a === l.quiz[i].answer).length;
      const perfect = score === l.quiz.length;
      $('#qz-result').innerHTML = `<div class="result-banner ${perfect ? 'good' : 'mid'}">${perfect
        ? `${score}/${l.quiz.length} — lesson complete.`
        : `${score}/${l.quiz.length}. Re-read the rule at the top and try again.`}</div>
        ${perfect ? '' : '<div class="actions"><button class="btn" id="qz-retry">Retry quiz</button></div>'}`;
      if (perfect) complete(l, 10 + 5 * l.quiz.length);
      else $('#qz-retry').addEventListener('click', () => renderQuiz(l));
    }
  }

  // ------------------------------------------------------------ widgets

  const unit = () => 'MIL';
  const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '–');

  function field(id, label, value, attrs) {
    return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" ${attrs || ''}></div>`;
  }

  function widgetShell(el, title, body) {
    el.innerHTML = `<div class="widget"><div class="widget-title"><span class="widget-tag">Try it</span>${title}</div>${body}</div>`;
    return el.firstChild;
  }

  const WIDGETS = {
    'drag-curves'(el) {
      const box = widgetShell(el, 'Drag coefficient vs Mach', '<div class="w-chart"></div>');
      const pts = (t) => t.filter((p) => p[0] <= 3).map((p) => [p[0], p[1]]);
      L.lineChart($('.w-chart', box), {
        series: [{ points: pts(B.G1), cls: 'info', label: 'G1 (flat base)' }, { points: pts(B.G7), cls: 'accent', label: 'G7 (boat tail)' }],
        xMax: 3, xStep: 0.5, xFmt: (v) => v.toFixed(1), xLabel: 'Mach', yLabel: 'Cd', shadeFrom: 0.8, shadeTo: 1.2,
        tip: (x, ys) => `Mach ${x.toFixed(2)}<br>G1 ${ys[0].toFixed(3)}<br>G7 ${ys[1].toFixed(3)}`,
      });
    },

    'density-altitude'(el) {
      const box = widgetShell(el, 'Density altitude and your card', `
        <div class="w-grid">${field('w-da-alt', 'Altitude (ft)', 0, 'step="500"')}${field('w-da-t', 'Temperature (°F)', 59)}${field('w-da-h', 'Humidity (%)', 30, 'step="10"')}</div>
        <div class="tiles w-out"></div><p class="hint">Elevation for your current Build Card load at 1000 yd, versus a standard day.</p>`);
      const run = () => {
        const a = +$('#w-da-alt').value || 0, t = +$('#w-da-t').value, h = +$('#w-da-h').value || 0;
        const atm = B.atmosphere({ altitudeFt: a, tempF: t, humidityPct: h });
        const p = L.profile;
        const here = B.solve(L.solverInput(p, { altitudeFt: a, tempF: t, humidityPct: h, windMph: 0 }), [1000]).rows[0];
        const std = B.solve(L.solverInput(p, { altitudeFt: 0, tempF: 59, humidityPct: 0, windMph: 0 }), [1000]).rows[0];
        const u = unit();
        const e = L.toUnit(-here.dropIn, 1000, u), e0 = L.toUnit(-std.dropIn, 1000, u);
        $('.w-out', box).innerHTML = tile('Density altitude', Math.round(atm.densityAltitudeFt), 'ft') +
          tile('Air density', fmt(atm.rho / 1.225 * 100, 1), '% of std') +
          tile('Elev @1000', fmt(e, 2), u) + tile('vs standard day', (e - e0 >= 0 ? '+' : '') + fmt(e - e0, 2), u);
      };
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    'wind-clock'(el) {
      const box = widgetShell(el, 'Click where the wind comes from', '<div class="w-clock-row"><div class="w-clock"></div><div class="w-clock-out"></div></div>');
      const holds = (clock) => {
        const p = L.profile;
        const u = unit();
        const r = B.solve(L.solverInput(p, { windMph: 10, windClock: clock }), [800]).rows[0];
        return { v: Math.abs(Math.sin(clock * Math.PI / 6)), hold: L.toUnit(-r.windIn, 800, u), u };
      };
      let sel = 3;
      const draw = () => {
        let svg = '<svg viewBox="-60 -60 120 120"><circle r="50" class="w-face"/>';
        for (let k = 1; k <= 12; k++) {
          const a = k * Math.PI / 6;
          const x = Math.sin(a) * 42, y = -Math.cos(a) * 42;
          svg += `<g class="w-hr${k === sel ? ' on' : ''}" data-k="${k}"><circle cx="${x}" cy="${y}" r="7.5"/><text x="${x}" y="${y + 3}" text-anchor="middle">${k}</text></g>`;
        }
        const a = sel * Math.PI / 6;
        svg += `<line x1="${Math.sin(a) * 33}" y1="${-Math.cos(a) * 33}" x2="0" y2="0" class="w-arrow"/>`;
        svg += '<circle r="3" class="w-center"/><text y="-22" text-anchor="middle" class="w-tgt">target</text></svg>';
        $('.w-clock', box).innerHTML = svg;
        const h = holds(sel);
        $('.w-clock-out', box).innerHTML = `<div class="tile"><div class="label">Wind value</div><div class="value">${fmt(h.v, 2)}</div></div>
          <div class="tile"><div class="label">Hold @800 yd, 10 mph</div><div class="value">${h.hold >= 0 ? 'R ' : 'L '}${fmt(Math.abs(h.hold), 2)}<small>${h.u}</small></div></div>
          <p class="hint">${h.v > 0.95 ? 'Full value.' : h.v > 0.8 ? 'Near full value.' : h.v > 0.6 ? 'About ¾ value.' : h.v > 0.3 ? 'Half value.' : 'Head/tail wind: almost no drift.'}</p>`;
        $$('.w-hr', box).forEach((g) => g.addEventListener('click', () => { sel = +g.dataset.k; L.sfx.click(); draw(); }));
      };
      draw();
    },

    coriolis(el) {
      const box = widgetShell(el, 'Coriolis at 1000 yd (your Build Card load)', `
        <div class="w-grid">
          <div class="slider"><div class="slider-head"><label>Latitude</label><output id="w-co-lat-o"></output></div><input type="range" id="w-co-lat" min="-70" max="70" value="40"></div>
          <div class="slider"><div class="slider-head"><label>Shooting direction (azimuth)</label><output id="w-co-az-o"></output></div><input type="range" id="w-co-az" min="0" max="359" value="90"></div>
        </div><div class="tiles w-out"></div>`);
      const dirName = (az) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8];
      const run = () => {
        const lat = +$('#w-co-lat').value, az = +$('#w-co-az').value;
        $('#w-co-lat-o').textContent = `${Math.abs(lat)}° ${lat >= 0 ? 'N' : 'S'}`;
        $('#w-co-az-o').textContent = `${az}° ${dirName(az)}`;
        const p = L.profile;
        const a = B.solve(L.solverInput(p, { windMph: 0 }), [1000]).rows[0];
        const c = B.solve(L.solverInput(p, { windMph: 0, coriolis: true, latitudeDeg: lat, azimuthDeg: az }), [1000]).rows[0];
        const u = unit();
        const v = L.toUnit(c.dropIn - a.dropIn, 1000, u), h = L.toUnit(c.windIn - a.windIn, 1000, u);
        $('.w-out', box).innerHTML = tile('Vertical', `${v >= 0 ? '▲' : '▼'} ${fmt(Math.abs(v), 3)}`, u) +
          tile('Horizontal', `${h >= 0 ? '▶' : '◀'} ${fmt(Math.abs(h), 3)}`, u) +
          tile('In inches', `${fmt(c.dropIn - a.dropIn, 1)} / ${fmt(c.windIn - a.windIn, 1)}`, 'up / right');
      };
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    stability(el) {
      const box = widgetShell(el, 'Stability calculator (Miller)', `
        <div class="field"><label>Load a system</label><select id="w-st-pre">${L.PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}</select></div>
        <div class="w-grid">${field('w-st-w', 'Weight (gr)', 140)}${field('w-st-d', 'Diameter (in)', 0.264, 'step="0.001"')}${field('w-st-l', 'Length (in)', 1.37, 'step="0.01"')}
        ${field('w-st-t', 'Twist (1:x in)', 8, 'step="0.25"')}${field('w-st-v', 'MV (fps)', 2710, 'step="10"')}${field('w-st-temp', 'Temp (°F)', 59)}</div>
        <div class="gauge"><div class="gauge-zones"><span class="z-bad">unstable</span><span class="z-mid">marginal</span><span class="z-good">stable</span></div><div class="gauge-needle"></div></div>
        <div class="tiles w-out"></div>`);
      const load = (i) => {
        const p = L.PRESETS[i];
        $('#w-st-w').value = p.bulletWeightGr; $('#w-st-d').value = p.bulletDiameterIn; $('#w-st-l').value = p.bulletLengthIn;
        $('#w-st-t').value = p.twistIn; $('#w-st-v').value = p.muzzleVelocityFps;
      };
      const run = () => {
        const args = {
          bulletWeightGr: +$('#w-st-w').value, bulletDiameterIn: +$('#w-st-d').value, bulletLengthIn: +$('#w-st-l').value,
          twistIn: +$('#w-st-t').value, muzzleVelocityFps: +$('#w-st-v').value, tempF: +$('#w-st-temp').value,
        };
        const sg = B.millerStability(args);
        if (!sg) return;
        const pos = Math.max(0, Math.min(100, sg / 3 * 100));
        $('.gauge-needle', box).style.left = pos + '%';
        const need = args.twistIn * Math.sqrt(sg / 1.5);
        const cold = B.millerStability(Object.assign({}, args, { tempF: 0 }));
        $('.w-out', box).innerHTML = tile('Sg', fmt(sg, 2), sg < 1 ? 'unstable' : sg < 1.4 ? 'marginal' : 'stable') +
          tile('Slowest twist for Sg 1.5', `1:${fmt(need, 1)}`, 'in') + tile('Sg at 0°F', fmt(cold, 2), '');
      };
      $('#w-st-pre').addEventListener('change', (e) => { load(+e.target.value); run(); });
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      const idx = L.PRESETS.findIndex((p) => p.name === L.profile.name);
      if (idx >= 0) { $('#w-st-pre').value = idx; load(idx); }
      run();
    },

    'unit-converter'(el) {
      const box = widgetShell(el, 'Angular unit converter', `
        <div class="w-grid">${field('w-uc-v', 'Value', 1, 'step="0.1"')}
          <div class="field"><label>Unit</label><select id="w-uc-u"><option>MIL</option><option value="IN">inches</option><option value="CM">cm</option></select></div>
          ${field('w-uc-r', 'Range (yd)', 600, 'step="25"')}</div>
        <div class="tiles w-out"></div>`);
      const run = () => {
        const v = +$('#w-uc-v').value, u = $('#w-uc-u').value, r = +$('#w-uc-r').value || 100;
        const k = r / 100;
        const inches = u === 'MIL' ? v * 3.6 * k : u === 'CM' ? v / 2.54 : v;
        const mil = inches / (3.6 * k);
        $('.w-out', box).innerHTML = tile('Inches', fmt(inches, 2), 'in') + tile('MIL', fmt(mil, 3), `${Math.round(mil / 0.1)} clk`) +
          tile('Clicks', Math.round(mil / 0.1), '0.1 mil') + tile('cm', fmt(inches * 2.54, 1), 'cm');
      };
      $$('input, select', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    'mil-ranging'(el) {
      const box = widgetShell(el, 'Reticle ranging calculator', `
        <div class="actions" style="margin:0 0 10px">${[['12" plate', 12], ['18" IPSC width', 18], ['30" IPSC height', 30], ['Deer chest ~18"', 18], ['1 m target', 39.37]]
          .map(([n, v]) => `<button class="btn" data-size="${v}">${n}</button>`).join('')}</div>
        <div class="w-grid">${field('w-mr-s', 'Target size (in)', 18, 'step="1"')}${field('w-mr-m', 'Measured (mil)', 0.8, 'step="0.05"')}</div>
        <div class="tiles w-out"></div>`);
      const run = () => {
        const size = +$('#w-mr-s').value, mil = +$('#w-mr-m').value;
        const ry = mil > 0 ? size * 27.78 / mil : NaN;
        const err = mil > 0.1 ? size * 27.78 / (mil - 0.05) - ry : NaN;
        $('.w-out', box).innerHTML = tile('Range', fmt(ry, 0), 'yd') +
          tile('If you misread by 0.05 mil', `±${fmt(err, 0)}`, 'yd') + tile('In meters', fmt(ry * 0.9144, 0), 'm');
      };
      $$('[data-size]', box).forEach((b) => b.addEventListener('click', () => { $('#w-mr-s').value = b.dataset.size; run(); }));
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    'card-anatomy'(el) {
      const p = Object.assign({}, L.profile, { rangeStart: 300, rangeEnd: 1000, rangeStep: 100 });
      const card = L.computeCard(p);
      widgetShell(el, `Your current card (${L.escapeHtml(p.name || 'custom')})`, `${L.cardHtml(p, card, false)}
        <ol class="w-anno">
          <li><b>Header chips</b> — load, MV, zero, sight height, click value and the DA the card is valid for.</li>
          <li><b>Elev ↑</b> — dial-up value, already rounded to the nearest click.</li>
          <li><b>Clk</b> — the same number in turret clicks, for dialing without looking.</li>
          <li><b>Wind hold columns</b> — full-value holds per wind bracket. Scale for speed and clock value.</li>
          <li><b>Amber / red rows</b> — transonic and subsonic: true these with field data.</li>
        </ol>
        <p class="hint">Change the load on <a data-goto="build">Build Card</a> and come back — this card follows it.</p>`);
    },

    'cartridge-table'(el) {
      const u = unit();
      const notes = {
        '.223 Rem 77 TMK': ['Very low', '5,000+'], '6mm Creedmoor 108 ELD-M': ['Low', '2,000–3,000'],
        '6.5 Creedmoor 140 ELD-M': ['Low–moderate', '2,500–3,500'], '6.5 PRC 147 ELD-M': ['Moderate', '1,500–2,000'],
        '.308 Win 175 SMK': ['Moderate', '5,000+'], '.300 Win Mag 215 Hybrid': ['High', '1,500–2,500'],
        '.300 PRC 225 ELD-M': ['High', '1,500–2,500'], '.338 Lapua 300 Hybrid': ['Very high', '2,000–3,000'],
      };
      const ranges = [];
      for (let r = 25; r <= 1600; r += 25) ranges.push(r);
      const rows = L.PRESETS.map((p) => {
        const res = B.solve(L.solverInput(Object.assign({}, L.DEFAULT_PROFILE, p), { windMph: 10, windClock: 3 }), ranges);
        const r1k = res.rows.find((r) => r.yards === 1000);
        const trans = res.rows.find((r) => r.mach < 1.2);
        return { p, r1k, trans: trans ? trans.yards : '>1600', sg: res.sg, n: notes[p.name] || ['', ''] };
      });
      const minWind = Math.min(...rows.map((r) => r.r1k.windMil));
      widgetShell(el, `Rifle systems at 1000 yd (${u}, sea level, 10 mph full value)`, `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>System</th><th>MV</th><th>G7</th><th>Elev</th><th>Wind</th><th>Vel fps</th><th>Energy ft·lb</th><th>Transonic yd</th><th>Sg</th><th>Recoil</th><th>Barrel life</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td style="font-family:var(--sans)"><b>${r.p.cartridge}</b><br><span class="hint">${r.p.bullet} · 1:${r.p.twistIn}</span></td>
          <td>${r.p.muzzleVelocityFps}</td><td>${r.p.bc.toFixed(3)}</td>
          <td>${fmt(r.r1k.elevMil, 2)}</td>
          <td${r.r1k.windMil === minWind ? ' style="color:var(--good);font-weight:700"' : ''}>${fmt(r.r1k.windMil, 2)}</td>
          <td>${fmt(r.r1k.velocityFps, 0)}</td><td>${fmt(r.r1k.energyFtLb, 0)}</td><td>${r.trans}</td><td>${fmt(r.sg, 2)}</td>
          <td style="font-family:var(--sans)">${r.n[0]}</td><td>${r.n[1]}</td></tr>`).join('')}</tbody></table></div>
        <p class="hint">Typical published bullet data; barrel length 24–27". Recoil and barrel life are rough, rifle-dependent guides.</p>`);
    },

    'sd-calc'(el) {
      const box = widgetShell(el, 'What your SD does at distance (your Build Card load)', `
        <div class="w-grid">
          <div class="slider"><div class="slider-head"><label>Velocity SD</label><output id="w-sd-o"></output></div><input type="range" id="w-sd" min="2" max="25" value="${L.profile.sdFps || 10}"></div>
          <div class="slider"><div class="slider-head"><label>Range</label><output id="w-sdr-o"></output></div><input type="range" id="w-sdr" min="300" max="1400" step="50" value="1000"></div>
        </div><div class="tiles w-out"></div>
        <p class="hint">95% of shots fall within ±2 SD of the average MV. Extreme spread for a 10-shot string is typically ~3 × SD.</p>`);
      const run = () => {
        const sd = +$('#w-sd').value, r = +$('#w-sdr').value;
        $('#w-sd-o').textContent = sd + ' fps';
        $('#w-sdr-o').textContent = r + ' yd';
        const p = L.profile;
        const zero = B.solve(L.solverInput(p, { windMph: 0 }), [+p.zeroYards]).zeroAngleRad;
        const at = (mv) => B.solve(L.solverInput(p, { windMph: 0, muzzleVelocityFps: mv, zeroAngleRad: zero, tempSensitivity: 0 }), [r]).rows[0].dropIn;
        const spread = Math.abs(at(+p.muzzleVelocityFps + 2 * sd) - at(+p.muzzleVelocityFps - 2 * sd));
        const u = unit();
        $('.w-out', box).innerHTML = tile('95% vertical spread', fmt(spread, 1), 'in') + tile('In angle', fmt(L.toUnit(spread, r, u), 2), u) +
          tile('vs 12" plate', fmt(spread / 12 * 100, 0), '% of plate') + tile('Est. 10-shot ES', fmt(sd * 3.1, 0), 'fps');
      };
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    glossary(el) {
      const box = widgetShell(el, 'Search the glossary', `<div class="field"><input type="text" id="w-gl-q" placeholder="Type to filter…"></div><dl class="w-gloss"></dl>`);
      const run = () => {
        const q = $('#w-gl-q').value.toLowerCase();
        $('.w-gloss', box).innerHTML = window.LRPS_GLOSSARY.filter(([t, d]) => !q || (t + d).toLowerCase().includes(q))
          .map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('') || '<p class="hint">No matches.</p>';
      };
      $('#w-gl-q').addEventListener('input', run);
      run();
    },
  };

  function tile(label, value, unitLabel) {
    return `<div class="tile"><div class="label">${label}</div><div class="value">${value}<small>${unitLabel || ''}</small></div></div>`;
  }

  renderSide();
  open(current, true);
  L.onTab('academy', () => { renderSide(); });
  L.onProfile(() => { if (L.currentTab === 'academy') open(current, true); });
})();
