/**
 * lathe.js — "2D Silhouette to 3D Lathe Geometry" (pure JavaScript, isomorphic).
 *
 * Chứa toàn bộ logic KHÔNG phụ thuộc native (sharp/@imgly) để biến một ảnh gốm sứ
 * (nền Studio #F8F7F4) thành:
 *   - object mask  (Uint8Array 1/0)
 *   - bounding box + centroid
 *   - silhouette scanlines (trái/phải mỗi hàng)
 *   - lathePoints (đường cong bán kính theo chiều cao Y) — dùng để xoay thành khối 3D
 *
 * Module này CÓ thể import trong 3 môi trường:
 *   - Cloudflare Worker (ES module, build bởi wrangler/esbuild) — không có sharp
 *   - Node (API server.js) — để refactor server.js sau này
 *   - Trình duyệt (FE) — Vite/ESBuild, chỉ dùng Uint8Array/Float64Array
 *
 * Port trung thực từ:
 *   - AI/potterySuitabilityAnalyzer.js  (buildObjectMask, dilateMask, countSignificantObjects, silhouetteScanlines)
 *   - API/server.js  maskAndBbox (471-487) + silhouette→lathe (540-671)
 * Chỉ khác: KHÔNG import sharp. Việc giải mã PNG/JPEG do caller (Worker dùng pngjs/jpeg-js,
 * Node dùng sharp) cung cấp raw RGBA; module này chỉ xử lý pixel.
 */

export const STUDIO_BG = { r: 248, g: 247, b: 244 };
export const ALPHA_THRESHOLD = 30;
export const COLOR_DIST_THRESHOLD = 30;

const { r: bgR, g: bgG, b: bgB } = STUDIO_BG;

/**
 * Build a Uint8 mask (1 = object pixel) from a raw RGBA buffer (nền Studio #F8F7F4).
 * Dùng trong cả Worker (mask từ ảnh bg-removed) lẫn khi nền đã là Studio.
 */
