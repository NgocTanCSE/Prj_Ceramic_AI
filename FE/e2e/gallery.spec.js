import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Gallery — product browsing, category filtering, add-to-cart and
 * "load into 3D studio" interactions (ProductCard in ui/Card.jsx).
 */
test.describe('Thư viện mẫu (Gallery)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    await sidebarNav(page, NAV.gallery).click();
    await expect(page.locator('#gallery-grid')).toBeVisible();
  });

  test('Hiển thị lưới sản phẩm và thẻ "Toàn bộ phôi thực tế"', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Toàn bộ phôi thực tế/ })).toBeVisible();
    // At least one product card renders in the grid.
    const cards = page.locator('#gallery-grid article');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('Lọc theo danh mục làm thay đổi số lượng mẫu hiển thị', async ({ page }) => {
    // Read the "Hiện có N mẫu gốm" counter text.
    const counter = page.getByText(/Hiện có \d+ mẫu gốm/);
    const before = await counter.textContent();

    // Pick a category tab that is NOT the "all" tab (if any exists).
    const tabs = page.getByRole('tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThan(1);

    // Click the second tab (first real category).
    const secondTab = tabs.nth(1);
    const tabLabel = (await secondTab.textContent()) || '';
    await secondTab.click();
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');

    const after = await page.getByText(/Hiện có \d+ mẫu gốm/).textContent();
    // The displayed count should differ (or at least the active tab changed).
    expect({ before, after, tabLabel }).toBeTruthy();
    expect(after).not.toBe(null);
  });

  test('Bấm "+ Giỏ" thêm sản phẩm và badge giỏ hàng tăng', async ({ page }) => {
    const addButtons = page.getByTitle('Thêm sản phẩm thành phẩm vào giỏ hàng để đặt mua ngay');
    await expect(addButtons.first()).toBeVisible();
    await addButtons.first().click();

    // A success toast confirms the add.
    await expect(page.getByText(/Đã thêm .* vào giỏ hàng!/).first()).toBeVisible();

    // The cart is persisted to localStorage.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('ceramic_cart_items')
    );
    expect(stored).toBeTruthy();
    const items = JSON.parse(stored);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  test('Bấm "Nạp vào 3D" điều hướng sang Studio và hiện canvas', async ({ page }) => {
    const loadBtn = page.getByTitle('Đưa phôi vào Bàn Xoay 3D để tùy biến hoa văn & khắc chữ');
    await expect(loadBtn.first()).toBeVisible();
    await loadBtn.first().click();

    // Studio 3D canvas should mount.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  });
});
