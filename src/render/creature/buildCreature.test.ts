import { describe, expect, it } from 'vitest';
import { generateGenome } from '../../core/genome';
import { SOURCES } from '../../core/mutations';
import { buildCreature } from './buildCreature';

function seedFor(pred: (g: ReturnType<typeof generateGenome>) => boolean, source = SOURCES.starter) {
  for (let i = 0; i < 20000; i++) if (pred(generateGenome(`T${i}`, source))) return `T${i}`;
  throw new Error('no seed');
}

describe('buildCreature', () => {
  for (const species of ['cat', 'dog', 'rat', 'raccoon'] as const) {
    it(`builds a skinned ${species} with normalized weights`, () => {
      const g = generateGenome(seedFor((x) => x.species === species));
      const t0 = performance.now();
      const c = buildCreature(g);
      const ms = performance.now() - t0;
      const pos = c.mesh.geometry.getAttribute('position');
      const w = c.mesh.geometry.getAttribute('skinWeight');
      expect(pos.count).toBeGreaterThan(2000);
      for (let i = 0; i < w.count; i++) {
        const s = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
        expect(Math.abs(s - 1)).toBeLessThan(1e-4);
      }
      expect(Object.keys(c.bones)).toContain('head');
      console.log(`${species}: ${pos.count} verts, ${ms.toFixed(0)} ms`);
    });
  }

  it('builds visible mutations (twin tail, third eye)', () => {
    const src = SOURCES.dealer;
    const twin = buildCreature(generateGenome(seedFor((g) => g.mutations.includes('twinTail'), src), src));
    expect(twin.bones.tailB0).toBeDefined();
    const third = buildCreature(generateGenome(seedFor((g) => g.mutations.includes('thirdEye'), src), src));
    expect(third.eyes.length).toBe(3);
  });
});
