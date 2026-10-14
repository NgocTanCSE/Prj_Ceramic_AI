/**
 * FE/api/ai/chat.js — Vercel Serverless Function for Ceramic AI Advisor
 * Integrates real DeepSeek API (https://api.deepseek.com) with tool extraction,
 * multi-turn context tracking, and structured ceramic design specifications.
 */

const SYSTEM_PROMPT = `Bạn là Trợ lý AI Chuyên viên Gốm Biên Hòa - Tân Vạn (Đồng Nai), một cố vấn nghệ nhân ảo đồng hành cùng khách hàng.
Bạn am hiểu sâu sắc về:
- Lịch sử gốm Biên Hòa - Tân Vạn, trường phái Bá Nghệ Biên Hòa 1903, giải thưởng Triển lãm Quốc tế Paris 1925.
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
9. ĐỊNH DẠNG PHẢN HỒI BẮT BUỘC:
Bạn PHẢI trả về duy nhất một đối tượng JSON hợp lệ (không kèm văn bản thừa bên ngoài khối JSON) theo cấu trúc:
{
  "reply": "Nội dung câu trả lời bằng tiếng Việt (có thể dùng markdown ngắn gọn)",
  "suggestions": ["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"],
  "spec": {
    "ready": true, // Chỉ true khi khách đã có ý tưởng thiết kế tương đối rõ ràng
    "archetype": "vase", // "vase" | "mug" | "bowl" | "plate"
    "archetypeName": "Bình hoa",
    "heightCm": 25,
    "diameterCm": 12,
    "glazeName": "Men Xanh Đồng Trổ (Vert de Biên Hòa)",
    "glazeHex": "#2A6B5C",
    "pattern": "cuc_day", // "cuc_day" | "sen_co" | "dong_son" | "none"
    "customText": ""
  },
  "booking": {
    "ready": false, // True khi khách muốn đặt lịch hoặc hỏi ca trống
    "type": "workshop", // "workshop" | "visit"
    "partySize": 2,
    "preferredDate": "",
    "timeSlot": ""
  }
}`;

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed',
      message: 'Chỉ chấp nhận phương thức POST',
    });
  }

  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const startTime = Date.now();

  try {
    const { message = '', history = [] } = req.body || {};
    const query = (typeof message === 'string' ? message : '').trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_MESSAGE',
        message: 'Vui lòng cung cấp nội dung câu hỏi.',
        requestId,
      });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    // Check if key is configured
    if (!apiKey || apiKey.trim() === '') {
      return res.status(503).json({
        success: false,
        provider: 'deepseek',
        model,
        requestId,
        error: 'MISSING_API_KEY',
        reply: 'Hệ thống AI chưa được kết nối với DeepSeek API Key. Quản trị viên vui lòng thiết lập biến môi trường DEEPSEEK_API_KEY trên Vercel để kích hoạt trợ lý đàm thoại thực tế.',
        suggestions: [
          'Tôi muốn tạo một chiếc bình hoa 30cm',
          'Tư vấn men xanh đồng Vert de Biên Hòa',
          'Tìm hiểu lịch mở xưởng gốm Tân Vạn',
        ],
      });
    }

    // Build multi-turn messages array
    const formattedMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Filter and sanitize incoming history (last 12 turns max to prevent prompt explosion)
    if (Array.isArray(history)) {
      const sanitizedHistory = history
        .slice(-12)
        .map((h) => {
          if (!h) return null;
          const role = h.role === 'user' || h.sender === 'user' ? 'user' : 'assistant';
          const content = (h.content || h.text || '').toString().trim();
          if (!content) return null;
          return { role, content };
        })
        .filter(Boolean);

      formattedMessages.push(...sanitizedHistory);
    }

    // Add current user turn
    formattedMessages.push({ role: 'user', content: query });

    // Call DeepSeek API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const dsResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model,
        messages: formattedMessages,
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!dsResponse.ok) {
      const errText = await dsResponse.text().catch(() => '');
      console.error(`[DeepSeek API Error] HTTP ${dsResponse.status}:`, errText);

      let userMsg = 'Hiện tại dịch vụ AI DeepSeek đang bận hoặc gặp sự cố phản hồi. Vui lòng thử lại sau giây lát.';
      if (dsResponse.status === 401) {
        userMsg = 'Khóa DeepSeek API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra cấu hình DEEPSEEK_API_KEY trên Vercel.';
      } else if (dsResponse.status === 402) {
        userMsg = 'Tài khoản DeepSeek API đã hết hạn mức (quota/credit). Vui lòng nạp thêm credit để tiếp tục sử dụng.';
      } else if (dsResponse.status === 429) {
        userMsg = 'Hệ thống đang tiếp nhận quá nhiều yêu cầu cùng lúc (Rate limit). Vui lòng đợi vài giây và bấm thử lại.';
      }

      return res.status(dsResponse.status >= 500 ? 502 : dsResponse.status).json({
        success: false,
        provider: 'deepseek',
        model,
        requestId,
        error: `UPSTREAM_${dsResponse.status}`,
        reply: userMsg,
        suggestions: ['Thử gửi lại', 'Mở Xưởng 3D', 'Xem danh mục gốm'],
      });
    }

    const data = await dsResponse.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parse structured JSON response from DeepSeek
    let parsed = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      // If wrapped in markdown ```json ... ```
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch (e2) {}
      }
    }

    const durationMs = Date.now() - startTime;

    if (parsed && typeof parsed.reply === 'string') {
      return res.status(200).json({
        success: true,
        provider: 'deepseek',
        model: data.model || model,
        requestId,
        durationMs,
        reply: parsed.reply,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        spec: parsed.spec && parsed.spec.ready ? parsed.spec : null,
        specReady: Boolean(parsed.spec && parsed.spec.ready),
        booking: parsed.booking && parsed.booking.ready ? parsed.booking : null,
      });
    }

    // Fallback if model answered in plain text
    return res.status(200).json({
      success: true,
      provider: 'deepseek',
      model: data.model || model,
      requestId,
      durationMs,
      reply: rawContent || 'Tôi đã tiếp nhận ý tưởng của bạn. Bạn muốn tiếp tục tùy chỉnh dáng gốm hay mở trong xưởng 3D?',
      suggestions: ['Mở trong Xưởng 3D', 'Tư vấn men xanh đồng', 'Đặt lịch tham quan'],
      specReady: false,
    });

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error(`[Chat API Handler Error] ${requestId}:`, err.message);

    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      provider: 'deepseek',
      requestId,
      error: isTimeout ? 'TIMEOUT' : 'SERVER_EXCEPTION',
      reply: isTimeout
        ? 'Dịch vụ AI phản hồi chậm hơn dự kiến (quá 20 giây). Vui lòng thử lại.'
        : 'Có lỗi kỹ thuật trong quá trình xử lý yêu cầu hội thoại. Vui lòng bấm thử lại.',
      suggestions: ['Thử lại', 'Vào Xưởng 3D', 'Xem trang Đặt lịch'],
    });
  }
}
