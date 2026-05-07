const BASE_URL = import.meta.env?.BASE_URL ?? '/'
const DUMMY_DATA_URL = `${BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`}data/dummy-data.json`
const TOKEN_STORAGE_KEY = 'student-portal-token'
const AUTH_PROFILE_STORAGE_KEY = 'student-portal-auth-profile'
const MOCK_ACTIVE_STUDENT_STORAGE_KEY = 'student-portal-mock-student-id'
const MOCK_ACTIVE_INSTRUCTOR_STORAGE_KEY = 'student-portal-mock-instructor-id'
const DEFAULT_ACTIVE_STUDENT_ID = '660e8400-e29b-41d4-a716-446655440001'
const DEFAULT_ACTIVE_INSTRUCTOR_ID = '770e8400-e29b-41d4-a716-446655440001'
const ENROLLMENT_STATUS = {
  enrolled: 0,
  waitlisted: 1,
}

let dummyDataPromise = null
let dummyDataState = null
let scheduleRequestCounter = 0
const scheduleRequests = new Map()

/**
 * @typedef {'Enrolled' | 'Waitlisted'} EnrollmentStatus
 */

/**
 * @typedef {Object} ClassSection
 * @property {string | number} sectionId
 * @property {Array<{day?: string, startTime?: string, endTime?: string, location?: string}>} [schedule]
 * @property {string} [instructorName]
 * @property {number | null} capacity
 * @property {number | null} enrolledCount
 * @property {number} waitlistedCount
 * @property {number | null} availableSeats
 * @property {boolean} isFull
 * @property {string} availabilityLabel
 */

/**
 * @typedef {Object} EnrollmentResponse
 * @property {'enroll' | 'unenroll'} action
 * @property {string} code
 * @property {string | number} sectionId
 * @property {EnrollmentStatus | 'Unenrolled'} enrollmentStatus
 */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function cloneData(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function toMockToken() {
  return `mock-token-${Date.now()}`
}

async function loadDummyDataFile() {
  if (!dummyDataPromise) {
    dummyDataPromise = fetch(DUMMY_DATA_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load dummy data from ${DUMMY_DATA_URL}`)
      }

      return response.json()
    })
  }

  return dummyDataPromise
}

async function getMockData() {
  if (!dummyDataState) {
    dummyDataState = cloneData(await loadDummyDataFile())
  }

  return dummyDataState
}

function getStoredValue(key) {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(key)
}

function setStoredValue(key, value) {
  if (typeof window !== 'undefined' && value) {
    window.localStorage.setItem(key, value)
  }
}

function getToken() {
  return getStoredValue(TOKEN_STORAGE_KEY)
}

function getStoredAuthProfile() {
  if (typeof window === 'undefined') {
    return null
  }

  const rawProfile = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY)
  if (!rawProfile) {
    return null
  }

  try {
    return JSON.parse(rawProfile)
  } catch {
    return null
  }
}

function setToken(token) {
  setStoredValue(TOKEN_STORAGE_KEY, token)
}

function setAuthProfile(profile) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }
}

function decodeJwtPayload(token) {
  if (!token || typeof window === 'undefined') {
    return null
  }

  const segments = String(token).split('.')
  if (segments.length < 2) {
    return null
  }

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = window.atob(padded)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function getAuthIdentity() {
  const token = getToken()
  const claims = decodeJwtPayload(token)
  const storedProfile = getStoredAuthProfile()

  return {
    name: firstDefined(
      storedProfile?.name,
      claims?.name,
      claims?.unique_name,
      claims?.preferred_username,
      claims?.given_name,
    ),
    email: firstDefined(storedProfile?.email, claims?.email, claims?.upn, claims?.preferred_username),
  }
}

function resolveDisplayName(user, fallbackLabel) {
  const authIdentity = getAuthIdentity()
  const dataName = String(user?.name ?? '').trim()
  const looksLikeHardcodedDemoUser = dataName === '' || /^demo user$/i.test(dataName)

  return firstDefined(
    looksLikeHardcodedDemoUser ? null : dataName,
    authIdentity.name,
    dataName,
    fallbackLabel,
  )
}

function resolveDisplayEmail(user) {
  const authIdentity = getAuthIdentity()
  return firstDefined(authIdentity.email, user?.email, '')
}

function formatTime(time) {
  if (!time) {
    return 'TBA'
  }

  const [hoursRaw = '0', minutesRaw = '00'] = String(time).split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 'TBA'
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12
  return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

function normalizeTime(time) {
  const [hoursRaw = '0', minutesRaw = '00'] = String(time ?? '').split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return ''
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function normalizeDay(day) {
  const normalized = String(day ?? '').trim().toLowerCase()
  const dayMap = {
    monday: 'Mon',
    mon: 'Mon',
    tuesday: 'Tue',
    tue: 'Tue',
    wednesday: 'Wed',
    wed: 'Wed',
    thursday: 'Thu',
    thu: 'Thu',
    friday: 'Fri',
    fri: 'Fri',
  }

  return dayMap[normalized] ?? String(day ?? '').slice(0, 3)
}

function formatSchedule(schedule = []) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return 'TBA'
  }

  const firstSlot = schedule[0]
  const sameTime = schedule.every(
    (slot) => slot.startTime === firstSlot.startTime && slot.endTime === firstSlot.endTime,
  )

  if (sameTime) {
    return `${schedule.map((slot) => slot.day).join('/')} ${formatTime(firstSlot.startTime)} - ${formatTime(firstSlot.endTime)}`
  }

  return schedule
    .map((slot) => `${slot.day} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`)
    .join(', ')
}

function buildLocationLabel(schedule = []) {
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return 'TBA'
  }

  const uniqueLocations = [...new Set(schedule.map((slot) => slot.location).filter(Boolean))]
  return uniqueLocations.length > 0 ? uniqueLocations.join(', ') : 'TBA'
}

