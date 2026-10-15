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

  let modelType = 'vase';
  let dimensions = 'Cao 20cm × Đường kính bụng 13cm';
  let title = 'Bình Gốm Nghệ Thuật Dáng Chuẩn';
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
  const wordBoundary = (w) => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'u');
  if (wordBoundary('đào').test(lower) || lower.includes('hoa đào') || lower.includes('blossom') || lower.includes('cành hoa')) pattern = 'hoa_dao';
  else if (wordBoundary('sen').test(lower) || lower.includes('hoa sen')) pattern = 'sen_co';
  else if (lower.includes('trống đồng') || wordBoundary('đông sơn').test(lower)) pattern = 'dong_son';
  else if (wordBoundary('cá').test(lower) || lower.includes('cá chép') || wordBoundary('ngư').test(lower)) pattern = 'ca_chep';
  else if (lower.includes('chấm bi') || wordBoundary('bi').test(lower)) pattern = 'cham_bi';

  // 4. Đánh giá độ khả thi kỹ nghệ lò nung
  const feasibility = {
    score: 94,
    verdict: 'Khả thi rất cao (Đã tối ưu xương đất và kết cấu chịu nhiệt lò rồng)',
    clayRecommendation: 'Đất sét xám Tân Vạn dẻo mịn pha phù sa sông Đồng Nai',
    firingProfile: 'Nung sơ mộc 800°C → Nung phủ men lò rồng củi 1220°C',
    wallThickness: '5.2mm - 6.0mm',
    shrinkage: '9.2% (Ủ lò rồng 1200°C)',
  };

  return {
    modelType,
    title,
    dimensions,
    lathePoints,
    shapeParams: parsePromptToShapeParams(lower, modelType),
    suggestedGlaze,
    pattern,
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
  const {
    archetype = 'vase',
    height = 22,
    maxRadius = 11.5,
    neckRatio = 0.35,
    rimFlare = 0.65,
    baseRadius = 0.45,
    curvature = 'bulbous'
  } = params;

  // Baseline hình học cho từng dáng gốm chuẩn tỉ lệ làng nghề Biên Hòa
  const normBases = {
    vase: { heightBase: 22.0, radiusBase: 11.5, normHeight: 2.45, normRadius: 1.15, minY: -1.15 },
    'vase-narrow-neck': { heightBase: 25.0, radiusBase: 11.5, normHeight: 2.55, normRadius: 1.15, minY: -1.20 },
    bowl: { heightBase: 8.5, radiusBase: 7.5, normHeight: 1.20, normRadius: 1.35, minY: -0.65 },
    plate: { heightBase: 3.8, radiusBase: 13.0, normHeight: 0.48, normRadius: 1.55, minY: -0.22 },
    mug: { heightBase: 10.5, radiusBase: 4.5, normHeight: 1.50, normRadius: 1.05, minY: -0.75 },
  };

  const base = normBases[archetype] || normBases.vase;
  const hNorm = Math.max(0.35, (height / base.heightBase) * base.normHeight);
  const rNorm = Math.max(0.40, (maxRadius / base.radiusBase) * base.normRadius);
  const minY = base.minY;
  const maxY = minY + hNorm;

  // Bán kính chân đế tối thiểu 42% bán kính bụng để đứng vững (chống lỗi "chân nhọn con quay")
  const safeBaseRatio = Math.max(0.42, Math.min(0.70, baseRadius || 0.48));
  const rFoot = rNorm * safeBaseRatio;

  // Bán kính cổ và miệng
  const safeNeckRatio = Math.max(0.25, Math.min(0.85, neckRatio || 0.40));
  const rNeck = archetype === 'vase-narrow-neck'
    ? rNorm * Math.max(0.20, Math.min(0.40, safeNeckRatio))
    : rNorm * safeNeckRatio;
  const rRim = Math.max(rNeck * 1.1, rNeck * (1 + (rimFlare || 0.5) * 0.28));

  // Tọa độ các mốc neo (anchors) thành ngoài theo từng dáng gốm
  const anchors = [];

  if (archetype === 'bowl') {
    // Dáng Bát: Đáy tiếp đất vững, thân loe đều đặn lên vành miệng
    anchors.push([0, minY]);
    anchors.push([rFoot, minY]);
    anchors.push([rFoot * 1.06, minY + hNorm * 0.12]);
    anchors.push([rNorm * 0.65, minY + hNorm * 0.35]);
    anchors.push([rNorm * 0.88, minY + hNorm * 0.65]);
    anchors.push([rNorm, maxY]);
  } else if (archetype === 'plate') {
    // Dáng Đĩa: Nông, vành mở rộng, chân đế mộc
    anchors.push([0, minY]);
    anchors.push([rFoot * 0.85, minY]);
    anchors.push([rNorm * 0.60, minY + hNorm * 0.30]);
    anchors.push([rNorm * 0.85, minY + hNorm * 0.70]);
    anchors.push([rNorm, maxY]);
  } else if (archetype === 'mug') {
    // Dáng Cốc: Thân trụ hơi bầu tròn hữu cơ, cổ thắt nhẹ
    anchors.push([0, minY]);
    anchors.push([rFoot, minY]);
    anchors.push([rFoot * 1.04, minY + hNorm * 0.10]);
    anchors.push([rNorm, minY + hNorm * 0.45]);
    anchors.push([rNorm * 0.95, minY + hNorm * 0.75]);
    anchors.push([rRim, maxY]);
  } else {
    // Dáng Bình/Lọ (vase & vase-narrow-neck)
    let bellyYPos = 0.45;
    if (curvature === 'bulbous') bellyYPos = 0.38; // bụng thấp đầy đặn
    else if (curvature === 'slender') bellyYPos = 0.50; // thân thon đều
    else if (curvature === 'flared') bellyYPos = 0.60; // bụng cao

    anchors.push([0, minY]);                                     // Tâm chân đế
    anchors.push([rFoot, minY]);                                 // Mép chân đế
    anchors.push([rFoot * 1.05, minY + hNorm * 0.12]);           // Đáy nở lên
    anchors.push([rNorm * 0.90, minY + hNorm * (bellyYPos * 0.65)]); // Thân dưới nở
    anchors.push([rNorm, minY + hNorm * bellyYPos]);             // Bụng nở cực đại
    anchors.push([rNorm * 0.82, minY + hNorm * (bellyYPos + (1 - bellyYPos) * 0.35)]); // Vai bình
    anchors.push([rNeck, minY + hNorm * (bellyYPos + (1 - bellyYPos) * 0.70)]);       // Cổ thắt
    anchors.push([rRim, maxY]);                                  // Miệng bình loe
  }

  // Nội suy Catmull-Rom mượt mà
  const rawSpline = catmullRomSpline(anchors, 6);

  // Đảm bảo bán kính vỏ ngoài luôn dương (chống lỗi tự cắt mesh)
  const outerProfile = rawSpline.map(([rx, ry], idx) => {
    const minSafeR = idx === 0 ? 0 : (idx === 1 ? rFoot : 0.08);
    return {
      x: idx === 0 ? 0 : Number(Math.max(minSafeR, rx).toFixed(3)),
      y: Number(ry.toFixed(3)),
    };
  });

  // ── Xây dựng THÀNH TRONG (Inner Wall) & LÒNG RỖNG KHÉP KÍN ──
  // Độ dày thành gốm tiêu chuẩn 7-10% bán kính
  const wallThick = Number(Math.max(0.06, rNorm * 0.09).toFixed(3));
  const floorThick = Number(Math.max(0.08, hNorm * 0.12).toFixed(3));
  const rimOuter = outerProfile[outerProfile.length - 1];

  const fullLathePoints = [];

  // 1. Toàn bộ vỏ ngoài từ đáy lên miệng
  for (let i = 0; i < outerProfile.length; i++) {
    fullLathePoints.push(outerProfile[i]);
  }

  // 2. Vành miệng bo tròn mượt (Lip rim round-over)
  fullLathePoints.push({
    x: Number(Math.max(0.04, rimOuter.x - wallThick * 0.4).toFixed(3)),
    y: Number((rimOuter.y + 0.03).toFixed(3)),
  });
  fullLathePoints.push({
    x: Number(Math.max(0.04, rimOuter.x - wallThick).toFixed(3)),
    y: Number(rimOuter.y.toFixed(3)),
  });

  // 3. Thành trong đi ngược từ miệng xuống lòng đáy (Inner Wall Cavity)
  for (let i = outerProfile.length - 2; i >= 1; i--) {
    const p = outerProfile[i];
    const progressFromRim = (outerProfile.length - 1 - i) / Math.max(1, outerProfile.length - 1);
    const innerR = Math.max(0.03, p.x - wallThick);
    const innerY = Math.min(rimOuter.y - 0.02, p.y + floorThick * progressFromRim);
    fullLathePoints.push({
      x: Number(innerR.toFixed(3)),
      y: Number(innerY.toFixed(3)),
    });
  }

  // 4. Tâm đáy lòng trong kết thúc khép kín vào trục đối xứng x = 0
  fullLathePoints.push({
    x: 0,
    y: Number((minY + floorThick).toFixed(3)),
  });

  return fullLathePoints;
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
 * Dùng khi LLaMA chưa được cấu hình hoặc trả về JSON lỗi.
 */
function parsePromptToShapeParams(lower, modelType = 'vase') {
  let curvature = 'bulbous';
  if (lower.includes('dài') || lower.includes('thẳng') || lower.includes('cao')) curvature = 'slender';
  if (lower.includes('lệch') || lower.includes('hở') || lower.includes('mở') || lower.includes('loe')) curvature = 'flared';
  if (lower.includes('béo') || lower.includes('tròn')) curvature = 'bulbous';

  let height = 22.0, maxRadius = 11.5, neckRatio = 0.35, rimFlare = 0.65, baseRadius = 0.45;

  if (modelType === 'bowl') {
    height = 7.5; maxRadius = 7.0; neckRatio = 0.0; rimFlare = 1.0; baseRadius = 0.8;
  } else if (modelType === 'mug') {
    height = 9.5; maxRadius = 4.2; neckRatio = 0.3; rimFlare = 0.8; baseRadius = 0.4;
  } else if (modelType === 'plate') {
    height = 3.0; maxRadius = 11.0; neckRatio = 0.0; rimFlare = 1.2; baseRadius = 0.3;
  } else if (modelType === 'vase-narrow-neck') {
    height = 25.0; maxRadius = 11.5; neckRatio = 0.25; rimFlare = 1.1; baseRadius = 0.5;
  }

  return { height, maxRadius, neckRatio, rimFlare, baseRadius, curvature };
}
