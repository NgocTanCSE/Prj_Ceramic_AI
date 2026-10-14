/**
 * patternSketcher.js
 *
 * "Chụp lại & phác thảo lại" — thay vì dán ảnh gốc (chụp và dán) lên mặt gốm,
 * hàm này biến ảnh họa tiết (photo/đã cắt) thành **bản vẽ nét đường (line-art)**:
 * nền trong suống, nét vẽ đen đậm theo độ lớn gradient biên (Sobel).
 * Khi overlay lên men gốm, nét giữ đường viền & để lại chỗ trống trong suống
 * để màu men hiện ra — tạo hiệu ứng "phác thảo bút" thật. Trả về dataURL PNG.
 *
 * Chạy trong trình duyệt (Canvas 2D). Môi trường SSR/build thì trả về ảnh gốc.
 */
const SOBEL_MAX = 4 * Math.SQRT2; // ~5.657 — chuẩn hoá magnitude về [0,1]

export async function sketchPatternImage(imgDataUrl, opts = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !window.CanvasRenderingContext2D) {
    return imgDataUrl;
  }
  if (typeof imgDataUrl !== 'string' || !imgDataUrl.startsWith('data:image')) {
    return imgDataUrl;
  }
  const threshold = opts.threshold ?? 0.04; // dưới ngưỡng -> trong suống (nền)
  const strength = opts.strength ?? 1.0;                // độ đậm nét vẽ

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.crossOrigin = 'anonymous';
    i.src = imgDataUrl;
  });

  const w = img.width, h = img.height;
  if (w === 0 || h === 0) return imgDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imgDataUrl;
  ctx.drawImage(img, 0, 0, w, h);

  const id = ctx.getImageData(0, 0, w, h);
  const src = id.data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }

  // Kênh output: nền trong suống (alpha=0); chỉ nét vẽ đường viền.
  const out = new Uint8ClampedArray(w * h * 4); // zero-init -> alpha 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const n = gray[i - w], s = gray[i + w];
      const wL = gray[i - 1], e = gray[i + 1];
      const nw = gray[i - w - 1], ne = gray[i - w + 1];
      const sw = gray[i + w - 1], se = gray[i + w + 1];
      const gx = -nw - 2 * n - ne + sw + 2 * s + se;
      const gy = -nw - 2 * wL - sw + ne + 2 * e + se;
      const mag = Math.hypot(gx, gy) / SOBEL_MAX;
      if (mag > threshold) {
        const a = (mag * 255 * Math.min(1, strength)) | 0;
        const j = i * 4;
        out[j] = 0; out[j + 1] = 0; out[j + 2] = 0; out[j + 3] = a;
      }
    }
  }

  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
  return canvas.toDataURL('image/png');
}
