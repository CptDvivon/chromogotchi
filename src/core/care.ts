// The care simulation: needs, waste, sickness, sleep, bond and health.
// Pure and deterministic, stepped in game minutes, so time spent away can be
// caught up exactly when the app is reopened.

import type { Genome } from './genome';
import { Rng } from './rng';
import type { Species } from './species';
import { hourOf } from './world';

export interface Needs {
  hunger: number; // 100 = full
  hygiene: number;
  energy: number;
  mood: number;
  health: number;
}

export interface PetState {
  needs: Needs;
  bond: number;
  waste: number;
  /** Food waiting to become waste. */
  digest: number;
  sick: boolean;
  asleep: boolean;
  lightsOn: boolean;
  /** Game-time ms of the last simulated minute. */
  simTime: number;
  /** Minutes of good vs. poor care (shapes the adult form in M5). */
  care: { good: number; poor: number };
}

export type CareEventKind =
  | 'fellAsleep' | 'wokeUp' | 'pooped' | 'gotSick' | 'starving' | 'filthy'
  | 'exhausted' | 'miserable' | 'critical' | 'napped';

export interface CareEvent { at: number; kind: CareEventKind }

export type FoodKind = 'paste' | 'scraps' | 'treat';

const MAX_WASTE = 5;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Rats and raccoons are nocturnal: they sleep through the day. */
export const NOCTURNAL: Record<Species, boolean> = { cat: false, dog: false, rat: true, raccoon: true };

export function inSleepWindow(species: Species, hour: number): boolean {
  return NOCTURNAL[species] ? hour >= 9 && hour < 17 : hour >= 23 || hour < 7;
}

export function newPetState(now: number): PetState {
  return {
    needs: { hunger: 70, hygiene: 90, energy: 80, mood: 70, health: 100 },
    bond: 10,
    waste: 0,
    digest: 0,
    sick: false,
    asleep: false,
    lightsOn: true,
    simTime: now,
    care: { good: 0, poor: 0 },
  };
}

/** Bigger, bulkier bodies get hungry faster. */
function appetite(g: Genome): number {
  return 0.75 + 0.25 * g.body.size * g.body.bulk + (g.species === 'dog' ? 0.1 : 0);
}

/**
 * Advances the pet by whole game minutes up to `until`. Returns notable events.
 * Mutates `s`.
 */
export function simulate(s: PetState, g: Genome, until: number, maxMinutes = 7 * 24 * 60): CareEvent[] {
  const events: CareEvent[] = [];
  const minutes = Math.min(maxMinutes, Math.floor((until - s.simTime) / 60000));
  if (minutes <= 0) return events;
  if (minutes === maxMinutes) s.simTime = until - maxMinutes * 60000;
  const app = appetite(g);
  for (let i = 0; i < minutes; i++) {
    s.simTime += 60000;
    stepMinute(s, g, app, events);
  }
  return events;
}

function crossed(before: number, after: number, line: number) {
  return before >= line && after < line;
}

function stepMinute(s: PetState, g: Genome, app: number, events: CareEvent[]) {
  const n = s.needs;
  const before = { ...n };
  const t = s.simTime;
  const rng = new Rng(`${g.seed}:${t}`);
  const hour = hourOf(t);
  const window = inSleepWindow(g.species, hour);
  const H = 1 / 60; // per-hour rates → per minute

  // Sleep / wake.
  if (!s.asleep && ((window && n.energy < 90) || n.energy < 8)) {
    s.asleep = true;
    events.push({ at: t, kind: window ? 'fellAsleep' : 'napped' });
  } else if (s.asleep && ((!window && n.energy > 60) || n.energy >= 100)) {
    s.asleep = false;
    events.push({ at: t, kind: 'wokeUp' });
  }

  if (s.asleep) {
    const restful = s.lightsOn ? 0.5 : 1;
    n.energy += 15 * restful * H;
    n.hunger -= 2.5 * app * H;
    n.mood -= (s.lightsOn ? 2 : 0) * H;
  } else {
    n.energy -= 6.5 * H;
    n.hunger -= 7 * app * H;
    n.mood -= (2.5 + (s.lightsOn ? 0 : 2)) * H;
  }
  n.hygiene -= (2 + 6 * s.waste) * H;
  if (n.hunger < 30) n.mood -= 4 * H;
  if (n.hygiene < 30) n.mood -= 3 * H;
  if (s.sick) n.mood -= 4 * H;

  // Digestion → waste.
  if (s.digest >= 30 && !s.asleep && s.waste < MAX_WASTE) {
    s.digest -= 30;
    s.waste++;
    events.push({ at: t, kind: 'pooped' });
  }

  // Sickness.
  if (!s.sick) {
    const p = 0.00002 + 0.0002 * s.waste + (n.hygiene < 25 ? 0.0004 : 0) + (n.health < 40 ? 0.0002 : 0);
    if (rng.chance(p)) {
      s.sick = true;
      events.push({ at: t, kind: 'gotSick' });
    }
  }

  // Health: drained by deprivation and sickness, slowly restored by good care.
  let dmg = 0;
  if (n.hunger < 15) dmg += 4;
  if (n.hygiene < 15) dmg += 3;
  if (n.energy < 5) dmg += 2;
  if (s.sick) dmg += 3;
  if (dmg > 0) n.health -= dmg * H;
  else if (n.hunger > 50 && n.hygiene > 50 && n.energy > 30) n.health += 1.5 * H;

  for (const k of Object.keys(n) as (keyof Needs)[]) n[k] = clamp(n[k]);

  // Bond fades under neglect.
  const avg = (n.hunger + n.hygiene + n.energy + n.mood) / 4;
  if (avg < 30) s.bond = Math.max(0, s.bond - 0.5 * H);
  if (avg >= 55 && n.health > 60) s.care.good++;
  else if (avg < 35 || n.health < 40) s.care.poor++;

  if (crossed(before.hunger, n.hunger, 20)) events.push({ at: t, kind: 'starving' });
  if (crossed(before.hygiene, n.hygiene, 20)) events.push({ at: t, kind: 'filthy' });
  if (crossed(before.energy, n.energy, 10)) events.push({ at: t, kind: 'exhausted' });
  if (crossed(before.mood, n.mood, 20)) events.push({ at: t, kind: 'miserable' });
  if (crossed(before.health, n.health, 15)) events.push({ at: t, kind: 'critical' });
}

