import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import JSZip from 'jszip';
import { createCeramicGeometry } from './orthographicRenderer.js';
import { createCeramicTextureCanvas } from './ceramicTextureGenerator.js';

/**
 * ceramicExporter.js
 * 
 * Bộ công cụ xuất và tải xuống trọn gói hồ sơ kỹ thuật gốm:
 * - File 3D (.obj) chuẩn công nghiệp (vertices, normals, UVs).
 * - Bộ 6 ảnh chiếu trực giao (VIEW-01 đến VIEW-06) định dạng PNG.
 * - Texture men gốm và hoa văn (.png).
 * - Bản đặc tả kỹ thuật lò nung và công nghệ gốm (.json).
 * - Đóng gói tất cả vào 1 file .ZIP duy nhất tải trực tiếp trên trình duyệt.
 */

export async function downloadCeramicPackage({
  title = 'Gom_Bien_Hoa_3D',
  modelType = 'bowl',
  lathePoints = null,
  suggestedGlaze = null,
  rimStyle = 'brown',
  pattern = 'none',
  patternImage = null,
  customText = '',
  views = [],
  dimensions = '',
  feasibility = null,
  glbFileUrl = null,
}) {
  const zip = new JSZip();
  const safeTitle = (title || 'Gom_Viet_3D').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');

  // 1a. Đóng gói file 3D (.GLB) nếu có từ AI
  if (glbFileUrl) {
    try {
      const glbRes = await fetch(glbFileUrl);
      if (glbRes.ok) {
        const glbBlob = await glbRes.blob();
        zip.file(`${safeTitle}_Model_AI.glb`, glbBlob);
      }
    } catch (e) {
      console.warn('Không tải được GLB vào zip:', e);
    }
  }

  // 1b. Tạo và xuất mô hình 3D (.OBJ)
  try {
    const geometry = createCeramicGeometry(modelType, lathePoints);
    const material = new THREE.MeshStandardMaterial({ name: 'CeramicGlazeMaterial' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = safeTitle;

    const group = new THREE.Group();
    group.add(mesh);

    // Nếu là cốc có quai (mug), thêm quai cầm 3D
    if (modelType === 'mug') {
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0.94, 0.55, 0),
        new THREE.Vector3(1.68, 0.45, 0),
        new THREE.Vector3(1.62, -0.15, 0),
        new THREE.Vector3(0.88, -0.42, 0)
      );
      const handleGeo = new THREE.TubeGeometry(curve, 32, 0.11, 16, false);
      const handleMat = new THREE.MeshStandardMaterial({ name: 'HandleGlazeMaterial' });
      const handleMesh = new THREE.Mesh(handleGeo, handleMat);
      handleMesh.name = 'Handle_QuaiCam';
      group.add(handleMesh);
    }

    const exporter = new OBJExporter();
    const objOutput = exporter.parse(group);
    zip.file(`${safeTitle}_Model_3D.obj`, objOutput);
  } catch (err) {
    console.error('Lỗi khi xuất OBJ:', err);
  }

  // 2. Xuất texture men gốm (.PNG)
  try {
    const textureCanvas = createCeramicTextureCanvas({
      glazeColor: suggestedGlaze?.hex || '#EDE8DC',
      glazeName: suggestedGlaze?.name || 'Men Sứ Trắng Ngà',
      pattern,
      patternImage,
      rimStyle,
      customText,
      modelType,
      width: 1024,
      height: 1024,
    });
    const textureDataUrl = textureCanvas.toDataURL('image/png');
    const textureBase64 = textureDataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file(`Texture_Men_Gom_1024.png`, textureBase64, { base64: true });
  } catch (err) {
    console.error('Lỗi khi xuất texture:', err);
  }

  // 3. Đóng gói bộ 6 ảnh chiếu 2D trực giao (VIEW-01 đến VIEW-06)
  const viewsFolder = zip.folder('Anh_Chieu_6_Mat_2D');
  if (Array.isArray(views) && views.length > 0) {
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const previewImg = v.previewImg;
      if (previewImg && typeof previewImg === 'string' && previewImg.startsWith('data:image')) {
        const base64Data = previewImg.replace(/^data:image\/\w+;base64,/, '');
        const filename = `${v.code || `VIEW-0${i+1}`}_${(v.shortName || v.name || 'Goc_Nhin').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.png`;
        viewsFolder.file(filename, base64Data, { base64: true });
      }
    }
  }

  // 4. Xuất file thông số kỹ thuật kỹ nghệ (.JSON)
  const specData = {
    tieuDe: title,
    dangGom: modelType,
    quyCachKichThuoc: dimensions || 'Theo tỷ lệ tiêu bản 3D',
    menGom: {
      tenMen: suggestedGlaze?.name || 'Men Gốm Nghệ Thuật',
      maMauHex: suggestedGlaze?.hex || '#EDE8DC',
      doNhamRoughness: suggestedGlaze?.roughness || 0.16,
    },
    vienMieng: {
      kieuVien: rimStyle,
      moTa: rimStyle === 'gold' ? 'Chỉ vàng hoàng kim' : (rimStyle === 'brown' ? 'Nâu da lươn oxit sắt' : 'Men mộc không viền'),
    },
    hoaVanTrangTri: {
      loaiHoaVan: pattern,
      nguonGoc: patternImage ? 'Tự động bóc tách từ phôi ảnh thật' : 'Vẽ tay mỹ nghệ',
    },
    thongSoLoNung: feasibility || {
      quyTrinh: 'Nung sơ mộc 800°C → Nung phủ men lò rồng củi 1220°C',
      loaiDat: 'Đất sét Tân Vạn lọc kỹ pha phù sa sông Đồng Nai',
      doCoNgot: '9.2%',
    },
    ngayXuatHoSo: new Date().toISOString(),
    phanMem: 'Gốm Việt AI Co-Creator Engine 3D',
  };
  zip.file(`Ho_So_Ky_Thuat_San_Xuat.json`, JSON.stringify(specData, null, 2));

  // 5. Tạo file zip và trigger tải về trên trình duyệt
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${safeTitle}_Ho_So_3D_va_6_Mat.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return true;
}

