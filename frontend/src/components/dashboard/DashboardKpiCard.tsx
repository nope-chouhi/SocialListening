import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
}

export default function DashboardKpiCard({ title, value, icon: Icon, colorClass }: KPIProps) {
  // Use colorClass to determine accent colors safely
  const isBlue = colorClass.includes('blue');
  const isGreen = colorClass.includes('green');
  const isRed = colorClass.includes('red');
  const isYellow = colorClass.includes('yellow');
  const isPurple = colorClass.includes('purple');
  const isIndigo = colorClass.includes('indigo');

  let accentGradient = 'from-gray-500/10 to-transparent';
  let iconColor = 'text-gray-400';
  let iconBg = 'bg-gray-500/10 border-gray-500/20';

  if (isBlue) { accentGradient = 'from-blue-500/10 to-transparent'; iconColor = 'text-blue-400'; iconBg = 'bg-blue-500/10 border-blue-500/20'; }
  else if (isGreen) { accentGradient = 'from-emerald-500/10 to-transparent'; iconColor = 'text-emerald-400'; iconBg = 'bg-emerald-500/10 border-emerald-500/20'; }
  else if (isRed) { accentGradient = 'from-rose-500/10 to-transparent'; iconColor = 'text-rose-400'; iconBg = 'bg-rose-500/10 border-rose-500/20'; }
  else if (isYellow) { accentGradient = 'from-amber-500/10 to-transparent'; iconColor = 'text-amber-400'; iconBg = 'bg-amber-500/10 border-amber-500/20'; }
  else if (isPurple) { accentGradient = 'from-purple-500/10 to-transparent'; iconColor = 'text-purple-400'; iconBg = 'bg-purple-500/10 border-purple-500/20'; }
  else if (isIndigo) { accentGradient = 'from-indigo-500/10 to-transparent'; iconColor = 'text-indigo-400'; iconBg = 'bg-indigo-500/10 border-indigo-500/20'; }

  return (
    <div className={`relative overflow-hidden bg-white dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-white/10 p-6 flex items-center justify-between transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl dark:hover:shadow-2xl hover:border-gray-200 dark:hover:border-white/20 group shadow-sm`}>
      {/* Background Gradient Accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${accentGradient} rounded-full blur-2xl -mr-10 -mt-10 opacity-30 dark:opacity-60 transition-opacity group-hover:opacity-60 dark:group-hover:opacity-100`}></div>
      
      <div className="relative z-10">
        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 tracking-wider uppercase mb-1">{title}</p>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">{value}</p>
      </div>
      
      <div className={`relative z-10 p-3.5 rounded-2xl border ${iconBg.replace('border-', 'border-gray-100 dark:border-')} shadow-sm dark:shadow-inner flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
        <Icon className={`w-6 h-6 ${iconColor.replace('400', '500 dark:text-[color]-400')} drop-shadow-[0_0_2px_currentColor] dark:drop-shadow-[0_0_8px_currentColor]`.replace('text-blue-500 dark:text-[color]-400', 'text-blue-600 dark:text-blue-400').replace('text-emerald-500 dark:text-[color]-400', 'text-emerald-600 dark:text-emerald-400').replace('text-rose-500 dark:text-[color]-400', 'text-rose-600 dark:text-rose-400').replace('text-amber-500 dark:text-[color]-400', 'text-amber-500 dark:text-amber-400').replace('text-purple-500 dark:text-[color]-400', 'text-purple-600 dark:text-purple-400').replace('text-indigo-500 dark:text-[color]-400', 'text-indigo-600 dark:text-indigo-400')} />
      </div>
    </div>
  );
}
