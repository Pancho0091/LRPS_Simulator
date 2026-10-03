/*
 * Data Book tab: record what you measure with your REAL rifle on a REAL range.
 *
 *   Rifle + lot  →  Conditions (DA)  →  Zero | Chrono | Field dope  →  Sessions
 *
 * Phase 1 is RECORD only. Nothing here trues the solver or prints a field
 * card; it stores the evidence those phases will need. The pure logic
 * (records, validation, merge, DA, chrono stats) lives in js/book/model.js.
 * Built for one thumb, gloves and bright sun: steppers instead of keyboards,
 * big targets, a Field mode for sunlight.
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { $, $$ } = L;
  let M = null;      // window.LRPS_BOOK, resolved at init (loads after this file)
  let RANGE = null;  // window.LRPS_RANGE catalogue (optional seed source)
  const esc = L.escapeHtml;
  const sign1 = (v) => (v >= 0 ? '+' : '') + (+v).toFixed(1);

  // ------------------------------------------------------------ state

  const UI_DEFAULT = {
    rifleId: null, lotId: null, kind: 'field', field: false,
    cur: { zero: null, chrono: null, field: null },
    cond: { altFt: 0, tempF: 59, pressureInHg: 29.92, humidityPct: 30, source: 'typed', pressureAuto: true },
    f: {},
  };
  const S = { inited: false, book: null, ui: null, edit: null, gpsHint: '', gpsBusy: false };

  // Stepper definitions: value key → step, bounds, decimals, label, unit, hold acceleration
  const STEPS = {
    altFt: { step: 100, min: -1000, max: 15000, dec: 0, label: 'Altitude', unit: 'ft', accel: true },
    tempF: { step: 1, min: -40, max: 130, dec: 0, label: 'Temp', unit: '°F', accel: true },
    pressureInHg: { step: 0.05, min: 15, max: 32, dec: 2, label: 'Pressure', unit: 'inHg', accel: true },
    humidityPct: { step: 5, min: 0, max: 100, dec: 0, label: 'Humidity', unit: '%' },
    zeroYd: { step: 25, min: 25, max: 500, dec: 0, label: 'Zero range', unit: 'yd' },
    groupIn: { step: 0.05, min: 0, max: 20, dec: 2, label: 'Group', unit: 'in', accel: true },
    zDialE: { step: 0.1, min: -30, max: 30, dec: 1, label: 'Dial elev', unit: 'mil', accel: true },
    zDialW: { step: 0.1, min: -30, max: 30, dec: 1, label: 'Dial wind', unit: 'mil', accel: true },
    fps: { step: 1, min: 300, max: 5000, dec: 0, label: 'Velocity', unit: 'fps', accel: true },
    yd: { step: 5, min: 5, max: 3000, dec: 0, label: 'Range', unit: 'yd', accel: true },
    angleDeg: { step: 1, min: -60, max: 60, dec: 0, label: 'Angle', unit: '°', accel: true },
    dialE: { step: 0.1, min: -40, max: 40, dec: 1, label: 'Elev', unit: 'mil', accel: true },
    dialW: { step: 0.1, min: -20, max: 20, dec: 1, label: 'Wind', unit: 'mil', accel: true },
    windMph: { step: 1, min: 0, max: 60, dec: 0, label: 'Wind', unit: 'mph', accel: true },
    windClock: { step: 1, min: 1, max: 12, dec: 0, label: 'From', unit: "o'clock", wrap: true },
    offMil: { step: 0.1, min: -10, max: 10, dec: 1, label: 'Off by', unit: '± mil', accel: true },
  };
  const F_DEFAULT = {
    zeroYd: 100, groupIn: 0.5, zDialE: 0, zDialW: 0, fps: 2700, yd: 300, angleDeg: 0, dialE: 0, dialW: 0,
    windMph: 5, windClock: 3, offMil: 0, result: 'hit', note: '', place: '',
  };

  // ------------------------------------------------------------ storage

  function load() {
    const v = M.validateBook(L.store.get('book', null));
    S.book = v.book;
    const ui = L.store.get('book.ui', {});
    S.ui = Object.assign({}, UI_DEFAULT, ui);
    S.ui.cur = Object.assign({}, UI_DEFAULT.cur, ui.cur && typeof ui.cur === 'object' ? ui.cur : {});
    S.ui.cond = Object.assign({}, UI_DEFAULT.cond, ui.cond && typeof ui.cond === 'object' ? ui.cond : {});
    S.ui.f = Object.assign({}, F_DEFAULT, ui.f && typeof ui.f === 'object' ? ui.f : {});
    Object.keys(STEPS).forEach((k) => { S.ui.f[k] = clampStep(k, S.ui.f[k]); });
    ['altFt', 'tempF', 'pressureInHg', 'humidityPct'].forEach((k) => { S.ui.cond[k] = clampStep(k, S.ui.cond[k]); });
    if (!M.KINDS.includes(S.ui.kind)) S.ui.kind = 'field';
    S.ui.field = !!S.ui.field;
    if (!M.RESULTS.includes(S.ui.f.result)) S.ui.f.result = 'hit';
    // Dangling references (a cleared store, a deleted rifle) fall back gracefully
    if (!rifle()) S.ui.rifleId = S.book.rifles.length ? S.book.rifles[0].id : null;
    if (!lot()) S.ui.lotId = (lotsFor(S.ui.rifleId)[0] || {}).id || null;
    M.KINDS.forEach((k) => { const s = session(S.ui.cur[k]); if (!s || s.kind !== k || s.rifleId !== S.ui.rifleId) S.ui.cur[k] = null; });
  }
  function saveBook() { L.store.set('book', S.book); }
  function saveUi() { L.store.set('book.ui', S.ui); }

  const rifle = () => S.book.rifles.find((r) => r.id === S.ui.rifleId) || null;
  const lot = () => S.book.lots.find((l) => l.id === S.ui.lotId && l.rifleId === S.ui.rifleId) || null;
  const lotsFor = (rifleId) => S.book.lots.filter((l) => l.rifleId === rifleId);
  const session = (id) => (id ? S.book.sessions.find((s) => s.id === id) || null : null);
  const cur = () => session(S.ui.cur[S.ui.kind]);

  function clampStep(key, v) {
    const d = STEPS[key];
    const n = Number.isFinite(+v) && v !== '' && v != null ? +v : (key in F_DEFAULT ? F_DEFAULT[key] : UI_DEFAULT.cond[key]);
    const m = Math.pow(10, d.dec);
    return Math.max(d.min, Math.min(d.max, Math.round(n * m) / m));
  }

  /* Live conditions → a snapshot to stamp on a record. */
  const liveCond = () => M.snapshot(S.ui.cond);

  /* Touch a session: stamp the time and persist. */
  function touch(s) { s.updatedAt = Date.now(); saveBook(); }

  /* The open session for the current kind, created on the first entry. */
  function ensureSession() {
    let s = cur();
    if (s) return s;
    if (!rifle()) return null;
    const lt = lot();
    s = M.makeSession(S.ui.kind, S.ui.rifleId, lt ? lt.id : null, S.ui.cond, { place: S.ui.f.place });
    if (s.kind === 'zero') { s.group.yd = S.ui.f.zeroYd; s.dial = { e: S.ui.f.zDialE, w: S.ui.f.zDialW }; }
    S.book.sessions.push(s);
    S.ui.cur[S.ui.kind] = s.id;
    saveBook(); saveUi();
    return s;
  }

  // ------------------------------------------------------------ render

  function stepperHtml(key, value, opts) {
    const d = STEPS[key];
    const o = opts || {};
    const v = clampStep(key, value);
    return `
      <div class="bk-step ${o.cls || ''}" data-step="${key}">
        <div class="bk-step-label">${esc(o.label || d.label)} <small>${esc(d.unit)}</small></div>
        <div class="bk-step-row">
          <button type="button" class="bk-stp" data-stp="${key}" data-d="-1" aria-label="${esc(o.label || d.label)} down">−</button>
          <input class="bk-step-val" inputmode="decimal" autocomplete="off" data-f="${key}" value="${v.toFixed(d.dec)}" aria-label="${esc(o.label || d.label)} (${esc(d.unit)})">
          <button type="button" class="bk-stp" data-stp="${key}" data-d="1" aria-label="${esc(o.label || d.label)} up">+</button>
        </div>
      </div>`;
  }

  function render() {
    const root = $('#book-main');
    if (!root) return;
    $('#tab-book').classList.toggle('field', S.ui.field);
    const fm = $('#book-field-mode');
    if (fm) { fm.classList.toggle('on', S.ui.field); fm.setAttribute('aria-pressed', S.ui.field ? 'true' : 'false'); }
    root.innerHTML = pickerHtml() + (S.edit ? editHtml() : '') + (rifle() ? condHtml() + recordHtml() + sessionsHtml() : emptyHtml());
  }

  function emptyHtml() {
    return `
      <div class="card bk-empty">
        <h3>Start with your rifle</h3>
        <p class="hint">Name it, note the barrel, twist, sight height and the zero range. Then add the ammo lot you are shooting. Everything you record is kept on this device; export it as a file to keep it safe.</p>
        <button type="button" class="btn primary big" data-act="new-rifle">Add your rifle</button>
      </div>`;
  }

  function pickerHtml() {
    const r = rifle(), lt = lot();
    const rifles = S.book.rifles.map((x) => `<option value="${esc(x.id)}" ${x.id === S.ui.rifleId ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const lots = lotsFor(S.ui.rifleId).map((x) => `<option value="${esc(x.id)}" ${x.id === S.ui.lotId ? 'selected' : ''}>${esc(x.loadName)}${x.lotNo ? ' · lot ' + esc(x.lotNo) : ''}</option>`).join('');
    const rMeta = r ? [r.barrelIn ? `${r.barrelIn}"` : '', r.twistIn ? `1:${r.twistIn}` : '', `sight ${r.sightHeightIn}"`, `zero ${r.zeroYd} yd`, r.travelMil ? `${r.travelMil} mil travel` : ''].filter(Boolean).join(' · ') : '';
    const lMeta = lt ? [lt.bulletGr ? `${lt.bulletGr} gr` : '', lt.bc ? `${lt.dragModel} ${lt.bc}` : '', lt.chrono && lt.chrono.fps.length ? `chrono ${Math.round(M.chronoStats(lt.chrono.fps).avg)} fps (n ${lt.chrono.fps.length}${lt.chrono.tempF != null ? `, ${lt.chrono.tempF}°F` : ''})` : 'not chronographed'].filter(Boolean).join(' · ') : '';
    return `
      <div class="card bk-picker">
        <div class="bk-pick">
          <label for="book-rifle">Rifle</label>
          <div class="bk-pick-row">
            <select id="book-rifle" data-f="rifleId" ${S.book.rifles.length ? '' : 'disabled'}>${rifles || '<option value="">— none yet —</option>'}</select>
            <button type="button" class="btn" data-act="new-rifle" title="New rifle">+</button>
            <button type="button" class="btn" data-act="edit-rifle" ${r ? '' : 'disabled'} title="Edit rifle" aria-label="Edit rifle">✎</button>
          </div>
          ${r ? `<div class="bk-meta">${esc(rMeta)}</div>` : ''}
        </div>
        <div class="bk-pick">
          <label for="book-lot">Ammo lot</label>
          <div class="bk-pick-row">
            <select id="book-lot" data-f="lotId" ${lots ? '' : 'disabled'}>${lots || '<option value="">— none yet —</option>'}</select>
            <button type="button" class="btn" data-act="new-lot" ${r ? '' : 'disabled'} title="New lot">+</button>
            <button type="button" class="btn" data-act="edit-lot" ${lt ? '' : 'disabled'} title="Edit lot" aria-label="Edit lot">✎</button>
          </div>
          ${lt ? `<div class="bk-meta">${esc(lMeta)}</div>` : r ? '<div class="bk-meta">Add the lot you are shooting: velocities and BC live on the lot, not the rifle.</div>' : ''}
        </div>
      </div>`;
  }

  // ---- rifle / lot editor

  function fieldHtml(id, label, value, attrs) {
    return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" ${attrs || 'type="text"'} value="${esc(value == null ? '' : value)}"></div>`;
  }
  const numAttr = (step) => `type="number" inputmode="decimal" step="${step}"`;

  function editHtml() {
    const e = S.edit;
    if (e.type === 'rifle') {
      const r = e.id ? S.book.rifles.find((x) => x.id === e.id) : null;
      const d = Object.assign({ name: '', barrelIn: '', twistIn: '', sightHeightIn: 1.9, travelMil: '', zeroYd: 100, notes: '' }, r || {}, e.draft || {});
      const optics = RANGE ? RANGE.OPTICS.map((o) => `<option value="${esc(o.id)}">${esc(o.name)} · ${o.travelMil} mil</option>`).join('') : '';
      return `
        <form class="card bk-edit" id="book-edit" autocomplete="off">
          <div class="card-title"><h3>${r ? 'Edit rifle' : 'New rifle'}</h3><span class="hint">identity · changes slowly</span></div>
          ${fieldHtml('be-name', 'Name', d.name, 'type="text" maxlength="80" required')}
          <div class="field-row">${fieldHtml('be-barrelIn', 'Barrel (in)', d.barrelIn, numAttr(0.5))}${fieldHtml('be-twistIn', 'Twist (1:x in)', d.twistIn, numAttr(0.25))}</div>
          <div class="field-row">${fieldHtml('be-sightHeightIn', 'Sight height (in)', d.sightHeightIn, numAttr(0.05))}${fieldHtml('be-zeroYd', 'Zero (yd)', d.zeroYd, numAttr(25))}</div>
          <div class="field-row">${fieldHtml('be-travelMil', 'Elev travel (mil)', d.travelMil, numAttr(1))}
            <div class="field"><label for="be-optic">Seed from catalogue</label><select id="be-optic" data-seed="optic"><option value="">optic…</option>${optics}</select></div></div>
          <div class="field"><label for="be-notes">Notes</label><textarea id="be-notes" rows="2" maxlength="1000">${esc(d.notes)}</textarea></div>
          <p class="hint">MIL turrets, 0.1 mil clicks. Sight height is bore centre to scope centre.</p>
          <div class="actions">
            <button type="submit" class="btn primary">Save rifle</button>
            <button type="button" class="btn" data-act="cancel-edit">Cancel</button>
            ${r ? `<button type="button" class="btn bk-danger" data-act="delete-rifle">Delete rifle…</button>` : ''}
          </div>
        </form>`;
    }
    const lt = e.id ? S.book.lots.find((x) => x.id === e.id) : null;
    const d = Object.assign({ loadName: '', lotNo: '', bulletGr: '', diaIn: '', lenIn: '', bc: '', dragModel: 'G7', notes: '' }, lt || {}, e.draft || {});
    const loads = RANGE ? RANGE.LOADS.map((l) => `<option value="${esc(l.id)}">${esc(RANGE.cartridge(l.cart).name)} · ${esc(l.brand)} ${esc(l.name)}</option>`).join('') : '';
    return `
      <form class="card bk-edit" id="book-edit" autocomplete="off">
        <div class="card-title"><h3>${lt ? 'Edit lot' : 'New ammo lot'}</h3><span class="hint">measurements · per box / lot</span></div>
        <div class="field"><label for="be-load">From catalogue</label><select id="be-load" data-seed="load"><option value="">pick a factory load to pre-fill…</option>${loads}</select></div>
        <div class="field-row">${fieldHtml('be-loadName', 'Load', d.loadName, 'type="text" maxlength="80" required')}${fieldHtml('be-lotNo', 'Lot #', d.lotNo, 'type="text" maxlength="40"')}</div>
        <div class="field-row">${fieldHtml('be-bulletGr', 'Bullet (gr)', d.bulletGr, numAttr(1))}${fieldHtml('be-bc', 'BC', d.bc, numAttr(0.001))}</div>
        <div class="field-row">
          <div class="field"><label for="be-dragModel">Drag model</label><select id="be-dragModel"><option ${d.dragModel === 'G7' ? 'selected' : ''}>G7</option><option ${d.dragModel === 'G1' ? 'selected' : ''}>G1</option></select></div>
          ${fieldHtml('be-diaIn', 'Diameter (in)', d.diaIn, numAttr(0.001))}
        </div>
        <div class="field-row">${fieldHtml('be-lenIn', 'Bullet length (in)', d.lenIn, numAttr(0.01))}<div class="field"></div></div>
        <div class="field"><label for="be-notes">Notes</label><textarea id="be-notes" rows="2" maxlength="1000">${esc(d.notes)}</textarea></div>
        ${lt && lt.chrono && lt.chrono.fps.length ? `<p class="hint">Chronographed ${lt.chrono.date || ''}: ${lt.chrono.fps.length} shots, avg ${Math.round(M.chronoStats(lt.chrono.fps).avg)} fps${lt.chrono.tempF != null ? ` at ${lt.chrono.tempF}°F` : ''}. A new string from the Chrono flow replaces it.</p>` : '<p class="hint">The published BC is a starting point; your chronograph string gets written here from the Chrono flow.</p>'}
        <div class="actions">
          <button type="submit" class="btn primary">Save lot</button>
          <button type="button" class="btn" data-act="cancel-edit">Cancel</button>
          ${lt ? `<button type="button" class="btn bk-danger" data-act="delete-lot">Delete lot…</button>` : ''}
        </div>
      </form>`;
  }

  // ---- conditions

  function condHtml() {
    const c = S.ui.cond;
    const da = M.densityAltitude(c);
    const gps = !!(navigator.geolocation && navigator.geolocation.getCurrentPosition);
    return `
      <div class="card bk-cond">
        <div class="card-title"><h3>Conditions</h3><span class="bk-src ${c.source === 'gps' ? 'gps' : ''}">${c.source === 'gps' ? 'altitude from GPS' : 'typed'}</span></div>
        <div class="bk-cond-grid">
          <div class="bk-steps">
            ${stepperHtml('altFt', c.altFt)}
            ${stepperHtml('tempF', c.tempF)}
            ${stepperHtml('pressureInHg', c.pressureInHg, { cls: c.pressureAuto ? 'auto' : '' })}
            ${stepperHtml('humidityPct', c.humidityPct)}
          </div>
          <div class="bk-da" aria-live="polite">
            <div class="bk-da-label">Density altitude</div>
            <div class="bk-da-value" id="book-da">${da.toLocaleString()}<small>ft</small></div>
            <div class="bk-da-note">the number you write on the card</div>
          </div>
        </div>
        <div class="actions bk-cond-actions">
          <button type="button" class="btn" data-act="gps" ${gps && !S.gpsBusy ? '' : 'disabled'}>${S.gpsBusy ? 'Reading GPS…' : 'Use GPS altitude'}</button>
          <button type="button" class="btn" data-act="press-std" ${c.pressureAuto ? 'disabled' : ''}>Std pressure for altitude</button>
          <span class="hint bk-gps-hint" id="book-gps-hint">${esc(S.gpsHint || (gps ? 'GPS gives a rough altitude (±30 m); a weather meter is better.' : 'GPS not available here — type the altitude from a map or your meter.'))}</span>
        </div>
      </div>`;
  }

  function updateDa() {
    const el = $('#book-da');
    if (el) el.innerHTML = `${M.densityAltitude(S.ui.cond).toLocaleString()}<small>ft</small>`;
    const ps = $('.bk-step[data-step="pressureInHg"]');
    if (ps) ps.classList.toggle('auto', !!S.ui.cond.pressureAuto);
    const std = $('[data-act="press-std"]');
    if (std) std.disabled = !!S.ui.cond.pressureAuto;
    const src = $('.bk-src');
    if (src) { src.classList.toggle('gps', S.ui.cond.source === 'gps'); src.textContent = S.ui.cond.source === 'gps' ? 'altitude from GPS' : 'typed'; }
  }

  // ---- record flows

  function recordHtml() {
    const s = cur();
    const lt = lot();
    const head = `
      <div class="bk-rec-head">
        <div class="seg bk-kind" id="book-kind">
          <button type="button" data-v="zero" class="${S.ui.kind === 'zero' ? 'on' : ''}">Zero</button>
          <button type="button" data-v="chrono" class="${S.ui.kind === 'chrono' ? 'on' : ''}">Chrono</button>
          <button type="button" data-v="field" class="${S.ui.kind === 'field' ? 'on' : ''}">Field dope</button>
        </div>
        <button type="button" class="btn" data-act="new-session" title="Start a new session of this kind">New session</button>
      </div>
      <div class="bk-sess-meta">
        <div class="field"><label for="book-date">Date</label><input id="book-date" type="date" data-f="date" value="${esc(s ? s.date : M.today())}"></div>
        <div class="field"><label for="book-place">Place</label><input id="book-place" type="text" maxlength="80" data-f="place" placeholder="range / spot" value="${esc(s ? s.place : S.ui.f.place)}"></div>
      </div>
      <p class="hint bk-sess-line">${s ? `Open session · ${esc(s.kind)} · ${esc(s.date)}${lt ? ' · ' + esc(lt.loadName) : ''} · DA ${s.cond.daFt.toLocaleString()} ft` : 'No session open: the first entry starts one and stamps today\'s conditions on it.'}</p>`;
    let body = '';
    if (S.ui.kind === 'zero') body = zeroHtml(s);
    else if (S.ui.kind === 'chrono') body = chronoHtml(s);
    else body = dopeHtml(s);
    return `<div class="card bk-record">${head}${body}</div>`;
  }

  function zeroHtml(s) {
    const f = S.ui.f;
    const g = s ? s.group : { sizeIn: f.groupIn, yd: f.zeroYd };
    const d = s ? s.dial : { e: f.zDialE, w: f.zDialW };
    const r = rifle();
    return `
      <ol class="bk-flow">
        <li>Check the conditions above, then fire a group at the zero range.</li>
        <li>Measure the group and dial the correction (group high → come down).</li>
        <li>Confirm with a shot. The dial you end on is your offset from mechanical zero.</li>
      </ol>
      <div class="bk-steps">
        ${stepperHtml('zeroYd', g.yd)}
        ${stepperHtml('groupIn', g.sizeIn == null ? f.groupIn : g.sizeIn)}
        ${stepperHtml('zDialE', d.e, { label: 'Dial ↑' })}
        ${stepperHtml('zDialW', d.w, { label: 'Dial →' })}
      </div>
      <p class="hint" id="book-zero-hint">Group ${(g.sizeIn == null ? f.groupIn : g.sizeIn).toFixed(2)}" at ${g.yd} yd = <b>${L.toUnit(g.sizeIn == null ? f.groupIn : g.sizeIn, g.yd).toFixed(2)} mil</b>${r && r.zeroYd !== g.yd ? ` · rifle profile says ${r.zeroYd} yd` : ''}.</p>
      <div class="actions">
        <button type="button" class="btn big bk-confirm ${s && s.confirmed ? 'on' : ''}" data-act="zero-confirm" aria-pressed="${s && s.confirmed ? 'true' : 'false'}">${s && s.confirmed ? '✓ Zero confirmed' : 'Zero confirmed'}</button>
      </div>
      <div class="field bk-notes"><label for="book-notes">Notes</label><textarea id="book-notes" rows="2" maxlength="2000" data-f="notes" placeholder="ammo temp, light, what you changed…">${esc(s ? s.notes : '')}</textarea></div>`;
  }

  function chronoHtml(s) {
    const fps = s ? s.fps : [];
    const st = M.chronoStats(fps);
    const lt = lot();
    const seed = fps.length ? fps[fps.length - 1] : (lt && lt.chrono && lt.chrono.fps.length ? Math.round(M.chronoStats(lt.chrono.fps).avg) : S.ui.f.fps);
    return `
      <div class="bk-chrono">
        <div class="bk-steps one">${stepperHtml('fps', seed)}</div>
        <button type="button" class="btn primary big block" data-act="chrono-add">Add shot</button>
        <div class="bk-fps-list" id="book-fps">${fps.map((v, i) => `<button type="button" class="bk-fps" data-act="chrono-del" data-i="${i}" title="Remove"><i>${i + 1}</i>${v}<span>×</span></button>`).join('') || '<span class="hint">no shots yet — set the velocity and tap Add</span>'}</div>
        <div class="tiles bk-stats">
          <div class="tile"><div class="label">n</div><div class="value">${st.n}</div></div>
          <div class="tile"><div class="label">avg</div><div class="value">${st.n ? Math.round(st.avg) : '–'}<small>fps</small></div></div>
          <div class="tile"><div class="label">SD</div><div class="value">${st.n > 1 ? st.sd.toFixed(1) : '–'}</div></div>
          <div class="tile"><div class="label">ES</div><div class="value">${st.n > 1 ? st.es : '–'}</div></div>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" data-act="chrono-save" ${st.n && lt ? '' : 'disabled'}>Save string to lot${lt ? ` · ${esc(lt.loadName)}` : ''}</button>
          <button type="button" class="btn" data-act="chrono-clear" ${st.n ? '' : 'disabled'}>Clear</button>
        </div>
        <p class="hint">${lt ? 'Saving writes avg, SD and the string to the lot with today\'s temperature — the lot is what gets trued later.' : 'Add an ammo lot above to save the string to it.'} 10 shots give a usable SD.</p>
      </div>`;
  }

  function dopeHtml(s) {
    const f = S.ui.f;
    const shots = s ? s.shots.slice().reverse() : [];
    const res = M.RESULTS.map((r) => `<button type="button" class="bk-res ${r} ${f.result === r ? 'on' : ''}" data-res="${r}" aria-pressed="${f.result === r}">${r.toUpperCase()}</button>`).join('');
    return `
      <div class="bk-field">
        <div class="bk-steps">
          ${stepperHtml('yd', f.yd)}
          ${stepperHtml('angleDeg', f.angleDeg)}
          ${stepperHtml('dialE', f.dialE, { label: 'Dial ↑' })}
          ${stepperHtml('dialW', f.dialW, { label: 'Dial →' })}
          ${stepperHtml('windMph', f.windMph)}
          ${stepperHtml('windClock', f.windClock)}
        </div>
        <div class="bk-results" role="group" aria-label="Result">${res}</div>
        <div class="bk-off ${f.result === 'hit' ? 'dim' : ''}">
          <div class="bk-steps one">${stepperHtml('offMil', f.offMil)}</div>
          <input type="text" class="bk-note" maxlength="200" data-f="note" placeholder="note (optional)" value="${esc(f.note)}" aria-label="Shot note">
        </div>
        <button type="button" class="btn primary big block" data-act="field-log">Log shot · ${f.yd} yd · ${sign1(f.dialE)} / ${sign1(f.dialW)} · ${esc(f.result.toUpperCase())}</button>
        <div class="bk-rows" id="book-rows">
          ${shots.length ? shots.map((x, i) => fieldRowHtml(x, shots.length - 1 - i)).join('') : '<p class="hint">Rows appear here, newest first, each with the conditions it was shot in.</p>'}
        </div>
        <div class="field bk-notes"><label for="book-notes">Session notes</label><textarea id="book-notes" rows="2" maxlength="2000" data-f="notes" placeholder="targets, light, what the wind did…">${esc(s ? s.notes : '')}</textarea></div>
      </div>`;
  }

  function fieldRowHtml(x, idx) {
    const off = x.offMil != null && x.result !== 'hit' ? ` ${sign1(x.offMil)} mil` : '';
    return `
      <div class="bk-row ${x.result}">
        <div class="bk-row-main">
          <b class="bk-row-yd">${x.yd}<small>yd</small></b>
          <span class="bk-row-dial">${sign1(x.dialE)} / ${sign1(x.dialW)}</span>
          <span class="bk-row-res">${esc(x.result.toUpperCase())}${esc(off)}</span>
          <button type="button" class="bk-x" data-act="field-del" data-i="${idx}" aria-label="Delete row">×</button>
        </div>
        <div class="bk-row-cond">${x.angleDeg ? `${x.angleDeg}° · ` : ''}wind ${x.windMph} mph @ ${x.windClock} · DA ${x.cond.daFt.toLocaleString()} ft · ${x.cond.tempF}°F · ${x.cond.altFt} ft · ${x.cond.pressureInHg} inHg${x.note ? ` · ${esc(x.note)}` : ''}</div>
      </div>`;
  }

  // ---- sessions list

  function sessionsHtml() {
    const list = S.book.sessions.filter((s) => s.rifleId === S.ui.rifleId).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.createdAt - a.createdAt));
    const lotName = (id) => { const l = S.book.lots.find((x) => x.id === id); return l ? l.loadName : ''; };
    const rows = list.map((s) => `
      <div class="bk-sess ${s.id === S.ui.cur[s.kind] ? 'open' : ''}" data-id="${esc(s.id)}">
        <button type="button" class="bk-sess-main" data-act="open-session" data-id="${esc(s.id)}">
          <span class="bk-kind-tag ${s.kind}">${s.kind === 'field' ? 'DOPE' : s.kind.toUpperCase()}</span>
          <span class="bk-sess-txt"><b>${esc(s.date)}${s.place ? ' · ' + esc(s.place) : ''}</b><small>${esc(M.sessionSummary(s))}${lotName(s.lotId) ? ' · ' + esc(lotName(s.lotId)) : ''} · DA ${s.cond.daFt.toLocaleString()} ft</small></span>
        </button>
        <button type="button" class="btn bk-mini" data-act="print-session" data-id="${esc(s.id)}" title="Print session" aria-label="Print session">⎙</button>
        <button type="button" class="btn bk-mini bk-x" data-act="delete-session" data-id="${esc(s.id)}" title="Delete session" aria-label="Delete session">×</button>
      </div>`).join('');
    return `
      <div class="card bk-sessions">
        <div class="card-title"><h3>Sessions</h3><span class="hint">${list.length} for ${esc(rifle().name)}</span></div>
        ${rows || '<p class="hint">Nothing recorded yet for this rifle.</p>'}
      </div>`;
  }

  // ------------------------------------------------------------ actions

  function setKind(k) {
    S.ui.kind = k; saveUi(); render();
  }

  function newSession() {
    S.ui.cur[S.ui.kind] = null;
    if (S.ui.kind === 'zero') { S.ui.f.zDialE = 0; S.ui.f.zDialW = 0; }
    saveUi(); render();
    L.toast('New session: the first entry stamps the conditions');
  }

  function openSession(id) {
    const s = session(id);
    if (!s) return;
    S.ui.kind = s.kind;
    S.ui.cur[s.kind] = s.id;
    if (s.lotId) S.ui.lotId = s.lotId;
    // the panel shows the conditions this session was shot in
    S.ui.cond = Object.assign({}, S.ui.cond, { altFt: s.cond.altFt, tempF: s.cond.tempF, pressureInHg: s.cond.pressureInHg, humidityPct: s.cond.humidityPct, source: s.cond.source, pressureAuto: false });
    if (s.kind === 'zero') { S.ui.f.zeroYd = s.group.yd; S.ui.f.zDialE = s.dial.e; S.ui.f.zDialW = s.dial.w; if (s.group.sizeIn != null) S.ui.f.groupIn = s.group.sizeIn; }
    S.ui.f.place = s.place;
    saveUi(); render();
    window.scrollTo({ top: $('.bk-record').offsetTop - 70, behavior: L.reducedMotion() ? 'auto' : 'smooth' });
  }

  function deleteSession(id) {
    const s = session(id);
    if (!s) return;
    if (!confirm(`Delete this ${s.kind} session from ${s.date}?\n${M.sessionSummary(s)}\n\nThis cannot be undone (export first to keep a copy).`)) return;
    S.book.sessions = S.book.sessions.filter((x) => x.id !== id);
    M.KINDS.forEach((k) => { if (S.ui.cur[k] === id) S.ui.cur[k] = null; });
    saveBook(); saveUi(); render();
    L.toast('Session deleted');
  }

  /* A condition stepper changed: live cond, and the open zero/chrono session is re-stamped (field rows stamp themselves). */
  function condChanged(key) {
    const c = S.ui.cond;
    if (key === 'altFt' && c.pressureAuto) c.pressureInHg = clampStep('pressureInHg', M.stdPressureInHg(c.altFt));
    if (key === 'pressureInHg') c.pressureAuto = false;
    if (key === 'altFt') c.source = 'typed';
    saveUi();
    const s = cur();
    if (s && s.kind !== 'field') { s.cond = liveCond(); touch(s); }
    const pv = $('.bk-step-val[data-f="pressureInHg"]');
    if (pv && key === 'altFt') pv.value = c.pressureInHg.toFixed(2);
    updateDa();
    const line = $('.bk-sess-line');
    if (line && s && s.kind !== 'field') line.textContent = line.textContent.replace(/DA [\d,]+ ft/, `DA ${s.cond.daFt.toLocaleString()} ft`);
  }

  function useGps() {
    const geo = navigator.geolocation;
    const hint = (t) => { S.gpsHint = t; S.gpsBusy = false; const el = $('#book-gps-hint'); if (el) el.textContent = t; const b = $('[data-act="gps"]'); if (b) { b.disabled = false; b.textContent = 'Use GPS altitude'; } };
    if (!geo || !geo.getCurrentPosition) { hint('GPS not available in this browser — type the altitude.'); return; }
    if (window.isSecureContext === false) { hint('GPS needs a secure page (https) — type the altitude.'); return; }
    S.gpsBusy = true;
    const b = $('[data-act="gps"]'); if (b) { b.disabled = true; b.textContent = 'Reading GPS…'; }
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; hint('GPS took too long — type the altitude.'); } }, 15000);
    try {
      geo.getCurrentPosition((pos) => {
        if (done) return; done = true; clearTimeout(timer);
        const alt = pos && pos.coords ? pos.coords.altitude : null;
        if (alt == null || !Number.isFinite(alt)) { hint('GPS fix had no altitude — type it from a map or your meter.'); return; }
        S.ui.cond.altFt = clampStep('altFt', alt / 0.3048);
        S.ui.cond.source = 'gps';
        S.ui.cond.pressureAuto = true;
        S.ui.cond.pressureInHg = clampStep('pressureInHg', M.stdPressureInHg(S.ui.cond.altFt));
        saveUi();
        const s = cur();
        if (s && s.kind !== 'field') { s.cond = liveCond(); touch(s); }
        S.gpsBusy = false;
        render();
        L.toast(`GPS altitude ${Math.round(S.ui.cond.altFt)} ft (±${Math.round((pos.coords.altitudeAccuracy || 30) / 0.3048)} ft)`);
      }, (err) => {
        if (done) return; done = true; clearTimeout(timer);
        hint(err && err.code === 1 ? 'Location permission denied — type the altitude.' : 'No GPS fix — type the altitude.');
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    } catch (e) { done = true; clearTimeout(timer); hint('GPS not available here — type the altitude.'); }
  }

  // ---- zero

  function zeroChanged() {
    const s = ensureSession();
    if (!s) return;
    s.group.yd = S.ui.f.zeroYd;
    s.group.sizeIn = S.ui.f.groupIn;
    s.dial = { e: S.ui.f.zDialE, w: S.ui.f.zDialW };
    touch(s);
    const hint = $('#book-zero-hint');
    if (hint) hint.innerHTML = `Group ${s.group.sizeIn.toFixed(2)}" at ${s.group.yd} yd = <b>${L.toUnit(s.group.sizeIn, s.group.yd).toFixed(2)} mil</b>.`;
  }

  function zeroConfirm() {
    const s = ensureSession();
    if (!s) return;
    zeroChanged();
    s.confirmed = !s.confirmed;
    touch(s);
    if (s.confirmed) { L.sfx.good(); L.addXp(15, 'Zero confirmed and recorded'); }
    render();
  }

  // ---- chrono

  function chronoAdd() {
    const s = ensureSession();
    if (!s) return;
    const v = clampStep('fps', S.ui.f.fps);
    s.fps.push(v);
    s.stats = M.chronoStats(s.fps);
    touch(s);
    L.sfx.click();
    render();
    const inp = $('.bk-step-val[data-f="fps"]');
    if (inp) inp.value = v.toFixed(0);
  }
  function chronoDel(i) {
    const s = cur(); if (!s) return;
    s.fps.splice(i, 1); s.stats = M.chronoStats(s.fps); touch(s); render();
  }
  function chronoClear() {
    const s = cur(); if (!s || !s.fps.length) return;
    if (!confirm(`Clear ${s.fps.length} velocities from this string?`)) return;
    s.fps = []; s.stats = M.chronoStats([]); touch(s); render();
  }
  function chronoSave() {
    const s = cur(); const lt = lot();
    if (!s || !lt || !s.fps.length) return;
    lt.chrono = { fps: s.fps.slice(), tempF: S.ui.cond.tempF, date: s.date };
    lt.updatedAt = Date.now();
    s.lotId = lt.id;
    touch(s);
    L.sfx.good();
    L.addXp(10, 'Chronograph string saved to the lot');
    render();
    L.toast(`${lt.loadName}: ${s.fps.length} shots, avg ${Math.round(s.stats.avg)} fps, SD ${s.stats.sd}`);
  }

  // ---- field

  function fieldLog() {
    const s = ensureSession();
    if (!s) return;
    const f = S.ui.f;
    s.shots.push(M.normalizeShot({
      yd: f.yd, angleDeg: f.angleDeg, dialE: f.dialE, dialW: f.dialW, result: f.result,
      offMil: f.result === 'hit' ? null : f.offMil, windMph: f.windMph, windClock: f.windClock,
      note: f.note, cond: liveCond(), t: Date.now(),
    }));
    f.note = ''; f.offMil = 0;
    touch(s); saveUi();
    L.sfx.click();
    render();
    L.replay($('#book-rows .bk-row'), 'new', 700);
  }
  function fieldDel(i) {
    const s = cur(); if (!s || !s.shots[i]) return;
    const x = s.shots[i];
    if (!confirm(`Delete the ${x.yd} yd ${x.result.toUpperCase()} row?`)) return;
    s.shots.splice(i, 1); touch(s); render();
  }

  // ---- rifle / lot editor

  function readNum(id) { const v = $(id).value.trim(); return v === '' ? null : +v; }

  function saveEdit(form) {
    const e = S.edit;
    if (e.type === 'rifle') {
      const fields = { name: $('#be-name').value.trim(), barrelIn: readNum('#be-barrelIn'), twistIn: readNum('#be-twistIn'), sightHeightIn: readNum('#be-sightHeightIn'), travelMil: readNum('#be-travelMil'), zeroYd: readNum('#be-zeroYd'), notes: $('#be-notes').value };
      if (!fields.name) { $('#be-name').focus(); return; }
      if (e.id) {
        const r = S.book.rifles.find((x) => x.id === e.id);
        Object.assign(r, M.normalizeRifle(Object.assign({}, r, fields, { updatedAt: Date.now() })));
      } else {
        const r = M.makeRifle(fields);
        S.book.rifles.push(r);
        S.ui.rifleId = r.id; S.ui.lotId = null;
        S.ui.cur = { zero: null, chrono: null, field: null };
      }
    } else {
      const fields = { loadName: $('#be-loadName').value.trim(), lotNo: $('#be-lotNo').value.trim(), bulletGr: readNum('#be-bulletGr'), bc: readNum('#be-bc'), dragModel: $('#be-dragModel').value, diaIn: readNum('#be-diaIn'), lenIn: readNum('#be-lenIn'), notes: $('#be-notes').value };
      if (!fields.loadName) { $('#be-loadName').focus(); return; }
      if (e.id) {
        const l = S.book.lots.find((x) => x.id === e.id);
        Object.assign(l, M.normalizeLot(Object.assign({}, l, fields, { updatedAt: Date.now() })));
      } else {
        const l = M.makeLot(S.ui.rifleId, fields);
        S.book.lots.push(l);
        S.ui.lotId = l.id;
      }
    }
    S.edit = null;
    saveBook(); saveUi(); render();
    L.sfx.click();
  }

  function seedFromCatalogue(kind, id) {
    if (!RANGE || !id) return;
    if (kind === 'optic') {
      const o = RANGE.optic(id);
      $('#be-travelMil').value = o.travelMil;
      if (!$('#be-sightHeightIn').value) $('#be-sightHeightIn').value = 1.9;
      L.toast(`${o.name}: ${o.travelMil} mil of travel`);
    } else {
      const l = RANGE.load(id);
      $('#be-loadName').value = `${l.brand} ${l.name}`;
      $('#be-bulletGr').value = l.bulletGr;
      $('#be-bc').value = l.bc;
      $('#be-dragModel').value = l.dragModel;
      $('#be-diaIn').value = l.diaIn;
      $('#be-lenIn').value = l.lenIn;
      L.toast('Published figures filled in — edit to match your box');
    }
  }

  function deleteRifle() {
    const r = rifle(); if (!r) return;
    const lots = lotsFor(r.id).length, sess = S.book.sessions.filter((s) => s.rifleId === r.id).length;
    if (!confirm(`Delete "${r.name}"?\n\nThis also deletes its ${lots} lot${lots === 1 ? '' : 's'} and ${sess} session${sess === 1 ? '' : 's'}. Export the book first if you want to keep them.`)) return;
    M.deleteRifle(S.book, r.id);
    S.edit = null;
    S.ui.rifleId = S.book.rifles.length ? S.book.rifles[0].id : null;
    S.ui.lotId = (lotsFor(S.ui.rifleId)[0] || {}).id || null;
    S.ui.cur = { zero: null, chrono: null, field: null };
    saveBook(); saveUi(); render();
    L.toast(`Rifle deleted with ${lots} lot(s) and ${sess} session(s)`);
  }

  function deleteLot() {
    const lt = lot(); if (!lt) return;
    const n = S.book.sessions.filter((s) => s.lotId === lt.id).length;
    if (!confirm(`Delete lot "${lt.loadName}"?\n\n${n} session${n === 1 ? '' : 's'} will keep their data but lose the link to this lot.`)) return;
    M.deleteLot(S.book, lt.id);
    S.edit = null;
    S.ui.lotId = (lotsFor(S.ui.rifleId)[0] || {}).id || null;
    saveBook(); saveUi(); render();
    L.toast('Lot deleted');
  }

  // ------------------------------------------------------------ export / import

  function exportText() { return JSON.stringify(S.book, null, 1); }

  function exportJson() {
    const blob = new Blob([exportText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lrps-databook-${M.today()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    L.toast(`Exported ${S.book.rifles.length} rifle(s), ${S.book.lots.length} lot(s), ${S.book.sessions.length} session(s)`);
  }

  /* Merge a JSON text into the book. Bad input leaves the book untouched. */
  function importText(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'Not a JSON file' }; }
    const v = M.validateBook(raw);
    if (!v.book.rifles.length && !v.book.lots.length && !v.book.sessions.length) {
      return { ok: false, error: v.errors[0] || 'No data book records in that file' };
    }
    const m = M.mergeBooks(S.book, v.book);
    S.book = m.book;
    saveBook();
    load(); render();
    return { ok: true, added: m.added, updated: m.updated, kept: m.kept, dropped: v.dropped };
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = importText(String(reader.result || ''));
      if (!r.ok) { L.toast(`Import failed: ${r.error}`, 'big'); return; }
      L.toast(`Imported: ${r.added} new, ${r.updated} updated, ${r.kept} kept${r.dropped ? `, ${r.dropped} invalid skipped` : ''}`);
    };
    reader.onerror = () => L.toast('Could not read that file');
    reader.readAsText(file);
  }

  // ------------------------------------------------------------ print

  function buildSheet(s) {
    const r = S.book.rifles.find((x) => x.id === s.rifleId) || {};
    const lt = S.book.lots.find((x) => x.id === s.lotId);
    const c = s.cond;
    const kv = (k, v) => `<div class="pf"><span>${k}</span><b>${v}</b></div>`;
    let body = '';
    if (s.kind === 'zero') {
      body = `<h2>Zero</h2>
        <div class="ps-grid3">${kv('Range', `${s.group.yd} yd`)}${kv('Group', s.group.sizeIn != null ? `${s.group.sizeIn}" = ${L.toUnit(s.group.sizeIn, s.group.yd).toFixed(2)} mil` : '____')}${kv('Confirmed', s.confirmed ? 'YES' : 'no')}
        ${kv('Dial ↑ from mech. zero', `${sign1(s.dial.e)} mil`)}${kv('Dial → from mech. zero', `${sign1(s.dial.w)} mil`)}${kv('Clicks', `${Math.round(s.dial.e / 0.1)} / ${Math.round(s.dial.w / 0.1)}`)}</div>`;
    } else if (s.kind === 'chrono') {
      const st = s.stats || M.chronoStats(s.fps);
      const rows = [];
      for (let i = 0; i < s.fps.length; i += 2) rows.push(`<tr><td>${i + 1}</td><td>${s.fps[i]}</td><td>${s.fps[i + 1] != null ? i + 2 : ''}</td><td>${s.fps[i + 1] != null ? s.fps[i + 1] : ''}</td></tr>`);
      body = `<h2>Chronograph string</h2>
        <table class="ps-tbl"><thead><tr><th>#</th><th>fps</th><th>#</th><th>fps</th></tr></thead><tbody>${rows.join('')}
        <tr><td colspan="2">Average <b>${Math.round(st.avg)}</b> · n ${st.n}</td><td colspan="2">SD <b>${st.sd}</b> · ES <b>${st.es}</b></td></tr></tbody></table>`;
    } else {
      const rows = s.shots.map((x) => `<tr><td>${x.yd}</td><td>${x.angleDeg || ''}</td><td>${sign1(x.dialE)}</td><td>${sign1(x.dialW)}</td><td>${esc(x.result.toUpperCase())}${x.offMil != null && x.result !== 'hit' ? ` ${sign1(x.offMil)}` : ''}</td><td>${x.windMph} @ ${x.windClock}</td><td>${x.cond.daFt}</td><td>${esc(x.note)}</td></tr>`).join('');
      body = `<h2>Field dope · as shot</h2>
        <table class="ps-tbl ps-dope"><thead><tr><th>Yds</th><th>Angle</th><th>Elev</th><th>Wind</th><th>Result</th><th>Wind mph @</th><th>DA</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
        <h2>Your card from it</h2>
        <table class="ps-tbl ps-dope"><thead><tr><th>Yds</th><th>Elev</th><th>5 mph</th><th>10 mph</th><th>15 mph</th><th>Confirmed / notes</th></tr></thead><tbody>
          ${[...new Set(s.shots.map((x) => x.yd))].sort((a, b) => a - b).map((y) => `<tr><td>${y}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
          ${'<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(Math.max(0, 8 - new Set(s.shots.map((x) => x.yd)).size))}
        </tbody></table>`;
    }
    $('#book-print-sheet').innerHTML = `
      <div class="ps-head"><div><div class="ps-tag">DATA BOOK · ${esc(s.kind.toUpperCase())} · MIL</div><h1>${esc(r.name || 'Rifle')}</h1></div><div class="ps-meta">${esc(s.date)}${s.place ? ' · ' + esc(s.place) : ''}</div></div>
      <div class="ps-grid3">
        ${kv('Rifle', `${r.barrelIn ? r.barrelIn + '" ' : ''}${r.twistIn ? '1:' + r.twistIn + ' ' : ''}· sight ${r.sightHeightIn}" · zero ${r.zeroYd} yd`)}
        ${kv('Ammo', lt ? `${esc(lt.loadName)}${lt.lotNo ? ' · lot ' + esc(lt.lotNo) : ''}${lt.bulletGr ? ' · ' + lt.bulletGr + ' gr' : ''}${lt.bc ? ' · ' + lt.dragModel + ' ' + lt.bc : ''}` : '____')}
        ${kv('Chrono', lt && lt.chrono && lt.chrono.fps.length ? `${Math.round(M.chronoStats(lt.chrono.fps).avg)} fps · SD ${M.chronoStats(lt.chrono.fps).sd}${lt.chrono.tempF != null ? ' @ ' + lt.chrono.tempF + '°F' : ''}` : '____')}
        ${kv('Altitude', `${c.altFt} ft${c.source === 'gps' ? ' (GPS)' : ''}`)}${kv('Temp', `${c.tempF} °F`)}${kv('Pressure', `${c.pressureInHg} inHg`)}
        ${kv('Humidity', `${c.humidityPct} %`)}${kv('Density altitude', `<span class="ps-big">${c.daFt.toLocaleString()} ft</span>`)}${kv('Click', '0.1 mil')}
      </div>
      ${body}
      ${s.notes ? `<h2>Notes</h2><p class="ps-note">${esc(s.notes)}</p>` : ''}
      <div class="ps-foot">Recorded, not predicted. Conditions were stamped when each entry was made. Full-value wind = 3 / 9 o'clock.</div>`;
    S.printing = s.id;
  }

  function printSession(id) {
    const s = session(id || S.ui.cur[S.ui.kind]);
    if (!s) { L.toast('Open a session to print it'); return; }
    buildSheet(s);
    document.body.classList.add('print-book');
    setTimeout(() => window.print(), 30);
  }

  // ------------------------------------------------------------ steppers (hold to repeat, accelerating)

  let hold = null;
  function stepKey(key, dir, mult) {
    const d = STEPS[key];
    const isCond = key in S.ui.cond;
    const curV = isCond ? S.ui.cond[key] : S.ui.f[key];
    let v = +curV + dir * d.step * (mult || 1);
    if (d.wrap) { const span = d.max - d.min + 1; v = ((v - d.min) % span + span) % span + d.min; }
    v = clampStep(key, v);
    if (isCond) S.ui.cond[key] = v; else S.ui.f[key] = v;
    const inp = $(`.bk-step-val[data-f="${key}"]`);
    if (inp) inp.value = v.toFixed(d.dec);
    afterStep(key);
  }
  function afterStep(key) {
    if (key in S.ui.cond) { condChanged(key); return; }
    saveUi();
    if (['zeroYd', 'groupIn', 'zDialE', 'zDialW'].includes(key)) zeroChanged();
    if (['yd', 'dialE', 'dialW'].includes(key)) { const b = $('[data-act="field-log"]'); if (b) b.textContent = `Log shot · ${S.ui.f.yd} yd · ${sign1(S.ui.f.dialE)} / ${sign1(S.ui.f.dialW)} · ${S.ui.f.result.toUpperCase()}`; }
  }
  function startHold(key, dir) {
    stopHold();
    stepKey(key, dir);
    L.sfx.click();
    let n = 0;
    const tick = () => {
      n++;
      const d = STEPS[key];
      const mult = d.accel && n > 14 ? 4 : d.accel && n > 6 ? 2 : 1;
      stepKey(key, dir, mult);
      hold.t = setTimeout(tick, n > 14 ? 60 : n > 6 ? 90 : 130);
    };
    hold = { t: setTimeout(tick, 380) };
  }
  function stopHold() { if (hold) { clearTimeout(hold.t); hold = null; } }

  function typedValue(key, raw) {
    const d = STEPS[key];
    const v = clampStep(key, raw);
    if (key in S.ui.cond) S.ui.cond[key] = v; else S.ui.f[key] = v;
    const inp = $(`.bk-step-val[data-f="${key}"]`);
    if (inp) inp.value = v.toFixed(d.dec);
    afterStep(key);
  }

  // ------------------------------------------------------------ events

  function bind() {
    const root = $('#book-main');

    root.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-stp]');
      if (!b) return;
      e.preventDefault();
      if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
      startHold(b.dataset.stp, +b.dataset.d);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('[data-stp]')) stopHold(); }));
    root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-stp]')) e.preventDefault(); });
    root.addEventListener('keydown', (e) => {
      const b = e.target.closest('[data-stp]');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); stepKey(b.dataset.stp, +b.dataset.d); L.sfx.click(); }
      if (e.key === 'Enter' && e.target.classList.contains('bk-step-val')) { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Enter' && e.target.classList.contains('bk-note')) { e.preventDefault(); fieldLog(); }
    });

    root.addEventListener('click', (e) => {
      const stp = e.target.closest('[data-stp]');
      if (stp) return; // handled by pointer events
      const res = e.target.closest('[data-res]');
      if (res) {
        S.ui.f.result = res.dataset.res; saveUi();
        $$('[data-res]', root).forEach((x) => { x.classList.toggle('on', x === res); x.setAttribute('aria-pressed', x === res); });
        const off = $('.bk-off', root); if (off) off.classList.toggle('dim', S.ui.f.result === 'hit');
        afterStep('yd');
        L.sfx.click();
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act, id = a.dataset.id;
      if (act === 'new-rifle') { S.edit = { type: 'rifle', id: null }; render(); $('#be-name').focus(); }
      else if (act === 'edit-rifle') { if (rifle()) { S.edit = { type: 'rifle', id: rifle().id }; render(); } }
      else if (act === 'new-lot') { if (rifle()) { S.edit = { type: 'lot', id: null }; render(); $('#be-loadName').focus(); } }
      else if (act === 'edit-lot') { if (lot()) { S.edit = { type: 'lot', id: lot().id }; render(); } }
      else if (act === 'cancel-edit') { S.edit = null; render(); }
      else if (act === 'delete-rifle') deleteRifle();
      else if (act === 'delete-lot') deleteLot();
      else if (act === 'gps') useGps();
      else if (act === 'press-std') { S.ui.cond.pressureAuto = true; S.ui.cond.pressureInHg = clampStep('pressureInHg', M.stdPressureInHg(S.ui.cond.altFt)); const pv = $('.bk-step-val[data-f="pressureInHg"]'); if (pv) pv.value = S.ui.cond.pressureInHg.toFixed(2); saveUi(); condChanged(null); }
      else if (act === 'new-session') newSession();
      else if (act === 'open-session') openSession(id);
      else if (act === 'delete-session') deleteSession(id);
      else if (act === 'print-session') printSession(id);
      else if (act === 'zero-confirm') zeroConfirm();
      else if (act === 'chrono-add') chronoAdd();
      else if (act === 'chrono-del') chronoDel(+a.dataset.i);
      else if (act === 'chrono-clear') chronoClear();
      else if (act === 'chrono-save') chronoSave();
      else if (act === 'field-log') fieldLog();
      else if (act === 'field-del') fieldDel(+a.dataset.i);
    });

    root.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.seed) { seedFromCatalogue(t.dataset.seed, t.value); return; }
      const f = t.dataset.f;
      if (!f) return;
      if (f === 'rifleId') { S.ui.rifleId = t.value; S.ui.lotId = (lotsFor(t.value)[0] || {}).id || null; S.ui.cur = { zero: null, chrono: null, field: null }; S.edit = null; saveUi(); render(); return; }
      if (f === 'lotId') { S.ui.lotId = t.value; const s = cur(); if (s) { s.lotId = t.value; touch(s); } saveUi(); render(); return; }
      if (f in STEPS) { typedValue(f, t.value); return; }
      if (f === 'date') { const s = ensureSession(); if (s && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) { s.date = t.value; touch(s); } return; }
      if (f === 'place') { S.ui.f.place = t.value.slice(0, 80); saveUi(); const s = cur(); if (s) { s.place = S.ui.f.place; touch(s); } return; }
      if (f === 'notes') { const s = ensureSession(); if (s) { s.notes = t.value.slice(0, 2000); touch(s); } return; }
      if (f === 'note') { S.ui.f.note = t.value.slice(0, 200); saveUi(); }
    });
    root.addEventListener('input', (e) => { if (e.target.dataset.f === 'note') S.ui.f.note = e.target.value.slice(0, 200); });
    root.addEventListener('submit', (e) => { if (e.target.id === 'book-edit') { e.preventDefault(); saveEdit(e.target); } });

    // segmented control is re-rendered each time, so the kind seg is handled by delegation
    root.addEventListener('click', (e) => {
      const b = e.target.closest('#book-kind button');
      if (b && b.dataset.v !== S.ui.kind) { L.sfx.click(); setKind(b.dataset.v); }
    });

    $('#book-field-mode').addEventListener('click', () => {
      S.ui.field = !S.ui.field; saveUi(); render();
      L.toast(S.ui.field ? 'Field mode: big, bright, fewer frills' : 'Field mode off');
    });
    $('#book-export').addEventListener('click', exportJson);
    $('#book-import').addEventListener('click', () => $('#book-import-file').click());
    $('#book-import-file').addEventListener('change', (e) => { importFile(e.target.files && e.target.files[0]); e.target.value = ''; });
    $('#book-print').addEventListener('click', () => printSession());
    window.addEventListener('beforeprint', () => { if (L.currentTab === 'book') { const s = cur(); if (s && S.printing !== s.id) buildSheet(s); if (s) document.body.classList.add('print-book'); } });
    window.addEventListener('afterprint', () => document.body.classList.remove('print-book'));
    window.addEventListener('pagehide', () => { saveUi(); });
  }

  // ------------------------------------------------------------ init

  function ensureInit() {
    if (S.inited) return;
    M = window.LRPS_BOOK;
    RANGE = window.LRPS_RANGE || null;
    if (!M || !$('#book-main')) return;
    S.inited = true;
    load();
    bind();
    render();
  }

  function onShown() { ensureInit(); }

  // Exposed for the smoke test and the console; the pure logic stays in the model.
  L.book = {
    exportText, importText,
    state: () => S,
    rerender: () => render(),
  };

  L.onTab('book', onShown);
  window.addEventListener('DOMContentLoaded', ensureInit);
})();
