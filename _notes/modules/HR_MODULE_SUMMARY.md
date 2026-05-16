# HR Module Implementation Summary

This document summarizes the full implementation of the HR Module within the ERP system.

## 🚀 Overview
The HR Module provides a comprehensive suite of tools for managing employees, leave, attendance, and payroll, fully integrated with the system's Accounting and RBAC modules.

## ✨ Key Features

### 1. Employee & Org Management
- **Extended User Profiles**: Added department, position, salary grade, and employment status.
- **Department Hierarchy**: Support for parent/child departments and assigned managers.
- **Master Data**: Dedicated management for Positions and Salary Grades.

### 2. Leave Management
- **Request Workflow**: Digital submission, approval, and rejection of leave requests.
- **Automated Balances**: Real-time tracking of entitled vs. used leave days per year.
- **Thai Leave Types**: Pre-seeded with standard types (Sick, Vacation, Personal, Maternity, Ordination).

### 3. Attendance Tracking
- **Interactive Clock-In**: Employee-facing UI for daily time recording.
- **Work Schedules**: Configurable shifts with automatic late detection (15-min grace).
- **OT Calculation**: Automatic computation of overtime hours based on clock-out times.

### 4. Thai Payroll System
- **Engine**: Handles base salary, OT multipliers (1.5x/3x), and absence deductions.
- **Compliance**: Automated Thai Social Security (SSO) with caps and progressive income tax withholding.
- **PDF Payslips**: Generated on-the-fly using `@react-pdf/renderer`.
- **Accounting Link**: Automatic creation of balanced Journal Entries (Dr Expense / Cr Payable) in the General Ledger upon payroll approval.

### 5. RBAC & Security
- **Granular Permissions**: 13 new permissions (e.g., `hr:payroll:run`, `hr:leave:approve`).
- **Role Integration**: Pre-configured access for System Admins, Managers, and Staff.

## 🛠 Technical Details
- **Framework**: Next.js 15 (App Router).
- **Database**: PostgreSQL (Raw `pg` queries).
- **Validation**: Zod schema validation for all API inputs.
- **Design**: Consistent with the project's Tailwind-based UI system.

## 📂 Important Files
- **Migration**: `migrations/019_hr_departments.sql` to `023_hr_permissions.sql`.
- **API**: `app/api/hr/`
- **UI**: `app/app/hr/`
- **Logic**: `lib/hr/payroll-calc.ts`
- **Detailed Log**: `conductor/tracks/hr-module/execution-summary.md`
