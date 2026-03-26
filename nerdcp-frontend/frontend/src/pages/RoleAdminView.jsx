/**
 * NERDCP — Role-Specific Admin Views
 * ─────────────────────────────────────────────────────────────────────────────
 * Three separate views rendered based on the logged-in user's role.
 * Each view filters the incident list and analytics to show only data
 * relevant to that service.
 *
 * Connect to your router:
 *   <Route path="/admin/hospital" element={<HospitalAdminView />} />
 *   <Route path="/admin/police"   element={<PoliceAdminView />} />
 *   <Route path="/admin/fire"     element={<FireAdminView />} />
 *
 * Or use the unified <RoleAdminView /> which auto-routes by user role.
 *
 * Roles mapped:
 *   HOSPITAL_ADMIN → HospitalAdminView  (MEDICAL incidents + ambulances)
 *   POLICE_ADMIN   → PoliceAdminView    (POLICE incidents + police cars)
 *   FIRE_ADMIN     → FireAdminView      (FIRE + HAZMAT incidents + fire trucks)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react'
import api, { getUser } from '../api/api'

const T = {
  bg:'#060810', surface:'#0d1117', raised:'#161b22', border:'#21262d',
  text:'#c9d1d9', muted:'#8b949e', dim:'#30363d',
  amber:'#f59e0b', red:'#ef4444', green:'#22c55e',
  blue:'#3b82f6', orange:'#f97316', purple:'#8b5cf6',
  mono:"'Syne Mono', monospace", sans:"'DM Sans', sans-serif",
}

const STATUS = {
  REPORTED:     { label: 'Reported',     color: T.amber  },
  ACKNOWLEDGED: { label: 'Acknowledged', color: T.blue   },
  DISPATCHED:   { label: 'Dispatched',   color: T.amber  },
  IN_PROGRESS:  { label: 'In Progress',  color: T.orange },
  RESOLVED:     { label: 'Resolved',     color: T.green  },
  CLOSED:       { label: 'Closed',       color: T.muted  },
}

const timeAgo = (iso) => {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function Spinner({ size = 14 }) {
  return (
    <span style={{
      display:'inline-block',width:size,height:size,
      border:`2px solid rgba(245,158,11,.2)`,borderTopColor:T.amber,
      borderRadius:'50%',animation:'spin .7s linear infinite',
    }} />
  )
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.REPORTED
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,
      padding:'2px 7px',borderRadius:2,
      fontSize:9,fontFamily:T.mono,fontWeight:700,letterSpacing:'.08em',
      color:s.color,background:`${s.color}12`,border:`1px solid ${s.color}30`,
    }}>
      {s.label.toUpperCase()}
    </span>
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const c = type === 'error' ? T.red : T.green
  return (
    <div style={{
      position:'fixed',top:24,right:24,zIndex:9999,
      display:'flex',alignItems:'center',gap:10,
      background:T.surface,border:`1px solid ${c}50`,borderLeft:`3px solid ${c}`,
      padding:'12px 16px',borderRadius:3,boxShadow:'0 8px 32px rgba(0,0,0,.5)',
      fontFamily:T.mono,fontSize:12,color:type==='error'?'#f87171':'#86efac',
      maxWidth:340,animation:'slideIn .25s ease',
    }}>
      {type === 'error' ? '✕' : '✓'} {message}
      <button onClick={onClose} style={{ background:'none',border:'none',color:'inherit',cursor:'pointer' }}>✕</button>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function Card({ label, value, color = T.amber, sub, icon }) {
  return (
    <div style={{
      background:T.surface,border:`1px solid ${T.border}`,
      borderTop:`2px solid ${color}`,borderRadius:3,padding:'16px 18px',
    }}>
      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
        <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted }}>{label}</div>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize:26,fontWeight:700,color,fontFamily:T.mono,lineHeight:1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:11,color:T.muted,marginTop:6 }}>{sub}</div>}
    </div>
  )
}

// ─── Incident table (shared) ──────────────────────────────────────────────────
function IncidentTable({ incidents, loading, error, onRetry, onAdvanceStatus, accentColor }) {
  if (loading) return (
    <div style={{ display:'flex',flexDirection:'column',gap:1 }}>
      {[...Array(4)].map((_,i) => <div key={i} style={{ height:60,background:T.raised,borderBottom:`1px solid ${T.border}` }} />)}
    </div>
  )
  if (error) return (
    <div style={{ background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.2)',borderLeft:'3px solid #ef4444',borderRadius:3,padding:'12px 14px',display:'flex',justifyContent:'space-between' }}>
      <span style={{ fontFamily:T.mono,fontSize:11,color:'#f87171' }}>⚠ {error}</span>
      {onRetry && <button onClick={onRetry} style={{ background:'none',border:'none',color:'#f87171',cursor:'pointer',fontFamily:T.mono,fontSize:11 }}>Retry</button>}
    </div>
  )
  if (incidents.length === 0) return (
    <div style={{ textAlign:'center',padding:'40px 24px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:3 }}>
      <div style={{ fontSize:32,marginBottom:10 }}>✅</div>
      <p style={{ color:T.muted,fontFamily:T.mono,fontSize:12 }}>No active incidents — all clear</p>
    </div>
  )
  return (
    <div style={{ border:`1px solid ${T.border}`,borderRadius:3,overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 120px 100px 80px',background:T.raised,padding:'8px 16px',borderBottom:`1px solid ${T.border}` }}>
        {['INCIDENT','TYPE','STATUS','TIME'].map(h => (
          <div key={h} style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.12em',color:T.dim,padding:'2px 4px' }}>{h}</div>
        ))}
      </div>
      {/* Rows */}
      {incidents.map((inc, idx) => (
        <div key={inc.id} style={{
          display:'grid',gridTemplateColumns:'1fr 120px 100px 80px',
          padding:'0 16px',
          background:idx%2===0?T.surface:'rgba(22,27,34,.5)',
          borderBottom:`1px solid ${T.raised}`,
          borderLeft:`3px solid ${accentColor}`,
        }}>
          <div style={{ padding:'12px 4px' }}>
            <div style={{ fontSize:12,color:'#f0f6fc',fontWeight:500,marginBottom:3,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {inc.description}
            </div>
            <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>{inc.id.slice(0,14)}…</div>
          </div>
          <div style={{ padding:'12px 4px',display:'flex',alignItems:'center',fontFamily:T.mono,fontSize:11,color:T.muted }}>
            {inc.type}
          </div>
          <div style={{ padding:'12px 4px',display:'flex',alignItems:'center' }}>
            <StatusBadge status={inc.status} />
          </div>
          <div style={{ padding:'12px 4px',display:'flex',alignItems:'center',fontFamily:T.mono,fontSize:10,color:T.dim }}>
            {timeAgo(inc.createdAt)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Generic admin view layout ────────────────────────────────────────────────
function AdminView({ config }) {
  const { title, subtitle, icon, accentColor, incidentTypes, vehicleType } = config

  const [incidents, setIncidents] = useState([])
  const [vehicles, setVehicles]   = useState([])
  const [incLoading, setIncLoading] = useState(true)
  const [vehLoading, setVehLoading] = useState(true)
  const [incError, setIncError]     = useState('')
  const [vehError, setVehError]     = useState('')
  const [toast, setToast]           = useState(null)
  const [activeTab, setActiveTab]   = useState('incidents')

  const notify = (msg, type = 'success') => setToast({ message: msg, type })

  const loadIncidents = useCallback(async () => {
    setIncLoading(true); setIncError('')
    try {
      // Load all open incidents and filter by this service's types
      const { data } = await api.getOpenIncidents()
      const all = data.data || []
      setIncidents(all.filter(i => incidentTypes.includes(i.type)))
    } catch (e) { setIncError(e.message) }
    finally { setIncLoading(false) }
  }, [incidentTypes])

  const loadVehicles = useCallback(async () => {
    setVehLoading(true); setVehError('')
    try {
      const { data } = await api.getVehicles({ type: vehicleType })
      setVehicles(data.data || data.vehicles || [])
    } catch (e) { setVehError(e.message) }
    finally { setVehLoading(false) }
  }, [vehicleType])

  useEffect(() => {
    loadIncidents()
    loadVehicles()
    const interval = setInterval(() => { loadIncidents(); loadVehicles() }, 30000)
    return () => clearInterval(interval)
  }, [loadIncidents, loadVehicles])

  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE').length
  const busyVehicles      = vehicles.filter(v => v.status === 'BUSY').length
  const activeIncidents   = incidents.filter(i => !['RESOLVED','CLOSED'].includes(i.status)).length

  const TABS = [
    { key:'incidents', label:'INCIDENTS' },
    { key:'fleet',     label:'MY FLEET' },
  ]

  return (
    <div style={{ minHeight:'100vh',background:T.bg,fontFamily:T.sans,color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0;transform:translateX(20px); } to { opacity:1;transform:translateX(0); } }
        * { box-sizing: border-box; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ maxWidth:1100,margin:'0 auto',padding:'32px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:28 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
              <div style={{ width:3,height:24,background:accentColor,borderRadius:2 }} />
              <span style={{ fontSize:24 }}>{icon}</span>
              <h1 style={{ fontFamily:T.mono,fontSize:20,fontWeight:700,color:'#f0f6fc',margin:0 }}>
                {title}
              </h1>
            </div>
            <p style={{ color:T.muted,fontSize:13,marginLeft:40,margin:0 }}>{subtitle}</p>
          </div>
          <button onClick={() => { loadIncidents(); loadVehicles() }} style={{
            display:'inline-flex',alignItems:'center',gap:6,
            background:'transparent',border:`1px solid ${T.border}`,
            color:T.muted,borderRadius:3,padding:'8px 14px',
            fontFamily:T.mono,fontSize:11,cursor:'pointer',
          }}>↻ Refresh</button>
        </div>

        {/* Stat cards */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:28 }}>
          <Card label="ACTIVE INCIDENTS"  value={activeIncidents}   color={accentColor} icon="🚨" sub={`${incidentTypes.join(', ').toLowerCase()}`} />
          <Card label="FLEET AVAILABLE"   value={availableVehicles} color={T.green}      icon="✅" sub={`${vehicleType.replace('_',' ').toLowerCase()}`} />
          <Card label="FLEET BUSY"        value={busyVehicles}      color={T.orange}     icon="🔄" sub="currently deployed" />
          <Card label="TOTAL UNITS"       value={vehicles.length}   color={T.blue}       icon="🚗" sub="registered" />
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',gap:0,marginBottom:0,borderBottom:`1px solid ${T.border}` }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding:'10px 20px',
              background:'transparent',
              border:'none',
              borderBottom:`2px solid ${activeTab === tab.key ? accentColor : 'transparent'}`,
              fontFamily:T.mono,fontSize:11,fontWeight:700,letterSpacing:'.08em',
              color: activeTab === tab.key ? accentColor : T.muted,
              cursor:'pointer',transition:'all .15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop:20 }}>
          {/* Incidents tab */}
          {activeTab === 'incidents' && (
            <div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>
                  {incLoading ? <Spinner size={12} /> : `${incidents.length} incident${incidents.length!==1?'s':''} (types: ${incidentTypes.join(', ')})`}
                </div>
              </div>
              <IncidentTable
                incidents={incidents}
                loading={incLoading}
                error={incError}
                onRetry={loadIncidents}
                accentColor={accentColor}
              />
            </div>
          )}

          {/* Fleet tab */}
          {activeTab === 'fleet' && (
            <div>
              <div style={{ marginBottom:14,fontFamily:T.mono,fontSize:11,color:T.muted }}>
                {vehLoading ? <Spinner size={12} /> : `${vehicles.length} ${vehicleType.replace('_',' ').toLowerCase()}${vehicles.length!==1?'s':''} registered`}
              </div>

              {vehError && (
                <div style={{ background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.2)',borderLeft:'3px solid #ef4444',borderRadius:3,padding:'12px 14px',marginBottom:16,display:'flex',justifyContent:'space-between' }}>
                  <span style={{ fontFamily:T.mono,fontSize:11,color:'#f87171' }}>⚠ {vehError}</span>
                  <button onClick={loadVehicles} style={{ background:'none',border:'none',color:'#f87171',cursor:'pointer',fontFamily:T.mono,fontSize:11 }}>Retry</button>
                </div>
              )}

              {vehLoading ? (
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:12 }}>
                  {[...Array(4)].map((_,i) => <div key={i} style={{ height:120,background:T.surface,border:`1px solid ${T.border}`,borderRadius:3 }} />)}
                </div>
              ) : vehicles.length === 0 ? (
                <div style={{ textAlign:'center',padding:'40px 24px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:3 }}>
                  <div style={{ fontSize:32,marginBottom:10 }}>🚗</div>
                  <p style={{ color:T.muted,fontFamily:T.mono,fontSize:12 }}>No {vehicleType.replace('_',' ').toLowerCase()}s registered yet</p>
                </div>
              ) : (
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:12 }}>
                  {vehicles.map(v => {
                    const sm = v.status === 'AVAILABLE' ? T.green : v.status === 'BUSY' ? T.orange : T.muted
                    return (
                      <div key={v.id} style={{
                        background:T.surface,border:`1px solid ${T.border}`,
                        borderTop:`2px solid ${accentColor}`,borderRadius:3,padding:'14px 16px',
                      }}>
                        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
                          <div style={{ fontSize:13,fontWeight:600,color:'#f0f6fc' }}>
                            {v.name || v.plateNumber || v.id.slice(0,12)+'…'}
                          </div>
                          <span style={{ fontFamily:T.mono,fontSize:9,color:sm,background:`${sm}12`,border:`1px solid ${sm}30`,padding:'2px 6px',borderRadius:2 }}>
                            {v.status}
                          </span>
                        </div>
                        {v.plateNumber && (
                          <div style={{ fontFamily:T.mono,fontSize:10,color:T.muted,marginBottom:4 }}>Plate: {v.plateNumber}</div>
                        )}
                        {v.latitude != null && (
                          <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>
                            {v.latitude}, {v.longitude}
                          </div>
                        )}
                        {v.currentIncidentId && (
                          <div style={{ marginTop:8,padding:'4px 8px',background:'rgba(249,115,22,.08)',border:'1px solid rgba(249,115,22,.3)',borderRadius:2,fontFamily:T.mono,fontSize:10,color:T.orange }}>
                            📌 Active call: {v.currentIncidentId.slice(0,12)}…
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop:28,padding:'10px 14px',background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,fontFamily:T.mono,fontSize:9,color:T.dim }}>
          {title} — Auto-refreshes every 30s · Showing incidents filtered to {incidentTypes.join(', ')}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE-SPECIFIC VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

export function HospitalAdminView() {
  return (
    <AdminView config={{
      title:         'HOSPITAL ADMIN',
      subtitle:      'Medical emergency incidents and ambulance fleet management',
      icon:          '🏥',
      accentColor:   T.blue,
      incidentTypes: ['MEDICAL'],
      vehicleType:   'AMBULANCE',
    }} />
  )
}

export function PoliceAdminView() {
  return (
    <AdminView config={{
      title:         'POLICE ADMIN',
      subtitle:      'Police incidents and patrol vehicle management',
      icon:          '🚔',
      accentColor:   T.purple,
      incidentTypes: ['POLICE', 'TRAFFIC'],
      vehicleType:   'POLICE_CAR',
    }} />
  )
}

export function FireAdminView() {
  return (
    <AdminView config={{
      title:         'FIRE SERVICE ADMIN',
      subtitle:      'Fire and hazmat incidents and fire truck management',
      icon:          '🔥',
      accentColor:   T.red,
      incidentTypes: ['FIRE', 'HAZMAT'],
      vehicleType:   'FIRE_TRUCK',
    }} />
  )
}

// ─── Auto-router based on logged-in user's role ───────────────────────────────
export default function RoleAdminView() {
  const user = getUser()
  const role = user?.role

  if (role === 'HOSPITAL_ADMIN' || (role === 'ADMIN' && window.location.search.includes('view=hospital'))) {
    return <HospitalAdminView />
  }
  if (role === 'POLICE_ADMIN' || (role === 'ADMIN' && window.location.search.includes('view=police'))) {
    return <PoliceAdminView />
  }
  if (role === 'FIRE_ADMIN' || (role === 'ADMIN' && window.location.search.includes('view=fire'))) {
    return <FireAdminView />
  }

  // Fallback: show all three role views as tabs
  return <AllRolesView />
}

function AllRolesView() {
  const [tab, setTab] = useState('hospital')
  const TABS = [
    { key:'hospital', label:'🏥 Hospital',     component:<HospitalAdminView /> },
    { key:'police',   label:'🚔 Police',        component:<PoliceAdminView /> },
    { key:'fire',     label:'🔥 Fire Service',  component:<FireAdminView /> },
  ]

  return (
    <div style={{ minHeight:'100vh',background:T.bg,fontFamily:T.sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top tab bar */}
      <div style={{ background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'0 32px',display:'flex',gap:0 }}>
        <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,padding:'14px 0',marginRight:20,alignSelf:'center' }}>
          SERVICE VIEW:
        </div>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'14px 20px',background:'transparent',border:'none',
            borderBottom:`2px solid ${tab===t.key ? T.amber : 'transparent'}`,
            fontFamily:T.mono,fontSize:11,fontWeight:700,
            color: tab===t.key ? T.amber : T.muted,
            cursor:'pointer',transition:'all .15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Render active view */}
      {TABS.find(t => t.key === tab)?.component}
    </div>
  )
}
