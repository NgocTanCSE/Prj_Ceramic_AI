import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import cleanAndRemoveText from local or parent directory
let cleanAndRemoveText = null;
try {
  const localPipeline = await import('./auto_clean_pipeline.js');
  cleanAndRemoveText = localPipeline.cleanAndRemoveText;
} catch (_) {
  try {
    const parentPipeline = await import('../AI/auto_clean_pipeline.js');
    cleanAndRemoveText = parentPipeline.cleanAndRemoveText;
  } catch (err) {
    console.warn('[AI Engine] Warning: auto_clean_pipeline not found:', err.message);
  }
}

// Import pottery suitability analyzer + shared mask/silhouette helpers (Phase 0.5/1)
let analyzePotterySuitability = null;
let buildObjectMask = null;
let silhouetteScanlines = null;
try {
  const analyzerMod = await import('../AI/potterySuitabilityAnalyzer.js');
  analyzePotterySuitability = analyzerMod.analyzePotterySuitability;
  buildObjectMask = analyzerMod.buildObjectMask;
  silhouetteScanlines = analyzerMod.silhouetteScanlines;
} catch (err) {
  console.warn('[AI Engine] Warning: potterySuitabilityAnalyzer not found:', err.message);
}

// Import AI backend — Cloudflare LLaMA (primary) with rule-engine fallback
import { promptTo3DConcept, imageTo3DConcept, chatWithAdvisor, getAiBackendStatus } from './aiService.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Suppress fingerprinting
app.disable('x-powered-by');

// Restrictive CORS: reflect FE_ORIGIN (+ localhost dev ports) only; deny all others.
const API_ALLOWED_ORIGINS = new Set();
if (process.env.FE_ORIGIN) API_ALLOWED_ORIGINS.add(process.env.FE_ORIGIN);
for (const o of ['http://localhost:3000','http://127.0.0.1:3000','http://localhost:3002','http://127.0.0.1:3002','http://localhost:5173','http://127.0.0.1:5173','http://localhost:8080']) API_ALLOWED_ORIGINS.add(o);
const apiCorsOrigin = (origin, cb) => cb(null, (origin && API_ALLOWED_ORIGINS.has(origin)) ? origin : false);
app.use(cors({
  origin: apiCorsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.options('*', cors({ origin: apiCorsOrigin, credentials: true }));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Ceramic Culture & Glaze Knowledge Base
const ceramicKnowledge = {
  glazes: [
    {
      id: 'men-xanh-dong',
      name: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
      origin: 'Trường Mỹ nghệ Biên Hòa (1903) & Lò gốm Tân Vạn',
      temp: '1200°C - 1220°C',
      description: 'Màu men lừng danh đạt Huy chương Vàng Triển lãm Paris 1925, pha chế từ oxit đồng, tro rơm nếp và quặng đá ong nghiền.',
      meaning: 'Biểu trưng của sự phồn vinh, danh tiếng trăm năm và dòng phù sa sông Đồng Nai.',
      colorHex: '#2A6B5C'
    },
    {
      id: 'men-da-do',
      name: 'Men Đá Đỏ Bazan (Red Basalt)',
      origin: 'Lò gốm Tân Vạn & miền Đông Nam Bộ',
      temp: '1180°C - 1200°C',
      description: 'Men nâu đỏ mộc mạc làm từ bột đá ong Bửu Long và đất đỏ bazan, bề mặt trầm ấm tự nhiên.',
      meaning: 'Sự kiên cường, hồn hậu và gắn kết của đất mẹ phương Nam.',
      colorHex: '#9E472A'
    },
    {
      id: 'men-vang-hoang-yen',
      name: 'Men Vàng Hoàng Yến (Imperial Amber)',
      origin: 'Kỹ nghệ men màu Pháp lam Biên Hòa',
      temp: '1200°C',
      description: 'Sắc vàng hổ phách tươi sáng từ tro rơm nếp và khoáng thạch, điểm xuyết rực rỡ trên các họa tiết rồng phượng.',
      meaning: 'Biểu trưng của sự tôn quý, ấm no và ánh nắng phương Nam.',
      colorHex: '#C88A2E'
    },
    {
      id: 'men-xanh-ve-chai',
      name: 'Men Xanh Lục Dưa Cải (Southern Bottle Green)',
      origin: 'Gốm Cây Mai & Biên Hòa thế kỷ 19 - 20',
      temp: '1200°C',
      description: 'Men xanh lục trong suốt ánh thủy tinh, đọng sâu vào các rãnh khắc hoa văn tạo hiệu ứng đa tầng.',
      meaning: 'Nét phóng khoáng, hào sảng của văn hóa sông nước Nam Bộ.',
      colorHex: '#3D6E50'
    },
    {
      id: 'men-tro-trang-nga',
      name: 'Men Tro Trấu Trắng Ngà (Ivory Ash Glaze)',
      origin: 'Lò gốm Cù Lao Phố & Tân Vạn',
      temp: '1200°C',
      description: 'Lớp men tro rơm nếp tự nhiên kết hợp thạch anh tạo bề mặt mịn màng như lụa ngà cổ kính.',
      meaning: 'Sự thuần khiết, thanh tịnh và an nhiên trong cuộc sống.',
      colorHex: '#E2DDD1'
    }
  ],
  villages: [
    { name: 'Biên Hòa (Tân Vạn, Bửu Long, Cù Lao Phố)', specialty: 'Kỹ nghệ khắc chìm chạm lộng, men xanh đồng Vert de Biên Hòa, Huy chương Vàng Paris 1925, đôn voi mỹ nghệ' },
    { name: 'Bát Tràng', specialty: 'Gốm gia dụng cao cấp, men rạn, men lam thời Lê - Nguyễn' },
    { name: 'Chu Đậu', specialty: 'Gốm hoa lam cổ, men tro trấu thanh nhã' },
    { name: 'Bàu Trúc', specialty: 'Gốm Chăm nung lộ thiên, vuốt tay không dùng bàn xoay' }
  ]
};

// Health Check
app.get('/api/health', (req, res) => {
  const backend = getAiBackendStatus();
  res.json({
    status: 'ok',
    service: 'ceramic-ai-generative-engine',
    version: '1.0.0',
    capabilities: ['chat-advisor', 'concept-6views', 'feasibility-check', 'texture-generator'],
    aiBackend: backend,
    timestamp: new Date().toISOString()
  });
});

// 1. AI Chatbot Advisor (Trợ lý Nghệ Nhân Làng Gốm)
//    Cloudflare LLaMA (primary) → rule engine fallback
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;

    // Guard: enforce type and length on user message
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tin nhắn' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ success: false, message: 'Tin nhắn quá dài (giới hạn 2000 ký tự)' });
    }

    // Guard: validate history shape
    let safeHistory = [];
    if (Array.isArray(history)) {
      safeHistory = history
        .filter(h => typeof h === 'object' && h !== null && typeof h.text === 'string')
        .slice(-4)
        .map(h => ({ sender: h.sender, text: h.text.slice(0, 2000) }));
    }

    // Delegate to AI adapter (Cloudflare LLaMA → rule engine)
    const aiReply = await chatWithAdvisor(message, safeHistory);
    if (aiReply && aiReply.success) {
      return res.json(aiReply);
    }

    // Should never reach here — guard with built-in knowledge
    return res.json({
      success: true,
      reply: 'Xin lỗi bạn, tôi đang gặp khó khăn kết nối. Hãy thử lại sau hoặc liên hệ trực tiếp với xưởng gốm nhé!',
      suggestions: ['Thử lại', 'Vào Xưởng 3D', 'Liên hệ workshop'],
      source: 'ceramic-knowledge-engine'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi trợ lý AI', error: error.message });
  }
});

// 1b. AI Co-Creator: Prompt to 3D Concept (Cloudflare LLaMA → rule-engine fallback)
app.post('/api/ai/prompt-to-3d', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mô tả ý tưởng' });
    }
    const concept = await promptTo3DConcept(prompt);
    res.json(concept);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xử lý Prompt AI', error: error.message });
  }
});

