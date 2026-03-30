import { useCallback, useEffect, useState } from 'react'
import TopNavbar from './TopNav'
import CourseCard from './CourseCard'
import CourseDetailView from './CourseDetailView'
import WeeklyCalendar from './WeeklyCalendar'
import ClassCatalog from './ClassCatalog'
import { getStudentDashboard } from '../services/studentRepository'

function EnrollmentBadge({ status }) {
  const isWaitlisted = String(status ?? '').toLowerCase().includes('waitlist')
  const classes = isWaitlisted
    ? 'inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800'
    : 'inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800'

  return <span className={classes}>{status}</span>
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await getStudentDashboard()
      setStudent(data)
      setSelectedCourseId((current) => current ?? data.courses[0]?.id ?? null)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const courses = student?.courses ?? []
  const totalCredits = courses.reduce((sum, course) => sum + Number(course.credits ?? 0), 0)
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNavbar student={student} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-24">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Loading dashboard...</h2>
            <p className="mt-2 text-slate-600">Fetching your profile, classes, and schedule from the production API.</p>
          </section>
        ) : errorMessage ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-rose-900">API request failed</h2>
            <p className="mt-2 text-rose-700">{errorMessage}</p>
          </section>
        ) : (
          <>
            {activeTab === 'overview' && (
              <section className="space-y-4">
                <header className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Student Profile</p>
                      <h2 className="text-2xl font-bold leading-tight">{student?.fullName}</h2>
                      <p className="text-sm text-slate-600">{student?.email || 'No email returned by API'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Student ID</p>
                        <p className="text-sm font-semibold text-slate-800">{student?.id}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Classes</p>
                        <p className="text-sm font-semibold text-slate-800">{courses.length}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Credits</p>
                        <p className="text-sm font-semibold text-slate-800">{totalCredits}</p>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                    <CourseDetailView course={selectedCourse} />
                    <div className="border-t border-slate-100" />
                    <div>
                      <h3 className="mb-4 text-base font-semibold text-slate-700">Weekly Schedule</h3>
                      <WeeklyCalendar courses={courses} />
                    </div>
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-slate-700">Registered Courses</h3>
                      <p className="text-xs text-slate-400">{courses.length} total</p>
                    </div>
                    <div className="space-y-2" aria-label="Registered courses">
                      {courses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onSelect={setSelectedCourseId}
                          isSelected={course.id === selectedCourse?.id}
                        />
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'courses' && <ClassCatalog onEnrollmentChange={loadDashboard} currentCourses={courses} />}

            {activeTab === 'grades' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Grade Snapshot</h3>
                <p className="mt-2 text-slate-600">
                  The documented API does not expose grade data. This view now reflects current enrollment state instead of mock grades.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {courses.map((course) => (
                    <li key={course.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{course.courseCode}</span>
                      <span>|</span>
                      <span>{course.className}</span>
                      <span>|</span>
                      <EnrollmentBadge status={course.enrollmentStatus} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {activeTab === 'schedule' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-xl font-semibold">Weekly Schedule</h3>
                <WeeklyCalendar courses={courses} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default Dashboard
