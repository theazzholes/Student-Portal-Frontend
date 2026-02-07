function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200 max-w-lg w-full">
        <h1 className="text-3xl font-black text-blue-600 mb-2">Student Portal</h1>
        <p className="text-gray-500 font-medium mb-6">Sprint 1: Environment Live ✅</p>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <h3 className="font-bold text-blue-800">React + Vite 7</h3>
            <p className="text-sm text-blue-600">Scaffolding complete.</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
            <h3 className="font-bold text-purple-800">Tailwind CSS</h3>
            <p className="text-sm text-purple-600">Manual config successful.</p>
          </div>
        </div>
        
        <button className="mt-8 w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
          View Dashboard
        </button>
      </div>
    </div>
  )
}

export default App