function buildScheduleMap(entries = []) {
  return entries.reduce((map, entry) => {
    const key = String(entry.sectionId)
    const current = map.get(key) ?? []
    current.push({
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      location: entry.location,
    })
    map.set(key, current)
    return map
  }, new Map())
}

function buildCatalogMap(classes = []) {
  return classes.reduce((map, classItem) => {
    map.set(String(classItem.classId), classItem)
    return map
  }, new Map())
}

function toNumberOrNull(value) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function parseCapacityString(value) {
  if (typeof value !== 'string') {
    return null
  }

  const match = value.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) {
    return null
  }

  return {
    enrolled: Number(match[1]),
    max: Number(match[2]),
  }
}

export function normalizeEnrollmentStatus(status) {
  if (Number(status) === ENROLLMENT_STATUS.enrolled) {
    return 'Enrolled'
  }

  if (Number(status) === ENROLLMENT_STATUS.waitlisted) {
    return 'Waitlisted'
  }

  const normalized = String(status ?? '').trim().toLowerCase()

  if (normalized.includes('waitlist')) {
    return 'Waitlisted'
  }

  if (normalized.includes('enroll')) {
    return 'Enrolled'
  }

  return status ?? 'Unknown'
}

export function getSectionAvailabilityLabel(section = {}) {
  const availableSeats = toNumberOrNull(section.availableSeats)
  const waitlistedCount = toNumberOrNull(section.waitlistedCount) ?? 0
  const isFull =
    typeof section.isFull === 'boolean' ? section.isFull : availableSeats !== null ? availableSeats <= 0 : false

  if (isFull || availableSeats === 0) {
    return waitlistedCount > 0 ? `Full • ${waitlistedCount} waitlisted` : 'Full'
  }

  if (availableSeats !== null) {
    return `Open: ${availableSeats} seat${availableSeats === 1 ? '' : 's'} left`
  }

  return 'Availability unavailable'
}

function normalizeSeatCounts(source = {}) {
  const parsedStringCapacity =
    parseCapacityString(source.capacityLabel) ??
    parseCapacityString(source.capacityDisplay) ??
    parseCapacityString(source.capacity)

  const capacity =
    toNumberOrNull(source.capacity) ??
    toNumberOrNull(source.maxCapacity) ??
    toNumberOrNull(source.capacityMax) ??
    toNumberOrNull(source.max) ??
    toNumberOrNull(source.totalSeats) ??
    parsedStringCapacity?.max ??
    null

  const enrolledCount =
    toNumberOrNull(source.enrolledCount) ??
    toNumberOrNull(source.enrollmentCount) ??
    toNumberOrNull(source.currentEnrollment) ??
    toNumberOrNull(source.capacityEnrolled) ??
    toNumberOrNull(source.takenSeats) ??
    toNumberOrNull(source.enrolled) ??
    parsedStringCapacity?.enrolled ??
    null

  const waitlistedCount =
    toNumberOrNull(source.waitlistedCount) ??
    toNumberOrNull(source.waitlistCount) ??
    toNumberOrNull(source.waitlisted) ??
    0

  const availableSeats =
    toNumberOrNull(source.availableSeats) ??
    (capacity !== null && enrolledCount !== null ? Math.max(capacity - enrolledCount, 0) : null)

  const isFull =
    typeof source.isFull === 'boolean'
      ? source.isFull
      : availableSeats !== null
        ? availableSeats <= 0
        : capacity !== null && enrolledCount !== null
          ? enrolledCount >= capacity
          : false

  return {
    capacity,
    enrolledCount,
    waitlistedCount,
    availableSeats,
    isFull,
  }
}

function normalizeSection(section = {}) {
  const normalizedSeats = normalizeSeatCounts(section)

  return {
    ...section,
    ...normalizedSeats,
    availabilityLabel: getSectionAvailabilityLabel(normalizedSeats),
  }
}

function resolveSectionData(classItem) {
  const sectionLikeSources = [
    classItem,
    classItem.section,
    ...(Array.isArray(classItem.sections) ? classItem.sections : []),
  ].filter(Boolean)

  for (const source of sectionLikeSources) {
    const normalizedSection = normalizeSection(source)
    if (
      normalizedSection.capacity !== null ||
      normalizedSection.enrolledCount !== null ||
      normalizedSection.availableSeats !== null
    ) {
      return normalizedSection
    }
  }

  return normalizeSection({})
}

