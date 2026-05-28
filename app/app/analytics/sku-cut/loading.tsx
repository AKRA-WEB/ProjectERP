export default function SkuCutLoading() {
  return (
    <div className="max-w-screen-xl mx-auto p-6 space-y-6">
      <div className="h-8 w-56 bg-stone-100 rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-9 w-32 bg-stone-100 rounded animate-pulse" />
        <div className="h-9 w-32 bg-stone-100 rounded animate-pulse" />
      </div>
      <div className="h-12 bg-stone-100 rounded animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