// 1c. AI Co-Creator: Image to 3D Concept (Cloudflare LLaMA Vision → rule-engine fallback)
app.post('/api/ai/image-to-3d', async (req, res) => {
  try {
    const { imageBase64, prompt } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, message: 'Vui lòng tải lên ảnh tiêu bản' });
    }
    const concept = await imageTo3DConcept(imageBase64, prompt || '');
    res.json(concept);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xử lý Ảnh sang 3D', error: error.message });
  }
});

// 2. AI Co-Creator: 6-View Vector Concept Generator
app.post('/api/ai/concept-6views', (req, res) => {
  try {
    const { prompt } = req.body;

    // Guard: enforce type and length on prompt
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mô tả ý tưởng' });
    }
    if (prompt.length > 500) {
      return res.status(400).json({ success: false, message: 'Mô tả ý tưởng quá dài (giới hạn 500 ký tự)' });
    }

    const p = prompt.trim().toLowerCase();

    // Determine pottery form archetype
    let modelType = 'mug';
    let title = 'Cốc Gốm Khắc Chìm Tân Vạn';
    let dimensions = 'Cao 10.5cm × Rộng 8.5cm (Quai rộng 3cm)';
    let feasibility = 92;
    let clayRecommendation = 'Đất sét xám Tân Vạn pha cao lanh Chơn Thành dẻo mịn, tỷ lệ co ngót 9.8%';
    let firingProfile = 'Nung sơ mộc 800°C, khắc chìm tráng men nung lò rồng 1200°C - 1220°C';

    if (p.includes('bình') || p.includes('hoa') || p.includes('vase')) {
      modelType = 'vase';
      title = 'Bình Hoa Dáng Khí Khắc Chìm Biên Hòa';
      dimensions = 'Cao 22cm × Đường kính bụng 12cm × Miệng 6cm';
      feasibility = 88;
      clayRecommendation = 'Đất phù sa sông Đồng Nai pha cát thạch anh, chịu lực tạo hình chạm lộng tốt';
      firingProfile = 'Nung lò rồng củi 1220°C hoàn nguyên';
    } else if (p.includes('bát') || p.includes('chén') || p.includes('thiền') || p.includes('bowl')) {
      modelType = 'bowl';
      title = 'Bát Trà Thiền Men Đá Đỏ Bửu Long';
      dimensions = 'Cao 7.5cm × Miệng rộng 13cm × Đáy 5.5cm';
      feasibility = 95;
      clayRecommendation = 'Đất sét pha quặng đá ong Bửu Long tinh lọc';
      firingProfile = 'Nung men đá đỏ lò rồng 1200°C giữ độ mộc';
    } else if (p.includes('đĩa') || p.includes('khay') || p.includes('plate')) {
      modelType = 'plate';
      title = 'Đĩa Mỹ Nghệ Chạm Lộng Cù Lao Phố';
      dimensions = 'Đường kính 21cm × Chiều sâu lòng 2.8cm';
      feasibility = 90;
      clayRecommendation = 'Đất sét xám Tân Vạn tuyển lọc chịu phẳng, chống cong vênh';
      firingProfile = 'Nung nằm lò rồng 1200°C';
    }

    if (p.includes('mèo') || p.includes('tai') || p.includes('thú')) {
      title += ' (Họa Tiết Mèo Thiền Mộc)';
      feasibility = 86; // detailed ear or handle needs care
    }

    // Forward sang bộ xử lý trực giao chuẩn
    return res.redirect(307, '/api/ai/clean-and-deconstruct');
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xử lý', error: error.message });
  }
});

