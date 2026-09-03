'use client';

import React, { useState, createContext, useContext } from 'react';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

export const MobileMenuContext = createContext<{
  openMobileMenu: () => void;
}>({
  openMobileMenu: () => {},
});

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobileMenu = () => setMobileOpen(true);
  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <MobileMenuContext.Provider value={{ openMobileMenu }}>
      <div className="app-layout">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onMobileClose={closeMobileMenu}
        />
        <div
          className={cn(
            'app-main',
            collapsed ? 'app-main-collapsed' : 'app-main-expanded'
          )}
        >
          {React.Children.map(children, (child) => {
            // Hanya pass onMobileMenuOpen pada React Component kustom, hindari tag HTML native (div, section, main, dsb)
            if (React.isValidElement(child) && typeof child.type !== 'string') {
              return React.cloneElement(child as React.ReactElement<{ onMobileMenuOpen?: () => void }>, {
                onMobileMenuOpen: openMobileMenu,
              });
            }
            return child;
          })}
        </div>
      </div>
    </MobileMenuContext.Provider>
  );
}
