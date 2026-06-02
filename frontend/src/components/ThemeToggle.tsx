'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
      title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-brand-blue" />
      )}
    </button>
  );
}
