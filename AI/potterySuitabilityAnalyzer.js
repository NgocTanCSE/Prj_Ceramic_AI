/**
 * potterySuitabilityAnalyzer.js
 *
 * "Đọc vật thể" — phân tích một bức ảnh phôi gốm (đã tách nền, nền Studio #F8F7F4)
 * để quyết định xem khối hình có **phù hợp để nặn (đất nặn dẻo / nặn xoay trục)**
 * không, và dự báo khả năng co/kéo của đất.
 *
 * Nguyên tắc (không dùng LLM, không cần GPU):
 *   1. Tính object mask từ background Studio.
 *   2. Đếm đối tượng thực sự (dãn hiệp để nối khe rách, bỏ nhiễu nhỏ) — thực thi "chỉ 1 đối tượng".
 *   3. Gate vật lý (loose): CHỈ từ chối empty / multi_object / low_fill. Không cứng như trước
 *      (trước đây dùng circularity>0.96/sym<0.6 để từ chối — nhưng ảnh bát thật chụp góc/đổ bóng
 *      thường có circularity ~1.0 và sym thấp mà vẫn là gốm, nên bị false-reject). Các tín hiệu
 *      hình dạng chỉ thành `shapeNote` thông tin, dùng UI cảnh báo nếu cần.
 *   4. Dò rim risk / wall-thickness proxy từ slope của silhouette.
 *   5. Dự báo pliability (khả năng nặn) dựa trên độ "góc sắc".
 *
 * Trả về một đối tượng gán thẳng vào response JSON của /api/ai/clean-and-deconstruct.
 */

import sharp from 'sharp';

const STUDIO_BG = { r: 248, g: 247, b: 244 };
const ALPHA_THRESHOLD = 30;
const COLOR_DIST_THRESHOLD = 30; // L1 distance — hẹt hơn 12 của thuật toán cũ để tránh "lem viền"

/** Build a Uint8 mask (1 = object pixel) from a raw RGBA buffer. */
export function buildObjectMask(rgba, width, height) {
  const mask = new Uint8Array(width * height);
  const { r: br, g: bg, b: bb } = STUDIO_BG;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    const a = rgba[idx + 3];
    const colorDist = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
    mask[i] = a > ALPHA_THRESHOLD && colorDist > COLOR_DIST_THRESHOLD ? 1 : 0;
  }
  return mask;
}

function bboxFromMask(mask, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, area, empty: area === 0 };
}

/**
 * Đếm số thành phần (đối tượng) nối tiếp trên mask (8-connectivity, BFS).
 * Trả về số miếng ghép có diện tích ≥ minArea. (Dùng cho debug/dev.)
 */
export function countConnectedComponents(mask, width, height, minArea = 32) {
  if (!mask || mask.length === 0) return 0;
  const visited = new Uint8Array(width * height);
  const qx = new Int32Array(width * height);
  const qy = new Int32Array(width * height);
  const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  let components = 0;
  for (let i = 0; i < width * height; i++) {
    if (!mask[i] || visited[i]) continue;
    const sy = (i / width) | 0;
    const sx = i - sy * width;
    let head = 0, tail = 0;
    qx[tail] = sx; qy[tail] = sy; visited[i] = 1; tail++;
    let area = 0;
    while (head < tail) {
      const cx = qx[head]; const cy = qy[head]; head++;
      area++;
      for (let d = 0; d < DIRS.length; d++) {
        const nx = cx + DIRS[d][0]; const ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (mask[ni] && !visited[ni]) { visited[ni] = 1; qx[tail] = nx; qy[tail] = ny; tail++; }
      }
    }
    if (area >= minArea) components++;
  }
  return components;
}

/** Dãn hiệp (diamond manhattan radius r) để nối các mảch rời rạp nhỏ (khe tách tay cầm, nhiễu). */
export function dilateMask(mask, w, h, r = 2) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        const maxDx = r - Math.abs(dy);
        for (let dx = -maxDx; dx <= maxDx; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          out[yy * w + xx] = 1;
        }
      }
    }
  }
  return out;
}

