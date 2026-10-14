import dotenv from 'dotenv';
try { dotenv.config(); } catch (_) {}

/**
 * aiService.js — AI backend adapter (strategy selector)
 *
 * Chọn backend AI phù hợp dựa trên env vars có sẵn:
 *   1. CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN → Cloudflare Workers AI (LLaMA)
 *   2. Rỗng → Curated Ceramic Intelligence (built-in rule engine)
 *
 * External LLM backends have been removed from the pipeline — only Cloudflare + rule engine.
 *
 * Xuất cùng interface: chatWithAdvisor, promptTo3DConcept, imageTo3DConcept
 * để server.js không cần thay đổi logic.
 */

// Import Cloudflare LLaMA backend
import * as cloudflare from './cloudflareService.js';

// Detect which backends are configured
const hasCloudflare =
  process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN;

/**
 * 0. Chat Advisor — Cloudflare LLaMA → rule engine fallback
 */
export async function chatWithAdvisor(message = '', history = []) {
  // 1. Try Cloudflare LLaMA first
  if (hasCloudflare) {
    const reply = await cloudflare.chatWithAdvisor(message, history);
    if (reply && reply.success) return reply;
  }

  // 2. Built-in Ceramic Knowledge Engine (rule-based fallback)
  return ceramicKnowledgeFallback(message);
}

/**
 * 1. Prompt → 3D Concept — Cloudflare LLaMA → rule engine fallback
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

  // Cloudflare service already includes the rule-engine fallback when no keys
  return cloudflare.promptTo3DConcept(userPrompt);
}

/**
 * 2. Image → 3D Concept (vision) — Cloudflare LLaMA Vision → rule engine fallback
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
 * 3. Built-in rule engine fallback for chat (mirrors server.js logic)
 * Used when no AI API keys are configured.
 */
