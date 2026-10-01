# Game Design Document — CHROMOGOTCHI

Living document. Each section is filled in as its planning step is agreed.
Status legend: ✅ locked · 🟡 in discussion · ⬜ not started

## Planning roadmap

| # | Step | Status |
|---|------|--------|
| 1 | Vision & pillars | ✅ |
| 2 | Scope decision: MVP = classic Tamagotchi loop | ✅ |
| 3 | Acquisition & hatching (pods, rarity) | ✅ |
| 4 | The creature: genome & procedural generation | ✅ |
| 5 | Care loop, needs, life stages, death | ✅ |
| 6 | Tech architecture & libraries | ✅ |
| 7 | Art / audio / UI style guide | ✅ |
| 8 | MVP milestones | ✅ |

---

## 1. Vision & pillars ✅

**Pitch:** You raise an ordinary living pet in a rotten cyberpunk city. Over its
life you choose whether to keep it flesh or rebuild it with biotech, black-market
chrome and AI chips. The more machine it becomes, the stronger it gets — and the
less it's *yours*.

**Pillars** (long-term vision — see §2 for what the MVP actually builds)
1. **Flesh vs. chrome is the core choice.** Every upgrade moves the pet along an
   organic ↔ machine axis. Machine = power + free will (disobedience, drift toward
   a cyberpsychosis-like breakdown). Organic = loyalty, stability, lower ceiling.
2. **Classic Tamagotchi at heart.** Short check-ins, feeding, cleaning, caring.
   Care is not decoration — it is what keeps a chromed pet sane.
3. **Idle via expeditions.** Send the pet out (Fallout Shelter style) for real-time
   runs; it returns with loot, money, XP — and injuries.
4. **Every pet is unique and mathematically generated.** A seeded genome drives
   body, look, stats and powers.
5. **Death is real.** Permadeath, with a legacy that carries into the next pet.

**Tone:** Gritty and dark. Grime, rust, flicker, sparse neon. No cute.

**Session shape:** Several short check-ins per day (Tamagotchi rhythm); optional
longer sessions for PvE/PvP.

**Visual direction:** Pixelated-3D hybrid — procedural low-poly 3D rendered at low
internal resolution, then palette-quantized + dithered, with neon bloom.
All assets (meshes, textures, shaders, UI, audio) are generated in code.

**Audience / scope:** Personal project, shared with friends. No monetization,
no anti-cheat. Mobile-first web app (installable PWA), optimized for iPhone.

---

## 2. Scope decision ✅

**Cut:** PvP (entirely). PvE as a separate mode (folded into expeditions).

**MVP = the classic Tamagotchi loop only.** Keep it simple:
choose a starter → hatch → meet your generated pet → care for it.

**Parked for later (agreed direction, not in MVP):**
- **Expeditions, two ways in:** *send alone* (idle, real-time, auto-resolved,
  event log, safer/lower loot, pet decides — drift makes it worse) or *jack in*
  (active 10–15 min roguelite node-map run, Slay the Spire / FTL style).
- **Turn-based combat** (3–4 one-thumb actions). The pet's body parts are its
  moveset; drift can override commands mid-fight.
- Implants (flesh vs chrome), drift, den idle layer, surgery minigame,
  crafting, fixer contracts, mini-games, legacy/memorial.
- Buying, splicing/combining starters; rarities above Common.

---

## 3. Acquisition & hatching ✅

**Vat Pods** replace eggs: scratched glass canisters of murky fluid with a living
silhouette inside, grown in back-alley labs.

**Start of game:** the player chooses 1 of 3 Common pods.
- Each pod shows a small readout screen derived from its genome (e.g.
  `POD #7F3A  MASS: 2.4kg  ACTIVITY: ▓▓▓░░  ORIGIN: [CORRUPTED]`) and a vague
  silhouette through fogged glass (differs by body plan).

**Hatching — no timer shown.** Progress is conveyed diegetically through a
heartbeat monitor line and the scene:
1. **Dormant** — murky fluid, slow faint heartbeat blip.
2. **Stirring** — silhouette twitches, bubbles, heartbeat quickens.
3. **Breaching** — glass fogs and cracks, fluid drains, lights flicker, haptics.
4. **Emergence** — seal bursts, steam clears, pet revealed.

Total hatch time is one config value: **1 minute for testing**, longer in real play.

