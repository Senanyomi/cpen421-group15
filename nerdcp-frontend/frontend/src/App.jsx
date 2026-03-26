/**
 * NERDCP — Main App Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Wires all pages together with protected routes and a shared nav sidebar.
 *
 * File: src/App.jsx
 *
 * Setup:
 *   1. npm install axios react-router-dom
 *   2. Copy all src/ files from this package into your Vite project
 *   3. In src/main.jsx: import App from './App'; ReactDOM.createRoot(...).render(<App />)
 *   4. Create .env with:
 *        VITE_IDENTITY_URL=http://localhost:3001
 *        VITE_INCIDENT_URL=http://localhost:3002
 *        VITE_DISPATCH_URL=http://localhost:3003
 *        VITE_ANALYTICS_URL=http://localhost:3004
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ── Pages ─────────────────────────────────────────────────────────────────────
import { AuthProvider, useAuth, LoginPage, ProtectedRoute } from './AuthUI'
import IncidentsPage    from './pages/IncidentsPage'
import DispatchDashboard from './pages/DispatchDashboard'
import VehicleTrackingPage from './pages/VehicleTrackingPage'
import AnalyticsDashboard  from './pages/AnalyticsDashboard'
import RoleAdminView, { HospitalAdminView, PoliceAdminView, FireAdminView } from './pages/RoleAdminView'

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: '#060810', surface: '#0d1117', raised: '#161b22', border: '#21262d',
  text: '#c9d1d9', muted: '#8b949e', dim: '#30363d',
  amber: '#f59e0b', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  mono: "'Syne Mono', monospace", sans: "'DM Sans', sans-serif",
}

// ─── Role-based nav config ────────────────────────────────────────────────────
const NAV = [
  { to: '/incidents',  label: 'INCIDENTS',   icon: '📋', roles: ['ADMIN','DISPATCHER','OPERATOR','RESPONDER'] },
  { to: '/dispatch',   label: 'DISPATCH',    icon: '📡', roles: ['ADMIN','DISPATCHER'] },
  { to: '/vehicles',   label: 'VEHICLES',    icon: '🚗', roles: ['ADMIN','DISPATCHER','RESPONDER'] },
  { to: '/analytics',  label: 'ANALYTICS',   icon: '📊', roles: ['ADMIN','ANALYST','DISPATCHER'] },
  { to: '/admin',      label: 'SERVICE VIEW', icon: '🏢', roles: ['ADMIN','HOSPITAL_ADMIN','POLICE_ADMIN','FIRE_ADMIN'] },
]

// ─── Sidebar layout ────────────────────────────────────────────────────────────
function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const handleLogout = () => {
    const token = localStorage.getItem('nerdcp_refresh')
    if (token) {
      fetch(`${import.meta.env?.VITE_IDENTITY_URL || 'http://localhost:3001'}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('nerdcp_token')}` },
        body: JSON.stringify({ refreshToken: token }),
      }).catch(() => {})
    }
    logout()
  }

  const visibleNav = NAV.filter(n => !user?.role || n.roles.includes(user.role))

  return (
    <div style={{
      width: 200, minHeight: '100vh', flexShrink: 0,
      background: T.surface, borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
          <span style={{ width:7,height:7,borderRadius:'50%',background:T.amber,boxShadow:`0 0 6px ${T.amber}`,animation:'pulseDot 1.5s infinite' }} />
          <span style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.2em',color:T.amber }}>LIVE</span>
        </div>
        <div style={{ fontFamily:T.mono,fontSize:18,fontWeight:700,color:'#f0f6fc',letterSpacing:'.06em' }}>NERDCP</div>
        <div style={{ fontFamily:T.mono,fontSize:8,letterSpacing:'.1em',color:T.dim,marginTop:3 }}>
          EMERGENCY RESPONSE
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex:1,padding:'16px 0' }}>
        {visibleNav.map(n => (
          <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
            display:'flex',alignItems:'center',gap:10,
            padding:'10px 20px',
            textDecoration:'none',
            background: isActive ? `${T.amber}12` : 'transparent',
            borderLeft: `2px solid ${isActive ? T.amber : 'transparent'}`,
            transition:'all .15s',
          })}>
            {({ isActive }) => (
              <>
                <span style={{ fontSize:14 }}>{n.icon}</span>
                <span style={{
                  fontFamily:T.mono,fontSize:10,fontWeight:700,letterSpacing:'.08em',
                  color: isActive ? T.amber : T.muted,
                }}>
                  {n.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ padding:'16px 20px',borderTop:`1px solid ${T.border}` }}>
        {user && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:T.mono,fontSize:10,color:'#f0f6fc',marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {user.name || user.email}
            </div>
            <div style={{ fontFamily:T.mono,fontSize:9,color:T.amber,letterSpacing:'.1em' }}>
              {user.role}
            </div>
          </div>
        )}
        <button onClick={handleLogout} style={{
          display:'flex',alignItems:'center',gap:6,width:'100%',
          background:'transparent',border:`1px solid ${T.border}`,
          color:T.muted,borderRadius:3,padding:'7px 12px',
          fontFamily:T.mono,fontSize:10,cursor:'pointer',
          transition:'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = `${T.red}50` }}
        onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border }}
        >
          ↩ Sign out
        </button>
      </div>
    </div>
  )
}

// ─── App shell with sidebar ────────────────────────────────────────────────────
function AppShell({ children }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:T.bg }}>
      <Sidebar />
      <main style={{ flex:1, overflow:'auto' }}>
        {children}
      </main>
    </div>
  )
}

// ─── Role-based redirect on / ──────────────────────────────────────────────────
function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (['ADMIN','DISPATCHER','OPERATOR'].includes(user.role)) return <Navigate to="/incidents" replace />
  if (user.role === 'ANALYST') return <Navigate to="/analytics" replace />
  if (user.role === 'HOSPITAL_ADMIN') return <Navigate to="/admin" replace />
  if (user.role === 'POLICE_ADMIN')   return <Navigate to="/admin" replace />
  if (user.role === 'FIRE_ADMIN')     return <Navigate to="/admin" replace />
  return <Navigate to="/incidents" replace />
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
          @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #060810; color: #c9d1d9; }
          select option { background: #161b22; color: #c9d1d9; }
        `}</style>

        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — wrap in shell */}
          <Route path="/" element={
            <ProtectedRoute>
              <AppShell><RootRedirect /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/incidents" element={
            <ProtectedRoute>
              <AppShell><IncidentsPage /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/dispatch" element={
            <ProtectedRoute>
              <AppShell><DispatchDashboard /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/vehicles" element={
            <ProtectedRoute>
              <AppShell><VehicleTrackingPage /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AppShell><AnalyticsDashboard /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AppShell><RoleAdminView /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/admin/hospital" element={
            <ProtectedRoute>
              <AppShell><HospitalAdminView /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/admin/police" element={
            <ProtectedRoute>
              <AppShell><PoliceAdminView /></AppShell>
            </ProtectedRoute>
          } />
          <Route path="/admin/fire" element={
            <ProtectedRoute>
              <AppShell><FireAdminView /></AppShell>
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
