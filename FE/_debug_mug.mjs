import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3335/');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Phác thảo mẫu' }).first().click();
await page.waitForTimeout(500);
await page.getByLabel('Nhập mô tả ý tưởng gốm sứ').fill('bình hoa gốm men xanh đồng');
await page.getByRole('button', { name: 'Phác thảo 2D' }).click();
await page.waitForTimeout(6000);
// Save mug render to file (vì ta làm test studio-3d không phải ai-creator)
// Thay vào đó render mug 3D bằng generateOrthographicViews rồi lưu PNG
const data = await page.evaluate(async () => {
  const ortho = await import('/src/utils/orthographicRenderer.js');
  const views = ortho.generateOrthographicViews(null, 'mug', '#EAE6DC', 0.9, null, 'none', '', 'Men Trắng', null, 'none');
  const front = views.find((v) => v.id === 'front');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = front.previewImg; });
  return new Promise((resolve) => {
    img.onload = () => {
      const S = 512;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, S, S);
      const dataUrl = canvas.toDataURL('image/png');
      resolve({ dataUrl, jpeg: canvas.toDataURL('image/jpeg', 0.8) });
    };
    img.onerror = (e) => resolve({ error: 'img load fail' });
  });
});
console.log('DATA_URL_LEN:', data.jpeg.length);
// Save để xem hình
await page.evaluate(() => {
  const canvas = new OffscreenCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  // placeholder: sẽ render bằng code khác
});
console.log('READY');
await browser.close();
