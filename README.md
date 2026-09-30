# CHROMOGOTCHI

A gritty cyberpunk virtual pet for the phone, built for the web (installable
PWA, iPhone-first). Design lives in [`docs/GDD.md`](docs/GDD.md).

## Develop

```sh
npm install
npm run dev      # dev server (also on your LAN, for phone testing)
npm test         # unit tests
npm run check    # type checks
npm run build    # production build in dist/
```

## Dev tools

- **DBG** button (top right): seed field, reroll, pixel resolution, filter
  toggles, time scale (used from M4), FPS and genome readout.
- `?seed=ABC123` loads a specific pet.
- `?inspect=90` freezes the pet and frames it up close from the given angle
  (degrees).

## Deploy

Pushes to `main` build and deploy to GitHub Pages via
`.github/workflows/deploy.yml` (Settings → Pages → Source: GitHub Actions).
Other branches run checks, tests and a build only.

## Layout

```
src/core/     pure game logic: RNG, genome, palette, config (tested, no rendering)
src/render/   Three.js den, pixel/CRT pipeline, procedural creatures
src/ui/       Svelte device UI and debug panel
scripts/      tooling (icon generation)
```
