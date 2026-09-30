// Generates the pixel-art app icons as PNGs (no dependencies).
// Usage: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const C = { '.': [11, 7, 8], o: [255, 140, 50], d: [168, 50, 30], c: [41, 240, 255], a: [242, 196, 107], m: [255, 46, 136] };

// 16x16 cat head: one organic amber eye, one chrome cyan eye.
const ART = [
  '................',
  '................',
  '..o.........o...',
  '..oo.......oo...',
  '..odo.....odo...',
  '..ooooooooooo...',
  '.ooooooooooooo..',
  '.oodooooooodoo..',
  '.ooaaooooocccoo.',
  '.ooaaooooocccoo.',
  '.oooooooooooooo.',
  '..oooooommoooo..',
  '..ooddoooooddo..',
  '...oooooooooo...',
  '.....oooooo.....',
  '................',
];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, padding) {
  const inner = size - padding * 2;
  const scale = inner / 16;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ax = Math.floor((x - padding) / scale), ay = Math.floor((y - padding) / scale);
      const ch = ax >= 0 && ay >= 0 && ax < 16 && ay < 16 ? ART[ay][ax] : '.';
      const [r, g, b] = C[ch];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, 16));
writeFileSync('public/icons/icon-512.png', png(512, 64));
writeFileSync('public/icons/apple-touch-icon.png', png(180, 10));
console.log('icons written');
