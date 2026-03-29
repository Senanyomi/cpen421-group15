/**
 * NERDCP — Analytics Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * API connections:
 *   GET /analytics/response-times
 *   GET /analytics/incidents-by-region
 *   GET /analytics/resource-utilization
 *
 * Drop into your project:
 *   1. Copy to src/pages/AnalyticsPage.jsx
 *   2. Router: <Route path="/analytics" element={<AnalyticsPage />} />
 *   3. .env: VITE_ANALYTICS_URL=http://localhost:3004
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANALYTICS_URL
    ? import.meta.env.VITE_ANALYTICS_URL
    : 'http://localhost:3004'

// ─── HTTP ─────────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('nerdcp_token') || ''

const http = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`)
  return data
}

// ─── MOCK DATA — used when API returns no data yet ────────────────────────────
const MOCK_RESPONSE_TIMES = {
  totalIncidents: 142,
  timeToDispatch: { avgSec: 187, minSec: 23, maxSec: 1840, p90Sec: 420 },
  timeToResolve:  { avgSec: 3420, minSec: 300, maxSec: 18000, p90Sec: 7200 },
  byType: [
    { type: 'MEDICAL',   incidentCount: 67, timeToDispatch: { avgSec: 142 }, timeToResolve: { avgSec: 2100 } },
    { type: 'FIRE',      incidentCount: 35, timeToDispatch: { avgSec: 210 }, timeToResolve: { avgSec: 4500 } },
    { type: 'POLICE',    incidentCount: 28, timeToDispatch: { avgSec: 160 }, timeToResolve: { avgSec: 3200 } },
    { type: 'TRAFFIC',   incidentCount: 12, timeToDispatch: { avgSec: 280 }, timeToResolve: { avgSec: 2800 } },
  ],
}

const MOCK_BY_REGION = {
  grandTotal: 142,
  regions: [
    { region: '5.6N_0.1W', totalIncidents: 34, sharePercent: 23.9, byType: [{ type: 'MEDICAL', count: 18 }, { type: 'FIRE', count: 10 }, { type: 'POLICE', count: 6 }] },
    { region: '5.5N_0.2W', totalIncidents: 28, sharePercent: 19.7, byType: [{ type: 'POLICE', count: 14 }, { type: 'MEDICAL', count: 9 }, { type: 'FIRE', count: 5 }] },
    { region: '5.6N_0.2W', totalIncidents: 21, sharePercent: 14.8, byType: [{ type: 'TRAFFIC', count: 10 }, { type: 'MEDICAL', count: 7 }, { type: 'FIRE', count: 4 }] },
    { region: '5.7N_0.1W', totalIncidents: 18, sharePercent: 12.7, byType: [{ type: 'FIRE', count: 9 }, { type: 'MEDICAL', count: 6 }, { type: 'OTHER', count: 3 }] },
    { region: '5.5N_0.1W', totalIncidents: 15, sharePercent: 10.6, byType: [{ type: 'MEDICAL', count: 8 }, { type: 'TRAFFIC', count: 4 }, { type: 'POLICE', count: 3 }] },
    { region: '5.6N_0.0E', totalIncidents: 12, sharePercent: 8.5,  byType: [{ type: 'HAZMAT', count: 6 }, { type: 'FIRE', count: 4 }, { type: 'OTHER', count: 2 }] },
    { region: '5.4N_0.2W', totalIncidents: 8,  sharePercent: 5.6,  byType: [{ type: 'POLICE', count: 5 }, { type: 'MEDICAL', count: 3 }] },
    { region: '5.7N_0.2W', totalIncidents: 6,  sharePercent: 4.2,  byType: [{ type: 'FIRE', count: 4 }, { type: 'MEDICAL', count: 2 }] },
  ],
}

const MOCK_UTILIZATION = {
  totalDeployments: 189,
  byVehicleType: [
    { vehicleType: 'AMBULANCE',   deployments: 84, locationPings: 3420, uniqueVehicles: 6, deploymentSharePercent: 44.4 },
    { vehicleType: 'POLICE_CAR',  deployments: 61, locationPings: 2180, uniqueVehicles: 8, deploymentSharePercent: 32.3 },
    { vehicleType: 'FIRE_TRUCK',  deployments: 28, locationPings: 940,  uniqueVehicles: 3, deploymentSharePercent: 14.8 },
    { vehicleType: 'RESCUE_TEAM', deployments: 10, locationPings: 320,  uniqueVehicles: 2, deploymentSharePercent: 5.3  },
    { vehicleType: 'HAZMAT_UNIT', deployments: 6,  locationPings: 160,  uniqueVehicles: 1, deploymentSharePercent: 3.2  },
  ],
  mostActiveVehicles: [
    { callSign: 'AMB-01', vehicleType: 'AMBULANCE',  deployments: 22 },
    { callSign: 'POL-02', vehicleType: 'POLICE_CAR', deployments: 19 },
    { callSign: 'AMB-02', vehicleType: 'AMBULANCE',  deployments: 17 },
    { callSign: 'FIRE-01',vehicleType: 'FIRE_TRUCK', deployments: 14 },
    { callSign: 'POL-01', vehicleType: 'POLICE_CAR', deployments: 12 },
  ],
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const VEHICLE_META = {
  AMBULANCE:    { icon: '🚑', color: '#3b82f6' },
  POLICE_CAR:   { icon: '🚔', color: '#6366f1' },
  FIRE_TRUCK:   { icon: '🚒', color: '#ef4444' },
  RESCUE_TEAM:  { icon: '🚁', color: '#22c55e' },
  HAZMAT_UNIT:  { icon: '🛻', color: '#eab308' },
  COMMAND_UNIT: { icon: '📡', color: '#f59e0b' },
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

// ─── PURE SVG CHARTS — no dependencies ───────────────────────────────────────

/** Horizontal bar chart */
function BarChart({ items, maxValue, colorFn, labelFn, valueFn, height = 220 }) {
  const barH   = 28
  const labelW = 120
  const valW   = 60
  const gap    = 8
  const rows   = items.length
  const totalH = rows * (barH + gap)
  const chartW = 400

  return (
    <svg viewBox={`0 0 ${labelW + chartW + valW + 20} ${totalH}`} style={{ width: '100%', overflow: 'visible' }}>
      {items.map((item, i) => {
        const y     = i * (barH + gap)
        const val   = valueFn(item)
        const pct   = maxValue > 0 ? val / maxValue : 0
        const barW  = Math.max(pct * chartW, 2)
        const color = colorFn(item)

        return (
          <g key={i}>
            {/* Label */}
            <text
              x={labelW - 8} y={y + barH / 2 + 4}
              textAnchor="end"
              fontSize="11" fontFamily="monospace" fill="#8b949e"
            >
              {labelFn(item)}
            </text>

            {/* Track */}
            <rect x={labelW} y={y} width={chartW} height={barH} fill="rgba(255,255,255,.03)" rx="2" />

            {/* Bar */}
            <rect
              x={labelW} y={y} width={barW} height={barH}
              fill={color} opacity=".85" rx="2"
              style={{ transition: 'width .6s ease' }}
            />

            {/* Subtle glow line at top of bar */}
            <rect x={labelW} y={y} width={barW} height={2} fill={color} rx="1" />

            {/* Value */}
            <text
              x={labelW + chartW + 8} y={y + barH / 2 + 4}
              fontSize="11" fontFamily="monospace" fill={color}
            >
              {valueFn(item)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Donut chart */
function DonutChart({ segments, size = 140, thickness = 28 }) {
  const cx = size / 2, cy = size / 2
  const r  = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0)

  let offset = 0
  const arcs = segments.map(seg => {
    const frac  = total > 0 ? seg.value / total : 0
    const dash  = frac * circumference
    const gap   = circumference - dash
    const arc   = { dash, gap, offset: -circumference * (offset / 360) + circumference * .25, frac }
    offset     += frac * 360
    return { ...seg, ...arc }
  })

  const topSeg = arcs.reduce((a, b) => (a.value > b.value ? a : b), arcs[0] || {})

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#161b22" strokeWidth={thickness} />
        {/* Segments */}
        {arcs.map((seg, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness - 2}
            strokeDasharray={`${seg.dash} ${seg.gap}`}
            strokeDashoffset={-circumference * (arcs.slice(0, i).reduce((s, a) => s + a.frac, 0)) * 1 + circumference * 0.25}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray .5s ease' }}
          />
        ))}
      </svg>
      {/* Centre label */}
      {topSeg && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: topSeg.color, lineHeight: 1 }}>
            {Math.round(topSeg.frac * 100)}%
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 8, color: '#8b949e', letterSpacing: '.08em', marginTop: 3 }}>
            {(topSeg.label || '').slice(0, 8)}
          </span>
        </div>
      )}
    </div>
  )
}

