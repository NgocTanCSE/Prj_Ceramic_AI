import dotenv from 'dotenv';
import sharp from 'sharp';
import { Buffer } from 'buffer';
dotenv.config();

/**
 * cloudflareService.js — Bộ kết nối Cloudflare Workers AI (LLaMA) cho nền tảng Gốm Sứ Biên Hòa
 *
 * Backend AI: Cloudflare Workers AI (LLaMA) + rule engine fallback.
 * Sử dụng Cloudflare Workers AI với mô hình LLaMA 3.1 để:
 *   1. Chat với Cụ Thành (text chat)
 *   2. Chuyển prompt tự nhiên sang concept 3D (JSON output)
 *   3. Phân tích ảnh chụp sang concept 3D (vision)
 *
 * Fallback: Curated Ceramic Intelligence (rule engine) khi chưa có key Cloudflare.
 *
 * Env vars được mong đợi:
 *   CLOUDFLARE_ACCOUNT_ID  — Account ID của Cloudflare Workers AI
 *   CLOUDFLARE_API_TOKEN   — API token với quyền Workers AI
 *   CLOUDFLARE_MODEL       — @cf/meta/llama-3.3-70b-instruct-fp8-fast (default)
 *   CLOUDFLARE_VISION_MODEL — @cf/meta/llama-3.2-11b-vision-instruct (default)
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CF_MODEL = process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8';
// Fallback models if the primary is deprecated/unavailable (smaller = token-efficient)
const CF_MODEL_FALLBACKS = [
  '@cf/meta/llama-3.1-8b-instruct-fp8',
  '@cf/meta/llama-3.2-3b-instruct',
  '@cf/meta/llama-3.2-1b-instruct',
];

// Shared Cloudflare API endpoint (Workers AI /chat/completions)
const CF_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`;

const CERAMIC_CHAT_SYSTEM_PROMPT = `Bạn là Cụ Thành - Nghệ nhân làng gốm Tân Vạn, Biên Hòa (Đồng Nai).
Bạn xưng hô 'tôi' và gọi khách là 'bạn' hoặc 'bác/cháu' thật thân thương, mộc mẫm, uyên bác mang phong vị miền Nam.

Nhiệm vụ: Tư vấn toàn diện về gốm Bắn Hòa — phối màu men (men xanh đồng Vert de Biên Hòa, men đá đỏ bazan, men vàng hoàng yến, men xanh lục dưa cải, men đỏ thẫm, men trắng rạn), kỹ thuật khắc chìm chạm lộng (champlevé), thiết kế đường motif (lá cờ Việt Nam, sen, đồng hồng, hoa đao), và đề xuất sản phẩm phù hợp với nhu cầng sử dụng.

Khi khách hỏi về sản phẩm: hãy đề xuất loại đựới phù hợp trước (cốc/ly cho dùng hàng ngày, bát cho ăn, đĩa trang trí, bình để trang trí, tượng kỷ niệm). Tôn trọng câu hỏi của khách — nếu họ hỏi về lá cờ Việt Nam thì trả lời về thiết kế lá cờ (màu đỏ + sao vàng) chứ không phải lá cây thường. Cảnh báo độ co ngót 9-11% khi nung lò rồng ở 1200°C-1220°C. Gợi ý thử nghiệm Xưởng 3D hoặc đặt lịch Workshop tại Tân Vạn bên bờ sông Đồng Nai.

Trả lời tự nhiên, thân thiện và chi tiết (3-5 câu), luôn kèm 2-3 gợi ý hành động ngắn.`;

const CERAMIC_SYSTEM_PROMPT = `QUAN TRỌNG: CHỈ trả về JSON thuần túy, không giải thích, không lời chào, không markdown.

Bạn là Nghệ nhân Bậc thầy và Kiến trúc sư 3D của Làng gốm Biên Hòa 1903 (Tân Vạn, Đồng Nai).
Nhiệm vụ: chuyển đổi prompt thành bản đặc tả kỹ thuật 3D gốm sứ chi tiết.
Trả về JSON với schema sau (đúng field, đúng kiểu, không thêm bớt):
{
  "title": "Tên tác phẩm (string)",
  "archetype": "Một trong 5: 'vase' | 'bowl' | 'plate' | 'mug' | 'vase-narrow-neck'",
  "dimensions": "Quy cách kích thước thực tế (string)",
  "shapeParams": {
    "height": 22.0,
    "maxRadius": 11.5,
    "neckRatio": 0.35,
    "rimFlare": 0.65,
    "baseRadius": 0.45,
    "curvature": "bulbous"
  },
  "suggestedGlaze": {
    "hex": "#2A6B5C",
    "name": "Tên dòng men truyền thống",
    "roughness": 0.15
  },
  "pattern": "sen_co | dong_son | ca_chep | cham_bi | hoa_dao | none",
  "customText": "Chữ khắc thân (hoặc rỗng '')",
  "story": "1-2 câu linh hồn văn hóa & phong thủy",
  "lathePoints": null
}`;

/**
 * Gọi Cloudflare Workers AI LLaMA
 * Tự động thử model dự phòng nếu model chính bị deprecated (HTTP 410)
 */

