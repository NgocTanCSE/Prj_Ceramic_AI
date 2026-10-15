import { test, expect } from '@playwright/test';

/**
 * Shared helpers for user-interaction (UI/E2E) tests.
 *
 * The app is a single-page shell driven by NavigationContext `activeTab`.
 * There is no URL routing, so we assert screen switches by looking for
 * screen-specific headings / landmarks in the DOM.
 */

/** Clear every key the app persists so each test starts from a clean slate. */
export async function resetAppState(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
    } catch (_) {
      /* ignore */
    }
  });
}

/** Open the app at the home tab with a clean state. */
export async function gotoHome(page) {
  await resetAppState(page);
  await page.goto('/');
  // The masthead brand is always rendered inside the left sidebar.
  await expect(page.getByRole('heading', { name: 'LÀNG GỐM BIÊN HÒA' })).toBeVisible();
}

/** Click a sidebar navigation item by its visible Vietnamese label. */
export function sidebarNav(page, label) {
  return page.getByRole('button', { name: label, exact: false }).first();
}

/** Sidebar primary nav labels (from LeftSidebar menuItems). */
export const NAV = {
  home: 'Trang chủ',
  gallery: 'Thư viện mẫu',
  aiCreator: 'Phác thảo mẫu',
  studio: 'Xưởng tạo hình',
  cart: 'Giỏ hàng',
  schedule: 'Đặt lịch ngắm mẫu',
};
