/* Build tab: live-recomputing dope card, stat tiles, elevation chart, print and CSV. */
(function () {
  'use strict';

  const L = window.LRPS;
  const { $, $$ } = L;

  const form = $('#profile-form');
  const presetSel = $('#preset');
  presetSel.innerHTML = '<option value="">— custom —</option>' +
    L.PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');

  function fillForm(p) {
    $$('input, select', form).forEach((el) => {
      if (!el.name || !(el.name in p)) return;
      if (el.type === 'checkbox') el.checked = !!p[el.name];
      else el.value = p[el.name];
    });
    const idx = L.PRESETS.findIndex((x) => x.name === p.name);
    presetSel.value = idx >= 0 ? idx : '';
  }

  function readForm() {
    const p = Object.assign({}, L.profile);
    $$('input, select', form).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') p[el.name] = el.checked;
      else if (el.type === 'number') p[el.name] = el.value === '' || !Number.isFinite(+el.value) ? p[el.name] : Number(el.value);
      else p[el.name] = el.value;
    });
    return p;
  }

  function valid(p) {
    return p.muzzleVelocityFps > 500 && p.bc > 0.05 && p.zeroYards > 0 && p.clickSize > 0 &&
      p.rangeEnd > p.rangeStart && p.rangeStep > 0;
  }

  let lastCard = null;

  function render() {
    const p = L.profile;
    lastCard = L.computeCard(p);
    $('#card-output').innerHTML = L.cardHtml(p, lastCard, false);
    const rows = lastCard.rows;
    const last = rows[rows.length - 1];
    const trans = rows.find((r) => r.mach < 1.2);
    const tile = (label, value, unit) =>
      `<div class="tile"><div class="label">${label}</div><div class="value">${value}<small>${unit}</small></div></div>`;
    $('#build-tiles').innerHTML =
      tile('Density altitude', Math.round(lastCard.atmosphere.densityAltitudeFt), 'ft') +
      tile(`Elev @${last.yards}`, L.fmtClick(last.elev, +p.clickSize), p.unit) +
      tile('Turret clicks', last.clicks, 'clk') +
      tile('Transonic', trans ? trans.yards : `>${last.yards}`, 'yd') +
      tile(`Energy @${last.yards}`, Math.round(last.energyFtLb), 'ft·lb');
    L.lineChart($('#chart-build'), {
      series: [
        { points: rows.map((r) => [r.yards, r.elev]), cls: 'accent', label: `Elevation (${p.unit})`, area: true },
        { points: rows.map((r) => [r.yards, r.winds[Math.min(1, r.winds.length - 1)] || 0]), cls: '2',
          label: `Wind hold @ ${lastCard.brackets[Math.min(1, lastCard.brackets.length - 1)] || 0} mph` },
      ],
      xMax: last.yards, yLabel: p.unit, shadeFrom: trans ? trans.yards : null,
      tip: (x, ys) => `${x} yd<br>elev ${ys[0].toFixed(2)}<br>wind ${ys[1].toFixed(2)}`,
    });
  }

  let timer = 0;
  form.addEventListener('input', (e) => {
    if (e.target === presetSel) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const p = readForm();
      if (!valid(p)) return;
      L.setProfile(p);
    }, 150);
  });

  presetSel.addEventListener('change', () => {
    const preset = L.PRESETS[presetSel.value];
    if (!preset) return;
    const p = Object.assign(readForm(), preset);
    fillForm(p);
    L.setProfile(p);
  });

  form.unit.addEventListener('change', () => {
    form.clickSize.value = L.clickFor(form.unit.value);
  });

  $('#print-card').addEventListener('click', () => {
    L.showTab('build');
    setTimeout(() => window.print(), 50);
  });

  $('#export-csv').addEventListener('click', () => {
    const p = L.profile;
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
    L.toast('Card exported as CSV');
  });

  L.onProfile(render);
  window.addEventListener('themechange', render);
  fillForm(L.profile);
  render();
})();
