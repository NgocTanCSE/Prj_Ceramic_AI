/**
 * renderFidelity.js — Đánh giá "3D có khác ảnh 2D gốc không" bằng render WebGL thật.
 *
 * Cơ chế:
 *  - Render mô hình 3D (scene đã có sẵn trong CeramicCanvas3D, cùng Material/Men/Decal) từ
 *    góc nhìn trước (orthographic front) sang một WebGLRenderTarget → lấy pixel RGBA.
 *  - Lấy mask silhouette ảnh gốc (dùng extractSilhouetteMaskFromCanvas của meshInflator —
 *    tự động dò màu nền 4 góc) + pixel RGBA ảnh gốc.
 *  - Tính: silhouetteIoU (robust, bất kể ánh sáng) + rgbMse (bắt lệch màu/sắc nét).
 *  - score = 0.65*IoU + 0.35*(1 - MSE/1180). 0..1.
 *
 * Toàn bộ phần thuần tính (silhouetteIoU, rgbMse) chạy được trên Node để test.
 * phần WebGL được bọc try/catch → nếu context/render thất bại trả về score=null
 * (ứng dụng không bao giờ crash). Chỉ chạy ở trình duyệt (có WebGL + DOM).
 */
import * as THREE from 'three';
import { extractSilhouetteMaskFromCanvas } from './meshInflator.js';

/** IoU giữa 2 mask nhị phân Uint8Array(0/1) kích thước w*h. */
export function silhouetteIoU(maskA, maskB, w, h) {
  if (!maskA || !maskB || maskA.length !== w * h || maskB.length !== w * h) return 0;
  let inter = 0;
  let union = 0;
  for (let i = 0; i < w * h; i++) {
    const a = maskA[i] > 0;
    const b = maskB[i] > 0;
    if (a && b) inter++;
    if (a || b) union++;
  }
  return union === 0 ? 0 : inter / union;
}

/** Mean-squared-error giữa 2 mảng RGBA Uint8 (length = px*4). Trả về 0..~118000. */
export function rgbMse(dataA, dataB, px) {
  if (!dataA || !dataB || dataA.length < px * 4 || dataB.length < px * 4) return Infinity;
  let s = 0;
  for (let i = 0; i < px * 4; i += 4) {
    const dr = dataA[i] - dataB[i];
    const dg = dataA[i + 1] - dataB[i + 1];
    const db = dataA[i + 2] - dataB[i + 2];
    s += dr * dr + dg * dg + db * db;
  }
  return s / px;
}

const MAX_MSE = 118000; // MSE tối đa ~ (255^2*3) khi khác nhau hoàn toàn

/**
 * Render mô hình 3D từ view trước sang RGBA Uint8Array (size*size*4).
 * Dùng renderTarget để không làm nhỡ canvas đang render trên UI.
 */
function renderSceneFrontToRGBA(renderer, scene, size) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
  });
  const cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 20);
  cam.position.set(0, 0.25, 3);
  cam.lookAt(0, 0.05, 0);
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  renderer.autoClear = prevAutoClear;

  const px = new Uint8Array(size * size * 4);
  // readRenderTargetPixels: nhiều bản three dùng (rt, x,y,w,h, format, type, arr)
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, THREE.RGBAFormat, THREE.UnsignedByteType, px);
  rt.dispose();
  return px;
}

/**
 * Tính fidelityScore giữa render 3D và ảnh gốc.
 * @param {object} opts
 * @param {THREE.Scene} opts.threeScene   — scene chứa mesh gốm
 * @param {THREE.WebGLRenderer} opts.threeRenderer
 * @param {THREE.Camera} opts.threeCamera — (dùng để fallback; front snapshot tự tạo ortho)
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap|string} opts.sourceImage
 * @param {number} [opts.size=224]
 * @returns {Promise<{score:number|null, silhouetteIoU:number, rgbMse:number, note:string}>}
 */
export async function renderFidelityScore({ threeScene, threeRenderer, threeCamera, sourceImage, size = 224 }) {
  if (!threeScene || !threeRenderer || !sourceImage || !threeCamera) {
    return { score: null, silhouetteIoU: 0, rgbMse: Infinity, note: 'Thiếu scene/renderer/ảnh nguồn' };
  }
  try {
    // 1) render 3D front → RGBA + alpha silhouette
    const renderedRGBA = renderSceneFrontToRGBA(threeRenderer, threeScene, size);
    const silA = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
      silA[i] = renderedRGBA[i * 4 + 3] > 30 ? 1 : 0;
    }

    // 2) vẽ ảnh gốc lên canvas size×size → mask + RGBA
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    // nền trắng để extractSilhouetteMaskFromCanvas dò được bg góc
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, size, size);
    octx.drawImage(sourceImage, 0, 0, size, size);
    const photo = extractSilhouetteMaskFromCanvas(off);
    if (photo.isEmpty) {
      return { score: null, silhouetteIoU: 0, rgbMse: Infinity, note: 'Không phát hiện đối tượng trong ảnh nguồn' };
    }
    const photoImgData = octx.getImageData(0, 0, size, size).data;

    // 3) metrics
    const iou = silhouetteIoU(silA, photo.mask, size, size);
    const mse = rgbMse(renderedRGBA, photoImgData, size * size);
    const normMse = Math.max(0, 1 - Math.min(1, mse / MAX_MSE));
    const score = 0.65 * iou + 0.35 * normMse;

    let note = '';
    if (iou < 0.55) note = 'Mô hình 3D khác biệt lớn với ảnh (silhouette).';
    else if (iou < 0.8) note = '3D gần đúng nhưng có lệch.';
    else note = '3D trùng khớp ảnh tốt.';
    if (mse > 300) note += ' Lệch màu/sắc so với ảnh gốc.';

    return {
      score: Number(score.toFixed(3)),
      silhouetteIoU: Number(iou.toFixed(3)),
      rgbMse: Math.round(mse),
      note,
    };
  } catch (e) {
    return {
      score: null,
      silhouetteIoU: 0,
      rgbMse: Infinity,
      note: `WebGL fidelity lỗi: ${e && e.message ? e.message : String(e)}`,
    };
  }
}
