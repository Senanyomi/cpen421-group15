/**
 * NERDCP — Incident Management Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained React component. All API calls, state, and styles are included.
 *
 * API connections:
 *   POST  /incidents            → create incident
 *   GET   /incidents            → list all incidents
 *   PUT   /incidents/:id/status → update status
 *   PUT   /incidents/:id/assign → assign vehicle/responder
 *
 * Integration with your Vite project:
 *   1. Copy this file to src/pages/IncidentsPage.jsx
 *   2. Add to your router: <Route path="/incidents" element={<IncidentsPage />} />
 *   3. Set VITE_INCIDENT_URL=http://localhost:3002 in .env
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api, { apiError } from '../api'

// Note: All API calls now use centralized service with automatic token refresh interceptor

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INCIDENT_TYPES = ['FIRE', 'MEDICAL', 'POLICE', 'NATURAL_DISASTER', 'HAZMAT', 'TRAFFIC', 'OTHER']

const STATUS_FLOW = {
  REPORTED:     ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['DISPATCHED', 'CLOSED'],
  DISPATCHED:   ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS:  ['RESOLVED'],
  RESOLVED:     ['CLOSED'],
  CLOSED:       [],
}

const STATUS_META = {
  REPORTED:     { label: 'Reported',     color: '#f59e0b', bg: 'rgba(245,158,11,.1)',   dot: '#f59e0b' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: '#3b82f6', bg: 'rgba(59,130,246,.1)',   dot: '#3b82f6' },
  DISPATCHED:   { label: 'Dispatched',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  dot: '#fbbf24' },
  IN_PROGRESS:  { label: 'In Progress',  color: '#f97316', bg: 'rgba(249,115,22,.1)',   dot: '#f97316' },
  RESOLVED:     { label: 'Resolved',     color: '#22c55e', bg: 'rgba(34,197,94,.1)',    dot: '#22c55e' },
  CLOSED:       { label: 'Closed',       color: '#8b949e', bg: 'rgba(139,148,158,.08)', dot: '#8b949e' },
}

const TYPE_META = {
  FIRE:             { icon: '🔥', color: '#ef4444' },
  MEDICAL:          { icon: '🚑', color: '#3b82f6' },
  POLICE:           { icon: '🚔', color: '#6366f1' },
  NATURAL_DISASTER: { icon: '🌪️', color: '#f97316' },
  HAZMAT:           { icon: '☢️', color: '#eab308' },
  TRAFFIC:          { icon: '🚧', color: '#8b5cf6' },
  OTHER:            { icon: '⚠️', color: '#8b949e' },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.REPORTED
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 2,
      fontSize: 10, fontFamily: 'monospace', fontWeight: 600, letterSpacing: '.08em',
      color: m.color, background: m.bg,
      border: `1px solid ${m.color}30`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: m.dot,
        boxShadow: status === 'IN_PROGRESS' || status === 'DISPATCHED'
          ? `0 0 6px ${m.dot}` : 'none',
        animation: status === 'IN_PROGRESS' ? 'pulseDot 1.5s infinite' : 'none',
      }} />
      {m.label.toUpperCase()}
    </span>
  )
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.OTHER
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <span>{m.icon}</span>
      <span style={{ color: m.color, fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>
        {type.replace('_', ' ')}
      </span>
    </span>
  )
}

function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid rgba(245,158,11,.2)`,
      borderTopColor: '#f59e0b',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
    }} />
  )
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#0d1117', border: `1px solid ${type === 'error' ? '#ef444460' : '#22c55e60'}`,
      borderLeft: `3px solid ${type === 'error' ? '#ef4444' : '#22c55e'}`,
      padding: '12px 16px', borderRadius: 3,
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      fontFamily: 'monospace', fontSize: 12,
      color: type === 'error' ? '#f87171' : '#86efac',
      maxWidth: 340,
      animation: 'slideIn .25s ease',
    }}>
      {type === 'error' ? '✕' : '✓'} {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 8, opacity: .6 }}>✕</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE INCIDENT FORM
// ═══════════════════════════════════════════════════════════════════════════════
function CreateIncidentPanel({ onCreated, onClose }) {
  const [form, setForm] = useState({
    type: 'FIRE', description: '', latitude: '', longitude: '', citizenName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (!form.citizenName.trim() || form.citizenName.trim().length < 2)
      return 'Citizen name must be at least 2 characters.'
    if (!form.description.trim() || form.description.trim().length < 10)
      return 'Description must be at least 10 characters.'
    if (!form.latitude || isNaN(form.latitude))  return 'Valid latitude is required.'
    if (!form.longitude || isNaN(form.longitude)) return 'Valid longitude is required.'
    if (form.latitude < -90  || form.latitude > 90)  return 'Latitude must be between -90 and 90.'
    if (form.longitude < -180 || form.longitude > 180) return 'Longitude must be between -180 and 180.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError('')
    try {
      const res = await api.incidents.create({
        type:        form.type,
        description: form.description.trim(),
        latitude:    parseFloat(form.latitude),
        longitude:   parseFloat(form.longitude),
        citizenName: form.citizenName.trim(),
      })
      onCreated(res.data.data)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #21262d',
      borderTop: '2px solid #f59e0b',
      borderRadius: 4, padding: '28px 28px 24px',
      animation: 'slideDown .3s ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ color: '#f0f6fc', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, letterSpacing: '.06em' }}>
            NEW INCIDENT REPORT
          </h3>
          <p style={{ color: '#8b949e', fontSize: 12, marginTop: 3 }}>
            All fields marked are required
          </p>
        </div>
        <button onClick={onClose} style={STYLES.closeBtn}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={STYLES.errorBanner}>⚠ {error}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Type */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={STYLES.label}>INCIDENT TYPE</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {INCIDENT_TYPES.map(t => (
                <button
                  key={t} type="button"
                  onClick={() => set('type', t)}
                  style={{
                    ...STYLES.typeBtn,
                    borderColor: form.type === t ? TYPE_META[t]?.color : '#21262d',
                    background: form.type === t ? `${TYPE_META[t]?.color}15` : 'transparent',
                    color: form.type === t ? TYPE_META[t]?.color : '#8b949e',
                  }}
                >
                  {TYPE_META[t]?.icon} {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Citizen Name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={STYLES.label}>CITIZEN NAME *</label>
            <input
              type="text" placeholder="Full name of person reporting"
              value={form.citizenName}
              onChange={e => set('citizenName', e.target.value)}
              style={STYLES.input}
            />
          </div>

          {/* Latitude */}
          <div>
            <label style={STYLES.label}>LATITUDE</label>
            <input
              type="number" step="any" placeholder="e.g. 5.6037"
              value={form.latitude}
              onChange={e => set('latitude', e.target.value)}
              style={STYLES.input}
            />
          </div>

          {/* Longitude */}
          <div>
            <label style={STYLES.label}>LONGITUDE</label>
            <input
              type="number" step="any" placeholder="e.g. -0.1870"
              value={form.longitude}
              onChange={e => set('longitude', e.target.value)}
              style={STYLES.input}
            />
          </div>

          {/* Description */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={STYLES.label}>INCIDENT DESCRIPTION</label>
            <textarea
              rows={3}
              placeholder="Describe the emergency situation (min 10 characters)…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              style={{ ...STYLES.input, resize: 'vertical', minHeight: 80, lineHeight: 1.6 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={STYLES.btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={loading} style={STYLES.btnPrimary}>
            {loading ? <><Spinner size={12} /> Submitting…</> : '⚡ Submit Report'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// INCIDENT DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function IncidentDrawer({ incident, onClose, onUpdated }) {
  const [statusLoading, setStatusLoading] = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [vehicleId, setVehicleId]         = useState(incident.assignedVehicleId || '')
  const [error, setError]                 = useState('')
  const [localIncident, setLocal]         = useState(incident)

  const nextStatuses = STATUS_FLOW[localIncident.status] || []

  const updateStatus = async (status) => {
    setStatusLoading(true); setError('')
    try {
      const res = await api.incidents.updateStatus(localIncident.id, status)
      setLocal(res.data)
      onUpdated(res.data)
    } catch (e) {
      setError(apiError(e))
    } finally {
      setStatusLoading(false)
    }
  }

  const assignVehicle = async (e) => {
    e.preventDefault()
    if (!vehicleId.trim()) { setError('Vehicle ID is required.'); return }
    setAssignLoading(true); setError('')
    try {
      const res = await api.incidents.assign(localIncident.id, vehicleId.trim())
      setLocal(res.data)
      onUpdated(res.data)
      setError('')
    } catch (e) {
      setError(apiError(e))
    } finally {
      setAssignLoading(false)
    }
  }

  const tm = TYPE_META[localIncident.type] || TYPE_META.OTHER

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(6,8,16,.7)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 101,
        width: '100%', maxWidth: 440,
        background: '#0d1117',
        borderLeft: '1px solid #21262d',
        borderTop: `3px solid ${tm.color}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 48px rgba(0,0,0,.5)',
        animation: 'slideFromRight .3s ease',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #161b22', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{tm.icon}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: tm.color, fontWeight: 700, letterSpacing: '.06em' }}>
                  {localIncident.type.replace('_', ' ')}
                </span>
              </div>
              <StatusBadge status={localIncident.status} />
            </div>
            <button onClick={onClose} style={STYLES.closeBtn}>✕</button>
          </div>
          <p style={{ color: '#8b949e', fontFamily: 'monospace', fontSize: 10, marginTop: 10, letterSpacing: '.08em' }}>
            ID: {localIncident.id.slice(0, 16)}…
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {error && <div style={STYLES.errorBanner}>⚠ {error}</div>}

          {/* Citizen Name */}
          <section>
            <div style={STYLES.sectionLabel}>REPORTED BY</div>
            <p style={{ color: '#c9d1d9', fontSize: 14 }}>
              {localIncident.citizenName || 'Anonymous'}
            </p>
          </section>

          {/* Description */}
          <section>
            <div style={STYLES.sectionLabel}>DESCRIPTION</div>
            <p style={{ color: '#c9d1d9', fontSize: 14, lineHeight: 1.7 }}>
              {localIncident.description}
            </p>
          </section>

          {/* Location */}
          <section>
            <div style={STYLES.sectionLabel}>COORDINATES</div>
            <div style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
              padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#c9d1d9',
              display: 'flex', gap: 20,
            }}>
              <span>LAT <span style={{ color: '#f59e0b' }}>{localIncident.latitude ?? '—'}</span></span>
              <span>LON <span style={{ color: '#f59e0b' }}>{localIncident.longitude ?? '—'}</span></span>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <div style={STYLES.sectionLabel}>TIMELINE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Reported',   localIncident.createdAt],
                ['Dispatched', localIncident.dispatchedAt],
                ['Resolved',   localIncident.resolvedAt],
              ].map(([label, ts]) => (
                ts && (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#8b949e', fontFamily: 'monospace' }}>{label}</span>
                    <span style={{ color: '#c9d1d9', fontFamily: 'monospace' }}>
                      {new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                )
              ))}
            </div>
          </section>

          {/* Assigned vehicle */}
          <section>
            <div style={STYLES.sectionLabel}>ASSIGNED VEHICLE</div>
            <form onSubmit={assignVehicle} style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Enter vehicle ID…"
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                style={{ ...STYLES.input, flex: 1, fontSize: 12 }}
              />
              <button type="submit" disabled={assignLoading} style={STYLES.btnPrimary}>
                {assignLoading ? <Spinner size={12} /> : 'Assign'}
              </button>
            </form>
            {localIncident.assignedVehicleId && (
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#22c55e', marginTop: 8 }}>
                ✓ Assigned: {localIncident.assignedVehicleId}
              </p>
            )}
          </section>

          {/* Status update */}
          {nextStatuses.length > 0 && (
            <section>
              <div style={STYLES.sectionLabel}>ADVANCE STATUS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {nextStatuses.map(s => {
                  const m = STATUS_META[s]
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
                      disabled={statusLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px',
                        background: `${m.color}12`,
                        border: `1px solid ${m.color}40`,
                        borderRadius: 3,
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                        color: m.color, cursor: 'pointer',
                        transition: 'all .15s',
                        opacity: statusLoading ? .5 : 1,
                      }}
                    >
                      {statusLoading ? <Spinner size={10} /> : null}
                      → {m.label.toUpperCase()}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {localIncident.status === 'CLOSED' && (
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e', textAlign: 'center', padding: 12 }}>
              This incident is closed — no further actions available.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function IncidentsPage() {
  const [incidents, setIncidents]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [toast, setToast]             = useState(null)
  const [showCreate, setShowCreate]   = useState(false)
  const [selected, setSelected]       = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType]   = useState('')
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)

  const notify = (message, type = 'success') => {
    setToast({ message, type })
  }

  const loadIncidents = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (filterStatus) params.set('status', filterStatus)
      if (filterType)   params.set('type', filterType)
      const query = new URLSearchParams(params).toString()
      const res = await api.incidents.list(Object.fromEntries(new URLSearchParams(query)))
      // Extract incidents array from response - handle both { data: [] } and { data: { data: [] } }
      const incidents = res?.data?.data || res?.data || []
      setIncidents(Array.isArray(incidents) ? incidents : [])
      setTotalPages(res?.pagination?.pages || 1)
    } catch (e) {
      setError(apiError(e))
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterType])

  useEffect(() => { loadIncidents() }, [loadIncidents])

  const handleCreated = (incident) => {
    setShowCreate(false)
    setIncidents(prev => [incident, ...prev])
    notify('Incident reported successfully')
  }

  const handleUpdated = (updated) => {
    setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
    if (selected?.id === updated.id) setSelected(updated)
    notify('Incident updated')
  }

  // Client-side search filter
  const displayed = incidents.filter(inc => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      inc.description?.toLowerCase().includes(q) ||
      inc.type?.toLowerCase().includes(q) ||
      inc.id?.includes(q)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#060810', fontFamily: "'DM Sans', sans-serif", color: '#c9d1d9' }}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Incident drawer */}
      {selected && (
        <IncidentDrawer
          incident={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 3, height: 24, background: '#f59e0b', borderRadius: 2 }} />
              <h1 style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.04em' }}>
                INCIDENT MANAGEMENT
              </h1>
            </div>
            <p style={{ color: '#8b949e', fontSize: 13, marginLeft: 13 }}>
              {loading ? 'Loading…' : `${incidents.length} incident${incidents.length !== 1 ? 's' : ''} in current view`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            style={{
              ...STYLES.btnPrimary,
              fontSize: 13, padding: '10px 18px',
              gap: 8,
            }}
          >
            {showCreate ? '✕ Cancel' : '+ New Incident'}
          </button>
        </div>

        {/* ── Create form ──────────────────────────────────────────────── */}
        {showCreate && (
          <div style={{ marginBottom: 24 }}>
            <CreateIncidentPanel
              onCreated={handleCreated}
              onClose={() => setShowCreate(false)}
            />
          </div>
        )}

        {/* ── Filters + search ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20,
          padding: '14px 16px',
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
        }}>
          <input
            placeholder="Search incidents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...STYLES.input, flex: 1, minWidth: 160, fontSize: 12 }}
          />
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            style={STYLES.select}
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_META).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
            style={STYLES.select}
          >
            <option value="">All Types</option>
            {INCIDENT_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_META[t]?.icon} {t.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            onClick={() => { setFilterStatus(''); setFilterType(''); setSearch(''); setPage(1) }}
            style={{ ...STYLES.btnGhost, fontSize: 11 }}
          >
            Clear
          </button>
          <button onClick={loadIncidents} style={{ ...STYLES.btnGhost, fontSize: 11 }}>
            ↻ Refresh
          </button>
        </div>

        {/* ── Error state ──────────────────────────────────────────────── */}
        {error && (
          <div style={{ ...STYLES.errorBanner, marginBottom: 20 }}>
            ⚠ {error}
            <button onClick={loadIncidents} style={{ marginLeft: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}>
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 64, background: '#0d1117',
                borderBottom: '1px solid #161b22',
                animation: `shimmer 1.5s infinite ${i * .1}s`,
              }} />
            ))}
          </div>
        )}

        {/* ── Incidents table ──────────────────────────────────────────── */}
        {!loading && (
          <>
            {displayed.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '64px 24px',
                background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <p style={{ color: '#8b949e', fontFamily: 'monospace', fontSize: 12 }}>
                  {search || filterStatus || filterType ? 'No incidents match your filters.' : 'No incidents reported yet.'}
                </p>
              </div>
            ) : (
              <div style={{ border: '1px solid #21262d', borderRadius: 3, overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 130px 120px 90px 100px',
                  gap: 0,
                  background: '#161b22',
                  borderBottom: '1px solid #21262d',
                  padding: '0 16px',
                }}>
                  {['#', 'INCIDENT', 'TYPE', 'STATUS', 'TIME', 'ACTION'].map(h => (
                    <div key={h} style={{
                      padding: '10px 8px',
                      fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
                      color: '#8b949e', letterSpacing: '.12em',
                    }}>{h}</div>
                  ))}
                </div>

                {/* Rows */}
                {displayed.map((inc, idx) => {
                  const tm = TYPE_META[inc.type] || TYPE_META.OTHER
                  return (
                    <div
                      key={inc.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 130px 120px 90px 100px',
                        gap: 0,
                        padding: '0 16px',
                        background: selected?.id === inc.id ? '#0d1420' : idx % 2 === 0 ? '#0d1117' : '#0a0f15',
                        borderBottom: '1px solid #161b22',
                        borderLeft: selected?.id === inc.id ? '2px solid #f59e0b' : '2px solid transparent',
                        transition: 'background .15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelected(inc)}
                    >
                      {/* Row number */}
                      <div style={{ padding: '14px 8px', fontFamily: 'monospace', fontSize: 10, color: '#30363d' }}>
                        {(page - 1) * 15 + idx + 1}
                      </div>

                      {/* Description */}
                      <div style={{ padding: '14px 8px' }}>
                        <div style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          {inc.description}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#30363d', letterSpacing: '.04em' }}>
                          {inc.id.slice(0, 12)}…
                        </div>
                      </div>

                      {/* Type */}
                      <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                        <TypeBadge type={inc.type} />
                      </div>

                      {/* Status */}
                      <div style={{ padding: '14px 8px', display: 'flex', alignItems: 'center' }}>
                        <StatusBadge status={inc.status} />
                      </div>

                      {/* Time */}
                      <div style={{ padding: '14px 8px', fontFamily: 'monospace', fontSize: 11, color: '#8b949e' }}>
                        {timeAgo(inc.createdAt)}
                      </div>

                      {/* Action */}
                      <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(inc) }}
                          style={{
                            padding: '5px 10px',
                            background: 'transparent',
                            border: '1px solid #21262d',
                            borderRadius: 2,
                            fontFamily: 'monospace', fontSize: 10,
                            color: '#8b949e', cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#f59e0b'
                            e.currentTarget.style.color = '#f59e0b'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#21262d'
                            e.currentTarget.style.color = '#8b949e'
                          }}
                        >
                          Manage →
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ ...STYLES.btnGhost, fontSize: 11, padding: '6px 12px' }}
                >
                  ← Prev
                </button>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e', padding: '6px 12px' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ ...STYLES.btnGhost, fontSize: 11, padding: '6px 12px' }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Status legend ────────────────────────────────────────────── */}
        <div style={{
          marginTop: 32, padding: '14px 16px',
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
          display: 'flex', flexWrap: 'wrap', gap: 16,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.1em', alignSelf: 'center' }}>
            STATUS LEGEND
          </span>
          {Object.entries(STATUS_META).map(([key, m]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot }} />
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: m.color }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SHARED STYLE OBJECTS ─────────────────────────────────────────────────────
const STYLES = {
  input: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
    padding: '9px 12px', fontFamily: 'monospace', fontSize: 13,
    color: '#c9d1d9', outline: 'none', width: '100%',
  },
  select: {
    background: '#161b22', border: '1px solid #21262d', borderRadius: 3,
    padding: '9px 10px', fontFamily: 'monospace', fontSize: 11,
    color: '#c9d1d9', outline: 'none', cursor: 'pointer',
  },
  label: {
    display: 'block', fontFamily: 'monospace', fontSize: 9,
    letterSpacing: '.15em', color: '#8b949e', marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em',
    color: '#30363d', marginBottom: 8, paddingBottom: 6,
    borderBottom: '1px solid #161b22',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#f59e0b', color: '#060810',
    border: 'none', borderRadius: 3, padding: '9px 16px',
    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
    letterSpacing: '.06em', cursor: 'pointer',
    transition: 'background .15s, box-shadow .15s',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: '#8b949e',
    border: '1px solid #21262d', borderRadius: 3, padding: '9px 14px',
    fontFamily: 'monospace', fontSize: 12, cursor: 'pointer',
    transition: 'color .15s, border-color .15s',
  },
  errorBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)',
    borderLeft: '3px solid #ef4444', color: '#f87171',
    fontFamily: 'monospace', fontSize: 12, padding: '10px 14px',
    borderRadius: 3, marginBottom: 16,
  },
  typeBtn: {
    padding: '6px 12px', borderRadius: 3, border: '1px solid',
    fontFamily: 'monospace', fontSize: 10, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s', letterSpacing: '.04em',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#8b949e',
    cursor: 'pointer', fontSize: 14, padding: 4,
    transition: 'color .15s',
  },
}

// ─── KEYFRAME CSS ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideFromRight { from { transform:translateX(100%); } to { transform:translateX(0); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
  @keyframes shimmer {
    0%   { background: #0d1117; }
    50%  { background: #161b22; }
    100% { background: #0d1117; }
  }
  * { box-sizing: border-box; }
  select option { background: #161b22; }
`
