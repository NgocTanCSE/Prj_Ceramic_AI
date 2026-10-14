/**
 * aiPromptParser.js
 * 
 * Bộ xử lý ngôn ngữ tự nhiên độc lập cho trợ lý gốm AI:
 * - Tách biệt hoàn toàn khỏi AICoCreatorScreen.jsx.
 * - Tự động nhận diện dáng gốm, tỷ lệ quy cách kích thước thực tế (khắc phục lỗi bình ngắn nhưng kích thước dài).
 * - Tự động phát hiện sắc men truyền thống, hoa văn và tính toán độ khả thi kỹ nghệ lò nung.
 */

export function parsePromptToConcept(queryText = '') {
  const text = (queryText || '').trim();
  const lower = text.toLowerCase();

  // 0. Trích xuất chính xác số đo từ prompt người dùng (Ví dụ: "cao 50 cm", "50cm", "đường kính 18cm")
  const heightRegex = /(?:cao|chiều cao|height|h\s*[:=]?)\s*(\d+(?:[.,]\d+)?)\s*(cm|centimet|m|mm)?/i;
  const standaloneCmRegex = /(\d+(?:[.,]\d+)?)\s*(?:cm|centimet)\b/i;
  let explicitHeight = null;
  const hMatch = lower.match(heightRegex) || lower.match(standaloneCmRegex);
  if (hMatch) {
    let val = parseFloat(hMatch[1].replace(',', '.'));
    const unit = (hMatch[2] || '').toLowerCase();
    if (unit === 'm' || (unit === '' && lower.includes(`${hMatch[1]}m`))) {
      val = val * 100;
    } else if (unit === 'mm') {
      val = val / 10;
    }
    if (val >= 3 && val <= 300) {
      explicitHeight = Math.round(val);
    }
  }

  const diameterRegex = /(?:đường kính|đk|rộng|thân rộng|bụng rộng|diameter|d\s*[:=]?)\s*(\d+(?:[.,]\d+)?)\s*(cm|centimet|m|mm)?/i;
  let explicitDiameter = null;
  const dMatch = lower.match(diameterRegex);
  if (dMatch) {
    let val = parseFloat(dMatch[1].replace(',', '.'));
    if (val >= 2 && val <= 300) {
      explicitDiameter = Math.round(val);
    }
  }

  let modelType = 'vase';
  let dimensions = explicitHeight ? `Cao ${explicitHeight}cm × Đường kính bụng 14cm` : 'Cao 20cm × Đường kính bụng 13cm';
  let title = explicitHeight ? `Bình Gốm Nghệ Thuật Cao ${explicitHeight}cm` : 'Bình Gốm Nghệ Thuật Dáng Chuẩn';
  let lathePoints = null;

  // 1. Phân tích dáng hình học & quy cách tỷ lệ thực tế
  if (lower.includes('ngắn') || lower.includes('lùn') || lower.includes('béo') || lower.includes('tròn bẹp') || lower.includes('mini')) {
    // Bình ngắn / Dáng lùn bụng tròn (Bình hút lộc mini)
    modelType = 'vase';
    dimensions = 'Cao 13.5cm × Đường kính bụng 16.5cm';
    title = 'Bình Gốm Dáng Lùn Bụng Tròn';
    lathePoints = [
      { x: 0, y: -0.65 },
      { x: 0.75, y: -0.65 },
      { x: 0.85, y: -0.55 },
      { x: 1.15, y: -0.35 },
      { x: 1.35, y: -0.05 },
      { x: 1.32, y: 0.15 },
      { x: 1.05, y: 0.35 },
      { x: 0.65, y: 0.50 },
      { x: 0.55, y: 0.60 },
      { x: 0.68, y: 0.68 },
      { x: 0.62, y: 0.70 },
      { x: 0.50, y: 0.66 },
      { x: 0.44, y: 0.52 },
      { x: 0.85, y: 0.05 },
      { x: 0.75, y: -0.40 },
      { x: 0, y: -0.50 }
    ];
  } else if (lower.includes('cổ nhỏ') || lower.includes('cổ cao') || lower.includes('thon cổ') || lower.includes('miệng nhỏ') || lower.includes('cổ thon')) {
    modelType = 'vase-narrow-neck';
    dimensions = 'Cao 24cm × Thân rộng 12cm × Cổ nhỏ 3.5cm';
    title = 'Bình Gốm Cổ Nhỏ Dáng Khí';
    lathePoints = [
      { x: 0, y: -1.2 }, { x: 0.55, y: -1.2 }, { x: 0.65, y: -1.0 },
      { x: 1.05, y: -0.4 }, { x: 1.15, y: 0.0 }, { x: 0.95, y: 0.45 },
      { x: 0.55, y: 0.8 }, { x: 0.28, y: 1.0 }, { x: 0.26, y: 1.3 },
      { x: 0.42, y: 1.4 }, { x: 0.35, y: 1.4 }, { x: 0.20, y: 1.3 },
      { x: 0.18, y: 0.8 }, { x: 0, y: 0 }
    ];
  } else if (lower.includes('bình') || lower.includes('lọ') || lower.includes('vase')) {
    modelType = 'vase';
    dimensions = 'Cao 22cm × Đường kính bụng 12cm';
    title = 'Bình Hoa Gốm Khí Thon Thanh Dáng';
    lathePoints = [
      { x: 0, y: -1.15 }, { x: 0.7, y: -1.15 }, { x: 0.75, y: -0.9 },
      { x: 0.95, y: -0.4 }, { x: 1.15, y: 0.05 }, { x: 1.05, y: 0.4 },
      { x: 0.7, y: 0.8 }, { x: 0.48, y: 1.05 }, { x: 0.52, y: 1.25 },
      { x: 0.72, y: 1.35 }, { x: 0.65, y: 1.38 }, { x: 0.46, y: 1.28 },
      { x: 0.42, y: 1.05 }, { x: 0.58, y: 0.75 }, { x: 0.82, y: 0.0 },
      { x: 0, y: -0.95 }
    ];
  } else if (lower.includes('bát') || lower.includes('chén') || lower.includes('tô') || lower.includes('bowl')) {
    modelType = 'bowl';
    dimensions = 'Đường kính 14.5cm × Cao 7.2cm';
    title = 'Bát Trà Thiền Men Mộc Vuốt Tay';
    // FIX (bug 2 — bát lông như lưỡi liềm): Profile có thành dày thực tế (inner wall ~8-9% so với outer).
    // Outer wall: foot → belly → rim. Rim curve bo tròn. Inner wall: rim → foot center.
    lathePoints = [
      // Outer wall (foot → rim)
      { x: 0, y: -0.65 },       // foot center (bottom)
      { x: 0.48, y: -0.65 },    // foot outer edge
      { x: 0.50, y: -0.52 },    // rising
      { x: 0.68, y: -0.40 },    // rising
      { x: 0.92, y: -0.22 },    // rising
      { x: 1.18, y: 0.00 },     // belly
      { x: 1.38, y: 0.25 },     // belly max
      { x: 1.48, y: 0.50 },     // rim outer (widest)
      // Rim curve (bo tròn góc để tránh góc sắc)
      { x: 1.46, y: 0.54 },     // rim outer curve
      { x: 1.38, y: 0.55 },     // rim inner curve
      // Inner wall (rim → foot, ~8-9% thickness)
      { x: 1.26, y: 0.50 },     // inner near rim (1.38 * 0.91)
      { x: 1.08, y: 0.25 },     // inner belly
      { x: 0.88, y: 0.00 },     // inner belly
      { x: 0.62, y: -0.22 },    // inner rising
      { x: 0.42, y: -0.40 },    // inner rising
      { x: 0.30, y: -0.52 },    // inner rising
      { x: 0, y: -0.55 },       // foot center inner (hollow floor)
    ];
  } else if (lower.includes('đĩa') || lower.includes('dĩa') || lower.includes('khay') || lower.includes('plate')) {
    modelType = 'plate';
    dimensions = 'Đường kính 22cm × Chiều cao 3.2cm';
    title = 'Đĩa Gốm Men Mộc Chạm Lộng';
    lathePoints = [
      { x: 0, y: -0.3 }, { x: 0.9, y: -0.3 }, { x: 1.4, y: -0.1 },
      { x: 1.95, y: 0.25 }, { x: 1.9, y: 0.3 }, { x: 1.35, y: -0.02 },
      { x: 0.85, y: -0.2 }, { x: 0, y: -0.2 }
    ];
  } else {
    modelType = 'mug';
    dimensions = 'Cao 10.5cm × Rộng 8.5cm';
    title = 'Cốc Bầu Men Mộc Vuốt Tay';
    lathePoints = [
      { x: 0, y: -0.75 }, { x: 0.55, y: -0.75 }, { x: 0.70, y: -0.68 },
      { x: 0.85, y: -0.55 }, { x: 0.98, y: -0.35 }, { x: 1.04, y: -0.10 },
      { x: 1.04, y: 0.10 }, { x: 0.99, y: 0.30 }, { x: 0.94, y: 0.50 },
      { x: 0.98, y: 0.65 }, { x: 1.02, y: 0.72 }, { x: 0.97, y: 0.74 },
      { x: 0.90, y: 0.70 }, { x: 0.85, y: 0.50 }, { x: 0.88, y: 0.15 },
      { x: 0.85, y: -0.20 }, { x: 0.68, y: -0.50 }, { x: 0.40, y: -0.62 },
      { x: 0, y: -0.64 }
    ];
  }

  // 2. Phân tích sắc men truyền thống
  let suggestedGlaze = {
    name: 'Men Xanh Đồng Trổ (Vert de Biên Hòa)',
    hex: '#2A6B5C',
    roughness: 0.16,
  };

  if (lower.includes('vàng') || lower.includes('hoàng yến')) {
    suggestedGlaze = {
      name: 'Men Vàng Hoàng Yến Biên Hòa',
      hex: '#E5B83B',
      roughness: 0.16,
    };
  } else if (lower.includes('xanh biển') || lower.includes('hỏa biến') || lower.includes('lam') || lower.includes('cobalt')) {
    suggestedGlaze = {
      name: 'Men Xanh Biển Hỏa Biến',
      hex: '#1E3A5F',
      roughness: 0.14,
    };
  } else if (lower.includes('đỏ') || lower.includes('bazan') || lower.includes('đá đỏ') || lower.includes('nâu')) {
    suggestedGlaze = {
      name: 'Men Đá Đỏ Bửu Long',
      hex: '#9E472A',
      roughness: 0.20,
    };
  } else if (lower.includes('trắng') || lower.includes('ngà') || lower.includes('bạch') || lower.includes('tro trấu')) {
    suggestedGlaze = {
      name: 'Men Tro Trấu Trắng Ngà',
      hex: '#EAE6DC',
      roughness: 0.15,
    };
  } else if (lower.includes('đen') || lower.includes('thiên mục') || lower.includes('hắc')) {
    suggestedGlaze = {
      name: 'Men Hắc Diệu Thiên Mục',
      hex: '#1F1E24',
      roughness: 0.15,
    };
  } else if (lower.includes('đào') || lower.includes('hoa đào')) {
    suggestedGlaze = {
      name: 'Men Sứ Trắng Vẽ Hoa Đào',
      hex: '#EDE8DC',
      roughness: 0.16,
    };
  }

  // 3. Phân tích hoa văn vẽ tay (word-boundary aware — tránh match 'cá' trong 'năm cánh')
  let pattern = 'none';
  let customPattern = '';
  const wordBoundary = (w) => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u');
  if (lower.includes('doraemon') || lower.includes('doremon')) {
    pattern = 'doraemon';
    customPattern = 'Họa tiết Doraemon (Vẽ men màu theo yêu cầu)';
  } else if (wordBoundary('đào').test(lower) || lower.includes('hoa đào') || lower.includes('blossom') || lower.includes('cành hoa')) {
    pattern = 'hoa_dao';
  } else if (wordBoundary('sen').test(lower) || lower.includes('hoa sen')) {
    pattern = 'sen_co';
  } else if (lower.includes('trống đồng') || wordBoundary('đông sơn').test(lower)) {
    pattern = 'dong_son';
  } else if (wordBoundary('cúc').test(lower) || lower.includes('hoa cúc') || lower.includes('cúc dây')) {
    pattern = 'cuc_day';
  } else if (wordBoundary('cá').test(lower) || lower.includes('cá chép') || wordBoundary('ngư').test(lower)) {
    pattern = 'ca_chep';
  } else if (lower.includes('chấm bi') || wordBoundary('bi').test(lower)) {
    pattern = 'cham_bi';
  }

  // 4. Tính toán tham số hình học dựa trên thông số người dùng
  const shapeParams = parsePromptToShapeParams(lower, modelType, explicitHeight, explicitDiameter);

  // Nếu người dùng chỉ định chiều cao cụ thể (ví dụ: 50cm):
  if (explicitHeight) {
    dimensions = `Cao ${shapeParams.height}cm × Đường kính bụng ${Math.round(shapeParams.maxRadius * 2)}cm`;
    // Tính toán lại lathePoints theo tỷ lệ kích thước thực
    lathePoints = paramsToLathePoints({ archetype: modelType, ...shapeParams });
  }

  // 5. Đánh giá độ khả thi kỹ nghệ lò nung
  const isLargeVessel = shapeParams.height > 40;
  const feasibility = {
    score: isLargeVessel ? 88 : 94,
    verdict: isLargeVessel
      ? `Khả thi chế tác đặc biệt (Kích thước ${shapeParams.height}cm cần nung khoang giữa lò rồng)`
      : 'Khả thi rất cao (Đã tối ưu xương đất và kết cấu chịu nhiệt lò rồng)',
    clayRecommendation: isLargeVessel
      ? 'Đất sét xám Tân Vạn gia cố quặng đá ong Bửu Long chịu lực vách cao'
      : 'Đất sét xám Tân Vạn dẻo mịn pha phù sa sông Đồng Nai',
    firingProfile: 'Nung sơ mộc 800°C → Nung phủ men lò rồng củi 1220°C',
    wallThickness: isLargeVessel ? '6.8mm - 8.2mm (Gia cố chống sụt nứt)' : '5.2mm - 6.0mm',
    shrinkage: '9.2% (Ủ lò rồng 1200°C)',
    largeSizeWarning: isLargeVessel
      ? `Lưu ý kích thước ${shapeParams.height}cm: Chiều cao lớn cần nghệ nhân vuốt phôi phân đoạn và nung chậm tại khoang trung tâm Lò rồng Tân Vạn để đảm bảo độ bền vững.`
      : null,
  };

  return {
    modelType,
    title,
    dimensions,
    lathePoints,
    shapeParams,
    suggestedGlaze,
    pattern,
    customPattern,
    feasibility,
  };
}

