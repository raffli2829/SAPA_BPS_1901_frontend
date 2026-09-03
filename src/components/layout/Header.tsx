'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { MobileMenuButton } from './Sidebar';
import { useMobileMenu } from './AppLayout';
import { LogOut, ArrowLeft, CheckCircle2, RefreshCw, Server, AlertCircle } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/types';
import { subscribeBackendStatus, getBackendStatus, syncWithBackend, BackendConnectionState } from '@/lib/repository';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMobileMenuOpen?: () => void;
  actions?: React.ReactNode;
  backHref?: string;
  onBack?: () => void;
}

export default function Header({
  title,
  subtitle,
  onMobileMenuOpen,
  actions,
  backHref,
  onBack,
}: HeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const mobileMenu = useMobileMenu();
  const [backendState, setBackendState] = useState<BackendConnectionState>(() => getBackendStatus());

  useEffect(() => {
    const unsub = subscribeBackendStatus((state) => {
      setBackendState(state);
    });
    return unsub;
  }, []);

  const handleMobileClick = onMobileMenuOpen || mobileMenu.openMobileMenu;

  return (
    <header className="app-header">
      <div className="header-left">
        <MobileMenuButton onClick={handleMobileClick} />
        {backHref ? (
          <Link href={backHref} className="header-back-btn" title="Kembali">
            <ArrowLeft size={16} />
          </Link>
        ) : onBack ? (
          <button type="button" onClick={onBack} className="header-back-btn" title="Kembali">
            <ArrowLeft size={16} />
          </button>
        ) : null}
        <div className="header-title-group">
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        {/* Indikator Status Koneksi Backend & Database */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            backendState.isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={`Backend Target: ${backendState.targetUrl || 'Port 80 / Ngrok'}\nDatabase: db_store.json & data_faq.csv\nTerakhir Sinkron: ${backendState.lastSyncedAt ? backendState.lastSyncedAt.toLocaleTimeString('id-ID') : 'Belum sinkron'}`}
        >
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {backendState.isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  backendState.isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <Server size={12} className="opacity-75" />
            <span className="hidden sm:inline">
              {backendState.isConnected ? 'Backend & DB Terhubung' : 'Backend Terputus'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => syncWithBackend()}
            disabled={backendState.isSyncing}
            className={`p-0.5 rounded-full hover:bg-black/5 transition-transform ${
              backendState.isSyncing ? 'animate-spin cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            title="Sinkronkan database sekarang"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        {actions}
        {isAuthenticated && user && (
          <div className="header-user">
            <div className="header-user-info">
              <span className="header-user-name">{user.name}</span>
              <span className="header-user-role">
                <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#10b981' }} />
                {ROLE_LABELS[user.role] || 'Pengelola Data BPS'}
              </span>
            </div>
            <button
              className="header-logout-btn"
              onClick={logout}
              title="Keluar dari sistem"
              type="button"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
