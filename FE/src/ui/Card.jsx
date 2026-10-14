import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';

/**
 * Shared Card primitive - paper-like container for content blocks.
 */
export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  hover = false,
  onClick,
  ...rest
}) {
  const variantClasses = {
    default: 'bg-ceramic-paper border border-ceramic-border shadow-paper',
    elevated: 'bg-ceramic-paper border border-ceramic-border shadow-card',
    interactive: 'bg-ceramic-paper border border-ceramic-border shadow-paper hover:border-ceramic-terracotta hover:shadow-card-hover transition-all cursor-pointer',
    glass: 'bg-ceramic-cream/90 backdrop-blur-md border border-ceramic-border',
  };

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
    none: 'p-0',
  };

  return (
    <div
      className={`
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${hover ? 'transition-shadow duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Card sub-components
 */
Card.Header = function CardHeader({ children, className = '' }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
};

Card.Body = function CardBody({ children, className = '' }) {
  return <div className={`space-y-3 ${className}`}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }) {
  return <div className={`mt-4 pt-4 border-t border-ceramic-border ${className}`}>{children}</div>;
};

/**
 * ────────────────────────────────────────────────────────────
 * ProductCard - Thẻ Sản Phẩm Gốm Sứ Tinh Gọn (Clean & Minimal)
 * Hiển thị chính xác các thông tin cốt lõi từ JSON:
 * - name, category, formattedPrice/price, rating, reviewCount, image/thumbnail, tag
 * Không hiển thị thêm thông số thừa, tránh rối mắt
 * ────────────────────────────────────────────────────────────
 */
export function ProductCard({ product, index, onSelect }) {
  const [imgError, setImgError] = useState(false);
  const fallbackImg = 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80';

  const { addItem } = useCart();
  const { showToast } = useToast();
  const { setSelectedProduct, setModelType, selectProductForDesign } = useDesign();
  const { setActiveTab } = useNavigation();

  const displayPrice = product.formattedPrice || (product.price ? product.price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ');
  const ratingValue = Number(product.rating || 5).toFixed(1);
  const reviews = product.reviewCount || 10;

  const handleAddToCart = (e) => {
    e?.stopPropagation();
    addItem({
      id: product.id || product.slug || `PROD-${Date.now()}`,
      name: product.name,
      price: Number(product.price) || 1320000,
      image: product.image || product.thumbnail || fallbackImg,
      modelType: product.type || 'vase',
      glazeName: product.glaze || 'Men Cổ Truyền Thống',
      glazeColor: product.glazeHex || '#2A6B5C',
      customText: '',
      isPreMade: true,
    });
    showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
  };

  const handleAddToSchedule = (e) => {
    e?.stopPropagation();
    // Set the product in design context so ScheduleScreen picks it up
    if (setSelectedProduct) setSelectedProduct(product);
    if (selectProductForDesign) selectProductForDesign(product);
    if (setModelType) setModelType(product.type || product.modelType || 'vase');
    // Navigate to schedule tab
    if (setActiveTab) setActiveTab('schedule');
    showToast(`Đã đưa "${product.name}" vào lịch đặt lịch ngắm mẫu!`);
  };

  return (
    <article
      className="
        bg-ceramic-paper border border-ceramic-border hover:border-ceramic-terracotta
        transition-all duration-300 flex flex-col justify-between group shadow-paper hover:shadow-card
        overflow-hidden
      "
    >
      {/* 1. Phần Ảnh & Tag danh mục */}
      <div className="relative aspect-[4/3] overflow-hidden bg-ceramic-cream/50 border-b border-ceramic-border">
        <img
          src={imgError ? fallbackImg : (product.image || product.thumbnail)}
          alt={product.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />
      </div>

      {/* 2. Phần Thông Tin Cốt Lõi (Gọn gàng & Rõ nét) */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Tên sản phẩm */}
          <h3
            className="font-editorial text-base font-bold text-ceramic-charcoal group-hover:text-ceramic-terracotta transition-colors leading-snug line-clamp-2"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Chủng loại / Tag dáng gốm */}
          {product.tag && (
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ceramic-slate/90">
              {product.tag}
            </div>
          )}

          {/* Đánh giá sao & lượt review */}
          <div className="flex items-center gap-1.5 pt-0.5 text-xs font-mono text-ceramic-slate">
            <span className="text-ceramic-terracotta text-sm leading-none">★</span>
            <span className="font-semibold text-ceramic-charcoal">{ratingValue}</span>
            <span className="text-[11px] text-ceramic-slate/70">({reviews} đánh giá)</span>
          </div>
        </div>

        {/* 3. Giá & Cụm Nút Hành Động */}
        <div className="pt-3 border-t border-ceramic-border space-y-3">
          {/* Giá — hàng riêng, không chồng lấn với nút */}
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-mono text-ceramic-slate uppercase whitespace-nowrap">Giá gốm:</span>
            <span className="font-editorial text-base sm:text-lg font-bold text-ceramic-terracotta leading-tight truncate">
              {displayPrice}
            </span>
          </div>

          {/* Cụm nút hành động — flex-wrap để tự xuống dòng khi không đủ chỗ */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Nút 1: Thêm vào giỏ hàng ngay */}
            <button
              type="button"
              onClick={handleAddToCart}
              title="Thêm sản phẩm thành phẩm vào giỏ hàng để đặt mua ngay"
              className="
                py-1.5 px-3 text-xs rounded-full font-medium flex-1 min-w-0
                border border-ceramic-terracotta text-ceramic-terracotta
                hover:bg-ceramic-terracotta hover:text-ceramic-paper
                transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-paper
              "
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="truncate">+ Giỏ</span>
            </button>

            {/* Nút 2: Nạp vào Bàn Xoay 3D */}
            <button
              type="button"
              onClick={onSelect}
              title="Đưa phôi vào Bàn Xoay 3D để tùy biến hoa văn & khắc chữ"
              className="py-1.5 px-3.5 text-xs rounded-full font-medium transition-all duration-200 active:scale-95 whitespace-nowrap shadow-paper bg-ceramic-terracotta hover:bg-ceramic-terracotta/90 text-ceramic-paper flex-1 min-w-0 text-center"
            >
              Nạp vào 3D
            </button>

            {/* Nút 3: Đặt lịch ngắm mẫu tại xưởng */}
            <button
              type="button"
              onClick={handleAddToSchedule}
              title="Đặt lịch ngắm mẫu gốm trực tiếp tại xưởng — hệ thống sẽ chuyển đến trang đặt lịch"
              className="
                py-1.5 px-3 text-xs rounded-full font-medium flex-1 min-w-0
                border border-ceramic-terracotta text-ceramic-terracotta
                hover:bg-ceramic-terracotta hover:text-ceramic-paper
                transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-paper
              "
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 9h12m-6 6h.01M9 18a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <span className="truncate">Đặt lịch</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

Card.Product = ProductCard;
