// Mutations and emergent rarity (see docs/GDD.md §4 "Rarity math").

import type { Rng } from './rng';

export type Severity = 1 | 3 | 6 | 10 | 15;
export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';
export const TIERS: readonly Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'];

export type MutationId =
  // minor (1)
  | 'heterochromia' | 'cloudyEye' | 'tornEar' | 'kinkedTail' | 'stubTail' | 'alopecia' | 'vitiligo'
  // visible (3)
  | 'thirdEye' | 'twinTail' | 'boneSpurs' | 'translucentSkin';

export interface MutationDef {
  id: MutationId;
  label: string;
  severity: Severity;
  weight: number;
}

export const MUTATIONS: readonly MutationDef[] = [
  { id: 'heterochromia', label: 'HETEROCHROMIA', severity: 1, weight: 3 },
  { id: 'cloudyEye', label: 'CLOUDED EYE', severity: 1, weight: 2 },
  { id: 'tornEar', label: 'TORN EAR', severity: 1, weight: 2 },
  { id: 'kinkedTail', label: 'KINKED TAIL', severity: 1, weight: 2 },
  { id: 'stubTail', label: 'STUB TAIL', severity: 1, weight: 1 },
  { id: 'alopecia', label: 'ALOPECIA', severity: 1, weight: 2 },
  { id: 'vitiligo', label: 'PIGMENT LOSS', severity: 1, weight: 2 },
  { id: 'thirdEye', label: 'THIRD EYE', severity: 3, weight: 2 },
  { id: 'twinTail', label: 'TWIN TAIL', severity: 3, weight: 2 },
  { id: 'boneSpurs', label: 'BONE SPURS', severity: 3, weight: 2 },
  { id: 'translucentSkin', label: 'TRANSLUCENT SKIN', severity: 3, weight: 1.5 },
];

/**
 * Where a pod comes from. `exposure` is the Poisson mean number of mutations;
 * `cap` is the worst severity that source can produce.
 * Horror (6), chimera (10) and wrongness (15) mutations arrive in later milestones.
 */
export interface Source {
  id: string;
  exposure: number;
  cap: Severity;
  /** Highest mutation load the source lets through (pods above are culled). */
  maxLoad: number;
}

export const SOURCES = {
  starter: { id: 'starter', exposure: 0.07, cap: 1, maxLoad: 2 },
  dealer: { id: 'dealer', exposure: 0.9, cap: 3, maxLoad: 14 },
} as const satisfies Record<string, Source>;

/** Genes beyond this many standard deviations count as a freak of nature (+1). */
export const OUTLIER_SIGMA = 2.75;

export function tierFor(load: number): Tier {
  if (load <= 0) return 'common';
  if (load <= 2) return 'uncommon';
  if (load <= 5) return 'rare';
  if (load <= 9) return 'epic';
  if (load <= 14) return 'legendary';
  return 'mythical';
}

/** Knuth's Poisson sampler; fine for small means. */
function poisson(rng: Rng, mean: number): number {
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.float();
  } while (p > l);
  return k - 1;
}

/** Rolls distinct mutations for a pod from the given source. */
export function rollMutations(rng: Rng, source: Source): MutationId[] {
  const pool = MUTATIONS.filter((m) => m.severity <= source.cap);
  const count = Math.min(poisson(rng, source.exposure), pool.length);
  const picked: MutationId[] = [];
  const available = [...pool];
  for (let i = 0; i < count; i++) {
    const m = rng.weighted(available.map((d) => [d, d.weight] as const));
    picked.push(m.id);
    available.splice(available.indexOf(m), 1);
    // Stub and kinked tails are mutually exclusive.
    if (m.id === 'stubTail' || m.id === 'kinkedTail') {
      const other = available.findIndex((d) => d.id === (m.id === 'stubTail' ? 'kinkedTail' : 'stubTail'));
      if (other >= 0) available.splice(other, 1);
    }
    if (!available.length) break;
  }
  return picked;
}

export function severityOf(id: MutationId): Severity {
  return MUTATIONS.find((m) => m.id === id)!.severity;
}

export function labelOf(id: MutationId): string {
  return MUTATIONS.find((m) => m.id === id)!.label;
}
