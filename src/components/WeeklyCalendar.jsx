import { useState } from 'react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }

const COURSE_COLORS = [
  { bg: '#e0f2fe', border: '#0284c7', text: '#0c4a6e', accent: '#0ea5e9' },
  { bg: '#fce7f3', border: '#db2777', text: '#831843', accent: '#ec4899' },
  { bg: '#dcfce7', border: '#16a34a', text: '#14532d', accent: '#22c55e' },
  { bg: '#fef9c3', border: '#ca8a04', text: '#723e11', accent: '#eab308' },
]

const GRID_START = 8 * 60
const GRID_END = 18 * 60
const GRID_MINUTES = GRID_END - GRID_START

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToDisplay(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

const HOUR_LABELS = []
for (let h = 8; h <= 18; h++) {
  HOUR_LABELS.push(h)
}

export default function WeeklyCalendar({ courses = [] }) {
  const [tooltip, setTooltip] = useState(null)

  const colorMap = {}
  courses.forEach((course, i) => {
    colorMap[course.id] = COURSE_COLORS[i % COURSE_COLORS.length]
  })

  const dayBlocks = {}
  DAYS.forEach(d => { dayBlocks[d] = [] })

  courses.forEach(course => {
    const schedule = course.schedule ?? []
    schedule.forEach(slot => {
      const startMin = timeToMinutes(slot.startTime)
      const endMin = timeToMinutes(slot.endTime)
      const top = ((startMin - GRID_START) / GRID_MINUTES) * 100
      const height = ((endMin - startMin) / GRID_MINUTES) * 100
      if (dayBlocks[slot.day]) {
        dayBlocks[slot.day].push({ course, startMin, endMin, top, height })
      }
    })
  })

  if (courses.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
        <h4 className="text-lg font-semibold text-slate-900">Weekly Schedule</h4>
        <p className="mt-2 text-slate-600">No courses found to display on the calendar.</p>
      </section>
    )
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .cal-block {
          position: absolute;
          left: 4px;
          right: 4px;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          overflow: hidden;
          border-left-width: 3px;
          border-left-style: solid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .cal-block:hover {
          transform: translateY(-1px) scale(1.01);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10;
        }
        .hour-line {
          position: absolute;
          left: 0; right: 0;
          border-top: 1px solid #e2e8f0;
        }
        .half-line {
          position: absolute;
          left: 0; right: 0;
          border-top: 1px dashed #f1f5f9;
        }
        .cal-tooltip {
          position: fixed;
          background: #1e293b;
          color: white;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          pointer-events: none;
          z-index: 999;
          max-width: 220px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          line-height: 1.5;
        }
      `}</style>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {courses.map((course, i) => {
          const color = COURSE_COLORS[i % COURSE_COLORS.length]
          const code = course.courseCode ?? course.code
          const name = course.className ?? course.title
          return (
            <div key={course.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'white', border: `1px solid ${color.border}`,
              borderRadius: '20px', padding: '4px 12px',
              fontSize: '0.8rem', fontWeight: 500, color: color.text,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.accent, display: 'inline-block' }} />
              {code} — {name}
            </div>
          )
        })}
      </div>

      {/* Calendar Grid */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)', borderBottom: '2px solid #e2e8f0' }}>
          <div style={{ padding: '14px 0', background: '#f8fafc' }} />
          {DAYS.map(day => (
            <div key={day} style={{
              padding: '14px 8px',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: '#374151',
              background: '#f8fafc',
              borderLeft: '1px solid #e2e8f0',
            }}>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {day}
              </span>
              <span>{DAY_LABELS[day].slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(5, 1fr)' }}>
          {/* Time Labels */}
          <div style={{ position: 'relative', height: `${GRID_MINUTES}px` }}>
            {HOUR_LABELS.map(h => {
              const top = ((h * 60 - GRID_START) / GRID_MINUTES) * GRID_MINUTES
              const label = h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`
              return (
                <div key={h} style={{
                  position: 'absolute',
                  top: top - 8,
                  right: 8,
                  fontSize: '0.7rem',
                  color: '#94a3b8',
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </div>
              )
            })}
          </div>

          {/* Day Columns */}
          {DAYS.map(day => (
            <div key={day} style={{
              position: 'relative',
              height: `${GRID_MINUTES}px`,
              borderLeft: '1px solid #e2e8f0',
            }}>
              {HOUR_LABELS.map(h => (
                <div key={h} className="hour-line" style={{ top: `${((h * 60 - GRID_START) / GRID_MINUTES) * 100}%` }} />
              ))}
              {HOUR_LABELS.map(h => {
                const top = (((h * 60 + 30) - GRID_START) / GRID_MINUTES) * 100
                if (top < 0 || top > 100) return null
                return <div key={`${h}-half`} className="half-line" style={{ top: `${top}%` }} />
              })}

              {dayBlocks[day].map(({ course, top, height, startMin, endMin }) => {
                const color = colorMap[course.id]
                const code = course.courseCode ?? course.code
                const name = course.className ?? course.title
                return (
                  <div
                    key={`${course.id}-${day}`}
                    className="cal-block"
                    style={{
                      top: `${top}%`,
                      height: `calc(${height}% - 2px)`,
                      background: color.bg,
                      borderLeftColor: color.border,
                      color: color.text,
                    }}
                    onMouseEnter={e => setTooltip({ course, code, name, x: e.clientX + 12, y: e.clientY - 10, time: `${minutesToDisplay(startMin)} – ${minutesToDisplay(endMin)}` })}
                    onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX + 12, y: e.clientY - 10 } : null)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.2, marginBottom: 2 }}>{code}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 500, opacity: 0.85, lineHeight: 1.2, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: '0.67rem', opacity: 0.7, lineHeight: 1.3 }}>{course.instructor}</div>
                    <div style={{ fontSize: '0.67rem', opacity: 0.7, lineHeight: 1.3 }}>📍 {course.location}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="cal-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.code} — {tooltip.name}</div>
          <div style={{ opacity: 0.8, fontSize: '12px' }}>🕐 {tooltip.time}</div>
          <div style={{ opacity: 0.8, fontSize: '12px' }}>👤 {tooltip.course.instructor}</div>
          <div style={{ opacity: 0.8, fontSize: '12px' }}>📍 {tooltip.course.location}</div>
        </div>
      )}
    </div>
  )
}
