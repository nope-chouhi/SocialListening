'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_superuser: boolean;
  current_organization_id: number | null;
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  switchOrganization: (orgId: number) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organizations: [],
  currentOrganization: null,
  permissions: [],
  isLoading: false,
  hasPermission: () => false,
  switchOrganization: async () => {},
  refreshContext: async () => {},
});

/** Parse JWT payload without verifying signature — fast, no network */
function parseJwt(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Read cached user from localStorage (set at login time) */
function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem('cached_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem('cached_user', JSON.stringify(user));
    else localStorage.removeItem('cached_user');
  } catch {}
}

const CURRENT_AUTH_STORAGE_VERSION = '1.0.0';

function ensureAuthStorageVersion() {
  if (typeof window === 'undefined') return;
  try {
    const version = localStorage.getItem('nope_auth_storage_version');
    if (!version) {
      localStorage.setItem('nope_auth_storage_version', CURRENT_AUTH_STORAGE_VERSION);
      return;
    }
    if (version !== CURRENT_AUTH_STORAGE_VERSION) {
      localStorage.setItem('nope_auth_storage_version', CURRENT_AUTH_STORAGE_VERSION);
      console.warn('[Auth] Storage version updated. Existing auth session preserved.');
    }
  } catch (err) {
    // ignore
  }
}

function clearInvalidAuthSession() {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('cached_user');
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from cache IMMEDIATELY — no async, no loading state
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    ensureAuthStorageVersion();
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    // Check token not expired
    const payload = parseJwt(token);
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      clearInvalidAuthSession();
      return null;
    }
    return getCachedUser();
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Never blocks initial render

  const router = useRouter();
  const pathname = usePathname();
  const bgFetchRef = useRef<AbortController | null>(null);

  const fetchContext = async (showLoader = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setUser(null);
      setCachedUser(null);
      return;
    }

    if (showLoader) setIsLoading(true);

    // Cancel any in-flight request
    bgFetchRef.current?.abort();
    bgFetchRef.current = new AbortController();

    try {
      const backendUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
      const authContextUrl = backendUrl ? `${backendUrl}/api/auth/me/context` : '/api/auth/me/context';
      const res = await fetch(authContextUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: bgFetchRef.current.signal,
        cache: 'no-store',
      });

      if (res.status === 401 || res.status === 403) {
        clearInvalidAuthSession();
        setUser(null);
        if (pathname.startsWith('/dashboard')) {
          window.location.href = '/login?expired=1';
        }
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setCachedUser(data.user);
        }
        if (data.organizations) setOrganizations(data.organizations);
        if (data.permissions) setPermissions(data.permissions);
      } else {
        console.warn(`[Auth] Context fetch returned HTTP ${res.status}; preserving cached session`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Intentional cancel
      // Network error — keep cached user, don't block
      console.warn('[Auth] Background context fetch failed, using cached data');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // No token — clear everything instantly, no loading
      setUser(null);
      if (pathname.startsWith('/dashboard')) {
        router.replace('/login');
      }
      return;
    }

    // Check expiry instantly from JWT without network
    const payload = parseJwt(token);
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      clearInvalidAuthSession();
      setUser(null);
      router.replace('/login?expired=1');
      return;
    }

    // Fetch fresh context in background WITHOUT blocking UI
    fetchContext(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount — not on every pathname change

  const currentOrganization = user?.current_organization_id
    ? organizations.find(o => o.id === user.current_organization_id) || null
    : null;

  const hasPermission = (permission: string) => {
    if (user?.is_superuser) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  const switchOrganization = async (orgId: number) => {
    console.warn('Switch organization API not implemented yet');
  };

  return (
    <AuthContext.Provider value={{
      user,
      organizations,
      currentOrganization,
      permissions,
      isLoading,
      hasPermission,
      switchOrganization,
      refreshContext: () => fetchContext(true),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
