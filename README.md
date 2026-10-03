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

1. **Learn** – rules first: the variables, conversion formulas, and where the simple rules break (transonic flight, MOA vs IPHY, DA changes, truing).
2. **Build Card** – enter a rifle, load and conditions; get a printable card (elevation, clicks, wind brackets, velocity, TOF) with transonic rows flagged. Export to CSV. Saved in the browser.
3. **Drills** – graded to the click:
   - *Convert*: raw solver output in inches → card cells in MIL/MOA and clicks.
   - *Interpolate*: read between 100 yd rows (and see why the straight-line estimate runs high).
   - *Wind call*: apply speed and clock direction to the card's 10 mph value.
4. **Range** – a target at a random distance with a wind call. Dial and hold from **your** card, fire, read the impact through a reticle, and correct. Includes velocity spread, rifle dispersion, gusts, and an optional **hidden MV error** for practising card truing.

## Limitations

This is a training aid, not a firing solution. It omits Coriolis, aerodynamic jump, and
scope tracking error, and its spin drift is an empirical approximation. Always confirm dope with live fire.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` tests the solver and publishes `index.html`, `css/` and `js/`
on every push. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is then served at `https://pancho0091.github.io/LRPS_Simulator/`.
(Pages on a private repo requires a paid GitHub plan; on a free plan make the repo public.)
