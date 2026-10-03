<div align="center">

# LRPS Dope Simulator

**Long-range precision shooting trainer · ballistic solver · dope card builder · range simulator**

[![Version](https://img.shields.io/badge/version-v2.0.0-f59e0b?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Updated](https://img.shields.io/badge/last%20updated-2026--10--03-6b7280?style=for-the-badge&labelColor=0a0e0c)](https://github.com/Pancho0091/LRPS_Simulator/commits)
[![Live](https://img.shields.io/badge/live-pancho0091.github.io%2FLRPS__Simulator-4ade80?style=for-the-badge&labelColor=0a0e0c)](https://pancho0091.github.io/LRPS_Simulator/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-auto--deploy-222222?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Pancho0091/LRPS_Simulator/actions/workflows/pages.yml)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla%2C%20no%20build-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Tests](https://img.shields.io/badge/node%3Atest-12%20passing-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](./test/ballistics.test.js)

### ▶ [Open the simulator](https://pancho0091.github.io/LRPS_Simulator/)

</div>

---

## Overview

A browser-based trainer for learning to **write and use dope cards** for long-range precision shooting. A real
point-mass ballistic solver sits underneath every screen, so the numbers you practise with are the numbers a
field solver would give you. The app is built around one idea: a dope card is a **precomputed lookup table**,
`f(range, conditions) → (elevation, wind)`, and you learn it best by building one and then shooting with it.

```
Learn  ──▶  Build Card  ──▶  Drills  ──▶  Range
 lab         your data       write it      shoot it
 sliders     live card       by hand       dial, hold,
 predict     print / CSV     graded        read the wind
```

Static site, no build step, no dependencies. Every push to the deploy branch runs the solver tests and
republishes to GitHub Pages. Progress (XP, rank), your card and preferences live in the browser's localStorage.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Vanilla HTML / CSS / JavaScript | No framework, no bundler — open `index.html` and it runs |
| **Solver** | `js/ballistics.js` | Point-mass model, G1/G7 drag tables, RK2 integration at 0.5 ms |
| **Charts** | Hand-rolled responsive SVG | Hover readouts, transonic band shading |
| **Range view** | Canvas 2D | Scope scene, reticle, mirage, wind flags, animated plate |
| **Audio** | Web Audio API | Synthesized shot, steel ding, turret clicks — no audio files |
| **Styling** | CSS custom properties | Light / dark themes, Inter + JetBrains Mono |
| **Hosting** | GitHub Pages via Actions | `.github/workflows/pages.yml`, deploys only if tests pass |
| **Testing** | `node:test` | Physics checks: zero, wind linearity, DA, angle, unit round-trips |

---

## Features

### Learn — Ballistics Lab

- Seven sliders (MV, BC, altitude, temperature, wind speed, wind clock, zero) drive live charts of the **bullet path** and the **corrections** you dial and hold
- Stat tiles at 1000 yd — elevation, wind, velocity, time of flight, density altitude, transonic range
- **Pin as baseline** draws the previous state as a dashed line so a single variable's effect is visible
- **Predict, then reveal** — 8 challenges ("it's 40°F warmer: more or less elevation?"); you answer, the sliders move, the app shows the real change and *why*
- Reference rules: system diagram, variable sensitivity, conversion formulas, exceptions (transonic, MOA vs IPHY, truing, DA)

### Build Card

- Recomputes as you type; five rifle/load presets or fully custom
- Card shows elevation (rounded to the click), turret clicks, wind holds for configurable mph brackets, velocity and time of flight
- Transonic (< Mach 1.2) and subsonic rows flagged — where solver data stops being trustworthy
- Optional spin-drift column, shot angle, altitude / temperature / humidity
- Print-ready layout and CSV export; the saved card is the one you shoot with on the Range

### Drills

- **Convert** — raw solver output in inches → card cells in MIL/MOA and clicks
- **Interpolate** — read between 100 yd rows, and see why the straight line over-estimates elevation
- **Wind call** — apply speed and clock direction to the card's 10 mph value
- Graded to the click, worked solutions, streaks, timer, accuracy, XP; `Enter` to check and advance

### Range

- Scope view of a steel plate at a random distance — treeline, berm, swinging plate on hits, spotter rings on misses
- Read the wind from gusting **near / mid / far flags** and drifting **mirage**; the shot uses the wind at the moment it breaks
- Clickable turret dials, real **time of flight**, and a ding delayed by sound travelling back (~1125 fps)
- Velocity spread, rifle dispersion, optional **hidden MV error** for truing practice
- Session stats: shots, hits, first-round hits, streak · keys: `↑↓` elevation · `←→` wind · `Shift` ×5 · `Space` fire · `N` new target

---

## Architecture

```
index.html            shell, tabs, static content
css/style.css         design tokens, light/dark themes, components
js/ballistics.js      solver (UMD — loads in the browser and in Node tests)
js/common.js          profile store, unit helpers, card math, sound, XP, toasts, SVG chart
js/lab.js             Learn tab: sliders, charts, challenges
js/build.js           Build Card tab
js/drills.js          Drills tab
js/range.js           Range tab: scenario, wind model, canvas rendering, turrets
test/                 node:test suite for the solver
```

### Solver model

| Stage | What it does |
|---|---|
| **Drag** | Standard G1 / G7 tables (Cd vs Mach), scaled by BC |
| **Atmosphere** | Density and speed of sound from altitude, temperature, humidity → density altitude |
| **Integration** | Midpoint (RK2), gravity + drag relative to the moving air, 0.5 ms step |
| **Zero** | Bisection on bore angle so the bullet crosses the line of sight at the zero range |
| **Extras** | Shot angle (gravity split across the line of sight), Litz spin-drift approximation |

Validated against published numbers: 6.5 Creedmoor 140 gr ELD-M at 2710 fps, sea level → ~30 MOA elevation and ~6.5 MOA per 10 mph at 1000 yd.

---

## Changelog

| Version | Date | Notes |
|---|---|---|
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

**Limitations** — a training aid, not a firing solution. No Coriolis or aerodynamic jump yet, spin drift is an empirical approximation, and scope tracking error is not modelled. Always confirm dope with live fire.

---

<div align="center">
<sub>Built for personal training · not a substitute for live-fire data</sub>
</div>
