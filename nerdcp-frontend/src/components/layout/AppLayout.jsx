// src/components/layout/AppLayout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api, { apiError } from '../../api'

const NAV = [
  { to: '/',          icon: '▣',  label: 'Dashboard'  },
  { to: '/incidents', icon: '⚡', label: 'Incidents'   },
  { to: '/vehicles',  icon: '🚑', label: 'Vehicles'    },
  { to: '/analytics', icon: '◈',  label: 'Analytics'  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('nerdcp_refresh')
      if (refresh) await api.auth.logout(refresh).catch(() => {})
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060810', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#0d1117',
        borderRight: '1px solid #21262d',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #21262d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', animation: 'blink 2s step-end infinite' }} />
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.1em' }}>NERDCP</span>
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.08em', marginTop: 5 }}>EMERGENCY PLATFORM</p>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 3, marginBottom: 3,
              textDecoration: 'none', transition: 'all .15s',
              background: isActive ? 'rgba(245,158,11,.08)' : 'transparent',
              borderLeft: `2px solid ${isActive ? '#f59e0b' : 'transparent'}`,
              color: isActive ? '#f59e0b' : '#8b949e',
              fontFamily: 'monospace', fontSize: 12, fontWeight: isActive ? 600 : 400,
            })}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '16px', borderTop: '1px solid #21262d' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9d1d9', fontWeight: 600, marginBottom: 2 }}>
              {user?.name || user?.email || 'Operator'}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#f59e0b', letterSpacing: '.08em' }}>
              {user?.role || 'OPERATOR'}
            </div>
          </div>
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: 'transparent',
            border: '1px solid #21262d', borderRadius: 3,
            fontFamily: 'monospace', fontSize: 11, color: '#8b949e', cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,.4)' }}
          onMouseLeave={e => { e.currentTarget.style.color='#8b949e'; e.currentTarget.style.borderColor='#21262d' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
