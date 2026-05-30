'use client';

// HOW TO USE: Copy this file to app/app/<module>/page.tsx
// Replace "ExamplePage" with your component name.
// Replace t('page.example') with an appropriate key from lib/i18n/en.json.

import { useT, useLanguage } from '@/lib/i18n';

export default function ExamplePage() {
  const t = useT();
  // const { lang } = useLanguage(); // uncomment if you need dual-language DB fields

  return (
    <div>
      <h1>{t('page.dashboard')}</h1>

      {/* For dual-language fields from DB, use localeName: */}
      {/* import { localeName } from '@/lib/i18n'; */}
      {/* <span>{localeName(record.name_th, record.name_en, lang)}</span> */}

      {/* For toast messages: */}
      {/* toast.success(t('msg.save_success')); */}

      {/* DO NOT hardcode Thai text — add a key to lib/i18n/en.json + th.json first */}
    </div>
  );
}
