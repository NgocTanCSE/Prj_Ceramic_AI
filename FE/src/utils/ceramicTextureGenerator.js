import * as THREE from 'three';
import { normalizeTextForPottery } from './textNormalizer.js';

/**
 * ceramicTextureGenerator.js
 *
 * Bộ công cụ vẽ texture men gốm và hoa văn 2D độc lập:
 * - Dùng chung cho cả CeramicCanvas3D và orthographicRenderer.
 * - Đảm bảo màu sắc hiển thị trên mô hình 3D và ảnh chụp 6 mặt trực giao đồng bộ 100%.
 */

// Image cache for decal motifs
export const imageCache = new Map();

// Canvas texture cache (Phase 3 perf): tránh render lại 16 canvas/thao tác resize
// khi các tùy chọn không thay đổi. Chỉ cache cho texture không phụ thuộc ảnh async.
const textureCanvasCache = new Map();
function cacheKey(opts) {
  return [
    opts.glazeColor, opts.glazeName, opts.pattern, opts.rimStyle,
    opts.modelType, opts.customText,
    JSON.stringify(opts.textTransform || {}),
    JSON.stringify(opts.patternTransform || {}),
    // Phase 3 FIX: latheProfile ảnh hưởng trực tiếp tới circScale (pattern/text scale + placement) nên
    // phải nằm trong cache key — thiếu trường này thì đổi profile thì texture bị cache thời gian thực sai lệch.
    JSON.stringify(opts.latheProfile || null),
    opts.width, opts.height,
  ].join('|');
}

/**
 * Default lathe radius profile (normalized y ∈ [-1,1] → r ∈ [0,1]) cho từng dáng
 * chuẩn. Dùng để tính circumference-thực tế tại vị trí pattern/text (Phase 3 fix lệch/vỡ).
 */
export function getDefaultLatheProfile(modelType = 'bowl') {
  // {y, r} theo thứ tự từ chân → miệng. r là bán kính so với bán kính lớn nhất.
  const profiles = {
    bowl: [
      { y: -0.65, r: 0.48 }, { y: -0.52, r: 0.50 }, { y: -0.40, r: 0.68 },
      { y: -0.22, r: 0.92 }, { y: 0.00, r: 1.00 }, { y: 0.25, r: 1.38 },
      { y: 0.50, r: 1.48 }, { y: 0.54, r: 1.46 },
    ],
    plate: [
      { y: -0.22, r: 0.48 }, { y: -0.07, r: 0.73 }, { y: 0.12, r: 1.00 }, { y: 0.26, r: 1.00 },
      { y: 0.00, r: 0.71 }, { y: -0.18, r: 0.44 },
    ],
    mug: [
      { y: -0.75, r: 0.55 }, { y: -0.50, r: 0.98 }, { y: 0.00, r: 1.04 },
      { y: 0.50, r: 0.94 }, { y: 0.72, r: 1.02 }, { y: 0.74, r: 0.90 }, { y: 0.50, r: 0.85 },
    ],
    vase: [
      { y: -1.15, r: 0.70 }, { y: -0.90, r: 0.75 }, { y: -0.30, r: 1.15 }, { y: 0.10, r: 1.18 },
      { y: 0.70, r: 0.55 }, { y: 1.05, r: 0.48 }, { y: 1.30, r: 0.40 },
    ],
    'vase-narrow-neck': [
      { y: -1.20, r: 0.55 }, { y: -1.00, r: 0.65 }, { y: -0.40, r: 1.05 }, { y: 0.00, r: 1.15 },
      { y: 0.45, r: 0.55 }, { y: 0.80, r: 0.28 }, { y: 1.00, r: 0.26 }, { y: 1.40, r: 0.20 },
    ],
  };
  return profiles[modelType] || profiles.bowl;
}

/** radius (0..1) của thân tại chiều cao pixel cy (0..height), dựa trên profile thực tế của mô hình 3D. */
export function radiusAtHeight(cy, height, modelType, latheProfile = null) {
  const profile = latheProfile && Array.isArray(latheProfile) && latheProfile.length
    ? latheProfile
    : getDefaultModelProfile(modelType);
  const pts = profile.map((p) => ({
    y: p.y !== undefined ? p.y : 0,
    r: p.r !== undefined ? p.r : (p.x !== undefined ? p.x : 0),
  }));
  if (!pts.length) return 1.0;

  // FIX (object height bug): Thay đổi từ nội suy index-based sang Y-value-based.
  // LathePoints từ server (và cả profile mặc định) có thể không đơn điệu theo Y
  // (do các điểm thành trong, rim extension). Nội suy theo index gây lệch vị trí.
  // Ánh xạ v = 1 - cy/height → Y target trong [-1, +1] dựa trên profile,
  // sau đó tìm 2 điểm bracketing Y target để nội suy bán kính chính xác.
  const normV = Math.max(0, Math.min(1, 1 - cy / height));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const yRange = Math.max(0.001, maxY - minY);
  const yTarget = minY + normV * yRange;

  // Sắp xếp profile theo Y để tìm bracketing points
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  let rAt = sorted[0].r;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].y <= yTarget && sorted[i + 1].y >= yTarget) {
      const span = Math.max(0.001, sorted[i + 1].y - sorted[i].y);
      const frac = (yTarget - sorted[i].y) / span;
      rAt = sorted[i].r + frac * (sorted[i + 1].r - sorted[i].r);
      break;
    }
  }

  const maxR = Math.max(...pts.map((p) => p.r), 1e-4);
  return Math.max(0, rAt / maxR);
}


/**
 * Tự động chuyển đổi ảnh hoa văn/logo/chữ vẽ tay có nền trắng hoặc sáng thành PNG trong suốt
 * Giúp họa tiết ôm sát lớp men gốm 3D một cách chân thực mà không bị mảng viền trắng thô.
 */
