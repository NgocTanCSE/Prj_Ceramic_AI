/**
 * ceramicChatAdvisor.js — Multi-turn Contextual Ceramic AI Engine
 * Cố vấn nghệ nhân Cụ Thành (Làng gốm Biên Hòa - Tân Vạn, Đồng Nai)
 *
 * Tracks conversation state, product specifications (archetype, dimensions,
 * glaze, motifs, and firing parameters) and responds intelligently without
 * repetition or echoing.
 */

export class CeramicAdvisorEngine {
  constructor() {
    this.context = {
      archetype: null,      // 'vase' | 'mug' | 'bowl' | 'plate' | 'don_voi'
      archetypeName: null,  // 'Bình hoa', 'Cốc uống nước', 'Bát trà thiền', v.v.
      height: null,         // '25 cm'
      diameter: null,       // '12 cm'
      glaze: null,          // 'Men xanh đồng Vert de Biên Hòa'
      glazeHex: null,       // '#2A6B5C'
      neckStyle: null,      // 'cổ thon' | 'miệng loe' | 'dáng trụ'
      motif: null,          // 'Hoa cúc dây', 'Hoa sen', 'Champlevé', v.v.
      lastTopic: null,      // 'dimension' | 'glaze' | 'shape' | 'motif' | 'general'
      turnCount: 0,
    };
  }

  reset() {
    this.context = {
      archetype: null,
      archetypeName: null,
      height: null,
      diameter: null,
      glaze: null,
      glazeHex: null,
      neckStyle: null,
      motif: null,
      lastTopic: null,
      turnCount: 0,
    };
  }

