'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '@/lib/api';
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
  isLoading: true,
  hasPermission: () => false,
  switchOrganization: async () => {},
  refreshContext: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const pathname = usePathname();

  const fetchContext = async () => {
    try {
      const data = await auth.getContext();
      setUser(data.user);
      setOrganizations(data.organizations);
      setPermissions(data.permissions);
    } catch (error) {
      console.error('Failed to fetch auth context', error);
      // If we are in dashboard, redirect to login
      if (pathname.startsWith('/dashboard')) {
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if we have a token
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchContext();
    } else {
      setIsLoading(false);
    }
  }, [pathname]);

  const currentOrganization = user?.current_organization_id 
    ? organizations.find(o => o.id === user.current_organization_id) || null
    : null;

  const hasPermission = (permission: string) => {
    if (user?.is_superuser) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  const switchOrganization = async (orgId: number) => {
    try {
      setIsLoading(true);
      // We would call a backend endpoint to switch org, then fetch context again
      // For now, let's just pretend we have a `auth.switchOrg` API
      // await api.post(`/api/auth/me/switch-organization/${orgId}`);
      // await fetchContext();
      console.warn("Switch organization API not implemented yet");
    } finally {
      setIsLoading(false);
    }
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
      refreshContext: fetchContext
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