/**
 * Rút trích JSON từ text trả về bởi LLaMA (có thể có markdown fences, lời giải thích...)
 * Thử 3 cách: JSON.parse thẳng → bỏ ```json fences → regex tìm {…}
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Try direct parse
  try {
    return JSON.parse(text.trim());
  } catch (_) {}

  // 2. Strip markdown fences ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {}
  }

  // 3. Regex extract first {…} block (handles leading prose like "Tôi xin lỗi...")
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (_) {}
  }

  return null;
}

async function callCloudflareLLaMA(messages, options = {}) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return null;
  }

  // Build the list of models to try: primary first, then fallbacks
  const modelsToTry = [CF_MODEL, ...CF_MODEL_FALLBACKS.filter(m => m !== CF_MODEL)];

  for (const model of modelsToTry) {
    try {
      const payload = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      };

      // For JSON-only output, use response_format
      if (options.json) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await fetch(CF_API_BASE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 410) {
        // Model deprecated — try next fallback model
        const errText = (await response.text()).slice(0, 200);
        console.warn(`[Cloudflare LLaMA] Model ${model} deprecated (410), trying fallback...`);
        continue;
      }

      if (!response.ok) {
        const errText = (await response.text()).slice(0, 200);
        console.warn(`[Cloudflare LLaMA] HTTP ${response.status}: ${errText}`);
        return null;
      }

      const data = await response.json();
      const content = data?.result?.response || data?.choices?.[0]?.message?.content;

      if (content && content.trim()) {
        return {
          success: true,
          text: content.trim(),
          source: `cloudflare-${model}`,
        };
      }

      console.warn(`[Cloudflare LLaMA] Empty response from model ${model}`);
    } catch (err) {
      console.warn(`[Cloudflare LLaMA] Lỗi gọi API với model ${model}:`, err.message);
    }
  }

  // All models exhausted
  console.warn('[Cloudflare LLaMA] Tất cả model đều thất bại, chuyển sang rule engine');
  return null;
}

/**
 * Rule-based chat enhancement — provides targeted responses for common questions.
 * Used as a post-processor when LLaMA response is too generic, or as a fallback
 * when the Cloudflare API key is not configured.
 */
