/*
 * Academy tab: a linear, module-based course. Lessons unlock in order —
 * each one builds on the previous — unless review mode is on.
 * Course structure: window.LRPS_COURSE (academy-curriculum.js), which reuses
 * lessons from the bank in window.LRPS_ACADEMY (academy-content.js).
 */
(function () {
  'use strict';

  const L = window.LRPS;
  const { B, $, $$ } = L;

  // ------------------------------------------------------------ course

  const bank = {};
  window.LRPS_ACADEMY.forEach((ch) => ch.lessons.forEach((l) => { bank[l.id] = l; }));

  const MODULES = window.LRPS_COURSE.map((m, mi) => {
    const lessons = m.lessons.map((x) => {
      const base = x.ref ? bank[x.ref] : {};
      return Object.assign({}, base, x, { id: x.ref || x.id });
    });
    return Object.assign({}, m, { mi, lessons });
  });
  const ORDER = [];   // the linear path (reference modules excluded)
  MODULES.forEach((m) => m.lessons.forEach((l, li) => {
    l.m = m; l.li = li;
    if (!m.reference) { l.idx = ORDER.length; ORDER.push(l); }
  }));
  const byId = {};
  MODULES.forEach((m) => m.lessons.forEach((l) => { byId[l.id] = l; }));

  let done = L.store.get('academy.done', {});
  let review = L.store.get('academy.review', false);
  let view = 'map';

  const isUnlocked = (l) => review || l.m.reference || l.idx === 0 || done[l.id] || done[ORDER[l.idx - 1].id];
  const modDone = (m) => m.lessons.filter((l) => done[l.id]).length;
  const modComplete = (m) => modDone(m) === m.lessons.length;
  const modUnlocked = (m) => m.lessons.some(isUnlocked);
  const nextLesson = () => ORDER.find((l) => !done[l.id]) || ORDER[ORDER.length - 1];
  const num = (m) => String(m.mi).padStart(2, '0');
  const code = (l) => (l.m.reference ? '★' : `${num(l.m)}.${l.li + 1}`);
  const mins = (m) => m.lessons.reduce((a, l) => a + (l.mins || 0), 0);

  const LOCK = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const CHECK = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>';

  // ------------------------------------------------------------ sidebar

  function renderSide() {
    const total = ORDER.length;
    const n = ORDER.filter((l) => done[l.id]).length;
    const cur = view !== 'map' ? byId[view] : null;
    $('#ac-progress').innerHTML = `
      <button class="btn block ac-mapbtn${view === 'map' ? ' on' : ''}" id="ac-map">☰ Table of contents</button>
      <div class="ac-prog-top"><b>${n}/${total}</b> lessons · ${Math.round(n / total * 100)}%</div>
      <div class="xp-bar"><span style="width:${n / total * 100}%"></span></div>`;
    $('#ac-map').addEventListener('click', () => showMap());
    $('#ac-nav').innerHTML = MODULES.map((m) => {
      const open = cur && cur.m === m;
      const unlocked = modUnlocked(m);
      return `<div class="ac-ch${unlocked ? '' : ' locked'}">
        <button class="ac-ch-title" data-mod="${m.id}"${unlocked ? '' : ' disabled'}><span class="num">${m.reference ? '★' : num(m)}</span>${m.title}
          <span class="ac-ch-count">${unlocked ? (m.reference ? '' : `${modDone(m)}/${m.lessons.length}`) : LOCK}</span></button>
        ${open ? m.lessons.map((l) => `<button class="ac-link${l.id === view ? ' on' : ''}${done[l.id] ? ' done' : ''}" data-lesson="${l.id}"${isUnlocked(l) ? '' : ' disabled'}>
          <span class="ac-dot"></span><span class="ac-code">${code(l)}</span>${l.title}${isUnlocked(l) ? '' : LOCK}</button>`).join('') : ''}
      </div>`;
    }).join('') + `<label class="check ac-review"><input type="checkbox" id="ac-review"${review ? ' checked' : ''}> Review mode (unlock everything)</label>`;
    $('#ac-review').addEventListener('change', (e) => { review = e.target.checked; L.store.set('academy.review', review); renderSide(); if (view === 'map') showMap(true); });
    $('#ac-select').innerHTML = '<option value="map">Table of contents</option>' + `<option value="review">${review ? '☑' : '☐'} Review mode (unlock everything)</option>` + MODULES.map((m) =>
      `<optgroup label="${m.reference ? '★' : num(m)} · ${m.title}">${m.lessons.map((l) =>
        `<option value="${l.id}"${l.id === view ? ' selected' : ''}${isUnlocked(l) ? '' : ' disabled'}>${done[l.id] ? '✓ ' : isUnlocked(l) ? '' : '🔒 '}${code(l)} ${l.title}</option>`).join('')}</optgroup>`).join('');
  }

  $('#ac-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lesson]');
    if (b && !b.disabled) { open(b.dataset.lesson); return; }
    const mb = e.target.closest('[data-mod]');
    if (mb && !mb.disabled) openModule(mb.dataset.mod);
  });
  $('#ac-select').addEventListener('change', (e) => {
    if (e.target.value === 'review') { review = !review; L.store.set('academy.review', review); renderSide(); if (view === 'map') showMap(true); return; }
    e.target.value === 'map' ? showMap() : open(e.target.value);
  });

  function openModule(id) {
    const m = MODULES.find((x) => x.id === id);
    const target = m.lessons.find((l) => isUnlocked(l) && !done[l.id]) || m.lessons.find(isUnlocked);
    if (target) open(target.id);
  }

  // ------------------------------------------------------------ course map

  function showMap(noScroll) {
    view = 'map';
    if (figObserver) figObserver.disconnect();
    L.store.set('academy.last', 'map');
    const nx = nextLesson();
    const started = ORDER.some((l) => done[l.id]);
    $('#ac-main').innerHTML = `
      <div class="map-hero">
        <div><div class="eyebrow">Your path</div><h2 class="ac-title">From first principles to first-round hits</h2>
        <p class="muted">${ORDER.length} lessons in ${MODULES.filter((m) => !m.reference).length} modules. Each module uses what the previous one taught,
          so lessons unlock in order: pass a lesson's quiz to open the next.</p></div>
        <button class="btn primary big" id="ac-continue">${started ? 'Continue' : 'Start'}: ${nx.title} →</button>
      </div>
      ${window.ISO && ISO.registry.module.course ? `<div class="map-hero-art">${figureHtml(cachedSvg('module:course', ISO.registry.module.course), '')}</div>` : ''}
      <div class="toc-tools"><h3>Table of contents</h3>
        <span><button class="btn" id="toc-expand">Expand all</button> <button class="btn" id="toc-collapse">Collapse all</button></span></div>
      <div class="path">${MODULES.map((m, k) => {
        const unlocked = modUnlocked(m);
        const d = modDone(m);
        const status = m.reference ? 'Reference' : modComplete(m) ? 'Completed' : !unlocked ? 'Locked' : d ? 'In progress' : 'Ready';
        const prev = MODULES[k - 1];
        const openMod = nx.m === m || status === 'In progress';
        const rows = m.lessons.map((l) => {
          const ok = isUnlocked(l);
          const st = done[l.id] ? `<span class="toc-st done">${CHECK}</span>` : !ok ? `<span class="toc-st">${LOCK}</span>` : l === nx ? '<span class="toc-st next">●</span>' : '<span class="toc-st"></span>';
          return `<button class="toc-row${l === nx ? ' next' : ''}" data-lesson="${l.id}"${ok ? '' : ' disabled'}>
            <span class="toc-code">${code(l)}</span><span class="toc-title">${l.title}</span>
            <span class="toc-mins">${l.mins ? l.mins + ' min' : ''}</span>${st}</button>`;
        }).join('');
        return `<details class="path-mod ${status.toLowerCase().replace(' ', '-')}"${openMod ? ' open' : ''}>
          <summary>
            ${moduleThumb(m)}
            <span class="path-num">${m.reference ? '★' : modComplete(m) ? CHECK : unlocked ? num(m) : LOCK}</span>
            <span class="path-body">
              <span class="path-top"><b>${m.reference ? '' : `Module ${num(m)} · `}${m.title}</b><span class="path-status">${status}</span></span>
              <span class="path-goal">${m.goal}</span>
              <span class="path-meta">${m.reference ? 'Always available' : `${m.lessons.length} lessons · ~${mins(m)} min${prev && !prev.reference && k > 0 ? ` · builds on ${num(prev)} ${prev.title}` : ''}`}</span>
              ${m.reference ? '' : `<span class="path-bar"><span style="width:${d / m.lessons.length * 100}%"></span></span>`}
            </span>
          </summary>
          <div class="toc-list">${rows}</div>
        </details>`;
      }).join('')}</div>`;
    $('#ac-continue').addEventListener('click', () => open(nx.id));
    $$('.toc-row', $('#ac-main')).forEach((b) => b.addEventListener('click', () => open(b.dataset.lesson)));
    $('#toc-expand').addEventListener('click', () => $$('.path-mod', $('#ac-main')).forEach((d) => { d.open = true; }));
    $('#toc-collapse').addEventListener('click', () => $$('.path-mod', $('#ac-main')).forEach((d) => { d.open = false; }));
    renderSide();
    watchFigures();
    L.enter($('#ac-main'));
    if (!noScroll) $('#tab-academy').scrollIntoView({ block: 'start' });
  }

  // ------------------------------------------------------------ lesson

  function open(id, noScroll) {
    const l = byId[id];
    if (!l || !isUnlocked(l)) { showMap(noScroll); return; }
    view = id;
    if (figObserver) figObserver.disconnect();
    L.store.set('academy.last', id);
    const m = l.m;
    const prev = l.m.reference ? null : ORDER[l.idx - 1];
    const next = l.m.reference ? null : ORDER[l.idx + 1];
    const terms = (l.terms || []).map((t) => `<span class="term">${t}</span>`).join('');
    const recap = (l.recap || []).map((r) => `<li>${r}</li>`).join('');
    $('#ac-main').innerHTML = `
      <div class="crumb"><a href="#" id="ac-crumb-map">Contents</a> › Module ${m.reference ? '★' : num(m)} · ${m.title} › Lesson ${l.li + 1} of ${m.lessons.length}</div>
      <h2 class="ac-title"><span class="ac-title-code">${code(l)}</span>${l.title}</h2>
      <div class="ac-meta hint">${l.mins ? `${l.mins} min read` : ''}${done[l.id] ? ' · <span style="color:var(--good)">completed</span>' : ''}
        ${prev ? ` · builds on <a href="#" data-open="${prev.id}">${prev.title}</a>` : ''}</div>
      ${terms ? `<div class="terms"><span class="terms-label">Key terms</span>${terms}</div>` : ''}
      <nav class="lesson-toc" id="lesson-toc"></nav>
      <div class="ac-body">${l.html}</div>
      ${recap ? `<div class="recap"><div class="eyebrow" style="margin:0 0 6px">What you now know</div><ul>${recap}</ul></div>` : ''}
      <div id="ac-quiz"></div>
      <div class="ac-nav-row" id="ac-navrow"></div>`;
    $('#ac-crumb-map').addEventListener('click', (e) => { e.preventDefault(); showMap(); });
    $$('.ac-meta [data-open]', $('#ac-main')).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); open(a.dataset.open); }));
    $$('.ac-body table', $('#ac-main')).forEach((t) => {
      if (t.parentElement.classList.contains('table-wrap')) return;
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.replaceWith(w);
      w.appendChild(t);
    });
    $$('.ac-body a[data-goto]', $('#ac-main')).forEach((a) => { if (!a.getAttribute('href')) a.href = '#' + a.dataset.goto; });
    $$('[data-widget]', $('#ac-main')).forEach((el) => {
      const w = WIDGETS[el.dataset.widget];
      if (w) w(el);
    });
    renderFigures(l);
    renderQuiz(l);
    renderNav(l, prev, next);
    renderLessonToc();
    renderSide();
    watchFigures();
    L.enter($('#ac-main'));
    if (!noScroll) $('#tab-academy').scrollIntoView({ block: 'start' });
  }

  // Isometric illustrations registered in js/illus/*.js (ISO.lesson / ISO.module)
  function figureHtml(svg, caption) {
    return `<figure class="illus">${svg}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }

  // Figures rise in as they scroll into view (purely cosmetic; skipped under reduced motion)
  let figObserver = null;
  function watchFigures() {
    if (!('IntersectionObserver' in window) || L.reducedMotion()) return;
    if (!figObserver) {
      figObserver = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          figObserver.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    }
    $$('#ac-main figure.illus:not(.io)').forEach((f) => { f.classList.add('io'); figObserver.observe(f); });
  }
  function renderFigures(l) {
    const ISO = window.ISO;
    if (!ISO) return;
    const body = $('#ac-main .ac-body');
    let figs = ISO.registry.lesson[l.id] || [];
    if (!figs.length && ISO.registry.module[l.m.id]) figs = [{ draw: ISO.registry.module[l.m.id], caption: '' }];
    figs.forEach((f, idx) => {
      const svg = cachedSvg(`lesson:${l.id}:${idx}`, f.draw);
      if (!svg) return;
      const html = figureHtml(svg, f.caption);
      const rule = $('.callout.rule', body);
      // An anchor inside a scrolling table wrapper places the figure outside the wrapper
      const anchor = (sel) => { const el = $(sel, body); return el ? (el.closest('.table-wrap') || el) : null; };
      if (f.at === 'top' || (!rule && f.at !== 'end')) body.insertAdjacentHTML('afterbegin', html);
      else if (f.at === 'end') body.insertAdjacentHTML('beforeend', html);
      else if (f.at && f.at.startsWith('before:') && anchor(f.at.slice(7))) anchor(f.at.slice(7)).insertAdjacentHTML('beforebegin', html);
      else if (f.at && f.at.startsWith('after:') && anchor(f.at.slice(6))) anchor(f.at.slice(6)).insertAdjacentHTML('afterend', html);
      else {
        // after the rule, keeping figures in registration order
        const prevFigs = [];
        let n = rule.nextElementSibling;
        while (n && n.matches('figure.illus')) { prevFigs.push(n); n = n.nextElementSibling; }
        (prevFigs[prevFigs.length - 1] || rule).insertAdjacentHTML('afterend', html);
      }
    });
  }

  // Illustrations are deterministic, so each one is drawn once per page load
  const svgCache = new Map();
  function cachedSvg(key, draw) {
    if (!svgCache.has(key)) {
      try { svgCache.set(key, draw()); } catch (e) { console.error('illustration failed', key, e); svgCache.set(key, ''); }
    }
    return svgCache.get(key);
  }
  function moduleThumb(m) {
    const ISO = window.ISO;
    const draw = ISO && ISO.registry.module[m.id];
    if (!draw) return '';
    const svg = cachedSvg('module:' + m.id, draw);
    return svg ? `<span class="path-thumb">${svg}</span>` : '';
  }

  // "In this lesson": the rule, each section heading, widgets, recap, quiz
  function renderLessonToc() {
    const main = $('#ac-main');
    const items = [];
    const add = (el, label, kind) => {
      if (!el) return;
      el.id = el.id || `sec-${items.length}`;
      items.push(`<a href="#${el.id}" data-sec="${el.id}" class="lt-${kind}">${label}</a>`);
    };
    add($('.ac-body .callout.rule', main), 'The rule', 'rule');
    $$('.ac-body h4, .ac-body .widget-title', main).forEach((h) => {
      const isWidget = h.classList.contains('widget-title');
      const text = isWidget ? 'Try it: ' + h.textContent.replace(/^Try it/, '').trim() : h.textContent.trim();
      add(isWidget ? h.closest('.widget') : h, text, isWidget ? 'widget' : 'h');
    });
    add($('.recap', main), 'What you now know', 'recap');
    add($('.quiz', main), 'Quiz', 'quiz');
    const nav = $('#lesson-toc');
    if (items.length < 3) { nav.remove(); return; }
    nav.innerHTML = `<div class="lt-head">In this lesson</div><div class="lt-items">${items.join('')}</div>`;
    $$('[data-sec]', nav).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(a.dataset.sec).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function renderNav(l, prev, next) {
    const row = $('#ac-navrow');
    const nextOpen = next && (review || done[l.id]);
    const moduleEnd = next && next.m !== l.m;
    row.innerHTML = `${prev ? `<button class="btn" data-open="${prev.id}">← ${prev.title}</button>` : '<button class="btn" data-map="1">← Table of contents</button>'}
      ${next ? (nextOpen
        ? `<button class="btn primary" data-open="${next.id}">${moduleEnd ? `Next module: ${next.m.title}` : next.title} →</button>`
        : `<button class="btn" disabled>${LOCK} ${l.quiz && l.quiz.length ? 'Pass the quiz to unlock the next lesson' : 'Finish this lesson to continue'}</button>`)
        : l.m.reference ? '' : '<button class="btn primary" data-map="1">Course complete — back to contents</button>'}`;
    $$('[data-open]', row).forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));
    $$('[data-map]', row).forEach((b) => b.addEventListener('click', () => showMap()));
  }

  function complete(l, xp) {
    if (done[l.id]) return;
    done[l.id] = true;
    L.store.set('academy.done', done);
    L.addXp(xp, 'lesson complete');
    const idx = l.idx;
    renderNav(l, ORDER[idx - 1], ORDER[idx + 1]);
    renderSide();
    if (!l.m.reference && modComplete(l.m)) {
      setTimeout(() => {
        L.toast(`Module ${num(l.m)} complete: ${l.m.title}`, 'xp big');
        L.addXp(50, 'module complete');
        L.confetti();
        L.sfx.good();
      }, 500);
    }
  }

  function renderQuiz(l) {
    const box = $('#ac-quiz');
    if (!l.quiz || !l.quiz.length) {
      box.innerHTML = done[l.id] || l.m.reference ? '' : '<div class="actions"><button class="btn primary" id="ac-done">Mark as read and continue</button></div>';
      const b = $('#ac-done');
      if (b) b.addEventListener('click', () => { complete(l, 10); renderQuiz(l); });
      return;
    }
    const answers = new Array(l.quiz.length).fill(null);
    box.innerHTML = `<div class="quiz">
      <div class="card-title" style="margin-bottom:6px"><h3>Check your model</h3><span class="hint">${done[l.id] ? 'completed · retake any time' : 'pass to unlock the next lesson'}</span></div>
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
        ? `${score}/${l.quiz.length} — lesson complete.${ORDER[l.idx + 1] ? ' Next lesson unlocked.' : ''}`
        : `${score}/${l.quiz.length}. Re-read the rule at the top, then retry — the next lesson builds on this one.`}</div>
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

  const deckXp = new Set();
  const NO_REACH = '<p class="hint">Your Build Card load does not reach this distance — pick a faster load to use this calculator.</p>';
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
        if (!here || !std) { $('.w-out', box).innerHTML = NO_REACH; return; }
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
        return { v: Math.abs(Math.sin(clock * Math.PI / 6)), hold: r ? L.toUnit(-r.windIn, 800, u) : NaN, u };
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
        if (!a || !c) { $('.w-out', box).innerHTML = NO_REACH; return; }
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
        '6.5 Creedmoor 140 ELD-M': ['Low–moderate', '2,500–3,500'], '6.5 PRC 147 ELD-M': ['Moderate', '1,500–2,500'],
        '.308 Win 175 SMK': ['Moderate', '5,000+'], '.300 Win Mag 215 Hybrid': ['High', '1,500–2,500'],
        '.300 PRC 225 ELD-M': ['High', '1,500–2,500'], '.338 Lapua 300 Hybrid': ['Very high', '2,000–3,000'],
      };
      const ranges = [];
      for (let r = 25; r <= 1600; r += 25) ranges.push(r);
      const rows = L.PRESETS.map((p) => {
        const res = B.solve(L.solverInput(Object.assign({}, L.DEFAULT_PROFILE, p), { windMph: 10, windClock: 3 }), ranges);
        const okRows = res.rows.filter(Boolean);
        const r1k = okRows.find((r) => r.yards === 1000) || okRows[okRows.length - 1];
        const trans = okRows.find((r) => r.mach < 1.2);
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
        const at = (mv) => (B.solve(L.solverInput(p, { windMph: 0, muzzleVelocityFps: mv, zeroAngleRad: zero, tempSensitivity: 0 }), [r]).rows[0] || { dropIn: NaN }).dropIn;
        const spread = Math.abs(at(+p.muzzleVelocityFps + 2 * sd) - at(+p.muzzleVelocityFps - 2 * sd));
        const u = unit();
        $('.w-out', box).innerHTML = tile('95% vertical spread', fmt(spread, 1), 'in') + tile('In angle', fmt(L.toUnit(spread, r, u), 2), u) +
          tile('vs 12" plate', fmt(spread / 12 * 100, 0), '% of plate') + tile('Est. 10-shot ES', fmt(sd * 3.1, 0), 'fps');
      };
      $$('input', box).forEach((i) => i.addEventListener('input', run));
      run();
    },

    // Side-profile schematic of a precision bolt rifle with clickable parts
    'rifle-anatomy'(el) {
      const parts = {
        scope: ['Optic (scope)', 'Magnifies the target and measures angles. Turrets on top/side adjust elevation and windage (module 08).'],
        rings: ['Rings / mount', 'Clamp the scope to the rifle. Must be torqued correctly so the scope never moves.'],
        barrel: ['Barrel', 'Rifled tube that spins and guides the bullet. The biggest single factor in precision (module 03).'],
        muzzle: ['Muzzle device', 'A brake redirects gas to cut recoil; a suppressor reduces noise. Both help you see your own impact.'],
        action: ['Action / receiver', 'The rigid core. Holds the bolt, locks the cartridge in the chamber; barrel and stock attach to it.'],
        bolt: ['Bolt', 'Lift, pull back (eject), push forward (load), close (lock). The firing pin lives inside it.'],
        trigger: ['Trigger', 'Releases the firing pin. Precision triggers break cleanly at ~1.5–3 lb.'],
        mag: ['Magazine', 'Detachable box holding the cartridges.'],
        stock: ['Stock / chassis', 'Holds the action rigidly and positions your eye behind the scope.'],
        cheek: ['Cheek riser', 'Adjusts so your eye lines up with the scope without strain.'],
        butt: ['Buttpad / length of pull', 'Where the rifle meets your shoulder; adjustable length fits the rifle to you.'],
        bipod: ['Bipod', 'Front support for prone and bench shooting.'],
        bag: ['Rear bag', 'Supports the back of the stock; squeeze it to fine-tune elevation.'],
      };
      const box = widgetShell(el, 'Click a part of the rifle', `
        <svg class="anat" viewBox="0 0 800 230" role="img" aria-label="Rifle diagram">
          <g class="part" data-p="bag"><path d="M40 170 q30 -22 70 0 v22 h-70 z"/></g>
          <g class="part" data-p="butt"><rect x="28" y="96" width="16" height="70" rx="4"/></g>
          <g class="part" data-p="stock"><path d="M44 102 h200 v26 h-40 l-20 40 h-30 l10 -30 h-120 z"/></g>
          <g class="part" data-p="cheek"><rect x="70" y="84" width="90" height="16" rx="4"/></g>
          <g class="part" data-p="trigger"><path d="M232 130 q6 16 -4 26" fill="none" stroke-width="5"/><path d="M212 130 h40 q4 30 -20 32 h-14" fill="none" stroke-width="3"/></g>
          <g class="part" data-p="mag"><rect x="262" y="128" width="34" height="46" rx="3"/></g>
          <g class="part" data-p="action"><rect x="244" y="96" width="120" height="32" rx="4"/></g>
          <g class="part" data-p="bolt"><rect x="250" y="100" width="70" height="10" rx="3"/><circle cx="262" cy="134" r="8"/><line x1="262" y1="110" x2="262" y2="128" stroke-width="5"/></g>
          <g class="part" data-p="stock"><rect x="364" y="112" width="150" height="20" rx="4"/></g>
          <g class="part" data-p="barrel"><rect x="364" y="102" width="330" height="12" rx="3"/></g>
          <g class="part" data-p="muzzle"><rect x="694" y="98" width="46" height="20" rx="3"/></g>
          <g class="part" data-p="bipod"><line x1="480" y1="132" x2="452" y2="196" stroke-width="5"/><line x1="490" y1="132" x2="518" y2="196" stroke-width="5"/></g>
          <g class="part" data-p="rings"><rect x="262" y="72" width="16" height="26" rx="2"/><rect x="336" y="72" width="16" height="26" rx="2"/></g>
          <g class="part" data-p="scope"><path d="M200 60 h30 l14 6 h150 l14 -10 h40 v34 h-40 l-14 -10 h-150 l-14 6 h-30 z"/><rect x="300" y="44" width="20" height="16" rx="3"/></g>
        </svg>
        <div class="anat-info"><b>Tap a part</b><span>Each part has one job; precision comes from every part doing it identically.</span></div>`);
      $$('.part', box).forEach((g) => g.addEventListener('click', () => {
        $$('.part', box).forEach((x) => x.classList.toggle('on', x.dataset.p === g.dataset.p));
        const [t, d] = parts[g.dataset.p];
        $('.anat-info', box).innerHTML = `<b>${t}</b><span>${d}</span>`;
        L.sfx.click();
      }));
    },

    // Cutaway of a bottleneck rifle cartridge with clickable parts
    'cartridge-anatomy'(el) {
      const parts = {
        head: ['Head & headstamp', 'The base of the case, stamped with the cartridge name and maker. Match it to your barrel marking.'],
        rim: ['Rim / extractor groove', 'The extractor hooks this groove to pull the fired case out of the chamber.'],
        primer: ['Primer', 'Struck by the firing pin; its flash ignites the powder.'],
        powder: ['Powder', 'Burns rapidly (does not explode) to create ~60,000 psi of gas pressure.'],
        body: ['Case body', 'Brass wall that holds the powder and expands to seal the chamber when fired.'],
        shoulder: ['Shoulder', 'The angled step that positions the case in the chamber (headspace).'],
        neck: ['Neck', 'Grips the bullet with consistent tension.'],
        boattail: ['Boat tail', 'Tapered base of the bullet that reduces drag at long range.'],
        bearing: ['Bearing surface', 'Straight section of the bullet that the rifling engraves.'],
        ogive: ['Ogive', 'The curved nose. Its shape (tangent, secant, hybrid) drives the BC.'],
        meplat: ['Meplat / tip', 'The very tip. Polymer tips make it uniform for consistent BC.'],
      };
      const box = widgetShell(el, 'Click a part of the cartridge (cutaway)', `
        <svg class="anat" viewBox="0 0 800 180" role="img" aria-label="Cartridge diagram">
          <g class="part" data-p="head"><rect x="40" y="52" width="26" height="76" rx="3"/></g>
          <g class="part" data-p="rim"><rect x="66" y="58" width="10" height="64"/></g>
          <g class="part" data-p="primer"><rect x="36" y="78" width="16" height="24" rx="3"/></g>
          <g class="part" data-p="body"><path d="M76 50 L400 56 L400 124 L76 130 Z"/></g>
          <g class="part" data-p="powder"><path d="M90 62 L390 66 L390 114 L90 118 Z" class="powder"/></g>
          <g class="part" data-p="shoulder"><path d="M400 56 L450 72 L450 108 L400 124 Z"/></g>
          <g class="part" data-p="neck"><rect x="450" y="72" width="70" height="36"/></g>
          <g class="part" data-p="boattail"><path d="M440 80 L470 76 L470 104 L440 100 Z" class="bullet"/></g>
          <g class="part" data-p="bearing"><rect x="470" y="76" width="110" height="28" class="bullet"/></g>
          <g class="part" data-p="ogive"><path d="M580 76 Q680 78 738 88 L738 92 Q680 102 580 104 Z" class="bullet"/></g>
          <g class="part" data-p="meplat"><rect x="738" y="86" width="14" height="8" rx="2"/></g>
          <line x1="430" y1="150" x2="760" y2="150" class="dim"/><text x="595" y="168" text-anchor="middle" class="dimt">bullet</text>
          <line x1="36" y1="150" x2="520" y2="150" class="dim"/><text x="278" y="168" text-anchor="middle" class="dimt">case</text>
        </svg>
        <div class="anat-info"><b>Tap a part</b><span>The bullet sits partly inside the case neck; only the bullet leaves the rifle.</span></div>`);
      $$('.part', box).forEach((g) => g.addEventListener('click', () => {
        $$('.part', box).forEach((x) => x.classList.toggle('on', x.dataset.p === g.dataset.p));
        const [t, d] = parts[g.dataset.p];
        $('.anat-info', box).innerHTML = `<b>${t}</b><span>${d}</span>`;
        L.sfx.click();
      }));
    },

    // Step through the firing sequence as a state machine
    'fire-sequence'(el) {
      const steps = [
        ['Trigger press', 't = 0', 'You press the trigger; the sear releases the spring-loaded firing pin.'],
        ['Firing pin strikes primer', '≈ 2–3 ms (lock time)', 'The pin dents the primer cup, crushing the impact-sensitive compound.'],
        ['Primer ignites powder', '+ fractions of a ms', 'A jet of flame shoots through the flash hole into the powder.'],
        ['Powder burns, pressure rises', 'peaks ≈ 60,000 psi', 'Burning powder makes hot gas. The case expands and seals the chamber.'],
        ['Bullet engraves into the rifling', 'starts moving', 'Pressure pushes the bullet out of the neck into the lands, which grip it and start it spinning.'],
        ['Bullet travels the barrel', '≈ 1 ms of barrel time', 'Gas keeps accelerating the spinning bullet down the bore.'],
        ['Leaves the muzzle', 'muzzle velocity reached', 'The bullet exits at its muzzle velocity (e.g. 2,700 fps), spinning hundreds of thousands of RPM.'],
        ['Flight', 'TOF ≈ 1–2 s to 1,000 yd', 'External ballistics takes over: gravity, drag and wind (module 07).'],
        ['Cycle the bolt', 'you', 'Lift and pull the bolt: the extractor pulls the empty case, the ejector throws it clear; push forward to chamber the next round.'],
      ];
      let i = 0;
      const box = widgetShell(el, 'The firing sequence — step through it', `
        <div class="fs-track">${steps.map((s, k) => `<div class="fs-node" data-k="${k}"><span>${k + 1}</span></div>`).join('')}</div>
        <div class="fs-card"></div>
        <div class="actions"><button class="btn" data-d="-1">← Back</button><button class="btn primary" data-d="1">Next →</button></div>`);
      const draw = () => {
        $$('.fs-node', box).forEach((n, k) => { n.classList.toggle('done', k < i); n.classList.toggle('on', k === i); });
        const [t, time, d] = steps[i];
        $('.fs-card', box).innerHTML = `<div class="eyebrow" style="margin:0">Step ${i + 1} of ${steps.length} · ${time}</div><b>${t}</b><p>${d}</p>`;
      };
      $$('[data-d]', box).forEach((b) => b.addEventListener('click', () => { i = Math.max(0, Math.min(steps.length - 1, i + +b.dataset.d)); L.sfx.click(); draw(); }));
      $$('.fs-node', box).forEach((n) => n.addEventListener('click', () => { i = +n.dataset.k; draw(); }));
      draw();
    },

    // Flip-card vocabulary drill; "Again" cards go back in the queue
    flashcards(el) {
      const deck = (window.LRPS_DECKS || {})[el.dataset.deck] || [];
      let queue = deck.map((c, k) => k).sort(() => Math.random() - 0.5);
      let known = 0;
      let flipped = false;
      const box = widgetShell(el, `Flashcards · ${deck.length} cards`, `
        <div class="fc-card" tabindex="0"><div class="fc-front"></div><div class="fc-back"></div></div>
        <div class="fc-bar"><span></span></div>
        <div class="actions fc-actions"><button class="btn" data-a="again">Again</button><button class="btn primary" data-a="got">Got it</button></div>
        <p class="hint fc-hint">Click the card to flip it.</p>`);
      const card = $('.fc-card', box);
      const draw = () => {
        $('.fc-bar span', box).style.width = (known / deck.length * 100) + '%';
        if (!queue.length) {
          card.classList.remove('flip');
          $('.fc-front', box).innerHTML = `<b>Deck complete</b><span>${deck.length} / ${deck.length}</span>`;
          $('.fc-back', box).innerHTML = '';
          $('.fc-actions', box).innerHTML = '<button class="btn" data-a="restart">Shuffle again</button>';
          $('[data-a="restart"]', box).addEventListener('click', () => { queue = deck.map((c, k) => k).sort(() => Math.random() - 0.5); known = 0; restoreButtons(); draw(); });
          return;
        }
        const [t, d] = deck[queue[0]];
        flipped = false;
        card.classList.remove('flip');
        $('.fc-front', box).innerHTML = `<b>${t}</b><span>What does it mean?</span>`;
        $('.fc-back', box).innerHTML = `<span>${d}</span>`;
      };
      const act = (a) => {
        if (!queue.length) return;
        if (!flipped) { flipped = true; card.classList.add('flip'); return; }
        const c = queue.shift();
        if (a === 'got') { known++; L.sfx.click(); } else queue.push(c);
        if (!queue.length) { L.sfx.good(); if (!deckXp.has(el.dataset.deck)) { deckXp.add(el.dataset.deck); L.addXp(5, 'flashcards complete'); } }
        draw();
      };
      function restoreButtons() {
        $('.fc-actions', box).innerHTML = '<button class="btn" data-a="again">Again</button><button class="btn primary" data-a="got">Got it</button>';
        $$('.fc-actions [data-a]', box).forEach((b) => b.addEventListener('click', () => act(b.dataset.a)));
      }
      card.addEventListener('click', () => { flipped = !flipped; card.classList.toggle('flip', flipped); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
      restoreButtons();
      draw();
    },

    glossary(el) {
      const box = widgetShell(el, 'Search the glossary', `<div class="field"><input type="text" id="w-gl-q" placeholder="Type to filter…"></div><dl class="w-gloss"></dl>`);
      const run = () => {
        const q = $('#w-gl-q').value.toLowerCase();
        const all = window.LRPS_GLOSSARY.concat(window.LRPS_GLOSSARY_EXTRA || []).sort((a, b) => a[0].localeCompare(b[0]));
        $('.w-gloss', box).innerHTML = all.filter(([t, d]) => !q || (t + d).toLowerCase().includes(q))
          .map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('') || '<p class="hint">No matches.</p>';
      };
      $('#w-gl-q').addEventListener('input', run);
      run();
    },
  };

  function tile(label, value, unitLabel) {
    return `<div class="tile"><div class="label">${label}</div><div class="value">${value}<small>${unitLabel || ''}</small></div></div>`;
  }


  const last = L.store.get('academy.last', 'map');
  if (last !== 'map' && byId[last] && isUnlocked(byId[last])) open(last, true); else showMap(true);
  // Widgets read the Build Card profile; re-render the open lesson when it changed while we were away
  let profileDirty = false;
  L.onTab('academy', () => { renderSide(); if (profileDirty && view !== 'map') { profileDirty = false; open(view, true); } });
  L.onProfile(() => { if (L.currentTab === 'academy' && view !== 'map') open(view, true); else profileDirty = true; });
})();
