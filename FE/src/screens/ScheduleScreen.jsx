import React, { useState, useRef, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useDesign } from '../contexts/DesignContext';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { usePersistentForm } from '../hooks/usePersistentForm';
import { WORKSHOP_SLOTS, WORKSHOP_VENUE } from '../data/workshopSlots';
import Button from '../ui/Button';

// Lazy-load PRODUCTS JSON — only needed for the mini-picker (PRODUCTS.slice(0, 8))
// Dynamic import prevents the 28-item product blob from blocking initial route render
let _productsCache = null;
function useLazyProducts() {
  const [products, setProducts] = useState(null);
  useEffect(() => {
    if (!_productsCache) {
      import('../data/products').then((mod) => {
        _productsCache = mod.PRODUCTS;
        setProducts(_productsCache);
      }).catch(() => setProducts([]));
    } else {
      setProducts(_productsCache);
    }
  }, []);
  return products;
}

// Lazy-load canvas-confetti — only used once on successful form submit
let _confettiModule = null;
async function loadConfetti() {
  if (!_confettiModule) {
    _confettiModule = await import('canvas-confetti');
  }
  return _confettiModule;
}

/* ──────────────────────────────────────────────────────────
   ScheduleScreen - Đặt Lịch Đến Ngắm Mẫu Tại Xưởng Gốm
   ── Màn hình độc lập cho phép khách hàng đặt lịch hẹn
      đến tham quan xưởng gốm Tân Vạn (Biên Hòa, Đồng Nai)
      để ngắm thử mẫu gốm thực tế, chọn màu men và họa tiết.
   ── Follows the same editorial ceramic aesthetic as Checkout.
   ────────────────────────────────────────────────────────── */

const VISIT_SLOTS = [
  '08:30 - 10:30 (Sáng)',
  '10:30 - 12:30 (Trưa)',
  '14:00 - 16:00 (Chiều)',
  '16:00 - 18:00 (Hoàng hôm)',
];

