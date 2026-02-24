function CourseDetailView({ course }) {
  if (!course) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h4 className="text-lg font-semibold text-slate-900">Course Details</h4>
        <p className="mt-2 text-slate-600">
          Select a course card to view professor contact details and class capacity.
        </p>
      </section>
    )
  }

  const courseName = course.className ?? course.title

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
          <dt className="text-xs uppercase tracking-wide text-slate-500">Professor Email</dt>
          <dd className="mt-1 font-medium text-slate-900">{course.professorInfo.email}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Office Hours</dt>
          <dd className="mt-1 font-medium text-slate-900">{course.professorInfo.officeHours}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Class Capacity</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {course.capacity.enrolled} / {course.capacity.max} enrolled
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default CourseDetailView
