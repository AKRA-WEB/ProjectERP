# Frontend UI Rules

**ใช้เมื่อ:** สร้าง React Component, Client Page, Tailwind CSS, หรือแก้ไข UI ใดก็ตาม

---

## Core Rules

1. **`'use client'` ทุก page** — ห้าม RSC data fetching ฝั่ง Client. Fetch จาก API routes เท่านั้นผ่าน `lib/api-client.ts`
2. **`get` / `post` / `patch` / `del`** จาก `lib/api-client.ts` — ห้าม `fetch()` ตรง
3. **UI components** ดึงจาก `components/ui/index.ts` เท่านั้น: `Button`, `Input`, `Select`, `Modal`, `Table`, `Badge`, `StatusBadge`, `Pagination`
4. **Bilingual labels** — Thai primary, English secondary เสมอ เช่น `คลังสินค้า / Warehouse`
5. **`formatDate()`** จาก `lib/utils.ts` — ห้าม `.toLocaleDateString()` หรือ string slicing
6. **`formatCurrency()`** จาก `lib/utils.ts` — ห้าม `.toLocaleString()` หรือ template literal สำหรับ THB
7. **Pagination** — ทุก list page ต้องมี `<Pagination>` component. ห้าม render rows ทั้งหมด

## State Pattern

```typescript
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const PAGE_SIZE = 20;

useEffect(() => {
  const load = async () => {
    try {
      setLoading(true);
      const res = await get<{ data: T[]; total: number }>(`/api/...?page=${page}&pageSize=${PAGE_SIZE}`);
      setData(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };
  load();
}, [page]);
```

## PATCH Action Pattern

```typescript
await patch(`/api/.../[id]`, { action: 'approve', reason: '...' });
```

## Constraints

- ห้าม `any` โดยไม่มีเหตุผล (TypeScript strict)
- ห้าม hardcode text สกุลเงินเป็น USD — ใช้ THB เสมอ
- ห้ามใช้ `Date.getDay()` โดยตรง สำหรับ Bangkok time — ใช้ `'T00:00:00+07:00'` offset
