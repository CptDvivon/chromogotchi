// Game flow: choose a pod → hatch it → live with the pet. Persisted locally.
// (M4 moves saves to IndexedDB with export/import; this stays the flow model.)

import { CONFIG } from './config';
import { randomSeed } from './rng';

export type GameState =
  | { phase: 'select'; pods: string[] }
  | { phase: 'hatching'; seed: string; startedAt: number }
  | { phase: 'den'; seed: string; hatchedAt: number; source?: 'starter' | 'dealer' };

const KEY = 'cg.game';

export function newGame(): GameState {
  return { phase: 'select', pods: [randomSeed(), randomSeed(), randomSeed()] };
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as GameState;
  } catch {
    /* fall through to a fresh game */
  }
  return newGame();
}

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress won't persist */
  }
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
