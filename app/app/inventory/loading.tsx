export default function InventoryLoading() {
  return (
    <div className="p-6 space-y-4 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-stone-100 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-8 w-28 bg-stone-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="h-20 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-stone-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
      <div className="h-10 bg-stone-100 rounded animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
