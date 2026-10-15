import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Checkout — Phiếu giao kết chế tác.
 * The shipping form has NO htmlFor/id on inputs, so we target by
 * type + placeholder + order. On submit it POSTs to {VITE_API_BASE_URL}/api/orders
 * (default http://localhost:5000). We mock that so the happy path is deterministic.
 */

async function seedCartAndGoCheckout(page) {
  // Add a real product to the cart via Gallery, then proceed to checkout.
  await sidebarNav(page, NAV.gallery).click();
  await expect(page.locator('#gallery-grid')).toBeVisible();
  await page.getByTitle('Thêm sản phẩm thành phẩm vào giỏ hàng để đặt mua ngay').first().click();

  await sidebarNav(page, NAV.cart).click();
  await expect(page.getByRole('heading', { name: 'Giỏ Phôi & Thiết Kế Gốm' })).toBeVisible();

  // Proceed to checkout (items are selected by default after add).
  await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
  await expect(page.getByText('Thông Tin Người Nhận & Địa Điểm Bàn Giao')).toBeVisible();
}

/** Mock the BE orders endpoint with a successful response. */
async function mockOrderApi(page) {
  await page.route('**/api/orders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        order: { orderId: 'GV-ORD-TEST01', totalAmount: 1530000 },
      }),
    });
  });
}

test.describe('Thanh toán (Checkout)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('Form giao hàng yêu cầu các trường bắt buộc (validate lỗi)', async ({ page }) => {
    await seedCartAndGoCheckout(page);

    // Submit with empty form -> validation errors appear, no navigation.
    await page.getByRole('button', { name: /Xác nhận đặt hàng chế tác thủ công/ }).click();

    await expect(page.getByText('Vui lòng nhập họ tên').first()).toBeVisible();
    await expect(page.getByText('Số điện thoại không hợp lệ').first()).toBeVisible();
    await expect(page.getByText('Vui lòng nhập địa chỉ nhận hàng').first()).toBeVisible();
  });

  test('Điền đủ thông tin và đặt hàng thành công (mock API)', async ({ page }) => {
    await mockOrderApi(page);
    await seedCartAndGoCheckout(page);

    // Fill the shipping form. Inputs are the text/tel fields in order.
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.fill('Nguyễn Văn A');

    const phoneInput = page.locator('form input[type="tel"]').first();
    await phoneInput.fill('0912345678');

    const addressInput = page.getByPlaceholder(/Số nhà, tên phố/).first();
    await addressInput.fill('123 Đường Biên Hòa, Đồng Nai');

    await page.getByRole('button', { name: /Xác nhận đặt hàng chế tác thủ công/ }).click();

    // On success the ConfirmationView shows a reference code (Mã số / GV-...).
    await expect(page.getByText(/GV-ORD-TEST01|Mã số/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('Chọn phương thức Workshop đổi sang form đặt lịch', async ({ page }) => {
    await seedCartAndGoCheckout(page);

    // The fulfillment selector exposes two role="radio" options.
    const workshopOption = page.getByRole('radio', {
      name: /Đặt Lịch Hẹn Đến Lò Gốm Biên Hòa Tự Nặn/i,
    });
    await workshopOption.click();

    // Workshop form heading appears.
    await expect(
      page.getByText('Phiếu Hẹn Đến Lò Gốm Biên Hòa (Workshop)')
    ).toBeVisible();
    // Submit button label switches to the workshop variant.
    await expect(
      page.getByRole('button', { name: /Xác nhận đặt lịch hẹn tại lò gốm/ })
    ).toBeVisible();
  });
});
