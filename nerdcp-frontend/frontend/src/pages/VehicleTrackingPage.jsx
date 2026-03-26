/**
 * NERDCP — Vehicle Tracking Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Lists all registered vehicles with their status and GPS coordinates.
 * Selecting a vehicle fetches its latest location.
 * Includes a simple map placeholder showing GPS coordinates visually.
 *
 * Connect to your router:
 *   <Route path="/vehicles" element={<VehicleTrackingPage />} />
 *
 * API calls:
 *   GET /vehicles              — list all vehicles
 *   GET /vehicles/:id/location — latest GPS ping for a vehicle
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/api'

const T = {
  bg: '#060810', surface: '#0d1117', raised: '#161b22', border: '#21262d',
  text: '#c9d1d9', muted: '#8b949e', dim: '#30363d',
  amber: '#f59e0b', amberDim: 'rgba(245,158,11,.1)',
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6', orange: '#f97316',
  purple: '#8b5cf6',
  mono: "'Syne Mono', monospace", sans: "'DM Sans', sans-serif",
}

const VEHICLE_TYPES = {
  AMBULANCE:   { icon: '🚑', color: T.blue },
  FIRE_TRUCK:  { icon: '🚒', color: T.red },
  POLICE_CAR:  { icon: '🚔', color: T.purple },
  HAZMAT_UNIT: { icon: '☢',  color: T.orange },
  RESCUE_TEAM: { icon: '🛟',  color: T.green },
}

const VEHICLE_STATUS = {
  AVAILABLE: { label: 'Available', color: T.green,  bg: 'rgba(34,197,94,.1)' },
  BUSY:      { label: 'Busy',      color: T.orange, bg: 'rgba(249,115,22,.1)' },
  OFFLINE:   { label: 'Offline',   color: T.muted,  bg: 'rgba(139,148,158,.08)' },
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
  const s = VEHICLE_STATUS[status] || VEHICLE_STATUS.OFFLINE
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:5,
      padding:'3px 8px',borderRadius:2,
      fontSize:10,fontFamily:T.mono,fontWeight:600,letterSpacing:'.08em',
      color:s.color,background:s.bg,border:`1px solid ${s.color}30`,
    }}>
      <span style={{
        width:5,height:5,borderRadius:'50%',background:s.color,
        animation: status === 'BUSY' ? 'pulseDot 1.5s infinite' : 'none',
        boxShadow: status === 'AVAILABLE' ? `0 0 6px ${s.color}` : 'none',
      }} />
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

// ─── GPS Map Placeholder ───────────────────────────────────────────────────────
// Shows a simple grid with a pin marker at the vehicle's coordinates.
// Replace with a real Leaflet/Google Maps component when ready.
function MapPlaceholder({ vehicle, location }) {
  const lat = location?.latitude  ?? vehicle?.latitude  ?? null
  const lon = location?.longitude ?? vehicle?.longitude ?? null

  return (
    <div style={{
      position:'relative',
      background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,
      overflow:'hidden',height:260,
    }}>
      {/* Grid background */}
      <div style={{
        position:'absolute',inset:0,
        backgroundImage:`
          linear-gradient(rgba(245,158,11,.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245,158,11,.05) 1px, transparent 1px)
        `,
        backgroundSize:'30px 30px',
      }} />

      {/* Label */}
      <div style={{
        position:'absolute',top:12,left:12,zIndex:2,
        fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,
        background:T.surface,border:`1px solid ${T.border}`,
        padding:'4px 8px',borderRadius:2,
      }}>
        MAP VIEW — PLACEHOLDER
      </div>

      {/* Coordinates display */}
      {lat !== null && lon !== null ? (
        <>
          {/* Crosshair pin at center */}
          <div style={{
            position:'absolute',top:'50%',left:'50%',
            transform:'translate(-50%,-50%)',
            display:'flex',flexDirection:'column',alignItems:'center',
            zIndex:3,
          }}>
            {/* Pulse ring */}
            <div style={{
              position:'absolute',
              width:40,height:40,borderRadius:'50%',
              border:`2px solid ${VEHICLE_TYPES[vehicle?.type]?.color || T.amber}`,
              animation:'pingRing 1.5s infinite',
              opacity:.4,
            }} />
            {/* Icon */}
            <div style={{
              width:36,height:36,borderRadius:'50%',
              background:T.surface,border:`2px solid ${VEHICLE_TYPES[vehicle?.type]?.color || T.amber}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:16,zIndex:1,
              boxShadow:`0 0 16px ${VEHICLE_TYPES[vehicle?.type]?.color || T.amber}40`,
            }}>
              {VEHICLE_TYPES[vehicle?.type]?.icon || '📍'}
            </div>
            {/* Name tag */}
            <div style={{
              marginTop:6,background:T.surface,border:`1px solid ${T.border}`,
              borderRadius:2,padding:'3px 8px',
              fontFamily:T.mono,fontSize:10,color:'#f0f6fc',whiteSpace:'nowrap',
            }}>
              {vehicle?.name || vehicle?.plateNumber || 'Unknown'}
            </div>
          </div>

          {/* Coordinate readout */}
          <div style={{
            position:'absolute',bottom:12,left:12,right:12,
            display:'flex',justifyContent:'center',gap:24,
            fontFamily:T.mono,fontSize:11,
          }}>
            <span><span style={{ color:T.dim }}>LAT </span><span style={{ color:T.amber }}>{lat}</span></span>
            <span><span style={{ color:T.dim }}>LON </span><span style={{ color:T.amber }}>{lon}</span></span>
            {location?.recordedAt && (
              <span style={{ color:T.dim }}>Updated {timeAgo(location.recordedAt)}</span>
            )}
          </div>
        </>
      ) : (
        <div style={{
          position:'absolute',inset:0,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:8,
        }}>
          <div style={{ fontSize:28 }}>📡</div>
          <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>No GPS data available</div>
          <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>Vehicle has not reported a location yet</div>
        </div>
      )}
    </div>
  )
}

// ─── Vehicle Detail Panel ──────────────────────────────────────────────────────
function VehicleDetail({ vehicle, onClose }) {
  const [location, setLocation]     = useState(null)
  const [locLoading, setLocLoading] = useState(true)
  const [locError, setLocError]     = useState('')

  useEffect(() => {
    const fetchLocation = async () => {
      setLocLoading(true)
      try {
        const { data } = await api.getVehicleLocation(vehicle.id)
        setLocation(data.data || data)
      } catch (e) {
        // 404 just means no GPS yet — not an error worth showing
        if (!e.message?.includes('404') && !e.message?.includes('not found')) {
          setLocError(e.message)
        }
      } finally {
        setLocLoading(false)
      }
    }
    fetchLocation()
    const interval = setInterval(fetchLocation, 10000) // refresh every 10s
    return () => clearInterval(interval)
  }, [vehicle.id])

  const tm = VEHICLE_TYPES[vehicle.type] || VEHICLE_TYPES.RESCUE_TEAM

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,zIndex:100,background:'rgba(6,8,16,.7)',backdropFilter:'blur(2px)' }} />
      <div style={{
        position:'fixed',right:0,top:0,bottom:0,zIndex:101,
        width:'100%',maxWidth:440,
        background:T.surface,borderLeft:`1px solid ${T.border}`,
        borderTop:`3px solid ${tm.color}`,
        display:'flex',flexDirection:'column',
        boxShadow:'-16px 0 48px rgba(0,0,0,.5)',
        animation:'slideFromRight .3s ease',
        overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:`1px solid ${T.raised}`,flexShrink:0 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                <span style={{ fontSize:24 }}>{tm.icon}</span>
                <span style={{ fontFamily:T.mono,fontSize:12,color:tm.color,fontWeight:700,letterSpacing:'.08em' }}>
                  {vehicle.type?.replace('_',' ')}
                </span>
              </div>
              <StatusBadge status={vehicle.status} />
            </div>
            <button onClick={onClose} style={{ background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:14,padding:4 }}>✕</button>
          </div>
          <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim,marginTop:10 }}>
            ID: {vehicle.id?.slice(0,20)}…
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1,overflow:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:20 }}>

          {/* Vehicle info */}
          <section>
            <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${T.raised}` }}>VEHICLE INFO</div>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {[
                ['Name',         vehicle.name         || '—'],
                ['Plate Number', vehicle.plateNumber   || '—'],
                ['Type',         vehicle.type?.replace('_',' ') || '—'],
                ['Driver ID',    vehicle.driverId      ? vehicle.driverId.slice(0,16)+'…' : '—'],
                ['Station',      vehicle.responderStationId ? vehicle.responderStationId.slice(0,16)+'…' : '—'],
                ['Registered',   vehicle.registeredAt  ? new Date(vehicle.registeredAt).toLocaleString() : '—'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${T.raised}` }}>
                  <span style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>{k}</span>
                  <span style={{ fontFamily:T.mono,fontSize:11,color:T.text }}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Live location */}
          <section>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,paddingBottom:6,borderBottom:`1px solid ${T.raised}`,flex:1 }}>
                LIVE LOCATION
              </div>
              {locLoading && <Spinner size={12} />}
            </div>

            {locError && (
              <div style={{ fontFamily:T.mono,fontSize:11,color:'#f87171',marginBottom:10 }}>⚠ {locError}</div>
            )}

            <MapPlaceholder vehicle={vehicle} location={location} />

            {location && (
              <div style={{ marginTop:12,display:'flex',flexDirection:'column',gap:6 }}>
                {[
                  ['Speed',    location.speed_kmh != null ? `${location.speed_kmh} km/h` : '—'],
                  ['Heading',  location.heading_degrees != null ? `${location.heading_degrees}°` : '—'],
                  ['Accuracy', location.accuracy_meters != null ? `±${location.accuracy_meters}m` : '—'],
                  ['Updated',  location.recordedAt ? new Date(location.recordedAt).toLocaleString() : '—'],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex',justifyContent:'space-between' }}>
                    <span style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>{k}</span>
                    <span style={{ fontFamily:T.mono,fontSize:11,color:T.amber }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Current incident */}
          {vehicle.currentIncidentId && (
            <section>
              <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${T.raised}` }}>CURRENT ASSIGNMENT</div>
              <div style={{
                background:T.raised,border:`1px solid ${T.border}`,borderLeft:`3px solid ${T.orange}`,
                borderRadius:3,padding:'10px 14px',fontFamily:T.mono,fontSize:11,color:T.orange,
              }}>
                Incident: {vehicle.currentIncidentId.slice(0,20)}…
              </div>
            </section>
          )}

        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function VehicleTrackingPage() {
  const [vehicles, setVehicles]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState(null)
  const [toast, setToast]         = useState(null)
  const [filterType, setFilterType]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch]       = useState('')
  const [lastRefresh, setLastRefresh]   = useState(null)

  const notify = (msg, type = 'success') => setToast({ message: msg, type })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filterType)   params.type   = filterType
      if (filterStatus) params.status = filterStatus
      const { data } = await api.getVehicles(params)
      setVehicles(data.data || data.vehicles || [])
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus])

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000) // refresh every 20s
    return () => clearInterval(interval)
  }, [load])

  const displayed = vehicles.filter(v => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      v.name?.toLowerCase().includes(q) ||
      v.plateNumber?.toLowerCase().includes(q) ||
      v.type?.toLowerCase().includes(q)
    )
  })

  // Counts by status
  const counts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ minHeight:'100vh',background:T.bg,fontFamily:T.sans,color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes pingRing { 0%{transform:scale(1);opacity:.4} 100%{transform:scale(2.5);opacity:0} }
        @keyframes slideIn { from { opacity:0;transform:translateX(20px); } to { opacity:1;transform:translateX(0); } }
        @keyframes slideFromRight { from{transform:translateX(100%)} to{transform:translateX(0)} }
        * { box-sizing: border-box; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {selected && <VehicleDetail vehicle={selected} onClose={() => setSelected(null)} />}

      <div style={{ maxWidth:1200,margin:'0 auto',padding:'32px 24px' }}>

        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:28 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
              <div style={{ width:3,height:24,background:T.amber,borderRadius:2 }} />
              <h1 style={{ fontFamily:T.mono,fontSize:20,fontWeight:700,color:'#f0f6fc',margin:0 }}>
                VEHICLE TRACKING
              </h1>
            </div>
            <p style={{ color:T.muted,fontSize:13,marginLeft:13,margin:0 }}>
              {loading ? 'Loading…' : `${vehicles.length} vehicle${vehicles.length !== 1 ? 's' : ''} registered`}
              {lastRefresh && !loading && (
                <span style={{ marginLeft:12,fontFamily:T.mono,fontSize:10,color:T.dim }}>
                  · refreshed {timeAgo(lastRefresh)}
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

        {/* Stat cards */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:28 }}>
          {Object.entries(VEHICLE_STATUS).map(([key, meta]) => (
            <div key={key} style={{
              background:T.surface,border:`1px solid ${T.border}`,
              borderTop:`2px solid ${meta.color}`,borderRadius:3,
              padding:'16px 20px',minWidth:130,
            }}>
              <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted,marginBottom:8 }}>{key}</div>
              <div style={{ fontSize:26,fontWeight:700,color:meta.color,fontFamily:T.mono }}>{counts[key] || 0}</div>
            </div>
          ))}
          <div style={{
            background:T.surface,border:`1px solid ${T.border}`,
            borderTop:`2px solid ${T.blue}`,borderRadius:3,
            padding:'16px 20px',minWidth:130,
          }}>
            <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted,marginBottom:8 }}>TOTAL</div>
            <div style={{ fontSize:26,fontWeight:700,color:T.blue,fontFamily:T.mono }}>{vehicles.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display:'flex',flexWrap:'wrap',gap:10,marginBottom:20,
          padding:'12px 14px',background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:3,
        }}>
          <input
            placeholder="Search vehicles…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex:1,minWidth:160,background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,padding:'8px 12px',fontFamily:T.mono,fontSize:11,color:T.text,outline:'none' }}
          />
          <select value={filterType} onChange={e => { setFilterType(e.target.value) }} style={{ background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,padding:'8px 10px',fontFamily:T.mono,fontSize:11,color:T.text,outline:'none',cursor:'pointer' }}>
            <option value="">All Types</option>
            {Object.keys(VEHICLE_TYPES).map(t => (
              <option key={t} value={t}>{VEHICLE_TYPES[t].icon} {t.replace('_',' ')}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value) }} style={{ background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,padding:'8px 10px',fontFamily:T.mono,fontSize:11,color:T.text,outline:'none',cursor:'pointer' }}>
            <option value="">All Statuses</option>
            {Object.keys(VEHICLE_STATUS).map(s => (
              <option key={s} value={s}>{VEHICLE_STATUS[s].label}</option>
            ))}
          </select>
          <button onClick={() => { setFilterType(''); setFilterStatus(''); setSearch('') }} style={{ background:'transparent',border:`1px solid ${T.border}`,color:T.muted,borderRadius:3,padding:'8px 12px',fontFamily:T.mono,fontSize:11,cursor:'pointer' }}>
            Clear
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.3)',
            borderLeft:'3px solid #ef4444',color:'#f87171',
            fontFamily:T.mono,fontSize:12,padding:'12px 16px',borderRadius:3,marginBottom:20,
            display:'flex',justifyContent:'space-between',
          }}>
            ⚠ {error}
            <button onClick={load} style={{ color:'#f87171',background:'none',border:'none',cursor:'pointer',fontFamily:T.mono,fontSize:11 }}>Retry</button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12 }}>
            {[...Array(6)].map((_,i) => (
              <div key={i} style={{ height:140,background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,opacity:1-i*.1 }} />
            ))}
          </div>
        )}

        {/* Vehicle grid */}
        {!loading && (
          displayed.length === 0 ? (
            <div style={{
              textAlign:'center',padding:'64px 24px',
              background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,
            }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🚗</div>
              <p style={{ color:T.muted,fontFamily:T.mono,fontSize:12 }}>
                {search || filterType || filterStatus ? 'No vehicles match your filters.' : 'No vehicles registered yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12 }}>
              {displayed.map(vehicle => {
                const tm = VEHICLE_TYPES[vehicle.type] || VEHICLE_TYPES.RESCUE_TEAM
                const sm = VEHICLE_STATUS[vehicle.status] || VEHICLE_STATUS.OFFLINE
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelected(vehicle)}
                    style={{
                      background:T.surface,border:`1px solid ${T.border}`,
                      borderTop:`2px solid ${tm.color}`,borderRadius:3,
                      padding:'16px 18px',cursor:'pointer',
                      transition:'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = tm.color; e.currentTarget.style.background = T.raised }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface }}
                  >
                    {/* Vehicle header */}
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                        <span style={{ fontSize:22 }}>{tm.icon}</span>
                        <div>
                          <div style={{ fontSize:13,fontWeight:600,color:'#f0f6fc' }}>
                            {vehicle.name || vehicle.plateNumber || 'Unknown'}
                          </div>
                          <div style={{ fontFamily:T.mono,fontSize:10,color:T.muted,marginTop:2 }}>
                            {vehicle.type?.replace('_',' ')}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={vehicle.status} />
                    </div>

                    {/* Coordinates or no-data */}
                    {vehicle.latitude != null ? (
                      <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted,marginBottom:10 }}>
                        <span style={{ color:T.dim }}>LAT </span><span style={{ color:T.amber }}>{vehicle.latitude}</span>
                        <span style={{ color:T.dim }}> · LON </span><span style={{ color:T.amber }}>{vehicle.longitude}</span>
                      </div>
                    ) : (
                      <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim,marginBottom:10 }}>No GPS data yet</div>
                    )}

                    {/* Plate */}
                    {vehicle.plateNumber && (
                      <div style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>
                        Plate: <span style={{ color:T.text }}>{vehicle.plateNumber}</span>
                      </div>
                    )}

                    {/* Current incident tag */}
                    {vehicle.currentIncidentId && (
                      <div style={{
                        marginTop:10,padding:'4px 8px',
                        background:'rgba(249,115,22,.08)',border:'1px solid rgba(249,115,22,.3)',
                        borderRadius:2,fontFamily:T.mono,fontSize:10,color:T.orange,
                      }}>
                        📌 On call: {vehicle.currentIncidentId.slice(0,12)}…
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${T.raised}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <span style={{ fontFamily:T.mono,fontSize:9,color:T.dim }}>
                        {vehicle.updatedAt ? `Updated ${timeAgo(vehicle.updatedAt)}` : ''}
                      </span>
                      <span style={{ fontFamily:T.mono,fontSize:10,color:T.amber }}>View details →</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Fleet summary legend */}
        <div style={{
          marginTop:28,padding:'12px 16px',
          background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,
          display:'flex',flexWrap:'wrap',gap:20,alignItems:'center',
        }}>
          <span style={{ fontFamily:T.mono,fontSize:9,color:T.dim,letterSpacing:'.12em' }}>FLEET:</span>
          {Object.entries(VEHICLE_TYPES).map(([k,v]) => (
            <div key={k} style={{ display:'flex',alignItems:'center',gap:5 }}>
              <span>{v.icon}</span>
              <span style={{ fontFamily:T.mono,fontSize:10,color:v.color }}>{k.replace('_',' ')}</span>
              <span style={{ fontFamily:T.mono,fontSize:10,color:T.dim }}>
                ({vehicles.filter(veh => veh.type === k).length})
              </span>
            </div>
          ))}
          <span style={{ marginLeft:'auto',fontFamily:T.mono,fontSize:9,color:T.dim }}>Auto-refreshes every 20s · Click any card for live location</span>
        </div>
      </div>
    </div>
  )
}
