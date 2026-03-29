// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { apiError } from '../api'

const STATUS_COLOR = {
  REPORTED: '#f59e0b', ACKNOWLEDGED: '#3b82f6', DISPATCHED: '#fbbf24',
  IN_PROGRESS: '#f97316', RESOLVED: '#22c55e', CLOSED: '#8b949e',
}
const TYPE_ICON = { FIRE:'🔥', MEDICAL:'🚑', POLICE:'🚔', NATURAL_DISASTER:'🌪️', HAZMAT:'☢️', TRAFFIC:'🚧', OTHER:'⚠️' }

const fmtDuration = (sec) => {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m ${sec % 60}s` : `${sec}s`
}

const timeAgo = (iso) => {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#0d1117', border:'1px solid #21262d', borderLeft:`2px solid ${color}`, borderRadius:3, padding:'16px 18px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ fontFamily:'monospace', fontSize:9, color:'#8b949e', letterSpacing:'.14em' }}>{label}</div>
        <span style={{ fontSize:16, opacity:.7 }}>{icon}</span>
      </div>
      <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color, lineHeight:1, marginBottom:5 }}>{value}</div>
      {sub && <div style={{ fontFamily:'monospace', fontSize:10, color:'#8b949e' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user }    = useAuth()
  const navigate    = useNavigate()
  const [dash, setDash]       = useState(null)
  const [active, setActive]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [dashRes, activeRes] = await Promise.all([
          api.analytics.dashboard(),
          api.incidents.active(),
        ])
        setDash(dashRes.data.data)
        setActive(activeRes.data.data?.slice(0, 8) || [])
      } catch (e) {
        setError(apiError(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const d = dash

  return (
    <div style={{ minHeight:'100vh', background:'#060810', fontFamily:"'DM Sans',sans-serif", color:'#c9d1d9' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
            <div style={{ width:3, height:24, background:'#f59e0b', borderRadius:2 }} />
            <h1 style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:'#f0f6fc', letterSpacing:'.04em' }}>
              COMMAND OVERVIEW
            </h1>
          </div>
          <p style={{ color:'#8b949e', fontSize:12, marginLeft:13 }}>
            Welcome back, <span style={{ color:'#f59e0b' }}>{user?.name || user?.email}</span> · {new Date().toLocaleString('en-GB', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderLeft:'3px solid #ef4444', color:'#f87171', fontFamily:'monospace', fontSize:12, padding:'10px 14px', borderRadius:3, marginBottom:20 }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:24 }}>
            {[...Array(5)].map((_,i) => (
              <div key={i} style={{ height:90, background:'#0d1117', border:'1px solid #161b22', borderRadius:3, animation:`shimmer 1.5s infinite ${i*.1}s` }} />
            ))}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:24 }}>
              <StatCard label="TOTAL INCIDENTS"     value={d?.incidents?.total ?? '—'}                color="#f59e0b" icon="📋" sub="Last 30 days" />
              <StatCard label="RESOLVED"            value={d?.incidents?.resolved ?? '—'}             color="#22c55e" icon="✓" sub={`${d?.incidents?.resolutionRate || '—'} rate`} />
              <StatCard label="AVG DISPATCH TIME"   value={fmtDuration(d?.responseTimes?.avgTimeToDispatch?.sec)} color="#3b82f6" icon="⚡" sub="Time to first unit" />
              <StatCard label="ACTIVE INCIDENTS"    value={active.length}                             color="#f97316" icon="🔴" sub="Unresolved now" />
              <StatCard label="DEPLOYMENTS"         value={d?.resources?.totalDeployments ?? '—'}     color="#8b5cf6" icon="🚑" sub="Vehicle dispatches" />
            </div>

            {/* Open by status */}
            {d?.incidents?.openByStatus?.length > 0 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
                {d.incidents.openByStatus.map(({ status, count }) => (
                  <div key={status} style={{ background:'#0d1117', border:`1px solid ${STATUS_COLOR[status]}40`, borderRadius:3, padding:'8px 14px', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:STATUS_COLOR[status], boxShadow:`0 0 5px ${STATUS_COLOR[status]}` }} />
                    <span style={{ fontFamily:'monospace', fontSize:11, color:STATUS_COLOR[status] }}>{status}</span>
                    <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#f0f6fc' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Active incidents table */}
            <div style={{ background:'#0d1117', border:'1px solid #21262d', borderTop:'2px solid #f59e0b', borderRadius:3, marginBottom:16 }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #161b22', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#f0f6fc' }}>ACTIVE INCIDENTS</div>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:'#8b949e', marginTop:2 }}>Ongoing emergencies requiring action</div>
                </div>
                <button onClick={() => navigate('/incidents')} style={{ background:'transparent', border:'1px solid #21262d', borderRadius:3, padding:'6px 12px', fontFamily:'monospace', fontSize:10, color:'#8b949e', cursor:'pointer' }}>
                  View all →
                </button>
              </div>
              {active.length === 0 ? (
                <div style={{ padding:'32px', textAlign:'center', fontFamily:'monospace', fontSize:11, color:'#30363d' }}>
                  No active incidents
                </div>
              ) : (
                active.map((inc, i) => (
                  <div key={inc.id} onClick={() => navigate('/incidents')}
                    style={{ display:'grid', gridTemplateColumns:'32px 1fr 120px 80px 80px', gap:0, padding:'0 16px', background: i%2===0 ? '#0d1117' : '#0a0f15', borderBottom:'1px solid #161b22', cursor:'pointer', transition:'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#0d1420'}
                    onMouseLeave={e => e.currentTarget.style.background= i%2===0 ? '#0d1117' : '#0a0f15'}
                  >
                    <div style={{ padding:'14px 8px', fontFamily:'monospace', fontSize:10, color:'#30363d' }}>{i+1}</div>
                    <div style={{ padding:'14px 8px' }}>
                      <div style={{ fontSize:13, color:'#c9d1d9', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:300 }}>{inc.description}</div>
                      <div style={{ fontFamily:'monospace', fontSize:10, color:'#30363d', marginTop:2 }}>{inc.id.slice(0,12)}…</div>
                    </div>
                    <div style={{ padding:'14px 8px', display:'flex', alignItems:'center', gap:5 }}>
                      <span>{TYPE_ICON[inc.type] || '⚠️'}</span>
                      <span style={{ fontFamily:'monospace', fontSize:10, color:'#8b949e' }}>{inc.type?.replace('_',' ')}</span>
                    </div>
                    <div style={{ padding:'14px 8px', display:'flex', alignItems:'center' }}>
                      <span style={{ fontFamily:'monospace', fontSize:9, fontWeight:700, color:STATUS_COLOR[inc.status], background:`${STATUS_COLOR[inc.status]}15`, border:`1px solid ${STATUS_COLOR[inc.status]}35`, padding:'2px 6px', borderRadius:2 }}>
                        {inc.status}
                      </span>
                    </div>
                    <div style={{ padding:'14px 8px', fontFamily:'monospace', fontSize:10, color:'#8b949e', display:'flex', alignItems:'center' }}>
                      {timeAgo(inc.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick links */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10 }}>
              {[
                { label:'Report Incident', sub:'Log a new emergency', icon:'⚡', to:'/incidents', color:'#f59e0b' },
                { label:'Fleet Status',    sub:'View all vehicles',   icon:'🚑', to:'/vehicles',  color:'#22c55e' },
                { label:'Analytics',       sub:'Performance metrics', icon:'◈',  to:'/analytics', color:'#3b82f6' },
              ].map(({ label, sub, icon, to, color }) => (
                <button key={to} onClick={() => navigate(to)} style={{ background:'#0d1117', border:`1px solid #21262d`, borderBottom:`2px solid ${color}`, borderRadius:3, padding:'16px 18px', textAlign:'left', cursor:'pointer', transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=color; e.currentTarget.style.background='#0d1218' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#21262d'; e.currentTarget.style.background='#0d1117'; e.currentTarget.style.borderBottomColor=color }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#f0f6fc' }}>{label}</span>
                  </div>
                  <div style={{ fontFamily:'monospace', fontSize:10, color:'#8b949e' }}>{sub}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes shimmer { 0%,100%{background:#0d1117} 50%{background:#161b22} }
        *,*::before,*::after{box-sizing:border-box}
      `}</style>
    </div>
  )
}
