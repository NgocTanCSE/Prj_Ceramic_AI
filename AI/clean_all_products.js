/**
 * clean_all_products.js
 * 
 * Pipeline AI xử lý làm sạch ảnh gốm:
 * 1. Đọc ảnh từ FE/src/data/raw/*.jpg
 * 2. Chạy model AI (ISNet ONNX qua @imgly/background-removal-node) để bóc tách,
 *    xóa sạch toàn bộ bối cảnh bừa bộn, banner quảng cáo, khung viền rác.
 * 3. Dùng Sharp để compositing phôi gốm lên nền studio xám mộc nhẹ nhàng (#FAF8F5)
 *    chuẩn catalogue mỹ nghệ atelier (căn giữa, cân đối tỷ lệ).
 * 4. Lưu vào:
 *    - FE/src/data/processed/{id}.png
 *    - FE/public/assets/products/{id}.png (để Vite serve trực tiếp cho web)
 * 5. Cập nhật lại đường dẫn ảnh trong FE/src/data/ecommerce_pottery_products.json
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
const jsonPath = path.resolve(__dirname, '../FE/src/data/ecommerce_pottery_products.json');
const toolsJsonPath = path.resolve(__dirname, '../tools/output/ecommerce_pottery_products.json');

// Đảm bảo các thư mục tồn tại
[processedDir, publicDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Kích thước chuẩn studio: 750x750, nền màu gốm mộc xám sáng #F8F7F4
const CANVAS_SIZE = 750;
const STUDIO_BG_COLOR = { r: 248, g: 247, b: 244, alpha: 1 };

async function processOneProduct(productId) {
  const rawFile = path.join(rawDir, `${productId}.jpg`);
  if (!fs.existsSync(rawFile)) {
    console.warn(`[!] Không tìm thấy file raw: ${rawFile}`);
    return false;
  }

  // 1. AI tách nền loại bỏ banner & bối cảnh
  const blob = await removeBackground(rawFile);
  const cutBuffer = Buffer.from(await blob.arrayBuffer());

  // 2. Dùng Sharp resize phôi sao cho cân đối ở giữa nền studio sạch
  const resizedPottery = await sharp(cutBuffer)
    .resize(600, 600, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  // 3. Ghép phôi lên phông nền studio mộc (chuẩn như Ảnh 1)
  const finalImageBuffer = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: STUDIO_BG_COLOR,
    }
  })
    .composite([
      {
        input: resizedPottery,
        gravity: 'center',
      }
    ])
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();

  // 4. Lưu ra processed và public/assets/products
  const processedPath = path.join(processedDir, `${productId}.png`);
  const publicPath = path.join(publicDir, `${productId}.png`);

  fs.writeFileSync(processedPath, finalImageBuffer);
  fs.writeFileSync(publicPath, finalImageBuffer);

  return true;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🤖 BẮT ĐẦU PIPELINE AI XỬ LÝ LÀM SẠCH ẢNH GỐM SỨ (STUDIO CLEAN)');
  console.log('═══════════════════════════════════════════════════════════════');

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const products = jsonData.products || [];

  console.log(`Tổng số sản phẩm cần AI làm sạch: ${products.length}\n`);

  let successCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`[${i + 1}/${products.length}] Đang xử lý AI cho: ${p.id} (${p.name.slice(0, 35)}...)`);
    
    try {
      const ok = await processOneProduct(p.id);
      if (ok) {
        // Cập nhật đường dẫn sang ảnh processed local
        const localUrl = `/assets/products/${p.id}.png`;
        p.image = localUrl;
        p.thumbnail = localUrl;
        console.log(`   -> ✅ Hoàn tất! Đã lưu ảnh studio clean vào: /assets/products/${p.id}.png`);
        successCount++;
      }
    } catch (err) {
      console.error(`   -> ❌ Lỗi xử lý ${p.id}:`, err.message);
    }
  }

  // Cập nhật lại file JSON
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  if (fs.existsSync(path.dirname(toolsJsonPath))) {
    fs.writeFileSync(toolsJsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`🎉 HOÀN TẤT: Đã làm sạch thành công ${successCount}/${products.length} ảnh!`);
  console.log('📁 Thư mục lưu ảnh đã xử lý: FE/src/data/processed/ và FE/public/assets/products/');
  console.log('📄 Đã cập nhật file JSON trỏ về ảnh studio cục bộ.');
  console.log('═══════════════════════════════════════════════════════════════');
}

run();
