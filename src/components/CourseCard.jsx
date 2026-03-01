function CourseCard({ course, onSelect, isSelected = false }) {
  const courseCode = course.courseCode ?? course.code
  const className = course.className ?? course.title
  const cardClasses = isSelected
    ? 'rounded-2xl border border-slate-900 bg-white p-5 text-left shadow-md transition-shadow'
    : 'rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md'

  return (
    <button type="button" onClick={() => onSelect?.(course.id)} className={cardClasses}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {courseCode}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{className}</h3>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-600">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Instructor</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.instructor}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Days / Times</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.daysTimes}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.location}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Credits</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.credits}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Waitlist</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.waitlistStatus}</dd>
        </div>
      </dl>
    </button>
  )
}

export default CourseCard
