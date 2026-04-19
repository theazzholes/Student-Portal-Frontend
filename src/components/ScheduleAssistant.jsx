import React, { useEffect, useMemo, useRef, useState } from 'react'
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

// ── Mii Agent ─────────────────────────────────────────────────────────────────
const MII_STYLES = `
  @keyframes miifloat {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-6px); }
  }
  @keyframes miiwave {
    from { transform: rotate(-20deg); }
    to   { transform: rotate(-55deg); }
  }
  @keyframes miiblink {
    0%,90%,100% { opacity:1; }
    95%          { opacity:0; }
  }
  @keyframes miipulse {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.06); }
  }
  .mii-float   { animation: miifloat 3s ease-in-out infinite; }
  .mii-arm-r   { transform-origin: top center; animation: none; transition: transform 0.3s ease; }
  .mii-waving .mii-arm-r { animation: miiwave 0.45s ease-in-out infinite alternate; }
  .mii-head    { transition: transform 0.3s ease; }
  .mii-badge   { animation: miipulse 2s ease-in-out infinite; }
  .mii-status-dot { animation: miiblink 3s infinite; }
`

const MII_HEAD_SRC = "data:image/png;base64,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"

function MiiAvatarSmall({ isTyping = false }) {
  return (
    <div className="relative flex-shrink-0 w-8 h-8">
      <div
        style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg,#0288d1 0%,#29b6f6 100%)',
          borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 2px 8px rgba(2,136,209,0.25)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <img src={MII_HEAD_SRC} alt="Mii" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {isTyping && (
        <span
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 10, height: 10,
            background: '#22c55e',
            borderRadius: '50%',
            border: '1.5px solid #fff',
          }}
        />
      )}
    </div>
  )
}