// ---------------------------------------------------------------- actions

export interface ActionResult { ok: boolean; message: string }

const FOOD: Record<FoodKind, { hunger: number; mood: number; health: number; digest: number; label: string }> = {
  paste: { hunger: 25, mood: -2, health: 0, digest: 10, label: 'NUTRIENT PASTE' },
  scraps: { hunger: 35, mood: 6, health: 0, digest: 15, label: 'MEAT SCRAPS' },
  treat: { hunger: 10, mood: 20, health: -4, digest: 5, label: 'SYNTH TREAT' },
};

function bump(s: PetState, k: keyof Needs, v: number) {
  s.needs[k] = clamp(s.needs[k] + v);
}

export function feed(s: PetState, kind: FoodKind): ActionResult {
  if (s.asleep) return { ok: false, message: 'SUBJECT ASLEEP // FEEDING DEFERRED' };
  if (s.needs.hunger > 92 && kind !== 'treat') return { ok: false, message: 'SUBJECT REFUSES // STOMACH FULL' };
  const f = FOOD[kind];
  const wasHungry = s.needs.hunger < 50;
  bump(s, 'hunger', f.hunger);
  bump(s, 'mood', f.mood);
  bump(s, 'health', f.health);
  s.digest += f.digest;
  if (wasHungry) s.bond = Math.min(100, s.bond + 0.5);
  return { ok: true, message: `${f.label} DISPENSED` };
}

export function clean(s: PetState): ActionResult {
  if (s.waste === 0 && s.needs.hygiene > 80) return { ok: false, message: 'DEN ALREADY CLEAN' };
  const had = s.waste;
  s.waste = 0;
  bump(s, 'hygiene', 45);
  bump(s, 'mood', -3);
  if (had > 0) s.bond = Math.min(100, s.bond + 0.3);
  return { ok: true, message: had ? `HOSED DOWN // ${had} PILE${had > 1 ? 'S' : ''} REMOVED` : 'SUBJECT HOSED DOWN' };
}

export function play(s: PetState, g: Genome): ActionResult {
  if (s.asleep) return { ok: false, message: 'SUBJECT ASLEEP' };
  if (s.needs.energy < 15) return { ok: false, message: 'SUBJECT TOO TIRED TO PLAY' };
  const gain = { curious: 28, vicious: 22, skittish: 16, lazy: 12 }[g.temperament];
  bump(s, 'mood', gain);
  bump(s, 'energy', -10);
  bump(s, 'hunger', -5);
  s.bond = Math.min(100, s.bond + 1);
  return { ok: true, message: 'PLAY SESSION LOGGED' };
}

export function pet(s: PetState, g: Genome): ActionResult {
  if (s.asleep) return { ok: false, message: 'SUBJECT ASLEEP // DO NOT TOUCH' };
  if (g.temperament === 'skittish' && s.bond < 30) {
    bump(s, 'mood', -2);
    return { ok: true, message: 'SUBJECT FLINCHES AWAY' };
  }
  if (g.temperament === 'vicious' && s.bond < 30) {
    bump(s, 'mood', 1);
    return { ok: true, message: 'SUBJECT BITES // TOLERATED' };
  }
  bump(s, 'mood', 4);
  s.bond = Math.min(100, s.bond + 0.2);
  return { ok: true, message: g.species === 'cat' ? 'SUBJECT PURRS' : g.species === 'dog' ? 'TAIL WAG DETECTED' : 'SUBJECT CHITTERS' };
}

export function medicate(s: PetState): ActionResult {
  if (!s.sick) {
    bump(s, 'health', -5);
    bump(s, 'mood', -5);
    return { ok: true, message: 'UNNECESSARY DOSE // SIDE EFFECTS' };
  }
  s.sick = false;
  bump(s, 'health', 10);
  bump(s, 'mood', -5);
  return { ok: true, message: 'INFECTION SUPPRESSED' };
}

export function setLights(s: PetState, on: boolean) {
  s.lightsOn = on;
}