export default function ScheduleScreen({ apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000' }) {
  const containerRef = useRef(null);
  useScrollReveal(containerRef);
  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();
  const { selectedProduct, modelType, setModelType, setSelectedProduct, setPattern } = useDesign();
  const hasSelectedProduct = !!selectedProduct;

  // Lazy-load products only when needed (mini-picker path)
  const lazyProducts = useLazyProducts();

  const [form, setForm, formActions] = usePersistentForm('ceramic_schedule_form', {
    name: '',
    phone: '',
    email: '',
    date: '',
    timeSlot: VISIT_SLOTS[1],
    attendees: 2,
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [confirmed, setConfirmed] = useState(null);

  const DEPOSIT_PER_PERSON = 50000;
  const depositAmount = form.attendees * DEPOSIT_PER_PERSON;

  const validatePhone = (val) => {
    if (!val || typeof val !== 'string') return false;
    const digits = val.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 11;
  };

  const validateDate = (val) => {
    if (!val || typeof val !== 'string') return false;
    return !isNaN(Date.parse(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    if (!form.name.trim()) errors.name = 'Vui lòng nhập họ tên';
    if (!validatePhone(form.phone)) errors.phone = 'Số điện thoại không hợp lệ';
    if (!form.email.includes('@')) errors.email = 'Email không hợp lệ';
    if (!validateDate(form.date)) errors.date = 'Chọn ngày hợp lệ';
    if (!VISIT_SLOTS.includes(form.timeSlot)) errors.timeSlot = 'Chọn ca giờ hợp lệ';
    if (form.attendees < 1 || form.attendees > 8) errors.attendees = 'Số lượng 1–8 khách';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Payment confirmation gate — Momo QR requires explicit confirmation
    if (paymentMethod === 'momo' && !paymentConfirmed) {
      setFormErrors({ submit: 'Vui lòng quét QR và xác nhận đã thanh toán trước khi gửi đơn' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
          date: form.date,
          timeSlot: form.timeSlot,
          attendees: form.attendees,
          notes: form.notes || '',
          bookingType: 'visit',
          purpose: 'sample_viewing',
          paymentMethod,
          depositAmount,
          depositStatus: 'pending',
        }),
      });

      const data = await res.json();
      if (data.success) {
        triggerConfetti();
        setConfirmed(data.appointment || data.booking);
        showToast('Đặt lịch ngắm mẫu thành công! Mã số đã được ghi nhận.');
      } else {
        throw new Error(data.message || 'Lỗi đặt lịch');
      }
    } catch (err) {
      const msg = err?.message || 'Lỗi không xác định. Vui lòng thử lại.';
      console.error('[Schedule] submission error:', err);
      setFormErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerConfetti = async () => {
    try {
      const { default: confetti } = await loadConfetti();
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        scalar: 1.6,
        zIndex: 9999,
      });
    } catch {
      /* optional */
    }
  };

  const handleBack = () => {
    if (confirmed) {
      setConfirmed(null);
      setActiveTab('home');
    } else {
      setActiveTab('home');
    }
  };

  if (confirmed) {
    return (
      <div className="w-full h-full overflow-y-auto p-6 md:p-10 lg:p-12 bg-ceramic-paper text-ceramic-charcoal">
        <div className="max-w-3xl mx-auto space-y-10">
          <ConfirmationView data={confirmed} onBackHome={() => setActiveTab('home')} />
        </div>
      </div>
    );
  }

  // Nếu chưa chọn sản phẩm → show inline mini picker (chọn trực tiếp tại đây)
  if (!hasSelectedProduct) {
    return (
      <div ref={containerRef} className="w-full h-full overflow-y-auto bg-ceramic-paper text-ceramic-charcoal font-body">
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-10">

          <section className="scroll-reveal text-center space-y-6">
            <div className="space-y-3">
              <h3 className="font-editorial text-2xl font-bold text-ceramic-charcoal">
                Chưa chọn sản phẩm
              </h3>
              <p className="text-sm text-ceramic-slate max-w-md mx-auto">
                Chọn một mẫu gốm để đặt lịch ngắm tại xưởng:
              </p>
            </div>

            {/* Mini product picker — pick directly here */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {lazyProducts ? lazyProducts.slice(0, 8).map((p) => (
                <button
                  key={p.id || p.slug}
                  type="button"
                  onClick={() => {
                    // Chỉ chọn sản phẩm đơn giản — không gọi AI xử lý ảnh
                    setSelectedProduct(p);
                    setModelType(p.modelType || p.type || 'vase');
                    setPattern('none');
                  }}
                  className="flex flex-col gap-2 p-3 border border-ceramic-border bg-ceramic-paper rounded-xl hover:border-ceramic-terracotta hover:bg-ceramic-cream transition-all cursor-pointer text-center"
                >
                  <div className="aspect-square border border-ceramic-border overflow-hidden bg-ceramic-cream rounded-lg mx-auto w-full">
                    {p.image || p.thumbnail ? (
                      <img
                        src={p.image || p.thumbnail}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-[10px] font-mono text-ceramic-slate/50 flex items-center justify-center h-full">NO IMG</span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-ceramic-charcoal truncate">
                    {p.name}
                  </span>
                  <span className="text-xs font-mono text-ceramic-terracotta">
                    {(p.price || 0).toLocaleString('vi-VN')}₫
                  </span>
                </button>
              )) : (
                // Skeleton fallback while lazy-loading PRODUCTS
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse border border-ceramic-border bg-ceramic-cream/50 rounded-xl aspect-[4/3]"></div>
                ))
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button variant="primary" size="md" onClick={() => setActiveTab('gallery')}>
                Xem tất cả Thư viện mẫu
              </Button>
              <Button variant="secondary" size="md" onClick={() => setActiveTab('ai-creator')}>
                Tạo bởi AI
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto bg-ceramic-paper text-ceramic-charcoal font-body">
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 space-y-12">

        {/* ── Editorial Header ── */}
        <section className="space-y-4 scroll-reveal">
          <div className="flex items-center gap-3 text-xs font-mono text-ceramic-terracotta">
            <span className="uppercase tracking-wider">ĐẶT LỊCH NGỮ DÒNG NGẮM MẪU</span>
          </div>
        </section>

        {/* ── Selected Product Preview ── */}
        {hasSelectedProduct && (
          <section className="scroll-reveal">
            <div className="flex items-start gap-4 p-6 border border-ceramic-border bg-ceramic-cream">
              <div className="w-20 h-20 border-2 border-ceramic-border flex-shrink-0 overflow-hidden bg-ceramic-paper">
                {selectedProduct.image || selectedProduct.thumbnail ? (
                  <img
                    src={selectedProduct.image || selectedProduct.thumbnail}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover object-center"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-ceramic-slate/50 flex items-center justify-center h-full">
                    NO IMAGE
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ceramic-terracotta">
                    MẪU ĐÃ CHỌN
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedProduct(null); setModelType('mug'); setPattern('none'); }}
                    className="text-[10px] font-mono text-ceramic-slate hover:text-ceramic-terracotta underline"
                  >
                    Chọn lại
                  </button>
                </div>
                <h4 className="font-editorial text-lg font-bold text-ceramic-charcoal">
                  {selectedProduct.name}
                </h4>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-ceramic-slate">
                  <span>Loại: <strong className="text-ceramic-charcoal">{modelType}</strong></span>
                  {selectedProduct.price && (
                    <span>Giá: <strong className="text-ceramic-terracotta">{selectedProduct.price.toLocaleString('vi-VN')}₫</strong></span>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Appointment Form */}
        <section className="scroll-reveal">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-t border-ceramic-border pt-4">
              <div className="text-xs font-mono uppercase tracking-wider text-ceramic-slate mb-3">
                Thông Tin Đặt Lịch
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Họ và tên"
                required
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                error={formErrors.name}
                type="text"
                symbol="N"
              />
              <FormInput
                label="Số điện thoại"
                required
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                error={formErrors.phone}
                type="tel"
                symbol="S"
              />
            </div>

            <FormInput
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              error={formErrors.email}
              type="email"
              placeholder="ten@email.com"
              symbol="M"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <FormInput
                label="Ngày hẹn"
                required
                value={form.date}
                onChange={(v) => setForm({ ...form, date: v })}
                error={formErrors.date}
                type="date"
              />

              <div className="md:col-span-2">
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
                  aria-label="Chọn ca giờ"
                >
                  {VISIT_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
                {formErrors.timeSlot && (
                  <p className="text-[10px] font-mono text-ceramic-charcoal mt-1">{formErrors.timeSlot}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ceramic-slate mb-1">
                Số lượng người tham quan
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1)) })}
                className="
                  w-full px-3 py-2.5 border text-xs w-20
                  bg-ceramic-cream text-ceramic-charcoal font-mono
                  border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
                "
                aria-label="Số lượng khách tham quan"
              />
              {formErrors.attendees && (
                <p className="text-[10px] font-mono text-ceramic-charcoal mt-1">{formErrors.attendees}</p>
              )}
            </div>

            <FormTextarea
              label="Yêu cầu ngắm mẫu (nếu có)"
              value={form.notes}
              onChange={(v) => setForm({ ...form, notes: v })}
              rows={2}
              placeholder="Ví dụ: Muốn ngắm men xanh đồng Vert de Biên Hòa, họa tiết hoa sen khắc chìm..."
            />

            {/* Visit Notes */}
            <div className="p-4 bg-ceramic-cream border border-ceramic-border text-xs text-ceramic-slate">
              <div className="font-mono text-[11px] font-bold text-ceramic-charcoal uppercase flex items-center gap-1.5">
                <span className="text-ceramic-terracotta">!</span>
                <span>Lưu ý khi đến ngắm:</span>
              </div>
              <p className="mt-1 leading-relaxed">
                Lịch hẹn ngắm mẫu miễn phí, nhưng bắt buộc đặt cọc {DEPOSIT_PER_PERSON.toLocaleString('vi-VN')}₫/người
                để khóa chỗ. Số tiền cọc sẽ được hoàn trả hoặc khấu trừ khi bạn đặt hàng thực tế tại xưởng.
              </p>
            </div>

            {/* Deposit & Payment Section */}
            <div className="border-t border-ceramic-border pt-6 space-y-6">
              {/* Cost Breakdown */}
              <div className="border border-ceramic-border bg-ceramic-cream p-4 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-ceramic-slate">
                  <span>Cọc đặt chỗ ({form.attendees} người × {DEPOSIT_PER_PERSON.toLocaleString('vi-VN')}₫):</span>
                  <span className="text-ceramic-charcoal font-medium">
                    {depositAmount.toLocaleString('vi-VN')}₫
                  </span>
                </div>
                <div className="flex justify-between text-ceramic-slate">
                  <span>Phí dịch vụ ngắm mẫu:</span>
                  <span className="text-ceramic-charcoal font-medium">0₫ (miễn phí)</span>
                </div>
                <div className="flex justify-between items-baseline border-t border-ceramic-border pt-3 text-ceramic-charcoal">
                  <span className="font-bold uppercase tracking-wider text-xs text-ceramic-terracotta">
                    TỔNG CỘNG PHẢI TRẢ:
                  </span>
                  <span className="font-editorial text-2xl font-bold">
                    {depositAmount.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="text-xs font-mono uppercase tracking-wider text-ceramic-slate mb-2">
                PHƯƠNG THỨC THANH TOÁN CỌC
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'cod', label: 'Thanh Toán Khi Đến Xưởng', code: 'COD' },
                  { value: 'momo', label: 'Momo QR', code: 'MOMO' },
                ].map((opt) => {
                  const isSelected = paymentMethod === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`
                        p-3 border flex items-center justify-between cursor-pointer transition-all
                        ${isSelected
                          ? 'border-ceramic-charcoal bg-ceramic-cream ring-1 ring-ceramic-charcoal/30'
                          : 'border-ceramic-border bg-ceramic-paper hover:border-ceramic-terracotta'}
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
                        <span className={`font-bold ${isSelected ? 'text-ceramic-charcoal' : 'text-ceramic-slate'}`}>
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-ceramic-slate">{opt.code}</span>
                    </label>
                  );
                })}
              </div>

              {/* Momo QR */}
              {paymentMethod === 'momo' && (
                <div className="border-t border-ceramic-border pt-6 space-y-4">
                  <div className="flex items-center justify-between text-ceramic-charcoal">
                    <span className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta">
                      PHƯƠNG THỨC: Ví Momo
                    </span>
                    <span className="text-xs font-mono text-ceramic-slate">
                      Số tiền cọc đặt chỗ
                    </span>
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-ceramic-slate">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-ceramic-terracotta/20 flex items-center justify-center text-[7px] text-ceramic-terracotta">1</span>
                      Mở app Momo
                    </span>
                    <span className="w-4 h-0.5 bg-ceramic-border" />
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-ceramic-terracotta/20 flex items-center justify-center text-[7px] text-ceramic-terracotta">2</span>
                      Quét QR
                    </span>
                    <span className="w-4 h-0.5 bg-ceramic-border" />
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-ceramic-terracotta/20 flex items-center justify-center text-[7px] text-ceramic-terracotta">3</span>
                      Xác nhận trả cọc
                    </span>
                  </div>

                  {/* QR Code Display */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <img
                        src="/assets/payments/qr-momo.jpg"
                        alt="Mã QR thanh toán cọc"
                        className="w-48 h-48 object-cover rounded-lg border border-ceramic-border bg-ceramic-paper"
                      />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-ceramic-terracotta rounded-full flex items-center justify-center border-2 border-ceramic-paper">
                        <span className="text-[6px] font-mono text-ceramic-paper">MOMO</span>
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-editorial font-bold text-ceramic-terracotta text-xl">
                        {depositAmount.toLocaleString('vi-VN')}₫
                      </div>
                      <div className="text-[10px] font-mono text-ceramic-slate">
                        Nhập số tiền cọc: {depositAmount.toLocaleString('vi-VN')}₫
                      </div>
                    </div>
                  </div>

                  {/* Payment confirmation checkbox */}
                  <div className="flex items-center gap-2 p-3 bg-ceramic-cream border border-ceramic-border rounded-lg">
                    <input
                      type="checkbox"
                      id="payment-confirmed-schedule"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-ceramic-border text-ceramic-terracotta focus:ring-ceramic-terracotta"
                    />
                    <label
                      htmlFor="payment-confirmed-schedule"
                      className={`text-xs font-mono ${paymentConfirmed ? 'text-ceramic-charcoal font-medium' : 'text-ceramic-slate'}`}
                    >
                      Tôi đã hoàn thành thanh toán cọc qua Momo
                    </label>
                  </div>
                </div>
              )}

              {/* COD */}
              {paymentMethod === 'cod' && (
                <div className="p-4 bg-ceramic-cream border border-ceramic-border rounded-xl shadow-paper text-center">
                  <div className="text-xs font-mono uppercase tracking-wider text-ceramic-terracotta mb-1">
                    THANH TOÁN KHI ĐẾN XƯỢNG
                  </div>
                  <div className="font-editorial text-xl font-bold text-ceramic-terracotta">
                    {depositAmount.toLocaleString('vi-VN')}₫
                  </div>
                  <div className="text-[10px] font-mono text-ceramic-slate mt-1">
                    Bạn sẽ thanh toán cọc khi đến xưởng gốm để nhận chỗ.
                  </div>
                </div>
              )}
            </div>

            {/* Submit-level error */}
            {formErrors.submit && (
              <div className="p-3 text-[11px] font-mono text-ceramic-charcoal bg-ceramic-cream/30 border border-ceramic-border rounded">
                ⚠ {formErrors.submit}
              </div>
            )}

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
                  {isSubmitting ? 'Đang ghi nhận lịch hẹn...' : 'Xác nhận đặt lịch ngắm mẫu'}
                </span>
              </span>
            </Button>

            {/* Form persistence help */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-ceramic-border text-xs font-mono text-ceramic-slate">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-state-success rounded-full animate-pulse" />
                  Dữ liệu form tự động lưu trình duyệt
                </span>
                {formActions.lastSaved && (
                  <span className="text-[10px] text-ceramic-slate/60">
                    Lưu lúc: {formActions.lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(form, null, 2)).then(() => {
                    showToast('Đã sao chép JSON form! Dán ở máy khác để khôi phục.', 'success');
                  });
                }}>
                  Sao chép JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={async () => {
                  const pasted = await navigator.clipboard.readText();
                  try {
                    const parsed = JSON.parse(pasted);
                    setForm((prev) => ({ ...prev, ...parsed }));
                    showToast('Đã khôi phục form từ clipboard!', 'success');
                  } catch {
                    const json = prompt('Dán JSON form vào đây để khôi phục:');
                    if (json) {
                      try {
                        const parsed = JSON.parse(json);
                        setForm((prev) => ({ ...prev, ...parsed }));
                        showToast('Đã khôi phục form thành công!', 'success');
                      } catch {
                        showToast('JSON không hợp lệ!', 'error');
                      }
                    }
                  }
                }}>
                  Nhập form
                </Button>
                <Button variant="secondary" size="sm" onClick={() => {
                  formActions.clear();
                  showToast('Đã xóa dữ liệu form đã lưu!', 'success');
                }}>
                  Xóa form
                </Button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

/**
 * Confirmation Certificate View
 */
function ConfirmationView({ data, onBackHome }) {
  const refCode = data.appointmentId || data.bookingId || 'GV-VST-447012';

  return (
    <div className="bg-ceramic-paper border border-ceramic-border p-8 md:p-12 text-center space-y-8">
      {/* Ceramic Seal Emblem */}
      <div className="w-16 h-16 border-2 border-ceramic-terracotta text-ceramic-terracotta mx-auto flex items-center justify-center font-editorial text-2xl font-bold select-none">
        ấn
      </div>

      <div className="space-y-2 max-w-lg mx-auto">
        <div className="text-[11px] font-mono uppercase tracking-widest text-ceramic-terracotta">
          ĐÃ GHI NHẬN LỊCH NGỮ DÒNG NGẮM MẪU TẠI XƯỢNG GỐM
        </div>

        <h2 className="font-editorial text-3xl font-bold text-ceramic-charcoal">
          Mã số: {refCode}
        </h2>

        <p className="text-xs text-ceramic-slate leading-relaxed font-body pt-1">
          Kính gửi <strong>{data.customerName}</strong>. Xưởng Tân Vạn đã ghi nhận lịch
          đến ngắm mẫu của bạn vào ngày {data.date || 'theo hẹn'} ({data.timeSlot || 'theo ca'})
          với {data.attendees || 1} khách hàng. Đã đặt cọc {data.depositAmount || 0}₫
          qua {data.paymentMethod === 'cod' ? 'thanh toán khi đến xưởng' : 'Momo QR'}.
          Nghệ nhân sẽ đón tiếp và hướng dẫn lựa chọn mẫu men màu, họa tiết và khắc chữ trực tiếp tại xưởng.
        </p>
      </div>

      {/* Visit Docket Details */}
      <div className="p-5 bg-ceramic-cream border border-ceramic-border max-w-md mx-auto text-left text-xs font-mono space-y-2">
        <div className="flex justify-between">
          <span className="text-ceramic-slate">TÊN:</span>
          <span className="font-bold text-ceramic-charcoal">{data.customerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ceramic-slate">SĐT:</span>
          <span className="font-bold text-ceramic-charcoal">{data.customerPhone}</span>
        </div>
        <div className="flex justify-between border-t border-ceramic-border pt-2">
          <span className="text-ceramic-slate">NGÀY:</span>
          <span className="font-bold text-ceramic-charcoal">{data.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ceramic-slate">CA:</span>
          <span className="font-bold text-ceramic-charcoal">{data.timeSlot}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ceramic-slate">SỐ NGƯỜI:</span>
          <span className="font-bold text-ceramic-charcoal">{data.attendees}</span>
        </div>
        <div className="flex justify-between border-t border-ceramic-border pt-2">
          <span className="text-ceramic-slate">PHƯƠNG THỨC CỌC:</span>
          <span className="font-bold text-ceramic-charcoal">
            {data.paymentMethod === 'cod' ? 'Thanh toán khi đến xưởng' : 'Momo QR'}
          </span>
        </div>
        <div className="flex justify-between border-t border-ceramic-border pt-2 text-ceramic-charcoal">
          <span className="text-ceramic-slate">SỐ TIỀN CỌC:</span>
          <span className="font-bold text-ceramic-terracotta">
            {(data.depositAmount || 0).toLocaleString('vi-VN')}₫
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ceramic-slate">TRẠNG THÁI CỌC:</span>
          <span className="font-bold text-ceramic-charcoal">
            {data.depositStatus === 'paid' ? 'Đã thanh toán' : data.paymentMethod === 'cod' ? 'Chưa thanh toán (trả khi đến)' : 'Chuyển khoản chưa xác minh'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Button variant="primary" size="md" onClick={onBackHome}>
          Về Trang Chủ Làng Gốm
        </Button>
        <Button variant="secondary" size="md" onClick={() => window.location.reload()}>
          Đặt Lịch Khác
        </Button>
      </div>
    </div>
  );
}

/**
 * Reusable input with label + error.
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
            w-full px-3 py-2.5 pl-10 border text-xs rounded
            bg-ceramic-cream text-ceramic-charcoal font-mono
            border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
            ${error ? 'border-ceramic-terracotta' : ''}
          `}
          aria-invalid={error ? 'true' : 'false'}
        />
        {error && (
          <p className="text-[10px] font-mono text-ceramic-terracotta mt-0.5">{error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Reusable textarea with label.
 */
function FormTextarea({ label, value, onChange, error, rows = 3, placeholder }) {
  return (
    <div className="text-xs space-y-1">
      <label className="block font-mono uppercase text-ceramic-slate flex items-center gap-1 text-[11px] font-semibold">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`
          w-full px-3 py-2.5 border text-xs rounded
          bg-ceramic-cream text-ceramic-charcoal font-mono
          border-ceramic-border focus:outline-none focus:border-ceramic-terracotta
          resize-y
          ${error ? 'border-ceramic-terracotta' : ''}
        `}
      />
      {error && (
        <p className="text-[10px] font-mono text-ceramic-terracotta mt-0.5">{error}</p>
      )}
    </div>
  );
}
