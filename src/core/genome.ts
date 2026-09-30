// A pet's DNA: one seed expands into every gene, mutation and the rarity tier.

import { Rng } from './rng';
import type { PaletteColor } from './palette';
import { SPECIES, SPECIES_DEFS, type Species } from './species';
import {
  OUTLIER_SIGMA, SOURCES, rollMutations, severityOf, tierFor,
  type MutationId, type Source, type Tier,
} from './mutations';

export type { Species } from './species';
export type Temperament = 'skittish' | 'vicious' | 'lazy' | 'curious';

export type BodyGene =
  | 'size' | 'bulk' | 'legLength' | 'tailLength' | 'earSize' | 'headSize' | 'snoutLength' | 'neckLength';

export interface Genome {
  seed: string;
  source: string;
  species: Species;
  designation: string;
  streetName: string;
  temperament: Temperament;
  /** Body proportions as multipliers around 1 (bell-curve sampled). */
  body: Record<BodyGene, number>;
  coat: {
    pattern: string;
    base: PaletteColor;
    secondary: PaletteColor;
    belly: PaletteColor;
    eye: PaletteColor;
    /** Second eye colour; differs from `eye` only with heterochromia / clouded eye. */
    eye2: PaletteColor;
    skin: PaletteColor;
  };
  /** 0..1 — how much bare, mangy skin shows. Street animals are worn. */
  mange: number;
  scars: number;
  mutations: MutationId[];
  /** Genes that landed beyond ±OUTLIER_SIGMA: freaks of nature. */
  outliers: BodyGene[];
  /** Mutation load: severities + outliers. Decides the tier. */
  load: number;
  tier: Tier;
}

const GENE_SD: Record<BodyGene, number> = {
  size: 0.07, bulk: 0.1, legLength: 0.07, tailLength: 0.12,
  earSize: 0.1, headSize: 0.06, snoutLength: 0.1, neckLength: 0.1,
};

const STREET_NAMES = [
  'Mongrel', 'Rust', 'Gutter', 'Static', 'Lint', 'Grime', 'Patch', 'Sprocket',
  'Soot', 'Nibs', 'Bile', 'Ash', 'Tallow', 'Scab', 'Fuse', 'Vandal', 'Kopek',
  'Mothball', 'Drain', 'Pylon', 'Rivet', 'Sump', 'Gristle', 'Wick', 'Bandit',
  'Sewer', 'Tinsel', 'Crumb', 'Nox', 'Brick',
] as const;

export function generateGenome(seed: string, source: Source = SOURCES.starter): Genome {
  const rng = new Rng(seed);
  const naming = rng.fork('name');
  const shape = rng.fork('body');
  const look = rng.fork('coat');
  const wear = rng.fork('wear');
  const mut = rng.fork('mutations');

  const species = rng.pick(SPECIES);
  const def = SPECIES_DEFS[species];

  const letters = 'ABCDEFGHJKLMNPRSTVWXZ';
  const designation =
    naming.pick([...letters]) + naming.pick([...letters]) + '-' + naming.int(1, 9) +
    naming.pick([...'0123456789ABCDEF']);

  // Body genes: z-scores on a bell curve, clamped at ±3.5σ.
  const body = {} as Record<BodyGene, number>;
  const outliers: BodyGene[] = [];
  for (const gene of Object.keys(GENE_SD) as BodyGene[]) {
    const z = Math.max(-3.5, Math.min(3.5, shape.normal()));
    body[gene] = 1 + z * GENE_SD[gene];
    if (Math.abs(z) > OUTLIER_SIGMA) outliers.push(gene);
  }

  const coatDef = look.weighted(def.coats.map((c) => [c, c.weight] as const));
  const [base, secondary, belly] = look.pick(coatDef.colors);
  const eye = coatDef.pattern === 'albino' ? 'magentaDeep' : look.weighted(def.eyes);

  const mutations = rollMutations(mut, source);
  let eye2: PaletteColor = eye;
  if (mutations.includes('cloudyEye')) eye2 = 'bone';
  else if (mutations.includes('heterochromia')) eye2 = mut.pick(['cyanDeep', 'amberPale', 'sickly', 'bone'].filter((c) => c !== eye) as PaletteColor[]);
  if (mutations.includes('stubTail')) body.tailLength *= 0.3;

  const load = Math.min(source.maxLoad, mutations.reduce((s, m) => s + severityOf(m), 0) + outliers.length);

  return {
    seed,
    source: source.id,
    species,
    designation,
    streetName: naming.pick(STREET_NAMES),
    temperament: rng.pick(['skittish', 'vicious', 'lazy', 'curious'] as const),
    body,
    coat: { pattern: coatDef.pattern, base, secondary, belly, eye, eye2, skin: def.skin },
    mange: Math.max(0, Math.min(1, 0.25 + wear.normal() * 0.2 + (mutations.includes('alopecia') ? 0.6 : 0))),
    scars: wear.weighted([[0, 3], [1, 3], [2, 1]]),
    mutations,
    outliers,
    load,
    tier: tierFor(load),
  };
}
