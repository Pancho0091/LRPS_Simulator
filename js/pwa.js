/* Offline, install, updates and the version.
 *
 * Registers the service worker (sw.js) so every tab keeps working with no
 * signal, asks the browser to keep this site's storage (the Data Book lives
 * in localStorage), offers "Install" where the browser supports it, shows the
 * running version in the header, and raises the update bar when a new release
 * has taken over. The service worker parts are a no-op under file:// and in
 * browsers without service workers — the app itself never depends on them.
 */
(function () {
  'use strict';
  const L = window.LRPS;
  const $ = (s) => document.querySelector(s);
  const meta = (n) => { const m = document.querySelector(`meta[name="${n}"]`); return m ? m.content : ''; };

  const RUNNING = { version: meta('app-version'), build: meta('app-build') };
  const CHECK_EVERY_MS = 15 * 60 * 1000;

  // ------------------------------------------------------------ version pill

  const pill = $('#ver-pill');
  if (pill && RUNNING.version) {
    pill.textContent = 'v' + RUNNING.version;
    pill.title = `Version ${RUNNING.version}${RUNNING.build ? ' · build ' + RUNNING.build : ''} — tap for what's new`;
  }

  // ------------------------------------------------------------ update bar

  const bar = $('#update-bar');
  let barMode = null;      // 'update' | 'info'
  let pending = null;      // release info of an update that has taken over

  async function releaseNotes() {
    // Served by the service worker from the newest installed release; absent under file://
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const j = await res.json();
      return j && typeof j.version === 'string' && Array.isArray(j.notes) ? j : null;
    } catch (e) { return null; }
  }

  function renderNotes(info, open) {
    const list = $('#ub-notes'), btn = $('#ub-notes-btn');
    const notes = info && info.notes ? info.notes.filter((n) => typeof n === 'string') : [];
    list.innerHTML = '';
    notes.forEach((n) => { const li = document.createElement('li'); li.textContent = n; list.appendChild(li); });
    btn.hidden = !notes.length;
    list.hidden = !(open && notes.length);
    btn.setAttribute('aria-expanded', String(!list.hidden));
  }

  function showBar(mode, info) {
    barMode = mode;
    const v = info && info.version ? info.version : RUNNING.version;
    const build = info && info.build ? info.build : RUNNING.build;
    const date = info && info.date ? ' · ' + info.date : '';
    if (mode === 'update') {
      $('#ub-title').textContent = `Update ready — v${v}${info && info.title ? ': ' + info.title : ''}`;
      $('#ub-sub').textContent = `${build ? 'build ' + build : ''}${date} · your sessions and Data Book are kept`;
    } else {
      $('#ub-title').textContent = `You're on v${RUNNING.version}`;
      $('#ub-sub').textContent = `${RUNNING.build ? 'build ' + RUNNING.build : 'local copy'}${info && info.version === RUNNING.version ? date : ''}${navigator.serviceWorker && navigator.serviceWorker.controller ? ' · works offline' : ''}`;
    }
    $('#ub-reload').hidden = mode !== 'update';
    renderNotes(info, mode === 'info');
    bar.hidden = false;
  }

  function hideBar() {
    bar.hidden = true;
    if (barMode === 'update' && pill) pill.classList.add('has-update');
    barMode = null;
  }

  if (bar) {
    $('#ub-close').addEventListener('click', hideBar);
    $('#ub-notes-btn').addEventListener('click', () => {
      const list = $('#ub-notes');
      list.hidden = !list.hidden;
      $('#ub-notes-btn').setAttribute('aria-expanded', String(!list.hidden));
    });
    $('#ub-reload').addEventListener('click', () => { reloading = true; location.reload(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bar.hidden) hideBar(); });
  }
  if (pill && bar) pill.addEventListener('click', async () => {
    if (!bar.hidden) { hideBar(); return; }
    if (pending) showBar('update', pending);
    else showBar('info', await releaseNotes());
  });

  // ------------------------------------------------------------ online / offline pill

  function renderNet() {
    const net = $('#net-pill');
    if (net) net.hidden = navigator.onLine !== false;
  }
  window.addEventListener('online', renderNet);
  window.addEventListener('offline', () => { renderNet(); L.toast('Offline — everything still works'); });
  renderNet();

  // ------------------------------------------------------------ install

  let deferred = null;
  const installBtn = $('#install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    installBtn.hidden = true;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* dismissed */ }
    deferred = null;
  });
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    L.toast('Installed — open it from your home screen, signal or not');
  });

  // iOS Safari has no install prompt: say how, in the Data Book
  const hint = $('#install-hint');
  if (hint && 'standalone' in navigator && navigator.standalone === false) hint.hidden = false;

  // ------------------------------------------------------------ service worker

  let reloading = false;
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || !window.isSecureContext) return;

  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (reloading) return;
    if (!hadController) {
      L.toast('Ready to work offline', 'big');
      document.documentElement.dataset.offline = 'ready';
      return;
    }
    // A new release took over. This page keeps running the old code until it reloads.
    pending = (await releaseNotes()) || { version: '', notes: [] };
    if (pending.build && pending.build === RUNNING.build) { pending = null; return; }
    if (pill) pill.classList.add('has-update');
    showBar('update', pending);
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      if (hadController) document.documentElement.dataset.offline = 'ready';
      // Look for a new release when the app comes back to the foreground, and every 15 min while open
      const check = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', check);
      setInterval(check, CHECK_EVERY_MS);
    } catch (e) {
      /* registration refused (private mode, policy): the app still works online */
    }
    try {
      if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch (e) { /* best effort */ }
  });
})();
