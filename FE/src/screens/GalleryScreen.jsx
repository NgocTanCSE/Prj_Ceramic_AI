import React, { useState, useEffect, useMemo } from 'react';
import ecommerceData from '../data/ecommerce_pottery_products.json';
import { PRODUCTS, CATEGORY_LABELS, MODEL_LABELS } from '../data/products';
import { ProductCard } from '../ui/Card';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';

/* ──────────────────────────────────────────────────────────
   GalleryScreen - Danh mục Phôi Gốm Thực Tế & Tác Phẩm Tuyển
   Dữ liệu kết nối động 100% từ ecommerce_pottery_products.json:
   - Tự động sinh Tabs lọc theo thẻ "categories" & "category" của JSON
   - Bạn có thể chỉnh sửa category tùy thích trong file JSON, web tự thích ứng
   ────────────────────────────────────────────────────────── */

export default function GalleryScreen() {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const { selectProductForDesign, setModelType } = useDesign();
  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();

  // Mô phỏng loading mượt mà trên mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (product) => {
    if (selectProductForDesign) {
      selectProductForDesign(product);
    } else if (setModelType) {
      setModelType(product.type || 'vase');
    }
    showToast(`✦ Đang nạp "${product.name}" vào Bàn Xoay 3D qua AI...`);
    setActiveTab('studio-3d');
  };

  // ── Sinh danh mục ĐỘNG từ thẻ "categories" & "category" của file JSON ──
  const categoryTabs = useMemo(() => {
    const rawCategories = ecommerceData.categories || [];
    const uniqueCategories = Array.from(
      new Set([...rawCategories, ...PRODUCTS.map((p) => p.category)])
    ).filter(Boolean);

    const tabs = [
      { id: 'all', label: 'Toàn bộ phôi thực tế', count: PRODUCTS.length },
    ];

    uniqueCategories.forEach((catKey) => {
      const count = PRODUCTS.filter((p) => p.category === catKey).length;
      if (count > 0) {
        tabs.push({
          id: catKey,
          label: CATEGORY_LABELS[catKey] || (catKey.charAt(0).toUpperCase() + catKey.slice(1)),
          count,
        });
      }
    });

    return tabs;
  }, []);

  // Lọc sản phẩm trực tiếp theo thẻ category của JSON
  const displayItems =
    categoryFilter === 'all'
      ? PRODUCTS
      : PRODUCTS.filter((item) => item.category === categoryFilter);

  return (
    <div className="w-full h-full overflow-y-auto p-6 md:p-10 lg:p-12 space-y-8 bg-ceramic-paper">
      {/* ── Filter Atelier Tabs ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ceramic-border pb-3">
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Lọc danh mục"
          >
            {categoryTabs.map((tab) => {
              const isActive = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="gallery-grid"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`
                    px-3.5 py-1.5 rounded-xl text-xs transition-all font-mono flex items-center gap-2 border
                    ${isActive
                      ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-medium shadow-paper'
                      : 'bg-ceramic-paper text-ceramic-slate border-ceramic-border hover:border-ceramic-terracotta hover:text-ceramic-charcoal'
                    }
                  `}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] ${isActive ? 'text-ceramic-cream/80' : 'text-ceramic-slate/60'}`}>
                    [{String(tab.count).padStart(2, '0')}]
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-ceramic-slate uppercase tracking-wider">
            Hiện có {displayItems.length} mẫu gốm
          </div>
        </div>
      </div>

      {/* ── Gallery Grid ── */}
      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <div
          id="gallery-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {displayItems.map((p, index) => (
            <ProductCard
              key={p.id || p.slug}
              product={p}
              index={index}
              onSelect={() => handleSelect(p)}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && displayItems.length === 0 && (
        <div className="text-center py-24 border border-dashed border-ceramic-border bg-ceramic-paper p-8">
          <div className="w-8 h-8 mx-auto mb-3 text-ceramic-slate/40 text-xl">○</div>
          <h3 className="font-editorial text-lg font-bold text-ceramic-charcoal">Không tìm thấy tiêu bản</h3>
          <p className="text-xs text-ceramic-slate mt-1">Không có mẫu nào tương ứng trong bộ lọc đã chọn.</p>
          <button
            type="button"
            onClick={() => {
              setMainFilter('all');
              setTypeFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl border-ceramic-terracotta text-ceramic-terracotta text-xs font-mono hover:bg-ceramic-terracotta hover:text-ceramic-paper transition-colors"
          >
          </button>
        </div>
      )}
    </div>
  );
}


/**
 * Editorial Skeleton Loader
 */
function ProductGridSkeleton({ count = 8 }) {
  const placeholders = Array.from({ length: Math.min(count, 8) });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {placeholders.map((_, i) => (
        <div
          key={i}
          className="bg-ceramic-paper border border-ceramic-border animate-pulse"
        >
          <div className="h-7 bg-ceramic-cream border-b border-ceramic-border" />
          <div className="aspect-[4/3] bg-ceramic-cream border-b border-ceramic-border" />
          <div className="p-5 space-y-3">
            <div className="h-5 bg-ceramic-cream w-3/4" />
            <div className="h-3 bg-ceramic-cream w-full" />
            <div className="h-3 bg-ceramic-cream w-2/3" />
            <div className="h-10 bg-ceramic-cream w-full mt-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
