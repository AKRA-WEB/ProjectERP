export default function DashboardLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-4 pt-2">
      <div className="h-8 w-72 bg-stone-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 bg-stone-100 rounded-[10px] animate-pulse" />
        <div className="h-72 bg-stone-100 rounded-[10px] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 bg-stone-100 rounded-[10px] animate-pulse" />
        <div className="h-48 bg-stone-100 rounded-[10px] animate-pulse" />
      </div>
    </div>
  );
}
