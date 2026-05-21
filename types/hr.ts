import { EmploymentType, EmployeeStatus, LeaveRequestStatus, AttendanceStatus, PayrollRunStatus } from './api';

export interface Department {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  parent_id: string | null;
  manager_id: string | null;
  manager_name_th?: string;
  manager_name_en?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  department_id: string | null;
  department_name_th?: string;
  salary_grade_id: string | null;
  salary_grade_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryGrade {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  base_salary_min: number;
  base_salary_max: number;
  created_at: string;
  updated_at: string;
}

export interface HrEmployee {
  id: string;
  employee_id: string | null;
  name_th: string;
  name_en: string;
  email: string;
  role: string;
  department_id: string | null;
  department_name_th: string | null;
  department_name_en: string | null;
  position_id: string | null;
  position_name_th: string | null;
  position_name_en: string | null;
  salary_grade_id: string | null;
  salary_grade_name: string | null;
  base_salary: number | null;
  employment_type: EmploymentType;
  employee_status: EmployeeStatus;
  hired_date: string | null;
  resignation_date: string | null;
  phone: string | null;
  created_at: string;
}

export interface LeaveType {
  id: string;
  code: string;
  name_th: string;
  name_en: string;
  days_per_year: number;
  is_paid: boolean;
  carry_over: boolean;
  is_active: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  year: number;
  days_entitled: number;
  days_used: number;
  days_remaining: number;
}

export interface LeaveRequest {
  id: string;
  request_number: string;
  employee_id: string;
  employee_name_th: string;
  employee_name_en: string;
  leave_type_id: string;
  leave_type_name_th: string;
  leave_type_name_en: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: LeaveRequestStatus;
  approved_by: string | null;
  approved_by_name_th: string | null;
  approved_by_name_en: string | null;
  approved_at: string | null;
  notes: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name_th?: string;
  employee_name_en?: string;
  employee_code?: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  ot_hours: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  name_th: string;
  name_en: string;
  shift_start: string;
  shift_end: string;
  days_of_week: number[];
  is_default: boolean;
  is_active: boolean;
}

export interface PayrollAllowance {
  name_th: string;
  name_en: string;
  amount: number;
}

export interface PayrollLine {
  id: string;
  run_id: string;
  employee_id: string;
  employee_name_th: string;
  employee_name_en: string;
  employee_id_code: string | null;
  base_salary: number;
  allowances: PayrollAllowance[];
  ot_pay: number;
  absence_deduction: number;
  gross_pay: number;
  sso_employee: number;
  sso_employer: number;
  taxable_income: number;
  income_tax: number;
  total_deductions: number;
  net_pay: number;
  slip_url: string | null;
}

export interface PayrollRun {
  id: string;
  run_number: string;
  period_month: number;
  period_year: number;
  status: PayrollRunStatus;
  total_gross: number;
  total_net: number;
  total_sso_emp: number;
  total_sso_co: number;
  total_tax: number;
  approved_by: string | null;
  approved_by_name_th: string | null;
  approved_by_name_en: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  created_by: string;
  created_by_name_th: string | null;
  created_by_name_en: string | null;
  created_at: string;
  lines?: PayrollLine[];
}
