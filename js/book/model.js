/*
 * Data Book model: the pure half of the Data Book tab.
 *
 * The book records what the shooter MEASURED with a real rifle on a real
 * range. Governing rule: identity on the rifle profile, measurements on the
 * ammo lot, evidence on each row, and a snapshot of the conditions stored on
 * every row — never recomputed later. Later phases (truing, field cards) read
 * these records; nothing here predicts anything.
 *
 * Stored as one object under lrps.book:
 *   { v: 1, rifles: [], lots: [], sessions: [] }
 *
 * UMD like the solver: loads in the browser (window.LRPS_BOOK) and in Node
 * tests (require). Density altitude comes from the solver's own atmosphere
 * function, so the number on the card is the number the solver would use.
 */
(function (root) {
  'use strict';

  const B = (typeof module !== 'undefined' && module.exports) ? require('../ballistics.js') : root.Ballistics;

  const VERSION = 1;
  const KINDS = ['zero', 'chrono', 'field'];
  const RESULTS = ['hit', 'high', 'low', 'left', 'right', 'miss'];
  const FT = 0.3048;

  // ------------------------------------------------------------ helpers

  const num = (v, fb) => (v === '' || v == null ? fb : Number.isFinite(+v) ? +v : fb);
  const numOrNull = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max || 200) : v == null ? '' : String(v).slice(0, max || 200));
  const bool = (v) => !!v;
  const round = (v, d) => { const m = Math.pow(10, d || 0); return Math.round(v * m) / m; };

  let idSeq = 0;
  function newId(prefix) {
    idSeq = (idSeq + 1) % 1296;
    return `${prefix || 'x'}${Date.now().toString(36)}${idSeq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  // ------------------------------------------------------------ conditions

  /* ICAO standard pressure at an altitude, inHg. */
  function stdPressureInHg(altFt) {
    return 29.92126 * Math.pow(1 - 2.25577e-5 * num(altFt, 0) * FT, 5.25588);
  }

  /*
   * Density altitude, ft, from what the shooter reads off a weather meter.
   * Station pressure (inHg) takes priority over altitude when given; the
   * solver's atmosphere() does the same, so the card and the solver agree.
   */
  function densityAltitude(c) {
    const cond = c || {};
    const p = numOrNull(cond.pressureInHg);
    const atm = B.atmosphere({
      altitudeFt: num(cond.altFt, 0),
      tempF: num(cond.tempF, 59),
      humidityPct: Math.max(0, Math.min(100, num(cond.humidityPct, 0))),
      stationPressureInHg: p != null && p > 0 ? p : null,
    });
    return Math.round(atm.densityAltitudeFt);
  }

  /* A conditions snapshot to stamp on a record: inputs plus the DA they give. */
  function snapshot(c) {
    const cond = c || {};
    const out = {
      altFt: round(num(cond.altFt, 0)),
      tempF: round(num(cond.tempF, 59), 1),
      pressureInHg: round(num(cond.pressureInHg, stdPressureInHg(num(cond.altFt, 0))), 2),
      humidityPct: Math.max(0, Math.min(100, round(num(cond.humidityPct, 0)))),
      source: cond.source === 'gps' ? 'gps' : 'typed',
    };
    out.daFt = densityAltitude(out);
    return out;
  }

  /* Accept a stored snapshot as-is (its daFt is evidence); fill a missing DA once. */
  function normalizeCond(c) {
    if (!c || typeof c !== 'object') return snapshot({});
    const out = {
      altFt: num(c.altFt, 0), tempF: num(c.tempF, 59), pressureInHg: num(c.pressureInHg, stdPressureInHg(num(c.altFt, 0))),
      humidityPct: Math.max(0, Math.min(100, num(c.humidityPct, 0))), source: c.source === 'gps' ? 'gps' : 'typed',
    };
    out.daFt = Number.isFinite(+c.daFt) ? Math.round(+c.daFt) : densityAltitude(out);
    return out;
  }

  // ------------------------------------------------------------ chronograph

  /* Velocity string statistics. SD is the sample SD (n − 1). */
  function chronoStats(arr) {
    const v = (Array.isArray(arr) ? arr : []).map(Number).filter((x) => Number.isFinite(x) && x > 0);
    if (!v.length) return { n: 0, avg: 0, sd: 0, es: 0, min: 0, max: 0 };
    const n = v.length;
    const avg = v.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
    const min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    return { n, avg: round(avg, 1), sd: round(sd, 1), es: round(max - min, 1), min, max };
  }

  /* "2710, 2718 2704" → [2710, 2718, 2704] */
  const parseFps = (text) => String(text == null ? '' : text).split(/[,\s;]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0);

  // ------------------------------------------------------------ records

  function normalizeRifle(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) return null;
    return {
      id: str(r.id, 64),
      name: str(r.name, 80) || 'Rifle',
      barrelIn: numOrNull(r.barrelIn),
      twistIn: numOrNull(r.twistIn),
      sightHeightIn: num(r.sightHeightIn, 1.9),
      clickMil: 0.1,
      travelMil: numOrNull(r.travelMil),
      zeroYd: num(r.zeroYd, 100),
      notes: str(r.notes, 1000),
      createdAt: num(r.createdAt, 0),
      updatedAt: num(r.updatedAt, num(r.createdAt, 0)),
    };
  }

  function normalizeLot(l) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !l.id || typeof l.rifleId !== 'string') return null;
    const ch = l.chrono && typeof l.chrono === 'object' ? l.chrono : null;
    return {
      id: str(l.id, 64),
      rifleId: str(l.rifleId, 64),
      loadName: str(l.loadName, 80) || 'Load',
      lotNo: str(l.lotNo, 40),
      bulletGr: numOrNull(l.bulletGr),
      diaIn: numOrNull(l.diaIn),
      lenIn: numOrNull(l.lenIn),
      bc: numOrNull(l.bc),
      dragModel: l.dragModel === 'G1' ? 'G1' : 'G7',
      chrono: ch ? { fps: parseFps(Array.isArray(ch.fps) ? ch.fps.join(' ') : ch.fps), tempF: numOrNull(ch.tempF), date: isDate(ch.date) ? ch.date : '' } : null,
      notes: str(l.notes, 1000),
      createdAt: num(l.createdAt, 0),
      updatedAt: num(l.updatedAt, num(l.createdAt, 0)),
    };
  }

  function normalizeShot(s) {
    if (!s || typeof s !== 'object') return null;
    const yd = numOrNull(s.yd);
    if (yd == null || yd <= 0) return null;
    return {
      yd: Math.round(yd),
      angleDeg: num(s.angleDeg, 0),
      dialE: round(num(s.dialE, 0), 1),
      dialW: round(num(s.dialW, 0), 1),
      result: RESULTS.includes(s.result) ? s.result : 'miss',
      offMil: numOrNull(s.offMil),
      windMph: num(s.windMph, 0),
      windClock: num(s.windClock, 12),
      note: str(s.note, 200),
      cond: normalizeCond(s.cond),
      t: num(s.t, 0),
    };
  }

  function normalizeSession(s) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || typeof s.rifleId !== 'string') return null;
    if (!KINDS.includes(s.kind)) return null;
    const out = {
      id: str(s.id, 64),
      rifleId: str(s.rifleId, 64),
      lotId: typeof s.lotId === 'string' && s.lotId ? str(s.lotId, 64) : null,
      kind: s.kind,
      date: isDate(s.date) ? s.date : today(),
      place: str(s.place, 80),
      cond: normalizeCond(s.cond),
      notes: str(s.notes, 2000),
      createdAt: num(s.createdAt, 0),
      updatedAt: num(s.updatedAt, num(s.createdAt, 0)),
    };
    if (s.kind === 'zero') {
      const g = s.group && typeof s.group === 'object' ? s.group : {};
      const d = s.dial && typeof s.dial === 'object' ? s.dial : {};
      out.group = { sizeIn: numOrNull(g.sizeIn), yd: num(g.yd, 100) };
      out.dial = { e: round(num(d.e, 0), 1), w: round(num(d.w, 0), 1) };
      out.confirmed = bool(s.confirmed);
    } else if (s.kind === 'chrono') {
      out.fps = parseFps(Array.isArray(s.fps) ? s.fps.join(' ') : s.fps);
      out.stats = chronoStats(out.fps);
    } else {
      out.shots = (Array.isArray(s.shots) ? s.shots : []).map(normalizeShot).filter(Boolean);
    }
    return out;
  }

  function blankBook() { return { v: VERSION, rifles: [], lots: [], sessions: [] }; }

  /*
   * Validate anything claiming to be a book (a stored value or an imported
   * file). Bad records are dropped and counted; a bad container becomes an
   * empty book. Orphans (lots without their rifle, sessions without their
   * rifle) are dropped too, so a cascade delete can never leave ghosts.
   */
  function validateBook(raw) {
    const errors = [];
    const book = blankBook();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, book, errors: ['not a data book object'], dropped: 0 };
    }
    if (raw.v != null && +raw.v > VERSION) errors.push(`newer format (v${raw.v}); reading what this version understands`);
    let dropped = 0;
    const seen = new Set();
    const take = (list, fn, out, label) => {
      if (list == null) return;
      if (!Array.isArray(list)) { errors.push(`${label}: not a list`); return; }
      list.forEach((x, i) => {
        const r = fn(x);
        if (!r) { dropped++; errors.push(`${label}[${i}]: invalid record dropped`); return; }
        if (seen.has(label + r.id)) { dropped++; errors.push(`${label}[${i}]: duplicate id ${r.id}`); return; }
        seen.add(label + r.id);
        out.push(r);
      });
    };
    take(raw.rifles, normalizeRifle, book.rifles, 'rifles');
    take(raw.lots, normalizeLot, book.lots, 'lots');
    take(raw.sessions, normalizeSession, book.sessions, 'sessions');
    const rifleIds = new Set(book.rifles.map((r) => r.id));
    book.lots = book.lots.filter((l) => { const ok = rifleIds.has(l.rifleId); if (!ok) { dropped++; errors.push(`lot ${l.id}: rifle ${l.rifleId} missing`); } return ok; });
    const lotIds = new Set(book.lots.map((l) => l.id));
    book.sessions = book.sessions.filter((s) => { const ok = rifleIds.has(s.rifleId); if (!ok) { dropped++; errors.push(`session ${s.id}: rifle ${s.rifleId} missing`); } return ok; });
    book.sessions.forEach((s) => { if (s.lotId && !lotIds.has(s.lotId)) s.lotId = null; });
    return { ok: errors.length === 0, book, errors, dropped };
  }

  /*
   * Merge an imported book into the current one by id. A record already in
   * the base is only replaced when the incoming copy is NEWER (updatedAt);
   * ties and older copies keep the base. Returns counts for the toast.
   */
  function mergeBooks(base, incoming) {
    const out = validateBook(base).book;
    const inc = validateBook(incoming).book;
    const counts = { added: 0, updated: 0, kept: 0 };
    const mergeList = (a, b) => {
      const byId = new Map(a.map((r) => [r.id, r]));
      b.forEach((r) => {
        const cur = byId.get(r.id);
        if (!cur) { byId.set(r.id, r); counts.added++; }
        else if (r.updatedAt > cur.updatedAt) { byId.set(r.id, r); counts.updated++; }
        else counts.kept++;
      });
      return Array.from(byId.values());
    };
    out.rifles = mergeList(out.rifles, inc.rifles);
    out.lots = mergeList(out.lots, inc.lots);
    out.sessions = mergeList(out.sessions, inc.sessions);
    return Object.assign({ book: validateBook(out).book }, counts);
  }

  // ------------------------------------------------------------ factories

  function makeRifle(fields) {
    const t = Date.now();
    return normalizeRifle(Object.assign({ id: newId('r'), createdAt: t, updatedAt: t }, fields || {}));
  }
  function makeLot(rifleId, fields) {
    const t = Date.now();
    return normalizeLot(Object.assign({ id: newId('l'), rifleId, createdAt: t, updatedAt: t }, fields || {}));
  }
  function makeSession(kind, rifleId, lotId, cond, fields) {
    const t = Date.now();
    return normalizeSession(Object.assign({ id: newId('s'), kind, rifleId, lotId, date: today(), cond: snapshot(cond), createdAt: t, updatedAt: t }, fields || {}));
  }

  /* Delete a rifle and everything hanging off it. Returns what went with it. */
  function deleteRifle(book, rifleId) {
    const lots = book.lots.filter((l) => l.rifleId === rifleId).length;
    const sessions = book.sessions.filter((s) => s.rifleId === rifleId).length;
    book.rifles = book.rifles.filter((r) => r.id !== rifleId);
    book.lots = book.lots.filter((l) => l.rifleId !== rifleId);
    book.sessions = book.sessions.filter((s) => s.rifleId !== rifleId);
    return { lots, sessions };
  }

  /* Delete a lot; its sessions stay (they lose the lot link, not the data). */
  function deleteLot(book, lotId) {
    book.lots = book.lots.filter((l) => l.id !== lotId);
    let unlinked = 0;
    book.sessions.forEach((s) => { if (s.lotId === lotId) { s.lotId = null; unlinked++; } });
    return { unlinked };
  }

  // ------------------------------------------------------------ summaries

  const sign1 = (v) => (v >= 0 ? '+' : '') + (+v).toFixed(1);

  /* One line for the sessions list. */
  function sessionSummary(s) {
    if (s.kind === 'zero') {
      const g = s.group.sizeIn != null ? `${s.group.sizeIn}" at ${s.group.yd} yd` : `${s.group.yd} yd`;
      return `${g} · dial ${sign1(s.dial.e)} / ${sign1(s.dial.w)}${s.confirmed ? ' · confirmed' : ''}`;
    }
    if (s.kind === 'chrono') {
      const st = s.stats || chronoStats(s.fps);
      return st.n ? `${st.n} shots · avg ${Math.round(st.avg)} · SD ${st.sd} · ES ${st.es}` : 'no shots';
    }
    const n = s.shots.length;
    if (!n) return 'no shots';
    const yds = s.shots.map((x) => x.yd);
    const hits = s.shots.filter((x) => x.result === 'hit').length;
    return `${n} shot${n > 1 ? 's' : ''} · ${Math.min.apply(null, yds)}–${Math.max.apply(null, yds)} yd · ${hits} hit${hits === 1 ? '' : 's'}`;
  }

  const api = {
    VERSION, KINDS, RESULTS,
    newId, today, stdPressureInHg, densityAltitude, snapshot, normalizeCond,
    chronoStats, parseFps,
    normalizeRifle, normalizeLot, normalizeSession, normalizeShot,
    blankBook, validateBook, mergeBooks,
    makeRifle, makeLot, makeSession, deleteRifle, deleteLot,
    sessionSummary,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LRPS_BOOK = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