function resolveDashboardSection(classItem, catalogMap) {
  const catalogClass = catalogMap.get(String(classItem.classId))
  if (!catalogClass) {
    return null
  }

  const sections = Array.isArray(catalogClass.sections) ? catalogClass.sections : []
  return sections.find((section) => String(section.sectionId) === String(classItem.sectionId)) ?? null
}

function toDashboardCourse(classItem, scheduleMap, catalogMap = new Map()) {
  const sectionId = String(classItem.sectionId)
  const matchedSection = resolveDashboardSection(classItem, catalogMap)
  const schedule = scheduleMap.get(sectionId) ?? matchedSection?.schedule ?? classItem.schedule ?? []
  const sectionData = resolveSectionData(matchedSection ?? classItem)

  return {
    id: sectionId,
    classId: classItem.classId,
    sectionId: classItem.sectionId,
    courseCode: firstDefined(classItem.code, matchedSection?.code, catalogMap.get(String(classItem.classId))?.code),
    className: firstDefined(classItem.title, catalogMap.get(String(classItem.classId))?.title),
    title: firstDefined(classItem.title, catalogMap.get(String(classItem.classId))?.title),
    instructor: firstDefined(classItem.instructorName, matchedSection?.instructorName, 'TBA'),
    credits: classItem.credits,
    daysTimes: formatSchedule(schedule),
    location: buildLocationLabel(schedule),
    enrollmentStatus: normalizeEnrollmentStatus(classItem.enrollmentStatus),
    waitlistStatus: normalizeEnrollmentStatus(classItem.enrollmentStatus),
    schedule,
    capacity: {
      enrolled: sectionData.enrolledCount ?? 'N/A',
      max: sectionData.capacity ?? 'N/A',
    },
    sectionAvailability: sectionData.availabilityLabel,
    availableSeats: sectionData.availableSeats,
    waitlistedCount: sectionData.waitlistedCount,
    isFull: sectionData.isFull,
  }
}

function toCatalogClass(classItem) {
  const sections = Array.isArray(classItem.sections) ? classItem.sections.map(normalizeSection) : []
  const firstSection = sections[0] ?? null
  const schedule = firstSection?.schedule ?? []

  return {
    id: String(classItem.classId),
    classId: classItem.classId,
    code: classItem.code,
    courseCode: classItem.code,
    className: classItem.title,
    title: classItem.title,
    description: classItem.description,
    department: classItem.departmentId,
    departmentId: classItem.departmentId,
    courseNumber: classItem.courseNumber,
    credits: classItem.credits,
    sections,
    instructor: firstSection?.instructorName ?? 'TBA',
    displayTimes: formatSchedule(schedule),
    location: buildLocationLabel(schedule),
    availableSeats: firstSection?.availableSeats ?? null,
    maxCapacity: firstSection?.capacity ?? null,
    waitlistedCount: firstSection?.waitlistedCount ?? 0,
    isFull: firstSection?.isFull ?? false,
    sectionAvailability: firstSection?.availabilityLabel ?? 'Availability unavailable',
    schedule,
  }
}

function toCourseCode(classItem = {}) {
  return firstDefined(classItem.code, classItem.courseCode, `${classItem.departmentId ?? 'GEN'} ${classItem.courseNumber ?? ''}`.trim())
}

function getActiveStudentId(data) {
  const storedId = getStoredValue(MOCK_ACTIVE_STUDENT_STORAGE_KEY)
  const storedStudent = data.students.find((student) => String(student.id) === String(storedId))
  if (storedStudent) {
    return storedStudent.id
  }

  const authEmail = getAuthIdentity().email
  const authStudent = data.students.find((student) => student.email === authEmail)
  if (authStudent) {
    return authStudent.id
  }

  return data.students.find((student) => student.id === DEFAULT_ACTIVE_STUDENT_ID)?.id ?? data.students[0]?.id ?? null
}

function getActiveInstructorId(data) {
  const storedId = getStoredValue(MOCK_ACTIVE_INSTRUCTOR_STORAGE_KEY)
  const storedInstructor = data.instructors.find((instructor) => String(instructor.id) === String(storedId))
  if (storedInstructor) {
    return storedInstructor.id
  }

  const authEmail = getAuthIdentity().email
  const authInstructor = data.instructors.find((instructor) => instructor.email === authEmail)
  if (authInstructor) {
    return authInstructor.id
  }

  return data.instructors.find((instructor) => instructor.id === DEFAULT_ACTIVE_INSTRUCTOR_ID)?.id ?? data.instructors[0]?.id ?? null
}

function getActiveStudent(data) {
  const activeStudentId = getActiveStudentId(data)
  return data.students.find((student) => String(student.id) === String(activeStudentId)) ?? null
}

function getActiveInstructor(data) {
  const activeInstructorId = getActiveInstructorId(data)
  return data.instructors.find((instructor) => String(instructor.id) === String(activeInstructorId)) ?? null
}

