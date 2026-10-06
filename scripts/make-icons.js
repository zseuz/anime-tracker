/**
 * Generates the PWA icons (public/icons/*.png) without any image dependency:
 * a violet→rose gradient rounded square with a white play triangle.
 *   node scripts/make-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const r = maskable ? 0 : size * 0.22; // maskable icons must fill the whole square
  const c1 = [124, 77, 255], c2 = [255, 64, 129];
  // Play triangle, centred; kept inside the maskable safe zone (inner 80%).
  const s = size * (maskable ? 0.2 : 0.26);
  const cx = size / 2, cy = size / 2;
  const tri = [[cx - s * 0.6, cy - s], [cx - s * 0.6, cy + s], [cx + s * 1.0, cy]];
  const inTri = (x, y) => {
    const [a, b, c] = tri;
    const d = (p, q, w) => (p[0] - w[0]) * (q[1] - w[1]) - (q[0] - w[0]) * (p[1] - w[1]);
    const p = [x, y], d1 = d(p, a, b), d2 = d(p, b, c), d3 = d(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const inRounded = (x, y) => {
    if (!r) return true;
    const dx = Math.max(r - x, 0, x - (size - r)), dy = Math.max(r - y, 0, y - (size - r));
    return dx * dx + dy * dy <= r * r;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4, t = (x + y) / (2 * size);
      if (!inRounded(x + 0.5, y + 0.5)) { px[i + 3] = 0; continue; }
      const white = inTri(x + 0.5, y + 0.5);
      for (let k = 0; k < 3; k++) px[i + k] = white ? 255 : Math.round(c1[k] + (c2[k] - c1[k]) * t);
      px[i + 3] = 255;
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${size}.png`), png(size, { maskable: false }));
  fs.writeFileSync(path.join(out, `icon-maskable-${size}.png`), png(size, { maskable: true }));
}
console.log('Iconos generados en public/icons');
