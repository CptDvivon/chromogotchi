import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { generateGenome } from './genome';

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

  it('keeps body genes in plausible ranges', () => {
    for (let i = 0; i < 500; i++) {
      const g = generateGenome(`seed-${i}`);
      for (const v of Object.values(g.body)) {
        expect(v).toBeGreaterThan(0.5);
        expect(v).toBeLessThan(1.5);
      }
      expect(g.mange).toBeGreaterThanOrEqual(0);
      expect(g.mange).toBeLessThanOrEqual(1);
      expect(g.designation).toMatch(/^[A-Z]{2}-\d[0-9A-F]$/);
    }
  });
});
