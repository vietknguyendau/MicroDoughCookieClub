export default function Loading() {
  return (
    <div className="mx-auto max-w-xl px-5 pt-6" aria-busy="true" aria-label="Loading cookies">
      <div className="skeleton mb-6 h-3 w-24" />
      <div className="skeleton h-9 w-4/5" />
      <div className="skeleton mt-3 h-4 w-3/5" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="box mt-4 flex items-center gap-4 p-4">
          <div className="skeleton h-24 w-24 rounded-full" />
          <div className="flex-1">
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton mt-2 h-3 w-full" />
            <div className="skeleton mt-1 h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
