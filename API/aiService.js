import dotenv from 'dotenv';
try { dotenv.config(); } catch (_) {}

/**
 * aiService.js — AI backend adapter (strategy selector)
 *
 * Chọn backend AI phù hợp:
 *   1. DEEPSEEK_API_KEY → DeepSeek Chat Completions (Primary)
 *   2. CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN → Cloudflare Workers AI (LLaMA)
 *   3. Rỗng → Thông báo trung thực chưa cấu hình API Key
 */

import * as cloudflare from './cloudflareService.js';

const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim() !== '');
const hasCloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

const DEEPSEEK_SYSTEM_PROMPT = `Bạn là Trợ lý AI Chuyên viên Gốm Biên Hòa - Tân Vạn (Đồng Nai), một cố vấn nghệ nhân ảo đồng hành cùng khách hàng.
Bạn am hiểu sâu sắc về:
- Lịch sử gốm Biên Hòa - Tân Vạn, trường phái Bá Nghệ Biên Hòa 1903, triển lãm Paris 1925.
- Các sắc men đặc trưng: Men Xanh Đồng Trổ (Vert de Biên Hòa, #2A6B5C), Men Đá Đỏ Bazan Bửu Long (#9E472A), Men Vàng Hoàng Yến (#C88A2E), Men Trắng Rạn Phù Sa (#DCD3C1).
- Các dòng sản phẩm chính: Bình hoa (vase), Cốc uống nước (mug), Bát trà thiền (bowl), Đĩa mỹ nghệ (plate).
- Kỹ thuật: Khắc chìm champlevé, chạm lộng, nung lò rồng củi ở nhiệt độ 1200°C - 1220°C, độ co ngót đất sét xám Tân Vạn từ 9% đến 11%, độ dày thành gốm tiêu chuẩn 5-7mm.
- Dịch vụ: Workshop tự tay làm gốm tại Tân Vạn và Đặt lịch tham quan ngắm mẫu tại showroom.

QUY TẮC PHỤC VỤ VÀ GIAO TIẾP:
1. Giao tiếp bằng tiếng Việt tự nhiên, ấm áp, nhã nhặn, tôn trọng khách hàng.
2. Trả lời TRỰC TIẾP và CHÍNH XÁC câu hỏi của khách hàng trước, sau đó mới đưa ra gợi ý tiếp theo phù hợp. Không lặp lại đoạn giới thiệu lịch sử nếu khách không hỏi.
3. Luôn nhận rõ mình là Trợ lý AI của Xưởng gốm, không giả vờ là con người bằng xương bằng thịt.
4. Ghi nhớ ngữ cảnh trò chuyện nhiều lượt (multi-turn). Nếu khách hàng thay đổi ý định (ví dụ: đang nói về bình hoa 30cm nhưng chuyển sang muốn làm bát thiền 18cm men nâu), hãy cập nhật theo yêu cầu mới nhất, bỏ các thông số cũ không còn phù hợp.
5. Khi khách hàng muốn đặt lịch:
   - Phân biệt rõ giữa: (A) "Workshop làm gốm trải nghiệm" (tự tay vuốt đất, có nghệ nhân hướng dẫn) và (B) "Đặt lịch tham quan xem mẫu" (ngắm sản phẩm, tư vấn không gian).
   - Hỏi các thông tin cần thiết: Ngày dự kiến, số lượng khách, ca sáng hay chiều. Nếu chưa có thông tin, hãy hỏi khéo léo và hướng dẫn khách mở trang Đặt lịch để xem các ca còn trống.
6. Khi khách hỏi về giá hoặc lịch trống:
   - Trả lời trung thực: nêu mức giá tham khảo (ví dụ: workshop trải nghiệm tham khảo khoảng 250.000đ/người, sản phẩm chế tác từ 180.000đ - 350.000đ tùy mẫu), nói rõ giá chính thức và slot trống sẽ được nhân viên xưởng xác nhận theo biểu mẫu thực tế.
7. Khi khách nhắc đến "lá cờ Việt Nam": hiểu đúng là quốc kỳ cờ đỏ sao vàng (dùng men đỏ thẫm/đá đỏ bazan làm nền và men vàng hoàng yến khắc sao vàng), không nhầm lẫn sang lá cây thông thường.
8. Khi khách chỉ hỏi kỹ thuật (như nhiệt độ nung, độ co ngót, cách bảo quản), hãy trả lời súc tích đúng trọng tâm, tôn trọng lệnh của khách, không ép mua hàng.
9. ĐỊNH DẠNG PHẢN HỒI BẮT BUỘC (JSON DUY NHẤT):
{
  "reply": "Nội dung câu trả lời bằng tiếng Việt",
  "suggestions": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"],
  "spec": {
    "ready": true,
    "archetype": "vase",
    "archetypeName": "Bình hoa",
    "heightCm": 25,
    "diameterCm": 12,
    "glazeName": "Men Xanh Đồng Trổ (Vert de Biên Hòa)",
    "glazeHex": "#2A6B5C",
    "pattern": "cuc_day",
    "customText": ""
  },
  "booking": {
    "ready": false,
    "type": "workshop",
    "partySize": 2,
    "preferredDate": "",
    "timeSlot": ""
  }
}`;