**Rarity tiers:** Common → Uncommon → Rare → Epic → Legendary → Mythical.
- Rarity means **more exotic, not more powerful**: stranger body plans,
  bioluminescence and rare patterns, more innate genetic traits, a slightly
  higher growth ceiling. Common pets must never feel like trash.
- Rarity is readable from the pod itself: Common = rusty, taped, murky;
  Rare = clean corp lab pod with the logo scratched off; Mythical =
  military-sealed, humming with light that shouldn't exist.
- MVP: starters are always Common, but the generator supports all six tiers.

**Later (not MVP):** buying pods from a gene dealer; **splicing** two pods'
genomes into a new pod with mutation chance.

---

## 4. The creature ✅

### Structure: three layers
1. **Species template** — a real animal, hand-authored in code (skeleton,
   proportions, silhouette). Commons are realistic street animals.
   **MVP species: cat, dog, rat, raccoon.**
2. **Genetic variation** — the genome varies the animal *within* its species,
   like real breeds: size, bulk, leg/tail/ear/snout length, fur length,
   coat colour and pattern, eye colour, scars.
3. **Mutation layer** — driven by rarity. The rarer the pod, the further the
   animal drifts from what it should be.

### Mutation ladder (rarity = how wrong it is, not how strong)
| Tier | What you see |
|------|--------------|
| Common | A normal animal. Mangy, scarred, street-worn — but real. |
| Uncommon | Small wrongness: heterochromia, extra toes, patchy fur, odd colouring. |
| Rare | Visible mutation: a third eye, a second tail, bone spurs, translucent skin patches. |
| Epic | Body horror: extra limbs, split jaw, exposed ribs, tumorous growths, glowing veins. |
| Legendary | Chimera: two species fused (genome blend), heavy mutation. |
| Mythical | Barely an animal: eyes where they shouldn't be, floating, wrong geometry. |

**Tone:** real body horror (option B), gated by rarity — the default Common
experience is a real animal you want to care for; the horror is the prize.
Horror is sold through silhouette, colour (raw pinks, bone white, bile green)
and *wrong* animation (unhinging jaws, twitches, limbs moving out of sync),
which reads better through the pixel filter than fine gore detail would.

### Genome & math
- One seed → seeded PRNG → normalized genes.
- **Bell-curve sampling**: most pets are average, extremes are rare.
- **Correlated genes**: bigger → slower, hungrier; big eyes → nocturnal.
- **Colours from a curated palette only**, never free random hues.
- **Same genome renders every life stage** (baby = juvenile proportions).
- **Temperament genes** (e.g. skittish, vicious, lazy, curious) drive idle
  behaviour and care preferences.
- Pod readout and silhouette are derived from the genome.
- **Name** generated from the seed (designation + street name, e.g.
  `KX-7F "Mongrel"`); player can rename.

### Rendering
- Bodies built from capsules/blobs smooth-merged into one fleshy mesh, then
  the pixel/dither/palette pass on top.
- All animation procedural: breathing, blinking, look-at, tail sway, gait,
  twitches.
- Cat/dog/rat are recognizable silhouettes, so errors are more visible than on
  invented creatures — the pixel filter helps; the first style test will prove
  or disprove it.

### Rarity math (rarity is emergent, not a label)
Rarity is *computed from the genome*, so the tier always tells the truth
about how mutated the animal is.

1. **Mutation count** ~ Poisson(λ). λ ("exposure") is set by the pod's source.
2. Each mutation draws a **severity** from a weighted table:
   minor = 1 (heterochromia, extra toe) · visible = 3 (third eye, second tail) ·
   horror = 6 (extra limb, split jaw) · chimera = 10 · wrongness = 15.
   Each source also has a **severity cap**.
3. **Statistical outliers** add load too: any gene beyond ±2.75σ on the bell
   curve (a giant, a runt, a freakishly long tail) adds +1.
4. **Mutation load** M = sum of severities + outlier points.
   Tier thresholds: 0 Common · 1–2 Uncommon · 3–5 Rare · 6–9 Epic ·
   10–14 Legendary · 15+ Mythical.

