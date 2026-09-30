# Game Design Document — Cyberpunk Tamagotchi (working title)

Living document. Each section is filled in as its planning step is agreed.
Status legend: ✅ locked · 🟡 in discussion · ⬜ not started

## Planning roadmap

| # | Step | Status |
|---|------|--------|
| 1 | Vision & pillars | ✅ |
| 2 | The creature: genome & procedural generation | 🟡 |
| 3 | Care loop, needs, permadeath | ⬜ |
| 4 | Idle layer: expeditions & economy | ⬜ |
| 5 | Progression: stats, levels, powers, implants | ⬜ |
| 6 | Combat core | ⬜ |
| 7 | PvE mode | ⬜ |
| 8 | PvP mode | ⬜ |
| 9 | Tech architecture & libraries | ⬜ |
| 10 | Art / audio / UI style guide | ⬜ |
| 11 | MVP scope & milestones | ⬜ |

---

## 1. Vision & pillars ✅

**Pitch:** You raise an ordinary living pet in a rotten cyberpunk city. Over its
life you choose whether to keep it flesh or rebuild it with biotech, black-market
chrome and AI chips. The more machine it becomes, the stronger it gets — and the
less it's *yours*.

**Pillars**
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
