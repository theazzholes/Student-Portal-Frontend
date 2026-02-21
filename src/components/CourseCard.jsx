function CourseCard({ course }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {course.code}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h3>
        </div>

        <div className="rounded-lg bg-emerald-50 px-3 py-1 text-right">
          <p className="text-lg font-bold text-emerald-700">{course.grade.letter}</p>
          <p className="text-xs font-medium text-emerald-600">{course.grade.percent}%</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm text-slate-600">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Instructor</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.instructor}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Credits</dt>
          <dd className="mt-1 font-medium text-slate-700">{course.credits}</dd>
        </div>
      </dl>
    </article>
  )
}

export default CourseCard
