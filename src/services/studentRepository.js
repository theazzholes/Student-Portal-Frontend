function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toLookupKey(value) {
  if (value === undefined || value === null || value === '') {
    return ''
  }

  return String(value).trim().toLowerCase()
}

function normalizeDay(value) {
  if (!value) {
    return ''
  }

  const trimmed = String(value).trim()
  const dayMap = {
    mon: 'Mon',
    monday: 'Mon',
    tue: 'Tue',
    tues: 'Tue',
    tuesday: 'Tue',
    wed: 'Wed',
    wednesday: 'Wed',
    thu: 'Thu',
    thur: 'Thu',
    thurs: 'Thu',
    thursday: 'Thu',
    fri: 'Fri',
    friday: 'Fri',
  }

  return dayMap[trimmed.toLowerCase()] ?? trimmed.slice(0, 3)
}

function normalizeTime(value) {
  if (!value && value !== 0) {
    return ''
  }

  const rawTime = String(value).trim()
  const twelveHour = rawTime.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (twelveHour) {
    let hours = Number(twelveHour[1])
    const minutes = Number(twelveHour[2] ?? '0')
    const meridiem = twelveHour[3].toLowerCase()

    if (meridiem === 'pm' && hours !== 12) {
      hours += 12
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const hourMinute = rawTime.match(/(\d{1,2}):(\d{2})/)
  if (hourMinute) {
    return `${String(Number(hourMinute[1])).padStart(2, '0')}:${hourMinute[2]}`
  }

  return ''
}

function toDisplayTime(time) {
  if (!time) {
    return ''
  }

  const [hourString = '', minuteString = '00'] = String(time).split(':')
  const hour = Number(hourString)
  const minute = Number(minuteString)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return ''
  }

  const meridiem = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${meridiem}`
}

function extractArrayPayload(payload, candidateKeys = []) {
  if (Array.isArray(payload)) {
    return payload
  }

  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key]
    }

    if (Array.isArray(payload?.data?.[key])) {
      return payload.data[key]
    }
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  return []
}

function extractStudentPayload(payload) {
  if (!payload || Array.isArray(payload)) {
    return {}
  }

  return payload.student ?? payload.currentStudent ?? payload.profile ?? payload.data?.student ?? {}
}

function extractRawSlots(source) {
  if (!source || typeof source !== 'object') {
    return []
  }

  const slotArrays = [
    source.schedule,
    source.meetings,
    source.classMeetings,
    source.timeSlots,
    source.slots,
  ]

  for (const slots of slotArrays) {
    if (Array.isArray(slots) && slots.length > 0) {
      return slots
    }
  }

  if (
    source.day ||
    source.dayOfWeek ||
    source.weekday ||
    source.startTime ||
    source.endTime ||
    source.start ||
    source.end
  ) {
    return [source]
  }

  return []
}

function normalizeSlots(rawSlots) {
  const normalized = rawSlots
    .map((slot) => {
      const day = normalizeDay(firstDefined(slot.day, slot.dayOfWeek, slot.weekday))
      const startTime = normalizeTime(firstDefined(slot.startTime, slot.start, slot.beginTime))
      const endTime = normalizeTime(firstDefined(slot.endTime, slot.end, slot.finishTime))
      const location = firstDefined(slot.location, slot.room, slot.locationName, '')

      if (!day || !startTime || !endTime) {
        return null
      }

      return {
        day,
        startTime,
        endTime,
        location,
      }
    })
    .filter(Boolean)

  const seen = new Set()
  return normalized.filter((slot) => {
    const key = `${slot.day}|${slot.startTime}|${slot.endTime}|${slot.location}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function toDaysTimes(schedule, explicitDaysTimes = '') {
  if (explicitDaysTimes) {
    return explicitDaysTimes
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    return 'TBA'
  }

  const firstSlot = schedule[0]
  const hasSharedTime = schedule.every(
    (slot) => slot.startTime === firstSlot.startTime && slot.endTime === firstSlot.endTime,
  )

  if (hasSharedTime) {
    const days = schedule.map((slot) => slot.day).join('/')
    const start = toDisplayTime(firstSlot.startTime)
    const end = toDisplayTime(firstSlot.endTime)
    return start && end ? `${days} ${start} - ${end}` : days
  }

  return schedule
    .map((slot) => `${slot.day} ${toDisplayTime(slot.startTime)} - ${toDisplayTime(slot.endTime)}`)
    .join(', ')
}

function buildScheduleLookup(scheduleEntries) {
  const lookup = new Map()

  const addEntry = (value, entry) => {
    const key = toLookupKey(value)
    if (key && !lookup.has(key)) {
      lookup.set(key, entry)
    }
  }

  for (const entry of scheduleEntries) {
    addEntry(entry?.id, entry)
    addEntry(entry?.classId, entry)
    addEntry(entry?.courseId, entry)
    addEntry(entry?.sectionId, entry)
    addEntry(entry?.crn, entry)
    addEntry(entry?.courseCode, entry)
    addEntry(entry?.code, entry)
  }

  return lookup
}

function findScheduleEntryForClass(classRecord, scheduleLookup) {
  const candidateKeys = [
    classRecord?.id,
    classRecord?.classId,
    classRecord?.courseId,
    classRecord?.sectionId,
    classRecord?.crn,
    classRecord?.courseCode,
    classRecord?.code,
  ]

  for (const candidate of candidateKeys) {
    const entry = scheduleLookup.get(toLookupKey(candidate))
    if (entry) {
      return entry
    }
  }

  return null
}

function toWaitlistStatus(classRecord) {
  const explicitStatus = firstDefined(classRecord.waitlistStatus, classRecord.waitlist?.status)
  if (explicitStatus) {
    return String(explicitStatus)
  }

  const count = firstDefined(
    classRecord.waitlistCount,
    classRecord.waitlist?.count,
    classRecord.waitlistSize,
  )

  const parsedCount = Number(count)
  if (Number.isFinite(parsedCount) && parsedCount > 0) {
    return `Waitlist ${parsedCount}`
  }

  return 'Open'
}

function toCourseCode(classRecord) {
  const explicitCode = firstDefined(classRecord.courseCode, classRecord.code, classRecord.classCode)
  if (explicitCode) {
    return String(explicitCode)
  }

  const subject = firstDefined(classRecord.subjectCode, classRecord.subject, classRecord.department)
  const number = firstDefined(classRecord.courseNumber, classRecord.catalogNumber, classRecord.number)
  if (subject && number) {
    return `${subject} ${number}`
  }

  return 'TBA'
}

export async function getStudentDashboard() {
  const classesData = await getCurrentStudentClasses()
  const classEntries = extractArrayPayload(classesData, [
    'classes',
    'currentClasses',
    'enrollments',
    'registrations',
  ])

  const needsScheduleData = classEntries.some((entry) => {
    const classRecord = entry?.class ?? entry?.course ?? entry ?? {}
    const hasDaysTimes = Boolean(classRecord.daysTimes)
    const hasLocation = Boolean(firstDefined(classRecord.location, classRecord.room))
    const hasSlotData = extractRawSlots(classRecord).length > 0
    return !hasDaysTimes || !hasLocation || !hasSlotData
  })

  const scheduleData = needsScheduleData ? await getCurrentStudentSchedule() : null
  const apiData = {
    classes: classesData,
    schedule: scheduleData,
  }
  console.log('Real API Data:', apiData)

  const scheduleEntries = extractArrayPayload(scheduleData, [
    'schedule',
    'schedules',
    'classSchedules',
    'classes',
  ])
  const scheduleLookup = buildScheduleLookup(scheduleEntries)

  const studentFromClasses = extractStudentPayload(classesData)
  const studentFromSchedule = extractStudentPayload(scheduleData)
  const studentProfile = {
    ...studentFromSchedule,
    ...studentFromClasses,
  }

  const fullNameFromParts = [
    firstDefined(studentProfile.firstName, studentProfile.givenName, ''),
    firstDefined(studentProfile.lastName, studentProfile.familyName, ''),
  ]
    .join(' ')
    .trim()

  const courses = classEntries.map((entry, index) => {
    const classRecord = entry?.class ?? entry?.course ?? entry ?? {}
    const scheduleRecord = findScheduleEntryForClass(classRecord, scheduleLookup) ?? {}

    const mergedRecord = {
      ...scheduleRecord,
      ...classRecord,
    }

    const normalizedSchedule = normalizeSlots([
      ...extractRawSlots(scheduleRecord),
      ...extractRawSlots(classRecord),
    ])

    const instructor = firstDefined(
      mergedRecord.instructor,
      mergedRecord.instructorName,
      mergedRecord.professor,
      mergedRecord.professorName,
      mergedRecord.facultyName,
      'TBA',
    )

    const location = firstDefined(
      mergedRecord.location,
      mergedRecord.locationName,
      mergedRecord.room,
      normalizedSchedule[0]?.location,
      'TBA',
    )

    const courseCode = toCourseCode(mergedRecord)
    const fallbackId = `${courseCode}-${index + 1}`

    return {
      id: String(
        firstDefined(
          mergedRecord.id,
          mergedRecord.classId,
          mergedRecord.courseId,
          mergedRecord.sectionId,
          mergedRecord.crn,
          fallbackId,
        ),
      ),
      courseCode,
      className: String(
        firstDefined(
          mergedRecord.className,
          mergedRecord.courseName,
          mergedRecord.title,
          mergedRecord.name,
          'Untitled Class',
        ),
      ),
      instructor: String(instructor),
      daysTimes: toDaysTimes(normalizedSchedule, firstDefined(mergedRecord.daysTimes, '')),
      location: String(location),
      credits: toNumber(firstDefined(mergedRecord.credits, mergedRecord.creditHours), 0),
      waitlistStatus: toWaitlistStatus(mergedRecord),
      grade: {
        letter: String(firstDefined(mergedRecord.grade?.letter, mergedRecord.letterGrade, 'N/A')),
        percent: toNumber(firstDefined(mergedRecord.grade?.percent, mergedRecord.gradePercent), 0),
      },
      professorInfo: {
        name: String(
          firstDefined(
            mergedRecord.professorInfo?.name,
            mergedRecord.professorName,
            mergedRecord.instructorName,
            instructor,
            'TBA',
          ),
        ),
        email: String(
          firstDefined(
            mergedRecord.professorInfo?.email,
            mergedRecord.instructorEmail,
            mergedRecord.professorEmail,
            'N/A',
          ),
        ),
        office: String(
          firstDefined(mergedRecord.professorInfo?.office, mergedRecord.office, mergedRecord.officeRoom, 'N/A'),
        ),
        officeHours: String(
          firstDefined(
            mergedRecord.professorInfo?.officeHours,
            mergedRecord.officeHours,
            mergedRecord.instructorOfficeHours,
            'TBA',
          ),
        ),
      },
      capacity: {
        enrolled: toNumber(
          firstDefined(mergedRecord.capacity?.enrolled, mergedRecord.enrolled, mergedRecord.enrolledCount),
          0,
        ),
        max: toNumber(
          firstDefined(
            mergedRecord.capacity?.max,
            mergedRecord.capacity?.maximum,
            mergedRecord.maxEnrollment,
            mergedRecord.capacityLimit,
          ),
          0,
        ),
      },
      schedule: normalizedSchedule,
    }
  })

  return {
    id: String(firstDefined(studentProfile.id, studentProfile.studentId, studentProfile.sid, 'current-student')),
    fullName: String(firstDefined(studentProfile.fullName, studentProfile.name, fullNameFromParts, 'Current Student')),
    email: String(firstDefined(studentProfile.email, studentProfile.schoolEmail, '')),
    program: String(firstDefined(studentProfile.program, studentProfile.major, '')),
    term: String(firstDefined(studentProfile.term, classesData?.term, scheduleData?.term, 'Current Term')),
    gpa: toNumber(firstDefined(studentProfile.gpa, classesData?.gpa, scheduleData?.gpa), 0),
    courses,
  }
}

const API_BASE_URL_ENV_KEY = 'VITE_STUDENT_API_BASE_URL'

function getApiBaseUrl() {
  const rawBaseUrl = import.meta.env[API_BASE_URL_ENV_KEY]

  if (!rawBaseUrl) {
    throw new Error(
      `Missing required environment variable: ${API_BASE_URL_ENV_KEY}. ` +
        `Set it to your API host, for example "https://example.com".`,
    )
  }

  const trimmedBaseUrl = rawBaseUrl.trim()
  if (trimmedBaseUrl.startsWith('/')) {
    return trimmedBaseUrl.endsWith('/') ? trimmedBaseUrl.slice(0, -1) : trimmedBaseUrl
  }

  const normalizedBaseUrl = /^https?:\/\//i.test(trimmedBaseUrl)
    ? trimmedBaseUrl
    : `https://${trimmedBaseUrl}`

  return normalizedBaseUrl.endsWith('/')
    ? normalizedBaseUrl.slice(0, -1)
    : normalizedBaseUrl
}

function buildApiUrl(path, queryParams = {}) {
  const baseUrl = getApiBaseUrl()
  const url = baseUrl.startsWith('/')
    ? new URL(`${baseUrl}${path}`, window.location.origin)
    : new URL(`${baseUrl}${path}`)

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  return url
}

async function fetchJson(path, queryParams = {}) {
  const url = buildApiUrl(path, queryParams)
  const urlString = url.toString()

  let response
  try {
    response = await fetch(urlString)
  } catch (error) {
    throw new Error(`Failed to connect to ${urlString}: ${error.message}`)
  }

  if (!response.ok) {
    throw new Error(
      `Failed to connect to ${urlString}: HTTP ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

export async function getCurrentStudentClasses() {
  return fetchJson('/students/current/classes')
}

export async function getCurrentStudentSchedule() {
  return fetchJson('/students/current/schedule')
}

export async function getClasses(departmentId) {
  return fetchJson('/classes', { departmentId })
}

export async function getClassById(classId) {
  if (!classId) {
    throw new Error('classId is required for GET /classes/{classId}')
  }

  return fetchJson(`/classes/${classId}`)
}

function extractClassId(classDetailsList) {
  if (!Array.isArray(classDetailsList) || classDetailsList.length === 0) {
    return null
  }

  const firstClass = classDetailsList[0]
  return firstClass?.classId ?? firstClass?.id ?? null
}

async function pingEndpoint(endpointLabel, requestFn) {
  try {
    const response = await requestFn()
    console.info(`[API ping success] ${endpointLabel}`, response)
    return response
  } catch (error) {
    console.error(`[API ping failed] ${endpointLabel}`, error)
    throw error
  }
}

export async function verifyStudentApiConnections() {
  const [allClasses, departmentClasses] = await Promise.all([
    pingEndpoint('GET /classes', () => getClasses()),
    pingEndpoint('GET /classes?departmentId=CSCE', () => getClasses('CSCE')),
    pingEndpoint('GET /students/current/classes', () => getCurrentStudentClasses()),
    pingEndpoint('GET /students/current/schedule', () => getCurrentStudentSchedule()),
  ])

  const classId = extractClassId(departmentClasses) ?? extractClassId(allClasses)

  if (!classId) {
    throw new Error(
      'Failed to connect to GET /classes/{classId}: could not determine a valid classId from GET /classes.',
    )
  }

  await pingEndpoint(`GET /classes/${classId}`, () => getClassById(classId))
}
