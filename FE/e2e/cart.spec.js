import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Cart — add/remove items, change quantity, select/deselect for checkout,
 * and localStorage persistence (CartContext stores in "ceramic_cart_items").
 *
 * We seed the cart by using the Gallery "+ Giỏ" button so we exercise the
 * real user path rather than injecting state.
 */
async function addOneProduct(page) {
  await sidebarNav(page, NAV.gallery).click();
  await expect(page.locator('#gallery-grid')).toBeVisible();
  await page.getByTitle('Thêm sản phẩm thành phẩm vào giỏ hàng để đặt mua ngay').first().click();
  await sidebarNav(page, NAV.cart).click();
  await expect(page.getByRole('heading', { name: 'Giỏ Phôi & Thiết Kế Gốm' })).toBeVisible();
}

test.describe('Giỏ hàng (Cart)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('Giỏ trống hiển thị trạng thái "Giỏ phôi hiện đang trống"', async ({ page }) => {
    await sidebarNav(page, NAV.cart).click();
    await expect(page.getByRole('heading', { name: 'Giỏ phôi hiện đang trống' })).toBeVisible();
  });

  test('Thêm sản phẩm vào giỏ và hiển thị trong danh sách', async ({ page }) => {
    await addOneProduct(page);
    // The empty state should be gone.
    await expect(page.getByRole('heading', { name: 'Giỏ phôi hiện đang trống' })).toHaveCount(0);
    // "Chọn tất cả" toolbar appears when there are items.
    await expect(page.getByText(/Chọn tất cả \(\d+ sản phẩm\)/)).toBeVisible();
  });

  test('Tăng số lượng sản phẩm cập nhật thành tiền', async ({ page }) => {
    await addOneProduct(page);
    const plusBtn = page.getByTitle('Tăng số lượng').first();
    await plusBtn.click();

    // Quantity label (centered bold span) should now read 2.
    const qtyCell = page.locator('span.w-8.text-center.font-bold').first();
    await expect(qtyCell).toHaveText('2');

    // localStorage reflects quantity = 2.
    const items = JSON.parse(
      await page.evaluate(() => window.localStorage.getItem('ceramic_cart_items'))
    );
    expect(items[0].quantity).toBe(2);
  });

  test('Giảm số lượng không xuống dưới 1 (nút giảm bị vô hiệu ở 1)', async ({ page }) => {
    await addOneProduct(page);
    const minusBtn = page.getByTitle('Giảm số lượng').first();
    // At quantity 1 the decrease button is disabled.
    await expect(minusBtn).toBeDisabled();
  });

  test('Xóa sản phẩm đưa giỏ về trống', async ({ page }) => {
    await addOneProduct(page);
    await page.getByTitle('Xóa khỏi giỏ hàng').first().click();
    await expect(page.getByRole('heading', { name: 'Giỏ phôi hiện đang trống' })).toBeVisible();

    const items = JSON.parse(
      await page.evaluate(() => window.localStorage.getItem('ceramic_cart_items'))
    );
    expect(items.length).toBe(0);
  });

  test('Bỏ chọn tất cả thì nút thanh toán bị vô hiệu', async ({ page }) => {
    await addOneProduct(page);
    const selectAll = page.getByText(/Chọn tất cả \(\d+ sản phẩm\)/);
    await selectAll.click(); // deselect (was checked by default)

    const checkoutBtn = page.getByRole('button', { name: /Chọn sản phẩm để thanh toán/ });
    await expect(checkoutBtn).toBeDisabled();
  });
});
