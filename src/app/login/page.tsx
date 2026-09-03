'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { MOCK_USERS } from '@/lib/mock-data';
import { ROLE_LABELS } from '@/lib/types';
import { Sparkles, ArrowRight, Shield, User, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSelectUser = (userId: string) => {
    login(userId);
    router.push('/');
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-logo">
            <Sparkles size={28} style={{ color: '#ffffff' }} />
          </div>
          <div className="login-brand-name">SAPA BPS</div>
          <div className="login-brand-sub">KABUPATEN BANGKA • 1901 IN</div>
          <p className="login-brand-desc">
            Sistem Manajemen & Publikasi Dataset Statistik Makro
          </p>
        </div>

        <div
          style={{
            padding: '10px 14px',
            background: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #e2e8f0',
            fontSize: 12.5,
            color: '#64748b',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <Lock size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          Pilih profil pengguna untuk masuk ke dashboard:
        </div>

        <div className="login-users">
          {MOCK_USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              className="login-user-btn"
              onClick={() => handleSelectUser(user.id)}
            >
              <div
                className="login-user-avatar"
                style={{
                  background: user.role === 'REVIEWER' ? '#eff6ff' : '#f1f5f9',
                  color: user.role === 'REVIEWER' ? '#1d4ed8' : '#475569',
                  border: user.role === 'REVIEWER' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                }}
              >
                {user.name.charAt(0)}
              </div>
              <div className="login-user-details">
                <div className="login-user-name">{user.name}</div>
                <div className="login-user-role" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {user.role === 'REVIEWER' ? (
                    <Shield size={11} style={{ color: '#2563eb' }} />
                  ) : (
                    <User size={11} style={{ color: '#64748b' }} />
                  )}
                  <span>{ROLE_LABELS[user.role]}</span>
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#94a3b8' }} />
            </button>
          ))}
        </div>

        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
          Badan Pusat Statistik Kabupaten Bangka © 2026
        </div>
      </div>
    </div>
  );
}