export function buildObjectMask(rgba, width, height, bg = STUDIO_BG) {
  const total = width * height;
  const mask = new Uint8Array(total);
  const R = bg.r, G = bg.g, B = bg.b;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const a = rgba[idx + 3];
    if (a <= ALPHA_THRESHOLD) continue;
    const colorDist = Math.abs(rgba[idx] - R) + Math.abs(rgba[idx + 1] - G) + Math.abs(rgba[idx + 2] - B);
    if (colorDist > COLOR_DIST_THRESHOLD) {
      mask[i] = 1;
    }
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

/** Dãn hiệp (diamond manhattan radius r) để nối các mảch rời rạp nhỏ (khe tách tay cầm...). */
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
      for (let d = 0; d < DIRS.length; d++) {
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

/** Số đối tượng ý nghĩa (dãn hiệp, bỏ blob <15% diện tích lớn nhất). */
export function countSignificantObjects(mask, w, h) {
  const dilated = dilateMask(mask, w, h, 2);
  const areas = _connectedComponentAreas(dilated, w, h, 32);
  if (areas.length === 0) return 0;
  const maxA = Math.max(...areas);
  const threshold = Math.max(32, 0.15 * maxA);
  return areas.filter((a) => a >= threshold).length;
}

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

/**
 * Tính object mask + bounding box từ raw RGBA (được cắt/đưa về 750x750 trước đó).
 * Trả về { mask, minX, maxX, minY, maxY, cx, objW, objH, area, empty }.
 */
export function maskAndBbox(rgba, pw, ph) {
  const mask = new Uint8Array(pw * ph);
  let minX = pw, maxX = -1, minY = ph, maxY = -1;
  let area = 0;
  for (let y = 0; y < ph; y++) {
    const rowOffset = y * pw;
    for (let x = 0; x < pw; x++) {
      const i = rowOffset + x;
      const idx = i * 4;
      const a = rgba[idx + 3];
      if (a <= ALPHA_THRESHOLD) continue;
      const cd = Math.abs(rgba[idx] - bgR) + Math.abs(rgba[idx + 1] - bgG) + Math.abs(rgba[idx + 2] - bgB);
      if (cd > COLOR_DIST_THRESHOLD) {
        mask[i] = 1;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const empty = area === 0 || maxX < minX || maxY < minY;
  if (empty) {
    return {
      mask,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      cx: pw / 2,
      objW: 0,
      objH: 0,
      area: 0,
      empty: true,
    };
  }

  const objW = maxX - minX + 1;
  const objH = maxY - minY + 1;
  return {
    mask,
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    objW,
    objH,
    area,
    empty: false,
  };
}

/**
 * Tính silhouette 1px-per-scanline (trái & phải) từ mask.
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

/**
 * Resize nearest-neighbor + letterbox lên đúng (NORM×NORM) trên nền Studio.
 * Thay thế sharp.extract/resize trong server.js để module này chạy ở Worker (không native).
 * Chỉ scale pixel (không nội suy) — đủ dùng cho mask/silhouette.
 */
export function resizeLetterboxRgba(rgba, sw, sh, NORM = 750) {
  const scale = NORM / Math.max(sw, sh);
  const tW = Math.max(1, Math.min(NORM, Math.round(sw * scale)));
  const tH = Math.max(1, Math.min(NORM, Math.round(sh * scale)));
  const offX = Math.max(0, Math.round((NORM - tW) / 2));
  const offY = Math.max(0, Math.round((NORM - tH) / 2));
  const totalPx = NORM * NORM;
  const out = new Uint8ClampedArray(totalPx * 4);

  // Fast studio background fill via Uint32Array (4x faster)
  const u32Out = new Uint32Array(out.buffer);
  const bgPixel32 = (255 << 24) | (bgB << 16) | (bgG << 8) | bgR;
  u32Out.fill(bgPixel32);

  // Precompute source coordinate lookup tables (removes float division from inner loop)
  const srcX = new Int32Array(tW);
  for (let x = 0; x < tW; x++) {
    srcX[x] = Math.min(sw - 1, Math.floor(x / scale));
  }
  const srcY = new Int32Array(tH);
  for (let y = 0; y < tH; y++) {
    srcY[y] = Math.min(sh - 1, Math.floor(y / scale));
  }

  // Copy target rectangle only (clean margins, zero edge-smear)
  for (let y = 0; y < tH; y++) {
    const rowSrc = srcY[y] * sw;
    const rowDst = (offY + y) * NORM + offX;
    for (let x = 0; x < tW; x++) {
      const si = (rowSrc + srcX[x]) * 4;
      const di = (rowDst + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { rgba: out, w: NORM, h: NORM };
}

/**
 * Median filter 5-element sorting network for 1D arrays (fast, no allocation).
 */
export function medianFilter5(arr) {
  const n = arr.length;
  if (n < 3) return arr.slice();
  const result = new Float64Array(n);
  const win = new Float64Array(5);
  for (let i = 0; i < n; i++) {
    for (let j = -2; j <= 2; j++) {
      const idx = Math.max(0, Math.min(n - 1, i + j));
      win[j + 2] = arr[idx];
    }
    let a = win[0], b = win[1], c = win[2], d = win[3], e = win[4];
    if (a > b) { const t = a; a = b; b = t; }
    if (d > e) { const t = d; d = e; e = t; }
    if (a > c) { const t = a; a = c; c = t; }
    if (b > c) { const t = b; b = c; c = t; }
    if (a > d) { const t = a; a = d; d = t; }
    if (c > d) { const t = c; c = d; d = t; }
    if (b > e) { const t = b; b = e; e = t; }
    if (b > c) { const t = b; b = c; c = t; }
    if (d > e) { const t = d; d = e; e = t; }
    result[i] = c;
  }
  return Array.from(result);
}

/**
 * Gaussian / Moving average filter (kernel=5, weights [1, 2, 3, 2, 1] / 9).
 */
export function gaussianSmooth5(arr) {
  const n = arr.length;
  if (n < 3) return arr.slice();
  const result = new Float64Array(n);
  const weights = [1, 2, 3, 2, 1];
  const wSum = 9;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -2; j <= 2; j++) {
      const idx = Math.max(0, Math.min(n - 1, i + j));
      sum += arr[idx] * weights[j + 2];
    }
    result[i] = sum / wSum;
  }
  return Array.from(result);
}

/**
 * Douglas-Peucker 1D trên đường cong bán kính theo chiều cao Y.
 * Giảm "đường tiết diện vỡ" từ 60 mẫu → tập hợp điểm tối thiểu.
 */
export function douglasPeucker(pts, eps = 0.012) {
  if (pts.length < 3) return pts.slice();
  let maxIdx = 0, maxDist = 0;
  const first = pts[0], last = pts[pts.length - 1];
  const segLen = Math.abs(last.y - first.y) || 1e-6;
  for (let i = 1; i < pts.length - 1; i++) {
    const t = (pts[i].y - first.y) / segLen;
    const projR = first.r + t * (last.r - first.r);
    const dist = Math.abs(pts[i].r - projR);
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist > eps) {
    return [
      ...douglasPeucker(pts.slice(0, maxIdx + 1), eps),
      ...douglasPeucker(pts.slice(maxIdx), eps).slice(1),
    ];
  }
  return [first, last];
}

/**
 * Catmull-Rom re-interpolation (resample đều theo Y để đảm bảo C² continuity, không giật cục bộ).
 */
export function catmullRomInterp(pts, targetCount = 18) {
  if (!pts || pts.length === 0) return [];
  const sorted = pts.slice().sort((a, b) => a.y - b.y);
  const n = sorted.length;
  if (n === 1) {
    return Array.from({ length: targetCount }, () => ({ ...sorted[0] }));
  }
  if (n === 2) {
    const [p0, p1] = sorted;
    const res = [];
    for (let i = 0; i < targetCount; i++) {
      const t = i / (targetCount - 1);
      res.push({
        r: Number((p0.r + t * (p1.r - p0.r)).toFixed(3)),
        y: Number((p0.y + t * (p1.y - p0.y)).toFixed(3)),
      });
    }
    return res;
  }
  const minY = sorted[0].y;
  const maxY = sorted[n - 1].y;
  const ySpan = Math.max(1e-5, maxY - minY);
  const result = [];

  for (let i = 0; i < targetCount; i++) {
    const t = i / (targetCount - 1);
    const targetY = minY + t * ySpan;

    let lo = 0;
    for (let j = 0; j < n - 1; j++) {
      if (sorted[j].y <= targetY && sorted[j + 1].y >= targetY) {
        lo = j;
        break;
      }
    }
    const hi = lo + 1;
    if (hi >= n) {
      result.push({ r: sorted[n - 1].r, y: targetY });
      continue;
    }

    const segLen = Math.abs(sorted[hi].y - sorted[lo].y) || 1e-6;
    const alpha = Math.max(0, Math.min(1, (targetY - sorted[lo].y) / segLen));

    const p0 = sorted[Math.max(0, lo - 1)];
    const p1 = sorted[lo];
    const p2 = sorted[hi];
    const p3 = sorted[Math.min(n - 1, hi + 1)];

    const t2 = alpha * alpha;
    const t3 = t2 * alpha;
    const r = 0.5 * (
      2 * p1.r +
      (-p0.r + p2.r) * alpha +
      (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * t2 +
      (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * t3
    );
    result.push({ r: Math.max(0.08, Number(r.toFixed(3))), y: Number(targetY.toFixed(3)) });
  }

  result[0] = { r: Number(sorted[0].r.toFixed(3)), y: Number(sorted[0].y.toFixed(3)) };
  result[result.length - 1] = { r: Number(sorted[n - 1].r.toFixed(3)), y: Number(sorted[n - 1].y.toFixed(3)) };
  return result;
}

/**
 * 2D Silhouette → 3D Lathe Geometry (solid of revolution) points.
 * Đồng bộ với chuẩn hình học gốm sứ và tỷ lệ không bị bẹp dẹt.
 *
 * @param {Uint8Array} mask       — object mask (1 = vật thể), trên ảnh đã chuẩn NORM×NORM.
 * @param {number} w,h            — kích thước mask.
 * @param {{minX,maxX,minY,maxY,cx,objW,objH,empty}} bbox — từ maskAndBbox.
 * @param {object} opts
 * @param {('bowl'|'mug'|'plate'|'vase'|'vase-narrow-neck')} [opts.modelType]
 * @param {Array<{x,y}>} [opts.mugPoints] — nếu modelType==='mug' và truyền vào, dùng
 *        danh sách điểm này (chuẩn pottery-mug-001) thay vì tính từ silhouette.
 * @returns {{lathePoints:Array<{x,y}>, modelType, outerCurve:Array<{r,y}>, objectCount:number, areaRatio:number, empty:boolean}}
 */
export function silhouetteToLathePoints(mask, w, h, bbox, opts = {}) {
  const modelType = opts.modelType || 'bowl';

  // Guard: Empty image / empty mask check (P0 fix)
  if (!bbox || bbox.empty || bbox.area === 0 || bbox.minX > bbox.maxX || bbox.minY > bbox.maxY || bbox.objW <= 2 || bbox.objH <= 2) {
    return { lathePoints: [], modelType, outerCurve: [], objectCount: 0, areaRatio: 0, empty: true };
  }

  const { minX, maxX, minY, maxY, cx, objW, objH } = bbox;
  const isObject = mask;

  // Lấy mẫu silhouette 60 hàng từ maxY xuống minY
  const numSamples = 60;
  const outerCurveRaw = [];
  const ySpanPx = Math.max(1, maxY - minY);
  const safeObjH = Math.max(1, objH);

  for (let i = 0; i <= numSamples; i++) {
    const sampleY = Math.round(maxY - (i / numSamples) * ySpanPx);
    const rowOffset = sampleY * w;
    let left = cx;
    let right = cx;
    for (let x = 0; x < w; x++) {
      if (isObject[rowOffset + x]) { left = x; break; }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (isObject[rowOffset + x]) { right = x; break; }
    }
    const halfWidth = Math.max(2, (right - left) / 2);
    const normY = Number((((maxY - sampleY) / safeObjH) * 2.0 - 1.0).toFixed(3));
    const normR = Number(((halfWidth / safeObjH) * 1.5).toFixed(3));
    outerCurveRaw.push({ r: Math.max(0.08, normR), y: normY });
  }

  // 1. Median filter (kernel=5) loại bỏ outlier pixel do bóng/họa tiết hoa văn
  const rawRadii = outerCurveRaw.map((p) => p.r);
  const medianRadii = medianFilter5(rawRadii);

  // 2. Gaussian / Moving Average làm mượt biên
  const smoothRadii = gaussianSmooth5(medianRadii);
  const outerCurveFiltered = outerCurveRaw.map((p, i) => ({
    r: Math.max(0.08, Number(smoothRadii[i].toFixed(3))),
    y: p.y
  }));

  // 3. Douglas-Peucker simplification
  const outerCurveDP = douglasPeucker(outerCurveFiltered, 0.012);

  // 4. Catmull-Rom re-interpolation (18 points đều đặn, C² continuous)
  const outerCurve = catmullRomInterp(outerCurveDP, 18);

  // Điểm rộng nhất = vành miệng thực
  let maxRIdx = 0;
  for (let i = 0; i < outerCurve.length; i++) {
    if (outerCurve[i].r >= outerCurve[maxRIdx].r) maxRIdx = i;
  }

  // Cho dáng bát/đĩa: miệng = điểm rộng nhất, chỉ lấy thân ngoài từ chân (i=0) đến miệng (i=maxRIdx)
  const activeCurve = (modelType === 'bowl' || modelType === 'plate') && maxRIdx >= 4
    ? outerCurve.slice(0, maxRIdx + 1)
    : outerCurve;

  // Đặc trưng cốc chuẩn pottery-mug-001 (tuỳ chọn)
  if (modelType === 'mug' && opts.mugPoints && Array.isArray(opts.mugPoints) && opts.mugPoints.length >= 10) {
    const lathePoints = opts.mugPoints.map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) }));
    return { lathePoints, modelType, outerCurve, objectCount: 1, areaRatio: 1.0, empty: false };
  }

  // Chuẩn hóa tỷ lệ theo từng hình thái dáng gốm độc bản (chống biến dạng dẹp bẹt)
  let targetYSpan = 2.45;
  let targetMaxR = 1.15;
  let targetMinY = -1.15;
  let footMinR = 0.45;

  if (modelType === 'bowl') {
    targetYSpan = 1.20;
    targetMaxR = 1.40;
    targetMinY = -0.65;
    footMinR = 0.40;
  } else if (modelType === 'plate') {
    targetYSpan = 0.48;
    targetMaxR = 1.55;
    targetMinY = -0.22;
    footMinR = 0.50;
  } else if (modelType === 'mug') {
    targetYSpan = 1.50;
    targetMaxR = 1.05;
    targetMinY = -0.75;
    footMinR = 0.48;
  } else if (modelType === 'vase-narrow-neck') {
    targetYSpan = 2.60;
    targetMaxR = 1.15;
    targetMinY = -1.20;
    footMinR = 0.45;
  }

  let maxR = 0.08;
  for (const pt of activeCurve) {
    if (pt.r > maxR) maxR = pt.r;
  }
  const rScale = maxR > 0 ? (targetMaxR / maxR) : 1.0;

  const baseMinY = activeCurve.length > 0 ? activeCurve[0].y : -1.0;
  const baseMaxY = activeCurve.length > 0 ? activeCurve[activeCurve.length - 1].y : 1.0;
  const ySpan = Math.max(0.01, baseMaxY - baseMinY);

  const scaledCurve = activeCurve.map((pt, idx) => {
    const normY = Number((targetMinY + ((pt.y - baseMinY) / ySpan) * targetYSpan).toFixed(3));
    const minR = idx === 0 ? footMinR : (idx === 1 ? (footMinR + 0.05) : 0.08);
    const scaledR = Number(Math.max(minR, pt.r * rScale).toFixed(3));
    return { r: scaledR, y: normY };
  });

  const lathePoints = [];

  // 1. Chân đế tiếp xúc mặt bàn
  lathePoints.push({ x: 0, y: scaledCurve[0].y });
  lathePoints.push({ x: scaledCurve[0].r, y: scaledCurve[0].y });

  // 2. Thân ngoài: chân → vành miệng
  for (let i = 1; i < scaledCurve.length; i++) {
    lathePoints.push({ x: scaledCurve[i].r, y: scaledCurve[i].y });
  }

  // 3. Vành miệng bo tròn nhẹ
  const rimPoint = scaledCurve[scaledCurve.length - 1];
  const wallThick = Math.min(rimPoint.r * 0.25, Math.max(0.04, rimPoint.r * 0.10));
  lathePoints.push({
    x: Math.max(0.04, Number((rimPoint.r - wallThick * 0.4).toFixed(3))),
    y: Number((rimPoint.y + 0.04).toFixed(3))
  });
  lathePoints.push({
    x: Math.max(0.04, Number((rimPoint.r - wallThick).toFixed(3))),
    y: rimPoint.y
  });

  // 4. Lòng trong khoét sâu xuống đáy (adaptive wall thickness, không tự giao nhau)
  for (let i = scaledCurve.length - 2; i >= 1; i--) {
    const localThick = Math.min(scaledCurve[i].r * 0.28, wallThick);
    const inR = Math.max(0.04, scaledCurve[i].r - localThick);
    lathePoints.push({
      x: Number(inR.toFixed(3)),
      y: Number((scaledCurve[i].y + 0.02).toFixed(3))
    });
  }

  // 5. Chạm đáy lòng trong
  lathePoints.push({ x: 0, y: Number((scaledCurve[0].y + 0.15).toFixed(3)) });

  const objectCount = countSignificantObjects(isObject, w, h);
  const areaRatio = bbox.objW * bbox.objH > 0 ? (bbox.objW * bbox.objH) / (w * h) : 0;

  return { lathePoints, modelType, outerCurve, objectCount, areaRatio, empty: false };
}

/**
 * Convenience: từ raw RGBA (bất kỳ kích thước nào) → resize letterbox 750 → mask → lathePoints.
 * Đây là entry point chính cho Worker/FE browser.
 */
export function imageToLathePoints(rgba, w, h, opts = {}) {
  const normSize = opts.NORM || 750;
  const { rgba: normRgba, w: nw, h: nh } = resizeLetterboxRgba(rgba, w, h, normSize);
  const bbox = maskAndBbox(normRgba, nw, nh);
  if (bbox.empty || bbox.area === 0 || bbox.objW <= 2 || bbox.objH <= 2) {
    return {
      lathePoints: [],
      modelType: opts.modelType || 'bowl',
      outerCurve: [],
      objectCount: 0,
      areaRatio: 0,
      empty: true
    };
  }
  return silhouetteToLathePoints(bbox.mask, nw, nh, bbox, opts);
}

/**
 * Server-side render-fidelity (CPU fallback). So sánh silhouette của ảnh 2D nguồn
 * (refRgba) với silhouette của render 3D (rendRgba) — IoU trên 2 mask binary.
 * Dùng khi không có WebGL (Worker/server). Node-testable (pure, không native).
 *
 * Plan Phase 1: `score` = IoU 0..1 (cao = khớp); `iou` trùng với score.
 * Caller phải cung cấp 2 buffer RGBA cùng kích thước (W×H); nếu khác size, caller resizeLetterbox trước.
 */
export function computeSilhouetteFidelity(refRgba, rendRgba, w, h, opts = {}) {
  if (!refRgba || !rendRgba) return { ok: false, score: null, iou: null, error: 'missing image data' };
  if (refRgba.length < w * h * 4 || rendRgba.length < w * h * 4) {
    return { ok: false, score: null, iou: null, error: 'rgba buffer length < w*h*4' };
  }
  const refBg = opts.refBg || opts.bg || STUDIO_BG;
  const rendBg = opts.rendBg || opts.bg || STUDIO_BG;
  const mRef = buildObjectMask(refRgba, w, h, refBg);
  const mRend = buildObjectMask(rendRgba, w, h, rendBg);
  let inter = 0, union = 0, refArea = 0, rendArea = 0;
  for (let i = 0; i < w * h; i++) {
    const a = mRef[i] ? 1 : 0;
    const b = mRend[i] ? 1 : 0;
    refArea += a; rendArea += b; inter += a & b; union += a | b;
  }
  const iou = union === 0 ? 0 : inter / union;
  return {
    ok: true,
    score: iou,
    iou,
    refArea,
    rendArea,
    inter,
    union,
    note: union === 0 ? 'both silhouettes empty' : (refArea === 0 ? 'reference empty' : (rendArea === 0 ? 'render empty' : '')),
  };
}