const RULE_BASED_CHAT_KB = [
  {
    keywords: ['lá cờ', 'cờ việt', 'quốc kỳ', 'lá cờ việt'],
    reply: 'À, bạn muốn in lá cờ Việt Nam à! Đối với thiết kế lá cờ, tôi gợi ý dùng men đỏ thẫm (đỏ cờ) kết hợp men vàng hoàng yến (sao vàng) để tạo nét rực rỡ. Cốc hoặc bát mini là lựa chọn lý tưởng để trưng diễn lá cờ — nhỏ gọn, dễ thể hiện chi tiết sao chép. Bạn thử ngay Xưởng 3D để mockup trước khi nung nhé!',
    suggestions: ['Xưởng 3D ngay', 'Đặt lịch workshop', 'Xem mẫu cờ gốm'],
  },
  {
    keywords: ['lá cây', 'lá việt', 'cây việt'],
    reply: 'Lá cây Việt Nam đẹp lên nhất là sen (lá sen toon) hoặc lá đào. Với lá sen, tôi gợi ý men xanh đồng Vert de Biên Hòa mang lại màu xanh tươi mát mẻ. Với lá đào, men đỏ thẫm hoặc men đá đỏ bazan sẽ nổi bật đẹp. Để in lá cây, bạn nên chọn bát hoặc đĩa trang trí — diện tích rộng dễ khắc chìm chi tiết. Hãy thử Xưởng 3D để thiết kế trước nhé!',
    suggestions: ['Xưởng 3D ngay', 'Đặt lịch workshop', 'Xem mẫu lá sen'],
  },
  {
    keywords: ['hàng ngày', 'dùng hằng ngày', 'sử dụng thường xuyên', 'sử dụng nhiều', 'dùng nhiều'],
    reply: 'Để dùng hàng ngày, cốc/gyver là lựa chọn đắc nhất — nhẹ, tiện cầm, dễ rửa. Với cốc in hình, tôi gợi ý men trắng rạn (Men Rạn Trắng Cổ) hoặc men xanh lục dưa cải — màu sắc tươi sáng, dễ vệ sinh, không bám bẩn. Đặc biệt với họa tiết lá cờ, dùng kỹ thuật champaeve (khắc chìm) để sao chép sao vàng và đường viền đỏ chính xác. Cảnh báo: men đỏ thẫm cần nung khe thấp nhiệt độ (~1050°C) nên nên gắn với men vàng ở lớp trên cùng!',
    suggestions: ['Xưởng 3D thiết kế cốc', 'Đặt lịch workshop', 'Xem mẫu cốc men đỏ'],
  },
  {
    keywords: ['sản phẩm nào', 'nên chọn', 'khuyên chọn', 'đề xuất', 'gợi ý sản phẩm'],
    reply: 'Dựa trên nhu cầu của bạn, tôi đề xuất: nếu dùng hàng ngày → cốc (mug) ho ouc thích hợp nhất; để trang trí bàn thờ → đĩa (plate); để bán hàng → bát (bowl); để trưng diễn lâu dài → bình (vase). Đối với họa tiết lá cờ Việt Nam, cốc size 300ml là lựa chọn "vàng" — vừa tiện dùng, vừa đủ không gian khắc chìm chi tiết sao tròn.',
    suggestions: ['Xưởng 3D ngay', 'Đặt lịch workshop', 'So sánh mẫu sản phẩm'],
  },
];

/**
 * Check if LLaMA reply is generic (doesn't address the question).
 * Returns true if the reply lacks specific content relevant to the query.
 */
function isGenericReply(message, reply) {
  if (!reply) return true;
  const lower = message.toLowerCase();
  const replyLower = reply.toLowerCase();
  
  // If user asks about specific topics (lá cờ, sản phẩm, etc.),
  // check if the reply actually addresses them
  const topics = ['lá cờ', 'cờ việt', 'lá cây', 'sản phẩm', 'hàng ngày', 'nên chọn'];
  for (const topic of topics) {
    if (lower.includes(topic)) {
      // Check if reply mentions related keywords
      const related = topic === 'lá cờ' ? ['cờ', 'đỏ', 'vàng', 'sao'] :
                     topic === 'lá cây' ? ['lá', 'sen', 'đào', 'xanh', 'đỏ'] :
                     topic === 'sản phẩm' ? ['cốc', 'bát', 'đĩa', 'bình', 'mug', 'bowl', 'plate', 'vase'] :
                     topic === 'hàng ngày' ? ['hàng ngày', 'cốc', 'dùng'] :
                     topic === 'nên chọn' ? ['cốc', 'bát', 'đĩa', 'bình', 'đề xuất'] : ['sản phẩm'];
      const hasRelated = related.some(r => replyLower.includes(r));
      if (!hasRelated) return true; // Reply doesn't mention topic-related keywords → generic
    }
  }
  return false;
}

/**
 * Apply rule-based chat KB to the message. Returns matched response or null.
 */
function applyRuleBasedChat(message) {
  const lower = (message || '').toLowerCase();
  for (const entry of RULE_BASED_CHAT_KB) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return {
        reply: entry.reply,
        suggestions: entry.suggestions,
        source: 'ceramic-rule-engine',
      };
    }
  }
  return null;
}

