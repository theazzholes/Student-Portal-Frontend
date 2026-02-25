import { MOCK_STUDENT } from '../data/mockData'

export function getStudentDashboard() {
  if (typeof structuredClone === 'function') {
    return structuredClone(MOCK_STUDENT)
  }

  return JSON.parse(JSON.stringify(MOCK_STUDENT))
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