  processMessage(userMessage) {
    const raw = (userMessage || '').trim();
    const lower = raw.toLowerCase();
    this.context.turnCount += 1;

    // 1. Phân tích loại sản phẩm (Archetype)
    if (lower.includes('bình') || lower.includes('lọ') || lower.includes('chum')) {
      this.context.archetype = 'vase';
      this.context.archetypeName = 'chiếc bình hoa mỹ nghệ';
    } else if (lower.includes('cốc') || lower.includes('ly') || lower.includes('tách') || lower.includes('mug')) {
      this.context.archetype = 'mug';
      this.context.archetypeName = 'chiếc cốc gốm';
    } else if (lower.includes('bát') || lower.includes('chén') || lower.includes('tô') || lower.includes('bowl')) {
      this.context.archetype = 'bowl';
      this.context.archetypeName = 'chiếc bát thiền';
    } else if (lower.includes('đĩa') || lower.includes('khay') || lower.includes('plate')) {
      this.context.archetype = 'plate';
      this.context.archetypeName = 'chiếc đĩa mỹ nghệ';
    } else if (lower.includes('đôn voi') || lower.includes('voi')) {
      this.context.archetype = 'don_voi';
      this.context.archetypeName = 'tác phẩm đôn voi Paris 1925';
    }

    // 2. Phân tích kích thước (Chiều cao / Đường kính)
    const heightMatch = lower.match(/(?:cao|chiều cao|khoảng)\s*(\d{1,3})\s*(cm|centimet|phân|mm)?/) ||
                        lower.match(/(\d{1,3})\s*(?:cm|centimet|phân)\s*(?:chiều cao|cao)?/);
    if (heightMatch) {
      const val = parseInt(heightMatch[1], 10);
      if (val > 0 && val < 200) {
        this.context.height = `${val} cm`;
        this.context.lastTopic = 'dimension';
      }
    } else {
      // Trường hợp trả lời chỉ có số ngắn, vd "25" hoặc "khoảng 20" khi đang hỏi kích thước
      const shortNumMatch = lower.match(/^(?:khoảng\s*)?(\d{1,3})(?:\s*cm)?$/);
      if (shortNumMatch && (this.context.archetype || this.context.lastTopic === 'dimension')) {
        const val = parseInt(shortNumMatch[1], 10);
        if (val >= 5 && val <= 100) {
          this.context.height = `${val} cm`;
          this.context.lastTopic = 'dimension';
        }
      }
    }

    // 3. Phân tích dáng cổ / thân
    if (lower.includes('cổ thon') || lower.includes('cổ nhỏ') || lower.includes('thon gọn')) {
      this.context.neckStyle = 'cổ thon thanh nhã';
    } else if (lower.includes('miệng loe') || lower.includes('loe') || lower.includes('miệng rộng')) {
      this.context.neckStyle = 'miệng loe đón tài lộc';
    } else if (lower.includes('dáng trụ') || lower.includes('thẳng') || lower.includes('vuông vức')) {
      this.context.neckStyle = 'dáng trụ vững chãi';
    }

    // 4. Phân tích men gốm
    if (lower.includes('xanh đồng') || lower.includes('vert de') || lower.includes('xanh ngọc') || lower.includes('xanh lam')) {
      this.context.glaze = 'Men xanh đồng trổ Vert de Biên Hòa';
      this.context.glazeHex = '#2A6B5C';
      this.context.lastTopic = 'glaze';
    } else if (lower.includes('đá đỏ') || lower.includes('bazan') || lower.includes('nâu đỏ') || lower.includes('màu đỏ')) {
      this.context.glaze = 'Men đá đỏ bazan Bửu Long';
      this.context.glazeHex = '#9E472A';
      this.context.lastTopic = 'glaze';
    } else if (lower.includes('hoàng yến') || lower.includes('vàng') || lower.includes('hổ phách')) {
      this.context.glaze = 'Men vàng hoàng yến pháp lam';
      this.context.glazeHex = '#C88A2E';
      this.context.lastTopic = 'glaze';
    } else if (lower.includes('trắng rạn') || lower.includes('men rạn') || lower.includes('màu trắng')) {
      this.context.glaze = 'Men trắng rạn cốt đất phù sa';
      this.context.glazeHex = '#DCD3C1';
      this.context.lastTopic = 'glaze';
    } else if (lower.includes('xanh lục') || lower.includes('dưa cải') || lower.includes('xanh lá')) {
      this.context.glaze = 'Men xanh lục dưa cải Cây Mai';
      this.context.glazeHex = '#3D5A45';
      this.context.lastTopic = 'glaze';
    }

    // 5. Phân tích hoa văn / chạm khắc
    if (lower.includes('sen') || lower.includes('hoa sen')) {
      this.context.motif = 'Hoa sen thanh khiết khắc chìm';
    } else if (lower.includes('cúc') || lower.includes('cúc dây') || lower.includes('hoa cúc')) {
      this.context.motif = 'Hoa cúc dây chạm lộng champlevé 1925';
    } else if (lower.includes('trống đồng') || lower.includes('đông sơn')) {
      this.context.motif = 'Họa tiết trống đồng Đông Sơn';
    } else if (lower.includes('cá chép') || lower.includes('ngư')) {
      this.context.motif = 'Cá chép vượt vũ môn';
    } else if (lower.includes('lá cờ') || lower.includes('cờ việt nam')) {
      this.context.motif = 'Lá cờ Tổ quốc với sao vàng khắc nổi';
    }

    // 6. Kiểm tra câu hỏi kiến thức chuyên môn
    const knowledgeResponse = this.checkKnowledgeQuestions(lower);
    if (knowledgeResponse) {
      return knowledgeResponse;
    }

    // 7. Sinh câu trả lời theo ngữ cảnh hội thoại hiện tại
    return this.generateContextualResponse(lower);
  }

