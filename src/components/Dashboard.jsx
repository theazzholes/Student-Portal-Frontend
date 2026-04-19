import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TopNavbar from './TopNav'
import CourseCard from './CourseCard'
import CourseDetailView from './CourseDetailView'
import WeeklyCalendar from './WeeklyCalendar'
import ClassCatalog from './ClassCatalog'
import { dropClass, getCurrentUser, getStudentDashboard } from '../services/studentRepository'
import TeacherDashboard from './TeacherDashboard'
import ScheduleAssistant from './ScheduleAssistant'

const OVERVIEW_TOAST_AUTO_DISMISS_MS = 3500

const TAB_TRANSITION_STYLES = `
  @keyframes tabFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes tabFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  .tab-enter {
    animation: tabFadeIn 0.2s ease-out both;
  }
  .tab-exit {
    animation: tabFadeOut 0.13s ease-in both;
    pointer-events: none;
  }
`

function useTabTransition(activeTab) {
  const [displayedTab, setDisplayedTab] = useState(activeTab)
  const [animClass, setAnimClass] = useState('')
  const pendingRef = useRef(null)

  useEffect(() => {
    if (activeTab === displayedTab) return

    // Exit current tab
    setAnimClass('tab-exit')
    pendingRef.current = activeTab

    const exitTimer = setTimeout(() => {
      setDisplayedTab(pendingRef.current)
      setAnimClass('tab-enter')
    }, 150)

    return () => clearTimeout(exitTimer)
  }, [activeTab]) 

  return { displayedTab, animClass }
}

function EnrollmentBadge({ status }) {
  const isWaitlisted = String(status ?? '').toLowerCase().includes('waitlist')
  const classes = isWaitlisted
    ? 'inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800'
    : 'inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800'

  return <span className={classes}>{status}</span>
}

