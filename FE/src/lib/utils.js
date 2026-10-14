/**
 * CERAMIC BRAND - Frontend Utility Helpers
 *
 * Small, dependency-free helpers that keep the codebase clean
 * and consistent across all components.
 */

/**
 * Conditionally join class strings.
 * Accepts string | object | falsy values.
 * Example:
 *   cn('px-3', isActive && 'bg-blue-500', { 'text-sm': true })
 */
export function cn(...classes) {
  return classes
    .flatMap((c) => (c ? (typeof c === 'string' ? [c] : Object.entries(c).filter(([_, v]) => v).map(([k]) => k)) : []))
    .join(' ');
}

/**
 * Format a Vietnamese đồng price string.
 * @param {number} amount
 * @returns {string} "180.000" (with dot separator)
 */
export const formatVND = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '-';
  return amount.toLocaleString('vi-VN');
};

/**
 * Truncate a string to max length with ellipsis.
 */
export const truncate = (str, maxLen = 100) => {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1).trim() + '…';
};

/**
 * Debounce a function.
 */
export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};
