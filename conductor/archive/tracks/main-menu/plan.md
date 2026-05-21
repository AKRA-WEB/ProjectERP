---
track: main-menu
status: Completed
aliases: ["Main Menu — Module Hub Page"]
owner: puka
module: Core
updated: 2026-05-13
---

# Main Menu — Module Hub Page

**Track:** main-menu  
**Created:** 2026-05-13  
**Status:** Ready for Gemini CLI  
**Architect:** Claude

---

## Scope

แทนที่ redirect หลัง login จาก `/app/dashboard` (WMS KPI) ด้วยหน้า **Main Menu** ที่แสดง module cards แบบ hub ให้ผู้ใช้เลือกระบบที่ต้องการเข้าทำงาน Role-based visibility บังคับ — staff เห็นเฉพาะ module ที่ตัวเองมี permission

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Route | `/app/menu` (new) | ไม่ disrupt `/app/dashboard` (WMS KPI ยังคงอยู่) |
| Post-login redirect | `/app/menu` | ผู้ใช้เห็น module selector ก่อนเสมอ |
| Data fetch | None — session only | Module visibility ใช้ role + permissions จาก session เท่านั้น ไม่ต้องเรียก API |
| Module cards | Static config array (role-filtered) | Pattern เดียวกับ `navGroups` ใน Sidebar |
| Admin block | role === 'admin' only | Consistent กับ middleware + sidebar |

---

## Module Config

| Module | Thai | ไอคอน | Entry href | Permission |
|--------|------|--------|-----------|------------|
| WMS | คลังสินค้า | 🏭 | `/app/dashboard` | `dashboard:view` |
| POS | ขายหน้าร้าน | 🛍️ | `/app/pos` | `pos:cashier` |
| Sales | การขาย | 📦 | `/app/sales-quotations` | `sq:view` |
| Accounting | การบัญชี | 📊 | `/app/accounting/chart-of-accounts` | `accounts:view` |
| HR | ทรัพยากรบุคคล | 👥 | `/app/hr/employees` | `hr:employees:view` |
| Admin | ผู้ดูแลระบบ | ⚙️ | `/app/admin/users` | role === 'admin' only |

---

## Phase 1 — Page: `app/(app)/menu/page.tsx`

- [ ] **1.1** `'use client'` — ใช้ `useSession()` เพื่อดึง `role` + `permissions`

- [ ] **1.2** Define `MODULE_CONFIG` array (ภายในไฟล์ ไม่ต้องแยกไฟล์):
  ```typescript
  interface ModuleCard {
    id: string;
    nameTh: string;
    nameEn: string;
    icon: string;
    description: string;      // Thai short desc
    href: string;             // primary entry point
    quickLinks: { label: string; href: string }[];
    permission?: string;      // if undefined → role check only
    adminOnly?: boolean;
  }
  ```

- [ ] **1.3** Implement `isModuleVisible(mod: ModuleCard, role: string, permissions: string[]): boolean`:
  - admin → sees all
  - adminOnly === true → only admin
  - else → check `permissions.includes(mod.permission)` (admin bypass already handled)

- [ ] **1.4** Render header section:
  - Greeting: `สวัสดี, [name]` + role badge
  - Subtitle: `เลือกระบบที่ต้องการใช้งาน / Select a module`
  - Current date (Thai locale, `Asia/Bangkok`)

- [ ] **1.5** Render module cards grid:
  - Responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  - Each card: large icon, Thai name, English name, description, "เข้าสู่ระบบ →" button
  - Quick links below main button (2-3 ลิงก์ shortcut)
  - Role badge บนการ์ด Admin: แสดง "Admin Only"
  - Loading state ขณะ session กำลังโหลด

- [ ] **1.6** Style — ใช้ design system ของโปรเจกต์:
  - Card: `bg-white border border-stone-200 rounded-[12px] shadow-sm hover:shadow-md transition-shadow`
  - Primary button: `bg-stone-950 text-white`
  - Quick links: `text-stone-500 hover:text-stone-800 text-[12.5px]`
  - No emojis in code — icon render ใน JSX เป็น text node

---

## Phase 2 — Middleware Update: `middleware.ts`

- [ ] **2.1** เปลี่ยน post-login redirect:
  ```typescript
  // เดิม
  return NextResponse.redirect(new URL('/app/dashboard', req.url));
  // ใหม่
  return NextResponse.redirect(new URL('/app/menu', req.url));
  ```

- [ ] **2.2** เปลี่ยน non-admin `/app/admin` redirect target ให้ชี้ไป `/app/menu` แทน `/app/dashboard`:
  ```typescript
  return NextResponse.redirect(new URL('/app/menu', req.url));
  ```

---

## Phase 3 — Sidebar: add Menu link

- [ ] **3.1** เพิ่ม entry แรกใน navGroup `ภาพรวม` ของ `components/layout/Sidebar.tsx`:
  ```typescript
  { href: '/app/menu', label: 'เมนูหลัก / Main Menu', icon: '🏠', permission: 'dashboard:view' },
  ```
  วางก่อน Dashboard entry

---

## Acceptance Criteria

- [ ] หน้า `/app/menu` โหลดได้ ไม่มี TypeScript error
- [ ] Admin เห็น 6 module cards (WMS, POS, Sales, Accounting, HR, Admin)
- [ ] Staff ที่มีแค่ `pos:cashier` เห็นเฉพาะ POS card
- [ ] คลิก "เข้าสู่ระบบ" บนการ์ด WMS → ไปที่ `/app/dashboard`
- [ ] Quick links คลิกได้และ navigate ถูก
- [ ] Login สำเร็จ → redirect ไป `/app/menu` (ไม่ใช่ `/app/dashboard` อีกต่อไป)
- [ ] `/app/admin` ถูกเข้าโดย non-admin → redirect ไป `/app/menu`
- [ ] `npm run lint` ผ่าน

---

## File Checklist

```
app/(app)/menu/page.tsx        (new)
middleware.ts                  (edit — 2 redirect targets)
components/layout/Sidebar.tsx  (edit — add menu link)
```

---

## Notes

- ไม่มี API route ใหม่ — ใช้ session data เท่านั้น
- `/app/dashboard` (WMS KPI) ไม่เปลี่ยนแปลง
- ถ้า session ยังไม่ load → แสดง skeleton/spinner แทน cards
- ห้าม hardcode user name — ดึงจาก `session.user`

---
## Execution Logs
- [[execution-summary]]

