# Game Design Document — Cyberpunk Tamagotchi (working title)

Living document. Each section is filled in as its planning step is agreed.
Status legend: ✅ locked · 🟡 in discussion · ⬜ not started

## Planning roadmap

| # | Step | Status |
|---|------|--------|
| 1 | Vision & pillars | ✅ |
| 2 | Scope decision: MVP = classic Tamagotchi loop | ✅ |
| 3 | Acquisition & hatching (pods, rarity) | ✅ |
| 4 | The creature: genome & procedural generation | 🟡 |
| 5 | Care loop, needs, life stages, death | ⬜ |
| 6 | Tech architecture & libraries | ⬜ |
| 7 | Art / audio / UI style guide | ⬜ |
| 8 | MVP milestones | ⬜ |

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

Total hatch time is one config value: **10 s for testing**, longer in real play.

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
