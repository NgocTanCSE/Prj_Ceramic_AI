/**
 * auto_clean_pipeline.js
 * 
 * Hệ thống tự động xử lý làm sạch ảnh gốm (AI Background Removal + Auto Text Removal):
 * 1. Phát hiện file ảnh mới trong: FE/src/data/raw/
 * 2. Tách nền bằng mô hình AI ISNet
 * 3. Thuật toán LCC (Largest Connected Component) phân tích Alpha Mask:
 *    - Xác định khối phôi gốm chính (khối liên thông lớn nhất)
 *    - Tự động xóa sạch 100% các cụm chữ trôi nổi, banner, watermark số điện thoại
 * 4. Đặt phôi sạch vào trung tâm khung Studio mộc #F8F7F4 (750x750px)
 * 5. Lưu vào:
 *    - FE/src/data/processed/{id}.png
 *    - FE/public/assets/products/{id}.png
 * 6. Tự động DỌN DẸP / XÓA file raw trong FE/src/data/raw/ sau khi hoàn tất.
 * 
 * Cách dùng:
 * - Chạy 1 lần xử lý tất cả: node AI/auto_clean_pipeline.js
 * - Chạy chế độ Watcher lắng nghe liên tục: node AI/auto_clean_pipeline.js --watch
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { removeBackground } from '@imgly/background-removal-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawDir = path.resolve(__dirname, '../FE/src/data/raw');
const processedDir = path.resolve(__dirname, '../FE/src/data/processed');
const publicDir = path.resolve(__dirname, '../FE/public/assets/products');

// Kích thước chuẩn studio
const CANVAS_SIZE = 750;
const STUDIO_BG_COLOR = { r: 248, g: 247, b: 244, alpha: 1 };

[rawDir, processedDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Trích xuất chiếc bát đỉnh chóp nguyên vẹn nhất từ cụm 10 bát (pottery-bowl-002)
 */
export async function extractSingleBowlFromBowl002(imageSource, options = {}) {
  let inputBuffer;
  if (Buffer.isBuffer(imageSource)) {
    inputBuffer = imageSource;
  } else if (typeof imageSource === 'string') {
    if (imageSource.startsWith('data:image')) {
      inputBuffer = Buffer.from(imageSource.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } else {
      inputBuffer = fs.readFileSync(imageSource);
    }
  }

  // Tọa độ chiếc bát trên cùng unoccluded trong cụm
  const cropBox = { left: 298, top: 210, width: 146, height: 114 };
  const cropped = await sharp(inputBuffer)
    .extract(cropBox)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cw = cropped.info.width;
  const ch = cropped.info.height;
  const cdata = cropped.data;

  // Mặt nạ mịn dạng parabol khử bỏ phần 2 chiếc bát đỡ phía dưới
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const idx = (y * cw + x) * 4;
      if (y >= 107) {
        cdata[idx + 3] = 0;
      } else if (y >= 75) {
        const t = (y - 75) / (107 - 75);
        const inset = Math.round(t * t * 28);
        if (x < inset || x > cw - inset) {
          cdata[idx + 3] = 0;
        }
      }
    }
  }

  const cleanBowlBuf = await sharp(cdata, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
  
  if (options.returnTransparent) {
    return cleanBowlBuf;
  }

  // Resize về chuẩn studio (500px chiều rộng, đặt giữa khung 750x750)
  const targetW = 500;
  const targetH = Math.round(ch * (targetW / cw));
  const resizedBowl = await sharp(cleanBowlBuf).resize(targetW, targetH).toBuffer();

  const studioCanvas = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: STUDIO_BG_COLOR,
    }
  })
    .composite([{ input: resizedBowl, gravity: 'center' }])
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();

  return studioCanvas;
}

/**
 * Thuật toán AI + LCC Text Removal + Single Salient Object Isolator:
 * Giữ lại khối gốm chính, xóa bỏ chữ in, watermark và trích xuất 1 vật thể toàn vẹn nhất nếu có nhiều món
 */
