import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard'
import { verifyStudentApiConnections } from './services/studentRepository'

function App() {
  const [apiReady, setApiReady] = useState(false)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    let isMounted = true

    verifyStudentApiConnections()
      .then(() => {
        if (isMounted) {
          setApiReady(true)
        }
      })
      .catch((error) => {
        if (isMounted) {
          setApiError(error.message)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  if (apiError) {
    return (
      <main className="mx-auto mt-16 max-w-3xl rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">
        <h1 className="text-xl font-semibold">API connection failed</h1>
        <p className="mt-2 text-sm">{apiError}</p>
      </main>
    )
  }

  if (!apiReady) {
    return (
      <main className="mx-auto mt-16 max-w-3xl rounded-xl border border-slate-200 bg-white p-6 text-slate-800">
        <h1 className="text-xl font-semibold">Connecting to student APIs...</h1>
      </main>
    )
  }

  return <Dashboard />
}

export default App
