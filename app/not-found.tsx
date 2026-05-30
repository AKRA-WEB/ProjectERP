/* eslint-disable local-rules/no-hardcoded-thai */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f4ef] text-[#78716c]">
      <h1 className="text-4xl font-bold text-[#1c1917]">404</h1>
      <p className="mt-2">ไม่พบหน้านี้ / Page Not Found</p>
      <a href="/app/menu" className="mt-6 text-emerald-600 hover:underline">
        กลับไปหน้าหลัก / Back to Menu
      </a>
    </div>
  );
}