function MiiAvatarFull({ isTyping = false, onWave }) {
  const [isWaving, setIsWaving] = React.useState(false)
  const containerRef = React.useRef(null)
  const headRef = React.useRef(null)

  const handleClick = () => {
    if (isWaving) return
    setIsWaving(true)
    onWave?.()
    setTimeout(() => setIsWaving(false), 1800)
  }

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const head = headRef.current
    const handleMove = (e) => {
      if (!head) return
      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / window.innerWidth
      const dy = (e.clientY - cy) / window.innerHeight
      head.style.transform = `translateX(-50%) perspective(400px) rotateX(${-dy * 12}deg) rotateY(${dx * 12}deg)`
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <>
      <style>{MII_STYLES}</style>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={isWaving ? 'mii-waving' : ''}
        style={{ position: 'relative', width: 160, height: 210, cursor: 'pointer', flexShrink: 0 }}
      >
        {/* Float wrapper */}
        <div className="mii-float" style={{ position: 'absolute', inset: 0 }}>
          {/* AI badge */}
          <div
            className="mii-badge"
            style={{
              position: 'absolute', top: 58, right: 16, zIndex: 6,
              background: 'linear-gradient(135deg,#00bcd4,#26c6da)',
              color: 'white', padding: '3px 8px', borderRadius: 12,
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              boxShadow: '0 3px 10px rgba(0,188,212,0.35)',
            }}
          >
            AI
          </div>

          {/* Head */}
          <div
            ref={headRef}
            className="mii-head"
            style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translateX(-50%)',
              width: 80, height: 80, zIndex: 5,
            }}
          >
            <img
              src={MII_HEAD_SRC}
              alt="Mii assistant"
              style={{
                width: '100%', height: '100%',
                borderRadius: '50%', objectFit: 'cover',
                border: '3px solid white',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                background: 'linear-gradient(135deg,#0288d1,#29b6f6)',
              }}
            />
          </div>

          {/* Body */}
          <div style={{
            position: 'absolute', top: 65, left: '50%', transform: 'translateX(-50%)',
            width: 60, height: 72,
            background: 'linear-gradient(180deg,#4fc3f7 0%,#29b6f6 50%,#0288d1 100%)',
            borderRadius: '50% 50% 45% 45% / 60% 60% 40% 40%',
            boxShadow: '0 6px 18px rgba(2,136,209,0.18),inset 0 -6px 12px rgba(0,0,0,0.05),inset 0 6px 12px rgba(255,255,255,0.25)',
            zIndex: 4,
          }} />

          {/* Arm left */}
          <div style={{
            position: 'absolute', top: 73, left: 24,
            width: 18, height: 48,
            background: 'linear-gradient(180deg,#4fc3f7,#29b6f6)',
            borderRadius: '50%', zIndex: 3,
            transform: 'rotate(15deg)', transformOrigin: 'top center',
          }}>
            <div style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              width: 22, height: 22,
              background: 'linear-gradient(135deg,#81d4fa,#4fc3f7)',
              borderRadius: '50%',
            }} />
          </div>

          {/* Arm right – animated on wave */}
          <div
            className="mii-arm-r"
            style={{
              position: 'absolute', top: 73, right: 24,
              width: 18, height: 48,
              background: 'linear-gradient(180deg,#4fc3f7,#29b6f6)',
              borderRadius: '50%', zIndex: 3,
              transform: 'rotate(-15deg)',
            }}
          >
            <div style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              width: 22, height: 22,
              background: 'linear-gradient(135deg,#81d4fa,#4fc3f7)',
              borderRadius: '50%',
            }} />
          </div>

          {/* Leg left */}
          <div style={{
            position: 'absolute', top: 128, left: 52,
            width: 20, height: 36,
            background: 'linear-gradient(180deg,#0277bd,#01579b)',
            borderRadius: '50%', zIndex: 3, transform: 'rotate(-5deg)',
          }}>
            <div style={{
              position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 16,
              background: 'linear-gradient(135deg,#01579b,#0277bd)',
              borderRadius: '50%',
            }} />
          </div>

          {/* Leg right */}
          <div style={{
            position: 'absolute', top: 128, right: 52,
            width: 20, height: 36,
            background: 'linear-gradient(180deg,#0277bd,#01579b)',
            borderRadius: '50%', zIndex: 3, transform: 'rotate(5deg)',
          }}>
            <div style={{
              position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 16,
              background: 'linear-gradient(135deg,#01579b,#0277bd)',
              borderRadius: '50%',
            }} />
          </div>

          {/* Shadow under feet */}
          <div style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            width: 80, height: 14,
            background: 'radial-gradient(ellipse,rgba(0,0,0,0.1) 0%,transparent 70%)',
            borderRadius: '50%',
          }} />
        </div>

        {/* Status dot */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(255,255,255,0.88)',
          padding: '3px 10px', borderRadius: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          whiteSpace: 'nowrap',
        }}>
          <span
            className="mii-status-dot"
            style={{ width: 7, height: 7, background: isTyping ? '#f59e0b' : '#4caf50', borderRadius: '50%', display: 'inline-block' }}
          />
          <span style={{ fontSize: 10, color: '#546e7a', fontWeight: 500 }}>
            {isTyping ? 'Thinking…' : 'Ready'}
          </span>
        </div>
      </div>
    </>
  )
}

// ── End Mii Agent ──────────────────────────────────────────────────────────────

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
    <article className={`flex items-end gap-2 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {item.role === 'assistant' && <MiiAvatarSmall />}
      <div
        className={`max-w-[88%] rounded-2xl border px-4 py-3 shadow-sm md:max-w-[82%] ${
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
          {/* Mii avatar + title row */}
          <div className="flex flex-wrap items-end gap-5">
            <MiiAvatarFull isTyping={isSubmitting} onWave={() => {}} />
            <div className="flex-1 min-w-0">
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
            </div>
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
              <div className="flex items-end gap-2 justify-start">
                <MiiAvatarSmall isTyping={true} />
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex gap-1">
                      <span style={{ animation: 'miifloat 1s ease-in-out infinite', display: 'inline-block', fontSize: 16 }}>•</span>
                      <span style={{ animation: 'miifloat 1s ease-in-out 0.2s infinite', display: 'inline-block', fontSize: 16 }}>•</span>
                      <span style={{ animation: 'miifloat 1s ease-in-out 0.4s infinite', display: 'inline-block', fontSize: 16 }}>•</span>
                    </span>
                    <span>{getSubmitModeLabel(submitMode)}</span>
                  </span>
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
