import TopNavbar from './Sidebar'
import CourseCard from './CourseCard'
import { mockStudent } from '../data/mockStudent'

function Dashboard() {
  const totalCredits = mockStudent.courses.reduce(
    (sum, course) => sum + course.credits,
    0,
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNavbar student={mockStudent} active="Overview" />

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-28">
        <header
          id="overview"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">Welcome back</p>
          <h2 className="mt-1 text-3xl font-bold">{mockStudent.fullName}</h2>
          <p className="mt-2 text-slate-600">
            Program: {mockStudent.program} | Term: {mockStudent.term}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Courses</p>
              <p className="mt-1 text-2xl font-bold">{mockStudent.courses.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Credits</p>
              <p className="mt-1 text-2xl font-bold">{totalCredits}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current GPA</p>
              <p className="mt-1 text-2xl font-bold">{mockStudent.gpa.toFixed(2)}</p>
            </div>
          </div>
        </header>

        <section id="courses" className="mt-8">
          <h3 className="text-xl font-semibold">Course Performance</h3>
          <div className="mt-4 grid grid-cols-3 gap-6">
            {mockStudent.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>

        <section id="grades" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Grade Snapshot</h3>
          <p className="mt-2 text-slate-600">
            Grades are shown on each course card with both letter and percentage for quick review.
          </p>
        </section>

        <section
          id="settings"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-xl font-semibold">Settings</h3>
          <p className="mt-2 text-slate-600">
            Placeholder section for future profile and preference controls.
          </p>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
