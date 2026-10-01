// Game flow: choose a pod → hatch it → live with the pet.

import { CONFIG } from './config';
import type { PetState } from './care';
import { randomSeed } from './rng';

export type GameState =
  | { phase: 'select'; pods: string[] }
  | { phase: 'hatching'; seed: string; startedAt: number }
  | { phase: 'den'; seed: string; hatchedAt: number; source?: 'starter' | 'dealer'; pet: PetState };

export function newGame(): GameState {
  return { phase: 'select', pods: [randomSeed(), randomSeed(), randomSeed()] };
}

export type HatchStage = 'dormant' | 'stirring' | 'breaching' | 'emergence';

/** Hatch progress 0..1 from wall-clock time (keeps going while the app is closed). */
export function hatchProgress(startedAt: number, now = Date.now(), hatchMs: number = CONFIG.hatchMs): number {
  return Math.max(0, Math.min(1, (now - startedAt) / hatchMs));
}

export function hatchStage(p: number): HatchStage {
  if (p < 0.3) return 'dormant';
  if (p < 0.6) return 'stirring';
  if (p < 0.92) return 'breaching';
  return 'emergence';
}
