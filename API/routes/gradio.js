// API/routes/gradio.js — Gradio Spaces proxies cho pipeline Text→2D→3D.
// Hỗ trợ:
//   - Text-to-Image (2D): FLUX.1-schnell (hoặc FLUX mirror)
//   - Image-to-3D (.glb): TencentARC/InstantMesh (Mặc định, ổn định, sinh lưới watertight)
//     kèm Fallback tự động sang stabilityai/stable-fast-3d nếu cần.
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { callSpace, fetchBuffer, createMockClientFactory, handleFile } from '../lib/gradioClient.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.GLB_UPLOAD_DIR || path.resolve(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
router.use('/uploads', express.static(UPLOAD_DIR));

const FLUX_SPACE = process.env.HF_FLUX_SPACE || 'black-forest-labs/FLUX.1-schnell';
const FLUX_FN = process.env.HF_FLUX_FN || '/infer';

// 3D Space chính & fallback
const PRIMARY_3D_SPACE = process.env.HF_3D_SPACE || 'TencentARC/InstantMesh';
const SF3D_SPACE = process.env.HF_SF3D_SPACE || 'stabilityai/stable-fast-3d';
const SF3D_FN = process.env.HF_SF3D_FN || '/run_button';

const HF_TOKEN = process.env.HF_TOKEN || '';
const API_ORIGIN = process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 8000}`;
const LOCAL_BASE = `${API_ORIGIN}/api/ai/gradio`;
const MOCK = process.env.GRADIO_MOCK === '1';
const hash = (s) => crypto.createHash('sha1').update(String(s) + Date.now()).digest('hex').slice(0, 12);
const imgUrlOf = (d) => (Array.isArray(d) ? (d[0] && (d[0].url || d[0].path || d[0])) : (d && (d.url || d.path || d)));
const glbOf = (d) => (Array.isArray(d) ? d[1] : (d && d.glbUrl) || d);

// Mock factory (dùng trong unit-test / GRADIO_MOCK)
function mockFactory(spaceId) {
  return createMockClientFactory({
    [FLUX_FN]: () => [{ url: `https://mock.hf.space/flux_${hash(spaceId)}.png`, path: '', size: 10, orig_name: 'flux.png', mime_type: 'image/png', is_stream: false, meta: {} }, 0],
    [SF3D_FN]: () => [`https://mock.hf.space/bg_${hash(spaceId)}.png`, `https://mock.hf.space/glb_${hash(spaceId)}.glb`],
    '/preprocess': () => [{ url: `https://mock.hf.space/pre_${hash(spaceId)}.png` }],
    '/generate_mvs': () => [{ url: `https://mock.hf.space/mvs_${hash(spaceId)}.png` }],
    '/make3d': () => [null, { url: `https://mock.hf.space/glb_${hash(spaceId)}.glb` }],
  });
}

function clientOpts() {
  return { hfToken: MOCK ? undefined : HF_TOKEN, clientFactory: MOCK ? mockFactory() : undefined };
}

// Tham số FLUX
function fluxArgs(b) {
  return [b.prompt, Number(b.seed) || 0, true, Number(b.width) || 1024, Number(b.height) || 1024, Number(b.steps) || 4];
}

// Tham số SF3D
function sf3dArgs(imageInput, b = {}) {
  return [imageInput, Number(b.foregroundRatio) || 0.85, null, b.remeshOption || 'None', Number(b.vertexCount) || -1, Number(b.textureSize) || 1024];
}

/**
 * Chạy tạo 3D qua TencentARC/InstantMesh:
 * Pipeline 3 bước: /preprocess -> /generate_mvs -> /make3d
 */
async function runInstantMesh(fileInput, opts = {}) {
  const mod = await import('@gradio/client');
  const Client = mod.Client || mod.default?.Client || mod.default?.client;
  const clientFactory = opts.clientFactory;
  let app;
  if (clientFactory) {
    app = await clientFactory('TencentARC/InstantMesh');
  } else {
    app = await Client.connect('TencentARC/InstantMesh', { token: opts.hfToken || undefined });
  }

  // Chuẩn hóa input cho InstantMesh nếu là link chuỗi
  let normalizedInput = fileInput;
  if (typeof fileInput === 'string' && fileInput.startsWith('http')) {
    normalizedInput = {
      path: fileInput,
      url: fileInput,
      orig_name: path.basename(fileInput) || 'input.png',
      meta: { _type: 'gradio.FileData' },
    };
  }

  // 1. Tiền xử lý xóa phông & căn chỉnh
  const preRes = await app.predict('/preprocess', [normalizedInput]);
  const preImg = preRes?.data?.[0];
  if (!preImg) throw new Error('InstantMesh preprocess không trả về ảnh');

  // 2. Tạo Multi-view Diffusion (50 steps để làm sắc nét viền miệng & giảm lỗ khuyết, seed 42)
  const steps = Number(opts.sampleSteps) || 50;
  await app.predict('/generate_mvs', [preImg, steps, 42]);

  // 3. Tái tạo lưới 3D (.glb)
  const res3d = await app.predict('/make3d', []);
  const glbData = res3d?.data?.[1];
  const glbUrl = glbData?.url || glbData?.path || (typeof glbData === 'string' ? glbData : null);
  if (!glbUrl) throw new Error('InstantMesh make3d không tạo được GLB');

  return glbUrl;
}

