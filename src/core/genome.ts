// A pet's DNA: one seed expands into every gene. M1 covers the cat species;
// M2 adds dog, rat, raccoon, mutations and rarity.

import { Rng } from './rng';
import type { PaletteColor } from './palette';

export type Species = 'cat';
export type CoatPattern = 'solid' | 'tabby' | 'tuxedo' | 'calico' | 'point';
export type Temperament = 'skittish' | 'vicious' | 'lazy' | 'curious';

export interface Genome {
  seed: string;
  species: Species;
  designation: string;
  streetName: string;
  temperament: Temperament;
  /** Body proportions as multipliers around 1 (bell-curve sampled). */
  body: {
    size: number;
    bulk: number;
    legLength: number;
    tailLength: number;
    earSize: number;
    headSize: number;
    snoutLength: number;
    neckLength: number;
  };
  coat: {
    pattern: CoatPattern;
    base: PaletteColor;
    secondary: PaletteColor;
    belly: PaletteColor;
    eye: PaletteColor;
  };
  /** 0..1 — how much bare, mangy skin shows. Street animals are worn. */
  mange: number;
  scars: number;
}

/** Bell-curve gene: mean 1, clamped so extremes stay plausible. */
function gene(rng: Rng, sd: number, min = 1 - sd * 3, max = 1 + sd * 3): number {
  return Math.min(max, Math.max(min, 1 + rng.normal() * sd));
}

const STREET_NAMES = [
  'Mongrel', 'Rust', 'Gutter', 'Static', 'Lint', 'Grime', 'Patch', 'Sprocket',
  'Soot', 'Nibs', 'Bile', 'Ash', 'Tallow', 'Scab', 'Fuse', 'Vandal', 'Kopek',
  'Mothball', 'Drain', 'Pylon', 'Rivet', 'Sump', 'Gristle', 'Wick',
] as const;

const COATS: Record<CoatPattern, readonly (readonly [PaletteColor, PaletteColor, PaletteColor])[]> = {
  // [base, secondary, belly]
  solid: [['tar', 'tar', 'soot'], ['concrete', 'mold', 'dust'], ['burnt', 'rust', 'amber'], ['dust', 'concrete', 'bone']],
  tabby: [['concrete', 'tar', 'dust'], ['amber', 'burnt', 'amberPale'], ['dust', 'rustDark', 'skin'], ['burnt', 'rustDark', 'amber']],
  tuxedo: [['tar', 'tar', 'bone'], ['concrete', 'soot', 'bone']],
  calico: [['bone', 'burnt', 'bone'], ['skin', 'tar', 'bone']],
  point: [['skin', 'rustDark', 'bone'], ['bone', 'concrete', 'bone']],
};

export function generateGenome(seed: string): Genome {
  const rng = new Rng(seed);
  const naming = rng.fork('name');
  const shape = rng.fork('body');
  const look = rng.fork('coat');
  const wear = rng.fork('wear');

  const letters = 'ABCDEFGHJKLMNPRSTVWXZ';
  const designation =
    naming.pick([...letters]) + naming.pick([...letters]) + '-' + naming.int(1, 9) +
    naming.pick([...'0123456789ABCDEF']);

  const pattern = look.weighted<CoatPattern>([
    ['tabby', 4], ['solid', 3], ['tuxedo', 2], ['calico', 1.5], ['point', 1],
  ]);
  const [base, secondary, belly] = look.pick(COATS[pattern]);

  return {
    seed,
    species: 'cat',
    designation,
    streetName: naming.pick(STREET_NAMES),
    temperament: rng.pick(['skittish', 'vicious', 'lazy', 'curious'] as const),
    body: {
      size: gene(shape, 0.07),
      bulk: gene(shape, 0.1),
      legLength: gene(shape, 0.07),
      tailLength: gene(shape, 0.12),
      earSize: gene(shape, 0.1),
      headSize: gene(shape, 0.06),
      snoutLength: gene(shape, 0.1),
      neckLength: gene(shape, 0.1),
    },
    coat: {
      pattern,
      base,
      secondary,
      belly,
      eye: look.weighted<PaletteColor>([['amber', 3], ['sickly', 3], ['amberPale', 2], ['cyanDeep', 1]]),
    },
    mange: Math.max(0, Math.min(1, 0.25 + wear.normal() * 0.2)),
    scars: wear.weighted([[0, 3], [1, 3], [2, 1]]),
  };
}
