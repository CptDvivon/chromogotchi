// Saves: IndexedDB (survives better than localStorage on iOS), plus a
// copy-paste export code as a manual backup.

import { get, set } from 'idb-keyval';
import { newPetState } from './care';
import { newGame, type GameState } from './session';

export interface SaveData {
  v: 1;
  game: GameState;
  /** Dev fast-forward: game clock = real clock + skew. */
  clockSkew: number;
}

const KEY = 'cg.save';
const EXPORT_PREFIX = 'CHROMO1:';

export function freshSave(): SaveData {
  return { v: 1, game: newGame(), clockSkew: 0 };
}

/** Validates and fills gaps in a save (also migrates M3-era saves). */
export function normalize(data: unknown): SaveData | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SaveData> & { phase?: string };
  // M3 stored the bare GameState in localStorage.
  const game = (d.game ?? (d.phase ? d : null)) as GameState | null;
  if (!game || !['select', 'hatching', 'den'].includes(game.phase)) return null;
  if (game.phase === 'den' && !game.pet) game.pet = newPetState(Date.now());
  return { v: 1, game, clockSkew: typeof d.clockSkew === 'number' ? d.clockSkew : 0 };
}

export async function loadSave(): Promise<SaveData> {
  try {
    const stored = normalize(await get(KEY));
    if (stored) return stored;
  } catch {
    /* IndexedDB unavailable: fall through */
  }
  try {
    const legacy = localStorage.getItem('cg.game');
    const migrated = legacy ? normalize(JSON.parse(legacy)) : null;
    if (migrated) return migrated;
  } catch {
    /* ignore */
  }
  return freshSave();
}

export async function writeSave(data: SaveData): Promise<void> {
  try {
    await set(KEY, JSON.parse(JSON.stringify(data)));
  } catch {
    /* storage unavailable: progress won't persist */
  }
}

/** Ask the browser not to evict our storage (helps on iOS home-screen apps). */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export function exportSave(data: SaveData): string {
  const json = JSON.stringify(data);
  return EXPORT_PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

export function importSave(code: string): SaveData | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(EXPORT_PREFIX)) return null;
  try {
    const bin = atob(trimmed.slice(EXPORT_PREFIX.length));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return normalize(JSON.parse(json));
  } catch {
    return null;
  }
}
