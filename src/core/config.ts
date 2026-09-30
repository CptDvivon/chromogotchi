// Tunable game timings. Test values for now (see docs/GDD.md).

const HOUR = 60 * 60 * 1000;

export const CONFIG = {
  hatchMs: 60 * 1000,
  stageMs: {
    hatchling: 6 * HOUR,
    juvenile: 24 * HOUR,
    adult: 72 * HOUR,
    elder: 18 * HOUR,
  },
} as const;
