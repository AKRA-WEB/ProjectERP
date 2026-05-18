'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/types';
import thDict from './th.json';
import enDict from './en.json';

type DictKey = keyof typeof thDict;

const DICTS: Record<Locale, Record<string, string>> = {
  th: thDict as Record<string, string>,
  en: enDict as Record<string, string>,
};

const LS_KEY = 'erp_lang';

interface LanguageContextValue {
  lang: Locale;
  setLang: (lang: Locale) => void;
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Locale>('th');

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'th' || stored === 'en') setLangState(stored);
  }, []);

  const setLang = useCallback((next: Locale) => {
    setLangState(next);
    localStorage.setItem(LS_KEY, next);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, []);

  const t = useCallback((key: DictKey): string => {
    return DICTS[lang][key] ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): { lang: Locale; setLang: (lang: Locale) => void } {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return { lang: ctx.lang, setLang: ctx.setLang };
}

export function useT(): (key: DictKey) => string {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used inside LanguageProvider');
  return ctx.t;
}

export function localeName(
  th: string,
  en: string | null | undefined,
  lang: Locale
): string {
  return lang === 'en' ? (en ?? th) : th;
}
