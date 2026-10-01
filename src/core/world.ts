// The world clock (real local time, optionally fast-forwarded in dev) and
// daily weather.

import { Rng } from './rng';

export type DayPhase = 'night' | 'dawn' | 'day' | 'dusk';
export type Weather = 'clear' | 'drizzle' | 'rain' | 'fog';

/** Local hour as a float 0..24 for a timestamp. */
export function hourOf(t: number): number {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function dayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** 0 at midnight, 1 at midday: how much daylight there is. */
export function daylight(hour: number): number {
  const s = Math.sin(((hour - 6) / 12) * Math.PI);
  return Math.max(0, Math.min(1, s * 1.4));
}

/** 0..1 peaking around sunrise (≈6:30) and sunset (≈18:30). */
export function twilight(hour: number): number {
  return Math.max(0, 1 - Math.abs(hour - 6.5) / 1.5, 1 - Math.abs(hour - 18.5) / 1.5);
}

/** Weather for a given local day; stable for the whole day. */
export function weatherOn(t: number): Weather {
  const d = new Date(t);
  const rng = new Rng(`weather:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  return rng.weighted<Weather>([['rain', 4], ['drizzle', 3], ['fog', 2], ['clear', 2]]);
}
