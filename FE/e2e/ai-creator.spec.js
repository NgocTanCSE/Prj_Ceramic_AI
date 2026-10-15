import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * AI Co-Creator — text-to-3D concept flow.
 *
 * handleGenerateFromPrompt() POSTs to `${VITE_AI_API_BASE_URL}/api/ai/prompt-to-3d`.
 * When that API is unreachable, the screen falls back to a fully local parser
 * (parsePromptToConcept → paramsToLathePoints → generateOrthographicViews), so we
 * mock the endpoint to abort and exercise that deterministic offline path:
 * prompt → concept → 3D turntable + 6 orthographic views → hand-off to Studio.
 */

/** Force the AI API to fail so the local fallback synthesises the concept. */
async function forceAiFallback(page) {
  await page.route('**/api/ai/prompt-to-3d', (route) => route.abort());
}

async function enterAiCreator(page) {
  await sidebarNav(page, NAV.aiCreator).click();
  await expect(page.getByRole('heading', { name: 'Phác thảo ý tưởng của bạn' })).toBeVisible();
}

/** Generate a concept from a prompt and wait for the result view. */
async function generateConcept(page, promptText) {
  const input = page.getByLabel('Nhập mô tả ý tưởng gốm sứ');
  await input.fill(promptText);
  await page.getByRole('button', { name: 'Phác thảo 2D' }).click();

  // Result view is reached when the "Chuyển vào Studio" action appears.
  await expect(page.getByRole('button', { name: /Chuyển vào Studio/ })).toBeVisible({
    timeout: 30000,
  });
}
test.describe('AI Phác thảo (Co-Creator)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    await forceAiFallback(page);
    await enterAiCreator(page);
  });

  test('Màn hình khởi đầu hiển thị ô nhập ý tưởng & nút phác thảo bị vô hiệu khi trống', async ({ page }) => {
    const input = page.getByLabel('Nhập mô tả ý tưởng gốm sứ');
    await expect(input).toBeVisible();

    const sketchBtn = page.getByRole('button', { name: 'Phác thảo 2D' });
    // Disabled while the prompt is empty.
    await expect(sketchBtn).toBeDisabled();
  });

  test('Nhập mô tả & tạo mẫu → hiển thị model 3D + lưới 6 mặt trực giao', async ({ page }) => {
    await generateConcept(page, 'một chiếc bình hoa gốm men xanh đồng cổ điển');

    // The 3D viewport is the default; a WebGL canvas mounts.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    // 2D/3D toggle + the 6-view thumbnail grid are present.
    await expect(page.getByRole('button', { name: 'Mô hình 3D' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ảnh Chiếu 2D' })).toBeVisible();

    // The 6 orthographic view thumbnails render (front/top/... codes).
    const viewCells = page.locator('.grid.grid-cols-3 > div');
    expect(await viewCells.count()).toBeGreaterThanOrEqual(6);
  });

  test('Chuyển sang chế độ Ảnh Chiếu 2D hiển thị bản vẽ đã chọn', async ({ page }) => {
    await generateConcept(page, 'chiếc bát gốm trắng vẽ tay hoa đào');

    // Switch to 2D projection mode.
    await page.getByRole('button', { name: 'Ảnh Chiếu 2D' }).click();
    // The 2D viewport shows an orthographic preview image.
    await expect(page.locator('img[alt]').first()).toBeVisible();
  });

  test('Bấm một ô 6 mặt trực giao để xem bản vẽ tương ứng', async ({ page }) => {
    await generateConcept(page, 'bình gốm sứ khắc chìm hoa văn rồng');

    // Click the 2nd thumbnail in the 6-view grid → switches to 2D mode for it.
    const cells = page.locator('.grid.grid-cols-3 > div');
    await cells.nth(1).click();
    // A preview image should now be shown in the main viewport.
    await expect(page.locator('img[alt]').first()).toBeVisible();
  });

  test('Nút "Chuyển vào Studio" đưa thiết kế sang Xưởng 3D', async ({ page }) => {
    await generateConcept(page, 'bình hoa gốm men xanh dáng cổ điển');
    await page.getByRole('button', { name: /Chuyển vào Studio/ }).click();
    // Studio mounts its own WebGL canvas.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20000 });
  });

  test('Nút "Đặt lịch ngắm mẫu" chuyển sang trang đặt lịch', async ({ page }) => {
    await generateConcept(page, 'đĩa gốm trang trí men vàng hoàng yến');
    // Scope to the result action cluster to avoid the sidebar's schedule button.
    const scheduleBtn = page
      .locator('button')
      .filter({ hasText: 'Đặt lịch ngắm mẫu' })
      .last();
    await scheduleBtn.click();
    await expect(page.getByText('ĐẶT LỊCH NGẮM MẪU TẠI XƯỞNG GỐM TÂN VẠN').first()).toBeVisible();
  });

  test('Nút "Tạo mẫu mới" đưa về màn hình nhập ý tưởng', async ({ page }) => {
    await generateConcept(page, 'bình cổ nhỏ gốm mộc');
    await page.getByRole('button', { name: /Tạo mẫu mới/ }).click();

    // Back to the initial input state (concept view dismissed).
    await expect(page.getByRole('button', { name: /Chuyển vào Studio/ })).toHaveCount(0);
    // The initial prompt field (with its aria-label) is shown again.
    await expect(page.getByLabel('Nhập mô tả ý tưởng gốm sứ')).toBeVisible({ timeout: 15000 });
  });
});
