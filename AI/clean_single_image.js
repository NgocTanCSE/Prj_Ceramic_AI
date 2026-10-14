/**
 * clean_single_image.js
 * 
 * Module tái sử dụng:
 * Làm sạch 1 ảnh bất kỳ (dành cho tính năng upload ảnh của người dùng tại AICoCreatorScreen):
 * Nhận đầu vào: Buffer / File path / Base64 ảnh người dùng chụp/upload
 * Xử lý: Tách nền bằng AI -> Đặt lên nền studio chuẩn 1:1 hoặc trả về PNG trong suốt
 * Đầu ra: Buffer PNG sạch chỉ có đúng vật thể phôi gốm duy nhất
 */

import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';

const CANVAS_SIZE = 750;
const STUDIO_BG_COLOR = { r: 248, g: 247, b: 244, alpha: 1 };

export async function cleanPotteryImage(inputSource, options = { returnTransparent: false }) {
  // 1. Chạy AI bóc tách nền
  const blob = await removeBackground(inputSource);
  const cutBuffer = Buffer.from(await blob.arrayBuffer());

  if (options.returnTransparent) {
    return cutBuffer;
  }

  // 2. Canh chỉnh kích thước phôi ở giữa khung ảnh studio
  const resizedPottery = await sharp(cutBuffer)
    .resize(600, 600, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  // 3. Đặt lên nền studio xám mộc sạch chuẩn mỹ nghệ
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

  return finalImageBuffer;
}

export default cleanPotteryImage;
