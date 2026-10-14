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
  const mask = new Uint8Array(width * height);
  const R = bg.r, G = bg.g, B = bg.b;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const colorDist = Math.abs(rgba[idx] - R) + Math.abs(rgba[idx + 1] - G) + Math.abs(rgba[idx + 2] - B);
    const a = rgba[idx + 3];
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
 * Trả về { mask, minX, maxX, minY, maxY, cx, objW, objH }. (port từ server.js maskAndBbox)
 */
export function maskAndBbox(rgba, pw, ph) {
  const mask = new Uint8Array(pw * ph);
  let minX = pw, maxX = 0, minY = ph, maxY = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = y * pw + x;
      const idx = i * 4;
      const cd = Math.abs(rgba[idx] - bgR) + Math.abs(rgba[idx + 1] - bgG) + Math.abs(rgba[idx + 2] - bgB);
      if (rgba[idx + 3] > 30 && cd > 30) {
        mask[i] = 1;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { mask, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, objW: Math.max(1, maxX - minX), objH: Math.max(1, maxY - minY) };
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
  const tW = Math.max(1, Math.round(sw * scale));
  const tH = Math.max(1, Math.round(sh * scale));
  const offX = Math.round((NORM - tW) / 2);
  const offY = Math.round((NORM - tH) / 2);
  const out = new Uint8ClampedArray(NORM * NORM * 4);
  // nền Studio
  for (let i = 0; i < NORM * NORM; i++) {
    const ii = i * 4; out[ii] = bgR; out[ii + 1] = bgG; out[ii + 2] = bgB; out[ii + 3] = 255;
  }
  const sx = (x) => Math.floor(x / scale);
  const sy = (y) => Math.floor(y / scale);
  const sxMax = Math.min(sw - 1, Math.ceil((NORM - 2 * offX) / scale));
  for (let y = 0; y < NORM; y++) {
    const fy = Math.max(0, Math.min(sh - 1, sy(y - offY)));
    for (let x = 0; x < NORM; x++) {
      const fx = Math.max(0, Math.min(sw - 1, sx(x - offX)));
      const si = (fy * sw + fx) * 4;
      const di = (y * NORM + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { rgba: out, w: NORM, h: NORM };
}

/**
 * Douglas-Peucker 1D trên đường cong bán kính theo chiều cao Y.
 * Giảm "đường tiết diện vỡ" từ 60 mẫu → tập hợp điểm tối thiểu.
 */
function douglasPeucker(pts, eps = 0.012) {
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
 * 2D Silhouette → 3D Lathe Geometry (solid of revolution) points.
 *
 * Port trực tiếp từ API/server.js 540-671 (phần pure-JS; bỏ qua phần render PNG 6-view
 * vì FE/CeramicCanvas3D + orthographicRenderer.js tự render 3D từ lathePoints).
 *
 * @param {Uint8Array} mask       — object mask (1 = vật thể), trên ảnh đã chuẩn NORM×NORM.
 * @param {number} w,h            — kích thước mask.
 * @param {{minX,maxX,minY,maxY,cx,objW,objH}} bbox — từ maskAndBbox.
 * @param {object} opts
 * @param {('bowl'|'mug'|'plate'|'vase'|'vase-narrow-neck')} [opts.modelType]
 * @param {Array<{x,y}>} [opts.mugPoints] — nếu modelType==='mug' và truyền vào, dùng
 *        danh sách điểm này (chuẩn pottery-mug-001) thay vì tính từ silhouette.
 * @returns {{lathePoints:Array<{x,y}>, modelType, outerCurve:Array<{r,y}>, objectCount:number, areaRatio:number}}
 */
export function silhouetteToLathePoints(mask, w, h, bbox, opts = {}) {
  const { minX, maxX, minY, maxY, cx, objW, objH } = bbox;
  const modelType = opts.modelType || 'bowl';
  const isObject = mask;

  // 2.1 Lấy mẫu silhouette 60 hàng (từ maxY xuống minY), mỗi hàng lấy left/right → (r = bán kính, y = tọa độ cao chuẩn hoá)
  const numSamples = 60;
  const outerCurveRaw = [];
  for (let i = 0; i <= numSamples; i++) {
    const sampleY = Math.round(maxY - (i / numSamples) * (maxY - minY));
    let left = cx;
    let right = cx;
    for (let x = 0; x < w; x++) {
      if (isObject[sampleY * w + x]) { left = x; break; }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (isObject[sampleY * w + x]) { right = x; break; }
    }
    const halfWidth = Math.max(2, (right - left) / 2);
    const normY = Number((((maxY - sampleY) / objH) * 2.0 - 1.0).toFixed(3));
    const normR = Number(((halfWidth / objH) * 1.5).toFixed(3));
    outerCurveRaw.push({ r: Math.max(0.08, normR), y: normY });
  }

  // Douglas-Peucker làm mượt
  const outerCurve = douglasPeucker(outerCurveRaw, 0.012);

  // Điểm rộng nhất = vành miệng thực (mỗi hàng r cộng đồng)
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
    return { lathePoints, modelType, outerCurve, objectCount: 1, areaRatio: 1.0 };
  }

  let lathePoints = [];
  const maxR = activeCurve.length > 0 ? Math.max(...activeCurve.map((p) => p.r)) : 0;
  const rScale = maxR > 0 ? (1.42 / maxR) : 1.0;

  const baseMinY = activeCurve.length > 0 ? activeCurve[0].y : -1.0;
  const baseMaxY = activeCurve.length > 0 ? activeCurve[activeCurve.length - 1].y : 1.0;
  const ySpan = Math.max(0.01, baseMaxY - baseMinY);

  const scaledCurve = activeCurve.map((pt, idx) => {
    const normY = Number((-0.65 + ((pt.y - baseMinY) / ySpan) * 1.25).toFixed(3));
    const minR = idx === 0 ? 0.48 : (idx === 1 ? 0.50 : 0.08);
    const scaledR = Number(Math.max(minR, pt.r * rScale).toFixed(3));
    return { r: scaledR, y: normY };
  });

  // Chân đế tiếp xúc mặt bàn
  lathePoints.push({ x: 0, y: scaledCurve[0].y });
  lathePoints.push({ x: scaledCurve[0].r, y: scaledCurve[0].y });

  // Thân ngoài: chân → vành miệng
  for (let i = 1; i < scaledCurve.length; i++) {
    lathePoints.push({ x: scaledCurve[i].r, y: scaledCurve[i].y });
  }

  // Vành miệng bo tròn nhẹ (lòe thanh thoát)
  const rimPoint = scaledCurve[scaledCurve.length - 1];
  const wallThick = Math.max(0.08, rimPoint.r * 0.10);
  lathePoints.push({ x: Math.max(0.04, Number((rimPoint.r - wallThick * 0.4).toFixed(3))), y: Number((rimPoint.y + 0.04).toFixed(3)) });
  lathePoints.push({ x: Math.max(0.04, Number((rimPoint.r - wallThick).toFixed(3))), y: rimPoint.y });

  // Lòng trong khoét sâu xuống đáy (mirror các điểm thân ngoài trừ vành miệng)
  for (let i = scaledCurve.length - 2; i >= 1; i--) {
    const inR = Math.max(0.04, scaledCurve[i].r - wallThick);
    lathePoints.push({ x: Number(inR.toFixed(3)), y: Number((scaledCurve[i].y + 0.02).toFixed(3)) });
  }
  // Chạm đáy lòng trong
  lathePoints.push({ x: 0, y: Number((scaledCurve[0].y + 0.15).toFixed(3)) });

  const objectCount = countSignificantObjects(isObject, w, h);
  const areaRatio = bbox.objW * bbox.objH > 0 ? (bbox.objW * bbox.objH) / (w * h) : 0;

  return { lathePoints, modelType, outerCurve, objectCount, areaRatio };
}

/**
 * Convenience: từ raw RGBA (bất kỳ kích thước nào) → resize letterbox 750 → mask → lathePoints.
 * Đây là entry point chính cho Worker/FE browser.
 */
export function imageToLathePoints(rgba, w, h, opts = {}) {
  const { rgba: normRgba, w: nw, h: nh } = resizeLetterboxRgba(rgba, w, h, opts.NORM || 750);
  const bbox = maskAndBbox(normRgba, nw, nh);
  if (bbox.empty) return { lathePoints: [], modelType: opts.modelType || 'bowl', outerCurve: [], objectCount: 0, areaRatio: 0, empty: true };
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

