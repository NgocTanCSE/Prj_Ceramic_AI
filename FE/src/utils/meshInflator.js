import * as THREE from 'three';

/**
 * meshInflator.js — "Đúc Khuôn Nước Từ Ảnh 2D" (Free-form Silhouette Mesh Inflation)
 * 
 * Tái tạo hình khối 3D gốm sứ trực tiếp từ hình bóng 2D của ảnh chụp/bản vẽ:
 * - Không phụ thuộc AI bên ngoài (chạy 100% Client-side bằng JavaScript).
 * - Bất kỳ hình dạng gốm tự do nào (bình méo, đĩa lá, ấm có quai, chậu uốn lượn) đều
 *   được "bơm phồng" thành khối 3D chân thực theo đúng đường viền thật.
 * - Giải thuật: 2D Silhouette Mask ➔ Exact Euclidean Distance Transform ➔ 3D Mesh Inflation.
 */

// 1. Phép biến đổi khoảng cách Euclid chính xác O(N) (Felzenszwalb & Huttenlocher)
function edt1d(f, n) {
  const d = new Float32Array(n);
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}

function computeEuclideanDistanceTransform(mask, w, h) {
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    f[i] = mask[i] ? Infinity : 0;
  }

  // Pass 1: Columns
  const colIn = new Float32Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) colIn[y] = f[y * w + x];
    const colOut = edt1d(colIn, h);
    for (let y = 0; y < h; y++) f[y * w + x] = colOut[y];
  }

  // Pass 2: Rows
  const rowIn = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) rowIn[x] = f[y * w + x];
    const rowOut = edt1d(rowIn, w);
    for (let x = 0; x < w; x++) f[y * w + x] = Math.sqrt(rowOut[x]);
  }

  return f;
}

/**
 * Trích xuất Mask đối tượng từ ảnh (Image/Canvas/ImageData)
 */
export function extractSilhouetteMaskFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Nhận diện màu nền từ 4 góc ảnh
  const corners = [
    0,
    (w - 1) * 4,
    ((h - 1) * w) * 4,
    ((h - 1) * w + w - 1) * 4
  ];

  let bgR = 255, bgG = 255, bgB = 255, bgCount = 0;
  for (const c of corners) {
    if (data[c + 3] > 20) {
      bgR += data[c];
      bgG += data[c + 1];
      bgB += data[c + 2];
      bgCount++;
    }
  }
  if (bgCount > 0) {
    bgR = Math.round(bgR / (bgCount + 1));
    bgG = Math.round(bgG / (bgCount + 1));
    bgB = Math.round(bgB / (bgCount + 1));
  }

  const mask = new Uint8Array(w * h);
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let objectPixels = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
      // Pixel thuộc đối tượng nếu không trong suốt và khác màu nền
      if (a > 30 && diff > 35) {
        mask[y * w + x] = 1;
        objectPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    mask,
    w,
    h,
    bbox: { minX, maxX, minY, maxY, count: objectPixels },
    isEmpty: objectPixels < 50
  };
}

/**
 * "Bơm Phồng Khuôn Đúc" — Tạo Mesh 3D BufferGeometry từ mặt nạ đường viền tự do
 * @param {HTMLCanvasElement|HTMLImageElement} imageSource 
 * @param {object} options 
 * @returns {THREE.BufferGeometry}
 */
