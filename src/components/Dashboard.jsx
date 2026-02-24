import { useEffect, useState } from 'react'
import TopNavbar from './TopNav'
import CourseCard from './CourseCard'
import CourseDetailView from './CourseDetailView'
import { getStudentDashboard } from '../services/studentRepository'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState('list')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    Promise.resolve(getStudentDashboard())
      .then((data) => {
        if (isMounted) {
          setStudent(data)
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const courses = student?.courses ?? []
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0)
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNavbar student={student} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-28">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Loading dashboard...</h2>
            <p className="mt-2 text-slate-600">
              Warming up data source and preparing your student portal experience.
            </p>
          </section>
        ) : (
          <>
            {activeTab === 'overview' && (
              <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Welcome back</p>
                <h2 className="mt-1 text-3xl font-bold">{student?.fullName}</h2>
                <p className="mt-2 text-slate-600">
                  Program: {student?.program} | Term: {student?.term}
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Courses</p>
                    <p className="mt-1 text-2xl font-bold">{courses.length}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Total Credits
                    </p>
                    <p className="mt-1 text-2xl font-bold">{totalCredits}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Current GPA</p>
                    <p className="mt-1 text-2xl font-bold">{student?.gpa.toFixed(2)}</p>
                  </div>
                </div>
              </header>
            )}

            {activeTab === 'courses' && (
              <section>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold">Registered Courses</h3>
                  <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        viewMode === 'list'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('calendar')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        viewMode === 'calendar'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Calendar
                    </button>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {courses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onSelect={setSelectedCourseId}
                          isSelected={course.id === selectedCourseId}
                        />
                      ))}
                    </div>
                    <CourseDetailView course={selectedCourse} />
                  </>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h4 className="text-lg font-semibold">Calendar View</h4>
                    <p className="mt-2 text-slate-600">
                      Calendar projection uses each course schedule from mock data.
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {courses.map((course) => (
                        <li key={course.id}>
                          <span className="font-semibold">{course.courseCode}</span> |{' '}
                          {course.daysTimes}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'grades' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Grade Snapshot</h3>
                <p className="mt-2 text-slate-600">
                  Current grades by enrolled course (mock data).
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {courses.map((course) => (
                    <li key={course.id}>
                      <span className="font-semibold">{course.courseCode}</span> |{' '}
                      {course.grade.letter} ({course.grade.percent}%)
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default Dashboard