/**
 * Gọi DeepSeek Chat API
 */
async function callDeepSeekChat(message, history = []) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const formattedMessages = [
    { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
  ];

  if (Array.isArray(history)) {
    const sanitized = history
      .slice(-12)
      .map((h) => {
        if (!h) return null;
        const role = h.role === 'user' || h.sender === 'user' ? 'user' : 'assistant';
        const content = (h.content || h.text || '').toString().trim();
        return content ? { role, content } : null;
      })
      .filter(Boolean);
    formattedMessages.push(...sanitized);
  }

  formattedMessages.push({ role: 'user', content: message });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: model,
      messages: formattedMessages,
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek API error HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content || '';

  let parsed = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (_) {
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try { parsed = JSON.parse(jsonMatch[1]); } catch (e2) {}
    }
  }

  if (parsed && typeof parsed.reply === 'string') {
    return {
      success: true,
      provider: 'deepseek',
      model: data.model || model,
      reply: parsed.reply,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      spec: parsed.spec && parsed.spec.ready ? parsed.spec : null,
      specReady: Boolean(parsed.spec && parsed.spec.ready),
      booking: parsed.booking && parsed.booking.ready ? parsed.booking : null,
    };
  }

  return {
    success: true,
    provider: 'deepseek',
    model: data.model || model,
    reply: rawContent || 'Tôi đã ghi nhận ý kiến của bạn.',
    suggestions: ['Mở trong Xưởng 3D', 'Tư vấn men xanh đồng', 'Xem lịch workshop'],
    specReady: false,
  };
}

/**
 * 0. Chat Advisor — DeepSeek (Primary) → Cloudflare LLaMA → Honest status
 */
export async function chatWithAdvisor(message = '', history = []) {
  if (hasDeepSeek) {
    try {
      return await callDeepSeekChat(message, history);
    } catch (err) {
      console.error('[AI Service] DeepSeek chat error:', err.message);
    }
  }

  if (hasCloudflare) {
    try {
      const reply = await cloudflare.chatWithAdvisor(message, history);
      if (reply && reply.success) return reply;
    } catch (err) {
      console.warn('[AI Service] Cloudflare chat error:', err.message);
    }
  }

  // Báo trung thực khi chưa có API Key
  return {
    success: false,
    provider: 'deepseek',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    error: 'MISSING_API_KEY',
    reply: 'Hệ thống AI chưa được kết nối với DeepSeek API Key. Quản trị viên vui lòng thiết lập biến môi trường DEEPSEEK_API_KEY để kích hoạt trợ lý đàm thoại thực tế.',
    suggestions: [
      'Tôi muốn tạo một chiếc bình hoa 30cm',
      'Tư vấn men xanh đồng Vert de Biên Hòa',
      'Tìm hiểu lịch mở xưởng gốm Tân Vạn',
    ],
  };
}

/**
 * 1. Prompt → 3D Concept
 */
export async function promptTo3DConcept(userPrompt) {
  if (hasCloudflare) {
    try {
      const concept = await cloudflare.promptTo3DConcept(userPrompt);
      if (concept && concept.success) return concept;
    } catch (err) {
      console.warn('[AI Adapter] Cloudflare promptTo3DConcept error:', err.message);
    }
  }
  return cloudflare.promptTo3DConcept(userPrompt);
}

/**
 * 2. Image → 3D Concept (vision)
 */
export async function imageTo3DConcept(imageBase64, userPrompt = '') {
  if (hasCloudflare) {
    try {
      const concept = await cloudflare.imageTo3DConcept(imageBase64, userPrompt);
      if (concept && concept.success) return concept;
    } catch (err) {
      console.warn('[AI Adapter] Cloudflare imageTo3DConcept error:', err.message);
    }
  }
  return cloudflare.imageTo3DConcept(imageBase64, userPrompt);
}

/**
 * Trạng thái cấu hình phục vụ health check
 */
export function getAiBackendStatus() {
  if (hasDeepSeek) {
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      configured: true,
    };
  }
  if (hasCloudflare) {
    return cloudflare.getAiBackendStatus();
  }
  return {
    provider: 'deepseek',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    configured: false,
  };
}
