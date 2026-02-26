type CircularGaugeProps = {
  /** 0–100 */
  percentage: number
  label: string
  size?: number
  strokeWidth?: number
}

export function CircularGauge({ percentage, label, size = 170, strokeWidth = 10 }: CircularGaugeProps) {
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percentage))
  const offset = circumference - (clamped / 100) * circumference

  const activeColor =
    clamped > 70 ? '#34D399'    // emerald-400 — healthy
    : clamped > 30 ? '#6EE7B7'  // emerald-300 — OK
    : clamped > 10 ? '#FBBF24'  // amber-400 — dry
    : '#F87171'                  // red-400 — very dry

  const gradientId = `gauge-g-${Math.round(clamped)}`

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={activeColor} stopOpacity={0.9} />
              <stop offset="100%" stopColor={activeColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-forest/[.06]" />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${activeColor}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-bold tabular-nums text-forest" aria-label={`${Math.round(clamped)} percent`}>
            {Math.round(clamped)}%
          </span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wider text-forest-400">
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
