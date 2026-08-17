import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, jsonBody } from '../lib/api';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ user: User }>('/auth/me', { dedupe: false });
      setUser(result.user);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const expired = () => { setUser(null); window.location.hash = '#/login'; };
    window.addEventListener('skyland:session-expired', expired);
    return () => window.removeEventListener('skyland:session-expired', expired);
  }, []);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const result = await api<{ user: User }>('/auth/login', { method: 'POST', ...jsonBody({ email, password, mfaCode }) });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    try { await api('/auth/logout', { method: 'POST', dedupe: false }); } catch { /* local logout still wins */ }
    window.location.hash = '#/login';
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, loading, login, logout, refresh,
    hasPermission: permission => user?.role === 'super_admin' || Boolean(user?.effectivePermissions?.[permission]),
  }), [user, loading, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
