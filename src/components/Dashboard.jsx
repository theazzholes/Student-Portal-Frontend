import { useEffect, useState } from 'react'
import TopNavbar from './TopNav'
import CourseCard from './CourseCard'
import CourseDetailView from './CourseDetailView'
import { getStudentDashboard } from '../services/studentRepository'

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
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
              <section className="space-y-6">
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

                <div className="grid gap-8 lg:grid-cols-3">
                  <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
                    <h3 className="text-xl font-semibold">Calendar View</h3>
                    <p className="mt-2 text-slate-600">
                      Upcoming class schedule from current registrations.
                    </p>
                    <ul className="mt-4 space-y-3 text-sm text-slate-700">
                      {courses.map((course) => (
                        <li key={course.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="font-semibold text-slate-900">{course.courseCode}</p>
                          <p className="text-slate-600">{course.daysTimes}</p>
                          <p className="text-xs text-slate-500">{course.location}</p>
                        </li>
                      ))}
                    </ul>
                  </aside>

                  <section className="space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-semibold">Registered Courses</h3>
                      <p className="text-sm text-slate-500">{courses.length} total</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
