import React from 'react';
import { Loader2 } from 'lucide-react';

interface QuickActionButtonProps {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  tooltip?: string;
}

export default function DashboardQuickActionButton({
  label,
  icon: Icon,
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'secondary',
  tooltip
}: QuickActionButtonProps) {
  
  const baseClasses = "inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400",
    danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50 focus:ring-red-500 disabled:bg-red-50 disabled:text-red-300",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-500"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variants[variant]}`}
      title={tooltip}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 mr-1.5" />
      ) : null}
      {label}
    </button>
  );
}
