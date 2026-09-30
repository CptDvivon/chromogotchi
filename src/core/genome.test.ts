import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { generateGenome } from './genome';
import { SOURCES, TIERS, type Tier } from './mutations';
import { SPECIES } from './species';

describe('Rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng('7F3A');
    const b = new Rng('7F3A');
    const c = new Rng('7F3B');
    const sa = Array.from({ length: 5 }, () => a.float());
    expect(Array.from({ length: 5 }, () => b.float())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.float())).not.toEqual(sa);
  });

  it('normal() is centred and mostly within 3 sd', () => {
    const r = new Rng('bell');
    const xs = Array.from({ length: 20000 }, () => r.normal());
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(xs.filter((x) => Math.abs(x) > 3).length / xs.length).toBeLessThan(0.01);
  });
});

describe('generateGenome', () => {
  it('is deterministic', () => {
    expect(generateGenome('ABC123')).toEqual(generateGenome('ABC123'));
  });

  it('keeps genes plausible and produces every species', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const g = generateGenome(`seed-${i}`);
      seen.add(g.species);
      for (const v of Object.values(g.body)) {
        expect(v).toBeGreaterThan(0.2);
        expect(v).toBeLessThan(1.5);
      }
      expect(g.mange).toBeGreaterThanOrEqual(0);
      expect(g.mange).toBeLessThanOrEqual(1);
      expect(g.designation).toMatch(/^[A-Z]{2}-\d[0-9A-F]$/);
    }
    expect([...seen].sort()).toEqual([...SPECIES].sort());
  });
});

/** Tier distribution for a source; `npm run sim` prints a 100k-pet table. */
const SIM = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM;

function distribution(source: (typeof SOURCES)[keyof typeof SOURCES], n: number) {
  const counts = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  for (let i = 0; i < n; i++) counts[generateGenome(`${source.id}-${i}`, source).tier]++;
  return counts;
}

describe('rarity', () => {
  const n = SIM ? 100_000 : 20_000;

  it('starter pods: ~11% Uncommon, never above Uncommon', () => {
    const c = distribution(SOURCES.starter, n);
    if (SIM) console.table(Object.fromEntries(TIERS.map((t) => [t, `${((c[t] / n) * 100).toFixed(2)}%`])));
    const uncommon = c.uncommon / n;
    expect(uncommon).toBeGreaterThan(0.09);
    expect(uncommon).toBeLessThan(0.13);
    expect(c.common + c.uncommon).toBe(n);
  });

  it('dealer pods reach Rare and beyond', () => {
    const c = distribution(SOURCES.dealer, Math.min(n, 20_000));
    if (SIM) console.table(c);
    expect(c.rare).toBeGreaterThan(0);
  });
});
