const THB = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FMT = new Intl.NumberFormat('th-TH');

const DATE_FMT = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATETIME_FMT = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === '') return '฿0.00';
  return THB.format(Number(value));
}

export function formatNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '0';
  return NUMBER_FMT.format(Number(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  return DATE_FMT.format(new Date(value));
}

export function formatDatetime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  return DATETIME_FMT.format(new Date(value));
}

export function formatQty(value: string | number | null | undefined, decimals = 2): string {
  if (value == null || value === '') return '0';
  return Number(value).toFixed(decimals);
}
