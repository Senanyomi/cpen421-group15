/**
 * NERDCP — Vehicle Tracking Page
 * ─────────────────────────────────────────────────────────────────────────────
 * API connections:
 *   GET /vehicles              → fleet list with status + last position
 *   GET /vehicles/:id/location → live GPS fix for a selected vehicle
 *
 * Drop into your project:
 *   1. Copy to src/pages/VehiclesPage.jsx
 *   2. Router: <Route path="/vehicles" element={<VehiclesPage />} />
 *   3. .env: VITE_DISPATCH_URL=http://localhost:3003
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISPATCH_URL
    ? import.meta.env.VITE_DISPATCH_URL
    : 'http://localhost:3003'

const POLL_INTERVAL_MS = 15_000 // refresh fleet every 15 s

// ─── HTTP HELPER ──────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('nerdcp_token') || ''

const http = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`)
  return data
}

const apiError = (err) => err?.message || 'Unexpected error.'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const VEHICLE_META = {
  AMBULANCE:    { icon: '🚑', label: 'Ambulance',    color: '#3b82f6' },
  POLICE_CAR:   { icon: '🚔', label: 'Police Car',   color: '#6366f1' },
  FIRE_TRUCK:   { icon: '🚒', label: 'Fire Truck',   color: '#ef4444' },
  HAZMAT_UNIT:  { icon: '🛻', label: 'HazMat',       color: '#eab308' },
  RESCUE_TEAM:  { icon: '🚁', label: 'Rescue',       color: '#22c55e' },
  COMMAND_UNIT: { icon: '📡', label: 'Command',      color: '#f59e0b' },
}

const STATUS_META = {
  AVAILABLE:  { label: 'Available', color: '#22c55e', bg: 'rgba(34,197,94,.1)',   glow: '#22c55e' },
  DISPATCHED: { label: 'Dispatched',color: '#f59e0b', bg: 'rgba(245,158,11,.12)', glow: '#f59e0b' },
  ON_SCENE:   { label: 'On Scene',  color: '#f97316', bg: 'rgba(249,115,22,.1)',  glow: '#f97316' },
  RETURNING:  { label: 'Returning', color: '#3b82f6', bg: 'rgba(59,130,246,.1)',  glow: '#3b82f6' },
  OFFLINE:    { label: 'Offline',   color: '#8b949e', bg: 'rgba(139,148,158,.08)',glow: 'none'   },
}

const ALL_TYPES    = Object.keys(VEHICLE_META)
const ALL_STATUSES = Object.keys(STATUS_META)

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtCoord = (n, decimals = 4) =>
  n == null ? '—' : Number(n).toFixed(decimals)

const timeAgo = (iso) => {
  if (!iso) return 'never'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid rgba(245,158,11,.2)',
      borderTopColor: '#f59e0b', borderRadius: '50%',
      animation: 'spin .7s linear infinite', flexShrink: 0,
    }} />
  )
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.OFFLINE
  const pulse = ['DISPATCHED', 'ON_SCENE'].includes(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 2,
      fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.1em',
      color: m.color, background: m.bg, border: `1px solid ${m.color}35`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: m.color,
        boxShadow: m.glow !== 'none' ? `0 0 5px ${m.glow}` : 'none',
        animation: pulse ? 'pulseDot 1.4s infinite' : 'none',
      }} />
      {m.label.toUpperCase()}
    </span>
  )
}

// ── Mini "map" placeholder for selected vehicle ────────────────────────────
function MapPlaceholder({ vehicle, liveLocation, loadingLoc }) {
  const loc = liveLocation || vehicle
  const hasPos = loc?.latitude != null && loc?.longitude != null
  const vm = VEHICLE_META[vehicle.type] || VEHICLE_META.COMMAND_UNIT

  return (
    <div style={{
      position: 'relative',
      background: '#0a0f15',
      border: '1px solid #21262d',
      borderRadius: 4,
      overflow: 'hidden',
      height: 280,
    }}>
      {/* SVG grid — looks like a tactical map */}
      <svg
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,158,11,.04)" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#smallGrid)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(245,158,11,.08)" strokeWidth="1" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={vm.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={vm.color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Range rings */}
        <circle cx="50%" cy="50%" r="60" fill="none" stroke={`${vm.color}18`} strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="50%" cy="50%" r="110" fill="none" stroke={`${vm.color}10`} strokeWidth="1" strokeDasharray="6 6" />

        {/* Centre glow */}
        <ellipse cx="50%" cy="50%" rx="50" ry="50" fill="url(#glow)" />

        {/* Cross-hair lines */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke={`${vm.color}20`} strokeWidth="0.5" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={`${vm.color}20`} strokeWidth="0.5" />

        {/* Vehicle dot */}
        {hasPos && (
          <>
            <circle cx="50%" cy="50%" r="12" fill={`${vm.color}20`} />
            <circle cx="50%" cy="50%" r="6" fill={vm.color} />
            <circle cx="50%" cy="50%" r="6" fill={vm.color} opacity=".5">
              <animate attributeName="r" from="6" to="20" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" from=".5" to="0" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>

      {/* Loading overlay */}
      {loadingLoc && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(6,8,16,.6)', backdropFilter: 'blur(2px)',
        }}>
          <Spinner size={20} />
        </div>
      )}

      {/* Coordinates readout */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, right: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div style={{
          background: 'rgba(6,8,16,.85)', border: '1px solid #21262d',
          borderRadius: 3, padding: '6px 10px',
          fontFamily: 'monospace', fontSize: 11,
        }}>
          {hasPos ? (
            <>
              <div style={{ color: '#8b949e', fontSize: 9, letterSpacing: '.1em', marginBottom: 3 }}>POSITION FIX</div>
              <div style={{ color: '#f59e0b' }}>
                {fmtCoord(loc.latitude)}° N &nbsp; {fmtCoord(loc.longitude)}° E
              </div>
            </>
          ) : (
            <span style={{ color: '#30363d', fontSize: 10 }}>NO GPS SIGNAL</span>
          )}
        </div>
        <div style={{
          background: 'rgba(6,8,16,.85)', border: '1px solid #21262d',
          borderRadius: 3, padding: '6px 10px',
          fontFamily: 'monospace', fontSize: 9, color: '#30363d',
          letterSpacing: '.06em',
        }}>
          SIMULATED MAP
        </div>
      </div>

      {/* Vehicle label */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        background: 'rgba(6,8,16,.85)', border: `1px solid ${vm.color}40`,
        borderRadius: 3, padding: '5px 10px',
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <span style={{ fontSize: 14 }}>{vm.icon}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: vm.color }}>
          {vehicle.callSign}
        </span>
      </div>
    </div>
  )
}

