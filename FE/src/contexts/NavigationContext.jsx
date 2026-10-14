import React, { createContext, useContext, useState, useMemo } from 'react';

/**
 * Global navigation context - holds the currently active tab
 * and the setter so any component can navigate without prop drilling.
 */
const NavigationContext = createContext(null);

export const useNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
};

export function NavigationProvider({ children, initialTab = 'home' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const value = useMemo(
    () => ({ activeTab, setActiveTab }),
    [activeTab, setActiveTab]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
