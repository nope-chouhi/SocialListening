'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  if (!mounted) {
    return <div className="w-8 h-8" />;
  }

  const currentIcon = theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />;
  const label = theme === 'dark' ? 'Dark theme' : theme === 'light' ? 'Light theme' : 'System theme';

  const handleSelect = (selectedTheme: string) => {
    setTheme(selectedTheme);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        {currentIcon}
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Theme options"
          className="absolute right-0 top-full mt-2 w-32 bg-popover border border-border rounded-lg shadow-lg z-50 py-1"
        >
          <button
            type="button"
            role="option"
            aria-selected={theme === 'light'}
            onClick={() => handleSelect('light')}
            className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
              theme === 'light' ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'
            }`}
          >
            <Sun className="w-4 h-4" /> Light
          </button>
          <button
            type="button"
            role="option"
            aria-selected={theme === 'dark'}
            onClick={() => handleSelect('dark')}
            className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
              theme === 'dark' ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'
            }`}
          >
            <Moon className="w-4 h-4" /> Dark
          </button>
          <button
            type="button"
            role="option"
            aria-selected={theme === 'system'}
            onClick={() => handleSelect('system')}
            className={`flex items-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors ${
              theme === 'system' ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'
            }`}
          >
            <Monitor className="w-4 h-4" /> System
          </button>
        </div>
      )}
    </div>
  );
}
