// Body plans: SDF primitives + skeleton joints for each species, shaped by the
// genome and its mutations. Authored at "unit" scale (roughly cat-sized); the
// species scale is applied to the whole group. Faces +Z, feet on y = 0.

import type { Genome } from '../../core/genome';
import { Rng } from '../../core/rng';
import type { Species } from '../../core/species';
import { ellipsoid, roundCone, type Primitive, type Vec3 } from './sdf';

export interface BoneDef {
  name: string;
  parent: string | null;
  /** Rest position in body space. */
  pos: Vec3;
}

export interface Anatomy {
  prims: Primitive[];
  bones: BoneDef[];
  eyes: { pos: Vec3; radius: number; second: boolean }[];
  bounds: { min: Vec3; max: Vec3 };
  /** Head centre, used for look-at and face markings. */
  head: Vec3;
  /** Torso centre height. */
  torsoY: number;
  /** Where the tail starts (for tail markings). */
  tailBase: Vec3;
  tailLength: number;
}

type EarKind = 'cone' | 'round' | 'floppy';

interface Plan {
  scale: number;
  legH: number;
  chest: { c: Vec3; r: Vec3 };
  hips: { c: Vec3; r: Vec3 };
  belly: { c: Vec3; r: Vec3 };
  neck: { base: Vec3; r0: number; r1: number };
  head: { c: Vec3; r: Vec3 };
  cheeks: number;
  snout: { len: number; rx: number; ry: number; drop: number };
  nose: number;
  ears: { kind: EarKind; size: number; x: number; up: number };
  front: { x: number; z: number; r: number; knee: number };
  hind: { x: number; z: number; r: number; knee: number; up: number };
  lower: number;
  paw: Vec3;
  tail: { segs: number; segLen: number; r0: number; r1: number; angle: number; curl: number; up: number };
  eye: { r: number; x: number; y: number; z: number };
}

/** Species scale relative to a cat; also drives camera framing. */
export const SPECIES_SCALE: Record<Species, number> = { cat: 1, dog: 1.3, rat: 0.55, raccoon: 1.15 };

