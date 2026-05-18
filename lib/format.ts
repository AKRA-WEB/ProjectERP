import type { Locale } from '@/types';

const THB = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FMT_TH = new Intl.NumberFormat('th-TH');
const NUMBER_FMT_EN = new Intl.NumberFormat('en-US');

const DATE_FMT_TH = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_FMT_EN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATETIME_FMT_TH = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const DATETIME_FMT_EN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrency(value: string | number | null | undefined, lang?: Locale): string {
  if (value == null || value === '') return lang === 'en' ? 'THB 0.00' : '฿0.00';
  return (lang === 'en' ? USD : THB).format(Number(value));
}

export function formatNumber(value: string | number | null | undefined, lang?: Locale): string {
  if (value == null || value === '') return '0';
  return (lang === 'en' ? NUMBER_FMT_EN : NUMBER_FMT_TH).format(Number(value));
}

export function formatDate(value: string | Date | null | undefined, lang?: Locale): string {
  if (!value) return '-';
  return (lang === 'en' ? DATE_FMT_EN : DATE_FMT_TH).format(new Date(value));
}

export function formatDatetime(value: string | Date | null | undefined, lang?: Locale): string {
  if (!value) return '-';
  return (lang === 'en' ? DATETIME_FMT_EN : DATETIME_FMT_TH).format(new Date(value));
}

export function formatQty(value: string | number | null | undefined, decimals = 2): string {
  if (value == null || value === '') return '0';
  return Number(value).toFixed(decimals);
}
