function CourseDetailView({ course }) {
  if (!course) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h4 className="text-lg font-semibold text-slate-900">Course Details</h4>
        <p className="mt-2 text-slate-600">
          Select a current class to view the instructor, schedule, location, and enrollment status returned by the API.
        </p>
      </section>
    )
  }

  const courseName = course.className ?? course.title
  const instructor = course.instructor ?? 'TBA'
  const location = course.location ?? 'TBA'
  const status = course.enrollmentStatus ?? 'Unknown'
  const enrolled = course.capacity?.enrolled ?? 'N/A'
  const maxCapacity = course.capacity?.max ?? 'N/A'
  const availability = course.sectionAvailability ?? 'Availability unavailable'
  const waitlistedCount = Number.isFinite(Number(course.waitlistedCount)) ? Number(course.waitlistedCount) : 0
  const isWaitlisted = String(status).toLowerCase().includes('waitlist')
  const statusClasses = isWaitlisted
    ? 'inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
    : 'inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Class</p>
      <h4 className="mt-1 text-xl font-semibold text-slate-900">
        {course.courseCode} | {courseName}
      </h4>

      <dl className="mt-5 grid grid-cols-1 gap-4 text-sm text-slate-700 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Instructor</dt>
          <dd className="mt-1 font-medium text-slate-900">{instructor}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Location</dt>
          <dd className="mt-1 font-medium text-slate-900">{location}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Enrollment Status</dt>
          <dd className="mt-1">
            <span className={statusClasses}>{status}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Meeting Times</dt>
          <dd className="mt-1 font-medium text-slate-900">{course.daysTimes ?? 'TBA'}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Credits</dt>
          <dd className="mt-1 font-medium text-slate-900">{course.credits ?? 'TBA'}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Section Availability</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {availability}
          </dd>
          <dd className="mt-1 text-xs text-slate-500">
            {enrolled} enrolled / {maxCapacity} capacity
            {waitlistedCount > 0 ? ` • ${waitlistedCount} waitlisted` : ''}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default CourseDetailView
