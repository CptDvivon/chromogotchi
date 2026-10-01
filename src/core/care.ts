// The care simulation: needs, waste, sickness, sleep, bond, health — plus the
// food bowl the pet eats from on its own schedule, and its wants.
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
  mood: number; // happiness: 0 broken … 50 stable … 100 elated
  health: number;
}

export type FoodKind = 'paste' | 'scraps' | 'treat';

/** Things the pet can want; shown as a thought bubble. */
export type WantKind = 'food' | 'treat' | 'sleep' | 'dark' | 'play' | 'affection' | 'clean' | 'meds';

export interface PetState {
  needs: Needs;
  bond: number;
  waste: number;
  /** Food waiting to become waste. */
  digest: number;
  sick: boolean;
  asleep: boolean;
  lightsOn: boolean;
  /** What's in the bowl; amount is in portions (0..1). */
  bowl: { kind: FoodKind | null; amount: number };
  eating: boolean;
  want: { kind: WantKind; since: number } | null;
  /** Game-time ms when PLAY / petting are available again. */
  playReadyAt: number;
  petReadyAt: number;
  /** A chosen nap lasts at least until this game time. */
  restUntil: number;
  /** Game-time ms of the last simulated minute. */
  simTime: number;
  /** Minutes of good vs. poor care (shapes the adult form in M5). */
  care: { good: number; poor: number };
}

export type CareEventKind =
  | 'fellAsleep' | 'wokeUp' | 'pooped' | 'gotSick' | 'starving' | 'filthy'
  | 'exhausted' | 'miserable' | 'critical' | 'napped' | 'ate' | 'finishedBowl'
  | 'wanted' | 'wantIgnored';

export interface CareEvent { at: number; kind: CareEventKind; want?: WantKind }

const MAX_WASTE = 5;
const PLAY_COOLDOWN = 20 * 60000;
const PET_COOLDOWN = 20000;
const WANT_EXPIRES = 3 * 60 * 60000;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Rats and raccoons are nocturnal: they sleep through the day. */
export const NOCTURNAL: Record<Species, boolean> = { cat: false, dog: false, rat: true, raccoon: true };
/** Greedy species eat (and crave food) even when they aren't hungry. */
const GREEDY: Record<Species, number> = { cat: 0.6, dog: 1.6, rat: 1.2, raccoon: 2 };

export function inSleepWindow(species: Species, hour: number): boolean {
  return NOCTURNAL[species] ? hour >= 9 && hour < 17 : hour >= 23 || hour < 7;
}

export function newPetState(now: number): PetState {
  return {
    needs: { hunger: 70, hygiene: 90, energy: 80, mood: 60, health: 100 },
    bond: 10,
    waste: 0,
    digest: 0,
    sick: false,
    asleep: false,
    lightsOn: true,
    bowl: { kind: null, amount: 0 },
    eating: false,
    want: null,
    playReadyAt: 0,
    petReadyAt: 0,
    restUntil: 0,
    simTime: now,
    care: { good: 0, poor: 0 },
  };
}

/** Fills fields added after a save was written. */
export function upgradePetState(s: Partial<PetState> & Pick<PetState, 'needs' | 'simTime'>): PetState {
  return { ...newPetState(s.simTime), ...s } as PetState;
}

/** Bigger, bulkier bodies get hungry faster. */
function appetite(g: Genome): number {
  return 0.75 + 0.25 * g.body.size * g.body.bulk + (g.species === 'dog' ? 0.1 : 0);
}

const FOOD: Record<FoodKind, { hunger: number; mood: number; health: number; digest: number; label: string }> = {
  paste: { hunger: 30, mood: -2, health: 0, digest: 10, label: 'NUTRIENT PASTE' },
  scraps: { hunger: 40, mood: 6, health: 0, digest: 15, label: 'MEAT SCRAPS' },
  treat: { hunger: 12, mood: 20, health: -4, digest: 5, label: 'SYNTH TREAT' },
};
/** Portions eaten per minute: a full bowl takes two minutes. */
const BITE = 0.5;

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

function bump(s: PetState, k: keyof Needs, v: number) {
  s.needs[k] = clamp(s.needs[k] + v);
}

/** If the pet wanted this, it's satisfied: happier, more bonded. */
function satisfy(s: PetState, kind: WantKind): boolean {
  if (s.want?.kind !== kind) return false;
  s.want = null;
  bump(s, 'mood', 8);
  s.bond = Math.min(100, s.bond + 0.5);
  return true;
}