export function makeImageTransparent(img) {
  if (!img || !img.width || !img.height) return img;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const w = canvas.width;
    const h = canvas.height;
    const corners = [
      0,
      (w - 1) * 4,
      ((h - 1) * w) * 4,
      ((h - 1) * w + w - 1) * 4
    ];

    let whiteCornerCount = 0;
    for (const c of corners) {
      if (data[c] > 215 && data[c + 1] > 215 && data[c + 2] > 215) whiteCornerCount++;
    }

    // Nếu ảnh có nền trắng hoặc giấy sáng màu (>= 2 góc trắng)
    if (whiteCornerCount >= 2) {
      // FIX: Flood-fill từ 4 góc để chỉ làm trong suốt vùng nền liên thông,
      // tránh làm mất màu của họa tiết bên trong (ví dụ: cánh hoa sen màu vàng nhạt).
      const stack = [];
      const visited = new Uint8Array(w * h);
      const corners4 = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
      for (const [cx0, cy0] of corners4) {
        const idx = cy0 * w + cx0;
        if (!visited[idx]) { stack.push(idx); visited[idx] = 1; }
      }
      while (stack.length) {
        const idx = stack.pop();
        const i4 = idx * 4;
        const r = data[i4], g = data[i4 + 1], b = data[i4 + 2];
        // Chỉ flood-fill qua các pixel gần trắng (nền)
        if (r > 200 && g > 200 && b > 200) {
          data[i4 + 3] = 0;
          const x = idx % w, y = (idx / w) | 0;
          const neighbors = [
            x > 0 ? idx - 1 : -1,
            x < w - 1 ? idx + 1 : -1,
            y > 0 ? idx - w : -1,
            y < h - 1 ? idx + w : -1,
          ];
          for (const ni of neighbors) {
            if (ni >= 0 && !visited[ni]) { visited[ni] = 1; stack.push(ni); }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }
    return img;
  } catch (_) {
    return img;
  }
}

// Preload image helper ensuring image is decoded and ready before rendering
export function preloadImage(src, autoTransparent = true) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    if (imageCache.has(src)) {
      const cached = imageCache.get(src);
      if (cached && (cached.complete || cached.width > 0)) return resolve(cached);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const processed = autoTransparent ? makeImageTransparent(img) : img;
      imageCache.set(src, processed);
      resolve(processed);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function getCachedImage(src, onImageLoaded) {
  if (!src) return null;
  if (imageCache.has(src)) {
    const cached = imageCache.get(src);
    if (cached && (cached.complete || cached.width > 0)) return cached;
    if (onImageLoaded) {
      if (cached instanceof HTMLImageElement) {
        cached.addEventListener('load', () => onImageLoaded(cached), { once: true });
      }
    }
    return cached;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  img.onload = () => {
    const processed = makeImageTransparent(img);
    imageCache.set(src, processed);
    if (onImageLoaded) onImageLoaded(processed);
  };
  imageCache.set(src, img);
  return img;
}

export function createCeramicTextureCanvas({
  glazeColor = '#2A6B5C',
  glazeName = 'Men Xanh Đồng',
  pattern = 'none',
  patternImage = null,
  patternTransform = null,
  customText = '',
  textTransform = null,
  modelType = 'bowl',
  rimStyle = 'brown',
  width = 1024,
  height = 1024,
  onImageLoaded = null,
  latheProfile = null,
  paintCanvas = null,
}) {
  // Phase 3 perf: cache canvas for deterministic (non-async-image/non-painted) configurations
  const hasDynamicContent = !!patternImage || !!paintCanvas;
  if (!hasDynamicContent) {
    const key = cacheKey({ glazeColor, glazeName, pattern, patternTransform, customText, textTransform, modelType, rimStyle, width, height, latheProfile });
    if (textureCanvasCache.has(key)) return textureCanvasCache.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const hex = (glazeColor || '#2A6B5C').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) || 42;
  const g = parseInt(hex.slice(2, 4), 16) || 107;
  const b = parseInt(hex.slice(4, 6), 16) || 92;

  // 1. Nền men chuẩn xác 100% theo glazeColor
  ctx.fillStyle = glazeColor;
  ctx.fillRect(0, 0, width, height);

  const isYellow = (r > 175 && g > 130 && b < 100) || glazeName.includes('Vàng');
  const isRed = (r > 130 && g < 100 && b < 100) || glazeName.includes('Đỏ') || glazeName.includes('Bazan');
  const isBlue = glazeName.includes('Biển') || glazeName.includes('Lam') || glazeName.includes('Hỏa Biến') || glazeName.includes('Cobalt');
  const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 130;

  // 2. Hiệu ứng kết tinh hỏa biến tự nhiên — GIẢM NHẸ để tránh loang lổ
  if (isYellow) {
    for (let i = 0; i < 12; i++) { // Giảm từ 35 → 12
      const rx = Math.random() * width;
      const ry = 80 + Math.random() * (height - 160);
      const rad = 20 + Math.random() * 55;
      const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
      rg.addColorStop(0, 'rgba(255, 235, 140, 0.15)'); // Giảm opacity từ 0.40 → 0.15
      rg.addColorStop(0.6, 'rgba(240, 195, 80, 0.06)'); // Giảm từ 0.15 → 0.06
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
      if (rx < rad) {
        ctx.beginPath();
        ctx.arc(rx + width, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      } else if (rx > width - rad) {
        ctx.beginPath();
        ctx.arc(rx - width, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (isBlue) {
    for (let i = 0; i < 12; i++) { // Giảm từ 35 → 12
      const rx = Math.random() * width;
      const ry = 80 + Math.random() * (height - 160);
      const rad = 25 + Math.random() * 60;
      const rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
      rg.addColorStop(0, 'rgba(165, 215, 255, 0.12)'); // Giảm từ 0.35 → 0.12
      rg.addColorStop(0.6, 'rgba(75, 145, 215, 0.05)'); // Giảm từ 0.15 → 0.05
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
      if (rx < rad) {
        ctx.beginPath();
        ctx.arc(rx + width, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      } else if (rx > width - rad) {
        ctx.beginPath();
        ctx.arc(rx - width, ry, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Đốm vi tinh thể men nung củi — GIẢM NHẸ để tránh loang lổ trên model 3D
  const speckleColor = isYellow
    ? 'rgba(255, 250, 205, 0.35)'
    : (isRed ? 'rgba(255, 220, 200, 0.30)' : (isBlue ? 'rgba(225, 245, 255, 0.35)' : 'rgba(255, 255, 255, 0.30)'));

  for (let i = 0; i < 120; i++) { // Giảm từ 400 → 120
    const sx = Math.random() * width;
    const sy = 60 + Math.random() * (height - 120);
    const srad = 0.6 + Math.random() * 1.8;
    ctx.fillStyle = speckleColor;
    ctx.beginPath();
    ctx.arc(sx, sy, srad, 0, Math.PI * 2);
    ctx.fill();
    if (sx < srad) {
      ctx.beginPath();
      ctx.arc(sx + width, sy, srad, 0, Math.PI * 2);
      ctx.fill();
    } else if (sx > width - srad) {
      ctx.beginPath();
      ctx.arc(sx - width, sy, srad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. Viền miệng gốm (Rim Banding - Men da lươn / nâu hổ phách / caramel oxit sắt)
  // Đặc trưng kinh điển của bát gốm Bát Tràng (như tiêu bản pottery-bowl-002) & gốm Biên Hòa:
  // Viền men ôm trọn đỉnh môi, tràn nhẹ 2-3mm vào lòng trong và mép ngoài thân.
  if (rimStyle !== 'none') {
    const isGold = rimStyle === 'gold';
    const rimDeepColor = isGold ? '#8C6415' : '#6E320D'; // Lõi oxit sắt nung đọng
    const rimMidColor  = isGold ? '#BF8824' : '#9E541E'; // Sắc men da lươn đậm
    const rimEdgeColor = isGold ? 'rgba(212, 160, 48, 0.70)' : 'rgba(191, 128, 40, 0.75)'; // Tông caramel #BF8028 thực tế từ pottery-bowl-002

    let rTopY, rBottomY, rCrestY;
    if (modelType === 'vase' || modelType === 'vase-narrow-neck') {
      rTopY = height * 0.22;
      rBottomY = height * 0.44;
      rCrestY = height * 0.33;
    } else if (modelType === 'mug') {
      rTopY = height * 0.28;
      rBottomY = height * 0.54;
      rCrestY = height * 0.41;
    } else {
      // bowl, plate và mặc định:
      // Bao phủ trọn vẹn từ thành trong (Y ~ 310) qua đỉnh môi (Y ~ 440 - 490) xuống mép ngoài (Y ~ 560)
      rTopY = height * 0.30;
      rBottomY = height * 0.58;
      rCrestY = height * 0.44;
    }

    // A. Lớp phủ men viền chuyển màu mượt mà ôm sát vành môi
    const rimGrad = ctx.createLinearGradient(0, rTopY, 0, rBottomY);
    rimGrad.addColorStop(0, 'rgba(164, 94, 38, 0)');
    rimGrad.addColorStop(0.12, rimEdgeColor);
    rimGrad.addColorStop(0.35, isGold ? '#E0AC3C' : '#C08129'); // Caramel sáng tự nhiên
    rimGrad.addColorStop(0.50, isGold ? '#B88220' : '#A45E26'); // Lõi men đậm
    rimGrad.addColorStop(0.68, isGold ? '#E0AC3C' : '#C08129');
    rimGrad.addColorStop(0.88, rimEdgeColor);
    rimGrad.addColorStop(1, 'rgba(164, 94, 38, 0)');

    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, rTopY, width, rBottomY - rTopY);

    // B. Sống viền chính ngay đỉnh môi (Crest line đọng men oxit sắt đậm đà)
    ctx.strokeStyle = rimDeepColor;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, rCrestY);
    ctx.lineTo(width, rCrestY);
    ctx.stroke();

    // C. Vành chỉ phụ ôm mép ngoài thân (chống hụt tọa độ khi lathePoints thay đổi)
    ctx.strokeStyle = rimMidColor;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, rCrestY + 36);
    ctx.lineTo(width, rCrestY + 36);
    ctx.stroke();

    // D. Vành chỉ phụ ôm mép trong lòng bát
    ctx.strokeStyle = rimMidColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, rCrestY - 32);
    ctx.lineTo(width, rCrestY - 32);
    ctx.stroke();

    // E. Vành chỉ bổ trợ mở rộng cho các phôi quét từ ảnh chụp thực tế
    if (modelType === 'bowl' || modelType === 'plate') {
      ctx.strokeStyle = isGold ? '#D4A030' : '#B8771C';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.51);
      ctx.lineTo(width, height * 0.51);
      ctx.stroke();
    }
  }

  // 4b. Vân gân vuốt tay mộc mạc (Throwing Ridges) như trên bát gốm thủ công
  if (modelType === 'bowl') {
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 4;
    for (let ry = height * 0.60; ry <= height * 0.82; ry += 45) {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(width, ry);
      ctx.stroke();
    }
  }

  // 5. Tọa độ trung tâm bụng ngoài (Belly Outer Surface) có thể tùy chỉnh tự do:
  // U = 0.5 là mặt chính diện đối diện camera (Chính diện 0° khi rotateY(PI))
  const defaultCy = modelType === 'bowl'
    ? height * 0.68  // Bụng bát ngoài: v ~ 0.32 -> canvas Y ~ 696
    : (modelType === 'mug'
      ? height * 0.60
      : (modelType === 'plate' ? height * 0.28 : height * 0.52)); // vase

  const pScale = patternTransform?.scale !== undefined ? Number(patternTransform.scale) : 1.0;
  const pTilt = patternTransform?.rotation !== undefined ? (Number(patternTransform.rotation) * Math.PI) / 180 : 0;
  const pRotAngle = patternTransform?.rotationAngle !== undefined ? Number(patternTransform.rotationAngle) : 0;
  // Xoay 360 độ tương ứng xOffset trên texture hình trụ lặp RepeatWrapping:
  const pShiftX = (pRotAngle / 360) * width;
  const cx = ((width * 0.5 + pShiftX) % width + width) % width;
  const cy = patternTransform?.yPercent !== undefined
    ? height * (Number(patternTransform.yPercent) / 100)
    : defaultCy;

  // Bù trừ biến dạng hình trụ (cylindrical UV pinching):
  // Khi hoa văn/chữ đặt ở lòng cốc, đáy mộc hoặc cổ hẹp (bán kính r nhỏ),
  // chu vi 2*PI*r bị co lại dẫn tới họa tiết bị bóp hẹp bề ngang (kéo nhọn).
  // Hệ số aspectCompensation mở rộng bề ngang canvas để triệt tiêu độ co này trên mô hình 3D.
  const patternCircRatio = radiusAtHeight(cy, height, modelType, latheProfile);
  // FIX (bug 4 — hoa văn kéo dãn, seam trắng): Clamp aspectCompensation tối đa 2.0x.
  // Trước đây 1.0/0.18 = 5.5x → pattern bị kéo dài vượt 1024px canvas, khi cuộn
  // trụ 360° bị chèn lên nhau tạo seam trắng. Giới hạn 2.0x giữ hình ảnh nằm gọn.
  const aspectCompensation = Math.min(2.0, 1.0 / Math.max(0.18, patternCircRatio));

  // A. Nếu có ảnh họa tiết riêng lẻ (Decal Image Upload từ người dùng)
  const resolvedImg = patternImage;
  let imageDrawn = false;
  if (resolvedImg) {
    try {
      const img = typeof resolvedImg === 'string' ? getCachedImage(resolvedImg, onImageLoaded) : resolvedImg;
      if (img && (img.complete || img.width > 0)) {
        // FIX (bug 4): Giới hạn pattern chiếm ≤50% canvas (460px max trên 1024px).
        // Đảm bảo pattern chỉ hiển thị trên mặt TRƯỚC của gốm (front-facing),
        // không bị kéo dài thành seam trắng ở lưng/miệng khi cuộn 360°.
        const baseW = Math.min(width * 0.45, 460);
        const dw = baseW * pScale;
        const dh = dw * (img.height > 0 ? (img.height / img.width) : 0.66);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(aspectCompensation, 1.0);
        if (pTilt !== 0) ctx.rotate(pTilt);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        imageDrawn = true;
      } else if (img && onImageLoaded) {
        img.addEventListener('load', () => onImageLoaded(img), { once: true });
      }
    } catch (_) {}
  }

  // B. Họa tiết Cành Hoa Đào (Vẽ vector nếu chưa tải xong ảnh hoặc fallback)
  if (pattern === 'hoa_dao' && !imageDrawn) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(aspectCompensation, 1.0);
    if (pTilt !== 0) ctx.rotate(pTilt);
    ctx.scale(pScale * 1.3, pScale * 1.3);

    // 1. Nhành cây nâu uốn lượn tự nhiên
    ctx.strokeStyle = '#543621';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-160, 35);
    ctx.quadraticCurveTo(-80, -25, 0, -10);
    ctx.quadraticCurveTo(80, 5, 150, -40);
    ctx.stroke();

    // Nhánh phụ vươn lên
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-40, -18);
    ctx.quadraticCurveTo(-20, -65, 15, -80);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(60, -8);
    ctx.quadraticCurveTo(90, -35, 130, -25);
    ctx.stroke();

    // 2. Lá cây xanh olive thon nhọn
    const drawLeaf = (lx, ly, angle, lsize = 28) => {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(angle);
      ctx.fillStyle = '#6E7C41';
      ctx.beginPath();
      ctx.ellipse(0, 0, lsize, lsize * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4B5526';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    };

    drawLeaf(-110, -15, -0.4);
    drawLeaf(-60, -45, 0.3);
    drawLeaf(25, -60, -0.2);
    drawLeaf(45, 15, 0.7);
    drawLeaf(120, -50, -0.5);

    // 3. Hoa đào 5 cánh hồng phớt tao nhã
    const drawFlower = (fx, fy, fsize = 32) => {
      ctx.save();
      ctx.translate(fx, fy);
      for (let p = 0; p < 5; p++) {
        const ang = (p * Math.PI * 2) / 5;
        ctx.fillStyle = 'rgba(235, 155, 165, 0.92)';
        ctx.beginPath();
        const px = Math.cos(ang) * (fsize * 0.55);
        const py = Math.sin(ang) * (fsize * 0.55);
        ctx.arc(px, py, fsize * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }
      // Nhụy hoa đậm
      ctx.fillStyle = '#7C2D32';
      ctx.beginPath();
      ctx.arc(0, 0, fsize * 0.18, 0, Math.PI * 2);
      ctx.fill();
      for (let s = 0; s < 5; s++) {
        const sang = (s * Math.PI * 2) / 5 + 0.3;
        ctx.fillStyle = '#4A1D20';
        ctx.beginPath();
        ctx.arc(Math.cos(sang) * (fsize * 0.28), Math.sin(sang) * (fsize * 0.28), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    drawFlower(105, -20, 36);
    drawFlower(-90, 30, 30);
    drawFlower(-15, 10, 24);

    // Nụ đào nhỏ
    ctx.fillStyle = 'rgba(235, 150, 160, 0.95)';
    ctx.beginPath();
    ctx.arc(-145, 18, 8, 0, Math.PI * 2);
    ctx.arc(140, -35, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // C. Vẽ Hoa Sen Cổ
  if (pattern === 'sen_co') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(aspectCompensation, 1.0);
    if (pTilt !== 0) ctx.rotate(pTilt);
    ctx.scale(pScale * 1.35, pScale * 1.35);

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 45, 75, 0.92)';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(25, 45, 75, 0.18)';
    ctx.lineWidth = 4.5;

    const drawLotus = () => {
      ctx.beginPath();
      ctx.moveTo(0, -80);
      ctx.quadraticCurveTo(-35, 0, 0, 40);
      ctx.quadraticCurveTo(35, 0, 0, -80);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.quadraticCurveTo(-70, -20, -60, -60);
      ctx.quadraticCurveTo(-30, -10, 0, 30);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.quadraticCurveTo(70, -20, 60, -60);
      ctx.quadraticCurveTo(30, -10, 0, 30);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 55, 45, 0, Math.PI, false);
      ctx.stroke();
    };

    drawLotus();
    ctx.restore();
  } else if (pattern === 'dong_son') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(aspectCompensation, 1.0);
    if (pTilt !== 0) ctx.rotate(pTilt);
    ctx.scale(pScale * 1.35, pScale * 1.35);

    ctx.strokeStyle = isDark ? 'rgba(255, 215, 0, 0.95)' : 'rgba(184, 93, 56, 0.92)';
    ctx.lineWidth = 4.5;
    for (let rCircle = 35; rCircle <= 130; rCircle += 25) {
      ctx.beginPath();
      ctx.arc(0, 0, rCircle, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
      ctx.lineTo(Math.cos(a) * 130, Math.sin(a) * 130);
      ctx.stroke();
    }
    ctx.restore();
  } else if (pattern === 'ca_chep') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(aspectCompensation, 1.0);
    if (pTilt !== 0) ctx.rotate(pTilt);
    ctx.scale(pScale * 1.35, pScale * 1.35);

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(30, 60, 100, 0.90)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.ellipse(-50, -10, 40, 80, Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(50, 25, 40, 80, -Math.PI / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (pattern === 'cham_bi') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(aspectCompensation, 1.0);
    if (pTilt !== 0) ctx.rotate(pTilt);
    ctx.scale(pScale * 1.35, pScale * 1.35);

    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(42, 107, 92, 0.80)';
    for (let ox = -200; ox <= 200; ox += 60) {
      for (let oy = -90; oy <= 90; oy += 45) {
        ctx.beginPath();
        ctx.arc(ox, oy, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 6. Khắc chữ thủ công (Custom Text Inscription)
  if (customText && customText.trim()) {
    const plText = computePatternPlacement({
      glazeColor, glazeName, pattern, patternTransform, customText: customText.trim(), textTransform,
      modelType, width, height, latheProfile, patternImage,
    });
    // Vẽ chính diện tại textCx
    drawTextMotif(ctx, plText);
    // Vẽ bản sao bù seam mép canvas để khi cuộn trụ 3D không bị đứt chữ
    drawTextMotif(ctx, { ...plText, textCx: plText.textCx - width });
    drawTextMotif(ctx, { ...plText, textCx: plText.textCx + width });
  }

  // ── Seam Copy: draw pattern at cx ± width for seamless cylindrical wrapping ──
  if (patternImage || (pattern && pattern !== 'none')) {
    const plSeamP = computePatternPlacement({
      glazeColor, glazeName, pattern, patternTransform, customText: '', textTransform,
      modelType, width, height, latheProfile, patternImage,
    });
    plSeamP.cx = cx - width;
    drawPatternMotif(ctx, plSeamP, onImageLoaded);
    plSeamP.cx = cx + width;
    drawPatternMotif(ctx, plSeamP, onImageLoaded);
  }

  // Draw hand-painted brush layer on top of glaze & motifs
  if (paintCanvas) {
    ctx.drawImage(paintCanvas, 0, 0, width, height);
  }

  // Phase 3 perf: memoize deterministic canvas
  if (!hasDynamicContent) {
    const key = cacheKey({ glazeColor, glazeName, pattern, patternTransform, customText, textTransform, modelType, rimStyle, width, height, latheProfile });
    textureCanvasCache.set(key, canvas);
  }

  return canvas;
}

export function createCeramicTexture(options = {}) {
  const canvas = createCeramicTextureCanvas(options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ─────────────────────────────────────────────────────────────────────────────
// DECAL MODE (thay thế Cylindrical UV Wrapping): tách vẽ thành 2 phần
//   1) glaze base  = createCeramicTextureCanvas({ pattern:'none', customText:'' })  — thân men (đối xứng, không seam)
//   2) decals      = createDecalCanvases(...)  — họa tiết/logo/text trong suốt, dán lên bề mặt bằng DecalGeometry
// Hai phần dùng chung computePatternPlacement để cx/cy/scale/tilt khớp hệt với texture cũ.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tính toán TẤT CẢ tọa độ/mời đặt họa tiết & chữ trên canvas (cx, cy, scale, tilt,
 * circScale, textCx, textCy, ...) — cùng logic với createCeramicTextureCanvas để
 * decal 3D rơi đúng vào vị trí cũ. Chỉ thay đổi: trả về object `pl` thay vì dùng biến cục bộ.
 */
export function computePatternPlacement(opts) {
  const {
    glazeColor, glazeName, pattern, patternTransform, customText, textTransform,
    modelType, width, height, latheProfile, patternImage,
  } = opts;
  const hex = (glazeColor || '#2A6B5C').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) || 42;
  const g = parseInt(hex.slice(2, 4), 16) || 107;
  const b = parseInt(hex.slice(4, 6), 16) || 92;
  const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 130;
  const isYellow = (r > 175 && g > 130 && b < 100) || glazeName.includes('Vàng');
  const isBlue = glazeName.includes('Biển') || glazeName.includes('Lam') || glazeName.includes('Hỏa Biến') || glazeName.includes('Cobalt');

  const defaultCy = modelType === 'bowl'
    ? height * 0.68
    : (modelType === 'mug' ? height * 0.60 : (modelType === 'plate' ? height * 0.28 : height * 0.52));

  const pScale = patternTransform?.scale !== undefined ? Number(patternTransform.scale) : 1.0;
  const pTilt = patternTransform?.rotation !== undefined ? (Number(patternTransform.rotation) * Math.PI) / 180 : 0;
  const pRotAngle = patternTransform?.rotationAngle !== undefined ? Number(patternTransform.rotationAngle) : 0;
  const pShiftX = (pRotAngle / 360) * width;
  const cx = ((width * 0.5 + pShiftX) % width + width) % width;
  const cy = patternTransform?.yPercent !== undefined
    ? height * (Number(patternTransform.yPercent) / 100)
    : defaultCy;

  const patternCircRatio = radiusAtHeight(cy, height, modelType, latheProfile);
  // FIX (bug 4 — hoa văn kéo dãn, seam trắng): Clamp aspectCompensation tối đa 2.0x.
  // Trước đây 1.0/0.18 = 5.5x → pattern bị kéo dài vượt 1024px canvas, khi cuộn
  // trụ 360° bị chèn lên nhau tạo seam trắng. Giới hạn 2.0x giữ hình ảnh nằm gọn.
  const aspectCompensation = Math.min(2.0, 1.0 / Math.max(0.18, patternCircRatio));
  // circScale: multiplier cho footprint kích thước tổng thể (không phải aspect ratio).
  // aspectCompensation (trục X) được áp dụng riêng trong createDecalCanvases để footprintW ≠ footprintH.
  const circScale = 1.0;

  const tRotAngle = textTransform?.rotationAngle !== undefined ? Number(textTransform.rotationAngle) : 0;
  const tShiftX = (tRotAngle / 360) * width;
  const tPlacement = textTransform?.placement || 'belly';
  const textCx = ((width * 0.5 + tShiftX) % width + width) % width;
  const defaultTextCy = tPlacement === 'bottom' ? height * 0.92 : (cy + 160);
  const textCy = textTransform?.yPercent !== undefined
    ? height * (Number(textTransform.yPercent) / 100)
    : defaultTextCy;
  const rNorm = radiusAtHeight(textCy, height, modelType, latheProfile);
  const textAspectCompensation = 1.0 / Math.max(0.20, rNorm);
  const circumferenceRatio = Math.max(0.55, Math.min(1.0, rNorm));
  const maxLineWidth = Math.round(width * 0.46 * circumferenceRatio);
  const userFont = textTransform?.fontSize !== undefined ? Number(textTransform.fontSize) : 48;
  let norm = null;
  if (customText && customText.trim()) {
    norm = normalizeTextForPottery(`“${customText.trim()}”`, {
      maxWidth: maxLineWidth, maxLines: 6,
      baseFontSize: Math.min(64, Math.max(28, userFont)),
    });
  }
  const fontSize = norm && norm.lines.length > 0
    ? norm.fontSize
    : (textTransform?.fontSize !== undefined ? userFont : 44);
  const lineHeight = norm ? norm.lineHeight : fontSize * 1.2;

  return {
    customText, textTransform,
    glazeColor, glazeName, pattern, patternImage, modelType, width, height, latheProfile,
    isDark, isYellow, isBlue, r, g, b,
    defaultCy, pScale, pTilt, pRotAngle, pShiftX, cx, cy,
    patternCircRatio, circScale, aspectCompensation,
    tRotAngle, tShiftX, tPlacement, textCx, defaultTextCy, textCy,
    rNorm, circumferenceRatio, maxLineWidth, userFont, norm, fontSize, lineHeight, textAspectCompensation,
  };
}

/** Vẽ họa tiết (ảnh decal hoặc vector) lên một ctx — tái sử dụng công thức cũ. */
export function drawPatternMotif(ctx, pl, onImageLoaded) {
  const { pattern, isDark, cx, cy, pTilt, pScale, width, patternImage, aspectCompensation = 1.0 } = pl;
  let imageDrawn = false;
  const resolvedImg = patternImage;
  if (resolvedImg) {
    try {
      const img = typeof resolvedImg === 'string' ? getCachedImage(resolvedImg, onImageLoaded) : resolvedImg;
      if (img && (img.complete || img.width > 0)) {
        // FIX (bug 4): Giới hạn pattern chiếm ≤50% canvas (460px max trên 1024px).
        // Đảm bảo pattern chỉ hiển thị trên mặt TRƯỚC của gốm (front-facing),
        // không bị kéo dài thành seam trắng ở lưng/miệng khi cuộn 360°.
        const baseW = Math.min(width * 0.45, 460);
        const dw = baseW * pScale;
        const dh = dw * (img.height > 0 ? (img.height / img.width) : 0.66);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(aspectCompensation, 1.0);
        if (pTilt !== 0) ctx.rotate(pTilt);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        imageDrawn = true;
      } else if (img && onImageLoaded) {
        img.addEventListener('load', () => onImageLoaded(img), { once: true });
      }
    } catch (_) {}
  }
  if (!imageDrawn) {
    if (pattern === 'hoa_dao') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(aspectCompensation, 1.0);
      if (pTilt !== 0) ctx.rotate(pTilt);
      ctx.scale(pScale * 1.3, pScale * 1.3);
      ctx.strokeStyle = '#543621';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-160, 35);
      ctx.quadraticCurveTo(-80, -25, 0, -10);
      ctx.quadraticCurveTo(80, 5, 150, -40);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-40, -18);
      ctx.quadraticCurveTo(-20, -65, 15, -80);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(60, -8);
      ctx.quadraticCurveTo(90, -35, 130, -25);
      ctx.stroke();
      const drawLeaf = (lx, ly, angle, lsize = 28) => {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(angle);
        ctx.fillStyle = '#6E7C41';
        ctx.beginPath();
        ctx.ellipse(0, 0, lsize, lsize * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4B5526';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      };
      drawLeaf(-110, -15, -0.4);
      drawLeaf(-60, -45, 0.3);
      drawLeaf(25, -60, -0.2);
      drawLeaf(45, 15, 0.7);
      drawLeaf(120, -50, -0.5);
      const drawFlower = (fx, fy, fsize = 32) => {
        ctx.save();
        ctx.translate(fx, fy);
        for (let p = 0; p < 5; p++) {
          const ang = (p * Math.PI * 2) / 5;
          ctx.fillStyle = 'rgba(235, 155, 165, 0.92)';
          ctx.beginPath();
          const px = Math.cos(ang) * (fsize * 0.55);
          const py = Math.sin(ang) * (fsize * 0.55);
          ctx.arc(px, py, fsize * 0.48, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#7C2D32';
        ctx.beginPath();
        ctx.arc(0, 0, fsize * 0.18, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < 5; s++) {
          const sang = (s * Math.PI * 2) / 5 + 0.3;
          ctx.fillStyle = '#4A1D20';
          ctx.beginPath();
          ctx.arc(Math.cos(sang) * (fsize * 0.28), Math.sin(sang) * (fsize * 0.28), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };
      drawFlower(105, -20, 36);
      drawFlower(-90, 30, 30);
      drawFlower(-15, 10, 24);
      ctx.fillStyle = 'rgba(235, 150, 160, 0.95)';
      ctx.beginPath();
      ctx.arc(-145, 18, 8, 0, Math.PI * 2);
      ctx.arc(140, -35, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (pattern === 'sen_co') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(aspectCompensation, 1.0);
      if (pTilt !== 0) ctx.rotate(pTilt);
      ctx.scale(pScale * 1.35, pScale * 1.35);
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(25, 45, 75, 0.92)';
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(25, 45, 75, 0.18)';
      ctx.lineWidth = 4.5;
      const drawLotus = () => {
        ctx.beginPath();
        ctx.moveTo(0, -80);
        ctx.quadraticCurveTo(-35, 0, 0, 40);
        ctx.quadraticCurveTo(35, 0, 0, -80);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.quadraticCurveTo(-70, -20, -60, -60);
        ctx.quadraticCurveTo(-30, -10, 0, 30);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.quadraticCurveTo(70, -20, 60, -60);
        ctx.quadraticCurveTo(30, -10, 0, 30);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 55, 45, 0, Math.PI, false);
        ctx.stroke();
      };
      drawLotus();
      ctx.restore();
    } else if (pattern === 'dong_son') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(aspectCompensation, 1.0);
      if (pTilt !== 0) ctx.rotate(pTilt);
      ctx.scale(pScale * 1.35, pScale * 1.35);
      ctx.strokeStyle = isDark ? 'rgba(255, 215, 0, 0.95)' : 'rgba(184, 93, 56, 0.92)';
      ctx.lineWidth = 4.5;
      for (let rCircle = 35; rCircle <= 130; rCircle += 25) {
        ctx.beginPath();
        ctx.arc(0, 0, rCircle, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a) * 130, Math.sin(a) * 130);
        ctx.stroke();
      }
      ctx.restore();
    } else if (pattern === 'ca_chep') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(aspectCompensation, 1.0);
      if (pTilt !== 0) ctx.rotate(pTilt);
      ctx.scale(pScale * 1.35, pScale * 1.35);
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(30, 60, 100, 0.90)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(-50, -10, 40, 80, Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(50, 25, 40, 80, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (pattern === 'cham_bi') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(aspectCompensation, 1.0);
      if (pTilt !== 0) ctx.rotate(pTilt);
      ctx.scale(pScale * 1.35, pScale * 1.35);
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(42, 107, 92, 0.80)';
      for (let ox = -200; ox <= 200; ox += 60) {
        for (let oy = -90; oy <= 90; oy += 45) {
          ctx.beginPath();
          ctx.arc(ox, oy, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}

/** Vẽ chữ ký thủ công (custom text) lên một ctx — tái sử dụng công thức cũ. */
export function drawTextMotif(ctx, pl) {
  const { customText, textTransform, modelType, cx, height, width, latheProfile,
    isDark, textCx, textCy, rNorm, fontSize, norm, lineHeight, textAspectCompensation = 1.0 } = pl;
  if (!customText || !customText.trim()) return;
  const tPlacement = textTransform?.placement || 'belly';
  const userFont = textTransform?.fontSize !== undefined ? Number(textTransform.fontSize) : 48;

  ctx.save();
  ctx.translate(textCx, textCy);
  ctx.scale(textAspectCompensation, 1.0);
  ctx.font = `italic 700 ${fontSize}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillStyle = isDark ? '#FFFFFF' : '#121212';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;
  const totalBlockH = (norm ? norm.lines.length : 0) * lineHeight;
  const startY = -totalBlockH / 2 + lineHeight / 2;
  if (norm && norm.lines.length > 0) {
    norm.lines.forEach((ln, i) => { ctx.fillText(ln, 0, startY + i * lineHeight); });
    if (norm.textWidth > 0) {
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(18, 18, 18, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-norm.textWidth / 2 - 20, startY - lineHeight * 0.6, norm.textWidth + 40, totalBlockH + lineHeight * 0.4);
    }
  }
  ctx.restore();
}

/**
 * Tạo danh sách decal canvas (nền trong suốt) chứa duy nhất họa tiết + chữ.
 * Mỗi phần tử: { canvas, kind, cx, cy, scale, tilt, footprintW, footprintH }.
 * Dùng kèm DecalGeometry thay vì cylindrical UV wrapping.
 */
export function createDecalCanvases(opts) {
  const pl = computePatternPlacement(opts);
  const W = pl.width, H = pl.height;
  const decals = [];
  const baseW = Math.min(W * 0.45, 460); // FIX (bug 4): ≤50% canvas — pattern chỉ chiếm mặt trước

  // (A) ảnh họa tiết người dùng tải lên
  if (pl.patternImage) {
    try {
      const img = typeof pl.patternImage === 'string' ? getCachedImage(pl.patternImage, opts.onImageLoaded) : pl.patternImage;
      if (img && (img.complete || img.width > 0)) {
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        const dw = baseW * pl.pScale;
        const dh = dw * (img.height > 0 ? (img.height / img.width) : 0.66);
        const ac = pl.aspectCompensation || 1.0;
        // FIX (bug 4 — Aspect Ratio Lock): Vẽ ảnh tại tỉ lệ nguyên bản (không scale),
        // footprintW = dw * ac chỉ biểu thị kích thước decal trên bề mặt 3D.
        // DecalGeometry dùng planar projection → AR của ảnh được bảo toàn hoàn toàn.
        ctx.save();
        ctx.translate(pl.cx, pl.cy);
        // FIX: Scale TRƯỚC, rotate SAU — tránh shear distortion khi pTilt != 0
        // (rotate trước scale sẽ kéo giãn ảnh theo hướng xiên)
        ctx.scale(ac, 1.0);
        if (pl.pTilt !== 0) ctx.rotate(pl.pTilt);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
        decals.push({ canvas, kind: 'patternImage', cx: pl.cx, cy: pl.cy, scale: pl.pScale, tilt: pl.pTilt, footprintW: dw * ac, footprintH: dh, rotationAngle: pl.pRotAngle });
      } else if (img && opts.onImageLoaded) {
        img.addEventListener('load', () => opts.onImageLoaded(img), { once: true });
      }
    } catch (_) {}
  } else if (pl.pattern && pl.pattern !== 'none' && pl.pattern !== undefined) {
    // (B) họa tiết vector (fallback khi không có ảnh)
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    drawPatternMotif(ctx, pl, opts.onImageLoaded);
    const sf = pl.pScale * (pl.pattern === 'hoa_dao' ? 1.3 : 1.35) * pl.circScale;
    const footprint = 330 * sf; // khung ngần nào ±160 sau scale
    const ac = pl.aspectCompensation || 1.0;
    // FIX: footprintW phải bao gồm aspectCompensation (canvas X bị kéo dài bởi ctx.scale(ac, 1.0)
    // trong drawPatternMotif), nhưng footprintH giữ nguyên vì scale Y = 1.0 → tránh decal bị kéo dài/méo
    decals.push({ canvas, kind: 'patternVector', pattern: pl.pattern, cx: pl.cx, cy: pl.cy, scale: pl.pScale, tilt: pl.pTilt, footprintW: footprint * ac, footprintH: footprint, rotationAngle: pl.pRotAngle });
  }

  // (C) chữ ký thủ công
  if (pl.customText && pl.customText.trim()) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    drawTextMotif(ctx, pl);
    const tw = pl.norm ? pl.norm.textWidth : 0;
    const th = ((pl.norm ? pl.norm.lines.length : 1) * pl.lineHeight);
    decals.push({ canvas, kind: 'text', cx: pl.textCx, cy: pl.textCy, scale: 1, tilt: 0, footprintW: (tw || 200) + 40, footprintH: th || pl.fontSize, rotationAngle: 0 });
  }
  return decals;
}

/**
 * Map một decal (trên canvas 2D, tọa độ cx,cy, footprint) sang vị trí/orientation/size trong
 * không gian local của LatheGeometry (ĐÃ áp dụng rotateY(PI) như createCeramicGeometry).
 *
 * Thuyết toán (self-consistent với cylindrical UV cũ):
 *   - v = 1 - cy/H                (0=base/chân, 1=miệng)  → lerp theo profile dọc Y
 *   - u = cx/W                    (0..1 quanh trục Y)       → góc quay φ = 2πu
 *   - rotateY(PI) áp dụng cho LatheGeometry → dịch chuyển thành (x,y,z)->(-x,y,-z)
 * => position_local = (-r·cosφ, yModel, -r·sinφ), normal_local = (-cosφ, 0, -sinφ)
 *
 * @param {'bowl'|'mug'|'plate'|'vase'|'vase-narrow-neck'} modelType
 * @param {Array<{x,y}>|{y,r}[]} customLathePoints - lathePoints thực (x=r, y=cao) hoặc profile mặc định {y,r}
 * @param {number} cx,cy - vị trí decal trên canvas (px)
 * @param {number} texW,texH - kích thước canvas texture
 * @param {number} footprintW,footprintH - kích thước motif trên canvas (px) → quy đổi ra world
 * @returns {{position:[x,y,z], normal:[x,y,z], up:[0,1,0], size:[w,h,d], y:number, r:number}}
 */
export function computeDecalPlacement(modelType, customLathePoints, cx, cy, texW, texH, footprintW, footprintH) {
  let profile = (customLathePoints && Array.isArray(customLathePoints) && customLathePoints.length >= 4)
    ? customLathePoints
    : getDefaultModelProfile(modelType);

  // Chuẩn hoá tỷ lệ đồng bộ 1:1 với createCeramicGeometry trong orthographicRenderer.js
  if (customLathePoints && Array.isArray(customLathePoints) && customLathePoints.length >= 4) {
    let minY = Infinity, maxY = -Infinity, maxX = 0;
    for (const p of customLathePoints) {
      const py = p.y !== undefined ? p.y : 0;
      const px = p.r !== undefined ? p.r : (p.x !== undefined ? p.x : 0);
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      if (px > maxX) maxX = px;
    }
    const currentYSpan = Math.max(0.1, maxY - minY);
    const currentMaxX = Math.max(0.1, maxX);

    let targetYSpan = 2.45;
    let targetMaxR = 1.15;
    let targetMinY = -1.15;

    if (modelType === 'bowl') {
      targetYSpan = 1.20;
      targetMaxR = 1.40;
      targetMinY = -0.65;
    } else if (modelType === 'plate') {
      targetYSpan = 0.48;
      targetMaxR = 1.55;
      targetMinY = -0.22;
    } else if (modelType === 'mug') {
      targetYSpan = 1.50;
      targetMaxR = 1.05;
      targetMinY = -0.75;
    }

    // FIX (object height bug): sync with createCeramicGeometry — if lathePoints are already
    // normalized to the target Y space (from AI server), skip re-normalizing Y to prevent
    // double-normalization height distortion. Only adjust radius.
    const ySpanRatio = currentYSpan / targetYSpan;
    const alreadyNormalized = ySpanRatio > 0.85 && ySpanRatio < 1.15;

    if (alreadyNormalized) {
      const rScale = targetMaxR / currentMaxX;
      profile = customLathePoints.map((p) => {
        const py = p.y !== undefined ? p.y : 0;
        const px = p.r !== undefined ? p.r : (p.x !== undefined ? p.x : 0);
        return { y: py, r: px * rScale };
      });
    } else {
      const yScale = targetYSpan / currentYSpan;
      const rScale = targetMaxR / currentMaxX;
      profile = customLathePoints.map((p) => {
        const py = p.y !== undefined ? p.y : 0;
        const px = p.r !== undefined ? p.r : (p.x !== undefined ? p.x : 0);
        return {
          y: targetMinY + (py - minY) * yScale,
          r: px * rScale,
        };
      });
    }
  }

  // chuẩn hoá thành {y, r} (lathePoints dùng {x:r,y} ; profile dùng {y,r})
  const pts = profile.map((p) => ({ y: p.y !== undefined ? p.y : 0, r: p.r !== undefined ? p.r : (p.x !== undefined ? p.x : 0) }));

  // FIX (object height bug): Y-value-based interpolation thay vì index-based.
  // Profile từ server có thể có điểm thành trong (non-monotonic Y) → index-based
  // gây lệch vị trí Y & bán kính trên mô hình 3D. Ánh xạ v → Y target dựa trên
  // profile Y range, tìm bracketing points theo Y để nội suy chính xác.
  const v = Math.max(0, Math.min(1, 1 - cy / texH)); // 0=base, 1=mouth
  const minYPt = Math.min(...pts.map((p) => p.y));
  const maxYPt = Math.max(...pts.map((p) => p.y));
  const yRange = Math.max(0.001, maxYPt - minYPt);
  const yTarget = minYPt + v * yRange;

  const sorted = [...pts].sort((a, b) => a.y - b.y);
  let yModel = sorted[0].y, r = sorted[0].r;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].y <= yTarget && sorted[i + 1].y >= yTarget) {
      const span = Math.max(0.001, sorted[i + 1].y - sorted[i].y);
      const frac = (yTarget - sorted[i].y) / span;
      yModel = sorted[i].y + frac * (sorted[i + 1].y - sorted[i].y);
      r = sorted[i].r + frac * (sorted[i + 1].r - sorted[i].r);
      break;
    }
  }

  const u = cx / texW;
  const phi = ((u % 1) + 1) % 1 * Math.PI * 2;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);

  // rotateY(PI): (x,y,z) -> (-x, y, -z)
  const position = [-r * cos, yModel, -r * sin];
  const normal = [-cos, 0, -sin];

  // world size từ footprint canvas px → arc length + height fraction
  // Aspect Ratio Locking: worldH được tính từ worldW / AR để bảo toàn tỷ lệ gốc
  // của họa tiết (tránh kéo dài/méo lên bề mặt 3D). Hình vuông luôn là hình vuông.
  // FIX: Clamp arcW để tránh wrap-around khi footprintW * aspectCompensation > texW.
  // Nếu arcW > 2π, Math.sin(arcW/2) bị wrap → worldW = 0 hoặc sai hoàn toàn → decal vỡ.
  // Giới hạn ở 1.8π (~324°) để decal không bao phủ quá nửa chu vi và tránh singularity.
  const rawArcW = (footprintW / texW) * Math.PI * 2;
  const arcW = Math.min(1.8 * Math.PI, Math.max(0.01, rawArcW));
  const worldW = Math.max(0.02, 2 * r * Math.sin(arcW / 2));
  const AR = footprintW / Math.max(1, footprintH); // tỷ lệ gốc của motif
  const worldH = worldW / AR; // worldH chặt chẽ = worldW / AR, không độc lập
  const depth = 0.02;

  return { position, normal, up: [0, 1, 0], size: [worldW, worldH, depth], y: yModel, r };
}

/**
 * Đường cong bán kính (x=r, y=cao) chuẩn cho từng dáng gốm — SAO CHÉP nguyên văn
 * các mảng điểm hardcode trong createCeramicGeometry (orthographicRenderer.js).
 * Dùng để: (a) build LatheGeometry qua createCeramicGeometry(modelType, profile),
 * (b) tính decal placement — đảm bảo BODY và DECAL dùng cùng 1 profile → vị trí decal
 * rơi đúng trên bề mặt thành khởi tạo.
 */
export function getDefaultModelProfile(modelType = 'bowl') {
  const curves = {
    bowl: [{x:0,y:-0.65},{x:0.48,y:-0.65},{x:0.50,y:-0.52},{x:0.68,y:-0.40},{x:0.92,y:-0.22},{x:1.18,y:0.00},{x:1.38,y:0.25},{x:1.48,y:0.50},{x:1.46,y:0.54},{x:1.38,y:0.55},{x:1.26,y:0.50},{x:1.08,y:0.25},{x:0.88,y:0.00},{x:0.62,y:-0.22},{x:0.42,y:-0.40},{x:0.30,y:-0.52},{x:0,y:-0.55}],
    mug: [{x:0,y:-0.75},{x:0.55,y:-0.75},{x:0.70,y:-0.68},{x:0.85,y:-0.55},{x:0.98,y:-0.35},{x:1.04,y:-0.10},{x:1.04,y:0.10},{x:0.99,y:0.30},{x:0.94,y:0.50},{x:0.98,y:0.65},{x:1.02,y:0.72},{x:0.97,y:0.74},{x:0.90,y:0.70},{x:0.85,y:0.50},{x:0.88,y:0.15},{x:0.85,y:-0.20},{x:0.68,y:-0.50},{x:0.40,y:-0.62},{x:0,y:-0.64}],
    plate: [{x:0,y:-0.22},{x:0.82,y:-0.22},{x:1.26,y:-0.07},{x:1.76,y:0.12},{x:1.72,y:0.26},{x:1.22,y:0.00},{x:0.76,y:-0.18},{x:0,y:-0.20}],
    vase: [{x:0,y:-1.15},{x:0.70,y:-1.15},{x:0.75,y:-0.90},{x:1.15,y:-0.30},{x:1.18,y:0.10},{x:0.55,y:0.70},{x:0.48,y:1.10},{x:0.75,y:1.30},{x:0.68,y:1.30},{x:0.40,y:1.05},{x:0.45,y:0.50},{x:0.10,y:0.00},{x:0,y:0.00}],
    'vase-narrow-neck': [{x:0,y:-1.20},{x:0.55,y:-1.20},{x:0.65,y:-1.00},{x:1.05,y:-0.40},{x:1.15,y:0.00},{x:0.95,y:0.45},{x:0.55,y:0.80},{x:0.28,y:1.00},{x:0.26,y:1.30},{x:0.42,y:1.40},{x:0.35,y:1.40},{x:0.20,y:1.30},{x:0.18,y:0.80},{x:0,y:0.00}],
  };
  return curves[modelType] || curves.bowl;
}


