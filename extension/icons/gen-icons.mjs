/**
 * Emit minimal valid RGB PNGs for extension icons using only Node core (zlib).
 * Run: node extension/icons/gen-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;

const BLACK = [0x0e, 0x0e, 0x10];
const ORANGE = [0xff, 0x7a, 0x00];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function pngRGB(size, paint) {
  const rowSize = 1 + size * 3;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    const rowOff = y * rowSize;
    raw[rowOff] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = paint(x, y, size);
      const i = rowOff + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function nearLine(x, y, x0, y0, x1, y1, thickness) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - x0) * dx + (y - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  const ddx = x - px;
  const ddy = y - py;
  return ddx * ddx + ddy * ddy <= thickness * thickness;
}

function paint(x, y, size) {
  const s = size / 128;
  // outer black rounded-ish (square with margin)
  const margin = Math.max(1, Math.round(size * 0.02));
  if (x < margin || y < margin || x >= size - margin || y >= size - margin) {
    return BLACK;
  }
  // rounded corners: black outside arc
  const rr = Math.round(size * 0.14);
  const corners = [
    [rr, rr],
    [size - 1 - rr, rr],
    [rr, size - 1 - rr],
    [size - 1 - rr, size - 1 - rr],
  ];
  for (const [cx, cy] of corners) {
    const inCornerQuad =
      (x < rr && y < rr && cx === rr && cy === rr) ||
      (x > size - 1 - rr && y < rr && cx === size - 1 - rr && cy === rr) ||
      (x < rr && y > size - 1 - rr && cx === rr && cy === size - 1 - rr) ||
      (x > size - 1 - rr &&
        y > size - 1 - rr &&
        cx === size - 1 - rr &&
        cy === size - 1 - rr);
    if (inCornerQuad && !inCircle(x, y, cx, cy, rr)) return BLACK;
  }

  // orange inset square
  const inset = Math.round(18 * s);
  const innerR = Math.round(16 * s);
  if (x < inset || y < inset || x >= size - inset || y >= size - inset) {
    return BLACK;
  }
  // inner rounded orange area check
  const ix0 = inset;
  const iy0 = inset;
  const ix1 = size - 1 - inset;
  const iy1 = size - 1 - inset;
  const ic = [
    [ix0 + innerR, iy0 + innerR],
    [ix1 - innerR, iy0 + innerR],
    [ix0 + innerR, iy1 - innerR],
    [ix1 - innerR, iy1 - innerR],
  ];
  let inOrange = true;
  for (const [cx, cy] of ic) {
    const q =
      (x <= ix0 + innerR && y <= iy0 + innerR && cx === ix0 + innerR && cy === iy0 + innerR) ||
      (x >= ix1 - innerR && y <= iy0 + innerR && cx === ix1 - innerR && cy === iy0 + innerR) ||
      (x <= ix0 + innerR && y >= iy1 - innerR && cx === ix0 + innerR && cy === iy1 - innerR) ||
      (x >= ix1 - innerR && y >= iy1 - innerR && cx === ix1 - innerR && cy === iy1 - innerR);
    if (q && !inCircle(x, y, cx, cy, innerR)) {
      inOrange = false;
      break;
    }
  }
  if (!inOrange) return BLACK;

  // scissors glyph
  const t = Math.max(1.2, 3 * s);
  const c1 = [42 * s, 48 * s];
  const c2 = [42 * s, 80 * s];
  const ring = 12 * s;
  const ringT = Math.max(1.5, 3.2 * s);
  const d1 = Math.hypot(x - c1[0], y - c1[1]);
  const d2 = Math.hypot(x - c2[0], y - c2[1]);
  if (Math.abs(d1 - ring) <= ringT || Math.abs(d2 - ring) <= ringT) return WHITE;
  if (nearLine(x, y, 52 * s, 54 * s, 92 * s, 88 * s, t)) return WHITE;
  if (nearLine(x, y, 52 * s, 74 * s, 92 * s, 40 * s, t)) return WHITE;

  return ORANGE;
}

mkdirSync(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  const buf = pngRGB(size, paint);
  const path = join(outDir, `${size}.png`);
  writeFileSync(path, buf);
  console.log("wrote", path, buf.length, "bytes");
}
