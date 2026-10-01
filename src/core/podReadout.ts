// What the pod's little screen shows, derived from the genome inside it.

import type { Genome } from './genome';
import { Rng } from './rng';

export interface PodReadout {
  id: string;
  massKg: number;
  /** 1..5 activity bars. */
  activity: number;
  origin: string;
  /** Uncommon+ pods flag a genome irregularity. */
  irregular: boolean;
}

const ADULT_KG = { cat: 4.2, dog: 18, rat: 0.35, raccoon: 7 } as const;
const BASE_ACTIVITY = { curious: 4, vicious: 5, skittish: 3, lazy: 1 } as const;
const ORIGINS = [
  '[CORRUPTED]', 'KOWLOON-B LAB', 'SECTOR 9 BACKROOM', 'UNREGISTERED',
  'VET CLINIC SALVAGE', '[REDACTED]', 'DOCK 14 COLDSTORE', 'NO RECORD',
];

export function podReadout(g: Genome): PodReadout {
  const rng = new Rng(`${g.seed}:readout`);
  const b = g.body;
  return {
    id: g.seed.slice(-4),
    massKg: ADULT_KG[g.species] * 0.06 * b.size ** 3 * b.bulk,
    activity: Math.max(1, Math.min(5, BASE_ACTIVITY[g.temperament] + rng.int(-1, 1))),
    origin: rng.pick(ORIGINS),
    irregular: g.tier !== 'common',
  };
}
