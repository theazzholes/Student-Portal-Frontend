import { useCallback, useEffect, useMemo, useState } from 'react'
import { dropClass, enrollInClass, getClasses, getInstructors } from '../services/studentRepository'
import CatalogCard from './CatalogCard'
import WeeklyCalendar from './WeeklyCalendar'

function formatTime(time) {
  const [hoursRaw = '0', minutesRaw = '00'] = String(time).split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

function formatSectionSchedule(schedule = []) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return 'TBA'
  }

  return schedule
    .map((slot) => `${slot.day} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} @ ${slot.location}`)
    .join(' | ')
}

function toActionLabel(action) {
  return action === 'enroll' ? 'Enrollment' : 'Unenrollment'
}

function toSuccessMessage(response) {
  if (response.action === 'enroll') {
    if (response.enrollmentStatus === 'Waitlisted') {
      return `Added to the waitlist for ${response.code} section ${response.sectionId}.`
    }

    return `Enrolled in ${response.code} section ${response.sectionId}.`
  }

  return `Unenrolled from ${response.code} section ${response.sectionId}.`
}

function toFailureMessage(action, error) {
  const reason = error?.message?.trim() || 'The request did not complete successfully.'
  return `${toActionLabel(action)} failed. ${reason}`
}

function toSectionPreviewCourse(source, section, label = 'Preview') {
  return {
    id: `preview-${source.classId}-${section.sectionId}`,
    courseCode: source.code,
    className: `${source.title} (${label})`,
    instructor: section.instructorName,
    location: section.schedule?.[0]?.location ?? 'TBA',
    schedule: section.schedule ?? [],
  }
}

function renderSectionAvailability(section) {
  return section.availabilityLabel ?? 'Availability unavailable'
}

function renderSectionCapacityMeta(section) {
  const capacity = Number.isFinite(Number(section.capacity)) ? Number(section.capacity) : null
  const enrolledCount = Number.isFinite(Number(section.enrolledCount)) ? Number(section.enrolledCount) : null
  const waitlistedCount = Number.isFinite(Number(section.waitlistedCount)) ? Number(section.waitlistedCount) : 0

  const pieces = []
  if (enrolledCount !== null) {
    pieces.push(`${enrolledCount} enrolled`)
  }
  if (capacity !== null) {
    pieces.push(`${capacity} capacity`)
  }
  if (waitlistedCount > 0) {
    pieces.push(`${waitlistedCount} waitlisted`)
  }

  return pieces.join(' • ') || 'No seat data returned'
}

function buildInstructorBrowseData(classes, instructors) {
  const classMap = new Map(classes.map((course) => [course.classId, course]))

  return instructors
    .map((instructor) => {
      const courses = instructor.courses
        .map((course) => {
          const classDetails = classMap.get(course.classId)
          if (!classDetails) {
            return null
          }

          const sections = classDetails.sections.filter((section) => course.sectionIds.includes(section.sectionId))
          if (sections.length === 0) {
            return null
          }

          return {
            classId: classDetails.classId,
            code: classDetails.code,
            title: classDetails.title,
            description: classDetails.description,
            departmentId: classDetails.departmentId,
            courseNumber: classDetails.courseNumber,
            credits: classDetails.credits,
            sections,
          }
        })
        .filter(Boolean)

      return {
        ...instructor,
        courses,
      }
    })
    .filter((instructor) => instructor.courses.length > 0)
}

