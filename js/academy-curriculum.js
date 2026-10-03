/*
 * The Academy course: a linear, module-based path from absolute basics to
 * writing and using a dope card. Each module builds on the previous one.
 *
 * A lesson is either written here in full, or { ref: 'id' } to reuse a lesson
 * from the lesson bank (academy-content.js), optionally overriding fields.
 * Every lesson can carry:
 *   terms  — key terms it introduces (shown as chips)
 *   recap  — what you now know (shown at the end)
 *   quiz   — must be passed to unlock the next lesson
 */
window.LRPS_COURSE = [
  // =====================================================================
  {
    id: 'm-basics',
    title: 'Safety & first principles',
    goal: 'Handle a rifle safely and understand what long-range precision shooting actually is.',
    lessons: [
      {
        id: 'safety',
        title: 'The safety system',
        mins: 5,
        terms: ['Muzzle', 'Cold range', 'Chamber flag', 'Backstop'],
        html: `
<div class="callout rule"><b>Rule:</b> Firearm safety is <b>defence in depth</b>: several independent rules, each of which alone prevents an injury.
An accident needs <i>every</i> rule to fail at the same time — so you follow all of them, all of the time.</div>
<h4>The four universal rules</h4>
<table class="tbl text">
<thead><tr><th>#</th><th>Rule</th><th>What it prevents</th></tr></thead>
<tbody>
<tr><td>1</td><td>Treat every firearm as if it is loaded</td><td>"I thought it was empty" — the most common cause of accidents</td></tr>
<tr><td>2</td><td>Never let the muzzle (the open front end of the barrel) point at anything you are not willing to destroy</td><td>If rule 1 fails, nobody is in the line of fire</td></tr>
<tr><td>3</td><td>Keep your finger off the trigger until your sights are on the target and you have decided to shoot</td><td>Unintended discharges from startle, stumbling or gripping</td></tr>
<tr><td>4</td><td>Be sure of your target and what is beyond it</td><td>Hitting the wrong thing; bullets travel well over a mile</td></tr>
</tbody></table>
<h4>Range basics</h4>
<ul>
<li><b>Eye and ear protection, always.</b> A rifle shot is roughly 150–170 dB; hearing damage starts well below that and is permanent.</li>
<li><b>Cold range</b> = nobody shoots, actions (the rifle's loading mechanism) open, chamber flags in, people may go downrange. <b>Hot range</b> = shooting allowed. Obey "cease fire" instantly.</li>
<li>Transport rifles unloaded with the action open or a <b>chamber flag</b> (a bright insert that shows the chamber is empty) inserted.</li>
<li>Only shoot where a proper <b>backstop</b> (berm) stops every bullet, including misses.</li>
</ul>
<div class="callout analog"><b>Technical analog:</b> the four rules are redundant guards around one dangerous operation.
<code>if (loaded && pointedAtPerson && fingerOnTrigger && noBackstop) harm()</code> — every rule forces one term to false.</div>
<div class="callout warn"><b>Before live fire:</b> this app teaches the theory. Take a hands-on course with a qualified instructor and follow your local laws and range rules.</div>`,
        recap: ['Four rules, all of them, all the time — each one alone prevents harm.', 'Eye and ear protection on every shot.', 'Know cold vs hot range and obey "cease fire" instantly.'],
        quiz: [
          { q: 'Why are there four rules instead of one?', options: ['Tradition', 'Each is an independent layer; an accident needs all to fail', 'They apply to different guns'], answer: 1, why: 'Defence in depth: any single rule followed prevents the injury.' },
          { q: 'On a cold range you should…', options: ['Keep shooting quietly', 'Have actions open / chamber flags in and hands off rifles', 'Load up for the next string'], answer: 1, why: 'Cold means people may be downrange.' },
        ],
      },
      {
        id: 'what-is-lrps',
        title: 'What long-range precision shooting is',
        mins: 5,
        terms: ['Precision', 'Accuracy', 'Error budget', 'First-round hit'],
        html: `
<div class="callout rule"><b>Rule:</b> Long-range precision shooting is the craft of hitting a small target far away — usually 300 to 1,000+ yards —
<b>with the first shot</b>. Every miss is the sum of a few error sources; the craft is shrinking each one.</div>
<h4>The error budget</h4>
<table class="tbl text">
<thead><tr><th>Error source</th><th>Where it comes from</th><th>Module that fixes it</th></tr></thead>
<tbody>
<tr><td>Rifle & ammo</td><td>How tightly the rifle groups with perfect aim</td><td>03–06 Platforms, ammo, calibers</td></tr>
<tr><td>Data</td><td>Wrong elevation for the range and conditions</td><td>07 Ballistics · 11 Dope cards</td></tr>
<tr><td>Wind</td><td>Misjudging how much the wind moves the bullet</td><td>07 Ballistics · 12 Field craft</td></tr>
<tr><td>Optics</td><td>Wrong adjustments, cant, parallax</td><td>08 Optics</td></tr>
<tr><td>Shooter</td><td>Wobble, poor trigger press, bad position</td><td>10 Positions & fundamentals</td></tr>
</tbody></table>
<h4>Accuracy vs precision</h4>
<ul>
<li><b>Precision</b> = how tight your group is (shots land close to each other).</li>
<li><b>Accuracy</b> = how close the group's center is to where you aimed.</li>
<li>A precise rifle with wrong data shoots tight groups in the wrong place. A dope card (your table of scope adjustments for each distance) fixes accuracy; equipment and skill fix precision.</li>
</ul>
<div class="callout analog"><b>Technical analog:</b> like a tolerance stack-up or a latency budget. Errors add up (roughly as the square root of the sum of squares),
so the biggest single error dominates — fix that one first.</div>
<h4>How this course is built</h4>
<pre class="code">safety ─▶ words & units ─▶ history ─▶ rifles ─▶ ammo ─▶ bullet types ─▶ calibers
       ─▶ ballistics ─▶ optics ─▶ equipment ─▶ positions ─▶ dope cards ─▶ field craft</pre>
<p>Each module uses words and ideas from the ones before it. That's why lessons unlock in order.</p>
<div class="callout try"><b>Verify:</b> on the <a data-goto="range">Range</a> (Training), run Setup → Chronograph → Zero, then fire at steel without dialing. The miss you see is the "data" error — the one this course teaches you to remove.</div>`,
        recap: ['Goal: first-round hits on small, distant targets.', 'Misses = rifle/ammo + data + wind + optics + shooter errors.', 'Precision = tight groups; accuracy = groups in the right place.'],
        quiz: [
          { q: 'Your rifle shoots tiny groups but they land 2 ft low at 800 yd. That is a problem of…', options: ['Precision', 'Accuracy (wrong data)', 'Safety'], answer: 1, why: 'The group is tight (precise) but not where you aimed (inaccurate).' },
          { q: 'With several error sources, which do you fix first?', options: ['The smallest', 'The biggest — it dominates the total', 'All equally'], answer: 1, why: 'Errors combine roughly as a root-sum-square, so the largest dominates.' },
        ],
      },
      {
        id: 'rifle-anatomy',
        title: 'Anatomy of a precision rifle',
        mins: 6,
        terms: ['Action', 'Bolt', 'Barrel', 'Chassis', 'Muzzle device', 'Bipod'],
        html: `
<div class="callout rule"><b>Rule:</b> A precision rifle is a <b>system</b>: a barrel that launches the bullet, an action that locks the cartridge in place,
a stock that holds it steady, and an optic that aims it. Precision requires every part to do its job <b>identically</b> every shot.</div>
<div data-widget="rifle-anatomy"></div>
<table class="tbl text">
<thead><tr><th>Part</th><th>Job</th><th>What matters for precision</th></tr></thead>
<tbody>
<tr><td>Barrel</td><td>Guides and spins the bullet</td><td>Quality, twist rate, length, "free-floated" (touches nothing but the action)</td></tr>
<tr><td>Action / receiver</td><td>Holds the bolt, attaches barrel and stock</td><td>Rigid, consistent lockup</td></tr>
<tr><td>Bolt</td><td>Loads, locks, extracts the cartridge</td><td>Smooth, consistent</td></tr>
<tr><td>Trigger</td><td>Releases the shot</td><td>Clean, light, the same every time</td></tr>
<tr><td>Magazine</td><td>Holds cartridges</td><td>Reliable feeding</td></tr>
<tr><td>Stock / chassis</td><td>Holds everything, fits the shooter</td><td>Rigid, adjustable cheek and length of pull</td></tr>
<tr><td>Optic (scope)</td><td>Aims and measures angles</td><td>Tracks exactly, holds zero</td></tr>
<tr><td>Muzzle device</td><td>Reduces recoil (brake) or noise (suppressor)</td><td>Lets you see your own hits</td></tr>
<tr><td>Bipod</td><td>Front support</td><td>Stable, consistent loading</td></tr>
</tbody></table>
<div class="callout analog"><b>Technical analog:</b> a rifle is a pipeline: <code>optic (aim) → stock (stability) → action (lockup) → barrel (launch)</code>.
A weak stage anywhere limits the whole pipeline.</div>`,
        recap: ['Barrel launches, action locks, stock steadies, optic aims.', 'Consistency of every part = precision.', 'Muzzle devices help you see your own impacts.'],
        quiz: [
          { q: 'Which part locks the cartridge in place and holds the bolt?', options: ['Barrel', 'Action / receiver', 'Bipod'], answer: 1, why: 'The action is the rifle’s core; barrel and stock attach to it.' },
          { q: '"Free-floated" barrel means…', options: ['It can be removed', 'It touches nothing but the action', 'It has no rifling'], answer: 1, why: 'Contact with the stock changes how the barrel vibrates shot to shot.' },
        ],
      },
      {
        id: 'how-a-shot-fires',
        title: 'How a shot fires, step by step',
        mins: 5,
        terms: ['Cartridge', 'Primer', 'Powder', 'Rifling', 'Muzzle velocity (MV)'],
        html: `
<div class="callout rule"><b>Rule:</b> Firing is a fixed sequence of events lasting a few thousandths of a second. Chemical energy in the powder becomes
gas pressure, gas pressure becomes bullet speed, and rifling turns that into a <b>spinning</b> projectile.</div>
<p>A <b>cartridge</b> (or "round") has four parts: the <b>case</b> (brass container), the <b>primer</b> (small explosive cap in the base),
the <b>powder</b> (propellant inside), and the <b>bullet</b> (the projectile in the front). Only the bullet leaves the rifle.</p>
<div data-widget="fire-sequence"></div>
<div class="callout analog"><b>Technical analog:</b> a state machine with no way back:
<code>IDLE → TRIGGER → PRIMER → BURN → ENGRAVE → MUZZLE → FLIGHT</code>. Variations in any state (a slightly different powder charge,
a different primer) change the <b>muzzle velocity</b> — the number that everything later in this course depends on.</div>
<div class="callout warn"><b>Exception:</b> "bullet" means only the projectile. Calling the whole cartridge a bullet is common, but in this course "bullet" always means the part that flies.</div>`,
        recap: ['Cartridge = case + primer + powder + bullet.', 'Trigger → primer → powder burns → pressure → bullet spins down the rifling → leaves at muzzle velocity.', 'Muzzle velocity is the key output of this sequence.'],
        quiz: [
          { q: 'What actually leaves the barrel and flies to the target?', options: ['The cartridge', 'The bullet', 'The case'], answer: 1, why: 'The case stays in the rifle and is ejected; only the bullet flies.' },
          { q: 'What makes the bullet spin?', options: ['The primer', 'The rifling in the barrel', 'The scope'], answer: 1, why: 'Spiral grooves (rifling) grip the bullet and twist it.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-terms',
    title: 'Terminology & units',
    goal: 'Speak the language: the units, words and abbreviations every later module uses.',
    lessons: [
      {
        id: 'units',
        title: 'The units shooters use',
        mins: 5,
        terms: ['Grain (gr)', 'fps', 'Yard', 'Foot-pound (ft·lb)', 'Twist rate'],
        html: `
<div class="callout rule"><b>Rule:</b> Shooting mixes imperial and metric units. Each quantity has one customary unit — learn the
unit <b>and its typical range</b>, so a wrong number looks wrong instantly.</div>
<table class="tbl text">
<thead><tr><th>Quantity</th><th>Unit</th><th>Typical values</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Bullet weight</td><td>grains (gr)</td><td>55 – 300 gr</td><td>7,000 gr = 1 lb; 1 gr ≈ 0.065 g</td></tr>
<tr><td>Velocity</td><td>feet per second (fps)</td><td>2,500 – 3,100 fps at the muzzle</td><td>Sound ≈ 1,120 fps</td></tr>
<tr><td>Distance</td><td>yards (yd) or meters (m)</td><td>100 – 1,500</td><td>1 yd = 0.9144 m — never mix them on one card</td></tr>
<tr><td>Size, drop</td><td>inches (in)</td><td>0 – 400 in of drop</td><td>Converted to angles (MIL) in module 08</td></tr>
<tr><td>Energy</td><td>foot-pounds (ft·lb)</td><td>1,000 – 5,000 at the muzzle (magnums at the top)</td><td>Matters for hunting and steel</td></tr>
<tr><td>Temperature</td><td>°F</td><td>0 – 110 °F</td><td>Affects air and powder</td></tr>
<tr><td>Air pressure</td><td>inches of mercury (inHg)</td><td>23 – 30 inHg</td><td>Lower at altitude</td></tr>
<tr><td>Twist rate</td><td>1:x inches</td><td>1:7 – 1:12</td><td>1:8 = one full turn of rifling every 8 inches</td></tr>
<tr><td>Aim adjustments</td><td>milliradians (MIL)</td><td>0 – 15 MIL</td><td>The angle unit of this whole app</td></tr>
</tbody></table>
<div class="callout analog"><b>Technical analog:</b> units are <b>types</b>. Adding yards to meters or using a G1 number in a G7 field (two different drag-rating scales, module 07) is a type error —
the math runs, the answer is silently wrong.</div>`,
        recap: ['Bullets in grains, speed in fps, distance in yards (or meters — not both).', 'Twist 1:8 = one turn per 8 inches.', 'Aim adjustments are angles in MIL.'],
        quiz: [
          { q: 'A bullet listed as "140 gr" weighs…', options: ['140 grams', '140 grains (about 9 g)', '140 ounces'], answer: 1, why: 'Grains: 7,000 per pound. 140 gr ≈ 9.1 g.' },
          { q: 'Twist rate 1:10 means…', options: ['10 turns per inch', 'One turn every 10 inches', '10 grooves'], answer: 1, why: 'Inches of barrel per full rotation.' },
        ],
      },
      {
        id: 'vocabulary',
        title: 'Core vocabulary',
        mins: 6,
        terms: ['POA / POI', 'Group', 'Zero', 'Dope', 'Hold / dial'],
        html: `
<div class="callout rule"><b>Rule:</b> Most shooting vocabulary falls into five buckets — <b>rifle, ammo, optics, ballistics, shooting</b>.
Learn the bucket first, then the word; the bucket tells you which module explains it.</div>
<table class="tbl text">
<thead><tr><th>Bucket</th><th>Words you'll meet</th></tr></thead>
<tbody>
<tr><td>Rifle</td><td>action, bolt, barrel, twist, chamber, crown, chassis, trigger, magazine</td></tr>
<tr><td>Ammo</td><td>cartridge, case, primer, powder, bullet, grain, lot, factory, handload</td></tr>
<tr><td>Optics</td><td>reticle, turret, click, MIL, zero, parallax, magnification, focal plane</td></tr>
<tr><td>Ballistics</td><td>muzzle velocity, drop, drift, BC, drag, time of flight, transonic, density altitude</td></tr>
<tr><td>Shooting</td><td>POA, POI, group, dope, hold, dial, wind call, spotter, natural point of aim</td></tr>
</tbody></table>
<h4>Five words to know today</h4>
<ul>
<li><b>Point of aim (POA)</b> — where the reticle was. <b>Point of impact (POI)</b> — where the bullet hit.</li>
<li><b>Group</b> — several shots fired at one aim point; its size measures precision.</li>
<li><b>Zero</b> — the distance at which POA = POI with no adjustment dialed (usually 100 yd).</li>
<li><b>Dope</b> — your recorded adjustments for each distance and condition.</li>
<li><b>Dial vs hold</b> — dial = turn the scope's turrets; hold = aim off using marks in the reticle.</li>
</ul>
<div data-widget="flashcards" data-deck="basics"></div>`,
        recap: ['Five buckets: rifle, ammo, optics, ballistics, shooting.', 'POA = aim, POI = impact; zero = the distance where they match.', 'Dial = turrets, hold = reticle marks.'],
        quiz: [
          { q: 'You aim at the center and the bullet hits 3" high. The 3" is the difference between…', options: ['POA and POI', 'MV and BC', 'Group and zero'], answer: 0, why: 'Point of aim vs point of impact.' },
          { q: '"Hold" means…', options: ['Turn the turret', 'Aim off using reticle marks', 'Hold your breath'], answer: 1, why: 'Holding uses the reticle; dialing uses the turrets.' },
        ],
      },
      {
        id: 'abbreviations',
        title: 'Abbreviations decoded',
        mins: 4,
        terms: ['MV', 'BC', 'SD', 'DA', 'TOF', 'FFP'],
        html: `
<div class="callout rule"><b>Rule:</b> Shooters compress everything into abbreviations. Decode them by asking "what quantity is this, and which bucket?"</div>
<table class="tbl text">
<thead><tr><th>Abbrev.</th><th>Meaning</th><th>Bucket</th></tr></thead>
<tbody>
<tr><td>MV</td><td>Muzzle velocity</td><td>Ballistics</td></tr>
<tr><td>BC (G1 / G7)</td><td>Ballistic coefficient — how well the bullet beats air drag</td><td>Ballistics</td></tr>
<tr><td>TOF</td><td>Time of flight</td><td>Ballistics</td></tr>
<tr><td>DA</td><td>Density altitude — how thick the air is</td><td>Ballistics</td></tr>
<tr><td>SD / ES</td><td>Standard deviation / extreme spread of velocity</td><td>Ammo</td></tr>
<tr><td>OTM / HPBT / FMJ</td><td>Open-tip match / hollow-point boat-tail / full metal jacket</td><td>Ammo</td></tr>
<tr><td>FFP / SFP</td><td>First / second focal plane reticle</td><td>Optics</td></tr>
<tr><td>MIL (mrad)</td><td>Milliradian — the angle unit</td><td>Optics</td></tr>
<tr><td>LRF</td><td>Laser rangefinder</td><td>Equipment</td></tr>
<tr><td>POA / POI</td><td>Point of aim / point of impact</td><td>Shooting</td></tr>
<tr><td>NPA</td><td>Natural point of aim</td><td>Shooting</td></tr>
<tr><td>PRS / NRL / ELR</td><td>Precision Rifle Series / National Rifle League / extreme long range</td><td>Disciplines</td></tr>
<tr><td>SAAMI / CIP</td><td>Bodies that standardise cartridge dimensions and pressures (US / Europe)</td><td>Ammo</td></tr>
</tbody></table>
<div data-widget="flashcards" data-deck="abbrev"></div>`,
        recap: ['Decode an abbreviation by its quantity and bucket.', 'MV, BC, TOF, DA are ballistics; SD/ES and OTM are ammo; FFP and MIL are optics.'],
        quiz: [
          { q: 'SD on an ammo box or chronograph refers to…', options: ['Scope distance', 'Standard deviation of velocity', 'Spin drift'], answer: 1, why: 'Velocity consistency; lower is better.' },
          { q: 'Which is an optics term?', options: ['FFP', 'OTM', 'DA'], answer: 0, why: 'First focal plane describes how the reticle scales.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-history',
    title: 'History: how we got here',
    goal: 'Understand why rifles and ammo look the way they do — each invention solved one bottleneck.',
    lessons: [
      {
        id: 'history-rifling',
        title: 'From smoothbore to rifling',
        mins: 5,
        terms: ['Smoothbore', 'Musket', 'Minié ball', 'Gyroscopic stability'],
        html: `
<div class="callout rule"><b>Rule:</b> The history of accuracy is a chain of bottlenecks. Each invention removed the biggest error of its time —
the same "fix the biggest error first" rule you learned in module 00.</div>
<div class="timeline">
  <div class="tl-item"><div class="tl-date">1500s–1850s</div><div><b>Smoothbore muskets.</b> A round ball in a smooth barrel tumbles unpredictably. Useful accuracy: roughly 50–100 yards. <i>Bottleneck: no spin.</i></div></div>
  <div class="tl-item"><div class="tl-date">1500s–1840s · specialist</div><div><b>Rifled barrels.</b> Spiral grooves spin the ball, stabilising it like a thrown football. Much more accurate — but a tight-fitting ball is slow to ram down the barrel, so rifles stayed a specialist tool. <i>Bottleneck: loading speed.</i></div></div>
  <div class="tl-item"><div class="tl-date">1849</div><div><b>The Minié ball.</b> A conical bullet small enough to drop down the barrel, with a hollow base that expands on firing to grip the rifling. Fast to load <i>and</i> spun. It made rifles standard issue by the 1850s–60s.</div></div>
</div>
<div class="callout analog"><b>Technical analog:</b> spin is a <b>gyroscope</b>. A spinning object resists being tipped over — that is why a rifled bullet flies point-first.
Module 07 turns this into a number (the stability factor, Sg).</div>`,
        recap: ['Smoothbores were inaccurate because the ball did not spin.', 'Rifling spins the bullet so it flies point-first (gyroscopic stability).', 'The Minié ball made rifling fast to load.'],
        quiz: [
          { q: 'Why was a smoothbore musket inaccurate?', options: ['Too much powder', 'The ball did not spin, so it flew unpredictably', 'No sights'], answer: 1, why: 'Without spin there is no gyroscopic stability.' },
          { q: 'What problem did the Minié ball solve?', options: ['Spin', 'Fast loading of a rifled barrel', 'Recoil'], answer: 1, why: 'It dropped in easily and expanded to grip the rifling on firing.' },
        ],
      },
      {
        id: 'history-smokeless',
        title: 'Smokeless powder, pointed bullets and bolt actions',
        mins: 5,
        terms: ['Smokeless powder', 'Spitzer', 'Boat tail', 'Bolt action', 'Drag tables'],
        html: `
<div class="callout rule"><b>Rule:</b> Between about 1880 and 1910 the modern rifle cartridge was born. Its shape — a brass case, smokeless powder,
a pointed jacketed bullet, a bolt action — is still what you shoot today.</div>
<div class="timeline">
  <div class="tl-item"><div class="tl-date">1884–1886</div><div><b>Smokeless powder</b> (France). Far more energy, little smoke and fouling. Velocities jump, trajectories flatten.</div></div>
  <div class="tl-item"><div class="tl-date">1898</div><div><b>The Mauser 98 bolt action</b> (Germany). Strong, controlled-feed, two front locking lugs. Countless modern bolt actions descend from its layout.</div></div>
  <div class="tl-item"><div class="tl-date">~1898–1905</div><div><b>Boat-tail and pointed "spitzer" bullets.</b> A pointed nose and tapered tail cut air drag dramatically, so bullets keep their speed far longer.</div></div>
  <div class="tl-item"><div class="tl-date">Late 1800s</div><div><b>Drag tables.</b> Military test commissions fired reference projectiles and tabulated their drag. The "G" in today's <b>G1</b> drag model refers to the French Gâvre commission.</div></div>
  <div class="tl-item"><div class="tl-date">1910s</div><div><b>Telescopic sights</b> on service rifles become widespread with organised sniping in World War I.</div></div>
</div>
<div class="callout analog"><b>Technical analog:</b> this was the era when ballistics became data-driven — measure a reference, then scale it.
That is exactly how BC and drag models still work (module 07).</div>`,
        recap: ['Smokeless powder brought high velocity.', 'Pointed, boat-tail bullets cut drag.', 'The bolt-action layout and drag tables from this era are still in use.'],
        quiz: [
          { q: 'What did pointed (spitzer) bullets improve?', options: ['Recoil', 'Air drag — they keep speed longer', 'Barrel life'], answer: 1, why: 'Lower drag = flatter trajectory and less wind drift.' },
          { q: 'The G1 drag model traces back to…', options: ['A 1990s computer program', 'Late-1800s military test firing', 'The Minié ball'], answer: 1, why: 'Reference projectiles were fired and tabulated by test commissions.' },
        ],
      },
      {
        id: 'history-modern',
        title: 'The modern precision era',
        mins: 5,
        terms: ['Mil-dot reticle', 'Ballistic solver', 'Doppler radar', 'PRS'],
        html: `
<div class="callout rule"><b>Rule:</b> Modern long-range shooting is <b>measurement + computation</b>. The rifle got better, but the biggest leap came from
measuring range, weather and velocity precisely and computing the solution. The dope card is the paper backup of that same model.</div>
<div class="timeline">
  <div class="tl-item"><div class="tl-date">1967</div><div>A US Marine sniper, Carlos Hathcock, made a confirmed hit at about 2,500 yards with a scoped M2 .50 BMG machine gun — a record that stood for decades.</div></div>
  <div class="tl-item"><div class="tl-date">1970s</div><div>The <b>mil-dot reticle</b>: marks spaced in milliradians for ranging and holds. The MIL becomes the language of precision.</div></div>
  <div class="tl-item"><div class="tl-date">Late 1980s</div><div>The <b>.338 Lapua Magnum</b>, designed for long-range military use.</div></div>
  <div class="tl-item"><div class="tl-date">1990s–2000s</div><div>Affordable <b>laser rangefinders</b> and handheld <b>weather meters</b> remove the guesswork from range and air density.</div></div>
  <div class="tl-item"><div class="tl-date">2000s</div><div><b>Ballistic solvers</b> on phones and meters; drag curves measured with <b>Doppler radar</b>; G7 BCs become standard for long bullets.</div></div>
  <div class="tl-item"><div class="tl-date">2007</div><div>The <b>6.5 Creedmoor</b> is introduced — a mild-recoiling, high-BC target cartridge that became a long-range staple.</div></div>
  <div class="tl-item"><div class="tl-date">2010s–today</div><div>Practical precision competitions like the <b>Precision Rifle Series (PRS)</b> and NRL; consumer Doppler chronographs and rangefinders with built-in solvers.</div></div>
</div>
<div class="callout try"><b>Verify:</b> the <a data-goto="range">Range</a> gives you the same tools a modern shooter has — rangefinder, weather meter, solver-built card. Turn them off in Realistic settings and see how much harder it gets.</div>`,
        recap: ['Modern accuracy = measuring range, weather, velocity + computing the solution.', 'The MIL reticle became the standard language.', 'Solvers, Doppler radar and rangefinders made first-round hits routine.'],
        quiz: [
          { q: 'What drove the biggest modern leap in long-range hit rates?', options: ['Heavier rifles', 'Measuring range/weather/velocity and computing solutions', 'Bigger bullets'], answer: 1, why: 'Measurement + computation removed the largest error sources.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-platforms',
    title: 'Weapon platforms',
    goal: 'Know the rifle types, what each part does, and which platform fits which discipline.',
    lessons: [
      {
        id: 'actions',
        title: 'Action types',
        mins: 5,
        terms: ['Bolt action', 'Semi-automatic', 'Single shot', 'Rimfire trainer'],
        html: `
<div class="callout rule"><b>Rule:</b> The action decides how a new cartridge gets into the chamber. For precision, <b>fewer moving parts during
the shot and a rigid lock</b> mean more consistency — which is why most precision rifles are bolt actions.</div>
<table class="tbl text">
<thead><tr><th>Action</th><th>How it cycles</th><th>Precision</th><th>Typical use</th></tr></thead>
<tbody>
<tr><td>Bolt action</td><td>You lift, pull, push and close the bolt by hand</td><td>Highest</td><td>PRS, F-Class, hunting, military/police precision</td></tr>
<tr><td>Semi-automatic (AR-15 / AR-10 style)</td><td>Gas from the fired round cycles the bolt automatically</td><td>Very good, slightly less consistent</td><td>Fast follow-up shots, designated marksman, 3-gun</td></tr>
<tr><td>Single shot</td><td>One round loaded by hand each time</td><td>Highest (benchrest)</td><td>Benchrest, some F-Class</td></tr>
<tr><td>Lever / pump</td><td>Lever or slide cycles the action</td><td>Moderate</td><td>Hunting at moderate range</td></tr>
</tbody></table>
<div class="callout tip"><b>Rimfire trainers:</b> a .22 LR bolt rifle set up like your centerfire rifle gives cheap, quiet practice of every skill in this course out to 100–300 yards.</div>
<div class="callout analog"><b>Technical analog:</b> a bolt action is a <b>locked, synchronous</b> operation — nothing moves until you move it. A semi-auto is
<b>event-driven</b>: the shot triggers the next cycle, which is faster but adds moving parts during the shot.</div>`,
        recap: ['Bolt actions dominate precision: rigid lock, nothing moves during the shot.', 'Semi-autos trade a little consistency for speed.', 'A rimfire trainer is the cheapest way to practise.'],
        quiz: [
          { q: 'Why are most precision rifles bolt actions?', options: ['Cheaper', 'Rigid lockup and no moving parts during the shot', 'Lighter'], answer: 1, why: 'Consistency is everything for precision.' },
        ],
      },
      {
        id: 'barrels',
        title: 'The barrel: rifling, twist, length, contour',
        mins: 6,
        terms: ['Lands & grooves', 'Chamber', 'Throat', 'Crown', 'Contour'],
        builds: 'Uses: rifling (00), twist rate (01)',
        html: `
<div class="callout rule"><b>Rule:</b> The barrel is the single biggest contributor to a rifle's precision. It must spin the bullet at the right rate,
release it identically every time, and stay consistent as it heats up.</div>
<table class="tbl text">
<thead><tr><th>Feature</th><th>What it is</th><th>Effect</th></tr></thead>
<tbody>
<tr><td>Lands & grooves</td><td>The raised ridges (lands) and channels (grooves) of the rifling</td><td>Grip and spin the bullet</td></tr>
<tr><td>Twist rate</td><td>Distance for one full rotation (1:8 etc.)</td><td>Must be fast enough for your bullet's length (module 07)</td></tr>
<tr><td>Chamber & throat</td><td>Where the cartridge sits, and the gap before the rifling</td><td>Cut to one exact cartridge</td></tr>
<tr><td>Length</td><td>Typically 20–28" for precision</td><td>Longer = more velocity (often ~15–35 fps per inch)</td></tr>
<tr><td>Contour (thickness)</td><td>Light "sporter" to heavy "varmint/MTU" profiles</td><td>Heavier = steadier and slower to heat</td></tr>
<tr><td>Crown</td><td>The finished edge at the muzzle</td><td>Damage here ruins accuracy</td></tr>
<tr><td>Threads</td><td>For a brake or suppressor</td><td>Recoil/noise control</td></tr>
</tbody></table>
<div class="callout warn"><b>Exception:</b> barrels wear out. Hot gas erodes the throat, slowly lowering velocity and precision. A barrel's "accuracy life" can be
just 1,500–5,000 rounds depending on the cartridge — more in module 05.</div>`,
        recap: ['Barrel = biggest precision factor.', 'Twist must match bullet length; length adds velocity; heavier contours stay consistent.', 'Barrels wear out from the throat forward.'],
        quiz: [
          { q: 'What do the lands of the rifling do?', options: ['Cool the barrel', 'Grip and spin the bullet', 'Hold the scope'], answer: 1, why: 'Lands engrave into the bullet’s bearing surface.' },
          { q: 'A longer barrel usually gives…', options: ['Lower velocity', 'Higher velocity', 'No change'], answer: 1, why: 'Powder gas pushes the bullet for longer.' },
        ],
      },
      {
        id: 'stocks-triggers',
        title: 'Stocks, chassis, triggers and magazines',
        mins: 5,
        terms: ['Chassis', 'Bedding', 'Length of pull', 'Cheek riser', 'ARCA rail'],
        html: `
<div class="callout rule"><b>Rule:</b> The stock's job is to hold the action rigidly and put <b>your eye directly behind the scope</b> the same way every shot.
Fit comes before features.</div>
<table class="tbl text">
<thead><tr><th>Component</th><th>Options</th><th>What to look for</th></tr></thead>
<tbody>
<tr><td>Stock</td><td>Wood, composite, or metal <b>chassis</b></td><td>Rigid, action bedded (precisely fitted, often with epoxy) or in an aluminium block</td></tr>
<tr><td>Adjustability</td><td>Length of pull (LOP), cheek riser height</td><td>Natural head position, eye centered behind the scope</td></tr>
<tr><td>Rails</td><td>ARCA (dovetail) and Picatinny</td><td>Mount bipods, tripods, bags quickly</td></tr>
<tr><td>Trigger</td><td>Single-stage or two-stage, adjustable weight</td><td>Clean break, ~1.5–3 lb, no creep</td></tr>
<tr><td>Magazine</td><td>Detachable box (often "AICS pattern")</td><td>Reliable feeding, spare mags</td></tr>
</tbody></table>
<div class="callout tip"><b>Fit check:</b> close your eyes, settle your cheek on the stock, open them. If you see a full, clear scope picture without moving your head, the stock fits.</div>`,
        recap: ['Stock/chassis: rigid hold + correct eye position.', 'Adjust length of pull and cheek height to fit you.', 'A clean, consistent trigger matters more than a very light one.'],
        quiz: [
          { q: 'The most important property of a stock for precision is…', options: ['Colour', 'Fit and rigidity — your eye lands behind the scope every time', 'Weight alone'], answer: 1, why: 'Consistency of position drives consistency of aim.' },
        ],
      },
      {
        id: 'platforms-by-use',
        title: 'Platforms by discipline',
        mins: 5,
        terms: ['PRS', 'NRL Hunter', 'F-Class', 'Benchrest', 'ELR'],
        html: `
<div class="callout rule"><b>Rule:</b> Every discipline optimises the same rifle system for a different constraint — weight, speed, position, or distance.
Pick the discipline first; it tells you the platform.</div>
<table class="tbl text">
<thead><tr><th>Discipline</th><th>Format</th><th>Typical rifle</th></tr></thead>
<tbody>
<tr><td>Hunting</td><td>One shot, often moving, carry all day</td><td>Light bolt action (7–10 lb), sporter barrel</td></tr>
<tr><td>PRS / NRL (centerfire)</td><td>Timed stages from props and barricades, 300–1,200 yd</td><td>Heavy chassis bolt gun (14–18 lb), 6 mm / 6.5 mm, brake</td></tr>
<tr><td>NRL Hunter</td><td>Field positions, rangefinding, carry-weight limits</td><td>Mid-weight hunting-style precision rifle</td></tr>
<tr><td>Rimfire (NRL22 / PRS Rimfire)</td><td>PRS-style stages, mostly 25–100 yd (some matches farther)</td><td>.22 LR bolt rifle in a chassis</td></tr>
<tr><td>F-Class</td><td>Prone, front rest + rear bag, 300–1,000 yd, scored rings</td><td>Very heavy, long barrel, high magnification</td></tr>
<tr><td>Benchrest</td><td>Smallest groups from a bench</td><td>Single-shot specialist rifles</td></tr>
<tr><td>ELR (extreme long range)</td><td>1,500 – 3,500+ yd</td><td>.375/.416-class magnums, 25+ lb</td></tr>
</tbody></table>
<div class="callout try"><b>Verify:</b> the <a data-goto="range">Range</a> "Stage" mode simulates a timed, multi-distance stage.</div>`,
        recap: ['Discipline → constraints → platform.', 'PRS/NRL: heavy chassis rifles, mild cartridges, brakes.', 'Rimfire versions train the same skills cheaply.'],
        quiz: [
          { q: 'Why are PRS rifles heavy (14–18 lb)?', options: ['Rules require it', 'Weight = stability and low recoil so you can spot hits', 'For carrying'], answer: 1, why: 'Heavy rifles move less and recoil less.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-ammo',
    title: 'Ammunition fundamentals',
    goal: 'Know every part of a cartridge, how it creates velocity, and how to read an ammo box.',
    lessons: [
      {
        id: 'cartridge-anatomy',
        title: 'Anatomy of a cartridge',
        mins: 6,
        terms: ['Case', 'Neck', 'Shoulder', 'Ogive', 'Bearing surface', 'Headstamp'],
        html: `
<div class="callout rule"><b>Rule:</b> A cartridge is a <b>single-use pressure vessel</b> with a projectile in the front. Every part is dimensioned so the
pressure — and therefore the velocity — is the same every shot.</div>
<div data-widget="cartridge-anatomy"></div>
<table class="tbl text">
<thead><tr><th>Part</th><th>Job</th></tr></thead>
<tbody>
<tr><td>Case (brass)</td><td>Holds everything; expands to seal the chamber when fired</td></tr>
<tr><td>Head & headstamp</td><td>The base; stamped with the cartridge name and maker. <b>Always match it to the barrel marking.</b></td></tr>
<tr><td>Rim / extractor groove</td><td>Lets the extractor pull the fired case out</td></tr>
<tr><td>Primer</td><td>Impact-sensitive cap that ignites the powder</td></tr>
<tr><td>Powder</td><td>Burns (does not explode) to create gas pressure</td></tr>
<tr><td>Shoulder & neck</td><td>Position the case in the chamber; the neck grips the bullet</td></tr>
<tr><td>Bullet</td><td>Base / boat tail, bearing surface (touches the rifling), ogive (curved nose), meplat (tip)</td></tr>
</tbody></table>
<div class="callout analog"><b>Technical analog:</b> a cartridge is a <b>config file</b> for the shot: case volume, powder charge, primer and bullet are the parameters;
muzzle velocity is the output. Change one parameter and the output changes.</div>`,
        recap: ['Case + primer + powder + bullet; the case seals the chamber.', 'Bullet parts: boat tail, bearing surface, ogive, meplat.', 'Headstamp must match the barrel marking.'],
        quiz: [
          { q: 'Which part of the bullet actually touches the rifling?', options: ['The ogive', 'The bearing surface', 'The meplat'], answer: 1, why: 'The parallel-sided bearing surface is engraved by the lands.' },
          { q: 'Where do you check the cartridge name before loading?', options: ['The bullet tip', 'The headstamp on the case base', 'The primer colour'], answer: 1, why: 'Headstamp vs barrel marking — every time.' },
        ],
      },
      {
        id: 'powder-primers',
        title: 'Powder, primers and pressure',
        mins: 5,
        terms: ['Burn rate', 'Chamber pressure', 'Temperature sensitivity', 'Handloading'],
        html: `
<div class="callout rule"><b>Rule:</b> Velocity comes from <b>pressure × time</b> as the bullet travels down the barrel. Powder is chosen so the pressure peaks
safely and keeps pushing — the right <b>burn rate</b> for the case size and bullet weight.</div>
<table class="tbl text">
<thead><tr><th>Variable</th><th>Effect</th></tr></thead>
<tbody>
<tr><td>Powder charge</td><td>More powder → more pressure and velocity (up to a safe maximum)</td></tr>
<tr><td>Burn rate</td><td>Fast powders suit small cases/light bullets; slow powders suit big cases/heavy bullets</td></tr>
<tr><td>Powder shape</td><td>Extruded "stick", spherical "ball", or flake — affects metering and temperature behaviour</td></tr>
<tr><td>Temperature</td><td>Warm powder burns faster → higher velocity (temperature sensitivity)</td></tr>
<tr><td>Primer</td><td>Small or large; "magnum" primers burn hotter for big powder charges</td></tr>
</tbody></table>
<p>Typical rifle cartridges operate around <b>60,000 psi</b>. Standards bodies (SAAMI in the US, CIP in Europe) publish maximum pressures for each cartridge.</p>
<div class="callout warn"><b>Exception & safety:</b> handloading (assembling your own ammo) can produce the most consistent ammunition, but it is an
advanced skill. Only ever use published load data from reputable manuals, start low, and never mix up powders or primers.</div>`,
        recap: ['Velocity = pressure acting over time in the barrel.', 'Warm powder → more velocity (temperature sensitivity).', 'Respect published maximum pressures; handloading is advanced.'],
        quiz: [
          { q: 'Ammo left in the hot sun will usually shoot…', options: ['Slower', 'Faster (higher velocity)', 'Exactly the same'], answer: 1, why: 'Warm powder burns faster, raising pressure and velocity.' },
        ],
      },
      {
        id: 'reading-the-box',
        title: 'Reading an ammo box',
        mins: 4,
        terms: ['Lot number', 'Test barrel', 'Factory ammo', 'Match ammo'],
        html: `
<div class="callout rule"><b>Rule:</b> An ammo box is a spec sheet. Read it for <b>what</b> it is (cartridge, bullet) and treat the performance numbers
(MV, BC) as a <b>starting point</b> — you will measure your own.</div>
<pre class="code">┌──────────────────────────────────────────────┐
│  6.5 CREEDMOOR            ← cartridge (must match barrel)
│  140 gr  OTM MATCH        ← bullet weight + type
│  BC  G1 0.6xx  G7 0.3xx   ← drag rating (use the G7)
│  MV  2,700 fps (24")      ← velocity in THEIR test barrel
│  LOT  A1234               ← production batch
└──────────────────────────────────────────────┘</pre>
<table class="tbl text">
<thead><tr><th>Field</th><th>How to use it</th></tr></thead>
<tbody>
<tr><td>Cartridge</td><td>Must match your barrel exactly</td></tr>
<tr><td>Bullet weight & type</td><td>Match / OTM for precision; check your twist can stabilise it</td></tr>
<tr><td>BC</td><td>Use the G7 value for long boat-tail bullets</td></tr>
<tr><td>MV + test barrel</td><td>Your barrel length and chamber give a different MV — chronograph it (measure it with a velocity-measuring device)</td></tr>
<tr><td>Lot number</td><td>Buy one lot in bulk; re-check MV when the lot changes</td></tr>
</tbody></table>`,
        recap: ['Box = spec sheet; MV and BC are starting points.', 'Use G7 BC for modern match bullets.', 'Stick to one lot and re-measure when it changes.'],
        quiz: [
          { q: 'The MV printed on the box is…', options: ['Exactly what your rifle will do', 'What their test barrel did — measure your own', 'The bullet’s top speed at 1,000 yd'], answer: 1, why: 'Barrel length, chamber and conditions all change MV.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-types',
    title: 'Ammo & bullet types',
    goal: 'Tell ammunition types apart, pick the right one for the job, and know what makes ammo consistent.',
    lessons: [
      {
        id: 'rimfire-centerfire',
        title: 'Rimfire vs centerfire',
        mins: 4,
        terms: ['Rimfire', 'Centerfire', '.22 LR', 'Subsonic'],
        html: `
<div class="callout rule"><b>Rule:</b> The difference is <b>where the primer is</b>. Rimfire puts priming compound inside the hollow rim; centerfire uses a
replaceable primer in the center of the base. That one design choice decides cost, power and reloadability.</div>
<table class="tbl text">
<thead><tr><th></th><th>Rimfire (.22 LR)</th><th>Centerfire (6.5 CM, .308…)</th></tr></thead>
<tbody>
<tr><td>Primer</td><td>Compound in the rim</td><td>Separate primer cup in the center</td></tr>
<tr><td>Pressure / power</td><td>Low</td><td>High</td></tr>
<tr><td>Cost per shot</td><td>Very low</td><td>High</td></tr>
<tr><td>Reloadable</td><td>No</td><td>Yes</td></tr>
<tr><td>Practical range</td><td>~25–300 yd</td><td>300–1,500+ yd</td></tr>
<tr><td>Best for</td><td>Training fundamentals, wind reading</td><td>Long-range precision</td></tr>
</tbody></table>
<div class="callout warn"><b>Exception:</b> .22 LR leaves the muzzle near the speed of sound (~1,050–1,250 fps). Subsonic and high-velocity .22 behave differently,
and supersonic rounds go transonic (slow into the unsteady zone around the speed of sound, module 07) almost immediately — one reason .22 drifts so much in wind.</div>`,
        recap: ['Rimfire: primer in the rim, cheap, low power, not reloadable.', 'Centerfire: central primer, powerful, reloadable.', '.22 LR is the best-value trainer.'],
        quiz: [
          { q: 'Where is the primer in a centerfire cartridge?', options: ['In the rim', 'In the center of the base', 'In the bullet'], answer: 1, why: 'Hence "centerfire".' },
        ],
      },
      { ref: 'bullets', terms: ['OTM / HPBT', 'Secant / tangent ogive', 'Hybrid', 'Monolithic', 'Boat tail'] },
      {
        id: 'ammo-purpose',
        title: 'Ammunition by purpose',
        mins: 4,
        terms: ['Match', 'Hunting', 'Practice (FMJ)', 'Subsonic', 'Frangible'],
        html: `
<div class="callout rule"><b>Rule:</b> Every load is designed around one priority: <b>consistency</b> (match), <b>terminal effect</b> (hunting),
<b>cost</b> (practice), <b>noise</b> (subsonic) or <b>safety around steel</b> (frangible). Choose by the job, not the price tag alone.</div>
<table class="tbl text">
<thead><tr><th>Type</th><th>Design priority</th><th>Use it for</th></tr></thead>
<tbody>
<tr><td>Match</td><td>Shot-to-shot consistency, high BC</td><td>Precision, competition, making your dope card</td></tr>
<tr><td>Hunting</td><td>Controlled expansion, weight retention</td><td>Ethical hunting (check expansion velocity at your max range)</td></tr>
<tr><td>Practice / FMJ</td><td>Low cost</td><td>Drills where precision matters less</td></tr>
<tr><td>Subsonic</td><td>Below the speed of sound — quiet with a suppressor</td><td>Short range; very curved trajectory</td></tr>
<tr><td>Frangible</td><td>Breaks up on hard surfaces</td><td>Close-range steel and training facilities</td></tr>
</tbody></table>
<div class="callout warn"><b>Exception:</b> your dope card is only valid for the load it was made with. A different bullet, weight or even lot needs its own data.</div>`,
        recap: ['Match = consistency; hunting = terminal effect; FMJ = cost.', 'A dope card belongs to one specific load.'],
        quiz: [
          { q: 'You make a dope card with match ammo, then shoot cheap FMJ. The card is…', options: ['Still exact', 'Not valid — different load, different data', 'More accurate'], answer: 1, why: 'Different bullet and velocity = different trajectory.' },
        ],
      },
      { ref: 'consistency', terms: ['SD', 'ES', 'Lot', 'Vertical dispersion'] },
      { ref: 'powder-barrel', terms: ['Temperature sensitivity', 'Throat erosion', 'Barrel life'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-calibers',
    title: 'Calibers & cartridges',
    goal: 'Decode cartridge names, understand cartridge families, and choose a first precision cartridge.',
    lessons: [
      {
        id: 'naming',
        title: 'Caliber vs cartridge: decoding the names',
        mins: 6,
        terms: ['Caliber', 'Cartridge', 'Bore diameter', 'SAAMI / CIP'],
        html: `
<div class="callout rule"><b>Rule:</b> <b>Caliber</b> is the bullet's diameter. A <b>cartridge</b> is the complete round design (case shape, length, pressure).
Many cartridges share one caliber — and the name often <i>doesn't</i> state the true bullet diameter.</div>
<table class="tbl text">
<thead><tr><th>Name</th><th>True bullet diameter</th><th>How to read the name</th></tr></thead>
<tbody>
<tr><td>.223 Remington</td><td>.224"</td><td>Imperial name, rounded</td></tr>
<tr><td>6mm Creedmoor</td><td>.243"</td><td>6 mm bullet</td></tr>
<tr><td>6.5 Creedmoor / 6.5 PRC</td><td>.264"</td><td>6.5 mm bullet; PRC = Precision Rifle Cartridge</td></tr>
<tr><td>.308 Winchester</td><td>.308"</td><td>Bullet diameter + maker</td></tr>
<tr><td>7.62×51 NATO</td><td>.308"</td><td>Metric: 7.62 mm bore × 51 mm case length</td></tr>
<tr><td>.30-06 Springfield</td><td>.308"</td><td>.30 caliber, adopted 1906</td></tr>
<tr><td>.300 Win Mag / .300 PRC</td><td>.308"</td><td>".300" family name, Magnum case</td></tr>
<tr><td>.338 Lapua Magnum</td><td>.338"</td><td>Diameter + designer</td></tr>
</tbody></table>
<div class="callout warn"><b>Exception — similar is not identical:</b> .223 Rem vs 5.56 NATO and .308 Win vs 7.62×51 share dimensions but differ in chamber
specs and pressure. Only fire what your barrel is marked for. <b>Headstamp = barrel marking, every time.</b></div>
<div class="callout analog"><b>Technical analog:</b> caliber is an <b>interface</b> (the bullet diameter); the cartridge is the <b>implementation</b>. Many implementations
(.308 Win, .30-06, .300 PRC) share the .308" interface but are not interchangeable.</div>`,
        recap: ['Caliber = bullet diameter; cartridge = complete design.', 'Names can mislead (.223 uses .224" bullets).', 'Similar cartridges are not interchangeable — match the headstamp to the barrel.'],
        quiz: [
          { q: 'Which cartridges use the same .308" bullet diameter?', options: ['.308 Win, .30-06, .300 Win Mag', '.223 and .308', '6.5 CM and .308'], answer: 0, why: 'All are ".30 caliber" family members.' },
          { q: 'Can you safely fire any cartridge with the same bullet diameter in your rifle?', options: ['Yes', 'No — the whole cartridge must match the chamber', 'Only if it fits'], answer: 1, why: 'Chamber dimensions and pressure differ between cartridges.' },
        ],
      },
      {
        id: 'families',
        title: 'Cartridge families and trade-offs',
        mins: 5,
        terms: ['Parent case', 'Necked down', 'Case capacity', 'Overbore'],
        html: `
<div class="callout rule"><b>Rule:</b> Most cartridges are derived from a <b>parent case</b> — necked down or up to a different bullet diameter. Three numbers
then decide behaviour: <b>case capacity</b> (powder), <b>bore diameter</b>, and <b>bullet weight</b>.</div>
<pre class="code">.308 Winchester ──┬─▶ .243 Win (6 mm)
                  ├─▶ .260 Rem (6.5 mm)
                  └─▶ 7mm-08
6.5 Creedmoor ───────▶ 6mm Creedmoor (necked down)
.416 Rigby ──────────▶ .338 Lapua Magnum
6mm BR ──────────────▶ 6mm Dasher (improved)</pre>
<table class="tbl text">
<thead><tr><th>Change</th><th>Gain</th><th>Cost</th></tr></thead>
<tbody>
<tr><td>More case capacity</td><td>More velocity → flatter, less wind drift</td><td>More recoil, shorter barrel life</td></tr>
<tr><td>Smaller bore, same case ("overbore")</td><td>Higher velocity, less recoil</td><td>Much shorter barrel life</td></tr>
<tr><td>Heavier, longer bullet</td><td>Higher BC, less wind drift</td><td>Needs faster twist, more recoil</td></tr>
</tbody></table>`,
        recap: ['Cartridges descend from parent cases.', 'Capacity, bore and bullet weight set velocity, recoil and barrel life.', 'Overbore = fast and soft-recoiling but hard on barrels.'],
        quiz: [
          { q: 'Necking a large case down to a small bullet usually gives…', options: ['Long barrel life', 'High velocity but shorter barrel life', 'Lower velocity'], answer: 1, why: 'Lots of powder through a small bore erodes the throat faster.' },
        ],
      },
      { ref: 'cartridges', terms: ['Recoil', 'Transonic range', 'Barrel life'] },
      {
        id: 'first-cartridge',
        title: 'Choosing your first precision cartridge',
        mins: 4,
        terms: ['Trainer', 'Match ammo availability'],
        html: `
<div class="callout rule"><b>Rule:</b> For learning, choose the cartridge that lets you <b>shoot the most, see your hits, and buy consistent ammo</b> —
not the one with the most energy. Skill grows with rounds fired.</div>
<pre class="code">Goal?
├─ Learn fundamentals cheaply ............ .22 LR bolt trainer (+ any below)
├─ Long-range target / PRS ............... 6.5 Creedmoor  (or 6mm Creedmoor)
├─ Cheap ammo, long barrel life .......... .308 Winchester
└─ Hunting big game far + targets ........ 6.5 PRC / .300 Win Mag (more recoil)</pre>
<table class="tbl text">
<thead><tr><th>Criterion</th><th>Why it matters to a beginner</th></tr></thead>
<tbody>
<tr><td>Low recoil</td><td>Better shooting habits; you see your own impacts</td></tr>
<tr><td>Match ammo availability</td><td>Consistent factory ammo = good data without handloading</td></tr>
<tr><td>Barrel life</td><td>More practice before a rebarrel</td></tr>
<tr><td>Cost per round</td><td>More rounds = more learning</td></tr>
</tbody></table>
<div class="callout try"><b>Verify:</b> load each system on <a data-goto="build">Build Card</a> and compare the 1,000 yd wind hold and transonic range (the distance where the bullet slows to near the speed of sound).</div>`,
        recap: ['Pick for practice volume, low recoil and consistent ammo.', '.22 LR trainer + 6.5 Creedmoor or .308 is a classic path.'],
        quiz: [
          { q: 'Best first priority for a learning cartridge?', options: ['Maximum energy', 'Low recoil and affordable, consistent ammo', 'Longest name'], answer: 1, why: 'Skill comes from many well-observed shots.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-ballistics',
    title: 'Ballistics',
    goal: 'Understand what happens to the bullet in flight — the physics your dope card encodes.',
    lessons: [
      { ref: 'what-is-dope', title: 'The three ballistics and the dope card idea', terms: ['Internal / external / terminal ballistics', 'Dope card', 'Solver'],
        recap: ['Internal ballistics sets MV; external ballistics is the flight; terminal is the impact.', 'A dope card precomputes external ballistics.'] },
      { ref: 'gravity-tof', terms: ['Time of flight', 'Line of sight', 'Bore line', 'Sight height'],
        recap: ['Drop depends on time of flight.', 'The bullet crosses the line of sight at the zero range.'] },
      { ref: 'drag-bc', terms: ['Drag', 'Mach', 'BC', 'G1 / G7'],
        recap: ['BC scales a reference drag curve; higher BC = less slowing.', 'Use G7 for modern boat-tail bullets.'] },
      { ref: 'transonic', terms: ['Speed of sound', 'Transonic', 'Subsonic'],
        recap: ['Below ~Mach 1.2 predictions degrade.', 'Mark the transonic range on your card.'] },
      { ref: 'atmosphere', terms: ['Density altitude', 'Station pressure'],
        recap: ['Thinner air = less drag = less drop.', 'Use station pressure, not sea-level corrected.'] },
      { ref: 'wind', terms: ['Crosswind', 'Lag time', 'Full value', 'Clock system'],
        recap: ['Drift ∝ crosswind × lag time.', 'Wind value = |sin(clock × 30°)|.'] },
      { ref: 'stability', terms: ['Stability factor (Sg)', 'Miller formula'],
        recap: ['Sg > 1.4 is the target; length drives the twist you need.'] },
      { ref: 'small-effects', terms: ['Spin drift', 'Coriolis', 'Aerodynamic jump'],
        recap: ['Three small effects worth a few tenths of a mil at 1,000 yd.'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-optics',
    title: 'Optics & the MIL',
    goal: 'Use a scope as a measuring instrument: angles, reticles, turrets, ranging and setup.',
    lessons: [
      { ref: 'mil-moa', terms: ['Milliradian (MIL)', 'Click', 'Subtension'], recap: ['1 mil = 3.6" at 100 yd; one click = 0.1 mil.', 'Never mix units.'] },
      { ref: 'reticles', terms: ['FFP', 'SFP', 'Reticle'], recap: ['FFP holds are valid at any magnification.', 'Dial elevation, hold wind.'] },
      { ref: 'turrets', terms: ['Turret', 'Revolution', 'Zero stop', 'Tracking'], recap: ['Know which revolution you are on.', 'Verify tracking with a tall target test.'] },
      { ref: 'mil-ranging', terms: ['Mil relation', 'Ranging'], recap: ['Range (yd) = size (in) × 27.78 ÷ mils.'] },
      { ref: 'scope-setup', terms: ['Cant', 'Parallax', 'Eye relief'], recap: ['Level the reticle, remove parallax, check your bubble.'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-equipment',
    title: 'Equipment',
    goal: 'Know what gear you need, in what order, and what each tool measures.',
    lessons: [
      {
        id: 'kit-priorities',
        title: 'Building a kit: what to get first',
        mins: 5,
        terms: ['Tier', 'Torque wrench', 'Data book'],
        html: `
<div class="callout rule"><b>Rule:</b> Buy in the order that removes the <b>largest error</b> first — the same error-budget rule from module 00.
Safety gear, then a reliable rifle + scope, then measurement, then comfort.</div>
<table class="tbl text">
<thead><tr><th>Tier</th><th>Items</th><th>Why</th></tr></thead>
<tbody>
<tr><td>0 · Safety</td><td>Eye protection, ear protection, chamber flag</td><td>Non-negotiable</td></tr>
<tr><td>1 · Core</td><td>Rifle, scope with reliable tracking, quality mounts, torque wrench</td><td>The scope must hold zero and dial accurately</td></tr>
<tr><td>2 · Support</td><td>Bipod, rear bag, bubble level</td><td>Stability and cant control</td></tr>
<tr><td>3 · Measurement</td><td>Chronograph, rangefinder, ballistic app</td><td>Real data instead of guesses</td></tr>
<tr><td>4 · Refinement</td><td>Weather meter, barricade bags, tripod, suppressor/brake</td><td>Field and competition performance</td></tr>
<tr><td>Always</td><td>Data book, cleaning kit, consistent match ammo</td><td>Learning from every shot</td></tr>
</tbody></table>
<div class="callout tip"><b>Spend on the scope.</b> A precise rifle under a scope that doesn't track is a guessing machine. A modest rifle under a reliable scope is a learning tool.</div>`,
        recap: ['Safety → core → support → measurement → refinement.', 'A scope that tracks reliably is the best investment.'],
        quiz: [
          { q: 'After safety gear, the highest-value purchase is…', options: ['A fancy stock', 'A scope that tracks and holds zero', 'A carbon barrel'], answer: 1, why: 'Every adjustment you make relies on it.' },
        ],
      },
      { ref: 'optics-gear', terms: ['Magnification', 'Tube size', 'Mount'] },
      { ref: 'measure', terms: ['Chronograph', 'Rangefinder', 'Weather meter'] },
      { ref: 'support', terms: ['Bipod', 'Rear bag', 'Tripod'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-positions',
    title: 'Shooting positions & fundamentals',
    goal: 'Build stable positions and a repeatable shot process — removing the shooter error.',
    lessons: [
      {
        id: 'positions',
        title: 'The stability ladder',
        mins: 5,
        terms: ['Prone', 'Bench', 'Barricade', 'Kneeling', 'Standing'],
        html: `
<div class="callout rule"><b>Rule:</b> Stability comes from <b>bone and ground contact</b>, not muscle. The lower and more supported the position, the smaller
your wobble — and the smaller the target you can hit reliably.</div>
<table class="tbl text">
<thead><tr><th>Position</th><th>Support</th><th>Typical wobble*</th><th>Use</th></tr></thead>
<tbody>
<tr><td>Bench / sandbags</td><td>Rifle fully rested</td><td>~0.04 mil</td><td>Zeroing, load testing</td></tr>
<tr><td>Prone · bipod + rear bag</td><td>Body on ground, both ends supported</td><td>~0.1 mil</td><td>Default long-range position</td></tr>
<tr><td>Prone · bipod only</td><td>Rear held by hand/shoulder</td><td>~0.2 mil</td><td>Field, fast setup</td></tr>
<tr><td>Barricade</td><td>Rifle on a prop with a bag</td><td>~0.4 mil</td><td>PRS stages, field</td></tr>
<tr><td>Kneeling · tripod</td><td>Partial body support</td><td>~0.75 mil</td><td>Over vegetation</td></tr>
<tr><td>Standing · tripod</td><td>Minimal body support</td><td>~1.3 mil</td><td>Last resort</td></tr>
</tbody></table>
<p class="hint">*Wobble values used by this app's Range simulator. A 12" plate at 800 yd is only 0.42 mil wide.</p>
<div class="callout analog"><b>Technical analog:</b> wobble is <b>noise</b> on your aim signal. A lower position is a better low-pass filter.</div>
<div class="callout try"><b>Verify:</b> change "Position" in the <a data-goto="range">Range</a> Setup and watch the reticle sway change.</div>`,
        recap: ['Bone + ground contact = stability.', 'Prone with bipod and rear bag is the default long-range position.', 'Your wobble must be smaller than the target.'],
        quiz: [
          { q: 'A 12" plate at 800 yd is about 0.42 mil. Which positions can hit it reliably?', options: ['Standing only', 'Prone (and bench) — wobble well under the plate size', 'Kneeling'], answer: 1, why: 'Prone wobble (~0.1–0.2 mil) fits inside 0.42 mil; kneeling (~0.75) does not.' },
        ],
      },
      {
        id: 'prone',
        title: 'Building a prone position',
        mins: 5,
        terms: ['Natural point of aim (NPA)', 'Bipod loading', 'Cheek weld'],
        html: `
<div class="callout rule"><b>Rule:</b> Build the position so the rifle points at the target <b>when you are relaxed</b> — your natural point of aim.
If you have to push the rifle onto the target, it will move back when the shot breaks.</div>
<ol class="steps">
<li><b>Align:</b> lie behind the rifle, body roughly in line with the bore (slightly angled is fine), so recoil comes straight back.</li>
<li><b>Load the bipod:</b> lean gently forward into it so the legs take a consistent pre-load.</li>
<li><b>Rear support:</b> place the rear bag under the toe of the stock; squeeze it to fine-tune elevation.</li>
<li><b>Head:</b> rest your cheek naturally on the stock — same spot every time (cheek weld), full scope picture.</li>
<li><b>Hands:</b> firing hand relaxed on the grip; support hand on the rear bag, not gripping the rifle.</li>
<li><b>Check NPA:</b> close your eyes, breathe, relax, open. If the reticle drifted off target, move your body, not your arms.</li>
</ol>
<div class="callout tip">A position you can rebuild identically in seconds beats a perfect position you can't repeat.</div>`,
        recap: ['Align straight behind the rifle; pre-load the bipod.', 'Rear bag for fine elevation; consistent cheek weld.', 'Check and adjust natural point of aim with your body.'],
        quiz: [
          { q: 'Your reticle drifts left every time you relax. You should…', options: ['Hold it right with your arms', 'Shift your body until the relaxed reticle sits on target', 'Ignore it'], answer: 1, why: 'Fix the natural point of aim; muscles tire and the rifle returns to NPA on recoil.' },
        ],
      },
      { ref: 'shot-process', terms: ['Breathing', 'Trigger press', 'Follow-through'] },
      {
        id: 'recoil-follow',
        title: 'Recoil, follow-through and calling the shot',
        mins: 4,
        terms: ['Follow-through', 'Calling the shot', 'Self-spotting'],
        html: `
<div class="callout rule"><b>Rule:</b> The shot isn't over when the trigger breaks. Keep the position, the trigger pressed and your eye in the scope until
you see the impact. What you saw at the break is your <b>call</b>; the impact is the <b>data</b>.</div>
<table class="tbl text">
<thead><tr><th>Skill</th><th>How</th><th>Pay-off</th></tr></thead>
<tbody>
<tr><td>Recoil management</td><td>Body straight behind the rifle, firm shoulder contact, relaxed grip</td><td>Rifle comes straight back and returns on target</td></tr>
<tr><td>Follow-through</td><td>Hold the trigger back, stay in the scope</td><td>No movement while the bullet is still in the barrel</td></tr>
<tr><td>Calling the shot</td><td>Note where the reticle was at the break</td><td>Separates your error from the data's error</td></tr>
<tr><td>Self-spotting</td><td>Watch for the splash or hit through the scope</td><td>You can correct without a spotter</td></tr>
</tbody></table>
<pre class="code">call = "broke slightly right"   impact = "0.2 right"
→ the data was fine; the miss was the shooter. Do NOT correct the dial.</pre>`,
        recap: ['Stay on the rifle through the shot.', 'Your call vs the impact tells you whether to blame yourself or the data.', 'Low recoil + good position = self-spotting.'],
        quiz: [
          { q: 'You called the shot "pulled left" and it hit 0.3 left. You should…', options: ['Dial 0.3 right', 'Not correct — the data was fine, the shot was pulled', 'Re-zero'], answer: 1, why: 'The call explains the miss; correcting would make the next good shot miss.' },
        ],
      },
    ],
  },
  // =====================================================================
  {
    id: 'm-cards',
    title: 'Writing a dope card',
    goal: 'Turn everything so far into a card you can trust — then verify and maintain it.',
    lessons: [
      { ref: 'workflow', terms: ['Chronograph', 'Zero', 'Truing'] },
      { ref: 'anatomy', terms: ['Header', 'Elevation column', 'Wind brackets'] },
      { ref: 'wind-formats', terms: ['Bracket', 'Reference wind'] },
      { ref: 'truing', terms: ['MV truing', 'Drop scale factor'] },
      { ref: 'conditions', terms: ['DA band', 'Cosine', 'Cold bore'] },
      { ref: 'card-formats', terms: ['Wrist coach', 'Data book'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-field',
    title: 'Field craft',
    goal: 'Read the wind, correct from impacts, run timed stages, and avoid the classic mistakes.',
    lessons: [
      { ref: 'read-wind', terms: ['Mirage', 'Switch', 'Bracket'] },
      { ref: 'corrections', terms: ['Correction', 'Spotter call'] },
      { ref: 'stages', terms: ['Stage card', 'Par time'] },
      { ref: 'mistakes', terms: ['Revolution error', 'Checklist'] },
    ],
  },
  // =====================================================================
  {
    id: 'm-glossary',
    title: 'Glossary',
    goal: 'Look up any term from the course.',
    reference: true,
    lessons: [{ ref: 'terms', title: 'Terms A–Z' }],
  },
];

window.LRPS_DECKS = {
  basics: [
    ['Point of aim (POA)', 'Where the reticle was when the shot broke.'],
    ['Point of impact (POI)', 'Where the bullet actually hit.'],
    ['Group', 'Several shots at one aim point; its size measures precision.'],
    ['Zero', 'The distance where POA equals POI with nothing dialed.'],
    ['Dope', 'Your recorded adjustments for each distance and condition.'],
    ['Dial', 'Turning the scope turrets to move the point of impact.'],
    ['Hold', 'Aiming off using marks in the reticle instead of dialing.'],
    ['Muzzle velocity', 'Bullet speed as it leaves the barrel (fps).'],
    ['Drop', 'How far the bullet falls below the line of sight.'],
    ['Drift', 'How far the wind pushes the bullet sideways.'],
    ['Reticle', 'The aiming pattern inside the scope.'],
    ['Turret', 'The knob on the scope that adjusts elevation or windage.'],
  ],
  abbrev: [
    ['MV', 'Muzzle velocity'],
    ['BC', 'Ballistic coefficient'],
    ['TOF', 'Time of flight'],
    ['DA', 'Density altitude'],
    ['SD', 'Standard deviation (of velocity)'],
    ['ES', 'Extreme spread (of velocity)'],
    ['OTM', 'Open-tip match bullet'],
    ['FMJ', 'Full metal jacket'],
    ['FFP', 'First focal plane'],
    ['LRF', 'Laser rangefinder'],
    ['NPA', 'Natural point of aim'],
    ['PRS', 'Precision Rifle Series'],
  ],
};

// Extra glossary terms introduced by the beginner modules
window.LRPS_GLOSSARY_EXTRA = [
  ['Action', 'The core of the rifle that holds the bolt and locks the cartridge; barrel and stock attach to it.'],
  ['Backstop / berm', 'Earth bank behind targets that safely stops every bullet.'],
  ['Bearing surface', 'The straight-sided part of the bullet that touches the rifling.'],
  ['Bolt action', 'Action cycled by hand with a bolt; the standard for precision.'],
  ['Caliber', 'Bullet (bore) diameter, e.g. .308" or 6.5 mm.'],
  ['Cartridge', 'A complete round: case, primer, powder and bullet.'],
  ['Centerfire / rimfire', 'Primer in the center of the base / priming compound in the rim.'],
  ['Chamber flag', 'Bright insert showing the chamber is empty.'],
  ['Chassis', 'Metal stock system that holds the action rigidly, usually adjustable.'],
  ['Cold range', 'No shooting; actions open; people may be downrange.'],
  ['Crown', 'Finished edge of the barrel at the muzzle.'],
  ['Grain (gr)', 'Unit of weight: 7,000 grains = 1 pound.'],
  ['Group', 'Several shots at one aim point; its size measures precision.'],
  ['Headstamp', 'Markings on the case base naming the cartridge and maker.'],
  ['Lands and grooves', 'Raised ridges and channels of the rifling.'],
  ['Lot number', 'Production batch of ammunition.'],
  ['Minié ball', '1849 conical bullet with an expanding base that made rifled muskets practical.'],
  ['POA / POI', 'Point of aim / point of impact.'],
  ['Primer', 'Impact-sensitive cap that ignites the powder.'],
  ['Spitzer', 'Pointed bullet nose shape that reduces drag.'],
];
