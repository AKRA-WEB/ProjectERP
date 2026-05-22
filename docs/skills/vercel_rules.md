---
type: skill
domain: vercel
agent: antigravity
load-when: "Next.js, Vercel, deployment, build, performance, optimization"
---

# Vercel & Next.js 15 Production Best Practices

**ใช้เมื่อ:** เขียนโค้ด React Components, Next.js Pages/API Routes, จัดการการติตตั้ง/ตั้งค่า Vercel, ปรับแต่งประสิทธิภาพ (Performance), หรือแก้ไขบั๊กระหว่างการ Build บน Vercel

---

## ⚡ 1. Eliminating Async Waterfalls (CRITICAL)

Async Waterfall เกิดขึ้นเมื่อมีการเชื่อมโยง `await` ต่อกันเป็นลำดับโดยที่แต่ละการดึงข้อมูลไม่ได้พึ่งพากัน ส่งผลให้เกิด latency สะสมสะท้อนกลับไปยัง Serverless Function ของ Vercel

*   **ห้ามรันการดึงข้อมูลทีละส่วนติดต่อกันแบบ Synchronous:**
    ```typescript
    // ❌ WRONG (Waterfall)
    const stats = await getStats();
    const employees = await getEmployees();
    ```
*   **ให้ทำ Parallelization ด้วย `Promise.all()` เสมอ สำหรับข้อมูลที่เป็นอิสระต่อกัน:**
    ```typescript
    // ✅ CORRECT
    const [stats, employees] = await Promise.all([
      getStats(),
      getEmployees()
    ]);
    ```
*   **Start Promises Early, Await Late:** ใน Next.js API Routes ให้เปิดการคิวรีฐานข้อมูลหรือ Fetch ข้อมูลตั้งแต่ช่วงต้นของฟังก์ชัน แล้วรอคำตอบ (Await) ในตอนที่จำเป็นต้องใช้ข้อมูลนั้นจริง ๆ

---

## 📦 2. Bundle Size & Import Optimization

ขนาดของ bundle ส่งผลตรงต่อคะแนน Lighthouse, Cold Start ของ Vercel Serverless Function และเวลาในการโหลดหน้าเว็บครั้งแรก

*   **หลีกเลี่ยง Barrel Imports (การนำเข้าผ่านไฟล์ดัชนีรวม):**
    *   การใช้ `import { IconA, IconB } from 'lucide-react'` หรือ Barrel Import รวมใน API / Page อาจดึงไลบรารีทั้งหมดเข้ามาใน Bundle ขนาดใหญ่
    *   *แก้ไข:* ให้ทำการ Import ตรงจาก module ย่อยเมื่อเขียน API routes เพื่อลดขนาดไฟล์ Bundle
*   **ใช้ Dynamic Import สำหรับ Component ขนาดใหญ่:**
    *   Component ที่แสดงผลภายหลัง เช่น Charts, Excel Import, Modal ตัวแก้ไข PDF ควรถูกเลื่อนเวลาการโหลดออกไปด้วย `next/dynamic`
    ```typescript
    import dynamic from 'next/dynamic';
    const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
      ssr: false,
      loading: () => <p>กำลังโหลดแผนภูมิ...</p>
    });
    ```

---

## 🔄 3. Vercel View Transitions

การเปลี่ยนผ่านหน้าจออย่างลื่นไหลด้วย View Transitions API

*   **หลีกเลี่ยง Direct Import:** ห้ามนำเข้า `ViewTransition` หรือสิ่งของเกี่ยวเนื่องโดยตรงจาก React (เนื่องจากเป็นคุณลักษณะทดลอง/Experimental และจะส่งผลให้ Vercel Build ล้มเหลว)
*   **ใช้ Bridge API ของโครงการเสมอ:**
    *   ให้ทำการห่อหุ้ม Layout หรือตัวเพจด้วย `<DirectionalTransition>` จาก `@/components/ui/directional-transition` หรือใช้ `viewTransition` prop ผ่าน `<Link>` ของ Next.js
    ```tsx
    import { DirectionalTransition } from '@/components/ui/directional-transition';
    
    export default function Page() {
      return (
        <DirectionalTransition>
          <main>...</main>
        </DirectionalTransition>
      );
    }
    ```

---

## 🔒 4. Production Security & Data Gating

ความปลอดภัยบนสภาพแวดล้อม Serverless ของ Vercel

*   **สิทธิ์และการเข้าถึง (Authentication & Role Verification):**
    *   ทุก API Route และ Server Action ต้องเรียก `const session = await auth()` และเช็กสิทธิ์ทันทีก่อนการเข้าคิวรี
    *   หลีกเลี่ยงการเปิดเผยข้อมูลการเงิน (เช่น `base_salary`) สำหรับสิทธิ์พนักงานธรรมดา (จำกัดเฉพาะสิทธิ์ `admin` หรือ `manager` เท่านั้น)
*   **ความปลอดภัย SQL:**
    *   ทุก API ที่เขียนลงฐานข้อมูลหรือเรียกใช้งานต้องทำการ Parameterized Queries เสมอ (`$1, $2`) ห้ามทำ String Interpolation เป็นอันขาด
*   **Edge Env & Secrets:**
    *   ห้ามระบุคีย์ลับหรือ API Token แข็งลงในซอร์สโค้ด ให้ดึงผ่าน `process.env` เท่านั้น และคีย์ที่เป็นความลับสุดยอดห้ามมีพรีฟิกซ์ `NEXT_PUBLIC_` นำหน้า

---

## 🛠️ 5. Pre-Flight Vercel Build Validation

เพื่อลดอัตราความล้มเหลวของการทำ Build & Deploy บน Vercel ให้ทำการรันการตรวจสอบภายในเครื่องก่อน Commit งานเสมอ

1.  **TypeScript Compilation:** รัน `npx tsc --noEmit` เพื่อเช็ก Type Safety ทั้งระบบ
2.  **Lint Check:** รัน `npm run lint` เพื่อเช็กความสะอาดและมาตรฐานการเขียนโค้ด
3.  **Client Directives:** ตรวจสอบให้แน่ใจว่าหน้าเพจหรือโมดูลย่อยที่มีการเรียกใช้งาน React Hooks (`useState`, `useEffect`, `useCallback`, `useRouter`, `useLanguage`) มีการเขียน `'use client';` ไว้ที่บรรทัดบนสุดของไฟล์ 100%

---

## ❌ Traps & Anti-patterns

*   **RSC vs Client Component Hybrid Error:** Importing Next.js dynamic hooks (e.g. `useRouter`, `usePathname`) in files without `'use client';` directive triggers Vercel Webpack compilation failures.
*   **Module-level Mutable State:** Storing global mutable state in API files. Serverless containers are reused across requests, leading to memory leaks and cross-request state leakage.
*   **Sequential Loop Connection Timeout (504):** Performing massive sequential row mutations/queries in a loop over HTTP (e.g. importing >1000 items) exceeds the maximum Vercel serverless execution limit (10s on hobby, 15s/60s on Pro), causing Gateway timeouts.
    *   *Fix:* Use chunked batch inserts (e.g. 100 rows per query). Implement graceful fallback to row-by-row queries only within failing chunks to log exact row errors.

