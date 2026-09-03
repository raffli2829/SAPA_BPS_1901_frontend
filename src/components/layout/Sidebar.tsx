'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  PenLine,
  Upload,
  MessageSquare,
  AlertTriangle,
  ShieldCheck,
  History,
  FileText,
  Users,
  ChevronLeft,
  Menu,
  X,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  group?: string;
  badge?: number | string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} /> },
    { label: 'Katalog Dataset', href: '/datasets', icon: <Database size={18} />, group: 'DATA STATISTIK' },
    { label: 'Input Data', href: '/input', icon: <PenLine size={18} />, group: 'DATA STATISTIK' },
    { label: 'Import Excel / CSV', href: '/import', icon: <Upload size={18} />, group: 'DATA STATISTIK' },
    { label: 'Template Chatbot', href: '/keywords', icon: <MessageSquare size={18} />, group: 'CHATBOT & LAYANAN' },
    { label: 'Koneksi Host WA', href: '/whatsapp', icon: <QrCode size={18} />, group: 'CHATBOT & LAYANAN' },
    { label: 'Verifikasi Data', href: '/issues', icon: <ShieldCheck size={18} />, group: 'KUALITAS & VALIDASI' },
    { label: 'Riwayat Audit', href: '/history', icon: <History size={18} />, group: 'SISTEM & RIWAYAT' },
    { label: 'Kamus Metadata', href: '/metadata', icon: <FileText size={18} />, group: 'SISTEM & RIWAYAT' },
    { label: 'Manajemen Pengguna', href: '/users', icon: <Users size={18} />, group: 'SISTEM & RIWAYAT' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  let currentGroup: string | undefined = undefined;

  const renderContent = () => (
    <>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Sparkles size={18} />
          </div>
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">
              SAPA BPS
              <span className="sidebar-brand-badge">1901 IN</span>
            </div>
            <span className="sidebar-brand-sub">BPS Kabupaten Bangka</span>
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const showGroup = item.group && item.group !== currentGroup;
          if (item.group) currentGroup = item.group;

          return (
            <React.Fragment key={item.href}>
              {showGroup && !collapsed && (
                <div className="sidebar-group-label">{item.group}</div>
              )}
              {showGroup && collapsed && (
                <div className="sidebar-divider" />
              )}
              <Link
                href={item.href}
                className={cn(
                  'sidebar-link',
                  isActive(item.href) && 'sidebar-link-active'
                )}
                title={collapsed ? item.label : undefined}
                onClick={onMobileClose}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="sidebar-link-label">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="sidebar-link-badge">{item.badge}</span>
                    )}
                  </>
                )}
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer Profile & Collapse */}
      <div className="sidebar-footer">
        {!collapsed && user && (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.name.charAt(0)}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={onToggle}
          type="button"
          title={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
        >
          <ChevronLeft
            size={16}
            className={cn(
              'transition-transform duration-200',
              collapsed && 'rotate-180'
            )}
          />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'sidebar sidebar-mobile',
          mobileOpen ? 'sidebar-mobile-open' : 'sidebar-mobile-closed'
        )}
      >
        <button className="sidebar-mobile-close" onClick={onMobileClose} type="button">
          <X size={18} />
        </button>
        {renderContent()}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sidebar sidebar-desktop',
          collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        )}
      >
        {renderContent()}
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="mobile-menu-btn"
      onClick={onClick}
      title="Buka Menu"
      type="button"
    >
      <Menu size={18} />
    </button>
  );
}