export async function cleanAndRemoveText(imageSource, options = {}) {
  const isPotteryBowl002 = 
    (typeof imageSource === 'string' && imageSource.includes('pottery-bowl-002')) || 
    options.sampleId === 'pottery-bowl-002';

  // Không dùng hàm crop thủ công cắt cụt ảnh. Sử dụng bộ lọc liên thông tự động (CCL Single Salient Object Isolator) ở bên dưới.

  // Bước 1: AI tách nền
  const pkgDist = path.resolve(__dirname, 'node_modules/@imgly/background-removal-node/dist');
  const publicPath = `file://${pkgDist}/`;
  const blob = await removeBackground(imageSource, { publicPath });
  const cutBuffer = Buffer.from(await blob.arrayBuffer());

  // Bước 2: Lấy dữ liệu thô RGBA (đảm bảo luôn có 4 kênh alpha)
  const { data, info } = await sharp(cutBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const visited = new Uint8Array(w * h);

  const significantComponents = [];
  let largestComponent = [];
  let maxCount = 0;

  // BFS tìm tất cả các vùng liên thông (Connected Component Labeling)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pIdx = y * w + x;
      // Bỏ qua pixel đã duyệt hoặc pixel trong suốt
      if (visited[pIdx] || data[pIdx * 4 + 3] < 80) continue;

      const queue = [pIdx];
      visited[pIdx] = 1;
      const currentComponent = [];

      let head = 0;
      let sumX = 0, sumY = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        currentComponent.push(curr);

        const cy = Math.floor(curr / w);
        const cx = curr % w;
        sumX += cx;
        sumY += cy;

        const neighbors = [
          [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            if (!visited[nIdx] && data[nIdx * 4 + 3] >= 80) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      if (currentComponent.length > 500) {
        const avgX = sumX / currentComponent.length;
        const avgY = sumY / currentComponent.length;
        const distFromCenter = Math.hypot(avgX - w / 2, avgY - h / 2);
        significantComponents.push({
          pixels: currentComponent,
          size: currentComponent.length,
          distFromCenter,
        });
      }

      if (currentComponent.length > maxCount) {
        maxCount = currentComponent.length;
        largestComponent = currentComponent;
      }
    }
  }

  // Bước 3: Bộ lọc đa vật thể (Single Salient Object Filter)
  // Nếu phát hiện nhiều đối tượng và bật cờ isolateSingleObject -> Chọn đúng 1 đối tượng toàn vẹn nhất
  let chosenComponent = largestComponent;
  let isMultiObject = significantComponents.length > 1;

  if (options.isolateSingleObject !== false && significantComponents.length > 1) {
    // Đánh giá: ưu tiên diện tích lớn + gần trung tâm khung ảnh nhất (không bị cắt mép)
    significantComponents.sort((a, b) => {
      const scoreA = a.size / (1 + a.distFromCenter * 0.8);
      const scoreB = b.size / (1 + b.distFromCenter * 0.8);
      return scoreB - scoreA;
    });
    chosenComponent = significantComponents[0].pixels;
  }

  if (chosenComponent && chosenComponent.length > 500) {
    const cleanMask = new Uint8Array(w * h);
    for (const idx of chosenComponent) {
      cleanMask[idx] = 1;
    }

    for (let i = 0; i < w * h; i++) {
      if (!cleanMask[i]) {
        data[i * 4 + 3] = 0; // Gán trong suốt cho đối tượng phụ và chữ trôi nổi
      }
    }
  }

  // Bước 3.5: Lọc bỏ hộp quà / vỏ bìa carton phía sau bát/cốc (nếu có)
  if (options.filterPackaging) {
    for (let y = 0; y < Math.floor(h * 0.45); y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (data[idx * 4 + 3] > 0) {
          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          // Màu vàng carton, đỏ bao bì quà tặng hoặc viền nắp hộp
          const isYellowCarton = (r > 150 && g > 110 && b < 90 && r - b > 55);
          const isRedGiftBox = (r > 140 && g < 75 && b < 75);
          if (isYellowCarton || isRedGiftBox) {
            data[idx * 4 + 3] = 0;
          }
        }
      }
    }
  }

  // Bước 4: Tạo ảnh phôi PNG hợp lệ
  const cleanPngBuffer = await sharp(data, {
    raw: { width: w, height: h, channels: 4 }
  }).png().toBuffer();

  // Bước 5: Cắt sát viền phôi và tự động xoay đứng nếu phôi bị đặt nằm ngang
  let trimmedSharp = sharp(cleanPngBuffer).trim();
  const trimmedMeta = await trimmedSharp.metadata();

  let rotateAngle = options.rotate || 0;
  if (!rotateAngle && options.autoOrientStanding && trimmedMeta.width > trimmedMeta.height * 1.1) {
    // Phôi tượng/bình đứng nhưng tỷ lệ ngang > dọc -> Tự động xoay đứng lại (-90 độ)
    rotateAngle = -90;
  }

  if (rotateAngle) {
    const rotatedBuf = await sharp(cleanPngBuffer).rotate(rotateAngle).trim().toBuffer();
    trimmedSharp = sharp(rotatedBuf);
  }

  // Chuẩn hóa tỷ lệ thu phóng Studio ("10 cái như 1"):
  // Đảm bảo khoảng thở viền an toàn (Safe Margin ~120-130px), không bị lẹm viền và không cái to cái nhỏ
  const tW = trimmedMeta.width;
  const tH = trimmedMeta.height;
  const ar = tW / tH;

  let targetDim = 500;
  if (ar > 1.3) {
    // Dáng bè ngang (bát, khay)
    targetDim = 520;
  } else if (ar < 0.8) {
    // Dáng cao thon (bình hoa, tượng)
    targetDim = 530;
  } else {
    // Dáng tròn / vuông cân đối (đĩa tròn, ly cốc)
    targetDim = 490;
  }

  const isolatedPottery = await trimmedSharp
    .resize(targetDim, targetDim, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();

  // Bước 6: Đặt lên nền studio xám mộc sáng
  const finalStudioBuffer = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: STUDIO_BG_COLOR,
    }
  })
    .composite([
      {
        input: isolatedPottery,
        gravity: 'center',
      }
    ])
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();

  return finalStudioBuffer;
}