  checkKnowledgeQuestions(lower) {
    if (lower.includes('đất sét') || lower.includes('tân vạn có gì') || lower.includes('nguyên liệu đất')) {
      return {
        reply: `Về đất sét Tân Vạn, đây là linh hồn của gốm Biên Hòa suốt 3 thế kỷ qua:\n• **Nguồn gốc:** Phù sa trầm tích cổ sâu dọc đôi bờ sông Đồng Nai, được thợ ủ qua mùa mưa rồi lọc qua 3 tầng bể lắng mịn.\n• **Đặc tính:** Độ dẻo cực cao, chịu lửa lò rồng lên tới 1.250°C mà không bị nứt vỡ.\n• **Độ co ngót:** Khi phơi khô và nung chín, đất co ngót khoảng 9–11%, do đó thợ xưởng luôn tính toán bù kích thước trước khi chuốt phôi!`,
        suggestions: ['Tư vấn phối men nung lò rồng', 'Kỹ thuật khắc chìm champlevé', 'Xem các mẫu bình hoa'],
      };
    }

    if (lower.includes('men xanh đồng') || lower.includes('vert de') || lower.includes('pha men')) {
      return {
        reply: `Dòng men **Vert de Biên Hòa** là niềm tự hào lớn nhất của gốm phương Nam từng đoạt Huy chương Vàng Paris 1925:\n• **Công thức bí truyền:** Pha từ gỉ đồng (oxit đồng), tro rơm nếp cấy đất phù sa và bột quặng đá ong Bửu Long nghiền mịn.\n• **Hỏa biến lò rồng:** Nung củi cao su liên tục ở 1.200°C – 1.220°C. Khí CO trong lò khử oxit đồng tạo nên màu xanh ngọc ánh đồng lấp lánh như ngọc bích cổ.`,
        suggestions: ['Thử men xanh đồng trong Xưởng 3D', 'Kỹ thuật khắc rãnh champlevé', 'Đặt lịch tham quan xưởng'],
      };
    }

    if (lower.includes('lò rồng') || lower.includes('nung bao lâu') || lower.includes('nhiệt độ')) {
      return {
        reply: `Lò rồng Tân Vạn là kỳ quan kỹ thuật dân gian Nam Bộ:\n• **Cấu trúc:** Lò hình vòm dài 50-60m uốn lượn thoai thoải như lưng rồng theo triền đồi hướng ra sông Đồng Nai, chia làm 36 bầu nung.\n• **Thời gian nung:** Mỗi mẻ kéo dài từ 36 đến 48 giờ liên tục, dùng hoàn toàn củi cao su già.\n• **Bí quyết thợ coi lò:** Không có nhiệt kế điện tử, nghệ nhân canh nhiệt bằng cách nhìn màu sắc ngọn lửa qua các lỗ dòm lò để tiếp củi đúng lúc!`,
        suggestions: ['Đặt lịch ngắm lò rồng Tân Vạn', 'Quy trình vuốt gốm thủ công', 'Tư vấn phôi mẫu'],
      };
    }

    if (lower.includes('champlevé') || lower.includes('khắc chìm') || lower.includes('chạm lộng')) {
      return {
        reply: `Kỹ thuật **khắc chìm chạm lộng (champlevé)** là dấu ấn độc quyền của Trường Mỹ nghệ Biên Hòa 1903:\n• Khi đất se lại đến độ "da bò", người thợ dùng mũi dao vạch rãnh sâu 0.8–1.2mm tạo viền hoa văn.\n• Rãnh này có tác dụng ngăn cách các mảng men màu khác nhau không bị lem chảy hòa vào nhau khi nung chảy ở 1.220°C.\n• Sau đó, thợ dùng cọ chấm từng khoang men màu như khảm tranh kính màu, tạo nên nét tinh tế không dòng gốm nào có được!`,
        suggestions: ['Thử vẽ tay cọ trên gốm 3D', 'Họa tiết hoa cúc dây đôn voi', 'Tạo mẫu bình hoa khắc chìm'],
      };
    }

    if (lower.includes('địa chỉ') || lower.includes('workshop') || lower.includes('ở đâu') || lower.includes('giờ mở cửa') || lower.includes('tham quan')) {
      return {
        reply: `Xưởng gốm Tân Vạn luôn hoan nghênh bạn ghé thăm:\n• **Địa chỉ:** Bờ kè sông Đồng Nai, phường Tân Vạn, thành phố Biên Hòa, tỉnh Đồng Nai.\n• **Thời gian mở cửa:** Thứ Bảy & Chủ Nhật hàng tuần (8:30 – 16:30).\n• **Trải nghiệm:** Tự tay ngồi bàn xoay vuốt phôi đất sét, được nghệ nhân 1-kèm-1 hướng dẫn vạch dao khắc champlevé và nhận sản phẩm tráng men sau mẻ nung!`,
        suggestions: ['Chuyển sang trang Đặt lịch', 'Khám phá video phóng sự xưởng', 'Tạo mẫu gốm trước khi đến'],
      };
    }

    return null;
  }

