export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-mono text-dim uppercase tracking-widest">
          {label}
        </label>
      )}
      <input
        className={`
          w-full bg-surface border rounded px-3 py-2 text-sm text-body font-mono
          placeholder:text-muted transition-colors
          focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber/20
          ${error ? 'border-critical' : 'border-border'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-2xs text-critical font-mono">{error}</p>}
    </div>
  )
}
