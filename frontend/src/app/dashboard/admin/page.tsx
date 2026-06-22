'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function GlobalAdminPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  
  if (!user?.is_superuser) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-800 p-4 rounded-md">
          Access Denied. You must be a global system administrator to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Global Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-[#111827] shadow rounded-lg p-6 border border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Organizations</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">1</p>
        </div>
        <div className="bg-white dark:bg-[#111827] shadow rounded-lg p-6 border border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Users</h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">1</p>
        </div>
        <div className="bg-white dark:bg-[#111827] shadow rounded-lg p-6 border border-gray-100 dark:border-white/5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">System Status</h3>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">Healthy</p>
        </div>
      </div>
    </div>
  );
}
