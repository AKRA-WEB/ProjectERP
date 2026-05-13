import { SSO_RATE, SSO_WAGE_CAP } from '../constants';

/**
 * Validates that all attendance records belong to the specified employee and period.
 * Requirement S-1 from Rework Plan.
 */
export function validateAttendanceRecords(
  records: Array<{ employee_id: string; work_date: string | Date }>,
  employeeId: string,
  month: number,
  year: number
): void {
  for (const r of records) {
    if (r.employee_id !== employeeId) {
      throw new Error(`Employee ID mismatch: expected ${employeeId}, found ${r.employee_id}`);
    }
    const date = typeof r.work_date === 'string' ? new Date(r.work_date) : r.work_date;
    if (date.getUTCMonth() + 1 !== month || date.getUTCFullYear() !== year) {
      throw new Error(`Period mismatch for record ${r.work_date}: expected ${month}/${year}`);
    }
  }
}

// Thai Social Security: 5% of min(gross, 15000), max 750 THB
export function calcSSO(grossPay: number): number {
  const base = Math.min(grossPay, SSO_WAGE_CAP);
  return Math.round(base * SSO_RATE * 100) / 100;
}

// Thai progressive income tax (annual)
const TAX_BRACKETS = [
  { from: 0, to: 150000, rate: 0 },
  { from: 150000, to: 300000, rate: 0.05 },
  { from: 300000, to: 500000, rate: 0.10 },
  { from: 500000, to: 750000, rate: 0.15 },
  { from: 750000, to: 1000000, rate: 0.20 },
  { from: 1000000, to: 2000000, rate: 0.25 },
  { from: 2000000, to: 5000000, rate: 0.30 },
  { from: 5000000, to: Infinity, rate: 0.35 },
];

function calcAnnualTax(taxableAnnual: number): number {
  let tax = 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableAnnual <= bracket.from) break;
    const inBracket = Math.min(taxableAnnual - bracket.from, bracket.to - bracket.from);
    tax += inBracket * bracket.rate;
  }
  return Math.round(tax * 100) / 100;
}

export interface CalcInput {
  baseSalary: number;
  allowancesTotal: number;
  otPay: number;
  absenceDeduction: number;
}

export interface CalcResult {
  grossPay: number;
  ssoEmployee: number;
  ssoEmployer: number;
  taxableIncome: number;
  incomeTax: number;
  total_deductions: number;
  netPay: number;
}

export function calcPayroll(input: CalcInput): CalcResult {
  const grossPay = input.baseSalary + input.allowancesTotal + input.otPay - input.absenceDeduction;

  const ssoEmployee = calcSSO(grossPay);
  const ssoEmployer = calcSSO(grossPay);

  // Annualized withholding tax
  const annualGross = grossPay * 12;
  const expenseDeduction = Math.min(annualGross * 0.5, 100000);
  const personalExemption = 60000;
  const taxableAnnual = Math.max(0, annualGross - expenseDeduction - personalExemption);
  const annualTax = calcAnnualTax(taxableAnnual);
  const incomeTax = Math.round((annualTax / 12) * 100) / 100;

  const taxableIncome = taxableAnnual / 12;
  const total_deductions = ssoEmployee + incomeTax;
  const netPay = grossPay - total_deductions;

  return { grossPay, ssoEmployee, ssoEmployer, taxableIncome, incomeTax, total_deductions, netPay };
}

// OT pay computation
// otType: 'weekday' (×1.5) | 'weekend' (×3)
export function calcOTPay(baseSalary: number, otHours: number, otType: 'weekday' | 'weekend' = 'weekday'): number {
  const hourlyRate = baseSalary / 26 / 8;
  const multiplier = otType === 'weekend' ? 3 : 1.5;
  return Math.round(hourlyRate * otHours * multiplier * 100) / 100;
}