/**
 * 0. AI Chat Advisor — trò chuyện tự nhiên với Cụ Thành
 * Trả về đối tượng { success, reply, suggestions, source } hoặc null nếu không có key.
 * Strategy:
 *   1. Nếu không có Cloudflare key → dùng rule-based trực tiếp
 *   2. Nếu có key → gọi LLaMA, kiểm tra độ generic, nếu generic → dùng rule-based nâng cấp
 *   3. Luôn đảm bảo trả lời có gợi ý hành động (suggestions)
 */
export async function chatWithAdvisor(message = '', history = []) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    // Rule-based-only mode (no Cloudflare key configured)
    const ruleRes = applyRuleBasedChat(message || '');
    if (ruleRes) {
      return { success: true, reply: ruleRes.reply, suggestions: ruleRes.suggestions, source: ruleRes.source };
    }
    return null;
  }

  const safeHistory = Array.isArray(history) ? history : [];

  // Build Cloudflare-format messages (system → history → current)
  const messages = [
    { role: 'system', content: CERAMIC_CHAT_SYSTEM_PROMPT },
  ];

  safeHistory.slice(-6).forEach((h) => {
    if (h && typeof h.text === 'string' && h.text.trim()) {
      messages.push({
        role: h.sender === 'user' ? 'user' : 'assistant',
        content: h.text.slice(0, 2000),
      });
    }
  });

  messages.push({ role: 'user', content: message.trim().slice(0, 2000) });

  const result = await callCloudflareLLaMA(messages, {
    temperature: 0.7,
    maxTokens: 512,
  });

  if (result && result.success) {
    let reply = result.text;
    let suggestions = [];

    // Post-process: check if LLaMA reply is too generic for the user's question
    const ruleRes = applyRuleBasedChat(message || '');
    if (isGenericReply(message || '', reply) && ruleRes) {
      // LLaMA gave a generic answer — use rule-based response for better relevance
      reply = ruleRes.reply;
      suggestions = ruleRes.suggestions;
      console.warn('[Cloudflare LLaMA] Reply too generic, using rule-engine enhancement');
    }

    // Always ensure we have suggestions
    if (!suggestions.length) {
      suggestions = ['Xưởng 3D', 'Đặt lịch Workshop', 'Xem Thư Viện Mẫu'];
    }

    return {
      success: true,
      reply,
      suggestions,
      source: result.source,
    };
  }

  // LLaMA failed — try rule-based as fallback
  const ruleRes = applyRuleBasedChat(message || '');
  if (ruleRes) {
    return { success: true, reply: ruleRes.reply, suggestions: ruleRes.suggestions, source: ruleRes.source };
  }

  return null;
}

/**
 * 1. Chuyển đổi Prompt tự nhiên thành bản vẽ 3D gốm sứ (JSON structured output)
 */
export async function promptTo3DConcept(userPrompt) {
  const promptText = (userPrompt || '').trim();

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return fallbackPromptToConcept(promptText);
  }

  const result = await callCloudflareLLaMA(
    [
      { role: 'system', content: CERAMIC_SYSTEM_PROMPT },
      { role: 'user', content: `Hãy thiết kế tác phẩm gốm theo yêu cầu sau: "${promptText}"` },
    ],
    { temperature: 0.4, maxTokens: 1024, json: true }
  );

  if (result && result.success) {
    const parsed = extractJSON(result.text);
    if (parsed) {
      return sanitizeConcept(parsed, promptText);
    }
    console.warn('[Cloudflare LLaMA] Parse concept JSON failed:', result.text?.slice(0, 200));
  }

  // Fallback to ceramic rule engine
  return fallbackPromptToConcept(promptText);
}

/**
 * 2. Phân tích ảnh chụp 2D → concept 3D (Cloudflare LLaMA vision)
 *
 * Lưu ý: Cloudflare Workers AI LLaMA 3.1 là text-only model.
 * Để phân tích ảnh, ta cần mô tả hình ảnh thành text trước khi gửi LLaMA.
 * Tuy nhiên Cloudflare cũng hỗ trợ một số vision models như @cf/meta/llama-3.2-11b-vision.
 *
 * Nếu CF_VISION_MODEL được cấu hình, dùng vision model trực tiếp.
 * Ngược lại, chuyển base64 → text description (simple heuristic) rồi gửi LLaMA.
 */
