'use client';

import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={cn('flex items-center gap-0.5 rounded-md border border-line bg-surface-sunken p-0.5', className)}>
      <button
        onClick={() => setLang('th')}
        className={cn(
          'px-2.5 py-1 rounded text-[12px] font-semibold transition-all',
          lang === 'th'
            ? 'bg-white text-ink shadow-sm border border-line'
            : 'text-ink-3 hover:text-ink'
        )}
      >
        TH
      </button>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'px-2.5 py-1 rounded text-[12px] font-semibold transition-all',
          lang === 'en'
            ? 'bg-white text-ink shadow-sm border border-line'
            : 'text-ink-3 hover:text-ink'
        )}
      >
        EN
      </button>
    </div>
  );
}