function _connectedComponentAreas(mask, w, h, minArea) {
  const visited = new Uint8Array(w * h);
  const qx = new Int32Array(w * h);
  const qy = new Int32Array(w * h);
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const areas = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || visited[i]) continue;
    const sy = (i / w) | 0;
    const sx = i - sy * w;
    let head = 0, tail = 0; qx[tail] = sx; qy[tail] = sy; visited[i] = 1; tail++; let area = 0;
    while (head < tail) {
      const cx = qx[head]; const cy = qy[head]; head++; area++;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS[d][0]; const ny = cy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (mask[ni] && !visited[ni]) { visited[ni] = 1; qx[tail] = nx; qy[tail] = ny; tail++; }
      }
    }
    if (area >= minArea) areas.push(area);
  }
  return areas;
}

/**
 * Đếm số đối tượng ý nghĩa: dãn hiệp nhẹ để nối khe rách (tay cầm, nhiễu), rồi chỉ tính
 * miếng ghép có diện tích ≥ 5% diện tích lớn nhất — loại nhiễu nhỏ, nhưng vẫn báo khi có ≥2 đối tượng thật.
 * Đây là chìa khóa để "1 đối tượng thật" không bị gán nhầm thành "nhiều đối tượng".
 */
export function countSignificantObjects(mask, w, h) {
  const dilated = dilateMask(mask, w, h, 2);
  const areas = _connectedComponentAreas(dilated, w, h, 32);
  if (areas.length === 0) return 0;
  const maxA = Math.max(...areas);
  // Ngưỡng 15% (thay vì 5%): với ảnh thực bg-removal thỉnh thoảng để lại bóng/reflection dưới dạng
  // blob mỏng (thường < 15% diện tích mảnh chính). Coi blob < 15% là nhiễu/phụ trợ — tránh bật
  // multi_object cho 1 bát thật. Hai đồ vật thật (cốc/cốc) thường mỗi ≥~40% → vẫn bị từ chối.
  const threshold = Math.max(32, 0.15 * maxA);
  return areas.filter((a) => a >= threshold).length;
}

/**
 * Tính silhouette 1px-per-scanline (trái & phải) để dùng cho cả lathe lẫn analyzer.
 * Trả về mảng { y, left, right, width }.
 */
export function silhouetteScanlines(mask, w, h) {
  const lines = [];
  for (let y = 0; y < h; y++) {
    let left = -1;
    let right = -1;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (left === -1) left = x;
        right = x;
      }
    }
    if (left !== -1) lines.push({ y, left, right, width: right - left });
  }
  return lines;
}

/** Đánh giá đối xứng trái/phải của outline (0..1, 1 = đối xứng hoàn hảo). */
function symmetryScore(lines, w, h) {
  if (lines.length === 0) return 0;
  // centroid X của toàn bộ object pixels
  let cxSum = 0, count = 0;
  for (const l of lines) {
    cxSum += (l.left + l.right) * 0.5 * (l.width + 1);
    count += (l.width + 1);
  }
  const cx = count ? cxSum / count : w / 2;

  let diffSum = 0, sampleN = 0;
  for (const l of lines) {
    const half = l.width / 2;
    if (half < 1) continue;
    const leftBound = l.left;
    const rightBound = l.right;
    const mid = (leftBound + rightBound) / 2;
    // so sánh pixel lấy mẫu dọc theo scanline
    const step = Math.max(1, Math.round(half / 12));
    for (let k = 0; k <= half; k += step) {
      const xl = Math.round(leftBound + k);
      const xr = Math.round(rightBound - k);
      if (xl >= 0 && xr < w) {
        diffSum += Math.abs(xl - (2 * mid - xr)); // lệch so với trục đối xứng tại mid
        sampleN++;
      }
    }
  }
  const avgDiff = sampleN ? diffSum / sampleN : half || 0;
  const norm = Math.max(1, w / 2);
  return Math.max(0, Math.min(1, 1 - avgDiff / norm));
}