/**
 * Xử lý một file cụ thể và dọn dẹp file raw
 */
export async function processSingleRawFile(rawFilePath) {
  const fileName = path.basename(rawFilePath);
  const ext = path.extname(fileName);
  const id = path.basename(fileName, ext);

  console.log(`\n⚡ [AI PIPELINE] Đang xử lý file raw: ${fileName}...`);

  try {
    const isStandingItem = id.includes('sculpture') || id.includes('vase');
    const finalBuffer = await cleanAndRemoveText(rawFilePath, {
      autoOrientStanding: isStandingItem,
      filterPackaging: true,
    });

    const processedPath = path.join(processedDir, `${id}.png`);
    const publicPath = path.join(publicDir, `${id}.png`);

    fs.writeFileSync(processedPath, finalBuffer);
    fs.writeFileSync(publicPath, finalBuffer);
    console.log(`   -> ✅ Đã lưu ảnh sạch không chữ vào processed/${id}.png & public/`);

    // DỌN DẸP: Xóa file raw sau khi xử lý thành công theo đúng yêu cầu
    if (fs.existsSync(rawFilePath)) {
      fs.unlinkSync(rawFilePath);
      console.log(`   -> 🧹 Đã dọn dẹp (xóa) file raw: ${fileName}`);
    }

    return true;
  } catch (err) {
    console.error(`   -> ❌ Lỗi xử lý ${fileName}:`, err.message);
    return false;
  }
}

/**
 * Quét toàn bộ thư mục raw hiện tại
 */
async function processAllExistingRaw() {
  const files = fs.readdirSync(rawDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (files.length === 0) {
    console.log('Thư mục raw đang trống. Không có file nào cần xử lý.');
    return;
  }

  console.log(`Tìm thấy ${files.length} file trong FE/src/data/raw/. Đang tiến hành làm sạch...`);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fullPath = path.join(rawDir, f);
    console.log(`[${i + 1}/${files.length}]`);
    await processSingleRawFile(fullPath);
  }

  console.log('\n🎉 ĐÃ XỬ LÝ VÀ DỌN SẠCH TOÀN BỘ FILE RAW TRONG FE/src/data/raw/!');
}

/**
 * Chế độ Watcher: Lắng nghe thư mục raw tự động
 */
function startWatcher() {
  console.log(`\n👀 ĐANG LẮNG NGHE THƯ MỤC RAW: ${rawDir}`);
  console.log('Khi có file ảnh mới được đẩy vào raw, AI sẽ tự động tách nền, xóa chữ, đưa vào processed và xóa file raw.\n');

  let isBusy = false;
  const queue = new Set();

  fs.watch(rawDir, (eventType, filename) => {
    if (!filename || !/\.(jpg|jpeg|png|webp)$/i.test(filename)) return;
    const fullPath = path.join(rawDir, filename);

    if (eventType === 'rename' && fs.existsSync(fullPath)) {
      queue.add(fullPath);
      triggerQueue();
    }
  });

  async function triggerQueue() {
    if (isBusy || queue.size === 0) return;
    isBusy = true;

    for (const filePath of Array.from(queue)) {
      queue.delete(filePath);
      if (fs.existsSync(filePath)) {
        await processSingleRawFile(filePath);
      }
    }

    isBusy = false;
  }
}

// Chạy chính nếu file được gọi trực tiếp
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isWatchMode = process.argv.includes('--watch');

  if (isWatchMode) {
    processAllExistingRaw().then(() => {
      startWatcher();
    });
  } else {
    processAllExistingRaw();
  }
}
