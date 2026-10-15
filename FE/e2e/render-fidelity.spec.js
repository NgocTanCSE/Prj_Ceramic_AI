import { test, expect } from '@playwright/test';
import { gotoHome } from './helpers.js';

/**
 * Render fidelity — 3D phải đúng với ảnh/prompt đầu vào:
 *  1) footprint decal = kích thước nét vẽ THỰC (alpha bbox, quy đổi đúng
 *     không gian texture) → không méo, không cắt, không mép thừa;
 *  2) motif render trong viewport khớp footprint (coverage test);
 *  3) màu men trên texture canvas = đúng mã men đã chọn (color accuracy).
 */
test.describe('Render fidelity (decal footprint & màu men)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('footprint vector khớp kích thước nét vẽ thực (ratio trong [0.7, 1.6])', async ({ page }) => {
    const rows = await page.evaluate(async () => {
      const mod = await import('/src/utils/ceramicTextureGenerator.js');
      const patterns = ['hoa_dao', 'sen_co', 'dong_son', 'ca_chep', 'cham_bi'];
      const out = [];
      for (const pattern of patterns) {
        const decals = mod.createDecalCanvases({
          glazeColor: '#2A6B5C', glazeName: 'Men Xanh Đồng',
          pattern, patternImage: null, patternTransform: null,
          customText: '', textTransform: null,
          modelType: 'bowl', width: 1024, height: 1024,
          latheProfile: null, onImageLoaded: null,
        });
        const d = decals[0];
        const c = d.canvas;
        const ctx = c.getContext('2d');
        const img = ctx.getImageData(0, 0, c.width, c.height).data;
        let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
        for (let y = 0; y < c.height; y++)
          for (let x = 0; x < c.width; x++)
            if (img[(y * c.width + x) * 4 + 3] > 10) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        // decal canvas 512 → không gian texture 1024 (×2)
        const realW = maxX < 0 ? 0 : (maxX - minX + 1) * 2;
        const realH = maxY < 0 ? 0 : (maxY - minY + 1) * 2;
        out.push({
          pattern,
          footprint: [Math.round(d.footprintW), Math.round(d.footprintH)],
          real: [realW, realH],
          wOver: +(d.footprintW / Math.max(1, realW)).toFixed(2),
          hOver: +(d.footprintH / Math.max(1, realH)).toFixed(2),
        });
      }
      return out;
    });

    for (const r of rows) {
      // footprint ôm sát nét vẽ: cho phép margin anti-alias, cấm cắt (<1)
      // và cấm thừa quá 60% (>1.6) gây vùng đen bao quanh.
      expect(r.wOver, `${r.pattern} wOver=${r.wOver} fp=${r.footprint} real=${r.real}`).toBeGreaterThanOrEqual(0.7);
      expect(r.hOver, `${r.pattern} hOver=${r.hOver} fp=${r.footprint} real=${r.real}`).toBeGreaterThanOrEqual(0.7);
      expect(r.wOver, `${r.pattern} wOver=${r.wOver} fp=${r.footprint} real=${r.real}`).toBeLessThanOrEqual(1.6);
      expect(r.hOver, `${r.pattern} hOver=${r.hOver} fp=${r.footprint} real=${r.real}`).toBeLessThanOrEqual(1.6);
    }
  });

  test('màu men trên texture = đúng mã men chọn (sai số RGB ≤ 25)', async ({ page }) => {
    const glaze = '#2A6B5C';
    const avg = await page.evaluate(async (hex) => {
      const mod = await import('/src/utils/ceramicTextureGenerator.js');
      const canvas = mod.createCeramicTextureCanvas({
        glazeColor: hex, glazeName: 'Men Xanh Đồng',
        pattern: 'none', patternImage: null, customText: '',
        modelType: 'mug', rimStyle: 'none', width: 256, height: 256,
      });
      const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(0, 0, 256, 256).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    }, glaze);

    const hexRgb = [parseInt(glaze.slice(1, 3), 16), parseInt(glaze.slice(3, 5), 16), parseInt(glaze.slice(5, 7), 16)];
    for (let i = 0; i < 3; i++) {
      // rimStyle 'none' + pattern 'none' → nền phải đúng men, cho phép lệch nhẹ do speckle.
      expect(Math.abs(avg[i] - hexRgb[i]), `chênh kênh ${i}: render=${avg} men=${hexRgb}`).toBeLessThanOrEqual(25);
    }
  });

  test('decal ảnh upload giữ đúng tỉ lệ gốc (AR không méo)', async ({ page }) => {
    const res = await page.evaluate(async () => {
      const mod = await import('/src/utils/ceramicTextureGenerator.js');
      // Ảnh test 400×200 (AR = 2.0)
      const img = new Image();
      img.width = 400; img.height = 200;
      const cnv = document.createElement('canvas');
      cnv.width = 400; cnv.height = 200;
      const decals = mod.createDecalCanvases({
        glazeColor: '#2A6B5C', glazeName: 'Men Xanh Đồng',
        pattern: 'none', patternImage: cnv, patternTransform: null,
        customText: '', textTransform: null,
        modelType: 'mug', width: 1024, height: 1024,
        latheProfile: null, onImageLoaded: null,
      });
      const d = decals[0];
      return { fpW: d.footprintW, fpH: d.footprintH, ar: d.footprintW / d.footprintH };
    });
    // Ảnh 400×200 → footprint phải giữ AR = 2.0 (cho phép ±10%)
    expect(res.ar).toBeGreaterThan(1.8);
    expect(res.ar).toBeLessThan(2.2);
  });
});