/**
 * Phân tích khả năng nặn của một khối ảnh phôi gốm.
 * @param {Buffer} imageBuffer RGBA/PNG buffer (nền đã là Studio #F8F7F4).
 * @param {object} opts { modelType, lathePoints }
 */
export async function analyzePotterySuitability(imageBuffer, opts = {}) {
  const { modelType = 'bowl', lathePoints = null } = opts;
  const { data: rgba, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const w = info.width;
  const h = info.height;
  const mask = buildObjectMask(rgba, w, h);
  const bb = bboxFromMask(mask, w, h);
  if (bb.empty) {
    return {
      suitable: false,
      isPottery: false,
      category: 'empty',
      objectCount: 0,
      reason: 'Không phát hiện vật thể nào trong ảnh (cảnh quống nghĩa trống hoặc trùng nền).',
      pliability: 'không xác định',
      score: 0,
      scoreLabel: 'Rất thấp',
      symmetryScore: 0,
      circularity: 0,
      aspectRatio: 0,
      aspectFit: 'không phù hợp',
      rimRisk: 'cao',
      wallThickness: 'quá mỏng',
      shapeNote: null,
      recommendation: 'Không phát hiện vật thể trong ảnh.',
    };
  }

  const lines = silhouetteScanlines(mask, w, h);
  const area = bb.area;
  const bbW = Math.max(1, bb.maxX - bb.minX + 1);
  const bbH = Math.max(1, bb.maxY - bb.minY + 1);
  const ar = bbW / bbH;
  const aspectFit =
    ar >= 0.9 && ar <= 1.2 ? 'trục xoay tròn (bát/đĩa)' :
    ar > 1.2 ? 'mặt phẳng (đĩa lớn)' :
    ar < 0.9 ? 'thon dọc (bình/cốc)' : 'lệch trục';

  const sym = symmetryScore(lines, w, h);
  const circularity = area / (bbW * bbH);

  // ── Phase 1 (physical-object gate, loose): "chỉ xác thựng là đồ vật, không phải phong cảnh/human" ──
  // CHỈ từ chối khi thực sự không có đối tượng thực sự: empty · multi_object · low_fill.
  // KHÔNG chặn theo circularity/sym — ảnh bát thực tế chụp góc/đổ bóng thường sinh mask dẻ cộng
  // (circularity ~1.0) hay mờ (sym thấp) mà vẫn là gốm. Các tín hiệu hình dạng chỉ thành `shapeNote` thông tin.
  const objectCount = countSignificantObjects(mask, w, h);
  const areaRatio = area / (w * h);
  const isPottery = objectCount === 1 && !bb.empty && areaRatio >= 0.03;

  let category;
  let reason;
  let shapeNote = null;
  if (objectCount > 1) {
    category = 'multi_object';
    reason = `Phát hiện ${objectCount} đối tượng — chỉ chọn 1 mảnh gốm/đồ vật duy nhất.`;
  } else if (areaRatio < 0.03) {
    category = 'low_fill';
    reason = 'Vật thể chiếm quá nhỏ trong khung (có thể là cảnh quống nghĩa / đối tượng xa) — vui lòng chụp gần đối tượng.';
  } else {
    // Chấp nhận (là một đồ vật thực). Ghi chú hình dạng để UI tham khảo, KHÔNG chặn:
    category = modelType;
    reason = null;
    if (circularity > 0.92) shapeNote = 'Đối tượng đầy khung — có thể là đĩa/trang gốm phẳng hoặc ảnh chưa tách nền hoàn toàn.';
    else if (sym < 0.6) shapeNote = 'Đối tượng hơi không đối xứng (ảnh chụp góc/đổ bóng) — vẫn khả thi.';
    else if (circularity < 0.35) shapeNote = 'Vật thể hơi thưa — kiểm tra lại góc chụp.';
  }

  // rim risk + wall-thickness proxy từ độ dốc silhouette (slope)
  let sharpAngles = 0, slopeSum = 0, slopeN = 0;
  let prevLeft = null, prevRight = null;
  for (const l of lines) {
    if (prevLeft !== null) {
      const dl = Math.abs((l.left - prevLeft));
      const dr = Math.abs((l.right - prevRight));
      const slope = (dl + dr) / 2;
      slopeSum += slope;
      slopeN++;
      // "góc sắc" = biến đổi bất ngờ lớn giữa các scanline → dễ nứt
      if (slope > Math.max(3, w * 0.02)) sharpAngles++;
    }
    prevLeft = l.left;
    prevRight = l.right;
  }
  const avgSlope = slopeN ? slopeSum / slopeN : 0;
  const rimRisk = sharpAngles > Math.max(6, lines.length * 0.06) ? 'cao' : (sharpAngles > 0 ? 'trung bình' : 'thấp');
  const wallThickness =
    avgSlope < 1.2 ? 'dày vững' :
    avgSlope < 3.5 ? 'vừa phải' :
    avgSlope < 6 ? 'hơi mỏng' : 'quá mỏn (nguy cơ nứt)';

  // pliability (khả năng nặn) — tổng hợp
  let pliability;
  if (ar > 2.5 || ar < 0.25) {
    pliability = 'khó nặn (bất thường)';
  } else if (sym > 0.85 && circularity > 0.55 && rimRisk !== 'cao') {
    pliability = 'rất dẻo, thích ứng nặn xoay tốt';
  } else if (sym > 0.7 && rimRisk !== 'cao') {
    pliability = 'dẻo mịn, nặn được';
  } else if (rimRisk === 'cao') {
    pliability = 'cần ủ ấm trước khi nặn (góc sắc)';
  } else {
    pliability = 'được, nhưng cần chú ý căng thẳng';
  }

  const suitable = isPottery && !['không phù hợp'].includes(aspectFit);
  const score = Math.round(sym * 40 + circularity * 40 + (rimRisk === 'thấp' ? 20 : rimRisk === 'trung bình' ? 10 : 0));

  let recommendation;
  if (!suitable) {
    recommendation = `Không chấp nhận: ${reason} (category=${category}).`;
  } else if (shapeNote) {
    recommendation = `Chấp nhận làm đồ vật. Lưu ý: ${shapeNote} sym=${(sym * 100).toFixed(0)}%, circularity=${Math.round(circularity * 100)}%.`;
  } else {
    recommendation =
      `Khối hình ${modelType} đối xứng tốt (sym=${(sym * 100).toFixed(0)}%, vòng tròn ${Math.round(circularity * 100)}%), phù hợp nặn xoay trụx. Dày thành: ${wallThickness}.`;
  }

  return {
    suitable,
    isPottery,
    category,
    objectCount,
    reason: reason || recommendation,
    pliability,
    score: Math.min(100, Math.max(0, score)),
    scoreLabel:
      score >= 80 ? 'Rất cao' :
      score >= 65 ? 'Cao' :
      score >= 50 ? 'Trung bình' :
      score >= 35 ? 'Thấp' : 'Rất thấp',
    symmetryScore: Number((sym * 100).toFixed(1)),
    circularity: Number((circularity * 100).toFixed(1)),
    aspectRatio: Number(ar.toFixed(2)),
    aspectFit,
    rimRisk,
    wallThickness,
    avgSlope: Number(avgSlope.toFixed(3)),
    sharpAngles,
    pixelArea: area,
    areaRatio: Number(areaRatio.toFixed(3)),
    shapeNote,
    recommendation,
  };
}