/** Sparkline for response time bar */
function MiniTimeline({ avgSec, minSec, maxSec, p90Sec, color }) {
  const w = 280, h = 36, pad = 4
  const range  = maxSec - minSec || 1
  const toX    = (v) => pad + ((v - minSec) / range) * (w - pad * 2)
  const avgX   = toX(avgSec)
  const p90X   = toX(p90Sec)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {/* Track */}
      <rect x={pad} y={h / 2 - 1} width={w - pad * 2} height={2} fill="#161b22" rx="1" />
      {/* Fill to avg */}
      <rect x={pad} y={h / 2 - 1} width={avgX - pad} height={2} fill={color} opacity=".4" rx="1" />
      {/* Avg tick */}
      <rect x={avgX - 1} y={h / 2 - 8} width={2} height={16} fill={color} rx="1" />
      <text x={avgX} y={h / 2 - 10} textAnchor="middle" fontSize="8" fontFamily="monospace" fill={color}>AVG</text>
      {/* P90 tick */}
      <rect x={p90X - 1} y={h / 2 - 5} width={2} height={10} fill={`${color}80`} rx="1" />
      <text x={p90X} y={h - 2} textAnchor="middle" fontSize="8" fontFamily="monospace" fill={`${color}80`}>P90</text>
      {/* Min / Max labels */}
      <text x={pad} y={h / 2 + 14} fontSize="8" fontFamily="monospace" fill="#30363d">{fmtDuration(minSec)}</text>
      <text x={w - pad} y={h / 2 + 14} textAnchor="end" fontSize="8" fontFamily="monospace" fill="#30363d">{fmtDuration(maxSec)}</text>
    </svg>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#f59e0b', icon }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d',
      borderLeft: `2px solid ${color}`,
      borderRadius: 3, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#8b949e', letterSpacing: '.14em' }}>{label}</div>
        {icon && <span style={{ fontSize: 16, opacity: .7 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b949e' }}>{sub}</div>}
    </div>
  )
}

// ─── PANEL WRAPPER ────────────────────────────────────────────────────────────
function Panel({ title, subtitle, children, loading, error, onRetry, accent = '#f59e0b' }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d',
      borderTop: `2px solid ${accent}`,
      borderRadius: 3,
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #161b22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.05em' }}>{title}</div>
          {subtitle && <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b949e', marginTop: 3 }}>{subtitle}</div>}
        </div>
        {loading && <span style={{
          width: 14, height: 14, display: 'inline-block',
          border: '2px solid rgba(245,158,11,.2)', borderTopColor: accent,
          borderRadius: '50%', animation: 'spin .7s linear infinite',
        }} />}
      </div>
      <div style={{ padding: '20px' }}>
        {error
          ? <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
              borderRadius: 3, padding: '10px 14px',
              fontFamily: 'monospace', fontSize: 11, color: '#f87171',
            }}>
              ⚠ {error}
              {onRetry && (
                <button onClick={onRetry} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontFamily: 'monospace', fontSize: 10 }}>
                  Retry
                </button>
              )}
            </div>
          : children
        }
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [responseTimes, setResponseTimes]   = useState(null)
  const [byRegion, setByRegion]             = useState(null)
  const [utilization, setUtilization]       = useState(null)
  const [loadingRT, setLoadingRT]           = useState(true)
  const [loadingReg, setLoadingReg]         = useState(true)
  const [loadingUtil, setLoadingUtil]       = useState(true)
  const [errorRT, setErrorRT]               = useState('')
  const [errorReg, setErrorReg]             = useState('')
  const [errorUtil, setErrorUtil]           = useState('')
  const [dateRange, setDateRange]           = useState('30d')
  const [mounted, setMounted]               = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 60) }, [])

  const buildParams = useCallback(() => {
    const to   = new Date()
    const from = new Date()
    const days = parseInt(dateRange)
    from.setDate(from.getDate() - days)
    return `?from=${from.toISOString()}&to=${to.toISOString()}`
  }, [dateRange])

  const fetchResponseTimes = useCallback(async () => {
    setLoadingRT(true); setErrorRT('')
    try {
      const data = await http(`/analytics/response-times${buildParams()}`)
      setResponseTimes(data.data?.totalIncidents ? data.data : MOCK_RESPONSE_TIMES)
    } catch {
      setResponseTimes(MOCK_RESPONSE_TIMES) // show mock on error
      setErrorRT('Using sample data — connect to analytics-service to see live data.')
    } finally { setLoadingRT(false) }
  }, [buildParams])

  const fetchByRegion = useCallback(async () => {
    setLoadingReg(true); setErrorReg('')
    try {
      const data = await http(`/analytics/incidents-by-region${buildParams()}`)
      setByRegion(data.data?.grandTotal ? data.data : MOCK_BY_REGION)
    } catch {
      setByRegion(MOCK_BY_REGION)
      setErrorReg('Using sample data — connect to analytics-service to see live data.')
    } finally { setLoadingReg(false) }
  }, [buildParams])

  const fetchUtilization = useCallback(async () => {
    setLoadingUtil(true); setErrorUtil('')
    try {
      const data = await http(`/analytics/resource-utilization${buildParams()}`)
      setUtilization(data.data?.totalDeployments ? data.data : MOCK_UTILIZATION)
    } catch {
      setUtilization(MOCK_UTILIZATION)
      setErrorUtil('Using sample data — connect to analytics-service to see live data.')
    } finally { setLoadingUtil(false) }
  }, [buildParams])

  useEffect(() => {
    fetchResponseTimes()
    fetchByRegion()
    fetchUtilization()
  }, [fetchResponseTimes, fetchByRegion, fetchUtilization])

  const rt   = responseTimes
  const reg  = byRegion
  const util = utilization

  return (
    <div style={{ minHeight: '100vh', background: '#060810', fontFamily: "'DM Sans', sans-serif", color: '#c9d1d9' }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', opacity: mounted ? 1 : 0, transition: 'opacity .4s ease' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <div style={{ width: 3, height: 24, background: '#3b82f6', borderRadius: 2 }} />
              <h1 style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#f0f6fc', letterSpacing: '.04em' }}>
                ANALYTICS
              </h1>
            </div>
            <p style={{ color: '#8b949e', fontSize: 12, marginLeft: 13 }}>
              Platform performance and operational intelligence
            </p>
          </div>

          {/* Date range selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[['7d', '7D'], ['30d', '30D'], ['90d', '90D']].map(([val, label]) => (
              <button key={val} onClick={() => setDateRange(val)} style={{
                padding: '7px 14px', borderRadius: 3, cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                border: `1px solid ${dateRange === val ? '#3b82f6' : '#21262d'}`,
                background: dateRange === val ? 'rgba(59,130,246,.15)' : 'transparent',
                color: dateRange === val ? '#3b82f6' : '#8b949e',
                transition: 'all .15s',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Top stat cards ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 24 }}>
          <StatCard
            label="TOTAL INCIDENTS"
            value={rt?.totalIncidents ?? '—'}
            sub={`Last ${dateRange}`}
            color="#f59e0b" icon="📋"
          />
          <StatCard
            label="AVG DISPATCH TIME"
            value={fmtDuration(rt?.timeToDispatch?.avgSec)}
            sub={`P90: ${fmtDuration(rt?.timeToDispatch?.p90Sec)}`}
            color="#3b82f6" icon="⚡"
          />
          <StatCard
            label="AVG RESOLVE TIME"
            value={fmtDuration(rt?.timeToResolve?.avgSec)}
            sub={`P90: ${fmtDuration(rt?.timeToResolve?.p90Sec)}`}
            color="#22c55e" icon="✓"
          />
          <StatCard
            label="TOTAL DEPLOYMENTS"
            value={util?.totalDeployments ?? '—'}
            sub={`${util?.byVehicleType?.length ?? 0} vehicle types`}
            color="#f97316" icon="🚑"
          />
          <StatCard
            label="REGIONS AFFECTED"
            value={reg?.regionCount ?? '—'}
            sub={`of ${reg?.grandTotal ?? 0} total`}
            color="#8b5cf6" icon="📍"
          />
        </div>

        {/* ── ROW 1: Response times + type breakdown ───────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Response time timelines */}
          <Panel
            title="RESPONSE TIMES"
            subtitle="Dispatch and resolution performance"
            loading={loadingRT}
            error={errorRT}
            onRetry={fetchResponseTimes}
            accent="#3b82f6"
          >
            {rt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Time to Dispatch */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b949e', letterSpacing: '.1em' }}>TIME TO DISPATCH</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#3b82f6' }}>
                      {fmtDuration(rt.timeToDispatch?.avgSec)}
                    </span>
                  </div>
                  <MiniTimeline
                    avgSec={rt.timeToDispatch?.avgSec}
                    minSec={rt.timeToDispatch?.minSec}
                    maxSec={rt.timeToDispatch?.maxSec}
                    p90Sec={rt.timeToDispatch?.p90Sec}
                    color="#3b82f6"
                  />
                </div>

                <div style={{ height: 1, background: '#161b22' }} />

                {/* Time to Resolve */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b949e', letterSpacing: '.1em' }}>TIME TO RESOLVE</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                      {fmtDuration(rt.timeToResolve?.avgSec)}
                    </span>
                  </div>
                  <MiniTimeline
                    avgSec={rt.timeToResolve?.avgSec}
                    minSec={rt.timeToResolve?.minSec}
                    maxSec={rt.timeToResolve?.maxSec}
                    p90Sec={rt.timeToResolve?.p90Sec}
                    color="#22c55e"
                  />
                </div>

                {/* Min / Avg / Max summary row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                  {[
                    ['FASTEST', rt.timeToDispatch?.minSec, '#22c55e'],
                    ['AVERAGE', rt.timeToDispatch?.avgSec, '#3b82f6'],
                    ['SLOWEST', rt.timeToDispatch?.maxSec, '#ef4444'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{
                      background: '#161b22', borderRadius: 3, padding: '8px 10px', textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#30363d', letterSpacing: '.1em', marginBottom: 5 }}>{label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color }}>{fmtDuration(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Breakdown by incident type */}
          <Panel
            title="RESPONSE BY INCIDENT TYPE"
            subtitle="Average dispatch time per category"
            loading={loadingRT}
            error={null}
            accent="#f59e0b"
          >
            {rt?.byType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rt.byType.map((row, i) => {
                  const tm       = TYPE_META[row.type] || TYPE_META.OTHER
                  const maxAvg   = Math.max(...rt.byType.map(r => r.timeToDispatch?.avgSec || 0))
                  const pct      = maxAvg > 0 ? (row.timeToDispatch?.avgSec || 0) / maxAvg : 0
                  return (
                    <div key={row.type} style={{ animation: `fadeInUp .3s ease ${i * .06}s both` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13 }}>{tm.icon}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: tm.color, fontWeight: 600 }}>
                            {row.type.replace('_', ' ')}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d' }}>
                            ×{row.incidentCount}
                          </span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#c9d1d9' }}>
                          {fmtDuration(row.timeToDispatch?.avgSec)}
                        </span>
                      </div>
                      <div style={{ background: '#161b22', borderRadius: 2, height: 5, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: `linear-gradient(to right, ${tm.color}cc, ${tm.color})`,
                          width: `${pct * 100}%`,
                          transition: 'width .6s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── ROW 2: Incidents by region ───────────────────────────────── */}
        <Panel
          title="INCIDENTS BY REGION"
          subtitle="Geographic distribution of emergency calls"
          loading={loadingReg}
          error={errorReg}
          onRetry={fetchByRegion}
          accent="#8b5cf6"
        >
          {reg && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
              {/* Bar chart */}
              <div style={{ minWidth: 0 }}>
                <BarChart
                  items={reg.regions.slice(0, 8)}
                  maxValue={reg.regions[0]?.totalIncidents || 1}
                  labelFn={item => item.region}
                  valueFn={item => item.totalIncidents}
                  colorFn={(item, i) => {
                    const palette = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#22c55e','#f59e0b','#f97316','#ef4444']
                    const idx = reg.regions.slice(0, 8).indexOf(item)
                    return palette[idx % palette.length]
                  }}
                />
              </div>

              {/* Top 5 table */}
              <div style={{ minWidth: 200 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.12em', marginBottom: 10 }}>
                  TOP HOTSPOTS
                </div>
                {reg.regions.slice(0, 5).map((r, i) => (
                  <div key={r.region} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', marginBottom: 4,
                    background: '#161b22', borderRadius: 3,
                    borderLeft: `2px solid ${['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#22c55e'][i]}`,
                  }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#c9d1d9' }}>{r.region}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#30363d', marginTop: 1 }}>
                        {r.byType?.slice(0, 2).map(t => `${TYPE_META[t.type]?.icon} ${t.count}`).join('  ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#f0f6fc' }}>{r.totalIncidents}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#8b949e' }}>{r.sharePercent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* ── ROW 3: Resource utilization ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

          {/* Donut + type breakdown */}
          <Panel
            title="FLEET UTILIZATION"
            subtitle="Deployments by vehicle type"
            loading={loadingUtil}
            error={errorUtil}
            onRetry={fetchUtilization}
            accent="#f97316"
          >
            {util && (
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <DonutChart
                  segments={util.byVehicleType.map(v => ({
                    label: v.vehicleType.split('_')[0],
                    value: v.deployments,
                    color: VEHICLE_META[v.vehicleType]?.color || '#8b949e',
                  }))}
                  size={140} thickness={26}
                />
                <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {util.byVehicleType.map((v, i) => {
                    const vm = VEHICLE_META[v.vehicleType] || { icon: '🚗', color: '#8b949e' }
                    return (
                      <div key={v.vehicleType} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        animation: `fadeInUp .3s ease ${i * .07}s both`,
                      }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{vm.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: vm.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.vehicleType.replace('_', ' ')}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#c9d1d9', flexShrink: 0 }}>
                              {v.deployments}
                            </span>
                          </div>
                          <div style={{ background: '#161b22', borderRadius: 2, height: 4 }}>
                            <div style={{
                              height: '100%', borderRadius: 2, background: vm.color,
                              width: `${v.deploymentSharePercent}%`,
                              transition: 'width .6s ease',
                            }} />
                          </div>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', flexShrink: 0, width: 32, textAlign: 'right' }}>
                          {v.deploymentSharePercent}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Panel>

          {/* Most active vehicles */}
          <Panel
            title="MOST ACTIVE UNITS"
            subtitle="Top deployments this period"
            loading={loadingUtil}
            error={null}
            accent="#22c55e"
          >
            {util?.mostActiveVehicles && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {util.mostActiveVehicles.map((v, i) => {
                  const vm  = VEHICLE_META[v.vehicleType] || { icon: '🚗', color: '#8b949e' }
                  const max = util.mostActiveVehicles[0]?.deployments || 1
                  const pct = (v.deployments / max) * 100
                  return (
                    <div key={v.callSign} style={{
                      background: '#161b22', borderRadius: 3, padding: '10px 14px',
                      borderLeft: `2px solid ${vm.color}`,
                      animation: `fadeInUp .3s ease ${i * .07}s both`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{vm.icon}</span>
                          <div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#f0f6fc' }}>
                              {v.callSign}
                            </div>
                            <div style={{ fontFamily: 'monospace', fontSize: 9, color: vm.color, letterSpacing: '.06em' }}>
                              {v.vehicleType.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: vm.color, lineHeight: 1 }}>
                            {v.deployments}
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#30363d', letterSpacing: '.06em' }}>
                            DEPLOYS
                          </div>
                        </div>
                      </div>
                      <div style={{ background: '#0d1117', borderRadius: 2, height: 3 }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: `linear-gradient(to right, ${vm.color}80, ${vm.color})`,
                          width: `${pct}%`, transition: 'width .6s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div style={{
          marginTop: 24, padding: '12px 16px',
          background: '#0d1117', border: '1px solid #21262d', borderRadius: 3,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.1em' }}>
            NERDCP ANALYTICS ENGINE · DATA REFRESHES ON LOAD
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#30363d', letterSpacing: '.06em' }}>
            PERIOD: LAST {dateRange.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── KEYFRAMES ────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500&display=swap');
  @keyframes spin      { to { transform: rotate(360deg); } }
  @keyframes fadeInUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  *, *::before, *::after { box-sizing: border-box; }
`
