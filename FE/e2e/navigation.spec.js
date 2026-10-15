import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Navigation — user clicks the left sidebar to move between screens.
 * The app is a tab-switch SPA (NavigationContext.activeTab), no URL routing.
 */
test.describe('Điều hướng giữa các màn hình (Sidebar)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('Mặc định mở ở Trang chủ với thương hiệu Làng Gốm Biên Hòa', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'LÀNG GỐM BIÊN HÒA' })).toBeVisible();
    // Home screen editorial intro text is a stable landmark.
    await expect(page.getByText(/Tân Vạn/).first()).toBeVisible();
  });

  test('Chuyển sang Thư viện mẫu và thấy bộ lọc danh mục', async ({ page }) => {
    await sidebarNav(page, NAV.gallery).click();
    await expect(page.getByRole('tablist', { name: 'Lọc danh mục' })).toBeVisible();
    await expect(page.locator('#gallery-grid')).toBeVisible();
  });

  test('Chuyển sang Phác thảo mẫu (AI Creator)', async ({ page }) => {
    await sidebarNav(page, NAV.aiCreator).click();
    // Prompt input for describing a ceramic idea.
    await expect(
      page.getByPlaceholder(/Nhập mô tả dáng gốm/).first()
    ).toBeVisible();
  });

  test('Chuyển sang Xưởng tạo hình (Studio 3D) và thấy canvas WebGL', async ({ page }) => {
    await sidebarNav(page, NAV.studio).click();
    // Studio mounts a Three.js <canvas> inside the stage container.
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 15000 });
  });

  test('Chuyển sang Giỏ hàng và thấy tiêu đề giỏ phôi', async ({ page }) => {
    await sidebarNav(page, NAV.cart).click();
    await expect(page.getByRole('heading', { name: 'Giỏ Phôi & Thiết Kế Gốm' })).toBeVisible();
  });

  test('Chuyển sang trang Đặt lịch ngắm mẫu', async ({ page }) => {
    await sidebarNav(page, NAV.schedule).click();
    // The schedule header text is a styled <span>, not a heading role.
    await expect(page.getByText('ĐẶT LỊCH NGẮM MẪU TẠI XƯỞNG GỐM TÂN VẠN').first()).toBeVisible();
  });

  test('Bấm logo thương hiệu để quay về Trang chủ', async ({ page }) => {
    await sidebarNav(page, NAV.gallery).click();
    await expect(page.getByRole('tablist', { name: 'Lọc danh mục' })).toBeVisible();
    // The brand block is a clickable element with aria-label "Trang chủ Gốm Việt"
    // (rendered twice: desktop sidebar + mobile drawer). Use the first (desktop).
    await page.getByLabel('Trang chủ Gốm Việt').first().click();
    await expect(page.getByRole('tablist', { name: 'Lọc danh mục' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'LÀNG GỐM BIÊN HÒA' })).toBeVisible();
  });
});
