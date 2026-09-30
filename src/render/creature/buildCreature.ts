// Turns a genome into a skinned, vertex-coloured Three.js creature.

import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import type { Genome } from '../../core/genome';
import { PALETTE, type PaletteColor } from '../../core/palette';
import { Rng } from '../../core/rng';
import { catAnatomy, type Anatomy } from './catAnatomy';
import { unionField } from './sdf';
import { surfaceNets } from './surfaceNets';

export interface Creature {
  group: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  eyes: THREE.Mesh[];
  anatomy: Anatomy;
  genome: Genome;
  dispose(): void;
}

const CELL = 0.0065;

export function buildCreature(genome: Genome): Creature {
  const anatomy = catAnatomy(genome);
  const { prims } = anatomy;
  const field = unionField(prims);
  const raw = surfaceNets(field, anatomy.bounds.min, anatomy.bounds.max, CELL);
  const n = raw.positions.length / 3;

  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);

  const boneNames = anatomy.bones.map((b) => b.name);
  const boneIdx = new Map(boneNames.map((name, i) => [name, i]));
  const painter = coatPainter(genome);
  const dists = new Float32Array(prims.length);
  const boneW = new Float32Array(boneNames.length);
  const eps = 0.002;

  for (let v = 0; v < n; v++) {
    const x = raw.positions[v * 3], y = raw.positions[v * 3 + 1], z = raw.positions[v * 3 + 2];

    // Normal from the field gradient.
    const gx = field(x + eps, y, z) - field(x - eps, y, z);
    const gy = field(x, y + eps, z) - field(x, y - eps, z);
    const gz = field(x, y, z + eps) - field(x, y, z - eps);
    const gl = Math.hypot(gx, gy, gz) || 1;
    normals[v * 3] = gx / gl; normals[v * 3 + 1] = gy / gl; normals[v * 3 + 2] = gz / gl;

    // Nearest primitive → region; soft distances → bone weights.
    let best = 0, dmin = Infinity;
    for (let i = 0; i < prims.length; i++) {
      const d = prims[i].dist(x, y, z);
      dists[i] = d;
      if (d < dmin) { dmin = d; best = i; }
    }
    boneW.fill(0);
    for (let i = 0; i < prims.length; i++) {
      boneW[boneIdx.get(prims[i].bone)!] += Math.exp(-(dists[i] - dmin) / 0.008);
    }
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      let bi = 0;
      for (let i = 1; i < boneW.length; i++) if (boneW[i] > boneW[bi]) bi = i;
      skinIndex[v * 4 + k] = bi;
      skinWeight[v * 4 + k] = boneW[bi];
      sum += boneW[bi];
      boneW[bi] = -1;
    }
    for (let k = 0; k < 4; k++) skinWeight[v * 4 + k] /= sum;

    const c = painter(prims[best].region, x, y, z, normals[v * 3 + 2]);
    colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(raw.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geometry.setIndex(new THREE.BufferAttribute(raw.indices, 1));

  // Skeleton in rest pose.
  const bones: Record<string, THREE.Bone> = {};
  const boneList: THREE.Bone[] = [];
  for (const def of anatomy.bones) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    const parentPos = def.parent ? anatomy.bones.find((b) => b.name === def.parent)!.pos : [0, 0, 0];
    bone.position.set(def.pos[0] - parentPos[0], def.pos[1] - parentPos[1], def.pos[2] - parentPos[2]);
    if (def.parent) bones[def.parent].add(bone);
    bones[def.name] = bone;
    boneList.push(bone);
  }

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = true;
  mesh.add(bones.root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(boneList));
  mesh.frustumCulled = false;

  // Eyes: separate glossy spheres riding the head bone; faint glow in the dark.
  const headPos = anatomy.bones.find((b) => b.name === 'head')!.pos;
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE[genome.coat.eye]) });
  const eyeGeo = new THREE.SphereGeometry(1, 10, 8);
  const eyes = anatomy.eyes.map((e) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.setScalar(e.radius);
    eye.position.set(e.pos[0] - headPos[0], e.pos[1] - headPos[1], e.pos[2] - headPos[2]);
    bones.head.add(eye);
    return eye;
  });

  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(genome.body.size);

  return {
    group, mesh, bones, eyes, anatomy, genome,
    dispose() {
      geometry.dispose();
      material.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
    },
  };
}

/** Returns a function that colours a surface point by region and coat genes. */
function coatPainter(g: Genome) {
  const rng = new Rng(`${g.seed}:coat-noise`);
  const noise = createNoise3D(() => rng.float());
  const { pattern, base, secondary, belly } = g.coat;
  const cache = new Map<PaletteColor, THREE.Color>();
  const col = (name: PaletteColor) => {
    let c = cache.get(name);
    if (!c) cache.set(name, (c = new THREE.Color(PALETTE[name])));
    return c;
  };

  // Scars: thin pale lines on random planes.
  const scarRng = new Rng(`${g.seed}:scars`);
  const scars = Array.from({ length: g.scars }, () => {
    const nrm = [scarRng.normal(), scarRng.normal(), scarRng.normal()];
    const l = Math.hypot(nrm[0], nrm[1], nrm[2]);
    return {
      n: nrm.map((v) => v / l),
      c: [scarRng.range(-0.05, 0.05), scarRng.range(0.2, 0.3), scarRng.range(-0.15, 0.2)],
    };
  });

  return (region: string, x: number, y: number, z: number, nz: number): THREE.Color => {
    if (region === 'nose') return col(base === 'tar' ? 'meat' : 'raw');
    if (region === 'ear' && nz > 0.35) return col('meat');

    // Bare, mangy skin patches.
    const m = noise(x * 18, y * 18, z * 18) * 0.5 + 0.5;
    if (region !== 'paw' && m < g.mange * 0.3) return col(m < g.mange * 0.14 ? 'bruise' : 'meat');

    for (const s of scars) {
      const d = (x - s.c[0]) * s.n[0] + (y - s.c[1]) * s.n[1] + (z - s.c[2]) * s.n[2];
      const r = Math.hypot(x - s.c[0], y - s.c[1], z - s.c[2]);
      if (Math.abs(d) < 0.0035 && r < 0.06) return col('skin');
    }

    const lower = region === 'belly' || (region === 'torso' && y < 0.2 && nz > -0.2);
    const warp = noise(x * 6, y * 6, z * 6) * 0.02;
    switch (pattern) {
      case 'tabby': {
        const along = region === 'leg' || region === 'paw' ? y : region === 'tail' ? z * 1.3 : z + y * 0.3;
        if (region === 'belly') return col(belly);
        return Math.sin((along + warp) * 110) > 0.35 ? col(secondary) : col(base);
      }
      case 'tuxedo':
        if (lower || region === 'paw' || region === 'muzzle' || (region === 'neck' && nz > 0.3)) return col(belly);
        return col(base);
      case 'calico': {
        const p = noise(x * 9 + 3, y * 9, z * 9);
        if (lower) return col(belly);
        return p > 0.35 ? col(secondary) : p < -0.35 ? col('tar') : col(base);
      }
      case 'point':
        if (region === 'ear' || region === 'muzzle' || region === 'paw' || region === 'tail' || (region === 'leg' && y < 0.1)) return col(secondary);
        return lower ? col(belly) : col(base);
      default:
        return lower ? col(belly) : col(base);
    }
  };
}