**Starter pods:** λ = 0.07, cap = minor only, load capped at 2 → measured over
100k pods: **88.9% Common / 11.1% Uncommon** (≈ 30% chance at least one of the
three starters is Uncommon). Never higher. (Mutations ≈ 6.8% + outliers ≈ 4.7%.)
**Dealer pods (dev/testing for now):** λ = 0.9, cap = visible → reach Rare/Epic.
Future sources (gene dealer, splicing) simply raise λ and the cap; splicing
derives λ from the parents' mutation loads.

**Tooling:** a debug seed field / reroll button, and a simulation script that
generates 100k genomes and prints the tier distribution, used to tune the numbers.

**Starter selection:** 3 random pods (species random, may repeat).

---

## 5. Care loop ✅

### Needs (0–100, decay in real time; offline time is caught up on open)
| Need | Drains from | Neglect looks like |
|------|-------------|--------------------|
| Hunger | time; faster for bigger bodies | ribs showing, lethargy |
| Hygiene | waste accumulating on the floor | flies, grime, sickness risk |
| Energy | being awake, play | stumbling, irritability |
| Mood | boredom, neglect | hiding, biting, pacing |
| Health | mostly hidden; long neglect, sickness, junk food | visible decline |

**Bond** grows slowly with consistent care (lightly used in MVP; foundation for drift later).

### Actions
- **Feed:** nutrient paste (cheap, bland) · meat scraps (good) · treats (big mood, hurts health).
- **Clean:** clear the waste, scrub the floor.
- **Play / pet:** finger-rub interaction; temperament decides what it likes.
- **Lights off:** sleep; needs drain slower.
- **Medicine:** when sick.
- ~~Discipline~~ — dropped for MVP.

Species flavour: raccoon steals food, cat ignores you, dog bonds faster, rat hides in the walls.

### Life stages
Hatchling → Juvenile → Adult → Elder → death of old age.
- **Care shapes the adult form:** well-kept → strong, glossy adult; neglected →
  scrawny, scarred, mangy. The genome sets potential; care sets outcome.
- **Test lifespan: 5 days total** (Hatchling 6 h · Juvenile 1 d · Adult 3 d ·
  Elder 18 h). Target for real play later: 2–3 weeks. Stage durations are config.
- A dev time-scale control lets us test a whole life in minutes.

### Death (permadeath)
- **Old age**, or **health reaching zero** from prolonged neglect / untreated sickness.
- Decline is always visible first. At health 0 the pet enters a **critical state
  with a grace period**; any proper care during it pulls the pet back.
- **"While you were gone" report** on every open summarizes what happened.

### Notifications
Real web push needs a server even for an installed PWA (Safari can't schedule
local notifications). **MVP ships without notifications**; hence slow, forgiving
decay (hours, not minutes). A small push server can come later.

---

## 6. Tech architecture ✅

| Area | Choice |
|------|--------|
| Language / build | TypeScript + Vite |
| 3D | Three.js; low-res render target → nearest upscale, palette quantize, ordered dither |
| Creature mesh | Marching cubes over merged blobs, built once at hatch, cached |
| RNG / noise | Own seeded PRNG (cyrb128 hash + sfc32) + `simplex-noise` |
| UI | Svelte 5 overlay |
| Saves | IndexedDB (`idb-keyval`) + export/import code |
| PWA | `vite-plugin-pwa` (standalone, offline, safe areas) |
| Audio | ZzFX + Web Audio (unlocked on first tap) |
| Tests | Vitest; rarity simulation script |
| Hosting | Static host with branch previews — see below |

**Architecture:** `src/core` is pure, render-free, fully testable game logic
(RNG, genome, rarity, needs, lifecycle, save). Offline catch-up simulates in
1-minute steps. `src/render` (Three.js), `src/ui` (Svelte), `scripts/` (sims).

**Dev tools:** debug panel (seed, reroll, time-scale, jump stage, set needs).

**iPhone notes:** no vibration API on iOS web (hatch "shake" = screen shake +
sound; real haptics only if wrapped with Capacitor later). Render ~30 fps idle,
pause when hidden. Audio unlocks on first tap.

**Hosting / running on the iPhone:** GitHub Pages from a public repo (owner's
choice), deployed on push to `main`. The installed PWA caches the whole game
and runs fully offline on the phone; a host is only needed for first install
and updates.

---

## 7. Art, audio & UI style guide ✅

**Title:** CHROMOGOTCHI. *(Fine for a personal project; "-gotchi" echoes Bandai's
Tamagotchi trademark, so revisit if it ever goes public.)*

