// Signed distance primitives used to sculpt creature bodies.
// Pure math (no Three.js) so it can run in tests and, later, a worker.

export type Vec3 = [number, number, number];

export interface Primitive {
  /** Signed distance from point to the primitive's surface. */
  dist(x: number, y: number, z: number): number;
  /** Smooth-union radius used when merging this primitive into the body. */
  blend: number;
  bone: string;
  region: string;
}

/** Polynomial smooth minimum: melts two shapes together. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Axis-aligned ellipsoid (approximate distance, iq). */
export function ellipsoid(c: Vec3, r: Vec3, bone: string, region: string, blend = 0.02): Primitive {
  return {
    bone, region, blend,
    dist(x, y, z) {
      const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
      const k0 = Math.hypot(px, py, pz);
      const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
      return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
    },
  };
}

/**
 * Cone with rounded ends between a (radius r1) and b (radius r2) — limbs,
 * necks, tails, ears. `squash` flattens the shape along an axis (e.g. ears).
 */
export function roundCone(
  a: Vec3, b: Vec3, r1: number, r2: number, bone: string, region: string,
  blend = 0.02, squash: Vec3 = [1, 1, 1],
): Primitive {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = (b[2] - a[2]) * squash[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const smax = Math.max(squash[0], squash[1], squash[2]);
  return {
    bone, region, blend,
    dist(x, y, z) {
      const pax = (x - a[0]) * squash[0], pay = (y - a[1]) * squash[1], paz = (z - a[2]) * squash[2];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      let d: number;
      if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - r2;
      else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - r1;
      else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
      return d / smax;
    },
  };
}

/** Union of primitives with per-primitive smooth blending. */
export function unionField(prims: readonly Primitive[]) {
  return (x: number, y: number, z: number): number => {
    let d = prims[0].dist(x, y, z);
    for (let i = 1; i < prims.length; i++) d = smin(d, prims[i].dist(x, y, z), prims[i].blend);
    return d;
  };
}
