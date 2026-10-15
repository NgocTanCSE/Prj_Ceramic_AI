import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Shape accuracy — mô hình 3D phải đúng silhouette ảnh đầu vào:
 * vẽ mask tổng hợp (bình/vase) → extractSymmetricLatheProfileFromMask →
 * LatheGeometry → render front view → đo silhouette IoU vs mask gốc.
 *
 * NOTE: dùng đúng hàm `generateOrthographicViews()` của project thay vì dựng
 * WebGL thủ công — vừa kiểm tra shape, vừa kiểm tra view-01 mà user nhìn.
 */

test.describe('Shape accuracy (silhouette từ ảnh)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('lathe từ mask bình → view front khớp silhouette IoU ≥ 0.85', async ({ page }) => {
    const iou = await page.evaluate(async () => {
      const infl = await import('/src/utils/meshInflator.js');
      const ortho = await import('/src/utils/orthographicRenderer.js');

      // 1) Mask tổng hợp: thân bình đối xứng (W=120,H=160 trong frame 160×200)
      const W = 160, H = 200;
      const cnv = document.createElement('canvas');
      cnv.width = W; cnv.height = H;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#333';
      // bình: chân rộng 60, thân bầu 100, cổ 44, miệng loe 52 (y từ 30→170)
      ctx.beginPath();
      ctx.moveTo(50, 170); ctx.lineTo(110, 170);          // chân
      ctx.quadraticCurveTo(112, 130, 128, 110);           // vai phải
      ctx.quadraticCurveTo(112, 70, 102, 60);             // eo phải
      ctx.lineTo(102, 40); ctx.lineTo(58, 40);            // cổ
      ctx.lineTo(58, 60);
      ctx.quadraticCurveTo(48, 70, 32, 110);
      ctx.quadraticCurveTo(48, 130, 50, 170);
      ctx.closePath(); ctx.fill();

      const { mask, w, h, bbox } = infl.extractSilhouetteMaskFromCanvas(cnv);
      const lathe = infl.extractSymmetricLatheProfileFromMask(mask, w, h, bbox);

      // 2) Dùng đúng pipeline project: men trắng để tách silhouette khỏi nền
      const views = ortho.generateOrthographicViews(
        null, 'vase', '#FFFFFF', 0.9, lathe, 'none', '', 'Men Trắng', null, 'none'
      );
      const front = views.find((v) => v.id === 'front');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = front.previewImg; });
      const S = 512;
      const rc = document.createElement('canvas');
      rc.width = S; rc.height = S;
      const rctx = rc.getContext('2d');
      rctx.drawImage(img, 0, 0, S, S);
      const rd = rctx.getImageData(0, 0, S, S).data;
      // nền 6-view: #F8F7F4 (248,247,244) — object tối hơn nền
      let rMinX = S, rMaxX = -1, rMinY = S, rMaxY = -1;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const lum = (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
          if (lum < 235) { // pixel thuộc thân men trắng phản chiếu ánh sáng
            if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x;
            if (y < rMinY) rMinY = y; if (y > rMaxY) rMaxY = y;
          }
        }
      const G = 64; // lưới so sánh chuẩn
      const grid = (test, bx0, by0, bx1, by1) => {
        const g = new Uint8Array(G * G);
        for (let gy = 0; gy < G; gy++)
          for (let gx = 0; gx < G; gx++) {
            const sx = bx0 + ((gx + 0.5) / G) * (bx1 - bx0);
            const sy = by0 + ((gy + 0.5) / G) * (by1 - by0);
            g[gy * G + gx] = test(Math.round(sx), Math.round(sy)) ? 1 : 0;
          }
        return g;
      };
      const gA = grid((x, y) => x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x],
        bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
      const gB = grid((x, y) => {
        const i = (y * S + x) * 4;
        const lum = (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
        return lum < 235;
      }, rMinX, rMinY, rMaxX, rMaxY);
      let inter = 0, union = 0;
      for (let i = 0; i < G * G; i++) {
        if (gA[i] && gB[i]) inter++;
        if (gA[i] || gB[i]) union++;
      }
      return union ? inter / union : 0;
    });

    // Silhouette phải khớp ảnh: ngưỡng 0.85 cho mask tổng hợp sạch.
    expect(iou, `silhouette IoU=${iou.toFixed(3)}`).toBeGreaterThanOrEqual(0.85);
  });

  test('lathe từ mask bát → view front khớp silhouette IoU ≥ 0.85', async ({ page }) => {
    const iou = await page.evaluate(async () => {
      const infl = await import('/src/utils/meshInflator.js');
      const ortho = await import('/src/utils/orthographicRenderer.js');

      // 1) Mask tổng hợp: bát cơm miệng loe (frame 200×140)
      const W = 200, H = 140;
      const cnv = document.createElement('canvas');
      cnv.width = W; cnv.height = H;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(60, 120); ctx.lineTo(140, 120);      // chân đế
      ctx.quadraticCurveTo(140, 100, 170, 80);        // thân phải loe
      ctx.lineTo(185, 40);                            // miệng phải
      ctx.lineTo(15, 40);                             // miệng trái
      ctx.lineTo(30, 80);
      ctx.quadraticCurveTo(60, 100, 60, 120);
      ctx.closePath(); ctx.fill();

      const { mask, w, h, bbox } = infl.extractSilhouetteMaskFromCanvas(cnv);
      const lathe = infl.extractSymmetricLatheProfileFromMask(mask, w, h, bbox);

      // 2) Pipeline project, men trắng phân tách silhouette
      const views = ortho.generateOrthographicViews(
        null, 'bowl', '#FFFFFF', 0.9, lathe, 'none', '', 'Men Trắng', null, 'none'
      );
      const front = views.find((v) => v.id === 'front');
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = front.previewImg; });
      const S = 512;
      const rc = document.createElement('canvas');
      rc.width = S; rc.height = S;
      const rctx = rc.getContext('2d');
      rctx.drawImage(img, 0, 0, S, S);
      const rd = rctx.getImageData(0, 0, S, S).data;
      let rMinX = S, rMaxX = -1, rMinY = S, rMaxY = -1;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const i = (y * S + x) * 4;
          const lum = (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
          if (lum < 235) {
            if (x < rMinX) rMinX = x; if (x > rMaxX) rMaxX = x;
            if (y < rMinY) rMinY = y; if (y > rMaxY) rMaxY = y;
          }
        }
      const G = 64;
      const grid = (test, bx0, by0, bx1, by1) => {
        const g = new Uint8Array(G * G);
        for (let gy = 0; gy < G; gy++)
          for (let gx = 0; gx < G; gx++) {
            const sx = bx0 + ((gx + 0.5) / G) * (bx1 - bx0);
            const sy = by0 + ((gy + 0.5) / G) * (by1 - by0);
            g[gy * G + gx] = test(Math.round(sx), Math.round(sy)) ? 1 : 0;
          }
        return g;
      };
      const gA = grid((x, y) => x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x],
        bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
      const gB = grid((x, y) => {
        const i = (y * S + x) * 4;
        const lum = (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
        return lum < 235;
      }, rMinX, rMinY, rMaxX, rMaxY);
      let inter = 0, union = 0;
      for (let i = 0; i < G * G; i++) {
        if (gA[i] && gB[i]) inter++;
        if (gA[i] || gB[i]) union++;
      }
      return union ? inter / union : 0;
    });

    expect(iou, `silhouette IoU(bát)=${iou.toFixed(3)}`).toBeGreaterThanOrEqual(0.85);
  });
});