function getClassBySection(data, sectionId) {
  const section = data.classSections.find((item) => String(item.id) === String(sectionId))
  if (!section) {
    return null
  }

  return data.classes.find((classItem) => String(classItem.id) === String(section.classId)) ?? null
}

function getSectionSchedules(data, sectionId) {
  return data.classSchedules
    .filter((schedule) => String(schedule.classSectionId) === String(sectionId))
    .map((schedule) => ({
      id: schedule.id,
      sectionId,
      day: normalizeDay(schedule.day),
      startTime: normalizeTime(schedule.startTime),
      endTime: normalizeTime(schedule.endTime),
      location: schedule.location,
    }))
}

function getSectionSeatCounts(data, sectionId) {
  const section = data.classSections.find((item) => String(item.id) === String(sectionId))
  const sectionEnrollments = data.enrollments.filter((item) => String(item.classSectionId) === String(sectionId))
  const enrolledCount = sectionEnrollments.filter((item) => Number(item.status) === ENROLLMENT_STATUS.enrolled).length
  const waitlistedCount = sectionEnrollments.filter((item) => Number(item.status) === ENROLLMENT_STATUS.waitlisted).length
  const capacity = toNumberOrNull(section?.capacity)
  const availableSeats = capacity === null ? null : Math.max(capacity - enrolledCount, 0)

  return {
    capacity,
    enrolledCount,
    waitlistedCount,
    availableSeats,
    isFull: availableSeats !== null ? availableSeats <= 0 : false,
  }
}

function toDummySection(data, section) {
  const classItem = data.classes.find((item) => String(item.id) === String(section.classId)) ?? {}
  const instructor = data.instructors.find((item) => String(item.id) === String(section.instructorId)) ?? {}
  const seatCounts = getSectionSeatCounts(data, section.id)
  const schedule = getSectionSchedules(data, section.id)

  return normalizeSection({
    id: section.id,
    sectionId: section.id,
    classId: section.classId,
    code: toCourseCode(classItem),
    courseCode: toCourseCode(classItem),
    title: classItem.title,
    instructorId: instructor.id,
    instructorName: instructor.name ?? 'TBA',
    schedule,
    capacity: section.capacity,
    ...seatCounts,
  })
}

function toRawCatalogClass(data, classItem) {
  const sections = data.classSections
    .filter((section) => String(section.classId) === String(classItem.id))
    .map((section) => toDummySection(data, section))

  return {
    id: classItem.id,
    classId: classItem.id,
    code: toCourseCode(classItem),
    courseCode: toCourseCode(classItem),
    title: classItem.title,
    className: classItem.title,
    description: classItem.description,
    departmentId: classItem.departmentId,
    departmentName: classItem.departmentName,
    courseNumber: classItem.courseNumber,
    credits: classItem.credits,
    semester: classItem.semester,
    session: classItem.session,
    sections,
  }
}

function toStudentClassEntry(data, enrollment) {
  const section = data.classSections.find((item) => String(item.id) === String(enrollment.classSectionId))
  const classItem = section ? data.classes.find((item) => String(item.id) === String(section.classId)) : null
  const instructor = section ? data.instructors.find((item) => String(item.id) === String(section.instructorId)) : null
  const seatCounts = section ? getSectionSeatCounts(data, section.id) : {}

  return {
    id: enrollment.id,
    classId: classItem?.id,
    sectionId: section?.id,
    code: toCourseCode(classItem),
    courseCode: toCourseCode(classItem),
    title: classItem?.title,
    className: classItem?.title,
    instructorName: instructor?.name ?? 'TBA',
    credits: classItem?.credits,
    enrollmentStatus: normalizeEnrollmentStatus(enrollment.status),
    schedule: section ? getSectionSchedules(data, section.id) : [],
    ...seatCounts,
  }
}

function getStudentEnrollments(data, studentId) {
  return data.enrollments
    .filter((enrollment) => String(enrollment.studentId) === String(studentId))
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
}

function getSectionEnrollment(data, sectionId, studentId) {
  return data.enrollments.find(
    (enrollment) =>
      String(enrollment.classSectionId) === String(sectionId) &&
      String(enrollment.studentId) === String(studentId),
  )
}

function createLocalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toEnrollmentResponse(data, action, sectionId, studentId) {
  const section = data.classSections.find((item) => String(item.id) === String(sectionId))
  const classItem = section ? data.classes.find((item) => String(item.id) === String(section.classId)) : null
  const enrollment = getSectionEnrollment(data, sectionId, studentId)

  return {
    action,
    code: toCourseCode(classItem),
    classId: classItem?.id ?? null,
    sectionId,
    enrollmentStatus: action === 'unenroll' ? 'Unenrolled' : normalizeEnrollmentStatus(enrollment?.status),
  }
}

