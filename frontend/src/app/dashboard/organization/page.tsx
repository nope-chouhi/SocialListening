'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function OrganizationPage() {
  const { currentOrganization, organizations, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Organization Settings</h1>
      
      {currentOrganization ? (
        <div className="bg-white dark:bg-[#111827] shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Current Organization</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-gray-900 dark:text-gray-200">{currentOrganization.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <p className="font-medium text-gray-900 dark:text-gray-200 capitalize">{currentOrganization.role}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md mb-8">
          You are not currently active in any organization.
        </div>
      )}

      <div className="bg-white dark:bg-[#111827] shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Your Organizations</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {organizations.map(org => (
                <tr key={org.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                    {org.name}
                    {currentOrganization?.id === org.id && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {org.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                      disabled={currentOrganization?.id === org.id}
                      className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Switch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
