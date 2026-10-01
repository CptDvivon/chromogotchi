import { describe, expect, it } from 'vitest';
import { clean, feed, inSleepWindow, medicate, newPetState, play, simulate } from './care';
import { generateGenome } from './genome';
import { buildReport } from './report';

const MIN = 60000;
const HOUR = 60 * MIN;
// A fixed local midday so sleep windows are predictable.
const NOON = new Date(2026, 9, 1, 12, 0, 0).getTime();

function catGenome() {
  for (let i = 0; i < 500; i++) {
    const g = generateGenome(`C${i}`);
    if (g.species === 'cat') return g;
  }
  throw new Error('no cat');
}

describe('care simulation', () => {
  const g = catGenome();

  it('is deterministic (offline catch-up = live play)', () => {
    const a = newPetState(NOON);
    const b = newPetState(NOON);
    simulate(a, g, NOON + 30 * HOUR);
    for (let t = NOON; t < NOON + 30 * HOUR; t += 17 * MIN) simulate(b, g, t);
    simulate(b, g, NOON + 30 * HOUR);
    expect(b).toEqual(a);
  });

  it('a neglected pet declines over a day and a half', () => {
    const s = newPetState(NOON);
    const events = simulate(s, g, NOON + 36 * HOUR);
    expect(s.needs.hunger).toBeLessThan(10);
    expect(s.needs.health).toBeLessThan(70);
    expect(events.some((e) => e.kind === 'starving')).toBe(true);
    expect(buildReport(events, g.seed).length).toBeGreaterThan(2);
  });

  it('a well-kept pet stays healthy', () => {
    const s = newPetState(NOON);
    for (let h = 0; h < 72; h += 3) {
      simulate(s, g, NOON + h * HOUR);
      if (s.needs.hunger < 60) feed(s, 'scraps');
      if (s.waste > 0 || s.needs.hygiene < 60) clean(s);
      if (s.sick) medicate(s);
      if (s.needs.mood < 60) play(s, g);
      s.lightsOn = !s.asleep;
    }
    expect(s.needs.health).toBeGreaterThan(80);
    expect(s.care.good).toBeGreaterThan(s.care.poor);
  });

  it('sleeps on schedule: cats at night, rats by day', () => {
    expect(inSleepWindow('cat', 2)).toBe(true);
    expect(inSleepWindow('cat', 12)).toBe(false);
    expect(inSleepWindow('rat', 12)).toBe(true);
    expect(inSleepWindow('rat', 2)).toBe(false);
  });

  it('refuses food when full or asleep', () => {
    const s = newPetState(NOON);
    s.needs.hunger = 95;
    expect(feed(s, 'paste').ok).toBe(false);
    s.needs.hunger = 40;
    s.asleep = true;
    expect(feed(s, 'paste').ok).toBe(false);
  });

  it('caps catch-up at a week', () => {
    const s = newPetState(NOON);
    simulate(s, g, NOON + 30 * 24 * HOUR);
    expect(s.simTime).toBe(NOON + 30 * 24 * HOUR);
  });
});
