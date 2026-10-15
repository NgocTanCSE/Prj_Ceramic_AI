import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Studio 3D — interactive WebGL (Three.js) rendering.
 *
 * The renderer is created with `preserveDrawingBuffer: true`, so we can read
 * pixels back from the canvas via toDataURL() and prove the scene actually
 * renders (non-empty) and that changing glaze colour re-renders new pixels.
 * WebGL is force-enabled headless via SwiftShader in playwright.config.js.
 */

/** Read a fingerprint of the studio canvas pixels (non-transparent + avg colour). */
async function canvasFingerprint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return null;
    // Draw the WebGL canvas into a 2D canvas to read pixels.
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const ctx = off.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let nonEmpty = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a > 10) {
        nonEmpty++;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
    }
    const n = nonEmpty || 1;
    return {
      w,
      h,
      nonEmpty,
      avg: [Math.round(r / n), Math.round(g / n), Math.round(b / n)],
    };
  });
}

/** Load a product into the studio so the "no product" overlay is dismissed. */
async function enterStudioWithProduct(page) {
  await sidebarNav(page, NAV.gallery).click();
  await expect(page.locator('#gallery-grid')).toBeVisible();
  await page.getByTitle('Đưa phôi vào Bàn Xoay 3D để tùy biến hoa văn & khắc chữ').first().click();

  const canvas = page.locator('canvas');
  await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  // Give the scene a few frames to actually draw.
  await page.waitForTimeout(1200);
}

test.describe('Xưởng tạo hình 3D (Studio render & tương tác)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('Canvas WebGL render được nội dung 3D', async ({ page }) => {
    await enterStudioWithProduct(page);

    const fp = await canvasFingerprint(page);
    expect(fp).not.toBeNull();
    expect(fp.w).toBeGreaterThan(0);
    expect(fp.h).toBeGreaterThan(0);
    // The ceramic body should cover a meaningful number of pixels.
    expect(fp.nonEmpty).toBeGreaterThan(500);
  });

  test('Bật/Tắt xoay tự động 360 độ', async ({ page }) => {
    await enterStudioWithProduct(page);

    const rotateBtn = page.getByRole('button', { name: /Đang xoay 360°/ });
    await expect(rotateBtn).toBeVisible();
    await rotateBtn.click();
    // After pausing, the button offers to resume.
    await expect(page.getByRole('button', { name: /Tạm dừng xoay/ })).toBeVisible();
  });

  test('Đổi màu men làm thay đổi pixel render', async ({ page }) => {
    await enterStudioWithProduct(page);

    // Pause auto-rotation so the only change between snapshots is the glaze.
    await page.getByRole('button', { name: /Đang xoay 360°/ }).click();
    await page.waitForTimeout(300);

    const before = await canvasFingerprint(page);

    // The glaze section is open by default in "list" mode; pick a different
    // glaze row (role=button). Choose one that is not currently selected.
    const glazeOptions = page.locator('[role="button"]').filter({ hasText: /Men / });
    // Fall back to the colour palette swatches if the list view is active.
    const swatches = page.locator('button[title*="("]');
    const target = (await glazeOptions.count()) ? glazeOptions.nth(2) : swatches.nth(3);
    await target.click();
    await page.waitForTimeout(800);

    const after = await canvasFingerprint(page);

    // Average colour should differ after changing the glaze.
    const changed =
      Math.abs(before.avg[0] - after.avg[0]) +
      Math.abs(before.avg[1] - after.avg[1]) +
      Math.abs(before.avg[2] - after.avg[2]);
    expect(changed).toBeGreaterThan(0);
  });

  test('Đổi dáng phôi vẫn giữ canvas render', async ({ page }) => {
    await enterStudioWithProduct(page);
    // Change to another standard shape via its label in the right panel.
    const shapeBtn = page.getByRole('button', { name: /Bình Khí/ }).first();
    if (await shapeBtn.count()) {
      await shapeBtn.click();
      await page.waitForTimeout(800);
    }
    const fp = await canvasFingerprint(page);
    expect(fp.nonEmpty).toBeGreaterThan(500);
  });

  test('Nhập chữ khắc hiển thị bộ điều khiển di chuyển', async ({ page }) => {
    await enterStudioWithProduct(page);

    const textInput = page.getByLabel('Chữ khắc');
    await expect(textInput).toBeVisible();
    await textInput.fill('An Nhien');

    // The input reflects the value.
    await expect(textInput).toHaveValue('An Nhien');
    // With text present, the mouse-drag placement controls appear.
    await expect(page.getByText('Di Chuyển Chữ Khắc (Chuột)').first()).toBeVisible();
  });

  test('Các nút góc nhìn (Chính diện / Xem miệng / Xem đáy) hoạt động', async ({ page }) => {
    await enterStudioWithProduct(page);

    await page.getByRole('button', { name: 'Chính diện' }).click();
    await page.getByRole('button', { name: 'Xem miệng' }).click();
    await page.getByRole('button', { name: 'Xem đáy' }).click();
    await page.waitForTimeout(400);

    // Canvas still renders after camera moves.
    const fp = await canvasFingerprint(page);
    expect(fp.nonEmpty).toBeGreaterThan(500);
  });
});
