export function parseBuddhistDate(beStr: string): string {
  // Input: "DD/MM/YYYY" where YYYY is BE (e.g., "31/12/2569")
  // Output: "YYYY-MM-DD" Gregorian
  if (!beStr || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(beStr)) return '';
  const [dd, mm, byyyy] = beStr.split('/');
  const gregorianYear = parseInt(byyyy) - 543;
  return `${gregorianYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function formatBuddhistDate(isoStr: string | null | undefined): string {
  // Input: "YYYY-MM-DD" Gregorian or standard Date object ISO string representation (e.g., from DB received_date)
  // Output: "DD/MM/YYYY" BE
  if (!isoStr) return '';
  const cleanStr = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr;
  if (!cleanStr || !/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return '';
  const [yyyy, mm, dd] = cleanStr.split('-');
  return `${dd}/${mm}/${parseInt(yyyy) + 543}`;
}

export function todayBE(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const be = now.getFullYear() + 543;
  return `${dd}/${mm}/${be}`;
}
