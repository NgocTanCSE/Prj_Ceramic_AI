// PURE Node (no deps, no WebGL) validation of AI/lathe.js computeSilhouetteFidelity (CPU IoU).
// Convention matches tools/test_render_fidelity_pure.mjs. MUST PASS.
import { computeSilhouetteFidelity, STUDIO_BG } from '../AI/lathe.js';

const STUDIO = STUDIO_BG;
const WHITE = { r: 255, g: 255, b: 255 };

function makeRgba(w, h, objFn, bg = STUDIO) {
  const b = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (objFn(x, y)) { b[i] = 250; b[i + 1] = 80; b[i + 2] = 80; b[i + 3] = 255; }   // object = red, opaque
    else { b[i] = bg.r; b[i + 1] = bg.g; b[i + 2] = bg.b; b[i + 3] = 255; }           // bg configurable
  }
  return b;
}
// light off-white ceramic: gần studio (cd<30 -> bị bỏ qua nếu dùng bg studio) nhưng xa white
const LIGHT_OBJ = { r: 250, g: 240, b: 230 };
function makeRgbaLight(w, h, objFn, bg = STUDIO) {
  const b = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (objFn(x, y)) { b[i] = LIGHT_OBJ.r; b[i + 1] = LIGHT_OBJ.g; b[i + 2] = LIGHT_OBJ.b; b[i + 3] = 255; }
    else { b[i] = bg.r; b[i + 1] = bg.g; b[i + 2] = bg.b; b[i + 3] = 255; }
  }
  return b;
}

let pass = 0, fail = 0;
const assert = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name, extra); }
};

const W = 60, H = 60;
const obj = (x, y) => x >= 15 && x < 45 && y >= 15 && y < 45;               // 30x30 centered square

console.log('--- computeSilhouetteFidelity (CPU IoU) ---');
{
  const A = makeRgba(W, H, obj, STUDIO);
  const B_same = makeRgba(W, H, obj, STUDIO);
  const r = computeSilhouetteFidelity(A, B_same, W, H);
  console.log('    identical:', JSON.stringify({ score: r.score, iou: r.iou, refArea: r.refArea, rendArea: r.rendArea }));
  assert('identical -> score≈1, ok', r.ok && Math.abs(r.score - 1.0) < 1e-6);
  assert('identical -> refArea==rendArea', r.refArea === r.rendArea);
}
{
  const A = makeRgba(W, H, obj, STUDIO);
  const B_disjoint = makeRgba(W, H, (x, y) => x >= 45 && x < 58 && y >= 45 && y < 58, STUDIO);
  const r = computeSilhouetteFidelity(A, B_disjoint, W, H);
  console.log('    disjoint:', JSON.stringify({ score: r.score, iou: r.iou, inter: r.inter }));
  assert('disjoint -> score=0', r.ok && r.score === 0);
  assert('disjoint -> inter=0', r.inter === 0);
}
{
  const A = makeRgba(W, H, obj, STUDIO);
  const B_half = makeRgba(W, H, (x, y) => x >= 30 && x < 45 && y >= 15 && y < 45, STUDIO); // B_inside A
  const r = computeSilhouetteFidelity(A, B_half, W, H);
  console.log('    half-overlap:', JSON.stringify({ score: r.score, inter: r.inter, union: r.union }));
  // B is 15x30=450 fully inside A(900). inter=450, union=900+450-450=900 -> iou=0.5
  assert('half-overlap -> score≈0.5', r.ok && Math.abs(r.score - 0.5) < 1e-6, `got ${r.score}`);
}
const bgOnly = makeRgba(W, H, () => false, STUDIO);
{
  const r = computeSilhouetteFidelity(bgOnly, bgOnly, W, H);
  console.log('    empty:', JSON.stringify({ score: r.score, note: r.note }));
  assert('both empty -> score=0', r.ok && r.score === 0);
  assert('both empty -> note set', !!r.note);
}
{
  assert('missing -> ok false', computeSilhouetteFidelity(null, makeRgba(W, H, obj, STUDIO), W, H).ok === false);
  assert('short buffer -> ok false', computeSilhouetteFidelity(makeRgba(W, H, obj, STUDIO).slice(0, 10), makeRgba(W, H, obj, STUDIO), W, H).ok === false);
}
// --- NEW: bg normalization (Phase 1-B) ---
console.log('--- bg normalization (opts.bg / opts.refBg / opts.rendBg) ---');
{
  // ảnh A: vật light ceramic (250,240,230) trên nền STUDIO -> default studio-mask: cd=2+6+6=14<30 -> rỗng
  // ảnh B: cùng vật trên nền WHITE -> default studio-mask cũng rỗng (vật quá gần studio)
  const A = makeRgbaLight(W, H, obj, STUDIO);
  const B = makeRgbaLight(W, H, obj, WHITE);
  const r0 = computeSilhouetteFidelity(A, B, W, H);            // mặc định studio bg
  console.log('    default(studio bg):', JSON.stringify({ score: r0.score, refArea: r0.refArea, rendArea: r0.rendArea, note: r0.note }));
  assert('default -> both empty (light obj missed by studio threshold)', r0.score === 0 && r0.refArea === 0 && r0.rendArea === 0);

  // khi biết nền trắng, override bg -> cùng region được dò ra -> IoU 1
  const r1 = computeSilhouetteFidelity(A, B, W, H, { bg: WHITE });
  console.log('    opts.bg=WHITE:', JSON.stringify({ score: r1.score, refArea: r1.refArea, rendArea: r1.rendArea }));
  assert('bg=WHITE -> score≈1 (normalized)', r1.ok && Math.abs(r1.score - 1.0) < 1e-6, `got ${r1.score}`);

  // asymmetric: ref studio, rend white -> dùng refBg/rendBg riêng
  const r2 = computeSilhouetteFidelity(A, B, W, H, { refBg: WHITE, rendBg: WHITE });
  assert('refBg/rendBg=WHITE -> score≈1', r2.ok && Math.abs(r2.score - 1.0) < 1e-6);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
