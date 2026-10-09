<div align="center">

# LRPS Dope Simulator

**Long-range precision shooting academy · ballistic solver · dope card builder · realistic range simulator**

[![Version](https://img.shields.io/badge/version-v2.6.0-f59e0b?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Updated](https://img.shields.io/badge/last%20updated-2026--10--03-6b7280?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Live](https://img.shields.io/badge/live-pancho0091.github.io%2FLRPS__Simulator-4ade80?style=for-the-badge&labelColor=0a0e0c)](https://pancho0091.github.io/LRPS_Simulator/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-auto--deploy-222222?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Pancho0091/LRPS_Simulator/actions/workflows/pages.yml)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla%2C%20no%20build-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Tests](https://img.shields.io/badge/node%3Atest-89%20passing-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](./test)
[![License](https://img.shields.io/badge/License-MIT-3b82f6?style=for-the-badge&labelColor=0a0e0c)](./LICENSE)

### ▶ [Open the simulator](https://pancho0091.github.io/LRPS_Simulator/)

</div>

---

## Overview

A browser-based trainer for learning to **write and use dope cards** for long-range precision shooting — starting
from zero. The Academy is a **beginner-first, linear course**: safety and vocabulary first, then rifles, ammunition
and calibers, and only then ballistics, optics and card writing. A real
point-mass ballistic solver sits underneath every screen, so the numbers you practise with are the numbers a
field solver would give you. The app is built around one idea: a dope card is a **precomputed lookup table**,
`f(range, conditions) → (elevation, wind)`, and you learn it best by building one and then shooting with it.

```
Academy  ──▶  Lab  ──▶  Build Card  ──▶  Drills  ──▶  Range  ──▶  Data Book
 13 modules    sliders    your rifle        write it      chrono, zero,   your REAL rifle:
 57 lessons    predict    system + card     by hand       shoot a day     record zero, chrono
 pass to       reveal     print / CSV       graded        on your own     and field dope with
 unlock next                                              paper           conditions stamped

00 Safety ─▶ 01 Terms ─▶ 02 History ─▶ 03 Platforms ─▶ 04 Ammo ─▶ 05 Bullet types ─▶ 06 Calibers
   ─▶ 07 Ballistics ─▶ 08 Optics ─▶ 09 Equipment ─▶ 10 Positions ─▶ 11 Dope cards ─▶ 12 Field craft
```

Everything is in **MIL** — reticle, turrets (0.1 mil clicks), card, spotter calls.

Static site, no build step, no dependencies. Every push to the deploy branch runs the solver tests and
republishes to GitHub Pages. Course progress, XP and rank, your card, Range setup, the Range session in progress, your Data Book and preferences live in the browser's localStorage. The app makes no network request after it loads: fonts are self-hosted and a Content-Security-Policy pins every asset to the site itself.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Vanilla HTML / CSS / JavaScript | No framework, no bundler — open `index.html` and it runs |
| **Solver** | `js/ballistics.js` | Point-mass model, G1/G7 drag, RK2 at 0.5 ms, Miller stability, spin drift, aerodynamic jump, Coriolis, powder temperature |
| **Illustrations** | `js/iso.js` + `js/illus/*.js` | In-house isometric SVG engine (face culling, flat three-tone shading) and the Academy's lesson and module scenes |
| **Charts** | Hand-rolled responsive SVG | Hover readouts, transonic band shading |
| **Range view** | Canvas 2D | Scope scene, FFP mil reticle, bubble level, mirage, wind flags, paper and steel |
| **Audio** | Web Audio API | Synthesized shot, steel ding, turret clicks — no audio files |
| **Styling** | CSS custom properties | Light / dark themes, Inter + JetBrains Mono |
| **Hosting** | GitHub Pages via Actions | `.github/workflows/pages.yml`, Node 22, deploys only if tests pass; `scripts/stage.mjs` cache-busts asset URLs by commit and writes the service worker's precache list |
| **Offline** | Service worker + Web App Manifest | `sw.js` precaches every file (~1 MB); network-first page with a 3 s budget, cache-first versioned assets; installable on Android, desktop and iOS (Add to Home Screen); update bar on new releases |
| **Testing** | `node:test` + Playwright | 89 tests (`test/ballistics.test.js`, `test/physics-audit.test.js`, `test/book.test.js`, `test/pwa.test.js`): zero, wind linearity, DA, angle, stability, Coriolis direction, aero jump sign, temp sensitivity, Range rifle truth, Data Book records / validation / merge / chrono stats · 34-scenario browser smoke test (`npm run smoke`: every tab, the full Academy course, every Range mode, the Data Book flows, storage robustness, mobile, a11y, perf; Playwright installed globally or as a devDependency — it is not in `package.json`) |

---

## Features

### Academy — Step 0

A beginner-first, **linear course**: each module builds on the one before it.

- **13 modules · 57 lessons**, numbered `00`–`12` (lessons as `03.2`), plus an always-open **★ Glossary** reference
- **Unlock in order** — a perfect quiz score unlocks the next lesson; finishing a module unlocks the next module
- **Review mode** toggle unlocks everything; progress is saved in the browser
- **Course map** lists every module and lesson with status — completed · in progress · ready · locked — with an isometric thumbnail per module
- **Ammo and calibers before ballistics**, on purpose: drag, BC and stability only make sense once you know what a bullet is

| # | Module | Lessons |
|---|---|---|
| 00 | Safety & first principles | 4 |
| 01 | Terminology & units | 3 |
| 02 | History: how we got here | 3 |
| 03 | Weapon platforms | 4 |
| 04 | Ammunition fundamentals | 3 |
| 05 | Ammo & bullet types | 5 |
| 06 | Calibers & cartridges | 4 |
| 07 | Ballistics | 8 |
| 08 | Optics & the MIL | 5 |
| 09 | Equipment | 4 |
| 10 | Shooting positions & fundamentals | 4 |
| 11 | Writing a dope card | 6 |
| 12 | Field craft | 4 |
| ★ | Glossary | reference |

**Every lesson** shows what it builds on, key-term chips and an "In this lesson" contents box, then leads with the
**governing rule** → tables → variables and **exceptions** (and *why*) → a technical analog → a way to verify it in
the app, and closes with a **"What you now know"** recap and a quiz.

- **Isometric illustrations in every lesson**: 73 figures across all 57 lessons, plus 15 module and course thumbnails for the table of contents, drawn by an in-house SVG isometric engine (`js/iso.js`) in a flat three-tone style — no image files. Scenes are deterministic and memoised, so each is drawn once per page load
- **Interactive widgets**: clickable rifle anatomy diagram, cartridge cutaway, firing-sequence stepper (a state machine), flip flashcards (vocabulary and abbreviations decks), history timelines
- **11 live calculators** on the real solver — G1 vs G7 drag curves, density altitude, wind clock, Coriolis, Miller stability, unit converter, reticle ranging, card anatomy, cartridge comparison, SD → vertical dispersion, glossary search
- **Rifle systems compared**: 8 cartridges from .223 to .338 Lapua with 1000 yd elevation, wind, velocity, energy, transonic range, Sg, recoil and barrel life
- Module completion awards **XP and confetti**

### Lab

- Seven sliders drive live charts of the **bullet path** and the **corrections** you dial and hold; transonic band shaded
- **Pin as baseline** to see one variable's effect as a dashed line
- **Predict, then reveal** — 8 challenges; the sliders move and the app shows the real change and *why*

### Build Card

- **Rifle systems**: 8 presets with bullet diameter, length, twist, ammo SD and powder temperature sensitivity — or fully custom
- Recomputes as you type; stability (Sg) and temperature-adjusted MV shown
- Elevation rounded to 0.1 mil clicks, wind-bracket holds, velocity, TOF; transonic and subsonic rows flagged; spin-drift column from Sg
- Print-ready card and CSV export. This is your own solver: the Range never reads it, so what you take to the line is whatever you wrote down

### Drills

- **Convert** raw solver inches → card cells · **Interpolate** between rows · **Wind call** speed + clock → hold
- Graded to the click, worked solutions, streaks, timer, XP

### Range

A full range day as a session: **Setup → Chronograph → Zero → Shoot → Debrief**. The dope is written on your own
paper — the Range never shows a dope card or a solution while you shoot. A printable blank data book is one click away.

- **Setup**: 9 cartridges (.22 LR trainer to .338 Lapua) and **18 factory loads** from Hornady, Berger, Federal, Sierra, Lapua, SK, Black Hills and CCI, each carrying its published box figures (labelled approximate); barrel length and twist (box MV scaled per inch of barrel); rifle class (factory hunting / factory precision / custom match); optic class (tracking error budget); sight height; zero distance; **6 locations** with their own climate, altitude, latitude and terrain-dependent near / mid / far wind zones; sky; shooting position (bench to standing); **Training** and **Realistic** presets plus **13 individual realism toggles**
- **The rifle you own** hides a true MV that differs from the box, its own SD, a boresight error, a cold-bore shift, barrel-heat walk and scope tracking error. You find them out the way you would at a real range: the **chronograph station** (per-shot velocities, average, SD, ES), the **zero station** (paper with a 1" grid, dial the correction, **Set zero** slips the turrets) and steel
- **Shoot modes**: known-distance lanes with berm signs · **unknown distance** — laser rangefinder on `R` with re-lasing and beam-divergence bad returns on small, far plates, or mil the plate when the LRF is switched off · **PRS-style stage** — 5 targets lased in prep, one shot each, par time, stage card and score
- **Physics per shot** through the solver: station pressure, density altitude, powder temperature soaking in the sun, three-zone wind (near / mid / far) with gusts, lulls and switches, mirage, spin drift / Coriolis / aerodynamic jump, shot angle, cold bore, barrel heat, tracking error, cant with a bubble level (`L`), position wobble, breath control (`B`), MV spread from the load's SD, rifle dispersion, real time of flight and a ding delayed by the sound's return trip
- **Spotter calls** in mil or self-spot the splash; wind call from the RO or read the flags, mirage and meter yourself
- **Debrief**: what you measured vs the truth (MV, SD, zero residual, tracking, cold bore, heat, bad LRF returns, air), **true dope from your zero vs what you dialed** per distance, and a layer-by-layer **"what changed"** table from box data on a standard day to the real rifle on the real day
- **Keyboard**: `↑` `↓` elevation · `←` `→` wind · `Shift` ×5 · `Space` / `Enter` / `F` fire · `B` hold breath · `L` level · `R` lase · `N` next target · `Z` / `+` zoom in · `−` zoom out · `0` reset dials

### Data Book

The Range is a simulator with synthetic truth. The Data Book is for your **real rifle on a real range**: record what you measure so later
phases can true the solver to your numbers and generate field cards. Phase 1 is **record only** — nothing is predicted.
Governing rule: **identity on the rifle profile, measurements on the ammo lot, evidence on each row, and a snapshot of the conditions stored on every row — never recomputed later.**

- **Rifle profiles** (name, barrel, twist, sight height, elevation travel, zero range, 0.1 mil clicks) and **ammo lots** per rifle (load, lot #, bullet, BC / drag model, chronograph string). Seed a lot from the Range catalogue's 18 factory loads and a rifle's travel from its optics, then edit
- **Conditions panel** shared by every flow: altitude, temperature, station pressure (follows the altitude as standard until you touch it), humidity, and the **density altitude computed live** by the solver's own atmosphere — the number you write on the card. **Use GPS** fills the altitude from `navigator.geolocation` and degrades to a one-line hint when the API is absent, denied or insecure
- **Three recording flows**, 1–2 taps per entry: **Zero** (range, group size, dial correction from mechanical zero, "Zero confirmed") · **Chrono** (tap-add velocities seeded from the last one, live avg / SD / ES / n, save writes the string to the session *and* to the lot) · **Field dope** (range, angle, dial E/W, wind mph + clock, HIT / HIGH / LOW / LEFT / RIGHT / MISS with an optional off-by mil, one tap to log; rows newest first, each carrying its own conditions snapshot)
- **Steppers, not keyboards**: −/+ with a big number, 48 px targets, hold to repeat with acceleration, last value pre-filled; typing still works (`inputmode="decimal"`)
- **Field mode**: high contrast, bigger type, fewer decorations, for gloves and bright sun. Light and dark themes
- **Sessions list** per rifle (date, kind, place, DA, one-line summary); tap to reopen, print or delete. Deleting a rifle asks first and cascades; deleting a lot unlinks its sessions but keeps them
- **Export / Import**: the whole book as `lrps-databook-YYYY-MM-DD.json`; import validates every record and **merges by id, never overwriting a newer record** — bad files leave the book untouched
- **Print session**: a clean sheet with the rifle, lot, conditions and the session's rows plus blank card lines to write your own dope from
- Stored under `lrps.book` (`{ v: 1, rifles, lots, sessions }`); the pure logic (`js/book/model.js`) is shared with the node tests

---

### Offline, install and updates

- **Works with no signal**: once the page has loaded, every tab — including the Data Book and a Range session — runs offline. An **Offline** pill in the header says when you have no connection.
- **Install it**: the download button in the header (Chrome, Edge, Android) or **Share → Add to Home Screen** (iPhone) puts it on your home screen as its own app, with shortcuts straight to the Data Book, Range and Academy.
- **Update bar**: when a new version is published while the app is open, a bar slides up with the version, the build and **What's new** — tap **Reload** when it suits you; sessions and the Data Book are kept.
- **Version pill**: the header always shows the running version; tap it for the build and this release's notes.

## Architecture

```
index.html                shell, tabs, static content; app-version meta + version pill
release.json              this release: version, date, title, notes (feeds the update bar)
manifest.webmanifest      install metadata: name, icons, standalone, shortcuts (Data Book, Range, Academy)
sw.js                     service worker: precache, offline page, versioned asset cache, old-release cleanup
icons/                    app icon (SVG source + 192/512/maskable/apple-touch PNGs)
fonts/                    Inter + JetBrains Mono (woff2, self-hosted)
css/style.css             design tokens, light/dark themes, components
css/range.css             Range tab: session stepper, stations, instruments, print sheet
css/book.css              Data Book tab: steppers, conditions, flows, field mode, print sheet
js/ballistics.js          solver (UMD — loads in the browser and in Node tests)
js/common.js              profile store, unit helpers, card math, sound, XP, toasts, SVG chart
js/iso.js                 isometric SVG engine: scene, solids, lathe/extrude, labels, registry
js/illus/core.js          shared isometric parts (rifle, cartridge, targets) + conventions
js/illus/{a,b,c,d}.js     lesson figures and module thumbnails, registered by lesson / module id
js/academy-content.js     Academy lesson bank (lessons, quizzes, glossary)
js/academy-curriculum.js  linear course: modules, lesson order, flashcard decks
js/academy.js             Academy tab: course map, unlocking, progress, quizzes, interactive widgets
js/lab.js                 Lab tab: sliders, charts, challenges
js/build.js               Build Card tab
js/drills.js              Drills tab
js/range.js               Range tab: session flow, stations, firing, debrief, print
js/range/data.js          Range catalogue: cartridges, loads, rifles, optics, positions, locations, toggles
js/range/world.js         Range day, wind field, rifle truth, per-shot ballistics, rangefinder
js/range/scene.js         Canvas rendering: scope view, reticle, level, mirage, wind flags
js/book.js                Data Book tab: rifle/lot pickers, conditions + DA, zero/chrono/field flows, export/import, print
js/book/model.js          Data Book model (UMD): record shapes, validation, merge, DA snapshot, chrono stats
js/pwa.js                 offline + install + updates: worker registration, update bar, version pill, Offline pill
test/ballistics.test.js   node:test suite for the solver
test/physics-audit.test.js physics audit: sign conventions, limits, degenerate inputs, Range rifle truth
test/book.test.js         Data Book model: DA from conditions, chrono stats, validation, merge, record shapes
test/pwa.test.js          manifest, icons, worker, staging, and the version-agreement check
scripts/smoke.js          Playwright browser smoke test (file://)
scripts/stage.mjs         stage the deployable site (used by the deploy and the offline test)
scripts/offline-check.mjs end-to-end offline test over HTTP: server down, weak signal, release mid-session
dev/                      illustration gallery + screenshot helper (not deployed)
```

### Solver model

| Stage | What it does |
|---|---|
| **Drag** | Standard G1 / G7 tables (Cd vs Mach), scaled by BC |
| **Atmosphere** | Density and speed of sound from altitude, temperature, humidity (or station pressure) → density altitude |
| **Integration** | Midpoint (RK2), gravity + drag relative to the moving air, 0.5 ms step |
| **Zero** | Bisection on bore angle so the bullet crosses the line of sight at the zero range |
| **Stability** | Miller twist rule → Sg, temperature/pressure corrected |
| **Second order** | Litz spin drift (from Sg), Litz aerodynamic jump, Coriolis + Eötvös from latitude and azimuth. Aero-jump convention for a right-hand twist: wind from the right = impact high, wind from the left = low (left twist flips it) |
| **Ammo** | MV adjusted by powder temperature sensitivity vs chronograph temperature |
| **Extras** | Shot angle (gravity split across the line of sight), fixed-zero mode for truing |
| **Output** | One row per requested range, returned in the caller's order; a row is `null` when the bullet never reaches that range |

Validated against published numbers: 6.5 Creedmoor 140 gr ELD-M at 2710 fps, sea level → ~8.8 mil elevation and ~1.9 mil per 10 mph at 1000 yd.

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| **v2.6.0** | 2026-10-09 | **Works offline + update bar**: installable app (manifest, icons, iOS home-screen support); a service worker precaches every file so all tabs and the Data Book open with no signal (network-first page with a 3 s budget for weak signal, cache-first versioned assets, old releases' caches removed); "Offline" pill in the header; storage marked persistent. A new release deployed while the app is open raises an **update bar** (version, build, what's new, Reload) — checked when the app returns to the foreground and every 15 min. **Version control**: `release.json` holds each release's version and notes; `package.json`, the `index.html` version meta and pill, the README badge and this table must agree or the tests fail; deploy stamps the commit as the build id. One staging script (`scripts/stage.mjs`) used by both the deploy and `npm run offline`, an end-to-end test that kills the server, hangs it, and ships a release mid-session. |
| **v2.5.0** | 2026-10-03 | **Data Book tab (Phase 1 — record only)**: rifle profiles and ammo lots for your real rifle, a conditions panel with live density altitude from the solver (GPS altitude optional), three recording flows — zero, chronograph string, field dope — with thumb-sized steppers, result buttons and a conditions snapshot stamped on every row; sessions list, Field mode for sunlight, JSON export / import with validation and newest-wins merge, printable session sheet. 15 model tests, 2 new smoke checks |
| **v2.4.0** | 2026-10-03 | **Offline-clean**: the Range session survives a reload (day, hidden rifle truth, chronograph string, zero, dials, log, stage clock — restored to the step you were on). Fonts self-hosted; Content-Security-Policy header; no external request after load. Repository default branch is `main`. |
| **v2.3.0** | 2026-10-03 | **QA release**: six-agent audit — physics, content, code review, browser QA, Range deep test, security. Fixed the aerodynamic-jump sign in the solver, lesson, figure and test. Range no longer resets on a tab switch or regenerates the day when a toggle changes; in-flight rounds are scored against the target they were fired at; stage one-shot enforcement. Build Card no longer crashes on out-of-range inputs; solver returns null-safe rows, accepts unsorted ranges and degenerate inputs; stored data is type-checked on load. Memoised illustrations, LRF realism (re-lase, beam divergence), flag calibration, example dope regenerated from the solver. Browser QA round two: focused buttons keep Space, zoom buttons follow the chosen optic, `−` zooms out, Review mode reachable on mobile, light-theme eyebrow contrast, toast de-dupe, preset clears when edited, tighter Build bounds. README, attribution and LICENSE; cache-busted deploys |
| **v2.2.1** | 2026-10-03 | **Illustrations**: 73 isometric figures across every lesson and 15 module thumbnails from an in-house SVG engine (`js/iso.js`). **Range overhaul**: session stepper (Setup → Chronograph → Zero → Shoot → Debrief), 18 factory loads with box data, barrel length / twist, rifle and optic classes, 6 locations, a hidden rifle truth you measure with the chronograph and zero paper, dope written on your own paper with a printable data book, LRF / mil-it / PRS stage modes, layer-by-layer debrief. Physics audit test suite. Polish and `css/range.css` |
| **v2.2.0** | 2026-10-03 | **Academy rebuilt as a beginner-first linear course**: 13 modules (00 Safety → 12 Field craft) and 57 lessons plus a glossary; perfect quiz score unlocks the next lesson, finished modules unlock the next, review mode unlocks all. Ammo and calibers now come before ballistics. Course map with lesson status, "In this lesson" contents, key-term chips and "What you now know" recaps. New widgets: rifle anatomy, cartridge cutaway, firing-sequence stepper, flashcards, history timelines. Module completion awards XP and confetti. Playwright smoke test (`npm run smoke`) |
| **v2.1.0** | 2026-10-03 | **Academy**: 33 lessons with quizzes and 11 solver-backed calculators covering ballistics, optics, card writing, gear, cartridges, bullet types and field craft. **Realistic Range**: range-day weather, shot angles, mil-ranging, near/mid/far wind, position sway and breath control, cant and bubble level, self-spotting, PRS stages and a "what changed vs your card" breakdown. Solver adds Miller stability, aerodynamic jump, Coriolis and powder temperature sensitivity. Eight rifle systems. **MIL only** throughout |
| **v2.0.0** | 2026-10-03 | Full redesign. Learn becomes an interactive **Ballistics Lab** with live charts and predict-then-reveal challenges. Build Card recomputes live with stat tiles and an elevation chart. Drills gain streaks, timer and XP. Range becomes a scope scene with gusting flags, mirage, swinging steel, clickable turrets, real time of flight and a delayed ding. Light/dark themes, XP ranks, synthesized sound |
| **v1.1.0** | 2026-10-03 | GitHub Pages deploy workflow — tests gate every publish |
| **v1.0.0** | 2026-10-03 | First release: point-mass G1/G7 solver, dope card builder (print + CSV), three graded drills, range simulator with dispersion, gusts and hidden MV error |

---

## Development

```sh
npm start          # python3 -m http.server 8000 → http://localhost:8000
npm test           # 89 solver / physics / data-book / offline / version tests (node:test, Node 18+; CI runs Node 22)
npm run smoke      # Playwright browser smoke test (scripts/smoke.js) — needs Playwright installed globally or as a devDependency
npm run offline    # end-to-end offline test: stages two releases, serves them over HTTP, kills/hangs the server, ships an update mid-session
```

**Deploying** — push to the deploy branch; `.github/workflows/pages.yml` runs `npm test` on Node 22, then `node scripts/stage.mjs _site <sha>`: copies the shipped files, cache-busts every stylesheet and script URL by commit (`?v=<sha>`), writes `version.json` (version, build, notes) and stamps the service worker with the build and its precache list. A failing test blocks the deploy.

**Releasing (version control)** — a release has one version, kept in five places that `test/pwa.test.js` checks agree: `package.json`, `release.json` (date, title and the notes the update bar shows), the `app-version` meta and the version pill in `index.html`, the README version badge, and the newest row of the changelog below. Bump all five in the same commit; the commit becomes the build id. Users with the app open see the update bar within 15 minutes, or as soon as they return to it.

**Offline** — the first visit precaches every file; after that every tab and the Data Book open with no signal. The page is fetched network-first with a 3 s budget (a weak signal falls back to the cached copy), versioned assets cache-first, and each release deletes the previous release's cache. The app asks the browser to keep its storage (`navigator.storage.persist()`); exporting the Data Book is still the backup.

**Dev tools** — `dev/illus-gallery.html` renders every registered illustration (with `?only=id,id` filtering and an engine self-test); `dev/shot.js` screenshots it with Playwright. Neither is deployed.

**Limitations** — a training aid, not a firing solution. Point-mass model (no 6-DOF), standard drag curves rather than measured custom curves, empirical spin-drift and aerodynamic-jump estimates, and approximate box data for the Range loads. Always confirm dope with live fire.

---

## Data sources & attribution

- **Drag**: the standard G1 and G7 drag tables (Cd vs Mach) for the public reference projectiles.
- **Spin drift and aerodynamic jump**: Bryan Litz's empirical fits, as published in *Applied Ballistics for Long Range Shooting*.
- **Gyroscopic stability**: the Miller twist rule.
- **Ammunition**: load names in the Range are manufacturer trademarks (Hornady, Berger, Federal, Sierra, Lapua, SK, Black Hills, CCI) used only to identify the loads. Velocities, BCs and SDs are approximate figures taken from published box and catalogue data, each noted in `js/range/data.js`. This project is not affiliated with or endorsed by any of them.
- **Fonts**: Inter and JetBrains Mono (SIL Open Font License), self-hosted from `fonts/` as latin subsets of the variable files. No third-party requests, no analytics, no tracking.

## License

MIT — see [LICENSE](./LICENSE).

---

<div align="center">
<sub>Built for personal training · not a substitute for live-fire data</sub>
</div>
