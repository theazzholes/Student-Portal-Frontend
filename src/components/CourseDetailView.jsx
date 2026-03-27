function CourseDetailView({ course }) {
  if (!course) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h4 className="text-lg font-semibold text-slate-900">Course Details</h4>
        <p className="mt-2 text-slate-600">
          Select a course tile to view instructor details, waitlist status, and class capacity.
        </p>
      </section>
    )
  }

  const courseName = course.className ?? course.title
  const instructor = course.instructor ?? course.professorInfo?.name ?? 'TBA'
  const location = course.location ?? 'TBA'
  const waitlistStatus = course.waitlistStatus ?? 'Open'
  const professorEmail = course.professorInfo?.email ?? 'N/A'
  const officeHours = course.professorInfo?.officeHours ?? 'TBA'
  const enrolled = course.capacity?.enrolled ?? 'N/A'
  const maxCapacity = course.capacity?.max ?? 'N/A'

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Detailed Class View
      </p>
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
          <dt className="text-xs uppercase tracking-wide text-slate-500">Waitlist</dt>
          <dd className="mt-1 font-medium text-slate-900">{waitlistStatus}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Professor Email</dt>
          <dd className="mt-1 font-medium text-slate-900">{professorEmail}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Office Hours</dt>
          <dd className="mt-1 font-medium text-slate-900">{officeHours}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Class Capacity</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {enrolled} / {maxCapacity} enrolled
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default CourseDetailView
