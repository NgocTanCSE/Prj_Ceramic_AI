import { test, expect } from '@playwright/test';
import { gotoHome } from './helpers.js';

/**
 * Prompt → concept accuracy — parsePromptToConcept phải nhận diện đúng:
 * dáng (modelType) + men (glaze hex) + hoa văn (pattern) từ mô tả tiếng Việt,
 * và lathePoints sinh ra phải hợp lệ (không NaN/radius âm/ít điểm).
 */
const CASES = [
  { prompt: 'bình hoa gốm men xanh đồng', modelType: 'vase', glaze: '#2A6B5C', pattern: 'none' },
  { prompt: 'bình gốm cổ nhỏ miệng loe', modelType: 'vase-narrow-neck' },
  { prompt: 'bình ngắn lùn bụng tròn', modelType: 'vase' },
  { prompt: 'cốc gốm uống trà buổi sáng', modelType: 'mug' },
  { prompt: 'ly cà phê men đen thiên mục', modelType: 'mug', glaze: '#1F1E24' },
  { prompt: 'bát cơm men trắng ngà', modelType: 'bowl', glaze: '#EAE6DC' },
  { prompt: 'chén trà nhỏ', modelType: 'bowl' },
  { prompt: 'đĩa tròn trang trí để bàn', modelType: 'plate' },
  { prompt: 'chiếc bình vẽ cành hoa đào', modelType: 'vase', glaze: '#EDE8DC', pattern: 'hoa_dao' },
  { prompt: 'cốc vẽ hoa sen cổ', modelType: 'mug', pattern: 'sen_co' },
  { prompt: 'bát vẽ cá chép', modelType: 'bowl', pattern: 'ca_chep' },
  { prompt: 'đĩa trống đồng đông sơn', modelType: 'plate', pattern: 'dong_son' },
  { prompt: 'bình chấm bi hiện đại', modelType: 'vase', pattern: 'cham_bi' },
  { prompt: 'bình men vàng hoàng yến', modelType: 'vase', glaze: '#E5B83B' },
  { prompt: 'bát men đá đỏ bazan', modelType: 'bowl', glaze: '#9E472A' },
  { prompt: 'vase men xanh biển hỏa biến', modelType: 'vase', glaze: '#1E3A5F' },
];

test.describe('Prompt → concept accuracy', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  for (const c of CASES) {
    test(`"${c.prompt}" → ${c.modelType}${c.pattern && c.pattern !== 'none' ? '/' + c.pattern : ''}`, async ({ page }) => {
      const concept = await page.evaluate(async (promptText) => {
        const mod = await import('/src/utils/aiPromptParser.js');
        return mod.parsePromptToConcept(promptText);
      }, c.prompt);

      expect(concept.modelType, `dáng sai cho "${c.prompt}"`).toBe(c.modelType);
      if (c.glaze) {
        expect(concept.suggestedGlaze?.hex, `men sai cho "${c.prompt}"`).toBe(c.glaze);
      }
      if (c.pattern) {
        expect(concept.pattern, `hoa văn sai cho "${c.prompt}"`).toBe(c.pattern);
      }

      // lathePoints hợp lệ: đủ điểm, x ≥ 0, không NaN, có độ mở thân
      const lp = concept.lathePoints;
      expect(Array.isArray(lp) && lp.length >= 4, `lathe ít điểm cho "${c.prompt}"`).toBe(true);
      for (const p of lp) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), `lathe NaN cho "${c.prompt}"`).toBe(true);
        expect(p.x, `radius âm cho "${c.prompt}"`).toBeGreaterThanOrEqual(0);
      }
      const maxR = Math.max(...lp.map((p) => p.x));
      expect(maxR, `thân không mở cho "${c.prompt}"`).toBeGreaterThan(0.2);
    });
  }

  test('prompt trống không crash, trả concept mặc định hợp lệ', async ({ page }) => {
    const concept = await page.evaluate(async () => {
      const mod = await import('/src/utils/aiPromptParser.js');
      return mod.parsePromptToConcept('');
    });
    expect(concept.modelType).toBeTruthy();
    expect(concept.suggestedGlaze?.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(Array.isArray(concept.lathePoints) && concept.lathePoints.length >= 4).toBe(true);
  });
});
