import { describe, expect, it } from 'vitest';
import { clean, feed, inSleepWindow, medicate, newPetState, pet, play, playCooldown, setLights, simulate } from './care';
import { generateGenome } from './genome';
import { buildReport } from './report';

const MIN = 60000;
const HOUR = 60 * MIN;
// A fixed local midday so sleep windows are predictable.
const NOON = new Date(2026, 9, 1, 12, 0, 0).getTime();

function genomeOf(species: string) {
  for (let i = 0; i < 2000; i++) {
    const g = generateGenome(`C${i}`);
    if (g.species === species) return g;
  }
  throw new Error('no ' + species);
}

describe('care simulation', () => {
  const g = genomeOf('cat');

  it('is deterministic (offline catch-up = live play)', () => {
    const a = newPetState(NOON);
    const b = newPetState(NOON);
    feed(a, 'scraps');
    feed(b, 'scraps');
    simulate(a, g, NOON + 30 * HOUR);
    for (let t = NOON; t < NOON + 30 * HOUR; t += 17 * MIN) simulate(b, g, t);
    simulate(b, g, NOON + 30 * HOUR);
    expect(b).toEqual(a);
  });

  it('feeding fills the bowl; hunger rises only as the pet eats', () => {
    const s = newPetState(NOON);
    s.needs.hunger = 25;
    feed(s, 'scraps');
    expect(s.needs.hunger).toBe(25);
    expect(s.bowl.amount).toBe(1);
    const events = simulate(s, g, NOON + 10 * MIN);
    expect(events.some((e) => e.kind === 'ate')).toBe(true);
    expect(s.needs.hunger).toBeGreaterThan(50);
    expect(s.bowl.amount).toBe(0);
  });

  it('a full pet mostly leaves the bowl alone', () => {
    const s = newPetState(NOON);
    s.needs.hunger = 95;
    feed(s, 'paste');
    simulate(s, g, NOON + 5 * MIN);
    expect(s.bowl.amount).toBe(1);
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
      if (s.bowl.amount === 0) feed(s, 'scraps');
      if (s.waste > 0 || s.needs.hygiene < 60) clean(s);
      if (s.sick) medicate(s);
      if (s.needs.mood < 60) play(s, g, NOON + h * HOUR);
      setLights(s, !s.asleep);
    }
    expect(s.needs.health).toBeGreaterThan(80);
    expect(s.care.good).toBeGreaterThan(s.care.poor);
  });

  it('play has a cooldown and petting cannot be spammed', () => {
    const s = newPetState(NOON);
    expect(play(s, g, NOON).ok).toBe(true);
    expect(play(s, g, NOON + MIN).ok).toBe(false);
    expect(playCooldown(s, NOON + MIN)).toBeGreaterThan(0);
    expect(play(s, g, NOON + 21 * MIN).ok).toBe(true);
    expect(pet(s, g, NOON).ok).toBe(true);
    expect(pet(s, g, NOON + 1000).ok).toBe(false);
  });

  it('forms wants over time, and satisfying one lifts mood', () => {
    const s = newPetState(NOON);
    const events = simulate(s, g, NOON + 6 * HOUR);
    expect(events.some((e) => e.kind === 'wanted')).toBe(true);
    const s2 = newPetState(NOON);
    s2.want = { kind: 'play', since: NOON };
    const mood = s2.needs.mood;
    expect(play(s2, g, NOON).message).toContain('SATISFIED');
    expect(s2.needs.mood).toBeGreaterThan(mood + 20);
    expect(s2.want).toBeNull();
  });

  it('a pet that wants to sleep naps when the lights go off', () => {
    const s = newPetState(NOON);
    s.want = { kind: 'sleep', since: NOON };
    setLights(s, false);
    simulate(s, g, NOON + 2 * MIN);
    expect(s.asleep).toBe(true);
  });

  it('sleeps on schedule: cats at night, rats by day', () => {
    expect(inSleepWindow('cat', 2)).toBe(true);
    expect(inSleepWindow('cat', 12)).toBe(false);
    expect(inSleepWindow('rat', 12)).toBe(true);
    expect(inSleepWindow('rat', 2)).toBe(false);
  });

  it('caps catch-up at a week', () => {
    const s = newPetState(NOON);
    simulate(s, g, NOON + 30 * 24 * HOUR);
    expect(s.simTime).toBe(NOON + 30 * 24 * HOUR);
  });
});
