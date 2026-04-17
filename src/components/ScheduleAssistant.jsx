import { useEffect, useMemo, useRef, useState } from 'react'
import WeeklyCalendar from './WeeklyCalendar'
import {
  acceptScheduleOption,
  clearSchedulePreferences,
  generateScheduleOptions,
  requestScheduleAlternatives,
  saveSchedulePreferences,
} from '../services/studentRepository'

const DEFAULT_OPTION_COUNT = 3
const INITIAL_ASSISTANT_THREAD = [
  {
    id: 'assistant-intro',
    role: 'assistant',
    text: 'Describe your schedule preferences. I will save them first, then generate schedule options when you ask.',
    source: 'Scheduling Assistant',
    mode: 'request',
    didGenerate: false,
    requestId: null,
    interpretedPreferences: null,
    generatedSchedule: null,
    classSuggestions: [],
  },
]
const INITIAL_SCHEDULE_CONTEXT = {
  requestId: null,
  generatedSchedule: null,
  latestOptions: [],
  interpretedPreferences: null,
  classSuggestions: [],
  acceptedOptionId: null,
}
const ALTERNATIVE_FOLLOWUP_PATTERNS = [
  /^any others\??$/i,
  /^show me more\??$/i,
  /^got any alternatives\??$/i,
  /^i do(?:\s*not|n't) like (?:these|those)\??$/i,
  /^try again\??$/i,
  /^different options\??$/i,
  /^another one\??$/i,
  /^more options\??$/i,
]
const MODIFICATION_FOLLOWUP_PATTERNS = [
  /\badd\s+\d+\s+more\s+classes?\b/i,
  /\bmake it earlier\b/i,
  /\bavoid mornings?\b/i,
  /\bno classes before\b/i,
  /\bkeep\b.+\bbut change the rest\b/i,
  /\bswap out\b.+\belective\b/i,
]
const GENERATION_INTENT_PATTERNS = [
  /\bshow me schedules?\b/i,
  /\bgenerate (?:my )?(?:schedule|schedules|options?)\b/i,
  /\bbuild (?:my )?schedule\b/i,
  /\bwhat schedules? can you make\b/i,
  /\bshow me (?:some )?options\b/i,
  /\bcreate (?:my )?schedule\b/i,
  /\bi(?:'d| would) like to see schedules?\b/i,
]
const RESET_PREFERENCE_PATTERNS = [
  /\bstart over\b/i,
  /\bignore that\b/i,
  /\bnew plan\b/i,
  /\breset\b/i,
  /\bforget (?:that|everything)\b/i,
]
const MERGE_PREFERENCE_PATTERNS = [
  /^(?:and\s+)?also\b/i,
  /\bas well\b/i,
  /\btoo\b/i,
  /\badd\b/i,
  /\bkeep\b/i,
  /^make it\b/i,
]

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
    return String(time)
  }

  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 === 0 ? 12 : hours % 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${meridiem}`
}

function formatMeetingSchedule(meetingSchedule) {
  if (typeof meetingSchedule === 'string' && meetingSchedule.trim()) {
    return meetingSchedule
  }

  if (!Array.isArray(meetingSchedule) || meetingSchedule.length === 0) {
    return 'TBA'
  }

  return meetingSchedule
    .map((slot) => {
      const day = firstDefined(slot.day, slot.days, 'TBA')
      const timeRange =
        slot.startTime && slot.endTime ? `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}` : 'TBA'
      const location = slot.location ? ` @ ${slot.location}` : ''
      return `${day} ${timeRange}${location}`
    })
    .join(' | ')
}

const DAY_ALIASES = {
  monday: 'Mon',
  mon: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  tues: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  thur: 'Thu',
  thurs: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
}

function normalizeDayToken(day) {
  const normalized = String(day ?? '')
    .trim()
    .toLowerCase()

  return DAY_ALIASES[normalized] ?? null
}

function normalizeDayList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeDayToken).filter(Boolean)
  }

  const raw = String(value ?? '').trim()
  if (!raw) {
    return []
  }

  return raw
    .split(/[,/&]+|\s+/)
    .map(normalizeDayToken)
    .filter(Boolean)
}

function normalizeTimeValue(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return null
  }

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    return raw
  }

   if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    return raw.slice(0, 5)
  }

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) {
    return null
  }

  let hours = Number(match[1])
  const minutes = Number(match[2] ?? '00')
  const meridiem = match[3].toUpperCase()

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12
  }

  if (meridiem === 'AM' && hours === 12) {
    hours = 0
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseMeetingScheduleString(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return []
  }

  const parts = raw.split('|').map((part) => part.trim()).filter(Boolean)
  const expandedParts = parts.length > 0 ? parts : [raw]

  return expandedParts.flatMap((part) => {
    const normalizedPart = part.replace(/\s+/g, ' ').trim()
    const match = normalizedPart.match(
      /^([A-Za-z,\s/&]+?)\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)(?:\s*@\s*(.+))?$/i,
    )

    if (!match) {
      return []
    }

    const [, daysRaw, startRaw, endRaw, location] = match
    const days = normalizeDayList(daysRaw)
    const startTime = normalizeTimeValue(startRaw)
    const endTime = normalizeTimeValue(endRaw)

    if (days.length === 0 || !startTime || !endTime) {
      return []
    }

    return days.map((day) => ({
      day,
      startTime,
      endTime,
      location: location?.trim() || 'TBA',
    }))
  })
}

function normalizeMeetingSlot(slot) {
  if (!slot || typeof slot !== 'object') {
    return []
  }

  const startTime = normalizeTimeValue(firstDefined(slot.startTime, slot.start, slot.beginTime, slot.meetingStartTime))
  const endTime = normalizeTimeValue(firstDefined(slot.endTime, slot.end, slot.finishTime, slot.meetingEndTime))
  const location = firstDefined(slot.location, slot.room, slot.building, 'TBA')
  const days = normalizeDayList(firstDefined(slot.day, slot.days, slot.dayOfWeek, slot.dayCode))

  if (days.length > 0 && startTime && endTime) {
    return days.map((day) => ({
      day,
      startTime,
      endTime,
      location,
    }))
  }

  const textCandidate = firstDefined(slot.display, slot.label, slot.meetingSchedule, slot.text)
  return parseMeetingScheduleString(textCandidate)
}

function normalizeMeetingSchedule(value) {
  if (typeof value === 'string') {
    return parseMeetingScheduleString(value)
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((slot) => normalizeMeetingSlot(slot))
}

function toBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value > 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['true', 'yes', 'y', '1', 'waitlisted'].includes(normalized)
  }

  return false
}

function toPreferenceEntries(preferences) {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return []
  }

  return Object.entries(preferences).filter(([, value]) => {
    if (value === undefined || value === null) {
      return false
    }

    if (Array.isArray(value)) {
      return value.length > 0
    }

    if (typeof value === 'string') {
      return value.trim() !== ''
    }

    return true
  })
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatPreferenceValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => formatPreferenceValue(entry)).join(', ')
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

   if (isPlainObject(value)) {
    return Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== undefined && nestedValue !== null && nestedValue !== '')
      .map(([nestedKey, nestedValue]) => `${toLabel(nestedKey)}: ${formatPreferenceValue(nestedValue)}`)
      .join(' | ')
  }

  return String(value)
}

function toLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getOptionClassEntries(option) {
  const candidates = [
    option?.entries,
    option?.classes,
    option?.classEntries,
    option?.courses,
    option?.sections,
    option?.schedule,
  ]

  return candidates.find((value) => Array.isArray(value)) ?? []
}

function getAcceptedOptionId(source = {}) {
  return firstDefined(
    source?.acceptedScheduleOptionId,
    source?.acceptedOptionId,
    source?.selectedScheduleOptionId,
    source?.selectedOptionId,
    source?.scheduleOptionId,
    source?.acceptedScheduleOption?.id,
    source?.acceptedScheduleOption?.optionId,
    null,
  )
}

function isRequestAccepted(source = {}) {
  const status = String(firstDefined(source?.status, source?.requestStatus, source?.state, '')).trim().toLowerCase()

  if (status.includes('accept') || status.includes('enroll') || status.includes('confirm')) {
    return true
  }

  return Boolean(getAcceptedOptionId(source))
}

function normalizeClassEntry(entry, index) {
  const rawMeetingSchedule =
    firstDefined(
      entry.meetingSchedule,
      entry.schedule,
      entry.meetings,
      entry.meetingTimes,
      entry.timeslots,
      entry.daysTimes,
      entry.daysAndTimes,
      entry.meetingPattern,
    ) ?? []
  const meetingSchedule = normalizeMeetingSchedule(rawMeetingSchedule)
  const meetingScheduleText =
    typeof rawMeetingSchedule === 'string' && rawMeetingSchedule.trim()
      ? rawMeetingSchedule
      : formatMeetingSchedule(meetingSchedule)

  return {
    id: firstDefined(entry.classId, entry.sectionId, entry.code, `class-${index + 1}`),
    code: firstDefined(entry.code, entry.courseCode, entry.subjectCode, `Course ${index + 1}`),
    title: firstDefined(entry.title, entry.className, entry.courseTitle, 'Untitled Class'),
    instructorName: firstDefined(entry.instructorName, entry.instructor, entry.professorName, 'TBA'),
    credits: firstDefined(entry.credits, entry.creditHours, 'TBA'),
    enrollmentStatusProjection: firstDefined(
      entry.enrollmentStatusProjection,
      entry.projectedEnrollmentStatus,
      entry.enrollmentProjection,
      entry.status,
      'Unknown',
    ),
    meetingSchedule,
    meetingScheduleText,
    rawEntry: entry,
  }
}

function normalizeOptions(response, acceptedOptionId = null) {
  const generatedSchedule = response?.generatedSchedule ?? response ?? {}
  const rawOptions = Array.isArray(generatedSchedule.options) ? generatedSchedule.options : []

  return rawOptions.map((option, index) => {
    const classEntries = getOptionClassEntries(option).map(normalizeClassEntry)
    const includesWaitlistedSections = toBooleanFlag(
      firstDefined(
        option.includesWaitlistedSections,
        option.hasWaitlistedSections,
        option.containsWaitlistedSections,
        classEntries.some((entry) => String(entry.enrollmentStatusProjection).toLowerCase().includes('waitlist')),
      ),
    )

    return {
      optionId: firstDefined(option.optionId, option.id, option.optionKey, `option-${index + 1}`),
      rank: firstDefined(option.rank, option.optionNumber, index + 1),
      totalCredits: firstDefined(option.totalCredits, option.creditTotal, option.credits, 'TBA'),
      summary: firstDefined(option.summary, option.description, option.rationale, 'Schedule option generated by the assistant.'),
      includesWaitlistedSections,
      isAccepted:
        toBooleanFlag(firstDefined(option.isAccepted, option.accepted, option.isSelected, false)) ||
        firstDefined(option.optionId, option.id, option.optionKey, null) === acceptedOptionId,
      classes: classEntries,
      rawOption: option,
    }
  })
}

function normalizeSourceLabel(source) {
  const normalized = String(source ?? '').trim()
  if (!normalized) {
    return 'Scheduling Assistant'
  }

  if (normalized === 'backend-orchestration') {
    return 'Scheduling Assistant'
  }

  if (normalized === 'backend-generation') {
    return 'Schedule Generator'
  }

  return toLabel(normalized)
}

function hasGeneratedSchedule(response) {
  return Boolean(response?.didGenerate) && Boolean(response?.generatedSchedule)
}

function getSuggestionCandidates(response = {}) {
  const generatedScheduleOptions = response?.generatedSchedule?.options
  const candidates = [
    response?.classSuggestions,
    response?.catalogSuggestions,
    response?.suggestedClasses,
    response?.recommendedClasses,
    response?.recommendations,
    response?.suggestions,
    response?.classes,
  ]

  return candidates.find((value) => Array.isArray(value) && value !== generatedScheduleOptions) ?? []
}

function normalizeSuggestion(suggestion, index) {
  return {
    suggestionId: firstDefined(
      suggestion?.classId,
      suggestion?.courseId,
      suggestion?.sectionId,
      suggestion?.id,
      `suggestion-${index + 1}`,
    ),
    code: firstDefined(suggestion?.code, suggestion?.courseCode, suggestion?.subjectCode, 'TBA'),
    title: firstDefined(suggestion?.title, suggestion?.className, suggestion?.courseTitle, 'Untitled Class'),
    credits: firstDefined(suggestion?.credits, suggestion?.creditHours, 'TBA'),
    department: firstDefined(
      suggestion?.department,
      suggestion?.departmentCode,
      suggestion?.departmentName,
      suggestion?.subject,
      'General',
    ),
    rationale: firstDefined(
      suggestion?.rationale,
      suggestion?.reason,
      suggestion?.whySuggested,
      suggestion?.summary,
      suggestion?.description,
      null,
    ),
    rawSuggestion: suggestion,
  }
}

function normalizeSuggestions(response) {
  return getSuggestionCandidates(response).map(normalizeSuggestion)
}

function hasSuggestions(response) {
  return normalizeSuggestions(response).length > 0
}

function getOutcomeMode(response) {
  if (hasGeneratedSchedule(response)) {
    return 'generate'
  }

  if (hasSuggestions(response)) {
    return 'suggestions'
  }

  return 'preferences'
}

function isSystemPreferenceKey(key) {
  const normalized = String(key ?? '').trim().toLowerCase()
  return ['id', 'prompt', 'updatedatutc', 'updatedat', 'createdatutc', 'createdat'].includes(normalized)
}

function toPreferenceSections(preferences, sectionLabel = null) {
  if (!isPlainObject(preferences)) {
    return []
  }

  const rows = []
  const sections = []

  for (const [key, value] of Object.entries(preferences)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (isSystemPreferenceKey(key)) {
      continue
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue
      }

      if (value.every((entry) => !isPlainObject(entry))) {
        rows.push({
          key,
          label: toLabel(key),
          value: value.map((entry) => formatPreferenceValue(entry)).join(', '),
        })
        continue
      }

      sections.push({
        key,
        label: toLabel(key),
        items: value.map((entry, index) => ({
          label: `${toLabel(key)} ${index + 1}`,
          rows: toPreferenceSections(entry).flatMap((section) => section.rows),
        })),
      })
      continue
    }

    if (isPlainObject(value)) {
      sections.push({
        key,
        label: toLabel(key),
        items: [
          {
            label: toLabel(key),
            rows: toPreferenceSections(value).flatMap((section) => section.rows),
          },
        ],
      })
      continue
    }

    rows.push({
      key,
      label: toLabel(key),
      value: formatPreferenceValue(value),
    })
  }

  return [
    {
      label: sectionLabel,
      rows,
      nestedSections: sections.filter((section) => section.items.some((item) => item.rows.length > 0)),
    },
  ]
}

function toCalendarCourses(option) {
  return option.classes.map((entry) => ({
    id: `${option.optionId}-${entry.id}`,
    courseCode: entry.code,
    className: entry.title,
    instructor: entry.instructorName,
    schedule: Array.isArray(entry.meetingSchedule) ? entry.meetingSchedule : [],
  }))
}

function buildAssistantThreadItem(response, sequence) {
  const mergedPreferences =
    response?.mergedInterpretedPreferences && isPlainObject(response.mergedInterpretedPreferences)
      ? response.mergedInterpretedPreferences
      : response?.interpretedPreferences ?? null
  const generatedSchedule = hasGeneratedSchedule(response) ? response.generatedSchedule : null
  const suggestions = normalizeSuggestions(response)
  const outcomeMode = getOutcomeMode(response)
  const requestId = firstDefined(response?.requestId, generatedSchedule?.requestId, generatedSchedule?.id, null)
  const acceptedOptionId = getAcceptedOptionId(response) ?? getAcceptedOptionId(generatedSchedule)
  const normalizedOptions = generatedSchedule ? normalizeOptions(response, acceptedOptionId) : []

  return {
    id: `assistant-${sequence}`,
    role: 'assistant',
    text: firstDefined(
      response?.message,
      generatedSchedule
        ? 'Here are the best schedule options I found.'
        : suggestions.length > 0
          ? 'Here are some catalog-backed class suggestions that match your preferences.'
        : "Preferences saved. Generate schedules when you're ready.",
    ),
    source: normalizeSourceLabel(firstDefined(response?.source, response?.generatedSchedule?.source, 'Scheduling Assistant')),
    mode: firstDefined(response?.mode, outcomeMode),
    outcomeMode,
    didGenerate: Boolean(response?.didGenerate) && Boolean(generatedSchedule),
    didSuggest: suggestions.length > 0,
    requestId,
    acceptedOptionId,
    accepted: isRequestAccepted(response) || isRequestAccepted(generatedSchedule),
    interpretedPreferences: mergedPreferences,
    classSuggestions: suggestions,
    generatedSchedule: generatedSchedule
      ? {
          requestId,
          options: normalizedOptions,
          raw: generatedSchedule,
        }
      : null,
  }
}

function toAcceptSuccessMessage(response, option) {
  return firstDefined(
    response?.message,
    response?.title,
    response?.detail,
    `You are enrolled in Option ${option.rank}.`,
  )
}

function isAlternativeFollowupMessage(message) {
  const normalized = String(message ?? '').trim()
  if (!normalized) {
    return false
  }

  if (ALTERNATIVE_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  const lower = normalized.toLowerCase()
  return (
    normalized.split(/\s+/).length <= 6 &&
    (lower.includes('alternative') ||
      lower.includes('another') ||
      lower.includes('others') ||
      lower.includes('more options') ||
      lower.includes('different options'))
  )
}

function isModificationFollowupMessage(message) {
  const normalized = String(message ?? '').trim()
  if (!normalized) {
    return false
  }

  return MODIFICATION_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isExplicitGenerationMessage(message) {
  const normalized = String(message ?? '').trim()
  if (!normalized) {
    return false
  }

  return GENERATION_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
}

function getSubmitModeLabel(mode) {
  if (mode === 'alternatives') {
    return 'Finding alternatives...'
  }

  if (mode === 'generate') {
    return 'Generating schedule options...'
  }

  return 'Saving preferences...'
}

function isResetPreferenceMessage(message) {
  const normalized = String(message ?? '').trim()
  if (!normalized) {
    return false
  }

  return RESET_PREFERENCE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isMergePreferenceMessage(message) {
  const normalized = String(message ?? '').trim()
  if (!normalized) {
    return false
  }

  return MERGE_PREFERENCE_PATTERNS.some((pattern) => pattern.test(normalized)) || normalized.split(/\s+/).length <= 8
}

function mergePreferenceValues(previousValue, nextValue) {
  if (nextValue === undefined || nextValue === null || nextValue === '') {
    return previousValue
  }

  if (Array.isArray(nextValue)) {
    const previousList = Array.isArray(previousValue) ? previousValue : []
    const mergedList = [...previousList]

    nextValue.forEach((entry) => {
      const serializedEntry = JSON.stringify(entry)
      if (!mergedList.some((existingEntry) => JSON.stringify(existingEntry) === serializedEntry)) {
        mergedList.push(entry)
      }
    })

    return mergedList
  }

  if (isPlainObject(nextValue)) {
    const previousObject = isPlainObject(previousValue) ? previousValue : {}
    return mergePreferenceObjects(previousObject, nextValue)
  }

  return nextValue
}

function mergePreferenceObjects(previousPreferences, nextPreferences) {
  const base = isPlainObject(previousPreferences) ? previousPreferences : {}
  const incoming = isPlainObject(nextPreferences) ? nextPreferences : {}
  const merged = { ...base }

  Object.entries(incoming).forEach(([key, value]) => {
    merged[key] = mergePreferenceValues(base[key], value)
  })

  return merged
}

function resolveInterpretedPreferences({
  previousPreferences,
  nextPreferences,
  message,
  shouldReset,
}) {
  if (!isPlainObject(nextPreferences)) {
    return shouldReset ? null : previousPreferences
  }

  if (shouldReset || !isPlainObject(previousPreferences)) {
    return nextPreferences
  }

  if (isMergePreferenceMessage(message)) {
    return mergePreferenceObjects(previousPreferences, nextPreferences)
  }

  return mergePreferenceObjects(previousPreferences, nextPreferences)
}

function PreferenceSection({ section }) {
  if (!section || (section.rows.length === 0 && section.nestedSections.length === 0)) {
    return null
  }

  return (
    <div className="space-y-3">
      {section.label && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>}

      {section.rows.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {section.rows.map((row) => (
            <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
              <p className="mt-1 text-sm text-slate-700">{row.value}</p>
            </div>
          ))}
        </div>
      )}

      {section.nestedSections.map((nestedSection) => (
        <div key={nestedSection.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{nestedSection.label}</p>
          <div className="mt-3 space-y-3">
            {nestedSection.items.map((item, index) => (
              <div key={`${nestedSection.key}-${index}`} className="rounded-xl bg-slate-50 p-3">
                {nestedSection.items.length > 1 && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                )}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {item.rows.map((row) => (
                    <div key={`${nestedSection.key}-${row.key}-${index}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SuggestionCards({ suggestions, onGenerateSchedules, isGenerateDisabled }) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested Classes</p>
        <p className="text-xs text-slate-500">{suggestions.length} suggested</p>
      </div>

      <div className="grid gap-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.suggestionId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{suggestion.code}</p>
                <h4 className="mt-1 text-base font-semibold text-slate-900">{suggestion.title}</h4>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Credits</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{suggestion.credits}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                Department: {suggestion.department}
              </span>
            </div>

            {suggestion.rationale && (
              <div className="mt-3 rounded-xl bg-white px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why It Fits</p>
                <p className="mt-1 text-sm text-slate-700">{suggestion.rationale}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onGenerateSchedules()}
          disabled={isGenerateDisabled}
          className="rounded-xl border border-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
        >
          Generate Schedules
        </button>
      </div>
    </div>
  )
}