function ClassCatalog({ onEnrollmentChange, currentCourses = [] }) {
  const [browseMode, setBrowseMode] = useState('courses')
  const [classes, setClasses] = useState([])
  const [instructors, setInstructors] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedInstructorId, setSelectedInstructorId] = useState(null)
  const [previewSelection, setPreviewSelection] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [mutationMessage, setMutationMessage] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [mutatingSectionId, setMutatingSectionId] = useState(null)

  const loadRegistrationData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const [classData, instructorData] = await Promise.all([getClasses(), getInstructors()])
    setClasses(classData)
    setInstructors(instructorData)
    setSelectedClassId((current) => current ?? classData[0]?.classId ?? null)
    setSelectedInstructorId((current) => current ?? instructorData[0]?.instructorId ?? null)
  }, [])

  useEffect(() => {
    let isMounted = true

    loadRegistrationData()
      .then(() => {
        if (!isMounted) {
          return
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
  }, [loadRegistrationData])

  const departmentOptions = useMemo(() => {
    return [...new Set(classes.map((catalogClass) => catalogClass.department).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [classes])

  const filteredClasses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return classes.filter((catalogClass) => {
      const matchesDepartment =
        selectedDepartments.length === 0 || selectedDepartments.includes(catalogClass.department)
      if (!matchesDepartment) {
        return false
      }

      if (!query) {
        return true
      }

      return [catalogClass.className, catalogClass.courseCode, catalogClass.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [classes, searchTerm, selectedDepartments])

  const instructorBrowseData = useMemo(
    () => buildInstructorBrowseData(classes, instructors),
    [classes, instructors],
  )

  const filteredInstructors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return instructorBrowseData.filter((instructor) => {
      const matchesDepartment =
        selectedDepartments.length === 0 ||
        instructor.courses.some((course) => selectedDepartments.includes(course.departmentId))

      if (!matchesDepartment) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        instructor.name,
        ...instructor.courses.flatMap((course) => [course.code, course.title, course.departmentId]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [instructorBrowseData, searchTerm, selectedDepartments])

  const selectedClassDetails = useMemo(
    () => classes.find((catalogClass) => catalogClass.classId === selectedClassId) ?? null,
    [classes, selectedClassId],
  )

  const selectedInstructor = useMemo(
    () => instructorBrowseData.find((instructor) => instructor.instructorId === selectedInstructorId) ?? null,
    [instructorBrowseData, selectedInstructorId],
  )

  const selectedDetail = browseMode === 'courses' ? selectedClassDetails : selectedInstructor

  const previewCourses = useMemo(() => {
    if (!previewSelection) {
      return currentCourses
    }

    return [...currentCourses, toSectionPreviewCourse(previewSelection.source, previewSelection.section)]
  }, [currentCourses, previewSelection])

  const handleDepartmentToggle = (department) => {
    setSelectedDepartments((current) =>
      current.includes(department) ? current.filter((item) => item !== department) : [...current, department],
    )
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedDepartments([])
  }

  const handleEnrollmentAction = async (action, sectionId) => {
    setMutatingSectionId(sectionId)
    setMutationError('')
    setMutationMessage('')

    try {
      const response = action === 'enroll' ? await enrollInClass(sectionId) : await dropClass(sectionId)
      setMutationMessage(toSuccessMessage(response))
      await Promise.all([loadRegistrationData(), onEnrollmentChange?.()])
    } catch (error) {
      setMutationError(toFailureMessage(action, error))
    } finally {
      setMutatingSectionId(null)
    }
  }

  const hasActiveFilters = searchTerm.trim() !== '' || selectedDepartments.length > 0

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Registration</h2>
            <p className="text-sm text-slate-600">Switch between course-based and instructor-based registration, preview sections on your calendar, and enroll directly from either view.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBrowseMode('courses')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${browseMode === 'courses' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Browse by Course
            </button>
            <button
              type="button"
              onClick={() => setBrowseMode('instructors')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${browseMode === 'instructors' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Browse by Instructor
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[530px_minmax(0,1fr)_420px]">
        <aside className="space-y-3">
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Filters</h3>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Reset
            </button>
          </div>

          <div className="mt-3">
            <label htmlFor="registration-search" className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Search
            </label>
            <input
              id="registration-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={browseMode === 'courses' ? 'Ex: CSCE 590' : 'Ex: Patel'}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Departments</p>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-auto pr-1">
              {departmentOptions.map((department) => {
                const checked = selectedDepartments.includes(department)
                return (
                  <label key={department} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleDepartmentToggle(department)}
                      className="h-4 w-4 rounded border-slate-400 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-sm font-medium text-slate-900">{department}</span>
                  </label>
                )
              })}
            </div>
          </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calendar Preview</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Current Schedule + Selected Section</h3>
              </div>
              {previewSelection && (
                <button
                  type="button"
                  onClick={() => setPreviewSelection(null)}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  Clear Preview
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Preview a section from either browse mode to see how it fits alongside your current classes before you enroll.
            </p>
            <div className="mt-4">
              <WeeklyCalendar
                courses={previewCourses}
                title="Registration Preview"
                emptyMessage="Choose a section to preview it on the calendar."
              />
            </div>
          </section>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Loading registration options...</div>}
          {!loading && errorMessage && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{errorMessage}</div>}

          {!loading && !errorMessage && browseMode === 'courses' && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-700">Courses</h3>
                <p className="text-xs text-slate-500">{filteredClasses.length} shown</p>
              </div>
              {filteredClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
                  No classes match your current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {filteredClasses.map((catalogClass) => (
                    <CatalogCard
                      key={catalogClass.classId}
                      catalogClass={catalogClass}
                      isSelected={catalogClass.classId === selectedClassId}
                      onSelect={setSelectedClassId}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !errorMessage && browseMode === 'instructors' && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-700">Instructors</h3>
                <p className="text-xs text-slate-500">{filteredInstructors.length} shown</p>
              </div>
              {filteredInstructors.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
                  No instructors match your current filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredInstructors.map((instructor) => {
                    const isSelected = instructor.instructorId === selectedInstructorId
                    return (
                      <button
                        key={instructor.instructorId}
                        type="button"
                        onClick={() => setSelectedInstructorId(instructor.instructorId)}
                        className={`w-full rounded-xl border p-4 text-left shadow-sm transition-colors ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              Instructor
                            </p>
                            <h4 className="mt-1 text-base font-semibold">{instructor.name}</h4>
                          </div>
                          <span className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {instructor.courses.length} courses
                          </span>
                        </div>
                        <ul className={`mt-3 space-y-1 text-sm ${isSelected ? 'text-slate-200' : 'text-slate-700'}`}>
                          {instructor.courses.map((course) => (
                            <li key={`${instructor.instructorId}-${course.classId}`}>
                              <span className="font-medium">{course.code}</span> | {course.title}
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {browseMode === 'courses' && selectedDetail && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Course</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedDetail.code}</h3>
                <p className="text-sm font-medium text-slate-800">{selectedDetail.title}</p>
                <p className="mt-2 text-sm text-slate-600">{selectedDetail.description}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Department</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDetail.departmentId}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Course #</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDetail.courseNumber}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Credits</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDetail.credits}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {selectedDetail.sections.map((section) => (
                    <article key={section.sectionId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-semibold text-slate-900">Section {section.sectionId}</h5>
                          <p className="mt-1 text-sm text-slate-600">{section.instructorName}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatSectionSchedule(section.schedule)}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>Availability</p>
                          <p className="mt-1 font-semibold text-slate-900">{renderSectionAvailability(section)}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{renderSectionCapacityMeta(section)}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewSelection({ source: selectedDetail, section })}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnrollmentAction('enroll', section.sectionId)}
                          disabled={mutatingSectionId === section.sectionId}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {mutatingSectionId === section.sectionId ? 'Submitting...' : 'Enroll'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEnrollmentAction('unenroll', section.sectionId)}
                          disabled={mutatingSectionId === section.sectionId}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          {mutatingSectionId === section.sectionId ? 'Submitting...' : 'Unenroll'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {browseMode === 'instructors' && selectedDetail && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Instructor</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedDetail.name}</h3>
                <p className="mt-1 text-sm text-slate-600">Choose any section this instructor teaches and preview it on your calendar before you add it.</p>

                <div className="mt-4 space-y-4">
                  {selectedDetail.courses.map((course) => (
                    <article key={`${selectedDetail.instructorId}-${course.classId}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{course.code}</p>
                        <h4 className="text-sm font-semibold text-slate-900">{course.title}</h4>
                        <p className="mt-1 text-xs text-slate-500">{course.departmentId} {course.courseNumber} | {course.credits} credits</p>
                      </div>
                      <div className="mt-3 space-y-3">
                        {course.sections.map((section) => (
                          <div key={section.sectionId} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-semibold text-slate-900">Section {section.sectionId}</h5>
                                <p className="mt-1 text-xs text-slate-500">{formatSectionSchedule(section.schedule)}</p>
                              </div>
                              <div className="text-right text-xs text-slate-500">
                                <p>Availability</p>
                                <p className="mt-1 font-semibold text-slate-900">{renderSectionAvailability(section)}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{renderSectionCapacityMeta(section)}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewSelection({ source: course, section })}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900"
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEnrollmentAction('enroll', section.sectionId)}
                                disabled={mutatingSectionId === section.sectionId}
                                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                              >
                                {mutatingSectionId === section.sectionId ? 'Submitting...' : 'Enroll'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEnrollmentAction('unenroll', section.sectionId)}
                                disabled={mutatingSectionId === section.sectionId}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                              >
                                {mutatingSectionId === section.sectionId ? 'Submitting...' : 'Unenroll'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {!selectedDetail && !loading && !errorMessage && (
              <p className="text-sm text-slate-600">Select a course or instructor to review available sections.</p>
            )}

            {mutationMessage && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {mutationMessage}
              </div>
            )}
            {mutationError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {mutationError}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

export default ClassCatalog
