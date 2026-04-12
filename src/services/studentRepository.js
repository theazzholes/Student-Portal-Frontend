const PROD_API_BASE_URL = 'https://azzhfunctionapp-h6apc3f6eyf7eagh.northcentralus-01.azurewebsites.net/api'
const TOKEN_STORAGE_KEY = 'student-portal-token'
const AUTH_PROFILE_STORAGE_KEY = 'student-portal-auth-profile'

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
 * @property {EnrollmentStatus} enrollmentStatus
 */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
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

function getToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
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
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  }
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
  const apiName = String(user?.name ?? '').trim()
  const looksLikeHardcodedDemoUser = apiName === '' || /^demo user$/i.test(apiName)

  return firstDefined(
    looksLikeHardcodedDemoUser ? null : apiName,
    authIdentity.name,
    apiName,
    fallbackLabel,
  )
}

function resolveDisplayEmail(user) {
  const authIdentity = getAuthIdentity()
  return firstDefined(authIdentity.email, user?.email, '')
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(AUTH_PROFILE_STORAGE_KEY)
  }
}

async function readError(response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null)
    if (payload) {
      const message = payload.message ?? payload.error ?? payload.title ?? ''
      if (payload.errorCode && message) {
        return `${payload.errorCode}: ${message}`
      }
      if (payload.errorCode) {
        return String(payload.errorCode)
      }
      if (message) {
        return String(message)
      }
    }
  }

  const text = await response.text().catch(() => '')
  return text || `Request failed with ${response.status}`
}

export async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers ?? {})
  headers.set('Content-Type', 'application/json')

  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${PROD_API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function signup(payload) {
  const data = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (data?.accessToken) {
    setToken(data.accessToken)
    setAuthProfile({
      name: payload?.name ?? '',
      email: payload?.email ?? '',
    })
  }

  return data
}

export async function login(payload) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (data?.accessToken) {
    setToken(data.accessToken)
    setAuthProfile({
      email: payload?.email ?? '',
    })
  }

  return data
}

export async function getCurrentUser() {
  return apiFetch('/users/current')
}

export async function getCurrentStudentClasses() {
  return apiFetch('/students/current/classes')
}

export async function getCurrentStudentSchedule() {
  return apiFetch('/students/current/schedule')
}

export async function getClasses(departmentId) {
  const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : ''
  const data = await apiFetch(`/classes${query}`)
  return Array.isArray(data) ? data.map(toCatalogClass) : []
}

export async function getClassById(classId) {
  const data = await apiFetch(`/classes/${classId}`)
  return data ? toCatalogClass(data) : data
}

export async function enrollInClass(sectionId) {
  return apiFetch('/students/current/enroll', {
    method: 'POST',
    body: JSON.stringify({ sectionId }),
  })
}

export async function dropClass(sectionId) {
  return apiFetch('/students/current/unenroll', {
    method: 'POST',
    body: JSON.stringify({ sectionId }),
  })
}

export async function getInstructors() {
  const data = await apiFetch('/instructors')
  return Array.isArray(data) ? data : []
}

export async function getCurrentTeacherClasses() {
  const data = await apiFetch('/teachers/current/classes')
  return Array.isArray(data) ? data : []
}

export async function getTeacherClassStudents(sectionId) {
  if (!sectionId) {
    return null
  }

  return apiFetch(`/teachers/current/classes/${encodeURIComponent(sectionId)}/students`)
}

export async function teacherEnrollStudent(sectionId, studentId) {
  return apiFetch(
    `/teachers/current/classes/${encodeURIComponent(sectionId)}/students/${encodeURIComponent(studentId)}/enroll`,
    {
      method: 'POST',
    },
  )
}

export async function teacherUnenrollStudent(sectionId, studentId) {
  return apiFetch(
    `/teachers/current/classes/${encodeURIComponent(sectionId)}/students/${encodeURIComponent(studentId)}/enroll`,
    {
      method: 'DELETE',
    },
  )
}

export async function getTeacherDashboard() {
  const [user, classes] = await Promise.all([getCurrentUser(), getCurrentTeacherClasses()])

  return {
    id: String(firstDefined(user?.instructorId, user?.id, 'teacher')),
    fullName: resolveDisplayName(user, 'Current Teacher'),
    email: resolveDisplayEmail(user),
    instructorId: user?.instructorId ?? null,
    assignedClasses: classes,
  }
}

export async function getStudentDashboard() {
  const [user, classes, scheduleEntries, catalog] = await Promise.all([
    getCurrentUser(),
    getCurrentStudentClasses(),
    getCurrentStudentSchedule(),
    getClasses().catch(() => []),
  ])

  const scheduleMap = buildScheduleMap(scheduleEntries)
  const catalogMap = buildCatalogMap(catalog)
  const courses = Array.isArray(classes)
    ? classes.map((entry) => toDashboardCourse(entry, scheduleMap, catalogMap))
    : []

  return {
    id: String(firstDefined(user?.studentId, user?.id, '1')),
    fullName: resolveDisplayName(user, 'Current Student'),
    email: resolveDisplayEmail(user),
    instructorId: user?.instructorId ?? null,
    program: 'Student',
    term: 'Current Term',
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

export { PROD_API_BASE_URL, TOKEN_STORAGE_KEY }
