// Cat body plan: SDF primitives + skeleton joints, shaped by the genome.
// Units are metres at size 1; the cat faces +Z, feet on y = 0.

import type { Genome } from '../../core/genome';
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
  eyes: { pos: Vec3; radius: number }[];
  bounds: { min: Vec3; max: Vec3 };
  /** Head centre, used for look-at. */
  head: Vec3;
}

export function catAnatomy(g: Genome): Anatomy {
  const b = g.body;
  const bulk = b.bulk;
  const legH = 0.15 * b.legLength;
  const hy = legH + 0.055 * bulk; // torso centre height
  const hs = b.headSize * 1.22;

  const prims: Primitive[] = [];
  const bones: BoneDef[] = [
    { name: 'root', parent: null, pos: [0, 0, 0] },
    { name: 'body', parent: 'root', pos: [0, hy, 0] },
    { name: 'chest', parent: 'body', pos: [0, hy, 0.05] },
  ];

  // Torso: chest, hips and a sagging belly.
  prims.push(ellipsoid([0, hy + 0.008, 0.06], [0.07 * bulk, 0.08 * bulk, 0.105], 'chest', 'torso'));
  prims.push(ellipsoid([0, hy + 0.012, -0.075], [0.074 * bulk, 0.078 * bulk, 0.095], 'body', 'torso', 0.05));
  prims.push(ellipsoid([0, hy - 0.022, -0.01], [0.066 * bulk, 0.062 * bulk, 0.115], 'chest', 'belly', 0.05));

  // Neck + head.
  const neckBase: Vec3 = [0, hy + 0.035, 0.14];
  const headC: Vec3 = [0, hy + 0.1 * b.neckLength, 0.2];
  bones.push({ name: 'head', parent: 'body', pos: neckBase });
  prims.push(roundCone(neckBase, [0, headC[1] - 0.02, headC[2] - 0.02], 0.052 * bulk, 0.042, 'head', 'neck', 0.04));
  prims.push(ellipsoid(headC, [0.05 * hs, 0.045 * hs, 0.048 * hs], 'head', 'head', 0.03));
  prims.push(ellipsoid([0, headC[1] - 0.014 * hs, headC[2] + 0.012 * hs], [0.048 * hs, 0.032 * hs, 0.04 * hs], 'head', 'head', 0.02));
  const sn = b.snoutLength;
  prims.push(ellipsoid([0, headC[1] - 0.016 * hs, headC[2] + 0.04 * hs + 0.006 * sn], [0.023 * hs, 0.017 * hs, 0.02 * hs * sn], 'head', 'muzzle', 0.015));
  prims.push(ellipsoid([0, headC[1] - 0.005 * hs, headC[2] + 0.057 * hs + 0.008 * sn], [0.009, 0.007, 0.007], 'head', 'nose', 0.008));

  // Ears: flattened cones, each on its own bone for twitches.
  for (const side of [-1, 1]) {
    const e = b.earSize;
    const base: Vec3 = [side * 0.03 * hs, headC[1] + 0.026 * hs, headC[2] - 0.004];
    const tip: Vec3 = [side * 0.048 * hs, headC[1] + (0.03 + 0.06 * e) * hs, headC[2] - 0.008];
    const name = side < 0 ? 'earL' : 'earR';
    bones.push({ name, parent: 'head', pos: base });
    prims.push(roundCone(base, tip, 0.025 * e, 0.003, name, 'ear', 0.008, [1, 1, 2.4]));
  }

  // Legs: upper + lower segment, paw.
  const legs: { name: string; hip: Vec3; knee: Vec3; paw: Vec3; r: number }[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.042 * bulk;
    legs.push({ name: side < 0 ? 'FL' : 'FR', hip: [x, hy - 0.005, 0.095], knee: [x * 1.05, hy - legH * 0.55, 0.105], paw: [x * 1.05, 0.016, 0.1], r: 0.032 * bulk });
    const xh = side * 0.046 * bulk;
    legs.push({ name: side < 0 ? 'HL' : 'HR', hip: [xh, hy + 0.005, -0.1], knee: [xh * 1.05, hy - legH * 0.4, -0.06], paw: [xh * 1.05, 0.016, -0.115], r: 0.044 * bulk });
  }
  for (const l of legs) {
    bones.push({ name: `leg${l.name}U`, parent: 'body', pos: l.hip });
    bones.push({ name: `leg${l.name}L`, parent: `leg${l.name}U`, pos: l.knee });
    prims.push(roundCone(l.hip, l.knee, l.r, 0.021, `leg${l.name}U`, 'leg', 0.035));
    prims.push(roundCone(l.knee, [l.paw[0], l.paw[1] + 0.01, l.paw[2]], 0.02, 0.016, `leg${l.name}L`, 'leg', 0.012));
    prims.push(ellipsoid([l.paw[0], 0.015, l.paw[2] + 0.009], [0.021, 0.015, 0.027], `leg${l.name}L`, 'paw', 0.012));
  }

  // Tail: a chain of cones curling up at the end.
  const segs = 5;
  const segLen = 0.058 * b.tailLength;
  let p: Vec3 = [0, hy + 0.035, -0.16];
  let angle = 0.35; // radians up from -Z
  let parent = 'body';
  for (let i = 0; i < segs; i++) {
    const next: Vec3 = [0, p[1] + Math.sin(angle) * segLen, p[2] - Math.cos(angle) * segLen];
    const name = `tail${i}`;
    bones.push({ name, parent, pos: p });
    const r1 = 0.022 - i * 0.0018, r2 = 0.022 - (i + 1) * 0.0018;
    prims.push(roundCone(p, next, r1, r2, name, 'tail', i === 0 ? 0.03 : 0.01));
    parent = name;
    p = next;
    angle += 0.22;
  }

  const eyes = [-1, 1].map((side) => ({
    pos: [side * 0.022 * hs, headC[1] + 0.008 * hs, headC[2] + 0.04 * hs] as Vec3,
    radius: 0.0095 * hs,
  }));

  return {
    prims,
    bones,
    eyes,
    head: headC,
    bounds: { min: [-0.13, -0.01, -0.5], max: [0.13, hy + 0.2, 0.32] },
  };
}