function enrollStudentInSection(data, sectionId, studentId) {
  const section = data.classSections.find((item) => String(item.id) === String(sectionId))
  if (!section) {
    throw new Error('Class section not found in dummy-data.json.')
  }

  const student = data.students.find((item) => String(item.id) === String(studentId))
  if (!student) {
    throw new Error('Student not found in dummy-data.json.')
  }

  const existingEnrollment = getSectionEnrollment(data, sectionId, studentId)
  if (existingEnrollment) {
    return toEnrollmentResponse(data, 'enroll', sectionId, studentId)
  }

  const seatCounts = getSectionSeatCounts(data, sectionId)
  const status = seatCounts.availableSeats === null || seatCounts.availableSeats > 0
    ? ENROLLMENT_STATUS.enrolled
    : ENROLLMENT_STATUS.waitlisted
  const sameStatusCount = data.enrollments.filter(
    (enrollment) =>
      String(enrollment.classSectionId) === String(sectionId) &&
      Number(enrollment.status) === status,
  ).length

  data.enrollments.push({
    id: createLocalId('mock-enrollment'),
    studentId,
    classSectionId: sectionId,
    status,
    createdAtUtc: new Date().toISOString(),
    position: sameStatusCount + 1,
  })

  return toEnrollmentResponse(data, 'enroll', sectionId, studentId)
}

function unenrollStudentFromSection(data, sectionId, studentId) {
  const enrollmentIndex = data.enrollments.findIndex(
    (enrollment) =>
      String(enrollment.classSectionId) === String(sectionId) &&
      String(enrollment.studentId) === String(studentId),
  )

  if (enrollmentIndex === -1) {
    throw new Error('Student is not enrolled in this dummy-data section.')
  }

  data.enrollments.splice(enrollmentIndex, 1)
  return toEnrollmentResponse(data, 'unenroll', sectionId, studentId)
}

function getSuggestedSections(data, message = '', optionCount = 3, offset = 0) {
  const activeStudent = getActiveStudent(data)
  const enrolledSectionIds = new Set(
    getStudentEnrollments(data, activeStudent?.id).map((enrollment) => String(enrollment.classSectionId)),
  )
  const lowerMessage = String(message ?? '').toLowerCase()

  const candidates = data.classSections
    .filter((section) => !enrolledSectionIds.has(String(section.id)))
    .map((section) => {
      const schedule = getSectionSchedules(data, section.id)
      const starts = schedule.map((slot) => Number(slot.startTime.split(':')[0])).filter(Number.isFinite)
      const earliestStart = starts.length > 0 ? Math.min(...starts) : 24
      const includesFriday = schedule.some((slot) => slot.day === 'Fri')
      const prefersMorning = lowerMessage.includes('morning') || lowerMessage.includes('early')
      const prefersAfternoon = lowerMessage.includes('afternoon') || lowerMessage.includes('later')
      const avoidFriday = lowerMessage.includes('no friday') || lowerMessage.includes('avoid friday')

      let score = 0
      if (prefersMorning) {
        score += earliestStart < 12 ? -10 : 10
      }
      if (prefersAfternoon) {
        score += earliestStart >= 12 ? -10 : 10
      }
      if (avoidFriday && includesFriday) {
        score += 20
      }

      return {
        section,
        score,
      }
    })
    .sort((a, b) => a.score - b.score || String(a.section.classId).localeCompare(String(b.section.classId)))
    .map((item) => item.section)

  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)]
  return rotated.slice(0, Math.max(optionCount * 5, 10))
}

function hasScheduleConflict(currentEntries, nextSection) {
  const nextSchedule = getOptionClassEntry(nextSection).meetingSchedule

  return currentEntries.some((entry) =>
    entry.meetingSchedule.some((slot) =>
      nextSchedule.some(
        (nextSlot) =>
          nextSlot.day === slot.day &&
          nextSlot.startTime < slot.endTime &&
          nextSlot.endTime > slot.startTime,
      ),
    ),
  )
}

function getOptionClassEntry(section) {
  const data = dummyDataState
  const classItem = data?.classes.find((item) => String(item.id) === String(section.classId)) ?? {}
  const instructor = data?.instructors.find((item) => String(item.id) === String(section.instructorId)) ?? {}
  const schedule = data ? getSectionSchedules(data, section.id) : []
  const seatCounts = data ? getSectionSeatCounts(data, section.id) : {}

  return {
    classId: classItem.id,
    sectionId: section.id,
    code: toCourseCode(classItem),
    courseCode: toCourseCode(classItem),
    title: classItem.title,
    className: classItem.title,
    instructorName: instructor.name ?? 'TBA',
    credits: classItem.credits,
    enrollmentStatusProjection: seatCounts.availableSeats === 0 ? 'Waitlisted' : 'Enrolled',
    meetingSchedule: schedule,
    schedule,
  }
}