function stepMinute(s: PetState, g: Genome, app: number, events: CareEvent[]) {
  const n = s.needs;
  const before = { ...n };
  const t = s.simTime;
  const rng = new Rng(`${g.seed}:${t}`);
  const hour = hourOf(t);
  const window = inSleepWindow(g.species, hour);
  const H = 1 / 60; // per-hour rates → per minute

  // Sleep / wake. A pet that wants to sleep naps as soon as the lights go off.
  const wantsNap = s.want?.kind === 'sleep' && !s.lightsOn;
  if (!s.asleep && ((window && n.energy < 90) || n.energy < 8 || wantsNap)) {
    s.asleep = true;
    s.eating = false;
    events.push({ at: t, kind: window ? 'fellAsleep' : 'napped' });
    if (satisfy(s, 'sleep')) s.restUntil = t + 90 * 60000;
  } else if (s.asleep && t >= s.restUntil && ((!window && n.energy > 60) || n.energy >= 100)) {
    s.asleep = false;
    events.push({ at: t, kind: 'wokeUp' });
    if (s.want?.kind === 'dark') s.want = null;
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

  // Eating from the bowl, on the pet's own schedule.
  if (!s.asleep && s.bowl.amount > 0 && s.bowl.kind) {
    if (!s.eating) {
      const kind = s.bowl.kind;
      const hungerPull = n.hunger < 30 ? 0.9 : n.hunger < 50 ? 0.45 : n.hunger < 75 ? 0.12 : 0.012 * GREEDY[g.species];
      const wanted = s.want?.kind === 'food' || (s.want?.kind === 'treat' && kind === 'treat');
      const p = wanted ? 0.9 : hungerPull * (kind === 'treat' ? 2 : 1);
      if (rng.chance(p)) {
        s.eating = true;
        events.push({ at: t, kind: 'ate' });
        satisfy(s, 'food') || (kind === 'treat' && satisfy(s, 'treat'));
      }
    }
    if (s.eating) {
      const f = FOOD[s.bowl.kind];
      const bite = Math.min(BITE, s.bowl.amount);
      // Overeating past full still digests (more waste) but stops adding fullness.
      n.hunger += f.hunger * bite;
      n.mood += f.mood * bite;
      n.health += f.health * bite;
      s.digest += f.digest * bite;
      s.bowl.amount = Math.max(0, s.bowl.amount - bite);
      if (s.bowl.amount <= 0.001) {
        s.bowl = { kind: null, amount: 0 };
        s.eating = false;
        events.push({ at: t, kind: 'finishedBowl' });
      } else if (n.hunger >= 98 && rng.chance(0.7 / GREEDY[g.species])) {
        s.eating = false; // full: walks away from the rest
      }
    }
  } else {
    s.eating = false;
  }

  // Digestion → waste.
  if (s.digest >= 30 && !s.asleep && !s.eating && s.waste < MAX_WASTE) {
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

  updateWants(s, g, rng, events);

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

/**
 * Wants come from needs *and* personality: a lazy pet wants to sleep with
 * energy to spare, a greedy one wants food on a full belly.
 */
function updateWants(s: PetState, g: Genome, rng: Rng, events: CareEvent[]) {
  const n = s.needs;
  const t = s.simTime;
  const H = 1 / 60;
  if (s.want) {
    // Already met by circumstance?
    const k = s.want.kind;
    if ((k === 'dark' && (!s.lightsOn || !s.asleep)) || (k === 'clean' && s.waste === 0) || (k === 'meds' && !s.sick) || (k === 'sleep' && s.asleep)) {
      s.want = null;
      return;
    }
    // Ignored wants make it sulk, and eventually it gives up.
    n.mood -= 1.5 * H;
    if (t - s.want.since > WANT_EXPIRES) {
      events.push({ at: t, kind: 'wantIgnored', want: k });
      s.want = null;
      n.mood -= 5;
      s.bond = Math.max(0, s.bond - 1);
    }
    return;
  }
  if (s.asleep) {
    if (s.lightsOn && rng.chance(0.08)) s.want = { kind: 'dark', since: t };
    return;
  }
  if (s.sick && rng.chance(0.1)) {
    s.want = { kind: 'meds', since: t };
    events.push({ at: t, kind: 'wanted', want: 'meds' });
    return;
  }
  if (!rng.chance(0.04)) return;
  const temper = g.temperament;
  const playFactor = { curious: 2, vicious: 1.2, skittish: 0.8, lazy: 0.3 }[temper];
  const weights: [WantKind, number][] = [
    ['food', n.hunger < 40 ? 6 : 0.25 * GREEDY[g.species]],
    ['treat', n.hunger > 40 ? (temper === 'curious' || temper === 'vicious' ? 0.5 : 0.25) : 0],
    ['sleep', n.energy < 30 ? 5 : temper === 'lazy' ? 0.9 : 0.1],
    ['play', n.energy > 35 ? (n.mood < 60 ? 2 : 0.8) * playFactor : 0],
    ['affection', (s.bond > 30 ? 1 : 0.4) * (temper === 'skittish' ? 0.3 : temper === 'vicious' ? 0.4 : 1)],
    ['clean', s.waste > 0 ? 2 * (g.species === 'cat' ? 2 : 1) : 0],
  ];
  const kind = rng.weighted(weights.filter(([, w]) => w > 0));
  s.want = { kind, since: t };
  events.push({ at: t, kind: 'wanted', want: kind });
}

// ---------------------------------------------------------------- actions

export interface ActionResult { ok: boolean; message: string }

const DONE = ' // SUBJECT SATISFIED';

/** Fill the bowl. The pet eats when it decides to. */
export function feed(s: PetState, kind: FoodKind): ActionResult {
  if (s.bowl.kind === kind && s.bowl.amount >= 0.99) return { ok: false, message: 'BOWL ALREADY FULL' };
  const replaced = s.bowl.kind && s.bowl.kind !== kind && s.bowl.amount > 0;
  s.bowl = { kind, amount: 1 };
  s.eating = false;
  return { ok: true, message: `${replaced ? 'BOWL REFILLED' : 'BOWL FILLED'} // ${FOOD[kind].label}` };
}

export function clean(s: PetState): ActionResult {
  if (s.waste === 0 && s.needs.hygiene > 80) return { ok: false, message: 'DEN ALREADY CLEAN' };
  const had = s.waste;
  s.waste = 0;
  bump(s, 'hygiene', 45);
  bump(s, 'mood', -3);
  if (had > 0) s.bond = Math.min(100, s.bond + 0.3);
  const ok = satisfy(s, 'clean');
  return { ok: true, message: (had ? `HOSED DOWN // ${had} PILE${had > 1 ? 'S' : ''} REMOVED` : 'SUBJECT HOSED DOWN') + (ok ? DONE : '') };
}

/** Minutes until PLAY is available again (0 = ready). */
export function playCooldown(s: PetState, now: number): number {
  return Math.max(0, Math.ceil((s.playReadyAt - now) / 60000));
}

export function play(s: PetState, g: Genome, now: number): ActionResult {
  if (s.asleep) return { ok: false, message: 'SUBJECT ASLEEP' };
  const wait = playCooldown(s, now);
  if (wait > 0) return { ok: false, message: `SUBJECT WINDED // READY IN ${wait}M` };
  if (s.needs.energy < 15) return { ok: false, message: 'SUBJECT TOO TIRED TO PLAY' };
  const gain = { curious: 28, vicious: 22, skittish: 16, lazy: 12 }[g.temperament];
  bump(s, 'mood', gain);
  bump(s, 'energy', -10);
  bump(s, 'hunger', -5);
  s.bond = Math.min(100, s.bond + 1);
  s.playReadyAt = now + PLAY_COOLDOWN;
  const ok = satisfy(s, 'play');
  return { ok: true, message: 'LASER ENGAGED // DRAG TO STEER' + (ok ? DONE : '') };
}

export function pet(s: PetState, g: Genome, now: number): ActionResult {
  if (s.asleep) return { ok: false, message: 'SUBJECT ASLEEP // DO NOT TOUCH' };
  if (now < s.petReadyAt) return { ok: false, message: 'SUBJECT HAS HAD ENOUGH' };
  s.petReadyAt = now + PET_COOLDOWN;
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
  const ok = satisfy(s, 'affection');
  return { ok: true, message: (g.species === 'cat' ? 'SUBJECT PURRS' : g.species === 'dog' ? 'TAIL WAG DETECTED' : 'SUBJECT CHITTERS') + (ok ? DONE : '') };
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
  if (s.want?.kind === 'meds') s.want = null;
  return { ok: true, message: 'INFECTION SUPPRESSED' };
}

export function setLights(s: PetState, on: boolean): string {
  s.lightsOn = on;
  if (!on && satisfy(s, 'dark')) return 'LIGHTS OFF' + DONE;
  return on ? 'LIGHTS ON' : 'LIGHTS OFF // ROOM DIMMED';
}

/** Happiness words for the mood gauge. */
export function moodLabel(mood: number): string {
  if (mood < 15) return 'BROKEN';
  if (mood < 35) return 'SULLEN';
  if (mood < 65) return 'STABLE';
  if (mood < 85) return 'CONTENT';
  return 'ELATED';
}
