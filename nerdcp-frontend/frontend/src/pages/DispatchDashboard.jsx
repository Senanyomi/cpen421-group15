/**
 * NERDCP — Dispatch Status Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows all active incidents and their assigned responders in one view.
 * Dispatchers and admins can advance incident status from here.
 *
 * Connect to your router:
 *   <Route path="/dispatch" element={<DispatchDashboard />} />
 *
 * API calls:
 *   GET /incidents/open          — all non-closed incidents
 *   GET /responders/nearest      — find nearest unit for an incident
 *   PUT /incidents/:id/status    — advance lifecycle
 *   PUT /incidents/:id/assign    — assign a vehicle
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../api/api'

// ─── Shared design tokens (match AuthUI + IncidentsPage palette) ──────────────
const T = {
  bg:       '#060810',
  surface:  '#0d1117',
  raised:   '#161b22',
  border:   '#21262d',
  text:     '#c9d1d9',
  muted:    '#8b949e',
  dim:      '#30363d',
  amber:    '#f59e0b',
  amberDim: 'rgba(245,158,11,.1)',
  red:      '#ef4444',
  green:    '#22c55e',
  blue:     '#3b82f6',
  orange:   '#f97316',
  mono:     "'Syne Mono', monospace",
  sans:     "'DM Sans', sans-serif",
}

const STATUS = {
  REPORTED:     { label: 'Reported',     color: T.amber,  bg: T.amberDim },
  ACKNOWLEDGED: { label: 'Acknowledged', color: T.blue,   bg: 'rgba(59,130,246,.1)' },
  DISPATCHED:   { label: 'Dispatched',   color: T.amber,  bg: 'rgba(245,158,11,.12)' },
  IN_PROGRESS:  { label: 'In Progress',  color: T.orange, bg: 'rgba(249,115,22,.1)' },
  RESOLVED:     { label: 'Resolved',     color: T.green,  bg: 'rgba(34,197,94,.1)' },
  CLOSED:       { label: 'Closed',       color: T.muted,  bg: 'rgba(139,148,158,.08)' },
}

const TYPE_ICON = {
  FIRE: '🔥', MEDICAL: '🚑', POLICE: '🚔',
  NATURAL_DISASTER: '🌊', HAZMAT: '☢', TRAFFIC: '🚧', OTHER: '⚠',
}

const NEXT = {
  REPORTED:     ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['DISPATCHED', 'CLOSED'],
  DISPATCHED:   ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS:  ['RESOLVED'],
  RESOLVED:     ['CLOSED'],
  CLOSED:       [],
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.REPORTED
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 2,
      fontSize: 10, fontFamily: T.mono, fontWeight: 600, letterSpacing: '.08em',
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: s.color,
        boxShadow: ['IN_PROGRESS','DISPATCHED'].includes(status) ? `0 0 6px ${s.color}` : 'none',
        animation: status === 'IN_PROGRESS' ? 'pulseDot 1.5s infinite' : 'none',
      }} />
      {s.label.toUpperCase()}
    </span>
  )
}

function StatCard({ label, value, color = T.amber, sub }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${color}`, borderRadius: 3,
      padding: '18px 20px', minWidth: 140,
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.15em', color: T.muted, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: T.mono, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid rgba(245,158,11,.2)`, borderTopColor: T.amber,
      borderRadius: '50%', animation: 'spin .7s linear infinite',
    }} />
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const c = type === 'error' ? T.red : T.green
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.surface, border: `1px solid ${c}50`,
      borderLeft: `3px solid ${c}`, padding: '12px 16px', borderRadius: 3,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      fontFamily: T.mono, fontSize: 12, color: type === 'error' ? '#f87171' : '#86efac',
      maxWidth: 340, animation: 'slideIn .25s ease',
    }}>
      {type === 'error' ? '✕' : '✓'} {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 4 }}>✕</button>
    </div>
  )
}

// ─── Assign modal ─────────────────────────────────────────────────────────────
function AssignModal({ incident, onClose, onAssigned }) {
  const [vehicleId, setVehicleId] = useState(incident.assignedVehicleId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nearestLoading, setNearestLoading] = useState(false)
  const [nearest, setNearest] = useState([])

  const loadNearest = async () => {
    setNearestLoading(true)
    try {
      const { data } = await api.getNearestResponders({
        lat: incident.latitude, lon: incident.longitude, limit: 5
      })
      setNearest(data.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setNearestLoading(false)
    }
  }

  useEffect(() => { loadNearest() }, [])

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!vehicleId.trim()) { setError('Vehicle ID is required.'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.assignResponder(incident.id, vehicleId.trim())
      onAssigned(data.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(6,8,16,.8)',backdropFilter:'blur(2px)' }} />
      <div style={{
        position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        zIndex:201,width:'100%',maxWidth:480,
        background:T.surface,border:`1px solid ${T.border}`,
        borderTop:`2px solid ${T.amber}`,borderRadius:4,
        padding:'28px 28px 24px',boxShadow:'0 24px 64px rgba(0,0,0,.6)',
      }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:T.mono,fontSize:12,fontWeight:700,color:'#f0f6fc' }}>ASSIGN RESPONDER</div>
            <div style={{ fontSize:12,color:T.muted,marginTop:3 }}>{TYPE_ICON[incident.type]} {incident.type} — {incident.id.slice(0,16)}…</div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:14 }}>✕</button>
        </div>

        {error && <div style={{ background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',borderLeft:'3px solid #ef4444',color:'#f87171',fontFamily:T.mono,fontSize:12,padding:'10px 14px',borderRadius:3,marginBottom:16 }}>⚠ {error}</div>}

        {/* Nearest responders */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted,marginBottom:10 }}>NEAREST AVAILABLE UNITS</div>
          {nearestLoading ? (
            <div style={{ display:'flex',alignItems:'center',gap:8,color:T.muted,fontSize:12 }}><Spinner size={12} /> Finding nearest units…</div>
          ) : nearest.length === 0 ? (
            <div style={{ color:T.muted,fontSize:12,fontFamily:T.mono }}>No units currently available</div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
              {nearest.map((r) => (
                <button key={r.id} onClick={() => setVehicleId(r.id)} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  background: vehicleId === r.id ? 'rgba(245,158,11,.1)' : T.raised,
                  border:`1px solid ${vehicleId === r.id ? T.amber : T.border}`,
                  borderRadius:3,padding:'10px 12px',cursor:'pointer',
                  transition:'all .15s',textAlign:'left',
                }}>
                  <div>
                    <div style={{ fontFamily:T.mono,fontSize:11,color:'#f0f6fc',fontWeight:600 }}>{r.name}</div>
                    <div style={{ fontFamily:T.mono,fontSize:10,color:T.muted,marginTop:2 }}>{r.type.replace('_',' ')}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:T.mono,fontSize:11,color:T.amber }}>{r.distanceKm} km</div>
                    <div style={{ fontFamily:T.mono,fontSize:9,color:T.green,marginTop:2 }}>AVAILABLE</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual entry */}
        <form onSubmit={handleAssign}>
          <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted,marginBottom:6 }}>OR ENTER VEHICLE ID MANUALLY</div>
          <div style={{ display:'flex',gap:8 }}>
            <input
              value={vehicleId} onChange={e => setVehicleId(e.target.value)}
              placeholder="Vehicle / Responder ID…"
              style={{ flex:1,background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,padding:'9px 12px',fontFamily:T.mono,fontSize:12,color:T.text,outline:'none' }}
            />
            <button type="submit" disabled={loading} style={{
              display:'inline-flex',alignItems:'center',gap:6,
              background:T.amber,color:T.bg,border:'none',borderRadius:3,
              padding:'9px 16px',fontFamily:T.mono,fontSize:12,fontWeight:700,cursor:'pointer',
              opacity: loading ? .6 : 1,
            }}>
              {loading ? <Spinner size={12} /> : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Incident Row ──────────────────────────────────────────────────────────────
function IncidentRow({ incident, idx, onUpdated, onAssign }) {
  const [advancing, setAdvancing] = useState(false)
  const nextStatuses = NEXT[incident.status] || []

  const advance = async (status) => {
    setAdvancing(true)
    try {
      const { data } = await api.updateIncidentStatus(incident.id, status)
      onUpdated(data.data)
    } catch (e) { /* parent handles toast */ }
    finally { setAdvancing(false) }
  }

  return (
    <div style={{
      background: idx % 2 === 0 ? T.surface : 'rgba(22,27,34,.5)',
      borderBottom: `1px solid ${T.raised}`,
      borderLeft: `3px solid ${STATUS[incident.status]?.color || T.amber}`,
      padding: '14px 20px',
      transition: 'background .15s',
    }}>
      {/* Top row */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:20 }}>{TYPE_ICON[incident.type] || '⚠'}</span>
          <div>
            <div style={{ fontSize:13,color:'#f0f6fc',fontWeight:500,marginBottom:3,maxWidth:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {incident.description}
            </div>
            <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>{incident.id.slice(0,16)}… · {timeAgo(incident.createdAt)}</div>
          </div>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
          <StatusBadge status={incident.status} />
        </div>
      </div>

      {/* Details row */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:16,marginBottom:12 }}>
        <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>
          <span style={{ color:T.dim }}>LAT </span>
          <span style={{ color:T.amber }}>{incident.latitude}</span>
          <span style={{ color:T.dim }}> · LON </span>
          <span style={{ color:T.amber }}>{incident.longitude}</span>
        </div>
        {incident.assignedVehicleId && (
          <div style={{ fontFamily:T.mono,fontSize:11,color:T.green }}>
            ✓ Assigned: {incident.assignedVehicleId.slice(0,12)}…
          </div>
        )}
        {incident.reportedBy && (
          <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>
            Reported by: {incident.reportedBy.slice(0,12)}…
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:8,alignItems:'center' }}>
        {/* Assign button */}
        {!['RESOLVED','CLOSED'].includes(incident.status) && (
          <button onClick={() => onAssign(incident)} style={{
            display:'inline-flex',alignItems:'center',gap:5,
            background:'transparent',border:`1px solid ${T.border}`,
            color:T.muted,borderRadius:3,padding:'5px 10px',
            fontFamily:T.mono,fontSize:10,cursor:'pointer',
            transition:'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.color = T.amber }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted }}
          >
            👥 Assign Responder
          </button>
        )}

        {/* Status advance buttons */}
        {nextStatuses.map(s => {
          const meta = STATUS[s]
          return (
            <button key={s} onClick={() => advance(s)} disabled={advancing} style={{
              display:'inline-flex',alignItems:'center',gap:5,
              background: `${meta.color}12`,border:`1px solid ${meta.color}40`,
              color:meta.color,borderRadius:3,padding:'5px 10px',
              fontFamily:T.mono,fontSize:10,fontWeight:600,cursor:'pointer',
              opacity: advancing ? .5 : 1,transition:'all .15s',
            }}>
              {advancing ? <Spinner size={10} /> : `→ ${meta.label.toUpperCase()}`}
            </button>
          )
        })}

        {incident.status === 'CLOSED' && (
          <span style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>Incident closed — no further actions</span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function DispatchDashboard() {
  const [incidents, setIncidents]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [toast, setToast]           = useState(null)
  const [filter, setFilter]         = useState('')
  const [assignTarget, setAssignTarget] = useState(null)
  const [lastRefresh, setLastRefresh]   = useState(null)

  const notify = (msg, type = 'success') => setToast({ message: msg, type })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.getOpenIncidents()
      setIncidents(data.data || [])
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const handleUpdated = (updated) => {
    setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    notify('Incident status updated')
  }

  const handleAssigned = (updated) => {
    setAssignTarget(null)
    setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    notify('Responder assigned successfully')
  }

  const filtered = filter
    ? incidents.filter(i => i.status === filter)
    : incidents

  // Summary counts
  const counts = incidents.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:T.sans, color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from { opacity:0;transform:translateX(20px); } to { opacity:1;transform:translateX(0); } }
        * { box-sizing: border-box; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {assignTarget && (
        <AssignModal
          incident={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={handleAssigned}
        />
      )}

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:28 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
              <div style={{ width:3,height:24,background:T.amber,borderRadius:2 }} />
              <h1 style={{ fontFamily:T.mono,fontSize:20,fontWeight:700,color:'#f0f6fc',margin:0 }}>
                DISPATCH STATUS DASHBOARD
              </h1>
            </div>
            <p style={{ color:T.muted,fontSize:13,marginLeft:13,margin:0 }}>
              {loading ? 'Loading…' : `${incidents.length} active incident${incidents.length !== 1 ? 's' : ''}`}
              {lastRefresh && !loading && (
                <span style={{ marginLeft:12, fontFamily:T.mono, fontSize:10, color:T.dim }}>
                  refreshed {timeAgo(lastRefresh)}
                </span>
              )}
            </p>
          </div>
          <button onClick={load} disabled={loading} style={{
            display:'inline-flex',alignItems:'center',gap:6,
            background:'transparent',border:`1px solid ${T.border}`,
            color:T.muted,borderRadius:3,padding:'8px 14px',
            fontFamily:T.mono,fontSize:11,cursor:'pointer',
          }}>
            {loading ? <Spinner size={12} /> : '↻'} Refresh
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:28 }}>
          <StatCard label="REPORTED"     value={counts.REPORTED     || 0} color={T.amber} />
          <StatCard label="ACKNOWLEDGED" value={counts.ACKNOWLEDGED || 0} color={T.blue} />
          <StatCard label="DISPATCHED"   value={counts.DISPATCHED   || 0} color={T.amber} />
          <StatCard label="IN PROGRESS"  value={counts.IN_PROGRESS  || 0} color={T.orange} />
          <StatCard label="TOTAL ACTIVE" value={incidents.length}          color={T.green} sub="non-closed" />
        </div>

        {/* Filter bar */}
        <div style={{
          display:'flex',flexWrap:'wrap',gap:8,marginBottom:20,
          padding:'12px 14px',background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:3,
        }}>
          <span style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,alignSelf:'center' }}>FILTER:</span>
          {['', 'REPORTED', 'ACKNOWLEDGED', 'DISPATCHED', 'IN_PROGRESS'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding:'5px 10px',borderRadius:2,fontFamily:T.mono,fontSize:10,
              cursor:'pointer',transition:'all .15s',
              background: filter === s ? T.amberDim : 'transparent',
              border: `1px solid ${filter === s ? T.amber : T.border}`,
              color: filter === s ? T.amber : T.muted,
            }}>
              {s || 'ALL'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',
            borderLeft:'3px solid #ef4444',color:'#f87171',
            fontFamily:T.mono,fontSize:12,padding:'12px 16px',borderRadius:3,marginBottom:20,
            display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            ⚠ {error}
            <button onClick={load} style={{ color:'#f87171',background:'none',border:'none',cursor:'pointer',fontFamily:T.mono,fontSize:11 }}>Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display:'flex',flexDirection:'column',gap:1 }}>
            {[...Array(5)].map((_,i) => (
              <div key={i} style={{ height:100,background:T.surface,borderBottom:`1px solid ${T.raised}`,opacity:1-i*.12 }} />
            ))}
          </div>
        )}

        {/* Incident list */}
        {!loading && (
          filtered.length === 0 ? (
            <div style={{
              textAlign:'center',padding:'64px 24px',
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,
            }}>
              <div style={{ fontSize:40,marginBottom:12 }}>📡</div>
              <p style={{ color:T.muted,fontFamily:T.mono,fontSize:12 }}>
                {filter ? `No incidents with status ${filter}` : 'No active incidents — all clear'}
              </p>
            </div>
          ) : (
            <div style={{ border:`1px solid ${T.border}`,borderRadius:3,overflow:'hidden' }}>
              {/* Table header */}
              <div style={{ padding:'10px 20px',background:T.raised,borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim }}>
                  ACTIVE INCIDENTS — {filtered.length} RECORD{filtered.length !== 1 ? 'S' : ''}
                </div>
              </div>
              {filtered.map((inc, idx) => (
                <IncidentRow
                  key={inc.id}
                  incident={inc}
                  idx={idx}
                  onUpdated={handleUpdated}
                  onAssign={setAssignTarget}
                />
              ))}
            </div>
          )
        )}

        {/* Legend */}
        <div style={{
          marginTop:28,padding:'12px 16px',
          background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,
          display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',
        }}>
          <span style={{ fontFamily:T.mono,fontSize:9,color:T.dim,letterSpacing:'.12em' }}>LIFECYCLE:</span>
          {['REPORTED','ACKNOWLEDGED','DISPATCHED','IN_PROGRESS','RESOLVED','CLOSED'].map(s => (
            <div key={s} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:STATUS[s].color }} />
              <span style={{ fontFamily:T.mono,fontSize:10,color:STATUS[s].color }}>{STATUS[s].label}</span>
            </div>
          ))}
          <span style={{ marginLeft:'auto',fontFamily:T.mono,fontSize:9,color:T.dim }}>Auto-refreshes every 30s</span>
        </div>
      </div>
    </div>
  )
}