function plan(g: Genome): Plan {
  const b = g.body;
  const k = b.bulk;
  const earRng = new Rng(`${g.seed}:ears`);
  switch (g.species) {
    case 'dog': {
      const legH = 0.2 * b.legLength;
      const hy = legH + 0.06 * k;
      const hs = b.headSize;
      return {
        scale: SPECIES_SCALE.dog, legH,
        chest: { c: [0, hy + 0.005, 0.07], r: [0.066 * k, 0.088 * k, 0.11] },
        hips: { c: [0, hy + 0.012, -0.09], r: [0.062 * k, 0.07 * k, 0.1] },
        belly: { c: [0, hy - 0.02, -0.01], r: [0.058 * k, 0.058 * k, 0.12] },
        neck: { base: [0, hy + 0.04, 0.15], r0: 0.05 * k, r1: 0.04 },
        head: { c: [0, hy + 0.12 * b.neckLength, 0.215], r: [0.05 * hs, 0.05 * hs, 0.056 * hs] },
        cheeks: 0.6,
        snout: { len: 0.075 * b.snoutLength, rx: 0.027 * hs, ry: 0.026 * hs, drop: 0.018 },
        nose: 0.012,
        ears: { kind: earRng.chance(0.55) ? 'floppy' : 'cone', size: b.earSize, x: 0.034, up: 0.03 },
        front: { x: 0.044 * k, z: 0.1, r: 0.03 * k, knee: 0.55 },
        hind: { x: 0.046 * k, z: -0.11, r: 0.04 * k, knee: 0.42, up: 0 },
        lower: 0.019,
        paw: [0.022, 0.016, 0.028],
        tail: { segs: 5, segLen: 0.058 * b.tailLength, r0: 0.02, r1: 0.011, angle: 0.75, curl: 0.12, up: 0.04 },
        eye: { r: 0.009 * hs, x: 0.024, y: 0.014, z: 0.043 },
      };
    }
    case 'rat': {
      const legH = 0.075 * b.legLength;
      const hy = legH + 0.055 * k;
      const hs = b.headSize;
      return {
        scale: SPECIES_SCALE.rat, legH,
        chest: { c: [0, hy, 0.05], r: [0.058 * k, 0.06 * k, 0.1] },
        hips: { c: [0, hy + 0.015, -0.08], r: [0.075 * k, 0.074 * k, 0.11] },
        belly: { c: [0, hy - 0.015, -0.03], r: [0.066 * k, 0.058 * k, 0.12] },
        neck: { base: [0, hy + 0.01, 0.12], r0: 0.05 * k, r1: 0.04 },
        head: { c: [0, hy + 0.035 * b.neckLength, 0.18], r: [0.045 * hs, 0.041 * hs, 0.05 * hs] },
        cheeks: 0.3,
        snout: { len: 0.055 * b.snoutLength, rx: 0.021 * hs, ry: 0.019 * hs, drop: 0.012 },
        nose: 0.009,
        ears: { kind: 'round', size: b.earSize * 1.3, x: 0.032, up: 0.03 },
        front: { x: 0.04 * k, z: 0.09, r: 0.022 * k, knee: 0.5 },
        hind: { x: 0.05 * k, z: -0.1, r: 0.038 * k, knee: 0.5, up: 0 },
        lower: 0.014,
        paw: [0.016, 0.012, 0.022],
        tail: { segs: 8, segLen: 0.062 * b.tailLength, r0: 0.016, r1: 0.005, angle: 0.05, curl: -0.03, up: 0.005 },
        eye: { r: 0.009 * hs, x: 0.028, y: 0.012, z: 0.03 },
      };
    }
    case 'raccoon': {
      const legH = 0.1 * b.legLength;
      const hy = legH + 0.075 * k;
      const hs = b.headSize;
      return {
        scale: SPECIES_SCALE.raccoon, legH,
        chest: { c: [0, hy, 0.05], r: [0.075 * k, 0.08 * k, 0.085] },
        hips: { c: [0, hy + 0.05, -0.06], r: [0.09 * k, 0.095 * k, 0.095] },
        belly: { c: [0, hy - 0.01, -0.01], r: [0.08 * k, 0.075 * k, 0.1] },
        neck: { base: [0, hy + 0.03, 0.11], r0: 0.06 * k, r1: 0.055 },
        head: { c: [0, hy + 0.07 * b.neckLength, 0.15], r: [0.068 * hs, 0.056 * hs, 0.055 * hs] },
        cheeks: 1.3,
        snout: { len: 0.042 * b.snoutLength, rx: 0.018 * hs, ry: 0.016 * hs, drop: 0.014 },
        nose: 0.009,
        ears: { kind: 'round', size: b.earSize * 0.95, x: 0.044, up: 0.042 },
        front: { x: 0.048 * k, z: 0.075, r: 0.03 * k, knee: 0.5 },
        hind: { x: 0.056 * k, z: -0.085, r: 0.046 * k, knee: 0.45, up: 0.03 },
        lower: 0.02,
        paw: [0.021, 0.014, 0.027],
        tail: { segs: 5, segLen: 0.055 * b.tailLength, r0: 0.046, r1: 0.04, angle: 0.25, curl: 0.04, up: 0.05 },
        eye: { r: 0.0085 * hs, x: 0.027, y: 0.012, z: 0.045 },
      };
    }
    default: {
      const legH = 0.15 * b.legLength;
      const hy = legH + 0.055 * k;
      const hs = b.headSize * 1.22;
      return {
        scale: SPECIES_SCALE.cat, legH,
        chest: { c: [0, hy + 0.008, 0.06], r: [0.07 * k, 0.08 * k, 0.105] },
        hips: { c: [0, hy + 0.012, -0.075], r: [0.074 * k, 0.078 * k, 0.095] },
        belly: { c: [0, hy - 0.022, -0.01], r: [0.066 * k, 0.062 * k, 0.115] },
        neck: { base: [0, hy + 0.035, 0.14], r0: 0.052 * k, r1: 0.042 },
        head: { c: [0, hy + 0.1 * b.neckLength, 0.2], r: [0.05 * hs, 0.045 * hs, 0.048 * hs] },
        cheeks: 1,
        snout: { len: 0.02 * b.snoutLength, rx: 0.023 * hs, ry: 0.017 * hs, drop: 0.016 * hs },
        nose: 0.009,
        ears: { kind: 'cone', size: b.earSize, x: 0.03 * hs, up: 0.026 * hs },
        front: { x: 0.042 * k, z: 0.095, r: 0.032 * k, knee: 0.55 },
        hind: { x: 0.046 * k, z: -0.1, r: 0.044 * k, knee: 0.4, up: 0 },
        lower: 0.02,
        paw: [0.021, 0.015, 0.027],
        tail: { segs: 5, segLen: 0.058 * b.tailLength, r0: 0.022, r1: 0.013, angle: 0.35, curl: 0.22, up: 0.035 },
        eye: { r: 0.0095 * hs, x: 0.022 * hs, y: 0.008 * hs, z: 0.04 * hs },
      };
    }
  }
}

