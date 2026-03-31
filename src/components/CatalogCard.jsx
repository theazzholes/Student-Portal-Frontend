function CatalogCard({ catalogClass, isSelected = false, onSelect }) {
  const safeClass = catalogClass ?? {}
  const availableSeats = Number.isFinite(Number(safeClass.availableSeats))
    ? Number(safeClass.availableSeats)
    : null
  const maxCapacity = Number.isFinite(Number(safeClass.maxCapacity))
    ? Number(safeClass.maxCapacity)
    : null
  const waitlistedCount = Number.isFinite(Number(safeClass.waitlistedCount))
    ? Number(safeClass.waitlistedCount)
    : 0
  const seatsLabel = safeClass.sectionAvailability ?? 'Availability unavailable'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(safeClass.classId)}
      className={`flex h-full w-full flex-col rounded-xl border p-4 text-left shadow-sm transition-colors ${
        isSelected
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
            {safeClass.courseCode ?? 'TBA'}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">{safeClass.className ?? 'Untitled Class'}</h3>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${isSelected ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          {safeClass.department ?? 'General'}
        </span>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${isSelected ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          {safeClass.credits ?? 0} credits
        </span>
      </div>

      <dl className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
        <div className="col-span-2 min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Instructor</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.instructor ?? 'TBA'}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Meeting Times</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.displayTimes ?? 'TBA'}</dd>
        </div>
        <div className="min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Location</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.location ?? 'TBA'}</dd>
        </div>
        <div>
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Seats</dt>
          <dd className="mt-0.5 font-medium">{seatsLabel}</dd>
          <dd className={`mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
            {availableSeats ?? 'N/A'} open
            {maxCapacity !== null ? ` • ${maxCapacity} capacity` : ''}
            {waitlistedCount > 0 ? ` • ${waitlistedCount} waitlisted` : ''}
          </dd>
        </div>
      </dl>

    </button>
  )
}

export default CatalogCard
