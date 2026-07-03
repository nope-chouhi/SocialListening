import { vi } from './locales/vi';
import { en } from './locales/en';
import { th } from './locales/th';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';

export const dictionaries = {
  vi,
  en,
  th,
  ja,
  ko,
  zh,
};

export type Language = keyof typeof dictionaries;
export type Dictionary = typeof vi;

export const languageNames: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  th: 'ภาษาไทย',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};
