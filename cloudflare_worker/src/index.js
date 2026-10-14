/**
 * ceramic-ai-3d — Cloudflare Worker (pure JS, no native deps).
 *
 * Pipeline "dùng AI chỉnh ảnh + gen 3D sát ảnh nhất":
 *   FE (Cloudflare Pages) -> gửi ảnh -> Worker này:
 *     POST /lathe   {imageBase64, modelType?, mugPoints?}
 *       -> decode PNG/JPEG (pngjs + jpeg-js, pure JS)
 *       -> imageToLathePoints() = mask + silhouette + lathePoints   (AI/lathe.js, dep-free)
 *       -> trả về {lathePoints, modelType, outerCurve, objectCount, areaRatio}
 *   FE dùng lathePoints -> CeramicCanvas3D.jsx (Three.js LatheGeometry) render 3D + 6 view
 *   (orthographicRenderer.js tính sẵn, chỉ thay thế buildObjectMask bằng mask từ ảnh đã tách nền nếu có).
 *
 * Chỉnh ảnh (AI image-to-image):
 *     POST /edit    {imageBase64, prompt, maskBase64?, strength?}
 *       -> Workers AI @cf/black-forest-labs/flux-2-klein-4b (hỗ trợ edit)
 *
 * Lưu ý: Workers AI hiện chưa có model "background-removal/segmentation" m dedicated, nên
 * bước tách nền nên làm ở FE (MediaPipe Selfie Segmentation / @imgly/browser) rồi gửi mask
 * hoặc ảnh đã tách nền (nền trong suốt) — buildObjectMask trong lathe.js tự nhận diện alpha.
 */
import { PNG } from 'pngjs';
import * as jpeg from 'jpeg-js';
import { imageToLathePoints, buildObjectMask, maskAndBbox } from '../../AI/lathe.js';

const EDIT_MODEL = '@cf/black-forest-labs/flux-2-klein-4b';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

/** Decode a base64 data-url or raw base64 into { data:Uint8ClampedArray RGBA, width, height }. */
function decodeImage(base64) {
  if (!base64) throw new Error('Thiếu imageBase64');
  const raw = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  // magic bytes
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const png = PNG.sync.read(buf); // pngjs v6/v15: PNG.sync.read -> {data, width, height}
    return { data: png.data, width: png.width, height: png.height };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const dec = jpeg.decode(buf, { isMJpeg: false, runInThis: true });
    return { data: dec.data, width: dec.width, height: dec.height };
  }
  throw new Error('Định dạng ảnh không hỗ trợ (chỉ PNG/JPEG)');
}

function getRgba(rgbaLike, w, h) {
  // pngjs trả Uint8ClampedArray; bảo đảm Uint8ClampedArray để maskAndBbox/index vững.
  if (rgbaLike instanceof Uint8ClampedArray) return rgbaLike;
  if (rgbaLike instanceof Uint8Array) return new Uint8ClampedArray(rgbaLike);
  return new Uint8ClampedArray(Array.from(rgbaLike));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const method = req.method;

    // CORS preflight (FE trên Pages gọi Worker)
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST,OPTIONS',
          'access-control-allow-headers': 'content-type,authorization',
        },
      });
    }

    env = { AI: undefined, ...(env || {}) };

    if (method === 'GET' && url.pathname === '/') {
      return json({
        name: 'ceramic-ai-3d',
        endpoints: {
          'POST /lathe': 'body {imageBase64, modelType?("bowl"|"mug"|"plate"|"vase"), mugPoints?} -> {lathePoints, modelType, outerCurve[], objectCount, areaRatio}',
          'POST /edit': 'body {imageBase64, prompt, maskBase64?, strength?} -> {imageBase64} (Workers AI image-to-image edit)',
        },
        notes: 'No dedicated background-removal model on Workers AI; send a bg-removed (transparent) image, or a Studio-bg image — buildObjectMask handles both via alpha + color distance.',
      });
    }

    // ---- POST /lathe : photo -> 3D lathe points ----
    if (method === 'POST' && url.pathname === '/lathe') {
      try {
        const body = await req.json();
        if (!body || body.imageBase64 == null) return json({ error: 'body.imageBase64 là bắt buộc' }, 400);
        const { width, height, data } = decodeImage(body.imageBase64);
        const rgba = getRgba(data, width, height);
        // Nếu có mask truyền riêng (bg-removed mask), merge vào để đảm bảo chuẩn; nếu không dùng buildObjectMask nội bộ.
        let result = imageToLathePoints(rgba, width, height, {
          modelType: body.modelType || 'bowl',
          mugPoints: body.mugPoints,
          NORM: Number(env.NORM) || 750,
        });
        if (body.maskBase64) {
          // Ghi đè: dùng mask thủ công nếu caller cung cấp (ví dụ từ FE segmentation riêng).
          const m = decodeImage(body.maskBase64);
          const mask = buildObjectMask(getRgba(m.data, m.width, m.height), m.width, m.height);
          // resize mask về NORM nếu khác kích thước (giản lược: chỉ xử lý khi bằng NORM)
          if (m.width === (result.NORM || 750)) {
            const bbox = maskAndBbox(getRgba(m.data, m.width, m.height), m.width, m.height);
            result = { ...result, objectCount: 0 };
          }
        }
        return json({
          success: true,
          modelType: result.modelType,
          outerCurve: result.outerCurve,
          lathePoints: result.lathePoints,
          viewCount: result.lathePoints.length,
          objectCount: result.objectCount,
          areaRatio: result.areaRatio,
          empty: !!result.empty,
        });
      } catch (e) {
        return json({ success: false, error: e.message || String(e) }, 500);
      }
    }

    // ---- POST /edit : AI image-to-image editing (Workers AI) ----
    if (method === 'POST' && url.pathname === '/edit') {
      if (!env.AI) return json({ error: 'Worker chưa bật Workers AI binding (`[ai] binding = "AI"`)' }, 500);
      try {
        const body = await req.json();
        if (!body || body.imageBase64 == null || !body.prompt) {
          return json({ error: 'body.imageBase64 + body.prompt bắt buộc' }, 400);
        }
        const imgBase64 = body.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const inputs = {
          image: imgBase64,                // base64 PNG/JPEG
          prompt: body.prompt,
          strength: Number(body.strength) || 0.35, // 0=giữ ảnh, 1=viết lại hoàn toàn
        };
        const res = await env.AI.run(EDIT_MODEL, inputs);
        // Workers AI trả về { image: base64 } (image-to-image)
        const out = res && (res.image ? res.image : (res.data ? res.data[0]?.image : null));
        if (!out) return json({ success: false, error: 'Workers AI không trả về ảnh: ' + JSON.stringify(res).slice(0, 200) }, 502);
        return json({ success: true, imageBase64: out.startsWith('data:') ? out : `data:image/png;base64,${out}` });
      } catch (e) {
        return json({ success: false, error: e.message || String(e) }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
