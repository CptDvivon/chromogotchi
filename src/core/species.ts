// Per-species data: coats, eyes, and how the camera frames them.

import type { PaletteColor } from './palette';

export type Species = 'cat' | 'dog' | 'rat' | 'raccoon';
export const SPECIES: readonly Species[] = ['cat', 'dog', 'rat', 'raccoon'];

export interface CoatDef {
  pattern: string;
  weight: number;
  /** Colour sets: [base, secondary, belly]. */
  colors: readonly (readonly [PaletteColor, PaletteColor, PaletteColor])[];
}

export interface SpeciesDef {
  /** Camera/room framing relative to a cat (body length ratio). */
  frame: number;
  coats: readonly CoatDef[];
  eyes: readonly (readonly [PaletteColor, number])[];
  /** Bare-skin colour for nose, ears, tail (rat) etc. */
  skin: PaletteColor;
}

export const SPECIES_DEFS: Record<Species, SpeciesDef> = {
  cat: {
    frame: 1,
    skin: 'meat',
    coats: [
      { pattern: 'tabby', weight: 4, colors: [['concrete', 'tar', 'dust'], ['amber', 'burnt', 'amberPale'], ['dust', 'rustDark', 'skin'], ['burnt', 'rustDark', 'amber']] },
      { pattern: 'solid', weight: 3, colors: [['tar', 'tar', 'soot'], ['concrete', 'mold', 'dust'], ['burnt', 'rust', 'amber'], ['dust', 'concrete', 'bone']] },
      { pattern: 'tuxedo', weight: 2, colors: [['tar', 'tar', 'bone'], ['concrete', 'soot', 'bone']] },
      { pattern: 'calico', weight: 1.5, colors: [['bone', 'burnt', 'bone'], ['skin', 'tar', 'bone']] },
      { pattern: 'point', weight: 1, colors: [['skin', 'rustDark', 'bone'], ['bone', 'concrete', 'bone']] },
    ],
    eyes: [['amber', 3], ['sickly', 3], ['amberPale', 2], ['cyanDeep', 1]],
  },
  dog: {
    frame: 1.35,
    skin: 'bruise',
    coats: [
      { pattern: 'solid', weight: 3, colors: [['burnt', 'rust', 'amber'], ['tar', 'tar', 'soot'], ['dust', 'concrete', 'bone'], ['rust', 'rustDark', 'burnt']] },
      { pattern: 'saddle', weight: 3, colors: [['burnt', 'tar', 'amber'], ['amber', 'rustDark', 'amberPale']] },
      { pattern: 'brindle', weight: 2, colors: [['burnt', 'rustDark', 'amber'], ['concrete', 'tar', 'dust']] },
      { pattern: 'patched', weight: 2, colors: [['bone', 'tar', 'bone'], ['bone', 'burnt', 'bone']] },
    ],
    eyes: [['rustDark', 3], ['burnt', 3], ['amber', 2], ['cyanDeep', 0.5]],
  },
  rat: {
    frame: 0.6,
    skin: 'raw',
    coats: [
      { pattern: 'agouti', weight: 5, colors: [['rust', 'rustDark', 'dust'], ['concrete', 'soot', 'dust']] },
      { pattern: 'solid', weight: 2, colors: [['tar', 'tar', 'soot'], ['concrete', 'mold', 'concrete']] },
      { pattern: 'hooded', weight: 1.5, colors: [['bone', 'tar', 'bone'], ['bone', 'rust', 'bone']] },
      { pattern: 'albino', weight: 0.5, colors: [['bone', 'bone', 'bone']] },
    ],
    eyes: [['void', 5], ['magentaDeep', 1]],
  },
  raccoon: {
    frame: 1.15,
    skin: 'tar',
    coats: [
      { pattern: 'masked', weight: 5, colors: [['concrete', 'tar', 'dust'], ['dust', 'tar', 'bone'], ['mold', 'tar', 'dust']] },
      { pattern: 'masked-dark', weight: 1, colors: [['soot', 'tar', 'concrete']] },
    ],
    eyes: [['rustDark', 3], ['burnt', 1]],
  },
};
