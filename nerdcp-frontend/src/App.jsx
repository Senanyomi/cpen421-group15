import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import IncidentsPage from './pages/IncidentsPage'
import VehiclesPage from './pages/VehiclesPage'
import AnalyticsPage from './pages/AnalyticsPage'

// Wraps routes that need a valid session
const Protected = ({ children }) => {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { token } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
