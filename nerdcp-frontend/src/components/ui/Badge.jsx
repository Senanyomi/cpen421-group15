export default function Badge({ label, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono font-medium border ${className}`}>
      {label}
    </span>
  )
}
