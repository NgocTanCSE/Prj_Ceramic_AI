import * as THREE from 'three';
import { createCeramicTexture } from './ceramicTextureGenerator.js';

/**
 * Tạo mô hình hình học Three.js chuẩn mực cho từng dáng gốm:
 * Ưu tiên tuyệt đối dùng lathePoints thực tế trích xuất từ phôi ảnh/tiêu bản.
 */
export function createCeramicGeometry(modelType = 'bowl', lathePoints = null, customGeometry = null) {
  if (customGeometry && customGeometry.isBufferGeometry) {
    return customGeometry.clone();
  }

  if (modelType === 'mug') {
    // Dáng Cốc Bầu Men Mộc 1:1 (Chubby Belly Mug theo tiêu bản pottery-mug-001)
    // Thân bầu tròn hữu cơ, bụng phình cong mềm mại, cổ thắt nhẹ và vành miệng loe thanh thoát
    const points = (lathePoints && Array.isArray(lathePoints) && lathePoints.length >= 10)
      ? lathePoints.map((p) => new THREE.Vector2(p.x, p.y))
      : [
          new THREE.Vector2(0, -0.75),        // Tâm chân đế tiếp xúc mặt bàn
          new THREE.Vector2(0.55, -0.75),     // Chân đế mộc tiếp đất
          new THREE.Vector2(0.70, -0.68),     // Đáy bo tròn nở lên
          new THREE.Vector2(0.85, -0.55),     // Bụng dưới bắt đầu phình
          new THREE.Vector2(0.98, -0.35),     // Thân dưới nở tròn
          new THREE.Vector2(1.04, -0.10),     // Bụng phình rộng nhất
          new THREE.Vector2(1.04, 0.10),      // Bụng phình
          new THREE.Vector2(0.99, 0.30),      // Thân trên thon dần
          new THREE.Vector2(0.94, 0.50),      // Cổ thắt nhẹ
          new THREE.Vector2(0.98, 0.65),      // Miệng bắt đầu loe
          new THREE.Vector2(1.02, 0.72),      // Đỉnh vành miệng loe thanh thoát
          new THREE.Vector2(0.97, 0.74),      // Mép vành miệng bo tròn mịn
          new THREE.Vector2(0.90, 0.70),      // Vách trong vành miệng
          new THREE.Vector2(0.85, 0.50),      // Lòng trên
          new THREE.Vector2(0.88, 0.15),      // Lòng giữa khoét theo bụng
          new THREE.Vector2(0.85, -0.20),     // Lòng dưới
          new THREE.Vector2(0.68, -0.50),     // Đáy trong
          new THREE.Vector2(0.40, -0.62),     // Lòng sát đáy
          new THREE.Vector2(0, -0.64),        // Tâm đáy lòng trong
        ];
    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  if (lathePoints && Array.isArray(lathePoints) && lathePoints.length >= 4) {
    // Tính toán bounding box thực tế của lathePoints
    let minY = Infinity, maxY = -Infinity, maxX = 0;
    for (const p of lathePoints) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.x > maxX) maxX = p.x;
    }
    const currentYSpan = Math.max(0.1, maxY - minY);
    const currentMaxX = Math.max(0.1, maxX);

    // Chuẩn hóa tỷ lệ theo từng loại hình gốm để KHÔNG BAO GIỜ bị ép bẹt như đĩa xoắn
    let targetYSpan = 2.45;
    let targetMaxR = 1.15;
    let targetMinY = -1.15;

    if (modelType === 'bowl') {
      targetYSpan = 1.20;
      targetMaxR = 1.40;
      targetMinY = -0.65;
    } else if (modelType === 'plate') {
      targetYSpan = 0.48;
      targetMaxR = 1.55;
      targetMinY = -0.22;
    } else if (modelType === 'mug') {
      targetYSpan = 1.50;
      targetMaxR = 1.05;
      targetMinY = -0.75;
    }

    // FIX (object height bug): Server (API/server.js) ALREADY normalizes lathePoints to this
    // exact [targetMinY, targetMinY + targetYSpan] space (lines 626-631). Re-normalizing an
    // already-normalized profile causes double-normalization height distortion: interior points
    // (rim extensions +0.04, foot center +0.15 — see server lines 650/659) extend the Y range
    // beyond the outer curve, so FE's (maxY-minY) > targetYSpan → yScale < 1.0 → object
    // gets vertically compressed. Detect already-normalized points (Y span within 15% of
    // target) and use as-is, only adjusting radius if needed.
    const ySpanRatio = currentYSpan / targetYSpan;
    const alreadyNormalized = ySpanRatio > 0.85 && ySpanRatio < 1.15;

    let points;
    if (alreadyNormalized) {
      // Points already in target Y space — preserve Y, only normalize radius
      const rScale = targetMaxR / currentMaxX;
      points = lathePoints.map((p) => new THREE.Vector2(p.x * rScale, p.y));
    } else {
      // Points NOT in target space — full re-normalization (e.g. raw silhouette from meshInflator)
      const yScale = targetYSpan / currentYSpan;
      const rScale = targetMaxR / currentMaxX;
      points = lathePoints.map((p) => {
        const normY = targetMinY + (p.y - minY) * yScale;
        const normX = p.x * rScale;
        return new THREE.Vector2(normX, normY);
      });
    }

    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  if (modelType === 'vase-narrow-neck') {
    // Dáng Bình Cổ Nhỏ (Narrow-neck bottle vase): Thân bầu tròn, cổ thon nhỏ, miệng loe thanh thoát
    const points = [];
    points.push(new THREE.Vector2(0, -1.2));
    points.push(new THREE.Vector2(0.55, -1.2));
    points.push(new THREE.Vector2(0.65, -1.0));
    points.push(new THREE.Vector2(1.05, -0.4));
    points.push(new THREE.Vector2(1.15, 0.0));
    points.push(new THREE.Vector2(0.95, 0.45));
    points.push(new THREE.Vector2(0.55, 0.8));
    points.push(new THREE.Vector2(0.28, 1.0));
    points.push(new THREE.Vector2(0.26, 1.3));
    points.push(new THREE.Vector2(0.42, 1.4));
    points.push(new THREE.Vector2(0.35, 1.4));
    points.push(new THREE.Vector2(0.20, 1.3));
    points.push(new THREE.Vector2(0.18, 0.8));
    points.push(new THREE.Vector2(0, 0));
    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  if (modelType === 'vase') {
    const points = [];
    points.push(new THREE.Vector2(0, -1.15));
    points.push(new THREE.Vector2(0.7, -1.15));
    points.push(new THREE.Vector2(0.75, -0.9));
    points.push(new THREE.Vector2(1.15, -0.3));
    points.push(new THREE.Vector2(1.18, 0.1));
    points.push(new THREE.Vector2(0.55, 0.7));
    points.push(new THREE.Vector2(0.48, 1.1));
    points.push(new THREE.Vector2(0.75, 1.3));
    points.push(new THREE.Vector2(0.68, 1.3));
    points.push(new THREE.Vector2(0.4, 1.05));
    points.push(new THREE.Vector2(0.45, 0.5));
    points.push(new THREE.Vector2(0.1, 0.0));
    points.push(new THREE.Vector2(0, 0.0));
    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  if (modelType === 'bowl') {
    // FIX (bug 5 — sai tỷ lệ): Profile có inner wall độ dày thực tế (~8-9%),
    // đồng bộ với getDefaultModelProfile.bowl + aiPromptParser.js.
    // Rim curve bo tròn tránh góc sắc.
    const points = [];
    points.push(new THREE.Vector2(0, -0.65));        // Tâm chân đế ngoài
    points.push(new THREE.Vector2(0.48, -0.65));     // Chân đế mộc tiếp đất
    points.push(new THREE.Vector2(0.50, -0.52));     // Đáy lên
    points.push(new THREE.Vector2(0.68, -0.40));     // Bụng dưới bắt đầu cong
    points.push(new THREE.Vector2(0.92, -0.22));     // Thân dưới nở tròn
    points.push(new THREE.Vector2(1.18, 0.00));      // Thân giữa
    points.push(new THREE.Vector2(1.38, 0.25));      // Thân trên nở ra miệng
    points.push(new THREE.Vector2(1.48, 0.50));      // Mép ngoài miệng loe (rộng nhất)
    points.push(new THREE.Vector2(1.46, 0.54));      // Đỉnh vành miệng bo tròn
    points.push(new THREE.Vector2(1.38, 0.55));      // Mép trong miệng bo tròn
    points.push(new THREE.Vector2(1.26, 0.50));      // Vách trong gần miệng (1.38 * 0.91)
    points.push(new THREE.Vector2(1.08, 0.25));      // Lòng trên
    points.push(new THREE.Vector2(0.88, 0.00));      // Lòng giữa
    points.push(new THREE.Vector2(0.62, -0.22));     // Lòng dưới
    points.push(new THREE.Vector2(0.42, -0.40));     // Lòng về đáy
    points.push(new THREE.Vector2(0.30, -0.52));     // Lòng sát đáy
    points.push(new THREE.Vector2(0, -0.55));        // Tâm đáy lòng trong (lòng chân không)
    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  if (modelType === 'plate') {
    // FIX (bug 5): Profile Y span = 0.60 > target 0.48 → trước đây bị nén dọc.
    // Điều chỉnh điểm để Y span ∈ [-0.22, +0.26] = 0.48 (targetYSpan).
    const points = [];
    points.push(new THREE.Vector2(0, -0.22));
    points.push(new THREE.Vector2(0.82, -0.22));
    points.push(new THREE.Vector2(1.26, -0.07));
    points.push(new THREE.Vector2(1.76, 0.12));
    points.push(new THREE.Vector2(1.72, 0.26));
    points.push(new THREE.Vector2(1.22, 0.0));
    points.push(new THREE.Vector2(0.76, -0.18));
    points.push(new THREE.Vector2(0, -0.20));
    const geo = new THREE.LatheGeometry(points, 64);
    geo.rotateY(Math.PI);
    return geo;
  }

  // Mặc định: Cốc gốm (mug)
  const points = [];
  points.push(new THREE.Vector2(0, -1.0));
  points.push(new THREE.Vector2(0.85, -1.0));
  points.push(new THREE.Vector2(0.92, -0.85));
  points.push(new THREE.Vector2(0.96, 0.0));
  points.push(new THREE.Vector2(0.98, 0.95));
  points.push(new THREE.Vector2(0.92, 1.05));
  points.push(new THREE.Vector2(0.84, 1.0));
  points.push(new THREE.Vector2(0.82, -0.82));
  points.push(new THREE.Vector2(0, -0.82));
  const geo = new THREE.LatheGeometry(points, 64);
  geo.rotateY(Math.PI);
  return geo;
}

/**
 * Render 6 góc nhìn trực giao siêu nét:
 * - VIEW-01: Giữ nguyên ảnh chụp thật nguyên vẹn 100% của sản phẩm hoặc ảnh 3D
 * - VIEW-02..06: Dùng Camera trực giao Three.js chụp từ mô hình 3D mở miệng và phủ men tương ứng
 */
export function generateOrthographicViews(
  frontPhotoUrl,
  modelType = 'bowl',
  glazeColor = '#1E3A5F',
  glazeRoughness = 0.15,
  lathePoints = null,
  pattern = 'none',
  customText = '',
  glazeName = '',
  patternImage = null,
  rimStyle = 'brown'
) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0xf8f7f4, 1.0); // Nền Studio sạch tinh tươm #F8F7F4
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();

  // Texture men gốm và hoa văn dùng chung chuẩn 1:1 với Bàn Xoay 3D
  const glazeTexture = createCeramicTexture({
    glazeColor,
    glazeName,
    pattern,
    patternImage,
    customText,
    modelType,
    rimStyle,
    width: 1024,
    height: 1024,
  });

  // Vật liệu gốm men bóng cao cấp đồng bộ 100% với CeramicCanvas3D
  // FIX (bug 2 — đen ngòm khi nhìn từ trong ra): side: DoubleSide để nhìn thấy
  // cả mặt trong bát/đĩa khi nhìn từ trong ra ngoài (top view).
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff), // RẤT QUAN TRỌNG: 0xffffff để không bị nhân màu 2 lần làm đen sẫm
    map: glazeTexture,
    roughness: glazeRoughness,
    metalness: 0.08,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    reflectivity: 0.85,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide, // FIX (bug 2): nhìn thấy cả mặt trong bát/đĩa từ góc trên
  });

  const geometry = createCeramicGeometry(modelType, lathePoints);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Đối với cốc (mug): thêm quai cầm 3D dáng chữ C chuẩn tỷ lệ 1:1 theo tiêu bản
  let handleMesh = null;
  if (modelType === 'mug') {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.94, 0.55, 0),
      new THREE.Vector3(1.68, 0.45, 0),
      new THREE.Vector3(1.62, -0.15, 0),
      new THREE.Vector3(0.88, -0.42, 0)
    );
    const handleGeo = new THREE.TubeGeometry(curve, 32, 0.11, 16, false);
    const handleCanvas = createCeramicTextureCanvas({
      glazeColor,
      glazeName,
      pattern: 'none',
      patternImage: null,
      customText: '',
      rimStyle: 'none',
      modelType: 'mug',
      width: 512,
      height: 512,
    });
    const handleTexture = new THREE.CanvasTexture(handleCanvas);
    handleTexture.wrapS = THREE.RepeatWrapping;
    handleTexture.wrapT = THREE.ClampToEdgeWrapping;
    const handleMat = material.clone();
    handleMat.map = handleTexture;
    handleMesh = new THREE.Mesh(handleGeo, handleMat);
    scene.add(handleMesh);
  }

  // Ánh sáng Studio chuẩn xác tương đồng 100% với CeramicCanvas3D
  const ambientLight = new THREE.AmbientLight(0xfff5eb, 1.25);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xd4e5ff, 1.1);
  fillLight.position.set(-4, 3, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffecd2, 1.5);
  rimLight.position.set(0, -3, -4);
  scene.add(rimLight);

  const frustumSize = modelType === 'plate' ? 4.2 : 3.3;
  const camera = new THREE.OrthographicCamera(
    -frustumSize / 2, frustumSize / 2,
    frustumSize / 2, -frustumSize / 2,
    0.1, 20
  );

  const topViewLabel = modelType === 'mug'
    ? 'Nhìn Trên Miệng Cốc'
    : (modelType === 'vase' || modelType === 'vase-narrow-neck'
        ? 'Nhìn Trên Miệng Bình'
        : (modelType === 'plate' ? 'Nhìn Trên Lòng Đĩa' : 'Nhìn Trên Lòng Bát'));

  const configs = [
    {
      id: 'front',
      name: 'Chính Diện (Front)',
      shortName: 'Chính diện (0°)',
      code: 'VIEW-01',
      pos: [0, 0, 5],
      up: [0, 1, 0],
      axis: 'Tọa Độ Vật Thể (0°, Y=0)',
      desc: 'Hình chiếu chính diện 0°: Chiều đứng tiêu chuẩn kỹ thuật',
    },
    {
      id: 'back',
      name: 'Mặt Sau (Back)',
      shortName: 'Mặt sau (180°)',
      code: 'VIEW-02',
      pos: [0, 0, -5],
      up: [0, 1, 0],
      axis: 'Tọa Độ Vật Thể (180°, Y=0)',
      desc: 'Hình chiếu lưng đối xứng qua trục quay thẳng đứng tại cao độ Y=0',
    },
    {
      id: 'left',
      name: 'Cạnh Trái (Left)',
      shortName: 'Cạnh trái (-90°)',
      code: 'VIEW-03',
      pos: [-5, 0, 0],
      up: [0, 1, 0],
      axis: 'Tọa Độ Vật Thể (-90°, Y=0)',
      desc: 'Hình chiếu sườn trái thành gốm tại cao độ Y=0',
    },
    {
      id: 'right',
      name: 'Cạnh Phải (Right)',
      shortName: 'Cạnh phải (+90°)',
      code: 'VIEW-04',
      pos: [5, 0, 0],
      up: [0, 1, 0],
      axis: 'Tọa Độ Vật Thể (+90°, Y=0)',
      desc: 'Hình chiếu sườn phải thành gốm tại cao độ Y=0',
    },
    {
      id: 'top',
      name: `${topViewLabel} (Top)`,
      shortName: topViewLabel,
      code: 'VIEW-05',
      pos: [0, 5, 0],
      up: [0, 0, -1],
      axis: 'Trục Chiếu Bằng Y+ (+90°)',
      desc: `Hình chiếu trực giao từ trên nhìn thẳng vào ${topViewLabel.toLowerCase()}`,
    },
    {
      id: 'bottom',
      name: 'Nhìn Dưới Chân Đế (Bottom)',
      shortName: 'Nhìn Dưới Chân Đế',
      code: 'VIEW-06',
      pos: [0, -5, 0],
      up: [0, 0, 1],
      axis: 'Trục Chiếu Đứng Y- (-90°)',
      desc: 'Hình chiếu trực giao từ chân đế tiếp xúc mặt bàn',
    },
  ];

  // Render đồng bộ 100% 6 góc nhìn từ camera trực giao 3D Studio
  const views = configs.map((cfg) => {
    camera.position.set(...cfg.pos);
    camera.up.set(...cfg.up);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      code: cfg.code,
      axis: cfg.axis,
      desc: cfg.desc,
      previewImg: renderer.domElement.toDataURL('image/png'),
    };
  });

  geometry.dispose();
  if (handleMesh) {
    handleMesh.geometry.dispose();
    if (handleMesh.material) {
      if (handleMesh.material.map) handleMesh.material.map.dispose();
      handleMesh.material.dispose();
    }
  }
  material.dispose();
  glazeTexture.dispose();
  renderer.dispose();

  return views;
}

