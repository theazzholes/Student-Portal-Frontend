import { useEffect, useMemo, useState } from 'react'
import { getClasses } from '../services/studentRepository'
import CatalogCard from './CatalogCard'

function toDisplayValue(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function getCatalogTerm(catalogClass) {
  return (
    toDisplayValue(catalogClass?.term) ||
    toDisplayValue(catalogClass?.semester) ||
    toDisplayValue(catalogClass?.sessionTerm)
  )
}

function ClassCatalog() {
  const [classes, setClasses] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [selectedTerms, setSelectedTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    Promise.resolve(getClasses())
      .then((data) => {
        if (isMounted) {
          setClasses(Array.isArray(data) ? data : [])
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error?.message ?? 'Unable to load the class catalog right now.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = new Set(
      classes
        .map((catalogClass) => catalogClass.department)
        .filter((department) => typeof department === 'string' && department.trim() !== ''),
    )

    return [...uniqueDepartments].sort((a, b) => a.localeCompare(b))
  }, [classes])

  const termOptions = useMemo(() => {
    const uniqueTerms = new Set(
      classes
        .map((catalogClass) => getCatalogTerm(catalogClass))
        .filter((term) => term !== ''),
    )

    return [...uniqueTerms].sort((a, b) => a.localeCompare(b))
  }, [classes])

  const filteredClasses = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase()

    return classes.filter((catalogClass) => {
      const departmentMatch =
        selectedDepartments.length === 0 || selectedDepartments.includes(catalogClass.department)
      const classTerm = getCatalogTerm(catalogClass)
      const termMatch = selectedTerms.length === 0 || selectedTerms.includes(classTerm)

      if (!departmentMatch || !termMatch) {
        return false
      }

      if (!searchValue) {
        return true
      }

      const className = String(catalogClass.className ?? '').toLowerCase()
      const courseCode = String(catalogClass.courseCode ?? '').toLowerCase()
      return className.includes(searchValue) || courseCode.includes(searchValue)
    })
  }, [classes, searchTerm, selectedDepartments, selectedTerms])

  const handleDepartmentToggle = (department) => {
    setSelectedDepartments((previousSelected) => {
      if (previousSelected.includes(department)) {
        return previousSelected.filter((item) => item !== department)
      }

      return [...previousSelected, department]
    })
  }

  const handleTermToggle = (term) => {
    setSelectedTerms((previousSelected) => {
      if (previousSelected.includes(term)) {
        return previousSelected.filter((item) => item !== term)
      }

      return [...previousSelected, term]
    })
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedDepartments([])
    setSelectedTerms([])
  }

  const hasActiveFilters = searchTerm.trim() !== '' || selectedDepartments.length > 0 || selectedTerms.length > 0

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Class Catalog</h2>
          {!loading && !errorMessage && (
            <p className="text-xs text-slate-500">
              {filteredClasses.length} of {classes.length} shown
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Filters</h3>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Reset Filters
            </button>
          </div>

          <div className="mt-3">
            <label htmlFor="class-catalog-search" className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Search by Class Name or Code
            </label>
            <input
              id="class-catalog-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ex: BIOL 1308"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-500 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Term</p>
            {termOptions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-700">No terms available.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {termOptions.map((term) => {
                  const selected = selectedTerms.includes(term)
                  return (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleTermToggle(term)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200'
                      }`}
                    >
                      {term}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Department</p>
            {departmentOptions.length === 0 ? (
              <p className="mt-2 text-xs text-slate-700">No departments available.</p>
            ) : (
              <div className="mt-2 max-h-56 space-y-1.5 overflow-auto pr-1">
                {departmentOptions.map((department) => {
                  const checked = selectedDepartments.includes(department)
                  return (
                    <label
                      key={department}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleDepartmentToggle(department)}
                        className="h-4 w-4 rounded border-slate-400 text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-sm font-medium text-slate-900">{department}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Loading class catalog...
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && filteredClasses.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-700">
              No classes match your current filters. Try broadening your search or reset filters.
            </div>
          )}

          {!loading && !errorMessage && filteredClasses.length > 0 && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filteredClasses.map((catalogClass) => (
                <CatalogCard
                  key={catalogClass.id ?? catalogClass.classId ?? catalogClass.courseCode}
                  catalogClass={catalogClass}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

export default ClassCatalog
