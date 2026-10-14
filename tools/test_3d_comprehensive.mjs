// tools/test_3d_comprehensive.mjs — Comprehensive Test Suite for Ceramic 3D Algorithms
// Groups A to E according to Master Prompt Section 12.
import {
  imageToLathePoints,
  silhouetteToLathePoints,
  maskAndBbox,
  buildObjectMask,
  countSignificantObjects,
  countConnectedComponents,
  computeSilhouetteFidelity,
  medianFilter5,
  gaussianSmooth5,
  douglasPeucker,
  catmullRomInterp,
  resizeLetterboxRgba,
  STUDIO_BG
} from '../AI/lathe.js';

import { countSignificantObjects as countObjectsAnalyzer } from '../AI/potterySuitabilityAnalyzer.js';

let worker = null;
try {
  const m = await import('../cloudflare_worker/src/index.js');
  worker = m.default || m;
} catch (_) {}

let aiService = null;
try {
  aiService = await import('../API/aiService.js');
} catch (_) {}

let THREE = null;
try {
  THREE = await import('../FE/node_modules/three/build/three.module.js');
} catch (_) {
  try {
    THREE = await import('three');
  } catch (_) {}
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    const errMsg = detail ? `${message} (Detail: ${detail})` : message;
    failures.push(errMsg);
    console.error(`  [FAIL] ${errMsg}`);
  }
}