function ceramicKnowledgeFallback(message = '') {
  const userMsg = message.trim().toLowerCase();

  const replies = {
    greeting: {
      reply: `Kính chào bạn! Tôi là Cụ Thành — Nghệ nhân làng gốm Tân Vạn, Biên Hòa. Rất vui được đồng hành cùng bạn trên hành trình tạo tác tác phẩm gốm mang dấu ấn riêng. Bạn đang ấp ủ làm một chiếc cốc khắc chìm, bình hoa chạm lộng hay muốn ghé thăm workshop nặn gốm tại Tân Vạn bên bờ sông Đồng Nai?`,
      suggestions: ['Tư vấn men xanh đồng Vert de Biên Hòa', 'Kỹ thuật khắc chìm champlevé', 'Đặt lịch tham gia workshop'],
    },
    glaze: {
      reply: `Trong nghệ thuật gốm Biên Hòa, màu men là kiệt tác danh tiếng thế giới!
• **Men Xanh Đồng Trổ (Vert de Biên Hòa):** Màu men trứ danh đạt Huy chương Vàng Paris 1925, pha từ oxit đồng, tro rơm nếp và quặng đá ong, nung lò rồng ở 1220°C tỏa sắc xanh ngọc ánh đồng lộng lẫy.
• **Men Đá Đỏ Bazan:** Nâu đỏ trầm ấm phong phó bìa từ đá ong Bửu Long và đất đỏ Đông Nam Bộ.
• **Men Vàng Hoàng Yến & Xanh Lục Dưa Cải:** Các sắc men màu khảm đa sắc độc nhất vô nhị.
Bạn có thể vào tab **'Xưởng 3D'** bên tay trái để thử nghiệm trực tiếp các sắc men này lên mô hình 360 độ nhé!`,
      suggestions: ['Thử phối màu trong Xưởng 3D', 'Họa tiết hoa cúc dây đôn voi', 'Đặc trưng đất sét Tân Vạn'],
    },
    flagLeaf: {
      reply: `À, bạn muốn in hình lá cờ Việt Nam à! Đây là thiết kế rất ý nghĩa. Để biểu trưng lá cờ (màu đỏ + sao vàng) lên gốm, tôi gợi ý:
• **Men đỏ thẫm (bazan):** Làm nền đỏ tươi như nền cờ. Cần nung ở lớp dưới (1200°C) để men cứng bám.
• **Men vàng hoàng yến:** Dùng kỹ thuật champaeve (khắc chìm) để tạo sao vàng nổi bật trên nền đỏ.
• **Sản phẩm đề xuất:** Cốc (mug) size 300ml hoặc bát nhỏ — diện tích miệng rộng phù hợp để khắc chi tiết sao chép. Cốc cũng tiện dùng hàng ngày!
• **Lưu ý:** Lá cờ không phải lá cây thường (sen, đào) — thiết kế cần đường viền sao tròn và màu đỏ chủ đạo.`,
      suggestions: ['Xưởng 3D thiết kế cốc lá cờ', 'Đặt lịch workshop khắc chìm', 'Xem mẫu cốc men đỏ + vàng'],
    },
    plantLeaf: {
      reply: `Lá cây Việt Nam (sen, đào, mai...) rất đẹp khi khắc lên gốm. Với lá sen, tôi gợi ý men xanh đồng Vert de Biên Hòa — màu xanh tươi mát mẻ như lá. Với lá đào, men đỏ thẫm hoặc men đá đỏ bazan sẽ nổi bật. Bát hoặc đĩa trang trí là lựa chọn lý tưởng vì diện tích rộng dễ khắc chi tiết lá. Bạn thử Xưởng 3D để mockup trước khi nung nhé!`,
      suggestions: ['Xưởng 3D ngay', 'Đặt lịch workshop', 'Xem mẫu lá sen'],
    },
    productRec: {
      reply: `Dựa trên nhu cầu của bạn, tôi đề xuất: nếu dùng hàng ngày → **cốc (mug)** — nhẹ, tiện cầm, dễ vệ sinh; để trang trí bàn thờ → **đĩa (plate)**; để bán hàng → **bát (bowl)**; để trưng diễn lâu dài → **bình (vase)**. Đối với họa tiết lá cờ Việt Nam, **cốc 300ml** là lựa chọn "vàng" — vừa tiện dùng, vừa đủ không gian khắc chìm chi tiết sao chép tròn vòng.`,
      suggestions: ['Xưởng 3D thiết kế cốc', 'Đặt lịch workshop', 'So sánh mẫu sản phẩm'],
    },
    workshop: {
      reply: `Trải nghiệm Workshop tại Tân Vạn (Biên Hòa, Đồng Nai) là cách tuyệt vời nhất để chạm vào linh hồn gốm đất phương Nam!
Khi bạn thiết kế trước sản phẩm trên **Xưởng 3D** của chúng tôi, xưởng sẽ chuẩn bị sẵn phôi đất sét xám Tân Vạn, bộ dao trổ và men màu đúng theo ý bạn. Đến nơi, bạn sẽ được nghệ nhân kèm 1-on-1 để vuốt phôi, khắc chìm hoa văn và chấm men màu. Sau đó xưởng sẽ nung lò rồng củi và gửi thành phẩm đóng hộp về tận nhà bạn!`,
      suggestions: ['Xem các ca workshop có sẵn', 'Thời gian nung lò rồng mất bao lâu?', 'Chi phí workshop một buổi'],
    },
    firing: {
      reply: `Câu hỏi rất nhà nghề! Gốm Biên Hòa là sự kết hợp giữa bàn tay tạo hình và ngọn lửa lò rồng (lò bầu dốc thoải dài theo triền sông). Đất sét xám Tân Vạn sau khi vuốt và khắc chìm sẽ co ngót khoảng 9% đến 11% khi nung lò rồng ở nhiệt độ 1200°C - 1220°C.
Vì vậy, khi tạo hình, nghệ nhân luôn khuyên bạn giữ độ dày thành sản phẩm từ 5-7mm để các nét khắc chìm không làm mỏng vách gốm gây nứt vỡ.`,
      suggestions: ['Kiểm tra độ khả thi ý tưởng', 'Vào Xưởng 3D để tạo mẫu', 'Kỹ thuật khắc chìm champlevé'],
    },
    price: {
      reply: `Về chi phí, mô hình xưởng gốm Biên Hòa có 2 gói dịch vụ rất minh bạch:
1. **Nghệ nhân Biên Hòa chế tác & Giao tận nhà:** Từ 180.000đ - 350.000đ/sản phẩm (tùy phôi cốc, bình hoa hay đĩa và độ phức tạp của hoa văn khắc chìm).
2. **Đặt lịch Workshop tự tay làm:** 250.000đ/người (bao gồm trọn gói đất sét Tân Vạn, dao trổ khắc, màu men Vert de Biên Hòa, nghệ nhân kèm riêng và phí nung lò rồng củi).`,
      suggestions: ['Thiết kế mẫu ngay', 'Xem giỏ hàng', 'Tư vấn ý tưởng độc lạ'],
    },
    default: {
      reply: `Ý tưởng của bạn rất tuyệt vời! Để hiện thực hóa tốt nhất, bạn có thể nhập mô tả vào mục **'AI Tư vấn'** ở thanh menu trái để hệ thống phác họa 6 mặt vector, sau đó đưa thẳng vào **'Xưởng 3D'** để thử màu men Vert de Biên Hòa và hoa văn khắc chìm nhé. Nếu cần mẹo gì về kỹ thuật nặn đất hay phối men màu, cứ hỏi tôi bất kỳ lúc nào!`,
      suggestions: ['Mở AI Tư vấn 6 mặt', 'Vào Xưởng 3D', 'Xem thư viện mẫu gốm'],
    },
  };

  let chosen;
  if (userMsg.includes('lá cờ') || userMsg.includes('cờ việt') || userMsg.includes('quốc kỳ')) {
    chosen = replies.flagLeaf;
  } else if (userMsg.includes('lá cây') || userMsg.includes('lá sen') || userMsg.includes('lá đào') || userMsg.includes('lá việt')) {
    chosen = replies.plantLeaf;
  } else if (userMsg.includes('chọn sản phẩm') || userMsg.includes('nên chọn') || userMsg.includes('sản phẩm nào') || userMsg.includes('đề xuất') || userMsg.includes('hàng ngày') || userMsg.includes('dùng thường xuyên')) {
    chosen = replies.productRec;
  } else if (userMsg.includes('chào') || userMsg.includes('hello') || userMsg.includes('hi')) {
    chosen = replies.greeting;
  } else if (userMsg.includes('men') || userMsg.includes('màu') || userMsg.includes('đồng') || userMsg.includes('đá đỏ') || userMsg.includes('vert')) {
    chosen = replies.glaze;
  } else if (userMsg.includes('workshop') || userMsg.includes('học') || userMsg.includes('trải nghiệm') || userMsg.includes('đến làng') || userMsg.includes('tân vạn')) {
    chosen = replies.workshop;
  } else if (userMsg.includes('nung') || userMsg.includes('nhiệt độ') || userMsg.includes('co ngót') || userMsg.includes('vỡ') || userMsg.includes('lò rồng')) {
    chosen = replies.firing;
  } else if (userMsg.includes('giá') || userMsg.includes('chi phí') || userMsg.includes('tiền') || userMsg.includes('đắt')) {
    chosen = replies.price;
  } else {
    chosen = replies.default;
  }

  return {
    success: true,
    reply: chosen.reply,
    suggestions: chosen.suggestions,
    source: 'ceramic-knowledge-engine',
  };
}

/**
 * Trả về trạng thái cấu hình — dùng cho health check
 */
export function getAiBackendStatus() {
  if (hasCloudflare) {
    return cloudflare.getAiBackendStatus();
  }
  return { provider: 'ceramic-intelligence-fallback', model: 'rule-engine', configured: false };
}
