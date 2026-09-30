// The curated CHROMOGOTCHI palette (sRGB). Everything on the monitor is
// quantized to these colours; genomes pick colours by name, never free hues.

export const PALETTE = {
  // grime
  void: '#0b0708',
  tar: '#141a1c',
  soot: '#1f2a2b',
  mold: '#34403d',
  concrete: '#53594f',
  dust: '#7d7a68',
  // rust / amber
  rustDark: '#3a1f16',
  rust: '#6b3420',
  burnt: '#a4552a',
  amber: '#d98a3a',
  amberPale: '#f2c46b',
  // flesh
  bruise: '#5a2a32',
  meat: '#9c4a52',
  raw: '#d98282',
  skin: '#e8b7a0',
  bone: '#e9e2cf',
  sickly: '#b8b04a',
  bile: '#6f7a2a',
  // neon
  magenta: '#ff2e88',
  magentaDeep: '#8a1450',
  cyan: '#29f0ff',
  cyanDeep: '#137a8c',
  whiteHot: '#fff6e0',
  night: '#2a2438',
} as const;

export type PaletteColor = keyof typeof PALETTE;

export const PALETTE_LIST: readonly string[] = Object.values(PALETTE);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