/**
 * Tạo lathePoints từ tham số hình dạng tham số (Catmull-Rom Spline)
 * Thay thế hoàn toàn danh sách hardcoded nếu/else cho 4 dáng.
 *
 * @param {object} params — { archetype, height, maxRadius, neckRatio, rimFlare, baseRadius, curvature }
 * @returns {Array<{x:number,y:number}>} — lathePoints dùng cho createCeramicGeometry
 *
 * 2D spline nằm trong không gian Chuẩn gốm: y ∈ [-1.20, 1.40], x (radius) ∈ [0, 2.0]
 */
export function paramsToLathePoints(params = {}) {
  const { archetype = 'vase', height = 22, maxRadius = 11.5, neckRatio = 0.35, rimFlare = 0.65, baseRadius = 0.45, curvature = 'bulbous' } = params;

  // FIX (bug 5 — sai tỷ lệ bát/bình): Dùng baseline riêng cho từng dáng gốm.
  // Trước đây dùng chung vase baseline (22cm → 2.55 normalized height) cho TẤT CẢ dáng,
  // dẫn tới bát 8.5cm bị co thành 0.97 normalized (thấp hơn target 1.20) → bị bóp bẹt.
  const normBases = {
    vase:            { heightBase: 22.0, radiusBase: 11.5, normHeight: 2.55, normRadius: 1.18 },
    'vase-narrow-neck': { heightBase: 25.0, radiusBase: 11.5, normHeight: 2.65, normRadius: 1.18 },
    bowl:            { heightBase: 8.5,  radiusBase: 7.5,  normHeight: 1.20, normRadius: 1.35 },
    plate:           { heightBase: 3.8,  radiusBase: 13.0, normHeight: 0.48, normRadius: 1.55 },
    mug:             { heightBase: 10.5, radiusBase: 4.5,  normHeight: 1.50, normRadius: 1.05 },
  };
  const base = normBases[archetype] || normBases.vase;
  const hNorm = (height / base.heightBase) * base.normHeight;
  const rNorm = (maxRadius / base.radiusBase) * base.normRadius;

  // Tính các điểm mốc chính (anchor points) theo archetype + shapeParams
  const anchors = [];

  // When archetype is 'vase' but LLaMA detected a narrow neck (neckRatio < 0.4),
  // augment with neck-narrowing anchors to produce the correct silhouette
  const hasNarrowNeck = archetype === 'vase' && neckRatio < 0.4;

  switch (curvature) {
    case 'slender':
      anchors.push([0, -hNorm / 2]);                  // đáy
      anchors.push([rNorm * 0.15, -hNorm * 0.85 / 2]); // chân dưới
      anchors.push([rNorm * 0.45, -hNorm * 0.60 / 2]);
      anchors.push([rNorm * 0.85, -hNorm * 0.30 / 2]);
      anchors.push([rNorm * 0.92, -hNorm * 0.10 / 2]);
      anchors.push([rNorm, 0]);                       // thắng cổ (nếu có)
      if (archetype === 'vase-narrow-neck' || hasNarrowNeck) {
        anchors.push([rNorm * (0.15 + neckRatio), hNorm * 0.25 / 2]);
        anchors.push([rNorm * (0.12 + neckRatio), hNorm * 0.50 / 2]);
        anchors.push([rNorm * (0.15 + neckRatio), hNorm * 0.70 / 2]);
      }
      anchors.push([rNorm * 0.80, hNorm * 0.95 / 2]);   // miệng
      anchors.push([rNorm * (0.85 + rimFlare * 0.30), hNorm / 2]); // miệng loe
      break;

    case 'bulbous':
      anchors.push([0, -hNorm / 2]);                   // đáy
      anchors.push([rNorm * 0.15, -hNorm * 0.85 / 2]);
      anchors.push([rNorm * 0.30, -hNorm * 0.65 / 2]);
      anchors.push([rNorm * 0.70, -hNorm * 0.45 / 2]);
      anchors.push([rNorm, -hNorm * 0.15 / 2]);       // bụng rộng nhất
      anchors.push([rNorm * 0.95, hNorm * 0.15 / 2]);
      if (archetype === 'vase-narrow-neck' || hasNarrowNeck) {
        anchors.push([rNorm * (0.20 + neckRatio), hNorm * 0.35 / 2]);
        anchors.push([rNorm * (0.15 + neckRatio), hNorm * 0.55 / 2]);
        anchors.push([rNorm * (0.20 + neckRatio), hNorm * 0.75 / 2]);
      }
      anchors.push([rNorm * 0.90, hNorm * 0.85 / 2]);
      anchors.push([rNorm * (0.80 + rimFlare * 0.30), hNorm / 2]);
      break;

    case 'flared':
      anchors.push([0, -hNorm / 2]);
      anchors.push([rNorm * 0.25, -hNorm * 0.75 / 2]);
      anchors.push([rNorm * 0.55, -hNorm * 0.50 / 2]);
      anchors.push([rNorm, -hNorm * 0.20 / 2]);
      anchors.push([rNorm * 1.05, 0]);                 // bụng rộng
      if (archetype === 'vase-narrow-neck' || hasNarrowNeck) {
        anchors.push([rNorm * (0.18 + neckRatio), hNorm * 0.25 / 2]);
        anchors.push([rNorm * (0.15 + neckRatio), hNorm * 0.50 / 2]);
      }
      anchors.push([rNorm * 0.95, hNorm * 0.75 / 2]);
      anchors.push([rNorm * (0.90 + rimFlare * 0.30), hNorm / 2]);
      break;

    case 'conical':
      anchors.push([0, -hNorm / 2]);
      anchors.push([rNorm * 0.70, -hNorm * 0.70 / 2]);
      anchors.push([rNorm * 0.90, -hNorm * 0.40 / 2]);
      anchors.push([rNorm, 0]);
      if (archetype === 'vase-narrow-neck' || hasNarrowNeck) {
        anchors.push([rNorm * (0.20 + neckRatio), hNorm * 0.30 / 2]);
        anchors.push([rNorm * (0.15 + neckRatio), hNorm * 0.60 / 2]);
      }
      anchors.push([rNorm * 0.85, hNorm * 0.80 / 2]);
      anchors.push([rNorm * (0.75 + rimFlare * 0.25), hNorm / 2]);
      break;

    case 'flat':
      // Disc / flat object — minimal height variation
      anchors.push([0, -hNorm / 2 * 0.85]);
      anchors.push([rNorm * 0.35, -hNorm / 2 * 0.70]);
      anchors.push([rNorm * 0.70, -hNorm / 2 * 0.30]);
      anchors.push([rNorm, 0]);
      anchors.push([rNorm * 1.05, hNorm / 2 * 0.30]);
      anchors.push([rNorm * 0.90, hNorm / 2 * 0.70]);
      anchors.push([rNorm * 0.50, hNorm / 2 * 0.85]);
      break;

    default: // 'bulbous'
      anchors.push([0, -hNorm / 2]);
      anchors.push([rNorm * 0.30, -hNorm * 0.60 / 2]);
      anchors.push([rNorm * 0.70, -hNorm * 0.30 / 2]);
      anchors.push([rNorm, 0]);
      if (archetype === 'vase-narrow-neck' || hasNarrowNeck) {
        anchors.push([rNorm * (0.18 + neckRatio), hNorm * 0.30 / 2]);
        anchors.push([rNorm * (0.14 + neckRatio), hNorm * 0.60 / 2]);
        anchors.push([rNorm * (0.18 + neckRatio), hNorm * 0.80 / 2]);
      } else if (archetype === 'bowl') {
        anchors.push([rNorm * 0.95, hNorm * 0.10 / 2]);
      } else if (archetype === 'plate') {
        anchors.push([rNorm * 1.05, hNorm * 0.05 / 2]);
      }
      anchors.push([rNorm * (0.85 + rimFlare * 0.20), hNorm / 2]);
  }

  // Đối với bowl, đảo ngược: miệng trên cùng là rộng nhất
  if (archetype === 'bowl' && anchors.length > 0) {
    anchors.sort((a, b) => a[1] - b[1]);
  }
  // Đối với plate, đảm bảo dạng phẳng
  if (archetype === 'plate') {
    anchors[0] = [0, -hNorm / 2 * 0.9];  // đáy phẳng
    anchors[anchors.length - 1] = [rNorm * (1.0 + rimFlare * 0.3), hNorm / 2 * 0.9];
  }

  // Catmull-Rom interpolation với 8-12 điểm trung gian
  const interpolated = catmullRomSpline(anchors, 8);

  // Chuyển sang định dạng lathePoints: {x: r, y: height}
  const lathePoints = interpolated.map(([rx, ry]) => ({ x: rx, y: ry }));

  // FIX (bug 2 — bát lông như lưỡi liềm): Với bowl/plate, thêm inner wall points
  // để tạo thành dày thực tế (hollow interior). Spline chỉ tạo outer silhouette.
  if (archetype === 'bowl' && lathePoints.length >= 6) {
    // Outer wall đã có sẵn từ spline (foot → rim).
    // Thêm inner wall: duyệt outer wall từ rim xuống foot, tạo points bên trong (~10% smaller radius)
    const outerProfile = lathePoints.slice(); // copy outer silhouette
    const innerPoints = [];
    // Lấy các điểm ngoài cùng (ít nhất 4) để xây dựng inner wall
    const rimOuter = outerProfile[outerProfile.length - 1]; // điểm rộng nhất (miệng)
    const wallThicknessRatio = 0.10; // 10% — đường dẫn trong cách ngoài 10%

    const floorOffset = Math.max(0.04, (rimOuter.y - outerProfile[0].y) * 0.08);
    for (let i = outerProfile.length - 1; i >= 0; i--) {
      const p = outerProfile[i];
      const progressFromRim = (outerProfile.length - 1 - i) / Math.max(1, outerProfile.length - 1);
      const innerR = Math.max(p.x * (1 - wallThicknessRatio), i === 0 ? 0 : 0.02);
      // Nâng dần đáy lòng trong để đáy gốm có độ dày thực tế, không bị mỏng dính ở tâm
      const innerY = Math.min(rimOuter.y - 0.02, p.y + floorOffset * progressFromRim);
      innerPoints.push({ x: innerR, y: innerY });
    }
    // Kết hợp outer wall (foot→rim) + inner wall (rim→foot) thành profile khép kín
    lathePoints.length = 0;
    lathePoints.push(...outerProfile);
    lathePoints.push(...innerPoints);
  } else if (archetype === 'plate' && lathePoints.length >= 4) {
    // Plate: thêm inner wall nhẹ để có độ dày
    const outerProfile = lathePoints.slice();
    const innerPoints = [];
    const rimOuter = outerProfile[outerProfile.length - 1];
    const wallThicknessRatio = 0.12;
    const floorOffset = Math.max(0.02, (rimOuter.y - outerProfile[0].y) * 0.10);
    for (let i = outerProfile.length - 1; i >= 0; i--) {
      const p = outerProfile[i];
      const progressFromRim = (outerProfile.length - 1 - i) / Math.max(1, outerProfile.length - 1);
      const innerR = Math.max(p.x * (1 - wallThicknessRatio), i === 0 ? 0 : 0.02);
      const innerY = Math.min(rimOuter.y - 0.015, p.y + floorOffset * progressFromRim);
      innerPoints.push({ x: innerR, y: innerY });
    }
    lathePoints.length = 0;
    lathePoints.push(...outerProfile);
    lathePoints.push(...innerPoints);
  }

  // Đảm bảo ít nhất 8 điểm
  if (lathePoints.length < 8) {
    // Pad bằng cách lặp lại
    while (lathePoints.length < 8) {
      lathePoints.push(lathePoints[lathePoints.length - 1]);
    }
  }

  return lathePoints;
}