export function buildAnatomy(g: Genome): Anatomy {
  const p = plan(g);
  const has = (m: string) => g.mutations.includes(m as never);
  const mrng = new Rng(`${g.seed}:mutation-shapes`);
  const hy = p.chest.c[1];
  const prims: Primitive[] = [];
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, hy, 0] },
    { name: 'chest', parent: 'body', pos: [0, hy, 0.05] },
  ];

  // Torso.
  prims.push(ellipsoid(p.chest.c, p.chest.r, 'chest', 'torso'));
  prims.push(ellipsoid(p.hips.c, p.hips.r, 'body', 'torso', 0.05));
  prims.push(ellipsoid(p.belly.c, p.belly.r, 'chest', 'belly', 0.05));

  // Neck + head.
  const hc = p.head.c;
  const hr = p.head.r;
  bones.push({ name: 'head', parent: 'body', pos: p.neck.base });
  prims.push(roundCone(p.neck.base, [0, hc[1] - 0.02, hc[2] - 0.02], p.neck.r0, p.neck.r1, 'head', 'neck', 0.04));
  prims.push(ellipsoid(hc, hr, 'head', 'head', 0.03));
  if (p.cheeks > 0)
    prims.push(ellipsoid([0, hc[1] - hr[1] * 0.3, hc[2] + hr[2] * 0.25], [hr[0] * (0.9 + 0.1 * p.cheeks), hr[1] * 0.7, hr[2] * 0.8], 'head', 'head', 0.02));
  const sn = p.snout;
  const snoutC: Vec3 = [0, hc[1] - sn.drop, hc[2] + hr[2] * 0.75 + sn.len * 0.5];
  prims.push(roundCone([0, snoutC[1] + 0.004, hc[2] + hr[2] * 0.4], [0, snoutC[1] - 0.002, hc[2] + hr[2] * 0.75 + sn.len], sn.ry * 1.1, sn.ry * 0.75, 'head', 'muzzle', 0.02, [sn.ry / sn.rx, 1, 1]));
  const noseC: Vec3 = [0, snoutC[1] + sn.ry * 0.35, hc[2] + hr[2] * 0.75 + sn.len + sn.ry * 0.55];
  prims.push(ellipsoid(noseC, [p.nose, p.nose * 0.75, p.nose * 0.75], 'head', 'nose', 0.008));

  // Ears (each on its own bone for twitches). A torn ear is shorter.
  const tornSide = mrng.chance(0.5) ? -1 : 1;
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'earL' : 'earR';
    const e = p.ears.size * (has('tornEar') && side === tornSide ? 0.55 : 1);
    const base: Vec3 = [side * p.ears.x, hc[1] + p.ears.up, hc[2] - 0.004];
    bones.push({ name, parent: 'head', pos: base });
    if (p.ears.kind === 'cone') {
      const tip: Vec3 = [side * (p.ears.x + 0.018 * e), hc[1] + p.ears.up + 0.07 * e, hc[2] - 0.008];
      prims.push(roundCone(base, tip, 0.034 * e, 0.003, name, 'ear', 0.008, [1, 1, 2.4]));
    } else if (p.ears.kind === 'round') {
      const c: Vec3 = [side * (p.ears.x + 0.008), hc[1] + p.ears.up + 0.012 * e, hc[2] - 0.006];
      prims.push(ellipsoid(c, [0.024 * e, 0.026 * e, 0.007], name, 'ear', 0.008));
    } else {
      const top: Vec3 = [side * (hr[0] * 0.85), hc[1] + hr[1] * 0.75, hc[2] - 0.012];
      const tip: Vec3 = [side * (hr[0] * 1.3), hc[1] - hr[1] * 0.85 * e, hc[2] - 0.006];
      bones[bones.length - 1].pos = top;
      prims.push(roundCone(top, tip, 0.026 * e, 0.022 * e, name, 'ear', 0.006, [2.2, 1, 1]));
    }
  }

  // Legs: upper + lower segment, paw.
  const legs: { name: string; hip: Vec3; knee: Vec3; paw: Vec3; r: number }[] = [];
  for (const side of [-1, 1]) {
    const f = p.front, h = p.hind;
    const fx = side * f.x, hx = side * h.x;
    legs.push({ name: side < 0 ? 'FL' : 'FR', hip: [fx, hy - 0.005, f.z], knee: [fx * 1.05, hy - p.legH * f.knee, f.z + 0.01], paw: [fx * 1.05, 0.016, f.z + 0.005], r: f.r });
    legs.push({ name: side < 0 ? 'HL' : 'HR', hip: [hx, hy + 0.005 + h.up, h.z], knee: [hx * 1.05, hy - p.legH * h.knee + h.up, h.z + 0.04], paw: [hx * 1.05, 0.016, h.z - 0.015], r: h.r });
  }
  for (const l of legs) {
    bones.push({ name: `leg${l.name}U`, parent: 'body', pos: l.hip });
    bones.push({ name: `leg${l.name}L`, parent: `leg${l.name}U`, pos: l.knee });
    prims.push(roundCone(l.hip, l.knee, l.r, p.lower * 1.05, `leg${l.name}U`, 'leg', 0.035));
    prims.push(roundCone(l.knee, [l.paw[0], l.paw[1] + 0.01, l.paw[2]], p.lower, p.lower * 0.8, `leg${l.name}L`, 'leg', 0.012));
    prims.push(ellipsoid([l.paw[0], p.paw[1], l.paw[2] + p.paw[2] * 0.35], p.paw, `leg${l.name}L`, 'paw', 0.012));
  }

  // Tail(s): chains of cones. A kinked tail has one sharp bend.
  const t = p.tail;
  const tailBase: Vec3 = [0, hy + t.up, p.hips.c[2] - p.hips.r[2] * 0.85];
  const kinkAt = has('kinkedTail') ? mrng.int(1, t.segs - 2) : -1;
  const chain = (prefix: string, splay: number) => {
    let pt: Vec3 = [...tailBase];
    let angle = t.angle;
    let parent = 'body';
    for (let i = 0; i < t.segs; i++) {
      if (i === kinkAt) angle += 1.3;
      const lateral = Math.sin(splay) * t.segLen * (i < 2 ? 1 : 0.4);
      const next: Vec3 = [pt[0] + lateral, pt[1] + Math.sin(angle) * t.segLen, pt[2] - Math.cos(angle) * t.segLen];
      const name = `${prefix}${i}`;
      bones.push({ name, parent, pos: pt });
      const r1 = t.r0 + (t.r1 - t.r0) * (i / t.segs), r2 = t.r0 + (t.r1 - t.r0) * ((i + 1) / t.segs);
      prims.push(roundCone(pt, next, r1, i === t.segs - 1 ? Math.min(r2, 0.006) : r2, name, 'tail', i === 0 ? 0.03 : 0.01));
      parent = name;
      pt = next;
      angle += t.curl;
    }
  };
  chain('tail', has('twinTail') ? -0.5 : 0);
  if (has('twinTail')) chain('tailB', 0.5);

  // Bone spurs along the spine.
  if (has('boneSpurs')) {
    const n = mrng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const z = p.chest.c[2] - (i / (n - 1)) * (p.chest.c[2] - p.hips.c[2]);
      const top = hy + p.chest.r[1] * 0.95;
      const h = p.chest.r[1] * mrng.range(0.45, 0.7);
      prims.push(roundCone([0, top - 0.01, z], [0, top + h, z - h * 0.4], p.chest.r[1] * 0.17, 0.002, i < n / 2 ? 'chest' : 'body', 'bone', 0.006));
    }
  }

  const eyes: Anatomy['eyes'] = [-1, 1].map((side) => ({
    pos: [side * p.eye.x, hc[1] + p.eye.y, hc[2] + p.eye.z] as Vec3,
    radius: p.eye.r,
    second: side > 0,
  }));
  if (has('thirdEye')) eyes.push({ pos: [0, hc[1] + hr[1] * 0.75, hc[2] + hr[2] * 0.62], radius: p.eye.r * 1.3, second: false });

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const pr of prims)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], pr.min[i] - 0.02);
      max[i] = Math.max(max[i], pr.max[i] + 0.02);
    }

  return { prims, bones, eyes, head: hc, torsoY: hy, tailBase, tailLength: t.segs * t.segLen, bounds: { min, max } };
}

export function speciesScale(g: Genome): number {
  return SPECIES_SCALE[g.species];
}

export type { Plan };