/**
 * Render 6 góc nhìn trực giao từ bất kỳ Object3D (mô hình GLB tải về từ AI)
 */
export function generateOrthographicViewsFromObject(object3D, modelType = 'bowl') {
  if (!object3D) return [];

  const width = 512;
  const height = 512;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0xfcfbf9, 1.0); // Fill góc đen → màu kem studio
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfcfbf9);

  // Ánh sáng Studio
  const ambientLight = new THREE.AmbientLight(0xfff5eb, 1.3);
  scene.add(ambientLight);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(4, 5, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xd4e5ff, 1.1);
  fillLight.position.set(-4, 3, -2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffecd2, 1.4);
  rimLight.position.set(0, -3, -4);
  scene.add(rimLight);

  const cloneObj = object3D.clone(true);
  scene.add(cloneObj);

  const frustumSize = 2.8;
  const camera = new THREE.OrthographicCamera(
    -frustumSize / 2, frustumSize / 2,
    frustumSize / 2, -frustumSize / 2,
    0.1, 20
  );

  const configs = [
    { id: 'front', name: 'Chính Diện (Front)', shortName: 'Chính diện (0°)', code: 'VIEW-01', pos: [0, 0, 5], up: [0, 1, 0] },
    { id: 'back', name: 'Mặt Sau (Back)', shortName: 'Mặt sau (180°)', code: 'VIEW-02', pos: [0, 0, -5], up: [0, 1, 0] },
    { id: 'left', name: 'Cạnh Trái (Left)', shortName: 'Cạnh trái (-90°)', code: 'VIEW-03', pos: [-5, 0, 0], up: [0, 1, 0] },
    { id: 'right', name: 'Cạnh Phải (Right)', shortName: 'Cạnh phải (+90°)', code: 'VIEW-04', pos: [5, 0, 0], up: [0, 1, 0] },
    { id: 'top', name: 'Nhìn Trên (Top)', shortName: 'Nhìn Trên (Top)', code: 'VIEW-05', pos: [0, 5, 0], up: [0, 0, -1] },
    { id: 'bottom', name: 'Nhìn Dưới (Bottom)', shortName: 'Nhìn Dưới (Bottom)', code: 'VIEW-06', pos: [0, -5, 0], up: [0, 0, 1] },
  ];

  const views = configs.map((cfg) => {
    camera.position.set(...cfg.pos);
    camera.up.set(...cfg.up);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return {
      id: cfg.id,
      name: cfg.name,
      shortName: cfg.shortName,
      code: cfg.code,
      previewImg: renderer.domElement.toDataURL('image/png'),
    };
  });

  renderer.dispose();
  return views;
}

