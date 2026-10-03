<div align="center">

# LRPS Dope Simulator

**Long-range precision shooting academy · ballistic solver · dope card builder · realistic range simulator**

[![Version](https://img.shields.io/badge/version-v2.1.0-f59e0b?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Updated](https://img.shields.io/badge/last%20updated-2026--10--03-6b7280?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Live](https://img.shields.io/badge/live-pancho0091.github.io%2FLRPS__Simulator-4ade80?style=for-the-badge&labelColor=0a0e0c)](https://pancho0091.github.io/LRPS_Simulator/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-auto--deploy-222222?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Pancho0091/LRPS_Simulator/actions/workflows/pages.yml)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla%2C%20no%20build-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Tests](https://img.shields.io/badge/node%3Atest-17%20passing-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](./test/ballistics.test.js)

### ▶ [Open the simulator](https://pancho0091.github.io/LRPS_Simulator/)

</div>

---

## Overview

A browser-based trainer for learning to **write and use dope cards** for long-range precision shooting. A real
point-mass ballistic solver sits underneath every screen, so the numbers you practise with are the numbers a
field solver would give you. The app is built around one idea: a dope card is a **precomputed lookup table**,
`f(range, conditions) → (elevation, wind)`, and you learn it best by building one and then shooting with it.

```
Academy  ──▶  Lab  ──▶  Build Card  ──▶  Drills  ──▶  Range
 33 lessons    sliders    your rifle        write it      shoot it in
 quizzes       predict    system + card     by hand       real conditions
 calculators   reveal     print / CSV       graded        training → realistic
```

Everything is in **MIL** — reticle, turrets (0.1 mil clicks), card, spotter calls.

Static site, no build step, no dependencies. Every push to the deploy branch runs the solver tests and
republishes to GitHub Pages. Progress (XP, rank), your card and preferences live in the browser's localStorage.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Vanilla HTML / CSS / JavaScript | No framework, no bundler — open `index.html` and it runs |
| **Solver** | `js/ballistics.js` | Point-mass model, G1/G7 drag, RK2 at 0.5 ms, Miller stability, spin drift, aerodynamic jump, Coriolis, powder temperature |
| **Charts** | Hand-rolled responsive SVG | Hover readouts, transonic band shading |
| **Range view** | Canvas 2D | Scope scene, reticle, mirage, wind flags, animated plate |
| **Audio** | Web Audio API | Synthesized shot, steel ding, turret clicks — no audio files |
| **Styling** | CSS custom properties | Light / dark themes, Inter + JetBrains Mono |
| **Hosting** | GitHub Pages via Actions | `.github/workflows/pages.yml`, deploys only if tests pass |
| **Testing** | `node:test` | 17 physics checks: zero, wind linearity, DA, angle, stability, Coriolis direction, aero jump sign, temp sensitivity |

---

## Features

### Academy — Step 0

- **33 lessons in 7 chapters**: ballistics foundations · optics & the milliradian · writing a dope card · gear · cartridges & ammunition · field craft · glossary
- Every lesson leads with the **governing rule**, then tables, the **exceptions** and *why* they happen, then a way to verify it in the app
- **11 live calculators** on the real solver — G1 vs G7 drag curves, density altitude, wind clock, Coriolis, Miller stability, unit converter, reticle ranging, card anatomy, cartridge comparison, SD → vertical dispersion, glossary search
- **Rifle systems compared**: 8 cartridges from .223 to .338 Lapua with 1000 yd elevation, wind, velocity, energy, transonic range, Sg, recoil and barrel life
- **Bullet & ammo types**: OTM, VLD/secant, tangent, hybrid, polymer-tip, monolithic, FMJ, hunting — plus SD/ES, lots, powder temperature and barrel life
- Quizzes with instant feedback, per-chapter progress, XP

### Lab

- Seven sliders drive live charts of the **bullet path** and the **corrections** you dial and hold; transonic band shaded
- **Pin as baseline** to see one variable's effect as a dashed line
- **Predict, then reveal** — 8 challenges; the sliders move and the app shows the real change and *why*

### Build Card

- **Rifle systems**: 8 presets with bullet diameter, length, twist, ammo SD and powder temperature sensitivity — or fully custom
- Recomputes as you type; stability (Sg) and temperature-adjusted MV shown
- Elevation rounded to 0.1 mil clicks, wind-bracket holds, velocity, TOF; transonic and subsonic rows flagged; spin-drift column from Sg
- Print-ready card and CSV export; the saved card is the one you shoot with

### Drills

- **Convert** raw solver inches → card cells · **Interpolate** between rows · **Wind call** speed + clock → hold
- Graded to the click, worked solutions, streaks, timer, XP

### Range

- **Training** and **Realistic** presets, plus individual toggles
- **Range-day weather** (5 locations) with a weather-meter readout — DA and powder temperature move your dope; one click loads today's weather into your card
- **Shot angles** with cosine readout · **no-rangefinder mode** — mil the plate (random sizes)
- **Wind that differs near / mid / far**, gusting in real time; read it from three flags, mirage (boils when calm, runs, fades above ~12 mph) and the meter
- **The shooter**: position-dependent reticle sway (bench → standing), breathing, **hold breath** (`B`) that helps for ~6 s then hurts, **cant** with a scope bubble level (`L`)
- **Spin drift, Coriolis, aerodynamic jump**, MV spread from your ammo SD, rifle dispersion, optional hidden MV error for truing
- **Spotter calls** or **self-spot** the splash · real time of flight · ding delayed by the sound's return trip
- **PRS stage**: 5 targets, one shot each, 150 s par, stage card and score
- **What changed vs your card**: breaks the true solution into weather, angle, zero/MV and second-order layers

---

## Architecture

```
index.html            shell, tabs, static content
css/style.css         design tokens, light/dark themes, components
js/ballistics.js      solver (UMD — loads in the browser and in Node tests)
js/common.js          profile store, unit helpers, card math, sound, XP, toasts, SVG chart
js/academy-content.js Academy curriculum (lessons, quizzes, glossary)
js/academy.js         Academy tab: navigation, progress, quizzes, interactive widgets
js/lab.js             Lab tab: sliders, charts, challenges
js/build.js           Build Card tab
js/drills.js          Drills tab
js/range.js           Range tab: weather, wind field, shooter model, stages, canvas rendering
test/                 node:test suite for the solver
```

### Solver model

| Stage | What it does |
|---|---|
| **Drag** | Standard G1 / G7 tables (Cd vs Mach), scaled by BC |
| **Atmosphere** | Density and speed of sound from altitude, temperature, humidity → density altitude |
| **Integration** | Midpoint (RK2), gravity + drag relative to the moving air, 0.5 ms step |
| **Zero** | Bisection on bore angle so the bullet crosses the line of sight at the zero range |
| **Stability** | Miller twist rule → Sg, temperature/pressure corrected |
| **Second order** | Litz spin drift (from Sg), Litz aerodynamic jump, Coriolis + Eötvös from latitude and azimuth |
| **Ammo** | MV adjusted by powder temperature sensitivity vs chronograph temperature |
| **Extras** | Shot angle (gravity split across the line of sight), fixed-zero mode for truing |

Validated against published numbers: 6.5 Creedmoor 140 gr ELD-M at 2710 fps, sea level → ~8.8 mil elevation and ~1.9 mil per 10 mph at 1000 yd.

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| **v2.1.0** | 2026-10-03 | **Academy**: 33 lessons with quizzes and 11 solver-backed calculators covering ballistics, optics, card writing, gear, cartridges, bullet types and field craft. **Realistic Range**: range-day weather, shot angles, mil-ranging, near/mid/far wind, position sway and breath control, cant and bubble level, self-spotting, PRS stages and a "what changed vs your card" breakdown. Solver adds Miller stability, aerodynamic jump, Coriolis and powder temperature sensitivity. Eight rifle systems. **MIL only** throughout |
| **v2.0.0** | 2026-10-03 | Full redesign. Learn becomes an interactive **Ballistics Lab** with live charts and predict-then-reveal challenges. Build Card recomputes live with stat tiles and an elevation chart. Drills gain streaks, timer and XP. Range becomes a scope scene with gusting flags, mirage, swinging steel, clickable turrets, real time of flight and a delayed ding. Light/dark themes, XP ranks, synthesized sound |
| **v1.1.0** | 2026-10-03 | GitHub Pages deploy workflow — tests gate every publish |
| **v1.0.0** | 2026-10-03 | First release: point-mass G1/G7 solver, dope card builder (print + CSV), three graded drills, range simulator with dispersion, gusts and hidden MV error |

---

## Development

```sh
npm start          # python3 -m http.server 8000 → http://localhost:8000
npm test           # solver unit tests (Node 18+)
```

**Deploying** — push to the deploy branch; `.github/workflows/pages.yml` runs `npm test`, stages `index.html`, `css/` and `js/`, and publishes to GitHub Pages. A failing test blocks the deploy.

**Limitations** — a training aid, not a firing solution. Point-mass model (no 6-DOF), standard drag curves rather than measured custom curves, empirical spin-drift and aerodynamic-jump estimates, and no scope tracking error. Always confirm dope with live fire.

---

<div align="center">
<sub>Built for personal training · not a substitute for live-fire data</sub>
</div>
