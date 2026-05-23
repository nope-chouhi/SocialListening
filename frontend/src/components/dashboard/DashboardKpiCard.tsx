import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
}

export default function DashboardKpiCard({ title, value, icon: Icon, colorClass }: KPIProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex items-center justify-between transition-all hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
      </div>
      <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center`}>
        <Icon className={`w-7 h-7 ${colorClass.replace('bg-', 'text-').replace('-500', '-600').replace('-600', '-500')}`} />
      </div>
    </div>
  );
}