  generateContextualResponse(lower) {
    const { archetype, archetypeName, height, neckStyle, glaze, motif } = this.context;

    // KỊCH BẢN 1: Đã có đủ cả Dáng + Kích thước + Men -> Tổng kết đặc tả & đề xuất tạo 3D
    if (archetype && height && glaze) {
      let summary = `Tuyệt vời! Tôi đã ghi nhận bản thiết kế của bạn:\n`;
      summary += `• **Sản phẩm:** ${archetypeName || 'Gốm mỹ nghệ'}\n`;
      summary += `• **Chiều cao:** ${height}\n`;
      if (neckStyle) summary += `• **Kiểu dáng:** ${neckStyle}\n`;
      summary += `• **Màu men:** ${glaze}\n`;
      if (motif) summary += `• **Họa tiết:** ${motif}\n`;
      summary += `\nThành gốm tiêu chuẩn sẽ được giữ ở mức 5.5mm và tính bù độ co ngót 9.5% của đất Tân Vạn. Bạn có muốn chuyển các thông số này sang mục **"Phác thảo mẫu"** để AI dựng mô hình 3D trực giao, hoặc mở ngay trong **"Xưởng tạo hình 3D"** không?`;

      return {
        reply: summary,
        suggestions: [
          'Chuyển sang Phác thảo AI',
          'Mở trong Xưởng tạo hình 3D',
          'Đổi màu men khác',
        ],
        specReady: true,
        context: { ...this.context },
      };
    }

    // KỊCH BẢN 2: Người dùng vừa cho biết Kích thước, nhưng chưa chọn Men
    if (archetype && height && !glaze) {
      return {
        reply: `Dáng ${archetypeName || 'sản phẩm'} với chiều cao **${height}** là kích thước rất chuẩn mực theo tỷ lệ vàng của gốm Biên Hòa!\n\n${neckStyle ? `Kiểu dáng ${neckStyle} sẽ tạo điểm nhấn rất đẹp.` : 'Bạn thích dáng cổ thon quý phái hay miệng loe phong thủy?'}\n\nVề màu men nung lò rồng, bạn thích sắc **Men xanh đồng Vert de Biên Hòa** (xanh ngọc ánh đồng Paris 1925) hay **Men đá đỏ bazan** (trầm ấm mộc mạc)?`,
        suggestions: [
          'Men xanh đồng Vert de Biên Hòa',
          'Men đá đỏ bazan',
          'Men vàng hoàng yến',
        ],
      };
    }

    // KỊCH BẢN 3: Người dùng vừa cho biết Men, nhưng chưa có Kích thước
    if (archetype && !height && glaze) {
      return {
        reply: `Sắc **${glaze}** phủ lên ${archetypeName || 'tác phẩm'} sẽ cho hỏa biến bề mặt cực kỳ sang trọng khi ra lò rồng 1.220°C.\n\nBạn dự định làm ${archetypeName || 'sản phẩm'} cao khoảng bao nhiêu centimet? Chẳng hạn:\n• **Cỡ vừa (bàn trà/kệ sách):** 20 – 25 cm\n• **Cỡ đại (phòng khách/tiền sảnh):** 30 – 40 cm\n• **Cỡ mini để bàn:** 12 – 15 cm`,
        suggestions: [
          'Cao khoảng 25 cm',
          'Cao khoảng 30 cm',
          'Cao 18 cm nhỏ gọn',
        ],
      };
    }

    // KỊCH BẢN 4: Người dùng mới chỉ nói loại sản phẩm (ví dụ "Tôi muốn làm một chiếc bình hoa")
    if (archetype && !height && !glaze) {
      if (archetype === 'vase') {
        return {
          reply: `Tuyệt quá! Bình gốm Biên Hòa là dòng mỹ nghệ nức tiếng với những đường vuốt thân nở uyển chuyển.\n\nĐể bắt đầu, bạn muốn chiếc bình cao khoảng bao nhiêu? (Ví dụ: 20 cm, 25 cm hay 35 cm?) Và bạn thích dáng cổ thon thanh nhã hay miệng loe đón hoa?`,
          suggestions: [
            'Cao khoảng 25 cm, cổ thon',
            'Cao 30 cm, miệng loe',
            'Tư vấn men xanh đồng Biên Hòa',
          ],
        };
      } else if (archetype === 'mug') {
        return {
          reply: `Cốc gốm vuốt tay từ đất sét xám Tân Vạn cầm rất đầm tay và giữ nhiệt cực tốt!\n\nBạn muốn cốc cao khoảng 10 cm (dung tích 350ml dùng cà phê) hay cốc dáng cao 13 cm? Bạn thích men mộc đá đỏ hay phủ men xanh đồng?`,
          suggestions: [
            'Cao 10 cm, men xanh đồng',
            'Cao 11 cm, men đá đỏ',
            'Khắc chìm tên kỷ niệm',
          ],
        };
      } else if (archetype === 'bowl') {
        return {
          reply: `Bát thiền gốm mộc Biên Hòa thường có dáng tròn đầm, viền miệng vuốt nhẹ nhàng.\n\nBạn dự tính đường kính miệng bát khoảng 13 cm hay 16 cm? Bạn chuộng sắc men đá đỏ nguyên bản hay men trắng rạn cổ?`,
          suggestions: [
            'Đường kính 14 cm, men đá đỏ',
            'Đường kính 16 cm, men rạn',
            'Tư vấn dáng bát thiền',
          ],
        };
      }
    }

    // KỊCH BẢN 5: Người dùng chào hỏi hoặc hỏi chung
    if (lower.includes('chào') || lower.includes('hello') || lower.includes('hi cụ') || lower.includes('bắt đầu')) {
      return {
        reply: `Kính chào bạn! Tôi là Cụ Thành — Nghệ nhân làng gốm Tân Vạn, Biên Hòa.\n\nRất vui được đồng hành cùng bạn tạo tác những sản phẩm gốm mang dấu ấn riêng bên bờ sông Đồng Nai. Bạn đang ấp ủ làm một **chiếc bình hoa**, **cốc uống nước**, **bát thiền** hay muốn tìm hiểu sắc men danh tiếng Vert de Biên Hòa?`,
        suggestions: [
          'Tôi muốn làm một chiếc bình hoa',
          'Tôi muốn tạo một chiếc cốc gốm',
          'Tìm hiểu men xanh đồng Biên Hòa',
        ],
      };
    }

    // KỊCH BẢN 6: Người dùng hỏi chung / chưa rõ ý
    return {
      reply: `Tôi rất hiểu mong muốn của bạn. Tại xưởng gốm Tân Vạn, mỗi tác phẩm đều bắt đầu từ việc chọn dáng phôi (bình hoa, cốc, bát hoặc đĩa), định hình chiều cao và chọn sắc men nung lò rồng phù hợp.\n\nBạn muốn tôi tư vấn thiết kế cho loại sản phẩm nào trước?`,
      suggestions: [
        'Thiết kế bình hoa men xanh đồng',
        'Tạo cốc gốm khắc chữ kỷ niệm',
        'Khám phá kỹ thuật chạm champlevé',
      ],
    };
  }
}