/**
 * Catmull-Rom spline interpolation (2D)
 * @param {Array<[x,y]>} points — anchor points
 * @param {number} steps — số điểm trung gian mỗi đoạn
 * @returns {Array<[x,y]>} — điểm nội suy
 */
function catmullRomSpline(points, steps = 8) {
  const result = [];

  // Thêm 2 điểm ảo ở đầu và cuối
  const pts = [[points[0][0], points[0][1]], ...points, [points[points.length - 1][0], points[points.length - 1][1]]];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];

    result.push([p1[0], p1[1]]);

    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom formula
      const x = 0.5 * (
        2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );
      const y = 0.5 * (
        2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );
      result.push([x, y]);
    }
  }

  return result;
}

/**
 * Chuyển prompt tự nhiên thành tham số hình dạng tham số (fallback rule engine)
 * Tôn trọng tuyệt đối số đo cm cụ thể do người dùng chỉ định (ví dụ: 50cm, 18cm).
 */
function parsePromptToShapeParams(lower, modelType = 'vase', explicitHeight = null, explicitDiameter = null) {
  let curvature = 'bulbous';
  if (lower.includes('dài') || lower.includes('thẳng') || lower.includes('cao')) curvature = 'slender';
  if (lower.includes('lệch') || lower.includes('hở') || lower.includes('mở') || lower.includes('loe')) curvature = 'flared';
  if (lower.includes('béo') || lower.includes('tròn')) curvature = 'bulbous';

  let height = 22.0, maxRadius = 11.5, neckRatio = 0.35, rimFlare = 0.65, baseRadius = 0.45;

  if (modelType === 'bowl') {
    height = 8.5; maxRadius = 7.5; neckRatio = 0.0; rimFlare = 1.0; baseRadius = 0.8;
  } else if (modelType === 'mug') {
    height = 10.5; maxRadius = 4.5; neckRatio = 0.3; rimFlare = 0.8; baseRadius = 0.4;
  } else if (modelType === 'plate') {
    height = 3.8; maxRadius = 13.0; neckRatio = 0.0; rimFlare = 1.2; baseRadius = 0.3;
  } else if (modelType === 'vase-narrow-neck') {
    height = 25.0; maxRadius = 11.5; neckRatio = 0.25; rimFlare = 1.1; baseRadius = 0.5;
  }

  // Tôn trọng tuyệt đối số đo explicit của người dùng
  if (explicitHeight !== null && explicitHeight > 0) {
    height = explicitHeight;
  }
  if (explicitDiameter !== null && explicitDiameter > 0) {
    maxRadius = explicitDiameter / 2;
  }

  return { height, maxRadius, neckRatio, rimFlare, baseRadius, curvature };
}
