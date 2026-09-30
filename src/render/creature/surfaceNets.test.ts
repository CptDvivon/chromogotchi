import { describe, expect, it } from 'vitest';
import { ellipsoid, roundCone, unionField } from './sdf';
import { surfaceNets } from './surfaceNets';

describe('surfaceNets', () => {
  it('meshes a sphere with outward-facing triangles', () => {
    const field = unionField([ellipsoid([0, 0, 0], [0.5, 0.5, 0.5], 'b', 'r')]);
    const { positions: p, indices } = surfaceNets(field, [-0.7, -0.7, -0.7], [0.7, 0.7, 0.7], 0.05);
    expect(indices.length).toBeGreaterThan(300);
    let outward = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
      const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
      const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[0] * p[a] + n[1] * p[a + 1] + n[2] * p[a + 2] > 0) outward++;
    }
    expect(outward / (indices.length / 3)).toBeGreaterThan(0.99);
    for (let i = 0; i < p.length; i += 3) {
      expect(Math.abs(Math.hypot(p[i], p[i + 1], p[i + 2]) - 0.5)).toBeLessThan(0.03);
    }
  });

  it('round cone distance is ~0 on its surface', () => {
    const c = roundCone([0, 0, 0], [0, 1, 0], 0.3, 0.1, 'b', 'r');
    expect(Math.abs(c.dist(0.3, 0, 0))).toBeLessThan(0.02);
    expect(Math.abs(c.dist(0, 1.1, 0))).toBeLessThan(0.02);
    expect(c.dist(0, 0.5, 0)).toBeLessThan(0);
  });
});