/**
 * Chạy tạo 3D qua stabilityai/stable-fast-3d
 */
async function runSF3D(fileInput, opts = {}, extraArgs = {}) {
  const r = await callSpace(SF3D_SPACE, SF3D_FN, sf3dArgs(fileInput, extraArgs), opts);
  if (!r.ok) throw new Error(r.error || 'SF3D trả về lỗi không xác định');
  const remoteGlb = glbOf(r.data);
  const glbUrl = remoteGlb?.url || remoteGlb?.path || (typeof remoteGlb === 'string' ? remoteGlb : null);
  if (!glbUrl) throw new Error('SF3D không tạo được file GLB');
  return glbUrl;
}

/**
 * Đúc phôi 3D từ ảnh đơn với cơ chế Fallback thông minh:
 * Thử InstantMesh trước -> nếu lỗi thì tự động fallback sang SF3D (hoặc ngược lại tùy config).
 */
async function generate3DFromImage(fileInput, opts = {}, extraArgs = {}) {
  if (MOCK) {
    return {
      remoteGlb: `https://mock.hf.space/glb_${hash(Date.now())}.glb`,
      provider: PRIMARY_3D_SPACE,
    };
  }

  const isInstantMeshPrimary = /instantmesh/i.test(PRIMARY_3D_SPACE);

  if (isInstantMeshPrimary) {
    try {
      console.log(`[AI Gradio] Đang đúc 3D với ${PRIMARY_3D_SPACE}...`);
      const glbUrl = await runInstantMesh(fileInput, opts);
      return { remoteGlb: glbUrl, provider: 'TencentARC/InstantMesh' };
    } catch (err) {
      // Quota hết → không fallback (cả 2 đều dùng ZeroGPU, sẽ lỗi lặp lại)
      if (isQuotaError(err)) {
        throw new Error('Mô hình AI đúc 3D (ZeroGPU) đã hết hạn mức (Quota) miễn phí trên Hugging Face. Vui lòng thử lại sau.');
      }
      console.warn(`[AI Gradio] ${PRIMARY_3D_SPACE} lỗi (${err.message}), kích hoạt fallback sang ${SF3D_SPACE}...`);
      try {
        const glbUrl = await runSF3D(fileInput, opts, extraArgs);
        return { remoteGlb: glbUrl, provider: SF3D_SPACE };
      } catch (err2) {
        if (isQuotaError(err2)) {
          throw new Error('Mô hình AI đúc 3D (ZeroGPU) đã hết hạn mức (Quota) miễn phí trên Hugging Face. Vui lòng thử lại sau.');
        }
        throw new Error(`Đúc 3D thất bại: ${err.message} (Fallback SF3D: ${err2.message})`);
      }
    }
  } else {
    try {
      console.log(`[AI Gradio] Đang đúc 3D với ${SF3D_SPACE}...`);
      const glbUrl = await runSF3D(fileInput, opts, extraArgs);
      return { remoteGlb: glbUrl, provider: SF3D_SPACE };
    } catch (err) {
      // Quota hết → không fallback
      if (isQuotaError(err)) {
        throw new Error('Mô hình AI đúc 3D (ZeroGPU) đã hết hạn mứuc (Quota) miễn phí trên Hugging Face. Vui lòng thử lại sau.');
      }
      console.warn(`[AI Gradio] ${PRIMARY_3D_SPACE} lỗi (${err.message}), kích hoạt fallback sang InstantMesh...`);
      try {
        const glbUrl = await runInstantMesh(fileInput, opts);
        return { remoteGlb: glbUrl, provider: 'TencentARC/InstantMesh' };
      } catch (err2) {
        if (isQuotaError(err2)) {
          throw new Error('Mô hình AI đúc 3D (ZeroGPU) đã hết hạn mức (Quota) miễn phí trên Hugging Face. Vui lòng thử lại sau.');
        }
        throw new Error(`Đúc 3D thất bại: ${err.message} (Fallback InstantMesh: ${err2.message})`);
      }
    }
  }
}

