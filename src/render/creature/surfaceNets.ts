// Naive surface nets: turns a signed distance field into a smooth triangle mesh.

import type { Vec3 } from './sdf';

export interface RawMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

export function surfaceNets(
  field: (x: number, y: number, z: number) => number,
  min: Vec3, max: Vec3, cell: number,
): RawMesh {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const gi = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  // Sample the field. Blocks whose centre is far from the surface can't contain
  // it, so they're filled with the centre value instead of evaluated per point.
  const values = new Float32Array(nx * ny * nz);
  const B = 4;
  const blockRadius = Math.sqrt(3) * (B / 2) * cell;
  for (let bk = 0; bk < nz; bk += B)
    for (let bj = 0; bj < ny; bj += B)
      for (let bi = 0; bi < nx; bi += B) {
        const ek = Math.min(bk + B, nz - 1), ej = Math.min(bj + B, ny - 1), ei = Math.min(bi + B, nx - 1);
        const dc = field(
          min[0] + ((bi + ei) / 2) * cell, min[1] + ((bj + ej) / 2) * cell, min[2] + ((bk + ek) / 2) * cell);
        const far = Math.abs(dc) > blockRadius + cell;
        for (let k = bk; k <= ek; k++)
          for (let j = bj; j <= ej; j++)
            for (let i = bi; i <= ei; i++)
              values[gi(i, j, k)] = far ? dc : field(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
      }

  // One vertex per cell that straddles the surface: average of edge crossings.
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const ci = (i: number, j: number, k: number) => i + cx * (j + cy * k);
  const cellVertex = new Int32Array(cx * cy * cz).fill(-1);
  const pos: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], // x
    [0, 2], [1, 3], [4, 6], [5, 7], // y
    [0, 4], [1, 5], [2, 6], [3, 7], // z
  ];
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const v = values[gi(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          corner[c] = v;
          if (v < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + t * ((b & 1) - (a & 1));
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
          n++;
        }
        cellVertex[ci(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }

  // One quad per grid edge that crosses the surface, joining the 4 cells around it.
  const idx: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c);
    else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = values[gi(i, j, k)];
        const in0 = v0 < 0;
        if (i < cx && j > 0 && k > 0 && in0 !== values[gi(i + 1, j, k)] < 0)
          quad(cellVertex[ci(i, j - 1, k - 1)], cellVertex[ci(i, j, k - 1)],
            cellVertex[ci(i, j, k)], cellVertex[ci(i, j - 1, k)], !in0);
        if (j < cy && i > 0 && k > 0 && in0 !== values[gi(i, j + 1, k)] < 0)
          quad(cellVertex[ci(i - 1, j, k - 1)], cellVertex[ci(i - 1, j, k)],
            cellVertex[ci(i, j, k)], cellVertex[ci(i, j, k - 1)], !in0);
        if (k < cz && i > 0 && j > 0 && in0 !== values[gi(i, j, k + 1)] < 0)
          quad(cellVertex[ci(i - 1, j - 1, k)], cellVertex[ci(i, j - 1, k)],
            cellVertex[ci(i, j, k)], cellVertex[ci(i - 1, j, k)], !in0);
      }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}
