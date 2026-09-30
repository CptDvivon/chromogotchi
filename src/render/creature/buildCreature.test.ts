import { describe, expect, it } from 'vitest';
import { generateGenome } from '../../core/genome';
import { buildCreature } from './buildCreature';

describe('buildCreature', () => {
  it('builds a skinned cat with normalized weights', () => {
    const t0 = performance.now();
    const c = buildCreature(generateGenome('TESTCAT'));
    const ms = performance.now() - t0;
    const pos = c.mesh.geometry.getAttribute('position');
    const w = c.mesh.geometry.getAttribute('skinWeight');
    expect(pos.count).toBeGreaterThan(2000);
    for (let i = 0; i < w.count; i++) {
      const s = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
      expect(Math.abs(s - 1)).toBeLessThan(1e-4);
    }
    expect(Object.keys(c.bones)).toContain('head');
    console.log(`cat: ${pos.count} verts, ${ms.toFixed(0)} ms`);
  });
});
