function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toCodeTokens(value) {
  return String(value ?? '')
    .toUpperCase()
    .match(/[A-Z]+|\d+[A-Z]?/g) ?? []
}

function formatCourseTitle(title, courseCode) {
  const normalizedTitle = String(title ?? '').trim()
  if (!normalizedTitle) {
    return 'Untitled Class'
  }

  const codeTokens = toCodeTokens(courseCode)
  if (codeTokens.length === 0) {
    return normalizedTitle
  }

  const tokenPattern = codeTokens.map(escapeRegExp).join('\\s*[-_ ]*')
  const codePrefixPattern = new RegExp(`^${tokenPattern}(?:\\s*[-:|]\\s*|\\s+)`, 'i')

  let strippedTitle = normalizedTitle
  let previousValue = ''
  while (strippedTitle !== previousValue) {
    previousValue = strippedTitle
    strippedTitle = strippedTitle.replace(codePrefixPattern, '').trim()
  }

  return strippedTitle || 'Course title unavailable'
}

function buildSeatSummary({ availableSeats, maxCapacity, waitlistedCount, seatsLabel }) {
  if (availableSeats !== null && maxCapacity !== null) {
    const summary = `${availableSeats} of ${maxCapacity} seats open`
    return waitlistedCount > 0 ? `${summary} | ${waitlistedCount} waitlisted` : summary
  }

  if (availableSeats !== null) {
    const summary = `${availableSeats} seats open`
    return waitlistedCount > 0 ? `${summary} | ${waitlistedCount} waitlisted` : summary
  }

  return seatsLabel
}

function CatalogCard({ catalogClass, isSelected = false, onSelect }) {
  const safeClass = catalogClass ?? {}
  const availableSeats = Number.isFinite(Number(safeClass.availableSeats)) ? Number(safeClass.availableSeats) : null
  const maxCapacity = Number.isFinite(Number(safeClass.maxCapacity)) ? Number(safeClass.maxCapacity) : null
  const waitlistedCount = Number.isFinite(Number(safeClass.waitlistedCount)) ? Number(safeClass.waitlistedCount) : 0
  const seatsLabel = safeClass.sectionAvailability ?? 'Availability unavailable'
  const title = formatCourseTitle(safeClass.className, safeClass.courseCode)
  const seatSummary = buildSeatSummary({ availableSeats, maxCapacity, waitlistedCount, seatsLabel })
  const seatState = safeClass.isFull ? 'Full' : availableSeats !== null ? 'Open' : 'TBA'
  const seatStateClasses = safeClass.isFull
    ? isSelected
      ? 'border-rose-300/30 bg-rose-500/20 text-rose-100'
      : 'border-rose-200 bg-rose-50 text-rose-700'
    : availableSeats !== null
      ? isSelected
        ? 'border-emerald-300/30 bg-emerald-500/20 text-emerald-100'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : isSelected
        ? 'border-slate-500 bg-slate-800 text-slate-200'
        : 'border-slate-200 bg-slate-50 text-slate-600'

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
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
            {safeClass.courseCode ?? 'TBA'}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-tight">{title}</h3>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${seatStateClasses}`}
        >
          {seatState}
        </span>
      </div>

      <p className={`mt-2 text-xs font-medium ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
        {safeClass.department ?? 'General'} | {safeClass.credits ?? 0} credits
      </p>

      <dl className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
        <div className="col-span-2 min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Instructor</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.instructor ?? 'TBA'}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Schedule</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.displayTimes ?? 'TBA'}</dd>
        </div>
        <div className="min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Location</dt>
          <dd className="mt-0.5 truncate font-medium">{safeClass.location ?? 'TBA'}</dd>
        </div>
        <div className="min-w-0">
          <dt className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Seats</dt>
          <dd className="mt-0.5 truncate font-medium">{seatSummary}</dd>
        </div>
      </dl>
    </button>
  )
}

export default CatalogCard
