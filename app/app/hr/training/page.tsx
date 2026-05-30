'use client';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

export default function TrainingPage() {
  const t = useT();
  return (
    <div className="flex-1 p-8">
      <div className="max-w-xl mx-auto text-center mt-24 space-y-4">
        <h1 className="font-display text-2xl font-semibold text-stone-900">{t('hr.training.title')}</h1>
        <p className="text-stone-500">Training Management</p>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          {t('hr.coming_soon')}
        </span>
        <div className="pt-4">
          <Link href="/app/hr" className="text-sm text-stone-500 hover:text-stone-900 underline">
            {t('hr.back_to_dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
