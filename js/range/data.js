/*
 * Range catalogue: cartridges, factory loads, rifles, optics, positions and
 * range locations. All ballistic numbers are APPROXIMATE / TYPICAL published
 * values (manufacturer boxes, Litz-measured G7 BCs, common chronograph data).
 * The rifle you "own" in a session never shoots exactly box velocity: the
 * simulator hides a per-rifle offset, the way a real barrel does.
 *
 * MV scaling with barrel length uses a per-cartridge fps-per-inch figure
 * (typical range 15–35 fps/in for centerfire; rimfire is flat past 16").
 */
(function () {
  'use strict';

  const RANGE = (window.LRPS_RANGE = window.LRPS_RANGE || {});

  /* --------------------------------------------------------- cartridges */
  // barrels: lengths offered (in). twists: offered twist rates (1:x in).
  // fpsPerIn: MV change per inch of barrel. maxYd: sensible far limit.
  RANGE.CARTRIDGES = [
    { id: '22lr', name: '.22 LR (trainer)', barrels: [16, 18, 20, 22, 24], twists: [16], fpsPerIn: 0, maxYd: 300, zeroYd: 50, kd: [25, 50, 75, 100, 150, 200, 250, 300], recoil: 0.08, note: 'Rimfire trainer. Subsonic and wind-sensitive: the same reading skills at 1/5 the distance.' },
    { id: '223', name: '.223 Remington / 5.56', barrels: [16, 18, 20, 22, 24], twists: [7, 8, 9], fpsPerIn: 25, maxYd: 900, zeroYd: 100, recoil: 0.35, note: 'Light recoil, cheap to shoot, goes transonic around 800–900 yd.' },
    { id: '6cm', name: '6mm Creedmoor', barrels: [20, 22, 24, 26], twists: [7, 7.5, 8], fpsPerIn: 22, maxYd: 1300, zeroYd: 100, recoil: 0.55, note: 'PRS favourite: flat, low recoil, short barrel life.' },
    { id: '65cm', name: '6.5 Creedmoor', barrels: [18, 20, 22, 24, 26], twists: [8, 8.5, 9], fpsPerIn: 22, maxYd: 1300, zeroYd: 100, recoil: 0.7, note: 'The modern all-rounder; stays supersonic to ~1,300 yd at sea level.' },
    { id: '65prc', name: '6.5 PRC', barrels: [22, 24, 26], twists: [7.5, 8], fpsPerIn: 25, maxYd: 1500, zeroYd: 100, recoil: 0.95, note: '~200 fps over the Creedmoor with the same bullets.' },
    { id: '308', name: '.308 Winchester', barrels: [16, 18, 20, 22, 24, 26], twists: [10, 11.25, 12], fpsPerIn: 22, maxYd: 1000, zeroYd: 100, recoil: 0.95, note: 'The classic; honest wind drift makes it a great teacher.' },
    { id: '300wm', name: '.300 Winchester Magnum', barrels: [24, 26], twists: [9, 10], fpsPerIn: 28, maxYd: 1500, zeroYd: 100, recoil: 1.5, note: 'Heavy recoil; watch barrel heat on long strings.' },
    { id: '300prc', name: '.300 PRC', barrels: [24, 26, 28], twists: [8, 9], fpsPerIn: 28, maxYd: 1600, zeroYd: 100, recoil: 1.5, note: 'Built around very long, high-BC .30 bullets.' },
    { id: '338lm', name: '.338 Lapua Magnum', barrels: [24, 26, 27, 28, 30], twists: [9.4, 10], fpsPerIn: 30, maxYd: 1800, zeroYd: 100, recoil: 2.2, note: 'ELR-capable; mind your shoulder and your budget.' },
  ];

  /* ---------------------------------------------------------- factory loads */
  // mvFps is the box velocity from refBarrelIn. bc is G7 unless dragModel says G1.
  // sdFps: typical extreme-spread-derived standard deviation for the factory
  // load. tempSens: fps per °F of powder temperature (approximate).
  RANGE.LOADS = [
    { id: 'sk-std-40', cart: '22lr', brand: 'SK / Lapua', name: 'Standard Plus 40 gr LRN', bulletGr: 40, bc: 0.13, dragModel: 'G1', diaIn: 0.2255, lenIn: 0.42, mvFps: 1070, refBarrelIn: 20, sdFps: 9, tempSens: 0.7, src: 'Lapua/SK data: ~1,073 fps, G1 ≈ 0.13' },
    { id: 'cci-sv-40', cart: '22lr', brand: 'CCI', name: 'Standard Velocity 40 gr LRN', bulletGr: 40, bc: 0.12, dragModel: 'G1', diaIn: 0.2255, lenIn: 0.42, mvFps: 1070, refBarrelIn: 20, sdFps: 14, tempSens: 0.8, src: 'CCI box: 1,070 fps; G1 ≈ 0.12' },

    { id: 'bh-77tmk', cart: '223', brand: 'Black Hills', name: '5.56 77 gr Sierra TMK', bulletGr: 77, bc: 0.208, dragModel: 'G7', diaIn: 0.224, lenIn: 1.0, mvFps: 2750, refBarrelIn: 20, sdFps: 12, tempSens: 0.9, src: 'Sierra G1 .420 (→ G7 ≈ .21); Black Hills 2,750 fps / 20"' },
    { id: 'fed-gmm-69', cart: '223', brand: 'Federal', name: 'Gold Medal 69 gr SMK', bulletGr: 69, bc: 0.169, dragModel: 'G7', diaIn: 0.224, lenIn: 0.9, mvFps: 2950, refBarrelIn: 24, sdFps: 13, tempSens: 1.0, src: 'Federal box: 2,950 fps / 24"; Litz G7 ≈ .169' },

    { id: 'berger-6cm-105', cart: '6cm', brand: 'Berger', name: '105 gr Hybrid Target', bulletGr: 105, bc: 0.275, dragModel: 'G7', diaIn: 0.243, lenIn: 1.236, mvFps: 3000, refBarrelIn: 24, sdFps: 9, tempSens: 0.5, src: 'Berger: G7 .275, length 1.236"; factory ≈ 3,000 fps / 24"' },
    { id: 'horn-6cm-108', cart: '6cm', brand: 'Hornady', name: '108 gr ELD Match', bulletGr: 108, bc: 0.270, dragModel: 'G7', diaIn: 0.243, lenIn: 1.231, mvFps: 2960, refBarrelIn: 24, sdFps: 10, tempSens: 0.6, src: 'Hornady box: 2,960 fps / 24"; G7 .270' },

    { id: 'horn-65-140', cart: '65cm', brand: 'Hornady', name: '140 gr ELD Match', bulletGr: 140, bc: 0.326, dragModel: 'G7', diaIn: 0.264, lenIn: 1.37, mvFps: 2710, refBarrelIn: 24, sdFps: 11, tempSens: 0.6, src: 'Hornady box: 2,710 fps / 24"; G7 .326' },
    { id: 'horn-65-147', cart: '65cm', brand: 'Hornady', name: '147 gr ELD Match', bulletGr: 147, bc: 0.351, dragModel: 'G7', diaIn: 0.264, lenIn: 1.44, mvFps: 2695, refBarrelIn: 24, sdFps: 11, tempSens: 0.6, src: 'Hornady box: 2,695 fps / 24"; G7 .351' },
    { id: 'berger-65-140', cart: '65cm', brand: 'Berger', name: '140 gr Hybrid Target', bulletGr: 140, bc: 0.311, dragModel: 'G7', diaIn: 0.264, lenIn: 1.409, mvFps: 2810, refBarrelIn: 24, sdFps: 9, tempSens: 0.5, src: 'Berger: G7 .311, length 1.409"; factory ≈ 2,810 fps / 24"' },
    { id: 'fed-65-130', cart: '65cm', brand: 'Federal', name: 'Gold Medal 130 gr Berger Hybrid', bulletGr: 130, bc: 0.290, dragModel: 'G7', diaIn: 0.264, lenIn: 1.3, mvFps: 2875, refBarrelIn: 24, sdFps: 12, tempSens: 0.9, src: 'Federal box: 2,875 fps / 24"; Berger G7 .290' },

    { id: 'horn-65prc-147', cart: '65prc', brand: 'Hornady', name: '147 gr ELD Match', bulletGr: 147, bc: 0.351, dragModel: 'G7', diaIn: 0.264, lenIn: 1.44, mvFps: 2910, refBarrelIn: 24, sdFps: 11, tempSens: 0.7, src: 'Hornady box: 2,910 fps / 24"; G7 .351' },

    { id: 'fed-gmm-175', cart: '308', brand: 'Federal', name: 'Gold Medal 175 gr SMK', bulletGr: 175, bc: 0.243, dragModel: 'G7', diaIn: 0.308, lenIn: 1.24, mvFps: 2600, refBarrelIn: 24, sdFps: 12, tempSens: 1.0, src: 'Federal box: 2,600 fps / 24"; Litz G7 .243' },
    { id: 'fed-gmm-168', cart: '308', brand: 'Federal', name: 'Gold Medal 168 gr SMK', bulletGr: 168, bc: 0.218, dragModel: 'G7', diaIn: 0.308, lenIn: 1.215, mvFps: 2650, refBarrelIn: 24, sdFps: 12, tempSens: 1.0, src: 'Federal box: 2,650 fps / 24"; Litz G7 .218' },
    { id: 'horn-308-168', cart: '308', brand: 'Hornady', name: '168 gr ELD Match', bulletGr: 168, bc: 0.263, dragModel: 'G7', diaIn: 0.308, lenIn: 1.32, mvFps: 2700, refBarrelIn: 24, sdFps: 12, tempSens: 0.7, src: 'Hornady box: 2,700 fps / 24"; G7 ≈ .263' },

    { id: 'berger-300wm-215', cart: '300wm', brand: 'Berger', name: '215 gr Hybrid Target', bulletGr: 215, bc: 0.354, dragModel: 'G7', diaIn: 0.308, lenIn: 1.595, mvFps: 2850, refBarrelIn: 26, sdFps: 12, tempSens: 1.1, src: 'Berger: G7 .354, length 1.595"; factory ≈ 2,850 fps / 26"' },
    { id: 'horn-300prc-225', cart: '300prc', brand: 'Hornady', name: '225 gr ELD Match', bulletGr: 225, bc: 0.391, dragModel: 'G7', diaIn: 0.308, lenIn: 1.62, mvFps: 2810, refBarrelIn: 24, sdFps: 11, tempSens: 0.8, src: 'Hornady box: 2,810 fps / 24"; G7 .391' },

    { id: 'berger-338-300', cart: '338lm', brand: 'Berger', name: '300 gr Hybrid OTM', bulletGr: 300, bc: 0.419, dragModel: 'G7', diaIn: 0.338, lenIn: 1.805, mvFps: 2750, refBarrelIn: 26, sdFps: 12, tempSens: 1.0, src: 'Berger: G7 .419, length 1.805"; typical 2,750 fps / 26"' },
    { id: 'lapua-338-300', cart: '338lm', brand: 'Lapua', name: '300 gr Scenar OTM', bulletGr: 300, bc: 0.368, dragModel: 'G7', diaIn: 0.338, lenIn: 1.72, mvFps: 2720, refBarrelIn: 27, sdFps: 10, tempSens: 0.9, src: 'Lapua box: 2,723 fps / 27"; G1 .736 (→ G7 ≈ .37)' },
  ];

  /* ------------------------------------------------------------ rifle class */
  // precisionMil: typical 5-shot group size. contour: barrel heat POI-walk
  // factor. weightLb for recoil. coldBore: typical cold-bore shift magnitude.
  RANGE.RIFLES = [
    { id: 'hunting', name: 'Factory hunting rifle', precisionMil: 0.32, contour: 1.0, weightLb: 8.5, coldBore: 0.3, desc: 'Pencil barrel, ~0.3 mil groups. Walks as it heats; worst cold-bore shift.' },
    { id: 'precision', name: 'Factory precision rifle', precisionMil: 0.2, contour: 0.45, weightLb: 12, coldBore: 0.18, desc: 'Heavy barrel in a chassis, ~0.2 mil groups. Mild heat walk.' },
    { id: 'custom', name: 'Custom match rifle', precisionMil: 0.12, contour: 0.25, weightLb: 15, coldBore: 0.1, desc: 'Match barrel and action, ~0.12 mil groups. Nearly immune to heat.' },
  ];

  /* ------------------------------------------------------------------ optic */
  // Every optic is MIL/MIL, 0.1 mil clicks, 10 mil per revolution, FFP.
  RANGE.OPTICS = [
    { id: 'mid', name: '5–25× FFP MIL', zooms: [5, 12, 25], travelMil: 30, trackErr: 0.015, desc: 'Mid-tier glass. Tracks within ±1.5%.' },
    { id: 'premium', name: '7–35× FFP MIL (premium)', zooms: [7, 18, 35], travelMil: 35, trackErr: 0.005, desc: 'Flagship glass. Tracks within ±0.5%.' },
    { id: 'budget', name: '4–16× FFP MIL (budget)', zooms: [4, 10, 16], travelMil: 24, trackErr: 0.035, desc: 'Entry level. Tracking error up to ±3.5%.' },
  ];
  RANGE.SIGHT_HEIGHTS = [1.5, 1.7, 1.9, 2.1, 2.3, 2.5, 2.8];

  /* -------------------------------------------------------------- positions */
  // wobble amplitude (mil), trigger-break scatter sigma (mil)
  RANGE.POSITIONS = [
    { id: 'bench', name: 'Bench / sandbags', wobble: 0.035, trigger: 0.02 },
    { id: 'prone-bag', name: 'Prone · bipod + rear bag', wobble: 0.09, trigger: 0.03 },
    { id: 'prone', name: 'Prone · bipod only', wobble: 0.18, trigger: 0.05 },
    { id: 'barricade', name: 'Barricade · bag', wobble: 0.4, trigger: 0.08 },
    { id: 'kneeling', name: 'Kneeling · tripod', wobble: 0.75, trigger: 0.12 },
    { id: 'standing', name: 'Standing · tripod', wobble: 1.3, trigger: 0.18 },
  ];

  /* -------------------------------------------------------------- locations */
  // zoneK: terrain multipliers for near/mid/far wind. maxYd: longest berm.
  // pressOff: typical weather-system pressure offset range (inHg).
  RANGE.LOCATIONS = [
    { id: 'coastal', name: 'Coastal range', alt: 50, lat: 34, temp: [50, 84], hum: [55, 95], zoneK: [1, 1.05, 1.15], maxYd: 1000, terrain: 'Flat, open; wind steadier but stronger far out.' },
    { id: 'midwest', name: 'Midwest prairie', alt: 900, lat: 41, temp: [20, 95], hum: [30, 80], zoneK: [1, 1, 1], maxYd: 1200, terrain: 'Open prairie; honest, gusty wind end to end.' },
    { id: 'desert', name: 'Desert range', alt: 2500, lat: 33, temp: [60, 108], hum: [8, 30], zoneK: [0.9, 1.1, 1.2], maxYd: 1600, terrain: 'Hot, thin air, heavy mirage; dust devils at midday.' },
    { id: 'mountain', name: 'Mountain valley', alt: 6200, lat: 39, temp: [25, 85], hum: [15, 55], zoneK: [0.6, 1.0, 1.3], maxYd: 1800, terrain: 'Sheltered firing line; the wind lives in the valley past 400 yd.' },
    { id: 'northern', name: 'Northern forest cut', alt: 1200, lat: 61, temp: [5, 70], hum: [40, 90], zoneK: [0.7, 1.0, 0.8], maxYd: 1000, terrain: 'Tree lines funnel the wind through the middle.' },
    { id: 'canyon', name: 'Canyon range', alt: 4100, lat: 36, temp: [40, 100], hum: [10, 40], zoneK: [1.2, 0.8, 1.1], maxYd: 1400, terrain: 'Wind swirls near the line and switches often.' },
  ];

  RANGE.SKY = [
    { id: 'overcast', name: 'Overcast', sun: 0.1, mirage: 0.5 },
    { id: 'partly', name: 'Partly cloudy', sun: 0.55, mirage: 0.8 },
    { id: 'sunny', name: 'Full sun', sun: 1, mirage: 1.1 },
  ];

  /* ---------------------------------------------------------------- helpers */
  RANGE.cartridge = (id) => RANGE.CARTRIDGES.find((c) => c.id === id) || RANGE.CARTRIDGES[3];
  RANGE.load = (id) => RANGE.LOADS.find((l) => l.id === id) || RANGE.LOADS.find((l) => l.id === RANGE.DEFAULT_SETUP.load) || RANGE.LOADS[0];
  RANGE.loadsFor = (cartId) => RANGE.LOADS.filter((l) => l.cart === cartId);
  RANGE.rifle = (id) => RANGE.RIFLES.find((r) => r.id === id) || RANGE.RIFLES[1];
  RANGE.optic = (id) => RANGE.OPTICS.find((o) => o.id === id) || RANGE.OPTICS[0];
  RANGE.position = (id) => RANGE.POSITIONS.find((p) => p.id === id) || RANGE.POSITIONS[1];
  RANGE.location = (id) => RANGE.LOCATIONS.find((l) => l.id === id) || null;
  RANGE.sky = (id) => RANGE.SKY.find((s) => s.id === id) || RANGE.SKY[1];

  /* Box velocity for this load fired from a barrel of the given length. */
  RANGE.boxMv = (load, barrelIn) => {
    const cart = RANGE.cartridge(load.cart);
    return Math.round(load.mvFps + (barrelIn - load.refBarrelIn) * cart.fpsPerIn);
  };

  /* Known-distance target lanes for a cartridge at a given location. */
  RANGE.kdLanes = (cart, maxYd) => {
    const far = Math.min(cart.maxYd, maxYd || cart.maxYd);
    const yards = cart.kd ? cart.kd.filter((y) => y <= far) : (() => {
      const out = [];
      for (let y = 100; y <= far; y += 100) out.push(y);
      return out;
    })();
    return yards.map((y) => ({ yards: y, plateIn: RANGE.platesFor(cart, y) }));
  };

  /* Typical steel sizes by distance (roughly 1.5–2.5 MOA). */
  RANGE.platesFor = (cart, yards) => {
    const scale = cart.id === '22lr' ? 5 : 1;
    const y = yards * scale;
    if (y <= 200) return 6;
    if (y <= 300) return 8;
    if (y <= 500) return 10;
    if (y <= 700) return 12;
    if (y <= 900) return 16;
    if (y <= 1200) return 20;
    return 24;
  };

  /* Session settings persisted across visits. */
  RANGE.DEFAULT_SETUP = {
    cart: '65cm', load: 'horn-65-140', barrelIn: 24, twistIn: 8, rifle: 'precision', optic: 'mid',
    sightHeightIn: 1.9, zeroYd: 100, location: 'midwest', sky: 'partly', position: 'prone-bag',
    preset: 'training',
  };

  /* Realism toggles per preset. */
  RANGE.PRESETS = {
    training: { lrf: true, lrfError: false, windCall: true, spotter: true, gusts: true, cant: false, angle: false, adv: false, heat: false, coldBore: false, tracking: false, sun: false, delay: true },
    realistic: { lrf: true, lrfError: true, windCall: false, spotter: false, gusts: true, cant: true, angle: true, adv: true, heat: true, coldBore: true, tracking: true, sun: true, delay: true },
  };
  RANGE.TOGGLES = [
    ['lrf', 'Laser rangefinder available (off = mil the target)'],
    ['lrfError', 'Rangefinder beam divergence (bad returns on small far targets)'],
    ['windCall', 'Wind call given by the RO'],
    ['spotter', 'Spotter calls impacts in mil'],
    ['gusts', 'Gusts, lulls and switches'],
    ['angle', 'Uphill / downhill targets'],
    ['cant', 'Cant (use the bubble level)'],
    ['adv', 'Spin drift, Coriolis, aerodynamic jump'],
    ['coldBore', 'Cold-bore / clean-bore shift'],
    ['heat', 'Barrel heat: MV and POI walk over a string'],
    ['tracking', 'Scope tracking error'],
    ['sun', 'Ammo warms in the sun during the session'],
    ['delay', 'Sound-delayed steel'],
  ];
})();
