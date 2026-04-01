import { useEffect, useState } from 'react'
import { getInstructors } from '../services/studentRepository'

function toDisplaySectionList(sectionIds = []) {
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    return 'None'
  }

  return sectionIds.map((_, index) => String(index + 1)).join(', ')
}

function InstructorList() {
  const [instructors, setInstructors] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    getInstructors()
      .then((data) => {
        if (isMounted) {
          setInstructors(data)
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error.message)
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

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faculty</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Instructors</h3>
        </div>
        {!loading && !errorMessage && (
          <p className="text-xs text-slate-500">{instructors.length} instructors</p>
        )}
      </div>

      {loading && <p className="mt-3 text-sm text-slate-600">Loading instructors...</p>}
      {errorMessage && <p className="mt-3 text-sm text-rose-700">{errorMessage}</p>}

      {!loading && !errorMessage && (
        <div className="mt-4 space-y-3">
          {instructors.map((instructor) => (
            <article key={instructor.instructorId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">{instructor.name}</h4>
                <span className="text-xs text-slate-500">{instructor.courses.length} courses</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {instructor.courses.map((course) => (
                  <li key={`${instructor.instructorId}-${course.classId}`}>
                    <span className="font-medium text-slate-900">{course.code}</span> {course.title} | Sections:{' '}
                    {toDisplaySectionList(course.sectionIds)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default InstructorList
