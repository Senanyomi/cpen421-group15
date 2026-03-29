const variants = {
  primary:  'bg-amber text-void hover:bg-amber-glow font-semibold',
  ghost:    'border border-border text-dim hover:border-amber hover:text-amber',
  danger:   'border border-critical/40 text-critical hover:bg-critical/10',
  success:  'border border-success/40 text-success hover:bg-success/10',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 rounded transition-all duration-150 font-mono
        ${variants[variant]} ${sizes[size]}
        ${disabled || loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