function MessageBubble({
  item,
  onSelectOption,
  onAcceptOption,
  onGenerateSchedules,
  selectedOptionId,
  acceptingOptionId,
  isGenerateDisabled,
}) {
  const preferenceEntries = toPreferenceEntries(item.interpretedPreferences)
  const preferenceSections = toPreferenceSections(item.interpretedPreferences)
  const suggestions = item.classSuggestions ?? []
  const options = item.generatedSchedule?.options ?? []
  const showPreferenceOnlyState =
    item.role === 'assistant' && !item.didGenerate && (preferenceEntries.length > 0 || item.id !== 'assistant-intro')
  const showSuggestions = item.role === 'assistant' && suggestions.length > 0
  const showGeneratedOptions = item.role === 'assistant' && item.didGenerate && item.generatedSchedule

  return (
    <article className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-4 py-3 shadow-sm md:max-w-[85%] ${
          item.role === 'user'
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-semibold uppercase tracking-wide ${item.role === 'user' ? 'text-slate-300' : 'text-slate-500'}`}>
            {item.role === 'user' ? 'You' : item.source ?? 'Assistant'}
          </p>
          {item.requestId && <span className={`text-[11px] ${item.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>Request ID: {item.requestId}</span>}
        </div>

        <p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${item.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
          {item.text}
        </p>

        {item.role === 'assistant' && preferenceEntries.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interpreted Preferences</p>
            <div className="mt-2 space-y-3">
              {preferenceSections.map((section, index) => (
                <PreferenceSection key={`${item.id}-prefs-${index}`} section={section} />
              ))}
            </div>
          </div>
        )}

        {showPreferenceOnlyState && !showSuggestions && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Preferences saved. Generate schedules when you&apos;re ready.
            </div>
            <button
              type="button"
              onClick={() => onGenerateSchedules()}
              disabled={isGenerateDisabled}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Generate Schedules
            </button>
          </div>
        )}

        {showSuggestions && (
          <SuggestionCards
            suggestions={suggestions}
            onGenerateSchedules={onGenerateSchedules}
            isGenerateDisabled={isGenerateDisabled}
          />
        )}

        {showGeneratedOptions && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule Options</p>
              <p className="text-xs text-slate-500">{options.length} returned</p>
            </div>

            {options.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                I generated schedules using your saved preferences, but could not find valid options yet. Try relaxing a constraint or ask for alternatives.
              </div>
            ) : (
              options.map((option) => {
                const isSelected = selectedOptionId === option.optionId
                const isAccepted = item.acceptedOptionId === option.optionId || option.isAccepted
                const isAccepting = acceptingOptionId === option.optionId

                return (
                  <div
                    key={option.optionId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectOption(item.requestId, option.optionId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectOption(item.requestId, option.optionId)
                      }
                    }}
                    className={`block w-full rounded-2xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          Option {option.rank}
                        </p>
                        <h4 className="mt-1 text-base font-semibold">{option.summary}</h4>
                      </div>
                      <div className={`rounded-xl px-3 py-2 text-right ${isSelected ? 'bg-slate-800' : 'bg-white'}`}>
                        <p className={`text-[11px] uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>Total Credits</p>
                        <p className="mt-1 text-sm font-semibold">{option.totalCredits}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full px-3 py-1 font-medium ${isSelected ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-700'}`}>
                        Option ID: {option.optionId}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${
                          option.includesWaitlistedSections
                            ? isSelected
                              ? 'bg-amber-400/20 text-amber-200'
                              : 'bg-amber-100 text-amber-800'
                            : isSelected
                              ? 'bg-emerald-400/20 text-emerald-200'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {option.includesWaitlistedSections ? 'Includes waitlisted sections' : 'No waitlisted sections'}
                      </span>
                      {isAccepted && (
                        <span
                          className={`rounded-full px-3 py-1 font-medium ${
                            isSelected ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Enrolled
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {option.classes.map((entry) => (
                        <div
                          key={`${option.optionId}-${entry.id}`}
                          className={`rounded-xl border p-3 ${
                            isSelected ? 'border-slate-700 bg-slate-800/90' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className={`text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                {entry.code}
                              </p>
                              <h5 className="mt-1 text-sm font-semibold">{entry.title}</h5>
                            </div>
                            <div className={`rounded-lg px-2.5 py-1 text-xs font-medium ${isSelected ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                              {entry.credits} credits
                            </div>
                          </div>

                          <dl className={`mt-3 grid gap-3 text-sm ${isSelected ? 'text-slate-200' : 'text-slate-700'} md:grid-cols-2`}>
                            <div>
                              <dt className={`text-xs uppercase tracking-wide ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Instructor</dt>
                              <dd className="mt-1">{entry.instructorName}</dd>
                            </div>
                            <div>
                              <dt className={`text-xs uppercase tracking-wide ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Projected Status</dt>
                              <dd className="mt-1">{entry.enrollmentStatusProjection}</dd>
                            </div>
                            <div className="md:col-span-2">
                              <dt className={`text-xs uppercase tracking-wide ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>Meeting Schedule</dt>
                              <dd className="mt-1">{entry.meetingScheduleText}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className={`text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        {isAccepted
                          ? 'This schedule has already been accepted.'
                          : 'Select this option to preview it, or enroll directly from here.'}
                      </p>
                      {isAccepted ? (
                        <button
                          type="button"
                          disabled
                          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                            isSelected ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          Enrolled
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onAcceptOption(item.requestId, option)
                          }}
                          disabled={isAccepting || !item.requestId}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            isSelected
                              ? 'bg-white text-slate-900 hover:bg-slate-100 disabled:bg-slate-300'
                              : 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400'
                          } disabled:cursor-not-allowed`}
                        >
                          {isAccepting ? 'Enrolling...' : 'Enroll in This Schedule'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function ScheduleAssistant({ currentCourses = [] }) {
  const [thread, setThread] = useState(INITIAL_ASSISTANT_THREAD)
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState('request')
  const [errorMessage, setErrorMessage] = useState('')
  const [resetFeedback, setResetFeedback] = useState(null)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [acceptFeedback, setAcceptFeedback] = useState(null)
  const [acceptingState, setAcceptingState] = useState({
    requestId: null,
    optionId: null,
  })
  const [selection, setSelection] = useState({
    requestId: null,
    optionId: null,
  })
  const [scheduleContext, setScheduleContext] = useState(INITIAL_SCHEDULE_CONTEXT)
  const threadEndRef = useRef(null)

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread, isSubmitting])

  const assistantResponses = useMemo(
    () =>
      thread.filter(
        (item) => item.role === 'assistant' && item.didGenerate && Array.isArray(item.generatedSchedule?.options),
      ),
    [thread],
  )

  const selectedResult = useMemo(() => {
    for (const item of assistantResponses) {
      if (item.requestId !== selection.requestId) {
        continue
      }

      const matchedOption = item.generatedSchedule.options.find((option) => option.optionId === selection.optionId)
      if (matchedOption) {
        return {
          requestId: item.requestId,
          option: matchedOption,
          interpretedPreferences: item.interpretedPreferences,
          accepted: item.accepted,
        }
      }
    }

    for (let index = assistantResponses.length - 1; index >= 0; index -= 1) {
      const item = assistantResponses[index]
      const fallbackOption = item.generatedSchedule.options[0]
      if (fallbackOption) {
        return {
          requestId: item.requestId,
          option: fallbackOption,
          interpretedPreferences: item.interpretedPreferences,
          accepted: item.accepted,
        }
      }
    }

    return null
  }, [assistantResponses, selection.optionId, selection.requestId])

  const selectedCalendarCourses = useMemo(
    () => (selectedResult?.option ? toCalendarCourses(selectedResult.option) : []),
    [selectedResult],
  )

  const resetLocalSchedulingState = () => {
    setThread(INITIAL_ASSISTANT_THREAD)
    setDraft('')
    setErrorMessage('')
    setAcceptFeedback(null)
    setResetFeedback(null)
    setSelection({
      requestId: null,
      optionId: null,
    })
    setAcceptingState({
      requestId: null,
      optionId: null,
    })
    setScheduleContext(INITIAL_SCHEDULE_CONTEXT)
    setSubmitMode('request')
    setIsConfirmingReset(false)
  }

  const activeRequestId = scheduleContext.requestId

  const updateScheduleContext = (assistantItem, fallbackRequestId = null, shouldReset = false) => {
    const nextRequestId = assistantItem.requestId ?? fallbackRequestId ?? scheduleContext.requestId
    const nextOptions = assistantItem.generatedSchedule?.options ?? []
    const hasOptions = nextOptions.length > 0

    setScheduleContext((current) => ({
      requestId: shouldReset ? assistantItem.requestId ?? null : nextRequestId,
      generatedSchedule: shouldReset ? assistantItem.generatedSchedule : assistantItem.generatedSchedule ?? current.generatedSchedule,
      latestOptions: shouldReset ? nextOptions : hasOptions ? nextOptions : current.latestOptions,
      interpretedPreferences: assistantItem.interpretedPreferences ?? current.interpretedPreferences,
      classSuggestions: shouldReset
        ? assistantItem.classSuggestions ?? []
        : assistantItem.classSuggestions?.length > 0
          ? assistantItem.classSuggestions
          : current.classSuggestions,
      acceptedOptionId: assistantItem.acceptedOptionId ?? current.acceptedOptionId,
    }))

    if (hasOptions) {
      setSelection({
        requestId: nextRequestId,
        optionId: nextOptions[0].optionId,
      })
    } else if (shouldReset) {
      setSelection({
        requestId: null,
        optionId: null,
      })
    }
  }

  const handleSelectOption = (requestId, optionId) => {
    setSelection({ requestId, optionId })
  }

  const handleAcceptOption = async (requestId, option) => {
    if (!requestId || !option?.optionId) {
      return
    }

    if (acceptingState.requestId === requestId && acceptingState.optionId === option.optionId) {
      return
    }

    setAcceptFeedback(null)
    setAcceptingState({
      requestId,
      optionId: option.optionId,
    })

    try {
      const response = await acceptScheduleOption(requestId, option.optionId)
      const acceptedOptionId = getAcceptedOptionId(response) ?? option.optionId
      const normalizedResponse = {
        ...response,
        didGenerate: true,
        requestId: firstDefined(response?.requestId, requestId),
        generatedSchedule:
          response?.generatedSchedule ??
          (Array.isArray(response?.options)
            ? {
                requestId,
                options: response.options,
              }
            : null),
      }

      setThread((current) =>
        current.map((item) => {
          if (item.role !== 'assistant' || item.requestId !== requestId) {
            return item
          }

          if (normalizedResponse.generatedSchedule) {
            const rebuilt = buildAssistantThreadItem(
              {
                ...normalizedResponse,
                generatedSchedule: {
                  ...(item.generatedSchedule.raw ?? {}),
                  ...(normalizedResponse.generatedSchedule ?? {}),
                  requestId,
                  options:
                    normalizedResponse.generatedSchedule.options ??
                    item.generatedSchedule.raw?.options ??
                    item.generatedSchedule.options.map((threadOption) => threadOption.rawOption),
                },
              },
              Date.now(),
            )

            return {
              ...item,
              text: rebuilt.text || item.text,
              source: rebuilt.source || item.source,
              didGenerate: true,
              acceptedOptionId: acceptedOptionId,
              accepted: true,
              generatedSchedule: rebuilt.generatedSchedule,
            }
          }

          return {
            ...item,
            acceptedOptionId,
            accepted: true,
            generatedSchedule: {
              ...item.generatedSchedule,
              options: item.generatedSchedule.options.map((threadOption) => ({
                ...threadOption,
                isAccepted: threadOption.optionId === acceptedOptionId,
              })),
            },
          }
        }),
      )

      setSelection({
        requestId,
        optionId: acceptedOptionId,
      })
      setScheduleContext((current) => ({
        ...current,
        requestId,
        acceptedOptionId,
        latestOptions: current.latestOptions.map((entry) => ({
          ...entry,
          isAccepted: entry.optionId === acceptedOptionId,
        })),
        generatedSchedule: current.generatedSchedule
          ? {
              ...current.generatedSchedule,
              options: current.generatedSchedule.options.map((entry) => ({
                ...entry,
                isAccepted: entry.optionId === acceptedOptionId,
              })),
            }
          : current.generatedSchedule,
      }))
      setAcceptFeedback({
        type: 'success',
        message: toAcceptSuccessMessage(response, option),
      })
    } catch (error) {
      setAcceptFeedback({
        type: 'error',
        message: error.message || 'Unable to enroll in this schedule.',
      })
    } finally {
      setAcceptingState({
        requestId: null,
        optionId: null,
      })
    }
  }

  const submitAssistantRequest = async (message, modeOverride = null) => {
    const useAlternatives =
      Boolean(activeRequestId) &&
      (modeOverride === 'alternatives' ||
        ((!modeOverride || modeOverride === 'auto') &&
          (isAlternativeFollowupMessage(message) || isModificationFollowupMessage(message))))
    const shouldGenerate =
      modeOverride === 'generate' || (!useAlternatives && (!modeOverride || modeOverride === 'auto') && isExplicitGenerationMessage(message))
    const submitModeValue = useAlternatives ? 'alternatives' : shouldGenerate ? 'generate' : 'request'

    setSubmitMode(submitModeValue)

    if (useAlternatives) {
      return {
        response: await requestScheduleAlternatives(activeRequestId, message, DEFAULT_OPTION_COUNT),
        submitModeValue,
      }
    }

    if (shouldGenerate) {
      return {
        response: await generateScheduleOptions(message, DEFAULT_OPTION_COUNT),
        submitModeValue,
      }
    }

    return {
      response: await saveSchedulePreferences(message, false),
      submitModeValue,
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const message = draft.trim()
    if (!message || isSubmitting || isResetting) {
      return
    }

    setErrorMessage('')
    setAcceptFeedback(null)
    setIsSubmitting(true)
    setDraft('')

    setThread((current) => [
      ...current,
      {
        id: `user-${current.length + 1}`,
        role: 'user',
        text: message,
      },
    ])

    try {
      const shouldResetPreferences = isResetPreferenceMessage(message)
      const { response, submitModeValue } = await submitAssistantRequest(message, 'auto')
      const mergedInterpretedPreferences = resolveInterpretedPreferences({
        previousPreferences: shouldResetPreferences ? null : scheduleContext.interpretedPreferences,
        nextPreferences: response?.interpretedPreferences ?? null,
        message,
        shouldReset: shouldResetPreferences,
      })

      const assistantItem = buildAssistantThreadItem(
        {
          ...response,
          mergedInterpretedPreferences,
        },
        Date.now(),
      )
      const effectiveRequestId = shouldResetPreferences
        ? assistantItem.requestId ?? null
        : assistantItem.requestId ?? activeRequestId ?? null

      setThread((current) => [...current, assistantItem])

      updateScheduleContext(
        {
          ...assistantItem,
          requestId: effectiveRequestId,
        },
        effectiveRequestId,
        shouldResetPreferences,
      )

      if ((assistantItem.generatedSchedule?.options.length ?? 0) === 0 && submitModeValue === 'alternatives') {
        setAcceptFeedback({
          type: 'error',
          message: 'No new alternatives were returned. Your current schedule options are still available above.',
        })
      }
    } catch (error) {
      setErrorMessage(error.message || 'The scheduling assistant request failed.')
    } finally {
      setIsSubmitting(false)
      setSubmitMode('request')
    }
  }

  const handleGenerateSchedules = async (message = '') => {
    if (isSubmitting || isResetting) {
      return
    }

    const normalizedMessage = String(message ?? '').trim()

    setErrorMessage('')
    setAcceptFeedback(null)
    setIsSubmitting(true)

    try {
      const { response } = await submitAssistantRequest(normalizedMessage, 'generate')
      const mergedInterpretedPreferences = resolveInterpretedPreferences({
        previousPreferences: scheduleContext.interpretedPreferences,
        nextPreferences: response?.interpretedPreferences ?? null,
        message: normalizedMessage,
        shouldReset: false,
      })
      const assistantItem = buildAssistantThreadItem(
        {
          ...response,
          mergedInterpretedPreferences,
        },
        Date.now(),
      )
      const effectiveRequestId = assistantItem.requestId ?? activeRequestId ?? null

      if (normalizedMessage) {
        setThread((current) => [
          ...current,
          {
            id: `user-${current.length + 1}`,
            role: 'user',
            text: normalizedMessage,
          },
          assistantItem,
        ])
      } else {
        setThread((current) => [...current, assistantItem])
      }

      updateScheduleContext(
        {
          ...assistantItem,
          requestId: effectiveRequestId,
        },
        effectiveRequestId,
      )
    } catch (error) {
      setErrorMessage(error.message || 'Unable to generate schedules.')
    } finally {
      setIsSubmitting(false)
      setSubmitMode('request')
      setDraft('')
    }
  }

  const handleResetSchedulingState = async () => {
    if (isResetting) {
      return
    }

    setResetFeedback(null)
    setErrorMessage('')
    setAcceptFeedback(null)
    setIsResetting(true)

    try {
      await clearSchedulePreferences()
      resetLocalSchedulingState()
      setResetFeedback({
        type: 'success',
        message: 'Scheduling preferences and generated schedule history were cleared.',
      })
    } catch (error) {
      setResetFeedback({
        type: 'error',
        message: error.message || 'Unable to clear scheduling preferences right now.',
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Scheduling Assistant</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">Plan schedules through chat</h3>
              <p className="mt-1 text-sm text-slate-600">
                Ask for morning-only classes, no Fridays, lighter credit loads, or alternatives around a required course.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Current Courses</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentCourses.length}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-600">
              Clear saved preferences and generated schedule history to start over with a clean scheduling conversation.
            </div>
            {isConfirmingReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Clear your saved scheduling state?</span>
                <button
                  type="button"
                  onClick={handleResetSchedulingState}
                  disabled={isResetting}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isResetting ? 'Clearing...' : 'Confirm Clear'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(false)}
                  disabled={isResetting}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResetFeedback(null)
                  setIsConfirmingReset(true)
                }}
                disabled={isResetting}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
              >
                Start Over
              </button>
            )}
          </div>
        </header>

        <div className="flex h-[36rem] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {thread.map((item) => (
              <MessageBubble
                key={item.id}
                item={item}
                onSelectOption={handleSelectOption}
                onAcceptOption={handleAcceptOption}
                onGenerateSchedules={handleGenerateSchedules}
                selectedOptionId={selection.optionId}
                acceptingOptionId={
                  acceptingState.requestId === item.requestId ? acceptingState.optionId : null
                }
                isGenerateDisabled={isSubmitting}
              />
            ))}

            {isSubmitting && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  {getSubmitModeLabel(submitMode)}
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {errorMessage}
              </div>
            )}

            {resetFeedback && (
              <div
                role={resetFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  resetFeedback.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {resetFeedback.message}
              </div>
            )}

            {acceptFeedback && (
              <div
                role={acceptFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  acceptFeedback.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {acceptFeedback.message}
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 px-5 py-4">
            <label htmlFor="schedule-chat-message" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Describe your scheduling preferences
            </label>
            {activeRequestId && (
              <p className="mt-1 text-xs text-slate-500">
                Active request: {activeRequestId}. Follow-up prompts like `any others?` or `avoid mornings` will ask
                for alternatives instead of starting over.
              </p>
            )}
            {!activeRequestId && scheduleContext.interpretedPreferences && (
              <p className="mt-1 text-xs text-slate-500">
                Preferences are saved. Ask explicitly for schedules or use the button below when you want options.
              </p>
            )}
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <textarea
                id="schedule-chat-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Example: I need 12 credits, no classes before 10 AM, and prefer to keep Fridays open."
                rows={3}
                className="min-h-28 flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="submit"
                disabled={isSubmitting || isResetting || draft.trim() === ''}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:self-end"
              >
                {isSubmitting ? 'Sending...' : activeRequestId ? 'Send Follow-Up' : 'Save Preferences'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleGenerateSchedules()}
                disabled={isSubmitting || isResetting}
                className="rounded-2xl border border-slate-900 px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
              >
                {isSubmitting && submitMode === 'generate' ? 'Generating...' : 'Generate Schedules'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Option</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {selectedResult?.option ? `Option ${selectedResult.option.rank}` : 'No option selected'}
              </h3>
            </div>
            {selectedResult?.requestId && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-600">
                Request ID: {selectedResult.requestId}
              </span>
            )}
          </div>

          {!selectedResult ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              {scheduleContext.interpretedPreferences
                ? "Preferences saved. Generate schedules when you're ready."
                : 'Save preferences first, then generate schedules to keep the selected requestId and optionId ready for follow-up actions.'}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Option ID</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedResult.option.optionId}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total Credits</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedResult.option.totalCredits}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Conversation State</p>
                <p className="mt-1 text-sm text-slate-700">
                  {selectedResult.requestId === activeRequestId
                    ? 'This option belongs to the active scheduling request.'
                    : 'Viewing an earlier scheduling response.'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Summary</p>
                <p className="mt-1 text-sm text-slate-700">{selectedResult.option.summary}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Enrollment Status</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedResult.option.isAccepted || selectedResult.accepted ? 'Enrolled' : 'Not yet accepted'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Next-step Metadata</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    requestId: {selectedResult.requestId}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    optionId: {selectedResult.option.optionId}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Suggestions</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {scheduleContext.classSuggestions.length > 0 ? `${scheduleContext.classSuggestions.length} class suggestions` : 'No suggestions yet'}
              </h3>
            </div>
          </div>

          {scheduleContext.classSuggestions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Ask for class ideas or catalog-backed suggestions to review possible courses before you generate schedules.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {scheduleContext.classSuggestions.map((suggestion) => (
                <div key={suggestion.suggestionId} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{suggestion.code}</p>
                      <h4 className="mt-1 text-sm font-semibold text-slate-900">{suggestion.title}</h4>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {suggestion.credits} credits
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-600">{suggestion.department}</p>
                  {suggestion.rationale && <p className="mt-2 text-sm text-slate-700">{suggestion.rationale}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Option Calendar</p>
          <div className="mt-4">
            <WeeklyCalendar
              courses={selectedCalendarCourses}
              title="Generated Schedule Preview"
              emptyMessage="Choose a generated schedule option to preview its class meetings on the calendar."
            />
          </div>
        </section>
      </aside>
    </section>
  )
}

export default ScheduleAssistant