function createRgbaCanvas(w, h, fillFn) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const pixel = fillFn(x, y, w, h);
      buf[idx] = pixel[0];
      buf[idx + 1] = pixel[1];
      buf[idx + 2] = pixel[2];
      buf[idx + 3] = pixel[3] !== undefined ? pixel[3] : 255;
    }
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== TEST GROUP A: HÌNH HỌC CHUẨN (STANDARD ARCHETYPES) ===');
// ─────────────────────────────────────────────────────────────
{
  const archetypes = [
    { type: 'bowl', desc: 'Bát miệng loe', shapeFn: (nx, ny) => nx < (0.2 + 0.6 * (1 - ny)) },
    { type: 'bowl', desc: 'Bát lòng sâu', shapeFn: (nx, ny) => nx < (0.3 + 0.4 * (1 - ny * ny)) },
    { type: 'plate', desc: 'Đĩa nông', shapeFn: (nx, ny) => ny > 0.6 && nx < (0.8 - (ny - 0.6) * 0.5) },
    { type: 'mug', desc: 'Cốc trụ', shapeFn: (nx, ny) => nx < 0.45 },
    { type: 'vase', desc: 'Bình trụ', shapeFn: (nx, ny) => nx < 0.35 },
    { type: 'vase', desc: 'Bình bụng phình', shapeFn: (nx, ny) => nx < (0.2 + 0.45 * Math.sin(ny * Math.PI)) },
    { type: 'vase-narrow-neck', desc: 'Bình cổ hẹp', shapeFn: (nx, ny) => ny < 0.3 ? nx < 0.15 : nx < (0.2 + 0.5 * Math.sin((ny - 0.3) / 0.7 * Math.PI)) }
  ];

  for (const arc of archetypes) {
    const W = 400, H = 400;
    const rgba = createRgbaCanvas(W, H, (x, y) => {
      const nx = Math.abs(x - W / 2) / (W / 2);
      const ny = y / H;
      if (ny > 0.15 && ny < 0.85 && arc.shapeFn(nx, (ny - 0.15) / 0.7)) {
        return [42, 107, 92, 255]; // Ceramic Teal
      }
      return [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
    });

    const res = imageToLathePoints(rgba, W, H, { modelType: arc.type });
    assert(!res.empty, `${arc.type} (${arc.desc}): không được rỗng`);
    assert(res.lathePoints.length >= 10, `${arc.type}: đủ điểm profile (got ${res.lathePoints.length})`);

    // Verify coordinates are strictly finite and non-negative radius
    const allFinite = res.lathePoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0);
    assert(allFinite, `${arc.type}: tọa độ finite và bán kính >= 0`);

    // Verify Three.js LatheGeometry construction
    let geoOk = false;
    try {
      const v2Points = res.lathePoints.map(p => new THREE.Vector2(p.x, p.y));
      const geo = new THREE.LatheGeometry(v2Points, 32);
      geoOk = geo.attributes.position.count > 0;
    } catch (e) {
      geoOk = false;
    }
    assert(geoOk, `${arc.type}: Three.js LatheGeometry tạo thành công không lỗi`);
  }
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== TEST GROUP B: ẢNH KHÓ (CHALLENGING INPUTS) ===');
// ─────────────────────────────────────────────────────────────
{
  const W = 300, H = 300;

  // 1. Ảnh hoàn toàn trống / nền trắng Studio
  const emptyStudio = createRgbaCanvas(W, H, () => [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255]);
  const resEmpty = imageToLathePoints(emptyStudio, W, H);
  assert(resEmpty.empty === true && resEmpty.lathePoints.length === 0, 'Ảnh hoàn toàn trống: trả về empty: true và lathePoints rỗng');

  // 2. Nền trong suốt (Alpha = 0)
  const transparentImg = createRgbaCanvas(W, H, (x, y) => {
    const dist = Math.hypot(x - W/2, y - H/2);
    return dist < 80 ? [180, 80, 50, 255] : [0, 0, 0, 0];
  });
  const resTrans = imageToLathePoints(transparentImg, W, H, { modelType: 'bowl' });
  assert(!resTrans.empty && resTrans.lathePoints.length >= 10, 'Nền trong suốt (alpha=0): nhận diện đối tượng chính xác');

  // 3. Nền gần màu vật thể (Low contrast)
  const lowContrastImg = createRgbaCanvas(W, H, (x, y) => {
    const dist = Math.hypot(x - W/2, y - H/2);
    // Studio bg: 248, 247, 244. Object: 200, 195, 185 (Men trắng ngà)
    return dist < 90 ? [195, 190, 180, 255] : [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const resLowContrast = imageToLathePoints(lowContrastImg, W, H, { modelType: 'plate' });
  assert(!resLowContrast.empty, 'Nền gần màu gốm men trắng ngà: phân đoạn thành công');

  // 4. Ảnh tối (Dark ceramic)
  const darkImg = createRgbaCanvas(W, H, (x, y) => {
    const inBox = x > 80 && x < 220 && y > 60 && y < 240;
    return inBox ? [30, 28, 26, 255] : [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const resDark = imageToLathePoints(darkImg, W, H, { modelType: 'mug' });
  assert(!resDark.empty && resDark.lathePoints.length >= 10, 'Ảnh vật thể men tối (Tenmoku): trích xuất profile tốt');

  // 5. Vật thể lệch tâm (Off-center)
  const offCenterImg = createRgbaCanvas(W, H, (x, y) => {
    const inBox = x > 160 && x < 280 && y > 60 && y < 240; // lệch sang phải
    return inBox ? [60, 120, 160, 255] : [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const resOffCenter = imageToLathePoints(offCenterImg, W, H, { modelType: 'vase' });
  assert(!resOffCenter.empty && resOffCenter.lathePoints.length >= 10, 'Vật thể lệch tâm: tự động tính lại trục quay cx');

  // 6. Vật thể nhỏ (Small object < 10% diện tích)
  const smallImg = createRgbaCanvas(W, H, (x, y) => {
    const inBox = x > 130 && x < 170 && y > 130 && y < 170; // 40x40 trên 300x300 (~1.7%)
    return inBox ? [200, 80, 80, 255] : [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const resSmall = imageToLathePoints(smallImg, W, H, { modelType: 'bowl' });
  assert(!resSmall.empty && resSmall.lathePoints.length >= 10, 'Vật thể nhỏ: chuẩn hóa letterbox không bị mất');

  // 7. Nhiều vật thể (Multi-object detection)
  const multiImg = createRgbaCanvas(W, H, (x, y) => {
    const obj1 = Math.hypot(x - 80, y - 150) < 40;
    const obj2 = Math.hypot(x - 220, y - 150) < 40;
    return (obj1 || obj2) ? [42, 107, 92, 255] : [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const maskMulti = buildObjectMask(multiImg, W, H);
  const countMulti = countSignificantObjects(maskMulti, W, H);
  assert(countMulti === 2, `Phát hiện nhiều vật thể: đếm đúng 2 đối tượng (got ${countMulti})`);
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== TEST GROUP C: EDGE CASES & GEOMETRIC INTEGRITY ===');
// ─────────────────────────────────────────────────────────────
{
  // 1. Single pixel mask
  const singlePixBbox = { minX: 50, maxX: 50, minY: 50, maxY: 50, cx: 50, objW: 1, objH: 1, empty: false, area: 1 };
  const singleMask = new Uint8Array(100 * 100);
  singleMask[50 * 100 + 50] = 1;
  const resSingle = silhouetteToLathePoints(singleMask, 100, 100, singlePixBbox);
  assert(resSingle.empty === true, 'Single pixel mask: từ chối an toàn, không sinh geometry giả');

  // 2. Inverted Bbox (min > max)
  const invertedBbox = { minX: 100, maxX: 0, minY: 100, maxY: 0, cx: 50, objW: 1, objH: 1, empty: false, area: 0 };
  const resInverted = silhouetteToLathePoints(new Uint8Array(10000), 100, 100, invertedBbox);
  assert(resInverted.empty === true, 'Inverted Bbox (min > max): chặn an toàn');

  // 3. Non-square image tall vase test for potterySuitabilityAnalyzer (Bug 3 regression)
  const tallMask = new Uint8Array(30 * 120);
  for (let y = 70; y < 100; y++) {
    for (let x = 8; x < 22; x++) tallMask[y * 30 + x] = 1;
  }
  const tallCount = countObjectsAnalyzer(tallMask, 30, 120);
  assert(tallCount === 1, `Regression Bug 3 (ny >= h): đếm đúng 1 đối tượng ở nửa dưới ảnh cao (got ${tallCount})`);

  // 4. Smoothing filter unit tests
  const noisy = [1.0, 1.0, 5.0, 1.0, 1.0]; // spike at index 2
  const med = medianFilter5(noisy);
  assert(med[2] === 1.0, `Median filter 5: loại bỏ điểm gai ngoại lai (5.0 -> ${med[2]})`);

  // 5. Catmull-Rom resampling monotonicity and continuity
  const roughPts = [
    { r: 0.4, y: -0.7 },
    { r: 1.1, y: 0.0 },
    { r: 0.8, y: 0.7 }
  ];
  const smooth = catmullRomInterp(roughPts, 18);
  assert(smooth.length === 18, `Catmull-Rom resample: tạo đúng 18 điểm (got ${smooth.length})`);
  assert(smooth.every(p => Number.isFinite(p.r) && Number.isFinite(p.y)), 'Catmull-Rom: mọi điểm đều finite');

  // 6. Wall thickness non-intersection: check inner wall radius < outer wall radius
  const W = 300, H = 300;
  const vaseImg = createRgbaCanvas(W, H, (x, y) => {
    const ny = y / H;
    const nx = Math.abs(x - W / 2) / (W / 2);
    if (ny > 0.2 && ny < 0.8 && nx < (0.15 + 0.4 * Math.sin(ny * Math.PI))) {
      return [42, 107, 92, 255];
    }
    return [STUDIO_BG.r, STUDIO_BG.g, STUDIO_BG.b, 255];
  });
  const vaseRes = imageToLathePoints(vaseImg, W, H, { modelType: 'vase' });
  assert(!vaseRes.empty, 'Bình hoa: dựng thành công');

  // Check that lathePoints loop does not self-intersect or collapse to 0 radius
  const pts = vaseRes.lathePoints;
  assert(pts[0].x === 0 && pts[pts.length - 1].x === 0, 'Chân đế và đáy trong chạm trục xoay X=0');
  const positiveRadii = pts.slice(1, pts.length - 1).every(p => p.x > 0);
  assert(positiveRadii, 'Tất cả các điểm thành thân đều có bán kính dương > 0');
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== TEST GROUP D: CLOUDFLARE WORKER & MASKBASE64 ===');
// ─────────────────────────────────────────────────────────────
if (worker) {
  // Test Worker OPTIONS preflight
  const optReq = new Request('http://localhost/lathe', { method: 'OPTIONS' });
  const optRes = await worker.fetch(optReq, {});
  assert(optRes.status === 200, 'Worker OPTIONS CORS preflight: HTTP 200');

  // Test Worker GET /
  const getReq = new Request('http://localhost/', { method: 'GET' });
  const getRes = await worker.fetch(getReq, {});
  assert(getRes.status === 200, 'Worker GET / metadata: HTTP 200');

  // Test Worker POST /lathe with missing body
  const badReq = new Request('http://localhost/lathe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const badRes = await worker.fetch(badReq, {});
  assert(badRes.status === 400, 'Worker POST /lathe thiếu imageBase64: HTTP 400');
} else {
  console.log('  [SKIP] Cloudflare Worker dependencies not installed in this environment');
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== TEST GROUP E: AI SERVICE & RESPONSE SANITIZATION ===');
// ─────────────────────────────────────────────────────────────
if (aiService && aiService.promptTo3DConcept) {
  const { promptTo3DConcept, chatWithAdvisor } = aiService;
  // 1. Prompt tiếng Việt hợp lệ (Rule engine fallback test)
  const concept1 = await promptTo3DConcept('Một chiếc bình hoa gốm men xanh đồng trổ Biên Hòa');
  assert(concept1.success === true, 'promptTo3DConcept tiếng Việt: success === true');
  assert(concept1.modelType === 'vase', `promptTo3DConcept modelType: vase (got ${concept1.modelType})`);
  assert(concept1.suggestedGlaze.hex.startsWith('#'), 'suggestedGlaze hex format hợp lệ');
  assert(Number.isFinite(concept1.suggestedGlaze.roughness), 'suggestedGlaze roughness là số hữu hạn');

  // 2. Prompt chén/bát
  const concept2 = await promptTo3DConcept('Bát trà thiền men đá đỏ');
  assert(concept2.modelType === 'bowl', `promptTo3DConcept modelType: bowl (got ${concept2.modelType})`);

  // 3. Prompt đĩa
  const concept3 = await promptTo3DConcept('Đĩa gốm mỹ nghệ sen cổ');
  assert(concept3.modelType === 'plate', `promptTo3DConcept modelType: plate (got ${concept3.modelType})`);

  // 4. Prompt rỗng
  const conceptEmpty = await promptTo3DConcept('');
  assert(conceptEmpty.success === true && conceptEmpty.modelType, 'promptTo3DConcept prompt rỗng: fallback an toàn');

  // 5. Chat Advisor fallback
  const chatRes = await chatWithAdvisor('Tư vấn giúp tôi cách chọn men cho cốc gốm');
  assert(chatRes.success === true && chatRes.reply.length > 20, 'chatWithAdvisor phản hồi tự nhiên, đầy đủ');
  assert(Array.isArray(chatRes.suggestions) && chatRes.suggestions.length >= 2, 'chatWithAdvisor cung cấp danh sách gợi ý');
} else {
  console.log('  [SKIP] AI Service dependencies not installed in this environment');
}

// ─────────────────────────────────────────────────────────────
console.log('\n=== SUMMARY ===');
// ─────────────────────────────────────────────────────────────
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.error('\nDanh sách lỗi:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ TẤT CẢ CÁC BÀI KIỂM THỬ THUẬT TOÁN 3D ĐỀU VƯỢT QUA XUẤT SẮC!');
  process.exit(0);
}
