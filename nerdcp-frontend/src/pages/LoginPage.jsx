// src/pages/LoginPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { apiError } from '../api'

export default function LoginPage() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const emailRef     = useRef(null)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    emailRef.current?.focus()
    return () => clearTimeout(t)
  }, [])

  const validate = () => {
    if (!email.trim()) return 'Email address is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
    if (!password) return 'Password is required.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true); setError('')
    try {
      const res = await api.auth.login(email, password)
      const { accessToken, refreshToken, user } = res.data.data
      if (refreshToken) localStorage.setItem('nerdcp_refresh', refreshToken)
      login(accessToken, user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#060810', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'DM Sans',sans-serif", position:'relative', overflow:'hidden' }}>
      {/* Grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(245,158,11,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,.04) 1px,transparent 1px)', backgroundSize:'40px 40px', pointerEvents:'none' }} />
      {/* Orbs */}
      <div style={{ position:'absolute', width:360, height:360, borderRadius:'50%', background:'radial-gradient(circle,rgba(245,158,11,.12) 0%,transparent 70%)', top:-80, right:-60, filter:'blur(60px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.07) 0%,transparent 70%)', bottom:-50, left:-50, filter:'blur(60px)', pointerEvents:'none' }} />

      <div style={{
        position:'relative', zIndex:1, width:'100%', maxWidth:400,
        background:'#0d1117', border:'1px solid #21262d', borderRadius:4,
        padding:'40px 36px 32px',
        boxShadow:'0 24px 64px rgba(0,0,0,.6)',
        transition:'opacity .45s ease, transform .45s ease',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)',
      }}>
        {/* Amber left bar */}
        <div style={{ position:'absolute', left:0, top:'20%', height:'60%', width:2, background:'linear-gradient(to bottom,transparent,#f59e0b,transparent)', borderRadius:'0 1px 1px 0' }} />

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'monospace', fontSize:10, letterSpacing:'.18em', color:'#f59e0b', border:'1px solid rgba(245,158,11,.25)', padding:'4px 10px', borderRadius:2, marginBottom:18 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#f59e0b', boxShadow:'0 0 6px #f59e0b', animation:'blink 1.5s step-end infinite' }} />
            SECURE ACCESS
          </div>
          <h1 style={{ fontFamily:'monospace', fontSize:32, fontWeight:800, color:'#f0f6fc', letterSpacing:'.08em', lineHeight:1, marginBottom:10 }}>NERDCP</h1>
          <p style={{ fontSize:12, lineHeight:1.6, color:'#8b949e' }}>National Emergency Response &<br />Dispatch Coordination Platform</p>
          <div style={{ margin:'20px auto 0', width:40, height:1, background:'linear-gradient(to right,transparent,#f59e0b,transparent)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }} noValidate>
          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', borderLeft:'3px solid #ef4444', color:'#f87171', fontFamily:'monospace', fontSize:12, padding:'10px 12px', borderRadius:2, animation:'shake .35s ease' }}>
              ⚠ {error}
            </div>
          )}

          <div>
            <label style={{ display:'block', fontFamily:'monospace', fontSize:9, letterSpacing:'.16em', color:'#8b949e', marginBottom:6 }}>EMAIL</label>
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#8b949e', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
              <input ref={emailRef} type="email" autoComplete="email" placeholder="operator@nerdcp.gov" value={email} onChange={e => { setEmail(e.target.value); setError('') }} disabled={loading}
                style={{ width:'100%', background:'#161b22', border:'1px solid #21262d', borderRadius:3, padding:'10px 12px 10px 36px', fontFamily:'monospace', fontSize:13, color:'#c9d1d9', outline:'none' }}
                onFocus={e => e.target.style.borderColor='#f59e0b'}
                onBlur={e => e.target.style.borderColor='#21262d'}
              />
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontFamily:'monospace', fontSize:9, letterSpacing:'.16em', color:'#8b949e', marginBottom:6 }}>PASSWORD</label>
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'#8b949e', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type={showPass ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••••" value={password} onChange={e => { setPassword(e.target.value); setError('') }} disabled={loading}
                style={{ width:'100%', background:'#161b22', border:'1px solid #21262d', borderRadius:3, padding:'10px 36px 10px 36px', fontFamily:'monospace', fontSize:13, color:'#c9d1d9', outline:'none' }}
                onFocus={e => e.target.style.borderColor='#f59e0b'}
                onBlur={e => e.target.style.borderColor='#21262d'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#8b949e', cursor:'pointer', display:'flex', alignItems:'center', padding:4 }}>
                {showPass
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background: loading ? '#92400e' : '#f59e0b', color:'#060810', border:'none', borderRadius:3, padding:'12px', fontFamily:'monospace', fontSize:13, fontWeight:700, letterSpacing:'.08em', cursor: loading ? 'not-allowed' : 'pointer', marginTop:4, transition:'background .2s' }}>
            {loading
              ? <><span style={{ width:13, height:13, border:'2px solid rgba(6,8,16,.3)', borderTopColor:'#060810', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> AUTHENTICATING…</>
              : '→ SIGN IN'
            }
          </button>
        </form>

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:18, borderTop:'1px solid #161b22' }}>
          <span style={{ fontFamily:'monospace', fontSize:8, color:'#21262d', letterSpacing:'.12em' }}>CLASSIFIED SYSTEM</span>
          <span style={{ fontFamily:'monospace', fontSize:8, color:'#21262d', letterSpacing:'.12em' }}>AUTHORISED ONLY</span>
        </div>
      </div>

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        *,*::before,*::after{box-sizing:border-box}
      `}</style>
    </div>
  )
}
