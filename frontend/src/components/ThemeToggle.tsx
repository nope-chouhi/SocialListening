'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  return (
    <div className="relative group">
      <button className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-slate-500 dark:text-gray-400 dark:hover:text-slate-900 dark:text-white transition-colors">
        {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
      </button>
      
      <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
            theme === 'light' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Sun className="w-4 h-4" /> Light
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
            theme === 'dark' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Moon className="w-4 h-4" /> Dark
        </button>
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
            theme === 'system' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Monitor className="w-4 h-4" /> System
        </button>
      </div>
    </div>
  );
}