**The device:** a jailbroken black-market vet-lab monitoring terminal.
- Top ~65%: the den through a CRT monitor (scanlines, slight curvature,
  vignette, gentle flicker). Post-effects apply to the monitor only.
- Bottom: the device's control deck, chunky one-thumb buttons, crisp text.

**The den:** a squat apartment — **no cage**; the pet roams a small room.
Stained floor, mattress on the floor, food bowl, waste accumulating, one harsh
buzzing fluorescent tube, rain-streaked window with a flickering neon sign
outside spilling magenta/cyan.
**Lights off = dimmed room**, not black: the tube goes dark, the bulb drops to
a low glow and the neon spill dominates. (A night-vision mode was tried and
rejected — it didn't read as "lights off".)
Pet moves freely within the room (simple wander/target movement).

**Palette:** ~24 curated colours — grime (blue-green blacks, rust), flesh
(sickly pinks/yellows, bone white, bile green), neon magenta/cyan as accent
and danger only. 3D renders at 180×320, nearest upscale, ordered dither.

**UI:** warm red-orange phosphor terminal.
- Primary text: hot orange-amber · secondary: dim red · background near-black.
- Positive/info accents: cyan · critical alerts: white-hot flicker + magenta.
- Fonts: *Silkscreen* (labels), *VT323* (terminal text), self-hosted.
- Segmented pixel meters for needs.

**Voice:** cold lab-terminal copy (`SUBJECT KX-7F // NUTRITION CRITICAL`); the
"while you were gone" log carries dark humour.

**Audio (all procedural):** ambience (rain, tube hum, city drone); SFX (CRT
clicks, heartbeat, squelch, crunch); stylized glitched vocalizations per
species, pitch derived from genome body size.

**Accessibility:** gentle flicker (photosensitivity), reduced-motion option,
sound toggle.

---

## 8. MVP milestones ✅

Each milestone is pushed with a preview URL; the owner tests on iPhone and
approves before the next one starts.

| # | Milestone | Done when |
|---|-----------|-----------|
| M0 ✅ | Project setup | Vite + TS + Svelte + PWA, Vitest, debug panel shell, deploy pipeline |
| M1 ✅ | **Style test** | Den + pixel/CRT pipeline + one procedural Common cat, idle animation. **Look approved.** |
| M2 ✅ | Genome & rarity | 4 species, variation, Uncommon minor mutations, names, rarity sim, seed gallery |
| M3 ✅ | Pods & hatching | 3 pods with readouts & silhouettes, 4 hatch phases, 1-minute hatch, reveal |
| M4 | Care loop | Needs, actions, sleep, sickness, offline catch-up, "while you were gone", save/export |
| M5 | Life & death | Stages, care-shaped adult, elder, critical state, death, start over |
| M6 | Polish | Audio, CRT transitions, install prompt, iPhone QA pass |

---

## M2 implementation notes

- **Species scale & framing:** cat 1 · dog 1.3 · rat 0.55 · raccoon 1.15. The
  camera and walk area scale with the pet, so a rat gets a rat's-eye view.
- **Mutations with visuals now:** minor — heterochromia, clouded eye, torn ear,
  kinked tail, stub tail, alopecia, pigment loss; visible — third eye, twin
  tail, bone spurs, translucent skin. Horror / chimera / wrongness come later.
- **Known weak spot:** the raccoon reads least clearly of the four (mask and
  ringed tail carry it); revisit when polishing.

## M3 implementation notes

- **Flow:** `select` (3 starter pods) → `hatching` (wall-clock based, survives
  closing the app) → `den`. Saved locally (`cg.game`); M4 moves saves to
  IndexedDB with export/import.
- **Pods** are real 3D objects in the den: the actual generated creature floats
  curled up inside as a dark silhouette; Uncommon pods have a blinking amber
  warning lamp and an "IRREGULARITY DETECTED" readout.
- **Hatch phases** (no timer, only rhythm): ECG heart rate 34 → 78 → 150 → 190
  bpm, bubbles and twitching increase, glass cracks and fluid drains while the
  room light stutters and the camera shakes, then the seal bursts (shards,
  steam, lid pops) and the creature unfolds onto the floor at full size.
- **Reveal card:** "SUBJECT VIABLE", designation, name, species, tier.
- **Dev:** DBG → NEW GAME (PODS), SKIP HATCH.