// ── Vehicle detail panel (right sidebar) ──────────────────────────────────
function VehicleDetail({ vehicle, onClose }) {
  const [liveLocation, setLiveLocation] = useState(null)
  const [loadingLoc, setLoadingLoc]     = useState(false)
  const [locError, setLocError]         = useState('')

  const vm = VEHICLE_META[vehicle.type] || VEHICLE_META.COMMAND_UNIT
  const sm = STATUS_META[vehicle.status] || STATUS_META.OFFLINE

  const fetchLocation = useCallback(async () => {
    if (vehicle.status === 'OFFLINE') return
    setLoadingLoc(true); setLocError('')
    try {
      const data = await http(`/vehicles/${vehicle.id}/location`)
      setLiveLocation(data.data)
    } catch (e) {
      setLocError(apiError(e))
    } finally {
      setLoadingLoc(false)
    }
  }, [vehicle.id, vehicle.status])

  useEffect(() => { fetchLocation() }, [fetchLocation])

  const loc = liveLocation || vehicle

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(6,8,16,.6)' }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 101,
        width: '100%', maxWidth: 400,
        background: '#0d1117', borderLeft: '1px solid #21262d',
        borderTop: `3px solid ${vm.color}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,.5)',
        animation: 'slideFromRight .28s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #161b22', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>{vm.icon}</span>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.04em' }}>
                  {vehicle.callSign}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: vm.color, letterSpacing: '.08em', marginTop: 2 }}>
                  {vm.label.toUpperCase()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={vehicle.status} />
              <button onClick={onClose} style={S.closeBtn}>✕</button>
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', marginTop: 10, letterSpacing: '.06em' }}>
            ID: {vehicle.id?.slice(0, 20)}…
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Map placeholder */}
          <MapPlaceholder vehicle={vehicle} liveLocation={liveLocation} loadingLoc={loadingLoc} />

          {locError && (
            <div style={S.errorBanner}>⚠ {locError}</div>
          )}

          {/* GPS readout */}
          <section>
            <div style={S.sectionLabel}>GPS COORDINATES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['LATITUDE',  loc?.latitude],
                ['LONGITUDE', loc?.longitude],
              ].map(([label, val]) => (
                <div key={label} style={{
                  background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
                  padding: '10px 12px',
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.12em', marginBottom: 5 }}>{label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, color: val != null ? '#f59e0b' : '#30363d' }}>
                    {fmtCoord(val)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Last updated */}
          <section>
            <div style={S.sectionLabel}>LAST UPDATE</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#c9d1d9' }}>
              {vehicle.lastUpdated
                ? <>
                    <span style={{ color: '#f0f6fc' }}>{timeAgo(vehicle.lastUpdated)}</span>
                    <span style={{ color: '#30363d', fontSize: 10, marginLeft: 8 }}>
                      ({new Date(vehicle.lastUpdated).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })})
                    </span>
                  </>
                : <span style={{ color: '#30363d' }}>No data received</span>
              }
            </div>
          </section>

          {/* Active assignment */}
          {vehicle.assignments?.length > 0 && (
            <section>
              <div style={S.sectionLabel}>ACTIVE ASSIGNMENT</div>
              {vehicle.assignments.map(a => (
                <div key={a.id} style={{
                  background: '#161b22', border: '1px solid #21262d',
                  borderLeft: '2px solid #f59e0b',
                  borderRadius: 3, padding: '10px 14px',
                  fontFamily: 'monospace',
                }}>
                  <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: '.08em', marginBottom: 4 }}>INCIDENT ID</div>
                  <div style={{ fontSize: 12, color: '#f0f6fc', wordBreak: 'break-all' }}>{a.incidentId}</div>
                  <div style={{ fontSize: 10, color: '#30363d', marginTop: 6 }}>
                    Assigned {timeAgo(a.assignedAt)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Refresh button */}
          <button onClick={fetchLocation} disabled={loadingLoc} style={{ ...S.btnGhost, width: '100%', justifyContent: 'center' }}>
            {loadingLoc ? <><Spinner size={12} /> Updating…</> : '↻  Refresh Location'}
          </button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function VehiclesPage() {
  const [vehicles, setVehicles]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [selected, setSelected]       = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType]   = useState('')
  const [search, setSearch]           = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const pollRef                       = useRef(null)

  const loadVehicles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: 100 })
      if (filterStatus) params.set('status', filterStatus)
      if (filterType)   params.set('type', filterType)
      const data = await http(`/vehicles?${params}`)
      setVehicles(data.data || [])
      setLastRefresh(new Date())
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterType])

  // Initial load + polling
  useEffect(() => {
    loadVehicles()
    pollRef.current = setInterval(() => loadVehicles(true), POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [loadVehicles])

  // Derived counts
  const counts = vehicles.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1
    return acc
  }, {})

  // Client-side search
  const displayed = vehicles.filter(v => {
    if (search) {
      const q = search.toLowerCase()
      if (!v.callSign?.toLowerCase().includes(q) && !v.type?.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: '#060810', fontFamily: "'DM Sans', sans-serif", color: '#c9d1d9' }}>
      <style>{CSS}</style>

      {selected && (
        <VehicleDetail vehicle={selected} onClose={() => setSelected(null)} />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <div style={{ width: 3, height: 24, background: '#22c55e', borderRadius: 2 }} />
              <h1 style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.04em' }}>
                VEHICLE TRACKING
              </h1>
            </div>
            <p style={{ color: '#8b949e', fontSize: 12, marginLeft: 13 }}>
              {lastRefresh
                ? `Last updated ${timeAgo(lastRefresh)} · auto-refreshes every 15s`
                : 'Loading fleet data…'
              }
            </p>
          </div>
          <button onClick={() => loadVehicles()} style={{ ...S.btnGhost, fontSize: 11 }}>
            {loading ? <><Spinner size={11} /> Refreshing…</> : '↻  Refresh'}
          </button>
        </div>

        {/* ── Status counters ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
          {Object.entries(STATUS_META).map(([status, m]) => (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
              style={{
                background: filterStatus === status ? m.bg : '#0d1117',
                border: `1px solid ${filterStatus === status ? m.color : '#21262d'}`,
                borderBottom: `2px solid ${filterStatus === status ? m.color : '#21262d'}`,
                borderRadius: 3, padding: '12px 14px', cursor: 'pointer',
                transition: 'all .15s', textAlign: 'left',
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: m.color, lineHeight: 1 }}>
                {counts[status] || 0}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b949e', letterSpacing: '.1em', marginTop: 5 }}>
                {m.label.toUpperCase()}
              </div>
            </button>
          ))}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18,
          padding: '12px 14px', background: '#0d1117',
          border: '1px solid #21262d', borderRadius: 3,
        }}>
          <input
            placeholder="Search by callsign or type…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, flex: 1, minWidth: 160, fontSize: 12 }}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={S.select}>
            <option value="">All Types</option>
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{VEHICLE_META[t].icon} {VEHICLE_META[t].label}</option>
            ))}
          </select>
          {(search || filterStatus || filterType) && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterType('') }}
              style={{ ...S.btnGhost, fontSize: 11 }}
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div style={{ ...S.errorBanner, marginBottom: 18 }}>
            ⚠ {error}
            <button onClick={() => loadVehicles()} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Grid / loading ───────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                height: 130, background: '#0d1117', border: '1px solid #161b22',
                borderRadius: 3, animation: `shimmer 1.6s infinite ${i * .08}s`,
              }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
            <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#8b949e' }}>
              {search || filterStatus || filterType ? 'No vehicles match your filters.' : 'No vehicles registered yet.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {displayed.map((v, i) => {
              const vm = VEHICLE_META[v.type] || VEHICLE_META.COMMAND_UNIT
              const sm = STATUS_META[v.status] || STATUS_META.OFFLINE
              const isActive   = ['DISPATCHED', 'ON_SCENE'].includes(v.status)
              const isSelected = selected?.id === v.id
              const hasPos     = v.latitude != null && v.longitude != null

              return (
                <div
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{
                    background: isSelected ? '#0d1420' : '#0d1117',
                    border: `1px solid ${isSelected ? vm.color + '60' : '#21262d'}`,
                    borderTop: `2px solid ${isActive ? vm.color : '#21262d'}`,
                    borderRadius: 3, padding: '16px 18px',
                    cursor: 'pointer', transition: 'all .18s',
                    animation: `fadeInUp .3s ease ${i * .04}s both`,
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = vm.color + '40'
                      e.currentTarget.style.background = '#0d1218'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = '#21262d'
                      e.currentTarget.style.background = '#0d1117'
                    }
                  }}
                >
                  {/* Active pulse glow */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      width: 80, height: 80,
                      background: `radial-gradient(circle at top right, ${vm.color}15, transparent)`,
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ fontSize: 22 }}>{vm.icon}</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.03em' }}>
                          {v.callSign}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: vm.color, letterSpacing: '.08em', marginTop: 1 }}>
                          {vm.label.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>

                  {/* Coordinates */}
                  <div style={{
                    background: '#161b22', borderRadius: 2,
                    padding: '8px 10px', marginBottom: 10,
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#30363d', letterSpacing: '.1em', marginBottom: 3 }}>LAT</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: hasPos ? '#f59e0b' : '#30363d' }}>
                        {fmtCoord(v.latitude)}
                      </div>
                    </div>
                    <div style={{ width: 1, background: '#21262d' }} />
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#30363d', letterSpacing: '.1em', marginBottom: 3 }}>LON</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: hasPos ? '#f59e0b' : '#30363d' }}>
                        {fmtCoord(v.longitude)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: hasPos ? '#22c55e' : '#30363d',
                        boxShadow: hasPos ? '0 0 5px #22c55e' : 'none',
                      }} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#30363d' }}>
                      {v.lastUpdated ? `Updated ${timeAgo(v.lastUpdated)}` : 'No updates'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b949e' }}>
                      View →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 28, padding: '12px 16px',
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
          display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.1em' }}>
            FLEET TYPES
          </span>
          {Object.entries(VEHICLE_META).map(([type, m]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13 }}>{m.icon}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b949e' }}>{m.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.06em' }}>
            {displayed.length} UNIT{displayed.length !== 1 ? 'S' : ''} SHOWN
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const S = {
  input: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
    padding: '8px 11px', fontFamily: 'monospace', fontSize: 12,
    color: '#c9d1d9', outline: 'none', width: '100%',
  },
  select: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
    padding: '8px 10px', fontFamily: 'monospace', fontSize: 11,
    color: '#c9d1d9', outline: 'none', cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: '#8b949e',
    border: '1px solid #21262d', borderRadius: 3,
    padding: '8px 14px', fontFamily: 'monospace', fontSize: 12,
    cursor: 'pointer', transition: 'color .15s, border-color .15s',
  },
  sectionLabel: {
    fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em',
    color: '#30363d', marginBottom: 8, paddingBottom: 6,
    borderBottom: '1px solid #161b22',
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)',
    borderLeft: '3px solid #ef4444', color: '#f87171',
    fontFamily: 'monospace', fontSize: 12, padding: '10px 14px', borderRadius: 3,
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#8b949e',
    cursor: 'pointer', fontSize: 14, padding: 4,
  },
}

// ─── KEYFRAMES ────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500&display=swap');
  @keyframes spin          { to { transform: rotate(360deg); } }
  @keyframes pulseDot      { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes slideFromRight{ from { transform:translateX(100%); } to { transform:translateX(0); } }
  @keyframes fadeInUp      { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer       { 0%,100%{background:#0d1117} 50%{background:#161b22} }
  *, *::before, *::after   { box-sizing: border-box; }
  select option            { background: #161b22; }
`