function buildScheduleOptions(data, message = '', optionCount = 3, offset = 0) {
  const candidates = getSuggestedSections(data, message, optionCount, offset)
  const options = []

  for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
    const entries = []
    const usedClassIds = new Set()
    const rotated = [...candidates.slice(optionIndex), ...candidates.slice(0, optionIndex)]

    for (const section of rotated) {
      if (entries.length >= 4) {
        break
      }

      if (usedClassIds.has(section.classId)) {
        continue
      }

      const entry = getOptionClassEntry(section)
      if (entries.length > 0 && hasScheduleConflict(entries, section)) {
        continue
      }

      entries.push(entry)
      usedClassIds.add(section.classId)
    }

    if (entries.length === 0) {
      continue
    }

    options.push({
      optionId: `option-${scheduleRequestCounter + 1}-${optionIndex + 1}`,
      rank: optionIndex + 1,
      totalCredits: entries.reduce((sum, entry) => sum + Number(entry.credits ?? 0), 0),
      summary: `Dummy schedule option ${optionIndex + 1} generated from local catalog data.`,
      classes: entries,
      includesWaitlistedSections: entries.some((entry) =>
        String(entry.enrollmentStatusProjection).toLowerCase().includes('waitlist'),
      ),
      isAccepted: false,
    })
  }

  return options
}

function parseSchedulePreferences(message = '') {
  const normalized = String(message).trim()
  const lowerMessage = normalized.toLowerCase()

  return {
    prompt: normalized || 'Generate schedule options from dummy catalog data.',
    preferredTimeOfDay: lowerMessage.includes('morning')
      ? 'Morning'
      : lowerMessage.includes('afternoon') || lowerMessage.includes('later')
        ? 'Afternoon'
        : 'Flexible',
    avoidFriday: lowerMessage.includes('no friday') || lowerMessage.includes('avoid friday'),
    source: 'public/data/dummy-data.json',
  }
}

function getClassSuggestions(data, message = '') {
  return getSuggestedSections(data, message, 6, 0).slice(0, 6).map((section) => {
    const classItem = data.classes.find((item) => String(item.id) === String(section.classId)) ?? {}

    return {
      classId: classItem.id,
      sectionId: section.id,
      code: toCourseCode(classItem),
      title: classItem.title,
      credits: classItem.credits,
      department: classItem.departmentId,
      rationale: 'Available in the local dummy catalog and not currently on your schedule.',
    }
  })
}

function createScheduleResponse(data, message = '', optionCount = 3, requestId = null, offset = 0) {
  scheduleRequestCounter += 1

  const nextRequestId = requestId ?? `mock-request-${scheduleRequestCounter}`
  const interpretedPreferences = parseSchedulePreferences(message)
  const options = buildScheduleOptions(data, message, optionCount, offset)
  const response = {
    message: options.length > 0
      ? 'Here are schedule options generated from dummy-data.json.'
      : 'No schedule options were available in dummy-data.json.',
    source: 'dummy-data.json',
    mode: 'generate',
    didGenerate: true,
    requestId: nextRequestId,
    interpretedPreferences,
    classSuggestions: getClassSuggestions(data, message),
    generatedSchedule: {
      id: nextRequestId,
      requestId: nextRequestId,
      options,
      source: 'dummy-data.json',
    },
  }

  scheduleRequests.set(nextRequestId, response)
  return response
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
  }
}

export async function signup(payload) {
  const data = await getMockData()
  const email = String(payload?.email ?? '').trim().toLowerCase()
  const name = firstDefined(payload?.name, email.split('@')[0], 'Demo Student')
  const existingStudent = data.students.find((student) => student.email.toLowerCase() === email)
  const student = existingStudent ?? {
    id: createLocalId('mock-student'),
    name,
    email,
    password: 'mock-password',
    major: 'Undeclared',
    classification: 'Student',
  }

  if (!existingStudent) {
    data.students.push(student)
  }

  if (!data.users.some((user) => String(user.studentId) === String(student.id))) {
    data.users.push({
      id: createLocalId('mock-user'),
      email,
      passwordHash: 'mock-password',
      name,
      studentId: student.id,
      createdAt: new Date().toISOString(),
    })
  }

  setStoredValue(MOCK_ACTIVE_STUDENT_STORAGE_KEY, student.id)
  setToken(toMockToken())
  setAuthProfile({ name: student.name, email: student.email })

  return {
    accessToken: getToken(),
    user: await getCurrentUser(),
  }
}

export async function login(payload) {
  const data = await getMockData()
  const email = String(payload?.email ?? '').trim().toLowerCase()
  const student = data.students.find((item) => item.email.toLowerCase() === email)
  const user = data.users.find((item) => item.email.toLowerCase() === email)
  const instructor = data.instructors.find((item) => item.email.toLowerCase() === email)

  if (!student && !user && !instructor) {
    throw new Error('No matching dummy-data.json account was found for that email.')
  }

  if (student || user) {
    setStoredValue(MOCK_ACTIVE_STUDENT_STORAGE_KEY, student?.id ?? user.studentId)
  }

  if (instructor) {
    setStoredValue(MOCK_ACTIVE_INSTRUCTOR_STORAGE_KEY, instructor.id)
  }

  setToken(toMockToken())
  setAuthProfile({
    name: firstDefined(student?.name, user?.name, instructor?.name),
    email: firstDefined(student?.email, user?.email, instructor?.email),
  })

  return {
    accessToken: getToken(),
    user: await getCurrentUser(),
  }
}

