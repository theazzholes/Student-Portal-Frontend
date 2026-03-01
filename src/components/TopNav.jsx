const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'courses', label: 'Courses' },
  { id: 'grades', label: 'Grades' },
  { id: 'schedule', label: 'Schedule'},
]

function TopNavbar({ student, activeTab = 'overview', onTabChange }) {
  const safeStudent = student ?? {
    fullName: 'Loading student...',
    program: '',
    term: '',
    gpa: 0,
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-700 bg-slate-900 text-slate-100">
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Student Portal
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {safeStudent.fullName}
            {safeStudent.program ? ` | ${safeStudent.program}` : ''}
          </p>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = item.id === activeTab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange?.(item.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">{safeStudent.term}</p>
          <p className="text-sm font-semibold text-white">GPA {safeStudent.gpa.toFixed(2)}</p>
        </div>
      </div>
    </header>
  )
}

export default TopNavbar
