import logo from '../assets/Capgemini Logo final.png'

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'courses', label: 'Courses' },
  { id: 'grades', label: 'Grades' },
  { id: 'schedule', label: 'Schedule' },
]

function TopNavbar({
  student,
  activeTab = 'overview',
  onTabChange,
  viewMode = 'student',
  onViewModeChange,
  canUseTeacherView = false,
}) {
  const activeNavItems = viewMode === 'teacher' ? [{ id: 'teacher-dashboard', label: 'Teacher Dashboard' }] : navItems

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-700 bg-slate-900 text-slate-100">
      <div className="mx-auto grid h-20 w-full max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-6">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Capgemini logo" className="h-12 w-auto object-contain" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white">
              {viewMode === 'teacher' ? 'Teacher Portal' : 'Student Portal'}
            </p>
          </div>
        </div>

        <nav className="col-start-2 flex items-center gap-2">
          {activeNavItems.map((item) => {
            const isActive = viewMode === 'teacher' ? true : item.id === activeTab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (viewMode !== 'teacher') {
                    onTabChange?.(item.id)
                  }
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="justify-self-end text-right">
          {canUseTeacherView && (
            <button
              type="button"
              onClick={() => onViewModeChange?.(viewMode === 'teacher' ? 'student' : 'teacher')}
              className="mb-1 rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:border-slate-300 hover:text-white"
            >
              {viewMode === 'teacher' ? 'Switch To Student' : 'Switch To Teacher'}
            </button>
          )}
          <p className="text-sm font-semibold text-white">{student?.fullName ?? 'Loading student...'}</p>
          <p className="text-xs text-slate-400">{student?.email ?? ''}</p>
        </div>
      </div>
    </header>
  )
}

export default TopNavbar
