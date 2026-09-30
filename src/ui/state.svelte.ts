// Shared UI state (Svelte 5 runes).

import type { PipelineSettings } from '../render/pixelPipeline';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const pipeline: PipelineSettings = $state(load('cg.pipeline', {
  lowHeight: 240,
  dither: true,
  quantize: true,
  crt: true,
  flicker: !reducedMotion,
}));

export const dev = $state({
  open: false,
  fps: 0,
  buildMs: 0,
  /** Game-time multiplier; drives needs and ageing from M4. */
  timeScale: load('cg.timeScale', 1),
  /** Which pod source rerolls use (dealer pods can be Rare+). */
  source: 'starter' as 'starter' | 'dealer',
});
