import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { DesignProvider } from './contexts/DesignContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';

import LeftSidebar from './components/LeftSidebar';
import ChatbotAI from './components/ChatbotAI';

import HomeScreen from './screens/HomeScreen';
import GalleryScreen from './screens/GalleryScreen';
import AICoCreatorScreen from './screens/AICoCreatorScreen';
import StudioScreen from './screens/StudioScreen';
import CartScreen from './screens/CartScreen';
import CheckoutScreen from './screens/CheckoutScreen';

// Lazy-load ScheduleScreen — only fetched when user navigates to it
const ScheduleScreen = lazy(() => import('./screens/ScheduleScreen'));

import './index.css';

/**
 * Lightweight router based on activeTab from NavigationContext.
 */
function ScreenRouter() {
  const { activeTab } = useNavigation();

  const screens = {
    home: <HomeScreen />,
    gallery: <GalleryScreen />,
    'ai-creator': <AICoCreatorScreen />,
    'studio-3d': <StudioScreen />,
    cart: <CartScreen />,
    checkout: <CheckoutScreen />,
    schedule: (
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-ceramic-paper"><div className="text-ceramic-slate font-body">Đang tải trang đặt lịch…</div></div>}>
        <ScheduleScreen />
      </Suspense>
    ),
  };

  return screens[activeTab] ?? screens.home;
}

/**
 * Root Layout Orchestrator
 * ── Wraps the atelier with providers, renders the masthead,
 *    the editorial left sidebar + main content well.
 *    The StudioScreen handles its own right tool panel internally.
 *    Mobile: the left sidebar becomes a slide-in drawer.
 *    Enhanced with Lenis for silky smooth momentum scrolling.
 */
function AppShell() {
  const { activeTab } = useNavigation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const mainRef = useRef(null);
  const contentRef = useRef(null);
  const lenisRef = useRef(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const mainEl = mainRef.current;
    const contentEl = contentRef.current;
    if (!mainEl || !contentEl) return;

    const lenis = new Lenis({
      wrapper: mainEl,
      content: contentEl,
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
      infinite: false,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', (e) => {
      if (e && typeof e.progress === 'number') {
        setScrollProgress(e.progress);
      }
    });

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Smooth scroll back to top when switching between screens
  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    setScrollProgress(0);
  }, [activeTab]);

  return (
    <div className="min-h-[100dvh] bg-ceramic-paper text-ceramic-charcoal font-body flex">
      {/* Left Editorial Sidebar */}
      <LeftSidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        desktopOpen={desktopSidebarOpen}
        setDesktopOpen={setDesktopSidebarOpen}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
      />

      {/* Main Content Well with Smooth Lenis Momentum Scroll */}
      <main
        ref={mainRef}
        className={`flex-1 h-[100dvh] bg-ceramic-paper relative ${activeTab === 'studio-3d' || activeTab === 'ai-creator' ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {/* Soft scroll progress indicator at top */}
        <div className="sticky top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none">
          <div
            className="h-full bg-ceramic-terracotta transition-all duration-75"
            style={{
              width: `${Math.min(100, Math.max(0, scrollProgress * 100))}%`,
              opacity: scrollProgress > 0.01 ? 1 : 0,
            }}
          />
        </div>

        <div
          ref={contentRef}
          className={`w-full min-h-full ${activeTab === 'studio-3d' || activeTab === 'ai-creator' ? 'h-full flex flex-col overflow-hidden' : ''}`}
        >
          <ScreenRouter />
        </div>
      </main>

      {/* Float Agent Assistant */}
      <ChatbotAI isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
    </div>
  );
}

/**
 * Root entry point - provider shell.
 * All contexts wrap the AppShell so navigation, design state,
 * cart, and toast notifications are available app-wide.
 */
function Root() {
  return (
    <NavigationProvider>
      <DesignProvider>
        <CartProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </CartProvider>
      </DesignProvider>
    </NavigationProvider>
  );
}

export default Root;
