'use client';
// ============================================================
// SAPA BPS 1901 IN — Auth Context
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/lib/types';
import { UserRepo } from '@/lib/repository';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userId: string) => void;
  logout: () => void;
  isReviewer: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isReviewer: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe: always start null + loading so server & client match
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Client-only: resolve user from localStorage after mount
    try {
      const stored = localStorage.getItem('sapa_bps_auth');
      if (stored) {
        const found = UserRepo.getById(stored);
        if (found) {
          setUser(found);
          setIsLoading(false);
          return;
        }
      }
      // Auto-login default user for demo
      const defaultUser = UserRepo.getById('user-1');
      if (defaultUser) {
        localStorage.setItem('sapa_bps_auth', 'user-1');
        setUser(defaultUser);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((userId: string) => {
    const found = UserRepo.getById(userId);
    if (found) {
      setUser(found);
      localStorage.setItem('sapa_bps_auth', userId);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('sapa_bps_auth');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        isReviewer: user?.role === UserRole.REVIEWER,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