export function inflateImageToCeramicGeometry(imageSource, options = {}) {
  const targetResolution = options.resolution || 96; // Lưới 96x96 mượt mà 60fps
  const depthScale = options.depthScale || 0.85;

  // Tạo canvas chuẩn hóa kích thước lưới
  const offscreen = document.createElement('canvas');
  offscreen.width = targetResolution;
  offscreen.height = targetResolution;
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(imageSource, 0, 0, targetResolution, targetResolution);

  const { mask, w, h, bbox, isEmpty } = extractSilhouetteMaskFromCanvas(offscreen);
  if (isEmpty) {
    return null;
  }

  const distField = computeEuclideanDistanceTransform(mask, w, h);
  let maxD = 0;
  for (let i = 0; i < w * h; i++) {
    if (distField[i] > maxD) maxD = distField[i];
  }
  if (maxD <= 0) return null;

  const { minX, maxX, minY, maxY } = bbox;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) / 2;

  // Lập bản đồ đỉnh (Vertex mapping)
  const vertMap = new Int32Array(w * h).fill(-1);
  const positions = [];
  const uvs = [];
  const indices = [];

  let vertCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx]) continue;

      const d = distField[idx];
      // Tọa độ chuẩn hóa trong không gian 3D Studio: Chiều cao = 2.0 (từ Y=-1.0 đến Y=+1.0)
      const nx = Number((((x - centerX) / spanY) * 2.0).toFixed(4));
      const ny = Number((((maxY - y) / spanY) * 2.0 - 1.0).toFixed(4));

      // Bơm phồng tự nhiên theo hình cầu/bán nguyệt dựa trên khoảng cách tới mép
      const normD = Math.min(1.0, d / maxD);
      // Phương trình vòm phồng elip mượt mà
      const nz = Number((Math.sqrt(Math.max(0, 1 - (1 - normD) ** 2)) * (maxD / spanY) * 2.0 * depthScale).toFixed(4));

      vertMap[idx] = vertCount;

      // 1. Đỉnh mặt trước (+Z)
      positions.push(nx, ny, nz);
      uvs.push((x - minX) / spanX, (maxY - y) / spanY);

      // 2. Đỉnh mặt sau (-Z)
      positions.push(nx, ny, -nz);
      uvs.push(1 - (x - minX) / spanX, (maxY - y) / spanY);

      vertCount += 2;
    }
  }

  // Nối tam giác (Triangulation) cho cả 2 mặt trước và sau
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i00 = vertMap[y * w + x];
      const i10 = vertMap[y * w + (x + 1)];
      const i01 = vertMap[(y + 1) * w + x];
      const i11 = vertMap[(y + 1) * w + (x + 1)];

      // 4 ô đều thuộc vật thể
      if (i00 !== -1 && i10 !== -1 && i01 !== -1 && i11 !== -1) {
        // Mặt trước (CCW)
        indices.push(i00, i10, i11);
        indices.push(i00, i11, i01);
        // Mặt sau (CW)
        indices.push(i00 + 1, i11 + 1, i10 + 1);
        indices.push(i00 + 1, i01 + 1, i11 + 1);
      } else {
        // Tam giác biên
        if (i00 !== -1 && i10 !== -1 && i01 !== -1) {
          indices.push(i00, i10, i01);
          indices.push(i00 + 1, i01 + 1, i10 + 1);
        } else if (i10 !== -1 && i11 !== -1 && i01 !== -1) {
          indices.push(i10, i11, i01);
          indices.push(i10 + 1, i01 + 1, i11 + 1);
        } else if (i00 !== -1 && i11 !== -1 && i01 !== -1) {
          indices.push(i00, i11, i01);
          indices.push(i00 + 1, i01 + 1, i11 + 1);
        } else if (i00 !== -1 && i10 !== -1 && i11 !== -1) {
          indices.push(i00, i10, i11);
          indices.push(i00 + 1, i11 + 1, i10 + 1);
        }
      }
    }
  }

  // Hàn mép kín (Seam stitching) nối liền mặt trước và mặt sau dọc theo đường biên
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const v = vertMap[idx];
      if (v === -1) continue;

      // Mép phải
      if (x < w - 1 && vertMap[idx + 1] === -1) {
        if (y < h - 1 && vertMap[(y + 1) * w + x] !== -1) {
          const vNext = vertMap[(y + 1) * w + x];
          indices.push(v, v + 1, vNext + 1);
          indices.push(v, vNext + 1, vNext);
        }
      }
      // Mép dưới
      if (y < h - 1 && vertMap[(y + 1) * w + x] === -1) {
        if (x < w - 1 && vertMap[idx + 1] !== -1) {
          const vNext = vertMap[idx + 1];
          indices.push(v, vNext, vNext + 1);
          indices.push(v, vNext + 1, v + 1);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

export const inflateSilhouetteToMesh = inflateImageToCeramicGeometry;

/**
 * Trích xuất đường cong tiết diện đối xứng chuẩn xác từ ảnh (Symmetric Half-Profile)
 * Khắc phục hoàn toàn lỗi quai cầm hoặc bóng đổ làm méo phôi khi dùng Bàn Xoay.
 */
export function extractSymmetricLatheProfileFromMask(mask, w, h, bbox) {
  const { minX, maxX, minY, maxY } = bbox;
  const spanY = Math.max(1, maxY - minY);
  const centerX = (minX + maxX) / 2;

  const numSamples = 40;
  const rawRadii = [];

  for (let i = 0; i <= numSamples; i++) {
    const sampleY = Math.round(maxY - (i / numSamples) * spanY);
    let left = centerX;
    let right = centerX;

    for (let x = 0; x < w; x++) {
      if (mask[sampleY * w + x]) {
        left = x;
        break;
      }
    }
    for (let x = w - 1; x >= 0; x--) {
      if (mask[sampleY * w + x]) {
        right = x;
        break;
      }
    }

    const rLeft = Math.max(2, centerX - left);
    const rRight = Math.max(2, right - centerX);

    // Lọc đối xứng: Nếu 1 bên có quai cầm hoặc bóng đổ (lớn hơn bên kia > 25%),
    // lấy bên thon gọn hơn để giữ đúng thân gốm xoay tròn không bị méo!
    let r = Math.abs(rLeft - rRight) > Math.min(rLeft, rRight) * 0.25
      ? Math.min(rLeft, rRight)
      : (rLeft + rRight) / 2;

    const normY = Number((-0.85 + (i / numSamples) * 1.85).toFixed(3));
    const normR = Number(((r / spanY) * 1.45).toFixed(3));
    rawRadii.push({ r: Math.max(0.12, normR), y: normY });
  }

  // Xây dựng các điểm lathePoints khép kín (có chân đế, vành miệng và lòng trong)
  const lathePoints = [];
  // 1. Tâm đáy ngoài
  lathePoints.push({ x: 0, y: rawRadii[0].y });
  lathePoints.push({ x: rawRadii[0].r, y: rawRadii[0].y });

  // 2. Thân ngoài từ chân lên miệng
  for (let i = 1; i < rawRadii.length; i++) {
    lathePoints.push({ x: rawRadii[i].r, y: rawRadii[i].y });
  }

  // 3. Vành miệng bo tròn
  const rim = rawRadii[rawRadii.length - 1];
  const wallThick = Math.max(0.08, rim.r * 0.12);
  lathePoints.push({ x: Math.max(0.05, Number((rim.r - wallThick * 0.4).toFixed(3))), y: Number((rim.y + 0.05).toFixed(3)) });
  lathePoints.push({ x: Math.max(0.05, Number((rim.r - wallThick).toFixed(3))), y: rim.y });

  // 4. Lòng trong khoét sâu xuống đáy
  for (let i = rawRadii.length - 2; i >= 1; i--) {
    const inR = Math.max(0.05, rawRadii[i].r - wallThick);
    lathePoints.push({ x: Number(inR.toFixed(3)), y: Number((rawRadii[i].y + 0.02).toFixed(3)) });
  }
  // 5. Tâm đáy lòng trong
  lathePoints.push({ x: 0, y: Number((rawRadii[0].y + 0.15).toFixed(3)) });

  return lathePoints;
}
