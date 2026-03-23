function CatalogCard({ catalogClass }) {
  const safeClass = catalogClass ?? {}
  const availableSeats = Number.isFinite(Number(safeClass.availableSeats))
    ? Number(safeClass.availableSeats)
    : 0
  const maxCapacity = Number.isFinite(Number(safeClass.maxCapacity))
    ? Number(safeClass.maxCapacity)
    : 0
  const classTerm = safeClass.term ?? safeClass.semester ?? safeClass.sessionTerm ?? 'TBA'

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {safeClass.courseCode ?? 'TBA'}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-tight text-slate-900">
            {safeClass.className ?? 'Untitled Class'}
          </h3>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
          {safeClass.department ?? 'General'}
        </span>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
          {classTerm}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-600">
        <div className="col-span-2 min-w-0">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Instructor</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-700">{safeClass.instructor ?? 'TBA'}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Meeting Times</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-700">{safeClass.displayTimes ?? 'TBA'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
          <dd className="mt-0.5 truncate font-medium text-slate-700">{safeClass.location ?? 'TBA'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Credits</dt>
          <dd className="mt-0.5 font-medium text-slate-700">{safeClass.credits ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Seats Open</dt>
          <dd className="mt-0.5 font-medium text-slate-700">{availableSeats}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Max Capacity</dt>
          <dd className="mt-0.5 font-medium text-slate-700">{maxCapacity}</dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <p className="text-xs text-slate-500">
          {availableSeats}/{maxCapacity} seats open
        </p>
      </div>

      <button
        type="button"
        disabled
        className="mt-2 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500"
      >
        Enroll
      </button>
    </article>
  )
}

export default CatalogCard
