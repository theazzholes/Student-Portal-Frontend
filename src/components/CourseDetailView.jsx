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
          <dd className="mt-1 font-medium text-slate-900">{status}</dd>
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
          <dt className="text-xs uppercase tracking-wide text-slate-500">Capacity</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {enrolled} / {maxCapacity}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default CourseDetailView