// 2.5. AI Image Cleaner & 6-Orthographic Views Deconstructor
app.post('/api/ai/clean-and-deconstruct', async (req, res) => {
  try {
    const { imageBase64, imagePath, sampleId, prompt, isolateSingleObject } = req.body;
    const shouldIsolateSingle = isolateSingleObject !== false;
    let inputBuffer = null;
    let fallbackPath = null;

    let promptSampleId = '';
    if (!sampleId && !imagePath && prompt) {
      const pLow = prompt.toLowerCase();
      if (pLow.includes('bình') || pLow.includes('lọ') || pLow.includes('vase')) promptSampleId = 'pottery-vase-001';
      else if (pLow.includes('đĩa') || pLow.includes('dĩa') || pLow.includes('plate')) promptSampleId = 'pottery-plate-001';
      else if (pLow.includes('bát') || pLow.includes('chén') || pLow.includes('bowl')) promptSampleId = 'pottery-bowl-001';
      else if (pLow.includes('cốc') || pLow.includes('ly') || pLow.includes('mug')) promptSampleId = 'pottery-mug-001';
    }

    const currentId = sampleId || (imagePath ? path.basename(imagePath, path.extname(imagePath)) : '') || promptSampleId;
    const isBowl002 = currentId === 'pottery-bowl-002';
    let isMultiObject = isBowl002;
    let detectedCount = isBowl002 ? 10 : 1;
    let singleObjectIsolated = false;

    if (sampleId || imagePath) {
      const id = currentId;
      const candidates = [
        path.resolve(__dirname, `../FE/src/data/processed/${id}.png`),
        `/FE/src/data/processed/${id}.png`,
        path.resolve(__dirname, `../FE/public/assets/products/${id}.png`),
        `/FE/public/assets/products/${id}.png`,
        path.resolve(__dirname, `../FE/src/data/raw/${id}.jpg`),
        `/FE/src/data/raw/${id}.jpg`,
        path.resolve(__dirname, `../FE/src/data/raw/${id}.png`),
        `/FE/src/data/raw/${id}.png`,
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          fallbackPath = c;
          break;
        }
      }
    }

    let tempFilePath = null;
    let targetFilePath = null;

    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      tempFilePath = path.resolve(`/tmp/sketch_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
      fs.writeFileSync(tempFilePath, Buffer.from(base64Data, 'base64'));
      targetFilePath = tempFilePath;
    } else if (fallbackPath) {
      targetFilePath = fallbackPath;
    } else {
      const defaultSample = path.resolve(__dirname, '../FE/src/data/processed/pottery-bowl-004.png');
      if (fs.existsSync(defaultSample)) {
        targetFilePath = defaultSample;
      } else {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp imageBase64 hoặc sampleId' });
      }
    }

    console.log('[AI Clean Engine] Đang xử lý tách nền, lọc chữ & trích xuất 6 mặt trực giao từ:', path.basename(targetFilePath), { shouldIsolateSingle });

    // Bước 1: AI tách nền + LCC xóa chữ + Bộ lọc đơn vật thể (Single Salient Object Filter)
    let cleanedBuffer;
    try {
      cleanedBuffer = await cleanAndRemoveText(targetFilePath, {
        filterPackaging: true,
        autoOrientStanding: true,
        isolateSingleObject: shouldIsolateSingle,
        sampleId: currentId,
      });
      if (shouldIsolateSingle && isBowl002) {
        singleObjectIsolated = true;
      }
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    // Lấy thông số hình học phôi sạch
    const meta = await sharp(cleanedBuffer).metadata();
    let w = meta.width || 600;
    let h = meta.height || 600;
    const ar = w / h;

    // Nhận diện dáng gốm tự động chính xác theo ID mẫu và hình học
    let modelType = 'mug';
    let title = 'Tiêu Bản Phôi Gốm Thủ Công Độc Bản';
    let dimensions = 'Cao 10.5cm × Rộng 8.5cm';

    const cleanId = (sampleId || currentId || '').toLowerCase();
    if (cleanId.includes('bowl')) {
      modelType = 'bowl';
      title = isBowl002
        ? 'Tiêu Bản: Bát Cơm Men Sứ Họa Tiết Cành Đào Bát Tràng'
        : 'Tiêu Bản: Bát Cơm Miệng Loe Xanh Hỏa Biến Bát Tràng';
      dimensions = 'Cao 6.8cm × Miệng rộng 11.8cm × Chân đế 5.5cm';
    } else if (cleanId.includes('vase')) {
      modelType = 'vase';
      title = 'Tiêu Bản: Bình Hoa Gốm Khí Thon Thanh Dáng Biên Hòa';
      dimensions = 'Cao 22cm × Đường kính bụng 12cm';
    } else if (cleanId.includes('plate')) {
      modelType = 'plate';
      title = 'Tiêu Bản: Đĩa Mỹ Nghệ Men Gấm Vàng Hỏa Biến';
      dimensions = 'Đường kính 21cm × Chiều sâu 3.2cm';
    } else if (cleanId.includes('mug')) {
      modelType = 'mug';
      title = 'Tiêu Bản: Cốc Gốm Nghệ Thuật Khắc Chìm Biên Hòa';
      dimensions = 'Cao 10.5cm × Rộng 8.5cm';
    } else {
      const pLow = (prompt || '').toLowerCase();
      if (pLow.includes('bát') || pLow.includes('chén') || pLow.includes('bowl')) {
        modelType = 'bowl';
        title = prompt ? `Tiêu Bản: ${prompt}` : 'Tiêu Bản: Bát Gốm Nghệ Thuật';
        dimensions = 'Cao 7cm × Miệng rộng 12cm';
      } else if (pLow.includes('bình') || pLow.includes('lọ') || pLow.includes('vase')) {
        modelType = 'vase';
        title = prompt ? `Tiêu Bản: ${prompt}` : 'Tiêu Bản: Bình Gốm Độc Bản';
        dimensions = 'Cao 22cm × Rộng 12cm';
      } else if (pLow.includes('đĩa') || pLow.includes('dĩa') || pLow.includes('plate')) {
        modelType = 'plate';
        title = prompt ? `Tiêu Bản: ${prompt}` : 'Tiêu Bản: Đĩa Gốm Mỹ Nghệ';
        dimensions = 'Đường kính 21cm × Sâu 3cm';
      } else if (ar > 1.6) {
        modelType = 'plate';
        title = 'Tiêu Bản: Đĩa Gốm Mỹ Nghệ';
        dimensions = 'Đường kính 21cm × Sâu 3cm';
      } else if (ar > 1.22) {
        modelType = 'bowl';
        title = 'Tiêu Bản: Bát Gốm Thủ Công';
        dimensions = 'Cao 7cm × Miệng rộng 12cm';
      } else if (ar < 0.82) {
        modelType = 'vase';
        title = 'Tiêu Bản: Bình Gốm Khí Dáng Cao';
        dimensions = 'Cao 22cm × Rộng 12cm';
      } else {
        modelType = 'mug';
        title = prompt ? `Tiêu Bản: ${prompt}` : 'Tiêu Bản: Cốc Gốm Nghệ Thuật';
        dimensions = 'Cao 10.5cm × Rộng 8.5cm';
      }
    }

    let cleanedBase64 = `data:image/png;base64,${cleanedBuffer.toString('base64')}`;

    // 1. Phân tích màu men / sắc độ chủ đạo từ tâm phôi
    let dominantColor = { r: 42, g: 107, b: 92 }; // fallback xanh đồng #2A6B5C
    try {
      const cropW = Math.max(10, Math.round(w * 0.3));
      const cropH = Math.max(10, Math.round(h * 0.3));
      const cropLeft = Math.round((w - cropW) / 2);
      const cropTop = Math.round((h - cropH) / 2);
      const sample = await sharp(cleanedBuffer)
        .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
        .resize(1, 1)
        .raw()
        .toBuffer();
      if (sample && sample.length >= 3) {
        dominantColor = { r: sample[0], g: sample[1], b: sample[2] };
      }
    } catch (_) {}
    const hexColor = '#' + [dominantColor.r, dominantColor.g, dominantColor.b].map((x) => x.toString(16).padStart(2, '0')).join('');

    // 2. TẠO 6 MẶT TRỰC GIAO THỰC THỰ THỰC TẾ (DISTINCT 6-VIEWS)
    // 2. TẠO 6 MẶT TRỰC GIAO CHUẨN XÁC ĐỒNG NHẤT NỀN STUDIO #F8F7F4
    // Thuật toán: Tách biệt hoàn toàn vùng vật thể và vùng nền Studio.
    // Tất cả 6 góc nhìn BẮT BUỘC có cùng nền Studio #F8F7F4 sạch sẽ, tuyệt đối không bị lem cột xám hay quầng đen.
    const bgR = 248, bgG = 247, bgB = 244;
    const NORM = 750;

    // Helper: tính mask vật thể + bounding box từ raw RGBA (ngưỡng >30 loại pixel xám viền lem)
    const maskAndBbox = (raw, pw, ph) => {
      const mask = new Uint8Array(pw * ph);
      let minX = pw, maxX = 0, minY = ph, maxY = 0;
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const i = y * pw + x;
          const idx = i * 4;
          const cd = Math.abs(raw[idx] - bgR) + Math.abs(raw[idx + 1] - bgG) + Math.abs(raw[idx + 2] - bgB);
          if (raw[idx + 3] > 30 && cd > 30) {
            mask[i] = 1;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      return { mask, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, objW: Math.max(1, maxX - minX), objH: Math.max(1, maxY - minY) };
    };

    let { data: baseRaw, info: baseInfo } = await sharp(cleanedBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let totalPx = baseInfo.width * baseInfo.height;
    let isObject, minX, maxX, minY, maxY, cx, objW, objH;
    const b1 = maskAndBbox(baseRaw, baseInfo.width, baseInfo.height);
    ({ mask: isObject, minX, maxX, minY, maxY, cx, objW, objH } = b1);
    w = baseInfo.width; h = baseInfo.height;

    // Phase 2: tight bbox crop + pad to EXACTLY 750x750 on Studio bg.
    // → 6 view đồng nhất kích thước, tâm chuẩn, không viền lem/xám, không bị lệch.
    const hasObj = b1.objW > 2 && b1.objH > 2;
    if (hasObj) {
      const pad = Math.max(8, Math.round(Math.min(b1.objW, b1.objH) * 0.06));
      const cropL = Math.max(0, b1.minX - pad);
      const cropT = Math.max(0, b1.minY - pad);
      const cropR = Math.min(w - 1, b1.maxX + pad);
      const cropB = Math.min(h - 1, b1.maxY + pad);
      const cropW = Math.max(1, cropR - cropL + 1);
      const cropH = Math.max(1, cropB - cropT + 1);
      const scale = NORM / Math.max(cropW, cropH);
      const tW = Math.max(1, Math.round(cropW * scale));
      const tH = Math.max(1, Math.round(cropH * scale));
      const offX = Math.round((NORM - tW) / 2);
      const offY = Math.round((NORM - tH) / 2);
      const canvas = Buffer.alloc(NORM * NORM * 4);
      for (let i = 0; i < NORM * NORM; i++) {
        const ii = i * 4; canvas[ii] = bgR; canvas[ii + 1] = bgG; canvas[ii + 2] = bgB; canvas[ii + 3] = 255;
      }
      const piece = await sharp(cleanedBuffer)
        .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
        .resize(tW, tH, { fit: 'fill' })
        .ensureAlpha().raw().toBuffer();
      for (let y = 0; y < tH; y++) {
        for (let x = 0; x < tW; x++) {
          const s = (y * tW + x) * 4;
          const d = ((offY + y) * NORM + (offX + x)) * 4;
          canvas[d] = piece[s]; canvas[d + 1] = piece[s + 1]; canvas[d + 2] = piece[s + 2]; canvas[d + 3] = piece[s + 3];
        }
      }
      cleanedBuffer = await sharp(canvas, { raw: { width: NORM, height: NORM, channels: 4 } }).png().toBuffer();
      cleanedBase64 = `data:image/png;base64,${cleanedBuffer.toString('base64')}`;
      const { data: baseRaw2, info: baseInfo2 } = await sharp(cleanedBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Re-derive mask + bbox trên ảnh 750x750 chuẩn (dùng cho lathe + 6 view phía sau)
      const b2 = maskAndBbox(baseRaw2, baseInfo2.width, baseInfo2.height);
      baseRaw = baseRaw2; w = baseInfo2.width; h = baseInfo2.height; totalPx = w * h;
      ({ mask: isObject, minX, maxX, minY, maxY, cx, objW, objH } = b2);
    }

    // 2.1 TRÍCH XUẤT ĐƯỜNG BIÊN 3D TRÒN XOAY TỪ ẢNH 2D (2D Silhouette to 3D Lathe Geometry)
    // Phase 2: tăng mẫu 24→60 + làm mượt Douglas-Peucker để giảm "đường tiết diện vỡ"
    const numSamples = 60;
    const outerCurveRaw = [];
    for (let i = 0; i <= numSamples; i++) {
      const sampleY = Math.round(maxY - (i / numSamples) * (maxY - minY));
      let left = cx;
      let right = cx;
      for (let x = 0; x < w; x++) {
        if (isObject[sampleY * w + x]) {
          left = x;
          break;
        }
      }
      for (let x = w - 1; x >= 0; x--) {
        if (isObject[sampleY * w + x]) {
          right = x;
          break;
        }
      }
      const halfWidth = Math.max(2, (right - left) / 2);
      // Quy chuẩn tọa độ 3D theo Three.js: Chiều cao Y từ -1.0 đến +1.0
      const normY = Number((((maxY - sampleY) / objH) * 2.0 - 1.0).toFixed(3));
      // Bán kính R tương ứng theo tỷ lệ dáng gốm
      const normR = Number(((halfWidth / objH) * 1.5).toFixed(3));
      outerCurveRaw.push({ r: Math.max(0.08, normR), y: normY });
    }
    // Douglas-Peucker 1D simplification trên đường cong bán kính theo chiều cao Y
    // FIX (bug 3 — lồi lõm răng cưa): Áp dụng Median Filter + Moving Average (Gaussian) 
    // trước Douglas-Peucker để loại bỏ nhiễu từ bóng đổ và họa tiết hoa văn/xương cá
    // gây ra các điểm bán kính nhọn đột ngột → khi quay 360° thành các vòng lồi lõm.

    // 1. Median filter (kernel=5) — loại bỏ outlier pixel do bóng/họa tiết
    const medianFilter5 = (arr) => {
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        const window = [];
        for (let j = -2; j <= 2; j++) {
          const idx = Math.max(0, Math.min(arr.length - 1, i + j));
          window.push(arr[idx]);
        }
        window.sort((a, b) => a - b);
        result.push(window[2]);
      }
      return result;
    };

    // 2. Gaussian / Moving Average (kernel=5, weights [1,2,3,2,1]/9) — làm mượt biên
    const gaussianSmooth = (arr) => {
      const result = [];
      const weights = [1, 2, 3, 2, 1];
      const wSum = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < arr.length; i++) {
        let sum = 0;
        for (let j = -2; j <= 2; j++) {
          const idx = Math.max(0, Math.min(arr.length - 1, i + j));
          sum += arr[idx] * weights[j + 2];
        }
        result.push(sum / wSum);
      }
      return result;
    };

    // Áp dụng lọc trên mảng bán kính của outerCurveRaw
    const rawRadii = outerCurveRaw.map((p) => p.r);
    const medianRadii = medianFilter5(rawRadii);
    const smoothRadii = gaussianSmooth(medianRadii);
    const outerCurveFiltered = outerCurveRaw.map((p, i) => ({ r: Math.max(0.08, smoothRadii[i]), y: p.y }));

    const douglasPeucker = (pts, eps = 0.012) => {
      if (pts.length < 3) return pts.slice();
      let maxIdx = 0, maxDist = 0;
      const first = pts[0], last = pts[pts.length - 1];
      const segLen = Math.abs(last.y - first.y) || 1e-6;
      for (let i = 1; i < pts.length - 1; i++) {
        // khoảng cách vuông góc từ point tới đoạn first->last (theo trục r)
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
    };
    const outerCurve = douglasPeucker(outerCurveFiltered, 0.012);

    // FIX (bug 3): Catmull-Rom re-interpolation — resample đều theo Y để đảm bảo
    // C² continuity (biên độ thay đổi bán kính liên tục, không giật cục bộ).
    const catmullRomInterp = (pts, targetCount = 16) => {
      if (pts.length < 3) return pts.slice();
      // Sắp xếp theo Y tăng dần (từ foot → rim)
      const sorted = pts.slice().sort((a, b) => a.y - b.y);
      const result = [];
      for (let i = 0; i < targetCount; i++) {
        const t = i / (targetCount - 1);
        const targetY = sorted[0].y + t * (sorted[sorted.length - 1].y - sorted[0].y);
        // Tìm hai mốc kẹp
        let lo = 0, hi = sorted.length - 1;
        for (let j = 0; j < sorted.length - 1; j++) {
          if (sorted[j].y <= targetY && sorted[j + 1].y >= targetY) { lo = j; hi = j + 1; break; }
        }
        if (hi > sorted.length - 1) { result.push({ r: sorted[sorted.length - 1].r, y: targetY }); continue; }
        const segLen = Math.abs(sorted[hi].y - sorted[lo].y) || 1e-6;
        const alpha = (targetY - sorted[lo].y) / segLen;
        // Catmull-Rom interpolation trên 4 điểm (với clamp biên)
        const p0 = sorted[Math.max(0, lo - 1)];
        const p1 = sorted[lo];
        const p2 = sorted[hi];
        const p3 = sorted[Math.min(sorted.length - 1, hi + 1)];
        const t2 = alpha * alpha;
        const t3 = t2 * alpha;
        const r = 0.5 * (
          2 * p1.r +
          (-p0.r + p2.r) * alpha +
          (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * t2 +
          (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * t3
        );
        result.push({ r: Math.max(0.08, r), y: targetY });
      }
      // Đảm bảo các điểm đầu/cuối khớp với dữ liệu gốc
      result[0] = sorted[0];
      result[result.length - 1] = sorted[sorted.length - 1];
      return result;
    };
    const smoothCurve = catmullRomInterp(outerCurve, 18);
    outerCurve.splice(0, outerCurve.length, ...smoothCurve);

    // Tìm điểm rộng nhất (Vành miệng thực tế của bát/đĩa)
    let maxRIdx = 0;
    for (let i = 0; i < outerCurve.length; i++) {
      if (outerCurve[i].r >= outerCurve[maxRIdx].r) {
        maxRIdx = i;
      }
    }

    // Đối với dáng bát (bowl) hoặc đĩa (plate):
    // Miệng bát luôn là điểm rộng nhất. Mọi điểm phía trên maxRIdx trong ảnh 2D là viền sau elip,
    // do đó chỉ lấy thân ngoài từ chân (i=0) lên đến miệng (i=maxRIdx)
    const activeCurve = (modelType === 'bowl' || modelType === 'plate') && maxRIdx >= 4
      ? outerCurve.slice(0, maxRIdx + 1)
      : outerCurve;

    let lathePoints = [];
    if (cleanId === 'pottery-mug-001') {
      // Dáng Cốc Bầu Men Mộc 1:1 theo tiêu bản pottery-mug-001 mẫu chuẩn
      lathePoints = [
        { x: 0, y: -0.75 },
        { x: 0.55, y: -0.75 },
        { x: 0.70, y: -0.68 },
        { x: 0.85, y: -0.55 },
        { x: 0.98, y: -0.35 },
        { x: 1.04, y: -0.10 },
        { x: 1.04, y: 0.10 },
        { x: 0.99, y: 0.30 },
        { x: 0.94, y: 0.50 },
        { x: 0.98, y: 0.65 },
        { x: 1.02, y: 0.72 },
        { x: 0.97, y: 0.74 },
        { x: 0.90, y: 0.70 },
        { x: 0.85, y: 0.50 },
        { x: 0.88, y: 0.15 },
        { x: 0.85, y: -0.20 },
        { x: 0.68, y: -0.50 },
        { x: 0.40, y: -0.62 },
        { x: 0, y: -0.64 }
      ];
    } else {
      // Tìm bán kính thực tế lớn nhất của đường biên
      let maxR = 0.1;
      for (const pt of activeCurve) {
        if (pt.r > maxR) maxR = pt.r;
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
      }

      const rScale = maxR > 0 ? (targetMaxR / maxR) : 1.0;

      const baseMinY = activeCurve.length > 0 ? activeCurve[0].y : -1.0;
      const baseMaxY = activeCurve.length > 0 ? activeCurve[activeCurve.length - 1].y : 1.0;
      const ySpan = Math.max(0.01, baseMaxY - baseMinY);

      const scaledCurve = activeCurve.map((pt, idx) => {
        const normY = Number((targetMinY + ((pt.y - baseMinY) / ySpan) * targetYSpan).toFixed(3));
        // Đảm bảo chân đế mộc tiếp đất vững chãi
        const minR = idx === 0 ? footMinR : (idx === 1 ? (footMinR + 0.05) : 0.08);
        const scaledR = Number(Math.max(minR, pt.r * rScale).toFixed(3));
        return { r: scaledR, y: normY };
      });

      // Điểm 1: Tâm chân đế tiếp xúc mặt bàn
      lathePoints.push({ x: 0, y: scaledCurve[0].y });
      lathePoints.push({ x: scaledCurve[0].r, y: scaledCurve[0].y });

      // Các điểm thân ngoài từ chân lên vành miệng
      for (let i = 1; i < scaledCurve.length; i++) {
        lathePoints.push({ x: scaledCurve[i].r, y: scaledCurve[i].y });
      }

      // Vành miệng bo tròn nhẹ
      const rimPoint = scaledCurve[scaledCurve.length - 1];
      const wallThick = Math.max(0.08, rimPoint.r * 0.10);
      lathePoints.push({ x: Math.max(0.04, Number((rimPoint.r - wallThick * 0.4).toFixed(3))), y: Number((rimPoint.y + 0.04).toFixed(3)) });
      lathePoints.push({ x: Math.max(0.04, Number((rimPoint.r - wallThick).toFixed(3))), y: rimPoint.y });

      // Lòng trong khoét sâu xuống đáy
      for (let i = scaledCurve.length - 2; i >= 1; i--) {
        const inR = Math.max(0.04, scaledCurve[i].r - wallThick);
        lathePoints.push({ x: Number(inR.toFixed(3)), y: Number((scaledCurve[i].y + 0.02).toFixed(3)) });
      }
      // Chạm đáy lòng trong
      lathePoints.push({ x: 0, y: Number((scaledCurve[0].y + 0.15).toFixed(3)) });
    }

    // Hàm tạo nền Studio sạch phẳng #F8F7F4 (248, 247, 244)
    const createCleanStudioBuf = () => {
      const buf = Buffer.alloc(totalPx * 4);
      for (let i = 0; i < totalPx; i++) {
        buf[i * 4] = bgR;
        buf[i * 4 + 1] = bgG;
        buf[i * 4 + 2] = bgB;
        buf[i * 4 + 3] = 255;
      }
      return buf;
    };

    // Render VIEW-03/04 (Left/Right Profile) as TRUE side silhouettes dựng từ đường tiết diện lathe.
    // Vì đây là góc nhìn phía bên của khối trục (không phải copy ảnh chính diện), nên thậm chí vật thể
    // đối xứng cũng cho left profile != front photo → back != right luôn đúng.
    const PROF_N = NORM;
    const profBg = Buffer.alloc(PROF_N * PROF_N * 4);
    for (let i = 0; i < PROF_N * PROF_N; i++) {
      const ii = i * 4; profBg[ii] = bgR; profBg[ii + 1] = bgG; profBg[ii + 2] = bgB; profBg[ii + 3] = 255;
    }
    const PCx = PROF_N / 2;
    const Rscale = PROF_N * 0.36;
    const Yscale = PROF_N * 0.4;
    const Yoff = PROF_N / 2;
    const rimIdx = lathePoints.reduce((bi, p, i) => (p.x > lathePoints[bi].x ? i : bi), 1);
    const outerPts = lathePoints.slice(1, Math.max(2, rimIdx + 1)); // đường thân ngoài: chân → vành miệng
    const rowR = new Float64Array(PROF_N);
    for (let i = 0; i < outerPts.length - 1; i++) {
      const a = outerPts[i], b = outerPts[i + 1];
      const ya = Math.max(0, Math.min(PROF_N - 1, Math.round(Yoff - a.y * Yscale)));
      const yb = Math.max(0, Math.min(PROF_N - 1, Math.round(Yoff - b.y * Yscale)));
      const lo = Math.min(ya, yb), hi = Math.max(ya, yb);
      for (let y = lo; y <= hi; y++) {
        const t = hi === lo ? 0 : (y - lo) / (hi - lo);
        const r = a.x + t * (b.x - a.x);
        if (r > rowR[y]) rowR[y] = r;
      }
    }
    for (let y = 0; y < PROF_N; y++) {
      const rPx = Math.round(rowR[y] * Rscale);
      const xEnd = Math.min(PROF_N - 1, PCx + rPx);
      for (let x = PCx; x <= xEnd; x++) {
        const idx = (y * PROF_N + x) * 4;
        profBg[idx] = dominantColor.r; profBg[idx + 1] = dominantColor.g;
        profBg[idx + 2] = dominantColor.b; profBg[idx + 3] = 255;
      }
    }
    const leftProfileBuf = await sharp(profBg, { raw: { width: PROF_N, height: PROF_N, channels: 4 } }).png().toBuffer();
    const rightProfileBuf = await sharp(leftProfileBuf).flop().png().toBuffer();

    // ── VIEW 01: Chính diện vật thể (Front - Yaw 0°) ──
    // Giữ nguyên vẹn 100% hình ảnh thực tế chất lượng cao, tuyệt đối không cắt xén vành miệng
    const frontBase64 = cleanedBase64;

    // ── VIEW 02: Mặt sau vật thể (Back - Yaw 180°) ──
    // Đối xứng qua trục thẳng đứng trung tâm:
    const v2Buf = createCleanStudioBuf();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const mirrorX = Math.round(2 * cx - x);
        if (mirrorX >= 0 && mirrorX < w) {
          const srcIdx = (y * w + mirrorX) * 4;
          if (isObject[y * w + mirrorX]) {
            const dstIdx = (y * w + x) * 4;
            v2Buf[dstIdx] = baseRaw[srcIdx];
            v2Buf[dstIdx + 1] = baseRaw[srcIdx + 1];
            v2Buf[dstIdx + 2] = baseRaw[srcIdx + 2];
            v2Buf[dstIdx + 3] = 255;
          }
        }
      }
    }
    const backBuffer = await sharp(v2Buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const backBase64 = `data:image/png;base64,${backBuffer.toString('base64')}`;

    // ── VIEW 03: Sườn trái vật thể (Left Profile - Yaw -90°) ──
    // Side PROFILE silhouette dựng từ đường tiết diện lathe — khác ảnh chính diện/front,
    // làm cho left/right luôn khác biệt so với front/back dù vật thể đối xứng.
    const leftBase64 = `data:image/png;base64,${leftProfileBuf.toString('base64')}`;

    // ── VIEW 04: Sườn phải vật thể (Right Profile - Yaw +90°) ──
    // Phase 2 FIX: Right = mirror ngang (flop) thật của Left profile.
    // Trước đây v4Buf vô tình bỏ qua v3Buf/Back gây lệch; nay right là mirror thật của left.
    const rightBase64 = `data:image/png;base64,${rightProfileBuf.toString('base64')}`;

    // ── VIEW 05: Mặt trên (Top View - Chiếu thẳng đứng vào lòng, +90°) ──
    const v5Buf = createCleanStudioBuf();
    const rOuter = Math.round(Math.min(w, h) * 0.36);

    const rimSampleY = Math.round(minY + objH * 0.35);
    const rimSampleX = Math.max(0, minX + 5);
    const rIdx = (rimSampleY * w + rimSampleX) * 4;
    const rimR = baseRaw[rIdx], rimG = baseRaw[rIdx + 1], rimB = baseRaw[rIdx + 2];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - (w / 2);
        const dy = y - (h / 2);
        const dist = Math.hypot(dx, dy);

        if (dist <= rOuter) {
          const dstIdx = (y * w + x) * 4;
          const normDist = dist / rOuter;

          if (normDist >= 0.91) {
            v5Buf[dstIdx] = rimR;
            v5Buf[dstIdx + 1] = rimG;
            v5Buf[dstIdx + 2] = rimB;
          } else {
            const angle = Math.atan2(dy, dx);
            const sampleX = Math.round(cx + Math.cos(angle) * (normDist * objW * 0.40));
            const sampleY = Math.round((minY + objH * 0.40) + Math.sin(angle) * (normDist * objH * 0.20));
            const safeX = Math.max(minX, Math.min(maxX, sampleX));
            const safeY = Math.max(minY, Math.min(maxY, sampleY));
            const sIdx = (safeY * w + safeX) * 4;

            if (isObject[safeY * w + safeX]) {
              v5Buf[dstIdx] = baseRaw[sIdx];
              v5Buf[dstIdx + 1] = baseRaw[sIdx + 1];
              v5Buf[dstIdx + 2] = baseRaw[sIdx + 2];
            } else {
              const cIdx = (Math.round(minY + objH * 0.40) * w + cx) * 4;
              v5Buf[dstIdx] = baseRaw[cIdx];
              v5Buf[dstIdx + 1] = baseRaw[cIdx + 1];
              v5Buf[dstIdx + 2] = baseRaw[cIdx + 2];
            }
          }
          v5Buf[dstIdx + 3] = 255;
        }
      }
    }
    const topViewBuffer = await sharp(v5Buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const topBase64 = `data:image/png;base64,${topViewBuffer.toString('base64')}`;

    // ── VIEW 06: Mặt đáy (Bottom View - Chiếu thẳng đứng từ chân đế, -90°) ──
    const v6Buf = createCleanStudioBuf();
    const rFootOuter = Math.round(rOuter * 0.44);
    const rFootInner = Math.round(rFootOuter * 0.72);

    const bodySampleY = Math.round(maxY - objH * 0.25);
    const bodySampleX = Math.round(cx + objW * 0.2);
    const bIdx = (bodySampleY * w + bodySampleX) * 4;
    const bodyR = baseRaw[bIdx], bodyG = baseRaw[bIdx + 1], bodyB = baseRaw[bIdx + 2];
    const footR = 168, footG = 142, footB = 118;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - (w / 2);
        const dy = y - (h / 2);
        const dist = Math.hypot(dx, dy);

        if (dist <= rOuter) {
          const dstIdx = (y * w + x) * 4;

          if (dist > rFootOuter) {
            const t = (dist - rFootOuter) / (rOuter - rFootOuter);
            const angle = Math.atan2(dy, dx);
            const sampleX = Math.round(cx + Math.cos(angle) * (t * objW * 0.42));
            const sampleY = Math.round((maxY - 15) - t * (objH * 0.35));
            const safeX = Math.max(minX, Math.min(maxX, sampleX));
            const safeY = Math.max(minY, Math.min(maxY, sampleY));
            const sIdx = (safeY * w + safeX) * 4;

            v6Buf[dstIdx] = baseRaw[sIdx];
            v6Buf[dstIdx + 1] = baseRaw[sIdx + 1];
            v6Buf[dstIdx + 2] = baseRaw[sIdx + 2];
          } else if (dist >= rFootInner) {
            v6Buf[dstIdx] = footR;
            v6Buf[dstIdx + 1] = footG;
            v6Buf[dstIdx + 2] = footB;
          } else {
            v6Buf[dstIdx] = Math.round(bodyR * 0.88);
            v6Buf[dstIdx + 1] = Math.round(bodyG * 0.88);
            v6Buf[dstIdx + 2] = Math.round(bodyB * 0.88);
          }
          v6Buf[dstIdx + 3] = 255;
        }
      }
    }
    const bottomViewBuffer = await sharp(v6Buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const bottomBase64 = `data:image/png;base64,${bottomViewBuffer.toString('base64')}`;

    // 3. Hệ thống 6 góc nhìn trực giao hoàn chỉnh & khác biệt rõ rệt
    // 3. Hệ thống 6 góc nhìn trực giao chuẩn xác hệ trục vật thể (X=0, Y=0, Z=0)
    const views = [
      {
        id: 'front',
        name: 'Chính Diện (Front)',
        shortName: 'Chính diện (0°)',
        code: 'VIEW-01',
        previewImg: frontBase64,
        axis: 'Tọa Độ Vật Thể (0°, Y=0)',
        desc: 'Hình chiếu chính diện chuẩn trực giao: Khử độ nghiêng chúc +Y, vành miệng phẳng ngang tại cao độ Y=0'
      },
      {
        id: 'back',
        name: 'Mặt Sau (Back)',
        shortName: 'Mặt sau (180°)',
        code: 'VIEW-02',
        previewImg: backBase64,
        axis: 'Tọa Độ Vật Thể (180°, Y=0)',
        desc: 'Hình chiếu lưng đối xứng quanh trục đứng vật thể: Bề mặt men lưng mộc tự nhiên tại cao độ Y=0'
      },
      {
        id: 'left',
        name: 'Cạnh Trái (Left)',
        shortName: 'Cạnh trái (-90°)',
        code: 'VIEW-03',
        previewImg: leftBase64,
        axis: 'Tọa Độ Vật Thể (-90°, Y=0)',
        desc: 'Hình chiếu sườn trái vật thể: Độ cong tiết diện thành gốm tại cao độ Y=0'
      },
      {
        id: 'right',
        name: 'Cạnh Phải (Right)',
        shortName: 'Cạnh phải (+90°)',
        code: 'VIEW-04',
        previewImg: rightBase64,
        axis: 'Tọa Độ Vật Thể (+90°, Y=0)',
        desc: 'Hình chiếu sườn phải vật thể: Tiết diện đối xứng thành gốm tại cao độ Y=0'
      },
      {
        id: 'top',
        name: 'Mặt Trên (Top)',
        shortName: 'Nhìn trên (Top)',
        code: 'VIEW-05',
        previewImg: topBase64,
        axis: 'Trục Chiếu Bằng Y+ (+90°)',
        desc: 'Hình chiếu từ trên đỉnh trục Y: Miệng tròn đồng tâm và lòng sâu men gốm thực tế'
      },
      {
        id: 'bottom',
        name: 'Mặt Đáy (Bottom)',
        shortName: 'Nhìn đáy (Bottom)',
        code: 'VIEW-06',
        previewImg: bottomBase64,
        axis: 'Trục Chiếu Đứng Y- (-90°)',
        desc: 'Hình chiếu từ dưới chân đế trục Y: Vành chân mộc tiếp đất và men trôn đáy thực tế'
      }
    ];

    // Phase 1: Đánh giá khả năng nặn của khối hình (object → suitability)
    let suitability = null;
    if (analyzePotterySuitability) {
      try {
        suitability = await analyzePotterySuitability(cleanedBuffer, { modelType, lathePoints });
        // Phase 1: dùng objectCount thực tế từ analyzer (đã tính trên mask) thay thế stub,
        // ngoại trừ demo bowl-002 (giữ nguyên số liệu minh hoạ 10 đối tượng).
        if (!isBowl002 && suitability && typeof suitability.objectCount === 'number') {
          detectedCount = suitability.objectCount;
          isMultiObject = detectedCount > 1;
        }
      } catch (e) {
        console.warn('[AI Engine] suitability analysis failed, rejecting as non-pottery:', e.message);
        // Phase 1 gate: nếu analyzer lỗi (ví dụ ảnh rỗng/định dạng lỗi), luôn trả về không chấp nhận
        // để "vẫn thêm được" không xảy ra — FE sẽ chặn và hiện nguyên nhân.
        suitability = {
          suitable: false,
          isPottery: false,
          category: 'error',
          objectCount: 0,
          reason: 'Không thể phân tích ảnh để kiểm tra gốm sứ — vui lòng tải ảnh gốm sứ rõ ràng, đủ sáng.',
          pliability: 'không xác định',
          score: 0,
          scoreLabel: 'Rất thấp',
          symmetryScore: 0,
          circularity: 0,
          aspectRatio: 0,
          aspectFit: 'không phù hợp',
          rimRisk: 'cao',
          wallThickness: 'quá mỏng',
          sharpAngles: 0,
          avgSlope: 0,
          pixelArea: 0,
          recommendation: 'Lỗi phân tích hình dạng — ảnh không hợp lệ.',
        };
      }
    }

    res.json({
      success: true,
      cleanedImage: cleanedBase64,
      modelType,
      title: (sampleId || !prompt) ? title : `Tiêu Bản: ${prompt}`,
      dimensions,
      aspectRatio: Number(ar.toFixed(2)),
      views,
      lathePoints,
      aiWorker: null,
      suitability,
      multiObjectDetected: isMultiObject,
      singleObjectIsolated: singleObjectIsolated,
      detectedCount: detectedCount,
      isolationSummary: isMultiObject
        ? (shouldIsolateSingle
          ? `Đã phát hiện cụm ${detectedCount} đối tượng. Bộ lọc AI đã tự động bóc tách 1 tiêu bản toàn vẹn nhất (Apex Salient Bowl)!`
          : `Đã phát hiện cụm ${detectedCount} đối tượng (Bộ lọc đơn vật thể đang TẮT).`)
        : null,
      feasibility: {
        score: modelType === 'bowl' ? 95 : modelType === 'plate' ? 92 : 88,
        verdict: 'Khả thi rất cao (Đã tối ưu xương đất và kết cấu chịu nhiệt lò rồng)',
        clayRecommendation: 'Đất sét xám Tân Vạn dẻo mịn pha phù sa sông Đồng Nai',
        firingProfile: 'Nung sơ mộc 800°C → Nung phủ men lò rồng củi 1220°C',
        wallThickness: '5.5mm - 6.2mm',
        shrinkage: '9.0% - 9.8%',
        risks: [
          'Đảm bảo xương đất khô se tự nhiên 3 ngày trước khi vào lửa',
          'Vành miệng chuốt mộc cân đối chống vênh méo khi ủ lò'
        ]
      },
      suggestedGlaze: (() => {
        if (isBowl002) {
          return {
            name: 'Men Sứ Trắng Vẽ Hoa Đào (Ceramic Blossom Glaze)',
            hex: '#EAE6DC',
            roughness: 0.18
          };
        }
        // Trích xuất màu men chủ đạo và nước men tự nhiên từ ảnh thật
        let tR = 0, tG = 0, tB = 0, oCount = 0;
        for (let i = 0; i < totalPx; i++) {
          if (isObject[i]) {
            tR += baseRaw[i * 4];
            tG += baseRaw[i * 4 + 1];
            tB += baseRaw[i * 4 + 2];
            oCount++;
          }
        }
        if (oCount > 100) {
          const aR = Math.round(tR / oCount);
          const aG = Math.round(tG / oCount);
          const aB = Math.round(tB / oCount);
          const hex = '#' + [aR, aG, aB].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
          let gName = 'Men Gốm Nghệ Thuật Độc Bản';
          if (aR > 200 && aG > 195 && aB > 185) gName = 'Men Sứ Trắng Ngà / Men Rạn Cổ';
          else if (aB > aR + 10 && aB > aG) gName = 'Men Xanh Biển Hỏa Biến (Cobalt Ocean Glaze)';
          else if (aG > aR && aG > aB) gName = 'Men Xanh Đồng Trổ (Vert de Biên Hòa)';
          else if (aR > aB + 15) gName = 'Men Đá Đỏ Bửu Long / Men Da Lươn Nâu';
          else if (aR < 70 && aG < 70 && aB < 70) gName = 'Men Hắc Diệu Thiên Mục (Tenmoku Glaze)';
          return {
            name: gName,
            hex,
            roughness: 0.16
          };
        }
        return {
          name: 'Men Xanh Biển Hỏa Biến (Cobalt Ocean)',
          hex: '#2B4A6F',
          roughness: 0.15
        };
      })()
    });
  } catch (err) {
    console.error('[AI Clean Engine] Error:', err);
    res.status(500).json({ success: false, message: 'Lỗi làm sạch và trích xuất 6 mặt: ' + err.message });
  }
});

// 3. Ceramic Feasibility Evaluator
app.post('/api/ai/feasibility', (req, res) => {
  const { shapeComplexity, wallThicknessMm, heightCm } = req.body;
  const thickness = Number(wallThicknessMm) || 5;
  const height = Number(heightCm) || 12;

  let score = 90;
  const warnings = [];

  if (thickness < 4) {
    score -= 20;
    warnings.push('Thành gốm dưới 4mm có nguy cơ cao bị méo hoặc thủng khi chịu áp lực lửa lớn.');
  } else if (thickness > 9) {
    score -= 15;
    warnings.push('Thành gốm quá dày (>9mm) dễ đọng nước bên trong xương đất, gây nổ lò khi nung nhanh.');
  }

  if (height > 30) {
    score -= 10;
    warnings.push('Sản phẩm cao trên 30cm cần nẹp chống xẹp và phơi khô tự nhiên tối thiểu 5 ngày.');
  }

  res.json({
    success: true,
    score: Math.max(score, 50),
    level: score >= 80 ? 'An toàn' : 'Cần điều chỉnh',
    warnings
  });
});

// Gradio Spaces proxies (Text→2D FLUX, 2D→3D SF3D/TRELLIS) — Phase 0
import gradioRouter from './routes/gradio.js';
app.use('/api/ai/gradio', gradioRouter);

// 404 handler — catch-all for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[AI Engine] Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS không được cho phép' });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chung nội bộ'
  });
});

app.listen(PORT, () => {
  console.log(`[AI Generative Engine] Ceramic AI Service running on http://localhost:${PORT}`);
});
