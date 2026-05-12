-- ─────────────────────────────────────────────
-- HR Permissions
-- ─────────────────────────────────────────────

INSERT INTO permissions (id, name_th, name_en, module, sort_order) VALUES
  ('hr:employees:view',    'ดูพนักงาน',          'View Employees',       'hr', 200),
  ('hr:employees:create',  'เพิ่มพนักงาน',        'Create Employees',     'hr', 201),
  ('hr:employees:edit',    'แก้ไขพนักงาน',        'Edit Employees',       'hr', 202),
  ('hr:departments:view',  'ดูแผนก',              'View Departments',     'hr', 210),
  ('hr:departments:edit',  'แก้ไขแผนก',           'Edit Departments',     'hr', 211),
  ('hr:leave:view',        'ดูวันลา',             'View Leave',           'hr', 220),
  ('hr:leave:create',      'ขอลา',                'Request Leave',        'hr', 221),
  ('hr:leave:approve',     'อนุมัติวันลา',        'Approve Leave',        'hr', 222),
  ('hr:attendance:view',   'ดูการเข้างาน',        'View Attendance',      'hr', 230),
  ('hr:attendance:edit',   'แก้ไขการเข้างาน',     'Edit Attendance',      'hr', 231),
  ('hr:payroll:view',      'ดูเงินเดือน',         'View Payroll',         'hr', 240),
  ('hr:payroll:run',       'คำนวณเงินเดือน',      'Run Payroll',          'hr', 241),
  ('hr:payroll:approve',   'อนุมัติเงินเดือน',    'Approve Payroll',      'hr', 242)
ON CONFLICT (id) DO NOTHING;

-- system_admin: all HR permissions
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions WHERE module = 'hr'
ON CONFLICT DO NOTHING;

-- system_manager: view + leave:approve + attendance:view
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
  WHERE id IN ('hr:employees:view','hr:departments:view','hr:leave:view','hr:leave:approve',
               'hr:attendance:view')
ON CONFLICT DO NOTHING;

-- system_staff: own attendance + own leave
INSERT INTO employee_role_permissions (role_id, permission_id)
  SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
  WHERE id IN ('hr:attendance:view','hr:leave:view','hr:leave:create')
ON CONFLICT DO NOTHING;
