import { test, expect } from '@playwright/test';
import { gotoHome } from './helpers.js';

/**
 * Mug handle — kiểm tra quai tồn tại, gắn liền thân, đúng phía,
 * không lơ lửng.
 */
test.describe('Quai cốc (mug handle)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('quai gắn vào thân ở hai đầu, không lơ lửng, đúng phía', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const ortho = await import('/src/utils/orthographicRenderer.js');
      const views = ortho.generateOrthographicViews(
        null, 'mug', '#EAE6DC', 0.9, null, 'none', '', 'Men Trắng', null, 'none'
      );
      const front = views.find((v) => v.id === 'front');
      const img = new Image();
      await new Promise((res2, rej) => { img.onload = res2; img.onerror = rej; img.src = front.previewImg; });
      const S = 512;
      const rc = document.createElement('canvas');
      rc.width = S; rc.height = S;
      const rctx = rc.getContext('2d');
      rctx.drawImage(img, 0, 0, S, S);
      const rd = rctx.getImageData(0, 0, S, S).data;

      const isObj = (x, y) => {
        const i = (y * S + x) * 4;
        return (rd[i] + rd[i + 1] + rd[i + 2]) / 3 < 235;
      };

      let minX = S, maxX = -1, minY = S, maxY = -1;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          if (isObj(x, y)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const rows = [];
      for (let y = minY; y <= maxY; y++) {
        let l = S, r = -1;
        for (let x = 0; x < S; x++) if (isObj(x, y)) { if (x < l) l = x; if (x > r) r = x; }
        if (r > l) rows.push({ y, l, r, w: r - l });
      }
      const widths = rows.map((r2) => r2.w).sort((a, b) => b - a);
      const medW = widths[Math.floor(widths.length / 2)];
      const p90w = widths[Math.floor(widths.length * 0.9)];

      const handle = rows.filter((r2) => r2.w > medW * 1.05);
      const handleVerticalExtent = handle.length > 1 ? handle.slice(-1)[0].y - handle[0].y : 0;

      return {
        objW: maxX - minX + 1,
        objH: maxY - minY + 1,
        objAR: (maxX - minX + 1) / (maxY - minY + 1),
        bodyWidest: medW,
        widthP90: p90w,
        handleRows: handle.length,
        coverRatio: handle.length / Math.max(1, rows.length),
        handleVerticalExtent,
      };
    });

    expect(res.objW / res.objH, 'tỉ lệ thân méo: ' + (res.objW / res.objH).toFixed(2)).toBeGreaterThan(0.7);
    expect(res.objW / res.objH, 'tỉ lệ thân méo: ' + (res.objW / res.objH).toFixed(2)).toBeLessThan(1.8);
    expect(res.handleRows, 'quai không rõ: ' + JSON.stringify(res)).toBeGreaterThan(2);
    expect(res.handleVerticalExtent, 'quai quá nhỏ: ' + res.handleVerticalExtent).toBeGreaterThan(0.12 * res.objH);
    expect(res.widthP90, 'P90 quá hẹp').toBeGreaterThan(res.bodyWidest * 0.85);
    expect(res.widthP90, 'P90 quá rộng').toBeLessThan(res.bodyWidest * 1.6);
  });
});