export async function getCurrentUser() {
  const data = await getMockData()
  const student = getActiveStudent(data)
  const instructor = getActiveInstructor(data)
  const user = data.users.find((item) => String(item.studentId) === String(student?.id))

  return {
    id: String(firstDefined(user?.id, student?.id, 'mock-user')),
    name: resolveDisplayName(student, 'Current Student'),
    email: resolveDisplayEmail(student),
    studentId: student?.id ?? null,
    instructorId: instructor?.id ?? null,
    instructorName: instructor?.name ?? '',
    instructorEmail: instructor?.email ?? '',
    program: student?.major ?? 'Student',
    classification: student?.classification ?? '',
  }
}

export async function getCurrentStudentClasses() {
  const data = await getMockData()
  const student = getActiveStudent(data)
  const enrollments = getStudentEnrollments(data, student?.id)

  return enrollments.map((enrollment) => toStudentClassEntry(data, enrollment)).filter((entry) => entry.sectionId)
}

export async function getCurrentStudentSchedule() {
  const classes = await getCurrentStudentClasses()

  return classes.flatMap((classItem) =>
    (classItem.schedule ?? []).map((slot) => ({
      sectionId: classItem.sectionId,
      classId: classItem.classId,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      location: slot.location,
    })),
  )
}

export async function saveSchedulePreferences(message, generateSchedules = false) {
  const data = await getMockData()

  if (generateSchedules) {
    return createScheduleResponse(data, message, 3)
  }

  scheduleRequestCounter += 1
  const requestId = `mock-request-${scheduleRequestCounter}`
  const response = {
    message: "Preferences saved from dummy-data.json. Generate schedules when you're ready.",
    source: 'dummy-data.json',
    mode: 'preferences',
    didGenerate: false,
    requestId,
    interpretedPreferences: parseSchedulePreferences(message),
    classSuggestions: getClassSuggestions(data, message),
  }

  scheduleRequests.set(requestId, response)
  return response
}

export async function generateScheduleOptions(message = '', optionCount = 3) {
  const data = await getMockData()
  return createScheduleResponse(data, message, optionCount)
}

export async function clearSchedulePreferences() {
  scheduleRequests.clear()
  return {
    message: 'Dummy scheduling preferences cleared.',
  }
}

export async function requestScheduleAlternatives(requestId, message, optionCount = 3) {
  const data = await getMockData()
  const previousRequest = scheduleRequests.get(requestId)
  const offset = (previousRequest?.generatedSchedule?.options?.length ?? 0) + 1
  return createScheduleResponse(data, message, optionCount, requestId, offset)
}

export async function acceptScheduleOption(requestId, scheduleOptionId) {
  const data = await getMockData()
  const request = scheduleRequests.get(requestId)
  const option = request?.generatedSchedule?.options?.find((item) => String(item.optionId) === String(scheduleOptionId))

  if (!option) {
    throw new Error('Schedule option was not found in local dummy schedule history.')
  }

  const student = getActiveStudent(data)
  option.classes.forEach((entry) => {
    enrollStudentInSection(data, entry.sectionId, student.id)
  })

  const options = request.generatedSchedule.options.map((item) => ({
    ...item,
    isAccepted: String(item.optionId) === String(scheduleOptionId),
  }))
  const response = {
    ...request,
    message: `Option ${option.rank} accepted. Dummy enrollments were updated locally.`,
    status: 'accepted',
    acceptedScheduleOptionId: scheduleOptionId,
    didGenerate: true,
    generatedSchedule: {
      ...request.generatedSchedule,
      options,
    },
  }

  scheduleRequests.set(requestId, response)
  return response
}

export async function getClasses(departmentId) {
  const data = await getMockData()
  const classes = data.classes
    .filter((classItem) => !departmentId || String(classItem.departmentId) === String(departmentId))
    .map((classItem) => toCatalogClass(toRawCatalogClass(data, classItem)))

  return classes
}

export async function getClassById(classId) {
  const data = await getMockData()
  const classItem = data.classes.find((item) => String(item.id) === String(classId))

  return classItem ? toCatalogClass(toRawCatalogClass(data, classItem)) : null
}

export async function enrollInClass(sectionId) {
  const data = await getMockData()
  const student = getActiveStudent(data)
  return enrollStudentInSection(data, sectionId, student.id)
}

export async function dropClass(sectionId) {
  const data = await getMockData()
  const student = getActiveStudent(data)
  return unenrollStudentFromSection(data, sectionId, student.id)
}

export async function getInstructors() {
  const data = await getMockData()
  const catalog = data.classes.map((classItem) => toRawCatalogClass(data, classItem))

  return data.instructors.map((instructor) => {
    const instructorSections = data.classSections.filter(
      (section) => String(section.instructorId) === String(instructor.id),
    )
    const courses = catalog
      .map((classItem) => {
        const sectionIds = instructorSections
          .filter((section) => String(section.classId) === String(classItem.classId))
          .map((section) => section.id)

        if (sectionIds.length === 0) {
          return null
        }

        return {
          classId: classItem.classId,
          code: classItem.code,
          title: classItem.title,
          sectionIds,
        }
      })
      .filter(Boolean)

    return {
      id: instructor.id,
      instructorId: instructor.id,
      name: instructor.name,
      email: instructor.email,
      courses,
    }
  })
}

