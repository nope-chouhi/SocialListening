'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Language, dictionaries, Dictionary } from '@/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyPath: string) => string;
}

const defaultLanguage: Language = 'vi';

const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => {},
  t: () => '',
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLang = localStorage.getItem('app_language') as Language;
    if (storedLang && dictionaries[storedLang]) {
      setLanguageState(storedLang);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_language', lang);
    }
  }, []);

  const t = useCallback((keyPath: string): string => {
    const keys = keyPath.split('.');
    let current: any = dictionaries[language] || dictionaries[defaultLanguage];
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to default language if key is missing in current language
        let fallbackCurrent: any = dictionaries[defaultLanguage];
        for (const fbKey of keys) {
          if (fallbackCurrent[fbKey] === undefined) return keyPath; // Return key path if fully missing
          fallbackCurrent = fallbackCurrent[fbKey];
        }
        return fallbackCurrent;
      }
      current = current[key];
    }
    
    return current;
  }, [language]);

  // Prevent hydration mismatch by rendering children without context translations initially
  // But actually we can just render context, but the initial HTML uses defaultLanguage
  // To be safe with hydration in Next.js, we should avoid changing text before mount
  
  return (
    <LanguageContext.Provider value={{ language: mounted ? language : defaultLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
