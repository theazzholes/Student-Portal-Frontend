function CourseCard({ course, onSelect, isSelected = false }) {
  const courseCode = course.courseCode ?? course.code
  const className = course.className ?? course.title
  const credits = Number.isFinite(course.credits) ? course.credits : course.credits ?? 'TBA'
  const daysTimes = course.daysTimes ?? 'TBA'
  const statusSource = String(course.enrollmentStatus ?? course.waitlistStatus ?? '').toLowerCase()
  const isWaitlisted = statusSource.includes('waitlisted')
  const statusLabel = isWaitlisted ? 'Waitlisted' : 'Enrolled'
  const statusCode = isWaitlisted ? 'WA' : 'EN'
  const statusClasses = isWaitlisted
    ? 'inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800'
    : 'inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800'
  const accessibilityLabel = `${courseCode ?? 'TBA'} ${className ?? 'Untitled Class'}, ${credits} credits, ${daysTimes}, ${statusLabel}`
  const cardClasses = isSelected
    ? 'w-full rounded-xl border border-slate-900 bg-slate-900 px-3.5 py-3 text-left text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2'
    : 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-left text-slate-900 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(course.id)}
      className={cardClasses}
      aria-pressed={isSelected}
      aria-label={accessibilityLabel}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>
            {courseCode ?? 'TBA'}
          </p>
          <h3 className={`mt-0.5 truncate text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
            {className ?? 'Untitled Class'}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className={`text-xs font-semibold ${isSelected ? 'text-slate-100' : 'text-slate-700'}`}>{credits} cr</p>
          <span className={statusClasses} aria-label={statusLabel}>
            {statusCode}
          </span>
        </div>
      </div>

      <p className={`mt-2 text-xs font-medium ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>{daysTimes}</p>
    </button>
  )
}

export default CourseCard