export async function getCurrentTeacherClasses() {
  const data = await getMockData()
  const instructor = getActiveInstructor(data)

  return data.classSections
    .filter((section) => String(section.instructorId) === String(instructor?.id))
    .map((section) => {
      const classItem = getClassBySection(data, section.id) ?? {}
      const normalizedSection = toDummySection(data, section)
      const enrollmentPercentage =
        normalizedSection.capacity && normalizedSection.capacity > 0
          ? Math.round((normalizedSection.enrolledCount / normalizedSection.capacity) * 100)
          : 0

      return {
        id: section.id,
        classId: classItem.id,
        sectionId: section.id,
        courseCode: toCourseCode(classItem),
        className: classItem.title,
        title: classItem.title,
        instructorName: instructor?.name ?? 'TBA',
        credits: classItem.credits,
        daysTimes: formatSchedule(normalizedSection.schedule),
        location: buildLocationLabel(normalizedSection.schedule),
        schedule: normalizedSection.schedule,
        capacity: normalizedSection.capacity,
        enrolledCount: normalizedSection.enrolledCount,
        waitlistedCount: normalizedSection.waitlistedCount,
        availableSeats: normalizedSection.availableSeats,
        enrollmentPercentage,
      }
    })
}

export async function getTeacherClassStudents(sectionId) {
  if (!sectionId) {
    return null
  }

  const data = await getMockData()
  const section = data.classSections.find((item) => String(item.id) === String(sectionId))
  if (!section) {
    throw new Error('Class section not found in dummy-data.json.')
  }

  const classItem = getClassBySection(data, sectionId) ?? {}
  const normalizedSection = toDummySection(data, section)
  const students = data.enrollments
    .filter((enrollment) => String(enrollment.classSectionId) === String(sectionId))
    .sort((a, b) => Number(a.status) - Number(b.status) || Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((enrollment) => {
      const student = data.students.find((item) => String(item.id) === String(enrollment.studentId)) ?? {}
      return {
        studentId: student.id ?? enrollment.studentId,
        studentName: student.name ?? 'Unknown Student',
        email: student.email ?? '',
        enrollmentDate: enrollment.createdAtUtc,
        enrollmentStatus: normalizeEnrollmentStatus(enrollment.status),
      }
    })

  return {
    sectionId,
    classId: classItem.id,
    code: toCourseCode(classItem),
    title: classItem.title,
    capacity: normalizedSection.capacity,
    enrolledCount: normalizedSection.enrolledCount,
    waitlistedCount: normalizedSection.waitlistedCount,
    students,
  }
}

export async function teacherEnrollStudent(sectionId, studentId) {
  const data = await getMockData()
  return enrollStudentInSection(data, sectionId, studentId)
}

export async function teacherUnenrollStudent(sectionId, studentId) {
  const data = await getMockData()
  return unenrollStudentFromSection(data, sectionId, studentId)
}

export async function getTeacherDashboard() {
  const data = await getMockData()
  const instructor = getActiveInstructor(data)
  const classes = await getCurrentTeacherClasses()

  return {
    id: String(firstDefined(instructor?.id, 'teacher')),
    fullName: instructor?.name ?? 'Current Teacher',
    email: instructor?.email ?? '',
    instructorId: instructor?.id ?? null,
    assignedClasses: classes,
  }
}

export async function getStudentDashboard() {
  const data = await getMockData()
  const user = await getCurrentUser()
  const [classes, scheduleEntries, catalog] = await Promise.all([
    getCurrentStudentClasses(),
    getCurrentStudentSchedule(),
    getClasses().catch(() => []),
  ])

  const scheduleMap = buildScheduleMap(scheduleEntries)
  const catalogMap = buildCatalogMap(catalog)
  const courses = Array.isArray(classes)
    ? classes.map((entry) => toDashboardCourse(entry, scheduleMap, catalogMap))
    : []
  const student = getActiveStudent(data)

  return {
    id: String(firstDefined(user?.studentId, user?.id, '1')),
    fullName: resolveDisplayName(student, 'Current Student'),
    email: resolveDisplayEmail(student),
    instructorId: user?.instructorId ?? null,
    program: student?.major ?? 'Student',
    term: 'Spring 2026',
    gpa: 0,
    courses,
    scheduleEntries: Array.isArray(scheduleEntries) ? scheduleEntries : [],
  }
}

export async function verifyStudentApiConnections() {
  const [catalog, currentClasses] = await Promise.all([getClasses(), getCurrentStudentClasses()])
  const classId = catalog[0]?.classId ?? currentClasses[0]?.classId

  await Promise.all([
    getCurrentUser(),
    getCurrentStudentSchedule(),
    getInstructors(),
    classId ? getClassById(classId) : Promise.resolve(null),
  ])
}

export { DUMMY_DATA_URL, TOKEN_STORAGE_KEY }
