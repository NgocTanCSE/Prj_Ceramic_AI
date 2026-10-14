import React, { useRef, useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useScrollReveal } from '../hooks/useScrollReveal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { MODEL_LABELS } from '../data/products';

/* ──────────────────────────────────────────────────────────
   CartScreen - Giỏ Phôi & Thiết Kế Gốm Độc Bản
   ── Quản lý danh sách sản phẩm/phôi đã lưu
   ── Cho phép chọn/bỏ chọn từng sản phẩm để thanh toán
   ── Tăng/giảm số lượng, xóa từng món hoặc xóa hàng loạt
   ── Chuyển tiếp sang CheckoutScreen với các sản phẩm được chọn
   ────────────────────────────────────────────────────────── */

export default function CartScreen() {
  const containerRef = useRef(null);
  useScrollReveal(containerRef);

  const {
    items,
    totalItems,
    selectedItems,
    selectedIds,
    selectedTotalPrice,
    selectedTotalItems,
    toggleSelectItem,
    selectAll,
    deselectAll,
    isItemSelected,
    updateQuantity,
    removeItem,
    removeSelectedItems,
    clearCart,
  } = useCart();

  const { selectProductForDesign, setModelType, setGlazeColor, setGlazeName, setPattern, setCustomText } = useDesign();
  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const handleProceedToCheckout = () => {
    if (selectedItems.length === 0) {
      showToast('Vui lòng chọn ít nhất một sản phẩm để thanh toán!', 'error');
      return;
    }
    setActiveTab('checkout');
  };

  const handleEditInStudio = (item) => {
    if (item.modelType) setModelType(item.modelType);
    if (item.glazeColor) setGlazeColor(item.glazeColor);
    if (item.glazeName) setGlazeName(item.glazeName);
    if (item.pattern) setPattern(item.pattern);
    if (item.customText !== undefined) setCustomText(item.customText);
    setActiveTab('studio-3d');
    showToast('Đã nạp lại thiết kế vào Bàn Xoay 3D để tùy biến!');
  };

  return (
    <div ref={containerRef} className="min-h-full bg-ceramic-paper py-8 md:py-12 px-4 sm:px-6 lg:px-12">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header: Tiêu đề giỏ hàng ── */}
        <div className="border-b border-ceramic-border/80 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-ceramic-charcoal tracking-tight">
              Giỏ Phôi & Thiết Kế Gốm
            </h1>
          </div>
        </div>

        {/* ── Main Content: Empty State hoặc Cart Layout ── */}
        {items.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center space-y-6 bg-ceramic-cream/40 border border-dashed border-ceramic-border/80 rounded-2xl p-8 max-w-xl mx-auto">
            <div className="space-y-2">
              <h3 className="font-editorial text-2xl font-bold text-ceramic-charcoal">
                Giỏ phôi hiện đang trống
              </h3>
              <p className="text-xs text-ceramic-slate max-w-sm mx-auto font-body">
                Bạn chưa thêm mẫu gốm nào vào giỏ. Hãy chọn một tác phẩm từ Thư viện mẫu hoặc tự tay phối men trên Bàn Xoay 3D.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Button variant="primary" size="sm" onClick={() => setActiveTab('gallery')}>
                Khám phá Thư viện mẫu
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('studio-3d')}>
                Tạo phôi trên Studio 3D
              </Button>
            </div>
          </div>
        ) : (
          /* Cart Grid: Danh sách bên trái (8 cols), Tổng kết bên phải (4 cols) */
          <div className="grid grid-cols-1 gap-8 items-start">

            {/* Cột trái (8 cols): Danh sách sản phẩm */}
            <div className="lg:col-span-8 space-y-4">

              {/* Toolbar điều khiển chọn tất cả */}
              <div className="bg-ceramic-paper border border-ceramic-border px-4 py-3 rounded-xl flex items-center justify-between text-xs font-mono shadow-paper">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => {
                      if (e.target.checked) selectAll();
                      else deselectAll();
                    }}
                    className="w-4 h-4 rounded accent-ceramic-terracotta cursor-pointer"
                  />
                  <span className="font-semibold text-ceramic-charcoal">
                    Chọn tất cả ({items.length} sản phẩm)
                  </span>
                </label>

                <div className="flex items-center gap-3">
                  {selectedIds.length > 0 && selectedIds.length < items.length && (
                    <button
                      type="button"
                      onClick={removeSelectedItems}
                      className="text-state-error hover:underline cursor-pointer text-[11px]"
                    >
                      Xóa {selectedIds.length} mục đã chọn
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
                        clearCart();
                        showToast('Đã làm trống giỏ hàng!');
                      }
                    }}
                    className="text-ceramic-slate hover:text-ceramic-charcoal cursor-pointer text-[11px]"
                  >
                    Xóa tất cả
                  </button>
                </div>
              </div>

              {/* Header tiêu đề các cột chuẩn 12 cột trên Desktop */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-2 text-[11px] font-mono uppercase tracking-wider text-ceramic-slate border-b border-ceramic-border/60">
                <div className="col-span-6">Sản phẩm & Chi tiết</div>
                <div className="col-span-2 text-center">Đơn giá</div>
                <div className="col-span-2 text-center">Số lượng</div>
                <div className="col-span-2 text-right">Thành tiền</div>
              </div>

              {/* Danh sách từng Item trong giỏ (Chia theo Grid 12 cột) */}
              <div className="space-y-3">
                {items.map((item) => {
                  const isChecked = isItemSelected(item.id);
                  const modelName = MODEL_LABELS[item.modelType] || (item.modelType ? `Dáng ${item.modelType}` : 'Gốm Thủ Công');

                  return (
                    <div
                      key={item.id}
                      className={`
                        bg-ceramic-paper border transition-all rounded-2xl p-4 sm:p-5 shadow-paper
                        ${isChecked
                          ? 'border-ceramic-terracotta/60 ring-1 ring-ceramic-terracotta/20 bg-ceramic-paper'
                          : 'border-ceramic-border hover:border-ceramic-slate/40 opacity-80'
                        }
                      `}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">

                        {/* Cột 1 -> 6 (6/12): Checkbox + Ảnh + Tên & Chi tiết */}
                        <div className="md:col-span-6 flex items-center gap-3 sm:gap-4 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectItem(item.id)}
                            className="w-4 h-4 rounded accent-ceramic-terracotta cursor-pointer flex-shrink-0"
                            aria-label={`Chọn ${item.name}`}
                          />

                          {/* Thumbnail ảnh 3D snapshot */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-ceramic-border overflow-hidden bg-ceramic-cream flex-shrink-0 relative group">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-mono text-ceramic-slate/60">
                                <span>PHÔI 3D</span>
                              </div>
                            )}

                            {item.glazeColor && (
                              <span
                                className="absolute top-1.5 left-1.5 w-3 h-3 rounded-full border border-ceramic-paper"
                                style={{ backgroundColor: item.glazeColor }}
                                title={`Men: ${item.glazeName || item.glazeColor}`}
                              />
                            )}
                          </div>

                          {/* Thông tin chi tiết */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-ceramic-cream text-ceramic-slate border border-ceramic-border/60">
                                {modelName}
                              </span>
                              {item.isPreMade && (
                                <span className="text-[10px] font-mono text-ceramic-terracotta font-semibold">
                                  Mẫu có sẵn
                                </span>
                              )}
                            </div>

                            <h3 className="font-editorial text-base sm:text-lg font-bold text-ceramic-charcoal leading-snug truncate" title={item.name}>
                              {item.name}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-mono text-ceramic-slate">
                              {item.glazeName && (
                                <span>
                                  Men: <strong className="text-ceramic-charcoal">{item.glazeName}</strong>
                                </span>
                              )}
                              {item.customText && (
                                <span className="text-ceramic-terracotta">
                                  Dấu: <strong>"{item.customText}"</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cột 7 -> 8 (2/12): Đơn giá */}
                        <div className="md:col-span-2 flex md:flex-col justify-between md:justify-center items-center md:items-center text-xs font-mono">
                          <span className="text-ceramic-slate md:text-[10px] uppercase md:hidden">Đơn giá:</span>
                          <span className="font-semibold text-ceramic-charcoal text-sm">
                            {(item.price || 0).toLocaleString('vi-VN')}₫
                          </span>
                        </div>

                        {/* Cột 9 -> 10 (2/12): Bộ điều khiển số lượng */}
                        <div className="md:col-span-2 flex md:flex-col justify-between md:justify-center items-center md:items-center gap-1 text-xs font-mono">
                          <span className="text-ceramic-slate md:text-[10px] uppercase md:hidden">Số lượng:</span>
                          <div className="flex items-center border border-ceramic-border rounded-lg bg-ceramic-paper overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-7 h-7 flex items-center justify-center hover:bg-ceramic-cream disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              title="Giảm số lượng"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-ceramic-charcoal select-none">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-ceramic-cream transition-colors cursor-pointer"
                              title="Tăng số lượng"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Cột 11 -> 12 (2/12): Thành tiền + Nút sửa/xóa */}
                        <div className="md:col-span-2 flex md:flex-col justify-between md:justify-center items-center md:items-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-ceramic-border/60">
                          <div className="text-left md:text-right">
                            <div className="text-[10px] font-mono text-ceramic-slate uppercase md:hidden">Thành tiền:</div>
                            <div className="font-editorial text-lg sm:text-xl font-bold text-ceramic-charcoal">
                              {((item.price || 0) * item.quantity).toLocaleString('vi-VN')}₫
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 pt-0.5">
                            {!item.isPreMade && (
                              <button
                                type="button"
                                onClick={() => handleEditInStudio(item)}
                                className="text-[11px] font-mono text-ceramic-slate hover:text-ceramic-terracotta transition-colors cursor-pointer"
                                title="Tải lại vào Bàn Xoay 3D"
                              >
                                Sửa 3D
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                removeItem(item.id);
                                showToast(`Đã xóa "${item.name}" khỏi giỏ hàng!`);
                              }}
                              className="text-[11px] font-mono text-state-error/80 hover:text-state-error transition-colors cursor-pointer"
                              title="Xóa khỏi giỏ hàng"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>



          </div>
        )}
        {/* Cột phải (4 cols): Bảng tóm tắt thanh toán */}
        <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start z-10">
          <div className="bg-ceramic-paper border border-ceramic-border rounded-2xl p-6 space-y-6 shadow-card">
            <div className="border-b border-ceramic-border pb-4">
              <h3 className="font-editorial text-2xl font-bold text-ceramic-charcoal">
                Tổng Kết Đơn Hàng
              </h3>
              <p className="text-xs font-mono text-ceramic-slate pt-1">
                Giao kết chế tác tại lò gốm Biên Hòa
              </p>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between text-ceramic-slate">
                <span>Tổng số sản phẩm trong giỏ:</span>
                <span className="font-semibold text-ceramic-charcoal">{totalItems}</span>
              </div>

              <div className="flex justify-between text-ceramic-slate">
                <span>Sản phẩm được chọn:</span>
                <span className="font-semibold text-ceramic-terracotta">
                  {selectedTotalItems} món ({selectedItems.length} loại)
                </span>
              </div>

              <div className="flex justify-between text-ceramic-slate">
                <span>Tạm tính các món đã chọn:</span>
                <span className="font-semibold text-ceramic-charcoal">
                  {selectedTotalPrice.toLocaleString('vi-VN')}₫
                </span>
              </div>

              <div className="flex justify-between text-ceramic-slate">
                <span>Phí vận chuyển dự kiến:</span>
                <span className="text-ceramic-slate/80">Tính ở bước thanh toán</span>
              </div>

              <div className="border-t border-ceramic-border pt-4 flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider text-ceramic-terracotta">
                  TỔNG TIỀN THANH TOÁN:
                </span>
                <span className="font-editorial text-2xl sm:text-3xl font-bold text-ceramic-charcoal">
                  {selectedTotalPrice.toLocaleString('vi-VN')}₫
                </span>
              </div>
            </div>

            {/* Nút Chuyển Sang Thanh Toán */}
            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center shadow-card font-bold text-sm tracking-wide"
                disabled={selectedItems.length === 0}
                onClick={handleProceedToCheckout}
              >
                {selectedItems.length === 0
                  ? 'Chọn sản phẩm để thanh toán'
                  : `Tiến hành thanh toán (${selectedTotalItems} món) →`}
              </Button>
            </div>

            {/* Cam kết xưởng gốm */}
            <div className="border-t border-ceramic-border/60 pt-4 flex flex-wrap items-center gap-6 text-[11px] font-mono text-ceramic-slate">
              <div className="flex items-center gap-2">
                <span className="text-state-success">✓</span>
                <span>100% Gốm vuốt tay nung lò rồng truyền thống</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-state-success">✓</span>
                <span>Hoàn tiền nếu sản phẩm không giống cam kết</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-state-success">✓</span>
                <span>Hỗ trợ nghệ nhân hướng dẫn chỉnh sửa bản vẽ</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
