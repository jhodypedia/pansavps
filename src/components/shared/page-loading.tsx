export function PageLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E7F4EC]" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded bg-[#F0F3F1]" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-[#E3E8E4] bg-[#F7F8F7]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
