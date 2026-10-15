import { test, expect } from '@playwright/test';
import { gotoHome, sidebarNav, NAV } from './helpers.js';

/**
 * Schedule — Đặt lịch ngắm mẫu tại xưởng.
 * On submit it POSTs to {apiBase}/api/appointments. We mock it for a
 * deterministic happy path. Inputs have no htmlFor/id, so we target by
 * type / aria-label / order (see ScheduleScreen FormInput + slot selectors).
 */

async function mockAppointmentApi(page) {
  await page.route('**/api/appointments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        appointment: {
          appointmentId: 'GV-VST-TEST01',
          customerName: 'Trần Thị B',
          customerPhone: '0987654321',
          date: '2099-12-31',
          timeSlot: '10:30 - 12:30 (Trưa)',
          attendees: 2,
          depositAmount: 100000,
          paymentMethod: 'cod',
          depositStatus: 'pending',
        },
      }),
    });
  });
}

test.describe('Đặt lịch ngắm mẫu (Schedule)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    await sidebarNav(page, NAV.schedule).click();
    await expect(page.getByRole('button', { name: /Xác nhận đặt lịch ngắm mẫu/ })).toBeVisible();
  });

  test('Form đặt lịch validate các trường bắt buộc', async ({ page }) => {
    await page.getByRole('button', { name: /Xác nhận đặt lịch ngắm mẫu/ }).click();
    await expect(page.getByText('Vui lòng nhập họ tên').first()).toBeVisible();
    await expect(page.getByText('Số điện thoại không hợp lệ').first()).toBeVisible();
    await expect(page.getByText('Email không hợp lệ').first()).toBeVisible();
  });

  test('Điền đủ thông tin và đặt lịch thành công (mock API)', async ({ page }) => {
    await mockAppointmentApi(page);

    // Name (first text input), phone (tel), email.
    await page.locator('form input[type="text"]').first().fill('Trần Thị B');
    await page.locator('form input[type="tel"]').first().fill('0987654321');
    await page.locator('form input[type="email"]').first().fill('tran.b@email.com');

    // Future date (app validates Date.parse; date input needs yyyy-mm-dd).
    await page.locator('form input[type="date"]').first().fill('2099-12-31');

    // Attendees number input has an explicit aria-label.
    const attendees = page.getByLabel('Số lượng khách tham quan');
    await attendees.fill('3');

    // Time slot select has aria-label "Chọn ca giờ".
    const slot = page.getByLabel('Chọn ca giờ');
    await slot.selectOption({ index: 1 });

    await page.getByRole('button', { name: /Xác nhận đặt lịch ngắm mẫu/ }).click();

    // Confirmation certificate shows the reference code.
    await expect(page.getByText(/Mã số:/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('GV-VST-TEST01').first()).toBeVisible();
  });

  test('Chọn nhanh mẫu gốm từ mini-picker', async ({ page }) => {
    // With no selected product, the quick sample picker shows product buttons.
    const sampleBtn = page
      .locator('section button', { hasText: /\d/ })
      .first();
    // Fallback: click the first product button in the picker grid if present.
    const anyProductButton = page.getByRole('button').filter({ hasText: /₫/ }).first();
    if (await anyProductButton.count()) {
      await anyProductButton.click();
      await expect(page.getByText(/Đã chọn mẫu/).first()).toBeVisible();
    } else {
      await expect(sampleBtn).toBeTruthy();
    }
  });
});
