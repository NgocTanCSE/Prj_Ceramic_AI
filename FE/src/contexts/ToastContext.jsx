import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Toast Context - global notification system.
 *
 * Provides a `showToast(message, options)` function that any component
 * can call without prop-drilling. Toasts auto-dismiss after 3.2s.
 */
const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, options = {}) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const toast = {
      id,
      message,
      duration: options.duration ?? 3200,
    };
    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Toast Container - rendered once at the root.
 * Supports multiple stacked toasts.
 */
function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="
            relative max-w-md px-5 py-3 rounded-2xl
            bg-ceramic-charcoal text-ceramic-paper text-xs font-medium
            shadow-card shadow-ceramic-charcoal/20
            animate-in fade-in slide-in-from-top-3 duration-200
            border border-ceramic-paper/10
          "
        >
          {toast.message}
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="absolute top-1.5 right-2 text-ceramic-paper/40 hover:text-ceramic-paper/70 text-[10px] transition-colors"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
