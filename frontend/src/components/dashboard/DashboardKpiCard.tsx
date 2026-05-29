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
    <div className={`relative overflow-hidden bg-[#111827] rounded-xl border border-gray-800 p-6 flex items-center justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 group`}>
      {/* Background Gradient Accent */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${accentGradient} rounded-full blur-2xl -mr-10 -mt-10 opacity-60 transition-opacity group-hover:opacity-100`}></div>
      
      <div className="relative z-10">
        <p className="text-sm font-medium text-gray-400 tracking-wide">{title}</p>
        <p className="text-3xl font-bold text-white mt-2 tracking-tight">{value}</p>
      </div>
      
      <div className={`relative z-10 p-3.5 rounded-xl border ${iconBg} shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
}
