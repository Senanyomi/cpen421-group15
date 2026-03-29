// Status → colour mappings used across many components
export const statusColor = {
  REPORTED:     'text-warning   border-warning',
  ACKNOWLEDGED: 'text-info      border-info',
  DISPATCHED:   'text-amber-glow border-amber',
  IN_PROGRESS:  'text-orange-400 border-orange-400',
  RESOLVED:     'text-success   border-success',
  CLOSED:       'text-dim       border-muted',
  // Vehicle statuses
  AVAILABLE:    'text-success   border-success',
  BUSY:         'text-warning   border-warning',
  OFFLINE:      'text-dim       border-muted',
  ON_SCENE:     'text-orange-400 border-orange-400',
  RETURNING:    'text-info      border-info',
}

export const statusDot = {
  REPORTED:     'warning',
  ACKNOWLEDGED: 'active',
  DISPATCHED:   'warning',
  IN_PROGRESS:  'critical',
  RESOLVED:     'active',
  CLOSED:       'offline',
  AVAILABLE:    'active',
  BUSY:         'warning',
  OFFLINE:      'offline',
  ON_SCENE:     'critical',
  RETURNING:    'warning',
}

export const severityColor = {
  CRITICAL: 'text-sev-critical',
  HIGH:     'text-sev-high',
  MEDIUM:   'text-sev-medium',
  LOW:      'text-sev-low',
}

export const typeIcon = {
  FIRE:             '🔥',
  MEDICAL:          '🚑',
  POLICE:           '🚔',
  NATURAL_DISASTER: '🌪️',
  HAZMAT:           '☢️',
  TRAFFIC:          '🚧',
  OTHER:            '⚠️',
}

export const vehicleIcon = {
  AMBULANCE:    '🚑',
  POLICE_CAR:   '🚔',
  FIRE_TRUCK:   '🚒',
  HAZMAT_UNIT:  '🛻',
  RESCUE_TEAM:  '🚁',
  COMMAND_UNIT: '📡',
}

export const formatTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatDateTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export const timeAgo = (iso) => {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const formatDuration = (sec) => {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export const apiError = (err) =>
  err?.response?.data?.message || err?.message || 'An unexpected error occurred.'
