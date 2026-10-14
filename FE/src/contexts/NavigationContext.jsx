import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Global navigation context with full SPA browser history support.
 * Maps URL paths to tabs:
 *   /              -> home
 *   /gallery       -> gallery
 *   /ai-creator    -> ai-creator
 *   /studio-3d     -> studio-3d
 *   /heritage      -> heritage
 *   /cart          -> cart
 *   /checkout      -> checkout
 *   /schedule      -> schedule
 */

const PATH_TO_TAB = {
  '/': 'home',
  '/home': 'home',
  '/gallery': 'gallery',
  '/ai-creator': 'ai-creator',
  '/ai-co-creator': 'ai-creator',
  '/studio': 'studio-3d',
  '/studio-3d': 'studio-3d',
  '/heritage': 'heritage',
  '/di-san': 'heritage',
  '/cart': 'cart',
  '/checkout': 'checkout',
  '/schedule': 'schedule',
};

const TAB_TO_PATH = {
  home: '/',
  gallery: '/gallery',
  'ai-creator': '/ai-creator',
  'studio-3d': '/studio-3d',
  heritage: '/heritage',
  cart: '/cart',
  checkout: '/checkout',
  schedule: '/schedule',
};

const NavigationContext = createContext(null);

export const useNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
};

function getTabFromPathname(pathname) {
  const clean = pathname ? pathname.replace(/\/+$/, '') || '/' : '/';
  return PATH_TO_TAB[clean] || 'home';
}

export function NavigationProvider({ children, initialTab }) {
  // Read current URL path or fallback to initialTab
  const [activeTab, setActiveTabState] = useState(() => {
    if (typeof window !== 'undefined') {
      const pathTab = getTabFromPathname(window.location.pathname);
      return pathTab || initialTab || 'home';
    }
    return initialTab || 'home';
  });

  // Navigate function that pushes or replaces browser history
  const navigate = useCallback((targetTab, options = {}) => {
    const { replace = false } = options;
    setActiveTabState(targetTab);

    if (typeof window !== 'undefined') {
      const targetPath = TAB_TO_PATH[targetTab] || '/';
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';

      if (currentPath !== targetPath) {
        if (replace) {
          window.history.replaceState({ tab: targetTab }, '', targetPath);
        } else {
          window.history.pushState({ tab: targetTab }, '', targetPath);
        }
      }
    }
  }, []);

  // Listen to browser Back and Forward navigation buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ensure initial history state has tab info
    const initialPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const currentTab = getTabFromPathname(initialPath);
    if (!window.history.state || !window.history.state.tab) {
      window.history.replaceState({ tab: currentTab }, '', initialPath);
    }

    const handlePopState = (event) => {
      if (event.state && event.state.tab) {
        setActiveTabState(event.state.tab);
      } else {
        const pathTab = getTabFromPathname(window.location.pathname);
        setActiveTabState(pathTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab: navigate,
    }),
    [activeTab, navigate]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
