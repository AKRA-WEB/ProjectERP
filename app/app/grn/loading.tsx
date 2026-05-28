export default function GRNLoading() {
  return (
    <div className="max-w-[1440px] mx-auto pb-12 space-y-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-stone-100 rounded animate-pulse" />
          <div className="h-4 w-32 bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-stone-100 rounded-[7px] animate-pulse" />
          <div className="h-8 w-24 bg-stone-100 rounded-[7px] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-0 border-b border-stone-200 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-24 mx-1 my-1 bg-stone-100 rounded animate-pulse flex-shrink-0" />
        ))}
      </div>
      <div className="h-16 bg-stone-100 rounded-[10px] animate-pulse" />
      <div className="h-96 bg-stone-100 rounded-[10px] animate-pulse" />
    </div>
  );
}
