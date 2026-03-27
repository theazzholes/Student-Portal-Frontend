const PROD_API_BASE_URL = 'https://azzhfunctionapp-h6apc3f6eyf7eagh.northcentralus-01.azurewebsites.net/api'
const TOKEN_STORAGE_KEY = 'student-portal-token'

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

function toDashboardCourse(classItem, scheduleMap) {
  const sectionId = String(classItem.sectionId)
  const schedule = scheduleMap.get(sectionId) ?? classItem.schedule ?? []

  return {
    id: sectionId,
    classId: classItem.classId,
    sectionId: classItem.sectionId,
    courseCode: classItem.code,
    className: classItem.title,
    title: classItem.title,
    instructor: classItem.instructorName,
    credits: classItem.credits,
    daysTimes: formatSchedule(schedule),
    location: buildLocationLabel(schedule),
    enrollmentStatus: classItem.enrollmentStatus,
    waitlistStatus: classItem.enrollmentStatus,
    schedule,
    capacity: {
      enrolled: 'N/A',
      max: 'N/A',
    },
  }
}

function toCatalogClass(classItem) {
  const firstSection = classItem.sections?.[0] ?? null
  const schedule = firstSection?.schedule ?? []
  const maxCapacity = firstSection?.capacity ?? 0

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
    sections: classItem.sections ?? [],
    instructor: firstSection?.instructorName ?? 'TBA',
    displayTimes: formatSchedule(schedule),
    location: buildLocationLabel(schedule),
    availableSeats: maxCapacity,
    maxCapacity,
    schedule,
  }
}

function getToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setToken(token) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  }
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
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
  return apiFetch(`/classes/${classId}`)
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

export async function getStudentDashboard() {
  const [user, classes, scheduleEntries] = await Promise.all([
    getCurrentUser(),
    getCurrentStudentClasses(),
    getCurrentStudentSchedule(),
  ])

  const scheduleMap = buildScheduleMap(scheduleEntries)
  const courses = Array.isArray(classes) ? classes.map((entry) => toDashboardCourse(entry, scheduleMap)) : []

  return {
    id: String(firstDefined(user?.studentId, user?.id, '1')),
    fullName: user?.name ?? 'Current Student',
    email: user?.email ?? '',
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
