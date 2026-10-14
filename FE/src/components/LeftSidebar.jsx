import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useNavigation } from '../contexts/NavigationContext';
import Badge from '../ui/Badge';

/* ──────────────────────────────────────────────────────────
   Left Sidebar Navigation
   Text-based editorial navigation, no icon library.
   ── Replaces icon-driven sidebar with numbered, label-only
      architecture appropriate for a craft atelier.
   ────────────────────────────────────────────────────────── */

const USER = {
  name: 'Visionary Team',
  role: 'Creative Studio',
  avatar: 'V',
};

const menuItems = [
  { id: 'home', label: 'Trang chủ', desc: null, badge: null },
  { id: 'gallery', label: 'Thư viện mẫu', desc: null, badge: null },
  { id: 'ai-creator', label: 'Phác thảo mẫu', desc: null, badge: null },
  { id: 'studio-3d', label: 'Xưởng tạo hình', desc: null, badge: null },
];

export default function LeftSidebar({
  mobileOpen,
  setMobileOpen,
  desktopOpen = true,
  setDesktopOpen,
  isChatOpen = false,
  setIsChatOpen,
}) {
  const { totalItems } = useCart();
  const { activeTab, setActiveTab } = useNavigation();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const items = menuItems;

  // Sidebar - shared content, used for both desktop (always visible)
  // and mobile (slide-in drawer)
  const sidebarContent = (
    <>
      {/* Close button for mobile overlay */}
      {setMobileOpen && (
        <div className="lg:hidden absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="w-8 h-8 rounded-lg bg-ceramic-stone/20 hover:bg-ceramic-stone/30 text-ceramic-charcoal flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-ceramic-terracotta"
            aria-label="Đóng menu"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      )}

      <div className="flex flex-col h-full">
        {/* ── Brand Block ── */}
        <div
          className="mb-8 cursor-pointer group"
          onClick={() => setActiveTab('home')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab('home')}
          aria-label="Trang chủ Gốm Việt"
        >
          <h1 className="font-editorial text-2xl font-bold tracking-wide text-ceramic-charcoal uppercase leading-none group-hover:text-ceramic-terracotta transition-colors">
            LÀNG GỐM BIÊN HÒA
          </h1>
          <p className="text-[10px] tracking-[0.2em] uppercase text-ceramic-terracotta font-semibold mt-1.5">
            Bảo tồn và Phát triển Nghề Gốm Truyền Thống Việt Nam
          </p>
        </div>

        {/* ── Navigation Section ── */}
        <nav aria-label="Điều hướng chính" className="flex-1">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-ceramic-slate/80 px-3.5 mb-2.5">

            </div>

            {items.map((item, index) => {
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen?.(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-3 rounded-2xl
                    transition-all duration-200 text-left group outline-none
                    ${isActive
                      ? 'bg-ceramic-paper text-ceramic-charcoal shadow-card ring-1 ring-ceramic-charcoal/5 font-semibold'
                      : 'text-ceramic-slate hover:bg-ceramic-cream/60 hover:text-ceramic-charcoal'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`flex-shrink-0 transition-colors ${isActive
                        ? 'text-ceramic-terracotta'
                        : 'text-ceramic-slate group-hover:text-ceramic-terracotta'
                        }`}
                    >
                      {item.id === 'home' && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      )}
                      {item.id === 'gallery' && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="7" height="7" x="3" y="3" rx="1.5" />
                          <rect width="7" height="7" x="14" y="3" rx="1.5" />
                          <rect width="7" height="7" x="14" y="14" rx="1.5" />
                          <rect width="7" height="7" x="3" y="14" rx="1.5" />
                        </svg>
                      )}
                      {item.id === 'ai-creator' && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.29 7 12 12 20.71 7" />
                          <line x1="12" y1="22" x2="12" y2="12" />
                        </svg>
                      )}
                      {item.id === 'studio-3d' && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 2h8" />
                          <path d="M9 2v3c0 1.5-2 3-2 6 0 4 2.5 7 5 7s5-3 5-7c0-3-2-4.5-2-6V2" />
                          <path d="M7 21h10" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium leading-snug">{item.label}</div>
                      <div className="text-xs text-ceramic-slate truncate mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <Badge
                      variant={isActive ? 'primary' : 'soft'}
                      size="xs"
                      className="ml-auto"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Bottom Section ── */}
        <div className="pt-4 border-t border-ceramic-border space-y-2.5">
          {/* Nút Tư Vấn (Vector icon chat bubble - Thu nhỏ gọn gàng) */}
          <button
            type="button"
            onClick={() => setIsChatOpen && setIsChatOpen((prev) => !prev)}
            className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-paper focus-visible:ring-2 focus-visible:ring-ceramic-terracotta ${isChatOpen
              ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold shadow-paper'
              : 'bg-ceramic-paper hover:bg-ceramic-cream text-ceramic-charcoal border-ceramic-border'
              }`}
            title="Tư vấn nghệ nhân gốm Biên Hòa"
            aria-label="Tư vấn nghệ nhân"
          >
            {/* Vector chat icon */}
            <svg
              className={`w-4 h-4 transition-colors ${isChatOpen ? 'text-ceramic-paper' : 'text-ceramic-charcoal'
                }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <line x1="8" y1="9" x2="16" y2="9" />
              <line x1="8" y1="13" x2="13" y2="13" />
            </svg>
            <span className="font-medium text-center">Tư vấn</span>
          </button>

          {/* Quick Đặt Lịch Button */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('schedule');
              setMobileOpen?.(false);
            }}
            className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-paper focus-visible:ring-2 focus-visible:ring-ceramic-terracotta ${
              activeTab === 'schedule'
                ? 'bg-ceramic-terracotta text-ceramic-paper border-ceramic-terracotta font-semibold shadow-paper'
                : 'bg-ceramic-paper hover:bg-ceramic-cream text-ceramic-charcoal border-ceramic-border'
            }`}
            title="Đặt lịch đến ngắm mẫu tại xưởng gốm"
            aria-label="Đặt lịch ngắm mẫu"
          >
            {/* Calendar icon */}
            <svg
              className={`w-4 h-4 transition-colors ${activeTab === 'schedule' ? 'text-ceramic-paper' : 'text-ceramic-charcoal'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="5" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <circle cx="9" cy="14" r="1" />
              <path d="M12 14h7a2 2 0 0 1 0 4h-7" />
            </svg>
            <span className="font-medium text-center">Đặt lịch ngắm mẫu</span>
          </button>

          {/* Quick Cart Button */}
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm transition-all shadow-paper focus-visible:ring-2 focus-visible:ring-ceramic-terracotta ${activeTab === 'cart'
              ? 'bg-ceramic-paper text-ceramic-charcoal border-ceramic-border shadow-card ring-1 ring-ceramic-charcoal/5 font-semibold'
              : 'bg-ceramic-paper hover:bg-ceramic-cream text-ceramic-charcoal border-ceramic-border'
              }`}
          >
            <svg
              className={`w-4 h-4 transition-colors ${activeTab === 'cart' ? 'text-ceramic-terracotta' : 'text-ceramic-charcoal'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="font-medium text-center">Giỏ hàng</span>
            {totalItems > 0 && (
              <Badge variant="primary" size="xs">
                {totalItems}
              </Badge>
            )}
          </button>



          {/* User Avatar & Controls (Bánh răng & Ẩn Sidebar) */}
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-ceramic-terracotta text-ceramic-paper flex items-center justify-center font-editorial text-base font-bold shadow-paper">
                  {USER.avatar}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-state-success ring-2 ring-ceramic-paper" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-ceramic-charcoal truncate">
                  {USER.name}
                </div>
                <div className="text-[10px] text-ceramic-slate truncate">
                  {USER.role}
                </div>
              </div>
            </div>

            {/* Action buttons: Gear Settings & Collapse Sidebar */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Nút Bánh Răng */}
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="w-7 h-7 rounded-lg hover:bg-ceramic-paper text-ceramic-slate hover:text-ceramic-charcoal border border-transparent hover:border-ceramic-border flex items-center justify-center transition-all focus:outline-none"
                title="Cài đặt xưởng"
                aria-label="Cài đặt xưởng"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>

              {/* Nút Ẩn Sidebar */}
              <button
                type="button"
                onClick={() => {
                  if (setDesktopOpen) setDesktopOpen(false);
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className="w-7 h-7 rounded-lg hover:bg-ceramic-paper text-ceramic-slate hover:text-ceramic-charcoal border border-transparent hover:border-ceramic-border flex items-center justify-center transition-all focus:outline-none"
                title="Ẩn thanh điều hướng"
                aria-label="Ẩn thanh điều hướng"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m14 9-3 3 3 3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // On mobile: we render the sidebar as a slide-in drawer triggered by App.
  // On desktop: always visible fixed sidebar.
  return (
    <>
      {/* Desktop fixed sidebar */}
      {desktopOpen && (
        <aside className="hidden lg:flex lg:w-72 lg:h-[100dvh] lg:flex-shrink-0 lg:bg-ceramic-cream lg:border-r lg:border-ceramic-border lg:flex-col lg:overflow-y-auto lg:select-none lg:z-30 lg:transition-all">
          <div className="p-6 h-full">{sidebarContent}</div>
        </aside>
      )}

      {/* Floating button mở lại sidebar trên desktop khi đã ẩn */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen && setDesktopOpen(true)}
          className="
            hidden lg:flex fixed top-5 left-5 z-40
            px-3.5 py-2.5 bg-ceramic-paper border border-ceramic-border rounded-xl shadow-card
            text-ceramic-charcoal hover:bg-ceramic-cream items-center gap-2 text-xs font-medium
            transition-all group focus-visible:ring-2 focus-visible:ring-ceramic-terracotta
          "
          title="Mở thanh điều hướng"
          aria-label="Mở thanh điều hướng"
        >
          <svg className="w-4 h-4 text-ceramic-slate group-hover:text-ceramic-terracotta transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
            <path d="m12 9 3 3-3 3" />
          </svg>
          <span className="font-mono text-[11px] uppercase tracking-wider">Mở menu</span>
        </button>
      )}

      {/* Mobile drawer */}
      {setMobileOpen !== undefined && (
        <>
          {/* Overlay - only on mobile */}
          {mobileOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-ceramic-charcoal/40 z-40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Drawer */}
          <aside
            className={`
              lg:hidden fixed top-0 left-0 h-[100dvh] w-72 z-50
              bg-ceramic-cream border-r border-ceramic-border flex flex-col
              transform transition-transform duration-300 ease-in-out
              select-none
              ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            aria-label="Điều hướng di động"
          >
            <div className="p-6 pt-14 h-full overflow-y-auto">
              {sidebarContent}
            </div>
          </aside>

          {/* Floating hamburger trigger - always visible on mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="
              lg:hidden fixed top-5 left-5 z-30
              w-11 h-11 rounded-2xl bg-ceramic-paper shadow-card
              flex items-center justify-center
              text-ceramic-charcoal
              hover:bg-ceramic-cream focus-visible:ring-2 focus-visible:ring-ceramic-terracotta
              transition-colors
            "
            aria-label="Mở menu"
          >
            <span className="text-xl leading-none">≡</span>
          </button>
        </>
      )}

      {/* Settings Modal (Cài đặt) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ceramic-charcoal/40 p-4">
          <div className="bg-ceramic-paper border border-ceramic-border w-full max-w-sm rounded-2xl shadow-card p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-ceramic-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-ceramic-terracotta">⚙</span>
                <h3 className="font-editorial text-lg font-bold text-ceramic-charcoal">Cài đặt xưởng gốm</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-ceramic-cream text-ceramic-slate hover:text-ceramic-charcoal flex items-center justify-center transition-colors text-lg"
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-ceramic-border/50">
                <span className="text-ceramic-slate">Chế độ hiển thị 3D</span>
                <span className="font-bold text-ceramic-charcoal">WebGL Phản Xạ Cao</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-ceramic-border/50">
                <span className="text-ceramic-slate">Hệ thống lò</span>
                <span className="font-bold text-ceramic-terracotta">Lò rồng 1220°C Tân Vạn</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-ceramic-border/50">
                <span className="text-ceramic-slate">Đơn vị sáng tạo</span>
                <span className="font-bold text-ceramic-charcoal">Visionary Team</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-ceramic-slate">Phiên bản</span>
                <span className="text-ceramic-slate">Atelier Biên Hòa v1.2.0</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2.5 bg-ceramic-terracotta hover:bg-ceramic-terracotta/90 text-ceramic-paper text-xs font-mono uppercase tracking-wider rounded-xl transition-colors"
            >
              Đóng cài đặt
            </button>
          </div>
        </div>
      )}
    </>
  );
}
