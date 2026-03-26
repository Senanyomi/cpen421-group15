/**
 * NERDCP — Analytics Dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows response time metrics, incidents by region, and resource utilization.
 * Falls back gracefully when the Analytics service is not yet running.
 *
 * Connect to your router:
 *   <Route path="/analytics" element={<AnalyticsDashboard />} />
 *
 * API calls:
 *   GET /analytics/response-times
 *   GET /analytics/incidents-by-region
 *   GET /analytics/resource-utilization
 *   GET /analytics/hospital-capacity   (optional, shown if available)
 *   GET /analytics/system-health       (optional)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react'
import api from '../api/api'

const T = {
  bg:'#060810', surface:'#0d1117', raised:'#161b22', border:'#21262d',
  text:'#c9d1d9', muted:'#8b949e', dim:'#30363d',
  amber:'#f59e0b', red:'#ef4444', green:'#22c55e',
  blue:'#3b82f6', orange:'#f97316', purple:'#8b5cf6', teal:'#14b8a6',
  mono:"'Syne Mono', monospace", sans:"'DM Sans', sans-serif",
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

// ─── Simple horizontal bar chart (CSS only, no library needed) ────────────────
function BarChart({ data, valueKey, labelKey, color = T.amber, maxWidth = '100%' }) {
  if (!data || data.length === 0) return (
    <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted,padding:'20px 0',textAlign:'center' }}>No data available</div>
  )
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
      {data.map((item, i) => {
        const pct = ((item[valueKey] || 0) / max) * 100
        return (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ fontFamily:T.mono,fontSize:10,color:T.muted,minWidth:120,textAlign:'right',flexShrink:0 }}>
              {item[labelKey] || '—'}
            </div>
            <div style={{ flex:1,background:T.raised,borderRadius:2,height:16,overflow:'hidden' }}>
              <div style={{
                width:`${pct}%`,height:'100%',
                background:`linear-gradient(90deg, ${color}, ${color}bb)`,
                borderRadius:2,transition:'width .6s ease',
                minWidth: pct > 0 ? 4 : 0,
              }} />
            </div>
            <div style={{ fontFamily:T.mono,fontSize:11,color,minWidth:50,textAlign:'right',flexShrink:0 }}>
              {typeof item[valueKey] === 'number' ? item[valueKey].toFixed(item[valueKey] < 10 ? 1 : 0) : item[valueKey] || 0}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit = '', color = T.amber, sub, icon }) {
  return (
    <div style={{
      background:T.surface,border:`1px solid ${T.border}`,
      borderTop:`2px solid ${color}`,borderRadius:3,
      padding:'18px 20px',
    }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10 }}>
        <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.muted }}>{label}</div>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      </div>
      <div style={{ display:'flex',alignItems:'baseline',gap:4 }}>
        <span style={{ fontSize:30,fontWeight:700,color,fontFamily:T.mono,lineHeight:1 }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontFamily:T.mono,fontSize:12,color:T.muted }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:11,color:T.muted,marginTop:6 }}>{sub}</div>}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, loading, error, children, onRetry }) {
  return (
    <div style={{
      background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,overflow:'hidden',
    }}>
      <div style={{
        padding:'12px 20px',borderBottom:`1px solid ${T.border}`,
        display:'flex',justifyContent:'space-between',alignItems:'center',
      }}>
        <div style={{ fontFamily:T.mono,fontSize:11,fontWeight:700,color:'#f0f6fc',letterSpacing:'.06em' }}>
          {title}
        </div>
        {loading && <Spinner size={12} />}
      </div>
      <div style={{ padding:'20px' }}>
        {error ? (
          <div style={{
            display:'flex',justifyContent:'space-between',alignItems:'center',
            background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.2)',
            borderLeft:'3px solid #ef4444',borderRadius:3,padding:'12px 14px',
          }}>
            <span style={{ fontFamily:T.mono,fontSize:11,color:'#f87171' }}>
              {error.includes('404') || error.includes('not found') || error.includes('ECONNREFUSED')
                ? '⚠ Analytics service not available yet — will show data once service is running'
                : `⚠ ${error}`}
            </span>
            {onRetry && !error.includes('ECONNREFUSED') && (
              <button onClick={onRetry} style={{ background:'none',border:'none',color:'#f87171',cursor:'pointer',fontFamily:T.mono,fontSize:11 }}>Retry</button>
            )}
          </div>
        ) : loading ? (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {[...Array(4)].map((_,i) => (
              <div key={i} style={{ height:20,background:T.raised,borderRadius:2,width:`${80-i*10}%`,opacity:1-i*.15 }} />
            ))}
          </div>
        ) : children}
      </div>
    </div>
  )
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function HealthDot({ status }) {
  const healthy = status === 'healthy' || status === 'ok' || status === 'up'
  const c = healthy ? T.green : T.red
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:5,fontFamily:T.mono,fontSize:10 }}>
      <span style={{ width:7,height:7,borderRadius:'50%',background:c,boxShadow:`0 0 6px ${c}`,animation: healthy ? 'pulseDot 2s infinite' : 'none' }} />
      <span style={{ color:c }}>{healthy ? 'HEALTHY' : 'DEGRADED'}</span>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsDashboard() {
  const [responseTimes, setResponseTimes]   = useState(null)
  const [byRegion, setByRegion]             = useState(null)
  const [utilization, setUtilization]       = useState(null)
  const [hospitalCap, setHospitalCap]       = useState(null)
  const [systemHealth, setSystemHealth]     = useState(null)

  const [rtLoading,   setRtLoading]   = useState(true)
  const [regLoading,  setRegLoading]  = useState(true)
  const [utilLoading, setUtilLoading] = useState(true)
  const [hospLoading, setHospLoading] = useState(true)
  const [hlthLoading, setHlthLoading] = useState(true)

  const [rtError,   setRtError]   = useState('')
  const [regError,  setRegError]  = useState('')
  const [utilError, setUtilError] = useState('')
  const [hospError, setHospError] = useState('')
  const [hlthError, setHlthError] = useState('')

  const [period, setPeriod] = useState('30d')
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchAll = useCallback(async () => {
    setLastRefresh(new Date())

    // Response times
    setRtLoading(true); setRtError('')
    api.getResponseTimes({ period })
      .then(({ data }) => setResponseTimes(data.data || data))
      .catch(e => setRtError(e.message))
      .finally(() => setRtLoading(false))

    // By region
    setRegLoading(true); setRegError('')
    api.getIncidentsByRegion({ period })
      .then(({ data }) => setByRegion(data.data || data))
      .catch(e => setRegError(e.message))
      .finally(() => setRegLoading(false))

    // Utilization
    setUtilLoading(true); setUtilError('')
    api.getResourceUtilization({ period })
      .then(({ data }) => setUtilization(data.data || data))
      .catch(e => setUtilError(e.message))
      .finally(() => setUtilLoading(false))

    // Hospital capacity (optional)
    setHospLoading(true); setHospError('')
    api.getHospitalCapacity()
      .then(({ data }) => setHospitalCap(data.data || data))
      .catch(e => setHospError(e.message))
      .finally(() => setHospLoading(false))

    // System health (optional)
    setHlthLoading(true); setHlthError('')
    api.getSystemHealth()
      .then(({ data }) => setSystemHealth(data.data || data))
      .catch(e => setHlthError(e.message))
      .finally(() => setHlthLoading(false))
  }, [period])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived summary values ───────────────────────────────────────────────────
  const avgResponse = responseTimes?.average
    ?? responseTimes?.avgResponseSecs
    ?? responseTimes?.mean
    ?? null

  const p90Response = responseTimes?.p90
    ?? responseTimes?.percentile90
    ?? null

  const totalIncidents = byRegion
    ? (Array.isArray(byRegion) ? byRegion.reduce((s, r) => s + (r.count || 0), 0) : byRegion.total)
    : null

  const avgUtilization = utilization
    ? Array.isArray(utilization)
      ? Math.round(utilization.reduce((s, r) => s + (r.availability_pct || r.availabilityPct || 0), 0) / (utilization.length || 1))
      : utilization.average
    : null

  // Normalise region data for bar chart
  const regionData = byRegion
    ? (Array.isArray(byRegion) ? byRegion : byRegion.regions || [])
    : []

  // Normalise utilization data for bar chart
  const utilData = utilization
    ? (Array.isArray(utilization) ? utilization : utilization.resources || [])
    : []

  return (
    <div style={{ minHeight:'100vh',background:T.bg,fontFamily:T.sans,color:T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne+Mono&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth:1200,margin:'0 auto',padding:'32px 24px' }}>

        {/* Page header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:28 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:6 }}>
              <div style={{ width:3,height:24,background:T.amber,borderRadius:2 }} />
              <h1 style={{ fontFamily:T.mono,fontSize:20,fontWeight:700,color:'#f0f6fc',margin:0 }}>
                ANALYTICS DASHBOARD
              </h1>
            </div>
            <p style={{ color:T.muted,fontSize:13,marginLeft:13,margin:0 }}>
              Platform performance metrics and resource utilization
              {lastRefresh && (
                <span style={{ marginLeft:12,fontFamily:T.mono,fontSize:10,color:T.dim }}>
                  · updated {new Date(lastRefresh).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            {/* Period selector */}
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{
              background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,
              padding:'7px 10px',fontFamily:T.mono,fontSize:11,color:T.text,
              outline:'none',cursor:'pointer',
            }}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <button onClick={fetchAll} style={{
              display:'inline-flex',alignItems:'center',gap:6,
              background:'transparent',border:`1px solid ${T.border}`,
              color:T.muted,borderRadius:3,padding:'8px 14px',
              fontFamily:T.mono,fontSize:11,cursor:'pointer',
            }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Summary metric cards ─────────────────────────────────────────── */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:28 }}>
          <MetricCard
            label="AVG RESPONSE TIME"
            value={avgResponse != null ? Math.round(avgResponse) : '—'}
            unit="sec"
            color={T.amber}
            icon="⏱"
            sub="seconds to first responder"
          />
          <MetricCard
            label="P90 RESPONSE TIME"
            value={p90Response != null ? Math.round(p90Response) : '—'}
            unit="sec"
            color={T.orange}
            icon="📊"
            sub="90th percentile"
          />
          <MetricCard
            label="TOTAL INCIDENTS"
            value={totalIncidents ?? '—'}
            color={T.blue}
            icon="📋"
            sub={`last ${period}`}
          />
          <MetricCard
            label="AVG FLEET AVAILABILITY"
            value={avgUtilization != null ? avgUtilization : '—'}
            unit="%"
            color={T.green}
            icon="🚗"
            sub="across all units"
          />
        </div>

        {/* ── Two-column grid ──────────────────────────────────────────────── */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:20 }}>

          {/* Response Times */}
          <Section
            title="RESPONSE TIMES"
            loading={rtLoading}
            error={rtError}
            onRetry={() => {
              setRtLoading(true); setRtError('')
              api.getResponseTimes({ period })
                .then(({ data }) => setResponseTimes(data.data || data))
                .catch(e => setRtError(e.message))
                .finally(() => setRtLoading(false))
            }}
          >
            {responseTimes && (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {/* Metrics list */}
                {[
                  ['Average',    responseTimes.average     ?? responseTimes.avgResponseSecs, 'sec'],
                  ['Median',     responseTimes.median      ?? responseTimes.p50, 'sec'],
                  ['P90',        responseTimes.p90         ?? responseTimes.percentile90, 'sec'],
                  ['P95',        responseTimes.p95         ?? responseTimes.percentile95, 'sec'],
                  ['Fastest',    responseTimes.min         ?? responseTimes.fastest, 'sec'],
                  ['Slowest',    responseTimes.max         ?? responseTimes.slowest, 'sec'],
                  ['Sample Size',responseTimes.count       ?? responseTimes.totalIncidents, 'incidents'],
                ].filter(([,v]) => v != null).map(([label, val, unit]) => (
                  <div key={label} style={{ display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${T.raised}` }}>
                    <span style={{ fontFamily:T.mono,fontSize:11,color:T.muted }}>{label}</span>
                    <span style={{ fontFamily:T.mono,fontSize:11,color:T.amber }}>
                      {typeof val === 'number' ? val.toFixed(1) : val} <span style={{ color:T.dim }}>{unit}</span>
                    </span>
                  </div>
                ))}

                {/* By type breakdown */}
                {(responseTimes.byType || responseTimes.by_type) && (
                  <div>
                    <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:10,marginTop:6 }}>BY INCIDENT TYPE</div>
                    <BarChart
                      data={Object.entries(responseTimes.byType || responseTimes.by_type).map(([k,v]) => ({ label: k, value: typeof v === 'object' ? v.average || v.avg : v }))}
                      labelKey="label"
                      valueKey="value"
                      color={T.amber}
                    />
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Incidents by Region */}
          <Section
            title="INCIDENTS BY REGION"
            loading={regLoading}
            error={regError}
            onRetry={() => {
              setRegLoading(true); setRegError('')
              api.getIncidentsByRegion({ period })
                .then(({ data }) => setByRegion(data.data || data))
                .catch(e => setRegError(e.message))
                .finally(() => setRegLoading(false))
            }}
          >
            {byRegion && (
              <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                <BarChart
                  data={regionData}
                  labelKey="region"
                  valueKey="count"
                  color={T.blue}
                />

                {/* Table if has extra fields */}
                {regionData.length > 0 && regionData[0].avgResolutionMins != null && (
                  <div>
                    <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:8 }}>RESOLUTION TIMES BY REGION</div>
                    <BarChart
                      data={regionData}
                      labelKey="region"
                      valueKey="avgResolutionMins"
                      color={T.orange}
                    />
                  </div>
                )}

                {/* Summary row */}
                <div style={{
                  padding:'10px 14px',background:T.raised,borderRadius:3,
                  fontFamily:T.mono,fontSize:11,
                  display:'flex',justifyContent:'space-between',
                }}>
                  <span style={{ color:T.muted }}>Total regions</span>
                  <span style={{ color:T.blue }}>{regionData.length}</span>
                </div>
                <div style={{
                  padding:'10px 14px',background:T.raised,borderRadius:3,
                  fontFamily:T.mono,fontSize:11,
                  display:'flex',justifyContent:'space-between',
                }}>
                  <span style={{ color:T.muted }}>Total incidents</span>
                  <span style={{ color:T.blue }}>{totalIncidents}</span>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* ── Resource Utilization (full width) ───────────────────────────── */}
        <div style={{ marginBottom:20 }}>
          <Section
            title="RESOURCE UTILIZATION"
            loading={utilLoading}
            error={utilError}
            onRetry={() => {
              setUtilLoading(true); setUtilError('')
              api.getResourceUtilization({ period })
                .then(({ data }) => setUtilization(data.data || data))
                .catch(e => setUtilError(e.message))
                .finally(() => setUtilLoading(false))
            }}
          >
            {utilization && (
              <div>
                {/* Summary cards */}
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:20 }}>
                  {(utilization.summary ? Object.entries(utilization.summary) : []).map(([k,v]) => (
                    <div key={k} style={{
                      background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,
                      padding:'12px 14px',
                    }}>
                      <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.1em',color:T.muted,marginBottom:6 }}>{k.toUpperCase().replace('_',' ')}</div>
                      <div style={{ fontSize:22,fontWeight:700,color:T.green,fontFamily:T.mono }}>{typeof v === 'number' ? v.toFixed(1) : v}</div>
                    </div>
                  ))}
                </div>

                {/* Availability chart */}
                {utilData.length > 0 && (
                  <div>
                    <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:12 }}>AVAILABILITY % BY RESOURCE</div>
                    <BarChart
                      data={utilData}
                      labelKey="resourceName"
                      valueKey="availability_pct"
                      color={T.green}
                    />
                  </div>
                )}

                {/* Incidents handled chart */}
                {utilData.length > 0 && utilData[0].incidents_handled != null && (
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontFamily:T.mono,fontSize:9,letterSpacing:'.15em',color:T.dim,marginBottom:12 }}>INCIDENTS HANDLED PER RESOURCE</div>
                    <BarChart
                      data={utilData}
                      labelKey="resourceName"
                      valueKey="incidents_handled"
                      color={T.amber}
                    />
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── Bottom row: Hospital capacity + System health ────────────────── */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>

          {/* Hospital Capacity */}
          <Section
            title="HOSPITAL CAPACITY"
            loading={hospLoading}
            error={hospError}
          >
            {hospitalCap && (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {(Array.isArray(hospitalCap) ? hospitalCap : hospitalCap.hospitals || []).map((h, i) => (
                  <div key={i} style={{
                    background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,
                    padding:'12px 14px',
                  }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
                      <span style={{ fontSize:13,fontWeight:500,color:'#f0f6fc' }}>{h.hospital_name || h.hospitalName || `Hospital ${i+1}`}</span>
                      <span style={{ fontFamily:T.mono,fontSize:10,color:T.green }}>
                        {h.available_beds ?? h.availableBeds ?? '—'} beds free
                      </span>
                    </div>
                    {/* Capacity bar */}
                    {h.total_beds && (
                      <div style={{ background:T.surface,borderRadius:2,height:6,overflow:'hidden' }}>
                        <div style={{
                          width:`${Math.round(((h.available_beds || 0) / (h.total_beds || 1)) * 100)}%`,
                          height:'100%',background:T.green,borderRadius:2,
                        }} />
                      </div>
                    )}
                    <div style={{ display:'flex',justifyContent:'space-between',marginTop:4 }}>
                      <span style={{ fontFamily:T.mono,fontSize:10,color:T.muted }}>
                        {h.occupancy_pct != null ? `${h.occupancy_pct}% occupied` : ''}
                      </span>
                      {h.ambulances_out != null && (
                        <span style={{ fontFamily:T.mono,fontSize:10,color:T.orange }}>
                          🚑 {h.ambulances_out} out
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {(!hospitalCap || (Array.isArray(hospitalCap) && hospitalCap.length === 0)) && (
                  <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted,textAlign:'center',padding:'20px 0' }}>No hospital data</div>
                )}
              </div>
            )}
          </Section>

          {/* System Health */}
          <Section
            title="SYSTEM HEALTH"
            loading={hlthLoading}
            error={hlthError}
          >
            {systemHealth && (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {(Array.isArray(systemHealth) ? systemHealth : systemHealth.services || []).map((svc, i) => (
                  <div key={i} style={{
                    background:T.raised,border:`1px solid ${T.border}`,borderRadius:3,
                    padding:'12px 14px',
                    display:'flex',justifyContent:'space-between',alignItems:'center',
                  }}>
                    <div>
                      <div style={{ fontSize:13,fontWeight:500,color:'#f0f6fc',marginBottom:4 }}>
                        {svc.service_name || svc.serviceName || `Service ${i+1}`}
                      </div>
                      {svc.response_time_ms != null && (
                        <div style={{ fontFamily:T.mono,fontSize:10,color:T.muted }}>
                          {svc.response_time_ms}ms
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4 }}>
                      <HealthDot status={svc.status} />
                      {svc.error_count != null && svc.error_count > 0 && (
                        <span style={{ fontFamily:T.mono,fontSize:10,color:T.red }}>{svc.error_count} errors</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!systemHealth || (Array.isArray(systemHealth) && systemHealth.length === 0)) && (
                  <div style={{ fontFamily:T.mono,fontSize:11,color:T.muted,textAlign:'center',padding:'20px 0' }}>No health data available</div>
                )}
              </div>
            )}
          </Section>

        </div>

        {/* Footer note */}
        <div style={{
          marginTop:28,padding:'12px 16px',
          background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,
          fontFamily:T.mono,fontSize:9,color:T.dim,
          display:'flex',justifyContent:'space-between',
        }}>
          <span>ANALYTICS — Data sourced from RabbitMQ event stream via nerdcp.events exchange</span>
          <span>Period: {period} · Charts update on refresh</span>
        </div>
      </div>
    </div>
  )
}