/**
 * Export mô hình 3D tạo procedural (lathe) thành .glb bằng GLTFExporter.
 * Dùng cho trường hợp KHÔNG có glbFileUrl từ AI (rule-engine / procedural).
 * Trả về ArrayBuffer của file .glb (binary). Caller (browser) rồi blob+download.
 */
export async function exportGLB({
  modelType = 'bowl',
  lathePoints = null,
  suggestedGlaze = null,
  glazeName = null,
  roughness = null,
  pattern = 'none',
  patternImage = null,
  customText = '',
  rimStyle = 'brown',
  onProgress = null,
} = {}) {
  const geometry = createCeramicGeometry(modelType, lathePoints);
  const textureCanvas = createCeramicTextureCanvas({
    glazeColor: suggestedGlaze?.hex || '#EDE8DC',
    glazeName: glazeName || suggestedGlaze?.name || 'Men Sứ Trắng Ngà',
    pattern,
    patternImage,
    rimStyle,
    customText,
    modelType,
    width: 1024,
    height: 1024,
  });

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  const material = new THREE.MeshPhysicalMaterial({
    name: 'CeramicGlazeMaterial',
    roughness: (roughness != null ? roughness : suggestedGlaze?.roughness) ?? 0.16,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    map: texture,
    envMapIntensity: 1.2,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ceramic_body';
  const group = new THREE.Group();
  group.add(mesh);

  // Quai cốc (mug) — đồng bộ mesh
  if (modelType === 'mug') {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.94, 0.55, 0),
      new THREE.Vector3(1.68, 0.45, 0),
      new THREE.Vector3(1.62, -0.15, 0),
      new THREE.Vector3(0.88, -0.42, 0)
    );
    const handleGeo = new THREE.TubeGeometry(curve, 32, 0.11, 16, false);
    const handleMat = material.clone();
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.name = 'Handle_QuaiCam';
    group.add(handleMesh);
  }

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(
    group,
    onProgress ? (p) => onProgress(p) : undefined,
    { binary: true }
  );
  return glb; // ArrayBuffer
}

/**
 * Tải xuống trực tiếp một file .glb đã có (ví dụ từ SF3D) — dùng cho CeramicCanvas3D đã load glbUrl.
 * Không cần GLTFExporter; fetch glbFileUrl -> blob -> anchor download.
 */
export async function downloadGLBFromUrl(glbFileUrl, filename = 'model.glb') {
  if (!glbFileUrl) throw new Error('glbFileUrl required');
  const res = await fetch(glbFileUrl);
  if (!res.ok) throw new Error(`Download glb thất bại: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
