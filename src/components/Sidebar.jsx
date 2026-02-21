const navItems = [
  { label: 'Overview', href: '#overview' },
  { label: 'Courses', href: '#courses' },
  { label: 'Grades', href: '#grades' },
  { label: 'Settings', href: '#settings' },
]

function TopNavbar({ student, active = 'Overview' }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-700 bg-slate-900 text-slate-100">
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Student Portal
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {student.fullName} | {student.program}
          </p>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = item.label === active
            return (
              <a
                key={item.label}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">{student.term}</p>
          <p className="text-sm font-semibold text-white">GPA {student.gpa.toFixed(2)}</p>
        </div>
      </div>
    </header>
  )
}

export default TopNavbar