function canUnenrollFromStatus(status) {
  const normalized = String(status ?? '').trim().toLowerCase()
  if (!normalized) {
    return false
  }

  if (normalized.includes('waitlist')) {
    return true
  }

  if (normalized.includes('unenroll') || normalized.includes('not enrolled')) {
    return false
  }

  return normalized.includes('enroll')
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState('student')
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [student, setStudent] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [mutatingCourseId, setMutatingCourseId] = useState(null)
  const [openCourseActionId, setOpenCourseActionId] = useState(null)
  const [primedCourseActionId, setPrimedCourseActionId] = useState(null)
  const [overviewToast, setOverviewToast] = useState(null)

  const { displayedTab, animClass } = useTabTransition(activeTab)

  const applyDashboardData = useCallback((data) => {
    setStudent(data)
    setSelectedCourseId((current) => {
      if (!current) {
        return data.courses[0]?.id ?? null
      }

      const currentSelectionStillExists = data.courses.some((course) => course.id === current)
      return currentSelectionStillExists ? current : data.courses[0]?.id ?? null
    })
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await getStudentDashboard()
      applyDashboardData(data)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [applyDashboardData])

  const refreshDashboardSilently = useCallback(async () => {
    try {
      const data = await getStudentDashboard()
      applyDashboardData(data)
    } catch {
    }
  }, [applyDashboardData])

  const loadCurrentUser = useCallback(async () => {
    try {
      const data = await getCurrentUser()
      setCurrentUser(data)
    } catch {
      setCurrentUser(null)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  useEffect(() => {
    if (!overviewToast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setOverviewToast(null)
    }, OVERVIEW_TOAST_AUTO_DISMISS_MS)

    return () => window.clearTimeout(timeoutId)
  }, [overviewToast])

  const courses = useMemo(() => student?.courses ?? [], [student])
  const isOverviewMutating = mutatingCourseId !== null
  const canUseTeacherView = Boolean(currentUser?.instructorId ?? student?.instructorId)
  const totalCredits = courses.reduce((sum, course) => sum + Number(course.credits ?? 0), 0)
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0] ?? null
  const navDisplayUser =
    viewMode === 'teacher'
      ? {
          fullName: currentUser?.name ?? student?.fullName,
          email: currentUser?.email ?? student?.email,
        }
      : student

  useEffect(() => {
    if (!canUseTeacherView && viewMode === 'teacher') {
      setViewMode('student')
    }
  }, [canUseTeacherView, viewMode])

  useEffect(() => {
    if (!openCourseActionId) {
      return
    }

    const stillExists = courses.some((course) => course.id === openCourseActionId)
    if (!stillExists) {
      setOpenCourseActionId(null)
    }
  }, [courses, openCourseActionId])

  useEffect(() => {
    if (!primedCourseActionId) {
      return
    }

    const stillExists = courses.some((course) => course.id === primedCourseActionId)
    if (!stillExists) {
      setPrimedCourseActionId(null)
    }
  }, [courses, primedCourseActionId])

  const handleOverviewCourseSelect = useCallback(
    (course) => {
      if (!course) {
        return
      }

      const isSameCourse = selectedCourseId === course.id
      setSelectedCourseId(course.id)

      if (!canUnenrollFromStatus(course.enrollmentStatus)) {
        setOpenCourseActionId(null)
        setPrimedCourseActionId(null)
        return
      }

      if (!isSameCourse) {
        setOpenCourseActionId(null)
        setPrimedCourseActionId(course.id)
        return
      }

      if (openCourseActionId === course.id) {
        setOpenCourseActionId(null)
        setPrimedCourseActionId(course.id)
        return
      }

      if (primedCourseActionId === course.id) {
        setOpenCourseActionId(course.id)
        return
      }

      setPrimedCourseActionId(course.id)
    },
    [openCourseActionId, primedCourseActionId, selectedCourseId],
  )

  const handleOverviewUnenroll = useCallback(
    async (course) => {
      if (!course?.sectionId) {
        setOverviewToast({
          type: 'error',
          message: 'Unenrollment failed. Missing section identifier for this class.',
        })
        return
      }

      setMutatingCourseId(course.id)
      setOverviewToast(null)

      try {
        const response = await dropClass(course.sectionId)
        const code = response?.code ?? course.courseCode ?? 'Class'
        const sectionLabel = response?.sectionId ?? course.sectionId

        setOverviewToast({
          type: 'success',
          message: `Unenrolled from ${code} section ${sectionLabel}.`,
        })
        setOpenCourseActionId(null)
        setPrimedCourseActionId(null)

        await refreshDashboardSilently()
      } catch (error) {
        setOverviewToast({
          type: 'error',
          message: `Unenrollment failed. ${error?.message ?? 'The request did not complete successfully.'}`,
        })
      } finally {
        setMutatingCourseId(null)
      }
    },
    [refreshDashboardSilently],
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNavbar
        student={navDisplayUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        canUseTeacherView={canUseTeacherView}
      />

      <main className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-24">
        <style>{TAB_TRANSITION_STYLES}</style>
        {viewMode === 'teacher' ? (
          <TeacherDashboard />
        ) : loading ? (
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
          <div key={displayedTab} className={animClass}>
            {displayedTab === 'overview' && (
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
                    {overviewToast && (
                      <div
                        role={overviewToast.type === 'error' ? 'alert' : 'status'}
                        aria-live={overviewToast.type === 'error' ? 'assertive' : 'polite'}
                        aria-atomic="true"
                        className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                          overviewToast.type === 'error'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {overviewToast.message}
                      </div>
                    )}
                    <div className="space-y-2" aria-label="Registered courses">
                      {courses.map((course) => {
                        const isMutating = mutatingCourseId === course.id
                        const showUnenrollButton = canUnenrollFromStatus(course.enrollmentStatus)
                        const isActionOpen = showUnenrollButton && openCourseActionId === course.id

                        return (
                          <div key={course.id} className="overflow-hidden">
                            <CourseCard
                              course={course}
                              onSelect={() => {
                                if (isOverviewMutating) {
                                  return
                                }

                                handleOverviewCourseSelect(course)
                              }}
                              isSelected={course.id === selectedCourse?.id}
                            />
                            {showUnenrollButton && (
                              <div
                                className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                                  isActionOpen
                                    ? 'mt-1.5 grid-rows-[1fr] opacity-100'
                                    : 'mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                                }`}
                              >
                                <div className="min-h-0 overflow-hidden px-1 pb-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOverviewUnenroll(course)}
                                    disabled={isOverviewMutating}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                                  >
                                    {isMutating ? 'Submitting...' : 'Unenroll'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              </section>
            )}

            {displayedTab === 'courses' && (
              <section className="h-[calc(100dvh-8.5rem)] min-h-0">
                <ClassCatalog onEnrollmentChange={refreshDashboardSilently} currentCourses={courses} />
              </section>
            )}

            {displayedTab === 'grades' && (
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

            {displayedTab === 'schedule' && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
                  <h3 className="text-xl font-semibold text-slate-900">Schedule Planning</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Review your current weekly schedule and ask the AI assistant to generate schedule options that
                    match your preferences.
                  </p>
                </div>

                <ScheduleAssistant currentCourses={courses} />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
