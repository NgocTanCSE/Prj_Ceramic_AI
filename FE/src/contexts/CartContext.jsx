import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Cart Context - Quản lý giỏ hàng phôi gốm và sản phẩm thủ công.
 * Hỗ trợ chọn/bỏ chọn từng sản phẩm để thanh toán theo lô.
 */
const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('ceramic_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [selectedIds, setSelectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('ceramic_cart_items');
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((i) => i.id);
    } catch (_) {
      return [];
    }
  });

  // Đồng bộ giỏ hàng vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ceramic_cart_items', JSON.stringify(items));
    } catch (_) {}
  }, [items]);

  const addItem = useCallback((design) => {
    const newItem = {
      ...design,
      id: design.id || `ITEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      quantity: design.quantity || 1,
      addedAt: new Date().toISOString(),
    };
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.id === newItem.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        return next;
      }
      return [newItem, ...prev];
    });
    setSelectedIds((prev) => (prev.includes(newItem.id) ? prev : [...prev, newItem.id]));
    return newItem;
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedIds([]);
  }, []);

  const updateQuantity = useCallback((id, qty) => {
    const validQty = Math.max(1, qty);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: validQty } : item))
    );
  }, []);

  const toggleSelectItem = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(items.map((i) => i.id));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isItemSelected = useCallback(
    (id) => selectedIds.includes(id),
    [selectedIds]
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const selectedTotalPrice = useMemo(
    () => selectedItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0),
    [selectedItems]
  );

  const selectedTotalItems = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  );

  const removeSelectedItems = useCallback(() => {
    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  }, [selectedIds]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

  const value = useMemo(
    () => ({
      items,
      totalItems,
      totalPrice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      // Quản lý các món được chọn thanh toán
      selectedIds,
      setSelectedIds,
      selectedItems,
      selectedTotalPrice,
      selectedTotalItems,
      toggleSelectItem,
      selectAll,
      deselectAll,
      isItemSelected,
      removeSelectedItems,
    }),
    [
      items,
      totalItems,
      totalPrice,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      selectedIds,
      selectedItems,
      selectedTotalPrice,
      selectedTotalItems,
      toggleSelectItem,
      selectAll,
      deselectAll,
      isItemSelected,
      removeSelectedItems,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
