/**
 * download_raw_images.js
 * 
 * Script:
 * 1. Đọc danh sách 28 sản phẩm từ FE/src/data/ecommerce_pottery_products.json
 * 2. Tải toàn bộ ảnh gốc từ Tiki CDN về thư mục FE/src/data/raw/
 * 3. Đổi tên chuẩn hóa theo ID sản phẩm:
 *    - pottery-vase-001.jpg
 *    - pottery-mug-001.jpg
 *    - pottery-bowl-001.jpg
 *    - pottery-plate-001.jpg
 *    - pottery-sculpture-001.jpg
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, '../FE/src/data/ecommerce_pottery_products.json');
const rawDir = path.resolve(__dirname, '../FE/src/data/raw');

if (!fs.existsSync(rawDir)) {
  fs.mkdirSync(rawDir, { recursive: true });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    // Nếu URL không hợp lệ
    if (!url || !url.startsWith('http')) {
      return resolve(false);
    }

    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Redirect
        return downloadImage(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return resolve(false);
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      resolve(false);
    });
  });
}

async function run() {
  console.log('--- 1. BẮT ĐẦU TẢI ẢNH RAW VÀ ĐỔI TÊN CHUẨN THEO ID ---');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const products = data.products || [];

  console.log(`Tìm thấy ${products.length} sản phẩm cần tải ảnh.`);

  let successCount = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const targetFilename = `${p.id}.jpg`;
    const targetPath = path.join(rawDir, targetFilename);

    console.log(`[${i + 1}/${products.length}] Đang tải ${p.id} (${p.category}): ${p.name.slice(0, 40)}...`);
    
    // Ưu tiên ảnh 750x750, fallback thumbnail
    const imgUrl = p.image || p.thumbnail;
    const ok = await downloadImage(imgUrl, targetPath);

    if (ok) {
      console.log(`   -> Đã lưu vào raw/${targetFilename}`);
      successCount++;
    } else {
      console.warn(`   -> Lỗi khi tải ảnh từ ${imgUrl}`);
    }
  }

  console.log(`\n✅ HOÀN TẤT TẢI RAW: Đã lưu thành công ${successCount}/${products.length} ảnh vào FE/src/data/raw/`);
}

run();
