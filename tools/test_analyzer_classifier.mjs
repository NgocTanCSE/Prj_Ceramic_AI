/**
 * Unit test trực tiếp cho bộ phân loại hình dạng trong AI/potterySuitabilityAnalyzer.js.
 * Kiểm tra các kịch bản người dùng: cây cảnh / bài vở / nhiều đối tượng phải bị từ chối,
 * trong khi gốm sứ thật phải được chấp nhận.
 *
 * Tự chứa: mã hoá PNG 8-bit RGBA bằng zlib (builtin) — không import sharp ở đây;
 * sharp chỉ được analyzer (ở AI/) tải để giải mã, nên phân giải từ AI/node_modules.
 */
import { deflateSync } from 'zlib';
import { analyzePotterySuitability, countConnectedComponents } from '../AI/potterySuitabilityAnalyzer.js';

// ── minimal CRC32 + PNG encoder ──────────────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(Buffer.concat([type, data])), 0);
  return Buffer.concat([len, type, data, crc]);
}
function pngRgba(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; let o = y * (w * 4 + 1) + 1; for (let i = 0; i < w * 4; i++) raw[o + i] = rgba[y * w * 4 + i]; }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk(Buffer.from('IHDR'), ihdr), chunk(Buffer.from('IDAT'), idat), chunk(Buffer.from('IEND'), Buffer.alloc(0))]);
}

// ── synthetic builders (750x750, Studio bg) ────────────────────────────────────
const W = 750, H = 750;
const BG = [248, 247, 244, 255];
const OBJ = [90, 90, 90, 255];
function canvas(draw) { const b = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) { b[i * 4] = BG[0]; b[i * 4 + 1] = BG[1]; b[i * 4 + 2] = BG[2]; b[i * 4 + 3] = BG[3]; } draw(b); return b; }
const px = (b, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; b[i] = OBJ[0]; b[i + 1] = OBJ[1]; b[i + 2] = OBJ[2]; b[i + 3] = OBJ[3]; };
const disk = (b, cx, cy, R) => { for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) px(b, x, y); };
const thickLine = (b, x0, y0, x1, y1, t) => {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, rx = -uy, ry = ux;
  for (let i = 0; i <= len; i += 3) { const px_ = x0 + ux * i, py = y0 + uy * i; for (let j = -t; j <= t; j += 2) px(b, Math.round(px_ + rx * j), Math.round(py + ry * j)); }
};
const rect = (b, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(b, x, y); };

const imgs = {
  circle: () => pngRgba(W, H, canvas((b) => disk(b, 375, 375, 260))),
  cactus: () => pngRgba(W, H, canvas((b) => { for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) { thickLine(b, 375, 375, 375 + 290 * Math.cos(a), 375 + 290 * Math.sin(a), 22); } thickLine(b, 375, 375, 375 + 260, 375 - 120, 26); })),
  page: () => pngRgba(W, H, canvas((b) => rect(b, 35, 135, 715, 615))),
  twoCircles: () => pngRgba(W, H, canvas((b) => { disk(b, 265, 375, 120); disk(b, 535, 375, 120); })),
};

// ── Chạy: node tools/test_analyzer_classifier.mjs
//
// Chuẩn gate mới (theo yêu cầu "chỉ cần xác thựng là đồ vật, không phải phong cảnh/human"):
//   - Chấp nhận: mọi đối tượng thực sự (bát, cốc, trang giấy, cây...) — duy nhất & chiếm ≥3% khung.
//   - Từ chối: empty (không có vật) · multi_object (>1 vật) · low_fill (<3% = cảnh xa/thưa).
//   - flat_surface/asymmetric không còn CHẶN nữa (chỉ là shapeNote thông tin), vì ảnh bát thật
//     chụp góc/đổ bóng thường cho circularity ~1.0 / sym thấp mà vẫn là gốm.
const cases = [
  { name: 'circle (gốm bát thật)', img: await imgs.circle(), expect: { suitable: true, isPottery: true, category: 'bowl', objectCount: 1 } },
  { name: 'rectangle (trang giấy/bài vở — là một đồ vật)', img: await imgs.page(), expect: { suitable: true, isPottery: true, category: 'bowl', objectCount: 1 } },
  { name: 'cactus-like (cây cảnh thưa/xa — low_fill)', img: await imgs.cactus(), expect: { suitable: false, isPottery: false, category: 'low_fill', objectCount: 1 } },
  { name: 'empty (không có vật thể — phong cảnh trống)', img: pngRgba(W, H, canvas(() => {})), expect: { suitable: false, isPottery: false, category: 'empty', objectCount: 0 } },
  { name: 'two circles (nhiều đối tượng)', img: await imgs.twoCircles(), expect: { suitable: false, isPottery: false, category: 'multi_object', objectCount: 2 } },
];

console.log('=== Analyzer shape-classifier unit test (tools/test_analyzer_classifier.mjs) ===');
let ok = true;
for (const c of cases) {
  const s = await analyzePotterySuitability(c.img, { modelType: 'bowl' });
  const pass = Object.entries(c.expect).every(([k, v]) => Array.isArray(v) ? v.includes(s[k]) : s[k] === v);
  if (!pass) ok = false;
  console.log((pass ? '✅' : '❌') + ' ' + c.name);
  console.log('    suitable=' + s.suitable + ' isPottery=' + s.isPottery + ' category=' + s.category + ' objectCount=' + s.objectCount + ' sym=' + s.symmetryScore + '% circ=' + s.circularity + ' reason=' + (s.reason ? s.reason.slice(0, 50) : ''));
}

console.log('\n' + (ok ? '✅ test_analyzer_classifier: ALL PASS' : '❌ test_analyzer_classifier: FAILURES'));
process.exit(ok ? 0 : 1);