export async function imageTo3DConcept(imageBase64, userPrompt = '') {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !imageBase64) {
    return fallbackImageToConcept(userPrompt);
  }

  const CF_VISION_MODEL = process.env.CLOUDFLARE_VISION_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct';

  // Downscale oversized images (>2MB base64) to avoid Cloudflare Vision HTTP 400 (code 3030)
  let visionBase64 = imageBase64;
  if (imageBase64 && imageBase64.length > 2_800_000) {
    try {
      visionBase64 = await downscaleBase64(imageBase64, 1024);
      console.log('[Cloudflare Vision] Ảnh đã được nén từ', imageBase64.length, '→', visionBase64.length, 'bytes');
    } catch (resizeErr) {
      console.warn('[Cloudflare Vision] Không nén được ảnh, dùng size gốc:', resizeErr.message);
    }
  }

  // Build vision system prompt
  const visionSystemPrompt = `${CERAMIC_SYSTEM_PROMPT}
BẠN ĐANG PHÂN TÍCH ẢNH TIÊU BẢN GỐM THỰC TẾ.
LƯU Ý ĐẶC BIỆT VỀ GÓC CHỤP:
- Ảnh chụp sản phẩm thường được chụp góc xiên 30-45 độ nhìn thấy một phần lòng trong.
- Nếu là Bát (bowl) hoặc Đĩa (plate): Miệng bát LUÔN MỞ RỘNG LOE THOÁNG, không bao giờ bịt kín chóp đầu như củ hành.
- Hãy nhận diện chính xác: modelType, màu men chủ đạo, hoa văn nếu có.`;

  try {
    // Call Cloudflare vision model directly with image input
    const visionUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`;
    const response = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CF_VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: visionSystemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Phân tích tiêu bản gốm sứ này và chuyển đổi thành cấu trúc 3D chuẩn xác. Yêu cầu thêm: "${userPrompt || ''}"`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: visionBase64,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.2,
        // NOTE: response_format json_object NOT supported on vision model with image input → 400 code 3030
      }),
    });

    if (!response.ok) {
      const errText = (await response.text()).slice(0, 200);
      console.warn(`[Cloudflare Vision] HTTP ${response.status}: ${errText}`);
      return fallbackImageToConcept(userPrompt);
    }

    const data = await response.json();
    const content = data?.result?.response || data?.choices?.[0]?.message?.content;

    if (content && content.trim()) {
      const parsed = extractJSON(content);
      if (parsed) {
        return sanitizeConcept(parsed, userPrompt || 'Tiêu Bản Gốm');
      }
      console.warn('[Cloudflare Vision] Parse JSON failed, raw:', content.slice(0, 200));
    }

    console.warn('[Cloudflare Vision] Empty response');
    return fallbackImageToConcept(userPrompt);
  } catch (err) {
    console.warn('[Cloudflare Vision] Lỗi gọi vision API:', err.message);
    return fallbackImageToConcept(userPrompt);
  }
}

/**
 * Đảm bảo dữ liệu concept trả về luôn tuân thủ chuẩn của Three.js Studio
 */
function sanitizeConcept(raw, defaultTitle = 'Tác Phẩm Gốm') {
  const validModels = ['bowl', 'mug', 'plate', 'vase', 'vase-narrow-neck'];
  // Accept both new "archetype" and legacy "modelType" for backward compatibility
  const rawModel = raw.archetype || raw.modelType;
  const modelType = validModels.includes(rawModel) ? rawModel : 'vase';

  const validPatterns = ['sen_co', 'dong_son', 'ca_chep', 'cham_bi', 'hoa_dao', 'none'];
  const pattern = validPatterns.includes(raw.pattern) ? raw.pattern : 'none';

  // Collect parametric shape params (new schema) — pass through for FE lathePoints generation
  const shapeParams = (raw.shapeParams && typeof raw.shapeParams === 'object') ? raw.shapeParams : null;

  return {
    success: true,
    engine: CF_MODEL ? `cloudflare-${CF_MODEL}` : 'ceramic-intelligence-fallback',
    title: raw.title || defaultTitle || 'Tiêu Bản Gốm Sứ',
    modelType,
    archetype: modelType, // alias for FE compatibility
    dimensions: raw.dimensions || 'Cao 20cm × ĐK bụng 13cm',
    shapeParams,
    suggestedGlaze: {
      hex: raw.suggestedGlaze?.hex || '#2A6B5C',
      name: raw.suggestedGlaze?.name || 'Men Xanh Đồng Trổ',
      roughness: Number(raw.suggestedGlaze?.roughness || 0.15)
    },
    pattern,
    customText: raw.customText || '',
    story: raw.story || 'Tác phẩm được định hình theo tinh hoa mỹ nghệ gốm Biên Hòa 1903.',
    lathePoints: Array.isArray(raw.lathePoints) && raw.lathePoints.length >= 8 ? raw.lathePoints : null
  };
}

