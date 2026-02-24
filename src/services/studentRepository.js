import { MOCK_STUDENT } from '../data/mockData'

export function getStudentDashboard() {
  if (typeof structuredClone === 'function') {
    return structuredClone(MOCK_STUDENT)
  }

  return JSON.parse(JSON.stringify(MOCK_STUDENT))
}
