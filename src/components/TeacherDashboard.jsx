import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getTeacherClassStudents,
  getTeacherDashboard,
  teacherEnrollStudent,
  teacherUnenrollStudent,
} from '../services/studentRepository'

const DEFAULT_TEST_STUDENT_ID = '33333333-3333-3333-3333-333333333333'
const AUTO_REFRESH_INTERVAL_MS = 10000

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function toMutationMessage(action, response) {
  if (!response) {
    return 'Request completed.'
  }

  if (action === 'enroll') {
    return `${response.code} updated. Student is now ${String(response.enrollmentStatus ?? '').toLowerCase() || 'processed'}.`
  }

  return `${response.code} updated. Student was unenrolled from the section.`
}

function toEnrollmentPercentage(item) {
  const percentage = Number(item?.enrollmentPercentage)
  if (Number.isFinite(percentage)) {
    return Math.max(0, Math.min(100, percentage))
  }

  const enrolledCount = Number(item?.enrolledCount)
  const capacity = Number(item?.capacity)
  if (Number.isFinite(enrolledCount) && Number.isFinite(capacity) && capacity > 0) {
    return Math.max(0, Math.min(100, Math.round((enrolledCount / capacity) * 100)))
  }

  return 0
}

function TeacherDashboard() {
  const [teacher, setTeacher] = useState(null)
  const [selectedSectionId, setSelectedSectionId] = useState(null)
  const [roster, setRoster] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [rosterError, setRosterError] = useState('')
  const [studentIdInput, setStudentIdInput] = useState(DEFAULT_TEST_STUDENT_ID)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [mutatingKey, setMutatingKey] = useState(null)

  const assignedClasses = teacher?.assignedClasses ?? []

  const loadTeacherDashboard = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await getTeacherDashboard()
      setTeacher(data)
      setSelectedSectionId((current) => current ?? data.assignedClasses[0]?.sectionId ?? null)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRoster = useCallback(async (sectionId) => {
    if (!sectionId) {
      setRoster(null)
      return
    }

    setRosterLoading(true)
    setRosterError('')

    try {
      const data = await getTeacherClassStudents(sectionId)
      setRoster(data)
    } catch (error) {
      setRosterError(error.message)
      setRoster(null)
    } finally {
      setRosterLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTeacherDashboard()
  }, [loadTeacherDashboard])

  useEffect(() => {
    loadRoster(selectedSectionId)
  }, [loadRoster, selectedSectionId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadTeacherDashboard()
      if (selectedSectionId) {
        loadRoster(selectedSectionId)
      }
    }, AUTO_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [loadRoster, loadTeacherDashboard, selectedSectionId])

  const selectedClass = useMemo(
    () => (teacher?.assignedClasses ?? []).find((item) => item.sectionId === selectedSectionId) ?? null,
    [teacher?.assignedClasses, selectedSectionId],
  )

  const refreshTeacherData = useCallback(async () => {
    await Promise.all([loadTeacherDashboard(), loadRoster(selectedSectionId)])
  }, [loadRoster, loadTeacherDashboard, selectedSectionId])

  const handleTeacherEnroll = async () => {
    const trimmedStudentId = studentIdInput.trim()
    if (!selectedSectionId || !trimmedStudentId) {
      setActionError('Provide a student ID and select a section first.')
      setActionMessage('')
      return
    }

    setMutatingKey(`enroll-${trimmedStudentId}`)
    setActionError('')
    setActionMessage('')

    try {
      const response = await teacherEnrollStudent(selectedSectionId, trimmedStudentId)
      setActionMessage(toMutationMessage('enroll', response))
      await refreshTeacherData()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setMutatingKey(null)
    }
  }

  const handleTeacherUnenroll = async (studentId) => {
    if (!selectedSectionId || !studentId) {
      return
    }

    setMutatingKey(`unenroll-${studentId}`)
    setActionError('')
    setActionMessage('')

    try {
      const response = await teacherUnenrollStudent(selectedSectionId, studentId)
      setActionMessage(toMutationMessage('unenroll', response))
      await refreshTeacherData()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setMutatingKey(null)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Loading teacher dashboard...</h2>
        <p className="mt-2 text-slate-600">Fetching assigned sections and teacher roster data from the API.</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-rose-900">Teacher dashboard failed to load</h2>
        <p className="mt-2 text-rose-700">{errorMessage}</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Teacher Debug View</p>
            <h2 className="text-2xl font-bold leading-tight">{teacher?.fullName}</h2>
            <p className="text-sm text-slate-600">{teacher?.email || 'No email returned by API'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">Instructor ID</p>
              <p className="text-sm font-semibold text-slate-800">{teacher?.instructorId}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-400">Assigned Sections</p>
              <p className="text-sm font-semibold text-slate-800">{assignedClasses.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-700">Assigned Classes</h3>
              <p className="text-sm text-slate-500">Select a section to load its roster.</p>
            </div>
            <button
              type="button"
              onClick={loadTeacherDashboard}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {assignedClasses.map((item) => {
              const isSelected = item.sectionId === selectedSectionId
              const enrollmentPercentage = toEnrollmentPercentage(item)
              return (
                <button
                  key={item.sectionId}
                  type="button"
                  onClick={() => setSelectedSectionId(item.sectionId)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {item.courseCode}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold">{item.className}</h4>
                    </div>
                    <span className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {item.enrollmentPercentage}% full
                    </span>
                  </div>
                  <p className={`mt-2 text-xs ${isSelected ? 'text-slate-200' : 'text-slate-600'}`}>{item.daysTimes}</p>
                  <p className={`mt-1 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{item.location}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-[11px] font-medium ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        Enrollment
                      </p>
                      <p className={`text-[11px] font-semibold ${isSelected ? 'text-slate-100' : 'text-slate-800'}`}>
                        {enrollmentPercentage}%
                      </p>
                    </div>
                    <div className={`mt-1 h-2.5 overflow-hidden rounded-full ${isSelected ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          enrollmentPercentage >= 100
                            ? 'bg-emerald-400'
                            : enrollmentPercentage >= 75
                              ? 'bg-amber-400'
                              : 'bg-sky-500'
                        }`}
                        style={{ width: `${enrollmentPercentage}%` }}
                      />
                    </div>
                  </div>
                  <p className={`mt-3 text-xs font-medium ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
                    {item.enrolledCount}/{item.capacity} enrolled | {item.waitlistedCount} waitlisted
                  </p>
                </button>
              )
            })}
          </div>

          {assignedClasses.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
              No teacher-owned sections were returned by the API.
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Section</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  {selectedClass ? `${selectedClass.courseCode} - ${selectedClass.className}` : 'No section selected'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedClass ? `${selectedClass.daysTimes} | ${selectedClass.location}` : 'Choose a teacher-owned section to manage its roster.'}
                </p>
              </div>

              {selectedClass && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Capacity</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClass.capacity}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Enrolled</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClass.enrolledCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Waitlisted</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedClass.waitlistedCount}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-700">Temporary Teacher Actions</h3>
                <p className="text-sm text-slate-500">
                  Use the seeded debug student ID or paste another student GUID to hit the teacher enroll endpoint.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadRoster(selectedSectionId)}
                disabled={!selectedSectionId || rosterLoading}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                {rosterLoading ? 'Refreshing...' : 'Refresh Roster'}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={studentIdInput}
                onChange={(event) => setStudentIdInput(event.target.value)}
                placeholder="Student GUID"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={handleTeacherEnroll}
                disabled={!selectedSectionId || mutatingKey === `enroll-${studentIdInput.trim()}`}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {mutatingKey === `enroll-${studentIdInput.trim()}` ? 'Submitting...' : 'Enroll Student'}
              </button>
            </div>

            {actionMessage && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {actionMessage}
              </div>
            )}
            {actionError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {actionError}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-700">Section Roster</h3>
                <p className="text-sm text-slate-500">
                  This calls `GET /teachers/current/classes/{'{sectionId}'}/students` for the selected section.
                </p>
              </div>
              {roster && (
                <p className="text-xs text-slate-500">
                  {roster.students?.length ?? 0} student{roster.students?.length === 1 ? '' : 's'}
                </p>
              )}
            </div>

            {rosterLoading && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading roster...
              </div>
            )}

            {!rosterLoading && rosterError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{rosterError}</div>
            )}

            {!rosterLoading && !rosterError && roster && (
              <div className="space-y-3">
                {(roster.students ?? []).map((student) => (
                  <article
                    key={`${student.studentId}-${student.enrollmentStatus}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{student.studentName}</h4>
                        <p className="mt-1 text-xs text-slate-500">{student.email}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.studentId}</p>
                        <p className="mt-2 text-xs text-slate-600">
                          Added {formatTimestamp(student.enrollmentDate)} | {student.enrollmentStatus}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTeacherUnenroll(student.studentId)}
                        disabled={mutatingKey === `unenroll-${student.studentId}`}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {mutatingKey === `unenroll-${student.studentId}` ? 'Submitting...' : 'Unenroll'}
                      </button>
                    </div>
                  </article>
                ))}

                {(roster.students ?? []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                    No students are currently enrolled or waitlisted for this section.
                  </div>
                )}
              </div>
            )}

            {!rosterLoading && !rosterError && !roster && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
                Select a section to load its roster.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

export default TeacherDashboard