/**
 * Kiểm tra lỗi hết quota ZeroGPU
 */
function isQuotaError(err) {
  if (!err) return false;
  const msg = (err.message || err.toString()).toLowerCase();
  return /quota/i.test(msg) || /exceeded/i.test(msg) || /zerogpu/i.test(msg) || /0s left/i.test(msg);
}

// Helper: Tải và lưu cache file GLB về local đĩa
async function downloadAndCacheGlb(remoteGlb, cacheName) {
  let glbFileUrl = remoteGlb;
  if (MOCK) {
    const mockName = `mock_${hash(cacheName)}.glb`;
    fs.writeFileSync(path.join(UPLOAD_DIR, mockName), Buffer.from('MOCK_GLB_BINARY_CONTENT'));
    return `${LOCAL_BASE}/uploads/${mockName}`;
  }
  if (remoteGlb) {
    const dl = await fetchBuffer(remoteGlb, { timeoutMs: 90000 });
    if (dl.ok) {
      const glbName = `glb_${hash(cacheName)}.glb`;
      fs.writeFileSync(path.join(UPLOAD_DIR, glbName), dl.data);
      glbFileUrl = `${LOCAL_BASE}/uploads/${glbName}`;
    }
  }
  return glbFileUrl;
}

// Helper dịch prompt tiếng Việt sang tiếng Anh cho FLUX diffusion
async function translatePromptToEnglish(prompt, cfAccountId, cfToken) {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fp8`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `Translate this Vietnamese pottery description into a descriptive English prompt for FLUX image generator. Output ONLY the English prompt string, no quotes, no markdown: "${prompt}"`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated = data?.result?.response?.trim().replace(/^["']|["']$/g, '');
      if (translated && translated.length > 3) return translated;
    }
  } catch (_) {}
  return prompt;
}

// Helper gọi Cloudflare Workers AI FLUX (không bị giới hạn ZeroGPU)
async function runCloudflareFlux(prompt) {
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!cfAccountId || !cfToken) return null;

  // Dịch sang tiếng Anh để FLUX hiểu chính xác 100% ý đồ (ví dụ: đĩa màu đỏ ngôi sao vàng)
  const englishPrompt = await translatePromptToEnglish(prompt, cfAccountId, cfToken);
  const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const enrichedPrompt = `${englishPrompt}, handcrafted ceramic pottery art, authentic studio glaze, photorealistic, 8k, professional lighting`;

  console.log(`[AI Text-to-Image] Đang sinh ảnh thật với Cloudflare FLUX: "${enrichedPrompt}"...`);
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: enrichedPrompt }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`[Cloudflare FLUX] HTTP ${resp.status}:`, errText.slice(0, 160));
    return null;
  }

  const json = await resp.json();
  const b64 = json?.result?.image;
  if (!b64) return null;

  const buf = Buffer.from(b64, 'base64');
  const imgName = `flux_cf_${hash(prompt)}.png`;
  fs.writeFileSync(path.join(UPLOAD_DIR, imgName), buf);
  return `${LOCAL_BASE}/uploads/${imgName}`;
}

// ---- 1. Text → 2D Image (Cloudflare FLUX hoặc HuggingFace FLUX.1-schnell) ----
router.post('/text-to-image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, message: 'prompt required' });

  // 1. Thử Cloudflare FLUX trước (cực nhanh ~2s, không bị lỗi ZeroGPU)
  try {
    const cfImageUrl = await runCloudflareFlux(prompt);
    if (cfImageUrl) {
      console.log(`[AI Text-to-Image] Cloudflare FLUX thành công: ${cfImageUrl}`);
      return res.json({
        success: true,
        provider: 'Cloudflare Workers AI (@cf/black-forest-labs/flux-1-schnell)',
        imageUrl: cfImageUrl,
        remoteUrl: cfImageUrl,
      });
    }
  } catch (cfErr) {
    console.warn('[Cloudflare FLUX] Lỗi, thử Hugging Face...', cfErr.message);
  }

  // 2. Fallback sang Hugging Face Space nếu có quota
  try {
    const r = await callSpace(FLUX_SPACE, FLUX_FN, fluxArgs(req.body), clientOpts());
    if (r.ok) {
      const remoteUrl = imgUrlOf(r.data);
      let finalImageUrl = remoteUrl;

      // Tải và lưu ảnh 2D về local cache để đảm bảo không bị hết hạn
      if (!MOCK && remoteUrl) {
        const dl = await fetchBuffer(remoteUrl, { timeoutMs: 30000 });
        if (dl.ok) {
          const imgName = `flux_${hash(prompt)}.png`;
          fs.writeFileSync(path.join(UPLOAD_DIR, imgName), dl.data);
          finalImageUrl = `${LOCAL_BASE}/uploads/${imgName}`;
        }
      }

      return res.json({ success: true, provider: FLUX_SPACE, method: FLUX_FN, imageUrl: finalImageUrl, remoteUrl });
    }
    return res.status(502).json({ success: false, message: r.error, provider: FLUX_SPACE, method: FLUX_FN });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- 2. Image (2D) → 3D Model (.glb) ----
router.post('/image-to-3d', async (req, res) => {
  const { imageUrl, imageBase64, imageName = 'input.png', ...rest } = req.body;
  if (!imageUrl && !imageBase64) return res.status(400).json({ success: false, message: 'imageUrl or imageBase64 required' });

  try {
    let inputFor3D = imageUrl;

    // Nếu gửi base64 hoặc link local, lưu ra file và dùng handleFile để upload trực tiếp lên Space
    if (imageBase64) {
      const buf = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
      const imgName = `img_${hash(imageName)}.png`;
      const localPath = path.join(UPLOAD_DIR, imgName);
      fs.writeFileSync(localPath, buf);
      inputFor3D = await handleFile(localPath);
    } else if (imageUrl && (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1'))) {
      const filename = path.basename(imageUrl);
      const localPath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(localPath)) {
        inputFor3D = await handleFile(localPath);
      }
    }

    const { remoteGlb, provider } = await generate3DFromImage(inputFor3D, clientOpts(), rest);
    const glbFileUrl = await downloadAndCacheGlb(remoteGlb, imageName);

    res.json({
      success: true,
      provider,
      glbUrl: remoteGlb,
      glbFileUrl,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- 3. Text → 2D → 3D Pipeline trọn gói ----
router.post('/text-to-3d-full', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ success: false, message: 'prompt required' });

  try {
    // Bước 1: Gọi FLUX sinh ảnh 2D
    const img = await callSpace(FLUX_SPACE, FLUX_FN, fluxArgs(req.body), clientOpts());
    if (!img.ok) return res.status(502).json({ success: false, message: `FLUX lỗi: ${img.error}`, provider: FLUX_SPACE });
    const remoteImgUrl = imgUrlOf(img.data);

    let localImgPath = null;
    let finalImageUrl = remoteImgUrl;
    if (!MOCK && remoteImgUrl) {
      const dl = await fetchBuffer(remoteImgUrl, { timeoutMs: 30000 });
      if (dl.ok) {
        const imgName = `flux_${hash(prompt)}.png`;
        localImgPath = path.join(UPLOAD_DIR, imgName);
        fs.writeFileSync(localImgPath, dl.data);
        finalImageUrl = `${LOCAL_BASE}/uploads/${imgName}`;
      }
    }

    // Bước 2: Gọi AI nặn 3D
    const inputFor3D = localImgPath ? await handleFile(localImgPath) : remoteImgUrl;
    const { remoteGlb, provider } = await generate3DFromImage(inputFor3D, clientOpts());
    const glbFileUrl = await downloadAndCacheGlb(remoteGlb, prompt);

    res.json({
      success: true,
      imageUrl: finalImageUrl,
      glbUrl: remoteGlb,
      glbFileUrl,
      provider,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- 4. Image(2D) → 3D trọn gói ----
router.post('/image-to-3d-full', async (req, res) => {
  const { imageBase64, imageName = 'upload.png' } = req.body;
  if (!imageBase64) return res.status(400).json({ success: false, message: 'imageBase64 required' });

  try {
    const buf = Buffer.from(imageBase64.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
    const imgName = `img_${hash(imageName)}.png`;
    const localPath = path.join(UPLOAD_DIR, imgName);
    fs.writeFileSync(localPath, buf);
    const imageUrl = `${LOCAL_BASE}/uploads/${imgName}`;

    const inputFor3D = await handleFile(localPath);
    const { remoteGlb, provider } = await generate3DFromImage(inputFor3D, clientOpts());
    const glbFileUrl = await downloadAndCacheGlb(remoteGlb, imageName);

    res.json({
      success: true,
      imageUrl,
      glbUrl: remoteGlb,
      glbFileUrl,
      provider,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