/**
 * Bộ tạo mẫu dự phòng (rule engine) khi chưa cấu hình AI API key
 */
function fallbackPromptToConcept(text) {
  const lower = (text || '').toLowerCase();
  let modelType = 'vase';
  let title = 'Bình Gốm Nghệ Thuật Dáng Khí';
  let dimensions = 'Cao 22cm × Đường kính bụng 13cm';
  let glaze = { hex: '#2A6B5C', name: 'Men Xanh Đồng Trổ', roughness: 0.15 };
  let pattern = 'none';

  // Parametric defaults per archetype
  let shapeParams = { height: 22.0, maxRadius: 11.5, neckRatio: 0.35, rimFlare: 0.65, baseRadius: 0.45, curvature: 'bulbous' };

  // Detect adjective modifiers for slenderness/thickness
  const isSlender = lower.includes('dài') || lower.includes('thẳng') || lower.includes('sặc sỡ') || lower.includes('cao');
  const isChubby = lower.includes('béo') || lower.includes('tròn') || lower.includes('bụng') || lower.includes('ngắn');
  const isFlared = lower.includes('lệch') || lower.includes('hở') || lower.includes('mở') || lower.includes('loe');

  if (lower.includes('bát') || lower.includes('chén') || lower.includes('bowl')) {
    modelType = 'bowl';
    title = 'Bát Thiền Men Gốm Mộc';
    dimensions = 'Đường kính 14cm × Cao 7.5cm';
    glaze = { hex: '#1B3252', name: 'Men Lam Chàm Cổ', roughness: 0.18 };
    shapeParams = { height: 7.5, maxRadius: 7.0, neckRatio: 0.0, rimFlare: 1.0, baseRadius: 0.8, curvature: isChubby ? 'bulbous' : 'flare' };
  } else if (lower.includes('cốc') || lower.includes('ly') || lower.includes('mug')) {
    modelType = 'mug';
    title = 'Cốc Bầu Men Mộc Quai Cầm';
    dimensions = 'Cao 9.5cm × ĐK miệng 8.5cm';
    glaze = { hex: '#EDE8DC', name: 'Men Rạn Trắng Cổ', roughness: 0.20 };
    shapeParams = { height: 9.5, maxRadius: 4.2, neckRatio: 0.3, rimFlare: 0.8, baseRadius: 0.4, curvature: isChubby ? 'bulbous' : 'slender' };
  } else if (lower.includes('đĩa') || lower.includes('dĩa') || lower.includes('plate')) {
    modelType = 'plate';
    title = 'Đĩa Gốm Chạm Khắc Mỹ Nghệ';
    dimensions = 'Đường kính 22cm × Cao 3cm';
    glaze = { hex: '#73A992', name: 'Men Ngọc Celadon', roughness: 0.12 };
    shapeParams = { height: 3.0, maxRadius: 11.0, neckRatio: 0.0, rimFlare: 1.2, baseRadius: 0.3, curvature: 'flare' };
  } else if (lower.includes('cổ nhỏ') || lower.includes('cổ thon') || lower.includes('bottle')) {
    modelType = 'vase-narrow-neck';
    title = 'Bình Gốm Cổ Thon Miệng Loe';
    dimensions = 'Cao 25cm × Thân rộng 12cm';
    glaze = { hex: '#8B5A2B', name: 'Men Nâu Mộc Lò Rồng', roughness: 0.22 };
    shapeParams = { height: 25.0, maxRadius: 11.5, neckRatio: 0.25, rimFlare: 1.1, baseRadius: 0.5, curvature: isSlender ? 'slender' : 'bulbous' };
  }

  // Adjust curvature for vase based on adjectives
  if (modelType === 'vase') {
    if (isSlender) shapeParams.curvature = 'slender';
    else if (isFlared) shapeParams.curvature = 'flared';
    else if (isChubby) shapeParams.curvature = 'bulbous';
  }

  if (lower.includes('sen')) pattern = 'sen_co';
  else if (lower.includes('cúc')) pattern = 'dong_son';
  else if (lower.includes('cá') || lower.includes('ngư')) pattern = 'ca_chep';
  else if (lower.includes('chấm') || lower.includes('khảm')) pattern = 'cham_bi';
  else if (lower.includes('đào')) pattern = 'hoa_dao';

  return {
    success: true,
    engine: 'ceramic-intelligence-fallback',
    title,
    modelType,
    archetype: modelType,
    dimensions,
    shapeParams,
    suggestedGlaze: glaze,
    pattern,
    customText: '',
    story: 'Khơi nguồn từ truyền thống chế tác gốm đất trầm tích ven sông Đồng Nai.',
    lathePoints: null
  };
}

