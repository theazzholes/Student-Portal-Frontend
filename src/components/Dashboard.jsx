import { useEffect, useState } from 'react'
import TopNavbar from './TopNav'
import CourseCard from './CourseCard'
import CourseDetailView from './CourseDetailView'
import WeeklyCalendar from './WeeklyCalendar'
import { getStudentDashboard } from '../services/studentRepository'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    Promise.resolve(getStudentDashboard())
      .then((data) => { if (isMounted) setStudent(data) })
      .finally(() => { if (isMounted) setLoading(false) })
    return () => { isMounted = false }
  }, [])

  const courses = student?.courses ?? []
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0)
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNavbar student={student} activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-24">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Loading dashboard...</h2>
            <p className="mt-2 text-slate-600">Warming up data source and preparing your student portal experience.</p>
          </section>
        ) : (
          <>
            {activeTab === 'overview' && (
              <section className="space-y-4">

                <header className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Welcome back</p>
                      <h2 className="text-2xl font-bold leading-tight">{student?.fullName}</h2>
                      <p className="text-sm text-slate-500">{student?.program}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Term</p>
                        <p className="text-sm font-semibold text-slate-800">{student?.term}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">GPA</p>
                        <p className="text-sm font-semibold text-slate-800">{student?.gpa.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Credits</p>
                        <p className="text-sm font-semibold text-slate-800">{totalCredits}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Courses</p>
                        <p className="text-sm font-semibold text-slate-800">{courses.length}</p>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-6">
                    <CourseDetailView course={selectedCourse} />
                    <div className="border-t border-slate-100" />

                    <div>
                      <h3 className="text-base font-semibold text-slate-700 mb-4">Calendar View</h3>
                      <WeeklyCalendar courses={courses} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-slate-700">Registered Courses</h3>
                      <p className="text-xs text-slate-400">{courses.length} total</p>
                    </div>
                    <div className="space-y-4">
                      {courses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          onSelect={setSelectedCourseId}
                          isSelected={course.id === selectedCourseId}
                        />
                      ))}
                    </div>
                  </div>

                </div>
              </section>
            )}

            {activeTab === 'courses' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold">Registered Courses</h3>
                  <p className="text-sm text-slate-500">{courses.length} total</p>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
              </section>
            )}

            {activeTab === 'grades' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Grade Snapshot</h3>
                <p className="mt-2 text-slate-600">Current grades by enrolled course (mock data).</p>
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

            {activeTab === 'schedule' && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-6">Weekly Schedule</h3>
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
