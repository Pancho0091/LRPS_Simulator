# LRPS Dope Simulator

A browser-based trainer for learning to **write and use dope cards** for long-range precision shooting.

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```sh
npm start          # python3 -m http.server 8000 → http://localhost:8000
npm test           # solver unit tests (Node 18+)
```

## Model

A dope card is a precomputed lookup table: `f(range, conditions) → (elevation, wind)`.
The app computes it with a **point-mass ballistic solver** (`js/ballistics.js`):

| Layer | What it does |
|---|---|
| Drag | Standard G1 / G7 drag tables (Cd vs Mach), scaled by the bullet's BC |
| Atmosphere | Air density and speed of sound from altitude, temperature and humidity → density altitude |
| Integration | Midpoint (RK2) integration of gravity + drag relative to the moving air, 0.5 ms step |
| Zero | Bisection on bore angle so the bullet crosses the line of sight at the zero range |
| Extras | Shot angle (gravity split along/across the line of sight), Litz spin-drift approximation |

## Modes

1. **Learn – Ballistics Lab**: sliders for MV, BC, altitude, temperature, wind and zero drive live charts of the bullet path and the corrections. Pin a baseline to compare. "Predict, then reveal" challenges test your mental model of each variable. Reference rules (conversions, exceptions) below.
2. **Build Card** – recomputes as you type; printable card (elevation, clicks, wind brackets, velocity, TOF) with transonic rows flagged, stat tiles and an elevation chart. Export to CSV. Saved in the browser.
3. **Drills** – graded to the click, with streaks, a timer and XP:
   - *Convert*: raw solver output in inches → card cells in MIL/MOA and clicks.
   - *Interpolate*: read between 100 yd rows (and see why the straight-line estimate runs high).
   - *Wind call*: apply speed and clock direction to the card's 10 mph value.
4. **Range** – a scope view of a steel plate at a random distance. Read the wind from gusting flags and drifting mirage, dial the clickable turrets from **your** card, and send it. Real time of flight, a ding delayed by the sound's return trip, velocity spread, rifle dispersion, and an optional **hidden MV error** for truing practice.

Progress (XP and rank) and preferences (theme, sound) are stored in your browser.

**Range keys:** `↑/↓` elevation · `←/→` wind · `Shift` ×5 · `Space` fire · `N` new target · `0` reset dials.

## Limitations

This is a training aid, not a firing solution. It omits Coriolis, aerodynamic jump, and
scope tracking error, and its spin drift is an empirical approximation. Always confirm dope with live fire.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` tests the solver and publishes `index.html`, `css/` and `js/`
on every push. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is then served at `https://pancho0091.github.io/LRPS_Simulator/`.
(Pages on a private repo requires a paid GitHub plan; on a free plan make the repo public.)