function fallbackImageToConcept(prompt = '') {
  const inferredModel = inferModelFromPrompt(prompt);
  const defaultShapeParams = {
    vase: { height: 22.0, maxRadius: 11.5, neckRatio: 0.35, rimFlare: 0.65, baseRadius: 0.45, curvature: 'bulbous' },
    bowl: { height: 7.5, maxRadius: 7.0, neckRatio: 0.0, rimFlare: 1.0, baseRadius: 0.8, curvature: 'bulbous' },
    plate: { height: 3.0, maxRadius: 11.0, neckRatio: 0.0, rimFlare: 1.2, baseRadius: 0.3, curvature: 'flare' },
    mug: { height: 9.5, maxRadius: 4.2, neckRatio: 0.3, rimFlare: 0.8, baseRadius: 0.4, curvature: 'slender' },
    'vase-narrow-neck': { height: 25.0, maxRadius: 11.5, neckRatio: 0.25, rimFlare: 1.1, baseRadius: 0.5, curvature: 'slender' },
  };
  return {
    success: true,
    engine: 'ceramic-intelligence-fallback',
    title: prompt || 'Tiêu Bản Gốm Nghệ Thuật',
    modelType: inferredModel,
    archetype: inferredModel,
    dimensions: 'Đường kính 14cm × Cao 8cm',
    shapeParams: defaultShapeParams[inferredModel] || defaultShapeParams.bowl,
    suggestedGlaze: { hex: '#1B3252', name: 'Men Lam Chàm Đồng Nai', roughness: 0.16 },
    pattern: 'none',
    customText: '',
    story: 'Tác phẩm được trích xuất từ tiêu bản ảnh chụp thực tế.',
    lathePoints: null
  };
}

/**
 * Infer pottery model type from image analysis prompt text
 */
function inferModelFromPrompt(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('bát') || t.includes('bowl') || t.includes('chén') || t.includes('thiền')) return 'bowl';
  if (t.includes('cốc') || t.includes('mug') || t.includes('ly')) return 'mug';
  if (t.includes('đĩa') || t.includes('dĩa') || t.includes('plate')) return 'plate';
  if (t.includes('cổ thon') || t.includes('cổ nhỏ') || t.includes('bottle') || t.includes('bình') || t.includes('vase')) return 'vase-narrow-neck';
  return 'vase';
}

/**
 * Nén/giảm kích thước ảnh base64 để tránh lỗi Cloudflare Vision HTTP 400 (code 3030 / Internal Server Error).
 * Dùng sharp để resize về ≤ maxSize px và chuyển đổi JPEG.
 */
async function downscaleBase64(dataUrl, maxSize = 1024) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
  if (!matches) return dataUrl;
  const [, mime, base64] = matches;
  const buf = Buffer.from(base64, 'base64');
  const resized = await sharp(buf)
    .resize({ width: maxSize, height: maxSize, fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${resized.toString('base64')}`;
}

/**
 * Trả về trạng thái cấu hình AI backend hiện tại
 */
export function getAiBackendStatus() {
  if (CF_ACCOUNT_ID && CF_API_TOKEN) {
    return {
      provider: 'cloudflare',
      model: CF_MODEL,
      configured: true,
    };
  }
  return {
    provider: 'ceramic-intelligence-fallback',
    model: 'rule-engine',
    configured: false,
  };
}
