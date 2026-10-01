import { describe, expect, it } from 'vitest';
import { hatchProgress, hatchStage } from './session';
import { podReadout } from './podReadout';
import { generateGenome } from './genome';

describe('hatching', () => {
  it('progresses with wall-clock time and clamps', () => {
    expect(hatchProgress(1000, 1000, 60000)).toBe(0);
    expect(hatchProgress(0, 30000, 60000)).toBe(0.5);
    expect(hatchProgress(0, 999999, 60000)).toBe(1);
  });

  it('walks through the four stages in order', () => {
    const stages = [0, 0.35, 0.7, 0.95].map(hatchStage);
    expect(stages).toEqual(['dormant', 'stirring', 'breaching', 'emergence']);
  });
});

describe('podReadout', () => {
  it('is deterministic and plausible', () => {
    const g = generateGenome('POD1');
    const r = podReadout(g);
    expect(podReadout(g)).toEqual(r);
    expect(r.activity).toBeGreaterThanOrEqual(1);
    expect(r.activity).toBeLessThanOrEqual(5);
    expect(r.massKg).toBeGreaterThan(0);
    expect(r.irregular).toBe(g.tier !== 'common');
  });
});
