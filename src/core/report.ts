// "While you were gone": turns care events into a terse, darkly funny log.

import type { CareEvent, CareEventKind, Needs, WantKind } from './care';
import { Rng } from './rng';

const LINES: Record<CareEventKind, string[]> = {
  fellAsleep: ['Subject curled up and slept.', 'Lights out for the subject. Snoring logged.'],
  napped: ['Subject collapsed into a nap.', 'Subject passed out mid-step.'],
  wokeUp: ['Subject awake. Staring at the wall.', 'Subject woke and checked the bowl.'],
  pooped: ['Waste deposited on the floor.', 'Subject relieved itself. Floor compromised.', 'New biohazard in sector 0.'],
  gotSick: ['Subject sneezing. Possible infection.', 'Fever detected. Subject listless.'],
  starving: ['Subject gnawing on the bedding.', 'Hunger critical. Subject licking the empty bowl.'],
  filthy: ['Den hygiene below tolerance. Flies arriving.', 'Smell reported by neighbours.'],
  exhausted: ['Subject running on fumes.', 'Subject too tired to stand.'],
  miserable: ['Subject sulking in the corner.', 'Subject stopped responding to its name.'],
  critical: ['VITALS CRITICAL. Intervention required.', 'Subject failing. Intervention required.'],
  ate: ['Subject ate from the bowl.', 'Subject wolfed down the bowl.'],
  finishedBowl: ['Bowl licked clean.'],
  wanted: [],
  wantIgnored: [],
};

const IGNORED: Record<WantKind, string> = {
  food: 'Subject begged for food. Nobody came.',
  treat: 'Subject craved a treat. Craving denied.',
  sleep: 'Subject wanted the lights off to nap. Ignored.',
  dark: 'Subject tried to sleep under the glare.',
  play: 'Subject wanted to play. Gave up waiting.',
  affection: 'Subject waited to be touched. Nothing.',
  clean: 'Subject pawed at its own filth, disgusted.',
  meds: 'Subject wanted relief. Still suffering.',
};

export interface ReportLine { at: number; text: string }

export function buildReport(events: CareEvent[], seed: string): ReportLine[] {
  const rng = new Rng(`${seed}:report:${events[0]?.at ?? 0}`);
  const lines: ReportLine[] = [];
  let poops = 0;
  for (const e of events) {
    if (e.kind === 'pooped') {
      poops++;
      continue;
    }
    if (e.kind === 'wanted' || e.kind === 'finishedBowl') continue;
    if (e.kind === 'wantIgnored') {
      lines.push({ at: e.at, text: IGNORED[e.want ?? 'food'] });
      continue;
    }
    lines.push({ at: e.at, text: rng.pick(LINES[e.kind]) });
  }
  if (poops) {
    const last = [...events].reverse().find((e) => e.kind === 'pooped')!;
    lines.push({ at: last.at, text: poops > 1 ? `Waste deposited ×${poops}. Floor compromised.` : rng.pick(LINES.pooped) });
  }
  lines.sort((a, b) => a.at - b.at);
  // Keep the log readable: the most recent dozen lines.
  return lines.slice(-12);
}

export function needDeltas(before: Needs, after: Needs): { key: keyof Needs; delta: number }[] {
  return (Object.keys(before) as (keyof Needs)[]).map((key) => ({ key, delta: Math.round(after[key] - before[key]) }));
}
