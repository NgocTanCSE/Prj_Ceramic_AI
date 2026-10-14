import React, { useState, useRef, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useCart } from '../contexts/CartContext';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { WORKSHOP_SLOTS, WORKSHOP_PRICE_PER_PERSON } from '../data/workshopSlots';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { usePersistentForm } from '../hooks/usePersistentForm';
import { generateOrthographicViews } from '../utils/orthographicRenderer';
import Button from '../ui/Button';

/* ──────────────────────────────────────────────────────────
   CheckoutScreen - Phiếu Giao Kết Chế Tác & Lịch Hẹn Xưởng
   ── Option 1: Nghệ nhân nung lò rồng & giao tận nhà.
   ── Option 2: Đặt lịch đến lò Biên Hòa tự tay vuột nặn.
   ── Editorial atelier docket layout with tactile craftsmanship.
   ── No icon library - all symbols are Unicode + CSS.
   ────────────────────────────────────────────────────────── */

export default function CheckoutScreen() {
  const containerRef = useRef(null);
  useScrollReveal(containerRef);
  const [fulfillmentType, setFulfillmentType] = useState('artisan_craft');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedData, setConfirmedData] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [fallbackImg, setFallbackImg] = useState(null);

  const {
    items: cartItems,
    selectedItems,
    removeSelectedItems,
    clearCart,
  } = useCart();
  const { activeDesign, selectedProduct } = useDesign();
  const { setActiveTab } = useNavigation();

  const beApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  // Lấy các sản phẩm được chọn từ giỏ hàng hoặc toàn bộ giỏ hàng
  const checkoutItems = useMemo(() => {
    if (selectedItems && selectedItems.length > 0) return selectedItems;
    if (cartItems && cartItems.length > 0) return cartItems;
    if (selectedProduct) {
      return [{
        name: selectedProduct.name,
        image: selectedProduct.image || selectedProduct.thumbnail,
        glazeName: activeDesign?.glazeName || 'Chưa chọn sắc màu',
        glazeColor: activeDesign?.glazeColor || '#B85D38',
        pattern: activeDesign?.pattern || 'Chưa chọn họa tiết',
        customText: activeDesign?.customText || '',
        price: selectedProduct.price || 0,
        quantity: 1,
      }];
    }
    return [];
  }, [selectedItems, cartItems, selectedProduct, activeDesign]);

  const currentItem = checkoutItems.length > 0 ? checkoutItems[0] : null;

  // Tự động sinh ảnh trực giao 3D nếu mẫu trong giỏ chưa có snapshot
  useEffect(() => {
    if (currentItem && !currentItem.image) {
      try {
        const views = generateOrthographicViews(
          null,
          currentItem.modelType || 'mug',
          currentItem.glazeColor || '#2A6B5C',
          currentItem.glazeRoughness ?? 0.15,
          currentItem.customLathePoints || null,
          currentItem.pattern || 'none',
          currentItem.customText || '',
          currentItem.glazeName || '',
          currentItem.patternImage || null
        );
        if (views && views[0]?.previewImg) {
          setFallbackImg(views[0].previewImg);
        }
      } catch (err) {
        console.warn('Không thể tự động sinh ảnh tiêu bản:', err);
      }
    }
  }, [currentItem]);

  // Shipping & workshop forms — auto-saved to localStorage for convenience.
  // The BE server (/api/orders, /api/workshops) is the source of truth on submit.
  const [shippingForm, setShippingForm, shippingActions] = usePersistentForm(
    'ceramic_checkout_shipping',
    { name: '', phone: '', address: '', notes: '' }
  );
  const [workshopForm, setWorkshopForm, workshopActions] = usePersistentForm(
    'ceramic_checkout_workshop',
    { name: '', phone: '', email: '', date: '', timeSlot: WORKSHOP_SLOTS[1], attendees: 2, notes: '' }
  );

  // Price calculation — guard when no product selected yet
  const isDelivery = fulfillmentType === 'artisan_craft';
  const totalItemPrice = checkoutItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
  const totalItemCount = checkoutItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const shippingFee = checkoutItems.length > 0 ? 30000 : 0;
  const workshopTotal = WORKSHOP_PRICE_PER_PERSON * workshopForm.attendees;
  const totalPrice = isDelivery ? totalItemPrice + shippingFee : workshopTotal;

  // Form validation
  const validatePhone = (val) => {
    if (!val || typeof val !== 'string') return false;
    const digits = val.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 11;
  };

  const validateDate = (val) => {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
    const d = new Date(val);
    return !isNaN(d.getTime()) && d > new Date();
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (isDelivery) {
      const errors = {};
      if (!shippingForm.name.trim()) errors.name = 'Vui lòng nhập họ tên';
      if (!validatePhone(shippingForm.phone)) errors.phone = 'Số điện thoại không hợp lệ';
      if (!shippingForm.address.trim()) errors.address = 'Vui lòng nhập địa chỉ nhận hàng';
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    } else {
      const errors = {};
      if (!workshopForm.name.trim()) errors.wName = 'Vui lòng nhập họ tên';
      if (!validatePhone(workshopForm.phone)) errors.wPhone = 'Số điện thoại không hợp lệ';
      if (!validateDate(workshopForm.date)) errors.date = 'Ngày không hợp lệ';
      if (!WORKSHOP_SLOTS.includes(workshopForm.timeSlot)) errors.timeSlot = 'Chọn ca giờ hợp lệ';
      if (workshopForm.attendees < 1 || workshopForm.attendees > 10) errors.attendees = 'Số lượng 1-10 khách';
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    }

    // Payment confirmation gate — Momo QR requires explicit confirmation
    if (paymentMethod === 'momo' && !paymentConfirmed) {
      setFormErrors({ submit: 'Vui lòng quét QR và xác nhận đã thanh toán trước khi gửi đơn' });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isDelivery) {
        const payload = {
          customerName: shippingForm.name,
          customerPhone: shippingForm.phone,
          customerAddress: shippingForm.address,
          customerNotes: shippingForm.notes,
          items: checkoutItems,
          designData: activeDesign,
          paymentMethod,
          totalAmount: totalPrice,
        };

        const res = await fetch(`${beApiBase}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          triggerSuccessConfetti();
          setConfirmedData({ type: 'order', data: data.order });
          if (removeSelectedItems) {
            removeSelectedItems();
          } else {
            clearCart();
          }
        } else {
          throw new Error(data.message || 'Lỗi đặt hàng');
        }
      } else {
        const payload = {
          customerName: workshopForm.name,
          customerPhone: workshopForm.phone,
          customerEmail: workshopForm.email,
          date: workshopForm.date,
          timeSlot: workshopForm.timeSlot,
          attendees: workshopForm.attendees,
          notes: workshopForm.notes,
          designData: activeDesign,
        };

        const res = await fetch(`${beApiBase}/api/workshops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          triggerSuccessConfetti();
          setConfirmedData({ type: 'workshop', data: data.booking });
          clearCart();
        } else {
          throw new Error(data.message || 'Lỗi đặt workshop');
        }
      }
    } catch (err) {
      // Phase fix: do NOT fabricate a fake order/workshop on error.
      // Surface the real failure so the user can retry instead of seeing a false success.
      const msg = err?.message || 'Lỗi không xác định. Vui lòng thử lại.';
      console.error('[Checkout] submission error:', err);
      setFormErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerSuccessConfetti = () => {
    try {
      const scalar = 2.0;
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        scalar,
        zIndex: 9999,
      });
    } catch (e) {
      /* optional */
    }
  };

  const handleBack = () => {
    if (confirmedData) {
      setConfirmedData(null);
      setActiveTab('home');
    } else {
      setActiveTab('studio-3d');
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto bg-ceramic-paper text-ceramic-charcoal font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-8">

        {/* ── Confirmation / Success Certificate ── */}
        {confirmedData ? (
          <div className="max-w-3xl mx-auto">
            <ConfirmationView
              data={confirmedData}
              checkoutItems={checkoutItems}
              currentItem={currentItem}
              fallbackImg={fallbackImg}
              totalPrice={totalPrice}
              onBackHome={() => setActiveTab('home')}
              onNewDesign={() => setActiveTab('studio-3d')}
            />
          </div>
        ) : checkoutItems.length === 0 ? (
          /* ── Empty State: chưa chọn sản phẩm ── */
          <div className="max-w-xl mx-auto">
            <section className="scroll-reveal py-16 text-center space-y-8">
              <div className="text-5xl text-ceramic-slate/30 font-editorial">○</div>
              <div className="space-y-3">
                <h3 className="font-editorial text-2xl font-bold text-ceramic-charcoal">
                  Chưa có sản phẩm được chọn để thanh toán
                </h3>
                <p className="text-sm text-ceramic-slate max-w-md mx-auto">
                  Hãy vào Giỏ hàng để tích chọn các phôi gốm muốn đặt chế tác, hoặc khám phá Thư viện mẫu.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="primary" size="md" onClick={() => setActiveTab('cart')}>
                  Xem Giỏ hàng
                </Button>
                <Button variant="secondary" size="md" onClick={() => setActiveTab('gallery')}>
                  Chọn từ Thư viện mẫu
                </Button>
              </div>
            </section>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-10 items-start">
            {/* ── CỘT TRÁI (7 cột): Thông tin sản phẩm + Phương thức tiếp nhận + Form giao hàng/workshop ── */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-8">
              {/* 1. Item Specimen Summary Docket */}
              <div className="scroll-reveal">
                <ItemSummaryDocket
                  checkoutItems={checkoutItems}
                  currentItem={currentItem}
                  fallbackImg={fallbackImg}
                  onEditCart={() => setActiveTab('cart')}
                />
              </div>

              {/* 2. Choose Fulfillment Path */}
              <div className="scroll-reveal">
                <FulfillmentSelector
                  fulfillmentType={fulfillmentType}
                  setFulfillmentType={setFulfillmentType}
                />
              </div>

              {/* 3. Input Forms */}
              <div className="scroll-reveal">
                {isDelivery ? (
                  <ShippingForm
                    form={shippingForm}
                    setForm={setShippingForm}
                    errors={formErrors}
                  />
                ) : (
                  <WorkshopForm
                    form={workshopForm}
                    setForm={setWorkshopForm}
                    errors={formErrors}
                    slots={WORKSHOP_SLOTS}
                  />
                )}
              </div>
            </div>

            {/* ── CỘT PHẢI (5 cột): Bảng thanh toán & Chi phí (Sticky khi cuộn) ── */}
            <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-6 space-y-6">
              <PaymentSection
                fulfillmentType={fulfillmentType}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentConfirmed={paymentConfirmed}
                setPaymentConfirmed={setPaymentConfirmed}
                totalItemPrice={totalItemPrice}
                shippingFee={isDelivery ? shippingFee : 0}
                workshopFee={isDelivery ? 0 : workshopTotal}
                totalPrice={totalPrice}
                isSubmitting={isSubmitting}
                formErrors={formErrors}
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────── */

/**
 * Specimen summary docket showing design specifications.
 */
function ItemSummaryDocket({ checkoutItems, currentItem, fallbackImg, onEditCart }) {
  const items = checkoutItems && checkoutItems.length > 0 ? checkoutItems : (currentItem ? [currentItem] : []);
  if (items.length === 0) return null;

  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-6 shadow-card space-y-5 rounded-xl">
      <div className="flex items-center justify-between border-b border-ceramic-border/80 pb-3">
        {onEditCart && (
          <button
            type="button"
            onClick={onEditCart}
            className="text-xs font-mono text-ceramic-slate hover:text-ceramic-terracotta transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>← Quay lại Giỏ hàng</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-ceramic-border/60">
        {items.map((item, idx) => {
          const displayImage = item.image || (idx === 0 ? fallbackImg : null);
          return (
            <div key={item.id || idx} className="py-4 first:pt-1 last:pb-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-16 h-16 border border-ceramic-border flex-shrink-0 overflow-hidden bg-ceramic-cream rounded-lg">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={item.name}
                      className="w-full h-full object-cover object-center"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ceramic-slate/50 flex items-center justify-center h-full">
                      NO IMAGE
                    </span>
                  )}
                </div>

                <div className="space-y-1 min-w-0">
                  <h3 className="font-editorial text-xl font-bold text-ceramic-charcoal truncate">
                    {item.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-mono text-ceramic-slate">
                    {item.glazeName && (
                      <span>SẮC MEN: <strong className="text-ceramic-charcoal">{item.glazeName}</strong></span>
                    )}
                    {item.customText && (
                      <span>DẤU KHẮC: <strong className="text-ceramic-terracotta">"{item.customText}"</strong></span>
                    )}
                    <span>SỐ LƯỢNG: <strong className="text-ceramic-charcoal">x{item.quantity}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-left md:text-right flex md:flex-col justify-between w-full md:w-auto items-center md:items-end border-t md:border-t-0 border-ceramic-border/40 pt-2 md:pt-0">
                <div className="text-[10px] font-mono text-ceramic-slate uppercase">THÀNH TIỀN</div>
                <div className="font-editorial text-xl font-bold text-ceramic-charcoal">
                  {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Architectural fulfillment path selector (2-column).
 */
function FulfillmentSelector({ fulfillmentType, setFulfillmentType }) {
  const options = [
    {
      value: 'artisan_craft',
      label: 'Nghệ Nhân Biên Hòa Chế Tác & Giao Tận Nhà',
      description:
        'Nghệ nhân vuột phôi theo số đo 3D, khắc chìm hoa văn, chấm men Vert de Biên Hòa truyền thống và nung lò rồng củi. Sản phẩm hoàn thiện được đóng gói gửi tận nhà.',
      leadTime: '7 - 10 ngày nung thủ công',
    },
    {
      value: 'workshop',
      label: 'Đặt Lịch Hẹn Đến Lò Gốm Biên Hòa Tự Nặn (Workshop)',
      description:
        'Đến trực tiếp làng gốm Tân Vạn (Biên Hòa, Đồng Nai) theo lịch hẹn. Bạn tự tay vuột phôi trên bàn xoay thực tế dưới sự hướng dẫn 1-on-1 từ nghệ nhân xưởng.',
      leadTime: 'Chuẩn bị sẵn nguyên liệu & bàn xoay',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider text-ceramic-slate">
        PHƯƠNG THỨC TIẾP NHẬN SẢN PHẨM:
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((opt) => {
          const selected = fulfillmentType === opt.value;

          return (
            <div
              key={opt.value}
              onClick={() => setFulfillmentType(opt.value)}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFulfillmentType(opt.value);
                }
              }}
              className={`
                p-6 border transition-all cursor-pointer flex flex-col justify-between
                ${selected
                  ? 'border-ceramic-charcoal bg-ceramic-paper ring-1 ring-ceramic-charcoal/30'
                  : 'border-ceramic-border bg-ceramic-cream hover:border-ceramic-terracotta'
                }
              `}
            >
              <div>
                <h4 className="font-editorial text-[17px] font-bold text-ceramic-charcoal leading-snug">
                  {opt.label}
                </h4>

                <p className="text-xs text-ceramic-slate leading-relaxed mt-2 font-body">
                  {opt.description}
                </p>
              </div>

              <div className="pt-3 border-t border-ceramic-border flex items-center gap-2 text-[11px] font-mono text-ceramic-slate">
                <span className="text-ceramic-terracotta">⏱</span>
                <span>{opt.leadTime}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Shipping Form - Option 1
 */
function ShippingForm({ form, setForm, errors }) {
  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between border-b border-ceramic-border/50 pb-3">
        <h4 className="font-editorial text-lg font-bold text-ceramic-charcoal flex items-center gap-2">
          <span>Thông Tin Người Nhận & Địa Điểm Bàn Giao</span>
        </h4>
        <span className="text-[10px] font-mono text-ceramic-slate uppercase">GIAO HÀNG TOÀN QUỐC</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Họ và tên người nhận"
          required
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          error={errors.name}
          type="text"
          symbol="N"
        />
        <FormInput
          label="Số điện thoại liên lạc"
          required
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          error={errors.phone}
          type="tel"
          symbol="S"
        />
      </div>

      <FormInput
        label="Địa chỉ giao hàng chi tiết"
        required
        value={form.address}
        onChange={(v) => setForm({ ...form, address: v })}
        error={errors.address}
        placeholder="Số nhà, tên phố, phường/xã, quận/huyện, tỉnh/thành phố..."
        type="text"
        symbol="A"
      />

      <FormTextarea
        label="Chỉ dẫn chế tác & đóng gói đặc biệt (nếu có)"
        value={form.notes}
        onChange={(v) => setForm({ ...form, notes: v })}
        rows={2}
        placeholder="Ví dụ: Đóng gói hộp gỗ mộc làm quà tân gia, chèn rơm lúa..."
      />
    </div>
  );
}

/**
 * Workshop Booking Form - Option 2
 */
function WorkshopForm({ form, setForm, errors, slots }) {
  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between border-b border-ceramic-border/50 pb-3">
        <h4 className="font-editorial text-lg font-bold text-ceramic-charcoal flex items-center gap-2">
          <span>Phiếu Hẹn Đến Lò Gốm Biên Hòa (Workshop)</span>
        </h4>
        <span className="text-[10px] font-mono text-ceramic-slate uppercase">1-ON-1 NGHỆ NHÂN KÈM</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Họ tên người đăng ký"
          required
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          error={errors.wName}
          type="text"
          symbol="N"
        />
        <FormInput
          label="Số điện thoại"
          required
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          error={errors.wPhone}
          type="tel"
          symbol="S"
        />
      </div>

      <FormInput
        label="Hòm thư điện tử (Email nhận xác nhận)"
        value={form.email}
        onChange={(v) => setForm({ ...form, email: v })}
        type="email"
        placeholder="ten@email.com"
        symbol="M"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <FormInput
          label="Ngày hẹn tham gia"
          required
          value={form.date}
          onChange={(v) => setForm({ ...form, date: v })}
          error={errors.date}
          type="date"
        />

        <div className="md:col-span-1">
          <label className="block text-xs font-mono uppercase text-ceramic-slate mb-1">
            Ca giờ *
          </label>
          <select
            value={form.timeSlot}
            onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
            className="
              w-full px-3 py-2.5 border text-xs
              bg-ceramic-cream text-ceramic-charcoal font-mono
              border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
            "
            aria-label="Chọn ca giờ workshop"
          >
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {errors.timeSlot && (
            <p className="text-[10px] font-mono text-ceramic-charcoal mt-1">{errors.timeSlot}</p>
          )}
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs font-mono uppercase text-ceramic-slate mb-1">
            Số lượng người
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={form.attendees}
            onChange={(e) =>
              setForm({ ...form, attendees: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
            className="
              w-full px-3 py-2.5 border text-xs
              bg-ceramic-cream text-ceramic-charcoal font-mono
              border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
            "
            aria-label="Số lượng khách tham gia"
          />
          {errors.attendees && (
            <p className="text-[10px] font-mono text-ceramic-charcoal mt-1">{errors.attendees}</p>
          )}
        </div>
      </div>

      <FormTextarea
        label="Nội dung muốn thực hành sâu (nếu có)"
        value={form.notes}
        onChange={(v) => setForm({ ...form, notes: v })}
        rows={2}
        placeholder="Ví dụ: Muốn tự tay vuốt bình gốm, tập khắc chìm hoa cúc dây và chấm men Vert de Biên Hòa..."
      />
    </div>
  );
}

/**
 * Payment Section & Cost Ledger
 */
function PaymentSection({
  fulfillmentType,
  paymentMethod,
  setPaymentMethod,
  paymentConfirmed,
  setPaymentConfirmed,
  totalItemPrice,
  shippingFee,
  workshopFee,
  totalPrice,
  isSubmitting,
  formErrors = {},
}) {
  const paymentOptions = [
    { value: 'cod', label: 'Thanh Toán Khi Nhận Hàng', code: 'COD' },
    { value: 'momo', label: 'Momo QR', code: 'MOMO' },
  ];

  // Reset payment confirmation when method changes
  React.useEffect(() => {
    setPaymentConfirmed(false);
  }, [paymentMethod, setPaymentConfirmed]);

  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-ceramic-border/50 pb-3">
        <h4 className="font-editorial text-lg font-bold text-ceramic-charcoal flex items-center gap-2">
          <span>Hình Thức Thanh Toán & Biên Nhận Chi Phí</span>
        </h4>
        <span className="text-[10px] font-mono text-ceramic-slate uppercase">
          BẢO MẬT GIAO DỊCH
        </span>
      </div>

      {/* Payment methods */}
      <div className="grid grid-rows-2 gap-3">
        {paymentOptions.map((opt) => {
          const isSelected = paymentMethod === opt.value;
          return (
            <label
              key={opt.value}
              className={`
                p-3 border flex items-center justify-between cursor-pointer transition-all
                ${isSelected
                  ? 'border-ceramic-charcoal bg-ceramic-cream ring-1 ring-ceramic-charcoal/30'
                  : 'border-ceramic-border bg-ceramic-paper hover:border-ceramic-terracotta'
                }
              `}
            >
              <div className="flex items-center gap-2 text-xs font-mono">
                <input
                  type="radio"
                  name="payment"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => setPaymentMethod(opt.value)}
                  className="accent-ceramic-terracotta cursor-pointer"
                />
                <span className={`font-bold ${isSelected ? 'text-ceramic-charcoal' : 'text-ceramic-slate'
                  }`}>
                  {opt.label}
                </span>
              </div>
              <span className="text-[10px] font-mono text-ceramic-slate">{opt.code}</span>
            </label>
          );
        })}
      </div>

      {/* Tabular Cost Breakdown Ledger */}
      <div className="border border-ceramic-border bg-ceramic-cream p-4 space-y-2 text-xs font-mono">
        <div className="flex justify-between text-ceramic-slate">
          <span>
            {fulfillmentType === 'artisan_craft'
              ? 'Chi phí chế tác gốm độc bản:'
              : 'Vé tham gia Workshop làng nghề:'}
          </span>
          <span className="text-ceramic-charcoal font-medium">
            {(fulfillmentType === 'artisan_craft' ? totalItemPrice : workshopFee).toLocaleString('vi-VN')}₫
          </span>
        </div>

        {shippingFee > 0 && fulfillmentType === 'artisan_craft' && (
          <div className="flex justify-between text-ceramic-slate">
            <span>Phí đóng gáp hộp mộc & bảo hiểm:</span>
            <span className="text-ceramic-charcoal font-medium">{shippingFee.toLocaleString('vi-VN')}₫</span>
          </div>
        )}

        <div className="flex justify-between items-baseline border-t border-ceramic-border pt-3 text-ceramic-charcoal">
          <span className="font-bold uppercase tracking-wider text-xs text-ceramic-terracotta">
            TỔNG CỘNG THANH TOÁN:
          </span>
          <span className="font-editorial text-2xl font-bold">
            {totalPrice.toLocaleString('vi-VN')}₫
          </span>
        </div>
      </div>

      {/* Payment Display: QR for Momo, COD message for COD */}
      {paymentMethod === 'momo' && (
        <div className="border-t border-ceramic-border pt-6 space-y-4">
          <div className="flex items-center justify-between text-ceramic-charcoal">
            <span className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta">
              PHƯƠNG THỨC: Ví Momo
            </span>
            <span className="text-xs font-mono text-ceramic-slate">
              Số tiền cần thanh toán
            </span>
          </div>

          {/* Step-by-step instructions (like Shopee/Lazada QR flow) */}
          <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-ceramic-slate">
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-ceramic-terracotta/20 text-ceramic-terracotta flex items-center justify-center text-[9px]">1</span>
              Mở app Momo
            </span>
            <span className="w-8 h-0.5 bg-ceramic-border" />
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-ceramic-terracotta/20 text-ceramic-terracotta flex items-center justify-center text-[9px]">2</span>
              Quét mã QR
            </span>
            <span className="w-8 h-0.5 bg-ceramic-border" />
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-ceramic-terracotta/20 text-ceramic-terracotta flex items-center justify-center text-[9px]">3</span>
              Xác nhận thanh toán
            </span>
          </div>

          {/* QR Code Display — centered, larger, cropped */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <img
                src="/assets/payments/qr-momo.jpg"
                alt="Mã QR thanh toán Momo"
                className="w-40 h-40 object-cover rounded-lg border border-ceramic-border bg-ceramic-paper"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-ceramic-terracotta rounded-full flex items-center justify-center border-2 border-ceramic-paper">
                <span className="text-[8px] font-mono text-ceramic-paper">MOMO</span>
              </div>
            </div>
            <div className="text-center space-y-1">
              <div className="font-editorial font-bold text-ceramic-terracotta text-xl">
                {totalPrice.toLocaleString('vi-VN')}₫
              </div>
              <div className="text-[10px] font-mono text-ceramic-slate">
                Nhập số tiền: {totalPrice.toLocaleString('vi-VN')}₫
              </div>
            </div>
          </div>

          {/* Payment confirmation checkbox */}
          <div className="flex items-center gap-2 p-3 bg-ceramic-cream border border-ceramic-border rounded-lg">
            <input
              type="checkbox"
              id="payment-confirmed-checkout"
              checked={paymentConfirmed}
              onChange={(e) => setPaymentConfirmed(e.target.checked)}
              className="w-4 h-4 rounded border-ceramic-border text-ceramic-terracotta focus:ring-ceramic-terracotta"
            />
            <label
              htmlFor="payment-confirmed-checkout"
              className={`text-xs font-mono ${paymentConfirmed ? 'text-ceramic-charcoal font-medium' : 'text-ceramic-slate'}`}
            >
              Tôi đã hoàn thành thanh toán qua Momo
            </label>
          </div>
        </div>
      )}


      {paymentMethod === 'cod' && (
        <div className="border-t border-ceramic-border pt-6">
          <div className="p-4 bg-ceramic-cream border border-ceramic-border rounded-xl shadow-paper text-center space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta">
              THANH TOÁN KHI NHẬN HÀNG
            </div>
            <div className="font-editorial text-xl font-bold text-ceramic-terracotta">
              {totalPrice.toLocaleString('vi-VN')}₫
            </div>
            <div className="text-[10px] font-mono text-ceramic-slate">
              Bạn sẽ thanh toán tiền mặt khi nhận được sản.
            </div>
          </div>
        </div>
      )}

      {/* Submit-level error (real server error surfaced, not faked) */}
      {formErrors.submit && (
        <div className="p-3 text-[11px] font-mono text-ceramic-charcoal bg-ceramic-cream/30 border border-ceramic-border rounded">
          ⚠ {formErrors.submit}
        </div>
      )}

      {/* Submit Button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={isSubmitting || (paymentMethod === 'momo' && !paymentConfirmed)}
        type="submit"
        className="py-4 text-xs font-mono uppercase tracking-widest"
      >
        <span className="flex items-center justify-center gap-1.5">
          <span>✓</span>
          <span>
            {isSubmitting
              ? 'Đang lập biên nhận...'
              : fulfillmentType === 'artisan_craft'
                ? 'Xác nhận đặt hàng chế tác thủ công'
                : 'Xác nhận đặt lịch hẹn tại lò gốm'}
          </span>
        </span>
      </Button>
    </div>
  );
}

/**
 * Confirmation Certificate View - shown on successful submission.
 */
function ConfirmationView({ data, currentItem, totalPrice, onBackHome, onNewDesign, fallbackImg }) {
  const isOrder = data.type === 'order';
  const refCode = isOrder ? data.data.orderId || 'GV-ORD-682914' : data.data.bookingId || 'GV-WS-114092';
  const displayImage = currentItem?.image || fallbackImg;

  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-8 md:p-12 text-center space-y-8">
      {/* Ceramic Seal Emblem */}
      <div className="w-16 h-16 border-2 border-ceramic-terracotta text-ceramic-terracotta mx-auto flex items-center justify-center font-editorial text-2xl font-bold select-none">
        ấn
      </div>

      {/* Product Thumbnail in confirmation */}
      {displayImage && (
        <div className="flex justify-center">
          <div className="w-24 h-24 border-2 border-ceramic-border overflow-hidden bg-ceramic-cream">
            <img
              src={displayImage}
              alt={currentItem?.name || 'Sản phẩm'}
              className="w-full h-full object-cover object-center"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2 max-w-lg mx-auto">
        <div className="text-[11px] font-mono uppercase tracking-widest text-ceramic-terracotta">
          {isOrder
            ? 'ĐÃ TIẾP NHẬN PHIẾU CHẾ TÁC GỐM ĐỘC BẢN'
            : 'ĐÃ GHI NHẬN LỊCH HẸN TẠI LÒ GỐM BIÊN HÒA (TÂN VẠN)'}
        </div>

        <h2 className="font-editorial text-3xl font-bold text-ceramic-charcoal">
          Mã số: {refCode}
        </h2>

        <p className="text-xs text-ceramic-slate leading-relaxed font-body pt-1">
          Kính gửi quý khách <strong>{data.data.customerName}</strong>.
          {isOrder
            ? ' Nghệ nhân xưởng Biên Hòa đã tiếp nhận thông số bản vẽ 3D và tiến hành tạo phôi thô. Quá trình phơi se, khắc chìm, chấm men và nung lò rồng dự kiến 7 - 10 ngày.'
            : ` Xưởng Tân Vạn đã xếp bàn xoay riêng và chuẩn bị đất mộc cho bạn vào ngày ${data.data.date || 'theo hẹn'} (${data.data.timeSlot || 'Ca chiều'}).`}
        </p>
      </div>

      {/* Artisan Docket Details */}
      <div className="p-5 bg-ceramic-cream border border-ceramic-border max-w-md mx-auto text-left text-xs font-mono space-y-2">
        <div className="flex justify-between">
          <span className="text-ceramic-slate">MẪU GỐM:</span>
          <span className="font-bold text-ceramic-charcoal">{currentItem?.name || 'Sản phẩm gốm'}</span>
        </div>
        {currentItem?.customText && (
          <div className="flex justify-between">
            <span className="text-ceramic-slate">DẤU KHẮC MỘC:</span>
            <span className="font-bold text-ceramic-terracotta">"{currentItem.customText}"</span>
          </div>
        )}
        <div className="flex justify-between border-t border-ceramic-border pt-2 text-ceramic-charcoal">
          <span className="text-ceramic-slate">TỔNG THANH TOÁN:</span>
          <span className="font-bold">{totalPrice.toLocaleString('vi-VN')}₫</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button variant="primary" size="md" onClick={onBackHome}>
          Về Trang Chủ Làng Gốm
        </Button>
        <Button variant="secondary" size="md" onClick={onNewDesign}>
          Tạo Mẫu Gốm Mới
        </Button>
      </div>
    </div>
  );
}

/**
 * Reusable input with label + error.
 * Symbol replaces the icon prefix with a text letter in a circle.
 */
function FormInput({ label, type, value, onChange, error, required, symbol, placeholder }) {
  return (
    <div className="text-xs space-y-1">
      <label className="block font-mono uppercase text-ceramic-slate flex items-center gap-1 text-[11px] font-semibold">
        {label}
        {required && <span className="text-ceramic-terracotta">*</span>}
      </label>
      <div className="relative">
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ceramic-terracotta/10 text-ceramic-terracotta flex-shrink-0 flex items-center justify-center text-[9px] font-bold pointer-events-none"
          aria-hidden="true"
        >
          {symbol || '•'}
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-3.5 py-2.5 border text-xs font-body
            pl-9
            ${error
              ? 'border-ceramic-terracotta focus:border-ceramic-terracotta bg-ceramic-cream/30'
              : 'border-ceramic-border focus:border-ceramic-terracotta bg-ceramic-cream'
            }
            text-ceramic-charcoal placeholder-ceramic-slate focus:outline-none transition-colors
          `}
        />
      </div>
      {error && <p className="text-[10px] font-mono text-ceramic-charcoal">{error}</p>}
    </div>
  );
}

/**
 * Reusable textarea with label.
 */
function FormTextarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="text-xs space-y-1">
      <label className="block font-mono uppercase text-ceramic-slate text-[11px] font-semibold">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full px-3.5 py-2.5 border border-ceramic-border bg-ceramic-cream
          text-ceramic-charcoal font-body focus:outline-none focus:border-ceramic-terracotta
          placeholder-ceramic-slate transition-colors
        "
      />
    </div>
  );
}
